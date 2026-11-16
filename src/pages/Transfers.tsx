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
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Player, Position } from '../types';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotTags, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney, formatMoneyExact } from '../utils/format';

type TransferTab = 'market' | 'history';

export const Transfers: React.FC = () => {
  const { career, settings, completeTransfer } = useCareerStore();
  const { openPlayerProfile, pushToast } = useUiStore();

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Transfer Market</h1>
          <p className="text-xs text-slate-400 tabular-nums">
            Window: <span className={career.transferWindowOpen ? 'text-emerald-400' : 'text-amber-400'}>
              {career.transferWindowOpen ? `Open (${career.transferWindowLabel})` : 'Closed'}
            </span>{' '}
            · Transfer Budget: <span className="font-mono text-white">{formatMoney(userClub.transferBudget, settings.currency)}</span>{' '}
            · Wage Cap Headroom: <span className="font-mono text-white">{formatMoney(Math.max(0, userClub.wageBudget - weeklyWages), settings.currency)}/wk</span>
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-md border border-slate-800 bg-[#121824]">
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
      </div>

      {tab === 'market' && (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search player name or country..."
                className="w-full rounded-md border border-slate-700 bg-[#0B0F17] pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position | 'All')}
              aria-label="Filter position"
              className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
              className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
              className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
              className="rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
            >
              <option value={38}>Max Age: Any</option>
              <option value={23}>U23 Prospects</option>
              <option value={27}>Max Age 27</option>
              <option value={30}>Max Age 30</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 px-1">
            <label className="flex items-center gap-2">
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
            <label className="flex items-center gap-2">
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

          {/* Results Table */}
          <div className="rounded-lg border border-slate-800 bg-[#121824] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-[#0E1420] text-xs text-slate-400">
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
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 pl-4 pr-3">
                          <button
                            type="button"
                            onClick={() => openPlayerProfile(p.id, 'transfers')}
                            className="flex items-center gap-3 text-left hover:text-emerald-300 min-w-[180px]"
                          >
                            <PlayerAvatar
                              playerId={p.id}
                              fullName={p.fullName}
                              primaryColor={club?.crest.primaryColor}
                              size={32}
                            />
                            <div className="space-y-1">
                              <div className="font-medium text-white flex items-center gap-1.5">
                                <span>{p.fullName}</span>
                                <SuperstarStar isSuperstar={p.isSuperstar} />
                              </div>
                              <div className="text-[11px] text-slate-400">{p.nationality}</div>
                              <SkillSlotTags player={p} compact />
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-300">{club?.name}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-300">
                          {POSITION_CODES[p.primaryPosition]}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">{p.age}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {p.overallRating}
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
                              className="rounded bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Bid
                            </button>
                            <button
                              type="button"
                              onClick={() => beginNegotiation(p, 'loan')}
                              className="rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200"
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
        </>
      )}

      {tab === 'history' && (
        <div className="rounded-lg border border-slate-800 bg-[#121824] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-[#0E1420] text-xs text-slate-400">
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
                    <td className="py-2.5 pl-4 pr-3 font-medium text-white">
                      {tr.playerName}
                      {tr.isHistoricalSeed && (
                        <span className="ml-2 text-[11px] text-slate-400">(Historical)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{tr.fromClubName}</td>
                    <td className="py-2.5 px-3 text-slate-300">{tr.toClubName}</td>
                    <td className="py-2.5 px-3 text-xs capitalize text-slate-300">{tr.type}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-400">
                      {tr.seasonId} · {tr.transferWindow}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono text-emerald-400">
                      {formatMoney(tr.fee, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Negotiation Modal */}
      {negotiation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-[#121824] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-emerald-400 font-medium capitalize">
                  {negotiation.type} Transfer Negotiation
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
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
              <button
                type="button"
                onClick={() => setNegotiation(null)}
                aria-label="Close negotiation"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-md border border-slate-800 bg-[#0B0F17] p-4 space-y-1.5">
              <div className="text-xs font-semibold text-white">{negotiation.statusMessage}</div>
              <p className="text-xs text-slate-300">{negotiation.aiFeedback}</p>
            </div>

            {negotiation.stage === 'fee' && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Club Asking Price</span>
                  <span className="font-mono text-white font-semibold">
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptCounterFee}
                    className="rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
                  >
                    Accept Asking ({formatMoney(negotiation.askingFee, settings.currency)})
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitFee}
                    className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
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
                  <span className="font-mono text-white font-semibold">
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
                      className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 font-mono text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5">Contract Duration</label>
                    <select
                      value={contractYearsInput}
                      onChange={(e) => setContractYearsInput(Number(e.target.value))}
                      disabled={negotiation.type === 'loan'}
                      className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
                    className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Submit Personal Terms
                  </button>
                </div>
              </div>
            )}

            {negotiation.stage === 'completed' && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-300 font-mono">
                  Fee {formatMoney(negotiation.offeredFee, settings.currency)} · Wage{' '}
                  {formatMoneyExact(negotiation.offeredWage, settings.currency)}/wk
                </div>
                <button
                  type="button"
                  onClick={handleFinalize}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-white"
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
                  className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
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
