import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from '@/lib/navigation'
import Link from '@/components/ui/app-link'
import { useLocale, useTranslations } from 'use-intl'
import { Check, Diff, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useProgressStore } from '@/store/progress'
import { useLanguageStore } from '@/store/language'
import { useAuthStore, isSubscribed, isFreemiumTrialActive } from '@/store/auth'
import { getGrammarTopics, type GrammarTopic } from '@/data/grammar'
import { AudioPlayer } from '@/components/ui/AudioPlayer'
import { VoiceRecorder } from '@/components/ui/VoiceRecorder'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WordTooltip, useWordSave } from '@/components/ui/WordTooltip'
import { PageLoading } from '@/components/ui/page-loading'
import { FreemiumQuotaBanner } from '@/components/billing/FreemiumQuotaBanner'
import { PaywallBanner } from '@/components/billing/PaywallBanner'
import { useFreemiumStore } from '@/store/freemium'
import { useConfigStore } from '@/store/config'
import { TargetLanguageText } from '@/components/TargetLanguageText'
import {
  ReviewPrompt,
  getReviewPromptDismissal,
} from '@/components/reviews/ReviewPrompt'
import {
  isPlanPositionComplete,
  shouldShowUnitReviewPrompt,
} from '@/lib/review-prompt-triggers'
import { cn } from '@/lib/utils'
import { documentOccurrences } from '@/lib/document-occurrences'
import {
  annotateAnswer,
  type FreeWriteCorrection,
  type AnswerSegment,
} from '@/lib/free-write-corrections'
import {
  formatLanguageName,
  getTargetLanguageTextClass,
} from '@/lib/target-languages'

interface ExerciseItem {
  id: number
  exercise_type: string
  question: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  native_explanation: string | null
  user_answer: string | null
  score: number | null
  feedback: string | null
  corrections: FreeWriteCorrection[] | null
  native_hint: string | null
}

interface LessonData {
  id: number
  study_plan_id: number
  title: string
  lesson_type: string
  cefr_level: string
  content: Record<string, unknown>
  is_completed: boolean
}

interface LessonVocabularyItem {
  word?: string
  definition?: string
  translation?: string | null
  example?: string
  example_translation?: string | null
  note?: string | null
  reading?: string | null
}

function validateExplanation(value: unknown) {
  if (value == null) return { record: null, text: null, invalid: false }
  if (typeof value !== 'object' || Array.isArray(value))
    return { record: null, text: null, invalid: true }
  const record = value as Record<string, unknown>
  const text = record.text
  if (text != null && typeof text !== 'string')
    return { record: null, text: null, invalid: true }
  return {
    record,
    text: typeof text === 'string' ? text : null,
    invalid: false,
  }
}

function getLessonUnitId(lesson: LessonData | null): string | null {
  const unitId = lesson?.content?.unit_id
  return typeof unitId === 'string' && unitId ? unitId : null
}

type Translate = ReturnType<typeof useTranslations>
type AuthoredOccurrence<T> = Readonly<{ key: string; value: T }>
type ExplanationExample = { sentence: string; note: string }
type ExplanationTrap = { mistake: string; fix: string }
type ExplanationGlossaryItem = { term: string; meaning: string; note?: string }

function nativeRequestLabel(
  loading: boolean,
  retry: boolean,
  retryLabel: () => string,
  requestLabel: () => string
) {
  if (loading) return '...'
  if (retry) return retryLabel()
  return requestLabel()
}

function LessonCompletionView({
  t,
  tCommon,
  lesson,
  exercises,
  dayComplete,
  reviewPromptOpen,
  onCloseReviewPrompt,
}: Readonly<{
  t: Translate
  tCommon: Translate
  lesson: LessonData | null
  exercises: readonly ExerciseItem[]
  dayComplete: boolean
  reviewPromptOpen: boolean
  onCloseReviewPrompt: () => void
}>) {
  return (
    <>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <div className="border-fl-border bg-fl-surface w-full max-w-xl border px-6 py-10 text-center sm:px-10">
          <p className="text-fl-label text-fl-muted-2 mb-4 flex items-center justify-center gap-2 font-mono tracking-widest uppercase">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {tCommon('complete')}
          </p>
          <p className="text-fl-fg font-mono text-xl font-bold tracking-widest">
            {t('lessonDone')}
          </p>
          <p className="text-fl-muted-1 mt-3 font-mono text-sm">
            {lesson?.title}
          </p>
          {exercises.length > 0 && (
            <p className="text-fl-caption text-fl-muted-1 mt-4 font-mono">
              {t('exerciseSummary', {
                completed: exercises.filter((item) => item.score != null)
                  .length,
                total: exercises.length,
              })}
            </p>
          )}
          {dayComplete && (
            <div className="border-fl-accent/30 bg-fl-accent/5 mt-6 border px-6 py-4">
              <p className="text-fl-accent font-mono text-sm font-bold tracking-widest">
                {t('dayComplete')}
              </p>
              <p className="text-fl-muted-1 mt-1 font-mono text-xs">
                {t('dayCompleteMsg')}
              </p>
            </div>
          )}
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              href="/plan"
              className="bg-fl-fg text-fl-bg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-8 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t('backToPlan')}
            </Link>
            <Link
              href="/dashboard"
              className="text-fl-muted-1 hover:text-fl-fg focus-visible:outline-fl-fg font-mono text-xs underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {tCommon('backToDashboard')}
            </Link>
          </div>
        </div>
      </div>
      <ReviewPrompt
        open={reviewPromptOpen}
        onClose={onCloseReviewPrompt}
        onSubmitted={onCloseReviewPrompt}
      />
    </>
  )
}

function LessonExplanation({
  t,
  targetLanguageCode,
  id,
  lesson,
  handleTextSelection,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  id: string
  lesson: LessonData | null
  handleTextSelection: ReturnType<typeof useWordSave>['handleTextSelection']
}>) {
  const targetExplanation = validateExplanation(lesson?.content?.explanation)
  const explanation = targetExplanation.record
  const explanationText = targetExplanation.text
  return (
    <>
      {targetExplanation.invalid && (
        <p role="alert" className="text-fl-error mt-4 text-sm">
          {t('invalidExplanation')}
        </p>
      )}
      {explanation && (
        <div className="mt-4 max-w-[70ch] space-y-3">
          {explanationText != null && (
            <TargetLanguageText
              as="p"
              languageCode={targetLanguageCode}
              className="text-fl-muted-1 word-selectable cursor-text select-text"
              onPointerUp={() =>
                handleTextSelection(explanationText, lesson?.cefr_level ?? 'B1')
              }
            >
              {explanationText}
            </TargetLanguageText>
          )}
          <LessonExplanationPoints
            id={id}
            explanation={explanation}
            targetLanguageCode={targetLanguageCode}
          />
          <LessonExplanationExamples
            t={t}
            id={id}
            explanation={explanation}
            targetLanguageCode={targetLanguageCode}
          />
        </div>
      )}
    </>
  )
}

function LessonExplanationPoints({
  id,
  explanation,
  targetLanguageCode,
}: Readonly<{
  id: string
  explanation: Record<string, unknown>
  targetLanguageCode: string
}>) {
  const points = (explanation.key_points ?? []) as string[]
  if (!points.length) return null
  const occurrences = documentOccurrences(
    ['lesson', id, 'explanation', 'key_points'],
    points
  )
  return (
    <ul className="border-fl-border space-y-1 border-t pt-3">
      {occurrences.map(({ value: kp, key }) => (
        <li key={key} className="text-fl-muted-1">
          <span className="text-fl-muted-2 mr-2">·</span>
          <TargetLanguageText languageCode={targetLanguageCode}>
            {kp}
          </TargetLanguageText>
        </li>
      ))}
    </ul>
  )
}

