# Future integrations: deliberately disconnected

No bank connections, CSV imports, external account tokens, or bank API calls exist. Manual transaction creation already normalizes external-looking data into integer cents, calendar dates, ownership, category, payer and split through `validateRecord`. That is the future import boundary.

## Bank provider contract

A future adapter should produce candidate records, not insert directly:

```ts
interface CandidateTransaction {
  provider: string;
  externalId: string;
  accountId: string;
  amountCents: number;
  currency: string;
  bookedDate: string;
  description: string;
}
interface TransactionProvider {
  listTransactions(cursor?: string): Promise<{
    candidates: CandidateTransaction[];
    nextCursor?: string;
  }>;
}
```

Before implementing a provider, verify that it is legally available for the user's bank/country and that the actual API and production use are free. An advertised sandbox is not a free production API. No provider was selected for this release.

Add account connections owned privately by a member, encrypted server-only tokens, a per-account sync cursor, and a unique `(connection_id, external_id)` index in a future migration. Bank data must default to private. A separate explicit review action can create a shared expense, with its split and payer; do not expose an entire bank account to the household. Validate currency and signs, model refunds explicitly, and test idempotency before importing.

## Calendar provider contract

Use normalized authorized `Event` occurrences from `events()`, stable `record-id:date` IDs, and owner-aware destinations. See [Google Calendar](features/google-calendar.md) for consent, token, destination and deletion semantics. Never reuse a shared calendar destination for private debt events.

## Notification transport

A future scheduled sender can query due reminders using the same member-level authorization and `remind_days`. Add opt-in delivery preferences and a unique per-occurrence delivery key. Do not send private financial details to a shared email destination. There is no background scheduler or message sender now.
