# Explicit shared borrowing and irregular-income decisions

The updated arrangement permits a specific jointly agreed household purchase to be shared even when a member carries it on a personal line of credit. This is represented separately from private `debt` records. The database rule that private debt records require an owner remains unchanged.

## Agreement flow

1. Either member proposes a purpose, specific amount, carrier, split, target date and terms.
2. Creating the proposal records the creator's consent. The other authenticated household member must approve the same immutable proposal.
3. Until approval, the amount is not treated as agreed borrowing and cannot accept repayments.
4. Once approved, each member may record payments they actually made from their own account. A conditional SQL insert prevents repayments exceeding the outstanding agreed principal, including concurrent attempts.

`agreements` stores only the explicitly disclosed amount and terms. It has no private debt ID, private account number or private balance. Approvals cannot be supplied in a client-created proposal, self-approved, or added by another household. The schema also prevents `approved_by=creator_id`.

Agreements are immutable in this release: there is no edit/cancellation workflow. If terms change, do not silently approve the old terms. A future revision/cancellation flow must invalidate prior consent and retain history.

## Borrowing accounting

The UI shows original agreed shares, outstanding total principal and the caller's recorded payments. It does not proportionally assign another person's payments to your share. Interest, unrelated line-of-credit spending and the underlying lender balance remain outside this ledger. Recording a shared repayment never changes a private debt balance automatically.

An agreement is not proof that a purchase or loan draw occurred, and does not create an expense, income, calendar event or automatic loan transfer. Record actual spending only when it happens. Actual agreed-borrowing repayments are included in forecasts once; future repayment dates should be specified in the terms and entered as plans separately if needed. No money moves automatically.

## Irregular income allocation

`kind=income_allocation` uses the same two-person approval flow for a date budget, joint contribution or another agreed destination. Sharing the proposal voluntarily discloses its amount/terms. Private income records themselves remain private. An approved allocation does not invent future income or post a deposit; record the actual transfer after funds arrive.

For the initial computer-work payment directed at a credit card, use a private one-off received-income record and a separate private payment. Recurring computer-work income should be marked irregular and excluded from the baseline forecast until actually received. A note can preserve the decision for money kept privately without sharing a private account balance.

## Verification

`tests/service.test.ts` covers two distinct consents, cross-household rejection, repayment before approval, overpayment, and preservation of private line-of-credit data. `tests/domain.test.ts` verifies expected irregular income is excluded and received lump sums count only once.
