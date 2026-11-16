import {
  Club,
  ClubTactics,
  FormationName,
  Player,
  Position,
  TacticalSlot,
} from '../types';
import {
  calculateEffectiveRatingForSlot,
  isNaturalOrSecondaryPosition,
} from './ratings';

export interface FormationSlotTemplate {
  slotIndex: number;
  rolePosition: Position;
  label: string;
  x: number;
  y: number;
}

export const ALL_FORMATIONS: FormationName[] = [
  '4-3-3',
  '4-2-3-1',
  '4-4-2',
  '4-1-4-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '4-3-1-2',
];

export const FORMATION_TEMPLATES: Record<FormationName, FormationSlotTemplate[]> = {
  '4-3-3': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LB', x: 16, y: 71 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 38, y: 74 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 62, y: 74 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'RB', x: 84, y: 71 },
    { slotIndex: 5, rolePosition: 'Defensive Midfielder', label: 'DM', x: 50, y: 55 },
    { slotIndex: 6, rolePosition: 'Central Midfielder', label: 'LCM', x: 31, y: 46 },
    { slotIndex: 7, rolePosition: 'Central Midfielder', label: 'RCM', x: 69, y: 46 },
    { slotIndex: 8, rolePosition: 'Winger', label: 'LW', x: 20, y: 24 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'ST', x: 50, y: 17 },
    { slotIndex: 10, rolePosition: 'Winger', label: 'RW', x: 80, y: 24 },
  ],
  '4-2-3-1': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LB', x: 16, y: 72 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 38, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 62, y: 75 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'RB', x: 84, y: 72 },
    { slotIndex: 5, rolePosition: 'Defensive Midfielder', label: 'LDM', x: 37, y: 56 },
    { slotIndex: 6, rolePosition: 'Defensive Midfielder', label: 'RDM', x: 63, y: 56 },
    { slotIndex: 7, rolePosition: 'Winger', label: 'LAM', x: 20, y: 36 },
    { slotIndex: 8, rolePosition: 'Attacking Midfielder', label: 'CAM', x: 50, y: 36 },
    { slotIndex: 9, rolePosition: 'Winger', label: 'RAM', x: 80, y: 36 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'ST', x: 50, y: 17 },
  ],
  '4-4-2': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LB', x: 16, y: 72 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 38, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 62, y: 75 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'RB', x: 84, y: 72 },
    { slotIndex: 5, rolePosition: 'Winger', label: 'LM', x: 17, y: 47 },
    { slotIndex: 6, rolePosition: 'Central Midfielder', label: 'LCM', x: 39, y: 50 },
    { slotIndex: 7, rolePosition: 'Central Midfielder', label: 'RCM', x: 61, y: 50 },
    { slotIndex: 8, rolePosition: 'Winger', label: 'RM', x: 83, y: 47 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'LST', x: 38, y: 20 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'RST', x: 62, y: 20 },
  ],
  '4-1-4-1': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LB', x: 16, y: 72 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 38, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 62, y: 75 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'RB', x: 84, y: 72 },
    { slotIndex: 5, rolePosition: 'Defensive Midfielder', label: 'CDM', x: 50, y: 58 },
    { slotIndex: 6, rolePosition: 'Winger', label: 'LM', x: 17, y: 39 },
    { slotIndex: 7, rolePosition: 'Central Midfielder', label: 'LCM', x: 39, y: 41 },
    { slotIndex: 8, rolePosition: 'Central Midfielder', label: 'RCM', x: 61, y: 41 },
    { slotIndex: 9, rolePosition: 'Winger', label: 'RM', x: 83, y: 39 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'ST', x: 50, y: 17 },
  ],
  '3-5-2': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Centre Back', label: 'LCB', x: 26, y: 73 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'CCB', x: 50, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 74, y: 73 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'LWB', x: 14, y: 49 },
    { slotIndex: 5, rolePosition: 'Defensive Midfielder', label: 'CDM', x: 50, y: 55 },
    { slotIndex: 6, rolePosition: 'Central Midfielder', label: 'LCM', x: 33, y: 44 },
    { slotIndex: 7, rolePosition: 'Central Midfielder', label: 'RCM', x: 67, y: 44 },
    { slotIndex: 8, rolePosition: 'Full Back', label: 'RWB', x: 86, y: 49 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'LST', x: 38, y: 20 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'RST', x: 62, y: 20 },
  ],
  '3-4-3': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Centre Back', label: 'LCB', x: 26, y: 73 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'CCB', x: 50, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 74, y: 73 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'LM', x: 15, y: 49 },
    { slotIndex: 5, rolePosition: 'Central Midfielder', label: 'LCM', x: 39, y: 51 },
    { slotIndex: 6, rolePosition: 'Central Midfielder', label: 'RCM', x: 61, y: 51 },
    { slotIndex: 7, rolePosition: 'Full Back', label: 'RM', x: 85, y: 49 },
    { slotIndex: 8, rolePosition: 'Winger', label: 'LW', x: 21, y: 24 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'ST', x: 50, y: 17 },
    { slotIndex: 10, rolePosition: 'Winger', label: 'RW', x: 79, y: 24 },
  ],
  '5-3-2': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LWB', x: 14, y: 66 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 32, y: 74 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'CCB', x: 50, y: 76 },
    { slotIndex: 4, rolePosition: 'Centre Back', label: 'RCB', x: 68, y: 74 },
    { slotIndex: 5, rolePosition: 'Full Back', label: 'RWB', x: 86, y: 66 },
    { slotIndex: 6, rolePosition: 'Central Midfielder', label: 'LCM', x: 32, y: 47 },
    { slotIndex: 7, rolePosition: 'Defensive Midfielder', label: 'CM', x: 50, y: 51 },
    { slotIndex: 8, rolePosition: 'Central Midfielder', label: 'RCM', x: 68, y: 47 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'LST', x: 38, y: 20 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'RST', x: 62, y: 20 },
  ],
  '4-3-1-2': [
    { slotIndex: 0, rolePosition: 'Goalkeeper', label: 'GK', x: 50, y: 89 },
    { slotIndex: 1, rolePosition: 'Full Back', label: 'LB', x: 16, y: 72 },
    { slotIndex: 2, rolePosition: 'Centre Back', label: 'LCB', x: 38, y: 75 },
    { slotIndex: 3, rolePosition: 'Centre Back', label: 'RCB', x: 62, y: 75 },
    { slotIndex: 4, rolePosition: 'Full Back', label: 'RB', x: 84, y: 72 },
    { slotIndex: 5, rolePosition: 'Central Midfielder', label: 'LCM', x: 28, y: 52 },
    { slotIndex: 6, rolePosition: 'Defensive Midfielder', label: 'CDM', x: 50, y: 56 },
    { slotIndex: 7, rolePosition: 'Central Midfielder', label: 'RCM', x: 72, y: 52 },
    { slotIndex: 8, rolePosition: 'Attacking Midfielder', label: 'CAM', x: 50, y: 36 },
    { slotIndex: 9, rolePosition: 'Striker', label: 'LST', x: 38, y: 19 },
    { slotIndex: 10, rolePosition: 'Striker', label: 'RST', x: 62, y: 19 },
  ],
};

