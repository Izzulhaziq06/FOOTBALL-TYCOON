import React, { useMemo, useState } from 'react';
import { ArrowUpCircle, Coins, Lock, ShieldCheck, Sparkles, Star, UserPlus } from 'lucide-react';
import { getAcademyAttributeCap } from '../engine/careerEngine';
import { getFacilityUpgradeCost, getStadiumExpansionDetails } from '../engine/financeEngine';
import { ALL_POSITIONS, calculateOverallRating, POSITION_CODES } from '../engine/ratings';
import { getCompatibleSkillsForPosition } from '../engine/skills';
import { useCareerStore } from '../store/careerStore';
import { ClubSubTab, useUiStore } from '../store/uiStore';
import {
  FacilityLevels,
  MentalAttributes,
  PhysicalAttributes,
  Position,
  TechnicalAttributes,
  TrainingFocus,
} from '../types';
import { GamePageHeader, OvrBadge } from '../components/shared/GamePrimitives';
import { formatMoney } from '../utils/format';

const TRAINING_OPTIONS: Array<{
  focus: TrainingFocus;
  desc: string;
}> = [
  { focus: 'Balanced', desc: 'Uniform tactical, passing, decision-making, and conditioning progression.' },
  { focus: 'Attacking', desc: 'Prioritizes finishing, shooting power, and final-third movement.' },
  { focus: 'Defensive', desc: 'Focuses on tackling timing, marking positioning, and aerial solidity.' },
  { focus: 'Physical', desc: 'Builds sprint pace, acceleration, and match stamina recovery.' },
  { focus: 'Technical', desc: 'Refines passing range, first touch, and ball control.' },
];

function buildInitialAttributesForPosition(pos: Position, cap: number): {
  tech: TechnicalAttributes;
  phys: PhysicalAttributes;
  ment: MentalAttributes;
} {
  const base = Math.min(cap, Math.max(60, cap - 5));
  const lo = Math.max(45, base - 16);
  const isGk = pos === 'Goalkeeper';
  const isDef = pos === 'Centre Back' || pos === 'Full Back' || pos === 'Defensive Midfielder';
  const isAtt = pos === 'Striker' || pos === 'Winger' || pos === 'Attacking Midfielder';

  return {
    tech: {
      passing: isGk ? lo : base,
      shooting: isGk ? 32 : isAtt ? base : lo + 8,
      finishing: isGk ? 30 : isAtt ? base : lo + 5,
      dribbling: isGk ? 38 : isAtt ? base : lo + 10,
      crossing: isGk ? 35 : pos === 'Full Back' || pos === 'Winger' ? base : lo + 8,
      tackling: isGk ? 35 : isDef ? base : lo,
      ballControl: isGk ? 52 : base,
      heading: pos === 'Centre Back' || pos === 'Striker' ? base : lo + 8,
      goalkeeping: isGk ? base : 20,
    },
    phys: {
      pace: isGk ? 54 : base,
      acceleration: isGk ? 56 : base,
      stamina: base,
      strength: pos === 'Centre Back' || pos === 'Striker' ? base : base - 4,
      agility: base,
      jumping: isGk || pos === 'Centre Back' || pos === 'Striker' ? base : base - 5,
    },
    ment: {
      vision: isGk ? 58 : base,
      positioning: base,
      decisions: base,
      composure: base - 2,
      leadership: base - 6,
      workRate: base,
    },
  };
}

