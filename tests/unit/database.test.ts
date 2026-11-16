import { describe, expect, it } from 'vitest';
import {
  buildSeasonDatabase,
  validateAllHistoricalSeasons,
  validateCustomDatabaseImport,
} from '../../src/data/database';
import { calculateOverallRating } from '../../src/engine/ratings';
import { SeasonId } from '../../src/types';

describe('Historical Football Database & Ratings', () => {
  it('validates all five historical seasons (2014/15 to 2018/19) with zero integrity errors and full club historical coverage', () => {
    const reports = validateAllHistoricalSeasons();
    expect(reports).toHaveLength(5);
    for (const rep of reports) {
      expect(rep.valid).toBe(true);
      expect(rep.issues).toHaveLength(0);
      expect(rep.clubsCount).toBe(50);
      expect(rep.competitionsCount).toBe(7);
      expect(rep.historicalPlayersCount).toBeGreaterThanOrEqual(140);

      const db = buildSeasonDatabase(rep.seasonId as SeasonId);
      for (const club of Object.values(db.clubs)) {
        const histCount = club.squadIds.filter((pid) => db.players[pid]?.isHistoricalRecord).length;
        expect(histCount).toBeGreaterThanOrEqual(1);
        expect(club.squadIds.length).toBeGreaterThanOrEqual(18);
        const squadNames = club.squadIds.map((pid) => db.players[pid].fullName);
        expect(new Set(squadNames).size).toBe(squadNames.length);
      }
      for (const p of Object.values(db.players)) {
        if (p.skill1 && p.skill2) {
          expect(p.skill1).not.toBe(p.skill2);
        }
        expect(
          calculateOverallRating(
            p.primaryPosition,
            p.technicalAttributes,
            p.physicalAttributes,
            p.mentalAttributes
          )
        ).toBe(p.overallRating);
        if (!p.isHistoricalRecord) {
          expect(p.overallRating).toBeLessThanOrEqual(79);
          expect(p.potential).toBeLessThanOrEqual(84);
          expect(p.isSuperstar).toBe(false);
          expect(p.ratingSource).toBe('gameplay_estimated');
        }
      }
    }
  });

  it('enforces historically accurate club-season player stints', () => {
    const db2014 = buildSeasonDatabase('2014/15');
    const db2018 = buildSeasonDatabase('2018/19');

    expect(db2014.players['cristiano_ronaldo']?.clubId).toBe('real_madrid');
    expect(db2018.players['cristiano_ronaldo']?.clubId).toBe('juventus');

    expect(db2014.players['neymar_jr']?.clubId).toBe('barcelona');
    expect(db2018.players['neymar_jr']?.clubId).toBe('psg');

    expect(db2014.players['kevin_de_bruyne']?.clubId).toBe('wolfsburg');
    expect(db2018.players['kevin_de_bruyne']?.clubId).toBe('man_city');
  });

  it('calculates position-specific weighted overall ratings (not equal weighting)', () => {
    const strikerProfile = {
      technical: {
        passing: 60,
        shooting: 88,
        finishing: 92,
        dribbling: 76,
        crossing: 55,
        tackling: 30,
        ballControl: 80,
        heading: 82,
        goalkeeping: 15,
      },
      physical: {
        pace: 85,
        acceleration: 84,
        stamina: 75,
        strength: 78,
        agility: 76,
        jumping: 78,
      },
      mental: {
        vision: 68,
        positioning: 90,
        decisions: 80,
        composure: 88,
        leadership: 70,
        workRate: 76,
      },
    };

    const stOvr = calculateOverallRating(
      'Striker',
      strikerProfile.technical,
      strikerProfile.physical,
      strikerProfile.mental
    );
    const cbOvr = calculateOverallRating(
      'Centre Back',
      strikerProfile.technical,
      strikerProfile.physical,
      strikerProfile.mental
    );
    const gkOvr = calculateOverallRating(
      'Goalkeeper',
      strikerProfile.technical,
      strikerProfile.physical,
      strikerProfile.mental
    );

    expect(stOvr).toBeGreaterThan(83);
    expect(cbOvr).toBeLessThan(stOvr - 10);
    expect(gkOvr).toBeLessThan(60);
  });

  it('validates and rejects malformed custom database imports', () => {
    const bad = validateCustomDatabaseImport('{"seasonId":"1999/00"}');
    expect(bad.ok).toBe(false);

    const seasons: SeasonId[] = ['2014/15'];
    const db = buildSeasonDatabase(seasons[0]);
    const validImport = validateCustomDatabaseImport(
      JSON.stringify({
        seasonId: db.seasonId,
        clubs: db.clubs,
        players: db.players,
        competitions: db.competitions,
      })
    );
    expect(validImport.ok).toBe(true);
  });
});
