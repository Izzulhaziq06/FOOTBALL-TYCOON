import React, { useState } from 'react';
import { ArrowLeft, BadgeDollarSign, FileSignature, Star } from 'lucide-react';
import { POSITION_CODES } from '../engine/ratings';
import {
  checkSuperstarUnlockEligibility,
  POSITION_SKILL_RECOMMENDATIONS,
  SKILL_MAP,
  SkillId,
} from '../engine/skills';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotCard, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney, formatMoneyExact } from '../utils/format';

export const PlayerProfile: React.FC = () => {
  const {
    career,
    settings,
    sellPlayer,
    renewContract,
    customizePlayerSkills,
    unlockSuperstar,
  } = useCareerStore();
  const { selectedPlayerId, previousScreen, navigate, pushToast } = useUiStore();

  const [sellConfirmOpen, setSellConfirmOpen] = useState(false);
  const [renewWage, setRenewWage] = useState<number | null>(null);
  const [renewYears, setRenewYears] = useState(3);

  if (!career || !selectedPlayerId) return null;
  const player = career.players[selectedPlayerId];
  if (!player) {
    return (
      <div className="rounded-lg border border-slate-800 bg-[#121824] p-6">
        <p className="text-sm text-slate-300">Player record not found.</p>
        <button
          type="button"
          onClick={() => navigate('squad')}
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Back to Squad
        </button>
      </div>
    );
  }

  const club = career.clubs[player.clubId];
  const isUserPlayer = player.clubId === career.userClubId;
  const proposedWage = renewWage ?? Math.round((player.weeklyWage * 1.1) / 500) * 500;

  const techList = [
    ['Passing', player.technicalAttributes.passing],
    ['Shooting', player.technicalAttributes.shooting],
    ['Finishing', player.technicalAttributes.finishing],
    ['Dribbling', player.technicalAttributes.dribbling],
    ['Crossing', player.technicalAttributes.crossing],
    ['Tackling', player.technicalAttributes.tackling],
    ['Ball Control', player.technicalAttributes.ballControl],
    ['Heading', player.technicalAttributes.heading],
    ...(player.primaryPosition === 'Goalkeeper'
      ? [['Goalkeeping', player.technicalAttributes.goalkeeping ?? 75]]
      : []),
  ] as Array<[string, number]>;

  const physList = [
    ['Pace', player.physicalAttributes.pace],
    ['Acceleration', player.physicalAttributes.acceleration],
    ['Stamina', player.physicalAttributes.stamina],
    ['Strength', player.physicalAttributes.strength],
    ['Agility', player.physicalAttributes.agility],
    ['Jumping', player.physicalAttributes.jumping],
  ] as Array<[string, number]>;

  const mentList = [
    ['Vision', player.mentalAttributes.vision],
    ['Positioning', player.mentalAttributes.positioning],
    ['Decisions', player.mentalAttributes.decisions],
    ['Composure', player.mentalAttributes.composure],
    ['Leadership', player.mentalAttributes.leadership],
    ['Work Rate', player.mentalAttributes.workRate],
  ] as Array<[string, number]>;

  const handleSell = async () => {
    const res = await sellPlayer(player.id);
    setSellConfirmOpen(false);
    if (res.ok) {
      pushToast(
        'success',
        `Sold ${player.fullName} for ${formatMoney(res.fee ?? 0, settings.currency)}.`
      );
      navigate('squad');
    } else {
      pushToast('error', res.error ?? 'Could not complete sale.');
    }
  };

  const handleRenew = async () => {
    const res = await renewContract(player.id, proposedWage, renewYears);
    if (res.ok) {
      pushToast('success', `Contract renewed for ${player.fullName}.`);
    } else {
      pushToast('error', res.error ?? 'Contract renewal failed.');
    }
  };

  const userClub = career.clubs[career.userClubId];
  const superstarCheck = checkSuperstarUnlockEligibility(player, userClub);
  const recommendedPairs = POSITION_SKILL_RECOMMENDATIONS[player.primaryPosition] ?? [];

  const handleSkillChange = async (slot: 1 | 2, nextSkill: SkillId | null) => {
    const latestPlayer = useCareerStore.getState().career?.players[player.id] ?? player;
    const next1 = slot === 1 ? nextSkill : latestPlayer.skill1;
    const next2 = slot === 2 ? nextSkill : latestPlayer.skill2;
    const res = await customizePlayerSkills(player.id, next1, next2);
    if (res.ok) {
      pushToast('success', `Updated Skill ${slot} for ${player.fullName}.`);
    } else {
      pushToast('error', res.error ?? 'Could not update skill slot.');
    }
  };

  const handleApplyRecommendedPair = async (pair: [SkillId, SkillId]) => {
    const res = await customizePlayerSkills(player.id, pair[0], pair[1]);
    if (res.ok) {
      pushToast(
        'success',
        `Applied ${SKILL_MAP[pair[0]].name} + ${SKILL_MAP[pair[1]].name} to ${player.fullName}.`
      );
    } else {
      pushToast('error', res.error ?? 'Could not apply recommended pair.');
    }
  };

  const handleUnlockSuperstar = async () => {
    const res = await unlockSuperstar(player.id);
    if (res.ok) {
      pushToast('success', `${player.fullName} unlocked Superstar status!`);
    } else {
      pushToast('error', res.error ?? 'Superstar elevation requirements not met.');
    }
  };

  const renderBar = (label: string, value: number) => {
    const barColor =
      value >= 82 ? 'bg-emerald-500' : value >= 70 ? 'bg-sky-500' : 'bg-slate-500';
    return (
      <div key={label} className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-300">{label}</span>
          <span className="font-mono font-semibold text-white tabular-nums">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(previousScreen === 'player_profile' ? 'squad' : previousScreen)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back</span>
      </button>

      {/* Player Header */}
      <section className="rounded-lg border border-slate-800 bg-[#121824] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <PlayerAvatar
            playerId={player.id}
            fullName={player.fullName}
            primaryColor={club?.crest.primaryColor}
            size={76}
          />
          <div className="space-y-1">
            <div className="text-xs text-slate-400">
              {club?.name} · {player.nationality} · Born {player.dateOfBirth}
            </div>
            <h1 className="font-display text-4xl font-bold text-white leading-none flex items-center gap-2.5 flex-wrap">
              <span>{player.fullName}</span>
              <SuperstarStar isSuperstar={player.isSuperstar} size="lg" />
            </h1>
            <div className="text-xs text-slate-300 pt-1">
              {player.primaryPosition} ({POSITION_CODES[player.primaryPosition]})
              {player.secondaryPositions.length > 0
                ? ` · Secondary: ${player.secondaryPositions.join(', ')}`
                : ''}
              {' · '}Foot: {player.preferredFoot}
            </div>
            <div className="text-[11px] text-slate-400">
              {player.isHistoricalRecord
                ? 'Verified historical club-season player record · Gameplay-estimated ratings'
                : player.isCustomAcademyPlayer
                  ? 'Youth Academy custom graduate · Gameplay-estimated ratings'
                  : 'Generated club squad depth player · Gameplay-estimated ratings'}
              {player.isSuperstar && player.superstarUnlockedReason
                ? ` · ${player.superstarUnlockedReason}`
                : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-xs text-slate-400">Overall</div>
            <div className="font-display text-4xl font-bold text-emerald-400 tabular-nums">
              {player.overallRating}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Potential</div>
            <div className="font-display text-4xl font-bold text-white tabular-nums">
              {player.potential}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Age</div>
            <div className="font-display text-4xl font-bold text-slate-200 tabular-nums">
              {player.age}
            </div>
          </div>
        </div>
      </section>

      {/* Attributes Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
          <h2 className="font-display text-xl font-bold text-white">Technical</h2>
          <div className="space-y-2.5">{techList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
          <h2 className="font-display text-xl font-bold text-white">Physical</h2>
          <div className="space-y-2.5">{physList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
          <h2 className="font-display text-xl font-bold text-white">Mental</h2>
          <div className="space-y-2.5">{mentList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
      </section>

      {/* Playstyle Skills (2 Slots: Blue + Purple) & Superstar Progression */}
      <section className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Playstyle Skills &amp; Superstar Tier
            </h2>
            <p className="text-xs text-slate-400">
              Two specialized tactical playstyles affect match simulation without altering base OVR.
            </p>
          </div>
          {isUserPlayer && recommendedPairs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400">Recommended for {POSITION_CODES[player.primaryPosition]}:</span>
              {recommendedPairs.map((pair, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyRecommendedPair(pair)}
                  className="rounded border border-slate-700 bg-[#0B0F17] hover:border-emerald-500 px-2.5 py-1 text-[11px] font-medium text-slate-200"
                >
                  {SKILL_MAP[pair[0]].name} + {SKILL_MAP[pair[1]].name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkillSlotCard
            slotLabel="Skill 1 (Blue)"
            tone="blue"
            value={player.skill1}
            blockedValue={player.skill2}
            editable={isUserPlayer}
            selectAriaLabel="Select Skill 1 (Blue)"
            onChange={(next) => handleSkillChange(1, next)}
          />

          <SkillSlotCard
            slotLabel="Skill 2 (Purple)"
            tone="purple"
            value={player.skill2}
            blockedValue={player.skill1}
            editable={isUserPlayer}
            selectAriaLabel="Select Skill 2 (Purple)"
            onChange={(next) => handleSkillChange(2, next)}
          />

          <div
            className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${
              player.isSuperstar
                ? 'border-amber-500/50 bg-amber-950/20'
                : 'border-slate-800 bg-[#0B0F17]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Star
                  className={`h-4 w-4 ${
                    player.isSuperstar ? 'fill-amber-400 text-amber-300' : 'text-slate-500'
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Superstar Status
                </span>
              </div>
              <div className="text-base font-semibold text-white">
                {player.isSuperstar ? 'Active Superstar' : 'Standard Squad Tier'}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {player.isSuperstar
                  ? player.superstarUnlockedReason ??
                    'Provides balanced late-game composure and clutch consistency.'
                  : superstarCheck.reason}
              </p>
            </div>

            {isUserPlayer && !player.isSuperstar && (
              <button
                type="button"
                disabled={!superstarCheck.eligible}
                onClick={handleUnlockSuperstar}
                className="rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 px-3.5 py-2 text-xs font-semibold text-white"
              >
                {superstarCheck.eligible
                  ? `Unlock Superstar (${formatMoney(superstarCheck.developmentCost, settings.currency)})`
                  : 'Requirements Not Met'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Performance, Contract, and Development */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">Season & Career Statistics</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-sm tabular-nums">
            <div className="rounded border border-slate-800 bg-[#0B0F17] p-3">
              <div className="text-xs text-slate-400">Appearances</div>
              <div className="font-mono text-lg font-semibold text-white">
                {player.seasonStats.appearances}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0B0F17] p-3">
              <div className="text-xs text-slate-400">Goals</div>
              <div className="font-mono text-lg font-semibold text-emerald-400">
                {player.seasonStats.goals}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0B0F17] p-3">
              <div className="text-xs text-slate-400">Assists</div>
              <div className="font-mono text-lg font-semibold text-white">
                {player.seasonStats.assists}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0B0F17] p-3">
              <div className="text-xs text-slate-400">Avg Rating</div>
              <div className="font-mono text-lg font-semibold text-white">
                {player.seasonStats.averageRating > 0
                  ? player.seasonStats.averageRating.toFixed(1)
                  : '—'}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Recent Form (last 5 ratings):{' '}
            <span className="font-mono text-slate-200">
              {player.recentForm.length > 0 ? player.recentForm.join(' · ') : 'No matches yet'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-300">Development Trajectory</h3>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/60 text-xs">
              {player.developmentHistory.map((d, i) => (
                <div key={i} className="py-1.5 flex justify-between gap-2">
                  <span className="text-slate-300">
                    {d.seasonId} MD {d.matchday} · {d.note}
                  </span>
                  <span className="font-mono text-emerald-400 tabular-nums">{d.overall} OVR</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">Contract & Valuation</h2>
          <div className="grid grid-cols-2 gap-4 text-sm tabular-nums">
            <div>
              <div className="text-xs text-slate-400">Market Value</div>
              <div className="font-mono text-lg font-semibold text-white">
                {formatMoney(player.marketValue, settings.currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Weekly Wage</div>
              <div className="font-mono text-lg font-semibold text-white">
                {formatMoneyExact(player.weeklyWage, settings.currency)}/wk
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Contract Expiry</div>
              <div className="font-mono text-base font-semibold text-white">
                June {player.contractExpiry}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Fitness / Morale</div>
              <div className="font-mono text-base font-semibold text-emerald-400">
                {player.fitness}% / {player.morale}%
              </div>
            </div>
          </div>

          {isUserPlayer && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Contract Management</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    New Weekly Wage (EUR)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    min={2000}
                    value={proposedWage}
                    onChange={(e) => setRenewWage(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Extension Years</label>
                  <select
                    value={renewYears}
                    onChange={(e) => setRenewYears(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-sm text-white"
                  >
                    <option value={2}>2 Years</option>
                    <option value={3}>3 Years</option>
                    <option value={4}>4 Years</option>
                    <option value={5}>5 Years</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRenew}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  <span>Renew Contract</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSellConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/30 hover:bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-200"
                >
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  <span>Sell Player ({formatMoney(player.marketValue * 0.95, settings.currency)})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={sellConfirmOpen}
        title="Confirm Player Sale"
        description={`Sell ${player.fullName} to an interested club for approximately ${formatMoney(player.marketValue * 0.95, settings.currency)}?`}
        confirmLabel="Complete Sale"
        destructive
        onConfirm={handleSell}
        onCancel={() => setSellConfirmOpen(false)}
      />
    </div>
  );
};
