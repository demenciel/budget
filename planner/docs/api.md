# Notebook API

## API-key access

Each signed-in household member can create and revoke keys in **Settings → API keys**. A key has full read/write access to everything that member can access: their private records and balances, shared household data, categories, household rhythm, invitations, and calendar exports. It cannot see the other member's private data or approve its own proposals on the other member's behalf. Keys are shown only when created; the database stores a SHA-256 hash and a short display prefix. Revocation takes effect on the next request.

Use HTTPS and send the key in the `Authorization` header. The API-key endpoint accepts no cookie-only requests and does not require a browser `Origin` header. It does not enable cross-origin browser access.

```sh
curl -H "Authorization: Bearer $TOGETHER_API_KEY" \
  https://YOUR_SITE/api/v1/notebook

curl -X POST https://YOUR_SITE/api/v1/notebook \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"action":"save","record":{"kind":"transaction","scope":"mine","title":"Groceries","amount":"42.30","date":"2026-10-03"}}'

curl -H "Authorization: Bearer $TOGETHER_API_KEY" \
  'https://YOUR_SITE/api/v1/notebook?export=calendar&scope=mine-and-shared'
```

`GET /api/v1/notebook` returns the same authorized notebook shape as the browser endpoint: `household`, `member`, `members`, `categories`, `records`, `jointEntries`, and `agreements`. Amounts in responses are integer cents. `GET ?export=calendar` returns an ICS snapshot. Calendar export defaults to shared events; `scope=mine-and-shared` includes the key owner's private events. `POST /api/v1/notebook` accepts the same action objects described below. It requires `Content-Type: application/json`, with a 16,000-character decoded body limit. There is no separate resource endpoint to bypass the service's ownership rules.

For example, to change a category use `{"action":"category","id":"CATEGORY_ID","name":"Food at home"}`. To record a payment use `{"action":"pay","id":"BILL_ID","date":"2026-10-03","payment_date":"2026-10-03"}`. To adjust the private rhythm plan use `{"action":"rhythm:privatePlan","fixed":"150","allowance":"100"}`. The response is `{ "ok": true }` for successful writes, except `invite`, which returns a one-use `token`. Reload the notebook to get generated record IDs and updated data.

Key management is available only to a signed-in browser session, at `GET /api/keys`, `POST /api/keys` with `{"name":"My integration"}`, and `DELETE /api/keys` with `{"id":"KEY_ID"}`. Writes require the same-site `Origin`, `X-Notebook: 1`, and JSON content type. Creation returns the secret `key` once; listing returns only metadata. A member must join or create a household through the browser before making a key. Keys cannot create or join a household because they are attached to an existing member.

