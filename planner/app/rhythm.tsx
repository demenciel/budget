'use client';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import {
  Users,
  LockKeyhole,
  ArrowUpRight,
  Check,
  CreditCard,
} from 'lucide-react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  money,
  today,
  addDays,
  events,
  jointSummary,
  myShare,
  allocation,
  type Notebook,
  type Kind,
  type RecordItem,
} from '@/lib/domain';
import type { Draft } from './planner';

type Props = {
  data: Notebook;
  busy: boolean;
  mutate: (
    b: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  edit: (k: Kind, r?: RecordItem, o?: Partial<Draft>) => void;
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Person({
  data,
  name,
  initial,
}: {
  data: Notebook;
  name: string;
  initial?: string;
}) {
  return (
    <NativeSelect name={name} defaultValue={initial ?? data.member.id}>
      {data.members.map((m) => (
        <NativeSelectOption key={m.id} value={m.id}>
          {m.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
function decimal(n = 0) {
  return (n / 100).toFixed(2);
}

export function JointOverview({
  data,
  open,
}: {
  data: Notebook;
  open: () => void;
}) {
  const joint = jointSummary(data),
    fmt = (n: number) => money(n, data.household.currency);
  return (
    <section className="panel joint-overview">
      <div>
        <span className="badge shared">
          <Users size={12} /> Shared · joint spending pot
        </span>
        <h2>What’s left for everyday life?</h2>
        <p
          className={'balance-value ' + (joint.available < 0 ? 'overdue' : '')}
        >
          {fmt(joint.available)}
        </p>
        <p className="muted">
          Recorded available · {joint.start} – {joint.end}
        </p>
      </div>
      <div>
        <p>{fmt(joint.cycleSpent)} spent this cycle</p>
        <p className="hint">
          {fmt(joint.carryover)} carried into this cycle
          <br />
          {fmt(joint.reserved)} reserved for card repayment
        </p>
        <button className="text-button" onClick={open}>
          Open our two-week plan <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  );
}

export function HouseholdRhythm({ data, busy, mutate, edit }: Props) {
  const [removing, setRemoving] = useState<string | null>(null);
  const now = today(),
    joint = jointSummary(data),
    fmt = (n: number) => money(n, data.household.currency),
    name = (id: string) =>
      data.members.find((m) => m.id === id)?.name ?? 'Household member';
  const timeline = events(
    data.records,
    addDays(now, -90),
    addDays(now, 60),
    data.jointEntries,
  );
  const paydays = timeline.filter(
    (e) =>
      e.record.kind === 'payday' &&
      e.record.dependable !== 0 &&
      e.record.frequency !== 'once',
  );
  const lastPay =
    paydays.filter((e) => e.date <= now).at(-1)?.date ?? joint.start;
  const nextPay = paydays.find((e) => e.date > now);
  const personalSpent = data.records
    .filter(
      (r) =>
        r.owner_id === data.member.id &&
        r.kind === 'transaction' &&
        r.spending_bucket === 'discretionary' &&
        r.date >= lastPay &&
        r.date <= now,
    )
    .reduce((n, r) => n + r.amount_cents, 0);
  const allowance = data.member.allowance_cents ?? 0;
  const jointSpending = data.records.filter(
    (r) =>
      r.kind === 'transaction' &&
      r.account === 'joint' &&
      r.date >= joint.start &&
      r.date <= now,
  );
  const receivedExtras = data.records.filter(
    (r) => r.kind === 'payday' && r.frequency === 'once' && r.dependable === 0,
  );
  const lastEntry = [
    ...(data.jointEntries ?? []).map((e) => e.date),
    ...data.records.filter((r) => r.account === 'joint').map((r) => r.date),
  ]
    .sort()
    .at(-1);
  async function submit(
    e: SubmitEvent<HTMLFormElement>,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const result = await mutate({
      action,
      ...values,
      ...(action === 'rhythm:propose'
        ? { split_bps: Math.round(Number(values.percentage) * 100) }
        : {}),
      ...extra,
    });
    if (
      result &&
      ['rhythm:deposit', 'rhythm:propose', 'rhythm:repay'].includes(action)
    )
      form.reset();
  }
  const upcomingFunding = timeline.filter(
    (e) =>
      e.record.kind === 'funding' &&
      !e.paid &&
      e.date >= joint.start &&
      e.date <= joint.end,
  );
  return (
    <div className="rhythm">
      <JointOverview
        data={data}
        open={() =>
          document
            .getElementById('joint-log')
            ?.scrollIntoView({ behavior: 'smooth' })
        }
      />
      <p className="notice">
        This is a manual notebook. Last joint activity recorded:{' '}
        {lastEntry ?? 'none yet'}. Unentered spending is not reflected here.
        Leftovers stay available across two-week cycles.
      </p>
      <div className="rhythm-actions">
        <button
          className="primary"
          onClick={() =>
            edit('transaction', undefined, {
              scope: 'shared',
              account: 'joint',
              title: '',
              payment_method: 'debit',
            })
          }
        >
          Add joint spending
        </button>
        <button
          className="secondary"
          onClick={() =>
            edit('funding', undefined, {
              scope: 'shared',
              title: 'Payday contribution to joint account',
              frequency: 'biweekly',
            })
          }
        >
          Plan a contribution each pay
        </button>
        <button
          className="secondary"
          onClick={() =>
            edit('payday', undefined, {
              scope: 'mine',
              frequency: 'semimonthly',
              date: now.slice(0, 7) + '-01',
              second_day: '15',
              title: 'Net pay',
            })
          }
        >
          Set my pay schedule
        </button>
        <button
          className="secondary"
          onClick={() =>
            edit('payday', undefined, {
              scope: 'mine',
              frequency: 'once',
              title: 'One-off income',
              dependable: false,
              received: true,
            })
          }
        >
          Add one-off income
        </button>
      </div>
      <div className="columns lower">
        <section className="panel">
          <h2>Keep the joint pot current</h2>
          <p className="hint">
            Record money only after it has been deposited. This is a transfer,
            not new household income.
          </p>
          <form
            className="form-grid lower"
            onSubmit={(e) => void submit(e, 'rhythm:deposit')}
          >
            <Field label="Amount deposited">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Date">
              <input
                name="date"
                type="date"
                defaultValue={now}
                max={now}
                required
              />
            </Field>
            <Field label="Contributed by">
              <Person data={data} name="member_id" />
            </Field>
            <Field label="Description">
              <input
                name="title"
                defaultValue="Payday joint contribution"
                required
                maxLength={160}
              />
            </Field>
            <button className="primary full" disabled={busy}>
              Record actual deposit
            </button>
          </form>
          <h3 className="lower">Planned for this cycle</h3>
          {upcomingFunding.length === 0 && (
            <p className="hint">
              Add a contribution schedule to make payday deposits visible in
              advance.
            </p>
          )}
          {upcomingFunding.map((e) => (
            <div className="event-row" key={e.id}>
              <div className="event-name">
                <b>{e.record.title}</b>
                <small>
                  {e.date} · {name(e.record.payer_id ?? '')} ·{' '}
                  {fmt(e.record.amount_cents)}
                </small>
              </div>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void mutate({
                    action: 'rhythm:deposit',
                    title: e.record.title,
                    date: now,
                    member_id: e.record.payer_id,
                    amount: decimal(e.record.amount_cents),
                    schedule_id: e.record.id,
                    occurrence: e.date,
                  })
                }
              >
                Record deposited
              </button>
            </div>
          ))}
          <p className="hint">
            For a scheduled contribution, use “Record deposited” so it replaces
            the expected transfer in forecasts. The general deposit form is for
            additional deposits.
          </p>
        </section>
        <section className="panel">
          <h2>Groceries, baby, and the good things</h2>
          {data.categories.map((c) => {
            const spent = jointSpending
              .filter((r) => r.category_id === c.id)
              .reduce((n, r) => n + r.amount_cents, 0);
            return spent ? (
              <div className="member-row" key={c.id}>
                <span>{c.name}</span>
                <b>{fmt(spent)}</b>
              </div>
            ) : null;
          })}
          <p className="hint">
            Joint spending covers groceries, household supplies, larger
            subscriptions, baby needs, and treats when money remains. Each
            purchase is counted once, whoever uses a card.
          </p>
          <h3 className="lower">
            <CreditCard size={18} /> Card repayments to do now
          </h3>
          {joint.pending.length === 0 ? (
            <p className="hint">No outstanding joint card purchases.</p>
          ) : (
            joint.pending.map((r) => (
              <div className="event-row" key={r.id}>
                <div className="event-name">
                  <b>{r.title}</b>
                  <small>
                    {fmt(r.amount_cents)} reserved · card used by{' '}
                    {name(r.payer_id ?? '')}
                  </small>
                </div>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void mutate({
                      action: 'rhythm:clearCard',
                      id: r.id,
                      date: now,
                    })
                  }
                >
                  Record repaid today
                </button>
              </div>
            ))
          )}
          <p className="hint">
            For PC Express, mark the purchase “Credit card” when entering it.
            Transfer that amount from the joint bank account yourself, then
            record the repayment here.
          </p>
        </section>
      </div>
      <section className="panel lower">
        <h2>Bills paid from a member’s account</h2>
        <p className="hint">
          Set Cheryl as the payer on mortgage, utilities, and other bills that
          leave her account. Your portion is shown here. Recording a transfer
          updates reimbursements; it does not mark the bill paid.
        </p>
        {timeline
          .filter(
            (e) =>
              !e.paid &&
              !e.record.owner_id &&
              ['bill', 'subscription'].includes(e.record.kind) &&
              e.date >= now,
          )
          .slice(0, 15)
          .map((e) => (
            <div className="event-row" key={e.id}>
              <div className="event-name">
                <b>{e.record.title}</b>
                <small>
                  {e.date} · paid from {name(e.record.payer_id ?? '')}’s account
                  · total {fmt(e.record.amount_cents)}
                </small>
              </div>
              <b>My portion {fmt(myShare(e.record, data.member))}</b>
              {e.record.payer_id && e.record.payer_id !== data.member.id && (
                <button
                  className="text-button"
                  onClick={() =>
                    edit('settlement', undefined, {
                      title: `Bill transfer: ${e.record.title}`,
                      scope: 'shared',
                      amount: decimal(myShare(e.record, data.member)),
                      payer_id: data.member.id,
                      note: `Transfer to ${name(e.record.payer_id!)} for occurrence ${e.date}.`,
                    })
                  }
                >
                  Record my transfer
                </button>
              )}
            </div>
          ))}
        <button
          className="text-button"
          onClick={() =>
            edit('bill', undefined, {
              scope: 'shared',
              title: 'Mortgage',
              frequency: 'monthly',
              payer_id:
                data.members.find((m) =>
                  m.name.toLowerCase().includes('cheryl'),
                )?.id ?? data.member.id,
            })
          }
        >
          Add a shared bill →
        </button>
      </section>
      <div className="columns lower">
        <section className="panel">
          <span className="badge mine">
            <LockKeyhole size={12} /> Mine · {data.member.name}
          </span>
          <h2 className="lower">My payday boundaries</h2>
          <p
            className={
              'balance-value ' +
              (allowance - personalSpent < 0 ? 'overdue' : '')
            }
          >
            {fmt(allowance - personalSpent)}
          </p>
          <p className="muted">
            Personal spending left since {lastPay}. {fmt(personalSpent)}{' '}
            recorded against {fmt(allowance)}.
          </p>
          <p className="hint">
            Tag private purchases “Personal spending allowance” to count them
            here. Fixed expenses stay separate. This plan does not treat credit
            limits or new borrowing as available money.
          </p>
          <form
            className="form-grid lower"
            onSubmit={(e) => void submit(e, 'rhythm:privatePlan')}
          >
            <Field label="Fixed personal costs to retain each pay">
              <input
                name="fixed"
                defaultValue={decimal(data.member.fixed_reserve_cents)}
                inputMode="decimal"
                required
              />
            </Field>
            <Field label="Personal spending to retain each pay">
              <input
                name="allowance"
                defaultValue={decimal(allowance)}
                inputMode="decimal"
                required
              />
            </Field>
            <button className="primary full" disabled={busy}>
              Save my private boundaries
            </button>
          </form>
          {nextPay && (
            <p className="hint">
              Next dependable pay: {fmt(nextPay.record.amount_cents)} on{' '}
              {nextPay.date}. After your two private reserves:{' '}
              {fmt(
                nextPay.record.amount_cents -
                  (data.member.fixed_reserve_cents ?? 0) -
                  allowance,
              )}
              , before bill transfers and joint contributions.
            </p>
          )}
          <h3 className="lower">Extra income stays extra</h3>
          {receivedExtras.map((r) => (
            <div className="event-row" key={r.id}>
              <div className="event-name">
                <b>{r.title}</b>
                <small>
                  {fmt(r.amount_cents)} ·{' '}
                  {r.received
                    ? 'Received'
                    : 'Expected · excluded from baseline'}{' '}
                  · {r.date}
                </small>
                <small>
                  {r.note || 'Add a note about where this money is going.'}
                </small>
              </div>
              <button className="text-button" onClick={() => edit('payday', r)}>
                Edit
              </button>
            </div>
          ))}
          <p className="hint">
            Initial computer-work payment: record the income privately, and
            record the actual credit-card payment separately when paid. Monthly
            extras can stay personal or be proposed below for dates/joint use;
            no forecast assumes those extras will arrive.
          </p>
        </section>
        <section className="panel">
          <h2>Our fortnightly setup</h2>
          <p className="hint">
            Choose any cycle anchor date. Every cycle is exactly 14 days. The
            opening amount is the actual joint balance before activity on its
            date; once activity exists it is locked to keep the ledger
            consistent.
          </p>
          <form
            className="form-grid lower"
            onSubmit={(e) => void submit(e, 'rhythm:setup')}
          >
            <Field label="Cycle starts on">
              <input
                name="anchor"
                type="date"
                defaultValue={data.household.cycle_anchor ?? now}
                required
              />
            </Field>
            <Field label="Target contribution each cycle">
              <input
                name="target"
                inputMode="decimal"
                defaultValue={decimal(data.household.joint_target_cents)}
                required
              />
            </Field>
            <Field label="Joint opening balance">
              <input
                name="opening"
                inputMode="decimal"
                defaultValue={decimal(data.household.joint_opening_cents)}
                required
              />
            </Field>
            <Field label="Opening balance date">
              <input
                name="date"
                type="date"
                max={now}
                defaultValue={data.household.joint_opening_date ?? now}
                required
              />
            </Field>
            <button className="primary full" disabled={busy}>
              Save our joint setup
            </button>
          </form>
          <p className="hint">
            This cycle: {fmt(joint.cycleDeposits)} deposited toward{' '}
            {fmt(data.household.joint_target_cents ?? 0)}. Transfers are
            recorded manually; the app cannot move money or enforce card
            spending limits.
          </p>
        </section>
      </div>
      <section className="panel lower">
        <span className="badge shared">Shared · agreements</span>
        <h2 className="lower">Only what we agree to share</h2>
        <p className="muted">
          Propose a specific household purchase to borrow for, or a use for
          irregular income. Creating a proposal records your agreement; your
          partner must approve the same amount and terms. Private line-of-credit
          balances never appear here.
        </p>
        <form
          className="form-grid lower"
          onSubmit={(e) => void submit(e, 'rhythm:propose')}
        >
          <Field label="Proposal type">
            <NativeSelect name="kind">
              <NativeSelectOption value="borrowing">
                Shared borrowing for a household need
              </NativeSelectOption>
              <NativeSelectOption value="income_allocation">
                Agree how to use extra income
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Purpose">
            <input name="title" required maxLength={160} />
          </Field>
          <Field label="Agreed amount only">
            <input name="amount" inputMode="decimal" required />
          </Field>
          <Field label="Target date">
            <input name="date" type="date" defaultValue={now} required />
          </Field>
          <Field label="Member carrying the borrowing / income">
            <Person data={data} name="carrier_id" />
          </Field>
          <Field label={`${data.members[0]?.name}’s share (%)`}>
            <input
              name="percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue="50"
              required
            />
          </Field>
          <div className="full">
            <Field label="Terms / destination / repayment plan">
              <textarea
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="For example: needed baby equipment; only this amount is shared. Or: monthly computer-work money goes to date nights."
              />
            </Field>
          </div>
          <button disabled={busy} className="primary full">
            Propose for my partner’s approval
          </button>
        </form>
        <div className="record-grid lower">
          {data.agreements?.map((a) => {
            const paid = (data.jointEntries ?? [])
              .filter((e) => e.agreement_id === a.id)
              .reduce((n, e) => n + e.amount_cents, 0);
            return (
              <article className="panel" key={a.id}>
                <span className="badge shared">
                  {a.approved_by ? 'Both agreed' : 'Awaiting partner approval'}
                </span>
                <h3 className="lower">{a.title}</h3>
                <p>
                  {fmt(a.amount_cents)} ·{' '}
                  {a.kind === 'borrowing'
                    ? 'Borrowing'
                    : 'Extra-income allocation'}
                </p>
                <p className="hint">
                  Carried by {name(a.carrier_id)} · {a.date}
                  <br />
                  {data.members[0]?.name}: {a.split_bps / 100}% ·{' '}
                  {data.members[1]?.name ?? 'Partner'}:{' '}
                  {100 - a.split_bps / 100}%
                </p>
                <p className="muted lower">{a.note}</p>
                {!a.approved_by && a.creator_id !== data.member.id && (
                  <button
                    className="secondary lower"
                    disabled={busy}
                    onClick={() =>
                      void mutate({ action: 'rhythm:approve', id: a.id })
                    }
                  >
                    <Check size={15} /> I agree to these terms
                  </button>
                )}
                {a.approved_by && a.kind === 'borrowing' && (
                  <>
                    <p className="hint">
                      Agreed balance remaining: {fmt(a.amount_cents - paid)}. My
                      original agreed share:{' '}
                      {fmt(
                        allocation(a.amount_cents, a.split_bps)[
                          data.member.slot - 1
                        ],
                      )}
                      . My payments so far:{' '}
                      {fmt(
                        (data.jointEntries ?? [])
                          .filter(
                            (e) =>
                              e.agreement_id === a.id &&
                              e.member_id === data.member.id,
                          )
                          .reduce((n, e) => n + e.amount_cents, 0),
                      )}
                      . Personal borrowing and interest are excluded.
                    </p>
                    <form
                      className="form-grid lower"
                      onSubmit={(e) =>
                        void submit(e, 'rhythm:repay', { id: a.id })
                      }
                    >
                      <Field label="Payment I made from my account">
                        <input name="amount" required inputMode="decimal" />
                      </Field>
                      <Field label="Paid on">
                        <input
                          name="date"
                          type="date"
                          max={now}
                          defaultValue={now}
                          required
                        />
                      </Field>
                      <button className="secondary full" disabled={busy}>
                        Record agreed-borrowing payment
                      </button>
                    </form>
                  </>
                )}
                {a.approved_by && a.kind === 'income_allocation' && (
                  <p className="hint">
                    Agreement recorded. It does not move money: record a deposit
                    or private payment only after it happens.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel lower" id="joint-log">
        <h2>Shared transfer and repayment log</h2>
        <p className="hint">
          Deposits and card clears move joint cash; agreed-borrowing payments
          are from the named member’s own account. Undo an incorrect entry to
          correct it. Removing a card clear reserves the purchase again.
        </p>
        {data.jointEntries?.map((e) => (
          <div className="event-row" key={e.id}>
            <div className="event-name">
              <b>{e.title}</b>
              <small>
                {e.date} · {name(e.member_id)} · Shared
              </small>
            </div>
            <b>{fmt(e.amount_cents)}</b>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemoving(e.id)}
            >
              Undo
            </button>
          </div>
        ))}
      </section>
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Undo this recorded entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This updates the notebook balance. It does not reverse a bank
            transfer. A scheduled contribution becomes unpaid again, or a card
            purchase becomes reserved again.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep entry</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (
                  await mutate({ action: 'rhythm:removeEntry', id: removing })
                )
                  setRemoving(null);
              }}
            >
              Undo entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
