import { REHARMS, ReharmId } from '../theory/reharm';
import { STYLES, StyleId } from '../theory/voicings';

interface Props {
  style: StyleId;
  bassRoot: boolean;
  reharms: Set<ReharmId>;
  counts: Partial<Record<ReharmId, number>>;
  onStyle: (s: StyleId) => void;
  onBassRoot: (b: boolean) => void;
  onToggleReharm: (id: ReharmId) => void;
}

export function VoicingPanel({ style, bassRoot, reharms, counts, onStyle, onBassRoot, onToggleReharm }: Props) {
  const info = STYLES.find((s) => s.id === style)!;
  const ownsBass = style === 'shell' || style === 'ust' || style === 'neosoul';
  const groups = [...new Set(REHARMS.map((r) => r.group))];
  return (
    <>
      <section className="panel">
        <h2>Voicing</h2>
        <div className="styles">
          {STYLES.map((s) => (
            <button key={s.id} className={s.id === style ? 'on' : ''} onClick={() => onStyle(s.id)}>
              {s.name}
              <small>{s.hands}</small>
            </button>
          ))}
        </div>
        <p className="hint">{info.desc}</p>
        <label className={`check ${ownsBass ? 'disabled' : ''}`}>
          <input type="checkbox" checked={ownsBass || bassRoot} disabled={ownsBass} onChange={(e) => onBassRoot(e.target.checked)} />
          Root in the bass (LH)
        </label>
      </section>
      <section className="panel">
        <h2>Reharmonize</h2>
        {groups.map((g) => (
          <div key={g} className="group">
            <h3>{g}</h3>
            {REHARMS.filter((r) => r.group === g).map((r) => (
              <label key={r.id} className="check reharm" title={r.desc}>
                <input type="checkbox" checked={reharms.has(r.id)} onChange={() => onToggleReharm(r.id)} />
                <span>
                  {r.name}
                  {reharms.has(r.id) && <em className={counts[r.id] ? '' : 'none'}>{counts[r.id] ? ` ${counts[r.id]}×` : ' no match'}</em>}
                  <small>{r.desc}</small>
                </span>
              </label>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
