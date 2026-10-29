# In Theory

A browser tool for turning piano harmony knowledge into playing: voicings, voice leading, reharmonization and modal interchange, practiced on real progressions in all 12 keys.

- **Progression Lab**: pick or type a progression (chord symbols or Roman numerals), voice it in 8 styles (shells, rootless A/B, drop 2/3, quartal, upper-structure triads, neo-soul clusters) with automatic voice leading, apply reharmonizations (secondary dominants, tritone subs, minor iv, bVI, backdoor ii–V, …) and practice it on a MIDI keyboard.
- **Daily Drill**: spaced repetition over style × progression × key cards, graded from your MIDI timing (or self-graded).
- **Ear Trainer**: chord quality, function in key (incl. borrowed chords) and "what changed?" reharmonization recognition.

MIDI input uses the Web MIDI API (Chrome / Edge). Piano samples are the Salamander Grand via Tone.js.

## Development

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # theory engine, drill scheduler, ear trainer
npm run build
```
