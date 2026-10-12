import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import Link from '@/components/ui/app-link'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordField } from '@/components/auth/PasswordField'
import { useTranslations } from 'use-intl'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { PageLoading } from '@/components/ui/page-loading'
import { NativeLanguageField } from '@/components/NativeLanguageField'
import { getLegalDocumentHref } from '@/lib/legal-navigation'

type SelectedPlan = 'monthly' | 'yearly'

function getSelectedPlan(plan: string | null): SelectedPlan | null {
  return plan === 'monthly' || plan === 'yearly' ? plan : null
}

const REGISTRATION_ERROR_KEYS: Readonly<Record<string, string>> = {
  'Username already taken': 'usernameTaken',
  'Email already taken': 'emailTaken',
  'Registration is closed': 'registrationClosed',
  'Invalid or expired invite': 'invalidInvite',
  'Email domain not allowed': 'invalidEmail',
}

function getValidationDetailError(detail: unknown): string {
  if (!Array.isArray(detail) || detail.length === 0) return 'error'
  const first: unknown = detail[0]
  if (!first || typeof first !== 'object') return 'error'
  const { loc, msg } = first as { loc?: unknown; msg?: unknown }
  const location = Array.isArray(loc)
    ? loc
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join('.')
    : ''
  const message = typeof msg === 'string' ? msg.toLowerCase() : ''
  if (location.includes('email') || message.includes('email')) {
    return 'invalidEmail'
  }
  if (location.includes('password')) return 'invalidPassword'
  return 'error'
}

function getRegistrationError(
  detail: unknown,
  t: (key: string) => string
): string {
  if (typeof detail === 'string') {
    const key = Object.hasOwn(REGISTRATION_ERROR_KEYS, detail)
      ? REGISTRATION_ERROR_KEYS[detail]
      : undefined
    return t(key ?? 'error')
  }
  return t(getValidationDetailError(detail))
}

function getRegistrationValidationError(
  password: string,
  confirmPassword: string,
  termsAccepted: boolean,
  username: string,
  t: (key: string) => string
): string | null {
  if (password !== confirmPassword) return t('passwordMismatch')
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,25}$/.test(password)) {
    return t('invalidPassword')
  }
  if (!termsAccepted) return t('termsRequired')
  if (!/^[a-zA-Z0-9._\s-]+$/.test(username)) return t('invalidUsernameChars')
  return null
}

