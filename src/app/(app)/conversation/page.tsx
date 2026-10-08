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

  const [initialContext, setInitialContext] = useState<
    ChatContextItem[] | undefined
  >(undefined)
  const [autoStart, setAutoStart] = useState(false)
  const [cefrLevel, setCefrLevel] = useState<string | null>(null)
  const [planReady, setPlanReady] = useState(false)
  const [voiceTrial, setVoiceTrial] = useState<VoiceTrial | null>(null)
  const handoffScopeRef = useRef<{ language: string | undefined } | null>(null)

  useEffect(() => {
    if (stripeEnabled && !isSubscribed(user, stripeEnabled)) {
      fetchFreemium()
    }
  }, [stripeEnabled, user, fetchFreemium])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setCefrLevel(null)
    // Consume a handoff once per language scope, not once per effect setup.
    // StrictMode replays effects; its second setup must retain the consumed
    // context/trial rather than clear a token already removed from storage.
    if (
      handoffScopeRef.current?.language !== activeLanguage?.code ||
      !handoffScopeRef.current
    ) {
      handoffScopeRef.current = { language: activeLanguage?.code }
      setInitialContext(undefined)
      setAutoStart(false)
      setVoiceTrial(null)
      const raw = sessionStorage.getItem('voice_context')
      if (raw) {
        sessionStorage.removeItem('voice_context')
        const context = parseVoiceContext(raw)
        if (context) {
          if (context.messages) setInitialContext(context.messages)
          setAutoStart(true)
        }
      }
      const trialRaw = sessionStorage.getItem('assessment_voice_trial')
      if (trialRaw) {
        sessionStorage.removeItem('assessment_voice_trial')
        const trial = parseVoiceTrial(trialRaw)
        if (trial) {
          setVoiceTrial(trial)
          setInitialContext([
            {
              role: 'user',
              content:
                'I just completed the placement assessment. Please start a short, friendly voice conversation adapted to my level.',
            },
          ])
          setAutoStart(true)
        }
      }
    }
    setPlanReady(false)
    apiFetch('/api/study-plan/today', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.cefr_level) setCefrLevel(data.cefr_level)
      })
      .catch(() => {
        /* No active plan — the backend resolves the language's default level. */
      })
      .finally(() => {
        if (active) setPlanReady(true)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [activeLanguage?.code])

  if (!planReady) return null

  let content
  if (voiceTrial) {
    content = (
      <ConversationMode
        initialContext={initialContext}
        autoStart={autoStart}
        cefrLevel={voiceTrial.cefrLevel ?? cefrLevel}
        targetLanguage={voiceTrial.targetLanguage ?? activeLanguage?.code}
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
        cefrLevel={cefrLevel}
        targetLanguage={activeLanguage?.code}
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