export interface OutOfPositionWarning {
  slotIndex: number;
  slotLabel: string;
  requiredPosition: Position;
  playerId: string;
  playerName: string;
  playerPrimaryPosition: Position;
  severity: 'minor' | 'major';
}

export interface TacticsValidationResult {
  valid: boolean;
  errors: string[];
  outOfPositionWarnings: OutOfPositionWarning[];
  effectiveTeamRating: number;
}

export function buildBestLineupForFormation(
  club: Club,
  playersMap: Record<string, Player>,
  formation: FormationName = '4-3-3'
): { slots: TacticalSlot[]; substituteIds: string[] } {
  const templates = FORMATION_TEMPLATES[formation];
  const available = club.squadIds
    .map((id) => playersMap[id])
    .filter((p): p is Player => Boolean(p) && p.injuryWeeks === 0);

  const fallbackPool =
    available.length >= 11
      ? available
      : club.squadIds.map((id) => playersMap[id]).filter((p): p is Player => Boolean(p));

  const usedIds = new Set<string>();
  const slots: TacticalSlot[] = templates.map((tpl) => ({
    ...tpl,
    playerId: null,
  }));

  // First pass: assign Goalkeeper slot (0)
  const gkCandidates = [...fallbackPool].sort(
    (a, b) =>
      calculateEffectiveRatingForSlot(b, 'Goalkeeper') -
      calculateEffectiveRatingForSlot(a, 'Goalkeeper')
  );
  if (gkCandidates[0]) {
    slots[0].playerId = gkCandidates[0].id;
    usedIds.add(gkCandidates[0].id);
  }

  // Second pass: assign natural primary position matches first
  for (let i = 1; i < slots.length; i += 1) {
    const slot = slots[i];
    const candidates = fallbackPool
      .filter((p) => !usedIds.has(p.id) && p.primaryPosition === slot.rolePosition)
      .sort((a, b) => b.overallRating - a.overallRating);

    if (candidates[0]) {
      slot.playerId = candidates[0].id;
      usedIds.add(candidates[0].id);
    }
  }

  // Third pass: assign best effective rating for any remaining open slots
  for (let i = 1; i < slots.length; i += 1) {
    const slot = slots[i];
    if (slot.playerId) continue;

    const candidates = fallbackPool
      .filter((p) => !usedIds.has(p.id))
      .sort(
        (a, b) =>
          calculateEffectiveRatingForSlot(b, slot.rolePosition) -
          calculateEffectiveRatingForSlot(a, slot.rolePosition)
      );

    if (candidates[0]) {
      slot.playerId = candidates[0].id;
      usedIds.add(candidates[0].id);
    }
  }

  const substituteIds = fallbackPool
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => {
      // Ensure at least one GK on the bench if available
      if (a.primaryPosition === 'Goalkeeper' && b.primaryPosition !== 'Goalkeeper') return -1;
      if (b.primaryPosition === 'Goalkeeper' && a.primaryPosition !== 'Goalkeeper') return 1;
      return b.overallRating - a.overallRating;
    })
    .slice(0, 7)
    .map((p) => p.id);

  return { slots, substituteIds };
}

