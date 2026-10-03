import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

interface Processor {
  port: { onmessage: (event: { data: { type: string } }) => void }
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
}
function load() {
  const postMessage = vi.fn()
  let ProcessorClass!: new () => Processor
  runInNewContext(
    readFileSync('public/audio/voice-recorder.worklet.js', 'utf8'),
    {
      AudioWorkletProcessor: class {
        port = { postMessage, onmessage: null }
      },
      registerProcessor: (name: string, constructor: new () => Processor) => {
        expect(name).toBe('voice-recorder')
        ProcessorClass = constructor
      },
      Float32Array,
    }
  )
  return { processor: new ProcessorClass(), postMessage }
}
describe('real public capture processor', () => {
  it('copies channel zero for variable quantum and outputs silence', () => {
    const { processor, postMessage } = load()
    for (const size of [1, 128, 256, 513]) {
      const input = new Float32Array(size).fill(0.25)
      const output = new Float32Array(size).fill(1)
      expect(
        processor.process(
          [[input, new Float32Array(size).fill(0.9)]],
          [[output]]
        )
      ).toBe(true)
      const [message, transfers] = postMessage.mock.calls.at(-1)!
      expect(message.type).toBe('samples')
      expect(message.samples).toEqual(input)
      expect(message.samples.buffer).not.toBe(input.buffer)
      expect(transfers).toEqual([message.samples.buffer])
      input.fill(0)
      expect(message.samples[0]).toBe(0.25)
      expect(output.every((sample) => sample === 0)).toBe(true)
    }
  })
  it('ACK follows all PCM and is terminal, idempotent and silent', () => {
    const { processor, postMessage } = load()
    processor.process([[new Float32Array([0.1])]], [[]])
    processor.process([[new Float32Array([0.2, 0.3])]], [[]])
    processor.port.onmessage({ data: { type: 'stop' } })
    processor.port.onmessage({ data: { type: 'stop' } })
    const output = new Float32Array([1, 1])
    expect(processor.process([[new Float32Array([1])]], [[output]])).toBe(false)
    expect(postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'samples',
      'samples',
      'stopped',
    ])
    expect(output).toEqual(new Float32Array(2))
  })
  it('handles absent input without manufacturing PCM', () => {
    const { processor, postMessage } = load()
    processor.process([], [[new Float32Array(7)]])
    expect(postMessage).not.toHaveBeenCalled()
  })
})
