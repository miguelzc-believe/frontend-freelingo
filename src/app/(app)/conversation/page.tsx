/**
 * /conversation — Voice conversation page.
 *
 * Explicit voice-message recording uses the browser AudioWorklet API.
 * The conversation screen is lazy-loaded inside the client-only app layout.
 */
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import type { ChatContextItem } from '@/lib/conversation-api'
import { PageLoading } from '@/components/ui/page-loading'
import { FreemiumQuotaBanner } from '@/components/billing/FreemiumQuotaBanner'
import { PaywallBanner } from '@/components/billing/PaywallBanner'
import { MaintenanceGate } from '@/components/billing/MaintenanceBanner'
import { apiFetch } from '@/lib/api'
import { useLanguageStore } from '@/store/language'
import { useConfigStore } from '@/store/config'
import { useAuthStore, isSubscribed, isFreemiumTrialActive } from '@/store/auth'
import { useFreemiumStore } from '@/store/freemium'

function ConversationLoading() {
  return <PageLoading minHeight="min-h-[calc(100vh-56px)] md:min-h-screen" />
}

const LazyConversationMode = lazy(
  () => import('@/components/conversation/ConversationMode')
)

function ConversationMode(
  props: Readonly<React.ComponentProps<typeof LazyConversationMode>>
) {
  return (
    <Suspense fallback={<ConversationLoading />}>
      <LazyConversationMode {...props} />
    </Suspense>
  )
}

interface VoiceTrial {
  token: string
  durationSeconds: number
  cefrLevel?: string | undefined
  targetLanguage?: string | undefined
}

interface ConversationScope {
  language: string | undefined
  userId: number | undefined
}

interface ScopedHandoff {
  scope: ConversationScope
  initialContext: ChatContextItem[] | undefined
  autoStart: boolean
  voiceTrial: VoiceTrial | null
}

interface ScopedPlan {
  scope: ConversationScope
  cefrLevel: string | null
  ready: boolean
}

function matchesScope(
  scope: ConversationScope,
  language: string | undefined,
  userId: number | undefined
) {
  return scope.language === language && scope.userId === userId
}

function parseVoiceContext(
  raw: string
): { messages?: ChatContextItem[] } | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'messages' in parsed) {
      return Array.isArray(parsed.messages)
        ? { messages: parsed.messages as ChatContextItem[] }
        : {}
    }
    if (Array.isArray(parsed)) return { messages: parsed as ChatContextItem[] }
  } catch {
    // malformed — ignore
  }
  return null
}

function parseVoiceTrial(raw: string): VoiceTrial | null {
  try {
    const parsed = JSON.parse(raw) as {
      token?: unknown
      durationSeconds?: unknown
      cefrLevel?: unknown
      targetLanguage?: unknown
    }
    if (typeof parsed.token !== 'string' || parsed.token.length === 0)
      return null
    return {
      token: parsed.token,
      durationSeconds:
        typeof parsed.durationSeconds === 'number'
          ? parsed.durationSeconds
          : 300,
      cefrLevel:
        typeof parsed.cefrLevel === 'string' ? parsed.cefrLevel : undefined,
      targetLanguage:
        typeof parsed.targetLanguage === 'string'
          ? parsed.targetLanguage
          : undefined,
    }
  } catch {
    // malformed — ignore
    return null
  }
}