function LessonExplanationExamples({
  t,
  id,
  explanation,
  targetLanguageCode,
}: Readonly<{
  t: Translate
  id: string
  explanation: Record<string, unknown>
  targetLanguageCode: string
}>) {
  const examples = (explanation.examples ?? []) as ExplanationExample[]
  if (!examples.length) return null
  const occurrences = documentOccurrences(
    ['lesson', id, 'explanation', 'examples'],
    examples
  )
  return (
    <div className="border-fl-border space-y-2 border-t pt-3">
      <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
        {t('examples')}
      </p>
      {occurrences.map(({ value: ex, key }) => (
        <div key={key} className="flex items-start gap-3">
          <span className="text-fl-muted-3 mt-0.5">·</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <TargetLanguageText
                languageCode={targetLanguageCode}
                className="text-fl-muted-1 italic"
              >
                {ex.sentence}
              </TargetLanguageText>
              <AudioPlayer text={ex.sentence} size="sm" />
            </div>
            {ex.note && (
              <p className="text-fl-muted-1 mt-0.5 font-sans text-sm leading-relaxed">
                {ex.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function NativeExplanationExamples({
  t,
  targetLanguageCode,
  nativeExamples,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  nativeExamples: readonly AuthoredOccurrence<ExplanationExample>[]
}>) {
  if (!nativeExamples.length) return null
  return (
    <div className="space-y-2">
      <p className="text-fl-label text-fl-muted-3 font-mono text-xs tracking-widest uppercase">
        {t('examples')}
      </p>
      {nativeExamples.map(({ value: ex, key }) => (
        <div key={key} className="flex items-start gap-3">
          <span className="text-fl-muted-3 mt-0.5 text-sm">·</span>
          <div className="min-w-0 flex-1">
            <TargetLanguageText
              languageCode={targetLanguageCode}
              className="text-fl-muted-1 text-sm italic"
            >
              {ex.sentence}
            </TargetLanguageText>
            {ex.note && (
              <p className="text-fl-muted-1 mt-0.5 text-sm leading-relaxed">
                {ex.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function NativeExplanationTraps({
  t,
  nativeTraps,
}: Readonly<{
  t: Translate
  nativeTraps: readonly AuthoredOccurrence<ExplanationTrap>[]
}>) {
  if (!nativeTraps.length) return null
  return (
    <div className="border-fl-border space-y-2 border-t pt-3">
      <p className="text-fl-label text-fl-muted-3 font-mono text-xs tracking-widest uppercase">
        {t('commonTraps')}
      </p>
      {nativeTraps.map(({ value: trap, key }) => (
        <div key={key} className="space-y-0.5">
          <p className="text-fl-muted-2 text-sm">{trap.mistake}</p>
          <p className="text-fl-muted-1 text-sm leading-relaxed">{trap.fix}</p>
        </div>
      ))}
    </div>
  )
}

function NativeExplanationGlossary({
  t,
  targetLanguageCode,
  nativeGlossary,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  nativeGlossary: readonly AuthoredOccurrence<ExplanationGlossaryItem>[]
}>) {
  if (!nativeGlossary.length) return null
  return (
    <div className="border-fl-border space-y-2 border-t pt-3">
      <p className="text-fl-label text-fl-muted-3 font-mono text-xs tracking-widest uppercase">
        {t('miniGlossary')}
      </p>
      {nativeGlossary.map(({ value: item, key }) => (
        <div key={key}>
          <TargetLanguageText
            languageCode={targetLanguageCode}
            className="text-fl-muted-1 text-sm font-bold"
          >
            {item.term}
          </TargetLanguageText>
          <p className="text-fl-muted-2 text-sm">{item.meaning}</p>
          {item.note && (
            <p className="text-fl-muted-1 text-sm leading-relaxed">
              {item.note}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function NativeExplanationContent({
  t,
  targetLanguageCode,
  nativeExplanationText,
  nativePoints,
  nativeExamples,
  nativeTraps,
  nativeGlossary,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  nativeExplanationText: string | null
  nativePoints: readonly AuthoredOccurrence<string>[]
  nativeExamples: readonly AuthoredOccurrence<ExplanationExample>[]
  nativeTraps: readonly AuthoredOccurrence<ExplanationTrap>[]
  nativeGlossary: readonly AuthoredOccurrence<ExplanationGlossaryItem>[]
}>) {
  return (
    <div className="mt-3 max-w-[70ch] space-y-3">
      {nativeExplanationText && (
        <p className="text-fl-muted-1 text-base leading-relaxed">
          {nativeExplanationText}
        </p>
      )}
      {nativePoints.length > 0 && (
        <ul className="space-y-1">
          {nativePoints.map(({ value: kp, key }) => (
            <li key={key} className="text-fl-muted-1 text-base leading-relaxed">
              <span className="text-fl-muted-2 mr-2">·</span>
              {kp}
            </li>
          ))}
        </ul>
      )}
      <NativeExplanationExamples
        t={t}
        targetLanguageCode={targetLanguageCode}
        nativeExamples={nativeExamples}
      />
      <NativeExplanationTraps t={t} nativeTraps={nativeTraps} />
      <NativeExplanationGlossary
        t={t}
        targetLanguageCode={targetLanguageCode}
        nativeGlossary={nativeGlossary}
      />
    </div>
  )
}

function NativeExplanationRequest({
  t,
  tCommon,
  nativeLanguageName,
  validatedNativeExplanation,
  loadingNativeExplanation,
  nativeExplanationError,
  generateNativeExplanation,
}: Readonly<{
  t: Translate
  tCommon: Translate
  nativeLanguageName: string
  validatedNativeExplanation: ReturnType<typeof validateExplanation>
  loadingNativeExplanation: boolean
  nativeExplanationError: boolean
  generateNativeExplanation: () => void
}>) {
  return (
    <div className="mt-3 text-center">
      {validatedNativeExplanation.invalid && (
        <p role="alert" className="text-fl-error mb-3 text-sm">
          {t('invalidExplanation')}
        </p>
      )}
      <button
        onClick={generateNativeExplanation}
        disabled={loadingNativeExplanation}
        className="text-fl-hint text-fl-muted-3 hover:text-fl-fg font-mono text-sm transition-colors"
      >
        {nativeRequestLabel(
          loadingNativeExplanation,
          nativeExplanationError || validatedNativeExplanation.invalid,
          () => tCommon('retry'),
          () => `${t('showNativeExplanation')} ${nativeLanguageName}`
        )}
      </button>
    </div>
  )
}

function NativeExplanation({
  t,
  targetLanguageCode,
  tCommon,
  id,
  lesson,
  nativeLanguageName,
  nativeExplanationOpen,
  onToggle,
  loadingNativeExplanation,
  nativeExplanationError,
  generateNativeExplanation,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  tCommon: Translate
  id: string
  lesson: LessonData | null
  nativeLanguageName: string
  nativeExplanationOpen: boolean
  onToggle: () => void
  loadingNativeExplanation: boolean
  nativeExplanationError: boolean
  generateNativeExplanation: () => void
}>) {
  if (!nativeLanguageName) return null
  const validatedNativeExplanation = validateExplanation(
    lesson?.content?.native_explanation
  )
  const nativeExplanation = validatedNativeExplanation.record
  const nativeExplanationText = validatedNativeExplanation.text
  const nativePoints = documentOccurrences(
    ['lesson', id, 'native_explanation', 'key_points'],
    (nativeExplanation?.key_points ?? []) as string[]
  )
  const nativeExamples = documentOccurrences(
    ['lesson', id, 'native_explanation', 'examples'],
    (nativeExplanation?.examples ?? []) as { sentence: string; note: string }[]
  )
  const nativeTraps = documentOccurrences(
    ['lesson', id, 'native_explanation', 'common_traps'],
    (nativeExplanation?.common_traps ?? []) as {
      mistake: string
      fix: string
    }[]
  )
  const nativeGlossary = documentOccurrences(
    ['lesson', id, 'native_explanation', 'mini_glossary'],
    (nativeExplanation?.mini_glossary ?? []) as {
      term: string
      meaning: string
      note?: string
    }[]
  )
  return (
    <div className="border-fl-border mt-4 border-t pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="text-fl-label text-fl-muted-3 hover:text-fl-fg flex w-full items-center justify-between font-mono tracking-widest uppercase transition-colors"
        aria-expanded={nativeExplanationOpen}
      >
        <span>{nativeLanguageName}</span>
        <span>{nativeExplanationOpen ? '−' : '+'}</span>
      </button>
      {nativeExplanationOpen &&
        (nativeExplanation ? (
          <NativeExplanationContent
            t={t}
            targetLanguageCode={targetLanguageCode}
            nativeExplanationText={nativeExplanationText}
            nativePoints={nativePoints}
            nativeExamples={nativeExamples}
            nativeTraps={nativeTraps}
            nativeGlossary={nativeGlossary}
          />
        ) : (
          <NativeExplanationRequest
            t={t}
            tCommon={tCommon}
            nativeLanguageName={nativeLanguageName}
            validatedNativeExplanation={validatedNativeExplanation}
            loadingNativeExplanation={loadingNativeExplanation}
            nativeExplanationError={nativeExplanationError}
            generateNativeExplanation={generateNativeExplanation}
          />
        ))}
    </div>
  )
}

function lessonTypeLabel(lessonType: string | undefined, tPlan: Translate) {
  if (!lessonType) return ''
  const labels: Record<string, string> = {
    grammar: tPlan('lessonTypes.grammar'),
    vocabulary: tPlan('lessonTypes.vocabulary'),
    reading: tPlan('lessonTypes.reading'),
    writing: tPlan('lessonTypes.writing'),
    listening: tPlan('lessonTypes.listening'),
    review: tPlan('lessonTypes.review'),
    level_test: tPlan('lessonTypes.level_test'),
  }
  return labels[lessonType] ?? lessonType
}

function LessonNativeHint({
  t,
  tCommon,
  exercise,
  nativeLanguageName,
  isEvaluated,
  isNativeHintOpen,
  loadingExerciseNativeHintId,
  exerciseNativeHintErrorId,
  showExerciseNativeHint,
}: Readonly<{
  t: Translate
  tCommon: Translate
  exercise: ExerciseItem
  nativeLanguageName: string
  isEvaluated: boolean
  isNativeHintOpen: boolean
  loadingExerciseNativeHintId: number | null
  exerciseNativeHintErrorId: number | null
  showExerciseNativeHint: (id: number) => void
}>) {
  if (!nativeLanguageName) return null
  if (isEvaluated && !(isNativeHintOpen && exercise.native_hint)) return null
  return (
    <div className="border-fl-border bg-fl-bg border px-4 py-3">
      {isNativeHintOpen && exercise.native_hint ? (
        <div className="space-y-2">
          <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest">
            {t('hint')}
          </p>
          <p className="text-fl-muted-1 max-w-[70ch] text-sm leading-relaxed">
            {exercise.native_hint}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => showExerciseNativeHint(exercise.id)}
          disabled={loadingExerciseNativeHintId === exercise.id}
          className="text-fl-hint text-fl-muted-3 hover:text-fl-fg font-mono text-sm transition-colors disabled:opacity-50"
        >
          {nativeRequestLabel(
            loadingExerciseNativeHintId === exercise.id,
            exerciseNativeHintErrorId === exercise.id,
            () => tCommon('retry'),
            () => `${t('showNativeHint')} ${nativeLanguageName}`
          )}
        </button>
      )}
    </div>
  )
}

function LessonMultipleChoiceOption({
  t,
  targetLanguageCode,
  opt,
  exercise,
  answer,
  isEvaluated,
  isReview,
  onAnswerChange,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  opt: string
  exercise: ExerciseItem
  answer: string
  isEvaluated: boolean
  isReview: boolean
  onAnswerChange: (answer: string) => void
}>) {
  const isSelected = answer === opt
  const isCorrect = isEvaluated && opt === exercise.correct_answer
  const isWrongSelection = isEvaluated && isSelected && !isCorrect
  return (
    <button
      key={opt}
      disabled={isEvaluated || isReview}
      onClick={() => onAnswerChange(opt)}
      className={`flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-colors disabled:opacity-100 ${optionClass(
        isCorrect,
        isWrongSelection,
        isSelected
      )}`}
    >
      <TargetLanguageText
        languageCode={targetLanguageCode}
        className="min-w-0 flex-1"
      >
        {opt}
      </TargetLanguageText>
      {isCorrect && (
        <span
          role="img"
          aria-label={t('correct')}
          className="text-fl-success shrink-0"
        >
          <Check className="size-4" aria-hidden="true" />
        </span>
      )}
      {isWrongSelection && (
        <span
          role="img"
          aria-label={t('incorrect')}
          className="text-fl-error-fg shrink-0"
        >
          <X className="size-4" aria-hidden="true" />
        </span>
      )}
    </button>
  )
}

function LessonMultipleChoiceInput({
  t,
  targetLanguageCode,
  exercise,
  answer,
  isEvaluated,
  isReview,
  onAnswerChange,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  exercise: ExerciseItem
  answer: string
  isEvaluated: boolean
  isReview: boolean
  onAnswerChange: (answer: string) => void
}>) {
  return (
    <div className="space-y-2">
      {exercise.options!.map((opt) => (
        <LessonMultipleChoiceOption
          key={opt}
          t={t}
          targetLanguageCode={targetLanguageCode}
          opt={opt}
          exercise={exercise}
          answer={answer}
          isEvaluated={isEvaluated}
          isReview={isReview}
          onAnswerChange={onAnswerChange}
        />
      ))}
    </div>
  )
}

function optionClass(
  isCorrect: boolean,
  isWrongSelection: boolean,
  isSelected: boolean
) {
  if (isCorrect) return 'text-fl-fg border-fl-success/50 bg-fl-success/5'
  if (isWrongSelection)
    return 'text-fl-fg border-fl-error-fg/50 bg-fl-error-fg/5'
  if (isSelected) return 'border-fl-accent bg-fl-accent text-fl-accent-fg'
  return 'border-fl-border text-fl-muted-1 hover:border-fl-border-2 hover:text-fl-fg'
}

function LessonPronunciationInput({
  tCommon,
  targetLanguageCode,
  exercise,
  lesson,
  isEvaluated,
  isReview,
  evaluating,
  submitAnswer,
}: Readonly<{
  tCommon: Translate
  targetLanguageCode: string
  exercise: ExerciseItem
  lesson: LessonData | null
  isEvaluated: boolean
  isReview: boolean
  evaluating: boolean
  submitAnswer: (answer?: string) => void
}>) {
  return (
    <div className="space-y-4">
      {/* Target phrase + listen button */}
      <div className="border-fl-border bg-fl-bg flex flex-wrap items-center gap-3 border px-4 py-4">
        <TargetLanguageText
          languageCode={targetLanguageCode}
          className="text-fl-fg flex-1 font-bold"
        >
          {exercise.correct_answer}
        </TargetLanguageText>
        <AudioPlayer text={exercise.correct_answer} size="md" />
      </div>
      {exercise.options?.[0] && (
        <TargetLanguageText
          as="p"
          languageCode={targetLanguageCode}
          className="text-fl-muted-1"
        >
          {exercise.options[0]}
        </TargetLanguageText>
      )}
      {!isEvaluated && !isReview && lesson && (
        <VoiceRecorder
          studyPlanId={lesson.study_plan_id}
          onTranscription={(text) => submitAnswer(text)}
          maxSeconds={8}
          disabled={evaluating}
        />
      )}
      {evaluating && (
        <p className="text-fl-hint text-fl-muted-3 animate-pulse font-mono tracking-widest uppercase">
          {tCommon('checking')}
        </p>
      )}
    </div>
  )
}

function answerBorderClass(
  isAnswerCorrect: boolean,
  isPartiallyCorrect: boolean
) {
  if (isAnswerCorrect) return 'border-fl-success/50'
  if (isPartiallyCorrect) return 'border-fl-warning/50'
  return 'border-fl-error-fg/50'
}

function answerStatusLabel(
  t: Translate,
  isAnswerCorrect: boolean,
  isPartiallyCorrect: boolean
) {
  if (isAnswerCorrect) return t('correct')
  if (isPartiallyCorrect) return t('corrections')
  return t('incorrect')
}

function answerStatusClass(
  isAnswerCorrect: boolean,
  isPartiallyCorrect: boolean
) {
  if (isAnswerCorrect) return 'text-fl-success'
  if (isPartiallyCorrect) return 'text-fl-warning'
  return 'text-fl-error-fg'
}

function AnswerStatusIcon({
  isAnswerCorrect,
  isPartiallyCorrect,
}: Readonly<{
  isAnswerCorrect: boolean
  isPartiallyCorrect: boolean
}>) {
  if (isAnswerCorrect) return <Check className="size-4" aria-hidden="true" />
  if (isPartiallyCorrect) return <Diff className="size-4" aria-hidden="true" />
  return <X className="size-4" aria-hidden="true" />
}

function LessonFreeWriteInput({
  t,
  targetLanguageCode,
  id,
  exercise,
  answer,
  isEvaluated,
  isReview,
  isAnswerCorrect,
  isPartiallyCorrect,
  showAnnotatedAnswer,
  answerSegments,
  onAnswerChange,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  id: string
  exercise: ExerciseItem
  answer: string
  isEvaluated: boolean
  isReview: boolean
  isAnswerCorrect: boolean
  isPartiallyCorrect: boolean
  showAnnotatedAnswer: boolean
  answerSegments: readonly AnswerSegment[] | null
  onAnswerChange: (answer: string) => void
}>) {
  return (
    <div className="relative">
      {showAnnotatedAnswer && answerSegments ? (
        <div
          className={cn(
            getTargetLanguageTextClass(targetLanguageCode),
            'bg-fl-bg text-fl-fg min-h-[90px] w-full border px-4 py-3 pr-10 whitespace-pre-wrap',
            answerBorderClass(isAnswerCorrect, isPartiallyCorrect)
          )}
        >
          {answerSegments.map((segment) =>
            segment.type === 'plain' ? (
              <span
                key={JSON.stringify([
                  id,
                  exercise.id,
                  'answer',
                  segment.start,
                  segment.end,
                ])}
              >
                {segment.text}
              </span>
            ) : (
              <span
                key={JSON.stringify([
                  id,
                  exercise.id,
                  'answer',
                  segment.start,
                  segment.end,
                ])}
              >
                <del className="text-fl-error-fg decoration-fl-error-fg/70 line-through">
                  {segment.original}
                </del>{' '}
                <ins className="text-fl-success decoration-fl-success/70 font-semibold">
                  {segment.corrected}
                </ins>
              </span>
            )
          )}
        </div>
      ) : (
        <textarea
          className={cn(
            getTargetLanguageTextClass(targetLanguageCode),
            'bg-fl-bg border-fl-border text-fl-fg placeholder:text-fl-muted-4 focus:border-fl-border-2 min-h-[90px] w-full resize-y border px-4 py-3 transition-colors focus:outline-none disabled:opacity-100',
            isEvaluated && 'pr-10',
            isEvaluated &&
              answerBorderClass(isAnswerCorrect, isPartiallyCorrect)
          )}
          placeholder={t('yourAnswer')}
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={isEvaluated || isReview}
        />
      )}
      {isEvaluated && (
        <span
          role="img"
          aria-label={answerStatusLabel(t, isAnswerCorrect, isPartiallyCorrect)}
          className={`absolute top-3 right-3 ${answerStatusClass(
            isAnswerCorrect,
            isPartiallyCorrect
          )}`}
        >
          <AnswerStatusIcon
            isAnswerCorrect={isAnswerCorrect}
            isPartiallyCorrect={isPartiallyCorrect}
          />
        </span>
      )}
    </div>
  )
}

function exerciseAnswerFeedback(id: string, exercise: ExerciseItem) {
  const isEvaluated = exercise?.score !== null
  const isAnswerCorrect = (exercise?.score ?? 0) >= 1
  const correctionOccurrences = documentOccurrences(
    ['lesson', id, 'exercise', String(exercise.id), 'corrections'],
    exercise.corrections ?? []
  ).filter(({ value }) => value.original && value.corrected)
  const exerciseCorrections = correctionOccurrences.map(({ value }) => value)
  // Amber only when the evaluator returned corrections with a partial score.
  // The LLM-unavailable fallback (score 0.5, no corrections) stays red/✕.
  const isPartiallyCorrect =
    exercise?.exercise_type === 'free_write' &&
    isEvaluated &&
    !isAnswerCorrect &&
    (exercise?.score ?? 0) > 0 &&
    exerciseCorrections.length > 0
  const answerSegments =
    exercise?.exercise_type === 'free_write' &&
    isEvaluated &&
    exercise?.user_answer &&
    exerciseCorrections.length > 0
      ? annotateAnswer(exercise.user_answer, exerciseCorrections)
      : null
  const showAnnotatedAnswer = !!answerSegments?.some(
    (segment) => segment.type === 'fix'
  )
  return {
    isAnswerCorrect,
    isPartiallyCorrect,
    answerSegments,
    showAnnotatedAnswer,
  }
}

function LessonAnswerInput(
  props: Readonly<{
    t: Translate
    tCommon: Translate
    targetLanguageCode: string
    id: string
    exercise: ExerciseItem
    lesson: LessonData | null
    answer: string
    isEvaluated: boolean
    isReview: boolean
    evaluating: boolean
    onAnswerChange: (answer: string) => void
    submitAnswer: (answer?: string) => void
  }>
) {
  const { exercise } = props
  const hasMultipleChoiceOptions =
    exercise.exercise_type === 'multiple_choice' &&
    Array.isArray(exercise.options) &&
    exercise.options.length > 0
  if (hasMultipleChoiceOptions) return <LessonMultipleChoiceInput {...props} />
  if (exercise.exercise_type === 'pronunciation')
    return <LessonPronunciationInput {...props} />
  const feedback = exerciseAnswerFeedback(props.id, exercise)
  return <LessonFreeWriteInput {...props} {...feedback} />
}

function LessonCorrections({
  t,
  targetLanguageCode,
  id,
  exercise,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  id: string
  exercise: ExerciseItem
}>) {
  const correctionOccurrences = documentOccurrences(
    ['lesson', id, 'exercise', String(exercise.id), 'corrections'],
    exercise.corrections ?? []
  ).filter(({ value }) => value.original && value.corrected)
  if (!correctionOccurrences.length) return null
  return (
    <div className="border-fl-border border px-4 py-4">
      <p className="text-fl-label text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
        {t('corrections')}
      </p>
      <ul className="space-y-3">
        {correctionOccurrences.map(({ value: correction, key }) => (
          <li key={key}>
            <p className={getTargetLanguageTextClass(targetLanguageCode)}>
              <del className="text-fl-error-fg decoration-fl-error-fg/70 line-through">
                {correction.original}
              </del>
              <span className="text-fl-muted-3"> → </span>
              <ins className="text-fl-success decoration-fl-success/70 font-semibold">
                {correction.corrected}
              </ins>
            </p>
            {correction.explanation && (
              <p className="text-fl-muted-2 mt-1 text-sm">
                {correction.explanation}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExerciseNativeExplanation({
  t,
  tCommon,
  exercise,
  nativeLanguageName,
  loadingExerciseNativeExplanationId,
  exerciseNativeExplanationErrorId,
  generateExerciseNativeExplanation,
}: Readonly<{
  t: Translate
  tCommon: Translate
  exercise: ExerciseItem
  nativeLanguageName: string
  loadingExerciseNativeExplanationId: number | null
  exerciseNativeExplanationErrorId: number | null
  generateExerciseNativeExplanation: (id: number) => void
}>) {
  return (
    <>
      {exercise.native_explanation && nativeLanguageName && (
        <div className="border-fl-border mt-4 border-t pt-4">
          <p className="text-fl-label text-fl-muted-3 mb-2 font-mono tracking-widest uppercase">
            {nativeLanguageName}
          </p>
          <p className="text-fl-muted-1 max-w-[70ch] text-base leading-relaxed">
            {exercise.native_explanation}
          </p>
        </div>
      )}
      {!exercise.native_explanation && nativeLanguageName && (
        <div className="border-fl-border mt-4 border-t pt-4 text-center">
          <button
            type="button"
            onClick={() => generateExerciseNativeExplanation(exercise.id)}
            disabled={loadingExerciseNativeExplanationId === exercise.id}
            className="text-fl-hint text-fl-muted-3 hover:text-fl-fg font-mono text-sm transition-colors disabled:opacity-50"
          >
            {nativeRequestLabel(
              loadingExerciseNativeExplanationId === exercise.id,
              exerciseNativeExplanationErrorId === exercise.id,
              () => tCommon('retry'),
              () => `${t('showNativeExplanation')} ${nativeLanguageName}`
            )}
          </button>
        </div>
      )}
    </>
  )
}

function LessonFeedbackExplanation({
  t,
  targetLanguageCode,
  tCommon,
  exercise,
  nativeLanguageName,
  loadingExerciseNativeExplanationId,
  exerciseNativeExplanationErrorId,
  generateExerciseNativeExplanation,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  tCommon: Translate
  exercise: ExerciseItem
  nativeLanguageName: string
  loadingExerciseNativeExplanationId: number | null
  exerciseNativeExplanationErrorId: number | null
  generateExerciseNativeExplanation: (id: number) => void
}>) {
  if (!exercise.explanation) return null
  return (
    <div className="border-fl-border border px-4 py-4">
      <p className="text-fl-label text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
        {t('explanation')}
      </p>
      <TargetLanguageText
        as="p"
        languageCode={targetLanguageCode}
        className="text-fl-muted-1 max-w-[70ch]"
      >
        {exercise.explanation}
      </TargetLanguageText>
      <ExerciseNativeExplanation
        t={t}
        tCommon={tCommon}
        exercise={exercise}
        nativeLanguageName={nativeLanguageName}
        loadingExerciseNativeExplanationId={loadingExerciseNativeExplanationId}
        exerciseNativeExplanationErrorId={exerciseNativeExplanationErrorId}
        generateExerciseNativeExplanation={generateExerciseNativeExplanation}
      />
    </div>
  )
}

function LessonNextAction({
  t,
  tCommon,
  hasNextExercise,
  isReview,
  freemiumExhausted,
  completingLesson,
  nextExercise,
  onBackToPlan,
  completeLessonHandler,
}: Readonly<{
  t: Translate
  tCommon: Translate
  hasNextExercise: boolean
  isReview: boolean
  freemiumExhausted: boolean | null
  completingLesson: boolean
  nextExercise: () => void
  onBackToPlan: () => void
  completeLessonHandler: () => void
}>) {
  if (hasNextExercise) {
    return (
      <button
        onClick={nextExercise}
        className="border-fl-border text-fl-muted-1 hover:text-fl-fg hover:border-fl-border-2 border px-6 py-2 font-mono text-xs tracking-widest uppercase transition-colors"
      >
        {tCommon('next')} →
      </button>
    )
  }
  if (isReview) {
    return (
      <button
        onClick={onBackToPlan}
        className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 px-6 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors"
      >
        {t('backToPlan')}
      </button>
    )
  }
  if (freemiumExhausted) return <PaywallBanner feature="lessons" compact />
  return (
    <button
      onClick={completeLessonHandler}
      disabled={completingLesson}
      className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 px-6 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      {t('completeLesson')}
    </button>
  )
}

function LessonFeedback({
  t,
  targetLanguageCode,
  tCommon,
  id,
  exercise,
  nativeLanguageName,
  loadingExerciseNativeExplanationId,
  exerciseNativeExplanationErrorId,
  generateExerciseNativeExplanation,
  hasNextExercise,
  isReview,
  freemiumExhausted,
  completingLesson,
  nextExercise,
  onBackToPlan,
  completeLessonHandler,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  tCommon: Translate
  id: string
  exercise: ExerciseItem
  nativeLanguageName: string
  loadingExerciseNativeExplanationId: number | null
  exerciseNativeExplanationErrorId: number | null
  generateExerciseNativeExplanation: (id: number) => void
  hasNextExercise: boolean
  isReview: boolean
  freemiumExhausted: boolean | null
  completingLesson: boolean
  nextExercise: () => void
  onBackToPlan: () => void
  completeLessonHandler: () => void
}>) {
  return (
    <div className="space-y-4">
      {exercise.feedback && (
        <div className="border-fl-border border px-4 py-4">
          <p className="text-fl-label text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
            {t('feedback')}
          </p>
          <TargetLanguageText
            as="p"
            languageCode={targetLanguageCode}
            className="text-fl-muted-1 max-w-[70ch]"
          >
            {exercise.feedback}
          </TargetLanguageText>
        </div>
      )}
      <LessonCorrections
        t={t}
        id={id}
        exercise={exercise}
        targetLanguageCode={targetLanguageCode}
      />
      <LessonFeedbackExplanation
        t={t}
        tCommon={tCommon}
        exercise={exercise}
        targetLanguageCode={targetLanguageCode}
        nativeLanguageName={nativeLanguageName}
        loadingExerciseNativeExplanationId={loadingExerciseNativeExplanationId}
        exerciseNativeExplanationErrorId={exerciseNativeExplanationErrorId}
        generateExerciseNativeExplanation={generateExerciseNativeExplanation}
      />
      <div className="flex items-center gap-4">
        <div className="border-fl-border border px-4 py-2">
          <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
            {tCommon('score')}{' '}
          </span>
          <span className="text-fl-fg font-mono text-sm font-bold">
            {exercise.score !== null
              ? Math.round((exercise.score ?? 0) * 100) + '%'
              : 'N/A'}
          </span>
        </div>
        <LessonNextAction
          t={t}
          tCommon={tCommon}
          hasNextExercise={hasNextExercise}
          isReview={isReview}
          freemiumExhausted={freemiumExhausted}
          completingLesson={completingLesson}
          nextExercise={nextExercise}
          onBackToPlan={onBackToPlan}
          completeLessonHandler={completeLessonHandler}
        />
      </div>
    </div>
  )
}

function LessonSubmitAction({
  t,
  tCommon,
  tError,
  exercise,
  evaluating,
  answer,
  submitError,
  submitAnswer,
}: Readonly<{
  t: Translate
  tCommon: Translate
  tError: Translate
  exercise: ExerciseItem
  evaluating: boolean
  answer: string
  submitError: boolean
  submitAnswer: (answer?: string) => void
}>) {
  if (exercise.exercise_type === 'pronunciation') return null
  return (
    <>
      <button
        onClick={() => submitAnswer()}
        disabled={evaluating || !answer.trim()}
        className="bg-fl-fg text-fl-bg hover:bg-fl-fg/90 focus-visible:outline-fl-fg w-full py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
      >
        {evaluating ? tCommon('checking') : t('submitAnswer')}
      </button>
      {submitError && (
        <p className="text-fl-error font-mono text-xs">{tError('title')}</p>
      )}
    </>
  )
}

function LessonVocabularyItemView({
  targetLanguageCode,
  item,
}: Readonly<{
  targetLanguageCode: string
  item: LessonVocabularyItem
}>) {
  return (
    <div className="border-fl-border border px-4 py-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.word && (
            <TargetLanguageText
              as="p"
              languageCode={targetLanguageCode}
              className="text-fl-fg font-semibold"
              reading={item.reading}
            >
              {item.word}
            </TargetLanguageText>
          )}
          {item.translation && (
            <p className="text-fl-muted-2 mt-1 text-sm">{item.translation}</p>
          )}
        </div>
        {item.example && <AudioPlayer text={item.example} size="sm" />}
      </div>
      {item.definition && (
        <TargetLanguageText
          as="p"
          languageCode={targetLanguageCode}
          className="text-fl-muted-1"
        >
          {item.definition}
        </TargetLanguageText>
      )}
      {item.example && (
        <div className="border-fl-border mt-3 border-t pt-3">
          <TargetLanguageText
            as="p"
            languageCode={targetLanguageCode}
            className="text-fl-muted-2 italic"
          >
            {item.example}
          </TargetLanguageText>
          {item.example_translation && (
            <p className="text-fl-hint text-fl-muted-3 mt-1 text-sm">
              {item.example_translation}
            </p>
          )}
        </div>
      )}
      {item.note && (
        <p className="text-fl-hint text-fl-muted-3 mt-3 text-sm">{item.note}</p>
      )}
    </div>
  )
}

function LessonVocabulary({
  t,
  targetLanguageCode,
  id,
  lesson,
}: Readonly<{
  t: Translate
  targetLanguageCode: string
  id: string
  lesson: LessonData | null
}>) {
  const vocabItems = (lesson?.content?.vocabulary ??
    []) as LessonVocabularyItem[]
  if (!vocabItems.length) return null
  return (
    <div className="border-fl-border bg-fl-surface border p-5">
      <p className="text-fl-label text-fl-muted-2 mb-3 font-mono tracking-widest uppercase">
        {t('vocabulary')}
      </p>
      <div className="space-y-3">
        {documentOccurrences(['lesson', id, 'vocabulary'], vocabItems).map(
          ({ value: item, key }) => (
            <LessonVocabularyItemView
              key={key}
              targetLanguageCode={targetLanguageCode}
              item={item}
            />
          )
        )}
      </div>
    </div>
  )
}

function LessonRelatedGrammar({
  t,
  lesson,
  grammarTopics,
}: Readonly<{
  t: Translate
  lesson: LessonData | null
  grammarTopics: readonly GrammarTopic[]
}>) {
  const grammarRefs = (lesson?.content?.grammar_refs ?? []) as string[]
  if (!grammarRefs.length) return null
  return (
    <div className="border-fl-border bg-fl-surface border p-5">
      <p className="text-fl-label text-fl-muted-2 mb-3 font-mono tracking-widest uppercase">
        {t('relatedGrammar')}
      </p>
      <div className="flex flex-wrap gap-2">
        {grammarRefs.map((slug) => {
          const topic = grammarTopics.find((t) => t.slug === slug)
          if (!topic) return null
          return (
            <Link
              key={slug}
              href={`/grammar/${slug}`}
              className="border-fl-border text-fl-label text-fl-muted-2 hover:border-fl-border-2 hover:text-fl-fg border px-3 py-1.5 font-mono tracking-widest uppercase transition-colors"
            >
              ● {topic.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function LessonPage() {
  const t = useTranslations('lesson')
  const tCommon = useTranslations('common')
  const tPlan = useTranslations('plan')
  const tError = useTranslations('error')
  const tLang = useTranslations('languages')
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const completeLesson = useProgressStore((s) => s.completeLesson)
  const activeLanguage = useLanguageStore((s) => s.activeLanguage)
  const user = useAuthStore((s) => s.user)
  const stripeEnabled = useConfigStore((s) => s.stripeEnabled)
  const fetchFreemium = useFreemiumStore((s) => s.fetchStatus)
  const freemiumStatus = useFreemiumStore((s) => s.status)
  const freemiumExhausted =
    stripeEnabled &&
    !isSubscribed(user, stripeEnabled) &&
    !isFreemiumTrialActive(user, stripeEnabled) &&
    freemiumStatus &&
    freemiumStatus.lessons_remaining <= 0
  const nativeLanguageName = user?.native_language
    ? formatLanguageName(tLang(user.native_language), locale)
    : ''
  const langAtLoad = useRef(activeLanguage?.code ?? null)
  const {
    selectedWord,
    tooltipPos,
    saveState,
    handleTextSelection,
    handleSaveWord,
    dismissTooltip,
  } = useWordSave()

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [currentExercise, setCurrentExercise] = useState(0)
  const [answer, setAnswer] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [dayComplete, setDayComplete] = useState(false)
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false)
  const [progressDayAtStart, setProgressDayAtStart] = useState(-1)
  const [grammarTopics, setGrammarTopics] = useState<GrammarTopic[]>([])

  useEffect(() => {
    getGrammarTopics(activeLanguage?.code ?? 'en-GB')
      .then(setGrammarTopics)
      .catch(() => setGrammarTopics([]))
  }, [activeLanguage?.code])

  useEffect(() => {
    if (stripeEnabled && !isSubscribed(user, stripeEnabled)) {
      fetchFreemium()
    }
  }, [stripeEnabled, user, fetchFreemium])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [regeneratingExercise, setRegeneratingExercise] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [loadingNativeExplanation, setLoadingNativeExplanation] =
    useState(false)
  const [nativeExplanationError, setNativeExplanationError] = useState(false)
  const [nativeExplanationOpen, setNativeExplanationOpen] = useState(false)
  const [
    loadingExerciseNativeExplanationId,
    setLoadingExerciseNativeExplanationId,
  ] = useState<number | null>(null)
  const [
    exerciseNativeExplanationErrorId,
    setExerciseNativeExplanationErrorId,
  ] = useState<number | null>(null)
  const [openNativeHintIds, setOpenNativeHintIds] = useState<Set<number>>(
    () => new Set()
  )
  const [loadingExerciseNativeHintId, setLoadingExerciseNativeHintId] =
    useState<number | null>(null)
  const [exerciseNativeHintErrorId, setExerciseNativeHintErrorId] = useState<
    number | null
  >(null)
  const completingLessonRef = useRef(false)
  const [completingLesson, setCompletingLesson] = useState(false)
  const isReview = lesson?.is_completed ?? false

  const loadLesson = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await apiFetch(`/api/lessons/${id}`)
      if (!res.ok) throw new Error('Lesson unavailable')
      const payload: unknown = await res.json()
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('lesson' in payload) ||
        !payload.lesson ||
        typeof payload.lesson !== 'object' ||
        !('exercises' in payload) ||
        !Array.isArray(payload.exercises)
      )
        throw new Error('Invalid lesson response')
      const data = payload as { lesson: LessonData; exercises: ExerciseItem[] }
      setLesson(data.lesson)
      setExercises(data.exercises)
      setNativeExplanationOpen(
        data.lesson?.cefr_level === 'A1' || data.lesson?.cefr_level === 'A2'
      )
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const generateNativeExplanation = async () => {
    setLoadingNativeExplanation(true)
    setNativeExplanationError(false)
    try {
      const res = await apiFetch(`/api/lessons/${id}/native-explanation`, {
        method: 'POST',
      })
      if (!res.ok) {
        setNativeExplanationError(true)
        return
      }
      const data = await res.json()
      if (data.native_explanation) {
        setLesson((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            content: {
              ...prev.content,
              native_explanation: data.native_explanation,
            },
          }
        })
      }
    } catch {
      setNativeExplanationError(true)
    } finally {
      setLoadingNativeExplanation(false)
    }
  }

  const generateExerciseNativeExplanation = async (exerciseId: number) => {
    setLoadingExerciseNativeExplanationId(exerciseId)
    setExerciseNativeExplanationErrorId(null)
    try {
      const res = await apiFetch(
        `/api/lessons/exercises/${exerciseId}/native-explanation`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setExerciseNativeExplanationErrorId(exerciseId)
        return
      }
      const data = await res.json()
      if (data.native_explanation) {
        setExercises((prev) =>
          prev.map((item) =>
            item.id === exerciseId
              ? { ...item, native_explanation: data.native_explanation }
              : item
          )
        )
      }
    } catch {
      setExerciseNativeExplanationErrorId(exerciseId)
    } finally {
      setLoadingExerciseNativeExplanationId(null)
    }
  }

  const showExerciseNativeHint = async (exerciseId: number) => {
    const existing = exercises.find((item) => item.id === exerciseId)
    setOpenNativeHintIds((prev) => new Set(prev).add(exerciseId))
    if (existing?.native_hint) return

    setLoadingExerciseNativeHintId(exerciseId)
    setExerciseNativeHintErrorId(null)
    try {
      const res = await apiFetch(
        `/api/lessons/exercises/${exerciseId}/native-hint`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setExerciseNativeHintErrorId(exerciseId)
        return
      }
      const data = await res.json()
      if (data.native_hint) {
        setExercises((prev) =>
          prev.map((item) =>
            item.id === exerciseId
              ? { ...item, native_hint: data.native_hint }
              : item
          )
        )
      }
    } catch {
      setExerciseNativeHintErrorId(exerciseId)
    } finally {
      setLoadingExerciseNativeHintId(null)
    }
  }

  // Capture progress_day at the time the lesson starts (for day-complete detection)
  useEffect(() => {
    apiFetch('/api/study-plan/today')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.progress_day !== undefined) setProgressDayAtStart(d.progress_day)
      })
      .catch(() => {})
  }, [])

  // Redirect to plan page if the user switches language while viewing a lesson
  useEffect(() => {
    const current = activeLanguage?.code ?? null
    if (langAtLoad.current && current && current !== langAtLoad.current) {
      router.replace('/plan')
    }
  }, [activeLanguage?.code, router])

  // Restore the answer field whenever the active exercise changes
  // (seeds previous user_answer for already-answered exercises, clears for fresh ones)
  useEffect(() => {
    const ex = exercises[currentExercise]
    setAnswer(
      ex?.score !== null && ex?.score !== undefined
        ? (ex.user_answer ?? '')
        : ''
    )
    setRegenerateError(null)
  }, [currentExercise, exercises])

  // Navigation or regeneration can replace the selected text. Answers and
  // hints keep the question unchanged and must not close a tooltip mid-save.
  const activeQuestion = exercises[currentExercise]?.question
  useEffect(() => {
    dismissTooltip()
  }, [currentExercise, activeQuestion, dismissTooltip])

  async function submitAnswer(overrideAnswer?: string) {
    if (isReview) return
    const finalAnswer = overrideAnswer ?? answer
    if (!finalAnswer.trim()) return
    const exercise = exercises[currentExercise]
    if (!exercise) return
    setEvaluating(true)
    try {
      const res = await apiFetch(
        `/api/lessons/exercises/${exercise.id}/answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: finalAnswer }),
        }
      )
      const result = await res.json()
      setExercises((prev) => {
        const copy = [...prev]
        copy[currentExercise] = {
          ...exercise,
          score: result.score,
          feedback: result.feedback,
          corrections: result.corrections ?? null,
          user_answer: finalAnswer,
        }
        return copy
      })
      if (overrideAnswer !== undefined) setAnswer(overrideAnswer)
      setSubmitError(false)
    } catch {
      setSubmitError(true)
    } finally {
      setEvaluating(false)
    }
  }

  async function regenerateCurrentExercise() {
    const exercise = exercises[currentExercise]
    if (!exercise) return
    if (!exercise || isEvaluated || isReview) return

    setRegeneratingExercise(true)
    setRegenerateError(null)
    try {
      const res = await apiFetch(
        `/api/lessons/exercises/${exercise.id}/regenerate`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setRegenerateError(
          res.status === 400 ? t('regenerateNotNeeded') : t('regenerateError')
        )
        return
      }
      const regenerated = await res.json()
      setExercises((prev) => {
        const copy = [...prev]
        copy[currentExercise] = regenerated
        return copy
      })
      setAnswer('')
      setSubmitError(false)
    } catch {
      setRegenerateError(t('regenerateError'))
    } finally {
      setRegeneratingExercise(false)
    }
  }

  function nextExercise() {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1)
    }
  }

  async function completeLessonHandler() {
    if (completingLessonRef.current) return
    completingLessonRef.current = true
    setCompletingLesson(true)

    try {
      const completedUnitId = getLessonUnitId(lesson)
      const res = await apiFetch(`/api/lessons/${id}/complete`, {
        method: 'POST',
      })
      if (!res.ok) return
      if (
        !isSubscribed(user, stripeEnabled) &&
        !isFreemiumTrialActive(user, stripeEnabled)
      ) {
        await fetchFreemium(true)
      }
      if (lesson) completeLesson(lesson.id)
      // Detect if completing this lesson advanced the plan to the next day
      try {
        const todayRes = await apiFetch('/api/study-plan/today')
        if (todayRes.ok) {
          const d = await todayRes.json()
          if (progressDayAtStart >= 0 && d.progress_day > progressDayAtStart) {
            setDayComplete(true)
          }
          const nextUnitId = d.lessons?.find(
            (item: { unit_id?: string | null }) => item.unit_id
          )?.unit_id
          const planComplete = isPlanPositionComplete(d)
          const unitCompleted =
            !!completedUnitId &&
            ((!!nextUnitId && nextUnitId !== completedUnitId) || planComplete)
          if (
            shouldShowUnitReviewPrompt(
              getReviewPromptDismissal(),
              unitCompleted
            )
          ) {
            setReviewPromptOpen(true)
          }
        }
      } catch {
        // Non-fatal: failing to detect day-advance does not prevent lesson completion
      }
      setCompleted(true)
    } finally {
      completingLessonRef.current = false
      setCompletingLesson(false)
    }
  }

  if (loading) {
    return <PageLoading label={t('loading')} />
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
        <p className="text-fl-muted-2 font-mono text-sm">{tError('body')}</p>
        <button
          onClick={() => {
            setLoadError(false)
            loadLesson()
          }}
          className="text-fl-accent font-mono text-xs tracking-widest uppercase underline"
        >
          {tError('retry')}
        </button>
        <Link
          href="/dashboard"
          className="text-fl-muted-3 font-mono text-xs tracking-widest uppercase underline"
        >
          {t('backToPlan')}
        </Link>
      </div>
    )
  }

  if (completed) {
    return (
      <LessonCompletionView
        t={t}
        tCommon={tCommon}
        lesson={lesson}
        exercises={exercises}
        dayComplete={dayComplete}
        reviewPromptOpen={reviewPromptOpen}
        onCloseReviewPrompt={() => setReviewPromptOpen(false)}
      />
    )
  }

  const exercise = exercises[currentExercise]
  if (!exercise) return
  const isEvaluated = exercise?.score !== null

  const targetLanguageCode = activeLanguage?.code ?? 'en-GB'

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {!isReview && <FreemiumQuotaBanner feature="lessons" />}
        {/* Lesson header */}
        <div className="border-fl-border bg-fl-surface border">
          <div className="border-fl-border flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-fl-label text-fl-muted-2">●</span>
              <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
                {t('label')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-fl-hint text-fl-muted-2 border-fl-border border px-2 py-1 font-mono tracking-widest uppercase">
                {lesson?.cefr_level}
              </span>
              <span className="text-fl-hint text-fl-muted-2 border-fl-border border px-2 py-1 font-mono tracking-widest uppercase">
                {lessonTypeLabel(lesson?.lesson_type, tPlan)}
              </span>
              <button
                onClick={() =>
                  isReview ? router.push('/plan') : setShowExitConfirm(true)
                }
                className="text-fl-muted-3 hover:text-fl-fg ml-1 font-mono text-lg leading-none transition-colors"
                aria-label={t('exit')}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-fl-fg font-mono text-base font-bold tracking-wide">
              {lesson?.title}
            </p>
            <LessonExplanation
              t={t}
              id={id}
              lesson={lesson}
              targetLanguageCode={targetLanguageCode}
              handleTextSelection={handleTextSelection}
            />
            {/* Native explanation */}
            <NativeExplanation
              t={t}
              tCommon={tCommon}
              id={id}
              lesson={lesson}
              targetLanguageCode={targetLanguageCode}
              nativeLanguageName={nativeLanguageName}
              nativeExplanationOpen={nativeExplanationOpen}
              onToggle={() => setNativeExplanationOpen((open) => !open)}
              loadingNativeExplanation={loadingNativeExplanation}
              nativeExplanationError={nativeExplanationError}
              generateNativeExplanation={generateNativeExplanation}
            />
          </div>
        </div>

        {/* Exercise */}
        {exercise && (
          <div className="border-fl-border bg-fl-surface border">
            <div className="border-fl-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-fl-label text-fl-muted-2">●</span>
                <span className="text-fl-caption text-fl-muted-1 font-mono tracking-widest uppercase">
                  {t('exercise')} {currentExercise + 1} / {exercises.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-fl-hint text-fl-muted-2 border-fl-border border px-2 py-1 font-mono tracking-widest uppercase">
                  {(
                    {
                      multiple_choice: t('exerciseTypeMultipleChoice'),
                      fill_blank: t('exerciseTypeFillBlank'),
                      free_write: t('exerciseTypeFreeWrite'),
                      pronunciation: t('exerciseTypePronunciation'),
                    } as Record<string, string>
                  )[exercise.exercise_type] ?? exercise.exercise_type}
                </span>
                {!isEvaluated && !isReview && (
                  <button
                    type="button"
                    onClick={regenerateCurrentExercise}
                    disabled={regeneratingExercise}
                    className="text-fl-caption text-fl-muted-1 hover:text-fl-fg border-fl-border hover:border-fl-border-2 border px-2 py-1 font-mono tracking-widest uppercase transition-colors disabled:opacity-50"
                  >
                    {regeneratingExercise
                      ? t('regeneratingExercise')
                      : t('regenerateExercise')}
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-fl-border h-1">
              <div
                className="bg-fl-accent h-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${Math.round(((currentExercise + 1) / exercises.length) * 100)}%`,
                }}
              />
            </div>

            <div className="space-y-5 px-6 py-6">
              <TargetLanguageText
                as="p"
                languageCode={targetLanguageCode}
                className="text-fl-fg word-selectable cursor-text select-text"
                onPointerUp={() =>
                  handleTextSelection(
                    exercise.question,
                    lesson?.cefr_level ?? 'B1'
                  )
                }
              >
                {exercise.question}
              </TargetLanguageText>
              {regenerateError && (
                <p className="text-fl-error font-mono text-xs">
                  {regenerateError}
                </p>
              )}

              <LessonNativeHint
                t={t}
                tCommon={tCommon}
                exercise={exercise}
                nativeLanguageName={nativeLanguageName}
                isEvaluated={isEvaluated}
                isNativeHintOpen={openNativeHintIds.has(exercise.id)}
                loadingExerciseNativeHintId={loadingExerciseNativeHintId}
                exerciseNativeHintErrorId={exerciseNativeHintErrorId}
                showExerciseNativeHint={showExerciseNativeHint}
              />

              <LessonAnswerInput
                t={t}
                tCommon={tCommon}
                targetLanguageCode={targetLanguageCode}
                id={id}
                exercise={exercise}
                lesson={lesson}
                answer={answer}
                isEvaluated={isEvaluated}
                isReview={isReview}
                evaluating={evaluating}
                onAnswerChange={setAnswer}
                submitAnswer={submitAnswer}
              />

              {!isEvaluated && !isReview ? (
                <LessonSubmitAction
                  t={t}
                  tCommon={tCommon}
                  tError={tError}
                  exercise={exercise}
                  evaluating={evaluating}
                  answer={answer}
                  submitError={submitError}
                  submitAnswer={submitAnswer}
                />
              ) : (
                <LessonFeedback
                  t={t}
                  tCommon={tCommon}
                  id={id}
                  exercise={exercise}
                  targetLanguageCode={targetLanguageCode}
                  nativeLanguageName={nativeLanguageName}
                  loadingExerciseNativeExplanationId={
                    loadingExerciseNativeExplanationId
                  }
                  exerciseNativeExplanationErrorId={
                    exerciseNativeExplanationErrorId
                  }
                  generateExerciseNativeExplanation={
                    generateExerciseNativeExplanation
                  }
                  hasNextExercise={currentExercise < exercises.length - 1}
                  isReview={isReview}
                  freemiumExhausted={freemiumExhausted}
                  completingLesson={completingLesson}
                  nextExercise={nextExercise}
                  onBackToPlan={() => router.push('/plan')}
                  completeLessonHandler={completeLessonHandler}
                />
              )}
            </div>
          </div>
        )}

        {/* Vocabulary */}
        <LessonVocabulary
          t={t}
          id={id}
          lesson={lesson}
          targetLanguageCode={targetLanguageCode}
        />

        {/* Related Grammar */}
        <LessonRelatedGrammar
          t={t}
          lesson={lesson}
          grammarTopics={grammarTopics}
        />
      </div>

      <ConfirmDialog
        open={showExitConfirm}
        title={t('exitConfirmTitle')}
        message={t('exitConfirmMessage')}
        confirmLabel={t('exit')}
        danger
        onConfirm={() => router.push('/dashboard')}
        onCancel={() => setShowExitConfirm(false)}
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
    </>
  )
}
