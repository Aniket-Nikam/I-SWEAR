/* Downsample the microphone to 16kHz mono, PCM16. Nothing is sent by this processor. */
class WitnessVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.phase = 0; this.sum = 0; this.count = 0;
    this.samples = new Int16Array(640); this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const value of input) {
      this.sum += value; this.count++; this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const sample = Math.max(-1, Math.min(1, this.sum / this.count));
        this.samples[this.offset++] = sample < 0 ? sample * 32768 : sample * 32767;
        this.sum = 0; this.count = 0;
        if (this.offset === 640) {
          this.port.postMessage(this.samples.buffer, [this.samples.buffer]);
          this.samples = new Int16Array(640); this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("witness-voice", WitnessVoiceProcessor);
