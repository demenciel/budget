# Savings goals

## Where it lives

records kind goal; app/planner.tsx: Savings goals; RecordForm

## Using it

Track a named private/shared goal with target amount/date, saved amount, priority and note. Update progress manually. Progress uses saved divided by target and is displayed with an accessible progress primitive.

## Data and behavior

Goal amount must be positive and saved amount cannot exceed the target. Target appears on the calendar but is not an expense in forecasting. Ownership uses the same server boundary as all other records.

## Safe changes and boundaries

Saved amount is a snapshot, not linked to deposits. Avoid counting both the target and actual savings contributions as commitments. If automated contribution tracking is added, introduce explicit contribution records and migrate snapshots with a clear effective date.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
