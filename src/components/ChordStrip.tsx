import { Chord, chordSymbol } from '../theory/chords';
import { NoteName } from '../theory/notes';
import { romanLabel } from '../theory/progressions';
import { Voicing, noteMotion } from '../theory/voicings';

interface Props {
  chords: Chord[];
  voicings: Voicing[];
  tonic: NoteName;
  active: number | null;
  done?: Set<number>;
  hideNotes?: boolean;
  onSelect: (i: number) => void;
}

export function ChordStrip({ chords, voicings, tonic, active, done, hideNotes, onSelect }: Props) {
  return (
    <div className="strip">
      {chords.map((c, i) => {
        const v = voicings[i];
        const motion = v ? noteMotion(voicings[i - 1], v) : new Map();
        return (
          <button
            key={i}
            className={`card ${i === active ? 'active' : ''} ${done?.has(i) ? 'done' : ''} ${c.note ? 'changed' : ''}`}
            style={{ gridColumn: `span ${Math.max(3, Math.round(c.beats * 3))}` }}
            onClick={() => onSelect(i)}
            title={c.note}
          >
            <span className="roman">{romanLabel(c, tonic)}</span>
            <span className="symbol">{chordSymbol(c)}</span>
            {v && <span className="variant">{v.variant}</span>}
            {v && !hideNotes && (
              <span className="notes">
                {[...v.notes].reverse().map((n) => {
                  const mv = motion.get(n.midi);
                  return (
                    <span key={n.midi} className={`note ${n.hand === 'L' ? 'lh' : 'rh'}`}>
                      <b>{n.label}</b>
                      <span>{n.name}</span>
                      <i className={mv === 'common' ? 'common' : ''}>
                        {mv === undefined ? '' : mv === 'common' ? '●' : mv > 0 ? `+${mv}` : `${mv}`}
                      </i>
                    </span>
                  );
                })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
