import { describe, expect, it } from 'vitest'
import { voiceStatusLabel, type VoiceStatus } from '@/lib/voice-presentation'

const statuses: VoiceStatus[] = [
  'ready',
  'connecting',
  'live',
  'sending',
  'ended',
  'error',
]

describe('voice status presentation', () => {
  it.each(statuses)('prioritizes recording over %s', (status) => {
    expect(voiceStatusLabel(status, true)).toBe('recording')
  })

  it.each<[VoiceStatus, string]>([
    ['ready', 'ready'],
    ['connecting', 'sending'],
    ['live', 'ready'],
    ['sending', 'sending'],
    ['ended', 'sessionEnded'],
    ['error', 'ready'],
  ])('presents %s as %s', (status, expected) => {
    expect(voiceStatusLabel(status, false)).toBe(expected)
  })
})
