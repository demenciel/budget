import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';
export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('CAD'),
  createdAt: text('created_at').notNull(),
  cycleAnchor: text('cycle_anchor').notNull().default('2026-09-09'),
  jointOpeningCents: integer('joint_opening_cents').notNull().default(0),
  jointOpeningDate: text('joint_opening_date').notNull().default('2026-09-09'),
  jointTargetCents: integer('joint_target_cents').notNull().default(0),
});
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    slot: integer('slot').notNull(),
    openingCents: integer('opening_cents').notNull().default(0),
    openingDate: text('opening_date').notNull(),
    fixedReserveCents: integer('fixed_reserve_cents').notNull().default(0),
    allowanceCents: integer('allowance_cents').notNull().default(0),
  },
  (t) => [
    uniqueIndex('members_household_slot').on(t.householdId, t.slot),
    check('member_slot', sql`${t.slot} IN (1,2)`),
  ],
);
export const invitations = sqliteTable(
  'invitations',
  {
    hash: text('hash').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [uniqueIndex('invitation_household').on(t.householdId)],
);
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('categories_household_name').on(t.householdId, t.name)],
);
export const records = sqliteTable(
  'records',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    ownerId: text('owner_id').references(() => members.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    amountCents: integer('amount_cents').notNull().default(0),
    date: text('date').notNull(),
    endDate: text('end_date'),
    frequency: text('frequency').notNull().default('once'),
    categoryId: text('category_id').references(() => categories.id),
    splitBps: integer('split_bps').notNull().default(5000),
    payerId: text('payer_id').references(() => members.id),
    note: text('note').notNull().default(''),
    priority: text('priority').notNull().default('medium'),
    balanceCents: integer('balance_cents'),
    savedCents: integer('saved_cents').notNull().default(0),
    sourceId: text('source_id'),
    occurrenceDate: text('occurrence_date'),
    completed: integer('completed').notNull().default(0),
    remindDays: integer('remind_days').notNull().default(3),
    secondDay: integer('second_day').notNull().default(15),
    dependable: integer('dependable').notNull().default(1),
    received: integer('received').notNull().default(0),
    account: text('account').notNull().default('personal'),
    paymentMethod: text('payment_method').notNull().default('debit'),
    spendingBucket: text('spending_bucket').notNull().default('fixed'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('records_household_owner_date').on(t.householdId, t.ownerId, t.date),
    uniqueIndex('records_payment_occurrence').on(t.sourceId, t.occurrenceDate),
    uniqueIndex('records_budget_private')
      .on(t.householdId, t.ownerId, t.categoryId, t.date)
      .where(sql`${t.kind} = 'budget' AND ${t.ownerId} IS NOT NULL`),
    uniqueIndex('records_budget_shared')
      .on(t.householdId, t.categoryId, t.date)
      .where(sql`${t.kind} = 'budget' AND ${t.ownerId} IS NULL`),
    check(
      'record_private_debt_income',
      sql`${t.kind} NOT IN ('debt','payday') OR ${t.ownerId} IS NOT NULL`,
    ),
    check(
      'record_shared_funding_settlement',
      sql`${t.kind} NOT IN ('funding','settlement') OR ${t.ownerId} IS NULL`,
    ),
    check(
      'record_amount',
      sql`${t.amountCents} >= 0 AND ${t.amountCents} <= 1000000000`,
    ),
    check('record_split', sql`${t.splitBps} BETWEEN 0 AND 10000`),
  ],
);

export const jointEntries = sqliteTable(
  'joint_entries',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    kind: text('kind').notNull(),
    amountCents: integer('amount_cents').notNull(),
    date: text('date').notNull(),
    title: text('title').notNull(),
    sourceId: text('source_id').unique(),
    agreementId: text('agreement_id'),
  },
  (t) => [
    index('joint_entries_household_date').on(t.householdId, t.date),
    check('joint_entry_amount', sql`${t.amountCents}>0`),
  ],
);

export const agreements = sqliteTable(
  'agreements',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    creatorId: text('creator_id')
      .notNull()
      .references(() => members.id),
    approvedBy: text('approved_by').references(() => members.id),
    carrierId: text('carrier_id')
      .notNull()
      .references(() => members.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    amountCents: integer('amount_cents').notNull(),
    splitBps: integer('split_bps').notNull(),
    date: text('date').notNull(),
    note: text('note').notNull().default(''),
  },
  (t) => [
    index('agreements_household').on(t.householdId),
    check('agreement_amount', sql`${t.amountCents}>0`),
    check('agreement_split', sql`${t.splitBps} BETWEEN 0 AND 10000`),
    check(
      'agreement_second_person',
      sql`${t.approvedBy} IS NULL OR ${t.approvedBy} != ${t.creatorId}`,
    ),
  ],
);
