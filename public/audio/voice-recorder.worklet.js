/* global AudioWorkletProcessor, registerProcessor */

// Send each quantum immediately: the port's FIFO order makes stopped a flush
// barrier, including the final quantum already captured before the stop command.
class VoiceRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.stopped = false
    this.port.onmessage = ({ data }) => {
      if (data?.type !== 'stop' || this.stopped) return
      this.stopped = true
      this.port.postMessage({ type: 'stopped' })
    }
  }

  process(inputs, outputs) {
    for (const output of outputs) {
      for (const channel of output) channel.fill(0)
    }
    if (this.stopped) return false
    const input = inputs[0]?.[0]
    if (input?.length) {
      const samples = new Float32Array(input)
      this.port.postMessage({ type: 'samples', samples }, [samples.buffer])
    }
    return true
  }
}

registerProcessor('voice-recorder', VoiceRecorderProcessor)
