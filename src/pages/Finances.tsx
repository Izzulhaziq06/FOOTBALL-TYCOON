import React from 'react';
import { calculateClubWeeklyWageBill } from '../engine/financeEngine';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCareerStore } from '../store/careerStore';
import { GamePageHeader } from '../components/shared/GamePrimitives';
import { formatMoney, formatMoneyExact } from '../utils/format';

export const Finances: React.FC = () => {
  const { career, settings } = useCareerStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  if (!career) return null;

  const club = career.clubs[career.userClubId];
  const weeklyWages = calculateClubWeeklyWageBill(club, career.players);
  const wageUtilization = Math.min(
    100,
    Math.round((weeklyWages / Math.max(1, club.wageBudget)) * 100)
  );

  const incomeTotal = career.transactions
    .filter((t) => t.amount > 0 && t.matchday > 0)
    .reduce((s, t) => s + t.amount, 0);

  const expenseTotal = career.transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <GamePageHeader
        eyebrow={`${club.name} · Executive Boardroom`}
        title="Financial Overview"
        accentColor={club.crest.primaryColor}
        subtitle={`${career.currentSeason} Ledger, Wage Governance & Transfer Budgets`}
      />

      {/* Executive Budget Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-slate-500/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Club Balance
          </div>
          <div className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-[#F4F5F0] tabular-nums">
            {formatMoney(club.balance, settings.currency)}
          </div>
        </div>
        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-emerald-500/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Transfer Budget
          </div>
          <div className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
            {formatMoney(club.transferBudget, settings.currency)}
          </div>
        </div>
        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-amber-500/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Weekly Wage Bill
          </div>
          <div className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-[#F4F5F0] tabular-nums">
            {formatMoney(weeklyWages, settings.currency)}/wk
          </div>
          <div className="mt-2 h-1.5 w-full rounded-xs bg-[#070B14] overflow-hidden">
            <div
              className={`h-full ${wageUtilization > 90 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${wageUtilization}%` }}
            />
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            Cap: {formatMoney(club.wageBudget, settings.currency)}/wk ({wageUtilization}%)
          </div>
        </div>
        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-sky-500/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Season Cashflow
          </div>
          <div className="mt-1.5 font-mono text-sm font-bold text-emerald-400 tabular-nums">
            In: +{formatMoney(incomeTotal, settings.currency)}
          </div>
          <div className="font-mono text-sm font-bold text-red-400 tabular-nums mt-0.5">
            Out: -{formatMoney(expenseTotal, settings.currency)}
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="ft-panel rounded-lg overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-800 bg-[#090E1A]">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Transaction Ledger</h2>
        </div>

        {/* Mobile Ledger Cards (< md) */}
        {!isDesktop && (
          <div className="divide-y divide-slate-800/70">
          {career.transactions.map((tx) => (
            <div key={tx.id} className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-slate-400">
                  {tx.date} · MD {tx.matchday} · {tx.category}
                </span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {formatMoneyExact(tx.amount, settings.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[#F4F5F0] font-medium truncate">{tx.description}</span>
                <span className="font-mono text-xs text-slate-400 shrink-0 tabular-nums">
                  Bal {formatMoney(tx.balanceAfter, settings.currency)}
                </span>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Desktop Ledger Table (md+) */}
        {isDesktop && (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-[#080D18] text-[11px] font-mono uppercase tracking-wider text-slate-400">
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
                <tr key={tx.id} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-slate-400">{tx.date}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{tx.matchday}</td>
                  <td className="py-2.5 px-3 text-xs font-mono text-slate-300">{tx.category}</td>
                  <td className="py-2.5 px-3 text-[#F4F5F0]">{tx.description}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
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
        )}
      </div>
    </div>
  );
};
