import { Chord, DEGREES, Degree, degreeNote, has, quality } from './chords';
import { NoteName, mod12, pcOf, spelledMidiName } from './notes';

export type StyleId = 'close' | 'shell' | 'rootless' | 'drop2' | 'drop3' | 'quartal' | 'ust' | 'neosoul';

export interface StyleInfo {
  id: StyleId;
  name: string;
  hands: string;
  desc: string;
}

export const STYLES: StyleInfo[] = [
  {
    id: 'close',
    name: 'Close position',
    hands: 'One hand',
    desc: 'All the main chord tones within an octave, with inversions picked for smooth voice leading. Everything else grows from this.',
  },
  {
    id: 'shell',
    name: 'Shells 1-3-7 / 1-7-3',
    hands: 'Left hand',
    desc: 'Root plus guide tones (3rd and 7th). The 3rd and 7th define the chord, and in a ii–V–I they only move by half or whole steps. Learn this first.',
  },
  {
    id: 'rootless',
    name: 'Rootless A / B',
    hands: 'One hand (+ bass)',
    desc: 'A = 3-5-7-9, B = 7-9-3-5 (13 replaces 5 on dominants). Alternating A and B keeps the hand almost still through a ii–V–I. The Bill Evans sound.',
  },
  {
    id: 'drop2',
    name: 'Drop 2',
    hands: 'Two hands',
    desc: 'Take a close 4-note voicing and drop the 2nd voice from the top down an octave. Open and singing, great for chord-melody.',
  },
  {
    id: 'drop3',
    name: 'Drop 3',
    hands: 'Two hands',
    desc: 'Drop the 3rd voice from the top an octave. Wider than drop 2, so the bottom note works like a bass line.',
  },
  {
    id: 'quartal',
    name: 'Quartal (4ths)',
    hands: 'One hand (+ bass)',
    desc: 'Stacked 4ths, as in "So What" and McCoy Tyner. Open, ambiguous, modal. Notice how one shape fits several chords.',
  },
  {
    id: 'ust',
    name: 'Upper-structure triads',
    hands: 'LH shell + RH triad',
    desc: 'The LH plays root + guide tones and the RH plays a plain triad that spells the tensions (e.g. D major over C7 = C13#11). Easy shapes, rich sound.',
  },
  {
    id: 'neosoul',
    name: 'Neo-soul clusters',
    hands: 'LH 1-7 + RH cluster',
    desc: 'The LH plays root + 7th, the RH a tight cluster with the 9th rubbing against the 3rd. The neo-soul / gospel sound.',
  },
];

type Slot = Degree | 'R';
interface Variant {
  name: string;
  lh: Slot[];
  rh: Slot[];
}

export interface VoicedNote {
  midi: number;
  label: string;
  name: string;
  hand: 'L' | 'R';
  isBass: boolean;
}

export interface Voicing {
  notes: VoicedNote[];
  variant: string;
}

type Range = [number, number];
// Ranges are for the lowest note of each hand's shape.
const BASS: Range = [36, 47];
const LH: Range = [38, 50];
const MID: Range = [50, 64];
const UPPER: Range = [60, 72];

const pick = (c: Chord, ...opts: Degree[]) => opts.find((d) => has(c, d));
const third = (c: Chord): Degree => pick(c, '3', 'b3', '4', '2') ?? '3';
const seventh = (c: Chord) => pick(c, 'b7', '7', 'bb7', '6');
const fifth = (c: Chord): Degree => pick(c, '5', 'b5', '#5') ?? '5';
const ninth = (c: Chord) => pick(c, '9', '#9', 'b9');
const isAltered = (c: Chord) => has(c, '#9') || has(c, 'b13') || has(c, '#5');

const semis = (d: Degree) => DEGREES[d][0];
const byPc = (ds: Degree[]) => [...ds].sort((a, b) => semis(a) - semis(b));
const rotations = <T,>(xs: T[]) => xs.map((_, i) => [...xs.slice(i), ...xs.slice(0, i)]);
const fmt = (s: Slot[]) => s.join('-');
const one = (rh: Slot[], name = fmt(rh)): Variant => ({ name, lh: [], rh });

