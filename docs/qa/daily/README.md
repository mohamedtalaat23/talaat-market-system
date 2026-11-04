# Daily workflow visual evidence — November 4, 2026

All names and transactions in these images are synthetic. The real-service journeys use an isolated loopback PostgreSQL test database. No business database was accessed.

Each reference has English (`en-`) and Arabic (`ar-`) versions at 1366×768 and 1920×1080. Finite animations are disabled during capture so screenshots show the finished layout.

| Image prefix | Evidence |
| --- | --- |
| `checkout-` | Existing checkout reference screen |
| `populated-cart` | Cart controls and payable amount before payment, after quantity/discount and suspend/resume |
| `approved-discount` | Receipt for a quantity change, suspended/resumed cart and manager-approved discount |
| `discounted-refund` | Net partial refund after an approved discount |
| `refund` | Returned-item receipt; the same test separately verifies a damaged write-off |
| `receiving` | Purchase created through the UI, partially received with a lost-response retry, then fully received |
| `customer-ledger` | Credit sale, idempotent lost-response partial-payment retry, then a separate payment of the same amount |
| `handover` | Next cashier opens their own shift after drawer adjustment and closure |
| `owner` | Saved setup, real backup history and safe diagnostics with external internet blocked |
| `reconciliation` | Manager review of approved/rejected entries and rejected-sale reconciliation |
| `layout-` | Controlled mocked loading/error/layout references from the existing polish suite |

Browser traces from failed exploratory runs remain in the ignored `packages/client/test-results` directory until a later run replaces them. Reproduction commands and release limits are in [the daily review report](../../DAILY_WORKFLOW_REVIEW.md). These images do not certify Windows, printers, scanners, cash drawers or fiscal compliance.