function RegisterForm() {
  const t = useTranslations('auth.register')
  const tLang = useTranslations('languages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const selectedPlan = getSelectedPlan(searchParams.get('plan'))
  const setTokens = useAuthStore((s) => s.setTokens)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nativeLanguage, setNativeLanguage] = useState('es')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError('')
      const validationError = getRegistrationValidationError(
        password,
        confirmPassword,
        termsAccepted,
        username,
        t
      )
      if (validationError !== null) {
        setError(validationError)
        return
      }
      setLoading(true)
      try {
        const sanitizedUsername = username.replace(/\s+/g, '_').toLowerCase()
        const body: Record<string, string | null> = {
          username: sanitizedUsername,
          email,
          password,
          display_name: displayName || username,
          native_language: nativeLanguage,
        }
        if (invite) body.invite_token = invite

        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(getRegistrationError(data.detail, t))
        }
        const data = await res.json()
        setTokens(data.access_token)
        router.push(
          selectedPlan ? `/onboarding?plan=${selectedPlan}` : '/onboarding'
        )
      } catch (err: unknown) {
        const knownErrors = [
          t('error'),
          t('usernameTaken'),
          t('emailTaken'),
          t('registrationClosed'),
          t('invalidInvite'),
          t('invalidEmail'),
          t('invalidPassword'),
        ]
        setError(
          err instanceof Error && knownErrors.includes(err.message)
            ? err.message
            : t('error')
        )
      } finally {
        setLoading(false)
      }
    },
    [
      username,
      email,
      password,
      confirmPassword,
      displayName,
      nativeLanguage,
      termsAccepted,
      invite,
      selectedPlan,
      router,
      t,
      setTokens,
    ]
  )

  return (
    <AuthShell
      title={t('title')}
      tagline={tCommon('tagline')}
      headerAside={
        invite && (
          <span className="text-fl-hint text-fl-muted-1 ml-auto font-mono tracking-widest uppercase">
            {t('inviteActive')}
          </span>
        )
      }
    >
      {error && (
        <div className="border-fl-error/40 text-fl-error mb-5 border px-4 py-3 font-mono text-xs tracking-wide">
          ✕ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          {
            label: t('username'),
            value: username,
            onChange: setUsername,
            type: 'text',
            required: true,
          },
          {
            label: t('displayName'),
            value: displayName,
            onChange: setDisplayName,
            type: 'text',
            required: false,
            placeholder: t('displayNamePlaceholder'),
          },
          {
            label: t('email'),
            value: email,
            onChange: setEmail,
            type: 'email',
            required: true,
          },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-fl-muted-2 mb-2 block font-mono text-xs tracking-widest uppercase">
              {field.label}
            </label>
            <input
              type={field.type}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              required={field.required}
              placeholder={
                'placeholder' in field ? field.placeholder : undefined
              }
              autoCorrect={field.type === 'email' ? 'off' : undefined}
              autoCapitalize={field.type === 'email' ? 'none' : undefined}
              spellCheck={field.type === 'email' ? false : undefined}
              className="bg-fl-bg border-fl-border text-fl-fg placeholder:text-fl-muted-4 focus:border-fl-border-2 w-full border px-4 py-3 font-mono text-sm transition-colors focus:outline-none"
            />
          </div>
        ))}

        <PasswordField
          label={t('password')}
          value={password}
          onChange={setPassword}
          required
          showPasswordLabel={t('showPassword')}
          hidePasswordLabel={t('hidePassword')}
        />

        <PasswordField
          label={t('confirmPassword')}
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          showPasswordLabel={t('showPassword')}
          hidePasswordLabel={t('hidePassword')}
        />

        {/* Legal acceptance */}
        <div className="flex items-start gap-3 py-1">
          <input
            id="terms-accept"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="accent-fl-accent mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer"
          />
          <label
            htmlFor="terms-accept"
            className="text-fl-muted-2 cursor-pointer font-mono text-xs leading-relaxed select-none"
          >
            {t('termsAccept')}{' '}
            <a
              href={getLegalDocumentHref('/terms', 'register', invite)}
              className="text-fl-muted-1 hover:text-fl-fg underline underline-offset-2 transition-colors"
            >
              {t('termsLink')}
            </a>{' '}
            {t('andWord')}{' '}
            <a
              href={getLegalDocumentHref('/privacy', 'register', invite)}
              className="text-fl-muted-1 hover:text-fl-fg underline underline-offset-2 transition-colors"
            >
              {t('privacyLink')}
            </a>
          </label>
        </div>

        <NativeLanguageField
          label={t('nativeLanguage')}
          value={nativeLanguage}
          onChange={setNativeLanguage}
          languageName={tLang}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 mt-2 w-full py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('creatingAccount')}
            </>
          ) : (
            t('submit')
          )}
        </button>
      </form>

      <p className="text-fl-label text-fl-muted-2 mt-6 text-center font-mono tracking-wide">
        {t('hasAccount')}{' '}
        <Link
          href="/login"
          className="text-fl-muted-1 hover:text-fl-fg transition-colors"
        >
          {t('login')}
        </Link>
      </p>
    </AuthShell>
  )
}

function RegistrationGate() {
  const t = useTranslations('auth.register')
  const tCommon = useTranslations('common')
  const invite = useSearchParams().get('invite')
  const allowRegistration = useConfigStore((s) => s.allowRegistration)
  const loadConfig = useConfigStore((s) => s.load)
  const [configLoading, setConfigLoading] = useState(true)

  useEffect(() => {
    void loadConfig().finally(() => setConfigLoading(false))
  }, [loadConfig])

  // Token validity is checked only by the backend when the form is submitted.
  if (invite || allowRegistration) return <RegisterForm />
  if (configLoading) return <PageLoading minHeight="min-h-screen" />

  return (
    <AuthShell title={t('title')} tagline={tCommon('tagline')}>
      <p className="border-fl-border bg-fl-bg text-fl-muted-1 mb-5 border px-4 py-4 text-center font-mono text-xs leading-relaxed">
        {t('registrationClosed')}
      </p>
      <Link
        href="/login"
        className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 block py-3 text-center font-mono text-sm font-bold tracking-widest uppercase transition-colors"
      >
        {t('login')}
      </Link>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegistrationGate />
    </Suspense>
  )
}
