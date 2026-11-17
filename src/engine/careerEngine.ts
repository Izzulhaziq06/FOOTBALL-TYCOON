import { buildSeasonDatabase } from '../data/database';
import {
  CareerState,
  Club,
  Fixture,
  ManagerObjective,
  ManagerProfile,
  MatchResult,
  MentalAttributes,
  NewsItem,
  PhysicalAttributes,
  Player,
  Position,
  SeasonId,
  TechnicalAttributes,
} from '../types';
import {
  advanceKnockoutBracketIfReady,
  calculateLeagueStandings,
  generateInitialKnockoutFixtures,
  generateLeagueFixtures,
} from './competitionEngine';
import { calculateClubWeeklyWageBill } from './financeEngine';
import { simulateMatchQuick } from './matchEngine';
import { runMatchdayTrainingAndRecovery } from './progressionEngine';
import {
  calculateOverallRating,
  estimateMarketValue,
  estimateWeeklyWage,
} from './ratings';
import {
  applyTokenRewardClaims,
  checkSuperstarUnlockEligibility,
  getEligibleDevelopedSkills,
  getNaturalSkillForPlayer,
  rollDeterministicSkill,
  SKILL_MAP,
  SkillId,
} from './skills';
import { buildDefaultTactics } from './tacticsEngine';

export interface CreateCareerParams {
  seasonId: SeasonId;
  clubId: string;
  managerName: string;
  managerNationality: string;
  philosophy: ManagerProfile['philosophy'];
  saveName?: string;
}

export function buildObjectivesForClub(club: Club): ManagerObjective[] {
  const targetFinish =
    club.reputation >= 88
      ? 'Top 2 / Title Challenge'
      : club.reputation >= 81
        ? 'Top 4 Continental Qualification'
        : 'Top 6 League Finish';

  return [
    {
      id: 'obj_league',
      title: 'League Target',
      targetDescription: targetFinish,
      progressText: 'Season starting',
      status: 'on_track',
    },
    {
      id: 'obj_finance',
      title: 'Financial Discipline',
      targetDescription: 'Maintain positive club balance',
      progressText: `Balance €${(club.balance / 1_000_000).toFixed(1)}M`,
      status: 'on_track',
    },
    {
      id: 'obj_squad',
      title: 'Squad Development',
      targetDescription: 'Develop first-team youth & sustain fitness',
      progressText: 'Training active',
      status: 'on_track',
    },
  ];
}

