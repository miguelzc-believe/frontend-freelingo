import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { useLoadingStore } from '@/store/loading'

const MIN_VISIBLE_MS = 600
const COMPLETE_DURATION_MS = 400

type Phase = 'hidden' | 'loading' | 'completing'

export function LoadingBar() {
  const tCommon = useTranslations('common')
  const count = useLoadingStore((s) => s.count)
  const complete = useLoadingStore((s) => s.complete)
  const finishComplete = useLoadingStore((s) => s.finishComplete)

  const [phase, setPhase] = useState<Phase>('hidden')
  const visibleSince = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (count > 0) {
      // New request started — show loading immediately, cancel any pending complete
      if (timerRef.current) clearTimeout(timerRef.current)
      visibleSince.current = Date.now()
      setPhase('loading')
      return
    }

    if (complete && phase === 'loading') {
      // All requests finished — wait minimum visible time, then exit
      const elapsed = Date.now() - visibleSince.current
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
      timerRef.current = setTimeout(() => {
        setPhase('completing')
      }, remaining)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [count, complete, phase])

  useEffect(() => {
    if (phase !== 'completing') return
    const timer = setTimeout(() => {
      setPhase('hidden')
      finishComplete()
    }, COMPLETE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [phase, finishComplete])

  if (phase === 'hidden') return null

  return (
    <>
      <progress
        className={`loading-progress fixed top-0 right-0 left-0 z-[300] h-px overflow-hidden ${
          phase === 'completing'
            ? 'animate-loading-bar-complete'
            : 'animate-loading-bar'
        }`}
        aria-label={tCommon('loading')}
      />
      <style>{`
        @keyframes loading-bar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(-20%); }
          100% { transform: translateX(0%); }
        }
        @keyframes loading-bar-complete {
          0%   { transform: translateX(0%); opacity: 1; }
          100% { transform: translateX(0%); opacity: 0; }
        }
        .loading-progress {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--fl-fg);
        }
        .loading-progress::progress-bar { background: transparent; }
        .loading-progress::-webkit-progress-bar { background: transparent; }
        .loading-progress::progress-value { background: var(--fl-fg); width: 100%; }
        .loading-progress::-webkit-progress-value { background: var(--fl-fg); width: 100%; }
        .loading-progress::-moz-progress-bar { background: var(--fl-fg); width: 100%; }
        /* Indeterminate WebKit progress has no value box: animate its track. */
        .loading-progress:indeterminate::-webkit-progress-bar { background: var(--fl-fg); }
        .loading-progress:indeterminate::progress-bar { background: var(--fl-fg); }
        .animate-loading-bar::progress-bar,
        .animate-loading-bar::progress-value { animation: loading-bar 1.4s ease-in-out infinite; }
        .animate-loading-bar::-webkit-progress-bar { animation: loading-bar 1.4s ease-in-out infinite; }
        .animate-loading-bar::-webkit-progress-value { animation: loading-bar 1.4s ease-in-out infinite; }
        .animate-loading-bar::-moz-progress-bar { animation: loading-bar 1.4s ease-in-out infinite; }
        .animate-loading-bar-complete::progress-bar,
        .animate-loading-bar-complete::progress-value { animation: loading-bar-complete ${COMPLETE_DURATION_MS}ms ease-out forwards; }
        .animate-loading-bar-complete::-webkit-progress-bar { animation: loading-bar-complete ${COMPLETE_DURATION_MS}ms ease-out forwards; }
        .animate-loading-bar-complete::-webkit-progress-value { animation: loading-bar-complete ${COMPLETE_DURATION_MS}ms ease-out forwards; }
        .animate-loading-bar-complete::-moz-progress-bar { animation: loading-bar-complete ${COMPLETE_DURATION_MS}ms ease-out forwards; }
      `}</style>
    </>
  )
}
