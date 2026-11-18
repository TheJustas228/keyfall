import { NoteDetector } from '../listen/detector';
import { piano, setAudioSession } from './piano';

export class MicError extends Error {
  constructor(
    readonly kind: 'denied' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

export interface Listener {
  stop(): void;
  level(): number;
}

const FFT_SIZE = 8192;

/** Listen to a real piano through the microphone and report note onsets. */
export async function startListening(onNotes: (midis: number[]) => void, sensitivity: number): Promise<Listener> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError('unavailable', 'This browser can’t use the microphone. Open Keyfall from Safari or the home screen.');
  }
  setAudioSession('play-and-record');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    setAudioSession('playback');
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicError('denied', 'Microphone access is off. Allow it in Settings › Safari › Microphone, then try again.');
    }
    throw new MicError('unavailable', 'No microphone was found.');
  }
  await piano.ensureStarted();
  const ctx = piano.ctx!;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(analyser).connect(sink).connect(ctx.destination);
  const detector = new NoteDetector(ctx.sampleRate, FFT_SIZE, { sensitivity });
  const buf = new Float32Array(analyser.frequencyBinCount);
  const timer = window.setInterval(() => {
    analyser.getFloatFrequencyData(buf);
    const notes = detector.process(buf, performance.now());
    if (notes.length) onNotes(notes);
  }, 16);

  return {
    level: () => detector.level(),
    stop() {
      clearInterval(timer);
      source.disconnect();
      analyser.disconnect();
      sink.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      setAudioSession('playback');
    },
  };
}
