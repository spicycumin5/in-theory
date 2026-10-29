import { NoteName, formatName, parseNoteName, pcOf, transposeName } from './notes';

// Chord degree -> [semitones above root, letter steps above root].
export const DEGREES = {
  '1': [0, 0],
  b9: [1, 1],
  '9': [2, 1],
  '#9': [3, 1],
  '2': [2, 1],
  b3: [3, 2],
  '3': [4, 2],
  '4': [5, 3],
  '11': [5, 3],
  '#11': [6, 3],
  b5: [6, 4],
  '5': [7, 4],
  '#5': [8, 4],
  b13: [8, 5],
  '6': [9, 5],
  '13': [9, 5],
  bb7: [9, 6],
  b7: [10, 6],
  '7': [11, 6],
} as const satisfies Record<string, readonly [number, number]>;

export type Degree = keyof typeof DEGREES;

const T = (s: string) => s.split(' ') as Degree[];

export const CHORD_TYPES: Record<string, Degree[]> = {
  '': T('1 3 5'),
  m: T('1 b3 5'),
  dim: T('1 b3 b5'),
  aug: T('1 3 #5'),
  sus4: T('1 4 5'),
  sus2: T('1 2 5'),
  '5': T('1 5'),
  '6': T('1 3 5 6'),
  m6: T('1 b3 5 6'),
  '69': T('1 3 5 6 9'),
  m69: T('1 b3 5 6 9'),
  add9: T('1 3 5 9'),
  madd9: T('1 b3 5 9'),
  maj7: T('1 3 5 7'),
  maj9: T('1 3 5 7 9'),
  maj13: T('1 3 5 7 9 13'),
  'maj7#11': T('1 3 5 7 #11'),
  'maj9#11': T('1 3 5 7 9 #11'),
  'maj13#11': T('1 3 5 7 9 #11 13'),
  'maj7#5': T('1 3 #5 7'),
  m7: T('1 b3 5 b7'),
  m9: T('1 b3 5 b7 9'),
  m11: T('1 b3 5 b7 9 11'),
  m13: T('1 b3 5 b7 9 11 13'),
  mmaj7: T('1 b3 5 7'),
  mmaj9: T('1 b3 5 7 9'),
  m7b5: T('1 b3 b5 b7'),
  m9b5: T('1 b3 b5 b7 9'),
  m11b5: T('1 b3 b5 b7 11'),
  dim7: T('1 b3 b5 bb7'),
  '7': T('1 3 5 b7'),
  '9': T('1 3 5 b7 9'),
  '13': T('1 3 5 b7 9 13'),
  '7sus4': T('1 4 5 b7'),
  '9sus4': T('1 4 5 b7 9'),
  '13sus4': T('1 4 5 b7 9 13'),
  '7b9': T('1 3 5 b7 b9'),
  '7#9': T('1 3 5 b7 #9'),
  '7#11': T('1 3 5 b7 #11'),
  '7b5': T('1 3 b5 b7'),
  '7#5': T('1 3 #5 b7'),
  '9#11': T('1 3 5 b7 9 #11'),
  '13#11': T('1 3 5 b7 9 #11 13'),
  '7b13': T('1 3 5 b7 b13'),
  '9b13': T('1 3 5 b7 9 b13'),
  '7b9b13': T('1 3 5 b7 b9 b13'),
  '7#9b13': T('1 3 b7 #9 b13'),
  '7b9#11': T('1 3 5 b7 b9 #11'),
  '7#9#11': T('1 3 5 b7 #9 #11'),
  '13b9': T('1 3 5 b7 b9 13'),
  '7#9#5': T('1 3 #5 b7 #9'),
  '7alt': T('1 3 b7 b9 #9 #11 b13'),
};

export interface Chord {
  root: NoteName;
  suffix: string;
  degrees: Degree[];
  bass?: NoteName;
  beats: number;
  /** Set when a reharmonization created or changed this chord. */
  note?: string;
}

