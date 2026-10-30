# Accounting rules

_Applies to the POS, refunds, customer accounts and shift reconciliation._

This system deals with money in two representations, and mixing them is how
ledgers drift. The rules below are the contract; the implementation lives in
`packages/server/src/utils/money.ts` (integer cents) and
`packages/server/src/services/sale-math.ts` (totals, tenders, refunds).

## 1. Representation

| Layer | Representation | Why |
| --- | --- | --- |
| PostgreSQL | `NUMERIC(12,2)` | exactly two decimals, no binary float |
| Application | integer **cents** (`number`) | `0.1 + 0.2 !== 0.3`; cents cannot drift |
| API / UI | decimal numbers or strings | display only |

* `toCents()` converts a decimal (number **or** the string PostgreSQL returns for
  `NUMERIC`) into integer cents using half-to-even rounding. It throws on `NaN`,
  `Infinity` and non-numeric strings — never silently becomes `0`.
* `fromCents()` converts back. It rejects fractional cents.
* Checkout, refund and payment safeguards use integer cents. Other existing reporting/purchasing calculations still require independent rounding review; this document is not proof of every server expression.

## 2. Sale totals

```
line_subtotal  = round_half_even(unit_price_cents × quantity)
line_total     = line_subtotal − line_discount_cents           (must be ≥ 0)
subtotal       = Σ line_subtotal
discount_total = Σ line_discount + global_discount             (each ≥ 0)
total          = subtotal − discount_total + tax               (tax = 0 today)
```

* A line discount may not exceed its own line subtotal.
* A global discount may not exceed `subtotal − line discounts`.
* If `discount_total / subtotal > 20%`, a **verified manager PIN** is required
  (`pinService.verifyPin` in the controller). A `manager_id` in the payload is not
  proof of anything.

## 3. Tenders

Exactly one of these identities must hold for every completed sale:

```
cash_paid + card_paid + debt_paid == total
change_given == max(0, tendered − total), paid out of the cash tendered
```

| Method | Rule |
| --- | --- |
| `cash` | `cash_received ≥ total`; change = `cash_received − total`; `cash_paid = total` |
| `card` | `card_paid = total` |
| `debt` | requires a customer; `debt_paid = total`; customer ledger gets `−total` |
| `split` | `card_amount ≤ total` (a card terminal cannot give change), `cash + card ≥ total`, change is capped at the cash tendered |

A card tender above the amount due is **rejected**, not recorded as an
overpayment. Cash over-tender is legitimate and produces change.

## 4. Refunds and voids

* Refund value of a line is allocated on a **cumulative** basis:
  `round(line_total × new_refunded_qty / qty) − round(line_total × already_refunded_qty / qty)`.
  Refunding a 10.00 line of three units in three steps returns exactly 10.00.
* `already_refunded + refund ≤ sale_total` is enforced with integer comparison —
  there is no epsilon and a sale is only `refunded` when the amounts are exactly
  equal.
* Each refund is split across the original tenders (`cash`, `card`, `debt`)
  proportionally with `allocateAcrossComponents`, which conserves every cent:
  the three shares always sum to the refund amount. The repository uses actual
  prior refund tender sums to cap the remaining amount of each tender, so
  refunding the whole sale in several steps returns exactly the original `cash_paid` / `card_paid` /
  `debt_paid`.
* Refunded cash is deducted from the shift's expected cash; reversed debt is
  credited back to the customer ledger inside the same transaction.

## 5. Shift reconciliation (`getShiftSummary`)

```
cash_sales = Σ sales.cash_paid + Σ cash customer payments − Σ refunds.cash_refunded
             + drawer pay-ins − drawer pay-outs
card_sales = Σ sales.card_paid + Σ card customer payments − Σ refunds.card_refunded
expected_cash = starting_cash + cash_sales
```

The summary is **derived from the ledgers**, not from the denormalised
`cashier_shifts.expected_cash` column, so a missed increment cannot silently
change the reconciliation. The column is still maintained for the live drawer
display.

## 6. Customer accounts

* A credit sale posts `customer_transactions.amount = −total` and decrements
  `customers.balance`; a payment posts a positive amount. A negative balance
  therefore means "customer owes".
* A payment must satisfy `0 < amount ≤ outstanding`, and the customer must
  actually owe money. Overpayments are rejected with `409 PAYMENT_EXCEEDS_BALANCE`
  and a zero-debt payment with `409 NO_OUTSTANDING_BALANCE`.
* Payments require an **open shift**; the ledger row carries `shift_id` and
  `payment_method`.
* Cash payments increment `cashier_shifts.expected_cash` inside the same
  transaction. Card payments do not (they settle through the acquirer) but they do
  appear in `card_sales` on the shift summary.
* Every payment accepts an `idempotency_key`; a retry returns the original
  payment (`duplicate: true`) instead of posting twice. A unique partial index on
  `(customer_id, idempotency_key)` also blocks the concurrent-duplicate race.

## 7. Offline sales

The server is authoritative for prices, even for sales captured offline:

1. Items are re-priced from the catalogue on sync.
2. Offline price **above** catalogue → repriced downwards (the customer is never
   overcharged) and audited (`offline_sync_price_reduced`).
3. Offline price **below** catalogue, or a discount above the 20% threshold →
   accepted only with a manager PIN verified by the server
   (`POST /pos/sync` with `manager_id`/`manager_pin`, or a manager resolving the
   quarantined sale). Without it the sale is **not posted**; it is parked in
   `offline_sync_quarantine` and reported back with
   `OFFLINE_PRICE_APPROVAL_REQUIRED` / `OFFLINE_DISCOUNT_APPROVAL_REQUIRED`.
4. Inventory is deducted on sync (offline replays may drive stock negative, since
   the goods physically left the store) and the underflow is visible in reports.

Operational consequence: cashiers can always complete an offline sale at the
catalogue price. Discounted offline sales need a manager to resolve them after
the connection returns.

## Commercial hardening additions

- Cart discounts are distributed over all receipt lines before calculating a
  partial refund. Duplicate line IDs in a refund are rejected.
- Refund API requests require an idempotency key. Migration 036 adds a unique
  `(sale_id, idempotency_key)` constraint; retries return the original refund.
- A return from a closed sale is paid through the operator's current **open**
  shift. Cash refunds reduce that drawer and do not rewrite the closed drawer's
  counted/expected snapshot. Shift summaries attribute refunds by payout shift.
- Shift close derives expected cash and records actual/expected/variance in the
  same locked transaction as its audit event. Repeated close is safe.
- Exact-balance customer payment retries check the existing ledger key **after**
  locking the customer, before testing outstanding balance.
