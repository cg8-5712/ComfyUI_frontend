/**
 * Type definitions for Comfy-Cloud API
 */

// Currently used types
export type SubscriptionTier = 'basic' | 'pro' | 'enterprise'

// Reserved for future features (Phase 2.6 - Management Platform)
/** @knipignore */
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

/** @knipignore */
export type UsageRecordType = 'gpu_usage' | 'storage' | 'bandwidth'

export interface ComfyCloudUser {
  id: number
  username: string
  email: string
  tier: SubscriptionTier
  balance: number
  storage_used: number
  storage_limit: number
  created_at: string
  subscription?: ComfyCloudSubscription
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ComfyCloudSubscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  started_at: string
  expires_at: string
  auto_renew: boolean
  features: {
    gpu_access: boolean
    vip_models: boolean
    storage_limit_gb: number
    concurrent_tasks: number
  }
}

export interface ComfyCloudBalance {
  balance: number
  currency: string
  last_updated: string
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ComfyCloudUsageStats {
  period: 'day' | 'week' | 'month' | 'year'
  start_date: string
  end_date: string
  gpu_seconds: number
  storage_gb_hours: number
  total_cost: number
  task_count: number
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ComfyCloudUsageRecord {
  id: number
  task_id: string
  type: UsageRecordType
  started_at: string
  ended_at: string
  duration_seconds: number
  cost: number
  details: Record<string, unknown>
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ComfyCloudModel {
  id: number
  name: string
  type: 'checkpoint' | 'lora' | 'vae' | 'embedding'
  size_bytes: number
  uploaded_at: string
  storage_cost_per_day: number
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ComfyCloudSettings {
  notifications: {
    email_on_task_complete: boolean
    email_on_low_balance: boolean
    low_balance_threshold: number
  }
  preferences: {
    language: string
    timezone: string
  }
}

// API Request/Response types

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: ComfyCloudUser
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface RegisterResponse {
  token: string
  user: ComfyCloudUser
}

/** @knipignore - Reserved for Phase 2.6 */
export interface ApiErrorResponse {
  error: string
  code?: string
  details?: Record<string, unknown>
}

export interface ComfyCloudAuthHeader {
  Authorization: string
}
