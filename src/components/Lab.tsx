import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureAudio, playChord, playSequence } from '../audio/player';
import { ChordStrip } from './ChordStrip';
import { KeyMark, Keyboard } from './Keyboard';
import { PracticePanel, usePractice } from './PracticeMode';
import { ProgressionEditor } from './ProgressionEditor';
import { VoicingPanel } from './VoicingPanel';
import { MidiState } from '../midi/useMidi';
import { chordSymbol } from '../theory/chords';
import { parseNoteName } from '../theory/notes';
import { KEYS, PRESETS, nextKeyFourths, parseProgressionText, romanLabel, transposeProgression } from '../theory/progressions';
import { ReharmId, applyReharms } from '../theory/reharm';
import { STYLES, StyleId, motionCost, noteMotion, upperNotes, voiceProgression } from '../theory/voicings';

const STEPS = [
  'Pick one progression and one voicing style. Play along with targets shown until your hands know the shapes.',
  'Watch the motion numbers: good voice leading means most voices hold (●) or move 1–2 semitones.',
  'Turn "Show target notes" off and play it from the formula alone.',
  'Take it through all 12 keys with "Next key (4ths)". Your slowest chord is what to drill.',
  'Add one reharmonization, listen to what it changes, then repeat steps 1–4.',
  'Use it in a real tune: find this progression in a song you know and play it there.',
];

export function Lab({ midi, visible }: { midi: MidiState; visible: boolean }) {
  const [key, setKey] = useState('C');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [text, setText] = useState(PRESETS[0].text);
  const [textKey, setTextKey] = useState('C');
  const [style, setStyle] = useState<StyleId>('shell');
  const [bassRoot, setBassRoot] = useState(true);
  const [reharms, setReharms] = useState<Set<ReharmId>>(new Set());
  const [bpm, setBpm] = useState(72);
  const [loop, setLoop] = useState(true);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const tonic = parseNoteName(key)!;
  const parsed = useMemo(() => {
    const from = parseNoteName(textKey)!;
    const r = parseProgressionText(text, from);
    return { errors: r.errors, chords: transposeProgression(r.chords, from, parseNoteName(key)!) };
  }, [text, textKey, key]);
  const reharmed = useMemo(() => applyReharms(parsed.chords, parseNoteName(key)!, reharms), [parsed, key, reharms]);
  const chords = reharmed.chords;
  const voicings = useMemo(() => voiceProgression(chords, style, { bassRoot }), [chords, style, bassRoot]);

  const practice = usePractice(voicings, chords, midi.held, { key, style, enabled: visible });

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };
  // Changing anything that alters the music stops playback.
  useEffect(stop, [voicings]);
  useEffect(() => {
    if (!visible) {
      stop();
      practice.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => {
    if (selected >= chords.length) setSelected(Math.max(0, chords.length - 1));
  }, [chords.length, selected]);

  const play = async () => {
    stop();
    await ensureAudio();
    stopRef.current = playSequence(
      voicings.map((v, i) => ({ midis: v.notes.map((n) => n.midi), beats: chords[i].beats })),
      bpm,
      loop,
      setPlaying,
    );
  };

  const playOne = async (i: number) => {
    await ensureAudio();
    const v = voicings[i];
    if (v) playChord(v.notes.map((n) => n.midi));
  };

  const select = (i: number) => {
    setSelected(i);
    if (playing === null) playOne(i);
  };

  const active = practice.active ? Math.min(practice.index, voicings.length - 1) : playing ?? selected;
  const v = voicings[active];
  const c = chords[active];
  const hideTarget = practice.active && !practice.showTarget;

  const marks = useMemo(() => {
    const map = new Map<number, KeyMark>();
    if (!v || hideTarget) return map;
    const motion = noteMotion(voicings[active - 1], v);
    v.notes.forEach((n) => map.set(n.midi, { label: n.label, hand: n.hand, common: motion.get(n.midi) === 'common' }));
    return map;
  }, [v, voicings, active, hideTarget]);

  const prevV = voicings[active - 1];
  const moved = v && prevV ? motionCost(upperNotes(prevV), upperNotes(v)) : null;
  const commons = v && prevV ? [...noteMotion(prevV, v).values()].filter((x) => x === 'common').length : 0;

  return (
    <div className="layout" hidden={!visible}>
      <aside>
        <ProgressionEditor
          presetId={presetId}
          text={text}
          textKey={textKey}
          keyName={key}
          errors={parsed.errors}
          onPreset={(id) => {
            setPresetId(id);
            const p = PRESETS.find((x) => x.id === id);
            if (p) {
              setText(p.text);
              setTextKey(key);
            }
          }}
          onText={(t) => {
            setText(t);
            setTextKey(key);
            setPresetId('custom');
          }}
          onKey={setKey}
        />
        <VoicingPanel
          style={style}
          bassRoot={bassRoot}
          reharms={reharms}
          counts={reharmed.counts}
          onStyle={setStyle}
          onBassRoot={setBassRoot}
          onToggleReharm={(id) =>
            setReharms((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
        />
      </aside>

      <main>
        <div className="transport">
          <button className="primary" onClick={() => (playing !== null ? stop() : play())}>
            {playing !== null ? '■ Stop' : '▶ Play'}
          </button>
          <label className="check">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Loop
          </label>
          <label className="tempo">
            {bpm} bpm
            <input type="range" min={40} max={180} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
          </label>
          <span className="keyinfo">
            Key of <b>{key}</b> · {STYLES.find((s) => s.id === style)!.name}
          </span>
        </div>

        <ChordStrip
          chords={chords}
          voicings={voicings}
          tonic={tonic}
          active={active}
          done={practice.active ? new Set(practice.times.map((_, i) => i)) : undefined}
          hideNotes={hideTarget}
          onSelect={select}
        />

        <Keyboard marks={marks} held={midi.held} judge={practice.active && practice.showTarget} onKey={(m) => ensureAudio().then(() => playChord([m], 1))} />
        <div className="legend">
          <span className="lh">Left hand</span>
          <span className="rh">Right hand</span>
          <span className="cm">● common tone (holds over)</span>
          <span className="ok">Played correctly</span>
          <span className="bad">Wrong note</span>
        </div>

        <div className="lower">
          {c && v && !hideTarget && (
            <section className="panel detail">
              <h2>
                {chordSymbol(c)} <span>{romanLabel(c, tonic)}</span>
              </h2>
              <p className="formula">{v.variant}</p>
              <p className="notelist">
                {v.notes.map((n) => (
                  <span key={n.midi} className={n.hand === 'L' ? 'lh' : 'rh'}>
                    <b>{n.label}</b> {n.name}
                  </span>
                ))}
              </p>
              {moved !== null && (
                <p className="hint">
                  From {chordSymbol(chords[active - 1])}: voices move {moved} semitone{moved === 1 ? '' : 's'} in total, {commons} common tone
                  {commons === 1 ? '' : 's'}.
                </p>
              )}
              {c.note && <p className="reharm-note">{c.note}</p>}
            </section>
          )}
          <PracticePanel
            practice={practice}
            chords={chords}
            voicings={voicings}
            midiReady={midi.status === 'ready' && midi.devices.length > 0}
            onPlayTarget={() => playOne(active)}
            onNextKey={() => setKey(nextKeyFourths(key))}
            onRandomKey={() => setKey(KEYS.filter((k) => k !== key)[Math.floor(Math.random() * 11)])}
          />
          <section className="panel steps">
            <h2>How to practice this</h2>
            <ol>
              {STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </div>
  );
}
