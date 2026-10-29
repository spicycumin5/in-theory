import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureAudio, playArpeggio, playSequence } from '../audio/player';
import {
  EarMode,
  FUNCTION_LEVELS,
  QUALITY_LEVELS,
  Question,
  Step,
  functionQuestion,
  qualityQuestion,
  reharmQuestion,
} from '../ear/questions';
import { KeyMark, Keyboard } from './Keyboard';

const MODES: { id: EarMode; name: string; about: string }[] = [
  { id: 'quality', name: 'Chord quality', about: 'Hear one chord and name its quality. Listen for the 3rd (major/minor), then the 7th, then the color on top.' },
  {
    id: 'function',
    name: 'Function in key',
    about: 'A cadence (I–IV–V–I) sets the key, then one chord plays. Which degree is it? Borrowed chords (iv, bVI, bVII…) have a darker color.',
  },
  {
    id: 'reharm',
    name: 'What changed?',
    about: 'Hear a progression, then a reharmonized version. Which technique was used? This is how you start hearing these sounds in records.',
  },
];

interface Score {
  right: number;
  total: number;
  streak: number;
  best: number;
}
type Scores = Record<EarMode, Score>;

const SCORE_KEY = 'intheory.ear';
const empty = (): Score => ({ right: 0, total: 0, streak: 0, best: 0 });

function loadScores(): Scores {
  try {
    return { quality: empty(), function: empty(), reharm: empty(), ...JSON.parse(localStorage.getItem(SCORE_KEY) ?? '{}') };
  } catch {
    return { quality: empty(), function: empty(), reharm: empty() };
  }
}

export function EarTrainer({ visible }: { visible: boolean }) {
  const [mode, setMode] = useState<EarMode>('quality');
  const [qLevel, setQLevel] = useState('Sevenths');
  const [fLevel, setFLevel] = useState('Diatonic');
  const [q, setQ] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores>(loadScores);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  const play = async (s: Step[], bpm: number) => {
    stop();
    await ensureAudio();
    stopRef.current = playSequence(s, bpm, false, () => {});
  };

  const next = async (m = mode) => {
    const nq = m === 'quality' ? qualityQuestion(qLevel) : m === 'function' ? functionQuestion(fLevel) : reharmQuestion();
    setQ(nq);
    setChosen(null);
    await play(nq.main, nq.bpm);
  };

  useEffect(() => {
    stop();
    setQ(null);
    setChosen(null);
  }, [mode, qLevel, fLevel]);

  useEffect(() => {
    if (!visible) stop();
  }, [visible]);

  const answer = (opt: string) => {
    if (!q || chosen) return;
    setChosen(opt);
    const ok = opt === q.answer;
    setScores((all) => {
      const s = all[mode];
      const streak = ok ? s.streak + 1 : 0;
      const upd = { ...all, [mode]: { right: s.right + (ok ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) } };
      try {
        localStorage.setItem(SCORE_KEY, JSON.stringify(upd));
      } catch {
        // Storage unavailable; the score lasts for this session only.
      }
      return upd;
    });
  };

  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>();
    if (chosen && q?.show) q.show.notes.forEach((n) => m.set(n.midi, { label: n.label, hand: n.hand }));
    return m;
  }, [chosen, q]);

  const s = scores[mode];
  const info = MODES.find((m) => m.id === mode)!;
  const levels = mode === 'quality' ? QUALITY_LEVELS : mode === 'function' ? FUNCTION_LEVELS : null;
  const level = mode === 'quality' ? qLevel : fLevel;
  const setLevel = mode === 'quality' ? setQLevel : setFLevel;

  return (
    <div className="ear" hidden={!visible}>
      <section className="panel">
        <div className="row wrap">
          {MODES.map((m) => (
            <button key={m.id} className={m.id === mode ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.name}
            </button>
          ))}
          <span className="score">
            {s.right}/{s.total} correct{s.total ? ` (${Math.round((100 * s.right) / s.total)}%)` : ''} · streak {s.streak} · best {s.best}
          </span>
        </div>
        <p className="hint">{info.about}</p>
        {levels && (
          <div className="row wrap">
            {Object.keys(levels).map((l) => (
              <button key={l} className={l === level ? 'on' : ''} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel ear-q">
        {!q ? (
          <button className="primary big" onClick={() => next()}>
            ▶ Start
          </button>
        ) : (
          <>
            <div className="row wrap">
              {q.alt ? (
                <>
                  <button onClick={() => play(q.main, q.bpm)}>▶ Original</button>
                  <button onClick={() => play(q.alt!, q.bpm)}>▶ Reharmonized</button>
                </>
              ) : (
                <button onClick={() => play(q.main, q.bpm)}>▶ Play again</button>
              )}
              {mode === 'quality' && <button onClick={() => ensureAudio().then(() => playArpeggio(q.main[0].midis))}>Arpeggiate</button>}
              {mode === 'function' && (
                <button onClick={() => play(q.main.slice(-1), q.bpm)} title="Just the target chord">
                  Target only
                </button>
              )}
            </div>
            <div className="options">
              {q.options.map((o) => (
                <button
                  key={o}
                  className={chosen ? (o === q.answer ? 'right' : o === chosen ? 'wrong' : '') : ''}
                  onClick={() => answer(o)}
                >
                  {o}
                </button>
              ))}
            </div>
            {chosen && (
              <>
                <p className={`verdict ${chosen === q.answer ? 'ok' : 'bad'}`}>
                  {chosen === q.answer ? 'Correct!' : `It was ${q.answer}.`}
                </p>
                <p className="reharm-note">{q.explain}</p>
                <button className="primary" onClick={() => next()}>
                  Next →
                </button>
              </>
            )}
          </>
        )}
      </section>

      {q?.show && <Keyboard marks={marks} held={new Set()} judge={false} />}
    </div>
  );
}
