import { bankersRound } from '../utils/currency';
import { allocateAcrossComponents, fromCents, multiplyCents, sumCents, toCents } from '../utils/money';

/**
 * Pure sale/refund arithmetic.
 *
 * Everything in this module works in **integer cents** and returns cents, so the
 * repository layer only converts at the persistence boundary. Splitting the math
 * out keeps it unit-testable without a database and makes the accounting rules
 * explicit:
 *
 *   line_subtotal   = round(unit_price * quantity)
 *   line_total      = line_subtotal - line_discount            (must be >= 0)
 *   subtotal        = Σ line_subtotal
 *   discount_total  = Σ line_discount + global_discount
 *   total           = subtotal - discount_total + tax          (tax is 0 today)
 *   cash_paid       = cash tendered - change
 *   card_paid       = card tendered                             (never > total)
 *   debt_paid       = total                                     (credit sale)
 *   cash_paid + card_paid + debt_paid == total                 (always)
 *   change          = max(0, tendered - total), paid out of the cash tendered
 *
 * Refunds are allocated against the *remaining* refundable amount and always
 * satisfy `already_refunded + refund <= sale_total` exactly (no epsilon).
 */

export class SaleMathError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SaleMathError';
    this.code = code;
  }
}

/** Discount share of the subtotal that requires manager authorization. */
export const DISCOUNT_APPROVAL_RATIO = 0.2;

export interface SaleLineRequest {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface ComputedSaleLine {
  product_id: number;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  lineSubtotalCents: number;
  lineTotalCents: number;
}

export interface SaleTotals {
  lines: ComputedSaleLine[];
  subtotalCents: number;
  lineDiscountCents: number;
  globalDiscountCents: number;
  taxCents: number;
  totalCents: number;
  /** `(line discounts + global discount) / subtotal`, 0 when subtotal is 0. */
  discountRatio: number;
  requiresDiscountApproval: boolean;
}

export interface ComputeSaleTotalsInput {
  items: readonly SaleLineRequest[];
  /** Global (cart-level) discount as a positive decimal amount. */
  globalDiscount?: number | undefined;
  taxCents?: number | undefined;
}


/**
 * Validates and totals a cart. Throws `SaleMathError` for anything that would
 * produce a nonsensical ledger entry (negative totals, discounts larger than the
 * amount they apply to, non-finite quantities).
 */
export function computeSaleTotals(input: ComputeSaleTotalsInput): SaleTotals {
  const globalDiscountCents = toCents(input.globalDiscount ?? 0);
  const taxCents = toCents(input.taxCents ?? 0);

  if (globalDiscountCents < 0) {
    throw new SaleMathError('NEGATIVE_DISCOUNT', 'Global discount cannot be negative.');
  }
  if (taxCents < 0) {
    throw new SaleMathError('NEGATIVE_TAX', 'Tax amount cannot be negative.');
  }

  const lines: ComputedSaleLine[] = input.items.map((item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new SaleMathError(
        'INVALID_QUANTITY',
        `Invalid quantity for product ${item.product_id}: ${item.quantity}`,
      );
    }

    const unitPriceCents = toCents(item.unit_price);
    const discountCents = toCents(item.discount);

    if (unitPriceCents < 0) {
      throw new SaleMathError(
        'NEGATIVE_PRICE',
        `Negative unit price for product ${item.product_id}`,
      );
    }
    if (discountCents < 0) {
      throw new SaleMathError(
        'NEGATIVE_DISCOUNT',
        `Negative line discount for product ${item.product_id}`,
      );
    }

    const lineSubtotalCents = multiplyCents(unitPriceCents, item.quantity);
    if (discountCents > lineSubtotalCents) {
      throw new SaleMathError(
        'LINE_DISCOUNT_EXCEEDS_LINE',
        `Discount on product ${item.product_id} exceeds the line subtotal.`,
      );
    }

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unitPriceCents,
      discountCents,
      lineSubtotalCents,
      lineTotalCents: lineSubtotalCents - discountCents,
    };
  });

  const subtotalCents = sumCents(lines.map((line) => line.lineSubtotalCents));
  const lineDiscountCents = sumCents(lines.map((line) => line.discountCents));

  if (globalDiscountCents > subtotalCents - lineDiscountCents) {
    throw new SaleMathError(
      'GLOBAL_DISCOUNT_EXCEEDS_SUBTOTAL',
      'Global discount exceeds the remaining payable amount.',
    );
  }

  const totalCents = subtotalCents - lineDiscountCents - globalDiscountCents + taxCents;

  if (totalCents < 0) {
    throw new SaleMathError('NEGATIVE_TOTAL', 'Sale total cannot be negative.');
  }

  const totalDiscountCents = lineDiscountCents + globalDiscountCents;
  const discountRatio = subtotalCents > 0 ? totalDiscountCents / subtotalCents : 0;

  return {
    lines,
    subtotalCents,
    lineDiscountCents,
    globalDiscountCents,
    taxCents,
    totalCents,
    discountRatio,
    requiresDiscountApproval: discountRatio > DISCOUNT_APPROVAL_RATIO,
  };
}

