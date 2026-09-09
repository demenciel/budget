# Deployment and operations

## Managed Sites (current working target)

The site manifest `.openai/hosting.json` contains the registered project ID and logical binding `DB`. Keep those values; the platform owns the actual Cloudflare database resource. Sites handles trusted identity, static assets, migrations, and TLS. The worker must be reachable through Sites dispatch only.

1. Run all focused checks and `npm run build`.
2. Commit and push the exact Site source to its configured source repository using short-lived per-command credentials.
3. Package the validated `dist/server` Worker, client assets, hosting manifest and Drizzle migrations with the Sites packaging helper.
4. Save the source SHA plus archive as a version.
5. Publish privately and wait for terminal deployment success.
6. To allow Cheryl, explicitly grant her viewer access in Sites sharing, then use the in-app household invitation. Keep broader audiences disabled unless you intend them.

Never store source tokens, auth cookies, invitation codes or user finance exports in Git. The initial deployment contains schema only. Local `.wrangler` data is neither packaged nor uploaded.

## Free-tier alternatives

Cloudflare Workers + D1 provides a no-VPS path with free-tier quotas. D1 is SQLite-compatible but has per-request and daily limits. This app fetches the authorized notebook in a small fixed number of queries and avoids polling. For two people, expected volume is modest; verify current quotas before choosing a plan.

Standalone hosting is an adaptation, not the current deployment command. Replace `getChatGPTUser()` with a server-verified session/OIDC implementation, reject untrusted identity headers, provide login/logout routes, replace Sites-specific Vite wiring, and configure a real D1 binding before deploying directly. Re-run privacy tests and add session expiry/CSRF/issuer/audience tests. Do not use `wrangler.local.json` as production configuration. Static-only hosts cannot run the database/auth API without a backend.

## Data and recovery

D1 is the persistent source of truth. Browser state is a view, never the financial database. Back up using the host's authorized D1 export/backup facilities; backup access may include both users' private records and is an operator responsibility. Test restoration in a separate environment before relying on it. There is no in-app full database backup or restore feature in v1.

Shared edits currently use last successful write wins. There is no audit trail or conflict-resolution UI. For larger households or stronger accounting needs, add revision numbers and write-conflict checks before expanding membership beyond two.

## Upgrades

Keep schema changes append-only after deployment. Build/publish migrations that remain compatible with the old Worker during rollout. A failed deploy may already have applied migrations; inspect status before editing or retrying. Never seed financial examples from a migration.

The pinned scaffold's dependency audit should be reviewed before a wider release. Do not blindly run `npm audit fix --force`; that can replace the framework/runtime contract. Upgrade through supported compatible releases and repeat privacy/build checks.
