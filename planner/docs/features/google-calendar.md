# Google Calendar export and future live sync

## Where it lives

lib/domain.ts: icsExport; lib/service.ts: exportCalendar; app/api/notebook/route.ts

## Using it

Choose Shared events only (default), or explicitly choose My private + shared events, then export a .ics file. Google Calendar desktop Settings → Import & export accepts this snapshot. Choose a destination calendar with the appropriate privacy. The export includes the next year of authorized, unpaid events, their titles/dates and reminder alarms, not monetary amounts or notes.

## Data and behavior

The service first loads only authorized records, then serializes VEVENTs with stable UIDs, exclusive next-day DTEND, CLASS:PRIVATE, escaped text and UTF-8-safe line folding. Partner-private records are never selected, even for the private export. Re-import behavior is controlled by the receiving app; a snapshot does not remove or update old imported events reliably.

## Safe changes and boundaries

Standard Google Calendar API use is available at no additional cost, subject to quotas. Live sync is deferred because it needs a Google Cloud OAuth client and separate user consent. Add server-encrypted refresh tokens owned by a member, explicit destination calendar selection, shared-vs-private destination validation, and event mappings keyed by member/calendar/occurrence ID. Handle deletions, retries, revocation and token refresh without exposing private titles. Never put private debt on the shared calendar. Reference: https://developers.google.com/workspace/calendar/api/guides/quota

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