export function createNewCareer(params: CreateCareerParams): CareerState {
  const bundle = buildSeasonDatabase(params.seasonId);
  const userClub = bundle.clubs[params.clubId];
  if (!userClub) {
    throw new Error(`Club "${params.clubId}" not found in season ${params.seasonId}`);
  }

  const fixtures: Fixture[] = [];
  for (const comp of Object.values(bundle.competitions)) {
    if (comp.competitionFormat === 'league') {
      fixtures.push(...generateLeagueFixtures(comp, bundle.startDate));
    } else {
      fixtures.push(...generateInitialKnockoutFixtures(comp, bundle.startDate));
    }
  }

  const userLeague = bundle.competitions[userClub.leagueId];
  const tactics = buildDefaultTactics(userClub, bundle.players, '4-3-3');
  const nowIso = new Date().toISOString();
  const careerId = `career_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const uclIncluded = bundle.competitions.ucl?.clubIds.includes(userClub.id);
  const uelIncluded = bundle.competitions.uel?.clubIds.includes(userClub.id);
  const continentalNote = uclIncluded
    ? 'Competing in UEFA Champions League.'
    : uelIncluded
      ? 'Competing in UEFA Europa League.'
      : 'Focusing on domestic league campaign.';

  return {
    id: careerId,
    saveName: params.saveName?.trim() || `${userClub.name} (${params.seasonId})`,
    saveVersion: '1.1.0',
    createdAt: nowIso,
    lastPlayedAt: nowIso,
    startingHistoricalSeason: params.seasonId,
    currentSeason: params.seasonId,
    isGeneratedSeason: false,
    currentMatchday: 1,
    totalMatchdays: userLeague.totalMatchdays,
    currentDate: bundle.startDate,
    transferWindowOpen: true,
    transferWindowLabel: 'Summer',
    userClubId: userClub.id,
    userLeagueId: userClub.leagueId,
    manager: {
      name: params.managerName.trim() || 'Alex Mercer',
      nationality: params.managerNationality.trim() || 'England',
      philosophy: params.philosophy,
      reputation: Math.max(60, userClub.reputation - 8),
      matchesManaged: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      trophiesWon: 0,
    },
    tactics,
    trainingFocus: 'Balanced',
    clubs: bundle.clubs,
    players: bundle.players,
    competitions: bundle.competitions,
    fixtures,
    transfers: bundle.historicalTransfers,
    transactions: [
      {
        id: 'tx_init_budget',
        date: bundle.startDate,
        matchday: 0,
        category: 'Sponsor & Broadcast',
        description: `Opening ${params.seasonId} season operating balance`,
        amount: userClub.balance,
        balanceAfter: userClub.balance,
      },
    ],
    news: [
      {
        id: 'news_welcome',
        date: bundle.startDate,
        matchday: 1,
        category: 'Board',
        headline: `${params.managerName} appointed manager of ${userClub.name}`,
        summary: `The board welcomes ${params.managerName} for the ${params.seasonId} campaign. ${continentalNote}`,
        clubId: userClub.id,
      },
    ],
    trainingReports: [],
    objectives: buildObjectivesForClub(userClub),
    seasonHistory: [],
    universalSkillTokens: 3,
    claimedSkillTokenRewards: [],
    skillRollCount: 0,
    seedCounter: 1001,
  };
}

export function getNextUserFixture(state: CareerState): Fixture | undefined {
  return state.fixtures.find(
    (f) =>
      f.seasonId === state.currentSeason &&
      f.matchday === state.currentMatchday &&
      f.status === 'scheduled' &&
      (f.homeClubId === state.userClubId || f.awayClubId === state.userClubId)
  );
}

function applyResultToPlayers(
  players: Record<string, Player>,
  result: MatchResult,
  homeClubId: string,
  awayClubId: string,
  seedOffset: number
): { nextPlayers: Record<string, Player>; injuredNames: string[] } {
  const nextPlayers = { ...players };
  const injuredNames: string[] = [];

  for (const pr of result.playerRatings) {
    const p = nextPlayers[pr.playerId];
    if (!p) continue;

    const isCleanSheet =
      (pr.clubId === homeClubId && result.awayGoals === 0) ||
      (pr.clubId === awayClubId && result.homeGoals === 0);
    const isMotm = result.motmPlayerId === p.id;

    const prevApps = p.seasonStats.appearances;
    const newApps = prevApps + 1;
    const newAvg = Number(
      ((p.seasonStats.averageRating * prevApps + pr.rating) / newApps).toFixed(2)
    );

    const careerApps = p.careerStats.appearances + 1;
    const careerAvg = Number(
      ((p.careerStats.averageRating * p.careerStats.appearances + pr.rating) / careerApps).toFixed(2)
    );

    const fitnessLoss = Math.min(24, Math.round((pr.minutesPlayed / 90) * 16));
    const isInjured = result.events.some(
      (e) => e.type === 'INJURY' && e.playerId === p.id
    );
    const injuryWeeks = isInjured ? 1 + (seedOffset % 3) : p.injuryWeeks;
    if (isInjured) injuredNames.push(p.fullName);

    const teamGoalsFor = pr.clubId === homeClubId ? result.homeGoals : result.awayGoals;
    const teamGoalsAgainst = pr.clubId === homeClubId ? result.awayGoals : result.homeGoals;
    const moraleDelta = teamGoalsFor > teamGoalsAgainst ? 2 : teamGoalsFor < teamGoalsAgainst ? -2 : 0;

    nextPlayers[p.id] = {
      ...p,
      fitness: Math.max(48, p.fitness - fitnessLoss),
      morale: Math.max(40, Math.min(99, p.morale + moraleDelta)),
      injuryWeeks,
      injuryDescription: isInjured ? 'Muscular strain' : p.injuryDescription,
      recentForm: [...p.recentForm, pr.rating].slice(-5),
      seasonStats: {
        appearances: newApps,
        minutesPlayed: p.seasonStats.minutesPlayed + pr.minutesPlayed,
        goals: p.seasonStats.goals + pr.goals,
        assists: p.seasonStats.assists + pr.assists,
        cleanSheets:
          p.seasonStats.cleanSheets +
          (isCleanSheet && (p.primaryPosition === 'Goalkeeper' || p.primaryPosition === 'Centre Back')
            ? 1
            : 0),
        yellowCards: p.seasonStats.yellowCards + pr.yellowCards,
        redCards: p.seasonStats.redCards + pr.redCards,
        motmAwards: p.seasonStats.motmAwards + (isMotm ? 1 : 0),
        averageRating: newAvg,
      },
      careerStats: {
        appearances: careerApps,
        minutesPlayed: p.careerStats.minutesPlayed + pr.minutesPlayed,
        goals: p.careerStats.goals + pr.goals,
        assists: p.careerStats.assists + pr.assists,
        cleanSheets:
          p.careerStats.cleanSheets +
          (isCleanSheet && (p.primaryPosition === 'Goalkeeper' || p.primaryPosition === 'Centre Back')
            ? 1
            : 0),
        yellowCards: p.careerStats.yellowCards + pr.yellowCards,
        redCards: p.careerStats.redCards + pr.redCards,
        motmAwards: p.careerStats.motmAwards + (isMotm ? 1 : 0),
        averageRating: careerAvg,
      },
    };
  }

  return { nextPlayers, injuredNames };
}

export function advanceMatchday(
  state: CareerState,
  precomputedUserResults?: Record<string, MatchResult>
): CareerState {
  const md = state.currentMatchday;
  if (md > state.totalMatchdays) return state;

  let nextSeed = state.seedCounter + 1;
  let nextPlayers = { ...state.players };
  const nextClubs = { ...state.clubs };
  const nextFixtures = [...state.fixtures];
  const nextTransactions = [...state.transactions];
  const newNews: NewsItem[] = [];
  let nextManager = { ...state.manager };
  const rewardCandidates: Array<{ id: string; amount: number }> = [];
  const existingClaims = new Set(state.claimedSkillTokenRewards ?? []);

  const mdFixtures = nextFixtures.filter(
    (f) => f.seasonId === state.currentSeason && f.matchday === md && f.status === 'scheduled'
  );

  for (const fix of mdFixtures) {
    const idx = nextFixtures.findIndex((f) => f.id === fix.id);
    const homeClub = nextClubs[fix.homeClubId];
    const awayClub = nextClubs[fix.awayClubId];
    if (!homeClub || !awayClub) continue;

    const isUserHome = fix.homeClubId === state.userClubId;
    const isUserAway = fix.awayClubId === state.userClubId;

    let result = precomputedUserResults?.[fix.id];
    if (!result) {
      result = simulateMatchQuick(
        fix,
        homeClub,
        awayClub,
        nextPlayers,
        nextSeed++,
        isUserHome ? state.tactics : undefined,
        isUserAway ? state.tactics : undefined
      );
    }

    nextFixtures[idx] = {
      ...fix,
      status: 'completed',
      result,
    };

    const applied = applyResultToPlayers(
      nextPlayers,
      result,
      homeClub.id,
      awayClub.id,
      nextSeed
    );
    nextPlayers = applied.nextPlayers;

    // Gate receipts for home club
    nextClubs[homeClub.id] = {
      ...nextClubs[homeClub.id],
      balance: nextClubs[homeClub.id].balance + result.gateReceipts,
    };

    if (isUserHome || isUserAway) {
      const userGoals = isUserHome ? result.homeGoals : result.awayGoals;
      const oppGoals = isUserHome ? result.awayGoals : result.homeGoals;
      const won = userGoals > oppGoals;
      const drew = userGoals === oppGoals;

      nextManager = {
        ...nextManager,
        matchesManaged: nextManager.matchesManaged + 1,
        wins: nextManager.wins + (won ? 1 : 0),
        draws: nextManager.draws + (drew ? 1 : 0),
        losses: nextManager.losses + (!won && !drew ? 1 : 0),
      };

      if (isUserHome) {
        nextTransactions.unshift({
          id: `tx_gate_${fix.id}`,
          date: fix.date,
          matchday: md,
          category: 'Matchday Gate',
          description: `Gate receipts vs ${awayClub.name} (${result.attendance.toLocaleString()} fans)`,
          amount: result.gateReceipts,
          balanceAfter: nextClubs[homeClub.id].balance,
        });
      }

      if (applied.injuredNames.length > 0) {
        newNews.push({
          id: `news_inj_${fix.id}`,
          date: fix.date,
          matchday: md,
          category: 'Injury',
          headline: `Injury setback after ${homeClub.shortName} vs ${awayClub.shortName}`,
          summary: `${applied.injuredNames.join(', ')} picked up a knock during Matchday ${md}.`,
          clubId: state.userClubId,
        });
      }

      for (const m of [10, 25, 50, 100]) {
        if (nextManager.matchesManaged >= m) {
          const claimId = `milestone_matches:${m}`;
          rewardCandidates.push({ id: claimId, amount: 1 });
          if (state.manager.matchesManaged < m && !existingClaims.has(claimId)) {
            newNews.push({
              id: `news_mile_${m}`,
              date: fix.date,
              matchday: md,
              category: 'Board',
              headline: `${nextManager.name} reaches ${m} matches in charge`,
              summary: `Record stands at ${nextManager.wins}W-${nextManager.draws}D-${nextManager.losses}L (+1 Universal Skill Token earned).`,
              clubId: state.userClubId,
            });
          }
        }
      }

      for (let w = 5; w <= nextManager.wins; w += 5) {
        rewardCandidates.push({ id: `win_threshold:${w}`, amount: 1 });
      }
    }
  }

  // Weekly wages + broadcast revenue for user club
  const userClub = nextClubs[state.userClubId];
  const wageBill = calculateClubWeeklyWageBill(userClub, nextPlayers);
  const broadcastIncome = Math.round(userClub.reputation * 16500);
  const balanceAfterWages = userClub.balance - wageBill + broadcastIncome;

  nextClubs[userClub.id] = {
    ...userClub,
    balance: balanceAfterWages,
  };

  nextTransactions.unshift(
    {
      id: `tx_wage_${state.currentSeason}_md${md}`,
      date: state.currentDate,
      matchday: md,
      category: 'Weekly Wages',
      description: `First-team weekly payroll (${userClub.squadIds.length} players)`,
      amount: -wageBill,
      balanceAfter: userClub.balance - wageBill,
    },
    {
      id: `tx_tv_${state.currentSeason}_md${md}`,
      date: state.currentDate,
      matchday: md,
      category: 'Sponsor & Broadcast',
      description: `Matchday ${md} broadcast & commercial distribution`,
      amount: broadcastIncome,
      balanceAfter: balanceAfterWages,
    }
  );

  // Advance knockout brackets for UCL and UEL
  const nextComps = { ...state.competitions };
  const seasonStartDate =
    state.fixtures.find((f) => f.seasonId === state.currentSeason && f.matchday === 1)?.date ??
    state.currentDate;
  for (const compId of ['ucl', 'uel']) {
    const comp = nextComps[compId];
    if (!comp) continue;
    const ko = advanceKnockoutBracketIfReady(comp, nextFixtures, seasonStartDate);
    if (ko.newFixtures.length > 0) {
      nextFixtures.push(...ko.newFixtures);
    }
    if (ko.winnerClubId && !comp.winnerClubId) {
      nextComps[compId] = { ...comp, winnerClubId: ko.winnerClubId };
      const compClaimId = `comp_win:${compId}:${state.currentSeason}`;
      const isUserWinner = ko.winnerClubId === state.userClubId;
      const grantsTokens = isUserWinner && !existingClaims.has(compClaimId);
      if (isUserWinner) {
        rewardCandidates.push({ id: compClaimId, amount: 2 });
      }
      const winNewsId = `news_win_${compId}_${state.currentSeason}`;
      if (!state.news.some((n) => n.id === winNewsId) && !newNews.some((n) => n.id === winNewsId)) {
        newNews.push({
          id: winNewsId,
          date: state.currentDate,
          matchday: md,
          category: 'Competition',
          headline: `${nextClubs[ko.winnerClubId]?.name} lift the ${comp.name}!`,
          summary: `A memorable continental triumph concludes the ${state.currentSeason} ${comp.name}.${grantsTokens ? ' (+2 Universal Skill Tokens earned)' : ''}`,
          clubId: ko.winnerClubId,
        });
      }
    }
  }

  // Check league standings for streak & position news
  const userLeague = nextComps[state.userLeagueId];
  const standings = calculateLeagueStandings(userLeague, nextFixtures, nextClubs);
  const userPos = standings.findIndex((r) => r.clubId === userClub.id) + 1;
  const userRow = standings[userPos - 1];

  if (userRow && userRow.form.length >= 3) {
    const last3 = userRow.form.slice(-3).join('');
    if (last3 === 'WWW') {
      newNews.push({
        id: `news_streak_w_${state.currentSeason}_${md}`,
        date: state.currentDate,
        matchday: md,
        category: 'Match',
        headline: `${userClub.name} extend winning run to three matches`,
        summary: `Strong form moves ${userClub.name} to ${userPos}${userPos === 1 ? 'st' : userPos === 2 ? 'nd' : userPos === 3 ? 'rd' : 'th'} in the ${userLeague.shortName}.`,
        clubId: userClub.id,
      });
    } else if (last3 === 'LLL') {
      newNews.push({
        id: `news_streak_l_${state.currentSeason}_${md}`,
        date: fixDatePlus7(state.currentDate),
        matchday: md,
        category: 'Match',
        headline: `Pressure mounts on ${userClub.name} after three straight defeats`,
        summary: `Supporters expect a tactical response ahead of Matchday ${md + 1}.`,
        clubId: userClub.id,
      });
    }
  }

  // Advance date & transfer window state
  const nextMd = md + 1;
  const nextDate = fixDatePlus7(state.currentDate);
  const isSummer = nextMd <= 3;
  const isWinter = nextMd >= 10 && nextMd <= 12;

  // Update board objectives
  const updatedObjectives: ManagerObjective[] = state.objectives.map((obj) => {
    if (obj.id === 'obj_league') {
      const targetMax = userClub.reputation >= 88 ? 2 : userClub.reputation >= 81 ? 4 : 6;
      return {
        ...obj,
        progressText: `Currently ${userPos}${userPos === 1 ? 'st' : userPos === 2 ? 'nd' : userPos === 3 ? 'rd' : 'th'} (${userRow?.points ?? 0} pts)`,
        status: userPos <= targetMax ? 'on_track' : 'at_risk',
      };
    }
    if (obj.id === 'obj_finance') {
      return {
        ...obj,
        progressText: `Balance €${(balanceAfterWages / 1_000_000).toFixed(1)}M`,
        status: balanceAfterWages >= 0 ? 'on_track' : 'at_risk',
      };
    }
    return obj;
  });

  // Update competition currentMatchday
  for (const comp of Object.values(nextComps)) {
    nextComps[comp.id] = {
      ...comp,
      currentMatchday: Math.min(comp.totalMatchdays, nextMd),
    };
  }

  const tokenRes = applyTokenRewardClaims(
    state.universalSkillTokens ?? 0,
    state.claimedSkillTokenRewards,
    rewardCandidates
  );

  let updatedState: CareerState = {
    ...state,
    currentMatchday: nextMd,
    currentDate: nextDate,
    transferWindowOpen: isSummer || isWinter,
    transferWindowLabel: isSummer ? 'Summer' : isWinter ? 'Winter' : 'Closed',
    clubs: nextClubs,
    players: nextPlayers,
    competitions: nextComps,
    fixtures: nextFixtures,
    transactions: nextTransactions.slice(0, 120),
    news: Array.from(
      new Map([...newNews, ...state.news].map((n) => [n.id, n])).values()
    ).slice(0, 60),
    manager: nextManager,
    objectives: updatedObjectives,
    universalSkillTokens: tokenRes.nextTokens,
    claimedSkillTokenRewards: tokenRes.nextClaims,
    seedCounter: nextSeed,
    lastPlayedAt: new Date().toISOString(),
  };

  updatedState = runMatchdayTrainingAndRecovery(updatedState);
  return updatedState;
}

function fixDatePlus7(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + 7);
  return dt.toISOString().slice(0, 10);
}

export function unlockOrRerollSkill2(
  state: CareerState,
  playerId: string
): {
  ok: boolean;
  error?: string;
  rolledSkill?: SkillId;
  previousSkill?: SkillId | null;
  nextState: CareerState;
} {
  const player = state.players[playerId];
  if (!player) {
    return { ok: false, error: 'Player not found.', nextState: state };
  }
  if (player.clubId !== state.userClubId) {
    return {
      ok: false,
      error: 'Only players at your managed club can develop playstyle skills.',
      nextState: state,
    };
  }
  const availableTokens = state.universalSkillTokens ?? 0;
  if (availableTokens < 1) {
    return {
      ok: false,
      error: 'Insufficient Universal Skill Tokens (1 token required).',
      nextState: state,
    };
  }

  const eligible = getEligibleDevelopedSkills(
    player.primaryPosition,
    player.skill1,
    player.skill2
  );
  if (eligible.length === 0) {
    return {
      ok: false,
      error: 'No eligible Developed Skills remain for this player position.',
      nextState: state,
    };
  }

  const rollIndex = state.skillRollCount ?? 0;
  const salt = `${playerId}:${rollIndex}:${player.skill2 ?? 'locked'}`;
  const rolled = rollDeterministicSkill(eligible, state.seedCounter, salt);
  const previousSkill = player.skill2;

  return {
    ok: true,
    rolledSkill: rolled.id,
    previousSkill,
    nextState: {
      ...state,
      universalSkillTokens: availableTokens - 1,
      skillRollCount: rollIndex + 1,
      seedCounter: state.seedCounter + 1,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          skill2: rolled.id,
        },
      },
      news: [
        {
          id: `news_skill_${state.currentSeason}_${state.currentMatchday}_${playerId}_${rollIndex}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Development' as const,
          headline:
            previousSkill === null
              ? `${player.fullName} unlocks ${rolled.name} Developed Skill`
              : `${player.fullName} adapts Developed Skill to ${rolled.name}`,
          summary:
            previousSkill === null
              ? `${player.fullName} unlocked ${rolled.name} (${rolled.category}) using 1 Universal Skill Token.`
              : `${player.fullName} replaced ${SKILL_MAP[previousSkill]?.name ?? previousSkill} with ${rolled.name} (${rolled.category}) via 1 Universal Skill Token.`,
          clubId: state.userClubId,
          playerId,
        },
        ...state.news,
      ].slice(0, 60),
      lastPlayedAt: new Date().toISOString(),
    },
  };
}

