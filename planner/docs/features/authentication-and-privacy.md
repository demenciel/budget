# Authentication, household membership and privacy

## Where it lives

app/chatgpt-auth.ts; app/api/notebook/route.ts; lib/service.ts; db/schema.ts

## Using it

Each person signs in with a separate ChatGPT account. The first creates a household; the second joins using a one-use 256-bit random invitation. Codes expire after seven days and are stored only as SHA-256 hashes. Regenerating a code invalidates the old one. The second slot and authenticated identity each have unique constraints.

## Data and behavior

A record with owner_id NULL is shared; a non-null owner_id is private to that member. Reads and mutations always scope to household and current owner or shared. Private records cannot be transferred to a partner or made shared by editing. Debt/payday records also have SQL checks requiring a private owner. Partner metadata excludes opening balances. Sites viewer access and application membership are separate gates.

## Safe changes and boundaries

Extend the identity adapter only with server-verified identity. Never trust client IDs or raw headers outside Sites. Cover every new list, export and aggregate with cross-household and partner-private tests. Operator database access is outside member-level privacy; data is not end-to-end encrypted.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
