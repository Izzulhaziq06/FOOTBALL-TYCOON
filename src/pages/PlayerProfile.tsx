import React, { useState } from 'react';
import { ArrowLeft, BadgeDollarSign, Coins, FileSignature, Star } from 'lucide-react';
import { POSITION_CODES } from '../engine/ratings';
import {
  checkSuperstarUnlockEligibility,
  getEligibleDevelopedSkills,
  SKILL_MAP,
} from '../engine/skills';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { ClubCrest } from '../components/shared/ClubCrest';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import { OvrBadge } from '../components/shared/GamePrimitives';
import { PlayerAvatar } from '../components/shared/PlayerAvatar';
import { SkillSlotCard, SuperstarStar } from '../components/shared/SkillBadges';
import { formatMoney, formatMoneyExact } from '../utils/format';

export const PlayerProfile: React.FC = () => {
  const {
    career,
    settings,
    isBusy,
    isRollingSkill,
    sellPlayer,
    renewContract,
    rollDevelopedSkill,
    unlockSuperstar,
  } = useCareerStore();
  const { selectedPlayerId, previousScreen, navigate, pushToast } = useUiStore();

  const [sellConfirmOpen, setSellConfirmOpen] = useState(false);
  const [rerollConfirmOpen, setRerollConfirmOpen] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [renewWage, setRenewWage] = useState<number | null>(null);
  const [renewYears, setRenewYears] = useState(3);

  if (!career || !selectedPlayerId) return null;
  const player = career.players[selectedPlayerId];
  if (!player) {
    return (
      <div className="ft-panel rounded-lg p-6">
        <p className="text-sm text-slate-300">Player record not found.</p>
        <button
          type="button"
          onClick={() => navigate('squad')}
          className="mt-3 rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
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
  const eligibleDevelopedPool = getEligibleDevelopedSkills(
    player.primaryPosition,
    player.skill1,
    player.skill2
  );
  const tokenCount = career.universalSkillTokens ?? 0;

  const executeSkillRoll = async () => {
    const res = await rollDevelopedSkill(player.id);
    setRerollConfirmOpen(false);
    if (res.ok && res.rolledSkill) {
      setRevealKey((k) => k + 1);
      const newSkillName = SKILL_MAP[res.rolledSkill]?.name ?? res.rolledSkill;
      if (res.previousSkill) {
        const oldName = SKILL_MAP[res.previousSkill]?.name ?? res.previousSkill;
        pushToast(
          'success',
          `${player.fullName} replaced ${oldName} with ${newSkillName}!`
        );
      } else {
        pushToast('success', `${player.fullName} unlocked ${newSkillName}!`);
      }
    } else {
      pushToast('error', res.error ?? 'Could not roll Developed Skill.');
    }
  };

  const handleDevelopedSkillAction = () => {
    if (player.skill2 !== null) {
      setRerollConfirmOpen(true);
    } else {
      void executeSkillRoll();
    }
  };

  const handleUnlockSuperstar = async () => {
    const res = await unlockSuperstar(player.id);
    if (res.ok) {
      pushToast('success', `${player.fullName} unlocked Superstar status! (+1 Universal Skill Token)`);
    } else {
      pushToast('error', res.error ?? 'Superstar elevation requirements not met.');
    }
  };

  const renderBar = (label: string, value: number) => {
    const barColor =
      value >= 82 ? 'bg-emerald-400' : value >= 70 ? 'bg-sky-400' : 'bg-slate-500';
    return (
      <div key={label} className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-300">{label}</span>
          <span className="font-mono font-bold text-[#F4F5F0] tabular-nums">{value}</span>
        </div>
        <div className="h-1.5 rounded-xs bg-[#070B14] overflow-hidden">
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
        className="inline-flex items-center gap-2 rounded border border-slate-700/80 bg-[#0E1626] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back</span>
      </button>

      {/* Player Dossier Header */}
      <section className="ft-broadcast-strip rounded-lg p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: club?.crest.primaryColor ?? '#10B981' }}
          aria-hidden="true"
        />
        <div className="flex items-center gap-4 sm:gap-5 pl-2 min-w-0">
          <PlayerAvatar
            playerId={player.id}
            fullName={player.fullName}
            primaryColor={club?.crest.primaryColor}
            size={84}
          />
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {club && <ClubCrest crest={club.crest} size={18} />}
              <span className="truncate">
                {club?.name} · {player.nationality} · Born {player.dateOfBirth}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-[#F4F5F0] leading-none flex items-center gap-2.5 flex-wrap">
              <span>{player.fullName}</span>
              <SuperstarStar isSuperstar={player.isSuperstar} size="lg" />
            </h1>
            <div className="text-xs text-slate-300 font-medium">
              <span className="font-mono font-bold text-emerald-400">
                {POSITION_CODES[player.primaryPosition]}
              </span>{' '}
              · {player.primaryPosition}
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

        <div className="flex items-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-800 md:pl-6 shrink-0 pl-2">
          <OvrBadge rating={player.overallRating} label="OVR" size="lg" />
          <div className="ft-chamfer-sm border border-slate-700/80 bg-[#090E1A] px-3.5 py-2 text-center min-w-[68px]">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              POT
            </div>
            <div className="font-display text-3xl font-extrabold text-[#F4F5F0] leading-none tabular-nums">
              {player.potential}
            </div>
          </div>
          <div className="ft-chamfer-sm border border-slate-800 bg-[#090E1A] px-3.5 py-2 text-center min-w-[60px]">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              AGE
            </div>
            <div className="font-display text-3xl font-extrabold text-slate-300 leading-none tabular-nums">
              {player.age}
            </div>
          </div>
        </div>
      </section>

      {/* Attributes Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-emerald-500/70">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Technical</h2>
          <div className="space-y-2.5">{techList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
        <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-sky-500/70">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Physical</h2>
          <div className="space-y-2.5">{physList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
        <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-amber-500/70">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Mental</h2>
          <div className="space-y-2.5">{mentList.map(([k, v]) => renderBar(k, v))}</div>
        </div>
      </section>

      {/* Playstyle Skills (Natural + Token-Developed) & Superstar Progression */}
      <section className="ft-panel rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
              Playstyle Skills &amp; Superstar Tier
            </h2>
            <p className="text-xs text-slate-400">
              Natural Skill is permanent. Use Universal Skill Tokens to unlock or reroll Developed
              Skill from position-compatible traits without altering base OVR.
            </p>
          </div>
          {isUserPlayer && (
            <div
              data-testid="universal-token-balance"
              className="inline-flex items-center gap-2.5 rounded border border-emerald-500/35 bg-[#08131E] px-3.5 py-2 shrink-0 self-start sm:self-auto"
            >
              <Coins className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="leading-tight">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Club Token Inventory
                </div>
                <div className="font-mono text-sm font-bold text-emerald-300 tabular-nums">
                  {tokenCount} Universal Skill {tokenCount === 1 ? 'Token' : 'Tokens'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkillSlotCard mode="natural" value={player.skill1} />

          <SkillSlotCard
            mode="developed"
            value={player.skill2}
            isUserPlayer={isUserPlayer}
            tokenCount={tokenCount}
            eligibleCount={eligibleDevelopedPool.length}
            isRolling={isRollingSkill}
            revealKey={revealKey}
            onUnlockOrReroll={handleDevelopedSkillAction}
          />

          <div
            className={`rounded-md border p-4 flex flex-col justify-between gap-3 ${
              player.isSuperstar
                ? 'border-amber-400/60 bg-amber-950/20 shadow-[inset_0_1px_0_rgba(245,158,11,0.2)]'
                : 'border-slate-800 bg-[#080D18]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Star
                  className={`h-4 w-4 ${
                    player.isSuperstar ? 'fill-amber-400 text-amber-300' : 'text-slate-500'
                  }`}
                />
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  Superstar Status
                </span>
              </div>
              <div className="font-display text-xl font-bold text-[#F4F5F0]">
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
                disabled={!superstarCheck.eligible || isBusy || isRollingSkill}
                onClick={handleUnlockSuperstar}
                className="rounded bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
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
        <div className="lg:col-span-6 ft-panel rounded-lg p-5 space-y-4">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Season &amp; Career Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm tabular-nums">
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Apps</div>
              <div className="font-mono text-xl font-bold text-[#F4F5F0] mt-0.5">
                {player.seasonStats.appearances}
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Goals</div>
              <div className="font-mono text-xl font-bold text-emerald-400 mt-0.5">
                {player.seasonStats.goals}
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Assists</div>
              <div className="font-mono text-xl font-bold text-[#F4F5F0] mt-0.5">
                {player.seasonStats.assists}
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Avg Rating</div>
              <div className="font-mono text-xl font-bold text-[#F4F5F0] mt-0.5">
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

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Development Trajectory
            </h3>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/60 text-xs">
              {player.developmentHistory.map((d, i) => (
                <div key={i} className="py-1.5 flex justify-between gap-2">
                  <span className="text-slate-300">
                    {d.seasonId} MD {d.matchday} · {d.note}
                  </span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {d.overall} OVR
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 ft-panel rounded-lg p-5 space-y-4">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Contract &amp; Valuation</h2>
          <div className="grid grid-cols-2 gap-4 text-sm tabular-nums">
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Market Value</div>
              <div className="font-mono text-lg font-bold text-[#F4F5F0] mt-0.5">
                {formatMoney(player.marketValue, settings.currency)}
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Weekly Wage</div>
              <div className="font-mono text-lg font-bold text-[#F4F5F0] mt-0.5">
                {formatMoneyExact(player.weeklyWage, settings.currency)}/wk
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Contract Expiry</div>
              <div className="font-mono text-base font-semibold text-[#F4F5F0] mt-0.5">
                June {player.contractExpiry}
              </div>
            </div>
            <div className="ft-panel-inset rounded p-3">
              <div className="text-[11px] font-mono uppercase text-slate-400">Fitness / Morale</div>
              <div className="font-mono text-base font-semibold text-emerald-400 mt-0.5">
                {player.fitness}% / {player.morale}%
              </div>
            </div>
          </div>

          {isUserPlayer && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-300">
                Contract Management
              </div>
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
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm font-mono text-[#F4F5F0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Extension Years</label>
                  <select
                    value={renewYears}
                    onChange={(e) => setRenewYears(Number(e.target.value))}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0]"
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
                  className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  <span>Renew Contract</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSellConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded border border-red-900/70 bg-red-950/30 hover:bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-200"
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
        open={rerollConfirmOpen && player.skill2 !== null}
        title="Confirm Developed Skill Reroll"
        description={
          player.skill2
            ? `Current Developed Skill: ${SKILL_MAP[player.skill2]?.name ?? player.skill2} (${SKILL_MAP[player.skill2]?.category ?? 'Playstyle'}). Spending 1 Universal Skill Token will permanently replace ${SKILL_MAP[player.skill2]?.name ?? player.skill2} with a new randomly rolled eligible skill. Remaining tokens after reroll: ${Math.max(0, tokenCount - 1)}.`
            : ''
        }
        confirmLabel="Confirm Reroll (1 Token)"
        cancelLabel="Cancel"
        onConfirm={() => {
          void executeSkillRoll();
        }}
        onCancel={() => setRerollConfirmOpen(false)}
      />

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
