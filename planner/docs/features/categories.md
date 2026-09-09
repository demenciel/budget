# Household categories

## Where it lives

lib/service.ts: category action; app/planner.tsx: SettingsView; categories table

## Using it

Default categories are Needs, Wants, Culture / learning, Unexpected, Savings, Debt, Household, Food, Baby, Transportation and Subscriptions. Either member can create or rename household categories in Settings.

## Data and behavior

Names are 1–60 characters and unique within a household. Records store category IDs, so historical entries display the renamed label without losing their links. Category names are shared metadata, not private fields.

## Safe changes and boundaries

Deletion/merging is intentionally unavailable so history is not silently reassigned. To add merging later, implement an explicit transaction that reassigns records and reconciles unique monthly budget rows; include both private owners without exposing their values in the response.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
