import { Club, Player, Position } from '../types';

export type SkillCategory =
  | 'Goalkeeping'
  | 'Defending'
  | 'Midfield'
  | 'Attacking'
  | 'Physical'
  | 'Team Influence'
  | 'Aerial Play';

export type SkillId =
  | 'saves'
  | 'reflexes'
  | 'gk_aerial'
  | 'anticipation'
  | 'gk_positioning'
  | 'tackling'
  | 'marking'
  | 'aggressiveness'
  | 'ball_recovery'
  | 'passing'
  | 'creativity'
  | 'intelligence'
  | 'control'
  | 'technique'
  | 'shooting'
  | 'dribbling'
  | 'att_positioning'
  | 'free_kicks'
  | 'speed'
  | 'endurance'
  | 'strength'
  | 'physique'
  | 'agility'
  | 'leadership'
  | 'heading';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  category: SkillCategory;
  description: string;
  recommendedPositions: Position[];
  simulationEffectSummary: string;
  effectStrength: number; // Balanced 0.04 - 0.08 modifier scale
  blueCompatible: true;
  purpleCompatible: true;
  originNote: 'FOOTBALL TYCOON Original Skill Definition';
}

export const SKILL_CATALOGUE: SkillDefinition[] = [
  // ======================== GOALKEEPING (5) ========================
  {
    id: 'saves',
    name: 'Saves',
    category: 'Goalkeeping',
    description: 'Clean shot-stopping technique that reduces opponent conversion on placed efforts.',
    recommendedPositions: ['Goalkeeper'],
    simulationEffectSummary: '+5.5% goalkeeper save conversion on shots on target.',
    effectStrength: 0.055,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'reflexes',
    name: 'Reflexes',
    category: 'Goalkeeping',
    description: 'Explosive close-range reaction speed against high-xG strikes inside the box.',
    recommendedPositions: ['Goalkeeper'],
    simulationEffectSummary: '+6.0% reaction save probability on close-range & high-xG chances.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'gk_aerial',
    name: 'Aerial Ability',
    category: 'Goalkeeping',
    description: 'Command of the penalty box in aerial duels, corners, and high deliveries.',
    recommendedPositions: ['Goalkeeper', 'Centre Back'],
    simulationEffectSummary: '+6.0% aerial duel & corner cross claiming resistance.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'anticipation',
    name: 'Anticipation',
    category: 'Goalkeeping',
    description: 'Reads through-balls early to narrow angles before attackers strike.',
    recommendedPositions: ['Goalkeeper', 'Defensive Midfielder', 'Centre Back'],
    simulationEffectSummary: '+4.5% early danger interception and 1v1 shot suppression.',
    effectStrength: 0.045,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'gk_positioning',
    name: 'GK Positioning',
    category: 'Goalkeeping',
    description: 'Disciplined goal-line alignment that lowers expected-goal danger on open shots.',
    recommendedPositions: ['Goalkeeper'],
    simulationEffectSummary: '-5.0% opponent shot quality when guarding the net.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== DEFENDING (4) ========================
  {
    id: 'tackling',
    name: 'Tackling',
    category: 'Defending',
    description: 'Well-timed standing and sliding challenges that win duels without conceding fouls.',
    recommendedPositions: ['Centre Back', 'Defensive Midfielder', 'Full Back'],
    simulationEffectSummary: '+5.5% defensive challenge disruption and lower card risk.',
    effectStrength: 0.055,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'marking',
    name: 'Marking',
    category: 'Defending',
    description: 'Persistent man-to-man tracking that denies space to forwards inside the box.',
    recommendedPositions: ['Centre Back', 'Full Back', 'Defensive Midfielder'],
    simulationEffectSummary: '-5.5% opponent shot quality (xG) on marked attacking moves.',
    effectStrength: 0.055,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'aggressiveness',
    name: 'Aggressiveness',
    category: 'Defending',
    description: 'High-intensity pressing challenges that break opponent rhythm with added foul risk.',
    recommendedPositions: ['Defensive Midfielder', 'Centre Back', 'Full Back'],
    simulationEffectSummary: '+6.0% pressing duel disruption with +10% tactical foul risk.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'ball_recovery',
    name: 'Ball Recovery',
    category: 'Defending',
    description: 'Quick anticipation of loose balls and interceptions to reclaim team possession.',
    recommendedPositions: ['Full Back', 'Defensive Midfielder', 'Central Midfielder'],
    simulationEffectSummary: '+5.0% possession regain and turnover-suppression weight.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== MIDFIELD (5) ========================
  {
    id: 'passing',
    name: 'Passing',
    category: 'Midfield',
    description: 'Crisp ball distribution under pressure that sustains possession and tempo.',
    recommendedPositions: ['Central Midfielder', 'Defensive Midfielder', 'Full Back', 'Attacking Midfielder'],
    simulationEffectSummary: '+6.0% build-up pass completions and midfield possession weight.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'creativity',
    name: 'Creativity',
    category: 'Midfield',
    description: 'Line-breaking vision that unlocks compact defenses with progressive key passes.',
    recommendedPositions: ['Attacking Midfielder', 'Central Midfielder'],
    simulationEffectSummary: '+7.0% chance-creation & assist probability on attacking moves.',
    effectStrength: 0.07,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    category: 'Midfield',
    description: 'Reads space between the lines to stabilize transitions and positional discipline.',
    recommendedPositions: ['Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder'],
    simulationEffectSummary: '+4.5% balanced midfield control and transition selection.',
    effectStrength: 0.045,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'control',
    name: 'Control',
    category: 'Midfield',
    description: 'Velvet first touch in congested zones that resists high-pressing traps.',
    recommendedPositions: ['Central Midfielder', 'Attacking Midfielder'],
    simulationEffectSummary: '+5.0% press resistance and possession retention in midfield.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'technique',
    name: 'Technique',
    category: 'Midfield',
    description: 'Refined ball mastery that elevates execution on complex passes and finishes.',
    recommendedPositions: ['Central Midfielder', 'Attacking Midfielder', 'Winger'],
    simulationEffectSummary: '+5.0% execution quality on key passes and technical shots.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== ATTACKING (4) ========================
  {
    id: 'shooting',
    name: 'Shooting',
    category: 'Attacking',
    description: 'Clean ball-striking mechanics that raise shot accuracy and testing strikes.',
    recommendedPositions: ['Striker', 'Winger', 'Attacking Midfielder'],
    simulationEffectSummary: '+6.0% shots on target conversion probability.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'dribbling',
    name: 'Dribbling',
    category: 'Attacking',
    description: 'Agile close-quarters carries that beat defenders 1v1 and draw dangerous fouls.',
    recommendedPositions: ['Winger', 'Attacking Midfielder', 'Striker'],
    simulationEffectSummary: '+6.5% dribble carry rate, final-third xG edge, and foul-drawing.',
    effectStrength: 0.065,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'att_positioning',
    name: 'Positioning',
    category: 'Attacking',
    description: 'Intelligent off-the-ball runs into high-value pockets inside the penalty area.',
    recommendedPositions: ['Striker', 'Attacking Midfielder', 'Winger'],
    simulationEffectSummary: '+6.5% shooting opportunity frequency and chance xG quality.',
    effectStrength: 0.065,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'free_kicks',
    name: 'Free Kicks',
    category: 'Attacking',
    description: 'Specialist dead-ball curl and accuracy directly on free-kick and corner situations.',
    recommendedPositions: ['Attacking Midfielder', 'Winger', 'Central Midfielder', 'Full Back'],
    simulationEffectSummary: 'Context-sensitive set-piece threat after fouls (no open-play pass boost).',
    effectStrength: 0.075,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== PHYSICAL (5) ========================
  {
    id: 'speed',
    name: 'Speed',
    category: 'Physical',
    description: 'High top-end sprint velocity on transition breaks and wide recovery runs.',
    recommendedPositions: ['Winger', 'Full Back', 'Striker'],
    simulationEffectSummary: '+5.5% transition attack pace and wide recovery speed.',
    effectStrength: 0.055,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'endurance',
    name: 'Endurance',
    category: 'Physical',
    description: 'High aerobic capacity that limits late-game stamina drop across 90 minutes.',
    recommendedPositions: ['Full Back', 'Central Midfielder', 'Defensive Midfielder'],
    simulationEffectSummary: '-25% per-minute match fatigue drain for sustained late-game output.',
    effectStrength: 0.06,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'strength',
    name: 'Strength',
    category: 'Physical',
    description: 'Upper-body balance and power for holding off markers and winning physical duels.',
    recommendedPositions: ['Striker', 'Centre Back', 'Defensive Midfielder'],
    simulationEffectSummary: '+5.0% physical duel shielding in box finishes and defensive blocks.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'physique',
    name: 'Physique',
    category: 'Physical',
    description: 'Resilient conditioning that lowers match knock risk and boosts full-match robustness.',
    recommendedPositions: ['Centre Back', 'Striker', 'Defensive Midfielder'],
    simulationEffectSummary: '-55% match injury risk and +3.5% late-match physical resilience.',
    effectStrength: 0.045,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
  {
    id: 'agility',
    name: 'Agility',
    category: 'Physical',
    description: 'Rapid balance shifts in tight areas to evade challenges and accelerate away.',
    recommendedPositions: ['Winger', 'Attacking Midfielder', 'Full Back', 'Goalkeeper'],
    simulationEffectSummary: '+5.0% sharp evasion on carries and close-quarters reactions.',
    effectStrength: 0.05,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== TEAM INFLUENCE (1) ========================
  {
    id: 'leadership',
    name: 'Leadership',
    category: 'Team Influence',
    description: 'Vocal pitch organization that steadies teammates composure in tense moments.',
    recommendedPositions: ['Centre Back', 'Defensive Midfielder', 'Central Midfielder', 'Goalkeeper'],
    simulationEffectSummary: '+1.2 capped team-wide composure & defensive organization aura.',
    effectStrength: 0.04,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },

  // ======================== AERIAL PLAY (1) ========================
  {
    id: 'heading',
    name: 'Heading',
    category: 'Aerial Play',
    description: 'Accurate directional headers specifically on crosses, set-pieces, and aerial balls.',
    recommendedPositions: ['Striker', 'Centre Back'],
    simulationEffectSummary: 'Context-sensitive +8.0% header conversion on crosses & corners only.',
    effectStrength: 0.07,
    blueCompatible: true,
    purpleCompatible: true,
    originNote: 'FOOTBALL TYCOON Original Skill Definition',
  },
];

export const SKILL_MAP: Record<SkillId, SkillDefinition> = SKILL_CATALOGUE.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<SkillId, SkillDefinition>
);

export const POSITION_SKILL_RECOMMENDATIONS: Record<Position, Array<[SkillId, SkillId]>> = {
  Goalkeeper: [
    ['saves', 'reflexes'],
    ['gk_aerial', 'gk_positioning'],
  ],
  'Centre Back': [
    ['tackling', 'marking'],
    ['gk_aerial', 'heading'],
  ],
  'Full Back': [
    ['ball_recovery', 'speed'],
    ['marking', 'passing'],
  ],
  'Defensive Midfielder': [
    ['tackling', 'ball_recovery'],
    ['marking', 'intelligence'],
  ],
  'Central Midfielder': [
    ['passing', 'control'],
    ['creativity', 'technique'],
  ],
  'Attacking Midfielder': [
    ['creativity', 'passing'],
    ['dribbling', 'technique'],
  ],
  Winger: [
    ['dribbling', 'speed'],
    ['agility', 'shooting'],
  ],
  Striker: [
    ['shooting', 'att_positioning'],
    ['heading', 'strength'],
  ],
};

export function getSkillById(id: SkillId | null | undefined): SkillDefinition | null {
  if (!id) return null;
  return SKILL_MAP[id] ?? null;
}

export function validateSkillPair(
  skill1: SkillId | null,
  skill2: SkillId | null
): { valid: boolean; error?: string } {
  if (skill1 && !SKILL_MAP[skill1]) {
    return { valid: false, error: `Unknown Skill 1 "${skill1}".` };
  }
  if (skill2 && !SKILL_MAP[skill2]) {
    return { valid: false, error: `Unknown Skill 2 "${skill2}".` };
  }
  if (skill1 && skill2 && skill1 === skill2) {
    return { valid: false, error: 'Skill 1 (Blue) and Skill 2 (Purple) cannot be the same skill.' };
  }
  return { valid: true };
}

export function getDefaultSkillsForPlayer(
  position: Position,
  seedKey: string
): { skill1: SkillId; skill2: SkillId } {
  const recs = POSITION_SKILL_RECOMMENDATIONS[position];
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i += 1) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pair = recs[(h >>> 0) % recs.length];
  return { skill1: pair[0], skill2: pair[1] };
}

export function hasSkill(player: Player, id: SkillId): boolean {
  return player.skill1 === id || player.skill2 === id;
}

export function checkSuperstarUnlockEligibility(
  player: Player,
  club: Club
): { eligible: boolean; reason: string; developmentCost: number } {
  if (player.isSuperstar) {
    return {
      eligible: false,
      reason: 'Player already holds Superstar status.',
      developmentCost: 0,
    };
  }
  const hasPeakPerformance =
    player.overallRating >= 82 ||
    (player.overallRating >= 78 && player.potential >= 85 && player.seasonStats.appearances >= 5);

  const hasInfrastructure = club.facilities.trainingGround >= 3 || club.facilities.youthAcademy >= 3;
  const developmentCost = 2_500_000;

  if (!hasInfrastructure) {
    return {
      eligible: false,
      reason: 'Requires Training Ground or Youth Academy Tier 3+ to unlock Superstar development.',
      developmentCost,
    };
  }
  if (!hasPeakPerformance) {
    return {
      eligible: false,
      reason:
        'Requires 82+ OVR, or 78+ OVR with 85+ Potential and at least 5 match appearances.',
      developmentCost,
    };
  }
  if (club.balance < developmentCost) {
    return {
      eligible: false,
      reason: 'Insufficient club balance (€2.5M development programme required).',
      developmentCost,
    };
  }
  return {
    eligible: true,
    reason: 'Meets performance & club infrastructure criteria for Superstar elevation.',
    developmentCost,
  };
}
