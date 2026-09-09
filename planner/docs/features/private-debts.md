# Private debt payments

## Where it lives

records kind debt; lib/domain.ts: validateRecord; db/schema.ts: record_private_debt_income

## Using it

Each person creates their own debt payment schedule with amount, payment dates, frequency and optional remaining balance. Debt is always Mine. It appears only in that person’s bills, calendar and forecast. The partner cannot infer it from shared totals or export.

## Data and behavior

Both input validation and SQL constraints reject shared debt records. Recording a payment produces a private transaction and clears one scheduled occurrence. The optional remaining balance is a manually maintained snapshot, not an amortization engine.

## Safe changes and boundaries

Do not automatically subtract all payments from the stored balance: interest and principal allocation are unknown. Add amortization only with an explicit model and tests. Explicit shared household borrowing is now tracked separately in [shared agreements](shared-agreements.md). It requires both members' consent and never exposes or modifies this private-debt record.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
