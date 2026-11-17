import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceMatchday,
  createAcademyPlayer,
  createNewCareer,
  unlockOrRerollSkill2,
  unlockPlayerSuperstar,
} from '../../src/engine/careerEngine';
import {
  advanceToNextSeason,
  runMatchdayTrainingAndRecovery,
} from '../../src/engine/progressionEngine';
import {
  applyTokenRewardClaims,
  getCompatibleSkillsForPosition,
  SKILL_MAP,
} from '../../src/engine/skills';
import { clearMemoryFallbackForTests } from '../../src/storage/indexedDB';
import * as saveManager from '../../src/storage/saveManager';
import { useCareerStore } from '../../src/store/careerStore';
import { CareerState } from '../../src/types';

function makeAcademyInput(name: string) {
  return {
    fullName: name,
    nationality: 'England',
    age: 18,
    primaryPosition: 'Central Midfielder' as const,
    secondaryPositions: [],
    preferredFoot: 'Right' as const,
    technicalAttributes: {
      passing: 72,
      shooting: 66,
      finishing: 64,
      dribbling: 72,
      crossing: 65,
      tackling: 66,
      ballControl: 73,
      heading: 62,
      goalkeeping: 20,
    },
    physicalAttributes: {
      pace: 72,
      acceleration: 72,
      stamina: 74,
      strength: 68,
      agility: 72,
      jumping: 66,
    },
    mentalAttributes: {
      vision: 72,
      positioning: 70,
      decisions: 71,
      composure: 70,
      leadership: 62,
      workRate: 74,
    },
    grantSuperstar: false,
  };
}

