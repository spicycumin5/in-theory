import {
  CHORD_TYPES,
  Chord,
  displaySuffix,
  makeChord,
  normalizeSuffix,
  parseChordSymbol,
  quality,
  transposeChord,
} from './chords';
import { NoteName, mod, mod12, parseNoteName, pcOf, transposeName } from './notes';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const NUMERAL_RE = '(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)';
const ROMAN_RE = new RegExp(`^([b#♭♯]?)${NUMERAL_RE}(.*)$`);
const TARGET_RE = new RegExp(`^([b#♭♯]?)${NUMERAL_RE}$`);

export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const keyName = (pc: number) => KEYS[mod12(pc)];
/** Next key around the cycle of 4ths (C F Bb Eb …), the order most tunes move in. */
export const nextKeyFourths = (key: string) => keyName(pcOf(parseNoteName(key)!) + 5);

const accOf = (s: string) => (s === 'b' || s === '♭' ? -1 : s === '#' || s === '♯' ? 1 : 0);
const degreeRoot = (tonic: NoteName, acc: number, idx: number) => transposeName(tonic, MAJOR[idx] + acc, idx);

/** Parse a Roman numeral like "ii7", "bVImaj7", "#iv°7" or "V7/ii" in the given key. */
export function parseRoman(token: string, tonic: NoteName, beats = 4): Chord | null {
  let main = token;
  let base = tonic;
  const slash = token.lastIndexOf('/');
  if (slash > 0) {
    const t = TARGET_RE.exec(token.slice(slash + 1));
    if (t) {
      base = degreeRoot(tonic, accOf(t[1]), NUMERALS.indexOf(t[2].toUpperCase()));
      main = token.slice(0, slash);
    }
  }
  const m = ROMAN_RE.exec(main);
  if (!m) return null;
  const idx = NUMERALS.indexOf(m[2].toUpperCase());
  const lower = m[2] === m[2].toLowerCase();
  let suffix = m[3];
  if (lower && !/^(m|ø|°|o|dim|h)/.test(suffix)) suffix = 'm' + suffix;
  const norm = normalizeSuffix(suffix);
  if (!(norm in CHORD_TYPES)) return null;
  return makeChord(degreeRoot(base, accOf(m[1]), idx), norm, beats);
}

/**
 * Parse a progression. Tokens are chord symbols (Dm7, G7alt, C/E) or Roman numerals (ii7, V7/vi).
 * "|" separates bars of 4 beats; chords inside a bar share it evenly. Without bars, each chord gets a bar.
 */
export function parseProgressionText(text: string, tonic: NoteName): { chords: Chord[]; errors: string[] } {
  const chords: Chord[] = [];
  const errors: string[] = [];
  const bars = text.includes('|') ? text.split('|') : text.trim().split(/\s+/);
  for (const bar of bars) {
    const tokens = bar.trim().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const beats = 4 / tokens.length;
      const c = /^[A-G]/.test(tok) ? parseChordSymbol(tok, beats) : parseRoman(tok, tonic, beats);
      if (c) chords.push(c);
      else errors.push(tok);
    }
  }
  return { chords, errors };
}

export function transposeProgression(chords: Chord[], from: NoteName, to: NoteName): Chord[] {
  const semis = mod12(pcOf(to) - pcOf(from));
  const steps = mod(to.letter - from.letter, 7);
  return chords.map((c) => transposeChord(c, semis, steps));
}

const NUMS = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const DIM_NUMS = ['I', '#I', 'II', '#II', 'III', 'IV', '#IV', 'V', '#V', 'VI', 'bVII', 'VII'];

export const relPc = (c: Chord, tonic: NoteName) => mod12(pcOf(c.root) - pcOf(tonic));

/** Roman numeral of the chord root alone, cased by quality: "ii", "bVI", "#iv". */
export function romanNumeral(c: Chord, tonic: NoteName): string {
  const q = quality(c);
  const rel = relPc(c, tonic);
  const num = q === 'dim' || q === 'hdim' ? DIM_NUMS[rel] : NUMS[rel];
  const lower = q === 'min' || q === 'mmaj' || q === 'dim' || q === 'hdim';
  return lower ? num.toLowerCase() : num;
}

/** Full Roman label, e.g. Dm9 in C -> "ii9", Abmaj7 -> "bVImaj7". */
export function romanLabel(c: Chord, tonic: NoteName): string {
  const num = romanNumeral(c, tonic);
  let suf = displaySuffix(c.suffix);
  if (num !== num.toUpperCase() && suf.startsWith('m') && !suf.startsWith('maj')) suf = suf.slice(1);
  return num + suf;
}

export interface Preset {
  id: string;
  name: string;
  text: string;
  about: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'ii-V-I',
    name: 'Major ii–V–I',
    text: 'ii7 | V7 | Imaj7 | Imaj7',
    about: 'The most important progression in jazz. Learn every voicing style on this first.',
  },
  {
    id: 'minor-ii-V-i',
    name: 'Minor ii–V–i',
    text: 'iiø7 | V7b9 | im6 | im6',
    about: 'Half-diminished ii, altered V, minor tonic.',
  },
  {
    id: 'turnaround',
    name: 'I–vi–ii–V turnaround',
    text: 'Imaj7 vi7 | ii7 V7 | Imaj7 vi7 | ii7 V7',
    about: 'The turnaround at the end of countless standards. Try secondary dominants and tritone subs on it.',
  },
  {
    id: 'pop',
    name: 'Pop I–V–vi–IV',
    text: 'I | V | vi | IV',
    about: 'Plain triads. Add extensions, minor iv and bVI to hear how far one progression can go.',
  },
  {
    id: 'neo-soul',
    name: 'Neo-soul 4–3–6',
    text: 'IVmaj7 | III7 | vi7 | v7 I7',
    about: 'IVmaj7 to a secondary dominant on III, landing on vi; v7–I7 sets up IV again.',
  },
  {
    id: 'gospel',
    name: 'Gospel 1–4 with passing chords',
    text: 'Imaj7 I7 | IVmaj7 #iv°7 | Imaj7 VI7 | ii7 V7',
    about: 'I7 pulls to IV, #iv°7 walks the bass back up, VI7 is V7/ii.',
  },
  {
    id: 'cycle',
    name: 'Diatonic cycle of 5ths',
    text: 'ii7 | V7 | Imaj7 | IVmaj7 | viiø7 | III7b9 | vi7 | vi7',
    about: 'Every chord moves down a 5th: a major ii–V–I, then a minor ii–V–i to the relative minor.',
  },
  {
    id: 'blues',
    name: 'Jazz blues',
    text: 'I7 | IV7 | I7 | v7 I7 | IV7 | #iv°7 | I7 | VI7b9 | ii7 | V7 | I7 VI7 | ii7 V7',
    about: '12-bar blues with jazz substitutions: ii–V into IV, passing diminished, turnaround.',
  },
];
