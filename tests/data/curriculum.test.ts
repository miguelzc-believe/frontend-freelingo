import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurriculumUnits } from '@/data/curriculum'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch }))

describe('curriculum client', () => {
  beforeEach(() => apiFetch.mockReset())

  it('returns units and encodes the level and target language', async () => {
    const units = [{ id: 'unit-1', title: 'Introductions' }]
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify(units)))
    await expect(getCurriculumUnits('A1/A2', 'zh Hans')).resolves.toEqual(units)
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/curriculum/A1%2FA2?language=zh%20Hans'
    )
  })

  it('returns no units when the server rejects the default-language request', async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(getCurriculumUnits('B1')).resolves.toEqual([])
    expect(apiFetch).toHaveBeenCalledWith('/api/curriculum/B1?language=en-GB')
  })
})