describe('Universal Skill Token Economy Integrity & Exploits Audit', () => {
  beforeEach(() => {
    clearMemoryFallbackForTests();
    useCareerStore.setState({
      career: null,
      saves: [],
      isHydrated: true,
      isBusy: false,
      isRollingSkill: false,
      lastPlayedFixtureId: null,
    });
    vi.restoreAllMocks();
  });

  it('1. Rewards all 7 token sources through applyTokenRewardClaims cleanly', () => {
    const res = applyTokenRewardClaims(3, [], [
      { id: 'training_block:2014/15:b0', amount: 1 },
      { id: 'acad_season:2014/15:1', amount: 1 },
      { id: 'superstar_elev:player_1', amount: 1 },
      { id: 'milestone_matches:10', amount: 1 },
      { id: 'win_threshold:5', amount: 1 },
      { id: 'comp_win:ucl:2014/15', amount: 2 },
      { id: 'season_obj_league:2014/15', amount: 2 },
      { id: 'season_obj_finance:2014/15', amount: 1 },
    ]);
    expect(res.grantedAmount).toBe(10);
    expect(res.nextTokens).toBe(13);
    expect(res.nextClaims).toHaveLength(8);
  });

  it('2 & 3. Enforces one-time match milestones (10/25/50/100) and every-5-win thresholds without duplicate grants', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Milestone Audit',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Place manager at 9 matches and 4 wins; simulate MD 1 with guaranteed 3-0 win
    const md1Fix = career.fixtures.find(
      (f) =>
        f.seasonId === '2014/15' &&
        f.matchday === 1 &&
        (f.homeClubId === 'chelsea' || f.awayClubId === 'chelsea')
    )!;
    const isHome = md1Fix.homeClubId === 'chelsea';

    career = {
      ...career,
      universalSkillTokens: 3,
      manager: { ...career.manager, matchesManaged: 9, wins: 4 },
    };

    const forcedWin = {
      fixtureId: md1Fix.id,
      homeGoals: isHome ? 3 : 0,
      awayGoals: isHome ? 0 : 3,
      events: [],
      homeStats: {
        possession: 55,
        shots: 14,
        shotsOnTarget: 6,
        expectedGoals: 2.1,
        passesCompleted: 420,
        corners: 5,
        fouls: 8,
        yellowCards: 1,
        redCards: 0,
      },
      awayStats: {
        possession: 45,
        shots: 6,
        shotsOnTarget: 2,
        expectedGoals: 0.6,
        passesCompleted: 310,
        corners: 2,
        fouls: 10,
        yellowCards: 2,
        redCards: 0,
      },
      playerRatings: [],
      motmPlayerId: 'eden_hazard',
      attendance: 40000,
      gateReceipts: 1_500_000,
      seed: 100,
    };

    const afterMd1 = advanceMatchday(career, { [md1Fix.id]: forcedWin });
    // Earned: milestone_matches:10 (+1), win_threshold:5 (+1), plus optional training_block:b0 (+0 or +1)
    expect(afterMd1.manager.matchesManaged).toBe(10);
    expect(afterMd1.manager.wins).toBe(5);
    expect(afterMd1.claimedSkillTokenRewards).toContain('milestone_matches:10');
    expect(afterMd1.claimedSkillTokenRewards).toContain('win_threshold:5');

    // Attempt replay at exact same matchday/milestone with pre-existing claims: 0 duplicate grants
    const replayed = advanceMatchday(
      {
        ...career,
        universalSkillTokens: afterMd1.universalSkillTokens,
        claimedSkillTokenRewards: afterMd1.claimedSkillTokenRewards,
      },
      { [md1Fix.id]: forcedWin }
    );
    expect(replayed.universalSkillTokens).toBe(afterMd1.universalSkillTokens);

    // Verify 25/50/100 milestones also grant once each
    const claims25 = applyTokenRewardClaims(5, afterMd1.claimedSkillTokenRewards, [
      { id: 'milestone_matches:10', amount: 1 },
      { id: 'milestone_matches:25', amount: 1 },
      { id: 'milestone_matches:50', amount: 1 },
      { id: 'milestone_matches:100', amount: 1 },
    ]);
    expect(claims25.grantedAmount).toBe(3); // 10 skipped, 25/50/100 granted
    expect(claims25.nextTokens).toBe(8);
  });

  it('4. Prevents training breakthrough token duplication on same MD and within same 6-MD training block', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Training Guard',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Force growth eligibility across all Chelsea youth/sub-potential players on MD 1->2
    career = {
      ...career,
      currentMatchday: 2, // just completed MD 1
      clubs: {
        ...career.clubs,
        chelsea: {
          ...career.clubs['chelsea'],
          facilities: { ...career.clubs['chelsea'].facilities, trainingGround: 5 },
        },
      },
    };

    // Boost potential headroom and find a hash-eligible youth player
    const testPid = career.clubs['chelsea'].squadIds.find((id) => career.players[id].age <= 24)!;
    career.players[testPid] = {
      ...career.players[testPid],
      potential: 95,
      overallRating: 75,
      injuryWeeks: 0,
    };

    const run1 = runMatchdayTrainingAndRecovery(career);
    // Repeat exact same completed matchday state: must NOT double-grant training_block:2014/15:b0
    const run2 = runMatchdayTrainingAndRecovery({
      ...career,
      universalSkillTokens: run1.universalSkillTokens,
      claimedSkillTokenRewards: run1.claimedSkillTokenRewards,
    });
    expect(run2.universalSkillTokens).toBe(run1.universalSkillTokens);

    // Advance within same 6-MD block (MD 3): even if a breakthrough occurs, block b0 stays capped at +1 total
    const run3 = runMatchdayTrainingAndRecovery({
      ...run1,
      currentMatchday: 4, // completed MD 3 -> still block b0
    });
    const b0Claims = run3.claimedSkillTokenRewards.filter(
      (id) => id === 'training_block:2014/15:b0'
    );
    expect(b0Claims.length).toBeLessThanOrEqual(1);
    expect(run3.universalSkillTokens).toBe(run1.universalSkillTokens);
  });

  it('5. Enforces Academy promotion token award once per promotion and caps at 3 per season', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'arsenal',
      managerName: 'Academy Guard',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });
    const startTokens = career.universalSkillTokens;

    for (let i = 1; i <= 5; i += 1) {
      const res = createAcademyPlayer(career, makeAcademyInput(`Prospect ${i}`));
      expect(res.ok).toBe(true);
      career = res.nextState;
      if (i <= 3) {
        expect(res.tokensEarned).toBe(1);
        expect(career.universalSkillTokens).toBe(startTokens + i);
      } else {
        expect(res.tokensEarned).toBe(0);
        expect(career.universalSkillTokens).toBe(startTokens + 3);
      }
    }

    // After season rollover to 2015/16, Academy seasonal allowance resets for the new season
    for (let md = 1; md <= career.totalMatchdays; md += 1) {
      career = advanceMatchday(career);
    }
    const nextSeason = advanceToNextSeason(career);
    const tokensBeforeS2Acad = nextSeason.universalSkillTokens;
    const s2Res = createAcademyPlayer(nextSeason, makeAcademyInput('Season 2 Prospect'));
    expect(s2Res.ok).toBe(true);
    expect(s2Res.tokensEarned).toBe(1);
    expect(s2Res.nextState.universalSkillTokens).toBe(tokensBeforeS2Acad + 1);
  });

  it('6. Prevents Superstar elevation token duplication for the same player', () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Superstar Guard',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    const with5Apps: CareerState = {
      ...career,
      players: {
        ...career.players,
        petr_cech: {
          ...career.players['petr_cech'],
          seasonStats: { ...career.players['petr_cech'].seasonStats, appearances: 5 },
        },
      },
    };

    const first = unlockPlayerSuperstar(with5Apps, 'petr_cech');
    expect(first.ok).toBe(true);
    expect(first.nextState.universalSkillTokens).toBe(career.universalSkillTokens + 1);
    expect(first.nextState.claimedSkillTokenRewards).toContain('superstar_elev:petr_cech');

    const second = unlockPlayerSuperstar(first.nextState, 'petr_cech');
    expect(second.ok).toBe(false);
    expect(second.nextState.universalSkillTokens).toBe(first.nextState.universalSkillTokens);
  });

  it('7. Blocks premature season rollover, repeated rollover, and checks pre-prize balance for finance objective', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Rollover Guard',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Premature rollover at MD 1 must be a strict no-op
    const premature = advanceToNextSeason(career);
    expect(premature).toBe(career);

    // Finish season in debt (-€1M before prize money) to verify pre-prize balance check
    for (let md = 1; md <= career.totalMatchdays; md += 1) {
      career = advanceMatchday(career);
    }
    career = {
      ...career,
      clubs: {
        ...career.clubs,
        chelsea: { ...career.clubs['chelsea'], balance: -1_000_000 },
      },
    };

    const rolled = advanceToNextSeason(career);
    expect(rolled.currentSeason).toBe('2015/16');
    // Post-prize balance is positive (> +€4M prize), yet finance objective MUST NOT be claimed because pre-prize was negative
    expect(rolled.clubs['chelsea'].balance).toBeGreaterThan(0);
    expect(rolled.claimedSkillTokenRewards).not.toContain('season_obj_finance:2014/15');

    // Immediate repeated rollover call on already-rolled or replayed season is blocked
    const doubleRoll = advanceToNextSeason(rolled);
    expect(doubleRoll).toBe(rolled);
    const replayArchivedRoll = advanceToNextSeason({
      ...career,
      seasonHistory: rolled.seasonHistory,
    });
    expect(replayArchivedRoll.universalSkillTokens).toBe(career.universalSkillTokens);
  });

  it('8. Rewards UCL and UEL continental victories (+2 once per competition season)', () => {
    let career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Continental Audit',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Simulate until both UCL & UEL have winners, or verify award logic cleanly on Final fixture
    for (let md = 1; md <= career.totalMatchdays; md += 1) {
      career = advanceMatchday(career);
    }

    const uclClaim = applyTokenRewardClaims(0, [], [
      { id: 'comp_win:ucl:2014/15', amount: 2 },
      { id: 'comp_win:ucl:2014/15', amount: 2 },
      { id: 'comp_win:uel:2014/15', amount: 2 },
    ]);
    expect(uclClaim.grantedAmount).toBe(4); // +2 UCL +2 UEL, duplicate UCL ignored
  });

  it('9 & 10. Migrates legacy saves to 3 tokens once, reloads idempotently, and preserves existing balances/skills', async () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Migration Audit',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Legacy v1.0 save at 12 matches, 5 wins, missing universalSkillTokens & claimedSkillTokenRewards
    const legacyRaw = {
      ...career,
      saveVersion: '1.0.0',
      manager: { ...career.manager, matchesManaged: 12, wins: 5 },
    } as Partial<CareerState>;
    delete legacyRaw.universalSkillTokens;
    delete legacyRaw.claimedSkillTokenRewards;

    const migrated1 = saveManager.migrateCareerSave(legacyRaw as CareerState);
    expect(migrated1.universalSkillTokens).toBe(3);
    expect(migrated1.claimedSkillTokenRewards).toContain('milestone_matches:10');
    expect(migrated1.claimedSkillTokenRewards).toContain('win_threshold:5');

    // Spend 1 token on Hazard, save, reload twice -> stays at 2 tokens and preserves Skill 1 & Skill 2
    const spent = unlockOrRerollSkill2(migrated1, 'eden_hazard');
    expect(spent.ok).toBe(true);
    await saveManager.saveCareer(spent.nextState);

    const loaded1 = await saveManager.loadCareer(career.id);
    const loaded2 = await saveManager.loadCareer(career.id);
    expect(loaded1?.universalSkillTokens).toBe(2);
    expect(loaded2?.universalSkillTokens).toBe(2);
    expect(loaded2?.players['eden_hazard'].skill1).toBe('dribbling');
    expect(loaded2?.players['eden_hazard'].skill2).toBe(spent.rolledSkill);
    expect(loaded2?.players['eden_hazard'].overallRating).toBe(
      career.players['eden_hazard'].overallRating
    );

    // Migrating a save that already had 7 custom tokens preserves 7 without resetting to 3
    const existingTokensSave = {
      ...career,
      universalSkillTokens: 7,
    } as Partial<CareerState>;
    delete existingTokensSave.claimedSkillTokenRewards;
    const migratedExisting = saveManager.migrateCareerSave(existingTokensSave as CareerState);
    expect(migratedExisting.universalSkillTokens).toBe(7);
  });

  it('11 & 12. Blocks concurrent double-clicks across reward grants and rapid Skill 2 rerolls (no double-spend)', async () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'arsenal',
      managerName: 'Concurrency Guard',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });
    await saveManager.saveCareer(career);
    await useCareerStore.getState().loadSavedCareer(career.id);

    // Concurrent Skill 2 unlock/rerolls on 1-token budget: only 1 succeeds
    useCareerStore.setState((s) => ({
      career: s.career ? { ...s.career, universalSkillTokens: 1 } : null,
    }));
    const [r1, r2, r3] = await Promise.all([
      useCareerStore.getState().rollDevelopedSkill('mesut_ozil'),
      useCareerStore.getState().rollDevelopedSkill('mesut_ozil'),
      useCareerStore.getState().rollDevelopedSkill('mesut_ozil'),
    ]);
    const successes = [r1, r2, r3].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(0);

    // Concurrent Academy promotions: only 1 succeeds
    const [a1, a2] = await Promise.all([
      useCareerStore.getState().createCustomPlayer(makeAcademyInput('Twin A')),
      useCareerStore.getState().createCustomPlayer(makeAcademyInput('Twin B')),
    ]);
    expect([a1.ok, a2.ok].filter(Boolean)).toHaveLength(1);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(1);

    // Concurrent matchday commits: only MD 1 runs
    const [m1, m2] = await Promise.all([
      useCareerStore.getState().commitMatchday(),
      useCareerStore.getState().commitMatchday(),
    ]);
    expect([m1, m2].filter(Boolean)).toHaveLength(1);
    expect(useCareerStore.getState().career?.currentMatchday).toBe(2);
  });

  it('13. Rolls back cleanly without phantom token spend or phantom token grants when persistence fails', async () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Persistence Fault Test',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });
    const prepared: CareerState = {
      ...career,
      universalSkillTokens: 3,
      players: {
        ...career.players,
        petr_cech: {
          ...career.players['petr_cech'],
          seasonStats: { ...career.players['petr_cech'].seasonStats, appearances: 5 },
        },
      },
    };
    await saveManager.saveCareer(prepared);
    await useCareerStore.getState().loadSavedCareer(prepared.id);

    vi.spyOn(saveManager, 'saveCareer').mockRejectedValue(new Error('IndexedDB write quota exceeded'));

    // 1. Failed skill roll must preserve tokens=3 and skill2=null
    const rollFail = await useCareerStore.getState().rollDevelopedSkill('eden_hazard');
    expect(rollFail.ok).toBe(false);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(3);
    expect(useCareerStore.getState().career?.players['eden_hazard'].skill2).toBeNull();
    expect(useCareerStore.getState().isRollingSkill).toBe(false);

    // 2. Failed Superstar unlock must preserve isSuperstar=false, balance, and tokens=3
    const ssFail = await useCareerStore.getState().unlockSuperstar('petr_cech');
    expect(ssFail.ok).toBe(false);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(3);
    expect(useCareerStore.getState().career?.players['petr_cech'].isSuperstar).toBe(false);
    expect(useCareerStore.getState().isBusy).toBe(false);

    // 3. Failed Academy creation must preserve tokens=3 and squad size
    const squadSizeBefore = useCareerStore.getState().career?.clubs['chelsea'].squadIds.length;
    const acadFail = await useCareerStore
      .getState()
      .createCustomPlayer(makeAcademyInput('Failed Save Kid'));
    expect(acadFail.ok).toBe(false);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(3);
    expect(useCareerStore.getState().career?.clubs['chelsea'].squadIds.length).toBe(
      squadSizeBefore
    );

    // 4. Failed matchday commit must preserve currentMatchday=1 and tokens=3
    const mdFail = await useCareerStore.getState().commitMatchday();
    expect(mdFail).toBe(false);
    expect(useCareerStore.getState().career?.currentMatchday).toBe(1);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(3);

    // 5. Failed season rollover must preserve completed season state and tokens without duplicate archive
    useCareerStore.setState((s) => ({
      career: s.career
        ? { ...s.career, currentMatchday: s.career.totalMatchdays + 1 }
        : null,
    }));
    const rolloverFail = await useCareerStore.getState().rolloverSeason();
    expect(rolloverFail).toBe(false);
    expect(useCareerStore.getState().career?.currentSeason).toBe('2014/15');
    expect(useCareerStore.getState().career?.seasonHistory).toHaveLength(0);
    expect(useCareerStore.getState().career?.universalSkillTokens).toBe(3);
  });

  it(
    '14 & 15. Maintains balanced multi-season economy, OVR invariants, and position-compatible skills across 3 seasons',
    { timeout: 20000 },
    () => {
    let career = createNewCareer({
      seasonId: '2015/16',
      clubId: 'arsenal',
      managerName: 'Multi Season Audit',
      managerNationality: 'England',
      philosophy: 'Possession',
    });

    const initialOvrs = new Map(
      career.clubs['arsenal'].squadIds.map((id) => [id, career.players[id].overallRating])
    );

    // Unlock 2 squad players at start and check Skill 2 compatibility & zero OVR mutation
    const gkId = career.clubs['arsenal'].squadIds.find(
      (id) => career.players[id].primaryPosition === 'Goalkeeper'
    )!;
    const stId = career.clubs['arsenal'].squadIds.find(
      (id) => career.players[id].primaryPosition === 'Striker'
    )!;

    const uGk = unlockOrRerollSkill2(career, gkId);
    expect(uGk.ok).toBe(true);
    career = uGk.nextState;
    expect(
      getCompatibleSkillsForPosition('Goalkeeper').some((s) => s.id === career.players[gkId].skill2)
    ).toBe(true);
    expect(career.players[gkId].overallRating).toBe(initialOvrs.get(gkId));

    const uSt = unlockOrRerollSkill2(career, stId);
    expect(uSt.ok).toBe(true);
    career = uSt.nextState;
    expect(SKILL_MAP[career.players[stId].skill2!].category).not.toBe('Goalkeeping');
    expect(career.players[stId].overallRating).toBe(initialOvrs.get(stId));

    // Simulate 3 complete seasons
    for (let seasonIdx = 0; seasonIdx < 3; seasonIdx += 1) {
      for (let md = 1; md <= career.totalMatchdays; md += 1) {
        career = advanceMatchday(career);
      }
      const tokensBeforeRoll = career.universalSkillTokens;
      career = advanceToNextSeason(career);
      expect(career.universalSkillTokens).toBeGreaterThanOrEqual(tokensBeforeRoll);
      expect(career.currentMatchday).toBe(1);
    }

    // Over 3 seasons, earned training block tokens <= 9 (max 3 per 18-MD season)
    const trainingClaims = career.claimedSkillTokenRewards.filter((id) =>
      id.startsWith('training_block:')
    );
    expect(trainingClaims.length).toBeLessThanOrEqual(9);
    expect(career.universalSkillTokens).toBeGreaterThanOrEqual(10);
    expect(career.universalSkillTokens).toBeLessThan(60);
    expect(career.seasonHistory).toHaveLength(3);
    expect(new Set(career.claimedSkillTokenRewards).size).toBe(
      career.claimedSkillTokenRewards.length
    );
  });
});
