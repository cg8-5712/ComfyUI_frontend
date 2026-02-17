import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type {
  ComfyCloudAuthHeader,
  ComfyCloudBalance,
  ComfyCloudUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse
} from '@/types/comfyCloudTypes'

const STORAGE_KEY = 'comfy_cloud_token'
const API_BASE = '/api'

// Internal error class for auth-related errors
class ComfyCloudAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ComfyCloudAuthError'
  }
}

export const useComfyCloudAuthStore = defineStore('comfyCloudAuth', () => {
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  // State
  const token = useLocalStorage<string | null>(STORAGE_KEY, null)
  const currentUser = ref<ComfyCloudUser | null>(null)
  const isInitialized = ref(false)
  const loading = ref(false)
  const balance = ref<ComfyCloudBalance | null>(null)
  const lastBalanceUpdateTime = ref<Date | null>(null)
  const isFetchingBalance = ref(false)

  // Computed
  const isAuthenticated = computed(() => !!currentUser.value && !!token.value)
  const userEmail = computed(() => currentUser.value?.email)
  const userId = computed(() => currentUser.value?.id)
  const userTier = computed(() => currentUser.value?.tier)

  // Helper: Build API URL
  const buildApiUrl = (path: string) => `${API_BASE}${path}`

  // Helper: Make authenticated request
  const fetchWithAuth = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    }

    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      token.value = null
      currentUser.value = null
      throw new ComfyCloudAuthError(t('toastMessages.userNotAuthenticated'))
    }

    return response
  }

  // Fetch user info
  const fetchUserInfo = async (): Promise<ComfyCloudUser> => {
    const response = await fetchWithAuth(buildApiUrl('/user/info'))

    if (!response.ok) {
      const errorData = await response.json()
      throw new ComfyCloudAuthError(
        errorData.error || 'Failed to fetch user info'
      )
    }

    const userData: ComfyCloudUser = await response.json()
    currentUser.value = userData
    return userData
  }

  // Fetch balance
  const fetchBalance = async (): Promise<ComfyCloudBalance | null> => {
    if (!isAuthenticated.value) return null

    isFetchingBalance.value = true
    try {
      const response = await fetchWithAuth(buildApiUrl('/user/balance'))

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        const errorData = await response.json()
        throw new ComfyCloudAuthError(
          errorData.error || 'Failed to fetch balance'
        )
      }

      const balanceData: ComfyCloudBalance = await response.json()
      balance.value = balanceData
      lastBalanceUpdateTime.value = new Date()
      return balanceData
    } finally {
      isFetchingBalance.value = false
    }
  }

  // Login
  const login = wrapWithErrorHandlingAsync(
    async (username: string, password: string): Promise<LoginResponse> => {
      loading.value = true

      try {
        const requestBody: LoginRequest = { username, password }
        const response = await fetch(buildApiUrl('/auth/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new ComfyCloudAuthError(errorData.error || 'Login failed')
        }

        const data: LoginResponse = await response.json()
        token.value = data.token
        currentUser.value = data.user

        toastStore.add({
          severity: 'success',
          summary: t('auth.login.success'),
          life: 3000
        })

        // Fetch balance after login
        void fetchBalance()

        return data
      } finally {
        loading.value = false
      }
    },
    toastErrorHandler
  )

  // Register
  const register = wrapWithErrorHandlingAsync(
    async (
      username: string,
      email: string,
      password: string
    ): Promise<RegisterResponse> => {
      loading.value = true

      try {
        const requestBody: RegisterRequest = { username, email, password }
        const response = await fetch(buildApiUrl('/auth/register'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new ComfyCloudAuthError(
            errorData.error || 'Registration failed'
          )
        }

        const data: RegisterResponse = await response.json()
        token.value = data.token
        currentUser.value = data.user

        toastStore.add({
          severity: 'success',
          summary: t('auth.register.success'),
          life: 3000
        })

        return data
      } finally {
        loading.value = false
      }
    },
    toastErrorHandler
  )

  // Logout
  const logout = wrapWithErrorHandlingAsync(async (): Promise<void> => {
    loading.value = true

    try {
      // Call logout API (optional, for server-side cleanup)
      if (token.value) {
        await fetchWithAuth(buildApiUrl('/auth/logout'), {
          method: 'POST'
        }).catch(() => {
          // Ignore errors, clear local state anyway
        })
      }

      // Clear local state
      token.value = null
      currentUser.value = null
      balance.value = null
      lastBalanceUpdateTime.value = null

      toastStore.add({
        severity: 'info',
        summary: t('auth.logout.success'),
        life: 3000
      })
    } finally {
      loading.value = false
    }
  }, toastErrorHandler)

  // Refresh token
  const refreshToken = async (): Promise<string | null> => {
    if (!token.value) return null

    try {
      const response = await fetchWithAuth(buildApiUrl('/auth/refresh'), {
        method: 'POST'
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      token.value = data.token
      return data.token
    } catch {
      return null
    }
  }

  // Get auth header
  const getAuthHeader = (): ComfyCloudAuthHeader | null => {
    if (!token.value) return null
    return {
      Authorization: `Bearer ${token.value}`
    }
  }

  // Get auth token (for WebSocket)
  const getAuthToken = (): string | null => {
    return token.value
  }

  // Watch token changes
  watch(
    token,
    async (newToken) => {
      if (newToken) {
        // Token exists, fetch user info
        try {
          await fetchUserInfo()
          isInitialized.value = true
        } catch (error) {
          console.error('Failed to fetch user info:', error)
          token.value = null
          isInitialized.value = true
        }
      } else {
        // Token cleared
        currentUser.value = null
        balance.value = null
        isInitialized.value = true
      }
    },
    { immediate: true }
  )

  return {
    // State
    currentUser,
    isAuthenticated,
    isInitialized,
    loading,
    balance,
    lastBalanceUpdateTime,
    isFetchingBalance,

    // Computed
    userEmail,
    userId,
    userTier,

    // Actions
    login,
    register,
    logout,
    fetchUserInfo,
    fetchBalance,
    refreshToken,
    getAuthHeader,
    getAuthToken
  }
})
