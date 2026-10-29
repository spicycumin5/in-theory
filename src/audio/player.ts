import * as Tone from 'tone';

// Salamander grand piano samples (loaded from the Tone.js CDN); a soft synth covers until they arrive.
let sampler: Tone.Sampler | null = null;
let synth: Tone.PolySynth | null = null;
let loaded = false;

function sampleUrls() {
  const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' };
  for (let o = 1; o <= 7; o++) {
    for (const [note, file] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]) urls[`${note}${o}`] = `${file}${o}.mp3`;
  }
  return urls;
}

export async function ensureAudio() {
  await Tone.start();
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 1.2 },
    }).toDestination();
    synth.volume.value = -14;
  }
  if (!sampler) {
    sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1,
      onload: () => {
        loaded = true;
      },
    }).toDestination();
  }
}

const instrument = () => (loaded && sampler ? sampler : synth);
const freqs = (midis: number[]) => midis.map((m) => Tone.Frequency(m, 'midi').toFrequency());

export function playChord(midis: number[], seconds = 1.6) {
  if (midis.length) instrument()?.triggerAttackRelease(freqs(midis), seconds);
}

/** Play notes one after another, low to high, letting them ring. */
export function playArpeggio(midis: number[], gap = 0.22) {
  const now = Tone.now();
  [...midis].sort((a, b) => a - b).forEach((m, i) => instrument()?.triggerAttackRelease(freqs([m]), 2, now + i * gap));
}

export function noteOn(midi: number) {
  instrument()?.triggerAttack(freqs([midi]));
}

export function noteOff(midi: number) {
  instrument()?.triggerRelease(freqs([midi]));
}

export function releaseAll() {
  sampler?.releaseAll();
  synth?.releaseAll();
}

/** Play chords in time. Returns a stop function. */
export function playSequence(
  steps: { midis: number[]; beats: number }[],
  bpm: number,
  loop: boolean,
  onStep: (i: number | null) => void,
): () => void {
  let cancelled = false;
  let timer: number | undefined;
  const beat = 60 / bpm;
  const run = (i: number) => {
    if (cancelled) return;
    if (i >= steps.length) {
      if (!loop || !steps.length) return onStep(null);
      i = 0;
    }
    const dur = steps[i].beats * beat;
    playChord(steps[i].midis, dur * 0.98);
    onStep(i);
    timer = window.setTimeout(() => run(i + 1), dur * 1000);
  };
  run(0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    releaseAll();
    onStep(null);
  };
}
