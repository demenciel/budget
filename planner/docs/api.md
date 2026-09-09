# Notebook API

`GET /api/notebook` returns the authenticated member's notebook or a `needsSetup` response. Unauthenticated requests return 401. Records and partner metadata are filtered server-side. All responses use `Cache-Control: private, no-store, max-age=0` and `X-Content-Type-Options: nosniff`.

`POST /api/notebook` requires `Content-Type: application/json`, `X-Notebook: 1`, and an `Origin` exactly matching the request URL origin, plus authenticated identity. The JSON body is capped at 16,000 characters after decoding. Do not enable permissive CORS. No GET has data-write semantics.

## Actions

| Action            | Body fields                                                 | Behavior                                                           |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `createHousehold` | `name`, `currency`                                          | Creates household, first member, categories in one transaction     |
| `joinHousehold`   | `name`, `token`                                             | Consumes unexpired one-use invitation; unique slot 2               |
| `invite`          | none                                                        | Rotates household invitation, expires in 7 days                    |
| `profile`         | `name`, `opening`, `date`                                   | Saves current person's display name and private balance snapshot   |
| `category`        | `name`, optional `id`                                       | Creates or renames household category                              |
| `save`            | `record`, optional `id`                                     | Validates and creates/updates a typed record                       |
| `delete`          | `id`                                                        | Authorized delete; detaches linked payments before deleting a plan |
| `pay`             | `id`, scheduled `date`, optional `payment_date`, `payer_id` | Creates transaction linked to unique scheduled occurrence          |
| `seed`            | none                                                        | Inserts illustrative examples only into an empty visible notebook  |

Amounts in incoming record bodies are decimal **strings** (`"126.80"`). Database responses use integer cents. The record editor's `inputRecord` function is the response-to-form adapter. Incoming fields are explicitly selected by `validateRecord`; arbitrary owner/household/source IDs are never copied through.

A record body includes `kind`, `scope` (`mine`/`shared`), `title`, `amount`, `date`, optional `end_date`, `frequency`, `category_id`, `split_bps`, `payer_id`, `note`, `priority`, `balance`, `saved`, `completed` (boolean), and `remind_days`. Private owner derives from identity. `source_id` and `occurrence_date` are server-controlled through `pay`.

`GET /api/notebook?export=calendar&scope=shared` downloads an ICS file. `scope=mine-and-shared` opts into including the caller's private events; never the partner's. Other scopes default to shared-only.

## Household-rhythm extension

The same authenticated, origin-checked POST endpoint accepts `rhythm:setup`, `rhythm:privatePlan`, `rhythm:deposit`, `rhythm:clearCard`, `rhythm:propose`, `rhythm:approve`, `rhythm:repay`, and `rhythm:removeEntry`. Exact validated bodies are in `lib/rhythm-service.ts`. `loadNotebook` now includes only the caller's household `jointEntries` and `agreements`. Private reserve/allowance fields are returned only on the caller's `member`, never partner summaries.

Record bodies additionally accept `second_day` (2–31), `dependable` and `received` booleans, `account` (`personal` or `joint`), `payment_method` (`debit` or `card`), and `spending_bucket` (`fixed` or `discretionary`). Joint account transactions must be shared. Received income must be a one-off payday dated today or earlier. Existing ownership/type invariants still apply.

## Errors

400 validation error; 401 missing login; 403 missing membership/origin failure; 404 inaccessible or missing item; 409 uniqueness conflicts; 413 oversized JSON; 415 unsupported content type; 500 unexpected storage error. SQL details are logged server-side, not returned to the client. The UI preserves the open editor on errors.

## Extension rule

Add business operations to `lib/service.ts`, not direct UI-side database access. Both reads and writes must use the current member. A new export or aggregate must start from `loadNotebook` or an equivalent SQL ownership predicate. Cover any new action with service tests using real SQLite.