export function unlockPlayerSuperstar(
  state: CareerState,
  playerId: string
): { ok: boolean; error?: string; nextState: CareerState } {
  const player = state.players[playerId];
  const club = state.clubs[state.userClubId];
  if (!player || !club || player.clubId !== club.id) {
    return { ok: false, error: 'Player does not belong to your club.', nextState: state };
  }
  const eligibility = checkSuperstarUnlockEligibility(player, club);
  if (!eligibility.eligible) {
    return { ok: false, error: eligibility.reason, nextState: state };
  }

  const nextBalance = club.balance - eligibility.developmentCost;
  const updatedClub: Club = {
    ...club,
    balance: nextBalance,
  };
  const updatedPlayer: Player = {
    ...player,
    isSuperstar: true,
    superstarUnlockedReason: `Elevated via Tier ${Math.max(club.facilities.trainingGround, club.facilities.youthAcademy)} Club Development Programme (${state.currentSeason})`,
  };

  const tokenRes = applyTokenRewardClaims(
    state.universalSkillTokens ?? 0,
    state.claimedSkillTokenRewards,
    [{ id: `superstar_elev:${playerId}`, amount: 1 }]
  );

  return {
    ok: true,
    nextState: {
      ...state,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      players: { ...state.players, [playerId]: updatedPlayer },
      universalSkillTokens: tokenRes.nextTokens,
      claimedSkillTokenRewards: tokenRes.nextClaims,
      transactions: [
        {
          id: `tx_ss_${Date.now()}_${playerId}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Facility Upgrade',
          description: `Superstar elevation programme for ${player.fullName}`,
          amount: -eligibility.developmentCost,
          balanceAfter: nextBalance,
        },
        ...state.transactions,
      ],
      news: [
        {
          id: `news_ss_${Date.now()}_${playerId}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Development' as const,
          headline: `${player.fullName} earns Superstar recognition at ${club.name}`,
          summary: `Following standout development and club investment, ${player.fullName} joins ${club.name}'s marquee Superstar tier${tokenRes.grantedAmount > 0 ? ' (+1 Universal Skill Token earned)' : ''}.`,
          clubId: club.id,
          playerId,
        },
        ...state.news,
      ].slice(0, 60),
      lastPlayedAt: new Date().toISOString(),
    },
  };
}

