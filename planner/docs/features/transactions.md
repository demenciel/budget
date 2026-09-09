# Manual transaction journal

## Where it lives

app/planner.tsx: RecordForm and Transactions; lib/domain.ts: validateRecord; lib/service.ts: save/delete/pay

## Using it

Add amount, date, owner, category, description and optional note. Shared expenses also record the full amount, split and payer. The journal shows full amount, your portion and who paid. Search description/notes within the selected month and scope. Linked bill payments are edited by deleting and re-recording; ordinary transactions can be edited directly.

## Data and behavior

Inputs are decimal strings converted exactly to integer cents. Actual payments cannot be future-dated; use a planned purchase instead. Private owner and payer derive from the current member. Type and scope are immutable after creation. No bank/import route exists.

## Safe changes and boundaries

Deleting a linked transaction reopens that bill occurrence. Deleting a schedule detaches actuals and preserves payment history. A manual unlinked transaction does not automatically settle a recurring bill: use Record payment for that occurrence to avoid double-counting. Refund/credit modeling is a future addition; negative amounts are not accepted.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
