import {
  type Member,
  type Category,
  type RecordItem,
  type Notebook,
  validateRecord,
  dateValid,
  dates,
  events,
  icsExport,
  cents,
  today,
  addDays,
} from './domain.ts';
import { handleRhythm } from './rhythm-service.ts';
export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
export type Identity = { userId: string; displayName: string };
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
const id = () => crypto.randomUUID();
const str = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
async function hash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function getMember(db: Database, user: Identity) {
  return db
    .prepare('SELECT * FROM members WHERE user_id = ?')
    .bind(user.userId)
    .first<Member>();
}
export async function loadNotebook(
  db: Database,
  member: Member,
): Promise<Notebook> {
  const [household, members, categories, records] = await Promise.all([
    db
      .prepare('SELECT * FROM households WHERE id = ?')
      .bind(member.household_id)
      .first<Notebook['household']>(),
    db
      .prepare(
        'SELECT id, household_id, name, slot FROM members WHERE household_id = ? ORDER BY slot',
      )
      .bind(member.household_id)
      .all<Member>(),
    db
      .prepare('SELECT * FROM categories WHERE household_id = ? ORDER BY name')
      .bind(member.household_id)
      .all<Category>(),
    db
      .prepare(
        'SELECT * FROM records WHERE household_id = ? AND (owner_id IS NULL OR owner_id = ?) ORDER BY date DESC, created_at DESC',
      )
      .bind(member.household_id, member.id)
      .all<RecordItem>(),
  ]);
  if (!household) throw new HttpError('Household not found.', 404);
  const [entries, agreements] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM joint_entries WHERE household_id=? ORDER BY date DESC,id',
      )
      .bind(member.household_id)
      .all<import('./domain.ts').JointEntry>(),
    db
      .prepare(
        'SELECT * FROM agreements WHERE household_id=? ORDER BY date DESC,id',
      )
      .bind(member.household_id)
      .all<import('./domain.ts').Agreement>(),
  ]);
  return {
    household,
    member,
    members: members.results,
    categories: categories.results,
    records: records.results,
    jointEntries: entries.results,
    agreements: agreements.results,
  };
}
function insert(db: Database, record: RecordItem) {
  const keys = Object.keys(record);
  return db
    .prepare(
      `INSERT INTO records (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    )
    .bind(...Object.values(record));
}
export async function handleAction(
  db: Database,
  user: Identity,
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; token?: string }> {
  const member = await getMember(db, user);
  const action = body.action;
  if (typeof action === 'string' && action.startsWith('rhythm:')) {
    if (!member) throw new HttpError('Set up your household first.', 403);
    return handleRhythm(db, await loadNotebook(db, member), body);
  }
  if (action === 'createHousehold') {
    if (member) throw new HttpError('You already belong to a household.');
    const name = str(body.name).trim();
    if (!name || name.length > 60)
      throw new HttpError('Enter your name (up to 60 characters).');
    const currency = str(body.currency, 'CAD');
    if (!['CAD', 'USD', 'EUR', 'GBP'].includes(currency))
      throw new HttpError('Choose a supported currency.');
    const h = id(),
      m = id(),
      now = new Date().toISOString();
    const defaults = [
      'Needs',
      'Wants',
      'Culture / learning',
      'Unexpected',
      'Savings',
      'Debt',
      'Household',
      'Food',
      'Baby',
      'Transportation',
      'Subscriptions',
    ];
    await db.batch([
      db
        .prepare(
          'INSERT INTO households (id,name,currency,created_at,cycle_anchor,joint_opening_date) VALUES (?,?,?,?,?,?)',
        )
        .bind(h, 'Our household', currency, now, today(), today()),
      db
        .prepare(
          'INSERT INTO members (id,user_id,household_id,name,slot,opening_cents,opening_date) VALUES (?,?,?,?,1,0,?)',
        )
        .bind(m, user.userId, h, name, today()),
      ...defaults.map((n) =>
        db
          .prepare(
            'INSERT INTO categories (id,household_id,name) VALUES (?,?,?)',
          )
          .bind(id(), h, n),
      ),
    ]);
    return { ok: true };
  }
  if (action === 'joinHousehold') {
    if (member) throw new HttpError('You already belong to a household.');
    const name = str(body.name).trim(),
      token = str(body.token);
    if (!name || name.length > 60 || !/^[a-f0-9]{64}$/.test(token))
      throw new HttpError('Enter your name and the complete invitation code.');
    const tokenHash = await hash(token);
    const invitation = await db
      .prepare(
        'SELECT household_id FROM invitations WHERE hash = ? AND expires_at > ?',
      )
      .bind(tokenHash, new Date().toISOString())
      .first<{ household_id: string }>();
    if (!invitation) throw new HttpError('Invitation is invalid or expired.');
    const memberId = id();
    await db.batch([
      db
        .prepare(
          'INSERT INTO members (id,user_id,household_id,name,slot,opening_cents,opening_date) SELECT ?,?,household_id,?,2,0,? FROM invitations WHERE hash = ? AND expires_at > ?',
        )
        .bind(
          memberId,
          user.userId,
          name,
          today(),
          tokenHash,
          new Date().toISOString(),
        ),
      db
        .prepare(
          'DELETE FROM invitations WHERE hash = ? AND EXISTS (SELECT 1 FROM members WHERE id = ?)',
        )
        .bind(tokenHash, memberId),
    ]);
    if (!(await getMember(db, user)))
      throw new HttpError('Invitation is no longer available.');
    return { ok: true };
  }
  if (!member) throw new HttpError('Set up or join your household first.', 403);
  const notebook = await loadNotebook(db, member);
  if (action === 'invite') {
    if (notebook.members.length === 2)
      throw new HttpError('Both household places are already filled.');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await db
      .prepare(
        'INSERT INTO invitations (hash,household_id,expires_at) VALUES (?,?,?) ON CONFLICT(household_id) DO UPDATE SET hash=excluded.hash, expires_at=excluded.expires_at',
      )
      .bind(
        await hash(token),
        member.household_id,
        new Date(Date.now() + 7 * 86400000).toISOString(),
      )
      .run();
    return { token };
  }
  if (action === 'profile') {
    const name = str(body.name).trim();
    if (!name || name.length > 60)
      throw new HttpError('Enter a name of 1–60 characters.');
    if (!dateValid(body.date) || body.date > today())
      throw new HttpError('Enter an opening balance date of today or earlier.');
    const raw = str(body.opening, '0'),
      negative = raw.startsWith('-');
    const opening = cents(negative ? raw.slice(1) : raw) * (negative ? -1 : 1);
    await db
      .prepare(
        'UPDATE members SET name=?, opening_cents=?, opening_date=? WHERE id=?',
      )
      .bind(name, opening, body.date, member.id)
      .run();
    return { ok: true };
  }
  if (action === 'category') {
    const name = str(body.name).trim();
    if (!name || name.length > 60)
      throw new HttpError('Use a category name of 1–60 characters.');
    if (body.id) {
      if (!notebook.categories.some((c) => c.id === body.id))
        throw new HttpError('Category not found.', 404);
      await db
        .prepare('UPDATE categories SET name=? WHERE id=? AND household_id=?')
        .bind(name, body.id, member.household_id)
        .run();
    } else
      await db
        .prepare('INSERT INTO categories (id,household_id,name) VALUES (?,?,?)')
        .bind(id(), member.household_id, name)
        .run();
    return { ok: true };
  }
  if (action === 'seed') {
    if (notebook.records.length)
      throw new HttpError('Demo data can only be added to an empty notebook.');
    const now = today(),
      month = now.slice(0, 7);
    const make = (
      key: string,
      kind: RecordItem['kind'],
      title: string,
      amount: string,
      date: string,
      scope: string,
      cat: string,
      frequency = 'once',
      extra = {},
    ) => ({
      ...validateRecord(
        {
          kind,
          title,
          amount,
          date,
          scope,
          category_id: notebook.categories.find((c) => c.name === cat)?.id,
          frequency,
          payer_id: member!.id,
          ...extra,
        },
        member!,
        notebook.members,
        notebook.categories,
      ),
      id: `demo-${member!.household_id}-${key}`,
      created_at: new Date().toISOString(),
    });
    const rows = [
      make(
        'rent',
        'bill',
        'Rent',
        '1400',
        month + '-01',
        'shared',
        'Household',
        'monthly',
      ),
      make(
        'water',
        'bill',
        'Water',
        '65',
        month + '-20',
        'shared',
        'Household',
        'monthly',
      ),
      make(
        'power',
        'bill',
        'Electricity',
        '145',
        month + '-15',
        'shared',
        'Household',
        'monthly',
      ),
      make(
        'wifi',
        'bill',
        'Wi-Fi',
        '80',
        month + '-18',
        'shared',
        'Household',
        'monthly',
        { split_bps: 6000 },
      ),
      make(
        'food',
        'transaction',
        'Groceries for the week',
        '126.80',
        now,
        'mine',
        'Food',
      ),
      make(
        'baby',
        'transaction',
        'Baby essentials',
        '48.50',
        now,
        'mine',
        'Baby',
      ),
      make(
        'gas',
        'transaction',
        'Cheryl’s gas',
        '55',
        now,
        'mine',
        'Transportation',
      ),
      make(
        'supplies',
        'transaction',
        'Household supplies',
        '32.40',
        now,
        'mine',
        'Household',
      ),
      make(
        'paidrent',
        'transaction',
        'Rent',
        '1400',
        month + '-01',
        'shared',
        'Household',
      ),
      make(
        'pay',
        'payday',
        'Payday',
        '2250',
        addDays(now, 3),
        'mine',
        'Needs',
        'biweekly',
      ),
      make(
        'subscription',
        'subscription',
        'Music subscription',
        '11.99',
        month + '-24',
        'mine',
        'Subscriptions',
        'monthly',
      ),
      make(
        'debt',
        'debt',
        'My personal payment',
        '120',
        month + '-25',
        'mine',
        'Debt',
        'monthly',
        { balance: '1800' },
      ),
      make(
        'goal',
        'goal',
        'A little breathing room',
        '2000',
        addDays(now, 90),
        'shared',
        'Savings',
        'once',
        { saved: '650' },
      ),
      make(
        'review',
        'review',
        'A moment to reflect',
        '0',
        month + '-28',
        'shared',
        'Needs',
        'monthly',
      ),
      make(
        'purchase',
        'purchase',
        'New baby seat',
        '240',
        addDays(now, 35),
        'mine',
        'Baby',
        'once',
        { priority: 'high' },
      ),
      make(
        'budgethouse',
        'budget',
        'Household plan',
        '1690',
        month + '-01',
        'shared',
        'Household',
      ),
      make(
        'budgetfood',
        'budget',
        'Food plan',
        '650',
        month + '-01',
        'mine',
        'Food',
      ),
      make(
        'budgetbaby',
        'budget',
        'Baby plan',
        '180',
        month + '-01',
        'mine',
        'Baby',
      ),
      make(
        'budgettransport',
        'budget',
        'Transport plan',
        '200',
        month + '-01',
        'mine',
        'Transportation',
      ),
      make(
        'reminder',
        'reminder',
        'Check next month’s electricity estimate',
        '0',
        addDays(now, 10),
        'shared',
        'Household',
      ),
    ];
    rows.find((r) =>
      r.id.endsWith('-paidrent'),
    )!.source_id = `demo-${member.household_id}-rent`;
    rows.find((r) => r.id.endsWith('-paidrent'))!.occurrence_date =
      month + '-01';
    await db.batch(rows.map((r) => insert(db, r)));
    return { ok: true };
  }
  const existing = body.id
    ? notebook.records.find((r) => r.id === body.id)
    : undefined;
  if (body.id && !existing) throw new HttpError('Item not found.', 404);
  if (
    existing &&
    ['save', 'delete'].includes(str(action)) &&
    notebook.jointEntries?.some(
      (e) => e.source_id === existing.id && e.kind === 'card_clear',
    )
  )
    throw new HttpError(
      'Undo the card repayment in Household rhythm before changing its purchase.',
    );
  if (action === 'delete') {
    if (!existing) throw new HttpError('Item not found.', 404);
    // Preserve payment history after a recurring plan is removed.
    await db.batch([
      db
        .prepare(
          'UPDATE records SET source_id=NULL, occurrence_date=NULL WHERE source_id=? AND household_id=?',
        )
        .bind(existing.id, member.household_id),
      db
        .prepare(
          'DELETE FROM records WHERE id=? AND household_id=? AND (owner_id IS NULL OR owner_id=?)',
        )
        .bind(existing.id, member.household_id, member.id),
    ]);
    return { ok: true };
  }
  if (action === 'pay') {
    if (
      !existing ||
      !['bill', 'subscription', 'debt', 'purchase'].includes(existing.kind)
    )
      throw new HttpError('Choose a payable commitment.');
    if (
      !dateValid(body.date) ||
      !dates(existing, body.date, body.date).includes(body.date)
    )
      throw new HttpError('This is not a scheduled occurrence.');
    const paymentDate = body.payment_date ?? today();
    if (!dateValid(paymentDate) || paymentDate > today())
      throw new HttpError('Payment date must be today or earlier.');
    const r = {
      ...existing,
      id: id(),
      kind: 'transaction' as const,
      date: paymentDate,
      end_date: null,
      frequency: 'once' as const,
      source_id: existing.id,
      occurrence_date: body.date,
      created_at: new Date().toISOString(),
      payer_id: existing.owner_id ? member.id : str(body.payer_id, member.id),
      completed: 0,
    };
    if (!notebook.members.some((m) => m.id === r.payer_id))
      throw new HttpError('Choose a payer from this household.');
    await insert(db, r).run();
    return { ok: true };
  }
  if (action === 'save') {
    if (
      !body.record ||
      typeof body.record !== 'object' ||
      Array.isArray(body.record)
    )
      throw new HttpError('Invalid item.');
    const data = validateRecord(
      body.record as Record<string, unknown>,
      member,
      notebook.members,
      notebook.categories,
    );
    if (
      data.account === 'joint' &&
      data.date < (notebook.household.joint_opening_date ?? data.date)
    )
      throw new HttpError(
        'Joint spending cannot precede its opening snapshot.',
      );
    if (existing) {
      if (existing.kind !== data.kind || existing.owner_id !== data.owner_id)
        throw new HttpError(
          'Item type and ownership cannot be changed. Create a new item instead.',
        );
      if (existing.source_id)
        throw new HttpError(
          'Delete and re-record a linked payment to change it.',
        );
      if (existing.kind === 'transaction' && data.date > today())
        throw new HttpError('Use a planned purchase for a future expense.');
      const keys = Object.keys(data).filter(
        (k) => !['source_id', 'occurrence_date'].includes(k),
      );
      await db
        .prepare(
          `UPDATE records SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=? AND household_id=? AND (owner_id IS NULL OR owner_id=?)`,
        )
        .bind(
          ...keys.map((k) => data[k as keyof typeof data]),
          existing.id,
          member.household_id,
          member.id,
        )
        .run();
    } else {
      if (
        ['transaction', 'settlement'].includes(data.kind) &&
        data.date > today()
      )
        throw new HttpError('Actual payments cannot be future dated.');
      await insert(db, {
        ...data,
        id: id(),
        created_at: new Date().toISOString(),
      }).run();
    }
    return { ok: true };
  }
  throw new HttpError('Unknown action.');
}
export async function exportCalendar(
  db: Database,
  member: Member,
  scope: string,
) {
  const notebook = await loadNotebook(db, member);
  return icsExport(
    events(
      notebook.records,
      today(),
      addDays(today(), 365),
      notebook.jointEntries,
    ),
    scope !== 'mine-and-shared',
  );
}