export interface CreateAcademyPlayerInput {
  fullName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPositions: Position[];
  preferredFoot: 'Right' | 'Left' | 'Both';
  technicalAttributes: TechnicalAttributes;
  physicalAttributes: PhysicalAttributes;
  mentalAttributes: MentalAttributes;
  skill1?: SkillId | null;
  skill2?: SkillId | null;
  grantSuperstar?: boolean;
}

export function getAcademyAttributeCap(youthAcademyTier: number): number {
  return Math.min(89, 64 + youthAcademyTier * 5);
}

export function createAcademyPlayer(
  state: CareerState,
  input: CreateAcademyPlayerInput
): { ok: boolean; error?: string; player?: Player; tokensEarned?: number; nextState: CareerState } {
  const club = state.clubs[state.userClubId];
  if (!club) {
    return { ok: false, error: 'Managed club not found.', nextState: state };
  }

  const trimmedName = input.fullName.trim();
  if (trimmedName.length < 2) {
    return { ok: false, error: 'Player name must be at least 2 characters.', nextState: state };
  }
  const age = Math.round(input.age);
  if (age < 16 || age > 23) {
    return { ok: false, error: 'Academy graduates must be aged between 16 and 23.', nextState: state };
  }

  const naturalSkill = getNaturalSkillForPlayer(
    input.primaryPosition,
    `acad:${club.id}:${trimmedName}:${state.seedCounter}`
  );

  const academyTier = club.facilities.youthAcademy;
  const maxAttr = getAcademyAttributeCap(academyTier);
  const clampAcademy = (v: number) => Math.max(40, Math.min(maxAttr, Math.round(v)));

  const tech: TechnicalAttributes = {
    passing: clampAcademy(input.technicalAttributes.passing),
    shooting: clampAcademy(input.technicalAttributes.shooting),
    finishing: clampAcademy(input.technicalAttributes.finishing),
    dribbling: clampAcademy(input.technicalAttributes.dribbling),
    crossing: clampAcademy(input.technicalAttributes.crossing),
    tackling: clampAcademy(input.technicalAttributes.tackling),
    ballControl: clampAcademy(input.technicalAttributes.ballControl),
    heading: clampAcademy(input.technicalAttributes.heading),
    goalkeeping:
      input.primaryPosition === 'Goalkeeper'
        ? clampAcademy(input.technicalAttributes.goalkeeping ?? 68)
        : 20,
  };
  const phys: PhysicalAttributes = {
    pace: clampAcademy(input.physicalAttributes.pace),
    acceleration: clampAcademy(input.physicalAttributes.acceleration),
    stamina: clampAcademy(input.physicalAttributes.stamina),
    strength: clampAcademy(input.physicalAttributes.strength),
    agility: clampAcademy(input.physicalAttributes.agility),
    jumping: clampAcademy(input.physicalAttributes.jumping),
  };
  const ment: MentalAttributes = {
    vision: clampAcademy(input.mentalAttributes.vision),
    positioning: clampAcademy(input.mentalAttributes.positioning),
    decisions: clampAcademy(input.mentalAttributes.decisions),
    composure: clampAcademy(input.mentalAttributes.composure),
    leadership: clampAcademy(input.mentalAttributes.leadership),
    workRate: clampAcademy(input.mentalAttributes.workRate),
  };

  const overallRating = calculateOverallRating(input.primaryPosition, tech, phys, ment);
  const potential = Math.min(93, Math.max(overallRating + 4, 74 + academyTier * 3));

  const superstarCost = input.grantSuperstar ? 2_500_000 : 0;
  if (input.grantSuperstar) {
    if (academyTier < 3) {
      return {
        ok: false,
        error: 'Superstar academy elevation requires Youth Academy Tier 3+.',
        nextState: state,
      };
    }
    if (overallRating < 74) {
      return {
        ok: false,
        error: 'Academy graduate must reach at least 74 OVR to earn Superstar designation.',
        nextState: state,
      };
    }
    if (club.balance < superstarCost) {
      return {
        ok: false,
        error: 'Insufficient club balance (€2.5M development programme required for Superstar status).',
        nextState: state,
      };
    }
  }

  const startYr = parseInt(state.currentSeason.slice(0, 4), 10) || 2015;
  const birthYear = startYr - age;
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  let playerId = `acad_${club.id}_${slug || 'player'}`;
  let suffix = 1;
  while (state.players[playerId]) {
    suffix += 1;
    playerId = `acad_${club.id}_${slug || 'player'}_${suffix}`;
  }

  const newPlayer: Player = {
    id: playerId,
    fullName: trimmedName,
    nationality: input.nationality.trim() || club.country,
    dateOfBirth: `${birthYear}-05-15`,
    ageBySeason: { [state.currentSeason]: age },
    age,
    primaryPosition: input.primaryPosition,
    secondaryPositions: input.secondaryPositions.filter((pos) => pos !== input.primaryPosition),
    overallRating,
    potential,
    technicalAttributes: tech,
    physicalAttributes: phys,
    mentalAttributes: ment,
    marketValue: estimateMarketValue(overallRating, age, potential),
    weeklyWage: estimateWeeklyWage(overallRating, club.reputation),
    contractExpiry: startYr + 4,
    preferredFoot: input.preferredFoot,
    clubId: club.id,
    seasonId: state.currentSeason,
    fitness: 96,
    morale: 86,
    injuryWeeks: 0,
    recentForm: [],
    seasonStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    careerStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    developmentHistory: [
      {
        seasonId: state.currentSeason,
        matchday: state.currentMatchday,
        overall: overallRating,
        focus: state.trainingFocus,
        note: 'Promoted from Youth Academy',
      },
    ],
    isHistoricalRecord: false,
    ratingSource: 'gameplay_estimated',
    loanedFromClubId: null,
    skill1: naturalSkill,
    skill2: null,
    isSuperstar: Boolean(input.grantSuperstar),
    superstarUnlockedReason: input.grantSuperstar
      ? `Academy Tier ${academyTier} Superstar Promotion (${state.currentSeason})`
      : undefined,
    isCustomAcademyPlayer: true,
  };

  const nextBalance = club.balance - superstarCost;
  const updatedClub: Club = {
    ...club,
    balance: nextBalance,
    squadIds: [...club.squadIds, newPlayer.id].sort((a, b) => {
      const pa = a === newPlayer.id ? newPlayer : state.players[a];
      const pb = b === newPlayer.id ? newPlayer : state.players[b];
      return (pb?.overallRating ?? 0) - (pa?.overallRating ?? 0);
    }),
  };

  const nextTransactions =
    superstarCost > 0
      ? [
          {
            id: `tx_acad_${Date.now()}_${newPlayer.id}`,
            date: state.currentDate,
            matchday: state.currentMatchday,
            category: 'Facility Upgrade' as const,
            description: `Academy Superstar graduate investment (${newPlayer.fullName})`,
            amount: -superstarCost,
            balanceAfter: nextBalance,
          },
          ...state.transactions,
        ]
      : state.transactions;

  const seasonAcadPrefix = `acad_season:${state.currentSeason}:`;
  const existingSeasonAcadCount = (state.claimedSkillTokenRewards ?? []).filter((id) =>
    id.startsWith(seasonAcadPrefix)
  ).length;
  const academyCandidates: Array<{ id: string; amount: number }> = [];
  if (existingSeasonAcadCount < 3) {
    academyCandidates.push({
      id: `${seasonAcadPrefix}${existingSeasonAcadCount + 1}`,
      amount: 1,
    });
  }
  const tokenRes = applyTokenRewardClaims(
    state.universalSkillTokens ?? 0,
    state.claimedSkillTokenRewards,
    academyCandidates
  );
  const playerClaimId = `acad_promo:${newPlayer.id}`;
  const nextClaims = tokenRes.nextClaims.includes(playerClaimId)
    ? tokenRes.nextClaims
    : [...tokenRes.nextClaims, playerClaimId];

  return {
    ok: true,
    player: newPlayer,
    tokensEarned: tokenRes.grantedAmount,
    nextState: {
      ...state,
      universalSkillTokens: tokenRes.nextTokens,
      claimedSkillTokenRewards: nextClaims,
      seedCounter: state.seedCounter + 1,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      players: { ...state.players, [newPlayer.id]: newPlayer },
      transactions: nextTransactions,
      news: [
        {
          id: `news_acad_${Date.now()}_${newPlayer.id}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Development' as const,
          headline: `${newPlayer.fullName} promoted from ${club.name} Academy`,
          summary: `${age}-year-old ${input.primaryPosition} (${overallRating} OVR / ${potential} POT) joins with Natural Skill ${SKILL_MAP[naturalSkill].name}${tokenRes.grantedAmount > 0 ? ' (+1 Universal Skill Token earned)' : ' (seasonal Academy token limit reached)'}.`,
          clubId: club.id,
          playerId: newPlayer.id,
        },
        ...state.news,
      ].slice(0, 60),
      lastPlayedAt: new Date().toISOString(),
    },
  };
}
