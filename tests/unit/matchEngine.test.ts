import { describe, expect, it } from 'vitest';
import { buildSeasonDatabase } from '../../src/data/database';
import {
  applyLiveSubstitution,
  createLiveMatchSession,
  finalizeLiveMatchSession,
  simulateMatchQuick,
  stepLiveMatchMinute,
} from '../../src/engine/matchEngine';
import { buildDefaultTactics } from '../../src/engine/tacticsEngine';
import { Fixture } from '../../src/types';

describe('Deterministic Match Simulation Engine', () => {
  const db = buildSeasonDatabase('2014/15');
  const home = db.clubs['chelsea'];
  const away = db.clubs['arsenal'];
  const fixture: Fixture = {
    id: 'test_fix_1',
    competitionId: 'epl',
    seasonId: '2014/15',
    matchday: 1,
    homeClubId: home.id,
    awayClubId: away.id,
    date: '2014-08-16',
    result: null,
    status: 'scheduled',
  };

  it('produces identical results for identical random seed and inputs', () => {
    const r1 = simulateMatchQuick(fixture, home, away, db.players, 424242);
    const r2 = simulateMatchQuick(fixture, home, away, db.players, 424242);

    expect(r1.homeGoals).toBe(r2.homeGoals);
    expect(r1.awayGoals).toBe(r2.awayGoals);
    expect(r1.homeStats).toEqual(r2.homeStats);
    expect(r1.awayStats).toEqual(r2.awayStats);
    expect(r1.events.length).toBe(r2.events.length);
  });

  it('maintains event order, goal consistency with GOAL events, and player stats', () => {
    const res = simulateMatchQuick(fixture, home, away, db.players, 98765);

    expect(res.events[0].type).toBe('KICK_OFF');
    expect(res.events[res.events.length - 1].type).toBe('FULL_TIME');
    expect(res.events.some((e) => e.type === 'HALF_TIME')).toBe(true);

    // Chronological order check
    for (let i = 1; i < res.events.length; i += 1) {
      expect(res.events[i].minute).toBeGreaterThanOrEqual(res.events[i - 1].minute);
    }

    // Score matches exact GOAL events
    const homeGoalEvents = res.events.filter(
      (e) => e.type === 'GOAL' && e.clubId === home.id
    ).length;
    const awayGoalEvents = res.events.filter(
      (e) => e.type === 'GOAL' && e.clubId === away.id
    ).length;

    expect(res.homeGoals).toBe(homeGoalEvents);
    expect(res.awayGoals).toBe(awayGoalEvents);
    expect(res.homeStats.possession + res.awayStats.possession).toBe(100);
    expect(res.playerRatings.length).toBeGreaterThanOrEqual(22);
  });

  it('supports live substitutions during a live match session', () => {
    const homeTac = buildDefaultTactics(home, db.players, '4-3-3');
    const awayTac = buildDefaultTactics(away, db.players, '4-2-3-1');
    const session = createLiveMatchSession(
      fixture,
      home,
      away,
      homeTac,
      awayTac,
      db.players,
      777
    );

    // Advance into first half
    for (let i = 0; i < 25; i += 1) {
      stepLiveMatchMinute(session, 'home');
    }

    const subId = session.home.tactics.substituteIds[1];
    const ok = applyLiveSubstitution(session, 'home', 5, subId);
    expect(ok).toBe(true);
    expect(session.home.tactics.slots[5].playerId).toBe(subId);
    expect(session.events.some((e) => e.type === 'SUBSTITUTION' && e.playerId === subId)).toBe(
      true
    );

    const finalRes = finalizeLiveMatchSession(session);
    expect(finalRes.events[finalRes.events.length - 1].type).toBe('FULL_TIME');
  });
});
