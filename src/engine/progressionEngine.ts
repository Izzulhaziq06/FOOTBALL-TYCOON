import {
  CareerState,
  Club,
  Competition,
  Fixture,
  NewsItem,
  Player,
  SeasonArchive,
  TrainingFocus,
  TrainingReport,
} from '../types';
import {
  calculateLeagueStandings,
  generateInitialKnockoutFixtures,
  generateLeagueFixtures,
  getCompetitionStatLeaders,
} from './competitionEngine';
import { calculateOverallRating, estimateMarketValue } from './ratings';
import { applyTokenRewardClaims } from './skills';
import { buildBestLineupForFormation } from './tacticsEngine';

function bumpAttr(val: number, delta: number): number {
  return Math.max(30, Math.min(99, val + delta));
}

export function runMatchdayTrainingAndRecovery(state: CareerState): CareerState {
  const userClub = state.clubs[state.userClubId];
  const trainingTier = userClub?.facilities.trainingGround ?? 2;
  const medicalTier = userClub?.facilities.medicalCenter ?? 2;
  const focus: TrainingFocus = state.trainingFocus;

  const nextPlayers: Record<string, Player> = { ...state.players };
  const improvedPlayers: TrainingReport['improvedPlayers'] = [];
  const newNews: NewsItem[] = [];

  for (const player of Object.values(state.players)) {
    let updated = { ...player };

    // Injury recovery
    if (updated.injuryWeeks > 0) {
      const recoveryStep = updated.clubId === state.userClubId && medicalTier >= 4 ? 2 : 1;
      const nextWeeks = Math.max(0, updated.injuryWeeks - recoveryStep);
      updated.injuryWeeks = nextWeeks;
      if (nextWeeks === 0) {
        updated.injuryDescription = undefined;
        updated.fitness = Math.max(updated.fitness, 82);
        if (updated.clubId === state.userClubId) {
          newNews.push({
            id: `news_rec_${state.currentSeason}_${state.currentMatchday}_${updated.id}`,
            date: state.currentDate,
            matchday: state.currentMatchday,
            category: 'Injury',
            headline: `${updated.fullName} returns to full training`,
            summary: `Medical staff have cleared ${updated.fullName} following recovery.`,
            clubId: updated.clubId,
            playerId: updated.id,
          });
        }
      }
    } else {
      // Natural weekly fitness recovery
      const recoveryBoost =
        updated.clubId === state.userClubId ? 7 + medicalTier * 2 : 9;
      updated.fitness = Math.min(100, updated.fitness + recoveryBoost);
    }

    // Gradual training progression for user club (and light growth for AI youth)
    const isUserPlayer = updated.clubId === state.userClubId;
    const growthChance = isUserPlayer
      ? (updated.age <= 23 ? 0.42 : updated.age <= 27 ? 0.18 : 0.05) * (0.85 + trainingTier * 0.12)
      : updated.age <= 22
        ? 0.15
        : 0.03;

    const hash =
      (state.currentMatchday * 31 + updated.id.length * 17 + updated.age * 13) % 100;

    if (
      updated.injuryWeeks === 0 &&
      updated.overallRating < updated.potential &&
      hash < growthChance * 100
    ) {
      const oldOvr = updated.overallRating;
      const tech = { ...updated.technicalAttributes };
      const phys = { ...updated.physicalAttributes };
      const ment = { ...updated.mentalAttributes };

      let trainedAttr = 'Decisions';
      const activeFocus: TrainingFocus = isUserPlayer ? focus : 'Balanced';

      if (activeFocus === 'Attacking') {
        tech.finishing = bumpAttr(tech.finishing, 1);
        tech.shooting = bumpAttr(tech.shooting, 1);
        trainedAttr = 'Finishing & Shooting';
      } else if (activeFocus === 'Defensive') {
        tech.tackling = bumpAttr(tech.tackling, 1);
        ment.positioning = bumpAttr(ment.positioning, 1);
        trainedAttr = 'Tackling & Positioning';
      } else if (activeFocus === 'Physical') {
        phys.stamina = bumpAttr(phys.stamina, 1);
        phys.pace = bumpAttr(phys.pace, 1);
        trainedAttr = 'Pace & Stamina';
      } else if (activeFocus === 'Technical') {
        tech.passing = bumpAttr(tech.passing, 1);
        tech.ballControl = bumpAttr(tech.ballControl, 1);
        trainedAttr = 'Passing & Ball Control';
      } else {
        tech.passing = bumpAttr(tech.passing, 1);
        ment.decisions = bumpAttr(ment.decisions, 1);
        phys.stamina = bumpAttr(phys.stamina, 1);
        trainedAttr = 'All-Round Development';
      }

      if (updated.primaryPosition === 'Goalkeeper') {
        tech.goalkeeping = bumpAttr(tech.goalkeeping ?? 70, 1);
        trainedAttr = 'Goalkeeping Reflexes';
      }

      const newOvr = calculateOverallRating(updated.primaryPosition, tech, phys, ment);
      updated = {
        ...updated,
        technicalAttributes: tech,
        physicalAttributes: phys,
        mentalAttributes: ment,
        overallRating: Math.max(oldOvr, newOvr),
        marketValue: estimateMarketValue(Math.max(oldOvr, newOvr), updated.age, updated.potential),
      };

      if (updated.overallRating > oldOvr && isUserPlayer) {
        updated.developmentHistory = [
          ...updated.developmentHistory,
          {
            seasonId: state.currentSeason,
            matchday: state.currentMatchday,
            overall: updated.overallRating,
            focus: activeFocus,
            note: `Improved ${trainedAttr} (+1 OVR)`,
          },
        ];
        improvedPlayers.push({
          playerId: updated.id,
          playerName: updated.fullName,
          attribute: trainedAttr,
          oldOverall: oldOvr,
          newOverall: updated.overallRating,
        });
      }
    }

    nextPlayers[updated.id] = updated;
  }

  const completedMatchday = Math.max(1, state.currentMatchday - 1);
  const trainingBlock = Math.floor((completedMatchday - 1) / 6);
  const trainingBlockClaimId = `training_block:${state.currentSeason}:b${trainingBlock}`;
  const tokenRes = applyTokenRewardClaims(
    state.universalSkillTokens ?? 0,
    state.claimedSkillTokenRewards,
    improvedPlayers.length > 0 ? [{ id: trainingBlockClaimId, amount: 1 }] : []
  );
  const devTokenEarned = tokenRes.grantedAmount;

  const report: TrainingReport = {
    id: `tr_rep_${state.currentSeason}_md${state.currentMatchday}`,
    matchday: state.currentMatchday,
    date: state.currentDate,
    focus,
    improvedPlayers,
    summary:
      improvedPlayers.length > 0
        ? `${improvedPlayers.length} first-team player(s) gained +1 overall rating under ${focus} training${devTokenEarned > 0 ? ' (+1 Universal Skill Token earned)' : ''}.`
        : `Squad completed ${focus} conditioning and tactical drills.`,
  };

  if (improvedPlayers.length > 0) {
    const top = improvedPlayers[0];
    newNews.push({
      id: `news_dev_${state.currentSeason}_${state.currentMatchday}_${top.playerId}`,
      date: state.currentDate,
      matchday: state.currentMatchday,
      category: 'Development',
      headline: `${top.playerName} progresses in ${focus} training`,
      summary: `${top.playerName} climbed to ${top.newOverall} OVR (${top.attribute}).${devTokenEarned > 0 ? ' +1 Universal Skill Token earned.' : ''}`,
      clubId: state.userClubId,
      playerId: top.playerId,
    });
  }

  return {
    ...state,
    players: nextPlayers,
    universalSkillTokens: tokenRes.nextTokens,
    claimedSkillTokenRewards: tokenRes.nextClaims,
    trainingReports: [report, ...state.trainingReports].slice(0, 25),
    news: Array.from(
      new Map([...newNews, ...state.news].map((n) => [n.id, n])).values()
    ).slice(0, 60),
  };
}

