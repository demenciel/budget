# Planned purchases

## Where it lives

records kind purchase; app/planner.tsx: Bills & plans; lib/domain.ts: forecast

## Using it

Create a purchase with expected amount, target date, ownership and low/medium/high priority. Known baby purchases can be Mine in Alexandre’s notebook. Shared purchases use the same split rules as shared bills.

## Data and behavior

A purchase is a one-time commitment, visible in the calendar and forecast until paid or paused/completed. Record payment converts the planned occurrence to a linked actual transaction; forecast includes the actual once. Priority is a planning label and does not automatically defer spending.

## Safe changes and boundaries

Changing the target date moves future calendar/forecast placement. Do not treat a savings goal as a purchase or count both as separate outflows for the same money. Tests for generic recurrence/payment handling also exercise one-time commitments.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
