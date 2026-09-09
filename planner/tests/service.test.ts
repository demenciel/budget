import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import {
  handleAction,
  getMember,
  loadNotebook,
  exportCalendar,
  type Database,
  type Statement,
} from '../lib/service.ts';
import { today, addDays, jointSummary } from '../lib/domain.ts';
class Sqlite implements Database {
  raw = new DatabaseSync(':memory:');
  constructor() {
    this.raw.exec('PRAGMA foreign_keys=ON');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((f) => f.endsWith('.sql'))
      .sort())
      this.raw.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
  }
  prepare(sql: string): Statement {
    const stmt = this.raw.prepare(sql);
    let values: unknown[] = [];
    const wrapper: Statement = {
      bind(...args) {
        values = args;
        return wrapper;
      },
      async first<T>() {
        return (stmt.get(...(values as never[])) as T) ?? null;
      },
      async all<T>() {
        return { results: stmt.all(...(values as never[])) as T[] };
      },
      async run() {
        return stmt.run(...(values as never[]));
      },
    };
    return wrapper;
  }
  async batch(statements: Statement[]) {
    this.raw.exec('BEGIN');
    try {
      for (const s of statements) await s.run();
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
}
const alex = { userId: 'alex', displayName: 'Alex' },
  cheryl = { userId: 'cheryl', displayName: 'Cheryl' },
  outsider = { userId: 'outsider', displayName: 'Outside' };
async function household() {
  const db = new Sqlite();
  await handleAction(db, alex, { action: 'createHousehold', name: 'Alex' });
  const invite = await handleAction(db, alex, { action: 'invite' });
  await handleAction(db, cheryl, {
    action: 'joinHousehold',
    name: 'Cheryl',
    token: invite.token,
  });
  const a = (await getMember(db, alex))!,
    c = (await getMember(db, cheryl))!;
  return { db, a, c };
}
const save = (
  db: Sqlite,
  user: typeof alex,
  record: Record<string, unknown>,
  id?: string,
) => handleAction(db, user, { action: 'save', record, id });
const expense = {
  kind: 'transaction',
  title: 'Groceries',
  scope: 'mine',
  amount: '123.45',
  date: today(),
};
void test('real SQLite migration enforces private debts at the database boundary', async () => {
  const { db, a } = await household();
  await assert.rejects(
    () => save(db, alex, { ...expense, kind: 'debt', scope: 'shared' }),
    /private/,
  );
  await save(db, alex, { ...expense, kind: 'debt' });
  assert.throws(
    () =>
      db.raw
        .prepare("UPDATE records SET owner_id=NULL WHERE kind='debt'")
        .run(),
    /CHECK/,
  );
  assert(a.id);
  db.raw.close();
});
void test('two logins see shared and own items, never partner debts, notes or balances', async () => {
  const { db, a, c } = await household();
  await save(db, alex, {
    ...expense,
    kind: 'debt',
    title: 'Alex private debt',
    note: 'secret-A',
    balance: '1900',
  });
  await save(db, cheryl, {
    ...expense,
    kind: 'debt',
    title: 'Cheryl private debt',
    note: 'secret-C',
  });
  await save(db, alex, {
    ...expense,
    scope: 'shared',
    title: 'Shared rent',
    payer_id: a.id,
  });
  await handleAction(db, cheryl, {
    action: 'profile',
    name: 'Cheryl',
    opening: '876543.21',
    date: today(),
  });
  const av = await loadNotebook(db, a),
    cv = await loadNotebook(db, (await getMember(db, cheryl))!);
  assert.equal(av.records.length, 2);
  assert.equal(cv.records.length, 2);
  assert(!JSON.stringify(av).includes('secret-C'));
  assert(!JSON.stringify(cv).includes('secret-A'));
  assert(!JSON.stringify(av).includes('87654321'));
  assert(!JSON.stringify(av.members).includes('opening_cents'));
  assert.notEqual(a.id, c.id);
  db.raw.close();
});
void test('ID guessing cannot read/update/delete/pay partner or other household records', async () => {
  const { db, a, c } = await household();
  await save(db, alex, { ...expense, kind: 'debt', title: 'Private debt' });
  const secret = (await loadNotebook(db, a)).records[0];
  for (const action of ['delete', 'pay'])
    await assert.rejects(
      () => handleAction(db, cheryl, { action, id: secret.id, date: today() }),
      /not found/,
    );
  await assert.rejects(
    () => save(db, cheryl, { ...expense, kind: 'debt' }, secret.id),
    /not found/,
  );
  await handleAction(db, outsider, {
    action: 'createHousehold',
    name: 'Outside',
  });
  await assert.rejects(
    () => handleAction(db, outsider, { action: 'delete', id: secret.id }),
    /not found/,
  );
  assert.equal((await loadNotebook(db, c)).records.length, 0);
  db.raw.close();
});
void test('shared records are collaborative but ownership cannot be transferred', async () => {
  const { db, a, c } = await household();
  await save(db, alex, { ...expense, scope: 'shared', payer_id: a.id });
  const item = (await loadNotebook(db, a)).records[0];
  await save(
    db,
    cheryl,
    { ...expense, scope: 'shared', payer_id: c.id, title: 'Updated' },
    item.id,
  );
  assert.equal((await loadNotebook(db, a)).records[0].title, 'Updated');
  await assert.rejects(() => save(db, cheryl, expense, item.id), /ownership/);
  db.raw.close();
});
void test('invitation is hashed, expires, rotates, and can be consumed only once', async () => {
  const db = new Sqlite();
  await handleAction(db, alex, { action: 'createHousehold', name: 'Alex' });
  const first = await handleAction(db, alex, { action: 'invite' });
  const second = await handleAction(db, alex, { action: 'invite' });
  assert(
    !JSON.stringify(db.raw.prepare('SELECT * FROM invitations').all()).includes(
      String(second.token),
    ),
  );
  await assert.rejects(
    () =>
      handleAction(db, cheryl, {
        action: 'joinHousehold',
        name: 'Cheryl',
        token: first.token,
      }),
    /invalid/,
  );
  await handleAction(db, cheryl, {
    action: 'joinHousehold',
    name: 'Cheryl',
    token: second.token,
  });
  await assert.rejects(
    () =>
      handleAction(db, outsider, {
        action: 'joinHousehold',
        name: 'Outside',
        token: second.token,
      }),
    /invalid/,
  );
  await assert.rejects(
    () => handleAction(db, alex, { action: 'invite' }),
    /filled/,
  );
  assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM members').get()?.n, 2);
  db.raw.close();
});
void test('expired invites fail and joining cannot displace an existing membership', async () => {
  const db = new Sqlite();
  await handleAction(db, alex, { action: 'createHousehold', name: 'Alex' });
  const token = (await handleAction(db, alex, { action: 'invite' })).token;
  db.raw.exec("UPDATE invitations SET expires_at='2000-01-01'");
  await assert.rejects(
    () =>
      handleAction(db, cheryl, {
        action: 'joinHousehold',
        name: 'Cheryl',
        token,
      }),
    /expired/,
  );
  await assert.rejects(
    () => handleAction(db, alex, { action: 'createHousehold', name: 'Other' }),
    /already/,
  );
  db.raw.close();
});
void test('payment occurrence is unique and removing its transaction reopens it', async () => {
  const { db, a } = await household();
  await save(db, alex, {
    ...expense,
    kind: 'bill',
    scope: 'shared',
    payer_id: a.id,
  });
  const bill = (await loadNotebook(db, a)).records[0];
  await handleAction(db, alex, {
    action: 'pay',
    id: bill.id,
    date: today(),
    payer_id: a.id,
  });
  await assert.rejects(
    () =>
      handleAction(db, cheryl, {
        action: 'pay',
        id: bill.id,
        date: today(),
        payer_id: a.id,
      }),
    /UNIQUE/,
  );
  const paid = (await loadNotebook(db, a)).records.find((r) => r.source_id)!;
  await handleAction(db, alex, { action: 'delete', id: paid.id });
  await handleAction(db, cheryl, {
    action: 'pay',
    id: bill.id,
    date: today(),
    payer_id: a.id,
  });
  assert.equal((await loadNotebook(db, a)).records.length, 2);
  db.raw.close();
});
void test('monthly budget uniqueness is enforced separately for shared and each private owner', async () => {
  const { db, a } = await household();
  const plan = {
    ...expense,
    kind: 'budget',
    date: today().slice(0, 7) + '-01',
    category_id: (await loadNotebook(db, a)).categories[0].id,
  };
  await save(db, alex, { ...plan, scope: 'shared' });
  await assert.rejects(
    () => save(db, cheryl, { ...plan, scope: 'shared' }),
    /UNIQUE/,
  );
  await save(db, alex, plan);
  await save(db, cheryl, plan);
  assert.equal(
    db.raw.prepare("SELECT COUNT(*) n FROM records WHERE kind='budget'").get()
      ?.n,
    3,
  );
  db.raw.close();
});
void test('category rename keeps historical links; foreign category cannot be edited', async () => {
  const { db, a } = await household();
  const category = (await loadNotebook(db, a)).categories[0];
  await save(db, alex, { ...expense, category_id: category.id });
  await handleAction(db, cheryl, {
    action: 'category',
    id: category.id,
    name: 'Our renamed category',
  });
  const book = await loadNotebook(db, a);
  assert.equal(book.records[0].category_id, category.id);
  assert(book.categories.some((c) => c.name === 'Our renamed category'));
  await handleAction(db, outsider, {
    action: 'createHousehold',
    name: 'Outside',
  });
  await assert.rejects(
    () =>
      handleAction(db, outsider, {
        action: 'category',
        id: category.id,
        name: 'Hijack',
      }),
    /not found/,
  );
  db.raw.close();
});
void test('calendar authorization is applied before export, including private export', async () => {
  const { db, a, c } = await household();
  await save(db, alex, { ...expense, kind: 'debt', title: 'Private debt A' });
  await save(db, cheryl, { ...expense, kind: 'debt', title: 'Private debt C' });
  const content = await exportCalendar(db, c, 'mine-and-shared');
  assert(content.includes('Private debt C'));
  assert(!content.includes('Private debt A'));
  assert(!(await exportCalendar(db, a, 'shared')).includes('Private debt A'));
  db.raw.close();
});
void test('demo is opt-in, creates linked paid rent and cannot be added twice', async () => {
  const { db, a } = await household();
  assert.equal((await loadNotebook(db, a)).records.length, 0);
  await handleAction(db, alex, { action: 'seed' });
  const records = (await loadNotebook(db, a)).records;
  assert(records.some((r) => r.kind === 'debt' && r.owner_id === a.id));
  assert(records.some((r) => r.source_id));
  await assert.rejects(
    () => handleAction(db, alex, { action: 'seed' }),
    /empty/,
  );
  db.raw.close();
});

void test('early bill payment keeps the actual date and scheduled occurrence separate', async () => {
  const { db, a } = await household();
  const due = addDays(today(), 10);
  await save(db, alex, {
    ...expense,
    kind: 'bill',
    date: due,
    scope: 'shared',
    payer_id: a.id,
  });
  const bill = (await loadNotebook(db, a)).records[0];
  await handleAction(db, alex, {
    action: 'pay',
    id: bill.id,
    date: due,
    payment_date: today(),
    payer_id: a.id,
  });
  const payment = (await loadNotebook(db, a)).records.find(
    (r) => r.source_id === bill.id,
  )!;
  assert.equal(payment.date, today());
  assert.equal(payment.occurrence_date, due);
  db.raw.close();
});

void test('shared borrowing needs two distinct approvals and does not disclose the underlying private debt', async () => {
  const { db, a, c } = await household();
  await save(db, cheryl, {
    ...expense,
    kind: 'debt',
    title: 'PRIVATE LOC',
    balance: '15000',
  });
  await handleAction(db, cheryl, {
    action: 'rhythm:propose',
    kind: 'borrowing',
    title: 'Needed baby equipment',
    amount: '400',
    date: today(),
    carrier_id: c.id,
    split_bps: 6000,
    note: 'Only this purchase is shared.',
  });
  const proposal = (await loadNotebook(db, a)).agreements![0];
  assert.equal(proposal.approved_by, null);
  assert(!JSON.stringify(await loadNotebook(db, a)).includes('PRIVATE LOC'));
  await assert.rejects(
    () =>
      handleAction(db, cheryl, { action: 'rhythm:approve', id: proposal.id }),
    /other household member/,
  );
  await assert.rejects(
    () =>
      handleAction(db, alex, {
        action: 'rhythm:repay',
        id: proposal.id,
        amount: '10',
        date: today(),
      }),
    /Approved shared borrowing/,
  );
  await handleAction(db, alex, { action: 'rhythm:approve', id: proposal.id });
  await handleAction(db, cheryl, {
    action: 'rhythm:repay',
    id: proposal.id,
    amount: '100',
    date: today(),
  });
  await assert.rejects(
    () =>
      handleAction(db, alex, {
        action: 'rhythm:repay',
        id: proposal.id,
        amount: '301',
        date: today(),
      }),
    /exceeds/,
  );
  const book = await loadNotebook(db, c);
  assert.equal(
    book.records.find((r) => r.title === 'PRIVATE LOC')!.balance_cents,
    1500000,
  );
  assert.equal(book.jointEntries![0].amount_cents, 10000);
  db.raw.close();
});

void test('joint ledger and approvals cannot be accessed by another household', async () => {
  const { db, a } = await household();
  await handleAction(db, alex, {
    action: 'rhythm:deposit',
    title: 'Deposit',
    amount: '100',
    date: today(),
  });
  await handleAction(db, alex, {
    action: 'rhythm:propose',
    kind: 'income_allocation',
    title: 'Date money',
    amount: '50',
    date: today(),
  });
  const book = await loadNotebook(db, a);
  await handleAction(db, outsider, {
    action: 'createHousehold',
    name: 'Other',
  });
  await assert.rejects(
    () =>
      handleAction(db, outsider, {
        action: 'rhythm:removeEntry',
        id: book.jointEntries![0].id,
      }),
    /not found/,
  );
  await assert.rejects(
    () =>
      handleAction(db, outsider, {
        action: 'rhythm:approve',
        id: book.agreements![0].id,
      }),
    /other household/,
  );
  const outside = await loadNotebook(db, (await getMember(db, outsider))!);
  assert.equal(outside.jointEntries!.length, 0);
  assert.equal(outside.agreements!.length, 0);
  db.raw.close();
});

void test('card clears are unique, undoable, and keep purchase corrections from corrupting cash', async () => {
  const { db, a } = await household();
  await handleAction(db, alex, {
    action: 'rhythm:deposit',
    amount: '100',
    date: today(),
    title: 'Deposit',
  });
  await save(db, alex, {
    ...expense,
    amount: '30',
    scope: 'shared',
    account: 'joint',
    payment_method: 'card',
    payer_id: a.id,
  });
  const r = (await loadNotebook(db, a)).records[0];
  assert.equal(jointSummary(await loadNotebook(db, a)).available, 7000);
  await handleAction(db, cheryl, {
    action: 'rhythm:clearCard',
    id: r.id,
    date: today(),
  });
  await assert.rejects(
    () =>
      handleAction(db, alex, {
        action: 'rhythm:clearCard',
        id: r.id,
        date: today(),
      }),
    /UNIQUE/,
  );
  await assert.rejects(
    () => handleAction(db, alex, { action: 'delete', id: r.id }),
    /Undo the card repayment/,
  );
  const book = await loadNotebook(db, a);
  assert.equal(jointSummary(book).available, 7000);
  const clear = book.jointEntries!.find((e) => e.kind === 'card_clear')!;
  await handleAction(db, alex, { action: 'rhythm:removeEntry', id: clear.id });
  assert.equal(jointSummary(await loadNotebook(db, a)).reserved, 3000);
  db.raw.close();
});

void test('private payday reserves never appear in partner metadata', async () => {
  const { db, a, c } = await household();
  await handleAction(db, cheryl, {
    action: 'rhythm:privatePlan',
    fixed: '9876.54',
    allowance: '321.09',
  });
  const own = await loadNotebook(db, (await getMember(db, cheryl))!);
  assert.equal(own.member.fixed_reserve_cents, 987654);
  const partnerView = JSON.stringify(await loadNotebook(db, a));
  assert(!partnerView.includes('987654'));
  assert(!partnerView.includes('32109'));
  assert(c.id);
  db.raw.close();
});

void test('scheduled joint deposits are idempotent and opening snapshots lock after activity', async () => {
  const { db, a } = await household();
  await save(db, alex, {
    ...expense,
    kind: 'funding',
    scope: 'shared',
    amount: '100',
    payer_id: a.id,
  });
  const plan = (await loadNotebook(db, a)).records[0];
  const body = {
    action: 'rhythm:deposit',
    title: 'Funded',
    date: today(),
    amount: '100',
    member_id: a.id,
    schedule_id: plan.id,
    occurrence: today(),
  };
  await handleAction(db, alex, body);
  await assert.rejects(() => handleAction(db, cheryl, body), /UNIQUE/);
  await assert.rejects(
    () =>
      handleAction(db, alex, {
        action: 'rhythm:setup',
        anchor: today(),
        date: today(),
        opening: '400',
        target: '100',
      }),
    /locked/,
  );
  assert.equal((await loadNotebook(db, a)).jointEntries!.length, 1);
  db.raw.close();
});
