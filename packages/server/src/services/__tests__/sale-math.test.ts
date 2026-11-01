import {
  allocateRefundTenders,
  computeRefundLineAmount,
  computeSaleTotals,
  computeTenders,
  resolveRefundState,
} from '../sale-math';

/**
 * Accounting regression suite for the pure sale/refund math.
 *
 * Covers the cases that used to drift or overpay: decimal line totals, split
 * tenders, card amounts above the amount due, partial refunds that never sum
 * back to the line total, and refunds split across cash/card/debt.
 */
describe('sale-math', () => {
  describe('computeSaleTotals', () => {
    it('totals decimal prices without floating point drift', () => {
      const totals = computeSaleTotals({
        items: [
          { product_id: 1, quantity: 3, unit_price: 0.1, discount: 0 },
          { product_id: 2, quantity: 1, unit_price: 19.99, discount: 0 },
          { product_id: 3, quantity: 2, unit_price: 2.35, discount: 0.35 },
        ],
      });

      expect(totals.lines[0]?.lineSubtotalCents).toBe(30);
      expect(totals.subtotalCents).toBe(30 + 1999 + 470);
      expect(totals.lineDiscountCents).toBe(35);
      expect(totals.totalCents).toBe(30 + 1999 + 470 - 35);
    });

    it('applies cart-level discounts after line discounts', () => {
      const totals = computeSaleTotals({
        items: [{ product_id: 1, quantity: 1, unit_price: 100, discount: 10 }],
        globalDiscount: 5,
      });

      expect(totals.subtotalCents).toBe(10000);
      expect(totals.lineDiscountCents).toBe(1000);
      expect(totals.globalDiscountCents).toBe(500);
      expect(totals.totalCents).toBe(8500);
    });

    it('flags discounts above the manager approval threshold', () => {
      const below = computeSaleTotals({
        items: [{ product_id: 1, quantity: 1, unit_price: 100, discount: 20 }],
      });
      const above = computeSaleTotals({
        items: [{ product_id: 1, quantity: 1, unit_price: 100, discount: 20.01 }],
      });

      expect(below.requiresDiscountApproval).toBe(false);
      expect(above.requiresDiscountApproval).toBe(true);
    });

    it('rejects a discount larger than its own line', () => {
      expect(() =>
        computeSaleTotals({
          items: [{ product_id: 1, quantity: 1, unit_price: 5, discount: 5.01 }],
        }),
      ).toThrow(/exceeds the line subtotal/);
    });

    it('rejects a global discount larger than the payable amount', () => {
      expect(() =>
        computeSaleTotals({
          items: [{ product_id: 1, quantity: 1, unit_price: 5, discount: 0 }],
          globalDiscount: 5.01,
        }),
      ).toThrow(/Global discount exceeds/);
    });

    it('rejects negative discounts and non-positive quantities', () => {
      expect(() =>
        computeSaleTotals({
          items: [{ product_id: 1, quantity: 1, unit_price: 5, discount: 0 }],
          globalDiscount: -1,
        }),
      ).toThrow(/cannot be negative/);

      expect(() =>
        computeSaleTotals({ items: [{ product_id: 1, quantity: 0, unit_price: 5, discount: 0 }] }),
      ).toThrow(/Invalid quantity/);
    });
  });

  describe('computeTenders', () => {
    const format = (value: number) => (value / 100).toFixed(2);

    it('applies exact cash and returns the change', () => {
      const tender = computeTenders({ method: 'cash', totalCents: 1999, cashReceived: 20 });
      expect(tender.cashPaidCents).toBe(1999);
      expect(tender.changeCents).toBe(1);
      expect(format(tender.changeCents)).toBe('0.01');
    });

    it('rejects cash below the amount due', () => {
      expect(() =>
        computeTenders({ method: 'cash', totalCents: 1999, cashReceived: 19.98 }),
      ).toThrow(/Insufficient cash/);
    });

    it('records the full total for card and debt tenders', () => {
      expect(computeTenders({ method: 'card', totalCents: 500 }).cardPaidCents).toBe(500);
      expect(computeTenders({ method: 'debt', totalCents: 500 }).debtPaidCents).toBe(500);
    });

    it('splits cash and card without overpaying either tender', () => {
      const tender = computeTenders({
        method: 'split',
        totalCents: 2000,
        cashAmount: 5,
        cardAmount: 15,
      });

      expect(tender.cashPaidCents).toBe(500);
      expect(tender.cardPaidCents).toBe(1500);
      expect(tender.changeCents).toBe(0);
      expect(tender.cashPaidCents + tender.cardPaidCents).toBe(2000);
    });

    it('pays change out of cash when the split over-tenders in cash', () => {
      const tender = computeTenders({
        method: 'split',
        totalCents: 2000,
        cashAmount: 10,
        cardAmount: 15,
      });

      expect(tender.changeCents).toBe(500);
      expect(tender.cashPaidCents).toBe(500);
      expect(tender.cardPaidCents).toBe(1500);
      expect(tender.cashPaidCents + tender.cardPaidCents).toBe(2000);
    });

    it('rejects a card amount above the amount due (no card change)', () => {
      expect(() =>
        computeTenders({ method: 'split', totalCents: 2000, cashAmount: 0, cardAmount: 20.01 }),
      ).toThrow(/cannot exceed the amount due/);
    });

    it('rejects split tenders below the amount due', () => {
      expect(() =>
        computeTenders({ method: 'split', totalCents: 2000, cashAmount: 5, cardAmount: 14 }),
      ).toThrow(/Insufficient split payment/);
    });

    it('rejects an empty split', () => {
      expect(() =>
        computeTenders({ method: 'split', totalCents: 2000, cashAmount: 0, cardAmount: 0 }),
      ).toThrow(/requires an amount/);
    });
  });

  describe('refund math', () => {
    it('refunds a line in parts and still returns exactly the line total', () => {
      const first = computeRefundLineAmount({
        lineTotalCents: 1000,
        saleQuantity: 3,
        alreadyRefundedQuantity: 0,
        refundQuantity: 1,
      });
      const second = computeRefundLineAmount({
        lineTotalCents: 1000,
        saleQuantity: 3,
        alreadyRefundedQuantity: 1,
        refundQuantity: 1,
      });
      const third = computeRefundLineAmount({
        lineTotalCents: 1000,
        saleQuantity: 3,
        alreadyRefundedQuantity: 2,
        refundQuantity: 1,
      });

      expect(first).toBe(333);
      expect(second).toBe(334);
      expect(third).toBe(333);
      expect(first + second + third).toBe(1000);
    });

    it('rejects refunding more units than remain', () => {
      expect(() =>
        computeRefundLineAmount({
          lineTotalCents: 1000,
          saleQuantity: 2,
          alreadyRefundedQuantity: 1,
          refundQuantity: 2,
        }),
      ).toThrow(/Only 1 available/);
    });

    it('allocates a split-tender refund proportionally', () => {
      const allocation = allocateRefundTenders({
        saleTotalCents: 2000,
        cashPaidCents: 500,
        cardPaidCents: 1500,
        debtPaidCents: 0,
        alreadyRefundedCents: 0,
        refundCents: 667,
      });

      expect(allocation.cashCents + allocation.cardCents + allocation.debtCents).toBe(667);
      expect(allocation.cashCents).toBe(167);
      expect(allocation.cardCents).toBe(500);
    });

    it('reconciles the tenders to the cent when the whole sale is refunded in steps', () => {
      const sale = {
        saleTotalCents: 2000,
        cashPaidCents: 500,
        cardPaidCents: 1500,
        debtPaidCents: 0,
      };

      let refunded = 0;
      const cashTotal: number[] = [];
      const cardTotal: number[] = [];

      for (const step of [667, 667, 666]) {
        const allocation = allocateRefundTenders({
          ...sale,
          alreadyRefundedCents: refunded,
          refundCents: step,
        });
        cashTotal.push(allocation.cashCents);
        cardTotal.push(allocation.cardCents);
        refunded += step;
      }

      expect(refunded).toBe(2000);
      expect(cashTotal.reduce((a, b) => a + b, 0)).toBe(500);
      expect(cardTotal.reduce((a, b) => a + b, 0)).toBe(1500);
    });

    it('refuses to allocate against tenders that do not match the sale total', () => {
      expect(() =>
        allocateRefundTenders({
          saleTotalCents: 1000,
          cashPaidCents: 400,
          cardPaidCents: 500,
          debtPaidCents: 0,
          alreadyRefundedCents: 0,
          refundCents: 100,
        }),
      ).toThrow(/do not match the sale total/);
    });

    it('rejects over-refunds with an exact comparison (no epsilon)', () => {
      expect(resolveRefundState(1000, 500, 500)).toEqual({
        refundedTotalCents: 1000,
        status: 'refunded',
      });
      expect(() => resolveRefundState(1000, 900, 101)).toThrow(/exceed the original sale total/);
    });
  });
});

describe('refund tender history rounding regression', () => {
  it('never refunds a tender twice while exhausting a three-cent split', () => {
    const history: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const allocation = allocateRefundTenders({
        saleTotalCents: 3,
        cashPaidCents: 1,
        cardPaidCents: 1,
        debtPaidCents: 1,
        alreadyRefundedCents: i,
        refundCents: 1,
        refundedComponentsCents: history,
      });
      history[0] += allocation.cashCents;
      history[1] += allocation.cardCents;
      history[2] += allocation.debtCents;
      expect(history.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
    expect(history).toEqual([1, 1, 1]);
  });
});
