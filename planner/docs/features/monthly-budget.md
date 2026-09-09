# Monthly planning and reflection

## Where it lives

app/planner.tsx: Budget; lib/domain.ts: budgetRows; records kind budget

## Using it

Select a month, choose Mine or Shared, then use a category pencil to enter the plan and optional reflection. The table shows planned, actual and planned minus actual. My overview opens the private plan; Shared shows full shared totals. Each category can have a separate private plan for each person plus one shared plan.

## Data and behavior

Budget records are dated the first day of their month. Partial unique indexes prevent duplicate plans in one household/owner/category/month. Actuals are transactions in that month and exact ownership scope. Reimbursements do not count as spending. Positive differences mean remaining room; negative differences mean overspend.

## Safe changes and boundaries

Keep category IDs stable on rename. Plans do not create forecast commitments, preventing double-counting of bills already planned separately. Savings progress is not a transaction; record an actual savings outflow if it should count in monthly actuals. Tests cover scope isolation, duplicate plans and arithmetic.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
