import { describe, expect, it } from 'vitest';
import { advanceMatchday, createNewCareer } from '../../src/engine/careerEngine';
import { calculateLeagueStandings } from '../../src/engine/competitionEngine';
import { advanceToNextSeason } from '../../src/engine/progressionEngine';
import { clearMemoryFallbackForTests } from '../../src/storage/indexedDB';
import {
  deleteCareerSave,
  listCareerSaves,
  loadCareer,
  migrateCareerSave,
  renameCareerSave,
  saveCareer,
} from '../../src/storage/saveManager';

describe('Competitions, Progression & Save System Integration', () => {
  it('computes league standings with points, goal difference, and tie-breakers and progresses full season', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'man_city',
      managerName: 'Alex Mercer',
      managerNationality: 'England',
      philosophy: 'Possession',
    });

    const epl = career.competitions['epl'];
    const eplFixtures = career.fixtures.filter((f) => f.competitionId === 'epl');
    expect(eplFixtures.length).toBe(90); // 10 teams * 9 * 2 / 2 = 90 matches

    // Simulate all 18 matchdays
    for (let md = 1; md <= career.totalMatchdays; md += 1) {
      career = advanceMatchday(career);
    }

    const standings = calculateLeagueStandings(
      career.competitions['epl'],
      career.fixtures,
      career.clubs
    );
    expect(standings).toHaveLength(10);
    for (const row of standings) {
      expect(row.played).toBe(18);
      expect(row.points).toBe(row.won * 3 + row.drawn);
      expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
    }

    // Verify sorting order (Points -> GD -> GF)
    for (let i = 1; i < standings.length; i += 1) {
      const prev = standings[i - 1];
      const curr = standings[i];
      const validOrder =
        prev.points > curr.points ||
        (prev.points === curr.points && prev.goalDifference > curr.goalDifference) ||
        (prev.points === curr.points &&
          prev.goalDifference === curr.goalDifference &&
          prev.goalsFor >= curr.goalsFor);
      expect(validOrder).toBe(true);
    }

    // Rollover to next season (marked clearly as generated career season if advancing beyond historical)
    const nextSeasonCareer = advanceToNextSeason(career);
    expect(nextSeasonCareer.currentSeason).toBe('2015/16');
    expect(nextSeasonCareer.isGeneratedSeason).toBe(true);
    expect(nextSeasonCareer.currentMatchday).toBe(1);
    expect(nextSeasonCareer.seasonHistory).toHaveLength(1);
  });

  it('saves, lists, loads, renames, deletes, and migrates multiple careers', async () => {
    clearMemoryFallbackForTests();

    const c1 = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Manager One',
      managerNationality: 'England',
      philosophy: 'Balanced',
      saveName: 'Chelsea Save',
    });

    const c2 = createNewCareer({
      seasonId: '2017/18',
      clubId: 'liverpool',
      managerName: 'Manager Two',
      managerNationality: 'Germany',
      philosophy: 'High Press',
      saveName: 'Liverpool Save',
    });

    await saveCareer(c1);
    await saveCareer(c2);

    const list = await listCareerSaves();
    expect(list).toHaveLength(2);

    const loaded = await loadCareer(c1.id);
    expect(loaded?.saveName).toBe('Chelsea Save');
    expect(loaded?.clubs['chelsea'].name).toBe('Chelsea FC');

    await renameCareerSave(c1.id, 'Blues Legacy');
    const renamed = await loadCareer(c1.id);
    expect(renamed?.saveName).toBe('Blues Legacy');

    // Migration test for older partial save
    const legacy = { ...c1, saveVersion: '1.0.0' };
    const migrated = migrateCareerSave(legacy);
    expect(migrated.saveVersion).toBe('1.1.0');
    const firstPlayer = Object.values(migrated.players)[0];
    expect(firstPlayer.skill1 !== undefined).toBe(true);
    expect(typeof firstPlayer.isSuperstar).toBe('boolean');

    await deleteCareerSave(c2.id);
    const afterDelete = await listCareerSaves();
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe(c1.id);
  });

  it('persists custom Academy player skills and preserves skills across season rollover without loan sale exploits', async () => {
    clearMemoryFallbackForTests();
    const {
      createAcademyPlayer,
      updatePlayerSkills,
    } = await import('../../src/engine/careerEngine');
    const {
      executeCompletedTransfer,
      sellUserPlayer,
      startTransferNegotiation,
      submitFeeOffer,
      submitWageOffer,
    } = await import('../../src/engine/transferEngine');

    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Integration Manager',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Customize Eden Hazard skills
    const customRes = updatePlayerSkills(career, 'eden_hazard', 'creativity', 'free_kicks');
    expect(customRes.ok).toBe(true);
    career = customRes.nextState;

    // Create Academy player
    const acadRes = createAcademyPlayer(career, {
      fullName: 'Mason Sterling-Cole',
      nationality: 'England',
      age: 17,
      primaryPosition: 'Striker',
      secondaryPositions: ['Winger'],
      preferredFoot: 'Right',
      technicalAttributes: {
        passing: 65,
        shooting: 72,
        finishing: 74,
        dribbling: 70,
        crossing: 60,
        tackling: 40,
        ballControl: 71,
        heading: 68,
        goalkeeping: 20,
      },
      physicalAttributes: {
        pace: 75,
        acceleration: 76,
        stamina: 72,
        strength: 68,
        agility: 74,
        jumping: 70,
      },
      mentalAttributes: {
        vision: 66,
        positioning: 73,
        decisions: 67,
        composure: 70,
        leadership: 58,
        workRate: 74,
      },
      skill1: 'shooting',
      skill2: 'att_positioning',
      grantSuperstar: false,
    });
    expect(acadRes.ok).toBe(true);
    career = acadRes.nextState;
    const acadId = acadRes.player!.id;

    // Loan in Carlos Vela and verify selling loaned-in player is blocked
    let loanSession = startTransferNegotiation(career, 'carlos_vela', 'loan');
    if (loanSession.stage === 'fee') {
      loanSession = submitFeeOffer(loanSession, loanSession.askingFee, career.clubs['chelsea']);
      loanSession = submitWageOffer(
        loanSession,
        loanSession.askingWage,
        1,
        career.clubs['chelsea'],
        1_000_000
      );
      const loanExec = executeCompletedTransfer(career, loanSession);
      expect(loanExec.ok).toBe(true);
      career = loanExec.nextState;

      const trySellLoan = sellUserPlayer(career, 'carlos_vela');
      expect(trySellLoan.ok).toBe(false);
      expect(trySellLoan.error?.toLowerCase()).toContain('loaned-in');

      const dupBuy = startTransferNegotiation(career, 'carlos_vela', 'permanent');
      expect(dupBuy.stage).toBe('collapsed');
    }

    await saveCareer(career);
    const reloaded = await loadCareer(career.id);
    expect(reloaded?.players[acadId]?.skill1).toBe('shooting');
    expect(reloaded?.players[acadId]?.skill2).toBe('att_positioning');
    expect(reloaded?.players['eden_hazard']?.skill1).toBe('creativity');

    // Simulate season & roll over — custom skills must remain intact and ages increment
    let endSeason = reloaded!;
    for (let md = 1; md <= endSeason.totalMatchdays; md += 1) {
      endSeason = advanceMatchday(endSeason);
    }
    const nextSeason = advanceToNextSeason(endSeason);
    expect(nextSeason.players['eden_hazard'].skill1).toBe('creativity');
    expect(nextSeason.players['eden_hazard'].skill2).toBe('free_kicks');
    expect(nextSeason.players[acadId].skill1).toBe('shooting');
    expect(nextSeason.players[acadId].age).toBe(18);
    expect(nextSeason.players[acadId].seasonId).toBe('2015/16');
  });
});
