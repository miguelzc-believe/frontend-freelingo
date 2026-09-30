import { refreshAccessToken } from '@/lib/session'
import { useAuthStore } from '@/store/auth'
import { useLoadingStore } from '@/store/loading'

const BASE_URL = ''

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { inc, dec } = useLoadingStore.getState()
  inc()
  try {
    return await _apiFetch(url, options)
  } finally {
    dec()
  }
}

async function _apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers,
        credentials: 'include',
      })
    } else {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') window.location.assign('/login')
    }
  }

  return res
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`
}
