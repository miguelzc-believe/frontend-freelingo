export type VoiceStatus =
  'ready' | 'connecting' | 'live' | 'sending' | 'ended' | 'error'

export function voiceStatusLabel(
  status: VoiceStatus,
  recording: boolean
): 'recording' | 'sending' | 'sessionEnded' | 'ready' {
  if (recording) return 'recording'
  if (status === 'connecting' || status === 'sending') return 'sending'
  if (status === 'ended') return 'sessionEnded'
  return 'ready'
}
