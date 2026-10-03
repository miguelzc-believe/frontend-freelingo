import { afterEach, describe, it, expect, vi } from 'vitest'
import { createAudioQueue, float32ToWav } from '@/lib/audio'

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

describe('createAudioQueue', () => {
  afterEach(() => vi.unstubAllGlobals())

  function setup() {
    const sources: ReturnType<typeof makeSource>[] = []
    function makeSource() {
      return {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      }
    }
    const decoded = {
      duration: 2,
      sampleRate: 16000,
      numberOfChannels: 1,
    } as AudioBuffer
    const ctx = {
      state: 'running',
      currentTime: 10,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue(decoded),
      createBufferSource: vi.fn(() => {
        const source = makeSource()
        sources.push(source)
        return source
      }),
    }
    const idle = vi.fn()
    const queue = createAudioQueue(ctx as unknown as AudioContext, idle)
    return { ctx, sources, idle, queue, decoded }
  }

  it('serializes decoding, schedules gapless chunks and waits for all playback to end', async () => {
    const { ctx, sources, idle, queue, decoded } = setup()
    const first = new ArrayBuffer(4)
    let resolveDecode!: (value: AudioBuffer) => void
    ctx.decodeAudioData.mockReturnValueOnce(
      new Promise<AudioBuffer>((resolve) => {
        resolveDecode = resolve
      })
    )
    const pending = queue.enqueue(first)
    void queue.enqueue(new ArrayBuffer(8))
    await Promise.resolve()
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(ctx.decodeAudioData.mock.calls[0]?.[0]).not.toBe(first)
    resolveDecode(decoded)
    await pending
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(sources[0]?.connect).toHaveBeenCalledWith(ctx.destination)
    expect(sources[0]?.start).toHaveBeenCalledWith(10.005)
    expect(sources[1]?.start).toHaveBeenCalledWith(12.005)
    sources[0]?.onended?.()
    expect(idle).not.toHaveBeenCalled()
    sources[1]?.onended?.()
    expect(idle).toHaveBeenCalledTimes(1)
  })

  it.each(['closed', 'resume', 'create', 'start'])(
    'handles %s context failures without rejecting',
    async (failure) => {
      const { ctx, queue, idle, sources } = setup()
      if (failure === 'closed') ctx.state = 'closed'
      if (failure === 'resume') {
        ctx.state = 'suspended'
        ctx.resume.mockRejectedValue(new Error('Resume denied'))
      }
      if (failure === 'create')
        ctx.createBufferSource.mockImplementation(() => {
          throw new Error('Unavailable')
        })
      if (failure === 'start')
        ctx.createBufferSource.mockImplementationOnce(() => {
          const source = {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(() => {
              throw new Error('Cannot start')
            }),
            stop: vi.fn(),
            onended: null,
          }
          return source
        })
      await expect(queue.enqueue(new ArrayBuffer(4))).resolves.toBeUndefined()
      if (failure === 'closed')
        expect(ctx.decodeAudioData).not.toHaveBeenCalled()
      if (failure === 'resume') {
        expect(ctx.resume).toHaveBeenCalledTimes(1)
        expect(sources[0]?.start).toHaveBeenCalledTimes(1)
        sources[0]?.onended?.()
      }
      expect(idle).toHaveBeenCalledTimes(1)
    }
  )

  it.each(['ended', 'error', 'rejected'])(
    'cleans up decode fallback on %s and becomes idle',
    async (outcome) => {
      const { ctx, queue, idle } = setup()
      const audio = document.createElement('audio')
      const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined)
      if (outcome === 'rejected')
        play.mockRejectedValue(new Error('Playback denied'))
      const revoke = vi.fn()
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: revoke,
      })
      vi.stubGlobal(
        'Audio',
        vi.fn(function () {
          return audio
        })
      )
      ctx.decodeAudioData.mockRejectedValue(new Error('Invalid audio'))
      const pending = queue.enqueue(new ArrayBuffer(4))
      await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))
      if (outcome !== 'rejected') {
        expect(idle).not.toHaveBeenCalled()
        audio.dispatchEvent(new Event(outcome))
      }
      await pending
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test')
      expect(idle).toHaveBeenCalledTimes(1)
      expect(ctx.createBufferSource).not.toHaveBeenCalled()
    }
  )

  it('cancels active, decoding and pending chunks, then accepts fresh playback', async () => {
    const { ctx, queue, sources, idle, decoded } = setup()
    await queue.enqueue(new ArrayBuffer(4))
    let resolveDecode!: (value: AudioBuffer) => void
    ctx.decodeAudioData.mockReturnValueOnce(
      new Promise<AudioBuffer>((resolve) => {
        resolveDecode = resolve
      })
    )
    const pending = queue.enqueue(new ArrayBuffer(8))
    void queue.enqueue(new ArrayBuffer(12))
    await Promise.resolve()
    queue.cancel()
    expect(sources[0]?.stop).toHaveBeenCalledWith(0)
    expect(idle).toHaveBeenCalledTimes(1)
    resolveDecode(decoded)
    await pending
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1)
    await queue.enqueue(new ArrayBuffer(16))
    expect(sources[1]?.start).toHaveBeenCalledWith(10.005)
  })
})
