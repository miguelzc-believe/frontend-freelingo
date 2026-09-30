import type { User, SubscriptionStatus } from '@/store/auth'
import type { UserLanguageInfo } from '@/store/language'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
function nullableString(
  value: unknown,
  fallback: string | null = null
): string | null {
  return typeof value === 'string' ? value : fallback
}
function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}
const subscriptionStatuses: SubscriptionStatus[] = [
  'none',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]

/** Validate external values and preserve the current user's optional PATCH fields. */
export function mapUser(value: unknown, current?: User | null): User {
  const data = record(value)
  const subscription = subscriptionStatuses.find(
    (status) => status === data.subscription_status
  )
  return {
    id: number(data.id, current?.id),
    username: string(data.username, current?.username),
    displayName: string(data.display_name, current?.displayName),
    ...(typeof data.email === 'string' ? { email: data.email } : {}),
    ...(typeof data.native_language === 'string'
      ? { native_language: data.native_language }
      : {}),
    ...(typeof data.target_language === 'string'
      ? { target_language: data.target_language }
      : {}),
    ui_locale: nullableString(data.ui_locale, current?.ui_locale),
    role:
      data.role === 'admin' || data.role === 'user'
        ? data.role
        : (current?.role ?? 'user'),
    conversation_max_duration: number(
      data.conversation_max_duration,
      current?.conversation_max_duration
    ),
    conversation_inactivity_timeout: number(
      data.conversation_inactivity_timeout,
      current?.conversation_inactivity_timeout
    ),
    ...(typeof data.conversation_speech_pause === 'number'
      ? { conversation_speech_pause: data.conversation_speech_pause }
      : {}),
    avatar:
      'avatar' in data
        ? nullableString(data.avatar)
        : (current?.avatar ?? null),
    is_verified: boolean(data.is_verified, current?.is_verified ?? true),
    bio: nullableString(data.bio, current?.bio),
    learning_goals: Array.isArray(data.learning_goals)
      ? data.learning_goals.filter(
          (goal): goal is string => typeof goal === 'string'
        )
      : (current?.learning_goals ?? null),
    subscription_status: subscription ?? current?.subscription_status ?? 'none',
    subscription_ends_at: nullableString(
      data.subscription_ends_at,
      current?.subscription_ends_at
    ),
    cancel_at_period_end: boolean(
      data.cancel_at_period_end,
      current?.cancel_at_period_end
    ),
    trial_used: boolean(data.trial_used, current?.trial_used),
    assessment_voice_trial_used: boolean(
      data.assessment_voice_trial_used,
      current?.assessment_voice_trial_used
    ),
    freemium_trial_ends_at: nullableString(
      data.freemium_trial_ends_at,
      current?.freemium_trial_ends_at
    ),
    freemium_trial_used: boolean(
      data.freemium_trial_used,
      current?.freemium_trial_used
    ),
    dismissed_dashboard_banner_revision:
      typeof data.dismissed_dashboard_banner_revision === 'number'
        ? data.dismissed_dashboard_banner_revision
        : (current?.dismissed_dashboard_banner_revision ?? null),
  }
}
export function mapUserLanguageInfo(value: unknown): UserLanguageInfo {
  const data = record(value)
  const plan = record(data.plan)
  const progress = record(data.progress)
  return {
    target_language: string(data.target_language, 'en-GB'),
    is_active: boolean(data.is_active),
    plan: data.plan
      ? {
          id: number(plan.id),
          cefr_level: nullableString(plan.cefr_level),
          progress_day: number(plan.progress_day),
          total_days: number(plan.total_days),
          completion_pct: number(plan.completion_pct),
        }
      : null,
    progress: data.progress
      ? {
          total_xp: number(progress.total_xp),
          current_streak: number(progress.current_streak),
          lessons_completed: number(progress.lessons_completed),
        }
      : null,
  }
}