/** Map the many ways people write chord qualities onto CHORD_TYPES keys. */
export function normalizeSuffix(raw: string): string {
  let s = raw.replace(/[()\s,]/g, '').replace(/♭/g, 'b').replace(/♯/g, '#');
  s = s.replace(/^m6\/9/, 'm69').replace(/^6\/9/, '69');
  if (s === 'Δ') return 'maj7';
  s = s.replace(/^Δ/, 'maj');
  if (/^(\+|aug)$/.test(s)) return 'aug';
  if (/^(\+7|7\+|7\+5|aug7|7aug)$/.test(s)) return '7#5';
  s = s.replace(/^(m|min|mi|-)(M|Maj|maj|ma|Ma|Δ)/, 'mmaj');
  if (s === 'mmaj') return 'mmaj7';
  s = s.replace(/^(min|mi|-)/, 'm');
  s = s.replace(/^(ø|h)7?$/, 'm7b5').replace(/^(ø|h)9$/, 'm9b5').replace(/^(ø|h)11$/, 'm11b5');
  s = s.replace(/^(°|o)7$/, 'dim7').replace(/^(°|o)$/, 'dim');
  s = s.replace(/-(?=\d)/g, 'b').replace(/\+(?=\d)/g, '#');
  s = s.replace(/^(M|Maj|Ma|ma)(?=\d|#|b|$)/, 'maj');
  if (s === 'maj' || s === 'M') return '';
  const aliases: Record<string, string> = {
    sus: 'sus4',
    '7sus': '7sus4',
    '9sus': '9sus4',
    '13sus': '13sus4',
    '11': '9sus4',
    alt: '7alt',
    add2: 'add9',
    '2': 'sus2',
    maj6: '6',
    m7b9b5: 'm7b5',
    'maj7+5': 'maj7#5',
  };
  return aliases[s] ?? s;
}

export function makeChord(root: NoteName, suffix: string, beats = 4, bass?: NoteName, note?: string): Chord {
  const degrees = CHORD_TYPES[suffix];
  if (!degrees) throw new Error(`Unknown chord type "${suffix}"`);
  return { root, suffix, degrees, bass, beats, note };
}

export function parseChordSymbol(symbol: string, beats = 4): Chord | null {
  const m = /^([A-G](?:bb|b|##|#|♭|♯)?)(.*?)(?:\/([A-G](?:b|#|♭|♯)?))?$/.exec(symbol.trim().replace('6/9', '69'));
  if (!m) return null;
  const root = parseNoteName(m[1]);
  const suffix = normalizeSuffix(m[2]);
  if (!root || !(suffix in CHORD_TYPES)) return null;
  const bass = m[3] ? parseNoteName(m[3]) ?? undefined : undefined;
  return makeChord(root, suffix, beats, bass && pcOf(bass) !== pcOf(root) ? bass : undefined);
}

const DISPLAY: Record<string, string> = {
  m7b5: 'ø7',
  m9b5: 'ø9',
  m11b5: 'ø11',
  dim7: '°7',
  dim: '°',
  '69': '6/9',
  m69: 'm6/9',
  mmaj7: 'm(maj7)',
  mmaj9: 'm(maj9)',
};
export const displaySuffix = (s: string) => DISPLAY[s] ?? s;

export function chordSymbol(c: Chord): string {
  return formatName(c.root) + displaySuffix(c.suffix) + (c.bass ? '/' + formatName(c.bass) : '');
}

export const has = (c: Chord, d: Degree) => c.degrees.includes(d);

export type Quality = 'maj' | 'min' | 'mmaj' | 'dom' | 'hdim' | 'dim' | 'sus' | 'aug';

export function quality(c: Chord): Quality {
  if (has(c, 'b3')) {
    if (has(c, 'b5')) return has(c, 'b7') ? 'hdim' : 'dim';
    return has(c, '7') ? 'mmaj' : 'min';
  }
  if (has(c, '3')) {
    if (has(c, 'b7')) return 'dom';
    if (has(c, '#5') && !has(c, '7')) return 'aug';
    return 'maj';
  }
  if (has(c, '4') || has(c, '2')) return 'sus';
  return 'maj';
}

/** The spelled note name of a degree of the chord, e.g. (G7alt, #9) -> A#. */
export function degreeNote(c: Chord, d: Degree): NoteName {
  const [semis, steps] = DEGREES[d];
  return transposeName(c.root, semis, steps);
}

export function transposeChord(c: Chord, semis: number, steps: number): Chord {
  return {
    ...c,
    root: transposeName(c.root, semis, steps),
    bass: c.bass && transposeName(c.bass, semis, steps),
  };
}