/** The four most important tones: guide tones first, then tensions, then 5th and root. */
function core(c: Chord): Degree[] {
  const s = seventh(c);
  if (!s) return c.degrees.slice(0, 4);
  const f = fifth(c);
  const out: Degree[] = [third(c), s];
  if (f !== '5') out.push(f);
  const n9 = pick(c, '#9', 'b9', '9');
  const n13 = pick(c, 'b13', '13', '#11', '11');
  if (n9) out.push(n9);
  if (n13 && out.length < 4) out.push(n13);
  if (out.length < 4 && f === '5' && has(c, '5')) out.push('5');
  if (out.length < 4) out.push('1');
  return out.slice(0, 4);
}

/** Rootless slots in A order: [3rd, 5th-ish, 7th, 9th-ish]. */
function rootless(c: Chord): Degree[] | null {
  const t = third(c);
  const s = seventh(c);
  const n9 = ninth(c) ?? '9';
  switch (quality(c)) {
    case 'maj':
      return [t, has(c, '13') ? '13' : fifth(c), s ?? '6', n9];
    case 'mmaj':
      return [t, '5', '7', n9];
    case 'min':
      return [t, has(c, '11') ? '11' : has(c, '13') ? '13' : fifth(c), s ?? 'b7', n9];
    case 'dom':
      return [t, pick(c, 'b13', '#5', '13', '#11') ?? '13', 'b7', n9];
    case 'sus':
      return t === '2' ? null : [t, has(c, '13') ? '13' : '5', s ?? '1', n9];
    case 'hdim':
      return [t, 'b5', 'b7', has(c, '11') ? '11' : has(c, '9') ? '9' : '1'];
    case 'dim':
      return [t, 'b5', s ?? 'bb7', '1'];
    default:
      return null;
  }
}

function drop(r: Degree[], k: number): Degree[] {
  const arr = [...r];
  const [x] = arr.splice(arr.length - k, 1);
  return [x, ...arr];
}

const closeVariants = (c: Chord) => rotations(byPc(core(c))).map((r) => one(r, `${r[0]} on bottom`));

function quartal(c: Chord): Variant[] {
  const s = seventh(c);
  switch (quality(c)) {
    case 'min':
    case 'mmaj':
      return [one(['1', '11', s ?? 'b7', 'b3', '5'], 'So What: 1-11-7-b3-5'), one(['5', '1', '11', s ?? 'b7'], '4ths from the 5th')];
    case 'maj':
      return s === '6'
        ? [one(['3', '6', '9', '5']), one(['6', '9', '5', '1'])]
        : [one(['3', '6', '9', '5']), one([s ?? '7', '3', '6', '9'])];
    case 'dom':
      return isAltered(c)
        ? [one(['3', 'b7', ninth(c) ?? '#9', pick(c, 'b13', '13') ?? 'b13'], 'tritone + 4ths (altered)')]
        : [one(['3', '13', '9', '5']), one(['b7', '3', '13', '9'], 'tritone + 4ths')];
    case 'sus':
      return [one(['5', '1', '4', 'b7']), one(['1', '4', 'b7', '9'])];
    case 'hdim':
      return [one(['1', '11', 'b7', 'b3', 'b5'])];
    default:
      return closeVariants(c);
  }
}

function upperTriad(c: Chord): { name: string; tones: Degree[] } {
  const s = seventh(c);
  switch (quality(c)) {
    case 'maj':
      if (has(c, '#11')) return { name: 'II', tones: ['9', '#11', '13'] };
      return s === '6' ? { name: 'vi', tones: ['6', '1', '3'] } : { name: 'V', tones: ['5', '7', '9'] };
    case 'mmaj':
      return { name: 'V', tones: ['5', '7', '9'] };
    case 'min':
      return s === '6' ? { name: 'IV', tones: ['11', '6', '1'] } : { name: 'bVII', tones: ['b7', '9', '11'] };
    case 'dom':
      if (isAltered(c)) return { name: 'bVI', tones: ['b13', '1', '#9'] };
      if (has(c, 'b9') && has(c, '13')) return { name: 'VI', tones: ['13', 'b9', '3'] };
      if (has(c, 'b9')) return { name: 'bV', tones: ['#11', 'b7', 'b9'] };
      if (has(c, '13') || has(c, '#11')) return { name: 'II', tones: ['9', '#11', '13'] };
      return { name: 'v', tones: ['5', 'b7', '9'] };
    case 'sus':
      return { name: 'bVII', tones: ['b7', '9', '11'] };
    case 'hdim':
      return { name: 'biii', tones: ['b3', 'b5', 'b7'] };
    case 'dim':
      return { name: '°', tones: ['b3', 'b5', 'bb7'] };
    case 'aug':
      return { name: 'I+', tones: ['3', '#5', '1'] };
  }
}