function incrementSeasonLabel(currentSeason: string): { nextLabel: string; startDate: string } {
  const startYr = parseInt(currentSeason.slice(0, 4), 10) || 2018;
  const nextYr = startYr + 1;
  const endShort = String(nextYr + 1).slice(-2);
  return {
    nextLabel: `${nextYr}/${endShort}`,
    startDate: `${nextYr}-08-14`,
  };
}

export function advanceToNextSeason(state: CareerState): CareerState {
  if (
    state.currentMatchday <= state.totalMatchdays ||
    state.seasonHistory.some((h) => h.seasonId === state.currentSeason)
  ) {
    return state;
  }

  const prePrizeUserBalance = state.clubs[state.userClubId]?.balance ?? -1;
  const userLeague = state.competitions[state.userLeagueId];
  const standings = calculateLeagueStandings(userLeague, state.fixtures, state.clubs);
  const userPosIdx = standings.findIndex((r) => r.clubId === state.userClubId);
  const userRow = standings[userPosIdx];
  const leagueWinner = standings[0];

  const leaders = getCompetitionStatLeaders(userLeague, state.players, state.clubs).sort(
    (a, b) => b.goals - a.goals
  );
  const topScorer = leaders[0];

  const uclWinnerId = state.competitions.ucl?.winnerClubId;
  const uelWinnerId = state.competitions.uel?.winnerClubId;

  const archiveEntry: SeasonArchive = {
    seasonId: state.currentSeason,
    isGeneratedSeason: state.isGeneratedSeason,
    leagueName: userLeague.name,
    leaguePosition: userPosIdx >= 0 ? userPosIdx + 1 : 1,
    points: userRow?.points ?? 0,
    leagueWinnerName: leagueWinner?.clubName ?? '',
    uclWinnerName: uclWinnerId ? state.clubs[uclWinnerId]?.name : undefined,
    uelWinnerName: uelWinnerId ? state.clubs[uelWinnerId]?.name : undefined,
    topScorerName: topScorer?.playerName,
    topScorerGoals: topScorer?.goals,
  };

  // Award prize money based on final league standing
  const userPos = userPosIdx >= 0 ? userPosIdx + 1 : 5;
  const prizeMoney = Math.max(4_000_000, (12 - userPos) * 3_500_000);
  const nextClubs: Record<string, Club> = {};

  for (const club of Object.values(state.clubs)) {
    const clubComp = state.competitions[club.leagueId];
    const table = calculateLeagueStandings(clubComp, state.fixtures, state.clubs);
    const pos = Math.max(1, table.findIndex((r) => r.clubId === club.id) + 1);
    const clubPrize = Math.max(3_500_000, (12 - pos) * 3_000_000);

    nextClubs[club.id] = {
      ...club,
      balance: club.balance + clubPrize,
      transferBudget: club.transferBudget + Math.round(clubPrize * 0.55),
    };
  }

  const { nextLabel, startDate } = incrementSeasonLabel(state.currentSeason);
  const nextYearNum = parseInt(nextLabel.slice(0, 4), 10);

  // Age players, return loans, handle contract expiries, reset season stats
  const nextPlayers: Record<string, Player> = {};
  for (const player of Object.values(state.players)) {
    let targetClubId = player.clubId;
    if (player.loanedFromClubId && nextClubs[player.loanedFromClubId]) {
      // Return loaned player to parent club
      nextClubs[targetClubId].squadIds = nextClubs[targetClubId].squadIds.filter(
        (id) => id !== player.id
      );
      targetClubId = player.loanedFromClubId;
      if (!nextClubs[targetClubId].squadIds.includes(player.id)) {
        nextClubs[targetClubId].squadIds.push(player.id);
      }
    }

    const nextAge = player.age + 1;
    const delta = nextAge <= 23 ? 2 : nextAge <= 28 ? 0 : nextAge <= 31 ? -1 : -2;
    const nextOverall = Math.max(
      55,
      Math.min(player.potential, player.overallRating + delta)
    );

    const renewedExpiry =
      player.contractExpiry <= nextYearNum ? nextYearNum + 2 : player.contractExpiry;

    nextPlayers[player.id] = {
      ...player,
      clubId: targetClubId,
      seasonId: nextLabel,
      ageBySeason: {
        ...player.ageBySeason,
        [nextLabel]: nextAge,
      },
      age: nextAge,
      overallRating: nextOverall,
      marketValue: estimateMarketValue(nextOverall, nextAge, player.potential),
      contractExpiry: renewedExpiry,
      fitness: 96,
      injuryWeeks: 0,
      injuryDescription: undefined,
      loanedFromClubId: null,
      loanMatchesRemaining: undefined,
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
      developmentHistory: [
        ...player.developmentHistory,
        {
          seasonId: nextLabel,
          matchday: 0,
          overall: nextOverall,
          focus: state.trainingFocus,
          note: `Season rollover (${delta >= 0 ? `+${delta}` : delta} OVR)`,
        },
      ],
    };
  }

  // Re-seed competitions & schedules for the generated career season
  const nextComps: Record<string, Competition> = {};
  const nextFixtures: Fixture[] = [];

  for (const comp of Object.values(state.competitions)) {
    const updatedComp: Competition = {
      ...comp,
      seasonId: nextLabel,
      currentMatchday: 1,
      winnerClubId: null,
    };
    nextComps[comp.id] = updatedComp;

    if (comp.competitionFormat === 'league') {
      nextFixtures.push(...generateLeagueFixtures(updatedComp, startDate));
    } else {
      nextFixtures.push(...generateInitialKnockoutFixtures(updatedComp, startDate));
    }
  }

  const userClub = nextClubs[state.userClubId];
  const rebuiltLineup = buildBestLineupForFormation(
    userClub,
    nextPlayers,
    state.tactics.formation
  );

  const starterIds = new Set(rebuiltLineup.slots.map((s) => s.playerId).filter(Boolean));
  const fallbackStarter =
    rebuiltLineup.slots.find((s) => s.slotIndex > 0 && s.playerId)?.playerId ??
    rebuiltLineup.slots[0]?.playerId ??
    null;
  const pickActiveOrFallback = (preferredId?: string | null) =>
    preferredId && starterIds.has(preferredId) ? preferredId : fallbackStarter;

  const wonLeague = userPos === 1;
  const targetMax = userClub.reputation >= 88 ? 2 : userClub.reputation >= 81 ? 4 : 6;
  const leagueObjectiveBonus = wonLeague ? 2 : userPos <= targetMax ? 1 : 0;
  const financeObjectiveBonus = prePrizeUserBalance >= 0 ? 1 : 0;

  const seasonCandidates: Array<{ id: string; amount: number }> = [];
  if (leagueObjectiveBonus > 0) {
    seasonCandidates.push({
      id: `season_obj_league:${state.currentSeason}`,
      amount: leagueObjectiveBonus,
    });
  }
  if (financeObjectiveBonus > 0) {
    seasonCandidates.push({
      id: `season_obj_finance:${state.currentSeason}`,
      amount: financeObjectiveBonus,
    });
  }
  const tokenRes = applyTokenRewardClaims(
    state.universalSkillTokens ?? 0,
    state.claimedSkillTokenRewards,
    seasonCandidates
  );
  const seasonRewardTokens = tokenRes.grantedAmount;

  return {
    ...state,
    currentSeason: nextLabel,
    isGeneratedSeason: true,
    currentMatchday: 1,
    totalMatchdays: userLeague.totalMatchdays,
    currentDate: startDate,
    transferWindowOpen: true,
    transferWindowLabel: 'Summer',
    clubs: nextClubs,
    players: nextPlayers,
    competitions: nextComps,
    fixtures: nextFixtures,
    universalSkillTokens: tokenRes.nextTokens,
    claimedSkillTokenRewards: tokenRes.nextClaims,
    tactics: {
      ...state.tactics,
      slots: rebuiltLineup.slots,
      substituteIds: rebuiltLineup.substituteIds,
      captainId: pickActiveOrFallback(state.tactics.captainId),
      penaltyTakerId: pickActiveOrFallback(state.tactics.penaltyTakerId),
      freeKickTakerId: pickActiveOrFallback(state.tactics.freeKickTakerId),
      cornerTakerId: pickActiveOrFallback(state.tactics.cornerTakerId),
    },
    manager: {
      ...state.manager,
      trophiesWon: state.manager.trophiesWon + (wonLeague ? 1 : 0),
    },
    transactions: [
      {
        id: `tx_prize_${nextLabel}`,
        date: startDate,
        matchday: 1,
        category: 'Prize Money',
        description: `End-of-season league prize (${userPos}${userPos === 1 ? 'st' : userPos === 2 ? 'nd' : userPos === 3 ? 'rd' : 'th'} place)`,
        amount: prizeMoney,
        balanceAfter: userClub.balance,
      },
      ...state.transactions,
    ],
    news: [
      {
        id: `news_new_season_${nextLabel}`,
        date: startDate,
        matchday: 1,
        category: 'Competition' as const,
        headline: `${nextLabel} Career Season Underway`,
        summary: `Generated career progression begins for ${userClub.name}. Summer transfer window is open.${seasonRewardTokens > 0 ? ` (+${seasonRewardTokens} Universal Skill Token${seasonRewardTokens > 1 ? 's' : ''} awarded for season objectives)` : ''}`,
        clubId: userClub.id,
      },
      ...state.news,
    ].slice(0, 60),
    seasonHistory: [archiveEntry, ...state.seasonHistory],
  };
}
