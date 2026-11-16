import {
  Club,
  ClubTactics,
  Fixture,
  MatchEvent,
  MatchResult,
  Player,
  PlayerMatchRating,
  TeamMatchStats,
} from '../types';
import { calculateEffectiveRatingForSlot } from './ratings';
import { hasSkill, SkillId } from './skills';
import { buildDefaultTactics } from './tacticsEngine';

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MatchTeamContext {
  club: Club;
  tactics: ClubTactics;
  players: Record<string, Player>;
  recentFormScore: number; // -5..+5
  isHome: boolean;
}

interface ComputedTeamPower {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
  staminaAvg: number;
  moraleAvg: number;
  chemistryBonus: number;
  tacticalPaceMod: number;
  pressingCardRisk: number;
  chanceRateSkillMod: number;
  passCountBonus: number;
  aerialDefenseEdge: number;
  skillCounts: Partial<Record<SkillId, number>>;
  activeSuperstars: number;
}

function getStarters(tactics: ClubTactics, players: Record<string, Player>): Player[] {
  return tactics.slots
    .map((s) => (s.playerId ? players[s.playerId] : null))
    .filter((p): p is Player => Boolean(p));
}

function diminishingWeight(count: number): number {
  if (count <= 0) return 0;
  // 1st instance = 1.0, 2nd = 0.45, 3rd+ = 0.15 each (prevents stacking exploits)
  let total = 1.0;
  if (count >= 2) total += 0.45;
  if (count >= 3) total += (count - 2) * 0.15;
  return total;
}