function ust(c: Chord): Variant[] {
  const s = seventh(c) ?? fifth(c);
  const lh: Slot[] = quality(c) === 'sus' ? ['R', s] : ['R', third(c), s];
  const tri = upperTriad(c);
  return rotations(tri.tones).map((rh) => ({ name: `${tri.name} triad on top (${fmt(rh)})`, lh, rh }));
}

function cluster(c: Chord): Degree[] {
  switch (quality(c)) {
    case 'maj':
      return ['9', '3', '5'];
    case 'mmaj':
      return ['9', 'b3', '5'];
    case 'min':
      return has(c, '11') ? ['9', 'b3', '11', '5'] : ['9', 'b3', '5'];
    case 'dom':
      if (isAltered(c)) return ['#9', '3', 'b13'];
      return has(c, 'b9') ? ['b9', '3', '13'] : ['9', '3', '13'];
    case 'sus':
      return ['9', '4', '13'];
    case 'hdim':
      return ['b3', '11', 'b5'];
    case 'dim':
      return ['b3', 'b5', 'bb7'];
    case 'aug':
      return ['9', '3', '#5'];
  }
}

function neosoul(c: Chord): Variant[] {
  const lh: Slot[] = ['R', seventh(c) ?? fifth(c)];
  return rotations(byPc(cluster(c))).map((rh) => ({ name: `cluster ${fmt(rh)}`, lh, rh }));
}

interface StyleDef {
  variants: (c: Chord) => Variant[];
  rhRange: Range;
  center: number;
  /** The style already puts the root in the left hand. */
  ownBass?: boolean;
}

const DEFS: Record<StyleId, StyleDef> = {
  close: { variants: closeVariants, rhRange: MID, center: 62 },
  shell: {
    variants: (c) => {
      const t = third(c);
      const s = seventh(c) ?? fifth(c);
      return [
        { name: '1-3-7', lh: ['R', t, s], rh: [] },
        { name: '1-7-3', lh: ['R', s, t], rh: [] },
      ];
    },
    rhRange: MID,
    center: 52,
    ownBass: true,
  },
  rootless: {
    variants: (c) => {
      const r = rootless(c);
      if (!r) return closeVariants(c);
      const [a, b, x, y] = r;
      return [one([a, b, x, y], `A: ${fmt([a, b, x, y])}`), one([x, y, a, b], `B: ${fmt([x, y, a, b])}`)];
    },
    rhRange: MID,
    center: 60,
  },
  drop2: { variants: (c) => rotations(byPc(core(c))).map((r) => one(drop(r, 2))), rhRange: [48, 60], center: 62 },
  drop3: {
    variants: (c) => {
      const cc = core(c);
      return rotations(byPc(cc)).map((r) => one(drop(r, cc.length >= 4 ? 3 : 2)));
    },
    rhRange: [46, 58],
    center: 60,
  },
  quartal: { variants: quartal, rhRange: MID, center: 62 },
  ust: { variants: ust, rhRange: UPPER, center: 62, ownBass: true },
  neosoul: { variants: neosoul, rhRange: UPPER, center: 62, ownBass: true },
};

const slotPc = (c: Chord, s: Slot) => (s === 'R' ? pcOf(c.bass ?? c.root) : mod12(pcOf(c.root) + semis(s)));
const slotName = (c: Chord, s: Slot): NoteName => (s === 'R' ? c.bass ?? c.root : degreeNote(c, s));

/** Stack slots upward, each note the nearest pitch above the previous one. */
function stack(c: Chord, slots: Slot[], start: number): number[] {
  const out = [start];
  for (let i = 1; i < slots.length; i++) {
    let m = out[i - 1] + 1;
    while (mod12(m) !== slotPc(c, slots[i])) m++;
    out.push(m);
  }
  return out;
}

