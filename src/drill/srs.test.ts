import { describe, expect, it } from 'vitest';
import { DAY, Deck, buildSession, cardId, newCard, review, suggestGrade } from './srs';

const now = 1_000 * DAY;

describe('spaced repetition', () => {
  it('suggests grades from timing', () => {
    expect(suggestGrade([1500, 1800], false)).toBe('easy');
    expect(suggestGrade([3000], false)).toBe('good');
    expect(suggestGrade([7000], false)).toBe('hard');
    expect(suggestGrade([1000], true)).toBe('again');
  });

  it('moves cards between boxes', () => {
    const c = newCard('shell', 'ii-V-I', 'C');
    const good = review(c, 'good', now);
    expect(good.box).toBe(1);
    expect(good.due).toBe(now + DAY);
    expect(review(review(good, 'easy', now), 'again', now).box).toBe(0);
  });

  it('starts with new cards in cycle-of-4ths order', () => {
    const s = buildSession({}, ['shell'], ['ii-V-I'], now, 4, 4);
    expect(s.map((c) => c.key)).toEqual(['C', 'F', 'Bb', 'Eb']);
  });

  it('puts due cards first, weakest first', () => {
    const deck: Deck = {};
    const add = (key: string, box: number, due: number) => {
      const c = { ...newCard('shell', 'ii-V-I', key), box, due, reps: 1 };
      deck[cardId(c)] = c;
    };
    add('C', 3, now - 1);
    add('F', 0, now - 1);
    add('Bb', 2, now + DAY);
    const s = buildSession(deck, ['shell'], ['ii-V-I'], now, 4, 1);
    expect(s.map((c) => c.key)).toEqual(['F', 'C', 'Eb', 'Bb']);
  });
});
