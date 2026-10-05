import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from '@/lib/navigation'
import Image from '@/components/ui/app-image'
import { useTranslations } from 'use-intl'
import { apiFetch } from '@/lib/api'
import {
  useAuthStore,
  isSubscribed,
  isFreemiumTrialActive,
  type User,
} from '@/store/auth'
import { useLanguageStore } from '@/store/language'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AudioPlayer } from '@/components/ui/AudioPlayer'
import { MaintenanceGate } from '@/components/billing/MaintenanceBanner'
import { PaywallBanner } from '@/components/billing/PaywallBanner'
import { FreemiumQuotaBanner } from '@/components/billing/FreemiumQuotaBanner'
import { useFreemiumStore } from '@/store/freemium'
import { useConfigStore } from '@/store/config'
import { WordTooltip, useWordSave } from '@/components/ui/WordTooltip'
import { PageLoading } from '@/components/ui/page-loading'
import { TargetLanguageText } from '@/components/TargetLanguageText'
import { AuthAvatarImage } from '@/components/AuthAvatarImage'
import { MemorySavedToast } from '@/components/memory/MemorySavedToast'
import { useTransientToast } from '@/hooks/useTransientToast'
import { readSseData } from '@/lib/sse'

import {
  createMessage,
  mergeMessage,
  type Message,
  type MessageContent,
} from '@/lib/chat-messages'

interface Conversation {
  id: number
  title: string
  source: string
  created_at: string
  updated_at: string
}

interface ChatSseEvent {
  conversation_id?: number
  token?: string
  response_reset?: boolean
  error?: string
  done?: boolean
  memory_updated?: boolean
}