function placements(c: Chord, slots: Slot[], [lo, hi]: Range): number[][] {
  if (!slots.length) return [[]];
  const res: number[][] = [];
  for (let m = lo; m <= hi; m++) if (mod12(m) === slotPc(c, slots[0])) res.push(stack(c, slots, m));
  return res;
}

function candidates(c: Chord, def: StyleDef, bassRoot: boolean): Voicing[] {
  const all: Voicing[] = [];
  for (const v of def.variants(c)) {
    const lh: Slot[] = !def.ownBass && bassRoot ? ['R', ...v.lh] : v.lh;
    for (const l of placements(c, lh, def.ownBass ? LH : BASS)) {
      for (const r of placements(c, v.rh, def.rhRange)) {
        const toNote = (s: Slot, midi: number, hand: 'L' | 'R'): VoicedNote => ({
          midi,
          label: s,
          name: spelledMidiName(midi, slotName(c, s)),
          hand,
          isBass: s === 'R',
        });
        const notes = [...l.map((m, i) => toNote(lh[i], m, 'L')), ...r.map((m, i) => toNote(v.rh[i], m, 'R'))];
        all.push({ notes: notes.sort((a, b) => a.midi - b.midi), variant: v.name });
      }
    }
  }
  const clean = all.filter((v) => new Set(v.notes.map((n) => n.midi)).size === v.notes.length);
  return clean.length ? clean : all;
}

export const upperNotes = (v: Voicing) => v.notes.filter((n) => !n.isBass).map((n) => n.midi);
const bassOf = (v: Voicing) => v.notes.find((n) => n.isBass)?.midi;

/** Total semitones the voices move between two chords. */
export function motionCost(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  if (a.length === b.length) {
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    return sa.reduce((s, x, i) => s + Math.abs(x - sb[i]), 0);
  }
  const nearest = (from: number[], to: number[]) =>
    from.reduce((s, x) => s + Math.min(...to.map((y) => Math.abs(x - y))), 0);
  return (nearest(a, b) + nearest(b, a)) / 2;
}

function transitionCost(a: Voicing, b: Voicing): number {
  const ba = bassOf(a);
  const bb = bassOf(b);
  return motionCost(upperNotes(a), upperNotes(b)) + (ba != null && bb != null ? 0.15 * Math.abs(ba - bb) : 0);
}

function registerCost(v: Voicing, center: number): number {
  const u = upperNotes(v);
  if (!u.length) return 0;
  return 0.3 * Math.abs(u.reduce((s, x) => s + x, 0) / u.length - center);
}

/** Voice a whole progression, choosing the voicing per chord that minimizes total motion (Viterbi). */
export function voiceProgression(chords: Chord[], style: StyleId, opts: { bassRoot: boolean }): Voicing[] {
  const def = DEFS[style];
  const cands = chords.map((c) => candidates(c, def, opts.bassRoot));
  if (!cands.length) return [];
  let cost = cands[0].map((v) => registerCost(v, def.center));
  const back: number[][] = [];
  for (let i = 1; i < cands.length; i++) {
    const next: number[] = [];
    const bp: number[] = [];
    for (const v of cands[i]) {
      let best = Infinity;
      let arg = 0;
      cands[i - 1].forEach((u, j) => {
        const x = cost[j] + transitionCost(u, v);
        if (x < best) [best, arg] = [x, j];
      });
      next.push(best + registerCost(v, def.center));
      bp.push(arg);
    }
    cost = next;
    back.push(bp);
  }
  let k = cost.indexOf(Math.min(...cost));
  const res: Voicing[] = new Array(cands.length);
  for (let i = cands.length - 1; i >= 0; i--) {
    res[i] = cands[i][k];
    if (i > 0) k = back[i - 1][k];
  }
  return res;
}

/** For each upper note of `cur`: 'common' if held over from `prev`, else signed semitones from the nearest previous note. */
export function noteMotion(prev: Voicing | undefined, cur: Voicing): Map<number, number | 'common'> {
  const res = new Map<number, number | 'common'>();
  const p = prev ? upperNotes(prev) : [];
  if (!p.length) return res;
  for (const m of upperNotes(cur)) {
    if (p.includes(m)) res.set(m, 'common');
    else {
      const nearest = p.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best));
      res.set(m, m - nearest);
    }
  }
  return res;
}