export function buildDefaultTactics(
  club: Club,
  playersMap: Record<string, Player>,
  formation: FormationName = '4-3-3'
): ClubTactics {
  const { slots, substituteIds } = buildBestLineupForFormation(club, playersMap, formation);
  const starters = slots
    .map((s) => (s.playerId ? playersMap[s.playerId] : null))
    .filter((p): p is Player => Boolean(p));

  const captain =
    [...starters].sort((a, b) => b.mentalAttributes.leadership - a.mentalAttributes.leadership)[0]
      ?.id ??
    starters[0]?.id ??
    null;

  const outfield = starters.filter((p) => p.primaryPosition !== 'Goalkeeper');
  const penaltyTaker =
    [...outfield].sort(
      (a, b) =>
        b.technicalAttributes.finishing +
        b.mentalAttributes.composure -
        (a.technicalAttributes.finishing + a.mentalAttributes.composure)
    )[0]?.id ?? captain;

  const freeKickTaker =
    [...outfield].sort(
      (a, b) =>
        b.technicalAttributes.shooting +
        b.technicalAttributes.passing -
        (a.technicalAttributes.shooting + a.technicalAttributes.passing)
    )[0]?.id ?? captain;

  const cornerTaker =
    [...outfield].sort(
      (a, b) =>
        b.technicalAttributes.crossing +
        b.technicalAttributes.passing -
        (a.technicalAttributes.crossing + a.technicalAttributes.passing)
    )[0]?.id ?? captain;

  return {
    formation,
    slots,
    substituteIds,
    captainId: captain,
    penaltyTakerId: penaltyTaker,
    freeKickTakerId: freeKickTaker,
    cornerTakerId: cornerTaker,
    mentality: 'Balanced',
    pressing: 'Medium',
    defensiveLine: 'Balanced',
    passing: 'Mixed',
    width: 'Balanced',
    tempo: 'Balanced',
  };
}

