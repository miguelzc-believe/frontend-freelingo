import { useEffect, useRef, useState } from 'react'

/** Shared warning/cleanup lifecycle only; each screen owns its generation request. */
export function usePracticeGeneration(isGenerating: boolean) {
  const [generatingWarn, setGeneratingWarn] = useState(false)
  const generateAbortRef = useRef<AbortController | null>(null)
  const generatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Warn if exercise generation takes longer than 15 s.
  useEffect(() => {
    if (isGenerating) {
      setGeneratingWarn(false)
      generatingTimerRef.current = setTimeout(
        () => setGeneratingWarn(true),
        15_000
      )
    } else {
      if (generatingTimerRef.current) clearTimeout(generatingTimerRef.current)
      setGeneratingWarn(false)
    }
    return () => {
      if (generatingTimerRef.current) clearTimeout(generatingTimerRef.current)
    }
  }, [isGenerating])

  // Cancel the screen's current in-flight long-poll on unmount only.
  useEffect(() => {
    return () => {
      // Generation assigns this ref after mount, so cleanup must read its latest value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generateAbortRef.current?.abort()
    }
  }, [])

  return { generatingWarn, generateAbortRef }
}
