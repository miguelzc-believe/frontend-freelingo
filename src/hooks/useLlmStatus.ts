import { useEffect, useState } from 'react'
import { fetchLlmStatus, type LlmStatus } from '@/lib/llm-settings'

export function useLlmStatus(enabled: boolean) {
  const [status, setStatus] = useState<LlmStatus | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    let request = 0
    async function reload() {
      const current = ++request
      try {
        const next = await fetchLlmStatus()
        if (active && current === request) {
          setStatus(next)
          setError(false)
        }
      } catch {
        if (active && current === request) setError(true)
      }
    }
    void reload()
    window.addEventListener('freelingo:llm-settings-saved', reload)
    window.addEventListener('focus', reload)
    return () => {
      active = false
      window.removeEventListener('freelingo:llm-settings-saved', reload)
      window.removeEventListener('focus', reload)
    }
  }, [enabled, attempt])

  return {
    status: enabled ? status : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  }
}
