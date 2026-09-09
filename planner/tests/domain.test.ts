import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocation,
  cents,
  dateValid,
  dates,
  forecast,
  events,
  icsExport,
  reimbursement,
  validateRecord,
  budgetRows,
  jointSummary,
  type Notebook,
  type RecordItem,
  type Member,
} from '../lib/domain.ts';
const me: Member = { id: 'a', household_id: 'h', name: 'Alex', slot: 1 },
  partner: Member = { id: 'c', household_id: 'h', name: 'Cheryl', slot: 2 };
const category = { id: 'food', household_id: 'h', name: 'Food' };
function record(changes: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r',
    household_id: 'h',
    owner_id: null,
    kind: 'bill',
    title: 'Rent',
    amount_cents: 10001,
    date: '2026-01-31',
    end_date: null,
    frequency: 'monthly',
    category_id: 'food',
    split_bps: 5000,
    payer_id: 'a',
    note: '',
    priority: 'medium',
    balance_cents: null,
    saved_cents: 0,
    source_id: null,
    occurrence_date: null,
    completed: 0,
    remind_days: 3,
    created_at: '2026-01-01',
    ...changes,
  };
}
void test('split conserves every cent, including zero/full percentages', () => {
  assert.deepEqual(allocation(10001, 5000), [5001, 5000]);
  assert.deepEqual(allocation(9, 0), [0, 9]);
  assert.deepEqual(allocation(9, 10000), [9, 0]);
  for (let total = 1; total < 500; total++)
    for (const bps of [1, 3333, 6000, 9999])
      assert.equal(
        allocation(total, bps).reduce((a, b) => a + b),
        total,
      );
});
void test('decimal entry is exact and rejects NaN, negatives, exponents and excessive precision', () => {
  assert.equal(cents('0.29'), 29);
  for (const value of ['-1', 'NaN', '1e4', '1.001', 'Infinity', '10000001'])
    assert.throws(() => cents(value));
});
void test('dates reject impossible calendar dates without throwing', () => {
  for (const d of ['2026-02-30', '2026-13-01', 'x', '1999-01-01', '2101-01-01'])
    assert.equal(dateValid(d), false);
  assert.equal(dateValid('2028-02-29'), true);
});
void test('month-end recurrence clamps February and restores March 31', () => {
  assert.deepEqual(dates(record(), '2026-01-01', '2026-04-30'), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
});
void test('leap-day yearly recurrence restores leap day, and end dates are inclusive', () => {
  assert.deepEqual(
    dates(
      record({
        date: '2024-02-29',
        frequency: 'yearly',
        end_date: '2028-02-29',
      }),
      '2024-01-01',
      '2029-01-01',
    ),
    ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
  );
});
void test('biweekly paydays cross a year and completed schedules stop', () => {
  assert.deepEqual(
    dates(
      record({ date: '2026-12-25', frequency: 'biweekly' }),
      '2026-12-01',
      '2027-02-01',
    ),
    ['2026-12-25', '2027-01-08', '2027-01-22'],
  );
  assert.deepEqual(
    dates(record({ completed: 1 }), '2026-01-01', '2027-01-01'),
    [],
  );
});
void test('shared debt and income are rejected and private ownership cannot be forged', () => {
  const base = {
    kind: 'debt',
    scope: 'shared',
    title: 'Loan',
    date: '2026-01-01',
    amount: '10',
  };
  assert.throws(
    () => validateRecord(base, me, [me, partner], [category]),
    /private/,
  );
  const validated = validateRecord(
    { ...base, scope: 'mine', owner_id: 'c' },
    me,
    [me, partner],
    [category],
  );
  assert.equal(validated.owner_id, 'a');
  assert.throws(
    () =>
      validateRecord(
        { ...base, kind: 'payday' },
        me,
        [me, partner],
        [category],
      ),
    /private/,
  );
});
void test('foreign category/payer and unknown ownership are rejected', () => {
  const base = {
    kind: 'transaction',
    scope: 'shared',
    title: 'Food',
    date: '2026-01-01',
    amount: '1',
    payer_id: 'a',
  };
  assert.throws(
    () =>
      validateRecord(
        { ...base, payer_id: 'outsider' },
        me,
        [me, partner],
        [category],
      ),
    /paid/,
  );
  assert.throws(
    () =>
      validateRecord(
        { ...base, category_id: 'outside' },
        me,
        [me, partner],
        [category],
      ),
    /category/,
  );
  assert.throws(
    () =>
      validateRecord(
        { ...base, scope: 'cheryl' },
        me,
        [me, partner],
        [category],
      ),
    /Mine or Shared/,
  );
});
void test('reimbursements close balances with correct sender direction', () => {
  const tx = record({
    kind: 'transaction',
    amount_cents: 10000,
    payer_id: 'a',
    split_bps: 6000,
  });
  assert.equal(reimbursement([tx], me), 4000);
  assert.equal(reimbursement([tx], partner), -4000);
  const settlement = record({
    id: 's',
    kind: 'settlement',
    amount_cents: 4000,
    payer_id: 'c',
  });
  assert.equal(reimbursement([tx, settlement], me), 0);
  assert.equal(reimbursement([tx, settlement], partner), 0);
});
void test('paid occurrences are marked and forecast counts actual payment once', () => {
  const bill = record({
    date: '2026-01-10',
    frequency: 'once',
    amount_cents: 10000,
  });
  const paid = record({
    id: 'p',
    kind: 'transaction',
    source_id: 'r',
    occurrence_date: '2026-01-10',
    date: '2026-01-11',
    frequency: 'once',
    amount_cents: 10000,
  });
  assert.equal(events([bill, paid], '2026-01-01', '2026-01-31')[0].paid, true);
  assert.equal(
    forecast([bill, paid], me, '2026-01-01', 'mine', 20000)[0].expense,
    5000,
  );
});
void test('private forecasts exclude partner data and shared outlook excludes all private income', () => {
  const mine = record({
      id: 'salary',
      owner_id: 'a',
      kind: 'payday',
      amount_cents: 100000,
      date: '2026-01-01',
    }),
    secret = record({
      id: 'secret',
      owner_id: 'c',
      kind: 'debt',
      amount_cents: 9000000,
      date: '2026-01-01',
    });
  const out = forecast([mine, secret, record()], me, '2026-01-01', 'mine', 0);
  assert.equal(out[0].income, 100000);
  assert.equal(out[0].expense, 5001);
  assert.equal(
    forecast([mine, secret, record()], me, '2026-01-01', 'shared', 0)[0].income,
    0,
  );
});
void test('cash pressure identifies a shortfall before a later payday even with positive month end', () => {
  const bill = record({ date: '2026-01-02', amount_cents: 20000 }),
    pay = record({
      id: 'income',
      owner_id: 'a',
      kind: 'payday',
      amount_cents: 50000,
      date: '2026-01-20',
    });
  const out = forecast([bill, pay], me, '2026-01-01', 'mine', 0)[0];
  assert.equal(out.low, -10000);
  assert.equal(out.balance, 40000);
  assert.equal(out.pressure[0].date, '2026-01-02');
  assert.equal(out.drivers[0].title, 'Rent');
});
void test('calendar shared export omits private titles, notes and monetary amounts; folds Unicode safely', () => {
  const privateEvent = record({
      id: 'private',
      owner_id: 'a',
      title: 'Secret debt',
      kind: 'debt',
    }),
    shared = record({
      title: 'Shared, event;\n' + 'é'.repeat(90),
      note: 'SECRET NOTE',
    });
  const output = icsExport(
    events([shared, privateEvent], '2026-01-01', '2026-02-01'),
  );
  assert(!output.includes('Secret debt'));
  assert(!output.includes('SECRET NOTE'));
  assert(!output.includes('10001'));
  assert(output.includes('Shared\\, event\\;\\n'));
  assert(output.includes('TRIGGER:-P3D'));
  for (const line of output.split('\r\n'))
    assert(new TextEncoder().encode(line).length <= 75);
  assert(
    icsExport(
      events([privateEvent], '2026-01-01', '2026-02-01'),
      false,
    ).includes('[Mine] Secret debt'),
  );
});
void test('monthly category review separates shared totals and private spending', () => {
  const plan = record({
      kind: 'budget',
      date: '2026-01-01',
      amount_cents: 20000,
    }),
    actual = record({ kind: 'transaction', amount_cents: 15000 });
  const own = record({
    kind: 'transaction',
    owner_id: 'a',
    amount_cents: 7000,
  });
  const row = budgetRows(
    [plan, actual, own],
    [category],
    '2026-01',
    'shared',
    me,
  )[0];
  assert.equal(row.actual, 15000);
  assert.equal(row.difference, 5000);
  assert.equal(
    budgetRows([plan, actual, own], [category], '2026-01', 'mine', me)[0]
      .actual,
    7000,
  );
});

void test('older opening snapshots roll forward into the requested coming-year window', () => {
  const salary = record({
    id: 'pay',
    kind: 'payday',
    owner_id: 'a',
    amount_cents: 10000,
    date: '2025-01-01',
    frequency: 'monthly',
  });
  const rows = forecast([salary], me, '2025-01-01', 'mine', 5000, '2026-09-01');
  assert.equal(rows[0].month, '2026-09');
  assert.equal(rows.at(-1)!.month, '2027-08');
  assert.equal(rows[0].balance, 215000);
});

void test('reminders and review events save without an amount', () => {
  for (const kind of ['reminder', 'review']) {
    const result = validateRecord(
      {
        kind,
        scope: 'shared',
        title: 'A moment to pause',
        amount: '',
        date: '2026-09-28',
      },
      me,
      [me, partner],
      [category],
    );
    assert.equal(result.amount_cents, 0);
  }
});

void test('twice-monthly schedules produce 24 paydays, clamp month end, and respect the start/end', () => {
  const schedule = record({
    date: '2028-01-01',
    frequency: 'semimonthly',
    second_day: 31,
  });
  const result = dates(schedule, '2028-01-01', '2028-12-31');
  assert.equal(result.length, 24);
  assert(result.includes('2028-02-29'));
  assert.deepEqual(
    dates({ ...schedule, end_date: '2028-02-29' }, '2028-02-02', '2028-04-01'),
    ['2028-02-29'],
  );
  assert.equal(
    dates(
      { ...schedule, frequency: 'every_two_months' },
      '2028-01-01',
      '2028-12-31',
    ).length,
    6,
  );
  assert.throws(
    () =>
      validateRecord(
        {
          kind: 'payday',
          scope: 'mine',
          title: 'Pay',
          amount: '1',
          date: '2028-01-20',
          frequency: 'semimonthly',
          second_day: 15,
        },
        me,
        [me, partner],
        [category],
      ),
    /later second day/,
  );
});

void test('extra income is excluded until received, without duplicating a lump sum', () => {
  const extra = record({
    id: 'extra',
    kind: 'payday',
    owner_id: 'a',
    date: '2026-01-10',
    amount_cents: 75000,
    frequency: 'once',
    dependable: 0,
    received: 0,
  });
  assert.equal(forecast([extra], me, '2026-01-01', 'mine')[0].income, 0);
  const received = forecast(
    [{ ...extra, received: 1 }],
    me,
    '2026-01-01',
    'mine',
  );
  assert.equal(received[0].income, 75000);
  assert.equal(received[1].income, 0);
});

void test('joint card purchases reserve once; repayment changes bank cash but not available cash', () => {
  const book: Notebook = {
    member: me,
    members: [me, partner],
    categories: [category],
    household: {
      id: 'h',
      name: 'Home',
      currency: 'CAD',
      cycle_anchor: '2026-01-01',
      joint_opening_date: '2026-01-01',
      joint_opening_cents: 10000,
    },
    records: [
      record({
        id: 'shop',
        kind: 'transaction',
        account: 'joint',
        payment_method: 'card',
        date: '2026-01-03',
        amount_cents: 2500,
      }),
    ],
    jointEntries: [],
  };
  const before = jointSummary(book, '2026-01-04');
  assert.equal(before.bank, 10000);
  assert.equal(before.reserved, 2500);
  assert.equal(before.available, 7500);
  book.jointEntries = [
    {
      id: 'clear',
      household_id: 'h',
      member_id: 'a',
      kind: 'card_clear',
      amount_cents: 2500,
      date: '2026-01-04',
      title: 'Card',
      source_id: 'shop',
    },
  ];
  const after = jointSummary(book, '2026-01-04');
  assert.equal(after.bank, 7500);
  assert.equal(after.reserved, 0);
  assert.equal(after.available, 7500);
  const next = jointSummary(book, '2026-01-15');
  assert.equal(next.start, '2026-01-15');
  assert.equal(next.carryover, 7500);
  assert.equal(next.cycleSpent, 0);
  assert.equal(reimbursement(book.records, me), 0);
});

void test('joint contribution replaces its expected occurrence and is a private transfer, not salary', () => {
  const plan = record({
    id: 'fund',
    kind: 'funding',
    amount_cents: 50000,
    date: '2026-01-01',
    frequency: 'once',
    payer_id: 'a',
  });
  const shopping = record({
    id: 'food',
    kind: 'transaction',
    amount_cents: 10000,
    account: 'joint',
    date: '2026-01-03',
  });
  const entries = [
    {
      id: 'deposit',
      household_id: 'h',
      member_id: 'a',
      kind: 'deposit',
      amount_cents: 50000,
      date: '2026-01-01',
      title: 'Joint transfer',
      source_id: 'fund:2026-01-01',
    },
  ];
  const own = forecast(
    [plan, shopping],
    me,
    '2026-01-01',
    'mine',
    0,
    '2026-01-01',
    entries,
  )[0];
  assert.equal(own.expense, 50000);
  assert.equal(own.income, 0);
  const shared = forecast(
    [plan, shopping],
    me,
    '2026-01-01',
    'shared',
    0,
    '2026-01-01',
    entries,
  )[0];
  assert.equal(shared.income, 50000);
  assert.equal(shared.expense, 10000);
  assert.equal(
    events([plan], '2026-01-01', '2026-01-31', entries)[0].paid,
    true,
  );
  assert.equal(
    forecast([plan], partner, '2026-01-01', 'mine', 0, '2026-01-01', entries)[0]
      .expense,
    0,
  );
});
