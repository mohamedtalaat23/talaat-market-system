import { allocateAcrossComponents, fromCents, multiplyCents, sumCents, toCents } from '../money';

/**
 * Money must never drift. These tests pin the integer-cent conversion rules and
 * the proportional allocator that is used for split-tender refunds.
 */
describe('money utilities', () => {
  describe('toCents', () => {
    it('converts two-decimal amounts exactly', () => {
      expect(toCents(0.1)).toBe(10);
      expect(toCents(0.2)).toBe(20);
      expect(toCents(19.99)).toBe(1999);
      expect(toCents('1234.56')).toBe(123456);
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
    });

    it('avoids the classic floating point sum error', () => {
      expect(sumCents([toCents(0.1), toCents(0.2)])).toBe(30);
      expect(fromCents(30)).toBe(0.3);
    });

    it('rounds half-to-even instead of always up', () => {
      // 12.5 cents -> 12, 13.5 cents -> 14
      expect(toCents(0.125)).toBe(12);
      expect(toCents(0.135)).toBe(14);
      expect(toCents(2.675)).toBe(268);
    });

    it('fails closed on non-numeric input', () => {
      expect(() => toCents('not-a-number')).toThrow(/Invalid monetary value/);
      expect(() => toCents(Number.NaN)).toThrow(/Invalid monetary value/);
      expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(/Invalid monetary value/);
    });
  });

  describe('fromCents', () => {
    it('rejects fractional cents', () => {
      expect(() => fromCents(10.5)).toThrow(/integer/);
    });
  });

  describe('multiplyCents', () => {
    it('multiplies quantities into whole cents', () => {
      expect(multiplyCents(1999, 3)).toBe(5997);
      expect(multiplyCents(100, 0.25)).toBe(25);
    });

    it('rounds halves to even', () => {
      expect(multiplyCents(5, 0.5)).toBe(2);
      expect(multiplyCents(7, 0.5)).toBe(4);
    });
  });

  describe('allocateAcrossComponents', () => {
    it('allocates proportionally and conserves every cent', () => {
      expect(allocateAcrossComponents([500, 1500], 0, 667)).toEqual([167, 500]);
      expect(sumCents(allocateAcrossComponents([500, 1500], 0, 667))).toBe(667);
    });

    it('keeps the full refund exactly equal to the original tenders', () => {
      const [cash, card] = allocateAcrossComponents([500, 1500], 0, 2000);
      expect(cash).toBe(500);
      expect(card).toBe(1500);
    });

    it('never loses a cent across many sequential partial refunds', () => {
      const components = [333, 667, 1000];
      let previous = 0;
      for (const step of [1, 7, 13, 199, 780, 1000, 2000]) {
        const allocation = allocateAcrossComponents(components, previous, step);
        expect(sumCents(allocation)).toBe(step - previous);
        expect(allocation.every((value) => value >= 0)).toBe(true);
        previous = step;
      }
    });

    it('handles single-cent components without inventing money', () => {
      const allocation = allocateAcrossComponents([1, 1, 1], 0, 1);
      expect(sumCents(allocation)).toBe(1);
      expect(allocation.every((value) => value >= 0)).toBe(true);
    });

    it('returns zeros when there is nothing to allocate', () => {
      expect(allocateAcrossComponents([0, 0], 0, 100)).toEqual([0, 0]);
    });
  });
});
