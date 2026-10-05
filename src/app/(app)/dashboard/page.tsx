import { useEffect, useState, useCallback } from 'react'
import Link from '@/components/ui/app-link'
import { useTranslations } from 'use-intl'
import { Check } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  isSubscribed,
  needsPaymentRecovery,
  isFreemiumTrialActive,
  useAuthStore,
} from '@/store/auth'
import { useProgressStore } from '@/store/progress'
import { useLanguageStore } from '@/store/language'
import { useConfigStore } from '@/store/config'
import OnboardingTour from '@/components/tour/OnboardingTour'
import WhatsNew from '@/components/whats-new/WhatsNew'
import { PageLoading } from '@/components/ui/page-loading'
import { SubscriptionPlanButtons } from '@/components/billing/SubscriptionPlanButtons'
import { DashboardAnnouncement } from '@/components/dashboard/DashboardAnnouncement'

interface TodayLessonItem {
  id: number | null
  title: string
  lesson_type: string
  week: number
  day: number
  objectives: string[]
  estimated_minutes: number
  is_completed: boolean
}

interface CompletionState {
  state: 'in_progress' | 'ready' | 'taken'
  score: number | null
  recommendation: string | null
  next_level: string | null
}

type Translate = ReturnType<typeof useTranslations>
type TodayLesson = ReturnType<
  typeof useProgressStore.getState
>['todayLessons'][number]

function getPlanProgress(
  hasPlan: boolean,
  complete: boolean,
  day: number,
  total: number
) {
  let planCompletion = 0
  if (hasPlan && total > 0) {
    planCompletion = complete
      ? 100
      : Math.min(100, Math.round((day / total) * 100))
  }
  const daysRemaining = hasPlan && !complete ? Math.max(total - day, 0) : 0
  return { planCompletion, daysRemaining }
}

function emptyTodayKey(hasPlan: boolean, completion: CompletionState | null) {
  if (!hasPlan) return 'startWithAssessment'
  if (completion?.state === 'ready') return 'levelTestReady'
  if (completion?.state === 'taken') return 'levelTestCompleted'
  return 'allCaughtUp'
}

function premiumTitle(
  t: Translate,
  active: boolean,
  days: number,
  recovery: boolean
) {
  if (active) return t('freemiumTrialTitle', { days })
  return t(recovery ? 'premiumBannerPastDueTitle' : 'premiumBannerTitle')
}

function premiumDescription(
  t: Translate,
  active: boolean,
  days: number,
  recovery: boolean,
  eligible: boolean
) {
  if (active) return t('freemiumTrialDesc', { days })
  if (recovery) return t('premiumBannerPastDueDesc')
  return t(eligible ? 'premiumBannerDesc' : 'premiumBannerDescTrialUsed')
}

