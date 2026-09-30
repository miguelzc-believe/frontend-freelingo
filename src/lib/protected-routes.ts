const protectedRoots = [
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
]
export function protectedPath(pathname: string): boolean {
  return protectedRoots.includes(pathname.split('/')[1] ?? '')
}
