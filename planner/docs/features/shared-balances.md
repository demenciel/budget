# Splits, payers and reimbursements

## Where it lives

lib/domain.ts: allocation, myShare, reimbursement; lib/service.ts: save; records split_bps/payer_id

## Using it

Each shared bill/transaction carries a percentage for the first household slot. The second member receives the complementary percentage. Payer is independent of ownership. Positive dashboard balance means the partner owes you; negative means you owe the partner. Record a reimbursement with its sender after money has moved. From **Keeping things balanced → Review expenses & transfer history**, either member can mark a shared expense paid from a member's account as settled by another arrangement. The action can be reversed with **Reopen**.

## Data and behavior

Compute first share with round(total_cents * split_bps / 10000), then second = total - first. For shared transactions: balance += amount paid by current member - allocated share. For settlements: add amount if current member sent it, subtract if received. Example: Alexandre pays 100 at 60/40, Cheryl owes 40; Cheryl sends 40 and both balances become zero. A manually settled expense and any reimbursements explicitly linked to it are excluded from the owed balance. The expense and transfer history remain visible. Unlinked transfers still contribute to the overall balance.

## Safe changes and boundaries

Do not include private transactions, joint-pot purchases, or unrecorded recurring bills in reimbursement balances. Marking an expense settled records an arrangement only: it does not move money, remove the original spending, or change personal or joint budgets. Payer IDs must be household members. The first member receives the rounding cent; this rule is stable across sessions. Tests cover pennies, 0/100 splits and repayment direction. There is no automatic transfer or bank payment.

## Verification

Run `npm test` and `npm run typecheck` after business-rule changes. Run the focused lint/format checks and production build before deployment. Add a regression test to `tests/domain.test.ts` or `tests/service.test.ts` when changing ownership, recurrence, financial calculations or mutation behavior.