export default function ConversationPage() {
  const activeLanguage = useLanguageStore((s) => s.activeLanguage)
  const stripeEnabled = useConfigStore((s) => s.stripeEnabled)
  const user = useAuthStore((s) => s.user)
  const fetchFreemium = useFreemiumStore((s) => s.fetchStatus)
  const freemiumStatus = useFreemiumStore((s) => s.status)
  const freemiumExhausted =
    stripeEnabled &&
    !isSubscribed(user, stripeEnabled) &&
    !isFreemiumTrialActive(user, stripeEnabled) &&
    freemiumStatus &&
    freemiumStatus.voice_remaining_seconds <= 0

  const freemiumVoiceRemaining = freemiumStatus
    ? Math.ceil(freemiumStatus.voice_remaining_seconds / 60)
    : undefined
  const freemiumVoiceLimit = freemiumStatus
    ? Math.ceil(freemiumStatus.voice_limit_seconds / 60)
    : undefined
  const showFreemiumVoicePill =
    stripeEnabled &&
    !isSubscribed(user, stripeEnabled) &&
    !isFreemiumTrialActive(user, stripeEnabled) &&
    freemiumStatus &&
    freemiumStatus.voice_limit_seconds > 0

  const languageCode = activeLanguage?.code
  const userId = user?.id
  const [handoff, setHandoff] = useState<ScopedHandoff | null>(null)
  const [plan, setPlan] = useState<ScopedPlan | null>(null)
  const handoffScopeRef = useRef<ConversationScope | null>(null)

  useEffect(() => {
    if (stripeEnabled && !isSubscribed(user, stripeEnabled)) {
      fetchFreemium()
    }
  }, [stripeEnabled, user, fetchFreemium])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const scope = { language: languageCode, userId }
    // Consume a handoff once per scope, not once per effect setup.
    // StrictMode replays effects; its second setup must retain the consumed
    // context/trial rather than clear a token already removed from storage.
    if (
      !handoffScopeRef.current ||
      !matchesScope(handoffScopeRef.current, languageCode, userId)
    ) {
      handoffScopeRef.current = scope
      let initialContext: ChatContextItem[] | undefined
      let autoStart = false
      let voiceTrial: VoiceTrial | null = null
      const raw = sessionStorage.getItem('voice_context')
      if (raw) {
        sessionStorage.removeItem('voice_context')
        const context = parseVoiceContext(raw)
        if (context) {
          initialContext = context.messages
          autoStart = true
        }
      }
      const trialRaw = sessionStorage.getItem('assessment_voice_trial')
      if (trialRaw) {
        sessionStorage.removeItem('assessment_voice_trial')
        const trial = parseVoiceTrial(trialRaw)
        if (trial) {
          voiceTrial = trial
          initialContext = [
            {
              role: 'user',
              content:
                'I just completed the placement assessment. Please start a short, friendly voice conversation adapted to my level.',
            },
          ]
          autoStart = true
        }
      }
      setHandoff({ scope, initialContext, autoStart, voiceTrial })
    }
    setPlan({ scope, cefrLevel: null, ready: false })
    apiFetch('/api/study-plan/today', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.cefr_level) {
          setPlan((current) =>
            current && matchesScope(current.scope, languageCode, userId)
              ? { ...current, cefrLevel: data.cefr_level }
              : current
          )
        }
      })
      .catch(() => {
        /* No active plan — the backend resolves the language's default level. */
      })
      .finally(() => {
        if (active) {
          setPlan((current) =>
            current && matchesScope(current.scope, languageCode, userId)
              ? { ...current, ready: true }
              : current
          )
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [languageCode, userId])

  // Effects run after render. Never pass an old owner's handoff or readiness
  // to a conversation rendered with the newly selected language/account.
  if (!plan || !matchesScope(plan.scope, languageCode, userId) || !plan.ready)
    return null
  const currentHandoff =
    handoff && matchesScope(handoff.scope, languageCode, userId)
      ? handoff
      : null
  const initialContext = currentHandoff?.initialContext
  const autoStart = currentHandoff?.autoStart ?? false
  const voiceTrial = currentHandoff?.voiceTrial

  let content
  if (voiceTrial) {
    content = (
      <ConversationMode
        initialContext={initialContext}
        autoStart={autoStart}
        cefrLevel={voiceTrial.cefrLevel ?? plan.cefrLevel}
        targetLanguage={voiceTrial.targetLanguage ?? languageCode}
        voiceTrialToken={voiceTrial.token}
        voiceTrialDurationSeconds={voiceTrial.durationSeconds}
        trialMode
      />
    )
  } else if (freemiumExhausted) {
    content = (
      <>
        <FreemiumQuotaBanner feature="voice" className="mb-4" />
        <PaywallBanner feature="voice" compact />
      </>
    )
  } else {
    content = (
      <ConversationMode
        initialContext={initialContext}
        autoStart={autoStart}
        cefrLevel={plan.cefrLevel}
        targetLanguage={languageCode}
        freemiumVoiceRemaining={
          showFreemiumVoicePill ? freemiumVoiceRemaining : undefined
        }
        freemiumVoiceLimit={
          showFreemiumVoicePill ? freemiumVoiceLimit : undefined
        }
      />
    )
  }
  return <MaintenanceGate>{content}</MaintenanceGate>
}
