import { useEffect, useRef, useState } from 'react';

export type MidiStatus = 'connecting' | 'unsupported' | 'denied' | 'ready';

/** Tracks which keys are held on any connected MIDI keyboard (Web MIDI: Chrome / Edge). */
export function useMidi(onNote?: (midi: number, on: boolean) => void) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<MidiStatus>('connecting');
  const [devices, setDevices] = useState<string[]>([]);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }
    let access: MIDIAccess | null = null;
    const notes = new Set<number>();
    const onMessage = (e: MIDIMessageEvent) => {
      const d = e.data;
      if (!d || d.length < 3) return;
      const cmd = d[0] & 0xf0;
      const [note, vel] = [d[1], d[2]];
      if (cmd === 0x90 && vel > 0) notes.add(note);
      else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) notes.delete(note);
      else return;
      onNoteRef.current?.(note, notes.has(note));
      setHeld(new Set(notes));
    };
    const attach = () => {
      if (!access) return;
      const names: string[] = [];
      access.inputs.forEach((input) => {
        input.onmidimessage = onMessage;
        names.push(input.name ?? 'MIDI input');
      });
      setDevices(names);
    };
    navigator.requestMIDIAccess().then(
      (a) => {
        access = a;
        attach();
        a.onstatechange = attach;
        setStatus('ready');
      },
      () => setStatus('denied'),
    );
    return () => {
      access?.inputs.forEach((input) => (input.onmidimessage = null));
      if (access) access.onstatechange = null;
    };
  }, []);

  return { held, status, devices };
}

export type MidiState = ReturnType<typeof useMidi>;
