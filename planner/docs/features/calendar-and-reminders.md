# Calendar, upcoming timeline and reminders

## Where it lives

lib/domain.ts: dates/events; app/planner.tsx: CalendarView and Overview

## Using it

The monthly grid includes paydays, bills, subscriptions, debt payments, purchases, goals, reviews and reminders. The timeline looks ahead 30, 60 or 90 days and retains unpaid payable occurrences up to 90 days overdue. Select an event to edit its source. Record payments through timeline check buttons.

## Data and behavior

Events derive from financial records; there is no second independent calendar table to drift out of sync. Stable occurrence ID is record ID + calendar date. Linked transactions mark occurrences paid. Each event carries the parent record’s ownership. remind_days drives dashboard lead-time reminders and ICS display alarms.

## Safe changes and boundaries

The calendar is date-only in America/Moncton for determining today; recurrence arithmetic uses UTC noon to avoid DST shifts. No browser notification permission, email/SMS, or background job is requested. Old unpaid schedules remain in Bills & plans even outside the timeline window.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
