import React, { useMemo, useState } from 'react';
import { ArrowUpCircle, Sparkles, Star, UserPlus } from 'lucide-react';
import { getAcademyAttributeCap } from '../engine/careerEngine';
import { getFacilityUpgradeCost, getStadiumExpansionDetails } from '../engine/financeEngine';
import { ALL_POSITIONS, calculateOverallRating, POSITION_CODES } from '../engine/ratings';
import {
  POSITION_SKILL_RECOMMENDATIONS,
  SKILL_MAP,
  SkillId,
} from '../engine/skills';
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
import { SkillSlotCard } from '../components/shared/SkillBadges';
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
  const [skill1, setSkill1] = useState<SkillId | null>(
    POSITION_SKILL_RECOMMENDATIONS['Central Midfielder'][0][0]
  );
  const [skill2, setSkill2] = useState<SkillId | null>(
    POSITION_SKILL_RECOMMENDATIONS['Central Midfielder'][0][1]
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

  const handleAcademyPositionChange = (nextPos: Position) => {
    setPrimaryPosition(nextPos);
    if (secondaryPosition === nextPos) setSecondaryPosition('');
    setAttrState(buildInitialAttributesForPosition(nextPos, currentAttrCap));
    const rec = POSITION_SKILL_RECOMMENDATIONS[nextPos]?.[0];
    if (rec) {
      setSkill1(rec[0]);
      setSkill2(rec[1]);
    }
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
      skill1,
      skill2,
      grantSuperstar: effectiveGrantSuperstar,
    });

    if (res.ok && res.player) {
      pushToast('success', `${res.player.fullName} promoted to first-team squad!`);
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Club & Infrastructure</h1>
          <p className="text-xs text-slate-400">
            {club.name} · Founded {club.foundedYear} · Balance{' '}
            <span className="font-mono text-emerald-400">
              {formatMoney(club.balance, settings.currency)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-md border border-slate-800 bg-[#121824]">
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
      </div>

      {/* OVERVIEW & LEGACY */}
      {clubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">Manager Legacy</h2>
            <div className="grid grid-cols-2 gap-4 text-sm tabular-nums">
              <div>
                <div className="text-xs text-slate-400">Manager</div>
                <div className="font-semibold text-white">{career.manager.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Philosophy</div>
                <div className="font-semibold text-white">{career.manager.philosophy}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Matches Managed</div>
                <div className="font-mono font-semibold text-white">
                  {career.manager.matchesManaged}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Record (W-D-L)</div>
                <div className="font-mono font-semibold text-emerald-400">
                  {career.manager.wins}-{career.manager.draws}-{career.manager.losses}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Trophies Won</div>
                <div className="font-mono font-semibold text-white">
                  {career.manager.trophiesWon}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Club Reputation</div>
                <div className="font-mono font-semibold text-white">{club.reputation}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Season Archive</h2>
            {career.seasonHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                Complete your first season to record league finishes, continental winners, and Golden Boot recipients.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {career.seasonHistory.map((arch) => (
                  <div key={arch.seasonId} className="py-3 flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-white">{arch.seasonId}</span>
                      {arch.isGeneratedSeason && (
                        <span className="ml-2 text-amber-300">(Generated)</span>
                      )}
                      <div className="text-slate-400 mt-0.5">
                        {arch.leagueName} · Champion: {arch.leagueWinnerName}
                        {arch.uclWinnerName ? ` · UCL: ${arch.uclWinnerName}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-emerald-400 font-semibold">
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
          <div className="relative h-44 rounded-lg border border-slate-800 overflow-hidden bg-[#121824]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <div className="text-xs text-emerald-300 font-mono">
                Training Ground Tier {club.facilities.trainingGround}/5
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
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
                  className={`text-left rounded-lg border p-4 transition-colors space-y-1.5 ${
                    active
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 bg-[#121824] hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-white text-sm">{opt.focus}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h3 className="font-display text-xl font-bold text-white">Recent Training Reports</h3>
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
                      <div className="text-emerald-400">
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
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-emerald-400">
                Youth Academy Tier {club.facilities.youthAcademy}/5 · Attribute Ceiling {currentAttrCap}
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                Academy Prospect Promotion
              </h2>
              <p className="text-xs text-slate-400">
                Design an original Youth Academy graduate with tier-balanced attributes, Blue &amp;
                Purple playstyle skills, and career-earned Superstar eligibility.
              </p>
            </div>
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-center shrink-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-300">
                Live Calculated OVR
              </div>
              <div
                data-testid="academy-preview-ovr"
                className="font-display text-4xl font-bold text-emerald-400 tabular-nums"
              >
                {previewOverall}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Identity & Attributes */}
            <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-5">
              <h3 className="font-display text-xl font-bold text-white">Profile &amp; Attributes</h3>

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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
                    className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
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
                  <span className="text-xs font-semibold text-slate-300">
                    Base Attributes (40–{currentAttrCap})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttrState(buildInitialAttributesForPosition(primaryPosition, currentAttrCap))
                    }
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
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
                          <span className="font-mono text-white font-semibold tabular-nums">
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

            {/* Playstyle Skills (Blue & Purple) + Career Superstar Option */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-white">
                    Playstyle Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(POSITION_SKILL_RECOMMENDATIONS[primaryPosition] ?? []).map((pair, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSkill1(pair[0]);
                          setSkill2(pair[1]);
                        }}
                        className="rounded border border-slate-700 bg-[#0B0F17] hover:border-emerald-500 px-2 py-1 text-[11px] text-slate-200"
                      >
                        {SKILL_MAP[pair[0]].name} + {SKILL_MAP[pair[1]].name}
                      </button>
                    ))}
                  </div>
                </div>

                <SkillSlotCard
                  slotLabel="Skill 1 (Blue)"
                  tone="blue"
                  value={skill1}
                  blockedValue={skill2}
                  editable
                  selectAriaLabel="Academy Skill 1 (Blue)"
                  onChange={setSkill1}
                />

                <SkillSlotCard
                  slotLabel="Skill 2 (Purple)"
                  tone="purple"
                  value={skill2}
                  blockedValue={skill1}
                  editable
                  selectAriaLabel="Academy Skill 2 (Purple)"
                  onChange={setSkill2}
                />

                <label className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-950/15 p-3.5 cursor-pointer">
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-semibold text-white"
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
                className="rounded-lg border border-slate-800 bg-[#121824] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-white">{fac.title}</h3>
                    <span className="font-mono text-xs text-emerald-400">Tier {level}/5</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{fac.benefit}</p>
                </div>
                <button
                  type="button"
                  disabled={maxed}
                  onClick={() => handleUpgrade(fac.key)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2.5 text-xs font-semibold text-white"
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
          <div className="relative h-48 rounded-lg border border-slate-800 overflow-hidden bg-[#121824]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <div className="text-xs text-emerald-300 font-mono">
                Tier {club.facilities.stadiumTier}/5 · Capacity {club.stadiumCapacity.toLocaleString()}
              </div>
              <h2 className="font-display text-3xl font-bold text-white">{club.stadiumName}</h2>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-xl font-bold text-white">Stand & Hospitality Expansion</h3>
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
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
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
