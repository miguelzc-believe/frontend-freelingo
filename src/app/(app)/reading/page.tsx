import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { apiFetch } from '@/lib/api'
import { useLanguageStore } from '@/store/language'
import { FreemiumQuotaBanner } from '@/components/billing/FreemiumQuotaBanner'
import { PaywallBanner } from '@/components/billing/PaywallBanner'
import { MaintenanceGate } from '@/components/billing/MaintenanceBanner'
import { type ReadingExercise } from '@/types/api'
import { useWordSave } from '@/components/ui/WordTooltip'
import { PracticeWordTooltip } from '@/components/practice/PracticeWordTooltip'
import { PageLoading } from '@/components/ui/page-loading'
import { Pagination } from '@/components/ui/pagination'
import { TargetLanguageText } from '@/components/TargetLanguageText'
import { PracticeScoreCard } from '@/components/practice/PracticeScoreCard'
import { PracticeQuestionReview } from '@/components/practice/PracticeQuestionReview'
import { PracticeResultActions } from '@/components/practice/PracticeResultActions'
import { PracticeHistoryContent } from '@/components/practice/PracticeHistoryContent'
import { PracticeQuestions } from '@/components/practice/PracticeQuestions'
import { PracticePageHeader } from '@/components/practice/PracticePageHeader'
import { PracticeEmptyState } from '@/components/practice/PracticeEmptyState'
import {
  ReviewPrompt,
  getReviewPromptDismissal,
} from '@/components/reviews/ReviewPrompt'
import { shouldShowExerciseReviewPrompt } from '@/lib/review-prompt-triggers'
import { useFreemiumStore } from '@/store/freemium'
import { useConfigStore } from '@/store/config'
import { useAuthStore, isSubscribed, isFreemiumTrialActive } from '@/store/auth'
import { usePracticeGeneration } from '@/hooks/usePracticeGeneration'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CorrectAnswer {
  index: number
  correct: string
}

interface SubmitResult {
  score: number
  xp_earned: number
  correct_answers: CorrectAnswer[]
}

interface AttemptItem {
  id: number
  score: number
  xp_earned: number
  completed_at: string
  exercise: ReadingExercise
  answers: Record<string, string>
  correct_answers: CorrectAnswer[]
}

type PageState =
  'loading' | 'idle' | 'generating' | 'exercise' | 'results' | 'history'

const HISTORY_PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Main page logic
// ---------------------------------------------------------------------------

function areAllQuestionsAnswered(
  exercise: ReadingExercise | null,
  answers: Record<string, string>
): boolean {
  if (!exercise) return false
  return Object.keys(answers).length === exercise.questions.length
}

function ReadingResults({
  result,
  exercise,
  answers,
  isReplay,
  targetLanguageCode,
  loadNext,
  loadHistory,
  reviewPromptOpen,
  onCloseReview,
  t,
}: Readonly<{
  result: SubmitResult
  exercise: ReadingExercise
  answers: Record<string, string>
  isReplay: boolean
  targetLanguageCode: string
  loadNext: () => void
  loadHistory: (page: number) => void
  reviewPromptOpen: boolean
  onCloseReview: () => void
  t: (key: string) => string
}>) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-8">
      {/* Score card */}
      <PracticeScoreCard
        score={result.score}
        questionCount={exercise.questions.length}
        xpEarned={result.xp_earned}
        isReplay={isReplay}
        resultsLabel={t('resultsLabel')}
        replayNoXpLabel={t('replayNoXp')}
      />

      {/* Question review */}
      <PracticeQuestionReview
        questions={exercise.questions}
        correctAnswers={result.correct_answers}
        answers={answers}
        languageCode={targetLanguageCode}
        reviewLabel={t('review')}
      />

      {/* Actions */}
      <PracticeResultActions
        onNext={loadNext}
        onHistory={loadHistory}
        nextLabel={t('nextExercise')}
        historyLabel={t('viewHistory')}
      />
      <ReviewPrompt
        open={reviewPromptOpen}
        onClose={onCloseReview}
        onSubmitted={onCloseReview}
      />
    </div>
  )
}

