/**
 * Encodes mono PCM samples into a standard WAV ArrayBuffer.
 * Explicit microphone recordings are resampled to 16 000 Hz for STT.
 */
export function float32ToWav(
  samples: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = numChannels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeStr(offset: number, s: string) {
    // ASCII chunk literals and in-bounds indices make undefined unreachable.
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.codePointAt(i) ?? 0)
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample ?? 0))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return buffer
}
