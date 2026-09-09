# Development and verification

## Local tools

Use Node 24 and the committed npm lockfile. Run `npm ci`, `npm run db:migrate:local`, then `npm run dev`. The Cloudflare Vite plugin and Wrangler share `.wrangler/state/v3/d1`. The local migration config contains a deliberate placeholder ID; never use it for a remote migration. `npm run start` runs the already-built Worker locally.

The development Sites sign-in uses a simulated local identity. Production sign-in is dispatch-owned. Never add a request query parameter or body field that impersonates a member. Test two identities through the isolated service tests, or configure separate local development sessions using the Sites runtime's supported facilities.

## Focused tests

`npm test` uses Node's built-in test runner. Domain tests cover exact cents, complementary splits, impossible dates, month-end clamping, leap years, biweekly schedules, paused/end dates, ownership validation, reimbursement direction, occurrence matching, monthly category comparisons, cash shortfalls and ICS escaping/folding.

Service tests run the actual Drizzle SQL in Node SQLite with foreign keys on. They cover two identities, private debt at both API service and database boundaries, no private metadata leaks, ID guessing across members and households, shared edits, immutable ownership, invite rotation/expiry/reuse, household capacity, category link preservation, duplicate plan/payment constraints, calendar authorization, and demo seeding. Tests create no remote resources and use no real notebook data.

## Checks

- `npm run typecheck`: strict TypeScript for the project.
- `npm run lint`: authored app/lib/db/tests plus Vite config. Generated shadcn files retain upstream source and are outside the focused lint target.
- `npm run format`: format authored files. `npm run format:check`: verify without modifying.
- `npm run build`: production client/server Worker build.
- `npm run db:generate`: create a migration after schema changes. Inspect generated SQL before applying it.

Do not edit applied migrations or matching snapshots/journal entries. Append new migrations. Migrations contain schema, not seed data. Deployment applies migrations before publishing the worker; design forward-compatible changes.

## HTTP smoke checks and manual release checks

Check that anonymous notebook requests return 401, signed-in GETs return only the caller's notebook, requests without Origin/custom header are rejected, and `/` renders successfully. HTTP checks do not replace browser interaction testing.

Manual browser checks for a release: create/join household using distinct accounts; add a private debt; verify the other member cannot see it; create shared bill with 60/40 split; record payer and payment; export shared-only calendar; resize to a phone width; navigate forms by keyboard; verify error dialogs and no data loss on validation failure. Automated browser end-to-end coverage is not included in this version.

The optional page-scoped WebMCP `navigate_budget_notebook` tool only navigates. It validates the page against the same navigation list, feature-detects support, and unregisters on unmount. A supported WebMCP runtime was not available for contract testing; no WebMCP verification is claimed. It is not required to use the app.

## Changing the UI

Theme tokens and responsive rules live in `app/globals.css`. Desktop uses a notebook sidebar, mobile uses a horizontally scrollable navigation. Forms use Base UI-backed dialogs and selects; tables use the installed table primitive. Do not replace those with inaccessible custom popovers. Dialogs preserve form state on validation errors.

The UI is in one feature-oriented component module for the first release. Extract a feature into `app/components/` when its next change makes it independently complex, preserving service boundaries. The domain module has no framework or database imports and should remain independently testable.
