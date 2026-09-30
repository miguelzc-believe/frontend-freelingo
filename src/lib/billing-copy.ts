export type BillingInterval = 'monthly' | 'yearly'

export function splitYearlyCta(label: string) {
  const parts = label.split(' · ')
  if (parts.length < 2) return { main: label, savings: null }

  return {
    main: `${parts.slice(0, -1).join(' · ')} →`,
    savings: parts.at(-1)?.replace('→', '').trim() ?? null,
  }
}
