// Pitch spelling. A note name is a letter (0 = C … 6 = B) plus an accidental,
// so transpositions can keep correct spelling (e.g. bVI in C is Ab, not G#).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const mod12 = (n: number) => mod(n, 12);

export interface NoteName {
  letter: number;
  acc: number;
}

export function parseNoteName(s: string): NoteName | null {
  const m = /^([A-Ga-g])(bb|b|##|#|♭|♯)?$/.exec(s.trim());
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const a = m[2] ?? '';
  const acc = a === 'bb' ? -2 : a === 'b' || a === '♭' ? -1 : a === '##' ? 2 : a === '#' || a === '♯' ? 1 : 0;
  return { letter, acc };
}

export const pcOf = (n: NoteName) => mod12(LETTER_PC[n.letter] + n.acc);

export function formatName(n: NoteName): string {
  return LETTERS[n.letter] + (n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc));
}

export function simpleName(pc: number, preferFlats: boolean): NoteName {
  return parseNoteName((preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)])!;
}

/** Move a note up by `semis` semitones and `letterSteps` letter names (e.g. a P5 is 7 semis, 4 steps). */
export function transposeName(n: NoteName, semis: number, letterSteps: number): NoteName {
  const letter = mod(n.letter + letterSteps, 7);
  const target = mod12(pcOf(n) + semis);
  const acc = mod(target - LETTER_PC[letter] + 6, 12) - 6;
  // Avoid double accidentals: fall back to the simplest enharmonic.
  if (Math.abs(acc) > 1) return simpleName(target, acc < 0);
  return { letter, acc };
}

/** Name a MIDI note using a given spelling, e.g. (61, Db) -> "Db4", (61, C#) -> "C#4". */
export function spelledMidiName(midi: number, name: NoteName): string {
  return formatName(name) + (Math.floor((midi - name.acc) / 12) - 1);
}

export function midiName(midi: number, preferFlats = true): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(midi)] + (Math.floor(midi / 12) - 1);
}
