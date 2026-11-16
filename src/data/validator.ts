import { ALL_POSITIONS } from '../engine/ratings';
import { validateSkillPair } from '../engine/skills';
import { Club, Competition, Player, SeasonId } from '../types';

export const VALID_SEASONS: SeasonId[] = [
  '2014/15',
  '2015/16',
  '2016/17',
  '2017/18',
  '2018/19',
];

export interface DatabaseValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'INVALID_SEASON'
    | 'DUPLICATE_CLUB_ID'
    | 'DUPLICATE_PLAYER_ID'
    | 'DUPLICATE_COMPETITION_ID'
    | 'MISSING_CLUB_REF'
    | 'MISSING_PLAYER_REF'
    | 'INVALID_POSITION'
    | 'INCOMPLETE_COMPETITION'
    | 'SQUAD_TOO_SMALL'
    | 'NO_GOALKEEPER'
    | 'INVALID_SKILLS';
  message: string;
  entityId?: string;
}

export interface DatabaseValidationReport {
  valid: boolean;
  seasonId: string;
  clubsCount: number;
  playersCount: number;
  competitionsCount: number;
  historicalPlayersCount: number;
  issues: DatabaseValidationIssue[];
}

export function validateSeasonDatabase(
  seasonId: string,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  competitions: Record<string, Competition>,
  options?: { allowGeneratedSeason?: boolean }
): DatabaseValidationReport {
  const issues: DatabaseValidationIssue[] = [];

  if (!options?.allowGeneratedSeason && !VALID_SEASONS.includes(seasonId as SeasonId)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_SEASON',
      message: `Season "${seasonId}" is not one of the supported historical seasons.`,
    });
  }

  const clubIdsSeen = new Set<string>();
  const playerIdsSeen = new Set<string>();
  const compIdsSeen = new Set<string>();

  for (const [key, comp] of Object.entries(competitions)) {
    if (compIdsSeen.has(comp.id) || key !== comp.id) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_COMPETITION_ID',
        entityId: comp.id,
        message: `Duplicate or mismatched competition ID "${comp.id}".`,
      });
    }
    compIdsSeen.add(comp.id);

    const participantSet = new Set(comp.clubIds);
    if (participantSet.size !== comp.clubIds.length) {
      issues.push({
        severity: 'error',
        code: 'INCOMPLETE_COMPETITION',
        entityId: comp.id,
        message: `Competition "${comp.name}" contains duplicate participant club IDs.`,
      });
    }

    const minParticipants = comp.competitionFormat === 'knockout' ? 8 : 6;
    if (comp.clubIds.length < minParticipants) {
      issues.push({
        severity: 'error',
        code: 'INCOMPLETE_COMPETITION',
        entityId: comp.id,
        message: `Competition "${comp.name}" has only ${comp.clubIds.length} clubs (minimum ${minParticipants}).`,
      });
    }

    for (const cid of comp.clubIds) {
      if (!clubs[cid]) {
        issues.push({
          severity: 'error',
          code: 'MISSING_CLUB_REF',
          entityId: cid,
          message: `Competition "${comp.name}" references missing club "${cid}".`,
        });
      }
    }
  }

  for (const [key, club] of Object.entries(clubs)) {
    if (clubIdsSeen.has(club.id) || key !== club.id) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_CLUB_ID',
        entityId: club.id,
        message: `Duplicate or mismatched club ID "${club.id}".`,
      });
    }
    clubIdsSeen.add(club.id);

    if (!competitions[club.leagueId]) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CLUB_REF',
        entityId: club.id,
        message: `Club "${club.name}" references missing league "${club.leagueId}".`,
      });
    }

    if (club.squadIds.length < 15) {
      issues.push({
        severity: 'error',
        code: 'SQUAD_TOO_SMALL',
        entityId: club.id,
        message: `Club "${club.name}" has only ${club.squadIds.length} players (minimum 15 required).`,
      });
    }

    let gkCount = 0;
    for (const pid of club.squadIds) {
      const player = players[pid];
      if (!player) {
        issues.push({
          severity: 'error',
          code: 'MISSING_PLAYER_REF',
          entityId: pid,
          message: `Club "${club.name}" references missing player "${pid}".`,
        });
      } else if (player.primaryPosition === 'Goalkeeper') {
        gkCount += 1;
      }
    }

    if (gkCount === 0) {
      issues.push({
        severity: 'error',
        code: 'NO_GOALKEEPER',
        entityId: club.id,
        message: `Club "${club.name}" has no natural Goalkeeper in its squad.`,
      });
    }
  }

  let historicalPlayersCount = 0;

  for (const [key, player] of Object.entries(players)) {
    if (playerIdsSeen.has(player.id) || key !== player.id) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_PLAYER_ID',
        entityId: player.id,
        message: `Duplicate or mismatched player ID "${player.id}".`,
      });
    }
    playerIdsSeen.add(player.id);

    if (!ALL_POSITIONS.includes(player.primaryPosition)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_POSITION',
        entityId: player.id,
        message: `Player "${player.fullName}" has invalid primary position "${player.primaryPosition}".`,
      });
    }

    for (const sec of player.secondaryPositions) {
      if (!ALL_POSITIONS.includes(sec)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_POSITION',
          entityId: player.id,
          message: `Player "${player.fullName}" has invalid secondary position "${sec}".`,
        });
      }
    }

    if (!clubs[player.clubId]) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CLUB_REF',
        entityId: player.id,
        message: `Player "${player.fullName}" references missing club "${player.clubId}".`,
      });
    }

    const skillValidation = validateSkillPair(player.skill1 ?? null, player.skill2 ?? null);
    if (!skillValidation.valid) {
      issues.push({
        severity: 'error',
        code: 'INVALID_SKILLS',
        entityId: player.id,
        message: `Player "${player.fullName}": ${skillValidation.error}`,
      });
    }

    if (player.isHistoricalRecord) {
      historicalPlayersCount += 1;
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    valid: !hasErrors,
    seasonId,
    clubsCount: Object.keys(clubs).length,
    playersCount: Object.keys(players).length,
    competitionsCount: Object.keys(competitions).length,
    historicalPlayersCount,
    issues,
  };
}