All key requests return `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Invalid or revoked keys return 401. Validation and ownership errors use the status codes below. Treat keys like passwords: store them in a secret manager, do not put them in URLs or client-side code, and revoke one immediately if it leaks. Hosted Sites access controls may also apply before a request reaches the Worker; the Site must allow the API caller to reach its routes.

`GET /api/notebook` returns the authenticated member's notebook or a `needsSetup` response. Unauthenticated requests return 401. Records and partner metadata are filtered server-side. All responses use `Cache-Control: private, no-store, max-age=0` and `X-Content-Type-Options: nosniff`.

`POST /api/notebook` requires `Content-Type: application/json`, `X-Notebook: 1`, and an `Origin` exactly matching the request URL origin, plus authenticated identity. The JSON body is capped at 16,000 characters after decoding. Do not enable permissive CORS. No GET has data-write semantics.

## Actions

| Action                | Body fields                                                 | Behavior                                                                 |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `createHousehold`     | `name`, `currency`                                          | Creates household, first member, categories in one transaction           |
| `joinHousehold`       | `name`, `token`                                             | Consumes unexpired one-use invitation; unique slot 2                     |
| `invite`              | none                                                        | Rotates household invitation, expires in 7 days                          |
| `profile`             | `name`, `opening`, `date`                                   | Saves current person's display name and private balance snapshot         |
| `category`            | `name`, optional `id`                                       | Creates or renames household category                                    |
| `save`                | `record`, optional `id`                                     | Validates and creates/updates a typed record                             |
| `delete`              | `id`                                                        | Authorized delete; detaches linked payments before deleting a plan       |
| `pay`                 | `id`, scheduled `date`, optional `payment_date`, `payer_id` | Creates transaction linked to unique scheduled occurrence                |
| `setSettlementStatus` | shared non-joint transaction `id`, `settled` (boolean)      | Marks or reopens an expense in the owed balance without changing budgets |
| `seed`                | none                                                        | Inserts illustrative examples only into an empty visible notebook        |

Amounts in incoming record bodies are decimal **strings** (`"126.80"`). Database responses use integer cents. The record editor's `inputRecord` function is the response-to-form adapter. Incoming fields are explicitly selected by `validateRecord`; arbitrary owner/household/source IDs are never copied through.

A record body includes `kind`, `scope` (`mine`/`shared`), `title`, `amount`, `date`, optional `end_date`, `frequency`, `category_id`, `split_bps`, `payer_id`, `note`, `priority`, `balance`, `saved`, `completed` (boolean), and `remind_days`. Private owner derives from identity. `source_id` and `occurrence_date` are server-controlled through `pay`.

`setSettlementStatus` is available through both the signed-in endpoint and the API-key endpoint. It changes only the shared balance calculation: the expense remains in spending and budget actuals, and no money movement is created. Explicitly linked reimbursements are ignored in the balance while the expense is marked settled; unlinked transfers still count. Either household member can reopen the expense. The returned record includes nullable `settled_at`.

`GET /api/notebook?export=calendar&scope=shared` downloads an ICS file. `scope=mine-and-shared` opts into including the caller's private events; never the partner's. Other scopes default to shared-only.

## Household-rhythm extension

The same authenticated, origin-checked POST endpoint accepts `rhythm:setup`, `rhythm:privatePlan`, `rhythm:deposit`, `rhythm:clearCard`, `rhythm:propose`, `rhythm:approve`, `rhythm:repay`, and `rhythm:removeEntry`. Exact validated bodies are in `lib/rhythm-service.ts`. `loadNotebook` now includes only the caller's household `jointEntries` and `agreements`. Private reserve/allowance fields are returned only on the caller's `member`, never partner summaries.

The API-key endpoint accepts these same rhythm actions. Their body fields are:

| Action               | Body fields                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `rhythm:setup`       | `anchor`, `date`, `opening`, `target`                                                                           |
| `rhythm:privatePlan` | `fixed`, `allowance`                                                                                            |
| `rhythm:deposit`     | `date`, `amount`, `title`, optional `member_id`, `schedule_id`, `occurrence`                                    |
| `rhythm:clearCard`   | joint card transaction `id`, repayment `date`                                                                   |
| `rhythm:propose`     | `kind` (`borrowing`/`income_allocation`), `amount`, `split_bps`, `carrier_id`, `date`, `title`, optional `note` |
| `rhythm:approve`     | proposal `id`; must be called by the other member                                                               |
| `rhythm:repay`       | approved borrowing `id`, `amount`, `date`                                                                       |
| `rhythm:removeEntry` | joint entry `id`                                                                                                |

Record bodies additionally accept `second_day` (2–31), `dependable` and `received` booleans, `account` (`personal` or `joint`), `payment_method` (`debit` or `card`), and `spending_bucket` (`fixed` or `discretionary`). Joint account transactions must be shared. Received income must be a one-off payday dated today or earlier. Existing ownership/type invariants still apply.

## Errors

400 validation error; 401 missing login; 403 missing membership/origin failure; 404 inaccessible or missing item; 409 uniqueness conflicts; 413 oversized JSON; 415 unsupported content type; 500 unexpected storage error. SQL details are logged server-side, not returned to the client. The UI preserves the open editor on errors.

## Extension rule

Add business operations to `lib/service.ts`, not direct UI-side database access. Both reads and writes must use the current member. A new export or aggregate must start from `loadNotebook` or an equivalent SQL ownership predicate. Cover any new action with service tests using real SQLite.
