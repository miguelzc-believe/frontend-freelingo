import { describe, it, expect } from 'vitest'
import { float32ToWav } from '@/lib/audio'

describe('float32ToWav', () => {
  it.each([
    { samples: [], riffSize: 36, dataSize: 0, pcmBytes: [] },
    {
      samples: [-1, 0, 1],
      riffSize: 42,
      dataSize: 6,
      pcmBytes: [0x00, 0x80, 0x00, 0x00, 0xff, 0x7f],
    },
  ])(
    'preserves exact WAV bytes for $samples',
    ({ samples, riffSize, dataSize, pcmBytes }) => {
      const buffer = float32ToWav(new Float32Array(samples), 16000)

      expect(Array.from(new Uint8Array(buffer))).toEqual([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        riffSize,
        0x00,
        0x00,
        0x00,
        0x57,
        0x41,
        0x56,
        0x45, // WAVE
        0x66,
        0x6d,
        0x74,
        0x20, // fmt (including its trailing space)
        0x10,
        0x00,
        0x00,
        0x00, // PCM chunk size: 16
        0x01,
        0x00, // PCM format
        0x01,
        0x00, // Mono
        0x80,
        0x3e,
        0x00,
        0x00, // Sample rate: 16000
        0x00,
        0x7d,
        0x00,
        0x00, // Byte rate: 32000
        0x02,
        0x00, // Block alignment: 2
        0x10,
        0x00, // Bits per sample: 16
        0x64,
        0x61,
        0x74,
        0x61, // data
        dataSize,
        0x00,
        0x00,
        0x00,
        ...pcmBytes,
      ])
      expect(buffer.byteLength).toBe(44 + dataSize)
    }
  )

  it('produces a valid WAV header', () => {
    const samples = new Float32Array(100)
    const buffer = float32ToWav(samples, 16000)
    const view = new DataView(buffer)

    expect(
      String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      )
    ).toBe('RIFF')
    expect(
      String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      )
    ).toBe('WAVE')
    expect(
      String.fromCharCode(
        view.getUint8(12),
        view.getUint8(13),
        view.getUint8(14),
        view.getUint8(15)
      )
    ).toBe('fmt ')
    expect(
      String.fromCharCode(
        view.getUint8(36),
        view.getUint8(37),
        view.getUint8(38),
        view.getUint8(39)
      )
    ).toBe('data')
  })

  it('writes correct PCM format chunk', () => {
    const samples = new Float32Array(100)
    const buffer = float32ToWav(samples, 16000)
    const view = new DataView(buffer)

    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(28, true)).toBe(32000)
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
  })

  it('calculates correct buffer size (44 byte header + data)', () => {
    const samples = new Float32Array(1000)
    const buffer = float32ToWav(samples, 16000)

    expect(buffer.byteLength).toBe(44 + 1000 * 2)
  })

  it('writes correct RIFF chunk size', () => {
    const samples = new Float32Array(100)
    const buffer = float32ToWav(samples, 16000)
    const view = new DataView(buffer)
    const dataSize = 100 * 2

    expect(view.getUint32(4, true)).toBe(36 + dataSize)
    expect(view.getUint32(40, true)).toBe(dataSize)
  })

  it('clamps samples to [-1, 1] range', () => {
    const samples = new Float32Array([2.0, -2.0, 0.5, -0.5])
    const buffer = float32ToWav(samples, 16000)
    const view = new DataView(buffer)

    const sample0 = view.getInt16(44, true)
    const sample1 = view.getInt16(46, true)
    const sample2 = view.getInt16(48, true)
    const sample3 = view.getInt16(50, true)

    expect(sample0).toBe(0x7fff)
    expect(sample1).toBe(-0x8000)
    expect(sample2).toBeGreaterThan(0)
    expect(sample3).toBeLessThan(0)
  })

  it('encodes silence as zeros', () => {
    const samples = new Float32Array(10)
    const buffer = float32ToWav(samples, 16000)
    const view = new DataView(buffer)

    for (let i = 0; i < 10; i++) {
      expect(view.getInt16(44 + i * 2, true)).toBe(0)
    }
  })

  it('handles empty sample array', () => {
    const samples = new Float32Array(0)
    const buffer = float32ToWav(samples, 16000)

    expect(buffer.byteLength).toBe(44)
  })

  it('works with different sample rates', () => {
    const samples = new Float32Array(100)
    const buffer = float32ToWav(samples, 44100)
    const view = new DataView(buffer)

    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(88200)
  })
})
