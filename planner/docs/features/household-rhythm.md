# Household rhythm: the three-account arrangement

## What the screen supports

Both salaries stay in private accounts. Each person can record private fixed-cost reserves and a personal spending allowance per pay. Private transactions tagged `discretionary` consume that allowance from the most recent dependable recurring payday. If no pay schedule exists, the current joint fortnight is the fallback period. The UI shows what remains; it cannot block bank or card spending.

Shared bills remain individual commitments with a split and a named expected payer. Set Cheryl as payer for mortgage/utilities that leave her account. The rhythm screen shows each person's allocation and offers a manual bill-transfer entry. Transfers are `settlement` records in the existing reimbursement ledger. A transfer does not mark the utility paid; record the actual bill payment separately. A transfer can precede a bill payment, leaving an advance balance that the eventual bill offsets.

The joint pot is a separately tracked shared account, not a bank connection. Configure the actual opening cash before activity on the opening date, a 14-day cycle anchor, and a contribution target. The opening snapshot is locked after joint activity begins. Anchor and target can still change. Existing private transactions are never automatically moved into the joint pot.

## Joint cash and carryover

`jointSummary` in `lib/domain.ts` computes:

- Recorded bank cash = opening cash + deposits − joint debit purchases − card clears.
- Reserved card cash = joint card purchases without a recorded clear.
- Available = recorded bank cash − reserved card cash.
- Cycle start = anchor + floor(days since anchor / 14) × 14 days.
- Carryover = available − current-cycle deposits + current-cycle purchases.

All computations are as of today, after the opening date. A balance is a manual estimate, so the UI displays the last recorded activity. Carryover remains across cycle/month/year boundaries; there is no reset job.

Joint transactions use `account=joint`, `owner_id=NULL`, and `payment_method=debit|card`. They are included in household category actuals but excluded from member reimbursement calculations. Do not book a second expense for the same purchase.

For PC Express, record the purchase against the joint pot using `card`. Available funds decrease immediately. After manually transferring the matching amount from the bank to the card, use **Record repaid today**. The bank balance falls and the reservation clears, leaving available unchanged. Only one clear per purchase is allowed. Undo the clear before editing/deleting its purchase. An incorrect ledger entry can be undone with confirmation; this never reverses money at the bank.

## Scheduled deposits and forecasts

Use a `funding` record as a joint contribution schedule, assigning the contributor, amount, start date and frequency. Use **Record deposited** on an occurrence to link an actual deposit to `schedule-id:occurrence-date`. A unique source ID prevents duplicate deposits for that occurrence. Use the general deposit form only for additional unscheduled deposits.

Forecasts replace the matched expected contribution with the actual deposit. A contribution is an outflow from the named member's private account and an inflow into the shared outlook; it is not salary. Joint purchases do not create another private outflow. Shared purchases remain expenses in the shared outlook. Member-account bills retain the existing allocated-responsibility forecast; temporary advances/reimbursement timing are still tracked separately.

## Code and storage

- `app/rhythm.tsx`: joint dashboard, transfer forms, private reserves, agreement controls.
- `lib/rhythm-service.ts`: authorized actions, server validation, conditional repayment insertion.
- `lib/domain.ts`: joint summary, recurrence and forecast integration.
- `households`: cycle anchor, opening amount/date, contribution target.
- `members`: private fixed reserve and allowance; excluded from partner metadata.
- `joint_entries`: actual deposits, card clears and agreed-borrowing payments. All entries are household-visible. Borrowing payments come from the named member's private account and do not affect joint bank cash.

Every action starts with the signed-in membership and authorized notebook. An ID from another household is rejected. Existing migrations stay immutable; migration `0001` only adds tables and constant-default columns.

## Verification

Domain tests cover card reservation/clear equivalence, fortnight rollover, and scheduled contribution de-duplication in both forecast scopes. SQLite service tests cover private reserves, unauthorized IDs, duplicate clears/deposits, corrections and opening-snapshot locking. Existing private-finance tests still run.
