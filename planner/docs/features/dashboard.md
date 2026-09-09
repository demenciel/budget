# Monthly overview

## Where it lives

app/planner.tsx: Overview; lib/domain.ts: reimbursement/events/forecast

## Using it

My overview shows private spending plus allocated shared portions; Shared shows full shared amounts; Mine shows private records only. Summary cards include month spending/planned amount, next private payday, and upcoming commitments. Timeline items, reminders and a monthly reflection link keep the next action close.

## Data and behavior

Upcoming cards use today and the chosen timeline horizon independently of the selected historical spending month. Budget progress caps the visual bar at 100% but displays the actual negative remaining amount when over budget. Reimbursement balance spans all recorded shared transactions and settlements.

## Safe changes and boundaries

Cash warnings compare listed income/commitments and name the largest drivers. They do not imply missing income is zero in the real world. Empty states invite entry, never fabricate balances. Sample data is opt-in and identified with a banner. Add new dashboard aggregates only from authorized records.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
