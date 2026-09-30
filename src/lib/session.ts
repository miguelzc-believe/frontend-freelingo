import { useAuthStore } from '@/store/auth'

let pendingRefresh: Promise<string | null> | null = null

/** All browser entry points share one rotation of the httpOnly refresh cookie. */
export function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh
  pendingRefresh = Promise.resolve()
    .then(() =>
      fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
    )
    .then(async (response) => {
      if (!response.ok) return null
      const data: unknown = await response.json()
      if (
        !data ||
        typeof data !== 'object' ||
        !('access_token' in data) ||
        typeof data.access_token !== 'string' ||
        !data.access_token
      )
        return null
      useAuthStore.getState().setTokens(data.access_token)
      return data.access_token
    })
    .catch(() => null)
    .finally(() => {
      pendingRefresh = null
    })
  return pendingRefresh
}
