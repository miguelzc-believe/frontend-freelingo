export interface RouteSearch {
  q?: string
  subscription?: string
  is_active?: string
  type?: string
  new?: string
  registered?: string
  plan?: string
  invite?: string
  from?: string
  token?: string
  session_id?: string
  review?: string
  unit?: string
  language?: string
  tab?: string
  page?: string
  search?: string
  role?: string
  status?: string
  sort?: string
}
export function validateSearch(input: Record<string, unknown>): RouteSearch {
  const result: RouteSearch = {}
  for (const key of [
    'q',
    'subscription',
    'is_active',
    'type',
    'new',
    'registered',
    'plan',
    'invite',
    'from',
    'token',
    'session_id',
    'review',
    'unit',
    'language',
    'tab',
    'page',
    'search',
    'role',
    'status',
    'sort',
  ] as const) {
    const value = input[key]
    if (typeof value === 'string' || typeof value === 'number')
      result[key] = String(value)
  }
  return result
}
