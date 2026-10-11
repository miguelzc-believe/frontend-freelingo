type SubscriptionLabelKey =
  | 'statusActive'
  | 'statusTrialing'
  | 'statusPastDue'
  | 'statusUnpaid'
  | 'statusPaused'
  | 'statusIncomplete'
  | 'statusIncompleteExpired'
  | 'statusCanceled'
  | 'statusNone'

type BillingTranslation = (key: SubscriptionLabelKey) => string

const SUBSCRIPTION_LABELS: ReadonlyMap<string, SubscriptionLabelKey> = new Map([
  ['active', 'statusActive'],
  ['trialing', 'statusTrialing'],
  ['past_due', 'statusPastDue'],
  ['unpaid', 'statusUnpaid'],
  ['paused', 'statusPaused'],
  ['incomplete', 'statusIncomplete'],
  ['incomplete_expired', 'statusIncompleteExpired'],
  ['canceled', 'statusCanceled'],
])

function subscriptionStatusClass(status: string) {
  switch (status) {
    case 'active':
      return 'border-green-500/40 text-green-400'
    case 'trialing':
      return 'border-blue-500/40 text-blue-400'
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'border-yellow-500/40 text-yellow-400'
    case 'incomplete':
    case 'incomplete_expired':
      return 'border-orange-500/40 text-orange-400'
    case 'canceled':
      return 'border-fl-border text-fl-muted-2'
    default:
      return 'border-fl-border text-fl-muted-3'
  }
}

export function getSubscriptionLabel(
  status: string,
  tBilling: BillingTranslation
) {
  return tBilling(SUBSCRIPTION_LABELS.get(status) ?? 'statusNone')
}

export function AdminSubscriptionBadge({
  status,
  tBilling,
  inline = false,
}: Readonly<{
  status: string
  tBilling: BillingTranslation
  inline?: boolean
}>) {
  return (
    <span
      className={`text-fl-hint ${inline ? 'inline-flex border' : 'border'} px-2 py-0.5 font-mono tracking-widest uppercase ${subscriptionStatusClass(status)}`}
    >
      {getSubscriptionLabel(status, tBilling)}
    </span>
  )
}
