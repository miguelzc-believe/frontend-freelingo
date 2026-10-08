import { vi } from 'vitest'

export function generatedSamples(length = 1600): Float32Array {
  return Float32Array.from(
    { length },
    (_, index) => Math.sin(index * 0.15) * 0.2
  )
}

export function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

export function captureFixture(rate = 16000) {
  const stopTrack = vi.fn()
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream
  const media = vi.fn().mockResolvedValue(stream)
  const addModule = vi.fn().mockResolvedValue(undefined)
  const resume = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn().mockResolvedValue(undefined)
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const nodes: MockNode[] = []
  class MockNode {
    port = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: vi.fn(),
      close: vi.fn(),
    }
    onprocessorerror: (() => void) | null = null
    connect = vi.fn()
    disconnect = vi.fn()
    constructor() {
      nodes.push(this)
    }
    emit(data: unknown) {
      this.port.onmessage?.({ data })
    }
  }
  const context = vi.fn(function () {
    return {
      sampleRate: rate,
      state: 'running',
      audioWorklet: { addModule },
      resume,
      close,
      destination: {},
      createMediaStreamSource: () => source,
    }
  })
  const offline = vi.fn(function (_channels: number, length: number) {
    return {
      destination: {},
      createBuffer: (_channels: number, inputLength: number) => ({
        getChannelData: () => new Float32Array(inputLength),
      }),
      createBufferSource: () => ({ connect: vi.fn(), start: vi.fn() }),
      startRendering: async () => ({
        getChannelData: () => generatedSamples(length),
      }),
    }
  })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } })
  vi.stubGlobal('AudioContext', context)
  vi.stubGlobal('AudioWorkletNode', MockNode)
  vi.stubGlobal('OfflineAudioContext', offline)
  return {
    stream,
    stopTrack,
    media,
    addModule,
    resume,
    close,
    source,
    nodes,
    context,
    offline,
  }
}
