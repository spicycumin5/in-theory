import { useState } from 'react';
import { ensureAudio, noteOff, noteOn } from './audio/player';
import { DailyDrill } from './components/DailyDrill';
import { EarTrainer } from './components/EarTrainer';
import { Lab } from './components/Lab';
import { useMidi } from './midi/useMidi';

type Tab = 'lab' | 'drill' | 'ear';

const TABS: { id: Tab; name: string }[] = [
  { id: 'lab', name: 'Progression Lab' },
  { id: 'drill', name: 'Daily Drill' },
  { id: 'ear', name: 'Ear Trainer' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('lab');
  const [monitor, setMonitor] = useState(false);
  const midi = useMidi((m, on) => {
    if (!monitor) return;
    if (on) noteOn(m);
    else noteOff(m);
  });

  return (
    <div className="app">
      <header>
        <h1>In Theory</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.name}
            </button>
          ))}
        </nav>
        <div className={`midi ${midi.status}`}>
          {midi.status === 'ready'
            ? midi.devices.length
              ? `MIDI: ${midi.devices.join(', ')}`
              : 'MIDI: no keyboard found. Plug one in.'
            : midi.status === 'unsupported'
              ? 'MIDI not supported in this browser (use Chrome or Edge)'
              : midi.status === 'denied'
                ? 'MIDI access denied'
                : 'Waiting for MIDI permission (check the browser prompt)…'}
          <label className="check">
            <input
              type="checkbox"
              checked={monitor}
              onChange={async (e) => {
                if (e.target.checked) await ensureAudio();
                setMonitor(e.target.checked);
              }}
            />
            Sound for my playing
          </label>
        </div>
      </header>

      <Lab midi={midi} visible={tab === 'lab'} />
      <DailyDrill midi={midi} visible={tab === 'drill'} />
      <EarTrainer visible={tab === 'ear'} />
    </div>
  );
}
