import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import Link from '@/components/ui/app-link'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordField } from '@/components/auth/PasswordField'
import { useTranslations } from 'use-intl'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { mapUser } from '@/lib/mappers'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'

function LoginForm() {
  const t = useTranslations('auth.login')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered') === 'true'
  const allowRegistration = useConfigStore((s) => s.allowRegistration)
  const loadConfig = useConfigStore((s) => s.load)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError('')
      if (!email.trim()) {
        setError(t('emailRequired'))
        return
      }
      if (!password) {
        setError(t('passwordRequired'))
        return
      }
      setLoading(true)
      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (Array.isArray(data.detail) && data.detail.length > 0) {
            const first = data.detail[0] as { loc?: string[]; msg?: string }
            const loc = (first.loc ?? []).join('.')
            if (
              loc.includes('email') ||
              first.msg?.toLowerCase().includes('email')
            ) {
              throw new Error(t('invalidEmail'))
            }
          }
          throw new Error(t('error'))
        }
        const { access_token } = await res.json()
        setTokens(access_token)
        const meRes = await apiFetch('/api/auth/me')
        if (meRes.ok) setUser(mapUser(await meRes.json()))
        router.push('/dashboard')
      } catch (err: unknown) {
        setError(
          err instanceof Error &&
            (err.message === t('error') || err.message === t('invalidEmail'))
            ? err.message
            : t('loginFailed')
        )
      } finally {
        setLoading(false)
      }
    },
    [email, password, router, setTokens, setUser, t]
  )

  return (
    <AuthShell title={t('title')} tagline={tCommon('tagline')}>
      {registered && (
        <div className="border-fl-border text-fl-muted-1 mb-5 border px-4 py-3 font-mono text-xs tracking-wide">
          ✓ {t('accountCreated')}
        </div>
      )}
      {error && (
        <div className="border-fl-error/40 text-fl-error mb-5 border px-4 py-3 font-mono text-xs tracking-wide">
          ✕ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="text-fl-muted-2 mb-2 block font-mono text-xs tracking-widest uppercase">
            {t('email')}
          </label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="bg-fl-bg border-fl-border text-fl-fg focus:border-fl-border-2 w-full border px-4 py-3 font-mono text-sm transition-colors focus:outline-none"
          />
        </div>
        <PasswordField
          label={t('password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          showPasswordLabel={t('showPassword')}
          hidePasswordLabel={t('hidePassword')}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 mt-2 w-full py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('signingIn')}
            </>
          ) : (
            t('submit')
          )}
        </button>
      </form>

      {allowRegistration && (
        <p className="text-fl-label text-fl-muted-2 mt-6 text-center font-mono tracking-wide">
          {t('noAccount')}{' '}
          <Link
            href="/register"
            className="text-fl-muted-1 hover:text-fl-fg transition-colors"
          >
            {t('register')}
          </Link>
        </p>
      )}
      <p className="text-fl-label text-fl-muted-4 mt-3 text-center font-mono tracking-wide">
        <Link
          href="/forgot-password"
          className="hover:text-fl-muted-2 transition-colors"
        >
          {t('forgotPassword')}
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
