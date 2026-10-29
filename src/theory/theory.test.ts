import { describe, expect, it } from 'vitest';
import { chordSymbol, parseChordSymbol } from './chords';
import { formatName, parseNoteName, pcOf } from './notes';
import { PRESETS, parseProgressionText, romanLabel, transposeProgression } from './progressions';
import { ReharmId, applyReharms } from './reharm';
import { STYLES, upperNotes, voiceProgression } from './voicings';

const C = parseNoteName('C')!;
const prog = (text: string, key = C) => parseProgressionText(text, key).chords;
const symbols = (text: string, reharms: ReharmId[] = [], key = C) =>
  applyReharms(prog(text, key), key, new Set(reharms)).chords.map(chordSymbol);

describe('chord parsing', () => {
  it('parses qualities and aliases', () => {
    expect(parseChordSymbol('Dm9')!.degrees).toEqual(['1', 'b3', '5', 'b7', '9']);
    expect(pcOf(parseChordSymbol('F#m7b5')!.root)).toBe(6);
    expect(parseChordSymbol('G7alt')!.degrees).toContain('#9');
    expect(parseChordSymbol('C-7')!.suffix).toBe('m7');
    expect(parseChordSymbol('CΔ7')!.suffix).toBe('maj7');
    expect(parseChordSymbol('Bø')!.suffix).toBe('m7b5');
    expect(parseChordSymbol('Ebm(maj7)')!.suffix).toBe('mmaj7');
    expect(parseChordSymbol('C6/9')!.suffix).toBe('69');
    expect(formatName(parseChordSymbol('C/E')!.bass!)).toBe('E');
    expect(parseChordSymbol('Hm7')).toBeNull();
  });
});

describe('progressions', () => {
  it('renders Roman numerals in a key', () => {
    expect(symbols('ii7 | V7 | Imaj7')).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(symbols('bVImaj7 #iv°7 V7/ii', [], parseNoteName('Eb')!)).toEqual(['Cbmaj7', 'A°7', 'C7']);
  });

  it('splits bars into beats', () => {
    expect(prog('Dm7 G7 | Cmaj7').map((c) => c.beats)).toEqual([2, 2, 4]);
  });

  it('transposes with correct spelling', () => {
    const t = transposeProgression(prog('Dm7 G7 Cmaj7'), C, parseNoteName('Eb')!);
    expect(t.map(chordSymbol)).toEqual(['Fm7', 'Bb7', 'Ebmaj7']);
  });

  it('labels chords with Roman numerals', () => {
    expect(prog('Dm9 Abmaj7 C#°7 Bø7').map((c) => romanLabel(c, C))).toEqual(['ii9', 'bVImaj7', '#i°7', 'viiø7']);
  });

  it('parses every preset', () => {
    for (const p of PRESETS) expect(parseProgressionText(p.text, C).errors).toEqual([]);
  });
});

describe('reharmonization', () => {
  it('tritone-subs G7 to Db7', () => {
    expect(symbols('Dm7 G7 Cmaj7', ['tritone'])).toEqual(['Dm7', 'Db7', 'Cmaj7']);
  });

  it('adds secondary dominants to a turnaround', () => {
    expect(symbols('Cmaj7 | Am7 | Dm7 | G7', ['secDom'])).toEqual(['Cmaj7', 'E7b9', 'A7b9', 'D7', 'G7']);
  });

  it('borrows from the parallel minor', () => {
    expect(symbols('I | V | vi | IV', ['minorIV', 'flatVI'])).toEqual(['C', 'G', 'Abmaj7', 'F', 'Fm6']);
    expect(symbols('ii7 V7 | Imaj7', ['backdoor'])).toEqual(['Fm7', 'Bb7', 'Cmaj7']);
  });

  it('inserts related ii and diminished passing chords', () => {
    expect(symbols('C7 | F7', ['relatedII'])).toEqual(['Gm7', 'C7', 'Cm7', 'F7']);
    expect(symbols('Cmaj7 | Dm7', ['dimPassing'])).toEqual(['Cmaj7', 'C#°7', 'Dm7']);
  });

  it('extends by function', () => {
    expect(symbols('ii7 | V7 | Imaj7 | iii7', ['extensions'])).toEqual(['Dm9', 'G13', 'Cmaj9', 'Em7']);
    expect(symbols('Dm7b5 | G7 | Cm7', ['extensions'])).toEqual(['Dø11', 'G7b9b13', 'Cm9']);
  });
});

describe('voicings', () => {
  it('builds rootless A for Dm9 as F A C E', () => {
    const [v] = voiceProgression(prog('Dm9'), 'rootless', { bassRoot: false });
    const names = v.notes.map((n) => n.name.replace(/\d/g, ''));
    expect(v.variant.startsWith('A') ? names : [...names.slice(2), ...names.slice(0, 2)]).toEqual(['F', 'A', 'C', 'E']);
  });

  it('voice-leads ii–V–I shells by step', () => {
    const vs = voiceProgression(prog('Dm7 G7 Cmaj7'), 'shell', { bassRoot: false });
    for (let i = 1; i < vs.length; i++) {
      const [a, b] = [upperNotes(vs[i - 1]), upperNotes(vs[i])];
      a.forEach((m, j) => expect(Math.abs(m - b[j])).toBeLessThanOrEqual(2));
    }
  });

  it('alternates rootless A/B through ii–V–I', () => {
    const vs = voiceProgression(prog('Dm9 G13 Cmaj9'), 'rootless', { bassRoot: false });
    expect(vs.map((v) => v.variant[0])).toEqual(['A', 'B', 'A']);
  });

  it('voices every preset in every style in all 12 keys', () => {
    for (const k of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      const key = parseNoteName(k)!;
      for (const p of PRESETS) {
        const chords = applyReharms(prog(p.text, key), key, new Set(['extensions', 'tritone', 'secDom'])).chords;
        for (const s of STYLES) {
          const vs = voiceProgression(chords, s.id, { bassRoot: true });
          expect(vs).toHaveLength(chords.length);
          vs.forEach((v) => expect(v.notes.length).toBeGreaterThan(1));
        }
      }
    }
  });
});
