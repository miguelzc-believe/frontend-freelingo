const protectedRoots = new Set([
  'admin',
  'assessment',
  'billing',
  'chat',
  'conversation',
  'dashboard',
  'faq',
  'feedback',
  'flashcards',
  'grammar',
  'lesson',
  'listening',
  'onboarding',
  'phrasebook',
  'plan',
  'progress',
  'reading',
  'settings',
  'vocabulary',
])
export function protectedPath(pathname: string): boolean {
  return protectedRoots.has(pathname.split('/')[1] ?? '')
}