function renderConversationList({
  loading,
  loadError,
  conversations,
  activeId,
  onRetry,
  onSelect,
  onDelete,
  labels,
}: Readonly<{
  loading: boolean
  loadError: boolean
  conversations: readonly Conversation[]
  activeId: number | null
  onRetry: () => void
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  labels: Readonly<{
    error: string
    retry: string
    noConversation: string
    voiceSession: string
    deleteConfirm: string
  }>
}>) {
  if (loading) {
    return <PageLoading fullScreen={false} className="block px-4 py-4" />
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <p className="text-fl-error font-mono text-xs">{labels.error}</p>
        <button
          onClick={onRetry}
          className="border-fl-border text-fl-label text-fl-muted-1 hover:text-fl-fg hover:border-fl-border-2 border px-4 py-2 font-mono tracking-widest uppercase transition-colors"
        >
          {labels.retry}
        </button>
      </div>
    )
  }
  if (conversations.length === 0) {
    return (
      <p className="text-fl-label text-fl-muted-4 px-4 py-4 font-mono">
        {labels.noConversation}
      </p>
    )
  }
  return conversations.map((c) => (
    <div
      key={c.id}
      className={`group border-fl-surface-2 flex items-stretch justify-between border-b transition-colors ${
        activeId === c.id
          ? 'bg-fl-surface-2 border-l-fl-fg border-l-2'
          : 'hover:bg-fl-surface border-l-2 border-l-transparent'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        className={`text-fl-label focus-visible:outline-fl-fg min-w-0 flex-1 cursor-pointer truncate py-3 pr-1 pl-4 text-left font-mono leading-tight focus-visible:outline-2 focus-visible:-outline-offset-2 ${activeId === c.id ? 'text-fl-fg' : 'text-fl-muted-1'}`}
      >
        {c.source === 'voice' && (
          <span className="text-fl-muted-3 mr-1.5" title={labels.voiceSession}>
            🎤
          </span>
        )}
        {c.title}
      </button>
      <button
        type="button"
        onClick={() => onDelete(c.id)}
        className="text-fl-label text-fl-error-fg hover:text-fl-error focus-visible:outline-fl-fg shrink-0 cursor-pointer py-3 pr-4 font-mono opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2"
        title={labels.deleteConfirm}
        aria-label={labels.deleteConfirm}
      >
        ✕
      </button>
    </div>
  ))
}

function renderChatAction({
  sending,
  sendingWarn,
  hasMessages,
  onContinueInVoice,
  labels,
}: Readonly<{
  sending: boolean
  sendingWarn: boolean
  hasMessages: boolean
  onContinueInVoice: () => void
  labels: Readonly<{
    thinking: string
    takingLonger: string
    continueInVoice: string
  }>
}>) {
  if (sending) {
    return (
      <div className="ml-auto flex flex-col items-end gap-0.5">
        <span className="text-fl-hint text-fl-muted-3 animate-pulse font-mono tracking-widest uppercase">
          {labels.thinking}
        </span>
        {sendingWarn && (
          <span className="text-fl-hint font-mono tracking-widest text-amber-500 uppercase">
            {labels.takingLonger}
          </span>
        )}
      </div>
    )
  }
  if (!hasMessages) return null
  return (
    <button
      onClick={onContinueInVoice}
      className="text-fl-hint text-fl-muted-2 hover:text-fl-fg ml-auto font-mono tracking-widest uppercase transition-colors"
    >
      {labels.continueInVoice}
    </button>
  )
}

function renderMessageAvatar(
  role: Message['role'],
  user: Readonly<User> | null
) {
  if (role === 'assistant') {
    return (
      <Image
        src="/logo_head.png"
        alt="Lingu"
        width={28}
        height={28}
        className="h-full w-full object-cover"
      />
    )
  }
  const fallback = (
    <div className="bg-fl-surface-2 flex h-full w-full items-center justify-center">
      <span className="text-fl-hint text-fl-muted-1 font-mono select-none">
        {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
      </span>
    </div>
  )
  if (!user?.avatar) return fallback
  return (
    <AuthAvatarImage
      avatar={user.avatar}
      alt=""
      width={28}
      height={28}
      className="h-full w-full object-cover"
      fallback={fallback}
    />
  )
}

function renderChatMessages({
  loading,
  messages,
  sending,
  user,
  targetLanguageCode,
  onTextSelection,
  title,
  subtitle,
}: Readonly<{
  loading: boolean
  messages: readonly Message[]
  sending: boolean
  user: Readonly<User> | null
  targetLanguageCode: string
  onTextSelection: (content: string) => void
  title: string
  subtitle: string
}>) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <PageLoading fullScreen={false} />
      </div>
    )
  }
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
          {title}
        </p>
        <p className="text-fl-muted-2 max-w-xs font-mono text-xs leading-relaxed">
          {subtitle}
        </p>
      </div>
    )
  }
  return messages.map((msg, i) => (
    <div
      key={msg.id}
      className={`flex items-end gap-2 ${msg.role === 'user' ? 'ml-auto max-w-[75%] flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className="border-fl-border mb-0.5 h-7 w-7 flex-shrink-0 overflow-hidden rounded-full border">
        {renderMessageAvatar(msg.role, user)}
      </div>
      <div className={`max-w-[75%] min-w-[10rem] text-left`}>
        <TargetLanguageText
          as="div"
          languageCode={targetLanguageCode}
          className={`word-selectable max-w-[70ch] border px-4 py-3 text-left ${
            msg.role === 'user'
              ? 'bg-fl-accent text-fl-accent-fg border-fl-accent'
              : 'bg-fl-surface text-fl-fg-2 border-fl-border'
          }`}
          onPointerUp={
            msg.role === 'assistant' && !(sending && i === messages.length - 1)
              ? () => onTextSelection(msg.content)
              : undefined
          }
        >
          {msg.content ||
            (sending && i === messages.length - 1 ? (
              <span className="text-fl-muted-2 animate-pulse">▌</span>
            ) : null)}
        </TargetLanguageText>
        {msg.role === 'assistant' &&
          msg.content &&
          !(sending && i === messages.length - 1) && (
            <div className="mt-1">
              <AudioPlayer text={msg.content} size="sm" />
            </div>
          )}
      </div>
    </div>
  ))
}

export default function ChatPage() {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const tLang = useTranslations('targetLanguages')
  const tQuota = useTranslations('conversation')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const activeLanguage = useLanguageStore((s) => s.activeLanguage)
  const {
    selectedWord,
    tooltipPos,
    saveState,
    handleTextSelection,
    handleSaveWord,
    dismissTooltip,
  } = useWordSave()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendingWarn, setSendingWarn] = useState(false)
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [convLoadError, setConvLoadError] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [deletePending, setDeletePending] = useState<number | null>(null)
  const {
    visible: memoryToast,
    announcementId: memoryToastId,
    show: showMemoryToast,
  } = useTransientToast()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const targetLanguageCode = activeLanguage?.code ?? 'en-GB'

  const stripeEnabled = useConfigStore((s) => s.stripeEnabled)
  const freemiumStatus = useFreemiumStore((s) => s.status)
  const fetchFreemium = useFreemiumStore((s) => s.fetchStatus)
  const decrementFreemium = useFreemiumStore((s) => s.decrement)
  const freemiumExhausted =
    stripeEnabled &&
    !isSubscribed(user, stripeEnabled) &&
    !isFreemiumTrialActive(user, stripeEnabled) &&
    freemiumStatus &&
    freemiumStatus.chat_remaining <= 0

  useEffect(() => {
    if (stripeEnabled && !isSubscribed(user, stripeEnabled)) {
      fetchFreemium()
    }
  }, [stripeEnabled, user, fetchFreemium])

  const scrollBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, scrollBottom])

  // Open sidebar by default only on desktop
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  // Warn if LLM takes longer than 60 s
  useEffect(() => {
    if (sending) {
      setSendingWarn(false)
      sendingTimerRef.current = setTimeout(() => setSendingWarn(true), 60_000)
    } else {
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current)
      setSendingWarn(false)
    }
    return () => {
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current)
    }
  }, [sending])

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/chat/conversations')
      if (res.ok) {
        const data: Conversation[] = await res.json()
        setConversations(data)
        return data
      }
    } catch {
      /* ignore */
    }
    return null
  }, [])

  // Load conversations on mount, auto-select the most recent
  useEffect(() => {
    async function init() {
      setConvLoadError(false)
      setLoadingConvs(true)
      const data = await loadConversations()
      if (data === null) {
        setConvLoadError(true)
        setLoadingConvs(false)
        return
      }
      if (data[0]) {
        selectConversation(data[0].id)
      } else {
        setActiveId(null)
        setMessages([])
      }
      setLoadingConvs(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLanguage?.code])

  async function selectConversation(id: number) {
    dismissTooltip()
    if (window.innerWidth < 768) setSidebarOpen(false)
    setActiveId(id)
    setMessages([])
    setError('')
    setLoadingMsgs(true)
    try {
      const res = await apiFetch(`/api/chat/conversations/${id}/messages`)
      if (res.ok) {
        const data = await res.json()
        const history: MessageContent[] = data.messages || []
        const records = history.map(createMessage)
        setMessages(records)
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMsgs(false)
    }
  }

  function retryConversations() {
    setConvLoadError(false)
    setLoadingConvs(true)
    loadConversations()
      .then((data) => {
        if (data === null) {
          setConvLoadError(true)
        } else if (data[0]) {
          selectConversation(data[0].id)
        }
      })
      .finally(() => setLoadingConvs(false))
  }

  async function newChat() {
    // Don't create — let the first message auto-create the conversation
    dismissTooltip()
    setActiveId(null)
    setMessages([])
    setError('')
    if (window.innerWidth < 768) setSidebarOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function continueInVoice() {
    const context = messages
      .filter((m) => m.content.trim().length > 0)
      .slice(-20)
      .map(({ role, content }) => ({ role, content }))
    // Only pass the message context — no conversation_id.
    // The voice session will create its own new conversation record so the
    // original text chat stays clean and the two appear as separate entries
    // in the sidebar (the voice one gets the 🎤 icon).
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify({
        messages: context,
      })
    )
    router.push('/conversation')
  }

  async function deleteConversation(id: number) {
    await apiFetch(`/api/chat/conversations/${id}`, { method: 'DELETE' })
    setDeletePending(null)
    const updated = await loadConversations()
    if (updated === null) {
      setConvLoadError(true)
      return
    }
    if (activeId === id) {
      if (updated[0]) {
        selectConversation(updated[0].id)
      } else {
        setActiveId(null)
        setMessages([])
      }
    }
  }

  async function getChatErrorMessage(res: Response) {
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      if (
        typeof data.detail === 'string' &&
        data.detail.startsWith('Monthly token limit reached')
      ) {
        return tQuota('quotaExceededTokens')
      }
    }
    return t('errorMessage')
  }

  async function consumeChatResponse(res: Response) {
    let assistantContent = ''
    let streamCompleted = false
    const assistantMessage = createMessage({ role: 'assistant', content: '' })
    setMessages((prev) => mergeMessage(prev, assistantMessage))

    function handleStreamEvent(data: ChatSseEvent) {
      if (data.conversation_id && !activeId) {
        setActiveId(data.conversation_id)
        loadConversations().then((list) => list && setConversations(list))
      }
      if (data.response_reset) {
        dismissTooltip()
        assistantContent = ''
        const resetMessage = { ...assistantMessage, content: '' }
        setMessages((prev) => mergeMessage(prev, resetMessage))
      }
      if (data.token) {
        assistantContent += data.token
        const tokenMessage = {
          ...assistantMessage,
          content: assistantContent,
        }
        setMessages((prev) => mergeMessage(prev, tokenMessage))
      }
      if (data.error) {
        streamCompleted = true
        setError(t('errorMessage'))
      }
      if (data.done) {
        streamCompleted = true
        if (
          !isSubscribed(user, stripeEnabled) &&
          !isFreemiumTrialActive(user, stripeEnabled)
        ) {
          decrementFreemium('chat_remaining')
        }
        loadConversations().then((list) => list && setConversations(list))
      }
      if (data.memory_updated) showMemoryToast()
    }

    if (!res.body) throw new Error(t('errorMessage'))
    for await (const data of readSseData<ChatSseEvent>(res.body)) {
      handleStreamEvent(data)
    }
    if (!streamCompleted) throw new Error(t('errorMessage'))
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setError('')
    const userMessage = createMessage({ role: 'user', content: text })
    setMessages((prev) => mergeMessage(prev, userMessage))
    setSending(true)

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: activeId }),
      })

      if (!res.ok) {
        setError(await getChatErrorMessage(res))
        return
      }

      await consumeChatResponse(res)
    } catch {
      setError(t('errorMessage'))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <MaintenanceGate>
      <div className="flex h-[calc(100dvh-56px)] w-full overflow-hidden md:h-screen">
        <MemorySavedToast
          visible={memoryToast}
          announcementId={memoryToastId}
        />
        {/* Sidebar backdrop — mobile only */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label={tCommon('close')}
            className="fixed inset-x-0 top-14 bottom-0 z-10 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="border-fl-border bg-fl-bg fixed top-14 bottom-0 left-0 z-20 flex w-56 shrink-0 flex-col overflow-hidden border-r md:relative md:top-auto md:bottom-auto md:left-auto md:z-auto">
            <div className="border-fl-border flex items-center justify-between border-b px-4 py-3">
              <span className="text-fl-hint text-fl-muted-2 font-mono tracking-widest uppercase">
                {t('conversations')}
              </span>
              <button
                onClick={newChat}
                className="text-fl-label text-fl-muted-1 hover:text-fl-fg font-mono tracking-widest uppercase transition-colors"
                title={t('newConversation')}
              >
                + {t('newConversation')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderConversationList({
                loading: loadingConvs,
                loadError: convLoadError,
                conversations,
                activeId,
                onRetry: retryConversations,
                onSelect: selectConversation,
                onDelete: setDeletePending,
                labels: {
                  error: tCommon('error'),
                  retry: tCommon('retry'),
                  noConversation: t('noConversation'),
                  voiceSession: t('voiceSession'),
                  deleteConfirm: t('deleteConfirm'),
                },
              })}
            </div>
          </aside>
        )}

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="border-fl-border bg-fl-bg flex shrink-0 items-center gap-2 border-b px-5 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-fl-label text-fl-muted-2 hover:text-fl-fg mr-1 text-lg transition-colors"
              title={
                sidebarOpen ? t('toggleSidebarHide') : t('toggleSidebarShow')
              }
            >
              {sidebarOpen ? '◀' : '☰'}
            </button>
            <span className="text-fl-label text-fl-muted-3">●</span>
            <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
              {activeId
                ? (conversations.find((c) => c.id === activeId)?.title ??
                  t('title'))
                : t('newConversation')}
            </span>
            {renderChatAction({
              sending,
              sendingWarn,
              hasMessages: messages.length > 0,
              onContinueInVoice: continueInVoice,
              labels: {
                thinking: t('thinking'),
                takingLonger: t('takingLonger'),
                continueInVoice: t('continueInVoice'),
              },
            })}
          </div>

          <FreemiumQuotaBanner feature="chat" />

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {renderChatMessages({
              loading: loadingMsgs,
              messages,
              sending,
              user,
              targetLanguageCode,
              onTextSelection: handleTextSelection,
              title: t('title'),
              subtitle: t('subtitle', {
                language: activeLanguage
                  ? tLang(activeLanguage.code)
                  : tLang('en-GB'),
              }),
            })}
            {error && (
              <div className="text-fl-label text-fl-error-fg border-fl-error/30 border px-4 py-2 font-mono">
                ✕{' '}
                {error === 'No active study plan found'
                  ? tCommon('noActivePlan')
                  : error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-fl-border bg-fl-bg shrink-0 border-t px-4 py-4">
            {freemiumExhausted ? (
              <PaywallBanner feature="chat" compact />
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && !e.shiftKey && sendMessage()
                    }
                    disabled={sending || loadingMsgs}
                    placeholder={t('placeholder')}
                    className="bg-fl-surface border-fl-border text-fl-fg placeholder:text-fl-border-2 focus:border-fl-border-2 flex-1 border px-4 py-3 font-mono text-base transition-colors focus:outline-none disabled:opacity-40"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim() || loadingMsgs}
                    className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 px-5 font-mono text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-30"
                  >
                    {sending ? '...' : t('send')}
                  </button>
                </div>
                <p className="text-fl-hint text-fl-border-2 mt-2 font-mono tracking-wide">
                  {t('enterToSend')}
                </p>
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={deletePending !== null}
          title={t('deleteTitle')}
          message={t('deleteMessage')}
          confirmLabel={t('deleteConfirm')}
          danger
          onConfirm={() =>
            deletePending !== null && deleteConversation(deletePending)
          }
          onCancel={() => setDeletePending(null)}
        />

        {/* Word-save tooltip */}
        {selectedWord && (
          <WordTooltip
            word={selectedWord}
            pos={tooltipPos}
            saveState={saveState}
            onSave={() => handleSaveWord()}
            onDismiss={dismissTooltip}
            labels={{
              saveWord: tCommon('saveWord'),
              wordSaved: tCommon('wordSaved'),
              wordAlreadySaved: tCommon('wordAlreadySaved'),
              wordSaveError: tCommon('wordSaveError'),
            }}
          />
        )}
      </div>
    </MaintenanceGate>
  )
}
