import type { Database } from './service.ts';
import { cents, dateValid, dates, today, type Notebook } from './domain.ts';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const titleOf = (v: unknown) => {
  const s = str(v).trim();
  if (!s || s.length > 160)
    throw new Error('Enter a description of 1–160 characters.');
  return s;
};
const positive = (v: unknown) => {
  const n = cents(v);
  if (!n) throw new Error('Enter an amount greater than zero.');
  return n;
};
const actualDate = (v: unknown) => {
  if (!dateValid(v) || v > today())
    throw new Error('Enter an actual date of today or earlier.');
  return v;
};

export async function handleRhythm(
  db: Database,
  book: Notebook,
  body: Record<string, unknown>,
) {
  const { member, household } = book,
    action = body.action;
  if (action === 'rhythm:setup') {
    if (!dateValid(body.anchor))
      throw new Error('Choose the first day of your two-week cycle.');
    const date = actualDate(body.date),
      opening = cents(body.opening),
      target = cents(body.target);
    if (
      ((book.jointEntries?.length ?? 0) > 0 ||
        book.records.some((r) => r.account === 'joint')) &&
      (opening !== household.joint_opening_cents ||
        date !== household.joint_opening_date)
    )
      throw new Error(
        'The opening snapshot is locked once joint activity exists. Record a deposit or spending entry instead.',
      );
    await db
      .prepare(
        'UPDATE households SET cycle_anchor=?,joint_opening_date=?,joint_opening_cents=?,joint_target_cents=? WHERE id=?',
      )
      .bind(body.anchor, date, opening, target, household.id)
      .run();
  } else if (action === 'rhythm:privatePlan') {
    await db
      .prepare(
        'UPDATE members SET fixed_reserve_cents=?,allowance_cents=? WHERE id=? AND household_id=?',
      )
      .bind(cents(body.fixed), cents(body.allowance), member.id, household.id)
      .run();
  } else if (action === 'rhythm:deposit') {
    const date = actualDate(body.date),
      amount = positive(body.amount),
      person = str(body.member_id) || member.id;
    if (!book.members.some((m) => m.id === person))
      throw new Error('Choose a household member.');
    if (date < (household.joint_opening_date ?? date))
      throw new Error('Deposit is before the joint opening snapshot.');
    let source: string | null = null;
    if (body.schedule_id) {
      const schedule = book.records.find(
        (r) => r.id === body.schedule_id && r.kind === 'funding' && !r.owner_id,
      );
      if (
        !schedule ||
        !dateValid(body.occurrence) ||
        !dates(schedule, body.occurrence, body.occurrence).length
      )
        throw new Error('Funding occurrence not found.');
      if (schedule.amount_cents !== amount || schedule.payer_id !== person)
        throw new Error('Use the scheduled contributor and amount.');
      source = `${schedule.id}:${body.occurrence}`;
    }
    await db
      .prepare(
        "INSERT INTO joint_entries (id,household_id,member_id,kind,amount_cents,date,title,source_id) VALUES (?,?,?,'deposit',?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        household.id,
        person,
        amount,
        date,
        titleOf(body.title),
        source,
      )
      .run();
  } else if (action === 'rhythm:clearCard') {
    const r = book.records.find(
      (r) =>
        r.id === body.id &&
        r.owner_id === null &&
        r.account === 'joint' &&
        r.payment_method === 'card' &&
        r.kind === 'transaction',
    );
    if (!r) throw new Error('Joint card purchase not found.');
    const date = actualDate(body.date);
    if (date < r.date)
      throw new Error('Card repayment cannot precede the purchase.');
    await db
      .prepare(
        "INSERT INTO joint_entries (id,household_id,member_id,kind,amount_cents,date,title,source_id) VALUES (?,?,?,'card_clear',?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        household.id,
        member.id,
        r.amount_cents,
        date,
        `Card repayment: ${r.title}`,
        r.id,
      )
      .run();
  } else if (action === 'rhythm:propose') {
    const kind = str(body.kind);
    if (!['borrowing', 'income_allocation'].includes(kind))
      throw new Error('Choose borrowing or irregular-income allocation.');
    const amount = positive(body.amount),
      split = Number(body.split_bps ?? 5000),
      carrier = str(body.carrier_id) || member.id;
    if (!Number.isInteger(split) || split < 0 || split > 10000)
      throw new Error('Split must be between 0 and 100 percent.');
    if (!book.members.some((m) => m.id === carrier))
      throw new Error('Choose a household member carrying this amount.');
    if (!dateValid(body.date)) throw new Error('Choose a valid target date.');
    const note = str(body.note);
    if (note.length > 2000)
      throw new Error('Keep the agreement under 2,000 characters.');
    await db
      .prepare(
        'INSERT INTO agreements (id,household_id,creator_id,carrier_id,kind,title,amount_cents,split_bps,date,note) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        household.id,
        member.id,
        carrier,
        kind,
        titleOf(body.title),
        amount,
        split,
        body.date,
        note,
      )
      .run();
  } else if (action === 'rhythm:approve') {
    const a = book.agreements?.find((a) => a.id === body.id);
    if (!a || a.creator_id === member.id || a.approved_by)
      throw new Error(
        'Only the other household member can approve a pending proposal.',
      );
    await db
      .prepare(
        'UPDATE agreements SET approved_by=? WHERE id=? AND household_id=? AND approved_by IS NULL AND creator_id<>?',
      )
      .bind(member.id, a.id, household.id, member.id)
      .run();
  } else if (action === 'rhythm:repay') {
    const a = book.agreements?.find(
      (a) => a.id === body.id && a.kind === 'borrowing' && a.approved_by,
    );
    if (!a) throw new Error('Approved shared borrowing not found.');
    const amount = positive(body.amount),
      date = actualDate(body.date),
      id = crypto.randomUUID();
    // Conditional insertion protects against concurrent repayments exceeding principal.
    await db
      .prepare(
        "INSERT INTO joint_entries (id,household_id,member_id,kind,amount_cents,date,title,agreement_id) SELECT ?,?,?,'debt_payment',?,?,?,? WHERE ? <= ? - COALESCE((SELECT SUM(amount_cents) FROM joint_entries WHERE agreement_id=? AND kind='debt_payment'),0)",
      )
      .bind(
        id,
        household.id,
        member.id,
        amount,
        date,
        `Agreed borrowing payment: ${a.title}`,
        a.id,
        amount,
        a.amount_cents,
        a.id,
      )
      .run();
    if (
      !(await db
        .prepare('SELECT id FROM joint_entries WHERE id=?')
        .bind(id)
        .first())
    )
      throw new Error('Payment exceeds the remaining agreed borrowing.');
  } else if (action === 'rhythm:removeEntry') {
    if (!book.jointEntries?.some((e) => e.id === body.id))
      throw new Error('Entry not found.');
    await db
      .prepare('DELETE FROM joint_entries WHERE id=? AND household_id=?')
      .bind(body.id, household.id)
      .run();
  } else throw new Error('Unknown household-rhythm action.');
  return { ok: true };
}
