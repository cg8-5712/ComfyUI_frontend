<template>
  <div
    v-if="isAuthenticated"
    ref="widgetRef"
    class="comfy-cloud-user-widget"
    :style="widgetStyle"
  >
    <div
      class="drag-handle"
      title="拖动调整位置"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <svg
        width="6"
        height="16"
        viewBox="0 0 6 16"
        fill="currentColor"
        opacity="0.5"
      >
        <circle cx="3" cy="3" r="1.5" />
        <circle cx="3" cy="8" r="1.5" />
        <circle cx="3" cy="13" r="1.5" />
      </svg>
    </div>
    <button
      class="user-button"
      :class="{ 'balance-low': isBalanceLow }"
      @click="toggleMenu"
    >
      <span class="username">{{ username }}</span>
      <span class="balance">¥{{ formattedBalance }}</span>
      <span class="tier-badge" :class="`tier-${tier}`">{{ tierLabel }}</span>
    </button>

    <div v-if="showMenu" class="dropdown-menu">
      <div class="menu-header">
        <div class="user-info">
          <p class="user-name">{{ username }}</p>
          <p class="user-email">{{ email }}</p>
        </div>
      </div>

      <div class="menu-section">
        <div class="balance-info">
          <span class="label">余额</span>
          <span class="value" :class="{ 'text-danger': isBalanceLow }">
            ¥{{ formattedBalance }}
          </span>
        </div>
        <div class="tier-info">
          <span class="label">订阅</span>
          <span class="value">{{ tierLabel }}</span>
        </div>
      </div>

      <div class="menu-divider" />

      <div class="menu-actions">
        <a :href="accountUrl" class="menu-item" target="_blank">
          <span>我的账户</span>
        </a>
        <button class="menu-item" @click="handleLogout">
          <span>退出登录</span>
        </button>
      </div>
    </div>

    <div v-if="showMenu" class="menu-overlay" @click="closeMenu" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useComfyCloudAuthStore } from '@/stores/comfyCloudAuthStore'

const authStore = useComfyCloudAuthStore()
const showMenu = ref(false)
const widgetRef = ref<HTMLElement | null>(null)

// 管理平台 URL（从环境变量读取，或使用当前域名）
const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_URL || window.location.origin

// 保存位置到 localStorage
const savedPosition = useLocalStorage<{ x: number; y: number }>(
  'comfy_cloud_widget_position',
  { x: window.innerWidth - 250, y: 16 }
)

// 拖拽状态
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 计算组件位置样式
const widgetStyle = computed(() => ({
  left: `${savedPosition.value.x}px`,
  top: `${savedPosition.value.y}px`
}))

// 计算属性
const isAuthenticated = computed(() => authStore.isAuthenticated)
const username = computed(() => authStore.currentUser?.username || '')
const email = computed(() => authStore.currentUser?.email || '')
const balance = computed(() => authStore.balance?.balance || 0)
const tier = computed(() => authStore.currentUser?.tier || 'basic')
const isBalanceLow = computed(() => balance.value < 10)

const formattedBalance = computed(() => {
  return balance.value.toFixed(2)
})

const tierLabel = computed(() => {
  const labels: Record<string, string> = {
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise'
  }
  return labels[tier.value] || tier.value
})

const accountUrl = computed(() => `${ADMIN_BASE_URL}/account`)

// 拖拽功能
const startDrag = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  isDragging.value = true

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  dragOffset.value = {
    x: clientX - savedPosition.value.x,
    y: clientY - savedPosition.value.y
  }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  let newX = clientX - dragOffset.value.x
  let newY = clientY - dragOffset.value.y

  // 边界限制
  const maxX = window.innerWidth - (widgetRef.value?.offsetWidth || 200)
  const maxY = window.innerHeight - (widgetRef.value?.offsetHeight || 100)

  newX = Math.max(0, Math.min(newX, maxX))
  newY = Math.max(0, Math.min(newY, maxY))

  savedPosition.value = { x: newX, y: newY }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

// 切换菜单
const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const closeMenu = () => {
  showMenu.value = false
}

// 登出
const handleLogout = async () => {
  closeMenu()
  await authStore.logout()
  window.location.href = `${ADMIN_BASE_URL}/login`
}

// 定时刷新余额（每 30 秒）
let balanceInterval: number | null = null

onMounted(() => {
  // 初始加载余额
  void authStore.fetchBalance()

  // 每 30 秒刷新一次
  balanceInterval = window.setInterval(() => {
    void authStore.fetchBalance()
  }, 30000)
})

onUnmounted(() => {
  if (balanceInterval) {
    clearInterval(balanceInterval)
  }
})
</script>

<style scoped>
.comfy-cloud-user-widget {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 100%;
  cursor: move;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;
  user-select: none;
}

.drag-handle:hover {
  color: rgba(255, 255, 255, 0.8);
}

.drag-handle:active {
  cursor: grabbing;
}

.user-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.user-button:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
}

.user-button.balance-low {
  border-color: rgba(239, 68, 68, 0.5);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    border-color: rgba(239, 68, 68, 0.5);
  }
  50% {
    border-color: rgba(239, 68, 68, 1);
  }
}

.username {
  font-weight: 500;
}

.balance {
  font-weight: 600;
  color: #10b981;
}

.balance-low .balance {
  color: #ef4444;
}

.tier-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.tier-basic {
  background: rgba(107, 114, 128, 0.3);
  color: #d1d5db;
}

.tier-pro {
  background: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.tier-enterprise {
  background: rgba(168, 85, 247, 0.3);
  color: #c084fc;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 16rem;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.menu-header {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-weight: 600;
  color: white;
  margin: 0;
}

.user-email {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.menu-section {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.balance-info,
.tier-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}

.value {
  font-weight: 600;
  color: white;
}

.text-danger {
  color: #ef4444;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.menu-actions {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: white;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.875rem;
  width: 100%;
  text-align: left;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
}
</style>
