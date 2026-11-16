import { describe, expect, it } from 'vitest';
import { buildSeasonDatabase } from '../../src/data/database';
import { buildDefaultTactics, validateTactics } from '../../src/engine/tacticsEngine';

describe('Squad & Tactical Validation', () => {
  it('builds a valid 11-player starting XI and substitutes for every club', () => {
    const db = buildSeasonDatabase('2014/15');
    const chelsea = db.clubs['chelsea'];
    const tactics = buildDefaultTactics(chelsea, db.players, '4-2-3-1');
    const result = validateTactics(tactics, chelsea, db.players);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(tactics.slots).toHaveLength(11);
    expect(tactics.substituteIds.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects duplicate players in Starting XI', () => {
    const db = buildSeasonDatabase('2014/15');
    const arsenal = db.clubs['arsenal'];
    const tactics = buildDefaultTactics(arsenal, db.players, '4-3-3');

    // Duplicate slot 1 player into slot 2
    tactics.slots[2].playerId = tactics.slots[1].playerId;
    const result = validateTactics(tactics, arsenal, db.players);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('multiple times'))).toBe(true);
  });

  it('requires a natural Goalkeeper in slot 0 and warns on out-of-position outfield players', () => {
    const db = buildSeasonDatabase('2015/16');
    const barca = db.clubs['barcelona'];
    const tactics = buildDefaultTactics(barca, db.players, '4-3-3');

    // Swap GK with striker -> invalid GK
    const gkId = tactics.slots[0].playerId;
    tactics.slots[0].playerId = tactics.slots[9].playerId;
    tactics.slots[9].playerId = gkId;

    const result = validateTactics(tactics, barca, db.players);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Goalkeeper'))).toBe(true);
  });
});
