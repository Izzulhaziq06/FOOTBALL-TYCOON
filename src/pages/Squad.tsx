import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ALL_POSITIONS, POSITION_CODES } from '../engine/ratings';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Position } from '../types';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotTags, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney } from '../utils/format';

type SortKey = 'overall' | 'potential' | 'age' | 'value' | 'wage' | 'fitness';

export const Squad: React.FC = () => {
  const { career, settings } = useCareerStore();
  const { openPlayerProfile } = useUiStore();

  const [query, setQuery] = useState('');
  const [posFilter, setPosFilter] = useState<Position | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortKey>('overall');

  if (!career) return null;
  const userClub = career.clubs[career.userClubId];

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return userClub.squadIds
      .map((id) => career.players[id])
      .filter((p) => {
        if (!p) return false;
        if (posFilter !== 'All' && p.primaryPosition !== posFilter) return false;
        if (q && !p.fullName.toLowerCase().includes(q) && !p.nationality.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'potential':
            return b.potential - a.potential;
          case 'age':
            return a.age - b.age;
          case 'value':
            return b.marketValue - a.marketValue;
          case 'wage':
            return b.weeklyWage - a.weeklyWage;
          case 'fitness':
            return b.fitness - a.fitness;
          case 'overall':
          default:
            return b.overallRating - a.overallRating;
        }
      });
  }, [userClub.squadIds, career.players, query, posFilter, sortBy]);

  const starterSet = useMemo(
    () => new Set(career.tactics.slots.map((s) => s.playerId).filter(Boolean) as string[]),
    [career.tactics.slots]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Squad Management</h1>
          <p className="text-xs text-slate-400">
            {userClub.name} · {userClub.squadIds.length} First-Team Players · Click any player to open full profile
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-[#121824] p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or nationality..."
            className="w-full rounded-md border border-slate-700 bg-[#0B0F17] pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as Position | 'All')}
          aria-label="Filter by position"
          className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="All">All Positions</option>
          {ALL_POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort squad"
          className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="overall">Sort: Overall Rating</option>
          <option value="potential">Sort: Potential</option>
          <option value="age">Sort: Age (Youngest)</option>
          <option value="value">Sort: Market Value</option>
          <option value="wage">Sort: Weekly Wage</option>
          <option value="fitness">Sort: Fitness</option>
        </select>
      </div>

      {/* Squad Data Table */}
      <div className="rounded-lg border border-slate-800 bg-[#121824] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-[#0E1420] text-xs text-slate-400">
              <tr>
                <th className="py-3 pl-4 pr-3">Player</th>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3 text-right">Age</th>
                <th className="py-3 px-3 text-right">OVR</th>
                <th className="py-3 px-3 text-right">POT</th>
                <th className="py-3 px-3 text-right">Fit</th>
                <th className="py-3 px-3 text-right">Morale</th>
                <th className="py-3 px-3 text-right">Value</th>
                <th className="py-3 px-3 text-right">Wage</th>
                <th className="py-3 pl-3 pr-4 text-right">Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {players.map((p) => {
                const isStarter = starterSet.has(p.id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => openPlayerProfile(p.id, 'squad')}
                    className="hover:bg-slate-800/45 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <PlayerAvatar
                          playerId={p.id}
                          fullName={p.fullName}
                          primaryColor={userClub.crest.primaryColor}
                          size={34}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium text-white flex items-center gap-1.5 truncate">
                            <span className="truncate">{p.fullName}</span>
                            <SuperstarStar isSuperstar={p.isSuperstar} />
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.nationality}
                            {isStarter ? ' · Starting XI' : ''}
                            {p.injuryWeeks > 0 ? ` · Injured (${p.injuryWeeks}w)` : ''}
                            {!p.isHistoricalRecord ? (p.isCustomAcademyPlayer ? ' · Academy' : ' · Depth') : ''}
                          </div>
                          <SkillSlotTags player={p} compact />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-200">
                      {POSITION_CODES[p.primaryPosition]}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">{p.age}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {p.overallRating}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {p.potential}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={
                          p.fitness >= 85
                            ? 'text-emerald-400'
                            : p.fitness >= 70
                              ? 'text-amber-300'
                              : 'text-red-400'
                        }
                      >
                        {p.fitness}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {p.morale}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      {formatMoney(p.marketValue, settings.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {formatMoney(p.weeklyWage, settings.currency)}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono text-slate-400">
                      {p.contractExpiry}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
