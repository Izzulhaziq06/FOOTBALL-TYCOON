import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Search, X } from 'lucide-react';
import { calculateClubWeeklyWageBill } from '../engine/financeEngine';
import { ALL_POSITIONS, POSITION_CODES } from '../engine/ratings';
import {
  searchTransferMarket,
  startTransferNegotiation,
  submitFeeOffer,
  submitWageOffer,
  TransferNegotiationSession,
} from '../engine/transferEngine';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Player, Position } from '../types';
import { ClubCrest } from '../components/shared/ClubCrest';
import { GamePageHeader, OvrBadge } from '../components/shared/GamePrimitives';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotTags, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney, formatMoneyExact } from '../utils/format';

type TransferTab = 'market' | 'history';

export const Transfers: React.FC = () => {
  const { career, settings, completeTransfer } = useCareerStore();
  const { openPlayerProfile, pushToast } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [tab, setTab] = useState<TransferTab>('market');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | 'All'>('All');
  const [maxAge, setMaxAge] = useState(35);
  const [minOverall, setMinOverall] = useState(65);
  const [minPotential, setMinPotential] = useState(65);
  const [maxValueMillions, setMaxValueMillions] = useState(250);
  const [clubFilter, setClubFilter] = useState('All');

  const [negotiation, setNegotiation] = useState<TransferNegotiationSession | null>(null);
  const [feeInput, setFeeInput] = useState<number>(0);
  const [wageInput, setWageInput] = useState<number>(0);
  const [contractYearsInput, setContractYearsInput] = useState<number>(4);

  if (!career) return null;
  const userClub = career.clubs[career.userClubId];
  const weeklyWages = calculateClubWeeklyWageBill(userClub, career.players);

  const results = useMemo(
    () =>
      searchTransferMarket(career.players, career.userClubId, {
        query,
        position,
        minAge: 16,
        maxAge,
        minOverall,
        maxOverall: 99,
        minPotential,
        maxValue: maxValueMillions * 1_000_000,
        clubId: clubFilter,
      }).slice(0, 80),
    [
      career.players,
      career.userClubId,
      query,
      position,
      maxAge,
      minOverall,
      minPotential,
      maxValueMillions,
      clubFilter,
    ]
  );

  const sortedClubs = useMemo(
    () =>
      Object.values(career.clubs)
        .filter((c) => c.id !== career.userClubId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [career.clubs, career.userClubId]
  );

  const beginNegotiation = (player: Player, type: 'permanent' | 'loan') => {
    if (!career.transferWindowOpen) {
      pushToast('warning', 'Transfer window is currently closed (opens MD 1-3 & MD 10-12).');
      return;
    }
    const session = startTransferNegotiation(career, player.id, type);
    setNegotiation(session);
    setFeeInput(session.offeredFee);
    setWageInput(session.askingWage);
    setContractYearsInput(session.contractYears);
  };

  const handleSubmitFee = () => {
    if (!negotiation) return;
    const next = submitFeeOffer(negotiation, feeInput, userClub);
    setNegotiation(next);
    if (next.stage === 'wage') {
      setWageInput(next.askingWage);
    }
  };

  const handleAcceptCounterFee = () => {
    if (!negotiation) return;
    const next = submitFeeOffer(negotiation, negotiation.askingFee, userClub);
    setNegotiation(next);
    if (next.stage === 'wage') {
      setWageInput(next.askingWage);
    }
  };

  const handleSubmitWage = () => {
    if (!negotiation) return;
    const next = submitWageOffer(
      negotiation,
      wageInput,
      contractYearsInput,
      userClub,
      weeklyWages
    );
    setNegotiation(next);
  };

  const handleFinalize = async () => {
    if (!negotiation) return;
    const res = await completeTransfer(negotiation);
    if (res.ok) {
      const pName = career.players[negotiation.playerId]?.fullName ?? 'Player';
      pushToast('success', `Transfer completed: ${pName} joined ${userClub.name}!`);
      setNegotiation(null);
    } else {
      pushToast('error', res.error ?? 'Failed to complete transfer.');
    }
  };

  return (
    <div className="space-y-5">
      <GamePageHeader
        eyebrow={`${userClub.name} · Recruitment & Scouting Desk`}
        title="Transfer Market"
        accentColor={userClub.crest.primaryColor}
        subtitle={
          <span className="tabular-nums">
            Window:{' '}
            <span className={career.transferWindowOpen ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {career.transferWindowOpen ? `Open (${career.transferWindowLabel})` : 'Closed'}
            </span>{' '}
            · Transfer Budget:{' '}
            <span className="font-mono text-[#F4F5F0] font-semibold">
              {formatMoney(userClub.transferBudget, settings.currency)}
            </span>{' '}
            · Wage Headroom:{' '}
            <span className="font-mono text-[#F4F5F0] font-semibold">
              {formatMoney(Math.max(0, userClub.wageBudget - weeklyWages), settings.currency)}/wk
            </span>
          </span>
        }
        actions={
          <div className="flex gap-1 p-1 rounded border border-slate-800 bg-[#080D18]">
            <button
              type="button"
              onClick={() => setTab('market')}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold ${
                tab === 'market' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Scout Players
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold ${
                tab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Transfer History ({career.transfers.length})
            </button>
          </div>
        }
      />

      {tab === 'market' && (
        <>
          {/* Filters */}
          <div className="ft-panel rounded-lg p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player name or country..."
                className="w-full rounded border border-slate-700/80 bg-[#070B14] pl-9 pr-3 py-2 text-sm text-[#F4F5F0] placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none min-h-[42px]"
              />
            </div>

            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position | 'All')}
              aria-label="Filter position"
              className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] min-h-[42px]"
            >
              <option value="All">All Positions</option>
              {ALL_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              aria-label="Filter club"
              className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] min-h-[42px]"
            >
              <option value="All">All Clubs</option>
              {sortedClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={minOverall}
              onChange={(e) => setMinOverall(Number(e.target.value))}
              aria-label="Minimum overall"
              className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] min-h-[42px]"
            >
              <option value={60}>Min OVR 60+</option>
              <option value={75}>Min OVR 75+</option>
              <option value={80}>Min OVR 80+</option>
              <option value={85}>Min OVR 85+</option>
            </select>

            <select
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              aria-label="Maximum age"
              className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] min-h-[42px]"
            >
              <option value={38}>Max Age: Any</option>
              <option value={23}>U23 Prospects</option>
              <option value={27}>Max Age 27</option>
              <option value={30}>Max Age 30</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300 px-1 font-mono">
            <label className="flex items-center gap-2.5">
              <span>Min Potential: {minPotential}</span>
              <input
                type="range"
                min={60}
                max={92}
                value={minPotential}
                onChange={(e) => setMinPotential(Number(e.target.value))}
                className="accent-emerald-500"
              />
            </label>
            <label className="flex items-center gap-2.5">
              <span>Max Value: €{maxValueMillions}M</span>
              <input
                type="range"
                min={5}
                max={250}
                step={5}
                value={maxValueMillions}
                onChange={(e) => setMaxValueMillions(Number(e.target.value))}
                className="accent-emerald-500"
              />
            </label>
          </div>

          {/* Mobile Scouting Cards (< md) */}
          {!isDesktop && (
            <div className="space-y-2.5">
            {results.map((p) => {
              const club = career.clubs[p.clubId];
              return (
                <div key={p.id} className="ft-panel rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openPlayerProfile(p.id, 'transfers')}
                      className="flex items-center gap-3 text-left min-w-0 flex-1"
                    >
                      <PlayerAvatar
                        playerId={p.id}
                        fullName={p.fullName}
                        primaryColor={club?.crest.primaryColor}
                        size={42}
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-sm text-[#F4F5F0] flex items-center gap-1.5">
                          <span className="truncate">{p.fullName}</span>
                          <SuperstarStar isSuperstar={p.isSuperstar} />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {POSITION_CODES[p.primaryPosition]} · {club?.name} · Age {p.age}
                        </div>
                        <SkillSlotTags player={p} compact />
                      </div>
                    </button>
                    <OvrBadge rating={p.overallRating} size="sm" />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="font-mono text-xs text-slate-300 tabular-nums">
                      Value <span className="text-[#F4F5F0] font-bold">{formatMoney(p.marketValue, settings.currency)}</span> · POT {p.potential}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => beginNegotiation(p, 'permanent')}
                        className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white min-h-[36px]"
                      >
                        Bid
                      </button>
                      <button
                        type="button"
                        onClick={() => beginNegotiation(p, 'loan')}
                        className="rounded border border-slate-700 bg-[#080D18] hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 min-h-[36px]"
                      >
                        Loan
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {results.length === 0 && (
              <div className="ft-panel rounded-lg p-8 text-center text-sm text-slate-400">
                No players match your scouting filters.
              </div>
            )}
            </div>
          )}

          {/* Desktop Results Table (md+) */}
          {isDesktop && (
            <div className="ft-panel rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-[#080D18] text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 pl-4 pr-3">Player</th>
                    <th className="py-3 px-3">Club</th>
                    <th className="py-3 px-3">Pos</th>
                    <th className="py-3 px-3 text-right">Age</th>
                    <th className="py-3 px-3 text-right">OVR</th>
                    <th className="py-3 px-3 text-right">POT</th>
                    <th className="py-3 px-3 text-right">Value</th>
                    <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 tabular-nums">
                  {results.map((p) => {
                    const club = career.clubs[p.clubId];
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.04]">
                        <td className="py-2.5 pl-4 pr-3">
                          <button
                            type="button"
                            onClick={() => openPlayerProfile(p.id, 'transfers')}
                            className="flex items-center gap-3 text-left hover:text-emerald-300 min-w-[190px]"
                          >
                            <PlayerAvatar
                              playerId={p.id}
                              fullName={p.fullName}
                              primaryColor={club?.crest.primaryColor}
                              size={36}
                            />
                            <div className="space-y-1">
                              <div className="font-semibold text-[#F4F5F0] flex items-center gap-1.5">
                                <span>{p.fullName}</span>
                                <SuperstarStar isSuperstar={p.isSuperstar} />
                              </div>
                              <div className="text-[11px] text-slate-400">{p.nationality}</div>
                              <SkillSlotTags player={p} compact />
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            {club && <ClubCrest crest={club.crest} size={20} />}
                            <span>{club?.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs font-bold text-slate-200">
                          {POSITION_CODES[p.primaryPosition]}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">{p.age}</td>
                        <td className="py-2.5 px-3 text-right">
                          <OvrBadge rating={p.overallRating} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          {p.potential}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                          {formatMoney(p.marketValue, settings.currency)}
                        </td>
                        <td className="py-2.5 pl-3 pr-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => beginNegotiation(p, 'permanent')}
                              className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Bid
                            </button>
                            <button
                              type="button"
                              onClick={() => beginNegotiation(p, 'loan')}
                              className="rounded border border-slate-700 bg-[#080D18] hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
                            >
                              Loan
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {results.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                No players match your scouting filters.
              </div>
            )}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="ft-panel rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-[#080D18] text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 pl-4 pr-3">Player</th>
                  <th className="py-3 px-3">From</th>
                  <th className="py-3 px-3">To</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Window</th>
                  <th className="py-3 pl-3 pr-4 text-right">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 tabular-nums">
                {career.transfers.map((tr) => (
                  <tr key={tr.id}>
                    <td className="py-2.5 pl-4 pr-3 font-semibold text-[#F4F5F0]">
                      {tr.playerName}
                      {tr.isHistoricalSeed && (
                        <span className="ml-2 text-[11px] font-normal text-slate-400">(Historical)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{tr.fromClubName}</td>
                    <td className="py-2.5 px-3 text-slate-300">{tr.toClubName}</td>
                    <td className="py-2.5 px-3 text-xs capitalize text-slate-300">{tr.type}</td>
                    <td className="py-2.5 px-3 text-xs font-mono text-slate-400">
                      {tr.seasonId} · {tr.transferWindow}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono font-bold text-emerald-400">
                      {formatMoney(tr.fee, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Executive Transfer Room Modal */}
      {negotiation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04070D]/80 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="ft-panel w-full max-w-lg rounded-lg p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <PlayerAvatar
                  playerId={negotiation.playerId}
                  fullName={career.players[negotiation.playerId]?.fullName ?? 'Player'}
                  primaryColor={career.clubs[negotiation.sellingClubId]?.crest.primaryColor}
                  size={52}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                    {negotiation.type} Transfer Negotiation
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F5F0] truncate">
                    {career.players[negotiation.playerId]?.fullName}
                  </h2>
                  <div className="text-xs text-slate-400">
                    From {career.clubs[negotiation.sellingClubId]?.name} · Valuation{' '}
                    {formatMoney(
                      career.players[negotiation.playerId]?.marketValue ?? 0,
                      settings.currency
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNegotiation(null)}
                aria-label="Close negotiation"
                className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="ft-panel-inset rounded p-4 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {negotiation.statusMessage}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{negotiation.aiFeedback}</p>
            </div>

            {negotiation.stage === 'fee' && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Club Asking Price</span>
                  <span className="font-mono text-[#F4F5F0] font-bold">
                    {formatMoneyExact(negotiation.askingFee, settings.currency)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1.5">
                    Your Fee Offer (EUR) · Round {negotiation.round}/{negotiation.maxRounds}
                  </label>
                  <input
                    type="number"
                    step={250000}
                    min={100000}
                    value={feeInput}
                    onChange={(e) => setFeeInput(Number(e.target.value))}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-[#F4F5F0]"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptCounterFee}
                    className="rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
                  >
                    Accept Asking ({formatMoney(negotiation.askingFee, settings.currency)})
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitFee}
                    className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    Submit Fee Offer
                  </button>
                </div>
              </div>
            )}

            {negotiation.stage === 'wage' && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Player Asking Wage</span>
                  <span className="font-mono text-[#F4F5F0] font-bold">
                    {formatMoneyExact(negotiation.askingWage, settings.currency)}/wk
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5">
                      Weekly Wage Offer (EUR)
                    </label>
                    <input
                      type="number"
                      step={1000}
                      min={2000}
                      value={wageInput}
                      onChange={(e) => setWageInput(Number(e.target.value))}
                      className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-[#F4F5F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5">Contract Duration</label>
                    <select
                      value={contractYearsInput}
                      onChange={(e) => setContractYearsInput(Number(e.target.value))}
                      disabled={negotiation.type === 'loan'}
                      className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0]"
                    >
                      <option value={1}>1 Year</option>
                      <option value={2}>2 Years</option>
                      <option value={3}>3 Years</option>
                      <option value={4}>4 Years</option>
                      <option value={5}>5 Years</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitWage}
                    className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    Submit Personal Terms
                  </button>
                </div>
              </div>
            )}

            {negotiation.stage === 'completed' && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-300 font-mono">
                  Fee {formatMoney(negotiation.offeredFee, settings.currency)} · Wage{' '}
                  {formatMoneyExact(negotiation.offeredWage, settings.currency)}/wk
                </div>
                <button
                  type="button"
                  onClick={handleFinalize}
                  className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>Complete Transfer</span>
                </button>
              </div>
            )}

            {negotiation.stage === 'collapsed' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setNegotiation(null)}
                  className="rounded border border-slate-700 bg-[#0B1220] px-4 py-2 text-xs font-semibold text-white"
                >
                  Close Talks
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
