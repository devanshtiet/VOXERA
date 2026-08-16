// AudioWorkletProcessor that forwards raw mic audio to the main thread via
// its MessagePort. Runs on the audio render thread, not the main thread —
// this is the modern replacement for ScriptProcessorNode. Kept as a plain
// vanilla-JS file served from /public since AudioWorklet modules load via
// a URL, not a bundler import.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      // Copy out — the underlying buffer is reused by the audio thread
      // between calls, so the reference itself isn't safe to hand off.
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
