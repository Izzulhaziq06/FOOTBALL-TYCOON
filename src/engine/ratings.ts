import {
  MentalAttributes,
  PhysicalAttributes,
  Player,
  Position,
  PositionCode,
  TechnicalAttributes,
} from '../types';

export const POSITION_CODES: Record<Position, PositionCode> = {
  Goalkeeper: 'GK',
  'Centre Back': 'CB',
  'Full Back': 'FB',
  'Defensive Midfielder': 'DM',
  'Central Midfielder': 'CM',
  'Attacking Midfielder': 'AM',
  Winger: 'W',
  Striker: 'ST',
};

export const ALL_POSITIONS: Position[] = [
  'Goalkeeper',
  'Centre Back',
  'Full Back',
  'Defensive Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Winger',
  'Striker',
];

type AttributeKey =
  | keyof TechnicalAttributes
  | keyof PhysicalAttributes
  | keyof MentalAttributes;

/**
 * Position-specific attribute weighting tables.
 * Every position has distinct weights summing to 1.00 — never equal-weighted.
 */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  Goalkeeper: {
    goalkeeping: 0.36,
    positioning: 0.16,
    agility: 0.14,
    decisions: 0.10,
    composure: 0.10,
    jumping: 0.08,
    passing: 0.06,
  },
  'Centre Back': {
    tackling: 0.22,
    positioning: 0.18,
    heading: 0.14,
    strength: 0.14,
    jumping: 0.09,
    decisions: 0.08,
    composure: 0.07,
    passing: 0.05,
    pace: 0.03,
  },
  'Full Back': {
    pace: 0.16,
    stamina: 0.14,
    tackling: 0.16,
    crossing: 0.14,
    acceleration: 0.10,
    positioning: 0.10,
    workRate: 0.08,
    passing: 0.07,
    dribbling: 0.05,
  },
  'Defensive Midfielder': {
    tackling: 0.18,
    positioning: 0.16,
    passing: 0.15,
    decisions: 0.13,
    stamina: 0.10,
    workRate: 0.10,
    strength: 0.08,
    composure: 0.06,
    ballControl: 0.04,
  },
  'Central Midfielder': {
    passing: 0.18,
    vision: 0.15,
    ballControl: 0.14,
    decisions: 0.12,
    stamina: 0.11,
    workRate: 0.10,
    dribbling: 0.08,
    tackling: 0.06,
    composure: 0.06,
  },
  'Attacking Midfielder': {
    vision: 0.18,
    passing: 0.17,
    dribbling: 0.16,
    ballControl: 0.15,
    finishing: 0.10,
    shooting: 0.09,
    agility: 0.08,
    composure: 0.07,
  },
  Winger: {
    pace: 0.17,
    acceleration: 0.15,
    dribbling: 0.17,
    crossing: 0.14,
    ballControl: 0.11,
    finishing: 0.09,
    agility: 0.09,
    stamina: 0.04,
    vision: 0.04,
  },
  Striker: {
    finishing: 0.24,
    shooting: 0.16,
    positioning: 0.15,
    composure: 0.11,
    pace: 0.10,
    ballControl: 0.08,
    heading: 0.08,
    strength: 0.05,
    dribbling: 0.03,
  },
};

function getAttributeValue(
  tech: TechnicalAttributes,
  phys: PhysicalAttributes,
  ment: MentalAttributes,
  key: AttributeKey
): number {
  if (key === 'goalkeeping') {
    return tech.goalkeeping ?? Math.round((ment.positioning + phys.agility + ment.composure) / 3);
  }
  if (key in tech) return (tech as unknown as Record<string, number>)[key] ?? 50;
  if (key in phys) return (phys as unknown as Record<string, number>)[key] ?? 50;
  if (key in ment) return (ment as unknown as Record<string, number>)[key] ?? 50;
  return 50;
}

export function calculateOverallRating(
  position: Position,
  technical: TechnicalAttributes,
  physical: PhysicalAttributes,
  mental: MentalAttributes
): number {
  const weights = POSITION_WEIGHTS[position];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (typeof weight === 'number') {
      const value = getAttributeValue(technical, physical, mental, key as AttributeKey);
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight <= 0) return 60;
  return Math.max(35, Math.min(99, Math.round(weightedSum / totalWeight)));
}

export function calculateEffectiveRatingForSlot(player: Player, slotPosition: Position): number {
  if (player.primaryPosition === slotPosition) {
    return player.overallRating;
  }
  if (player.secondaryPositions.includes(slotPosition)) {
    return Math.max(35, Math.round(player.overallRating * 0.94));
  }
  // Goalkeeper out of goal or outfield player in goal suffers severe penalty
  if (player.primaryPosition === 'Goalkeeper' || slotPosition === 'Goalkeeper') {
    return Math.max(25, Math.round(player.overallRating * 0.42));
  }
  const slotOvr = calculateOverallRating(
    slotPosition,
    player.technicalAttributes,
    player.physicalAttributes,
    player.mentalAttributes
  );
  return Math.max(35, Math.round(slotOvr * 0.84));
}

export function isNaturalOrSecondaryPosition(player: Player, slotPosition: Position): boolean {
  return (
    player.primaryPosition === slotPosition ||
    player.secondaryPositions.includes(slotPosition)
  );
}

export function estimateMarketValue(overall: number, age: number, potential: number): number {
  const base = Math.pow(Math.max(1, overall - 54), 2.35) * 9200;
  const ageFactor =
    age <= 21 ? 1.28 : age <= 25 ? 1.18 : age <= 28 ? 1.02 : age <= 31 ? 0.72 : 0.4;
  const potentialBonus = Math.max(0, potential - overall) * 280000;
  const raw = base * ageFactor + potentialBonus;
  return Math.max(250000, Math.round(raw / 100000) * 100000);
}

export function estimateWeeklyWage(overall: number, clubReputation: number): number {
  const base = Math.pow(Math.max(1, overall - 55), 1.98) * 145;
  const repMultiplier = 0.75 + clubReputation / 200;
  return Math.max(2500, Math.round((base * repMultiplier) / 500) * 500);
}
