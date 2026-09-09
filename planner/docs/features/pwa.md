# Phone installation (PWA)

Together opens as a standalone home-screen app using the existing site, sign-in, household permissions and database.

## Install

- iPhone/iPad: open the site in Safari → Share → Add to Home Screen. Enable Open as Web App if offered, then Add.
- Android: open the site in Chrome → menu → Install app or Add to Home screen (wording varies).
- Launch from the new icon and sign in if prompted. Installed apps may need a separate sign-in.

## Implementation

`app/layout.tsx` supplies manifest, Apple touch icon, Apple web-app metadata and viewport/theme settings; zoom stays enabled. `public/manifest.webmanifest` defines the stable root identity, standalone display and PNG icons in `public/icons/`. Icons use the existing Together green monogram; the maskable icon keeps the mark within its central safe zone.

`app/pwa.tsx` registers `/sw.js` in production only with `updateViaCache: 'none'`. Registration failure does not interrupt budgeting. The worker handles only root-page GET navigations: network first with HTTP caching disabled, falling back to a generic reconnect message when the network fails. There is no Cache Storage, offline financial data, queued mutation or interception of API/auth routes. Server errors and redirects pass through unchanged.

Internet access is required to read fresh balances and save changes. Installation does not add push notifications or offline editing. Existing in-app reminders are unchanged. Keep the manifest identity stable during future deployments. HTTPS is required outside localhost.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`. `tests/pwa.test.ts` verifies icon sizes and worker behavior with a mocked network. Actual phone installation is a manual device check, not covered by these tests.
