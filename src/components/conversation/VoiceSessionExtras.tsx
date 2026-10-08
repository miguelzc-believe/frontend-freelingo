import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { useRouter } from '@/lib/navigation'
import { apiFetch } from '@/lib/api'
import { useConfigStore } from '@/store/config'
import { splitYearlyCta, type BillingInterval } from '@/lib/billing-copy'
import type { QuotaStatus } from '@/types/api'

function QuotaBar({
  label,
  used,
  limit,
  unlimited,
}: Readonly<{
  label: string
  used: number
  limit: number
  unlimited: boolean
}>) {
  const pct =
    unlimited || limit === 0
      ? null
      : Math.min(100, Math.round((used / limit) * 100))
  const exceeded = !unlimited && limit > 0 && used >= limit
  return (
    <div className="flex items-center gap-3">
      <span className="text-fl-hint text-fl-muted-4 w-36 shrink-0 font-mono tracking-widest uppercase">
        {label}
      </span>
      {unlimited ? (
        <span className="text-fl-hint text-fl-muted-2 font-mono">∞</span>
      ) : (
        <>
          <div className="bg-fl-surface-2 h-1 flex-1 overflow-hidden">
            <div
              className={`h-full transition-all ${exceeded ? 'bg-fl-error' : 'bg-fl-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={`text-fl-hint font-mono tabular-nums ${exceeded ? 'text-fl-error' : 'text-fl-muted-2'}`}
          >
            {used}&thinsp;/&thinsp;{limit}
          </span>
        </>
      )}
    </div>
  )
}

export function QuotaPill({ quota }: Readonly<{ quota: QuotaStatus }>) {
  const t = useTranslations('conversation')
  const [open, setOpen] = useState(false)
  const parts: string[] = []
  let alert = false
  if (!quota.sessions_unlimited) {
    parts.push(`${quota.sessions_this_week}/${quota.sessions_limit} ses`)
    if (quota.sessions_this_week >= quota.sessions_limit) alert = true
  }
  if (!quota.time_unlimited) {
    parts.push(`${quota.minutes_today}/${quota.minutes_limit} min`)
    if (quota.minutes_today >= quota.minutes_limit) alert = true
  }
  if (!quota.tokens_unlimited) {
    parts.push(
      `${Math.round((quota.tokens_this_month ?? 0) / 1000)}k/${Math.round((quota.tokens_monthly_limit ?? 0) / 1000)}k tok`
    )
    if ((quota.tokens_this_month ?? 0) >= (quota.tokens_monthly_limit ?? 0))
      alert = true
  }
  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((value) => !value)}
        className={`text-fl-hint flex w-full items-center justify-between border px-3 py-1.5 font-mono tracking-widest uppercase transition-colors ${alert ? 'border-fl-error/50 text-fl-error hover:border-fl-error' : 'border-fl-border text-fl-muted-3 hover:border-fl-border-2 hover:text-fl-muted-1'}`}
      >
        <span>● {parts.length ? parts.join(' · ') : '∞'}</span>
        <span className="text-fl-muted-4">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="border-fl-border bg-fl-surface space-y-1.5 border border-t-0 px-4 py-3">
          <QuotaBar
            label={t('quotaSessions')}
            used={quota.sessions_this_week}
            limit={quota.sessions_limit}
            unlimited={quota.sessions_unlimited}
          />
          <QuotaBar
            label={t('quotaMinutes')}
            used={quota.minutes_today}
            limit={quota.minutes_limit}
            unlimited={quota.time_unlimited}
          />
          {!quota.tokens_unlimited && (
            <QuotaBar
              label={t('quotaTokens')}
              used={quota.tokens_this_month ?? 0}
              limit={quota.tokens_monthly_limit ?? 0}
              unlimited={false}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function TrialPremiumCta() {
  const t = useTranslations('billing')
  const tConversation = useTranslations('conversation')
  const locale = useLocale()
  const router = useRouter()
  const priceMonthly = useConfigStore((state) => state.priceMonthly)
  const priceYearly = useConfigStore((state) => state.priceYearly)
  const [loading, setLoading] = useState<BillingInterval | null>(null)
  const [error, setError] = useState<string | null>(null)
  const yearlyCta = splitYearlyCta(
    t('planYearly', {
      price: new Intl.NumberFormat(locale).format(priceYearly),
    })
  )

  async function handleCheckout(interval: BillingInterval) {
    setLoading(interval)
    setError(null)
    try {
      const response = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: interval }),
      })
      if (!response.ok) throw new Error(t('checkoutError'))
      const { url } = await response.json()
      window.location.assign(url)
    } catch {
      setError(t('checkoutError'))
      setLoading(null)
    }
  }

  return (
    <div className="border-fl-border bg-fl-surface mb-4 border p-5 text-center">
      <p className="text-fl-label text-fl-muted-2 mb-2 font-mono tracking-widest uppercase">
        {tConversation('trialCtaLabel')}
      </p>
      <h2 className="text-fl-fg mb-2 font-mono text-base font-bold">
        {tConversation('trialCtaTitle')}
      </h2>
      <p className="text-fl-muted-1 mb-5 font-mono text-sm leading-relaxed">
        {tConversation('trialCtaDesc')}
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => void handleCheckout('yearly')}
          disabled={loading !== null}
          className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 w-full px-4 py-3 font-mono text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
        >
          {loading === 'yearly' ? (
            '...'
          ) : (
            <span className="flex flex-col items-center gap-0.5 leading-relaxed">
              <span>{yearlyCta.main}</span>
              {yearlyCta.savings && (
                <span className="text-fl-accent-fg text-xs">
                  {yearlyCta.savings}
                </span>
              )}
            </span>
          )}
        </button>
        <button
          onClick={() => void handleCheckout('monthly')}
          disabled={loading !== null}
          className="border-fl-border text-fl-muted-1 hover:text-fl-fg hover:border-fl-border-2 w-full border px-4 py-3 font-mono text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
        >
          {loading === 'monthly'
            ? '...'
            : t('planMonthly', {
                price: new Intl.NumberFormat(locale).format(priceMonthly),
              })}
        </button>
      </div>
      {error && (
        <p className="text-fl-hint mt-4 font-mono text-red-500">{error}</p>
      )}
      <button
        onClick={() => router.push('/plan')}
        className="text-fl-muted-4 hover:text-fl-muted-2 mt-5 w-full font-mono text-xs tracking-widest uppercase transition-colors"
      >
        {t('paywallSkip')}
      </button>
    </div>
  )
}
