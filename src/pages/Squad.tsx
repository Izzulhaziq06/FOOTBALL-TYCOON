import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { ALL_POSITIONS, POSITION_CODES } from '../engine/ratings';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Position } from '../types';
import { GamePageHeader, OvrBadge } from '../components/shared/GamePrimitives';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotTags, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney } from '../utils/format';

type SortKey = 'overall' | 'potential' | 'age' | 'value' | 'wage' | 'fitness';

export const Squad: React.FC = () => {
  const { career, settings } = useCareerStore();
  const { openPlayerProfile } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [query, setQuery] = useState('');
  const [posFilter, setPosFilter] = useState<Position | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortKey>('overall');

  if (!career) return null;
  const userClub = career.clubs[career.userClubId];

  const allSquad = useMemo(
    () => userClub.squadIds.map((id) => career.players[id]).filter(Boolean),
    [userClub.squadIds, career.players]
  );

  const depthSummary = useMemo(() => {
    let gk = 0;
    let def = 0;
    let mid = 0;
    let fwd = 0;
    let ovrSum = 0;
    for (const p of allSquad) {
      ovrSum += p.overallRating;
      if (p.primaryPosition === 'Goalkeeper') gk += 1;
      else if (p.primaryPosition === 'Centre Back' || p.primaryPosition === 'Full Back') def += 1;
      else if (p.primaryPosition === 'Striker' || p.primaryPosition === 'Winger') fwd += 1;
      else mid += 1;
    }
    return {
      gk,
      def,
      mid,
      fwd,
      avgOvr: Math.round(ovrSum / Math.max(1, allSquad.length)),
    };
  }, [allSquad]);

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSquad
      .filter((p) => {
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
  }, [allSquad, query, posFilter, sortBy]);

  const starterSet = useMemo(
    () => new Set(career.tactics.slots.map((s) => s.playerId).filter(Boolean) as string[]),
    [career.tactics.slots]
  );

  return (
    <div className="space-y-5">
      <GamePageHeader
        eyebrow={`${userClub.name} · First-Team Roster`}
        title="Squad Management"
        accentColor={userClub.crest.primaryColor}
        subtitle={`${userClub.squadIds.length} First-Team Players · Select any footballer to open full dossier & playstyle slots`}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
            <span className="ft-panel-inset px-2.5 py-1.5 rounded text-emerald-300">
              AVG {depthSummary.avgOvr} OVR
            </span>
            <span className="ft-panel-inset px-2.5 py-1.5 rounded text-slate-300">
              GK {depthSummary.gk} · DEF {depthSummary.def} · MID {depthSummary.mid} · FWD {depthSummary.fwd}
            </span>
          </div>
        }
      />

      {/* Tactical Filter Console */}
      <div className="ft-panel rounded-lg p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or nationality..."
            className="w-full rounded border border-slate-700/80 bg-[#070B14] pl-9 pr-3 py-2 text-sm text-[#F4F5F0] placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none min-h-[42px]"
          />
        </div>

        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as Position | 'All')}
          aria-label="Filter by position"
          className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none min-h-[42px]"
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
          className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none min-h-[42px]"
        >
          <option value="overall">Sort: Overall Rating</option>
          <option value="potential">Sort: Potential</option>
          <option value="age">Sort: Age (Youngest)</option>
          <option value="value">Sort: Market Value</option>
          <option value="wage">Sort: Weekly Wage</option>
          <option value="fitness">Sort: Fitness</option>
        </select>
      </div>

      {/* Dedicated Mobile Player Card Deck (< md) */}
      {!isDesktop && (
        <div className="space-y-2.5">
        {players.map((p) => {
          const isStarter = starterSet.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openPlayerProfile(p.id, 'squad')}
              className="ft-panel w-full rounded-lg p-3.5 text-left flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <PlayerAvatar
                  playerId={p.id}
                  fullName={p.fullName}
                  primaryColor={userClub.crest.primaryColor}
                  size={44}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-xs shrink-0">
                      {POSITION_CODES[p.primaryPosition]}
                    </span>
                    <span className="font-semibold text-sm text-[#F4F5F0] truncate">
                      {p.fullName}
                    </span>
                    <SuperstarStar isSuperstar={p.isSuperstar} />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                    {p.age}y · {p.fitness}% Fit · {formatMoney(p.marketValue, settings.currency)}
                    {isStarter ? ' · XI' : ''}
                    {!p.isHistoricalRecord ? (p.isCustomAcademyPlayer ? ' · Acad' : ' · Depth') : ''}
                  </div>
                  <SkillSlotTags player={p} compact />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <OvrBadge rating={p.overallRating} size="sm" />
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </div>
            </button>
          );
        })}
        </div>
      )}

      {/* Desktop Broadcast Roster Table (md+) */}
      {isDesktop && (
        <div className="ft-panel rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-[#080D18] text-[11px] font-mono uppercase tracking-wider text-slate-400">
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
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-3 min-w-[210px]">
                        <PlayerAvatar
                          playerId={p.id}
                          fullName={p.fullName}
                          primaryColor={userClub.crest.primaryColor}
                          size={38}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="font-semibold text-[#F4F5F0] flex items-center gap-1.5 truncate">
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
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs font-bold text-slate-200 bg-[#080D18] border border-slate-700/80 px-2 py-0.5 rounded-xs">
                        {POSITION_CODES[p.primaryPosition]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">{p.age}</td>
                    <td className="py-2.5 px-3 text-right">
                      <OvrBadge rating={p.overallRating} size="sm" />
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
      )}
    </div>
  );
};