export function validateTactics(
  tactics: ClubTactics,
  club: Club,
  playersMap: Record<string, Player>
): TacticsValidationResult {
  const errors: string[] = [];
  const outOfPositionWarnings: OutOfPositionWarning[] = [];

  if (tactics.slots.length !== 11) {
    errors.push(`Starting XI must have exactly 11 slots (found ${tactics.slots.length}).`);
  }

  const starterIds: string[] = [];
  const starterSet = new Set<string>();
  const clubSquadSet = new Set(club.squadIds);
  let effectiveSum = 0;

  for (const slot of tactics.slots) {
    if (!slot.playerId) {
      errors.push(`Slot ${slot.label} (${slot.rolePosition}) has no assigned player.`);
      continue;
    }

    const player = playersMap[slot.playerId];
    if (!player) {
      errors.push(`Slot ${slot.label} references unknown player "${slot.playerId}".`);
      continue;
    }

    if (!clubSquadSet.has(player.id) || player.clubId !== club.id) {
      errors.push(`${player.fullName} does not belong to ${club.name}'s active squad.`);
    }

    if (player.injuryWeeks > 0) {
      errors.push(`${player.fullName} is injured (${player.injuryWeeks}w remaining) and cannot start.`);
    }

    if (starterSet.has(player.id)) {
      errors.push(`${player.fullName} is assigned multiple times in the Starting XI.`);
    } else {
      starterSet.add(player.id);
      starterIds.push(player.id);
    }

    if (slot.slotIndex === 0 && player.primaryPosition !== 'Goalkeeper') {
      errors.push(`Slot GK requires a Goalkeeper (${player.fullName} is a ${player.primaryPosition}).`);
    }

    const effective = calculateEffectiveRatingForSlot(player, slot.rolePosition);
    effectiveSum += effective;

    if (player.primaryPosition !== slot.rolePosition) {
      const isSecondary = isNaturalOrSecondaryPosition(player, slot.rolePosition);
      outOfPositionWarnings.push({
        slotIndex: slot.slotIndex,
        slotLabel: slot.label,
        requiredPosition: slot.rolePosition,
        playerId: player.id,
        playerName: player.fullName,
        playerPrimaryPosition: player.primaryPosition,
        severity: isSecondary ? 'minor' : 'major',
      });
    }
  }

  if (starterSet.size !== 11 && errors.length === 0) {
    errors.push('Starting XI must contain 11 unique players.');
  }

  const subSet = new Set<string>();
  for (const subId of tactics.substituteIds) {
    if (starterSet.has(subId)) {
      const p = playersMap[subId];
      errors.push(`${p?.fullName ?? subId} cannot be in both Starting XI and Substitutes.`);
    }
    if (subSet.has(subId)) {
      errors.push(`Duplicate substitute player detected.`);
    }
    if (!clubSquadSet.has(subId)) {
      errors.push(`Substitute "${subId}" does not belong to active squad.`);
    }
    subSet.add(subId);
  }

  return {
    valid: errors.length === 0,
    errors,
    outOfPositionWarnings,
    effectiveTeamRating: tactics.slots.length > 0 ? Math.round(effectiveSum / tactics.slots.length) : 0,
  };
}