function computeTeamPower(
  ctx: MatchTeamContext,
  staminaByPlayer: Record<string, number>,
  redCardedIds: Set<string>,
  minute = 1
): ComputedTeamPower {
  const activeSlots = ctx.tactics.slots.filter(
    (s) => s.playerId && !redCardedIds.has(s.playerId)
  );

  let attackSum = 0;
  let attackCount = 0;
  let midSum = 0;
  let midCount = 0;
  let defSum = 0;
  let defCount = 0;
  let gkRating = 65;
  let staminaTotal = 0;
  let moraleTotal = 0;
  let naturalMatches = 0;
  let activeSuperstars = 0;
  const skillCounts: Partial<Record<SkillId, number>> = {};

  const recordSkill = (id: SkillId | null | undefined) => {
    if (!id) return;
    skillCounts[id] = (skillCounts[id] ?? 0) + 1;
  };

  for (const slot of activeSlots) {
    const p = slot.playerId ? ctx.players[slot.playerId] : undefined;
    if (!p) continue;

    recordSkill(p.skill1);
    recordSkill(p.skill2);
    if (p.isSuperstar) activeSuperstars += 1;

    const currentStamina = staminaByPlayer[p.id] ?? p.fitness;
    const staminaFactor = 0.72 + (currentStamina / 100) * 0.28;
    const moraleFactor = 0.92 + (p.morale / 100) * 0.14;
    // Modest balanced Superstar consistency bump (+0.9 effective OVR equivalent in slot)
    const superstarFlatBump = p.isSuperstar ? 0.9 : 0;
    const eff =
      calculateEffectiveRatingForSlot(p, slot.rolePosition) * staminaFactor * moraleFactor +
      superstarFlatBump;

    if (p.primaryPosition === slot.rolePosition) naturalMatches += 1;
    staminaTotal += currentStamina;
    moraleTotal += p.morale;

    if (slot.rolePosition === 'Goalkeeper') {
      const gkAttr =
        p.technicalAttributes.goalkeeping ??
        Math.round((p.mentalAttributes.positioning + p.physicalAttributes.agility) / 2);
      const gkSkillBump =
        (hasSkill(p, 'gk_positioning') ? 1.8 : 0) +
        (hasSkill(p, 'anticipation') ? 1.5 : 0) +
        (hasSkill(p, 'agility') ? 0.9 : 0);
      gkRating = (eff * 0.5 + gkAttr * 0.5) * moraleFactor + gkSkillBump;
    } else if (slot.rolePosition === 'Centre Back' || slot.rolePosition === 'Full Back') {
      const defAttr =
        p.technicalAttributes.tackling * 0.45 +
        p.mentalAttributes.positioning * 0.35 +
        p.physicalAttributes.pace * 0.2;
      const latePhysique = minute >= 65 && hasSkill(p, 'physique') ? 0.9 : 0;
      defSum += eff * 0.65 + defAttr * 0.35 + latePhysique;
      defCount += 1;
    } else if (
      slot.rolePosition === 'Defensive Midfielder' ||
      slot.rolePosition === 'Central Midfielder' ||
      slot.rolePosition === 'Attacking Midfielder'
    ) {
      const midAttr =
        p.technicalAttributes.passing * 0.4 +
        p.mentalAttributes.vision * 0.3 +
        p.technicalAttributes.dribbling * 0.3;
      const latePhysique = minute >= 65 && hasSkill(p, 'physique') ? 0.8 : 0;
      midSum += eff * 0.65 + midAttr * 0.35 + latePhysique;
      midCount += 1;
    } else {
      const attAttr =
        p.technicalAttributes.finishing * 0.4 +
        p.technicalAttributes.shooting * 0.25 +
        p.physicalAttributes.pace * 0.2 +
        p.technicalAttributes.dribbling * 0.15;
      const latePhysique = minute >= 65 && hasSkill(p, 'physique') ? 0.9 : 0;
      attackSum += eff * 0.65 + attAttr * 0.35 + latePhysique;
      attackCount += 1;
    }
  }

  // Red card penalty reduces unit strength proportionally
  const redPenalty = Math.max(0.62, 1 - redCardedIds.size * 0.14);

  let attack = (attackCount > 0 ? attackSum / attackCount : 68) * redPenalty;
  let midfield = (midCount > 0 ? midSum / midCount : 68) * redPenalty;
  let defense = (defCount > 0 ? defSum / defCount : 68) * redPenalty;

  // Apply diminishing-returns unit skill modifiers (modest balanced weights, never overpowering OVR)
  const leadershipAura = Math.min(1.2, diminishingWeight(skillCounts.leadership ?? 0) * 0.85);
  const superstarAura = Math.min(1.8, activeSuperstars * 0.55);

  attack +=
    diminishingWeight(skillCounts.shooting ?? 0) * 0.95 +
    diminishingWeight(skillCounts.dribbling ?? 0) * 1.05 +
    diminishingWeight(skillCounts.att_positioning ?? 0) * 1.05 +
    diminishingWeight(skillCounts.speed ?? 0) * 0.85 +
    diminishingWeight(skillCounts.technique ?? 0) * 0.75 +
    diminishingWeight(skillCounts.agility ?? 0) * 0.65 +
    diminishingWeight(skillCounts.strength ?? 0) * 0.55 +
    leadershipAura +
    superstarAura * 0.5;

  midfield +=
    diminishingWeight(skillCounts.passing ?? 0) * 1.15 +
    diminishingWeight(skillCounts.creativity ?? 0) * 0.95 +
    diminishingWeight(skillCounts.control ?? 0) * 0.95 +
    diminishingWeight(skillCounts.intelligence ?? 0) * 0.9 +
    diminishingWeight(skillCounts.ball_recovery ?? 0) * 0.95 +
    diminishingWeight(skillCounts.technique ?? 0) * 0.55 +
    leadershipAura +
    superstarAura * 0.4;

  defense +=
    diminishingWeight(skillCounts.tackling ?? 0) * 1.1 +
    diminishingWeight(skillCounts.marking ?? 0) * 1.1 +
    diminishingWeight(skillCounts.aggressiveness ?? 0) * 0.95 +
    diminishingWeight(skillCounts.ball_recovery ?? 0) * 0.7 +
    diminishingWeight(skillCounts.strength ?? 0) * 0.6 +
    diminishingWeight(skillCounts.anticipation ?? 0) * 0.5 +
    leadershipAura +
    superstarAura * 0.3;

  // Tactical Modifiers
  const { mentality, pressing, defensiveLine, passing, tempo, width } = ctx.tactics;

  if (mentality === 'Very Attacking') {
    attack += 6.5;
    defense -= 5.5;
  } else if (mentality === 'Attacking') {
    attack += 3.5;
    defense -= 2.5;
  } else if (mentality === 'Defensive') {
    defense += 3.5;
    attack -= 2.5;
  } else if (mentality === 'Very Defensive') {
    defense += 6.5;
    attack -= 5.5;
  }

  if (pressing === 'Aggressive') {
    midfield += 3.5;
  } else if (pressing === 'High') {
    midfield += 2;
  } else if (pressing === 'Low') {
    defense += 1.5;
  }

  if (defensiveLine === 'High') {
    midfield += 2;
    defense -= 1.5;
  } else if (defensiveLine === 'Deep') {
    defense += 2.5;
    midfield -= 1.5;
  }

  if (passing === 'Short') {
    midfield += 2.5;
  } else if (passing === 'Direct') {
    attack += 2;
  }

  if (width === 'Wide') {
    attack += 1.2;
  } else if (width === 'Narrow') {
    midfield += 1.2;
  }

  const tacticalPaceMod = tempo === 'Fast' ? 1.15 : tempo === 'Slow' ? 0.88 : 1.0;
  const aggRisk = 1 + diminishingWeight(skillCounts.aggressiveness ?? 0) * 0.08;
  const tackSafety = 1 - Math.min(0.12, diminishingWeight(skillCounts.tackling ?? 0) * 0.045);
  const pressingCardRisk =
    (pressing === 'Aggressive' ? 1.45 : pressing === 'High' ? 1.2 : pressing === 'Low' ? 0.78 : 1.0) *
    aggRisk *
    tackSafety;

  const chanceRateSkillMod =
    1 + Math.min(0.12, diminishingWeight(skillCounts.creativity ?? 0) * 0.045 + diminishingWeight(skillCounts.speed ?? 0) * 0.025);
  const passCountBonus = Math.round(diminishingWeight(skillCounts.passing ?? 0) * 0.9);
  const aerialDefenseEdge =
    diminishingWeight(skillCounts.gk_aerial ?? 0) * 0.032 +
    diminishingWeight(skillCounts.heading ?? 0) * 0.015;

  const homeBoost = ctx.isHome ? 3.2 : 0;
  const formBoost = ctx.recentFormScore * 0.45;
  const chemistryBonus = (naturalMatches / 11) * 3.0;

  return {
    attack: attack + homeBoost + formBoost + chemistryBonus,
    midfield: midfield + homeBoost * 0.6 + formBoost + chemistryBonus,
    defense: defense + homeBoost * 0.7 + formBoost + chemistryBonus,
    goalkeeping: gkRating + homeBoost * 0.4,
    staminaAvg: activeSlots.length > 0 ? staminaTotal / activeSlots.length : 85,
    moraleAvg: activeSlots.length > 0 ? moraleTotal / activeSlots.length : 75,
    chemistryBonus,
    tacticalPaceMod,
    pressingCardRisk,
    chanceRateSkillMod,
    passCountBonus,
    aerialDefenseEdge,
    skillCounts,
    activeSuperstars,
  };
}

