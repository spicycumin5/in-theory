import { Chord, chordSymbol, makeChord, quality } from './chords';
import { NoteName, mod12, pcOf, transposeName } from './notes';
import { relPc, romanNumeral } from './progressions';

export type ReharmId =
  | 'minorIV'
  | 'flatVI'
  | 'halfDimII'
  | 'backdoor'
  | 'secDom'
  | 'relatedII'
  | 'tritone'
  | 'dimPassing'
  | 'extensions';

export interface ReharmInfo {
  id: ReharmId;
  name: string;
  group: 'Modal interchange' | 'Dominant tricks' | 'Color';
  desc: string;
}

// Listed in the order they are applied.
export const REHARMS: ReharmInfo[] = [
  {
    id: 'minorIV',
    name: 'Minor iv',
    group: 'Modal interchange',
    desc: 'Borrow iv from the parallel minor: IV becomes IV then iv6 (or just iv6). The bittersweet "minor plagal" sound.',
  },
  {
    id: 'flatVI',
    name: 'bVI',
    group: 'Modal interchange',
    desc: 'vi becomes bVImaj7, borrowed from the parallel minor. A dramatic, cinematic lift.',
  },
  {
    id: 'halfDimII',
    name: 'iiø7',
    group: 'Modal interchange',
    desc: 'ii becomes iiø7 and V becomes V7b9: a minor ii–V that resolves to major. Darker approach.',
  },
  {
    id: 'backdoor',
    name: 'Backdoor ii–V',
    group: 'Modal interchange',
    desc: 'ii–V–I becomes iv7–bVII7–I. The dominant from the parallel minor resolves up a whole step.',
  },
  {
    id: 'secDom',
    name: 'Secondary dominants',
    group: 'Dominant tricks',
    desc: 'Chords that fall a 5th into the next chord become dominants (V7/x), or a V7/x is inserted. Each chord gets pulled toward the next.',
  },
  {
    id: 'relatedII',
    name: 'Related ii',
    group: 'Dominant tricks',
    desc: 'Every dominant gets its own ii in front of it, so each V7 becomes a little ii–V.',
  },
  {
    id: 'tritone',
    name: 'Tritone substitution',
    group: 'Dominant tricks',
    desc: 'A resolving V7 is replaced by the dominant a tritone away. Same 3rd and 7th (swapped), and the bass moves down by half step.',
  },
  {
    id: 'dimPassing',
    name: 'Diminished passing',
    group: 'Dominant tricks',
    desc: 'Between chords a whole step apart, insert a #°7. Chromatic bass line; it works like a rootless V7b9 of the next chord.',
  },
  {
    id: 'extensions',
    name: 'Extensions',
    group: 'Color',
    desc: 'Add 7ths, 9ths and 13ths by function: maj9 on major, m9 on minor (m7 on iii), 13 on dominants, 7b9b13 when resolving to minor.',
  },
];

type Rule = (chords: Chord[], tonic: NoteName) => { chords: Chord[]; count: number };

const isDom = (c: Chord) => quality(c) === 'dom';
const isMinorish = (c: Chord) => ['min', 'mmaj', 'hdim'].includes(quality(c));
/** True when a's root is a perfect 5th above b's root (a "resolves" down a 5th to b). */
const fallsFifthTo = (a: Chord, b: Chord) => mod12(pcOf(a.root) - pcOf(b.root)) === 7;
const withBeats = (c: Chord, beats: number): Chord => ({ ...c, beats });
const annotate = (c: Chord, note: string): Chord => ({ ...c, note: c.note ? `${c.note} ${note}` : note });

const minorIV: Rule = (chords, tonic) => {
  let count = 0;
  const out = chords.flatMap((c) => {
    if (relPc(c, tonic) !== 5 || quality(c) !== 'maj') return [c];
    count++;
    const note = 'iv6 borrowed from the parallel minor (minor plagal).';
    if (c.beats >= 2) return [withBeats(c, c.beats / 2), makeChord(c.root, 'm6', c.beats / 2, undefined, note)];
    return [makeChord(c.root, 'm6', c.beats, undefined, note)];
  });
  return { chords: out, count };
};

const flatVI: Rule = (chords, tonic) => {
  let count = 0;
  const out = chords.map((c) => {
    if (relPc(c, tonic) !== 9 || !isMinorish(c)) return c;
    count++;
    return makeChord(transposeName(tonic, 8, 5), 'maj7', c.beats, undefined, 'bVImaj7 borrowed from the parallel minor (replaces vi).');
  });
  return { chords: out, count };
};

const halfDimII: Rule = (chords, tonic) => {
  let count = 0;
  const out = [...chords];
  out.forEach((c, i) => {
    if (relPc(c, tonic) !== 2 || quality(c) !== 'min') return;
    count++;
    out[i] = makeChord(c.root, 'm7b5', c.beats, undefined, 'iiø7 borrowed from the parallel minor.');
    const next = out[i + 1];
    if (next && isDom(next) && relPc(next, tonic) === 7) {
      out[i + 1] = makeChord(next.root, '7b9', next.beats, next.bass, 'V7b9: the b9 comes from the minor key, matching iiø7.');
    }
  });
  return { chords: out, count };
};

