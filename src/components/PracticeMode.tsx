import { useCallback, useEffect, useRef, useState } from 'react';
import { Chord, chordSymbol } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { Voicing } from '../theory/voicings';

export type MatchMode = 'exact' | 'shape' | 'pitch';

const LOG_KEY = 'intheory.practiceLog';

export interface LogEntry {
  t: number;
  key: string;
  style: string;
  chord: string;
  variant: string;
  ms: number;
}

function appendLog(entry: LogEntry) {
  try {
    const log: LogEntry[] = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    log.push(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-5000)));
  } catch {
    // Storage unavailable; the session still works.
  }
}

function matches(held: Set<number>, target: Voicing, mode: MatchMode) {
  const want = target.notes.map((n) => n.midi);
  if (mode === 'exact') return held.size === want.length && want.every((m) => held.has(m));
  if (mode === 'shape') {
    // Same voicing, any octave.
    if (held.size !== want.length) return false;
    const h = [...held].sort((a, b) => a - b);
    const w = [...want].sort((a, b) => a - b);
    const d = h[0] - w[0];
    return d % 12 === 0 && h.every((m, i) => m - w[i] === d);
  }
  const a = new Set([...held].map(mod12));
  const b = new Set(want.map(mod12));
  return a.size === b.size && [...b].every((pc) => a.has(pc));
}

/** Step through the progression, advancing when the held MIDI notes match the target voicing. */
export function usePractice(
  voicings: Voicing[],
  chords: Chord[],
  held: Set<number>,
  ctx: { key: string; style: string; enabled?: boolean },
  initialMode: MatchMode = 'exact',
) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [matched, setMatched] = useState(false);
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [showTarget, setShowTarget] = useState(true);
  const startRef = useRef(0);
  const timerRef = useRef<number>();

  const start = useCallback(() => {
    clearTimeout(timerRef.current);
    setActive(true);
    setIndex(0);
    setTimes([]);
    setMatched(false);
    startRef.current = performance.now();
  }, []);

  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    setActive(false);
  }, []);

  // A new key / style / progression restarts the run.
  useEffect(() => {
    if (active) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicings]);

  useEffect(() => {
    if (!active || matched || index >= voicings.length || ctx.enabled === false) return;
    if (!matches(held, voicings[index], mode)) return;
    const ms = performance.now() - startRef.current;
    setMatched(true);
    setTimes((t) => [...t, ms]);
    appendLog({ t: Date.now(), key: ctx.key, style: ctx.style, chord: chordSymbol(chords[index]), variant: voicings[index].variant, ms });
    timerRef.current = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setMatched(false);
      startRef.current = performance.now();
    }, 350);
  }, [held, active, matched, index, voicings, chords, mode, ctx.key, ctx.style, ctx.enabled]);

  return { active, index, times, matched, mode, setMode, showTarget, setShowTarget, start, stop, done: active && index >= voicings.length };
}

type Practice = ReturnType<typeof usePractice>;

interface Props {
  practice: Practice;
  chords: Chord[];
  voicings: Voicing[];
  midiReady: boolean;
  onPlayTarget: () => void;
  onNextKey: () => void;
  onRandomKey: () => void;
}

const sec = (ms: number) => (ms / 1000).toFixed(1) + 's';

export function PracticePanel({ practice: p, chords, voicings, midiReady, onPlayTarget, onNextKey, onRandomKey }: Props) {
  const settings = (
    <div className="row wrap">
      <label className="check">
        <input type="checkbox" checked={p.showTarget} onChange={(e) => p.setShowTarget(e.target.checked)} />
        Show target notes
      </label>
      <label className="check">
        <input type="checkbox" checked={p.mode === 'pitch'} onChange={(e) => p.setMode(e.target.checked ? 'pitch' : 'exact')} />
        Any octave / inversion
      </label>
    </div>
  );

  if (!p.active) {
    return (
      <section className="panel practice">
        <h2>Practice</h2>
        <p className="hint">
          Play each voicing on your MIDI keyboard. It turns green and moves on when you hit it. When you know it, turn targets off:
          you'll only see the formula (e.g. A: b3-5-b7-9) and have to find the notes yourself.
        </p>
        {settings}
        <button className="primary" disabled={!midiReady || !voicings.length} onClick={p.start}>
          Start practice
        </button>
        {!midiReady && <p className="hint">Connect a MIDI keyboard (Chrome or Edge) to practice.</p>}
      </section>
    );
  }

  if (p.done) {
    const total = p.times.reduce((s, x) => s + x, 0);
    const slowest = p.times.indexOf(Math.max(...p.times));
    return (
      <section className="panel practice">
        <h2>Done in {sec(total)}</h2>
        <ol className="times">
          {p.times.map((t, i) => (
            <li key={i} className={i === slowest ? 'slow' : ''}>
              {chordSymbol(chords[i])} <span>{sec(t)}</span>
            </li>
          ))}
        </ol>
        <p className="hint">Slowest: {chordSymbol(chords[slowest])}. Now take it to the next key.</p>
        <div className="row wrap">
          <button className="primary" onClick={onNextKey}>
            Next key (4ths) →
          </button>
          <button onClick={onRandomKey}>Random key</button>
          <button onClick={p.start}>Again</button>
          <button onClick={p.stop}>Stop</button>
        </div>
      </section>
    );
  }

  const v = voicings[p.index];
  return (
    <section className={`panel practice ${p.matched ? 'hit' : ''}`}>
      <h2>
        Chord {p.index + 1} / {voicings.length}: {chordSymbol(chords[p.index])}
      </h2>
      <p className="formula">{v.variant}</p>
      {!p.showTarget && <p className="hint">Notes from low to high: {v.notes.map((n) => n.label).join(' · ')}</p>}
      {settings}
      <div className="row wrap">
        <button onClick={onPlayTarget}>Hear it</button>
        <button onClick={p.start}>Restart</button>
        <button onClick={p.stop}>Stop</button>
      </div>
    </section>
  );
}