export const Club: React.FC = () => {
  const {
    career,
    settings,
    isBusy,
    setTrainingFocus,
    upgradeFacility,
    createCustomPlayer,
  } = useCareerStore();
  const { clubTab, setClubTab, openPlayerProfile, pushToast } = useUiStore();
  const [stadiumImgErr, setStadiumImgErr] = useState(false);
  const [trainingImgErr, setTrainingImgErr] = useState(false);

  const initialClub = career ? career.clubs[career.userClubId] : null;
  const academyTier = initialClub?.facilities.youthAcademy ?? 1;
  const attrCap = getAcademyAttributeCap(academyTier);

  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState(initialClub?.country ?? 'England');
  const [age, setAge] = useState(18);
  const [primaryPosition, setPrimaryPosition] = useState<Position>('Central Midfielder');
  const [secondaryPosition, setSecondaryPosition] = useState<Position | ''>('');
  const [preferredFoot, setPreferredFoot] = useState<'Right' | 'Left' | 'Both'>('Right');
  const [attrState, setAttrState] = useState(() =>
    buildInitialAttributesForPosition('Central Midfielder', attrCap)
  );
  const [grantSuperstar, setGrantSuperstar] = useState(false);

  if (!career) return null;
  const club = career.clubs[career.userClubId];
  const stadiumPlan = getStadiumExpansionDetails(club);
  const currentAttrCap = getAcademyAttributeCap(club.facilities.youthAcademy);

  const previewOverall = useMemo(
    () =>
      calculateOverallRating(
        primaryPosition,
        attrState.tech,
        attrState.phys,
        attrState.ment
      ),
    [primaryPosition, attrState]
  );

  const compatiblePoolCount = useMemo(
    () => getCompatibleSkillsForPosition(primaryPosition).length,
    [primaryPosition]
  );

  const handleAcademyPositionChange = (nextPos: Position) => {
    setPrimaryPosition(nextPos);
    if (secondaryPosition === nextPos) setSecondaryPosition('');
    setAttrState(buildInitialAttributesForPosition(nextPos, currentAttrCap));
  };

  const canGrantSuperstar = club.facilities.youthAcademy >= 3 && previewOverall >= 74;
  const effectiveGrantSuperstar = grantSuperstar && canGrantSuperstar;

  const handleCreateAcademyPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createCustomPlayer({
      fullName,
      nationality,
      age,
      primaryPosition,
      secondaryPositions: secondaryPosition ? [secondaryPosition] : [],
      preferredFoot,
      technicalAttributes: attrState.tech,
      physicalAttributes: attrState.phys,
      mentalAttributes: attrState.ment,
      grantSuperstar: effectiveGrantSuperstar,
    });

    if (res.ok && res.player) {
      const tokenNote =
        (res.tokensEarned ?? 0) > 0
          ? ' +1 Universal Skill Token earned.'
          : ' Seasonal Academy token bonus limit (3/season) reached.';
      pushToast('success', `${res.player.fullName} promoted!${tokenNote}`);
      setFullName('');
      setGrantSuperstar(false);
      openPlayerProfile(res.player.id, 'squad');
    } else {
      pushToast('error', res.error ?? 'Could not create academy graduate.');
    }
  };

  const handleUpgrade = async (facility: keyof FacilityLevels) => {
    const res = await upgradeFacility(facility);
    if (res.ok) {
      pushToast('success', 'Upgrade completed and active immediately.');
    } else {
      pushToast('error', res.error ?? 'Upgrade failed.');
    }
  };

  return (
    <div className="space-y-6">
      <GamePageHeader
        eyebrow={`${club.name} · Founded ${club.foundedYear}`}
        title="Club & Infrastructure"
        accentColor={club.crest.primaryColor}
        subtitle={
          <span>
            Club Balance{' '}
            <span className="font-mono text-emerald-400 font-semibold">
              {formatMoney(club.balance, settings.currency)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-1 p-1 rounded border border-slate-800 bg-[#080D18]">
            {(
              [
                ['overview', 'Club History'],
                ['training', 'Training Centre'],
                ['academy', 'Youth Academy'],
                ['facilities', 'Facilities'],
                ['stadium', 'Stadium'],
              ] as Array<[ClubSubTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setClubTab(id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold ${
                  clubTab === id ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* OVERVIEW & LEGACY */}
      {clubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 ft-panel rounded-lg p-5 space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Manager Legacy</h2>
            <div className="grid grid-cols-2 gap-3 text-sm tabular-nums">
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Manager</div>
                <div className="font-semibold text-[#F4F5F0] mt-0.5">{career.manager.name}</div>
              </div>
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Philosophy</div>
                <div className="font-semibold text-[#F4F5F0] mt-0.5">{career.manager.philosophy}</div>
              </div>
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Matches</div>
                <div className="font-mono font-bold text-[#F4F5F0] mt-0.5">
                  {career.manager.matchesManaged}
                </div>
              </div>
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Record (W-D-L)</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  {career.manager.wins}-{career.manager.draws}-{career.manager.losses}
                </div>
              </div>
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Trophies</div>
                <div className="font-mono font-bold text-[#F4F5F0] mt-0.5">
                  {career.manager.trophiesWon}
                </div>
              </div>
              <div className="ft-panel-inset rounded p-3">
                <div className="text-[11px] font-mono uppercase text-slate-400">Reputation</div>
                <div className="font-mono font-bold text-[#F4F5F0] mt-0.5">{club.reputation}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 ft-panel rounded-lg p-5 space-y-3">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Season Archive</h2>
            {career.seasonHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                Complete your first season to record league finishes, continental winners, and Golden Boot recipients.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {career.seasonHistory.map((arch) => (
                  <div key={arch.seasonId} className="py-3 flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#F4F5F0]">{arch.seasonId}</span>
                      {arch.isGeneratedSeason && (
                        <span className="ml-2 text-amber-300">(Generated)</span>
                      )}
                      <div className="text-slate-400 mt-0.5">
                        {arch.leagueName} · Champion: {arch.leagueWinnerName}
                        {arch.uclWinnerName ? ` · UCL: ${arch.uclWinnerName}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-emerald-400 font-bold">
                        Finished #{arch.leaguePosition} ({arch.points} pts)
                      </div>
                      {arch.topScorerName && (
                        <div className="text-slate-400">
                          Top Scorer: {arch.topScorerName} ({arch.topScorerGoals})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRAINING CENTRE */}
      {clubTab === 'training' && (
        <div className="space-y-6">
          <div className="relative h-48 rounded-lg border border-slate-800 overflow-hidden bg-[#0E1523]">
            {!trainingImgErr ? (
              <img
                src="/src/assets/images/training_ground_pitch_1794859589198.jpg"
                alt="Training pitch at dawn"
                referrerPolicy="no-referrer"
                onError={() => setTrainingImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#0F172A] to-[#0B291E]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/45 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <div className="text-xs text-emerald-300 font-mono uppercase tracking-wider font-semibold">
                Training Ground Tier {club.facilities.trainingGround}/5
              </div>
              <h2 className="font-display text-3xl font-extrabold text-[#F4F5F0]">
                First-Team Training Programme
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {TRAINING_OPTIONS.map((opt) => {
              const active = career.trainingFocus === opt.focus;
              return (
                <button
                  key={opt.focus}
                  type="button"
                  onClick={async () => {
                    await setTrainingFocus(opt.focus);
                    pushToast('success', `Training focus set to ${opt.focus}.`);
                  }}
                  className={`text-left rounded-lg p-4 transition-all space-y-1.5 ${
                    active
                      ? 'ft-panel border-emerald-400/70 bg-emerald-500/12 ring-1 ring-emerald-400/35'
                      : 'ft-panel hover:border-slate-600/80'
                  }`}
                >
                  <div className="font-display text-lg font-bold text-[#F4F5F0]">{opt.focus}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="ft-panel rounded-lg p-5 space-y-3">
            <h3 className="font-display text-2xl font-bold text-[#F4F5F0]">
              Recent Training Reports
            </h3>
            {career.trainingReports.length === 0 ? (
              <p className="text-xs text-slate-400">
                Training reports are generated after each matchday.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {career.trainingReports.map((rep) => (
                  <div key={rep.id} className="py-3 space-y-1">
                    <div className="flex justify-between text-slate-400 font-mono">
                      <span>
                        MD {rep.matchday} · {rep.focus}
                      </span>
                      <span>{rep.date}</span>
                    </div>
                    <div className="text-slate-200">{rep.summary}</div>
                    {rep.improvedPlayers.length > 0 && (
                      <div className="text-emerald-400 font-medium">
                        {rep.improvedPlayers
                          .map(
                            (ip) =>
                              `${ip.playerName} (${ip.oldOverall} → ${ip.newOverall} OVR)`
                          )
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* YOUTH ACADEMY — CREATE CUSTOM ACADEMY PLAYER */}
      {clubTab === 'academy' && (
        <form onSubmit={handleCreateAcademyPlayer} className="space-y-6">
          <div className="ft-broadcast-strip rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Youth Academy Tier {club.facilities.youthAcademy}/5 · Attribute Ceiling {currentAttrCap}
              </div>
              <h2 className="font-display text-3xl font-extrabold text-[#F4F5F0]">
                Academy Prospect Promotion
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Design an original Youth Academy graduate with tier-balanced attributes, Blue &amp;
                Purple playstyle skills, and career-earned Superstar eligibility.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                Live Calculated OVR
              </div>
              <div data-testid="academy-preview-ovr">
                <OvrBadge rating={previewOverall} size="lg" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Identity & Attributes */}
            <div className="lg:col-span-7 ft-panel rounded-lg p-5 space-y-5">
              <h3 className="font-display text-2xl font-bold text-[#F4F5F0]">
                Profile &amp; Attributes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="acad-name" className="block text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    id="acad-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Lucas Holloway"
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acad-nat" className="block text-slate-300 mb-1">
                    Nationality
                  </label>
                  <input
                    id="acad-nat"
                    type="text"
                    required
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acad-age" className="block text-slate-300 mb-1">
                    Age (16–23)
                  </label>
                  <input
                    id="acad-age"
                    type="number"
                    min={16}
                    max={23}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acad-foot" className="block text-slate-300 mb-1">
                    Preferred Foot
                  </label>
                  <select
                    id="acad-foot"
                    value={preferredFoot}
                    onChange={(e) => setPreferredFoot(e.target.value as 'Right' | 'Left' | 'Both')}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0]"
                  >
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="acad-pos" className="block text-slate-300 mb-1">
                    Primary Position
                  </label>
                  <select
                    id="acad-pos"
                    value={primaryPosition}
                    onChange={(e) => handleAcademyPositionChange(e.target.value as Position)}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0]"
                  >
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p} ({POSITION_CODES[p]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="acad-sec-pos" className="block text-slate-300 mb-1">
                    Secondary Position (Optional)
                  </label>
                  <select
                    id="acad-sec-pos"
                    value={secondaryPosition}
                    onChange={(e) => setSecondaryPosition(e.target.value as Position | '')}
                    className="w-full rounded border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0]"
                  >
                    <option value="">None</option>
                    {ALL_POSITIONS.filter((p) => p !== primaryPosition).map((p) => (
                      <option key={p} value={p}>
                        {p} ({POSITION_CODES[p]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Key Attribute Sliders */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                    Base Attributes (40–{currentAttrCap})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttrState(buildInitialAttributesForPosition(primaryPosition, currentAttrCap))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Reset Position Template</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(
                    [
                      ['tech', 'passing', 'Passing'],
                      ['tech', 'shooting', 'Shooting'],
                      ['tech', 'finishing', 'Finishing'],
                      ['tech', 'dribbling', 'Dribbling'],
                      ['tech', 'tackling', 'Tackling'],
                      ['tech', 'ballControl', 'Ball Control'],
                      ...(primaryPosition === 'Goalkeeper'
                        ? ([['tech', 'goalkeeping', 'Goalkeeping']] as const)
                        : []),
                      ['phys', 'pace', 'Pace'],
                      ['phys', 'stamina', 'Stamina'],
                      ['phys', 'strength', 'Strength'],
                      ['ment', 'vision', 'Vision'],
                      ['ment', 'positioning', 'Positioning'],
                      ['ment', 'composure', 'Composure'],
                    ] as Array<['tech' | 'phys' | 'ment', string, string]>
                  ).map(([group, key, label]) => {
                    const rawVal =
                      group === 'tech'
                        ? (attrState.tech as unknown as Record<string, number>)[key]
                        : group === 'phys'
                          ? (attrState.phys as unknown as Record<string, number>)[key]
                          : (attrState.ment as unknown as Record<string, number>)[key];
                    const val = rawVal ?? 60;
                    return (
                      <label key={key} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-300">{label}</span>
                          <span className="font-mono text-[#F4F5F0] font-bold tabular-nums">
                            {val}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={currentAttrCap}
                          value={Math.min(currentAttrCap, val)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setAttrState((prev) => ({
                              ...prev,
                              [group]: { ...prev[group], [key]: n },
                            }));
                          }}
                          className="w-full accent-emerald-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Playstyle Progression & Career Superstar Option */}
            <div className="lg:col-span-5 space-y-4">
              <div className="ft-panel rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-2xl font-bold text-[#F4F5F0]">
                    Playstyle Traits &amp; Tokens
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/35 bg-[#08131E] px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-300">
                    <Coins className="h-3.5 w-3.5 text-emerald-400" />
                    {career.universalSkillTokens ?? 0} Tokens
                  </span>
                </div>

                <div className="rounded-md border border-sky-400/35 bg-[#0A1629] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-300">
                      Natural Skill (Blue · Slot 1)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-sky-300 border border-sky-400/30 bg-sky-950/40 px-2 py-0.5 rounded-sm">
                      <ShieldCheck className="h-3 w-3" />
                      Auto-Assigned
                    </span>
                  </div>
                  <div className="font-display text-lg font-bold text-[#F4F5F0]">
                    Permanent {primaryPosition} Playstyle
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Automatically assigned upon promotion from{' '}
                    <span className="font-mono text-sky-200">{compatiblePoolCount}</span>{' '}
                    position-compatible playstyles. Permanent and cannot be changed.
                  </p>
                </div>

                <div className="rounded-md border border-slate-700/70 bg-[#0B1020] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300">
                      Developed Skill (Purple · Slot 2)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border border-slate-700 bg-slate-900/70 px-2 py-0.5 rounded-sm">
                      <Lock className="h-3 w-3" />
                      Starts Locked
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Unlocks on Player Profile using 1 Universal Skill Token with unlimited rerolls.
                    Promoting an Academy graduate rewards{' '}
                    <span className="font-semibold text-emerald-300">
                      +1 Universal Skill Token
                    </span>{' '}
                    to your shared club inventory.
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded border border-amber-500/40 bg-amber-950/20 p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectiveGrantSuperstar}
                    disabled={!canGrantSuperstar}
                    onChange={(e) => setGrantSuperstar(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                  />
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-300" />
                      <span>Promote as Superstar Graduate (€2.5M)</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Requires Youth Academy Tier 3+ (current: {club.facilities.youthAcademy}) and
                      74+ OVR (current: {previewOverall}). Purely in-game progression — no real-money
                      purchases.
                    </p>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="ft-chamfer-sm w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Promote to First Team</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* CLUB FACILITIES */}
      {clubTab === 'facilities' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(
            [
              {
                key: 'trainingGround' as const,
                title: 'Training Ground',
                benefit: 'Accelerates weekly attribute growth toward player potential ceilings.',
              },
              {
                key: 'youthAcademy' as const,
                title: 'Youth Academy',
                benefit: 'Boosts club reputation and long-term prospect readiness.',
              },
              {
                key: 'medicalCenter' as const,
                title: 'Medical Center',
                benefit: 'Increases weekly fitness recovery and speeds up injury rehabilitation.',
              },
            ]
          ).map((fac) => {
            const level = club.facilities[fac.key];
            const cost = getFacilityUpgradeCost(fac.key, level);
            const maxed = level >= 5;
            return (
              <div
                key={fac.key}
                className="ft-panel rounded-lg p-5 flex flex-col justify-between gap-4 border-t-2 border-t-emerald-500/70"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-bold text-[#F4F5F0]">{fac.title}</h3>
                    <span className="font-mono text-xs font-bold text-emerald-400">Tier {level}/5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((tier) => (
                      <div
                        key={tier}
                        className={`h-1.5 rounded-xs ${
                          tier <= level ? 'bg-emerald-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{fac.benefit}</p>
                </div>
                <button
                  type="button"
                  disabled={maxed}
                  onClick={() => handleUpgrade(fac.key)}
                  className="ft-chamfer-sm inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>
                    {maxed
                      ? 'Maximum Tier Reached'
                      : `Upgrade (${formatMoney(cost, settings.currency)})`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* STADIUM MANAGEMENT */}
      {clubTab === 'stadium' && (
        <div className="space-y-5">
          <div className="relative h-52 rounded-lg border border-slate-800 overflow-hidden bg-[#0E1523]">
            {!stadiumImgErr ? (
              <img
                src="/src/assets/images/stadium_aerial_editorial_1794859588513.jpg"
                alt={club.stadiumName}
                referrerPolicy="no-referrer"
                onError={() => setStadiumImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#0F172A] to-[#0B291E]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/45 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <div className="text-xs text-emerald-300 font-mono uppercase tracking-wider font-semibold">
                Tier {club.facilities.stadiumTier}/5 · Capacity {club.stadiumCapacity.toLocaleString()}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#F4F5F0]">
                {club.stadiumName}
              </h2>
            </div>
          </div>

          <div className="ft-panel rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-2xl font-bold text-[#F4F5F0]">
                Stand &amp; Hospitality Expansion
              </h3>
              <p className="text-xs text-slate-300">
                {stadiumPlan.canUpgrade
                  ? `Adds +${stadiumPlan.addedSeats.toLocaleString()} seats and increases average matchday gate receipts per home fixture.`
                  : 'Stadium has reached maximum Tier 5 capacity.'}
              </p>
            </div>
            <button
              type="button"
              disabled={!stadiumPlan.canUpgrade}
              onClick={() => handleUpgrade('stadiumTier')}
              className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap shrink-0"
            >
              {stadiumPlan.canUpgrade
                ? `Expand Stadium (${formatMoney(stadiumPlan.cost, settings.currency)})`
                : 'Maximum Capacity'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
