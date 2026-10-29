import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureAudio, playSequence } from '../audio/player';
import { CELLS, Card, Deck, FOURTHS, GRADES, Grade, MAX_BOX, allCards, buildSession, cardId, loadDeck, review, saveDeck, suggestGrade } from '../drill/srs';
import { MidiState } from '../midi/useMidi';
import { chordSymbol } from '../theory/chords';
import { parseNoteName } from '../theory/notes';
import { parseProgressionText } from '../theory/progressions';
import { STYLES, StyleId, voiceProgression } from '../theory/voicings';
import { ChordStrip } from './ChordStrip';
import { KeyMark, Keyboard } from './Keyboard';
import { usePractice } from './PracticeMode';

type Phase = 'setup' | 'run' | 'grade' | 'summary';

const GRADE_LABEL: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const styleName = (id: StyleId) => STYLES.find((s) => s.id === id)!.name;
const cellName = (id: string) => CELLS.find((c) => c.id === id)!.name;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);

function toggle<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

export function DailyDrill({ midi, visible }: { midi: MidiState; visible: boolean }) {
  const [deck, setDeck] = useState<Deck>(loadDeck);
  const [styles, setStyles] = useState<StyleId[]>(['shell', 'rootless']);
  const [cells, setCells] = useState<string[]>(['ii-V-I']);
  const [size, setSize] = useState(8);
  const [session, setSession] = useState<Card[]>([]);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ card: Card; grade: Grade; ms?: number }[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const card = session[pos] as Card | undefined;
  const chords = useMemo(
    () => (card ? parseProgressionText(CELLS.find((c) => c.id === card.cell)!.text, parseNoteName(card.key)!).chords : []),
    [card],
  );
  const voicings = useMemo(() => (card ? voiceProgression(chords, card.style, { bassRoot: false }) : []), [chords, card]);
  const midiReady = midi.status === 'ready' && midi.devices.length > 0;
  const practice = usePractice(
    voicings,
    chords,
    midi.held,
    { key: card?.key ?? '', style: card?.style ?? '', enabled: visible && phase === 'run' },
    'shape',
  );

  const stopAudio = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  useEffect(() => {
    if (phase === 'run' && midiReady) practice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pos, session, midiReady]);

  useEffect(() => {
    if (phase === 'run' && practice.done) setPhase('grade');
  }, [practice.done, phase]);

  useEffect(() => {
    if (!visible) stopAudio();
  }, [visible]);

  const now = Date.now();
  const pool = allCards(deck, styles, cells);
  const dueCount = pool.filter((c) => c.reps > 0 && c.due <= now).length;
  const newCount = pool.filter((c) => c.reps === 0).length;

  const startSession = () => {
    const s = buildSession(deck, styles, cells, Date.now(), size);
    setSession(s);
    setPos(0);
    setResults([]);
    setRevealed(false);
    setPhase('run');
  };

  const grade = (g: Grade) => {
    if (!card) return;
    stopAudio();
    const ms = practice.times.length === voicings.length ? avg(practice.times) : undefined;
    const next = { ...deck, [cardId(card)]: review(card, g, Date.now(), ms) };
    setDeck(next);
    saveDeck(next);
    setResults((r) => [...r, { card, grade: g, ms }]);
    practice.stop();
    setRevealed(false);
    if (pos + 1 < session.length) {
      setPos(pos + 1);
      setPhase('run');
    } else setPhase('summary');
  };

  const hear = async () => {
    stopAudio();
    await ensureAudio();
    stopRef.current = playSequence(
      voicings.map((v, i) => ({ midis: v.notes.map((n) => n.midi), beats: chords[i].beats })),
      80,
      false,
      () => {},
    );
  };

  const active = Math.min(practice.index, voicings.length - 1);
  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>();
    if (revealed && voicings[active]) voicings[active].notes.forEach((n) => m.set(n.midi, { label: n.label, hand: n.hand }));
    return m;
  }, [revealed, voicings, active]);

  if (phase === 'setup' || !card) {
    return (
      <div className="drill" hidden={!visible}>
        <section className="panel">
          <h2>Daily Drill</h2>
          <p className="hint">
            Short sessions of spaced repetition. Each card is one voicing style on one progression in one key. You see only the chord
            symbols and the formula and have to find the voicing yourself, in any octave. Fast, clean runs come back in days or weeks;
            slow ones or peeking bring the card back soon. New keys are introduced around the cycle of 4ths. Ten minutes a day beats two
            hours on Sunday.
          </p>
          <div className="drill-setup">
            <div>
              <h3>Voicing styles</h3>
              {STYLES.map((s) => (
                <label key={s.id} className="check">
                  <input type="checkbox" checked={styles.includes(s.id)} onChange={() => setStyles(toggle(styles, s.id))} />
                  {s.name}
                </label>
              ))}
            </div>
            <div>
              <h3>Progressions</h3>
              {CELLS.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={cells.includes(c.id)} onChange={() => setCells(toggle(cells, c.id))} />
                  {c.name}
                </label>
              ))}
              <h3>Session length</h3>
              <div className="row">
                {[5, 8, 12, 20].map((n) => (
                  <button key={n} className={n === size ? 'on' : ''} onClick={() => setSize(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="row wrap">
            <button className="primary" disabled={!styles.length || !cells.length} onClick={startSession}>
              Start session
            </button>
            <span className="hint">
              {dueCount} due · {newCount} new
              {!midiReady && ' · No MIDI keyboard: you will grade yourself.'}
            </span>
          </div>
        </section>
        <Mastery deck={deck} styles={styles} cells={cells} />
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="drill" hidden={!visible}>
        <section className="panel">
          <h2>Session done</h2>
          <ol className="times">
            {results.map((r, i) => (
              <li key={i} className={r.grade === 'again' ? 'slow' : ''}>
                {styleName(r.card.style)} · {cellName(r.card.cell)} in {r.card.key}
                <span>
                  {GRADE_LABEL[r.grade]}
                  {r.ms !== undefined && ` · ${(r.ms / 1000).toFixed(1)}s per chord`}
                </span>
              </li>
            ))}
          </ol>
          <div className="row wrap">
            <button className="primary" onClick={startSession}>
              Another session
            </button>
            <button onClick={() => setPhase('setup')}>Back</button>
          </div>
        </section>
        <Mastery deck={deck} styles={styles} cells={cells} />
      </div>
    );
  }

  const complete = practice.times.length === voicings.length;
  const suggested = phase === 'grade' && complete ? suggestGrade(practice.times, revealed) : null;
  const v = voicings[active];
  return (
    <div className="drill" hidden={!visible}>
      <div className="transport">
        <span className="keyinfo-left">
          Card {pos + 1} / {session.length} · <b>{cellName(card.cell)}</b> in <b>{card.key}</b> · {styleName(card.style)}
        </span>
        <span className="boxes" title="Memory box: higher means longer until it comes back">
          {Array.from({ length: MAX_BOX }, (_, i) => (
            <i key={i} className={i < card.box ? 'on' : ''} />
          ))}
        </span>
      </div>
      <ChordStrip
        chords={chords}
        voicings={voicings}
        tonic={parseNoteName(card.key)!}
        active={midiReady && phase === 'run' ? active : null}
        done={new Set(practice.times.map((_, i) => i))}
        hideNotes={!revealed}
        onSelect={() => {}}
      />
      <Keyboard marks={marks} held={midi.held} judge={revealed} />
      <section className={`panel practice ${practice.matched ? 'hit' : ''}`}>
        {phase === 'run' && midiReady && v && (
          <>
            <h2>Play {chordSymbol(chords[active])}</h2>
            <p className="formula">{v.variant}</p>
            <p className="hint">Low to high: {v.notes.map((n) => n.label).join(' · ')}. Any octave is fine.</p>
          </>
        )}
        {phase === 'run' && !midiReady && (
          <>
            <h2>Play it on your piano</h2>
            <p className="hint">Play the whole progression with these voicings, then grade yourself honestly.</p>
            <p className="formula">{voicings.map((x, i) => `${chordSymbol(chords[i])}: ${x.variant}`).join('   ')}</p>
          </>
        )}
        {phase === 'grade' && (
          <>
            <h2>{complete ? `${(avg(practice.times)! / 1000).toFixed(1)}s per chord${revealed ? ' (peeked)' : ''}` : 'Grade yourself'}</h2>
            {complete && <p className="hint">Suggested grade is highlighted. Override it if it felt different.</p>}
          </>
        )}
        <div className="row wrap">
          {!revealed && <button onClick={() => setRevealed(true)}>Show answer</button>}
          <button onClick={hear}>Hear it</button>
        </div>
        {(phase === 'grade' || !midiReady) && (
          <div className="row wrap grades">
            {GRADES.map((g) => (
              <button key={g} className={g === suggested ? 'primary' : ''} onClick={() => grade(g)}>
                {GRADE_LABEL[g]}
              </button>
            ))}
          </div>
        )}
        {phase === 'run' && midiReady && (
          <button className="link" onClick={() => setPhase('grade')}>
            Skip and grade myself
          </button>
        )}
      </section>
    </div>
  );
}

function Mastery({ deck, styles, cells }: { deck: Deck; styles: StyleId[]; cells: string[] }) {
  const now = Date.now();
  if (!styles.length || !cells.length) return null;
  return (
    <section className="panel">
      <h2>Mastery by key</h2>
      <p className="hint">Darker means longer retained. Outlined squares are due now.</p>
      <table className="mastery">
        <thead>
          <tr>
            <th />
            {FOURTHS.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {styles.flatMap((s) =>
            cells.map((c) => (
              <tr key={s + c}>
                <th>
                  {styleName(s)} <small>{cellName(c)}</small>
                </th>
                {FOURTHS.map((k) => {
                  const card = deck[cardId({ style: s, cell: c, key: k })];
                  const level = card ? card.box : -1;
                  const due = card && card.due <= now;
                  return (
                    <td key={k}>
                      <i
                        className={`m${level} ${due ? 'due' : ''}`}
                        title={
                          card
                            ? `Box ${card.box}, ${card.reps} reviews${card.lastMs ? `, ${(card.lastMs / 1000).toFixed(1)}s/chord` : ''}. Due ${new Date(card.due).toLocaleDateString()}`
                            : 'Not started'
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}
