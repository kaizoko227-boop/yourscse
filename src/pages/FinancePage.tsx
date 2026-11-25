import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Download,
  PiggyBank,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, enqueueSync } from '../db/database';
import { generateId } from '../lib/crypto';
import { formatNPR, formatShortDate, getCurrentMonthISO, getTodayISO } from '../lib/dateUtils';
import type {
  AccountType,
  FinanceAccount,
  FinanceBudget,
  FinanceTransaction,
  PaymentMethod,
  SavingsGoal,
} from '../types/models';
import { EmptyState, Modal, PageHeader } from '../components/ui/Modal';

type FinanceTab = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'reports';

const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Education & Books',
  'Internet & Mobile',
  'Rent & Utilities',
  'Tech & Subscriptions',
  'Health',
  'Shopping',
  'Entertainment',
  'Other Expense',
];

const INCOME_CATEGORIES = [
  'Allowance / Family',
  'Freelance / Projects',
  'Part-time Job',
  'Scholarship',
  'Bug Bounty / CTF',
  'Gift',
  'Other Income',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'eSewa',
  'Khalti',
  'IME Pay',
  'ConnectIPS',
  'Debit/Credit Card',
  'Other',
];

const CHART_COLORS = ['#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6', '#EF4444'];

export function FinancePage() {
  const todayISO = getTodayISO();
  const currentMonth = getCurrentMonthISO();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [accountFilter, setAccountFilter] = useState('all');

  // Transaction Modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [txDate, setTxDate] = useState(todayISO);
  const [txDesc, setTxDesc] = useState('');
  const [txCounterparty, setTxCounterparty] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const [txToAccountId, setTxToAccountId] = useState('');
  const [txPayment, setTxPayment] = useState<PaymentMethod>('eSewa');

  // Account Modal
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('esewa');
  const [accBalance, setAccBalance] = useState('0');
  const [accNotes, setAccNotes] = useState('');

  // Budget Modal
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [budgetLimit, setBudgetLimit] = useState('');

  // Savings Goal Modal
  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalDeadline, setGoalDeadline] = useState('');

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? [];
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []) ?? [];

  // Compute live balance for each account from real transactions
  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((a) => map.set(a.id, a.initialBalance));
    transactions.forEach((t) => {
      if (t.type === 'income') {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) + t.amount);
      } else if (t.type === 'expense') {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) - t.amount);
      } else if (t.type === 'transfer') {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) - t.amount);
        if (t.toAccountId) {
          map.set(t.toAccountId, (map.get(t.toAccountId) ?? 0) + t.amount);
        }
      }
    });
    return map;
  }, [accounts, transactions]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Real financial metrics
  const metrics = useMemo(() => {
    const netBalance = accounts.reduce((s, a) => s + (accountBalances.get(a.id) ?? a.initialBalance), 0);
    const monthTx = transactions.filter((t) => t.date.startsWith(selectedMonth));
    const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savingsRate =
      monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0;

    // Daily average spending across elapsed days in selected month
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const isCurrentMonth = selectedMonth === currentMonth;
    const elapsedDays = isCurrentMonth ? Math.max(1, Number(todayISO.slice(-2))) : daysInMonth;
    const dailyAvgSpending = monthExpense > 0 ? Math.round(monthExpense / elapsedDays) : 0;

    // Top expense categories
    const expCatMap = new Map<string, number>();
    monthTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => expCatMap.set(t.category, (expCatMap.get(t.category) ?? 0) + t.amount));
    const topExpenses = Array.from(expCatMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Income sources
    const incCatMap = new Map<string, number>();
    monthTx
      .filter((t) => t.type === 'income')
      .forEach((t) => incCatMap.set(t.category, (incCatMap.get(t.category) ?? 0) + t.amount));
    const incomeSources = Array.from(incCatMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly 6-month history trend (real transactions only)
    const monthlyTrend: { month: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(yr, mo - 1 - i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = dt.toLocaleDateString('en-US', { month: 'short' });
      const mTxs = transactions.filter((t) => t.date.startsWith(ym));
      monthlyTrend.push({
        month: label,
        income: mTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: mTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }

    return {
      netBalance,
      monthIncome,
      monthExpense,
      savingsRate,
      dailyAvgSpending,
      topExpenses,
      incomeSources,
      monthlyTrend,
      expCatMap,
    };
  }, [accounts, accountBalances, transactions, selectedMonth, currentMonth, todayISO]);

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (accountFilter !== 'all' && t.accountId !== accountFilter && t.toAccountId !== accountFilter)
          return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.counterparty.toLowerCase().includes(q) ||
            t.paymentMethod.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, typeFilter, accountFilter, searchQuery]);

  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const openTxModal = (type: 'income' | 'expense' | 'transfer' = 'expense') => {
    setTxType(type);
    setTxCategory(type === 'income' ? INCOME_CATEGORIES[0] : type === 'transfer' ? 'Transfer' : EXPENSE_CATEGORIES[0]);
    setTxAmount('');
    setTxDesc('');
    setTxCounterparty('');
    setTxDate(todayISO);
    setTxAccountId(accounts[0]?.id || '');
    setTxToAccountId(accounts[1]?.id || accounts[0]?.id || '');
    setTxModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const now = new Date().toISOString();
    const record: FinanceAccount = {
      id: generateId('acc'),
      name: accName.trim(),
      type: accType,
      initialBalance: Number(accBalance) || 0,
      currency: 'NPR',
      color: CHART_COLORS[accounts.length % CHART_COLORS.length],
      notes: accNotes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await db.accounts.put(record);
    await enqueueSync('accounts', record.id, 'upsert', record);
    setAccName('');
    setAccBalance('0');
    setAccNotes('');
    setAccModalOpen(false);
  };

  const deleteAccount = async (id: string) => {
    await db.accounts.delete(id);
    await enqueueSync('accounts', id, 'delete');
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(txAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    // Auto-create a default Cash account if user records a transaction before adding accounts
    let accountId = txAccountId;
    if (!accountId) {
      const now = new Date().toISOString();
      const defaultAcc: FinanceAccount = {
        id: generateId('acc'),
        name: txPayment === 'Cash' ? 'Cash Wallet' : txPayment,
        type: txPayment === 'eSewa' ? 'esewa' : txPayment === 'Khalti' ? 'khalti' : txPayment === 'Cash' ? 'cash' : 'bank',
        initialBalance: 0,
        currency: 'NPR',
        color: '#06B6D4',
        notes: 'Auto-created account',
        createdAt: now,
        updatedAt: now,
      };
      await db.accounts.put(defaultAcc);
      await enqueueSync('accounts', defaultAcc.id, 'upsert', defaultAcc);
      accountId = defaultAcc.id;
    }

    const now = new Date().toISOString();
    const record: FinanceTransaction = {
      id: generateId('tx'),
      type: txType,
      amount: amt,
      category: txType === 'transfer' ? 'Transfer' : txCategory,
      date: txDate,
      description: txDesc.trim() || txCategory,
      counterparty: txCounterparty.trim(),
      accountId,
      toAccountId: txType === 'transfer' ? txToAccountId : undefined,
      paymentMethod: txPayment,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await db.transactions.put(record);
    await enqueueSync('transactions', record.id, 'upsert', record);
    setTxModalOpen(false);
  };

  const deleteTransaction = async (id: string) => {
    await db.transactions.delete(id);
    await enqueueSync('transactions', id, 'delete');
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const lim = Number(budgetLimit);
    if (!Number.isFinite(lim) || lim <= 0) return;
    const existing = budgets.find((b) => b.category === budgetCategory && b.month === selectedMonth);
    const record: FinanceBudget = {
      id: existing?.id || generateId('bud'),
      category: budgetCategory,
      month: selectedMonth,
      limitAmount: lim,
      updatedAt: new Date().toISOString(),
    };
    await db.budgets.put(record);
    await enqueueSync('budgets', record.id, 'upsert', record);
    setBudgetLimit('');
    setBudgetModalOpen(false);
  };

  const handleSaveSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(goalTarget);
    if (!goalTitle.trim() || !Number.isFinite(target) || target <= 0) return;
    const now = new Date().toISOString();
    const record: SavingsGoal = {
      id: generateId('sav'),
      title: goalTitle.trim(),
      targetAmount: target,
      currentAmount: Number(goalCurrent) || 0,
      deadline: goalDeadline,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await db.savingsGoals.put(record);
    await enqueueSync('savingsGoals', record.id, 'upsert', record);
    setGoalTitle('');
    setGoalTarget('');
    setGoalCurrent('0');
    setGoalDeadline('');
    setSavingsModalOpen(false);
  };

  const exportFinanceCSV = () => {
    const header = ['Date', 'Type', 'Amount (NPR)', 'Category', 'Description', 'Source/Recipient', 'Account', 'Payment Method'];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type,
      String(t.amount),
      t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.counterparty.replace(/"/g, '""')}"`,
      `"${(accountMap.get(t.accountId)?.name || '').replace(/"/g, '""')}"`,
      t.paymentMethod,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-life-os-finance-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Finance"
        subtitle="NPR cashflow, Nepal wallets (eSewa, Khalti, Bank, Cash), budgets, and real analytics"
        actions={
          <>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="os-input py-2 px-3 text-xs font-mono !w-auto"
            />
            <button
              type="button"
              onClick={() => setAccModalOpen(true)}
              className="os-btn-secondary text-xs py-2 px-3"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Add Account
            </button>
            <button
              type="button"
              onClick={() => openTxModal('expense')}
              className="os-btn-primary text-xs py-2 px-3.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Transaction
            </button>
          </>
        }
      />

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'transactions', label: `Transactions (${transactions.length})` },
              { id: 'accounts', label: `Accounts (${accounts.length})` },
              { id: 'budgets', label: 'Budgets & Goals' },
              { id: 'reports', label: 'Reports' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-[0_4px_14px_-3px_rgba(6,182,212,0.55)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {transactions.length > 0 && (
          <button type="button" onClick={exportFinanceCSV} className="os-btn-ghost text-xs py-1.5">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="os-card p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Net Balance</div>
              <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums mt-1">
                {formatNPR(metrics.netBalance)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="os-card p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Monthly Income</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {formatNPR(metrics.monthIncome)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">{selectedMonth}</div>
            </div>

            <div className="os-card p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Monthly Expenses</span>
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                {formatNPR(metrics.monthExpense)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                Daily avg: {formatNPR(metrics.dailyAvgSpending)}
              </div>
            </div>

            <div className="os-card p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Savings Rate</div>
              <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums mt-1">
                {metrics.monthIncome > 0 ? `${metrics.savingsRate}%` : '—'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                Net flow: {formatNPR(metrics.monthIncome - metrics.monthExpense)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Monthly Bar Chart */}
            <div className="lg:col-span-7 os-card p-5">
              <h2 className="text-sm font-semibold mb-1">6-Month Income vs Expenses (NPR)</h2>
              <p className="text-xs text-slate-500 mb-4">Calculated exclusively from recorded transactions</p>
              {transactions.length === 0 ? (
                <EmptyState
                  compact
                  icon={<BarChart3 className="w-5 h-5" />}
                  title="No financial records yet"
                  description="Record your first income or expense in NPR to generate live monthly cashflow charts."
                  action={
                    <button
                      type="button"
                      onClick={() => openTxModal('income')}
                      className="os-btn-primary text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Log First Transaction
                    </button>
                  }
                />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => formatNPR(v)}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.2)',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="income" name="Income" fill="#10B981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="expense" name="Expense" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent Transactions & Top Categories */}
            <div className="lg:col-span-5 os-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Recent Activity</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>
              {transactions.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Wallet className="w-5 h-5" />}
                  title="Zero transactions logged"
                  description="Add your eSewa, Khalti, Bank, or Cash entries to track every rupee."
                />
              ) : (
                <div className="space-y-2">
                  {filteredTransactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/55 dark:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.type === 'income'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : tx.type === 'expense'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-sky-500/10 text-sky-600'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : tx.type === 'expense' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{tx.description}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {tx.category} • {tx.paymentMethod}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-mono font-semibold ${
                            tx.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'expense'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatNPR(tx.amount)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{tx.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="os-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, category, eSewa, recipient..."
                className="os-input !pl-9 py-2 text-xs"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="os-input py-2 text-xs !w-auto"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="os-input py-2 text-xs !w-auto"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No matching transactions"
              description="Add an income, expense, or account transfer to start your chronological ledger."
              action={
                <button
                  type="button"
                  onClick={() => openTxModal('expense')}
                  className="os-btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Transaction
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/50 dark:border-white/[0.08] text-slate-500">
                    <th className="py-2.5 pr-3 font-medium">Date</th>
                    <th className="py-2.5 pr-3 font-medium">Description</th>
                    <th className="py-2.5 pr-3 font-medium">Category</th>
                    <th className="py-2.5 pr-3 font-medium">Account / Method</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/45 dark:divide-white/[0.07]">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/55 dark:hover:bg-white/[0.06]">
                      <td className="py-3 pr-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatShortDate(tx.date)}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </div>
                        {tx.counterparty && (
                          <div className="text-[11px] text-slate-400">{tx.counterparty}</div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/[0.09]">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
                        <div>{accountMap.get(tx.accountId)?.name || 'Account'}</div>
                        <div className="text-[10px] text-slate-400">{tx.paymentMethod}</div>
                      </td>
                      <td
                        className={`py-3 pr-3 text-right font-mono font-semibold whitespace-nowrap ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'expense'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}
                        {formatNPR(tx.amount)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <div className="os-card p-5">
              <EmptyState
                icon={<CreditCard className="w-5 h-5" />}
                title="No financial accounts added yet"
                description="Add your Cash wallet, Nepal Bank account, eSewa, Khalti, or Savings account to track real balances and transfers."
                action={
                  <button
                    type="button"
                    onClick={() => setAccModalOpen(true)}
                    className="os-btn-primary text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add First Account
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const liveBalance = accountBalances.get(acc.id) ?? acc.initialBalance;
                return (
                  <div key={acc.id} className="os-card p-5 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                          {acc.type}
                        </span>
                        <h3 className="text-base font-semibold mt-2">{acc.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAccount(acc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-5">
                      <div className="text-xs text-slate-500">Current Balance</div>
                      <div className="text-2xl font-semibold font-mono tabular-nums mt-0.5">
                        {formatNPR(liveBalance)}
                      </div>
                      {acc.notes && <p className="text-xs text-slate-400 mt-2">{acc.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BUDGETS & SAVINGS GOALS TAB */}
      {activeTab === 'budgets' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly Budgets */}
          <div className="os-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Monthly Budgets ({selectedMonth})</h2>
                <p className="text-xs text-slate-500">Track category spending against monthly limits</p>
              </div>
              <button
                type="button"
                onClick={() => setBudgetModalOpen(true)}
                className="os-btn-secondary py-1.5 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Set Budget
              </button>
            </div>

            {monthBudgets.length === 0 ? (
              <EmptyState
                compact
                icon={<Wallet className="w-5 h-5" />}
                title="No monthly budgets set"
                description="Set NPR spending caps for Food, Transport, Tech, or Education."
              />
            ) : (
              <div className="space-y-3">
                {monthBudgets.map((b) => {
                  const spent = metrics.expCatMap.get(b.category) ?? 0;
                  const pct = Math.min(100, Math.round((spent / b.limitAmount) * 100));
                  const over = spent > b.limitAmount;
                  return (
                    <div key={b.id} className="p-3.5 rounded-xl bg-white/55 dark:bg-white/[0.05] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{b.category}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className={over ? 'text-rose-500 font-semibold' : ''}>
                            {formatNPR(spent)} / {formatNPR(b.limitAmount)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await db.budgets.delete(b.id);
                              await enqueueSync('budgets', b.id, 'delete');
                            }}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Savings Goals */}
          <div className="os-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Savings Goals</h2>
                <p className="text-xs text-slate-500">Emergency fund, laptop upgrade, certifications</p>
              </div>
              <button
                type="button"
                onClick={() => setSavingsModalOpen(true)}
                className="os-btn-secondary py-1.5 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Goal
              </button>
            </div>

            {savingsGoals.length === 0 ? (
              <EmptyState
                compact
                icon={<PiggyBank className="w-5 h-5" />}
                title="No savings goals created"
                description="Set NPR targets for exam vouchers, hardware, or emergency savings."
              />
            ) : (
              <div className="space-y-3">
                {savingsGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <div key={g.id} className="p-3.5 rounded-xl bg-white/55 dark:bg-white/[0.05] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{g.title}</div>
                          {g.deadline && (
                            <div className="text-[11px] text-slate-400">
                              Target: {formatShortDate(g.deadline)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const add = prompt('Add NPR amount to this savings goal:', '1000');
                              const num = Number(add);
                              if (!Number.isFinite(num) || num === 0) return;
                              const updated = {
                                ...g,
                                currentAmount: Math.max(0, g.currentAmount + num),
                                updatedAt: new Date().toISOString(),
                              };
                              await db.savingsGoals.put(updated);
                              await enqueueSync('savingsGoals', updated.id, 'upsert', updated);
                            }}
                            className="text-[11px] font-medium px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                          >
                            + Contribute
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await db.savingsGoals.delete(g.id);
                              await enqueueSync('savingsGoals', g.id, 'delete');
                            }}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span>{formatNPR(g.currentAmount)}</span>
                        <span className="text-slate-400">{formatNPR(g.targetAmount)} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="os-card p-5">
            <h2 className="text-sm font-semibold mb-1">Top Expense Categories ({selectedMonth})</h2>
            <p className="text-xs text-slate-500 mb-4">Real category distribution</p>
            {metrics.topExpenses.length === 0 ? (
              <EmptyState
                compact
                icon={<TrendingDown className="w-5 h-5" />}
                title="No expenses in this month"
                description="Expense charts appear once you log spending entries for this month."
              />
            ) : (
              <div className="space-y-4">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.topExpenses}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={3}
                      >
                        {metrics.topExpenses.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatNPR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {metrics.topExpenses.map((e, i) => (
                    <div key={e.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {e.name}
                      </span>
                      <span className="font-mono font-medium">{formatNPR(e.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="os-card p-5">
            <h2 className="text-sm font-semibold mb-1">Income Sources ({selectedMonth})</h2>
            <p className="text-xs text-slate-500 mb-4">Where your NPR inflows come from</p>
            {metrics.incomeSources.length === 0 ? (
              <EmptyState
                compact
                icon={<TrendingUp className="w-5 h-5" />}
                title="No income logged in this month"
                description="Log allowance, freelance, scholarship, or project income to see your breakdown."
              />
            ) : (
              <div className="space-y-3">
                {metrics.incomeSources.map((src, i) => {
                  const pct = Math.round((src.value / Math.max(1, metrics.monthIncome)) * 100);
                  return (
                    <div key={src.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{src.name}</span>
                        <span className="font-mono">
                          {formatNPR(src.value)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900/[0.07] dark:bg-white/[0.09] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW TRANSACTION MODAL */}
      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Record Financial Transaction"
        subtitle="All balances and reports recalculate immediately in NPR"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-1.5 bg-white/55 dark:bg-white/[0.07] border border-white/75 dark:border-white/[0.12] backdrop-blur-xl p-1 rounded-full shadow-xs">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTxType(t);
                  setTxCategory(
                    t === 'income'
                      ? INCOME_CATEGORIES[0]
                      : t === 'transfer'
                      ? 'Transfer'
                      : EXPENSE_CATEGORIES[0]
                  );
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  txType === t
                    ? 'bg-white dark:bg-[#1A1F2E] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount (NPR)</label>
              <input
                type="number"
                required
                min={1}
                step="any"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="e.g. 500"
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>

          {txType !== 'transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="os-input"
                >
                  {(txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                <select
                  value={txPayment}
                  onChange={(e) => setTxPayment(e.target.value as PaymentMethod)}
                  className="os-input"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {accounts.length > 0 && (
            <div className={`grid ${txType === 'transfer' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {txType === 'transfer' ? 'From Account' : 'Account'}
                </label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  className="os-input"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatNPR(accountBalances.get(a.id) ?? a.initialBalance)})
                    </option>
                  ))}
                </select>
              </div>
              {txType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">To Account</label>
                  <select
                    value={txToAccountId}
                    onChange={(e) => setTxToAccountId(e.target.value)}
                    className="os-input"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <input
              required
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              placeholder="e.g. College canteen lunch, Ncell pack, Freelance script"
              className="os-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {txType === 'income' ? 'Source (optional)' : 'Recipient / Merchant (optional)'}
            </label>
            <input
              value={txCounterparty}
              onChange={(e) => setTxCounterparty(e.target.value)}
              placeholder="e.g. Bhat-Bhateni, GCT Bookstore, Client"
              className="os-input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTxModalOpen(false)}
              className="os-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* ADD ACCOUNT MODAL */}
      <Modal open={accModalOpen} onClose={() => setAccModalOpen(false)} title="Add Financial Account">
        <form onSubmit={handleSaveAccount} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
            <input
              required
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="e.g. eSewa Wallet, Nabil Bank, Cash"
              className="os-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Account Type</label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as AccountType)}
                className="os-input"
              >
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
                <option value="imepay">IME Pay</option>
                <option value="bank">Bank Account</option>
                <option value="cash">Cash</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Opening Balance (NPR)
              </label>
              <input
                type="number"
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input
              value={accNotes}
              onChange={(e) => setAccNotes(e.target.value)}
              placeholder="Optional account notes..."
              className="os-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAccModalOpen(false)} className="os-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* SET BUDGET MODAL */}
      <Modal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title={`Set Monthly Budget (${selectedMonth})`}
      >
        <form onSubmit={handleSaveBudget} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Expense Category</label>
            <select
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.target.value)}
              className="os-input"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Monthly Limit (NPR)
            </label>
            <input
              type="number"
              required
              min={1}
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              placeholder="e.g. 5000"
              className="os-input font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setBudgetModalOpen(false)} className="os-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Budget
            </button>
          </div>
        </form>
      </Modal>

      {/* SAVINGS GOAL MODAL */}
      <Modal open={savingsModalOpen} onClose={() => setSavingsModalOpen(false)} title="Create Savings Goal">
        <form onSubmit={handleSaveSavingsGoal} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Goal Title</label>
            <input
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. CompTIA Security+ Voucher Fund"
              className="os-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target (NPR)</label>
              <input
                type="number"
                required
                min={1}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="os-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Saved So Far (NPR)</label>
              <input
                type="number"
                min={0}
                value={goalCurrent}
                onChange={(e) => setGoalCurrent(e.target.value)}
                className="os-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Target Date (optional)</label>
            <input
              type="date"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
              className="os-input font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSavingsModalOpen(false)} className="os-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Create Goal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
