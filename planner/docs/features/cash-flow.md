# Understandable twelve-month forecasting

## Where it lives

lib/domain.ts: forecast; app/planner.tsx: ForecastView; members opening_cents/opening_date

## Using it

Each person sets their own net pay schedule and a private available-cash snapshot. Their outlook combines private income/commitments with their share of shared expenses. Shared outlook compares full shared commitments with explicit shared funding plans, never either person’s private salary. A shared opening amount is a temporary scenario input, not persisted household cash.

## Data and behavior

Generate active occurrences after the opening date, remove paid occurrences, add actual transactions after the snapshot, and group movements into twelve calendar-month buckets starting with the current month. Show income, commitments, cumulative balance, minimum running balance, first negative date, and largest drivers. A later payday can restore a positive month end while a midmonth pressure point remains visible.

## Safe changes and boundaries

Savings goals, category budgets and reminders are not duplicate cash outflows. Expected funding is not treated as private income. Personal projection represents allocated responsibility; full-bill advances/reimbursement timing are not assumed. Unentered variable spending and interest are absent. Old snapshots carry activity into the current coming-year window; update them regularly for accuracy. Opening cash is defined before the selected day’s activity.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
