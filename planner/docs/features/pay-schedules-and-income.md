# Pay schedules and one-off income

Use **Set my pay schedule** or the **Pay / one-off income** item type. Amounts are expected net income per occurrence and remain private. The UI now distinguishes:

| Frequency          | Meaning                                   |
| ------------------ | ----------------------------------------- |
| Once               | One lump sum or a single expected payment |
| Weekly             | Every 7 days                              |
| Every two weeks    | Every 14 days; usually 26/year            |
| Twice monthly      | Two calendar dates each month; 24/year    |
| Monthly            | Same anchored day each month              |
| Every two months   | One payment every other month             |
| Quarterly / yearly | Existing three/twelve-month recurrence    |

“Bimonthly” is ambiguous, so both twice-monthly and every-two-months options are explicitly named. For twice-monthly, the first due date provides the first day (1–28); `second_day` selects a later day up to 31. The second date clamps to February/month-end and restores the anchor next month. The first day precedes the second, preventing duplicate dates. End dates are inclusive. `date` is also the earliest occurrence: earlier occurrences are not synthesized.

## Dependable versus extra

`dependable=1` is normal recurring pay and participates in the baseline forecast. Set `dependable=0` for computer-work or other uncertain income. These events remain on the calendar, but expected irregular payments are excluded from income available to commitments.

**Add one-off income** defaults to irregular, once, received. The form allows changing received to expected. `received=1` is allowed only for one-off paydays dated today or earlier. A received lump sum counts once in the private forecast after the opening snapshot. It does not generate future recurring income. Existing stored paydays retain dependable status through a constant-default migration.

Record the destination payment separately: an income record does not automatically pay a credit card, fill the joint account, or share the income with your partner. Use private notes for a private allocation, or a shared agreement proposal to make a joint decision.

## Code and tests

`dates`, `validateRecord`, and `forecast` in `lib/domain.ts`; the form in `app/planner.tsx`; shortcuts in `app/rhythm.tsx`. Tests cover 24 dates/year, leap-February clamping, start/end bounds, incorrect day ordering, every-other-month frequency, expected/received irregular income, and legacy recurrence behavior.
