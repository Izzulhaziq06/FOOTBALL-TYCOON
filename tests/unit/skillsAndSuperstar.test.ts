import { describe, expect, it } from 'vitest';
import { buildSeasonDatabase } from '../../src/data/database';
import {
  createAcademyPlayer,
  createNewCareer,
  getAcademyAttributeCap,
  unlockPlayerSuperstar,
  updatePlayerSkills,
} from '../../src/engine/careerEngine';
import {
  createLiveMatchSession,
  finalizeLiveMatchSession,
  simulateMatchQuick,
  stepLiveMatchMinute,
} from '../../src/engine/matchEngine';
import { calculateOverallRating } from '../../src/engine/ratings';
import {
  checkSuperstarUnlockEligibility,
  POSITION_SKILL_RECOMMENDATIONS,
  SKILL_CATALOGUE,
  validateSkillPair,
} from '../../src/engine/skills';
import { buildDefaultTactics } from '../../src/engine/tacticsEngine';
import { ALL_POSITIONS } from '../../src/engine/ratings';
import { Fixture, Player } from '../../src/types';

describe('25-Skill Playstyle System & Superstar Balance', () => {
  it('defines exactly 25 unique playstyle skills and valid recommendations for all 8 positions', () => {
    expect(SKILL_CATALOGUE).toHaveLength(25);
    const ids = new Set(SKILL_CATALOGUE.map((s) => s.id));
    expect(ids.size).toBe(25);

    for (const pos of ALL_POSITIONS) {
      const recs = POSITION_SKILL_RECOMMENDATIONS[pos];
      expect(recs.length).toBeGreaterThanOrEqual(2);
      for (const [s1, s2] of recs) {
        expect(validateSkillPair(s1, s2).valid).toBe(true);
        expect(s1).not.toBe(s2);
      }
    }
  });

  it('prevents duplicate skill selection and preserves base OVR when changing skills', () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Alex Reid',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    const hazardId = 'eden_hazard';
    const beforeOvr = career.players[hazardId].overallRating;

    const dup = updatePlayerSkills(career, hazardId, 'dribbling', 'dribbling');
    expect(dup.ok).toBe(false);
    expect(dup.error).toContain('cannot be the same');

    const ok = updatePlayerSkills(career, hazardId, 'creativity', 'free_kicks');
    expect(ok.ok).toBe(true);
    expect(ok.nextState.players[hazardId].skill1).toBe('creativity');
    expect(ok.nextState.players[hazardId].skill2).toBe('free_kicks');
    expect(ok.nextState.players[hazardId].overallRating).toBe(beforeOvr);
  });

  it('enforces Academy attribute caps and career-only Superstar unlock rules', () => {
    let career = createNewCareer({
      seasonId: '2015/16',
      clubId: 'arsenal',
      managerName: 'Manager Test',
      managerNationality: 'France',
      philosophy: 'Possession',
    });

    const club = career.clubs['arsenal'];
    const tierCap = getAcademyAttributeCap(club.facilities.youthAcademy);

    const created = createAcademyPlayer(career, {
      fullName: 'Julian Sterling-Hayes',
      nationality: 'England',
      age: 18,
      primaryPosition: 'Central Midfielder',
      secondaryPositions: ['Attacking Midfielder'],
      preferredFoot: 'Right',
      technicalAttributes: {
        passing: 99,
        shooting: 99,
        finishing: 99,
        dribbling: 99,
        crossing: 99,
        tackling: 99,
        ballControl: 99,
        heading: 99,
        goalkeeping: 20,
      },
      physicalAttributes: {
        pace: 99,
        acceleration: 99,
        stamina: 99,
        strength: 99,
        agility: 99,
        jumping: 99,
      },
      mentalAttributes: {
        vision: 99,
        positioning: 99,
        decisions: 99,
        composure: 99,
        leadership: 99,
        workRate: 99,
      },
      skill1: 'passing',
      skill2: 'creativity',
      grantSuperstar: false,
    });

    expect(created.ok).toBe(true);
    expect(created.player).toBeDefined();
    expect(created.player!.technicalAttributes.passing).toBeLessThanOrEqual(tierCap);
    expect(created.player!.isCustomAcademyPlayer).toBe(true);
    expect(created.player!.skill1).toBe('passing');
    expect(created.player!.skill2).toBe('creativity');

    career = created.nextState;
    // Superstar unlock requires Tier 3+ facility; verify west_ham (Tier < 3) is blocked
    const lowTierCareer = createNewCareer({
      seasonId: '2015/16',
      clubId: 'west_ham',
      managerName: 'Tier Test',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });
    const lowTierPlayer = Object.values(lowTierCareer.players).find(
      (p) => p.clubId === 'west_ham' && !p.isSuperstar
    )!;
    const eligCheck = checkSuperstarUnlockEligibility(
      lowTierPlayer,
      lowTierCareer.clubs['west_ham']
    );
    expect(eligCheck.eligible).toBe(false);

    // Elevate an 82+ OVR player with Tier 3+ training ground
    const boostedCareer = {
      ...career,
      clubs: {
        ...career.clubs,
        arsenal: {
          ...career.clubs['arsenal'],
          balance: 20_000_000,
          facilities: { ...career.clubs['arsenal'].facilities, trainingGround: 3 },
        },
      },
    };
    const highOvrPid = boostedCareer.clubs['arsenal'].squadIds.find(
      (id) =>
        boostedCareer.players[id].overallRating >= 82 && !boostedCareer.players[id].isSuperstar
    );
    if (highOvrPid) {
      const unlockRes = unlockPlayerSuperstar(boostedCareer, highOvrPid);
      expect(unlockRes.ok).toBe(true);
      expect(unlockRes.nextState.players[highOvrPid].isSuperstar).toBe(true);
      expect(unlockRes.nextState.clubs['arsenal'].balance).toBe(17_500_000);
    }
  });

  it('produces identical Quick vs Live results with same seed, 1:1 corner events, and userSide respect', () => {
    const db = buildSeasonDatabase('2014/15');
    const home = db.clubs['chelsea'];
    const away = db.clubs['arsenal'];
    const homeTac = buildDefaultTactics(home, db.players, '4-3-3');
    const awayTac = buildDefaultTactics(away, db.players, '4-2-3-1');
    const fixture: Fixture = {
      id: 'parity_fix',
      competitionId: 'epl',
      seasonId: '2014/15',
      matchday: 1,
      homeClubId: home.id,
      awayClubId: away.id,
      date: '2014-08-16',
      result: null,
      status: 'scheduled',
    };

    const quick = simulateMatchQuick(fixture, home, away, db.players, 5150, homeTac, awayTac);
    const live = createLiveMatchSession(fixture, home, away, homeTac, awayTac, db.players, 5150);
    // Do NOT pass userSide so quick AI auto-sub parity matches quick sim
    const liveResult = finalizeLiveMatchSession(live);

    expect(liveResult.homeGoals).toBe(quick.homeGoals);
    expect(liveResult.awayGoals).toBe(quick.awayGoals);
    expect(liveResult.homeStats).toEqual(quick.homeStats);
    expect(liveResult.awayStats).toEqual(quick.awayStats);

    // 1:1 corner stats vs CORNER events
    const homeCorners = quick.events.filter(
      (e) => e.type === 'CORNER' && e.clubId === home.id
    ).length;
    const awayCorners = quick.events.filter(
      (e) => e.type === 'CORNER' && e.clubId === away.id
    ).length;
    expect(quick.homeStats.corners).toBe(homeCorners);
    expect(quick.awayStats.corners).toBe(awayCorners);

    // Live session with userSide='home' should not auto-sub for home
    const userLive = createLiveMatchSession(fixture, home, away, homeTac, awayTac, db.players, 5150);
    for (let i = 0; i < 120; i += 1) {
      stepLiveMatchMinute(userLive, 'home');
    }
    expect(userLive.homeSubsUsed).toBe(0);
  });

  it('balances Superstar and Skills so low-OVR Superstar squads do not outperform high-OVR squads', () => {
    const db = buildSeasonDatabase('2016/17');
    const strongClub = db.clubs['real_madrid'];
    const weakClub = db.clubs['udinese'];

    const modifiedPlayers: Record<string, Player> = structuredClone(db.players);
    for (const pid of strongClub.squadIds) {
      modifiedPlayers[pid].isSuperstar = false;
      modifiedPlayers[pid].skill1 = null;
      modifiedPlayers[pid].skill2 = null;
    }
    for (const pid of weakClub.squadIds) {
      modifiedPlayers[pid].isSuperstar = true;
      modifiedPlayers[pid].skill1 = 'shooting';
      modifiedPlayers[pid].skill2 = 'dribbling';
    }

    let strongPoints = 0;
    let weakPoints = 0;
    for (let s = 1; s <= 12; s += 1) {
      const fix: Fixture = {
        id: `bal_${s}`,
        competitionId: 'ucl',
        seasonId: '2016/17',
        matchday: s,
        homeClubId: s % 2 === 0 ? strongClub.id : weakClub.id,
        awayClubId: s % 2 === 0 ? weakClub.id : strongClub.id,
        date: '2016-09-10',
        result: null,
        status: 'scheduled',
      };
      const res = simulateMatchQuick(
        fix,
        db.clubs[fix.homeClubId],
        db.clubs[fix.awayClubId],
        modifiedPlayers,
        1000 + s * 37
      );
      const strongGoals = fix.homeClubId === strongClub.id ? res.homeGoals : res.awayGoals;
      const weakGoals = fix.homeClubId === weakClub.id ? res.homeGoals : res.awayGoals;
      if (strongGoals > weakGoals) strongPoints += 3;
      else if (strongGoals === weakGoals) {
        strongPoints += 1;
        weakPoints += 1;
      } else {
        weakPoints += 3;
      }
    }

    expect(strongPoints).toBeGreaterThan(weakPoints);
  });

  it('verifies endurance skill reduces late-match stamina drain', () => {
    const db = buildSeasonDatabase('2015/16');
    const home = db.clubs['chelsea'];
    const away = db.clubs['arsenal'];
    const homeTac = buildDefaultTactics(home, db.players, '4-3-3');
    const awayTac = buildDefaultTactics(away, db.players, '4-3-3');
    const testPid = homeTac.slots[7].playerId!;

    const playersNoEndurance = structuredClone(db.players);
    playersNoEndurance[testPid].skill1 = null;
    playersNoEndurance[testPid].skill2 = null;

    const playersWithEndurance = structuredClone(db.players);
    playersWithEndurance[testPid].skill1 = 'endurance';
    playersWithEndurance[testPid].skill2 = null;

    const fix: Fixture = {
      id: 'endurance_check',
      competitionId: 'epl',
      seasonId: '2015/16',
      matchday: 1,
      homeClubId: home.id,
      awayClubId: away.id,
      date: '2015-08-15',
      result: null,
      status: 'scheduled',
    };

    const s1 = createLiveMatchSession(fix, home, away, homeTac, awayTac, playersNoEndurance, 444);
    const s2 = createLiveMatchSession(fix, home, away, homeTac, awayTac, playersWithEndurance, 444);

    for (let i = 0; i < 65; i += 1) {
      stepLiveMatchMinute(s1, 'home');
      stepLiveMatchMinute(s2, 'home');
    }

    expect(s2.stamina[testPid]).toBeGreaterThan(s1.stamina[testPid]);
  });

  it('enforces both intentional Superstar paths cleanly without bypasses', () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Gate Tester',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    // Path 1: 78+ OVR with 85+ POT requires at least 5 appearances
    const petrCech = career.players['petr_cech']; // 80 OVR, 87 POT, 0 apps
    expect(petrCech.overallRating).toBeGreaterThanOrEqual(78);
    expect(petrCech.overallRating).toBeLessThan(82);
    expect(petrCech.potential).toBeGreaterThanOrEqual(85);
    expect(checkSuperstarUnlockEligibility(petrCech, career.clubs['chelsea']).eligible).toBe(false);

    const with5AppsCareer = {
      ...career,
      players: {
        ...career.players,
        petr_cech: {
          ...petrCech,
          seasonStats: { ...petrCech.seasonStats, appearances: 5 },
        },
      },
    };
    const path1Unlock = unlockPlayerSuperstar(with5AppsCareer, 'petr_cech');
    expect(path1Unlock.ok).toBe(true);
    expect(path1Unlock.nextState.players['petr_cech'].isSuperstar).toBe(true);
    expect(path1Unlock.nextState.clubs['chelsea'].balance).toBe(
      career.clubs['chelsea'].balance - 2_500_000
    );

    // Path 2: Youth Academy Tier 3+ requires 74+ OVR graduate for Superstar promotion
    const academyTooLow = createAcademyPlayer(career, {
      fullName: 'Low OVR Prospect',
      nationality: 'England',
      age: 17,
      primaryPosition: 'Central Midfielder',
      secondaryPositions: [],
      preferredFoot: 'Right',
      technicalAttributes: {
        passing: 65,
        shooting: 60,
        finishing: 60,
        dribbling: 65,
        crossing: 60,
        tackling: 60,
        ballControl: 65,
        heading: 60,
        goalkeeping: 20,
      },
      physicalAttributes: {
        pace: 65,
        acceleration: 65,
        stamina: 65,
        strength: 65,
        agility: 65,
        jumping: 65,
      },
      mentalAttributes: {
        vision: 65,
        positioning: 65,
        decisions: 65,
        composure: 65,
        leadership: 65,
        workRate: 65,
      },
      skill1: 'passing',
      skill2: 'control',
      grantSuperstar: true,
    });
    expect(academyTooLow.ok).toBe(false);
    expect(academyTooLow.error).toContain('74 OVR');
  });
});
