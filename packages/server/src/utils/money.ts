import { bankersRound } from './currency';

/**
 * Monetary arithmetic helpers.
 *
 * Accounting rules (see docs/ACCOUNTING_RULES.md):
 *   1. Every persisted monetary column is `NUMERIC(12,2)` — exactly two
 *      decimals. Anything finer than a cent does not exist in this system.
 *   2. All intermediate arithmetic is done in **integer minor units (cents)**.
 *      Binary floating point is never used to accumulate money
 *      (`0.1 + 0.2 !== 0.3`), which is what produced penny drift in invoices
 *      and shift reconciliations.
 *   3. Converting a decimal amount to cents rounds half-to-even
 *      (`bankersRound`) so repeated conversions do not bias totals upwards.
 *   4. Conversions fail closed: `NaN`, `Infinity` and non-numeric strings throw
 *      instead of silently becoming 0.
 */

export class MoneyError extends Error {
  public code = 'INVALID_MONEY_VALUE';

  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Number of minor units in one major unit (this system has two decimals). */
export const CENTS_PER_UNIT = 100;

/**
 * Converts a decimal amount (number or numeric string, as returned by
 * PostgreSQL for `NUMERIC` columns) into integer cents.
 */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;

  const numeric = typeof value === 'string' ? Number(value.trim()) : value;

  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    throw new MoneyError(`Invalid monetary value: ${String(value)}`);
  }

  const rounded = bankersRound(numeric, 2);

  // `Math.round` on an already-rounded 2-decimal value cannot drift, but use
  // the sign-aware form to keep -0 out of stored values.
  const cents = Math.round(rounded * CENTS_PER_UNIT);
  return cents === 0 ? 0 : cents;
}

/** Converts integer cents back into the decimal amount stored in the database. */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new MoneyError(`Cents must be an integer, received ${cents}`);
  }
  return cents / CENTS_PER_UNIT;
}

/** Sums cents without introducing floating point error. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `unitCents * quantity` with half-to-even rounding to whole cents. */
export function multiplyCents(unitCents: number, quantity: number): number {
  if (!Number.isFinite(quantity)) {
    throw new MoneyError(`Invalid quantity: ${quantity}`);
  }
  return bankersRound(unitCents * quantity, 0);
}

/**
 * Allocates a change in a total amount across components proportionally,
 * without ever losing or inventing a cent.
 *
 * Used for refunds: a sale paid 5.00 cash + 15.00 card must return exactly
 * 5.00/15.00 when fully refunded, and the intermediate partial refunds must
 * always add up to the refunded amount exactly.
 *
 * The allocation is computed on *cumulative* shares, so the sum of the returned
 * deltas is guaranteed to equal `nextTotalCents - previousTotalCents`.
 */
export function allocateAcrossComponents(
  componentsCents: readonly number[],
  previousTotalCents: number,
  nextTotalCents: number,
): number[] {
  const grandTotal = sumCents(componentsCents);

  if (grandTotal <= 0) return componentsCents.map(() => 0);

  const share = (totalCents: number): number[] => {
    let cumulative = 0;
    let allocatedSoFar = 0;
    return componentsCents.map((component) => {
      cumulative += component;
      const allocated = bankersRound((totalCents * cumulative) / grandTotal, 0);
      const shareForComponent = allocated - allocatedSoFar;
      allocatedSoFar = allocated;
      return shareForComponent;
    });
  };

  const before = share(previousTotalCents);
  const after = share(nextTotalCents);
  const deltas = after.map((value, index) => value - (before[index] ?? 0));

  // Rounding can make a single component's delta negative in contrived splits;
  // move that cent onto the largest positive component so no refund line goes
  // backwards and the sum stays exact.
  let deficit = deltas.reduce((sum, delta) => (delta < 0 ? sum + delta : sum), 0);
  while (deficit < 0) {
    let largestIndex = -1;
    for (let i = 0; i < deltas.length; i += 1) {
      if (deltas[i]! > 0 && (largestIndex === -1 || deltas[i]! > deltas[largestIndex]!)) {
        largestIndex = i;
      }
    }
    if (largestIndex === -1) break;

    for (let i = 0; i < deltas.length && deficit < 0; i += 1) {
      if (deltas[i]! < 0) {
        deltas[i] = deltas[i]! + 1;
        deltas[largestIndex] = deltas[largestIndex]! - 1;
        deficit += 1;
      }
    }
  }

  const expected = nextTotalCents - previousTotalCents;
  const actual = sumCents(deltas);
  if (actual !== expected) {
    throw new MoneyError(
      `Proportional allocation did not conserve value (expected ${expected}, got ${actual})`,
    );
  }

  return deltas;
}
