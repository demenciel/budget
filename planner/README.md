# Together — a household budget notebook

A calm, manual-entry, Kakeibo-inspired planner for Alexandre and Cheryl. React 19, TypeScript, accessible shadcn/Base UI components, Vinext/Vite, and Cloudflare D1 (SQLite). No VPS, bank connection, CSV importer, payment processor, or paid UI library is required.

## Start here

```sh
# Node 24 recommended; npm is the committed package manager.
npm ci
npm run db:migrate:local
npm run dev
```

Open the Local URL printed by the development server, normally `http://localhost:3000`. Sign in, create a household, then add your own financial information. Local development uses the Sites development identity, not a production account. Local SQLite lives under `.wrangler/state/v3/d1` and is ignored by Git. Do not use the development server as an internet-facing deployment.

The production build uses **separate ChatGPT logins**, with authentication handled by Sites and authorization handled by this application. No password is stored by Together. `app/chatgpt-auth.ts` is the isolated identity adapter.

### Getting both of you set up

1. Each person needs a separate ChatGPT account.
2. The first person creates a household and selects its currency (CAD by default).
3. In Settings, create a one-use invitation. Give the code directly to Cheryl.
4. Cheryl signs in as herself, chooses **Join with an invitation**, and enters the code. Do not create a second household first.
5. In the hosted Sites version, the site owner must also grant Cheryl **viewer access to the Site** through its sharing controls. A household invitation grants application membership; it does not bypass the host's access list. The initial deployment is owner-private.
6. Each person enters their own available balance/date and pay schedule. Opening cash is private. Use the balance **before** activity on the selected date.

The site starts empty. Settings offers optional **illustrative sample data** when the visible notebook is empty. It adds realistic example records to the database, including private example debt for the current user. A persistent banner identifies sample data. Remove examples individually before using the same household for real. Tests always use isolated in-memory databases and never touch your notebook.

## What is included

| Feature                 | Behavior                                                                                  | Developer guide                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Ownership and accounts  | Two-member household; private and shared records; hashed one-use invitations              | [Authentication and privacy](docs/features/authentication-and-privacy.md) |
| Monthly budgeting       | Category plans, actual spending, differences, optional monthly reflection                 | [Monthly budgets](docs/features/monthly-budget.md)                        |
| Categories              | Household categories can be created or renamed without breaking history                   | [Categories](docs/features/categories.md)                                 |
| Transactions            | Manual amount/date/category/merchant/note, custom split, payer, edit/delete               | [Transactions](docs/features/transactions.md)                             |
| Shared balances         | Exact-cent allocations and recorded reimbursement transfers                               | [Splits and reimbursements](docs/features/shared-balances.md)             |
| Bills and subscriptions | Once, weekly, biweekly, monthly, quarterly, yearly; inclusive end date; pause; payments   | [Bills](docs/features/bills-and-subscriptions.md)                         |
| Private debts           | Recurring payment dates and optional manually maintained balance                          | [Debts](docs/features/private-debts.md)                                   |
| Planned purchases       | Amount, ownership, target date, priority, actual payment                                  | [Purchases](docs/features/planned-purchases.md)                           |
| Savings                 | Personal/shared goals, target date, saved amount, priority                                | [Goals](docs/features/savings-goals.md)                                   |
| Calendar and reminders  | Monthly calendar, 30/60/90-day timeline, overdue items and lead-time reminders            | [Calendar](docs/features/calendar-and-reminders.md)                       |
| Google Calendar export  | Authorized .ics snapshot, shared-only by default, private export opt-in                   | [Google Calendar](docs/features/google-calendar.md)                       |
| Cash-flow outlook       | Twelve calendar-month buckets, own liabilities and shared funding, low points and drivers | [Forecasting](docs/features/cash-flow.md)                                 |
| Overview                | Spending, budget progress, next pay, due commitments, reimbursement balance, warnings     | [Dashboard](docs/features/dashboard.md)                                   |

## Your household arrangement

The current arrangement is implemented in **Household rhythm**. See [three-account workflow](docs/features/household-rhythm.md), [explicit shared agreements](docs/features/shared-agreements.md), and [pay schedules/lump sums](docs/features/pay-schedules-and-income.md).

Install Together on your phone using [the PWA installation guide](docs/features/pwa.md). It opens from your home screen and requires internet access for budgeting.

- Both salaries remain private. Each member can reserve fixed personal costs and a personal allowance per pay.
- Set Cheryl as the bill payer for mortgage/utilities paid from her account, and record the other member's actual transfers separately.
- Groceries, household spending, bigger shared subscriptions, baby needs and affordable treats now use a joint pot with a 14-day cycle and carryover. Earlier private records are not automatically reclassified.
- Joint card purchases reserve their immediate repayment, preventing PC Express spending from appearing as available cash twice.
- Only explicitly proposed and independently approved household borrowing is shared. Neither person's remaining private line-of-credit balance is exposed.
- Twice-monthly pay and one-off received income are supported. Irregular expected income is excluded from the baseline forecast.

The original setup remains available for records that still use member accounts:

