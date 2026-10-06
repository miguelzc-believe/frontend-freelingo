import { useState } from 'react'
import Link from '@/components/ui/app-link'
import { useTranslations } from 'use-intl'
import { useAuthStore } from '@/store/auth'

interface FAQItem {
  id: string
  q: string
  a: React.ReactNode
}

export default function FAQPage() {
  const t = useTranslations('faq')
  const [open, setOpen] = useState<number | null>(null)
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  const strong = (chunks: React.ReactNode) => (
    <strong className="text-fl-fg">{chunks}</strong>
  )
  const code = (chunks: React.ReactNode) => (
    <code className="text-fl-fg bg-fl-surface-2 px-1">{chunks}</code>
  )
  const adminLink = (chunks: React.ReactNode) => (
    <Link
      href="/admin/users"
      className="text-fl-fg underline underline-offset-2"
    >
      {chunks}
    </Link>
  )
  const settingsLink = (chunks: React.ReactNode) => (
    <Link href="/settings" className="text-fl-fg underline underline-offset-2">
      {chunks}
    </Link>
  )
  const aiSettingsLink = (chunks: React.ReactNode) => (
    <Link
      href="/settings#ai"
      className="text-fl-fg underline underline-offset-2"
    >
      {chunks}
    </Link>
  )
  const feedbackLink = (chunks: React.ReactNode) => (
    <Link href="/feedback" className="text-fl-fg underline underline-offset-2">
      {chunks}
    </Link>
  )

  const workflowSteps = [
    'workflowStep1',
    'workflowStep2',
    'workflowStep3',
    'workflowStep4',
    'workflowStep5',
    'workflowStep6',
  ]

  const providers: [string, string][] = [
    ['ollama', t('provider_ollama')],
    ['openai', t('provider_openai')],
    ['anthropic', t('provider_anthropic')],
    ['deepseek', t('provider_deepseek')],
    ['custom', t('provider_custom')],
  ]

  const faqs: FAQItem[] = (() => {
    const items: FAQItem[] = [
      { id: 'q_start', q: t('q_start'), a: t.rich('a_start', { strong }) },
      { id: 'q_language', q: t('q_language'), a: t('a_language') },
      {
        id: 'q_workflow',
        q: t('q_workflow'),
        a: (
          <ol className="list-none space-y-1">
            {workflowSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="text-fl-label text-fl-muted-4 mt-0.5 shrink-0 font-mono">
                  {i + 1}.
                </span>
                <span>{t(step)}</span>
              </li>
            ))}
          </ol>
        ),
      },
      { id: 'q_assessment', q: t('q_assessment'), a: t('a_assessment') },
      {
        id: 'q_studyPlan',
        q: t('q_studyPlan'),
        a: t.rich('a_studyPlan', { strong }),
      },
      {
        id: 'q_resources',
        q: t('q_resources'),
        a: t.rich('a_resources', { strong }),
      },
      {
        id: 'q_flashcards',
        q: t('q_flashcards'),
        a: t.rich('a_flashcards', { strong }),
      },
      {
        id: 'q_vocabulary',
        q: t('q_vocabulary'),
        a: t.rich('a_vocabulary', { strong }),
      },
      { id: 'q_tutor', q: t('q_tutor'), a: t('a_tutor') },
      { id: 'q_voice', q: t('q_voice'), a: t.rich('a_voice', { strong }) },
      {
        id: 'q_listening',
        q: t('q_listening'),
        a: t.rich('a_listening', { strong }),
      },
      {
        id: 'q_reading',
        q: t('q_reading'),
        a: t.rich('a_reading', { strong }),
      },
      {
        id: 'q_feedback',
        q: t('q_feedback'),
        a: t.rich('a_feedback', { feedbackLink }),
      },
      {
        id: 'q_password',
        q: t('q_password'),
        a: t.rich('a_password', { settingsLink }),
      },
      {
        id: 'q_uiLanguage',
        q: t('q_uiLanguage'),
        a: t.rich('a_uiLanguage', { settingsLink, strong }),
      },
    ]

    if (isAdmin) {
      items.push(
        {
          id: 'q_providers',
          q: t('q_providers'),
          a: (
            <>
              {t.rich('a_providers_intro', { aiSettingsLink })}
              <ul className="mt-2 list-none space-y-1">
                {providers.map(([name, desc]) => (
                  <li key={name} className="flex items-start gap-2">
                    <code className="text-fl-muted-1 shrink-0">{name}</code>
                    <span className="text-fl-muted-2">— {desc}</span>
                  </li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: 'q_invite',
          q: t('q_invite'),
          a: t.rich('a_invite', { adminLink, code }),
        }
      )
    }

    return items
  })()

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="border-fl-border mb-8 border-b pb-4">
        <p className="text-fl-label text-fl-muted-2 mb-1 font-mono tracking-widest uppercase">
          {t('title')}
        </p>
        <h1 className="text-fl-fg font-mono text-2xl font-bold tracking-tight">
          {t('subtitle')}
        </h1>
      </div>

      {/* Accordion */}
      <div className="border-fl-border border">
        {faqs.map((item, i) => (
          <div
            key={item.id}
            className={i < faqs.length - 1 ? 'border-fl-border border-b' : ''}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="hover:bg-fl-surface flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
            >
              <span className="text-fl-fg pr-4 font-mono text-xs tracking-wide">
                {item.q}
              </span>
              <span className="text-fl-muted-2 shrink-0 font-mono text-sm">
                {open === i ? '−' : '+'}
              </span>
            </button>
            {open === i && (
              <div className="text-fl-muted-1 border-fl-border bg-fl-bg-alt border-t px-5 pt-4 pb-5 font-mono text-xs leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
