import { KEYS, PRESETS, nextKeyFourths } from '../theory/progressions';

interface Props {
  presetId: string;
  text: string;
  textKey: string;
  keyName: string;
  errors: string[];
  onPreset: (id: string) => void;
  onText: (text: string) => void;
  onKey: (key: string) => void;
}

export function ProgressionEditor({ presetId, text, textKey, keyName, errors, onPreset, onText, onKey }: Props) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const hasSymbols = /(^|\s|\|)[A-G]/.test(text);
  return (
    <section className="panel">
      <h2>Progression</h2>
      <label className="field">
        <span>Preset</span>
        <select value={presetId} onChange={(e) => onPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>
      {preset && <p className="hint">{preset.about}</p>}
      <label className="field">
        <span>Chords</span>
        <textarea
          rows={3}
          value={text}
          spellCheck={false}
          onChange={(e) => onText(e.target.value)}
          placeholder="ii7 | V7 | Imaj7   or   Dm9 G13 | Cmaj9"
        />
      </label>
      <p className="hint">
        Chord symbols (Dm9, G7alt, F/A) or Roman numerals (ii7, bVImaj7, V7/vi). "|" separates bars.
        {hasSymbols && textKey !== keyName && ` Typed in ${textKey}, shown in ${keyName}.`}
      </p>
      {errors.length > 0 && <p className="error">Couldn't read: {errors.join(', ')}</p>}
      <div className="field">
        <span>Key</span>
        <div className="keys">
          {KEYS.map((k) => (
            <button key={k} className={k === keyName ? 'on' : ''} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button onClick={() => onKey(nextKeyFourths(keyName))}>Next key (4ths) →</button>
        <button onClick={() => onKey(KEYS.filter((k) => k !== keyName)[Math.floor(Math.random() * 11)])}>Random key</button>
      </div>
    </section>
  );
}