export type PaymentMethod = 'cash' | 'card' | 'split' | 'debt';

export interface TenderInput {
  method: PaymentMethod;
  totalCents: number;
  cashReceived?: number | undefined;
  cashAmount?: number | undefined;
  cardAmount?: number | undefined;
}

export interface TenderBreakdown {
  cashPaidCents: number;
  cardPaidCents: number;
  debtPaidCents: number;
  changeCents: number;
  /** Raw amounts as tendered by the customer (what the receipt shows). */
  cashTenderedCents: number | null;
  cardTenderedCents: number | null;
}

/**
 * Resolves tendered amounts into the amounts actually applied to the sale.
 *
 * Invariants:
 *   - `cashPaid + cardPaid + debtPaid === total` (never more, never less).
 *   - Change is only ever paid out of cash that was physically received.
 *   - A card tender is never allowed to exceed the amount due: card terminals
 *     cannot "give change", so such a request is rejected instead of being
 *     silently recorded as an overpayment.
 */
export function computeTenders(input: TenderInput): TenderBreakdown {
  const { totalCents } = input;

  if (totalCents < 0) {
    throw new SaleMathError('NEGATIVE_TOTAL', 'Sale total cannot be negative.');
  }

  const empty: TenderBreakdown = {
    cashPaidCents: 0,
    cardPaidCents: 0,
    debtPaidCents: 0,
    changeCents: 0,
    cashTenderedCents: null,
    cardTenderedCents: null,
  };

  const format = (cents: number) => fromCents(cents).toFixed(2);

  switch (input.method) {
    case 'cash': {
      const receivedCents = toCents(input.cashReceived ?? 0);
      if (receivedCents < 0) {
        throw new SaleMathError('NEGATIVE_TENDER', 'Cash received cannot be negative.');
      }
      if (receivedCents < totalCents) {
        throw new SaleMathError(
          'INSUFFICIENT_TENDER',
          `Insufficient cash received. Minimum required: ${format(totalCents)}`,
        );
      }
      return {
        ...empty,
        cashPaidCents: totalCents,
        changeCents: receivedCents - totalCents,
        cashTenderedCents: receivedCents,
      };
    }

    case 'card':
      return { ...empty, cardPaidCents: totalCents, cardTenderedCents: totalCents };

    case 'debt':
      return { ...empty, debtPaidCents: totalCents };

    case 'split': {
      const cashCents = toCents(input.cashAmount ?? 0);
      const cardCents = toCents(input.cardAmount ?? 0);

      if (cashCents < 0 || cardCents < 0) {
        throw new SaleMathError('NEGATIVE_TENDER', 'Split payment amounts cannot be negative.');
      }
      if (cashCents === 0 && cardCents === 0) {
        throw new SaleMathError('SPLIT_REQUIRES_AMOUNTS', 'Split payment requires an amount.');
      }
      if (cardCents > totalCents) {
        throw new SaleMathError(
          'CARD_EXCEEDS_TOTAL',
          `Card amount (${format(cardCents)}) cannot exceed the amount due (${format(totalCents)}). Card terminals cannot give change.`,
        );
      }

      const tenderedCents = cashCents + cardCents;
      if (tenderedCents < totalCents) {
        throw new SaleMathError(
          'INSUFFICIENT_TENDER',
          `Insufficient split payment amounts. Total provided: ${format(tenderedCents)}, required: ${format(totalCents)}`,
        );
      }

      const changeCents = Math.min(tenderedCents - totalCents, cashCents);
      const cashPaidCents = cashCents - changeCents;
      const cardPaidCents = cardCents;

      if (cashPaidCents + cardPaidCents !== totalCents) {
        throw new SaleMathError(
          'TENDER_MISMATCH',
          'Split payment does not reconcile with the sale total.',
        );
      }

      return {
        cashPaidCents,
        cardPaidCents,
        debtPaidCents: 0,
        changeCents,
        cashTenderedCents: cashCents,
        cardTenderedCents: cardCents,
      };
    }

    default:
      throw new SaleMathError('INVALID_PAYMENT_METHOD', 'Unknown payment method.');
  }
}

