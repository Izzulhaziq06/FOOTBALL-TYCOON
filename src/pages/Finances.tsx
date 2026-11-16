import React from 'react';
import { calculateClubWeeklyWageBill } from '../engine/financeEngine';
import { useCareerStore } from '../store/careerStore';
import { formatMoney, formatMoneyExact } from '../utils/format';

export const Finances: React.FC = () => {
  const { career, settings } = useCareerStore();
  if (!career) return null;

  const club = career.clubs[career.userClubId];
  const weeklyWages = calculateClubWeeklyWageBill(club, career.players);

  const incomeTotal = career.transactions
    .filter((t) => t.amount > 0 && t.matchday > 0)
    .reduce((s, t) => s + t.amount, 0);

  const expenseTotal = career.transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Financial Overview</h1>
        <p className="text-xs text-slate-400">
          {club.name} · {career.currentSeason} Ledger & Budgets
        </p>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Club Balance</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
            {formatMoney(club.balance, settings.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Transfer Budget</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
            {formatMoney(club.transferBudget, settings.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Weekly Wage Bill</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
            {formatMoney(weeklyWages, settings.currency)}/wk
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Cap: {formatMoney(club.wageBudget, settings.currency)}/wk
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Season Cashflow</div>
          <div className="mt-1 font-mono text-sm text-emerald-400 tabular-nums">
            In: +{formatMoney(incomeTotal, settings.currency)}
          </div>
          <div className="font-mono text-sm text-red-400 tabular-nums">
            Out: -{formatMoney(expenseTotal, settings.currency)}
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="rounded-lg border border-slate-800 bg-[#121824] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white">Transaction Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-[#0E1420] text-xs text-slate-400">
              <tr>
                <th className="py-3 pl-4 pr-3">Date</th>
                <th className="py-3 px-3">MD</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 pl-3 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {career.transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-slate-400">{tx.date}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{tx.matchday}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-300">{tx.category}</td>
                  <td className="py-2.5 px-3 text-slate-200">{tx.description}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-semibold ${
                      tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {formatMoneyExact(tx.amount, settings.currency)}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right font-mono text-slate-300">
                    {formatMoney(tx.balanceAfter, settings.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
