export const kinds = [
  'transaction',
  'bill',
  'subscription',
  'debt',
  'purchase',
  'goal',
  'payday',
  'funding',
  'reminder',
  'review',
  'budget',
  'settlement',
] as const;
export type Kind = (typeof kinds)[number];
export const frequencies = [
  'once',
  'weekly',
  'biweekly',
  'semimonthly',
  'every_two_months',
  'monthly',
  'quarterly',
  'yearly',
] as const;
export type Frequency = (typeof frequencies)[number];
export type Member = {
  id: string;
  household_id: string;
  name: string;
  slot: number;
  opening_cents?: number;
  opening_date?: string;
  fixed_reserve_cents?: number;
  allowance_cents?: number;
};
export type Category = { id: string; name: string; household_id: string };
export type RecordItem = {
  id: string;
  household_id: string;
  owner_id: string | null;
  kind: Kind;
  title: string;
  amount_cents: number;
  date: string;
  end_date: string | null;
  frequency: Frequency;
  category_id: string | null;
  split_bps: number;
  payer_id: string | null;
  note: string;
  priority: string;
  balance_cents: number | null;
  saved_cents: number;
  source_id: string | null;
  occurrence_date: string | null;
  completed: number;
  remind_days: number;
  created_at: string;
  second_day?: number;
  dependable?: number;
  received?: number;
  account?: string;
  payment_method?: string;
  spending_bucket?: string;
};
export type Notebook = {
  member: Member;
  members: Member[];
  household: {
    id: string;
    name: string;
    currency: string;
    cycle_anchor?: string;
    joint_opening_cents?: number;
    joint_opening_date?: string;
    joint_target_cents?: number;
  };
  jointEntries?: JointEntry[];
  agreements?: Agreement[];
  categories: Category[];
  records: RecordItem[];
};
export type JointEntry = {
  id: string;
  household_id: string;
  member_id: string;
  kind: string;
  amount_cents: number;
  date: string;
  title: string;
  source_id: string | null;
  agreement_id?: string | null;
};
export type Agreement = {
  id: string;
  household_id: string;
  creator_id: string;
  approved_by: string | null;
  carrier_id: string;
  kind: string;
  title: string;
  amount_cents: number;
  split_bps: number;
  date: string;
  note: string;
};
export type Event = {
  id: string;
  record: RecordItem;
  date: string;
  paid: boolean;
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Moncton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function dateValid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '2000-01-01' &&
    value <= '2100-12-31' &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function addMonths(date: string, count: number) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + count + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + count, Math.min(d, last), 12))
    .toISOString()
    .slice(0, 10);
}
export function monthLabel(month: string) {
  return new Date(month.slice(0, 7) + '-01T12:00:00Z').toLocaleDateString(
    'en-CA',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );
}
export function money(cents: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(
    cents / 100,
  );
}
export function cents(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a positive amount with at most two decimals.');
  const [whole, frac = ''] = value.split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (n > 1e9) throw new Error('Amount is too large.');
  return n;
}
export function allocation(total: number, bps: number): [number, number] {
  const first = Math.round((total * bps) / 10000);
  return [first, total - first];
}
export function visible(
  record: Pick<RecordItem, 'household_id' | 'owner_id'>,
  member: Member,
) {
  return (
    record.household_id === member.household_id &&
    (record.owner_id === null || record.owner_id === member.id)
  );
}
export function myShare(record: RecordItem, member: Member) {
  return record.owner_id
    ? record.amount_cents
    : allocation(record.amount_cents, record.split_bps)[member.slot - 1];
}
export function dates(
  record: Pick<
    RecordItem,
    'date' | 'end_date' | 'frequency' | 'completed' | 'second_day'
  >,
  from: string,
  to: string,
) {
  if (record.completed) return [];
  const result: string[] = [];
  if (record.frequency === 'semimonthly') {
    const first = Number(record.date.slice(8));
    for (let i = 0; i < 1213; i++) {
      const month = addMonths(record.date.slice(0, 7) + '-01', i);
      if (month > to) break;
      const last = Number(addDays(addMonths(month, 1), -1).slice(8));
      for (const day of new Set([
        Math.min(first, last),
        Math.min(record.second_day ?? 15, last),
      ])) {
        const date = month.slice(0, 8) + String(day).padStart(2, '0');
        if (
          date >= record.date &&
          date >= from &&
          date <= to &&
          (!record.end_date || date <= record.end_date)
        )
          result.push(date);
      }
    }
    return result;
  }
  for (let i = 0; i < 5300; i++) {
    let date = record.date;
    if (record.frequency === 'weekly') date = addDays(record.date, 7 * i);
    else if (record.frequency === 'biweekly')
      date = addDays(record.date, 14 * i);
    else if (record.frequency !== 'once')
      date = addMonths(
        record.date,
        i *
          (record.frequency === 'monthly'
            ? 1
            : record.frequency === 'every_two_months'
              ? 2
              : record.frequency === 'quarterly'
                ? 3
                : 12),
      );
    if (date > to || (record.end_date && date > record.end_date)) break;
    if (date >= from) result.push(date);
    if (record.frequency === 'once') break;
  }
  return result;
}
export function events(
  records: RecordItem[],
  from: string,
  to: string,
  entries: JointEntry[] = [],
): Event[] {
  const paid = new Set(
    records
      .filter((r) => r.kind === 'transaction' && r.source_id)
      .map((r) => `${r.source_id}:${r.occurrence_date}`),
  );
  for (const e of entries)
    if (e.kind === 'deposit' && e.source_id) paid.add(e.source_id);
  return records
    .filter((r) => !['transaction', 'budget', 'settlement'].includes(r.kind))
    .flatMap((record) =>
      dates(record, from, to).map((date) => ({
        id: `${record.id}:${date}`,
        record,
        date,
        paid: paid.has(`${record.id}:${date}`),
      })),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.record.title.localeCompare(b.record.title),
    );
}
export function reimbursement(records: RecordItem[], member: Member) {
  return records
    .filter((r) => !r.owner_id && !r.completed && r.account !== 'joint')
    .reduce((n, r) => {
      if (r.kind === 'transaction')
        return (
          n +
          (r.payer_id === member.id ? r.amount_cents : 0) -
          myShare(r, member)
        );
      if (r.kind === 'settlement')
        return (
          n + (r.payer_id === member.id ? r.amount_cents : -r.amount_cents)
        );
      return n;
    }, 0);
}
export function budgetRows(
  records: RecordItem[],
  categories: Category[],
  month: string,
  scope: string,
  member: Member,
) {
  const filtered = records.filter(
    (r) =>
      r.date.startsWith(month) &&
      (scope === 'shared' ? r.owner_id === null : r.owner_id === member.id),
  );
  return categories.map((category) => {
    const budget = filtered.find(
      (r) => r.kind === 'budget' && r.category_id === category.id,
    );
    const actual = filtered
      .filter((r) => r.kind === 'transaction' && r.category_id === category.id)
      .reduce((n, r) => n + r.amount_cents, 0);
    return {
      category,
      budget,
      planned: budget?.amount_cents ?? 0,
      actual,
      difference: (budget?.amount_cents ?? 0) - actual,
    };
  });
}
export function forecast(
  records: RecordItem[],
  member: Member,
  start: string,
  scope: 'mine' | 'shared',
  opening = 0,
  displayFrom = start,
  entries: JointEntry[] = [],
) {
  const to = addDays(addMonths(displayFrom.slice(0, 7) + '-01', 12), -1);
  const relevant = records.filter(
    (r) => visible(r, member) && (scope !== 'shared' || r.owner_id === null),
  );
  const upcoming = events(relevant, start, to, entries).filter(
    (e) =>
      !e.paid &&
      !['goal', 'review', 'reminder'].includes(e.record.kind) &&
      !(
        e.record.kind === 'payday' &&
        e.record.dependable === 0 &&
        e.record.received !== 1
      ),
  );
  const movements = upcoming.map((e) => {
    const income =
      scope === 'shared'
        ? e.record.kind === 'funding'
        : e.record.kind === 'payday';
    const excluded =
      scope === 'mine' &&
      e.record.kind === 'funding' &&
      e.record.payer_id !== member.id;
    return {
      date: e.date,
      title: e.record.title,
      income: income ? e.record.amount_cents : 0,
      expense:
        income || excluded
          ? 0
          : scope === 'shared'
            ? e.record.amount_cents
            : e.record.kind === 'funding'
              ? e.record.amount_cents
              : myShare(e.record, member),
    };
  });
  // Existing actual transactions dated after the opening snapshot are cash movements;
  // a paid recurring occurrence is removed above so it is never counted twice.
  for (const r of relevant.filter(
    (r) =>
      r.kind === 'transaction' &&
      r.date >= start &&
      r.date <= to &&
      (scope === 'shared' || r.account !== 'joint'),
  ))
    movements.push({
      date: r.date,
      title: r.title,
      income: 0,
      expense: scope === 'shared' ? r.amount_cents : myShare(r, member),
    });
  for (const e of entries.filter(
    (e) =>
      e.household_id === member.household_id && e.date >= start && e.date <= to,
  )) {
    if (e.kind === 'deposit')
      movements.push({
        date: e.date,
        title: e.title,
        income: scope === 'shared' ? e.amount_cents : 0,
        expense:
          scope === 'mine' && e.member_id === member.id ? e.amount_cents : 0,
      });
    if (e.kind === 'debt_payment')
      movements.push({
        date: e.date,
        title: e.title,
        income: 0,
        expense:
          scope === 'shared' || e.member_id === member.id ? e.amount_cents : 0,
      });
  }
  let balance = opening;
  const daily = movements
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ ...m, balance: (balance += m.income - m.expense) }));
  return Array.from({ length: 12 }, (_, i) => {
    const from = addMonths(displayFrom.slice(0, 7) + '-01', i);
    const month = from.slice(0, 7);
    const rows = daily.filter((d) => d.date.startsWith(month));
    const previous =
      daily.filter((d) => d.date < from).at(-1)?.balance ?? opening;
    return {
      month,
      income: rows.reduce((n, r) => n + r.income, 0),
      expense: rows.reduce((n, r) => n + r.expense, 0),
      balance: rows.at(-1)?.balance ?? previous,
      low: Math.min(previous, ...rows.map((r) => r.balance)),
      drivers: rows
        .filter((r) => r.expense > 0)
        .sort((a, b) => b.expense - a.expense)
        .slice(0, 3),
      pressure: rows.filter((r) => r.balance < 0),
    };
  });
}
export function icsExport(list: Event[], sharedOnly = true) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Together//Budget Notebook//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of list.filter(
    (e) => !e.paid && (!sharedOnly || e.record.owner_id === null),
  )) {
    const r = event.record;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@together-budget`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z/, 'Z')}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, '')}`,
      `SUMMARY:${escape((r.owner_id ? '[Mine] ' : '[Shared] ') + r.title)}`,
      'CLASS:PRIVATE',
    );
    if (r.remind_days > 0)
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Budget reminder',
        `TRIGGER:-P${r.remind_days}D`,
        'END:VALARM',
      );
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return (
    lines
      .map((line) => {
        let out = '',
          current = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (current + size > 73) {
            out += '\r\n ';
            current = 1;
          }
          out += char;
          current += size;
        }
        return out;
      })
      .join('\r\n') + '\r\n'
  );
}
export function validateRecord(
  input: Record<string, unknown>,
  member: Member,
  members: Member[],
  categories: Category[],
): Omit<RecordItem, 'id' | 'created_at'> {
  const kind = input.kind as Kind;
  if (!kinds.includes(kind)) throw new Error('Choose a valid item type.');
  if (
    typeof input.scope !== 'string' ||
    !['mine', 'shared'].includes(input.scope)
  )
    throw new Error('Choose Mine or Shared.');
  const shared = input.scope === 'shared';
  if (shared && ['debt', 'payday'].includes(kind))
    throw new Error('Debts and pay schedules must remain private.');
  if (!shared && ['funding', 'settlement'].includes(kind))
    throw new Error('Household funding and reimbursements must be shared.');
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.length > 160
  )
    throw new Error('Add a title of 1–160 characters.');
  if (!dateValid(input.date))
    throw new Error('Enter a valid date between 2000 and 2100.');
  const frequency = (input.frequency ?? 'once') as Frequency;
  if (!frequencies.includes(frequency))
    throw new Error('Choose a valid frequency.');
  const secondDay = Number(input.second_day ?? 15);
  if (!Number.isInteger(secondDay) || secondDay < 2 || secondDay > 31)
    throw new Error('Second payday must be day 2–31.');
  if (
    frequency === 'semimonthly' &&
    (Number(input.date.slice(8)) > 28 ||
      Number(input.date.slice(8)) >= secondDay)
  )
    throw new Error(
      'For twice-monthly pay, choose a first day from 1–28 and a later second day.',
    );
  const account = input.account ?? 'personal',
    method = input.payment_method ?? 'debit';
  if (
    typeof account !== 'string' ||
    !['personal', 'joint'].includes(account) ||
    typeof method !== 'string' ||
    !['debit', 'card'].includes(method)
  )
    throw new Error('Choose a valid account and payment method.');
  if (account === 'joint' && (!shared || kind !== 'transaction'))
    throw new Error('Joint spending must be a shared transaction.');
  const received = input.received === true ? 1 : 0;
  if (
    input.spending_bucket !== undefined &&
    !['fixed', 'discretionary'].includes(input.spending_bucket as string)
  )
    throw new Error('Choose fixed costs or personal spending.');
  if (
    received &&
    (kind !== 'payday' || frequency !== 'once' || input.date > today())
  )
    throw new Error(
      'Received income must be a one-off payday dated today or earlier.',
    );
  if (
    ['transaction', 'budget', 'settlement', 'goal', 'purchase'].includes(
      kind,
    ) &&
    frequency !== 'once'
  )
    throw new Error('This item cannot repeat.');
  const end = input.end_date || null;
  if (end !== null && (!dateValid(end) || end < input.date))
    throw new Error('End date must be on or after the start date.');
  const amount = ['reminder', 'review'].includes(kind)
    ? 0
    : cents(input.amount ?? '0');
  if (
    [
      'transaction',
      'bill',
      'subscription',
      'debt',
      'purchase',
      'goal',
      'payday',
      'funding',
      'settlement',
    ].includes(kind) &&
    amount === 0
  )
    throw new Error('Amount must be greater than zero.');
  const split = Number(input.split_bps ?? 5000);
  if (!Number.isInteger(split) || split < 0 || split > 10000)
    throw new Error('Split must be between 0 and 100 percent.');
  const category = input.category_id || null;
  if (category !== null && !categories.some((c) => c.id === category))
    throw new Error('Choose a household category.');
  if (kind === 'budget' && (!category || !input.date.endsWith('-01')))
    throw new Error(
      'A monthly budget needs a category and first day of month.',
    );
  const payer = shared ? input.payer_id || null : member.id;
  if (
    shared &&
    ['transaction', 'settlement'].includes(kind) &&
    !members.some((m) => m.id === payer)
  )
    throw new Error('Choose who paid.');
  if (payer && !members.some((m) => m.id === payer))
    throw new Error('Payer must belong to this household.');
  const note = input.note ?? '';
  if (typeof note !== 'string' || note.length > 2000)
    throw new Error('Notes must be under 2,000 characters.');
  const remind = Number(input.remind_days ?? 3);
  if (!Number.isInteger(remind) || remind < 0 || remind > 90)
    throw new Error('Reminder must be 0–90 days before.');
  const priority =
    typeof input.priority === 'string' ? input.priority : 'medium';
  if (!['low', 'medium', 'high'].includes(priority))
    throw new Error('Choose a valid priority.');
  const saved = cents(input.saved ?? '0');
  if (kind === 'goal' && saved > amount)
    throw new Error('Saved amount cannot exceed the goal.');
  return {
    household_id: member.household_id,
    owner_id: shared ? null : member.id,
    kind,
    title: input.title.trim(),
    amount_cents: amount,
    date: input.date,
    end_date: end as string | null,
    frequency,
    category_id: category as string | null,
    split_bps: split,
    payer_id: payer as string | null,
    note,
    priority,
    balance_cents: input.balance ? cents(input.balance) : null,
    saved_cents: saved,
    source_id: null,
    occurrence_date: null,
    completed: input.completed === true ? 1 : 0,
    remind_days: remind,
    second_day: secondDay,
    dependable: input.dependable === false ? 0 : 1,
    received,
    account: account as string,
    payment_method: method as string,
    spending_bucket:
      input.spending_bucket === 'discretionary' ? 'discretionary' : 'fixed',
  };
}

