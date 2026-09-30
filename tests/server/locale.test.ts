import { describe, expect, it } from 'vitest'
import { detectLocale, readCookie } from '@/server/locale'
import { protectedPath } from '@/lib/protected-routes'
import { validateSearch } from '@/lib/route-search'

describe('request presentation', () => {
  it('respects the selected locale over accept-language', () => {
    expect(
      detectLocale(
        new Request('http://test', {
          headers: { cookie: 'NEXT_LOCALE=es', 'accept-language': 'fr' },
        })
      )
    ).toBe('es')
  })
  it('sorts language weights and falls back to English', () => {
    expect(
      detectLocale(
        new Request('http://test', {
          headers: { 'accept-language': 'xx;q=1,fr;q=0.5,pt-BR;q=0.9' },
        })
      )
    ).toBe('pt')
    expect(
      detectLocale(
        new Request('http://test', {
          headers: { 'accept-language': 'xx;q=1,es;q=0,fr;q=bad' },
        })
      )
    ).toBe('en')
  })
  it('handles malformed cookie encoding', () => {
    expect(
      readCookie(
        new Request('http://test', { headers: { cookie: 'NEXT_LOCALE=%xx' } }),
        'NEXT_LOCALE'
      )
    ).toBeUndefined()
  })
  it('uses route segments so unknown protected-looking URLs can return 404', () => {
    expect(protectedPath('/admin/users/1')).toBe(true)
    expect(protectedPath('/reading')).toBe(true)
    expect(protectedPath('/dashboard-unknown')).toBe(false)
    expect(protectedPath('/missing')).toBe(false)
  })
  it('retains invitations, onboarding and administrative filters as strings', () => {
    expect(
      validateSearch({
        invite: 'abc',
        new: 'true',
        q: 'a',
        page: 2,
        is_active: 'false',
        injected: {},
      })
    ).toEqual({
      invite: 'abc',
      new: 'true',
      q: 'a',
      page: '2',
      is_active: 'false',
    })
  })
})
