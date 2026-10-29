import { StyleId } from '../theory/voicings';

// A drill card is one voicing style applied to one short progression in one key.

export interface Cell {
  id: string;
  name: string;
  text: string;
}

export const CELLS: Cell[] = [
  { id: 'ii-V-I', name: 'Major ii–V–I', text: 'ii7 | V7 | Imaj7' },
  { id: 'minor', name: 'Minor ii–V–i', text: 'iiø7 | V7b9 | im7' },
  { id: 'turnaround', name: 'I–vi–ii–V', text: 'Imaj7 vi7 | ii7 V7' },
];

/** Keys in the order new cards are introduced: around the cycle of 4ths from C. */
export const FOURTHS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'F#', 'B', 'E', 'A', 'D', 'G'];

export interface Card {
  style: StyleId;
  cell: string;
  key: string;
  box: number;
  due: number;
  reps: number;
  lapses: number;
  lastMs?: number;
}

export type Deck = Record<string, Card>;
export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

export const DAY = 864e5;
/** Days until a card is due again, per box (Leitner-style). */
const INTERVALS = [0, 1, 2, 4, 7, 15, 30];
export const MAX_BOX = INTERVALS.length - 1;

export const cardId = (c: Pick<Card, 'style' | 'cell' | 'key'>) => `${c.style}|${c.cell}|${c.key}`;

export const newCard = (style: StyleId, cell: string, key: string): Card => ({ style, cell, key, box: 0, due: 0, reps: 0, lapses: 0 });

/** Grade from how long each chord took to find (ms). Peeking at the answer is always "again". */
export function suggestGrade(times: number[], revealed: boolean): Grade {
  if (revealed || !times.length) return 'again';
  const avg = times.reduce((s, x) => s + x, 0) / times.length;
  return avg < 2000 ? 'easy' : avg < 4000 ? 'good' : avg < 8000 ? 'hard' : 'again';
}

export function review(card: Card, grade: Grade, now: number, avgMs?: number): Card {
  const box =
    grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, card.box) : Math.min(MAX_BOX, card.box + (grade === 'good' ? 1 : 2));
  return {
    ...card,
    box,
    due: grade === 'again' ? now + 10 * 60e3 : now + INTERVALS[box] * DAY,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 'again' ? 1 : 0),
    lastMs: avgMs ?? card.lastMs,
  };
}

export function allCards(deck: Deck, styles: StyleId[], cells: string[]): Card[] {
  const out: Card[] = [];
  for (const key of FOURTHS)
    for (const style of styles)
      for (const cell of cells) out.push(deck[cardId({ style, cell, key })] ?? newCard(style, cell, key));
  return out;
}

/** Due cards first (weakest first), then a few new ones, then extra practice on the weakest seen cards. */
export function buildSession(deck: Deck, styles: StyleId[], cells: string[], now: number, size = 8, maxNew = 4): Card[] {
  const all = allCards(deck, styles, cells);
  const seen = all.filter((c) => c.reps > 0);
  const fresh = all.filter((c) => c.reps === 0);
  const out = seen
    .filter((c) => c.due <= now)
    .sort((a, b) => a.box - b.box || a.due - b.due)
    .slice(0, size);
  out.push(...fresh.slice(0, Math.min(maxNew, size - out.length)));
  const fill = (pool: Card[]) => out.push(...pool.filter((c) => !out.includes(c)).slice(0, size - out.length));
  fill([...seen].sort((a, b) => a.box - b.box || (b.lastMs ?? 0) - (a.lastMs ?? 0)));
  fill(fresh);
  return out;
}

const DECK_KEY = 'intheory.deck';

export function loadDeck(): Deck {
  try {
    return JSON.parse(localStorage.getItem(DECK_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveDeck(deck: Deck) {
  try {
    localStorage.setItem(DECK_KEY, JSON.stringify(deck));
  } catch {
    // Storage unavailable; progress lasts for this session only.
  }
}
