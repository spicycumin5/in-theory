import { describe, expect, it } from 'vitest';
import { FUNCTION_LEVELS, QUALITY_LEVELS, functionQuestion, qualityQuestion, reharmQuestion } from './questions';

describe('ear trainer questions', () => {
  it('generates valid questions of every kind', () => {
    for (let i = 0; i < 200; i++) {
      for (const level of Object.keys(QUALITY_LEVELS)) {
        const q = qualityQuestion(level);
        expect(q.options).toContain(q.answer);
        expect(q.main[0].midis.length).toBeGreaterThan(2);
      }
      for (const level of Object.keys(FUNCTION_LEVELS)) {
        const q = functionQuestion(level);
        expect(q.options).toContain(q.answer);
        expect(q.main).toHaveLength(6);
      }
      const r = reharmQuestion();
      expect(r.options).toContain(r.answer);
      expect(new Set(r.options).size).toBe(4);
      expect(r.alt!.map((s) => s.midis.join())).not.toEqual(r.main.map((s) => s.midis.join()));
    }
  });
});