export interface RefundLineInput {
  lineTotalCents: number;
  saleQuantity: number;
  alreadyRefundedQuantity: number;
  refundQuantity: number;
}

/**
 * Refund value of `refundQuantity` units of a line, allocated on a cumulative
 * basis so that refunding a line in several steps returns exactly its total
 * (e.g. 10.00 over 3 units → 3.33 + 3.33 + 3.34, never 9.99).
 */
export function computeRefundLineAmount(input: RefundLineInput): number {
  const { lineTotalCents, saleQuantity, alreadyRefundedQuantity, refundQuantity } = input;

  if (saleQuantity <= 0) {
    throw new SaleMathError('INVALID_QUANTITY', 'Sale line has no quantity to refund.');
  }
  if (refundQuantity <= 0) {
    throw new SaleMathError('INVALID_QUANTITY', 'Refund quantity must be greater than zero.');
  }

  const newRefundedQuantity = alreadyRefundedQuantity + refundQuantity;
  if (newRefundedQuantity > saleQuantity + 1e-9) {
    throw new SaleMathError(
      'QUANTITY_EXCEEDS_REMAINING',
      `Cannot refund ${refundQuantity} of item. Only ${saleQuantity - alreadyRefundedQuantity} available.`,
    );
  }

  const share = (quantity: number) => bankersRound((lineTotalCents * quantity) / saleQuantity, 0);

  return share(newRefundedQuantity) - share(alreadyRefundedQuantity);
}

export interface RefundAllocationInput {
  saleTotalCents: number;
  cashPaidCents: number;
  cardPaidCents: number;
  debtPaidCents: number;
  alreadyRefundedCents: number;
  refundCents: number;
}

export interface RefundAllocation {
  cashCents: number;
  cardCents: number;
  debtCents: number;
}

/**
 * Splits a refund amount across the tenders used for the original sale,
 * proportionally and without losing cents. The three returned amounts always
 * sum to `refundCents`.
 */
export function allocateRefundTenders(input: RefundAllocationInput): RefundAllocation {
  const {
    saleTotalCents,
    cashPaidCents,
    cardPaidCents,
    debtPaidCents,
    alreadyRefundedCents,
    refundCents,
  } = input;

  if (refundCents < 0) {
    throw new SaleMathError('NEGATIVE_REFUND', 'Refund amount cannot be negative.');
  }

  const tenderTotal = cashPaidCents + cardPaidCents + debtPaidCents;
  if (tenderTotal !== saleTotalCents) {
    throw new SaleMathError(
      'TENDER_MISMATCH',
      `Recorded tenders (${fromCents(tenderTotal).toFixed(2)}) do not match the sale total (${fromCents(
        saleTotalCents,
      ).toFixed(2)}).`,
    );
  }

  const components = [cashPaidCents, cardPaidCents, debtPaidCents];
  const [cashCents = 0, cardCents = 0, debtCents = 0] = allocateAcrossComponents(
    components,
    alreadyRefundedCents,
    alreadyRefundedCents + refundCents,
  );

  return { cashCents, cardCents, debtCents };
}

export type RefundStatus = 'partially_refunded' | 'refunded';

/** Exact (integer) over-refund guard plus the resulting sale status. */
export function resolveRefundState(
  saleTotalCents: number,
  alreadyRefundedCents: number,
  refundCents: number,
): { refundedTotalCents: number; status: RefundStatus } {
  if (refundCents < 0) {
    throw new SaleMathError('NEGATIVE_REFUND', 'Refund amount cannot be negative.');
  }

  const refundedTotalCents = alreadyRefundedCents + refundCents;

  if (refundedTotalCents > saleTotalCents) {
    throw new SaleMathError(
      'REFUND_EXCEEDS_SALE',
      `Refund would exceed the original sale total (already refunded ${fromCents(
        alreadyRefundedCents,
      ).toFixed(2)}, new refund ${fromCents(refundCents).toFixed(2)}, sale total ${fromCents(
        saleTotalCents,
      ).toFixed(2)}).`,
    );
  }

  return {
    refundedTotalCents,
    status: refundedTotalCents === saleTotalCents ? 'refunded' : 'partially_refunded',
  };
}
