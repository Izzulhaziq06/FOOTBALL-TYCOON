import {
  Club,
  Competition,
  Fixture,
  LeagueStandingRow,
  Player,
} from '../types';

/**
 * Generates a balanced double round-robin schedule (home & away) for a league.
 */
export function generateLeagueFixtures(
  competition: Competition,
  seasonStartDate: string
): Fixture[] {
  const teams = [...competition.clubIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) {
    teams.push('BYE');
  }

  const n = teams.length;
  const half = n / 2;
  const roundsFirstHalf: Array<Array<{ home: string; away: string }>> = [];
  const rotating = teams.slice(1);

  for (let round = 0; round < n - 1; round += 1) {
    const roundMatches: Array<{ home: string; away: string }> = [];
    const current = [teams[0], ...rotating];

    for (let i = 0; i < half; i += 1) {
      const t1 = current[i];
      const t2 = current[n - 1 - i];
      if (t1 === 'BYE' || t2 === 'BYE') continue;

      // Alternate home/away for fairness
      if ((round + i) % 2 === 0) {
        roundMatches.push({ home: t1, away: t2 });
      } else {
        roundMatches.push({ home: t2, away: t1 });
      }
    }

    roundsFirstHalf.push(roundMatches);
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  const allRounds = [
    ...roundsFirstHalf,
    ...roundsFirstHalf.map((matches) =>
      matches.map((m) => ({ home: m.away, away: m.home }))
    ),
  ];

  const fixtures: Fixture[] = [];
  const baseDate = new Date(`${seasonStartDate}T15:00:00Z`);

  allRounds.forEach((matches, roundIdx) => {
    const matchday = roundIdx + 1;
    const matchDate = new Date(baseDate.getTime() + roundIdx * 7 * 86400000);
    const isoDate = matchDate.toISOString().slice(0, 10);

    matches.forEach((m, idx) => {
      fixtures.push({
        id: `fix_${competition.id}_${competition.seasonId}_md${matchday}_${idx}`,
        competitionId: competition.id,
        seasonId: competition.seasonId,
        matchday,
        homeClubId: m.home,
        awayClubId: m.away,
        date: isoDate,
        result: null,
        status: 'scheduled',
      });
    });
  });

  return fixtures;
}

/**
 * Generates initial Round of 16 knockout bracket for UCL / UEL (mapped across matchdays 4, 8, 12, 16).
 */
export const KNOCKOUT_ROUND_MATCHDAYS = [4, 8, 12, 16] as const;
export const KNOCKOUT_ROUND_NAMES: Record<number, string> = {
  4: 'Round of 16',
  8: 'Quarter-Final',
  12: 'Semi-Final',
  16: 'Final',
};

export function generateInitialKnockoutFixtures(
  competition: Competition,
  seasonStartDate: string
): Fixture[] {
  const clubIds = competition.clubIds.slice(0, 16);
  const fixtures: Fixture[] = [];
  const baseDate = new Date(`${seasonStartDate}T20:00:00Z`);
  const matchday = KNOCKOUT_ROUND_MATCHDAYS[0];
  const roundDate = new Date(baseDate.getTime() + (matchday - 1) * 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  for (let i = 0; i + 1 < clubIds.length; i += 2) {
    fixtures.push({
      id: `fix_${competition.id}_${competition.seasonId}_ko_r16_${i / 2}`,
      competitionId: competition.id,
      seasonId: competition.seasonId,
      matchday,
      roundName: 'Round of 16',
      homeClubId: clubIds[i],
      awayClubId: clubIds[i + 1],
      date: roundDate,
      result: null,
      status: 'scheduled',
    });
  }

  return fixtures;
}

export function advanceKnockoutBracketIfReady(
  competition: Competition,
  fixtures: Fixture[],
  seasonStartDate: string
): { newFixtures: Fixture[]; winnerClubId: string | null } {
  if (competition.competitionFormat !== 'knockout') {
    return { newFixtures: [], winnerClubId: null };
  }

  const compFixtures = fixtures.filter(
    (f) => f.competitionId === competition.id && f.seasonId === competition.seasonId
  );

  // Find highest matchday generated so far
  const roundMatchdays = KNOCKOUT_ROUND_MATCHDAYS;
  let latestRoundIdx = -1;
  for (let i = 0; i < roundMatchdays.length; i += 1) {
    if (compFixtures.some((f) => f.matchday === roundMatchdays[i])) {
      latestRoundIdx = i;
    }
  }
  if (latestRoundIdx === -1) return { newFixtures: [], winnerClubId: null };

  const currentRoundMd = roundMatchdays[latestRoundIdx];
  const currentRoundFixtures = compFixtures.filter((f) => f.matchday === currentRoundMd);

  if (currentRoundFixtures.some((f) => f.status !== 'completed' || !f.result)) {
    return { newFixtures: [], winnerClubId: null };
  }

  // Determine winners (on tie in knockout, higher shots on target or away goal/home tiebreaker deterministically)
  const winners = currentRoundFixtures.map((f) => {
    const res = f.result!;
    if (res.homeGoals > res.awayGoals) return f.homeClubId;
    if (res.awayGoals > res.homeGoals) return f.awayClubId;
    // Penalty shootout deterministic tiebreaker using match seed
    return res.seed % 2 === 0 ? f.homeClubId : f.awayClubId;
  });

  if (winners.length === 1) {
    return { newFixtures: [], winnerClubId: winners[0] };
  }

  const nextRoundIdx = latestRoundIdx + 1;
  if (nextRoundIdx >= roundMatchdays.length) {
    return { newFixtures: [], winnerClubId: winners[0] ?? null };
  }

  const nextMd = roundMatchdays[nextRoundIdx];
  const nextRoundName = KNOCKOUT_ROUND_NAMES[nextMd];
  const baseDate = new Date(`${seasonStartDate}T20:00:00Z`);
  const nextDate = new Date(baseDate.getTime() + (nextMd - 1) * 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const newFixtures: Fixture[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    newFixtures.push({
      id: `fix_${competition.id}_${competition.seasonId}_ko_md${nextMd}_${i / 2}`,
      competitionId: competition.id,
      seasonId: competition.seasonId,
      matchday: nextMd,
      roundName: nextRoundName,
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      date: nextDate,
      result: null,
      status: 'scheduled',
    });
  }

  return { newFixtures, winnerClubId: null };
}

/**
 * Computes league standings sorted strictly by:
 * 1. Points (Win = 3, Draw = 1, Loss = 0)
 * 2. Goal Difference
 * 3. Goals Scored
 * 4. Club Name (alphabetical deterministic fallback)
 */
export function calculateLeagueStandings(
  competition: Competition,
  fixtures: Fixture[],
  clubsMap: Record<string, Club>
): LeagueStandingRow[] {
  const rows: Record<string, LeagueStandingRow> = {};

  for (const clubId of competition.clubIds) {
    rows[clubId] = {
      clubId,
      clubName: clubsMap[clubId]?.name ?? clubId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    };
  }

  const completed = fixtures
    .filter(
      (f) =>
        f.competitionId === competition.id &&
        f.seasonId === competition.seasonId &&
        f.status === 'completed' &&
        f.result !== null
    )
    .sort((a, b) => a.matchday - b.matchday);

  for (const fix of completed) {
    const res = fix.result!;
    const home = rows[fix.homeClubId];
    const away = rows[fix.awayClubId];
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += res.homeGoals;
    home.goalsAgainst += res.awayGoals;
    away.goalsFor += res.awayGoals;
    away.goalsAgainst += res.homeGoals;

    if (res.homeGoals > res.awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
      home.form.push('W');
      away.form.push('L');
    } else if (res.homeGoals < res.awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
      away.form.push('W');
      home.form.push('L');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push('D');
      away.form.push('D');
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  for (const r of Object.values(rows)) {
    if (r.form.length > 5) {
      r.form = r.form.slice(-5);
    }
  }

  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  });
}

export interface CompetitionLeaderRow {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  position: string;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motmAwards: number;
  averageRating: number;
}

export function getCompetitionStatLeaders(
  competition: Competition,
  playersMap: Record<string, Player>,
  clubsMap: Record<string, Club>
): CompetitionLeaderRow[] {
  const clubSet = new Set(competition.clubIds);
  return Object.values(playersMap)
    .filter((p) => clubSet.has(p.clubId) && p.seasonStats.appearances > 0)
    .map((p) => ({
      playerId: p.id,
      playerName: p.fullName,
      clubId: p.clubId,
      clubName: clubsMap[p.clubId]?.name ?? p.clubId,
      position: p.primaryPosition,
      appearances: p.seasonStats.appearances,
      goals: p.seasonStats.goals,
      assists: p.seasonStats.assists,
      cleanSheets: p.seasonStats.cleanSheets,
      motmAwards: p.seasonStats.motmAwards,
      averageRating: p.seasonStats.averageRating,
    }));
}
