# Bills and subscriptions

## Where it lives

app/planner.tsx: Bills & plans; lib/domain.ts: dates/events; lib/service.ts: pay

## Using it

Create rent, water, electricity and Wi-Fi as shared bills with their individual splits. Add personal subscriptions as Mine. Frequencies are once, weekly, every two weeks, monthly, quarterly and yearly. Optional last date is inclusive. Pause a schedule through its status.

## Data and behavior

Monthly recurrence stays anchored to the original day: January 31 becomes February 28, then March 31. Yearly leap-day schedules recover February 29 in leap years. Record payment creates a transaction linked to schedule ID + occurrence date; a unique index prevents duplicates even under races. Payment date is independently entered, permitting early or late payment.

## Safe changes and boundaries

Changing a recurring schedule edits the source for future derived occurrences; it does not rewrite actual transactions. Amounts are expected full occurrence totals. For partial payments, the current release does not track installment completion; use separate planned installments. Twice-monthly and every-two-months schedules now have explicit frequency options; see [pay schedules](pay-schedules-and-income.md). Focused tests cover recurrence and occurrence uniqueness.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
