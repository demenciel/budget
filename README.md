# Together — shared household budget planner

The full app lives in **[planner/](planner/README.md)**. It is a React/TypeScript notebook backed by SQLite-compatible Cloudflare D1, with separate authenticated household memberships and server-enforced private/shared ownership.

```sh
cd planner
npm ci
npm run db:migrate:local
npm run dev
```

Use Node 24. Sign in locally, create a household, and invite Cheryl through Settings. Hosted access also requires granting Cheryl viewer access in Sites sharing. Your individual debts and pay schedules remain private.

**[Detailed README](planner/README.md)** · **[Feature guides](planner/docs/features/)** · **[Architecture](planner/docs/architecture.md)** · **[Development/testing](planner/docs/development.md)** · **[Deployment](planner/docs/deployment.md)**

Manual transactions, Kakeibo monthly plans/reflections, editable categories, per-bill splits and reimbursements, recurring bills/subscriptions, private debts, purchases, savings goals, a monthly calendar, 30–90-day timeline, reminders, Google-compatible ICS export, and a twelve-month outlook are implemented. Sample records are optional. No bank connections or CSV imports are included.

Run focused checks from `planner`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

The deployed target is managed Sites on Cloudflare Workers/D1. No VPS is required. Direct standalone Cloudflare hosting would need a verified replacement for the Sites authentication adapter; see the deployment guide. Google Calendar export works now; live OAuth sync is a documented next step.