function ReadingPage() {
  const t = useTranslations('reading')
  const tCommon = useTranslations('common')
  const activeLanguage = useLanguageStore((s) => s.activeLanguage)
  const {
    selectedWord,
    tooltipPos,
    saveState,
    handleTextSelection,
    handleSaveWord,
    dismissTooltip,
  } = useWordSave()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [exercise, setExercise] = useState<ReadingExercise | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [history, setHistory] = useState<AttemptItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false)

  const textRef = useRef<HTMLDivElement>(null)
  const [isReplay, setIsReplay] = useState(false)
  const { generatingWarn, generateAbortRef } = usePracticeGeneration(
    pageState === 'generating'
  )

  const user = useAuthStore((s) => s.user)
  const stripeEnabled = useConfigStore((s) => s.stripeEnabled)
  const fetchFreemium = useFreemiumStore((s) => s.fetchStatus)
  const decrementFreemium = useFreemiumStore((s) => s.decrement)
  const freemiumStatus = useFreemiumStore((s) => s.status)
  const freemiumExhausted =
    stripeEnabled &&
    !isSubscribed(user, stripeEnabled) &&
    !isFreemiumTrialActive(user, stripeEnabled) &&
    freemiumStatus &&
    freemiumStatus.reading_remaining <= 0

  useEffect(() => {
    if (stripeEnabled && !isSubscribed(user, stripeEnabled)) {
      fetchFreemium()
    }
  }, [stripeEnabled, user, fetchFreemium])

  const loadNext = useCallback(async () => {
    setPageState('loading')
    setError('')
    dismissTooltip()
    try {
      const res = await apiFetch('/api/reading/next')
      if (!res.ok) {
        setPageState('idle')
        return
      }
      const data = (await res.json()) as {
        available: boolean
        exercise?: ReadingExercise
      }
      if (data.available && data.exercise) {
        setExercise(data.exercise)
        setAnswers({})
        setResult(null)
        setIsReplay(false)
        setPageState('exercise')
      } else {
        setPageState('idle')
      }
    } catch {
      setError(t('errorLoading'))
      setPageState('idle')
    }
  }, [t, dismissTooltip])

  useEffect(() => {
    loadNext()
  }, [loadNext, activeLanguage?.code])

  async function handleGenerate() {
    try {
      const res = await apiFetch('/api/reading/generate', { method: 'POST' })
      if (res.ok || res.status === 202) {
        setPageState('generating')
        const controller = new AbortController()
        generateAbortRef.current = controller
        const nextRes = await apiFetch('/api/reading/next?wait=true', {
          signal: controller.signal,
        })
        generateAbortRef.current = null
        if (nextRes.ok) {
          const data = (await nextRes.json()) as {
            available: boolean
            exercise?: ReadingExercise
          }
          if (data.available && data.exercise) {
            setExercise(data.exercise)
            setAnswers({})
            setResult(null)
            setIsReplay(false)
            setPageState('exercise')
            return
          }
        }
        setPageState('idle')
      } else {
        const d = (await res.json().catch(() => ({}))) as { detail?: string }
        setError(
          d.detail === 'No active study plan found'
            ? tCommon('noActivePlan')
            : t('errorLoading')
        )
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setPageState('idle')
    }
  }

  async function handleSubmit() {
    if (!exercise) return
    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/api/reading/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exercise.id,
          answers,
          replay: isReplay,
        }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { detail?: string }
        setError(
          d.detail === 'already_attempted'
            ? t('alreadyAttempted')
            : t('errorSubmit')
        )
        return
      }
      const data = (await res.json()) as SubmitResult
      setResult(data)
      dismissTooltip()
      if (
        !isSubscribed(user, stripeEnabled) &&
        !isFreemiumTrialActive(user, stripeEnabled)
      ) {
        decrementFreemium('reading_remaining')
      }
      setPageState('results')
      if (
        shouldShowExerciseReviewPrompt(getReviewPromptDismissal(), !isReplay)
      ) {
        setReviewPromptOpen(true)
      }
    } catch {
      setError(t('errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  async function loadHistory(pageIndex = 0) {
    setPageState('history')
    setHistoryPage(pageIndex)
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        skip: String(pageIndex * HISTORY_PAGE_SIZE),
        limit: String(HISTORY_PAGE_SIZE),
      })
      const res = await apiFetch(`/api/reading/history?${params.toString()}`)
      if (res.ok) {
        const data = (await res.json()) as {
          items: AttemptItem[]
          total: number
        }
        setHistory(data.items)
        setHistoryTotal(data.total)
      }
    } catch {
      setError(t('errorLoading'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const allAnswered = areAllQuestionsAnswered(exercise, answers)
  const targetLanguageCode = activeLanguage?.code ?? 'en-GB'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return <PageLoading minHeight="min-h-[calc(100vh-56px)] md:min-h-screen" />
  }

  // ── Generating (long-poll) ────────────────────────────────────────────────
  if (pageState === 'generating') {
    return (
      <PageLoading
        label={t('generating')}
        subtext={
          generatingWarn
            ? `${t('generatingDesc')} ${t('generatingLong')}`
            : t('generatingDesc')
        }
        minHeight="min-h-[calc(100vh-56px)] md:min-h-screen"
      />
    )
  }

  // ── History ───────────────────────────────────────────────────────────────
  if (pageState === 'history') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
        <PracticePageHeader
          title={t('historyTitle')}
          actionLabel={t('practiceMore')}
          onAction={loadNext}
        />

        <PracticeHistoryContent
          historyLoading={historyLoading}
          history={history}
          emptyLabel={t('historyEmpty')}
          replayLabel={t('practiceAgain')}
          renderText={(item) => (
            <TargetLanguageText
              as="p"
              languageCode={item.exercise.target_language}
              className="text-fl-muted-2 border-fl-border mb-3 line-clamp-3 border-t pt-3"
            >
              {item.exercise.text}
            </TargetLanguageText>
          )}
          onReplay={(item) => {
            setExercise(item.exercise)
            setAnswers({})
            setResult(null)
            setIsReplay(true)
            setPageState('exercise')
          }}
        />

        <Pagination
          page={historyPage}
          totalPages={Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
          loading={historyLoading}
          onPageChange={loadHistory}
          prevLabel={`← ${tCommon('back')}`}
          nextLabel={`${tCommon('next')} →`}
          className="mt-4"
        />
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (pageState === 'results' && result && exercise) {
    return (
      <ReadingResults
        result={result}
        exercise={exercise}
        answers={answers}
        isReplay={isReplay}
        targetLanguageCode={targetLanguageCode}
        loadNext={loadNext}
        loadHistory={loadHistory}
        reviewPromptOpen={reviewPromptOpen}
        t={t}
        onCloseReview={() => setReviewPromptOpen(false)}
      />
    )
  }

  // ── Idle (no exercises available) ─────────────────────────────────────────
  if (pageState === 'idle') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
        <PracticePageHeader
          title={t('title')}
          actionLabel={t('history')}
          onAction={() => loadHistory(0)}
        />

        {error && (
          <p className="text-fl-caption text-fl-error-fg mb-4 font-mono">
            {error}
          </p>
        )}

        <FreemiumQuotaBanner feature="reading" className="mb-4" />

        {freemiumExhausted ? (
          <PaywallBanner feature="reading" compact />
        ) : (
          <PracticeEmptyState
            label={t('noExercises')}
            generateLabel={t('generate')}
            onGenerate={handleGenerate}
          />
        )}
      </div>
    )
  }

  // ── Exercise ──────────────────────────────────────────────────────────────
  if (!exercise) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-fl-fg font-mono text-sm font-bold tracking-widest uppercase">
            {t('title')}
          </h1>
          <p className="text-fl-label text-fl-muted-3 mt-0.5 font-mono tracking-widest uppercase">
            {exercise.level} · {exercise.exercise_type} · {exercise.topic}
          </p>
        </div>
        <button
          onClick={() => loadHistory(0)}
          className="text-fl-muted-2 hover:text-fl-fg shrink-0 font-mono text-xs tracking-widest uppercase transition-colors"
        >
          {t('history')}
        </button>
      </div>

      <FreemiumQuotaBanner feature="reading" className="mb-4" />

      {freemiumExhausted ? (
        <PaywallBanner feature="reading" compact />
      ) : (
        <>
          {/* Two-column on desktop, stacked on mobile */}
          <div className="flex flex-col gap-5 md:grid md:grid-cols-[55fr_45fr] md:gap-6">
            {/* Left: reading text */}
            <div>
              <p className="text-fl-label text-fl-muted-3 mb-2 font-mono tracking-widest uppercase">
                {t('textLabel')}
              </p>
              <div className="border-fl-border bg-fl-surface relative border p-5">
                <div
                  ref={textRef}
                  onPointerUp={() =>
                    handleTextSelection(
                      exercise?.text ?? '',
                      exercise?.level ?? 'B1'
                    )
                  }
                >
                  <TargetLanguageText
                    as="p"
                    languageCode={exercise.target_language}
                    className="reading-text text-fl-fg word-selectable max-w-[70ch] cursor-text whitespace-pre-wrap select-text"
                  >
                    {exercise.text}
                  </TargetLanguageText>
                </div>
              </div>
              <p className="text-fl-caption text-fl-muted-1 mt-2 text-center font-sans leading-relaxed">
                {t('selectWordHint')}
              </p>
            </div>

            {/* Right: questions */}
            <div>
              <p className="text-fl-label text-fl-muted-3 mb-2 font-mono tracking-widest uppercase">
                {t('questionsLabel')}
              </p>
              <PracticeQuestions
                questions={exercise.questions}
                answers={answers}
                languageCode={exercise.target_language}
                level={exercise.level}
                modality="reading"
                onTextSelection={handleTextSelection}
                onAnswer={(index, key) =>
                  setAnswers((prev) => ({ ...prev, [String(index)]: key }))
                }
              />

              {error && (
                <p className="text-fl-caption text-fl-error-fg mt-3 font-mono">
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="border-fl-border bg-fl-fg text-fl-bg hover:bg-fl-fg/90 focus-visible:outline-fl-fg mt-4 w-full border py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? '...' : t('submit')}
              </button>
            </div>
          </div>

          {/* Word-save tooltip */}
          <PracticeWordTooltip
            selectedWord={selectedWord}
            tooltipPos={tooltipPos}
            saveState={saveState}
            onSave={handleSaveWord}
            onDismiss={dismissTooltip}
            tCommon={tCommon}
          />
        </>
      )}
    </div>
  )
}

export default function ReadingPageWrapper() {
  return (
    <MaintenanceGate>
      <ReadingPage />
    </MaintenanceGate>
  )
}