export function jointSummary(book: Notebook, now = today()) {
  const h = book.household,
    anchor = h.cycle_anchor ?? now;
  const elapsed = Math.floor(
    (Date.parse(now + 'T12:00:00Z') - Date.parse(anchor + 'T12:00:00Z')) /
      86400000,
  );
  const start = addDays(anchor, Math.floor(elapsed / 14) * 14),
    end = addDays(start, 13);
  const openingDate = h.joint_opening_date ?? now;
  const entries = (book.jointEntries ?? []).filter(
    (e) => e.date <= now && e.date >= openingDate,
  );
  const spending = book.records.filter(
    (r) =>
      r.kind === 'transaction' &&
      r.account === 'joint' &&
      r.date <= now &&
      r.date >= openingDate,
  );
  const deposits = entries
    .filter((e) => e.kind === 'deposit')
    .reduce((n, e) => n + e.amount_cents, 0);
  const clears = entries.filter((e) => e.kind === 'card_clear');
  const debit = spending
    .filter((r) => r.payment_method !== 'card')
    .reduce((n, r) => n + r.amount_cents, 0);
  const pending = spending.filter(
    (r) =>
      r.payment_method === 'card' && !clears.some((e) => e.source_id === r.id),
  );
  const bank =
    (h.joint_opening_cents ?? 0) +
    deposits -
    debit -
    clears.reduce((n, e) => n + e.amount_cents, 0);
  const reserved = pending.reduce((n, r) => n + r.amount_cents, 0);
  const cycleSpent = spending
    .filter((r) => r.date >= start)
    .reduce((n, r) => n + r.amount_cents, 0);
  const cycleDeposits = entries
    .filter((e) => e.kind === 'deposit' && e.date >= start)
    .reduce((n, e) => n + e.amount_cents, 0);
  return {
    start,
    end,
    bank,
    reserved,
    available: bank - reserved,
    cycleSpent,
    cycleDeposits,
    carryover: bank - reserved - cycleDeposits + cycleSpent,
    pending,
  };
}
