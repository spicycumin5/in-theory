import { Chord, chordSymbol, displaySuffix, makeChord } from '../theory/chords';
import { parseNoteName } from '../theory/notes';
import { KEYS, PRESETS, parseProgressionText } from '../theory/progressions';
import { REHARMS, applyReharms } from '../theory/reharm';
import { Voicing, voiceProgression } from '../theory/voicings';

export type EarMode = 'quality' | 'function' | 'reharm';

export interface Step {
  midis: number[];
  beats: number;
}

export interface Question {
  mode: EarMode;
  answer: string;
  options: string[];
  /** What to play; `alt` is the second clip (the reharmonized version). */
  main: Step[];
  alt?: Step[];
  bpm: number;
  explain: string;
  /** Voicing to show on the keyboard after answering. */
  show?: Voicing;
}

export const QUALITY_LEVELS: Record<string, string[]> = {
  Triads: ['', 'm', 'dim', 'aug', 'sus4'],
  Sevenths: ['maj7', '7', 'm7', 'm7b5', 'dim7', 'mmaj7'],
  Extended: ['maj9', '9', 'm9', '13', '7b9', '7#9', '7alt', '9sus4', 'm11', '69'],
};

const DIATONIC = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
const BORROWED = ['iv', 'bVI', 'bVII', 'bIII', 'ii°'];
export const FUNCTION_LEVELS: Record<string, string[]> = {
  Diatonic: DIATONIC,
  'Diatonic + borrowed': [...DIATONIC, ...BORROWED],
};

const REHARM_BASES = ['ii-V-I', 'turnaround', 'pop', 'cycle', 'gospel'];

export const qualityName = (s: string) => (s === '' ? 'major' : s === 'm' ? 'minor' : displaySuffix(s));

export const pick = <T,>(xs: T[], rnd = Math.random) => xs[Math.floor(rnd() * xs.length)];

export function shuffle<T>(xs: T[], rnd = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const steps = (chords: Chord[], voicings: Voicing[]): Step[] =>
  voicings.map((v, i) => ({ midis: v.notes.map((n) => n.midi), beats: chords[i].beats }));

export function qualityQuestion(level: string, rnd = Math.random): Question {
  const pool = QUALITY_LEVELS[level];
  const suffix = pick(pool, rnd);
  const chord = makeChord(parseNoteName(pick(KEYS, rnd))!, suffix);
  const [v] = voiceProgression([chord], 'close', { bassRoot: true });
  return {
    mode: 'quality',
    answer: qualityName(suffix),
    options: pool.map(qualityName),
    main: [{ midis: v.notes.map((n) => n.midi), beats: 4 }],
    bpm: 60,
    explain: `${chordSymbol(chord)}: ${v.notes.map((n) => n.label).join(' ')}`,
    show: v,
  };
}

export function functionQuestion(level: string, rnd = Math.random): Question {
  const pool = FUNCTION_LEVELS[level];
  const target = pick(pool, rnd);
  const key = pick(KEYS, rnd);
  const chords = parseProgressionText(`I IV | V7 I | ${target}`, parseNoteName(key)!).chords;
  const voicings = voiceProgression(chords, 'close', { bassRoot: true });
  const borrowed = BORROWED.includes(target);
  return {
    mode: 'function',
    answer: target,
    options: pool,
    main: [...steps(chords.slice(0, 4), voicings.slice(0, 4)), { midis: [], beats: 1 }, ...steps(chords.slice(4), voicings.slice(4))],
    bpm: 96,
    explain: `${target} in ${key} is ${chordSymbol(chords[4])}${borrowed ? ', borrowed from the parallel minor' : ''}.`,
    show: voicings[4],
  };
}

export function reharmQuestion(rnd = Math.random): Question {
  for (;;) {
    const key = parseNoteName(pick(KEYS, rnd))!;
    const baseId = pick(REHARM_BASES, rnd);
    const base = PRESETS.find((p) => p.id === baseId)!;
    const original = parseProgressionText(base.text, key).chords;
    const valid = REHARMS.filter((r) => (applyReharms(original, key, new Set([r.id])).counts[r.id] ?? 0) > 0);
    if (!valid.length) continue;
    const correct = pick(valid, rnd);
    const changed = applyReharms(original, key, new Set([correct.id])).chords;
    const others = shuffle(REHARMS.filter((r) => r.id !== correct.id), rnd).slice(0, 3);
    const voice = (cs: Chord[]) => steps(cs, voiceProgression(cs, 'drop2', { bassRoot: true }));
    return {
      mode: 'reharm',
      answer: correct.name,
      options: shuffle([correct, ...others], rnd).map((r) => r.name),
      main: voice(original),
      alt: voice(changed),
      bpm: 84,
      explain: `${original.map(chordSymbol).join(' ')}  →  ${changed.map(chordSymbol).join(' ')}. ${correct.desc}`,
    };
  }
}
