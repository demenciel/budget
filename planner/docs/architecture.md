# Architecture and first-release plan

The app is a household notebook for two adults. Money is stored as integer cents in one household currency. Dates are calendar dates (`YYYY-MM-DD`), not browser-local timestamps. Ownership is enforced on the server before data leaves storage.

## Data model

- **Households** contain a currency and two member slots. A one-use invitation connects the second account.
- **Members** associate an authenticated identity with a household and display name. Identity comes from the authentication provider, never a request body.
- **Categories** belong to a household and can be renamed without changing historical record links.
- **Financial records** are transactions, bills, subscriptions, debts, purchases, savings goals, pay schedules, reminders, or budget reviews. Every record has a household and either a private owner or shared scope. Debts and income schedules require a private owner.
- **Shared allocations** store the first member's percentage in basis points; the second receives the remainder. The payer is independent of the split. Rounding assigns the remaining cent to the second member so allocations always add up.
- **Monthly budgets** store planned category amounts and optional reflection notes with the same ownership rules.
- **Payment occurrences** connect an actual transaction to a recurring commitment and date to prevent counting a paid occurrence twice.
- **Calendar events** are derived from the same commitments, with stable occurrence IDs. Exports apply the same authorization filter as the UI.

## Permissions

The September 9 extension adds `joint_entries` for shared deposits/card clears/agreed repayments and `agreements` for immutable two-person borrowing/income-allocation consent. Neither table references a private debt or exposes its balance. Household cycle/opening settings are shared; member pay reserves and allowances stay private. See [Household rhythm](features/household-rhythm.md).

Members read their own records and shared records in their household. Shared records are editable by either member; a member cannot create or transfer private records to their partner. Neither aggregates, calendar exports, nor forecasts include the partner's private records. Household forecasts therefore describe shared commitments rather than making claims about combined private income or debt.

## Delivery sequence

1. Establish React UI, database, and authenticated membership.
2. Implement ownership validation and reusable money/recurrence calculations.
3. Build dashboard, transactions, monthly budgets, commitments, goals, calendar, and forecasting.
4. Provide manual payment recording and reimbursement visibility.
5. Add a Google Calendar-compatible ICS export and document a future OAuth adapter.
6. Verify authorization, date boundaries, recurrence, rounding, and forecast behavior; provide feature guides and deployment instructions.

## First-release boundaries

Manual entry only. No bank calls, CSV imports, automatic payments, or background notifications. Reminders appear in the application and can be exported to a calendar. Exported calendar files are snapshots, not a live sync. Automatic Google Calendar sync requires a separately configured Google OAuth application and explicit per-person consent.