const backdoor: Rule = (chords, tonic) => {
  let count = 0;
  const out: Chord[] = [];
  for (let i = 0; i < chords.length; i++) {
    const [c, n1, n2] = [chords[i], chords[i + 1], chords[i + 2]];
    const iv = () => makeChord(transposeName(tonic, 5, 3), 'm7', c.beats, undefined, 'iv7 from the parallel minor (backdoor ii).');
    const bVII = (beats: number) =>
      makeChord(transposeName(tonic, 10, 6), '7', beats, undefined, 'bVII7 backdoor dominant: resolves up a whole step to I.');
    if (n1 && n2 && relPc(c, tonic) === 2 && quality(c) === 'min' && relPc(n1, tonic) === 7 && isDom(n1) && relPc(n2, tonic) === 0) {
      out.push(iv(), bVII(n1.beats));
      i++;
      count++;
    } else if (n1 && relPc(c, tonic) === 7 && isDom(c) && relPc(n1, tonic) === 0) {
      out.push(bVII(c.beats));
      count++;
    } else out.push(c);
  }
  return { chords: out, count };
};

const secDom: Rule = (chords, tonic) => {
  let count = 0;
  const out: Chord[] = [];
  chords.forEach((t, j) => {
    const prev = out[out.length - 1];
    const q = quality(t);
    const target = j > 0 && relPc(t, tonic) !== 0 && ['maj', 'min', 'mmaj', 'dom'].includes(q);
    if (target && !(isDom(prev) && fallsFifthTo(prev, t))) {
      const suffix = isMinorish(t) ? '7b9' : '7';
      const note = `V7/${romanNumeral(t, tonic)}: secondary dominant pulling to ${chordSymbol(t)}.`;
      if (fallsFifthTo(prev, t)) {
        out[out.length - 1] = makeChord(prev.root, suffix, prev.beats, prev.bass, note);
        count++;
      } else if (prev.beats >= 2) {
        out[out.length - 1] = withBeats(prev, prev.beats / 2);
        out.push(makeChord(transposeName(t.root, 7, 4), suffix, prev.beats / 2, undefined, note));
        count++;
      }
    }
    out.push(t);
  });
  return { chords: out, count };
};

const relatedII: Rule = (chords) => {
  let count = 0;
  const out: Chord[] = [];
  chords.forEach((c, i) => {
    const prev = out[out.length - 1];
    const next = chords[i + 1];
    const hasII = prev && fallsFifthTo(prev, c) && isMinorish(prev);
    if (isDom(c) && c.beats >= 2 && !hasII) {
      const toMinor = next && fallsFifthTo(c, next) && isMinorish(next);
      out.push(
        makeChord(transposeName(c.root, 7, 4), toMinor ? 'm7b5' : 'm7', c.beats / 2, undefined, `Related ii of ${chordSymbol(c)}: turns it into a ii–V.`),
        withBeats(c, c.beats / 2),
      );
      count++;
    } else out.push(c);
  });
  return { chords: out, count };
};

const tritone: Rule = (chords) => {
  let count = 0;
  const out = chords.map((c, i) => {
    const next = chords[(i + 1) % chords.length];
    if (!isDom(c) || chords.length < 2 || !fallsFifthTo(c, next)) return c;
    count++;
    return makeChord(
      transposeName(c.root, 6, 4),
      c.suffix === '7' ? '7' : '9',
      c.beats,
      undefined,
      `subV7: tritone sub for ${chordSymbol(c)}. Same guide tones, bass now moves by half step.`,
    );
  });
  return { chords: out, count };
};

const dimPassing: Rule = (chords) => {
  let count = 0;
  const out = chords.flatMap((a, i) => {
    const b = chords[i + 1];
    if (!b || a.beats < 2 || quality(a) === 'dim' || mod12(pcOf(b.root) - pcOf(a.root)) !== 2) return [a];
    count++;
    const dim = makeChord(transposeName(a.root, 1, 0), 'dim7', a.beats / 2, undefined, `Passing °7: chromatic bass from ${chordSymbol(a)} up to ${chordSymbol(b)}.`);
    return [withBeats(a, a.beats / 2), dim];
  });
  return { chords: out, count };
};

const extensions: Rule = (chords, tonic) => {
  let count = 0;
  const out = chords.map((c, i) => {
    const next = chords[(i + 1) % chords.length];
    const toMinor = chords.length > 1 && fallsFifthTo(c, next) && isMinorish(next);
    const rel = relPc(c, tonic);
    const upgrade: Record<string, string> = {
      '': rel === 7 ? (toMinor ? '7b9' : '9') : 'maj9',
      maj7: 'maj9',
      '6': '69',
      m: rel === 4 ? 'm7' : 'm9',
      m7: rel === 4 ? 'm7' : 'm9',
      m6: 'm69',
      '7': toMinor ? '7b9b13' : '13',
      '9': toMinor ? '7b9b13' : '13',
      m7b5: 'm11b5',
      '7sus4': '9sus4',
    };
    const to = upgrade[c.suffix];
    if (!to || to === c.suffix) return c;
    count++;
    return annotate(makeChord(c.root, to, c.beats, c.bass, c.note), `Extended from ${chordSymbol(c)}.`);
  });
  return { chords: out, count };
};

const RULES: Record<ReharmId, Rule> = {
  minorIV,
  flatVI,
  halfDimII,
  backdoor,
  secDom,
  relatedII,
  tritone,
  dimPassing,
  extensions,
};

export function applyReharms(chords: Chord[], tonic: NoteName, active: Set<ReharmId>) {
  const counts: Partial<Record<ReharmId, number>> = {};
  let cur = chords;
  for (const { id } of REHARMS) {
    if (!active.has(id)) continue;
    const r = RULES[id](cur, tonic);
    cur = r.chords;
    counts[id] = r.count;
  }
  return { chords: cur, counts };
}
