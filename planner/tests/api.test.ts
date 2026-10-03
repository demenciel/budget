import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleAction, type Database, type Statement } from '../lib/service.ts';
import {
  handleApiRequest,
  handleKeyManagementRequest,
} from '../lib/api-http.ts';
import { today } from '../lib/domain.ts';

class Sqlite implements Database {
  raw = new DatabaseSync(':memory:');
  constructor() {
    this.raw.exec('PRAGMA foreign_keys=ON');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((name) => name.endsWith('.sql'))
      .sort())
      this.raw.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
  }
  prepare(sql: string): Statement {
    const statement = this.raw.prepare(sql);
    let values: unknown[] = [];
    const wrapper: Statement = {
      bind(...args) {
        values = args;
        return wrapper;
      },
      async first<T>() {
        return (statement.get(...(values as never[])) as T) ?? null;
      },
      async all<T>() {
        return { results: statement.all(...(values as never[])) as T[] };
      },
      async run() {
        return statement.run(...(values as never[]));
      },
    };
    return wrapper;
  }
  async batch(statements: Statement[]) {
    this.raw.exec('BEGIN');
    try {
      for (const statement of statements) await statement.run();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
}

const base = 'https://budget.example';
const alex = { userId: 'alex', displayName: 'Alex' };
const cheryl = { userId: 'cheryl', displayName: 'Cheryl' };
const management = (method: string, body?: object, origin = base) =>
  new Request(`${base}/api/keys`, {
    method,
    headers: {
      Origin: origin,
      'X-Notebook': '1',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const api = (key: string, method = 'GET', body?: object) =>
  new Request(`${base}/api/v1/notebook`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

void test('API keys read and write as their member and revoke immediately', async () => {
  const db = new Sqlite();
  await handleAction(db, alex, { action: 'createHousehold', name: 'Alex' });
  const invite = await handleAction(db, alex, { action: 'invite' });
  await handleAction(db, cheryl, {
    action: 'joinHousehold',
    name: 'Cheryl',
    token: invite.token,
  });
  await handleAction(db, cheryl, {
    action: 'save',
    record: {
      kind: 'debt',
      scope: 'mine',
      title: 'Cheryl secret',
      amount: '100',
      date: today(),
    },
  });
  const createdResponse = await handleKeyManagementRequest(
    management('POST', { name: 'Automation' }),
    db,
    alex,
  );
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as { key: string; id: string };
  assert.match(created.key, /^tb_[a-f0-9]{64}$/);
  assert(
    !JSON.stringify(db.raw.prepare('SELECT * FROM api_keys').all()).includes(
      created.key,
    ),
  );
  const listed = await handleKeyManagementRequest(management('GET'), db, alex);
  assert.equal(listed.status, 200);
  const listBody = await listed.text();
  assert(!listBody.includes(created.key));
  assert(listBody.includes('Automation'));
  assert.equal(
    (
      await handleKeyManagementRequest(
        management('DELETE', { id: created.id }),
        db,
        cheryl,
      )
    ).status,
    404,
  );

  const save = await handleApiRequest(
    api(created.key, 'POST', {
      action: 'save',
      record: {
        kind: 'transaction',
        scope: 'mine',
        title: 'Via API',
        amount: '12.34',
        date: today(),
      },
    }),
    db,
  );
  assert.equal(save.status, 200);
  const read = await handleApiRequest(api(created.key), db);
  assert.equal(read.status, 200);
  const notebook = (await read.json()) as {
    records: { id: string; title: string; amount_cents: number }[];
  };
  assert.equal(notebook.records.length, 1);
  assert.equal(notebook.records[0].title, 'Via API');
  assert.equal(notebook.records[0].amount_cents, 1234);
  assert(!JSON.stringify(notebook).includes('Cheryl secret'));

  const rhythm = await handleApiRequest(
    api(created.key, 'POST', {
      action: 'rhythm:privatePlan',
      fixed: '25',
      allowance: '10',
    }),
    db,
  );
  assert.equal(rhythm.status, 200);
  const calendar = await handleApiRequest(
    new Request(
      `${base}/api/v1/notebook?export=calendar&scope=mine-and-shared`,
      {
        headers: { Authorization: `Bearer ${created.key}` },
      },
    ),
    db,
  );
  assert.equal(calendar.status, 200);
  assert.match(calendar.headers.get('Content-Type') ?? '', /text\/calendar/);
  assert(!(await calendar.text()).includes('Cheryl secret'));

  const revocation = await handleKeyManagementRequest(
    management('DELETE', { id: created.id }),
    db,
    alex,
  );
  assert.equal(revocation.status, 200);
  assert.equal((await handleApiRequest(api(created.key), db)).status, 401);
  db.raw.close();
});

void test('key management requires a session and same-origin write; API ignores cookies', async () => {
  const db = new Sqlite();
  await handleAction(db, alex, { action: 'createHousehold', name: 'Alex' });
  assert.equal(
    (
      await handleKeyManagementRequest(
        management('POST', { name: 'No session' }),
        db,
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleKeyManagementRequest(
        management('POST', { name: 'Wrong origin' }, 'https://evil.example'),
        db,
        alex,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleApiRequest(
        new Request(`${base}/api/v1/notebook`, {
          headers: { Cookie: 'session=anything' },
        }),
        db,
      )
    ).status,
    401,
  );
  assert.equal(
    (await handleApiRequest(api('tb_' + '0'.repeat(64)), db)).status,
    401,
  );
  db.raw.close();
});