function pickWeightedPlayer(
  rng: () => number,
  candidates: Player[],
  weightFn: (p: Player) => number
): Player | undefined {
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((p) => Math.max(1, weightFn(p)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export interface LiveMatchSession {
  fixtureId: string;
  seed: number;
  rngStateCounter: number;
  home: MatchTeamContext;
  away: MatchTeamContext;
  minute: number;
  addedTimeHalf1: number;
  addedTimeHalf2: number;
  phase: 'PRE_MATCH' | 'FIRST_HALF' | 'HALF_TIME' | 'SECOND_HALF' | 'FULL_TIME';
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  homePossessionTicks: number;
  awayPossessionTicks: number;
  stamina: Record<string, number>;
  yellowCardedIds: Set<string>;
  redCardedIds: Set<string>;
  injuredIds: Set<string>;
  homeSubsUsed: number;
  awaySubsUsed: number;
  playerMinutes: Record<string, number>;
  playerGoals: Record<string, number>;
  playerAssists: Record<string, number>;
  playerYellows: Record<string, number>;
  playerReds: Record<string, number>;
  playerImpact: Record<string, number>;
  attendance: number;
  gateReceipts: number;
}

export function calculateFixtureAttendance(homeClub: Club, awayClub: Club): {
  attendance: number;
  gateReceipts: number;
} {
  const repAvg = (homeClub.reputation + awayClub.reputation) / 2;
  const fillRate = Math.min(0.99, Math.max(0.58, 0.52 + (repAvg - 65) * 0.012));
  const tierFactor = 1 + (homeClub.facilities.stadiumTier - 2) * 0.04;
  const attendance = Math.min(
    homeClub.stadiumCapacity,
    Math.round(homeClub.stadiumCapacity * Math.min(0.99, fillRate * tierFactor))
  );
  const avgTicketPrice = 38 + homeClub.facilities.stadiumTier * 8 + (homeClub.reputation - 70) * 0.4;
  const gateReceipts = Math.round(attendance * Math.max(25, avgTicketPrice));
  return { attendance, gateReceipts };
}

export function createLiveMatchSession(
  fixture: Fixture,
  homeClub: Club,
  awayClub: Club,
  homeTactics: ClubTactics,
  awayTactics: ClubTactics,
  players: Record<string, Player>,
  seed: number,
  homeFormScore = 0,
  awayFormScore = 0
): LiveMatchSession {
  const rng = createSeededRng(seed);
  const addedTimeHalf1 = 1 + Math.floor(rng() * 3);
  const addedTimeHalf2 = 2 + Math.floor(rng() * 4);
  const { attendance, gateReceipts } = calculateFixtureAttendance(homeClub, awayClub);

  const stamina: Record<string, number> = {};
  const playerMinutes: Record<string, number> = {};
  const playerGoals: Record<string, number> = {};
  const playerAssists: Record<string, number> = {};
  const playerYellows: Record<string, number> = {};
  const playerReds: Record<string, number> = {};
  const playerImpact: Record<string, number> = {};

  for (const s of [...homeTactics.slots, ...awayTactics.slots]) {
    if (s.playerId && players[s.playerId]) {
      stamina[s.playerId] = players[s.playerId].fitness;
      playerMinutes[s.playerId] = 0;
      playerGoals[s.playerId] = 0;
      playerAssists[s.playerId] = 0;
      playerYellows[s.playerId] = 0;
      playerReds[s.playerId] = 0;
      playerImpact[s.playerId] = 6.4;
    }
  }
  for (const pid of [...homeTactics.substituteIds, ...awayTactics.substituteIds]) {
    if (players[pid]) {
      stamina[pid] = players[pid].fitness;
      playerMinutes[pid] = 0;
      playerGoals[pid] = 0;
      playerAssists[pid] = 0;
      playerYellows[pid] = 0;
      playerReds[pid] = 0;
      playerImpact[pid] = 6.3;
    }
  }

  return {
    fixtureId: fixture.id,
    seed,
    rngStateCounter: 1,
    home: {
      club: homeClub,
      tactics: structuredClone(homeTactics),
      players,
      recentFormScore: homeFormScore,
      isHome: true,
    },
    away: {
      club: awayClub,
      tactics: structuredClone(awayTactics),
      players,
      recentFormScore: awayFormScore,
      isHome: false,
    },
    minute: 0,
    addedTimeHalf1,
    addedTimeHalf2,
    phase: 'PRE_MATCH',
    homeScore: 0,
    awayScore: 0,
    events: [],
    homeStats: {
      possession: 50,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      passesCompleted: 0,
      expectedGoals: 0,
    },
    awayStats: {
      possession: 50,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      passesCompleted: 0,
      expectedGoals: 0,
    },
    homePossessionTicks: 1,
    awayPossessionTicks: 1,
    stamina,
    yellowCardedIds: new Set(),
    redCardedIds: new Set(),
    injuredIds: new Set(),
    homeSubsUsed: 0,
    awaySubsUsed: 0,
    playerMinutes,
    playerGoals,
    playerAssists,
    playerYellows,
    playerReds,
    playerImpact,
    attendance,
    gateReceipts,
  };
}

function nextRng(session: LiveMatchSession): () => number {
  session.rngStateCounter += 1;
  return createSeededRng(session.seed + session.rngStateCounter * 7919);
}

export function updateLiveMatchTactics(
  session: LiveMatchSession,
  side: 'home' | 'away',
  newTactics: ClubTactics
): void {
  if (side === 'home') {
    session.home.tactics = structuredClone(newTactics);
  } else {
    session.away.tactics = structuredClone(newTactics);
  }
}

function getEventClock(session: LiveMatchSession): { minute: number; addedTime?: number } {
  if (session.phase === 'FIRST_HALF' && session.minute > 45) {
    return { minute: 45, addedTime: session.minute - 45 };
  }
  if (session.phase === 'SECOND_HALF' && session.minute > 90) {
    return { minute: 90, addedTime: session.minute - 90 };
  }
  return { minute: Math.max(1, session.minute) };
}

export function applyLiveSubstitution(
  session: LiveMatchSession,
  side: 'home' | 'away',
  slotIndex: number,
  subPlayerId: string
): boolean {
  const team = side === 'home' ? session.home : session.away;
  const subsUsed = side === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
  if (subsUsed >= 3) return false;

  const slot = team.tactics.slots[slotIndex];
  if (!slot || !slot.playerId) return false;
  if (!team.tactics.substituteIds.includes(subPlayerId)) return false;

  const offPlayer = team.players[slot.playerId];
  const onPlayer = team.players[subPlayerId];
  if (!offPlayer || !onPlayer) return false;

  const offId = slot.playerId;
  slot.playerId = subPlayerId;
  team.tactics.substituteIds = team.tactics.substituteIds.filter((id) => id !== subPlayerId);
  if (session.playerImpact[subPlayerId] === undefined) {
    session.playerImpact[subPlayerId] = 6.3;
  }

  if (side === 'home') session.homeSubsUsed += 1;
  else session.awaySubsUsed += 1;

  session.events.push({
    id: `ev_${session.fixtureId}_${session.events.length}`,
    ...getEventClock(session),
    type: 'SUBSTITUTION',
    clubId: team.club.id,
    playerId: subPlayerId,
    secondaryPlayerId: offId,
    commentary: `Substitution (${team.club.shortName}): ${onPlayer.fullName} replaces ${offPlayer.fullName}.`,
    homeScoreAfter: session.homeScore,
    awayScoreAfter: session.awayScore,
  });

  return true;
}

function autoAiSubstitutionIfNeeded(session: LiveMatchSession, side: 'home' | 'away') {
  const subsUsed = side === 'home' ? session.homeSubsUsed : session.awaySubsUsed;
  if (subsUsed >= 3) return;
  const team = side === 'home' ? session.home : session.away;

  // Find tired outfield starter (< 72 stamina)
  const tiredSlot = team.tactics.slots
    .filter((s) => s.slotIndex > 0 && s.playerId && !session.redCardedIds.has(s.playerId))
    .sort((a, b) => (session.stamina[a.playerId!] ?? 100) - (session.stamina[b.playerId!] ?? 100))[0];

  if (!tiredSlot || !tiredSlot.playerId) return;
  if ((session.stamina[tiredSlot.playerId] ?? 100) > 72 && session.minute < 72) return;

  const bestSub = team.tactics.substituteIds
    .map((id) => team.players[id])
    .filter((p): p is Player => Boolean(p) && p.primaryPosition !== 'Goalkeeper')
    .sort(
      (a, b) =>
        calculateEffectiveRatingForSlot(b, tiredSlot.rolePosition) -
        calculateEffectiveRatingForSlot(a, tiredSlot.rolePosition)
    )[0];

  if (bestSub) {
    applyLiveSubstitution(session, side, tiredSlot.slotIndex, bestSub.id);
  }
}

export function stepLiveMatchMinute(session: LiveMatchSession, userSide?: 'home' | 'away'): void {
  if (session.phase === 'FULL_TIME') return;

  const rng = nextRng(session);

  if (session.phase === 'PRE_MATCH') {
    session.phase = 'FIRST_HALF';
    session.minute = 1;
    session.events.push({
      id: `ev_${session.fixtureId}_${session.events.length}`,
      minute: 1,
      type: 'KICK_OFF',
      clubId: session.home.club.id,
      commentary: `Kick-off at ${session.home.club.stadiumName}. ${session.home.club.name} get us underway against ${session.away.club.name}.`,
      homeScoreAfter: 0,
      awayScoreAfter: 0,
    });
    return;
  }

  if (session.phase === 'HALF_TIME') {
    session.phase = 'SECOND_HALF';
    session.minute = 46;
    session.events.push({
      id: `ev_${session.fixtureId}_${session.events.length}`,
      minute: 46,
      type: 'KICK_OFF',
      clubId: session.away.club.id,
      commentary: `Second half begins. ${session.away.club.name} restart play.`,
      homeScoreAfter: session.homeScore,
      awayScoreAfter: session.awayScore,
    });
    return;
  }

  // Track minutes played and fatigue drain (Endurance skill cuts per-minute drain by 25%)
  for (const ctx of [session.home, session.away]) {
    for (const s of ctx.tactics.slots) {
      if (!s.playerId || session.redCardedIds.has(s.playerId)) continue;
      session.playerMinutes[s.playerId] = (session.playerMinutes[s.playerId] ?? 0) + 1;
      const p = ctx.players[s.playerId];
      const enduranceMod = p && hasSkill(p, 'endurance') ? 0.75 : 1.0;
      const baseDrain = s.slotIndex === 0 ? 0.08 : 0.34;
      session.stamina[s.playerId] = Math.max(
        25,
        (session.stamina[s.playerId] ?? 90) - baseDrain * enduranceMod
      );
    }
  }

  const homePower = computeTeamPower(session.home, session.stamina, session.redCardedIds, session.minute);
  const awayPower = computeTeamPower(session.away, session.stamina, session.redCardedIds, session.minute);

  // Possession tick & pass generation derived from midfield + passing/control skills
  const midDiff = homePower.midfield - awayPower.midfield;
  const homePossProb = Math.min(0.72, Math.max(0.28, 0.5 + midDiff * 0.014));
  const homeHasBall = rng() < homePossProb;
  if (homeHasBall) {
    session.homePossessionTicks += 1;
    session.homeStats.passesCompleted += 4 + Math.floor(rng() * 5) + homePower.passCountBonus;
  } else {
    session.awayPossessionTicks += 1;
    session.awayStats.passesCompleted += 4 + Math.floor(rng() * 5) + awayPower.passCountBonus;
  }

  const totalTicks = session.homePossessionTicks + session.awayPossessionTicks;
  session.homeStats.possession = Math.round((session.homePossessionTicks / totalTicks) * 100);
  session.awayStats.possession = 100 - session.homeStats.possession;

  const atkTeam = homeHasBall ? session.home : session.away;
  const defTeam = homeHasBall ? session.away : session.home;
  const atkPower = homeHasBall ? homePower : awayPower;
  const defPower = homeHasBall ? awayPower : homePower;
  const atkStats = homeHasBall ? session.homeStats : session.awayStats;
  const defStats = homeHasBall ? session.awayStats : session.homeStats;

  const atkPlayers = getStarters(atkTeam.tactics, atkTeam.players).filter(
    (p) => !session.redCardedIds.has(p.id) && p.primaryPosition !== 'Goalkeeper'
  );
  const defPlayers = getStarters(defTeam.tactics, defTeam.players).filter(
    (p) => !session.redCardedIds.has(p.id)
  );
  const defGK = defPlayers.find((p) => p.primaryPosition === 'Goalkeeper') ?? defPlayers[0];

  // Occasional midfield build-up pass log every ~14 minutes (excludes free_kicks from ordinary passing)
  if (session.minute % 14 === 0 && atkPlayers.length > 0) {
    const passer = pickWeightedPlayer(
      rng,
      atkPlayers,
      (p) =>
        p.technicalAttributes.passing +
        p.mentalAttributes.vision +
        (hasSkill(p, 'passing') ? 16 : 0) +
        (hasSkill(p, 'control') ? 10 : 0) +
        (hasSkill(p, 'intelligence') ? 10 : 0)
    );
    if (passer) {
      session.events.push({
        id: `ev_${session.fixtureId}_${session.events.length}`,
        ...getEventClock(session),
        type: 'PASS',
        clubId: atkTeam.club.id,
        playerId: passer.id,
        commentary: `${passer.fullName} dictates tempo from midfield for ${atkTeam.club.shortName}.`,
        homeScoreAfter: session.homeScore,
        awayScoreAfter: session.awayScore,
      });
    }
  }

  // Attack / Chance probability based on tempo and midfield/creativity superiority
  const eventRate = 0.25 * atkPower.tacticalPaceMod * atkPower.chanceRateSkillMod;
  const roll = rng();

  if (roll < eventRate && atkPlayers.length > 0 && defPlayers.length > 0) {
    // Determine if foul/card happens vs attacking chance
    const foulRoll = rng();
    const foulChance = 0.22 * defPower.pressingCardRisk;

    if (foulRoll < foulChance) {
      const fouler = pickWeightedPlayer(
        rng,
        defPlayers.filter((p) => p.primaryPosition !== 'Goalkeeper'),
        (p) =>
          110 -
          p.mentalAttributes.decisions +
          (p.primaryPosition === 'Centre Back' ? 20 : 10) +
          (hasSkill(p, 'aggressiveness') ? 18 : 0) -
          (hasSkill(p, 'tackling') ? 12 : 0)
      );
      const victim = pickWeightedPlayer(
        rng,
        atkPlayers,
        (p) =>
          p.technicalAttributes.dribbling +
          (hasSkill(p, 'dribbling') ? 16 : 0) +
          (hasSkill(p, 'agility') ? 10 : 0)
      );
      defStats.fouls += 1;

      if (fouler) {
        const cardRoll = rng();
        const aggCardFactor = hasSkill(fouler, 'aggressiveness') ? 1.15 : hasSkill(fouler, 'tackling') ? 0.85 : 1.0;
        if (cardRoll < 0.022 * aggCardFactor) {
          // Direct or second yellow -> Red Card
          defStats.redCards += 1;
          session.redCardedIds.add(fouler.id);
          session.playerReds[fouler.id] = (session.playerReds[fouler.id] ?? 0) + 1;
          session.playerImpact[fouler.id] = Math.max(3.5, (session.playerImpact[fouler.id] ?? 6) - 1.6);
          session.events.push({
            id: `ev_${session.fixtureId}_${session.events.length}`,
            ...getEventClock(session),
            type: 'RED_CARD',
            clubId: defTeam.club.id,
            playerId: fouler.id,
            secondaryPlayerId: victim?.id,
            commentary: `RED CARD! ${fouler.fullName} (${defTeam.club.shortName}) is sent off for a reckless challenge on ${victim?.fullName ?? 'an opponent'}!`,
            homeScoreAfter: session.homeScore,
            awayScoreAfter: session.awayScore,
          });
        } else if (cardRoll < 0.28 * aggCardFactor) {
          if (session.yellowCardedIds.has(fouler.id)) {
            defStats.yellowCards += 1;
            defStats.redCards += 1;
            session.redCardedIds.add(fouler.id);
            session.playerYellows[fouler.id] = (session.playerYellows[fouler.id] ?? 0) + 1;
            session.playerReds[fouler.id] = (session.playerReds[fouler.id] ?? 0) + 1;
            session.playerImpact[fouler.id] = Math.max(4.0, (session.playerImpact[fouler.id] ?? 6) - 1.2);
            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'RED_CARD',
              clubId: defTeam.club.id,
              playerId: fouler.id,
              commentary: `SECOND YELLOW & RED! ${fouler.fullName} receives his marching orders.`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
          } else {
            defStats.yellowCards += 1;
            session.yellowCardedIds.add(fouler.id);
            session.playerYellows[fouler.id] = (session.playerYellows[fouler.id] ?? 0) + 1;
            session.playerImpact[fouler.id] = Math.max(5.0, (session.playerImpact[fouler.id] ?? 6.2) - 0.3);
            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'YELLOW_CARD',
              clubId: defTeam.club.id,
              playerId: fouler.id,
              secondaryPlayerId: victim?.id,
              commentary: `Yellow card for ${fouler.fullName} (${defTeam.club.shortName}) after bringing down ${victim?.fullName ?? 'the attacker'}.`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
          }
        } else {
          session.events.push({
            id: `ev_${session.fixtureId}_${session.events.length}`,
            ...getEventClock(session),
            type: 'FOUL',
            clubId: defTeam.club.id,
            playerId: fouler.id,
            secondaryPlayerId: victim?.id,
            commentary: `Free-kick awarded to ${atkTeam.club.shortName} after a foul by ${fouler.fullName}.`,
            homeScoreAfter: session.homeScore,
            awayScoreAfter: session.awayScore,
          });
        }

        // Context-sensitive direct Free Kick chance (~24% of fouls in dangerous zones)
        if (rng() < 0.24) {
          const fkTaker =
            (atkTeam.tactics.freeKickTakerId &&
              atkPlayers.find((p) => p.id === atkTeam.tactics.freeKickTakerId)) ||
            pickWeightedPlayer(
              rng,
              atkPlayers,
              (p) =>
                p.technicalAttributes.shooting +
                p.technicalAttributes.passing +
                (hasSkill(p, 'free_kicks') ? 45 : 0)
            );
          if (fkTaker) {
            const hasFK = hasSkill(fkTaker, 'free_kicks');
            const fkQuality = hasFK ? 0.14 : 0.08;
            atkStats.shots += 1;
            atkStats.expectedGoals = Number((atkStats.expectedGoals + fkQuality).toFixed(2));
            const fkOnTarget = rng() < (hasFK ? 0.58 : 0.34);
            if (fkOnTarget) {
              atkStats.shotsOnTarget += 1;
              const gkSaveEdge =
                (defGK && hasSkill(defGK, 'saves') ? 0.045 : 0) +
                (defGK && hasSkill(defGK, 'gk_positioning') ? 0.035 : 0);
              const fkGoalProb = Math.min(0.45, Math.max(0.12, (hasFK ? 0.31 : 0.19) - gkSaveEdge));
              if (rng() < fkGoalProb) {
                if (homeHasBall) session.homeScore += 1;
                else session.awayScore += 1;
                session.playerGoals[fkTaker.id] = (session.playerGoals[fkTaker.id] ?? 0) + 1;
                session.playerImpact[fkTaker.id] = Math.min(10, (session.playerImpact[fkTaker.id] ?? 6.5) + 1.4);
                session.events.push({
                  id: `ev_${session.fixtureId}_${session.events.length}`,
                  ...getEventClock(session),
                  type: 'GOAL',
                  clubId: atkTeam.club.id,
                  playerId: fkTaker.id,
                  isGoal: true,
                  isOnTarget: true,
                  commentary: `FREE-KICK GOAL! ${fkTaker.fullName} whips an unstoppable dead-ball strike past ${defGK?.fullName ?? 'the keeper'}!`,
                  homeScoreAfter: session.homeScore,
                  awayScoreAfter: session.awayScore,
                });
              } else {
                if (defGK) {
                  session.playerImpact[defGK.id] = Math.min(9.8, (session.playerImpact[defGK.id] ?? 6.5) + 0.35);
                }
                session.events.push({
                  id: `ev_${session.fixtureId}_${session.events.length}`,
                  ...getEventClock(session),
                  type: 'SAVE',
                  clubId: defTeam.club.id,
                  playerId: defGK?.id,
                  secondaryPlayerId: fkTaker.id,
                  isOnTarget: true,
                  commentary: `${defGK?.fullName ?? 'The keeper'} palms away ${fkTaker.fullName}'s curling free kick!`,
                  homeScoreAfter: session.homeScore,
                  awayScoreAfter: session.awayScore,
                });
              }
            } else {
              session.events.push({
                id: `ev_${session.fixtureId}_${session.events.length}`,
                ...getEventClock(session),
                type: 'SHOT',
                clubId: atkTeam.club.id,
                playerId: fkTaker.id,
                isOnTarget: false,
                commentary: `${fkTaker.fullName}'s direct free kick clears the wall and whistles just past the post.`,
                homeScoreAfter: session.homeScore,
                awayScoreAfter: session.awayScore,
              });
            }
          }
        }
      }
    } else {
      // Attacking sequence -> Open-play or Aerial/Cross Chance -> Shot -> Save / Goal / Corner
      const isAerialChance = rng() < 0.22;
      const shooter = pickWeightedPlayer(rng, atkPlayers, (p) => {
        const posBoost =
          p.primaryPosition === 'Striker'
            ? 3.2
            : p.primaryPosition === 'Winger' || p.primaryPosition === 'Attacking Midfielder'
              ? 2.1
              : 0.8;
        const skillMult =
          (hasSkill(p, 'att_positioning') ? 1.15 : 1) *
          (isAerialChance && hasSkill(p, 'heading') ? 1.28 : 1);
        return (p.technicalAttributes.finishing + p.technicalAttributes.shooting) * posBoost * skillMult;
      });

      const assisterPool = atkPlayers.filter((p) => p.id !== shooter?.id);
      const assister = pickWeightedPlayer(
        rng,
        assisterPool,
        (p) =>
          p.technicalAttributes.passing +
          p.mentalAttributes.vision +
          p.technicalAttributes.crossing +
          (hasSkill(p, 'creativity') ? 22 : 0) +
          (hasSkill(p, 'passing') ? 12 : 0)
      );

      if (shooter) {
        const atkEdge = (atkPower.attack - defPower.defense) * 0.008;
        const shooterPosEdge = hasSkill(shooter, 'att_positioning') ? 0.025 : 0;
        const superstarEdge =
          shooter.isSuperstar && (session.minute >= 70 || Math.abs(session.homeScore - session.awayScore) <= 1)
            ? 0.018
            : 0;
        const shotQuality = Math.min(
          0.42,
          Math.max(0.06, 0.14 + atkEdge + shooterPosEdge + (rng() - 0.5) * 0.12)
        );
        atkStats.shots += 1;
        atkStats.expectedGoals = Number((atkStats.expectedGoals + shotQuality).toFixed(2));

        const shootingSkillEdge = hasSkill(shooter, 'shooting') ? 0.055 : 0;
        const headingSkillEdge = isAerialChance && hasSkill(shooter, 'heading') ? 0.065 : 0;
        const techSkillEdge = hasSkill(shooter, 'technique') ? 0.025 : 0;
        const onTargetProb = Math.min(
          0.76,
          Math.max(
            0.28,
            0.44 +
              (shooter.technicalAttributes.shooting - 70) * 0.007 +
              shootingSkillEdge +
              headingSkillEdge +
              techSkillEdge
          )
        );
        const isOnTarget = rng() < onTargetProb;

        if (!isOnTarget) {
          if (rng() < 0.35) {
            atkStats.corners += 1;
            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'CORNER',
              clubId: atkTeam.club.id,
              playerId: shooter.id,
              commentary: `${shooter.fullName}'s ${isAerialChance ? 'header' : 'strike'} is deflected behind for a ${atkTeam.club.shortName} corner.`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
          } else {
            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'SHOT',
              clubId: atkTeam.club.id,
              playerId: shooter.id,
              isOnTarget: false,
              commentary: isAerialChance
                ? `${shooter.fullName} meets a high cross, but heads narrowly wide.`
                : `${shooter.fullName} unleashes a shot from outside the area, but it drifts wide.`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
          }
        } else {
          atkStats.shotsOnTarget += 1;
          const finishEdge =
            (shooter.technicalAttributes.finishing * 0.65 +
              shooter.mentalAttributes.composure * 0.35 -
              defPower.goalkeeping) *
            0.009;
          const gkSavesPenalty =
            (defGK && hasSkill(defGK, 'saves') ? 0.045 : 0) +
            (defGK && hasSkill(defGK, 'reflexes') && shotQuality >= 0.2 ? 0.055 : 0) +
            (defGK && hasSkill(defGK, 'gk_positioning') ? 0.035 : 0) +
            (defGK && hasSkill(defGK, 'anticipation') ? 0.028 : 0) +
            (isAerialChance ? defPower.aerialDefenseEdge : 0);

          const atkFinishBonus =
            (isAerialChance && hasSkill(shooter, 'heading') ? 0.055 : 0) +
            (hasSkill(shooter, 'strength') ? 0.02 : 0) +
            superstarEdge;

          const goalProb = Math.min(
            0.54,
            Math.max(0.14, 0.29 + finishEdge + atkEdge + atkFinishBonus - gkSavesPenalty)
          );

          if (rng() < goalProb) {
            if (homeHasBall) session.homeScore += 1;
            else session.awayScore += 1;

            session.playerGoals[shooter.id] = (session.playerGoals[shooter.id] ?? 0) + 1;
            session.playerImpact[shooter.id] = Math.min(10, (session.playerImpact[shooter.id] ?? 6.5) + 1.3);

            let assistText = '';
            const assistChance = assister && hasSkill(assister, 'creativity') ? 0.85 : 0.78;
            if (assister && rng() < assistChance) {
              session.playerAssists[assister.id] = (session.playerAssists[assister.id] ?? 0) + 1;
              session.playerImpact[assister.id] = Math.min(
                10,
                (session.playerImpact[assister.id] ?? 6.5) + 0.7
              );
              assistText = ` Assisted by ${assister.fullName}.`;
            }

            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'GOAL',
              clubId: atkTeam.club.id,
              playerId: shooter.id,
              secondaryPlayerId: assistText ? assister?.id : undefined,
              isGoal: true,
              isOnTarget: true,
              commentary: isAerialChance
                ? `GOAL! ${shooter.fullName} powers home a towering header for ${atkTeam.club.name}!${assistText}`
                : `GOAL! ${shooter.fullName} finishes clinically for ${atkTeam.club.name}!${assistText}`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
          } else {
            if (defGK) {
              session.playerImpact[defGK.id] = Math.min(9.8, (session.playerImpact[defGK.id] ?? 6.5) + 0.35);
            }
            session.events.push({
              id: `ev_${session.fixtureId}_${session.events.length}`,
              ...getEventClock(session),
              type: 'SAVE',
              clubId: defTeam.club.id,
              playerId: defGK?.id,
              secondaryPlayerId: shooter.id,
              isOnTarget: true,
              commentary: `Fine save by ${defGK?.fullName ?? 'the keeper'} to deny ${shooter.fullName} from close range!`,
              homeScoreAfter: session.homeScore,
              awayScoreAfter: session.awayScore,
            });
            // If save deflected behind, emit real CORNER event so corner stats stay 1:1 with events
            if (rng() < 0.35) {
              atkStats.corners += 1;
              session.events.push({
                id: `ev_${session.fixtureId}_${session.events.length}`,
                ...getEventClock(session),
                type: 'CORNER',
                clubId: atkTeam.club.id,
                playerId: shooter.id,
                commentary: `Tipped around the post for a ${atkTeam.club.shortName} corner.`,
                homeScoreAfter: session.homeScore,
                awayScoreAfter: session.awayScore,
              });
            }
          }
        }
      }
    }
  }

  // Rare injury check (Physique skill reduces personal knock risk by 55%)
  if (rng() < 0.00014 && atkPlayers.length > 0) {
    const hurt = atkPlayers[Math.floor(rng() * atkPlayers.length)];
    const physiqueProtects = hurt && hasSkill(hurt, 'physique') && rng() < 0.55;
    if (hurt && !physiqueProtects && !session.injuredIds.has(hurt.id)) {
      session.injuredIds.add(hurt.id);
      session.events.push({
        id: `ev_${session.fixtureId}_${session.events.length}`,
        ...getEventClock(session),
        type: 'INJURY',
        clubId: atkTeam.club.id,
        playerId: hurt.id,
        commentary: `${hurt.fullName} pulls up with a knock and requires medical attention.`,
        homeScoreAfter: session.homeScore,
        awayScoreAfter: session.awayScore,
      });
    }
  }

  // AI automatic substitutions around 60'-80'
  if (session.minute >= 60 && session.minute <= 82 && session.minute % 6 === 0) {
    if (userSide !== 'home') autoAiSubstitutionIfNeeded(session, 'home');
    if (userSide !== 'away') autoAiSubstitutionIfNeeded(session, 'away');
  }

  // Advance clock & phase transitions
  if (session.phase === 'FIRST_HALF') {
    if (session.minute >= 45 + session.addedTimeHalf1) {
      session.phase = 'HALF_TIME';
      session.events.push({
        id: `ev_${session.fixtureId}_${session.events.length}`,
        minute: 45,
        addedTime: session.addedTimeHalf1,
        type: 'HALF_TIME',
        clubId: session.home.club.id,
        commentary: `Half-time whistle: ${session.home.club.name} ${session.homeScore} - ${session.awayScore} ${session.away.club.name}.`,
        homeScoreAfter: session.homeScore,
        awayScoreAfter: session.awayScore,
      });
    } else {
      session.minute += 1;
    }
  } else if (session.phase === 'SECOND_HALF') {
    if (session.minute >= 90 + session.addedTimeHalf2) {
      session.phase = 'FULL_TIME';
      session.events.push({
        id: `ev_${session.fixtureId}_${session.events.length}`,
        minute: 90,
        addedTime: session.addedTimeHalf2,
        type: 'FULL_TIME',
        clubId: session.home.club.id,
        commentary: `Full-time! Final score: ${session.home.club.name} ${session.homeScore} - ${session.awayScore} ${session.away.club.name}.`,
        homeScoreAfter: session.homeScore,
        awayScoreAfter: session.awayScore,
      });
    } else {
      session.minute += 1;
    }
  }
}

export function finalizeLiveMatchSession(
  session: LiveMatchSession,
  userSide?: 'home' | 'away'
): MatchResult {
  while (session.phase !== 'FULL_TIME') {
    stepLiveMatchMinute(session, userSide);
  }

  const playerRatings: PlayerMatchRating[] = [];

  for (const [playerId, minutes] of Object.entries(session.playerMinutes)) {
    if (minutes <= 0) continue;
    const isHome = Boolean(
      session.home.tactics.slots.some((s) => s.playerId === playerId) ||
        session.home.club.squadIds.includes(playerId)
    );
    const clubId = isHome ? session.home.club.id : session.away.club.id;
    const teamWon = isHome
      ? session.homeScore > session.awayScore
      : session.awayScore > session.homeScore;
    const cleanSheetBonus =
      (isHome && session.awayScore === 0) || (!isHome && session.homeScore === 0) ? 0.35 : 0;
    const winBonus = teamWon ? 0.35 : 0;

    const rawRating = Math.min(
      10,
      Math.max(4.0, Number(((session.playerImpact[playerId] ?? 6.4) + winBonus + cleanSheetBonus).toFixed(1)))
    );

    playerRatings.push({
      playerId,
      clubId,
      rating: rawRating,
      goals: session.playerGoals[playerId] ?? 0,
      assists: session.playerAssists[playerId] ?? 0,
      minutesPlayed: minutes,
      yellowCards: session.playerYellows[playerId] ?? 0,
      redCards: session.playerReds[playerId] ?? 0,
    });
  }

  const motm = [...playerRatings].sort((a, b) => b.rating - a.rating)[0];

  return {
    homeGoals: session.homeScore,
    awayGoals: session.awayScore,
    homeStats: session.homeStats,
    awayStats: session.awayStats,
    events: session.events,
    playerRatings,
    motmPlayerId: motm?.playerId ?? '',
    attendance: session.attendance,
    gateReceipts: session.gateReceipts,
    seed: session.seed,
  };
}

export function simulateMatchQuick(
  fixture: Fixture,
  homeClub: Club,
  awayClub: Club,
  players: Record<string, Player>,
  seed: number,
  homeTactics?: ClubTactics,
  awayTactics?: ClubTactics,
  homeFormScore = 0,
  awayFormScore = 0
): MatchResult {
  const hTac = homeTactics ?? buildDefaultTactics(homeClub, players, '4-3-3');
  const aTac = awayTactics ?? buildDefaultTactics(awayClub, players, '4-2-3-1');
  const session = createLiveMatchSession(
    fixture,
    homeClub,
    awayClub,
    hTac,
    aTac,
    players,
    seed,
    homeFormScore,
    awayFormScore
  );
  return finalizeLiveMatchSession(session);
}