- Shared recurring essentials: **rent, water, electricity, Wi-Fi**. Each item carries its own split; 60/40 Wi-Fi can coexist with 50/50 rent.
- Any expenses that remain Alexandre's personal responsibility (including Cheryl's gas, if still agreed) can be recorded as **Mine while Alexandre is signed in**. A description mentioning Cheryl does not transfer ownership.
- Each person records their own subscriptions, personal payments, and debts privately.
- No partner-private view exists. The logged-in person sees **Mine** and **Shared**. When Cheryl logs in, **Mine means Cheryl's**. Shared split/payer labels use actual member names.
- Shared bills are full household totals in Shared. My overview uses your allocated portion, plus your private expenses.

## Project map

```text
app/
  page.tsx                 Entry point
  planner.tsx              Notebook screens, forms and accessible dialogs
  globals.css              Theme and responsive layout
  chatgpt-auth.ts          Sites identity adapter (server only)
  api/notebook/route.ts    HTTP auth, no-cache, CSRF/origin, JSON and ICS responses
lib/
  domain.ts                Money, validation, dates, recurrence, budgets, forecasts, ICS
  service.ts               Database operations and ownership policy
  utils.ts                 Component class-name helper
components/ui/             Generated shadcn/Base UI primitives (unmodified)
db/schema.ts               Drizzle schema; source of truth for migrations
drizzle/                   Checked-in SQLite migrations + Drizzle metadata
tests/                     Domain + real SQLite service tests
.openai/hosting.json        Sites ID and logical D1 binding; no secrets
wrangler.local.json        Local-only database migration configuration
```

See [architecture](docs/architecture.md), [API](docs/api.md), [development and verification](docs/development.md), and [deployment](docs/deployment.md).

## Database and permissions

`households` store currency and a label. `members` link a trusted identity to one of exactly two unique household slots. `invitations` store only SHA-256 hashes and expirations. `categories` are household-wide labels. `records` is a typed financial-event table with ownership, monetary values, dates, recurrence, optional category, split, payer, and type-specific optional fields.

Every read and mutation scopes by household and `(owner_id IS NULL OR owner_id = current_member)`. Private owners are derived from the authenticated identity, never accepted from the body. Existing type/ownership cannot be changed. Shared items can be edited by either member. SQL constraints independently prohibit shared debt/payday records and duplicate occurrence payments. Separate partial unique indexes prevent duplicate monthly plans in each private/shared category scope.

Partner member summaries contain only IDs, name, and slot; private opening balances never leave their own session. Calendars and aggregates use only already-authorized records. An arbitrary ID returns the same not-found result whether it is nonexistent or another person's private item.

Money uses integer cents (maximum 10,000,000 currency units per item). Splits use basis points: 6000 = 60%. The first household slot receives the rounded first allocation, and the second receives the remaining cents. Dates use ISO calendar strings. Household “today” uses `America/Moncton`; change the domain helper before supporting a different household timezone.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

- Tests execute the actual committed migrations in Node's in-memory SQLite and exercise the same service used by API routes.
- Lint targets application, domain, database, tests, and Vite configuration. The generated UI catalog has upstream lint findings and is intentionally not rewritten.
- Formatting covers authored sources/configuration/docs. Generated UI, migrations, build output and the lockfile are excluded.
- See `docs/development.md` for the tested boundaries and remaining manual checks.

## Hosting without a VPS

This checkout is ready for managed **Sites** deployment with a logical D1 binding. Its production Worker is built at `dist/server/index.js`. Sites provisions the real D1 database, injects trusted identity, handles sign-in, and applies migrations. Do not deploy the current worker to an untrusted/raw origin: the identity headers are trusted only behind Sites dispatch.

Cloudflare Workers and D1 have free tiers that are a reasonable capacity fit for two people. Free-tier limits apply, and Sites access/availability depends on your OpenAI account. This is not a guarantee that every host or future plan is free. A standalone Cloudflare deployment would need a verified identity adapter (for example validated OIDC sessions) in place of Sites headers. It is **not** a one-command standalone deployment today. No VPS is needed for that future route either.

References checked September 8, 2026: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Google Calendar API quotas](https://developers.google.com/workspace/calendar/api/guides/quota).

## Deliberate first-release limits

- Manual entry only. Provider contracts are documented in [future integrations](docs/future-integrations.md); no bank or CSV endpoints exist.
- Google Calendar export is a **snapshot**, not a background sync. Standard Calendar API use is available at no additional cost, but an OAuth app and each person's consent are needed for live synchronization.
- Reminders are in-app and ICS alarms, not email, SMS, push, or server-scheduled jobs.
- Recurrence includes weekly, biweekly, twice monthly, monthly, every two months, quarterly and yearly. Twice-monthly schedules select two dates directly.
- Debt balance and goal saved amounts are manually entered snapshots. Payments do not calculate interest or automatically change those fields.
- The personal forecast allocates your share of shared spending. It does not assume reimbursement dates or model temporary full-bill cash advances. Reimbursements are shown separately.
- Variable future groceries, unentered expenses, interest and inflation are not guessed. Add planned purchases/commitments for known future spending.
- The opening balance defines the calculation start; the UI shows twelve calendar-month buckets starting this month. Old snapshots carry expected past activity forward; update them regularly for accuracy.
- A member currently belongs to one household. Member replacement, leaving a household, currency conversion, per-person category labels, audit history, optimistic concurrency, pagination, data import, and automated backups are not implemented.
- Data is access-controlled, not end-to-end encrypted. The hosting/database operator can access stored data. Export files become ordinary files outside app permissions.
