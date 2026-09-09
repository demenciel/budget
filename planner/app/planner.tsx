'use client';
/* oxlint-disable nextjs/no-html-link-for-pages -- Sites sign-in/out require top-level navigation, not framework prefetch. */
import {
  useCallback,
  useEffect,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  House,
  Leaf,
  Plus,
  ReceiptText,
  Settings,
  Target,
  Wallet,
  LockKeyhole,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Pencil,
  Trash2,
  TriangleAlert,
  Users,
  LogOut,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { HouseholdRhythm, JointOverview } from './rhythm';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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
  today,
  money,
  monthLabel,
  addMonths,
  addDays,
  allocation,
  budgetRows,
  events,
  forecast,
  reimbursement,
  myShare,
  kinds,
  frequencies,
  type Kind,
  type Notebook,
  type RecordItem,
  type Event,
  type JointEntry,
} from '@/lib/domain';
const navItems = [
  [House, 'Overview'],
  [Users, 'Household rhythm'],
  [BookOpen, 'Monthly budget'],
  [ReceiptText, 'Transactions'],
  [Wallet, 'Bills & plans'],
  [CalendarDays, 'Calendar'],
  [ChartNoAxesCombined, 'Cash flow'],
  [Target, 'Savings goals'],
  [Settings, 'Settings'],
] as const;
const titles: Record<string, [string, string]> = {
  'Household rhythm': [
    'Our money, with clear boundaries.',
    'Your accounts stay yours. The joint pot is something you can both see.',
  ],
  Overview: [
    'Your month, at a glance.',
    'Make room for what matters. One small decision at a time.',
  ],
  'Monthly budget': [
    'Give your money a little intention.',
    'Plan, notice, reflect. Every month is a fresh page.',
  ],
  Transactions: [
    'The everyday, written down.',
    'Small expenses count. So do the things that make life good.',
  ],
  'Bills & plans': [
    'A place for what’s ahead.',
    'Household essentials, personal commitments, and things worth planning for.',
  ],
  Calendar: [
    'A little less to remember.',
    'Paydays, due dates, and moments to pause—all in one place.',
  ],
  'Cash flow': [
    'Look ahead with a little clarity.',
    'An estimate from what you’ve planned, with space for life to change.',
  ],
  'Savings goals': [
    'Make room for something good.',
    'A little at a time is still moving forward.',
  ],
  Settings: [
    'Your household notebook.',
    'Two people. A shared plan. A private space for each of you.',
  ],
};
const kindNames: Record<Kind, string> = {
  transaction: 'Transaction',
  bill: 'Bill',
  subscription: 'Subscription',
  debt: 'Private debt payment',
  purchase: 'Planned purchase',
  goal: 'Savings goal',
  payday: 'Pay / one-off income',
  funding: 'Joint contribution schedule',
  reminder: 'Reminder',
  review: 'Budget review',
  budget: 'Monthly category plan',
  settlement: 'Reimbursement',
};
function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue>
            {options.find((o) => o[0] === value)?.[1] ?? 'Choose…'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Leaf size={25} />
      <p>{children}</p>
    </div>
  );
}
function Owner({ r }: { r: Pick<RecordItem, 'owner_id'> }) {
  return (
    <span className={'badge ' + (r.owner_id ? 'mine' : 'shared')}>
      {r.owner_id ? <LockKeyhole size={11} /> : <Users size={11} />}{' '}
      {r.owner_id ? 'Mine' : 'Shared'}
    </span>
  );
}
const inputRecord = (r: RecordItem) => ({
  kind: r.kind,
  title: r.title,
  amount: (r.amount_cents / 100).toFixed(2),
  date: r.date,
  end_date: r.end_date ?? '',
  frequency: r.frequency,
  category_id: r.category_id ?? '',
  scope: r.owner_id ? 'mine' : 'shared',
  split_bps: String(r.split_bps),
  payer_id: r.payer_id ?? '',
  note: r.note,
  priority: r.priority,
  balance: r.balance_cents === null ? '' : (r.balance_cents / 100).toFixed(2),
  saved: (r.saved_cents / 100).toFixed(2),
  remind_days: String(r.remind_days),
  completed: !!r.completed,
  second_day: String(r.second_day ?? 15),
  dependable: r.dependable !== 0,
  received: r.received === 1,
  account: r.account ?? 'personal',
  payment_method: r.payment_method ?? 'debit',
  spending_bucket: r.spending_bucket ?? 'fixed',
});
export type Draft = ReturnType<typeof inputRecord>;
export default function Planner() {
  const [data, setData] = useState<Notebook | null>(null),
    [loading, setLoading] = useState(true),
    [needsAuth, setNeedsAuth] = useState(false),
    [setup, setSetup] = useState(false),
    [view, setView] = useState('Overview'),
    [scope, setScope] = useState('all'),
    [month, setMonth] = useState(today().slice(0, 7)),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [deleting, setDeleting] = useState<RecordItem | null>(null),
    [paying, setPaying] = useState<Event | null>(null),
    [payer, setPayer] = useState(''),
    [paymentDate, setPaymentDate] = useState(today()),
    [horizon, setHorizon] = useState('30'),
    [search, setSearch] = useState(''),
    [invite, setInvite] = useState(''),
    [exportScope, setExportScope] = useState('shared');
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/notebook', { cache: 'no-store' });
      const result = (await r.json()) as Notebook & {
        needsAuth?: boolean;
        needsSetup?: boolean;
        error?: string;
      };
      setNeedsAuth(!!result.needsAuth);
      setSetup(!!result.needsSetup);
      if (result.needsAuth || result.needsSetup) {
        setData(null);
        return;
      }
      if (!r.ok) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load your notebook.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  async function mutate(body: Record<string, unknown>) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const r = await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Notebook': '1' },
        body: JSON.stringify(body),
      });
      const result = (await r.json()) as Record<string, unknown>;
      if (!r.ok) throw new Error(String(result.error));
      await refresh();
      setMessage('Saved to your notebook.');
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  function openEditor(
    kind: Kind = 'transaction',
    r?: RecordItem,
    overrides: Partial<Draft> = {},
  ) {
    if (!data) return;
    setEditing(r?.id ?? null);
    setError('');
    setDraft(
      r
        ? inputRecord(r)
        : {
            kind,
            title: '',
            second_day: '15',
            dependable: true,
            received: false,
            account: 'personal',
            payment_method: 'debit',
            spending_bucket: 'fixed',
            amount: '',
            date: kind === 'budget' ? month + '-01' : today(),
            end_date: '',
            frequency: ['bill', 'subscription', 'debt', 'payday'].includes(kind)
              ? 'monthly'
              : 'once',
            category_id:
              data.categories.find(
                (c) =>
                  c.name ===
                  (kind === 'debt'
                    ? 'Debt'
                    : kind === 'transaction'
                      ? 'Food'
                      : 'Household'),
              )?.id ?? '',
            scope: ['debt', 'payday', 'transaction'].includes(kind)
              ? 'mine'
              : scope === 'mine'
                ? 'mine'
                : 'shared',
            split_bps: '5000',
            payer_id: data.member.id,
            note: '',
            priority: 'medium',
            balance: '',
            saved: '0',
            remind_days: '3',
            completed: false,
            ...overrides,
          },
    );
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'navigate_budget_notebook',
          description:
            'Navigate to a notebook page. Does not create or change financial records.',
          inputSchema: {
            type: 'object',
            properties: {
              page: { type: 'string', enum: navItems.map((n) => n[1]) },
            },
            required: ['page'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const page = (input as { page?: unknown })?.page;
            if (
              typeof page !== 'string' ||
              !navItems.some((n) => n[1] === page)
            )
              throw new Error('Unknown notebook page.');
            setView(page);
            return { page };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const currentDate = today();
  const fmt = (n: number) => money(n, data?.household.currency);
  const filtered =
    data?.records.filter(
      (r) =>
        scope === 'all' ||
        (scope === 'shared'
          ? r.owner_id === null
          : r.owner_id === data.member.id),
    ) ?? [];
  const due = events(
    filtered,
    addDays(currentDate, -90),
    addDays(currentDate, Number(horizon)),
    data?.jointEntries,
  ).filter(
    (e) =>
      !e.paid &&
      (e.date >= currentDate ||
        ['bill', 'subscription', 'debt', 'purchase'].includes(e.record.kind)),
  );
  const upcoming = due.filter((e) => e.date >= currentDate);
  const transactions = filtered.filter(
    (r) => r.kind === 'transaction' && r.date.startsWith(month),
  );
  const amountFor = (r: RecordItem) =>
    scope === 'all' && data ? myShare(r, data.member) : r.amount_cents;
  const spent = transactions.reduce((n, r) => n + amountFor(r), 0),
    planned = filtered
      .filter((r) => r.kind === 'budget' && r.date.startsWith(month))
      .reduce((n, r) => n + amountFor(r), 0);
  const net = data ? reimbursement(data.records, data.member) : 0;
  const nextPay = upcoming.find(
    (e) =>
      e.record.kind === 'payday' &&
      e.record.dependable !== 0 &&
      !e.record.received,
  );
  const personalForecast = data
    ? forecast(
        data.records,
        data.member,
        currentDate.slice(0, 7) + '-01',
        'mine',
        0,
        currentDate.slice(0, 7) + '-01',
        data.jointEntries,
      )
    : [];
  const warnings = personalForecast[0];
  function eventRow(e: Event, withPay = false) {
    return (
      <div className="event-row" key={e.id}>
        <div className="date-tile">
          <b>{Number(e.date.slice(8))}</b>
          <small>
            {new Date(e.date + 'T12:00:00Z')
              .toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' })
              .toUpperCase()}
          </small>
        </div>
        <div className="event-name">
          <button
            className="row-title"
            onClick={() => openEditor(e.record.kind, e.record)}
          >
            {e.record.title}
          </button>
          <small>
            {e.date < currentDate ? (
              <span className="overdue">Overdue · </span>
            ) : null}
            {kindNames[e.record.kind]}
            {!e.record.owner_id
              ? ` · ${e.record.split_bps / 100} / ${100 - e.record.split_bps / 100} split`
              : ''}
            {e.paid ? ' · Paid' : ''}
          </small>
        </div>
        <Owner r={e.record} />
        <b>{e.record.amount_cents ? fmt(e.record.amount_cents) : ''}</b>
        {withPay &&
          !e.paid &&
          ['bill', 'subscription', 'debt', 'purchase'].includes(
            e.record.kind,
          ) && (
            <button
              className="icon-button"
              aria-label={`Record payment for ${e.record.title}`}
              onClick={() => {
                setPaying(e);
                setPaymentDate(today());
                setPayer(e.record.payer_id ?? data!.member.id);
              }}
            >
              <Check size={17} />
            </button>
          )}
      </div>
    );
  }
  return (
    <SidebarProvider className="shell">
      <Sidebar collapsible="none" className="rail">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          together<span className="brand-dot">.</span>
        </a>
        <div className="household">
          <span className="avatars">
            <b>{data?.members[0]?.name[0] ?? 'A'}</b>
            <b>{data?.members[1]?.name[0] ?? 'C'}</b>
          </span>
          <div>
            Our household<small>A little planning, together</small>
          </div>
        </div>
        <p className="eyebrow">YOUR NOTEBOOK</p>
        <nav aria-label="Main navigation">
          {navItems.map(([Icon, label]) => (
            <button
              className={view === label ? 'active' : ''}
              key={label}
              onClick={() => {
                setView(label);
                setSearch('');
              }}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="rail-note">
          <Leaf size={22} />
          <p>
            Small steps.
            <br />A little more peace of mind.
          </p>
          <small>Your money, with intention.</small>
        </div>
        <div className="profile">
          <span className="avatar">{data?.member.name[0] ?? 'A'}</span>
          <div>
            {data?.member.name ?? 'My notebook'}
            <small>
              <LockKeyhole size={12} /> Private & shared
            </small>
          </div>
          {data && (
            <a
              className="signout"
              href="/signout-with-chatgpt?return_to=%2F"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </a>
          )}
        </div>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <span>
            Our household <span className="slash">/</span> {view}
          </span>
          <span className="private-note">
            <LockKeyhole size={14} /> A private space for the two of you
          </span>
        </header>
        <div className="page">
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button
                className="text-button"
                onClick={() => {
                  setError('');
                  void refresh();
                }}
              >
                Retry / refresh
              </button>
            </div>
          )}
          {message && (
            <output className="notice success">
              {message}
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage('')}
              >
                ×
              </button>
            </output>
          )}
          {loading ? (
            <Empty>Opening your notebook…</Empty>
          ) : needsAuth ? (
            <section className="welcome panel">
              <Leaf size={32} />
              <h1>A little planning, together.</h1>
              <p>
                Your own money stays private. Your household plans have a place
                to meet.
              </p>
              <a
                className="primary"
                href="/signin-with-chatgpt?return_to=%2F"
                target="_top"
              >
                Sign in with ChatGPT <ArrowUpRight size={17} />
              </a>
              <small>You and Cheryl each sign in with your own account.</small>
            </section>
          ) : setup ? (
            <Setup busy={busy} save={mutate} />
          ) : !data ? (
            <Empty>
              Your notebook is unavailable. Use refresh above to try again.
            </Empty>
          ) : (
            <>
              {data.records.some((r) => r.id.startsWith('demo-')) && (
                <div className="notice">
                  Illustrative sample data is present. These amounts are
                  examples, not your real finances.
                </div>
              )}
              <div className="page-heading">
                <div>
                  <p className="eyebrow">A LITTLE CLARITY, EVERY DAY</p>
                  <h1>{titles[view][0]}</h1>
                  <p>{titles[view][1]}</p>
                </div>
                <button
                  className="primary"
                  onClick={() =>
                    openEditor(
                      view === 'Savings goals'
                        ? 'goal'
                        : view === 'Bills & plans'
                          ? 'bill'
                          : view === 'Calendar'
                            ? 'reminder'
                            : 'transaction',
                    )
                  }
                >
                  <Plus size={18} />
                  {view === 'Savings goals'
                    ? 'Add goal'
                    : view === 'Bills & plans'
                      ? 'Add commitment'
                      : view === 'Calendar'
                        ? 'Add event'
                        : 'Add transaction'}
                </button>
              </div>
              {!['Settings', 'Household rhythm'].includes(view) && (
                <div className="toolbar">
                  <Tabs
                    value={scope}
                    onValueChange={(v) => setScope(String(v))}
                  >
                    <TabsList>
                      <TabsTrigger value="all">My overview</TabsTrigger>
                      <TabsTrigger value="shared">Shared</TabsTrigger>
                      <TabsTrigger value="mine">
                        Mine <LockKeyhole size={12} />
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {!['Cash flow', 'Savings goals'].includes(view) && (
                    <div className="month-switch">
                      <button
                        aria-label="Previous month"
                        onClick={() =>
                          setMonth(addMonths(month + '-01', -1).slice(0, 7))
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>{monthLabel(month)}</span>
                      <button
                        aria-label="Next month"
                        onClick={() =>
                          setMonth(addMonths(month + '-01', 1).slice(0, 7))
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {view === 'Household rhythm' && (
                <HouseholdRhythm
                  data={data}
                  mutate={mutate}
                  busy={busy}
                  edit={openEditor}
                />
              )}
              {view === 'Overview' && (
                <>
                  <JointOverview
                    data={data}
                    open={() => setView('Household rhythm')}
                  />
                  {!data.records.length && (
                    <div className="notice">
                      Your notebook is ready. Start with your pay schedule and
                      household bills, or explore sample data in Settings.
                    </div>
                  )}
                  <section className="stats">
                    <article className="stat feature">
                      <span>
                        {scope === 'all'
                          ? 'My spending, including shared portions'
                          : 'Spent this month'}
                      </span>
                      <strong>{fmt(spent)}</strong>
                      <small>
                        {planned
                          ? `Of ${fmt(planned)} planned`
                          : 'Add a monthly plan to set your intention'}
                      </small>
                      <Progress
                        aria-label="Monthly budget used"
                        value={
                          planned ? Math.min(100, (spent / planned) * 100) : 0
                        }
                      />
                      <footer>
                        {planned
                          ? `${fmt(planned - spent)} ${planned >= spent ? 'left in your plan' : 'over the plan'}`
                          : 'A fresh page for this month'}
                        <ArrowUpRight size={16} />
                      </footer>
                    </article>
                    <article className="stat">
                      <span>Next payday</span>
                      <strong>
                        {nextPay ? fmt(nextPay.record.amount_cents) : 'Not set'}
                      </strong>
                      <small>
                        {nextPay
                          ? nextPay.date
                          : 'Add your expected net income in Bills & plans'}
                      </small>
                      <footer>
                        <span className="badge mine">
                          <LockKeyhole size={11} /> Mine
                        </span>{' '}
                        Your income stays private
                      </footer>
                    </article>
                    <article className="stat">
                      <span>Due in the next {horizon} days</span>
                      <strong>
                        {fmt(
                          upcoming
                            .filter((e) =>
                              [
                                'bill',
                                'subscription',
                                'debt',
                                'purchase',
                              ].includes(e.record.kind),
                            )
                            .reduce((n, e) => n + amountFor(e.record), 0),
                        )}
                      </strong>
                      <small>
                        {scope === 'all'
                          ? 'Your portion of planned commitments'
                          : 'Planned commitments in this view'}
                      </small>
                      <footer>
                        <span className="badge shared">A little heads-up</span>{' '}
                        Excludes paid items
                      </footer>
                    </article>
                  </section>
                  {due.some((e) => e.date < currentDate) && (
                    <div className="notice warning">
                      <TriangleAlert size={18} />
                      {due.filter((e) => e.date < currentDate).length} unpaid
                      occurrences in the last 90 days need a look.
                      <button
                        className="text-button"
                        onClick={() => setView('Calendar')}
                      >
                        Review due items →
                      </button>
                    </div>
                  )}
                  {scope !== 'shared' &&
                    warnings &&
                    warnings.expense > warnings.income && (
                      <div className="notice warning">
                        <TriangleAlert size={18} />
                        This month’s listed commitments exceed listed income by{' '}
                        {fmt(warnings.expense - warnings.income)}. Biggest item:{' '}
                        {warnings.drivers[0]?.title ?? 'your plans'}.
                        <button
                          className="text-button"
                          onClick={() => setView('Cash flow')}
                        >
                          See outlook →
                        </button>
                      </div>
                    )}
                  {upcoming.some(
                    (e) =>
                      addDays(e.date, -e.record.remind_days) <= currentDate,
                  ) && (
                    <div className="notice">
                      <CalendarDays size={18} />
                      Reminder:{' '}
                      {upcoming
                        .filter(
                          (e) =>
                            addDays(e.date, -e.record.remind_days) <=
                            currentDate,
                        )
                        .slice(0, 3)
                        .map((e) => `${e.record.title} on ${e.date}`)
                        .join(' · ')}
                    </div>
                  )}
                  <div className="columns">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Coming up</h2>
                        <button
                          className="text-button"
                          onClick={() => setView('Calendar')}
                        >
                          View calendar <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {due.slice(0, 5).map((e) => eventRow(e, true))}
                      {!due.length && (
                        <Empty>
                          Nothing due just yet. Add a bill, payday, or reminder.
                        </Empty>
                      )}
                    </section>
                    <section className="panel reflection">
                      <span className="eyebrow">THE MONTHLY PAUSE</span>
                      <BookOpen size={28} />
                      <h2>
                        How do you want
                        <br />
                        this month to feel?
                      </h2>
                      <p>
                        A budget is a little promise to yourself. Plan for the
                        essentials, and leave space for the good things.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setView('Monthly budget')}
                      >
                        Open your monthly plan <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </div>
                  <div className="columns lower">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Recent spending</h2>
                        <button
                          className="text-button"
                          onClick={() => setView('Transactions')}
                        >
                          See all <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {transactions.slice(0, 4).map((r) => (
                        <div className="event-row" key={r.id}>
                          <span className="category-icon">
                            <ReceiptText size={17} />
                          </span>
                          <div className="event-name">
                            <button
                              className="row-title"
                              onClick={() => openEditor(r.kind, r)}
                            >
                              {r.title}
                            </button>
                            <small>
                              {data.categories.find(
                                (c) => c.id === r.category_id,
                              )?.name ?? 'Uncategorized'}{' '}
                              · {r.date}
                            </small>
                          </div>
                          <Owner r={r} />
                          <b>{fmt(amountFor(r))}</b>
                        </div>
                      ))}
                      {!transactions.length && (
                        <Empty>No spending entered for this month.</Empty>
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Keeping things balanced</h2>
                        <Users size={20} />
                      </div>
                      <p className="balance-value">{fmt(Math.abs(net))}</p>
                      <p className="muted">
                        {net > 0
                          ? 'Your partner owes you'
                          : net < 0
                            ? 'You owe your partner'
                            : 'You’re all square'}{' '}
                        across recorded shared expenses.
                      </p>
                      <p className="hint">
                        Based on who paid, each bill’s split, and recorded
                        reimbursements.
                      </p>
                      <button
                        className="text-button"
                        onClick={() =>
                          openEditor('settlement', undefined, {
                            scope: 'shared',
                          })
                        }
                      >
                        Record a reimbursement <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {view === 'Monthly budget' && (
                <Budget
                  data={data}
                  month={month}
                  scope={scope === 'shared' ? 'shared' : 'mine'}
                  edit={openEditor}
                  fmt={fmt}
                />
              )}
              {view === 'Transactions' && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Your spending journal</h2>
                    <input
                      className="search"
                      aria-label="Search transactions"
                      placeholder="Find a merchant or note…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'Date',
                          'Description',
                          'Ownership',
                          'Total',
                          'My portion',
                          'Paid by',
                          '',
                        ].map((s, i) => (
                          <TableHead key={i}>{s}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered
                        .filter(
                          (r) =>
                            ['transaction', 'settlement'].includes(r.kind) &&
                            r.date.startsWith(month) &&
                            `${r.title} ${r.note}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                        )
                        .map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.date}</TableCell>
                            <TableCell>
                              <b>{r.title}</b>
                              <small className="table-note">
                                {kindNames[r.kind]} ·{' '}
                                {data.categories.find(
                                  (c) => c.id === r.category_id,
                                )?.name ?? '—'}
                                {r.note ? ' · ' + r.note : ''}
                              </small>
                            </TableCell>
                            <TableCell>
                              <Owner r={r} />
                            </TableCell>
                            <TableCell>{fmt(r.amount_cents)}</TableCell>
                            <TableCell>
                              {r.kind === 'settlement'
                                ? 'Transfer'
                                : fmt(myShare(r, data.member))}
                            </TableCell>
                            <TableCell>
                              {data.members.find((m) => m.id === r.payer_id)
                                ?.name ?? '—'}
                            </TableCell>
                            <TableCell>
                              <div className="actions">
                                {!r.source_id && (
                                  <button
                                    className="icon-button"
                                    aria-label={`Edit ${r.title}`}
                                    onClick={() => openEditor(r.kind, r)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                )}
                                <button
                                  className="icon-button"
                                  aria-label={`Delete ${r.title}`}
                                  onClick={() => setDeleting(r)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {!transactions.length && (
                    <Empty>
                      Your transactions will appear here as you add them.
                    </Empty>
                  )}
                </section>
              )}
              {view === 'Bills & plans' && (
                <>
                  <div className="notice">
                    <House size={19} /> Shared essentials: rent, water,
                    electricity, and Wi-Fi. Food, supplies, baby expenses, and
                    Cheryl’s gas can stay in your personal plan.
                  </div>
                  <div className="record-grid">
                    {filtered
                      .filter((r) =>
                        [
                          'bill',
                          'subscription',
                          'debt',
                          'purchase',
                          'payday',
                          'funding',
                        ].includes(r.kind),
                      )
                      .map((r) => (
                        <section className="panel record-card" key={r.id}>
                          <div className="section-heading">
                            <Owner r={r} />
                            <div className="actions">
                              <button
                                aria-label={`Edit ${r.title}`}
                                className="icon-button"
                                onClick={() => openEditor(r.kind, r)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                aria-label={`Delete ${r.title}`}
                                className="icon-button"
                                onClick={() => setDeleting(r)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <small className="eyebrow">
                            {kindNames[r.kind]} {r.completed ? '· Paused' : ''}
                          </small>
                          <h2>{r.title}</h2>
                          <p className="balance-value">
                            {fmt(r.amount_cents)} <small>/ {r.frequency}</small>
                          </p>
                          <p className="muted">
                            Starts {r.date}
                            {r.end_date ? ` · Ends ${r.end_date}` : ''}
                          </p>
                          {r.owner_id === null && (
                            <p className="hint">
                              {data.members[0]?.name}: {r.split_bps / 100}% ·{' '}
                              {data.members[1]?.name ?? 'Cheryl'}:{' '}
                              {100 - r.split_bps / 100}%
                            </p>
                          )}
                          {r.kind === 'debt' && r.balance_cents !== null && (
                            <p className="hint">
                              <LockKeyhole size={12} /> Remaining balance:{' '}
                              {fmt(r.balance_cents)} · manually entered
                            </p>
                          )}
                          {r.kind === 'purchase' && (
                            <p className="hint">{r.priority} priority</p>
                          )}
                          {r.note && <p className="hint">{r.note}</p>}
                          {due
                            .filter((e) => e.record.id === r.id)
                            .slice(0, 1)
                            .map((e) => (
                              <button
                                key={e.id}
                                className="text-button"
                                onClick={() => {
                                  setPaying(e);
                                  setPaymentDate(today());
                                  setPayer(e.record.payer_id ?? data.member.id);
                                }}
                              >
                                <Check size={15} /> Record {e.date} payment
                              </button>
                            ))}
                        </section>
                      ))}
                  </div>
                  {!filtered.some((r) =>
                    [
                      'bill',
                      'subscription',
                      'debt',
                      'purchase',
                      'payday',
                      'funding',
                    ].includes(r.kind),
                  ) && (
                    <Empty>
                      Add your first household bill or private pay schedule.
                    </Empty>
                  )}
                </>
              )}
              {view === 'Calendar' && (
                <>
                  <CalendarView
                    records={filtered}
                    entries={data.jointEntries}
                    month={month}
                    edit={openEditor}
                    fmt={fmt}
                  />
                  <section className="panel lower">
                    <div className="section-heading">
                      <h2>On the horizon</h2>
                      <Choice
                        label="Look ahead"
                        value={horizon}
                        onChange={setHorizon}
                        options={['30', '60', '90'].map((v) => [
                          v,
                          `${v} days`,
                        ])}
                      />
                    </div>
                    {due.map((e) => eventRow(e, true))}
                    {!due.length && (
                      <Empty>Your next {horizon} days are clear.</Empty>
                    )}
                    <p className="hint">
                      Reminders appear here {`and in exported calendars`}. Due
                      items show up to 90 days overdue; older commitments remain
                      in Bills & plans.
                    </p>
                    <div className="export-row">
                      <Choice
                        label="Calendar export"
                        value={exportScope}
                        onChange={setExportScope}
                        options={[
                          ['shared', 'Shared events only'],
                          ['mine-and-shared', 'My private + shared events'],
                        ]}
                      />
                      <a
                        className="secondary"
                        href={`/api/notebook?export=calendar&scope=${exportScope}`}
                      >
                        <Download size={16} /> Export for Google Calendar
                      </a>
                    </div>
                    <p className="hint">
                      A one-time .ics snapshot, with titles and dates only.
                      Import into a calendar you control. Keep private events in
                      a private calendar. Export does not automatically sync
                      updates.
                    </p>
                  </section>
                </>
              )}
              {view === 'Cash flow' && (
                <ForecastView
                  data={data}
                  scope={scope === 'shared' ? 'shared' : 'mine'}
                  fmt={fmt}
                />
              )}
              {view === 'Savings goals' && (
                <div className="record-grid">
                  {filtered
                    .filter((r) => r.kind === 'goal')
                    .map((r) => (
                      <section className="panel goal-card" key={r.id}>
                        <div className="section-heading">
                          <Owner r={r} />
                          <Target size={23} />
                        </div>
                        <h2>{r.title}</h2>
                        <p className="balance-value">
                          {fmt(r.saved_cents)}
                          <small> of {fmt(r.amount_cents)}</small>
                        </p>
                        <Progress
                          aria-label={`${r.title} saved`}
                          value={
                            r.amount_cents
                              ? Math.min(
                                  100,
                                  (r.saved_cents / r.amount_cents) * 100,
                                )
                              : 0
                          }
                        />
                        <p className="hint">
                          Target {r.date} · {r.priority} priority
                          {r.completed ? ' · Completed' : ''}
                        </p>
                        <p className="muted">
                          {r.note || 'A little at a time.'}
                        </p>
                        <div className="section-heading lower">
                          <button
                            className="text-button"
                            onClick={() => openEditor('goal', r)}
                          >
                            Update progress <ArrowUpRight size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${r.title}`}
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </section>
                    ))}
                  {!filtered.some((r) => r.kind === 'goal') && (
                    <Empty>
                      What would you like to make room for? Add a savings goal.
                    </Empty>
                  )}
                </div>
              )}
              {view === 'Settings' && (
                <SettingsView
                  data={data}
                  busy={busy}
                  mutate={mutate}
                  invite={invite}
                  setInvite={setInvite}
                />
              )}
              <footer className="page-footer">
                <Leaf size={14} /> A little planning. More room for life.
                <span>
                  {data.household.currency} · Manual entry · {data.member.name}
                  ’s view
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
      >
        <DialogContent className="editor">
          <DialogTitle>
            {editing ? 'Edit' : 'Add'}{' '}
            {draft ? kindNames[draft.kind].toLowerCase() : ''}
          </DialogTitle>
          <DialogDescription>
            {draft?.scope === 'shared'
              ? 'Visible to both of you.'
              : 'Only you can see this item.'}
          </DialogDescription>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {draft && data && (
            <RecordForm
              draft={draft}
              setDraft={setDraft}
              data={data}
              editing={!!editing}
              busy={busy}
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate({ action: 'save', id: editing, record: draft })
                )
                  setDraft(null);
              }}
            />
          )}
          {editing && data && (
            <button
              className="text-button"
              onClick={() => {
                const item = data.records.find((r) => r.id === editing);
                if (item) {
                  setDraft(null);
                  setDeleting(item);
                }
              }}
            >
              <Trash2 size={15} /> Delete this item
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!paying}
        onOpenChange={(open) => {
          if (!open && !busy) setPaying(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Record this payment</DialogTitle>
          <DialogDescription>
            {paying?.record.title} · scheduled {paying?.date} ·{' '}
            {fmt(paying?.record.amount_cents ?? 0)}. Record the date money left
            your account.
          </DialogDescription>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <Field label="Paid on">
            <input
              type="date"
              value={paymentDate}
              max={currentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </Field>
          <Choice
            label="Who paid?"
            value={payer}
            onChange={setPayer}
            options={data?.members.map((m) => [m.id, m.name]) ?? []}
          />
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (
                await mutate({
                  action: 'pay',
                  id: paying!.record.id,
                  date: paying!.date,
                  payment_date: paymentDate,
                  payer_id: payer,
                })
              )
                setPaying(null);
            }}
          >
            Record payment
          </button>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the item. Deleting a recorded payment reopens its
            scheduled occurrence. Existing payments remain if you delete a
            recurring plan.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep item</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (await mutate({ action: 'delete', id: deleting!.id }))
                  setDeleting(null);
              }}
            >
              Delete item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
function Setup({
  busy,
  save,
}: {
  busy: boolean;
  save: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  const [join, setJoin] = useState(false),
    [currency, setCurrency] = useState('CAD');
  return (
    <section className="welcome panel">
      <Leaf size={32} />
      <h1>A fresh page for the two of you.</h1>
      <p>
        Create your household, then invite Cheryl to sign in with her own
        account. Private debts and income stay in each person’s notebook.
      </p>
      <Tabs
        value={join ? 'join' : 'create'}
        onValueChange={(v) => setJoin(v === 'join')}
      >
        <TabsList>
          <TabsTrigger value="create">Create household</TabsTrigger>
          <TabsTrigger value="join">Join with an invitation</TabsTrigger>
        </TabsList>
      </Tabs>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await save({
            action: join ? 'joinHousehold' : 'createHousehold',
            name: f.get('name'),
            token: f.get('token'),
            currency,
          });
        }}
      >
        <Field label="Your name">
          <input name="name" autoComplete="name" required maxLength={60} />
        </Field>
        {join ? (
          <Field label="Invitation code">
            <input name="token" required autoComplete="off" />
          </Field>
        ) : (
          <Choice
            label="Household currency"
            value={currency}
            onChange={setCurrency}
            options={['CAD', 'USD', 'EUR', 'GBP'].map((c) => [c, c])}
          />
        )}
        <button disabled={busy} className="primary full">
          {join ? 'Join our household' : 'Create our notebook'}
        </button>
      </form>
      <small>
        You’ll start with an empty notebook. Sample data is optional in
        Settings.
      </small>
    </section>
  );
}
function RecordForm({
  draft: d,
  setDraft: set,
  data,
  editing,
  busy,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (v: Draft) => void;
  data: Notebook;
  editing: boolean;
  busy: boolean;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
}) {
  const change = (key: keyof Draft, value: string | boolean) =>
    set({ ...d, [key]: value });
  const noMoney = ['reminder', 'review'].includes(d.kind),
    privateOnly = ['debt', 'payday'].includes(d.kind),
    sharedOnly = ['funding', 'settlement'].includes(d.kind);
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <Choice
        label="Item type"
        value={d.kind}
        disabled={editing}
        onChange={(v) =>
          set({
            ...d,
            kind: v as Kind,
            account: v === 'transaction' ? d.account : 'personal',
            received: v === 'payday' ? d.received : false,
            scope: ['debt', 'payday'].includes(v)
              ? 'mine'
              : ['funding', 'settlement'].includes(v)
                ? 'shared'
                : d.scope,
            frequency: [
              'transaction',
              'settlement',
              'budget',
              'goal',
              'purchase',
            ].includes(v)
              ? 'once'
              : d.frequency,
            date: v === 'budget' ? d.date.slice(0, 7) + '-01' : d.date,
          })
        }
        options={kinds.map((k) => [k, kindNames[k]])}
      />
      <Choice
        label="Ownership"
        value={d.scope}
        disabled={editing || privateOnly || sharedOnly}
        onChange={(v) =>
          set({
            ...d,
            scope: v,
            account: v === 'mine' ? 'personal' : d.account,
          })
        }
        options={[
          ['mine', `Mine · ${data.member.name}`],
          ['shared', 'Shared'],
        ]}
      />
      <Field label="Description / merchant">
        <input
          value={d.title}
          onChange={(e) => change('title', e.target.value)}
          maxLength={160}
          required
        />
      </Field>
      {!noMoney && (
        <Field label={`Amount (${data.household.currency})`}>
          <input
            inputMode="decimal"
            value={d.amount}
            onChange={(e) => change('amount', e.target.value)}
            pattern="[0-9]+(\.[0-9]{1,2})?"
            required
          />
        </Field>
      )}
      <Field
        label={
          d.kind === 'budget'
            ? 'Month (first day)'
            : ['goal', 'purchase'].includes(d.kind)
              ? 'Target date'
              : 'Date / first due date'
        }
      >
        <input
          type="date"
          value={d.date}
          min="2000-01-01"
          max="2100-12-31"
          required
          onChange={(e) => change('date', e.target.value)}
        />
      </Field>
      <Choice
        label="Category"
        value={d.category_id}
        onChange={(v) => change('category_id', v)}
        options={data.categories.map((c) => [c.id, c.name])}
      />
      {!['transaction', 'settlement', 'budget', 'goal', 'purchase'].includes(
        d.kind,
      ) && (
        <>
          <Choice
            label="Repeats"
            value={d.frequency}
            onChange={(v) =>
              set({
                ...d,
                frequency: v as Draft['frequency'],
                received: v === 'once' ? d.received : false,
              })
            }
            options={frequencies.map((f) => [
              f,
              f === 'biweekly'
                ? 'Every two weeks'
                : f === 'semimonthly'
                  ? 'Twice monthly (two dates)'
                  : f === 'every_two_months'
                    ? 'Every two months'
                    : f[0].toUpperCase() + f.slice(1),
            ])}
          />
          <Field label="Last date (optional)">
            <input
              type="date"
              value={d.end_date}
              onChange={(e) => change('end_date', e.target.value)}
            />
          </Field>
        </>
      )}
      {d.scope === 'shared' &&
        !noMoney &&
        !['settlement', 'funding'].includes(d.kind) && (
          <div className="split-box full">
            <Field
              label={`${data.members[0]?.name ?? 'First member'}’s share (%)`}
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={Number(d.split_bps) / 100}
                onChange={(e) =>
                  change(
                    'split_bps',
                    String(Math.round(Number(e.target.value) * 100)),
                  )
                }
              />
            </Field>
            <p>
              {data.members[1]?.name ?? 'Cheryl'}’s share:{' '}
              {100 - Number(d.split_bps) / 100}%<br />
              {allocation(
                Math.round((Number(d.amount) || 0) * 100),
                Number(d.split_bps),
              )
                .map((n) => money(n, data.household.currency))
                .join(' / ')}
            </p>
          </div>
        )}
      {d.scope === 'shared' &&
        [
          'transaction',
          'settlement',
          'bill',
          'subscription',
          'funding',
        ].includes(d.kind) && (
          <Choice
            label={
              d.kind === 'settlement'
                ? 'Who sent the reimbursement?'
                : d.kind === 'funding'
                  ? 'Who contributes?'
                  : ['bill', 'subscription'].includes(d.kind)
                    ? 'Whose account pays this bill?'
                    : 'Who paid?'
            }
            value={d.payer_id}
            onChange={(v) => change('payer_id', v)}
            options={data.members.map((m) => [m.id, m.name])}
          />
        )}
      {d.kind === 'debt' && (
        <Field label="Remaining debt balance (optional)">
          <input
            inputMode="decimal"
            value={d.balance}
            onChange={(e) => change('balance', e.target.value)}
          />
        </Field>
      )}
      {d.frequency === 'semimonthly' && (
        <Field label="Second payday · day of month (2–31)">
          <input
            type="number"
            min="2"
            max="31"
            value={d.second_day}
            onChange={(e) => change('second_day', e.target.value)}
          />
        </Field>
      )}
      {d.kind === 'payday' && (
        <>
          <Choice
            label="Income certainty"
            value={d.dependable ? 'regular' : 'extra'}
            onChange={(v) => change('dependable', v === 'regular')}
            options={[
              ['regular', 'Dependable income'],
              ['extra', 'Extra / irregular · exclude from baseline'],
            ]}
          />
          {d.frequency === 'once' && (
            <Choice
              label="One-off income status"
              value={d.received ? 'received' : 'expected'}
              onChange={(v) => change('received', v === 'received')}
              options={[
                ['expected', 'Expected, not yet received'],
                ['received', 'Received in my account'],
              ]}
            />
          )}
          <p className="hint full">
            Twice monthly means two dates each month (24 paydays/year). Every
            two weeks means a 14-day interval. Keep computer-work money marked
            extra until it arrives; note its agreed destination below.
          </p>
        </>
      )}
      {d.kind === 'transaction' && d.scope === 'shared' && (
        <>
          <Choice
            label="Spending account"
            value={d.account}
            onChange={(v) => change('account', v)}
            options={[
              ['personal', 'Member’s account · split/reimburse'],
              ['joint', 'Joint spending pot · no reimbursement'],
            ]}
          />
          {d.account === 'joint' && (
            <Choice
              label="Paid using"
              value={d.payment_method}
              onChange={(v) => change('payment_method', v)}
              options={[
                ['debit', 'Joint debit card'],
                ['card', 'Credit card · reserve immediate repayment'],
              ]}
            />
          )}
        </>
      )}
      {d.kind === 'transaction' && d.scope === 'mine' && (
        <Choice
          label="Private spending bucket"
          value={d.spending_bucket}
          onChange={(v) => change('spending_bucket', v)}
          options={[
            ['fixed', 'Fixed / essential costs'],
            ['discretionary', 'Personal spending allowance'],
          ]}
        />
      )}
      {d.kind === 'goal' && (
        <Field label="Already saved">
          <input
            inputMode="decimal"
            value={d.saved}
            onChange={(e) => change('saved', e.target.value)}
            required
          />
        </Field>
      )}
      {['purchase', 'goal'].includes(d.kind) && (
        <Choice
          label="Priority"
          value={d.priority}
          onChange={(v) => change('priority', v)}
          options={['low', 'medium', 'high'].map((p) => [
            p,
            p[0].toUpperCase() + p.slice(1),
          ])}
        />
      )}
      {!['transaction', 'settlement', 'budget'].includes(d.kind) && (
        <>
          <Field label="Remind me (days before)">
            <input
              type="number"
              min="0"
              max="90"
              value={d.remind_days}
              onChange={(e) => change('remind_days', e.target.value)}
            />
          </Field>
          <Choice
            label="Status"
            value={d.completed ? 'complete' : 'active'}
            onChange={(v) => change('completed', v === 'complete')}
            options={[
              ['active', 'Active'],
              ['complete', 'Paused / completed'],
            ]}
          />
        </>
      )}
      <div className="full">
        <Field
          label={
            d.kind === 'budget'
              ? 'Reflection · what could improve next month?'
              : 'Note (optional)'
          }
        >
          <textarea
            rows={3}
            value={d.note}
            maxLength={2000}
            onChange={(e) => change('note', e.target.value)}
          />
        </Field>
      </div>
      {d.kind === 'payday' && (
        <p className="hint full">
          Enter expected net income per payday. Your partner cannot see this
          schedule.
        </p>
      )}
      {d.kind === 'funding' && (
        <p className="hint full">
          A planned transfer from the named contributor to the joint account.
          Record the actual deposit in Household rhythm after moving the money.
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? 'Saving…' : 'Save to notebook'}
      </button>
    </form>
  );
}
function Budget({
  data,
  month,
  scope,
  edit,
  fmt,
}: {
  data: Notebook;
  month: string;
  scope: string;
  edit: (k: Kind, r?: RecordItem, o?: Partial<Draft>) => void;
  fmt: (n: number) => string;
}) {
  const rows = budgetRows(
    data.records,
    data.categories,
    month,
    scope,
    data.member,
  );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>
            {scope === 'shared' ? 'Our shared plan' : 'My private monthly plan'}
          </h2>
          <p className="hint">
            {scope === 'shared'
              ? 'Full shared totals; split details stay with each bill.'
              : 'Private spending only. Open Shared to review household totals.'}
          </p>
        </div>
        <Owner r={{ owner_id: scope === 'shared' ? null : data.member.id }} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              'Category',
              'Planned',
              'Actual',
              'Difference',
              'Reflection',
              '',
            ].map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.category.id}>
              <TableCell>{row.category.name}</TableCell>
              <TableCell>{fmt(row.planned)}</TableCell>
              <TableCell>{fmt(row.actual)}</TableCell>
              <TableCell className={row.difference < 0 ? 'overdue' : ''}>
                {fmt(row.difference)}
              </TableCell>
              <TableCell className="note-cell">
                {row.budget?.note || '—'}
              </TableCell>
              <TableCell>
                <button
                  className="icon-button"
                  aria-label={`Plan ${row.category.name}`}
                  onClick={() =>
                    edit('budget', row.budget, {
                      scope,
                      category_id: row.category.id,
                      title: row.category.name + ' plan',
                      date: month + '-01',
                    })
                  }
                >
                  <Pencil size={16} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="budget-total">
        <b>This month</b>
        <span>{fmt(rows.reduce((n, r) => n + r.planned, 0))} planned</span>
        <span>{fmt(rows.reduce((n, r) => n + r.actual, 0))} actual</span>
      </div>
      <p className="hint">
        Positive difference means room left in the plan. A negative difference
        means spending exceeded the plan. Savings goals track progress
        separately; record actual savings or debt outflows as transactions to
        include them here.
      </p>
    </section>
  );
}
function CalendarView({
  records,
  entries,
  month,
  edit,
  fmt,
}: {
  records: RecordItem[];
  entries?: JointEntry[];
  month: string;
  edit: (k: Kind, r?: RecordItem) => void;
  fmt: (n: number) => string;
}) {
  const first = month + '-01',
    last = addDays(addMonths(first, 1), -1),
    list = events(records, first, last, entries),
    offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  return (
    <section className="panel calendar-panel">
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="weekday">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div className="calendar-day outside" key={'empty' + i} />
        ))}
        {Array.from({ length: Number(last.slice(8)) }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div
              className={'calendar-day ' + (date === today() ? 'today' : '')}
              key={date}
            >
              <span className="day-number">{i + 1}</span>
              {list
                .filter((e) => e.date === date)
                .map((e) => (
                  <button
                    key={e.id}
                    className={
                      'calendar-event ' +
                      (e.record.owner_id ? 'personal' : 'shared') +
                      (e.paid ? ' paid' : '')
                    }
                    onClick={() => edit(e.record.kind, e.record)}
                    title={`${e.record.title} · ${fmt(e.record.amount_cents)} · ${e.record.owner_id ? 'Mine' : 'Shared'}`}
                  >
                    <span>
                      {e.paid ? '✓ ' : ''}
                      {e.record.owner_id ? 'Mine' : 'Shared'} · {e.record.title}
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      <p className="hint">
        Private events are blue. Shared events are green. Select an event to
        view or edit its plan. Record due payments in the timeline below.
      </p>
    </section>
  );
}
function ForecastView({
  data,
  scope,
  fmt,
}: {
  data: Notebook;
  scope: 'mine' | 'shared';
  fmt: (n: number) => string;
}) {
  const start = today().slice(0, 7) + '-01';
  const [opening, setOpening] = useState('0');
  const rows = forecast(
    data.records,
    data.member,
    start,
    scope,
    scope === 'shared' ? Math.round((Number(opening) || 0) * 100) : 0,
    start,
    data.jointEntries,
  );
  const privateStart = data.member.opening_date ?? today();
  const personal = forecast(
    data.records,
    data.member,
    privateStart,
    'mine',
    data.member.opening_cents ?? 0,
    start,
    data.jointEntries,
  );
  const display = scope === 'shared' ? rows : personal;
  const max = Math.max(1, ...display.flatMap((r) => [r.income, r.expense]));
  return (
    <>
      <div className="notice">
        <LockKeyhole size={18} />
        {scope === 'shared'
          ? 'This view compares shared commitments with explicitly entered shared funding. Neither person’s private income or debts are included.'
          : 'Your private income and commitments, plus your portion of shared bills. This is a spending-responsibility forecast; temporary advances and reimbursements are shown separately on the dashboard.'}
      </div>
      {scope === 'shared' ? (
        <section className="panel">
          <Field label="Shared opening amount · scenario only">
            <input
              className="small-input"
              type="number"
              step="0.01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </Field>
          <p className="hint">
            Starts {start}. Add a shared funding plan in Bills & plans to cover
            household commitments.
          </p>
        </section>
      ) : (
        <div className="hint forecast-note">
          Opening balance: {fmt(data.member.opening_cents ?? 0)} on{' '}
          {privateStart}. Update this private snapshot in Settings. Include only
          cash available before that day’s activity.
        </div>
      )}
      <section className="panel lower">
        <div className="section-heading">
          <h2>The coming year</h2>
          <span className="chart-legend">
            <i /> Income / funding <i /> Commitments
          </span>
        </div>
        <figure
          className="forecast-chart"
          aria-label="Monthly income and planned commitments; exact values are in the table below"
        >
          {display.map((r) => (
            <div className="chart-month" key={r.month}>
              <div className="bars">
                <div style={{ height: `${(r.income / max) * 100}%` }} />
                <div style={{ height: `${(r.expense / max) * 100}%` }} />
              </div>
              <span>
                {new Date(r.month + '-01T12:00:00Z').toLocaleDateString('en', {
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </span>
            </div>
          ))}
        </figure>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                'Month',
                'Income / funding',
                'Commitments',
                'Projected balance',
                'Pressure points',
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((r) => (
              <TableRow key={r.month}>
                <TableCell>{monthLabel(r.month)}</TableCell>
                <TableCell>{fmt(r.income)}</TableCell>
                <TableCell>{fmt(r.expense)}</TableCell>
                <TableCell className={r.balance < 0 ? 'overdue' : ''}>
                  {fmt(r.balance)}
                </TableCell>
                <TableCell className="note-cell">
                  {r.low < 0 ? (
                    <>
                      <span className="overdue">
                        Low point {fmt(r.low)}
                        {r.pressure[0] ? ' · ' + r.pressure[0].date : ''}
                      </span>
                      <small className="table-note">
                        Main commitments:{' '}
                        {r.drivers
                          .map((d) => `${d.title} (${fmt(d.expense)})`)
                          .join(', ') || 'Carried-over shortfall'}
                      </small>
                    </>
                  ) : r.expense > r.income ? (
                    'Commitments exceed income this month'
                  ) : (
                    'Within listed funds'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="hint">
          Estimates include active pay schedules, bills, subscriptions, debt
          payments, planned purchases, and actual expenses after the opening
          date. Paid occurrences count once. Savings goals, reminders, and
          category budgets are not extra bills. Variable day-to-day spending
          that hasn’t been entered is not predicted. No interest or inflation is
          assumed.
        </p>
      </section>
    </>
  );
}
function SettingsView({
  data,
  busy,
  mutate,
  invite,
  setInvite,
}: {
  data: Notebook;
  busy: boolean;
  mutate: (
    v: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  invite: string;
  setInvite: (v: string) => void;
}) {
  return (
    <div className="columns settings-grid">
      <section className="panel">
        <h2>My private setup</h2>
        <form
          key={`${data.member.name}-${data.member.opening_date}`}
          className="form-grid lower"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await mutate({
              action: 'profile',
              name: f.get('name'),
              opening: f.get('opening'),
              date: f.get('date'),
            });
          }}
        >
          <Field label="My name">
            <input
              name="name"
              defaultValue={data.member.name}
              required
              maxLength={60}
            />
          </Field>
          <Field label={`Available balance (${data.household.currency})`}>
            <input
              name="opening"
              defaultValue={(data.member.opening_cents ?? 0) / 100}
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Balance at start of day">
            <input
              name="date"
              type="date"
              defaultValue={data.member.opening_date}
              required
            />
          </Field>
          <button className="primary full" disabled={busy}>
            Save my setup
          </button>
        </form>
        <p className="hint">
          Only you can see this balance. Both of you can see your display name.
          Household currency is fixed at creation.
        </p>
      </section>
      <section className="panel">
        <h2>The two of us</h2>
        {data.members.map((m) => (
          <div className="member-row" key={m.id}>
            <span className="avatar">{m.name[0]}</span>
            <div>
              <b>{m.name}</b>
              <small className="table-note">
                {m.id === data.member.id
                  ? 'Your private notebook + shared plans'
                  : 'Separate private notebook + shared plans'}
              </small>
            </div>
          </div>
        ))}
        {data.members.length < 2 ? (
          <>
            <p className="muted">
              Invite Cheryl to join this household with her own ChatGPT login.
            </p>
            <button
              className="secondary lower"
              disabled={busy}
              onClick={async () => {
                const r = await mutate({ action: 'invite' });
                if (r) setInvite(String(r.token));
              }}
            >
              Create a one-use invitation
            </button>
            {invite && (
              <div className="invite">
                <Field label="Invitation code · expires in 7 days">
                  <textarea readOnly rows={3} value={invite} />
                </Field>
                <p className="hint">
                  Share this code directly with Cheryl. A new code invalidates
                  the previous one.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="hint">
            <Check size={14} /> Your household has both members.
          </p>
        )}
        <p className="hint">
          Each person only sees “Mine” and “Shared.” Your partner’s private
          items never appear, even as totals.
        </p>
      </section>
      <section className="panel">
        <h2>Make the categories yours</h2>
        <p className="hint">
          Category names are shared. Renaming one preserves linked history.
        </p>
        {data.categories.map((c) => (
          <form
            className="category-row"
            key={c.id}
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate({
                action: 'category',
                id: c.id,
                name: new FormData(e.currentTarget).get('name'),
              });
            }}
          >
            <input
              aria-label={`Rename ${c.name}`}
              name="name"
              defaultValue={c.name}
              required
              maxLength={60}
            />
            <button
              className="icon-button"
              aria-label={`Save ${c.name} category`}
              disabled={busy}
            >
              <Check size={16} />
            </button>
          </form>
        ))}
        <form
          className="category-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            if (
              await mutate({
                action: 'category',
                name: new FormData(f).get('name'),
              })
            )
              f.reset();
          }}
        >
          <input
            name="name"
            aria-label="New category"
            placeholder="New category…"
            required
            maxLength={60}
          />
          <button
            className="icon-button"
            aria-label="Add category"
            disabled={busy}
          >
            <Plus size={17} />
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>A safe place to begin</h2>
        <p className="muted lower">
          Start by adding rent, water, electricity, and Wi-Fi with the split
          that works for each bill. Add your own paydays, personal
          subscriptions, and debts separately.
        </p>
        <h3 className="lower">Optional sample notebook</h3>
        <p className="hint">
          Adds clearly illustrative amounts for household bills and your own
          spending. These are saved records, not your real finances. Available
          only while your visible notebook is empty; remove sample records
          individually before using it for real.
        </p>
        <button
          className="secondary lower"
          disabled={busy || data.records.length > 0}
          onClick={() => void mutate({ action: 'seed' })}
        >
          Add illustrative sample data
        </button>
        <h3 className="lower">Calendar and connections</h3>
        <p className="hint">
          Export shared events or your private + shared events from Calendar.
          Google Calendar accepts the .ics file under Settings → Import &
          export. This is a snapshot. Live Google sync and future bank providers
          are documented next steps; no bank connection or import is active.
        </p>
      </section>
    </div>
  );
}