function premiumCta(t: Translate, recovery: boolean, eligible: boolean) {
  if (recovery) return t('premiumBannerPastDueCta')
  return t(eligible ? 'premiumBannerCta' : 'premiumBannerCtaTrialUsed')
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tAssessment = useTranslations('assessment')
  const tBilling = useTranslations('billing')
  const tNav = useTranslations('nav')
  const tPlan = useTranslations('plan')
  const tTarget = useTranslations('targetLanguages')
  const tError = useTranslations('error')
  const user = useAuthStore((s) => s.user)
  const stripeEnabled = useConfigStore((s) => s.stripeEnabled)
  const trialEligible = !user?.trial_used
  const freemiumTrialActive = isFreemiumTrialActive(user, stripeEnabled)
  const [freemiumTrialDaysLeft, setFreemiumTrialDaysLeft] = useState(0)

  useEffect(() => {
    if (freemiumTrialActive && user?.freemium_trial_ends_at) {
      const days = Math.max(
        1,
        Math.ceil(
          (new Date(user.freemium_trial_ends_at).getTime() - Date.now()) /
            86400000
        )
      )
      setFreemiumTrialDaysLeft(days)
    }
  }, [freemiumTrialActive, user?.freemium_trial_ends_at])

  const {
    streak,
    xp,
    skills,
    todayLessons,
    completedToday,
    setProgress,
    setTodayLessons,
  } = useProgressStore()
  const activeLanguage = useLanguageStore((s) => s.activeLanguage)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasPlan, setHasPlan] = useState(false)
  const [planId, setPlanId] = useState<number | null>(null)
  const [completion, setCompletion] = useState<CompletionState | null>(null)
  const [cefrLevel, setCefrLevel] = useState<string | null>(null)
  const [progressDay, setProgressDay] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [totalLessons, setTotalLessons] = useState(0)
  const [totalExercises, setTotalExercises] = useState(0)
  const [exercisesCorrect, setExercisesCorrect] = useState(0)
  const [accuracy, setAccuracy] = useState(0)
  const [vocabularyLevel, setVocabularyLevel] = useState<string | null>(null)
  const [vocabularyMastered, setVocabularyMastered] = useState(0)
  const [vocabularyTotal, setVocabularyTotal] = useState(0)
  const [vocabularyProgress, setVocabularyProgress] = useState(0)
  const [skipping, setSkipping] = useState(false)
  const [skipError, setSkipError] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [progRes, planRes] = await Promise.all([
        apiFetch('/api/progress/summary'),
        apiFetch('/api/study-plan/today'),
      ])
      if (progRes.ok) {
        const prog = await progRes.json()
        setProgress({
          streak: prog.current_streak ?? 0,
          xp: prog.total_xp ?? 0,
          skills: prog.skills ?? {},
        })
        setTotalLessons(prog.total_lessons ?? 0)
        setTotalExercises(prog.total_exercises ?? 0)
        setExercisesCorrect(prog.exercises_correct ?? 0)
        setAccuracy(prog.accuracy ?? 0)
        setVocabularyLevel(prog.vocabulary_level ?? null)
        setVocabularyMastered(prog.vocabulary_mastered ?? 0)
        setVocabularyTotal(prog.vocabulary_total ?? 0)
        setVocabularyProgress(prog.vocabulary_progress ?? 0)
      } else {
        setProgress({ streak: 0, xp: 0, skills: {} })
        setTotalLessons(0)
        setTotalExercises(0)
        setExercisesCorrect(0)
        setAccuracy(0)
        setVocabularyLevel(null)
        setVocabularyMastered(0)
        setVocabularyTotal(0)
        setVocabularyProgress(0)
      }
      if (planRes.ok) {
        const plan = await planRes.json()
        setCefrLevel(plan.cefr_level ?? null)
        setPlanId(plan.plan_id ?? null)
        setCompletion(plan.completion ?? null)
        setProgressDay(plan.progress_day ?? 0)
        setTotalDays(plan.total_days ?? 0)
        setPendingCount(plan.pending_count ?? 0)
        setTodayLessons(
          plan.lessons.map((l: TodayLessonItem) => ({
            id: l.id,
            title: l.title,
            lessonType: l.lesson_type,
            week: l.week,
            day: l.day,
            objectives: l.objectives || [],
            estimatedMinutes: l.estimated_minutes || 25,
            isCompleted: l.is_completed,
          }))
        )
        setHasPlan(true)
      } else {
        setCefrLevel(null)
        setPlanId(null)
        setCompletion(null)
        setProgressDay(0)
        setTotalDays(0)
        setPendingCount(0)
        setTodayLessons([])
        setHasPlan(false)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch when active language changes
  }, [setProgress, setTodayLessons, activeLanguage?.code])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function skipDay() {
    if (skipping) return
    setSkipping(true)
    try {
      await apiFetch('/api/study-plan/skip-day', { method: 'POST' })
      await loadData()
    } catch {
      setSkipError(true)
    } finally {
      setSkipping(false)
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (!res.ok) throw new Error(tBilling('portalError'))
      const { url } = await res.json()
      window.location.assign(url)
    } catch {
      setPortalError(tBilling('portalError'))
      setPortalLoading(false)
    }
  }

  if (loading) {
    return <PageLoading label={t('loadingProgress')} minHeight="min-h-screen" />
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-fl-muted-2 font-mono text-sm">{tError('body')}</p>
        <button
          onClick={() => {
            setLoadError(false)
            setLoading(true)
            loadData()
          }}
          className="text-fl-accent font-mono text-xs tracking-widest uppercase underline"
        >
          {tError('retry')}
        </button>
      </div>
    )
  }

  const skillEntries = Object.entries(skills)
    .map(([skill, value]) => ({ skill, value: value as number }))
    .sort((a, b) => a.value - b.value)
  const completedLessonCount = todayLessons.filter(
    (lesson) =>
      (lesson.id && completedToday.includes(lesson.id)) || lesson.isCompleted
  ).length
  const nextLesson = todayLessons.find(
    (lesson) =>
      lesson.id && !completedToday.includes(lesson.id) && !lesson.isCompleted
  )
  const planPositionComplete =
    completion?.state === 'ready' || completion?.state === 'taken'
  const { planCompletion, daysRemaining } = getPlanProgress(
    hasPlan,
    planPositionComplete,
    progressDay,
    totalDays
  )
  const currentDayDisplay = planPositionComplete
    ? totalDays
    : Math.min(progressDay + 1, totalDays)
  const vocabularyProgressPct = Math.round(vocabularyProgress * 100)
  const paymentRecovery = needsPaymentRecovery(user)
  const showPremiumBanner = stripeEnabled && !isSubscribed(user, stripeEnabled)

  function getPerformanceLabel(value: number) {
    if (value < 0.5) return t('performanceNeedsPractice')
    if (value < 0.8) return t('performanceInProgress')
    return t('performanceStrong')
  }

  return (
    <>
      <OnboardingTour />
      <WhatsNew />
      <div className="mx-auto max-w-4xl p-6">
        {/* Header */}
        <div className="border-fl-border mb-6 border-b pb-4">
          <p className="text-fl-label text-fl-muted-2 mb-1 font-mono tracking-widest uppercase">
            {t('welcomeBack')}
          </p>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-fl-fg font-mono text-2xl font-bold tracking-tight">
                {user?.displayName || user?.username}
              </h1>
              {activeLanguage && (
                <p className="text-fl-muted-1 mt-2 font-mono text-sm">
                  {tTarget(activeLanguage.code)}
                  {cefrLevel ? ` (${cefrLevel})` : ''}
                </p>
              )}
            </div>
            {hasPlan && totalDays > 0 && (
              <p className="text-fl-hint text-fl-muted-2 font-mono tracking-widest uppercase">
                {t('dayProgress', {
                  current: currentDayDisplay,
                  total: totalDays,
                })}
              </p>
            )}
          </div>
        </div>

        <DashboardAnnouncement />

        {/* Next step */}
        <DashboardNextStep
          t={t}
          tAssessment={tAssessment}
          tPlan={tPlan}
          hasPlan={hasPlan}
          todayLessons={todayLessons}
          completedLessonCount={completedLessonCount}
          completion={completion}
          planId={planId}
          nextLesson={nextLesson}
          pendingCount={pendingCount}
        />

        {/* Stats row */}
        <DashboardStats
          t={t}
          streak={streak}
          xp={xp}
          totalLessons={totalLessons}
          totalExercises={totalExercises}
          accuracy={accuracy}
          exercisesCorrect={exercisesCorrect}
        />

        <div className="bg-fl-border mb-8 grid gap-px sm:grid-cols-2">
          {/* Plan progress */}
          <DashboardPlanProgress
            t={t}
            hasPlan={hasPlan}
            totalDays={totalDays}
            planCompletion={planCompletion}
            currentDayDisplay={currentDayDisplay}
            daysRemaining={daysRemaining}
            vocabularyTotal={vocabularyTotal}
            vocabularyLevel={vocabularyLevel}
            cefrLevel={cefrLevel}
            vocabularyProgressPct={vocabularyProgressPct}
            vocabularyMastered={vocabularyMastered}
          />

          {/* Today's lessons */}
          <DashboardTodayLessons
            t={t}
            tPlan={tPlan}
            tError={tError}
            todayLessons={todayLessons}
            completedToday={completedToday}
            nextLesson={nextLesson}
            activeLanguage={activeLanguage}
            planId={planId}
            skipDay={skipDay}
            skipping={skipping}
            skipError={skipError}
            hasPlan={hasPlan}
            completion={completion}
          />

          {/* Recent performance */}
          <DashboardPerformance
            t={t}
            tPlan={tPlan}
            skillEntries={skillEntries}
            getPerformanceLabel={getPerformanceLabel}
          />
        </div>

        {showPremiumBanner && (
          <DashboardPremiumBanner
            t={t}
            tBilling={tBilling}
            freemiumTrialActive={freemiumTrialActive}
            freemiumTrialDaysLeft={freemiumTrialDaysLeft}
            paymentRecovery={paymentRecovery}
            trialEligible={trialEligible}
            portalLoading={portalLoading}
            portalError={portalError}
            handleManageSubscription={handleManageSubscription}
          />
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {hasPlan && (
            <Link href="/plan">
              <button className="text-fl-bg bg-fl-fg hover:bg-fl-accent/90 px-4 py-2 font-mono text-sm tracking-widest uppercase transition-colors">
                {t('goToMyPlan')}
              </button>
            </Link>
          )}
          {pendingCount > 0 && (
            <Link href="/plan">
              <button className="text-fl-fg border-fl-accent/50 hover:border-fl-accent border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors">
                {pendingCount} {t('pendingLessons')} →
              </button>
            </Link>
          )}
          <Link href="/flashcards">
            <button className="text-fl-fg border-fl-border hover:border-fl-border-2 border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors">
              {tNav('flashcards')}
            </button>
          </Link>
          <Link href="/chat">
            <button className="text-fl-fg border-fl-border hover:border-fl-border-2 border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors">
              {tNav('tutor')}
            </button>
          </Link>
          <Link href="/assessment">
            <button className="text-fl-fg border-fl-border hover:border-fl-border-2 border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors">
              {tNav('assessment')}
            </button>
          </Link>
        </div>
      </div>
    </>
  )
}

function DashboardNextStep({
  t,
  tAssessment,
  tPlan,
  hasPlan,
  todayLessons,
  completedLessonCount,
  completion,
  planId,
  nextLesson,
  pendingCount,
}: Readonly<{
  t: Translate
  tAssessment: Translate
  tPlan: Translate
  hasPlan: boolean
  todayLessons: TodayLesson[]
  completedLessonCount: number
  completion: CompletionState | null
  planId: number | null
  nextLesson: TodayLesson | undefined
  pendingCount: number
}>) {
  return (
    <div className="border-fl-border bg-fl-surface mb-8 border p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
          {t('nextStep')}
        </p>
        {hasPlan && todayLessons.length > 0 && (
          <div className="text-fl-caption font-mono">
            <p className="text-fl-muted-1">{t('planDayGoal')}</p>
            <p className="text-fl-fg mt-1">
              {t('completedToday', {
                completed: completedLessonCount,
                total: todayLessons.length,
              })}
            </p>
          </div>
        )}
      </div>
      <DashboardNextAction
        t={t}
        tAssessment={tAssessment}
        tPlan={tPlan}
        hasPlan={hasPlan}
        completion={completion}
        planId={planId}
        nextLesson={nextLesson}
        pendingCount={pendingCount}
      />
    </div>
  )
}

function DashboardStats({
  t,
  streak,
  xp,
  totalLessons,
  totalExercises,
  accuracy,
  exercisesCorrect,
}: Readonly<{
  t: Translate
  streak: number
  xp: number
  totalLessons: number
  totalExercises: number
  accuracy: number
  exercisesCorrect: number
}>) {
  return (
    <div className="bg-fl-border mb-8 grid grid-cols-2 gap-px sm:grid-cols-4">
      {[
        { label: t('streak'), value: `${streak}d`, accent: streak > 0 },
        { label: t('xp'), value: xp, accent: false },
        {
          label: t('lessonsCompleted'),
          value: totalLessons,
          accent: false,
        },
        {
          label: t('accuracy'),
          value: totalExercises > 0 ? `${Math.round(accuracy * 100)}%` : '—',
          accent: false,
          detail:
            totalExercises > 0
              ? t('exerciseStats', {
                  correct: exercisesCorrect,
                  total: totalExercises,
                })
              : t('noExercisesYet'),
        },
      ].map((stat) => (
        <div key={stat.label} className="bg-fl-surface px-5 py-5">
          <p className="text-fl-caption text-fl-muted-1 mb-2 font-mono tracking-widest uppercase">
            {stat.label}
          </p>
          <p
            className={`font-mono text-3xl font-bold tracking-tight ${stat.accent ? 'text-fl-accent' : 'text-fl-fg'}`}
          >
            {stat.value}
          </p>
          {'detail' in stat && stat.detail && (
            <p className="text-fl-caption text-fl-muted-1 mt-2 font-mono">
              {stat.detail}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function DashboardPlanProgress({
  t,
  hasPlan,
  totalDays,
  planCompletion,
  currentDayDisplay,
  daysRemaining,
  vocabularyTotal,
  vocabularyLevel,
  cefrLevel,
  vocabularyProgressPct,
  vocabularyMastered,
}: Readonly<{
  t: Translate
  hasPlan: boolean
  totalDays: number
  planCompletion: number
  currentDayDisplay: number
  daysRemaining: number
  vocabularyTotal: number
  vocabularyLevel: string | null
  cefrLevel: string | null
  vocabularyProgressPct: number
  vocabularyMastered: number
}>) {
  return (
    <div className="bg-fl-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-fl-label text-fl-muted-2">●</span>
          <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
            {t('planProgress')}
          </span>
        </div>
        {hasPlan && totalDays > 0 && (
          <span className="text-fl-caption text-fl-muted-1 shrink-0 font-mono tracking-widest">
            {planCompletion}%
          </span>
        )}
      </div>
      {hasPlan && totalDays > 0 ? (
        <>
          <div className="bg-fl-border mb-4 h-1 w-full">
            <div
              className="bg-fl-accent h-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${planCompletion}%` }}
            />
          </div>
          <div className="bg-fl-border grid grid-cols-2 gap-px">
            <div className="bg-fl-bg p-3">
              <p className="text-fl-hint text-fl-muted-2 mb-1 font-mono tracking-widest uppercase">
                {t('currentDay')}
              </p>
              <p className="text-fl-fg font-mono text-lg font-bold">
                {currentDayDisplay} / {totalDays}
              </p>
            </div>
            <div className="bg-fl-bg p-3">
              <p className="text-fl-hint text-fl-muted-2 mb-1 font-mono tracking-widest uppercase">
                {t('daysRemaining')}
              </p>
              <p className="text-fl-fg font-mono text-lg font-bold">
                {daysRemaining}
              </p>
            </div>
          </div>
          {vocabularyTotal > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-fl-hint text-fl-muted-2 font-mono tracking-widest uppercase">
                  {t('vocabularyProgress', {
                    level: vocabularyLevel ?? cefrLevel ?? '',
                  })}
                </p>
                <p className="text-fl-label text-fl-muted-2 font-mono">
                  {vocabularyProgressPct}%
                </p>
              </div>
              <p className="text-fl-caption text-fl-muted-1 mt-2 font-mono">
                {t('vocabularyWords', {
                  mastered: vocabularyMastered,
                  total: vocabularyTotal,
                })}
              </p>
              <div className="bg-fl-border mt-2 h-1 w-full">
                <div
                  className="bg-fl-accent h-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${vocabularyProgressPct}%` }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-fl-muted-2 font-mono text-xs">
          {t('startWithAssessment')}
        </p>
      )}
    </div>
  )
}

function DashboardTodayLessons({
  t,
  tPlan,
  tError,
  todayLessons,
  completedToday,
  nextLesson,
  activeLanguage,
  planId,
  skipDay,
  skipping,
  skipError,
  hasPlan,
  completion,
}: Readonly<{
  t: Translate
  tPlan: Translate
  tError: Translate
  todayLessons: TodayLesson[]
  completedToday: number[]
  nextLesson: TodayLesson | undefined
  activeLanguage: ReturnType<typeof useLanguageStore.getState>['activeLanguage']
  planId: number | null
  skipDay: () => Promise<void>
  skipping: boolean
  skipError: boolean
  hasPlan: boolean
  completion: CompletionState | null
}>) {
  return (
    <div className="bg-fl-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-fl-label text-fl-muted-2">●</span>
          <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
            {t('today')}
          </span>
        </div>
      </div>

      {todayLessons.length > 0 ? (
        <div className="space-y-2">
          {todayLessons.map((lesson) => {
            const isDone =
              (lesson.id && completedToday.includes(lesson.id)) ||
              lesson.isCompleted
            const isNext = nextLesson?.id === lesson.id

            return (
              <div
                key={JSON.stringify([
                  activeLanguage?.code,
                  planId,
                  lesson.week,
                  lesson.day,
                  lesson.title,
                ])}
                className={`border px-4 py-3 ${
                  isNext
                    ? 'border-fl-accent/60 bg-fl-accent/5'
                    : 'border-fl-border'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-fl-fg font-mono text-xs">
                      {lesson.title}
                    </p>
                    <p className="text-fl-label text-fl-muted-2 mt-0.5 font-mono tracking-wider uppercase">
                      {tPlan(`lessonTypes.${lesson.lessonType}`)} ·{' '}
                      {lesson.estimatedMinutes}min
                    </p>
                  </div>
                  <TodayLessonAction
                    t={t}
                    lesson={lesson}
                    isDone={!!isDone}
                    isNext={isNext}
                  />
                </div>
              </div>
            )
          })}
          <div className="pt-1">
            <button
              onClick={skipDay}
              disabled={skipping}
              className="text-fl-hint text-fl-muted-3 hover:text-fl-muted-1 font-mono tracking-widest uppercase transition-colors disabled:opacity-40"
            >
              {skipping ? '...' : t('skipDay')}
            </button>
            {skipError && (
              <p className="text-fl-error mt-1 font-mono text-xs">
                {tError('title')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-fl-muted-2 font-mono text-xs">
            {t(emptyTodayKey(hasPlan, completion))}
          </p>
          {!hasPlan && (
            <Link href="/assessment">
              <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
                {t('takeAssessmentArrow')}
              </button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function DashboardPerformance({
  t,
  tPlan,
  skillEntries,
  getPerformanceLabel,
}: Readonly<{
  t: Translate
  tPlan: Translate
  skillEntries: { skill: string; value: number }[]
  getPerformanceLabel: (value: number) => string
}>) {
  return (
    <div className="bg-fl-surface p-5 sm:col-span-2">
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-fl-label text-fl-muted-2">●</span>
          <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
            {t('recentPerformance')}
          </span>
        </div>
        <p className="text-fl-muted-3 font-mono text-xs">
          {t('recentPerformanceDescription')}
        </p>
      </div>
      {skillEntries.length > 0 ? (
        <div className="space-y-3">
          {skillEntries.map(({ skill, value }) => (
            <div key={skill}>
              <div className="mb-1 flex justify-between">
                <span className="text-fl-label text-fl-muted-1 font-mono tracking-widest uppercase">
                  {tPlan(`lessonTypes.${skill}`)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
                    {getPerformanceLabel(value)}
                  </span>
                  <span className="text-fl-label text-fl-muted-2 font-mono">
                    {Math.round(value * 100)}%
                  </span>
                </div>
              </div>
              <div className="bg-fl-border h-1 w-full">
                <div
                  className="bg-fl-accent h-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-fl-muted-2 font-mono text-xs">{t('noSkills')}</p>
      )}
    </div>
  )
}

function DashboardPremiumBanner({
  t,
  tBilling,
  freemiumTrialActive,
  freemiumTrialDaysLeft,
  paymentRecovery,
  trialEligible,
  portalLoading,
  portalError,
  handleManageSubscription,
}: Readonly<{
  t: Translate
  tBilling: Translate
  freemiumTrialActive: boolean
  freemiumTrialDaysLeft: number
  paymentRecovery: boolean
  trialEligible: boolean
  portalLoading: boolean
  portalError: string | null
  handleManageSubscription: () => Promise<void>
}>) {
  return (
    <div className="border-fl-border bg-fl-surface mb-6 border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="text-fl-accent font-mono text-sm leading-none">
            ★
          </span>
          <div>
            <p className="text-fl-label text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
              {premiumTitle(
                t,
                freemiumTrialActive,
                freemiumTrialDaysLeft,
                paymentRecovery
              )}
            </p>
            <p className="text-fl-muted-2 font-mono text-xs leading-relaxed">
              {premiumDescription(
                t,
                freemiumTrialActive,
                freemiumTrialDaysLeft,
                paymentRecovery,
                trialEligible
              )}
            </p>
          </div>
        </div>
        {!freemiumTrialActive && (
          <span className="text-fl-label text-fl-accent border-fl-accent/30 border px-3 py-1.5 font-mono tracking-widest whitespace-nowrap uppercase">
            {premiumCta(t, paymentRecovery, trialEligible)}
          </span>
        )}
      </div>
      {!freemiumTrialActive &&
        (paymentRecovery ? (
          <div className="border-fl-border mt-4 border-t pt-4">
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 w-full px-4 py-2.5 font-mono text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-50 sm:w-auto"
            >
              {portalLoading ? '...' : tBilling('updatePayment')}
            </button>
            {portalError && (
              <p className="text-fl-hint mt-3 font-mono text-red-500">
                {portalError}
              </p>
            )}
          </div>
        ) : (
          <SubscriptionPlanButtons className="border-fl-border mt-4 border-t pt-4" />
        ))}
    </div>
  )
}

function DashboardNextAction({
  t,
  tAssessment,
  tPlan,
  hasPlan,
  completion,
  planId,
  nextLesson,
  pendingCount,
}: Readonly<{
  t: Translate
  tAssessment: Translate
  tPlan: Translate
  hasPlan: boolean
  completion: CompletionState | null
  planId: number | null
  nextLesson: TodayLesson | undefined
  pendingCount: number
}>) {
  if (!hasPlan)
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-fl-fg font-mono text-xl font-bold tracking-tight">
            {t('startWithAssessment')}
          </h2>
          <p className="text-fl-muted-2 mt-2 max-w-xl font-mono text-sm">
            {t('assessmentCreatesPlan')}
          </p>
        </div>
        <Link href="/assessment">
          <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
            {t('takeAssessmentArrow')}
          </button>
        </Link>
      </div>
    )
  if (completion?.state === 'taken')
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-fl-fg font-mono text-xl font-bold tracking-tight">
            {t('levelTestCompleted')}
          </h2>
          <p className="text-fl-muted-2 mt-2 font-mono text-sm">
            {t('levelTestScoreLine', {
              score:
                completion.score != null
                  ? `${Math.round(completion.score * 100)}%`
                  : '—',
            })}
          </p>
        </div>
        {completion.next_level != null ? (
          <Link href="/assessment">
            <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
              {tAssessment('retake')}
            </button>
          </Link>
        ) : (
          <Link href="/plan">
            <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
              {t('goToMyPlan')}
            </button>
          </Link>
        )}
      </div>
    )
  if (completion?.state === 'ready')
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-fl-fg font-mono text-xl font-bold tracking-tight">
            {t('levelTestReady')}
          </h2>
          <p className="text-fl-muted-2 mt-2 max-w-xl font-mono text-sm">
            {t('levelTestReadyDesc')}
          </p>
        </div>
        {planId != null && (
          <Link href={`/assessment/level-test?plan=${planId}`}>
            <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
              {tPlan('beginLevelTest')}
            </button>
          </Link>
        )}
      </div>
    )
  if (nextLesson)
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-fl-hint text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
            {t('lessonReady')}
          </p>
          <h2 className="text-fl-fg font-mono text-xl font-bold tracking-tight">
            {nextLesson.title}
          </h2>
          <p className="text-fl-muted-2 mt-2 font-mono text-sm">
            {tPlan(`lessonTypes.${nextLesson.lessonType}`)} ·{' '}
            {nextLesson.estimatedMinutes}min
          </p>
        </div>
        <Link href={`/lesson/${nextLesson.id}`}>
          <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
            {t('startLesson')}
          </button>
        </Link>
      </div>
    )
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-fl-fg font-mono text-xl font-bold tracking-tight">
          {t('allCaughtUp')}
        </h2>
        <p className="text-fl-muted-2 mt-2 font-mono text-sm">
          {pendingCount > 0
            ? t('pendingStillAvailable', { count: pendingCount })
            : t('noPendingToday')}
        </p>
      </div>
      <Link href="/plan">
        <button className="text-fl-bg bg-fl-fg hover:bg-fl-fg/90 focus-visible:outline-fl-fg px-4 py-2 font-mono text-sm font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
          {t('goToMyPlan')}
        </button>
      </Link>
    </div>
  )
}

function TodayLessonAction({
  t,
  lesson,
  isDone,
  isNext,
}: Readonly<{
  t: Translate
  lesson: TodayLesson
  isDone: boolean
  isNext: boolean
}>) {
  if (isDone)
    return (
      <span className="text-fl-label text-fl-muted-2 inline-flex items-center gap-1.5 font-mono tracking-widest uppercase">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        {t('lessonDone')}
      </span>
    )
  if (!lesson.id) return null
  return (
    <Link href={`/lesson/${lesson.id}`}>
      <button
        className={`text-fl-caption focus-visible:outline-fl-fg px-3 py-1 font-mono tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
          isNext
            ? 'text-fl-bg bg-fl-fg hover:bg-fl-fg/90 font-bold'
            : 'text-fl-fg border-fl-border hover:border-fl-border-2 border'
        }`}
      >
        {t('startLesson')}
      </button>
    </Link>
  )
}
