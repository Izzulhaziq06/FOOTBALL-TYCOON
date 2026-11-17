import manifestJson from './database-manifest.json';
import competitionsJson from './competitions/competitions.json';
import season2014 from './seasons/2014-15.json';
import season2015 from './seasons/2015-16.json';
import season2016 from './seasons/2016-17.json';
import season2017 from './seasons/2017-18.json';
import season2018 from './seasons/2018-19.json';
import { CLUBS_CATALOG } from './clubsCatalog';
import { HISTORICAL_PLAYERS, HistoricalPlayerSeed, PlayerTier } from './historicalPlayers';
import {
  calculateOverallRating,
  estimateMarketValue,
  estimateWeeklyWage,
} from '../engine/ratings';
import { getNaturalSkillForPlayer } from '../engine/skills';
import {
  Club,
  Competition,
  CompetitionFormat,
  HistoricalManifest,
  MentalAttributes,
  PhysicalAttributes,
  Player,
  Position,
  SeasonId,
  TechnicalAttributes,
  Transfer,
} from '../types';
import { validateSeasonDatabase } from './validator';

interface SeasonConfigJson {
  seasonId: SeasonId;
  startDate: string;
  uclClubIds: string[];
  uelClubIds: string[];
  historicalTransfers: Array<{
    playerName: string;
    fromClubId: string;
    toClubId: string;
    fee: number;
    window: 'Summer' | 'Winter';
  }>;
}

const SEASON_CONFIGS: Record<SeasonId, SeasonConfigJson> = {
  '2014/15': season2014 as SeasonConfigJson,
  '2015/16': season2015 as SeasonConfigJson,
  '2016/17': season2016 as SeasonConfigJson,
  '2017/18': season2017 as SeasonConfigJson,
  '2018/19': season2018 as SeasonConfigJson,
};

export const DATABASE_MANIFEST = manifestJson as HistoricalManifest;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededOffset(seedKey: string, min: number, max: number): number {
  const h = hashString(seedKey);
  return min + (h % (max - min + 1));
}

function clampAttr(v: number): number {
  return Math.max(25, Math.min(98, Math.round(v)));
}

function seasonStartYear(seasonId: SeasonId): number {
  return parseInt(seasonId.slice(0, 4), 10);
}

function calculateAgeForSeason(dateOfBirth: string, seasonId: SeasonId): number {
  const birthYear = parseInt(dateOfBirth.slice(0, 4), 10);
  return Math.max(16, seasonStartYear(seasonId) - birthYear);
}

function buildAttributesForPosition(
  position: Position,
  baseLevel: number,
  seedKey: string
): {
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
} {
  const j = (salt: string, spread = 6) => seededOffset(`${seedKey}:${salt}`, -spread, spread);

  const isGK = position === 'Goalkeeper';
  const isCB = position === 'Centre Back';
  const isFB = position === 'Full Back';
  const isDM = position === 'Defensive Midfielder';
  const isCM = position === 'Central Midfielder';
  const isAM = position === 'Attacking Midfielder';
  const isW = position === 'Winger';
  const isST = position === 'Striker';

  const technical: TechnicalAttributes = {
    passing: clampAttr(baseLevel + (isCM || isAM ? 6 : isDM ? 3 : isGK ? -16 : -2) + j('pas')),
    shooting: clampAttr(baseLevel + (isST ? 6 : isAM || isW ? 3 : isCB || isGK ? -24 : -5) + j('sho')),
    finishing: clampAttr(baseLevel + (isST ? 8 : isW || isAM ? 2 : isCB || isGK ? -28 : -8) + j('fin')),
    dribbling: clampAttr(baseLevel + (isW || isAM ? 7 : isCM ? 2 : isCB || isGK ? -22 : -2) + j('dri')),
    crossing: clampAttr(baseLevel + (isFB || isW ? 6 : isAM ? 1 : isCB || isGK ? -22 : -6) + j('cro')),
    tackling: clampAttr(baseLevel + (isCB || isDM ? 8 : isFB ? 5 : isST || isW || isGK ? -26 : -4) + j('tac')),
    ballControl: clampAttr(baseLevel + (isAM || isCM || isW ? 5 : isGK ? -18 : 0) + j('bal')),
    heading: clampAttr(baseLevel + (isCB || isST ? 6 : isGK ? -18 : -6) + j('hea')),
    goalkeeping: isGK ? clampAttr(baseLevel + 4 + j('gk', 4)) : clampAttr(18 + j('gk_out', 5)),
  };

  const physical: PhysicalAttributes = {
    pace: clampAttr(baseLevel + (isW || isFB ? 7 : isST ? 3 : isCB ? -4 : isGK ? -26 : 0) + j('pac')),
    acceleration: clampAttr(baseLevel + (isW || isFB ? 7 : isAM ? 3 : isGK ? -24 : 0) + j('acc')),
    stamina: clampAttr(baseLevel + (isFB || isDM || isCM ? 5 : isGK ? -20 : 0) + j('sta')),
    strength: clampAttr(baseLevel + (isCB || isDM || isST ? 5 : isW ? -7 : 0) + j('str')),
    agility: clampAttr(baseLevel + (isW || isAM || isGK ? 4 : isCB ? -7 : 0) + j('agi')),
    jumping: clampAttr(baseLevel + (isCB || isGK || isST ? 5 : -3) + j('jum')),
  };

  const mental: MentalAttributes = {
    vision: clampAttr(baseLevel + (isAM || isCM ? 7 : isGK ? -12 : -2) + j('vis')),
    positioning: clampAttr(baseLevel + (isCB || isDM || isST || isGK ? 4 : 0) + j('pos')),
    decisions: clampAttr(baseLevel + 2 + j('dec')),
    composure: clampAttr(baseLevel + 2 + j('com')),
    leadership: clampAttr(baseLevel - 4 + j('lea', 9)),
    workRate: clampAttr(baseLevel + (isDM || isFB ? 5 : 0) + j('wor')),
  };

  return { technical, physical, mental };
}

function tierBaseLevel(tier: PlayerTier, age: number, potentialPeak: number): number {
  const tierFloor =
    tier === 'world_class'
      ? 85
      : tier === 'elite'
        ? 80
        : tier === 'first_team'
          ? 75
          : 70;
  // Slight progression toward peak for younger players
  const ageModifier = age < 21 ? -4 : age <= 24 ? -1 : age <= 29 ? 2 : age <= 32 ? 0 : -3;
  return Math.min(potentialPeak, Math.max(66, tierFloor + ageModifier));
}

const COUNTRY_NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  England: {
    first: ['Oliver', 'Harry', 'Jack', 'Charlie', 'George', 'Callum', 'Liam', 'Mason', 'Ben', 'Tom'],
    last: ['Ward', 'Clarke', 'Taylor', 'Bennett', 'Hughes', 'Fletcher', 'Cooper', 'Edwards', 'Brooks', 'Turner'],
  },
  Spain: {
    first: ['Carlos', 'Alejandro', 'Pablo', 'Javier', 'Diego', 'Sergio', 'Mario', 'Álvaro', 'Hugo', 'Raúl'],
    last: ['Navarro', 'Ruiz', 'Moreno', 'Jiménez', 'Serrano', 'Molina', 'Vázquez', 'Ortega', 'Castro', 'Delgado'],
  },
  Germany: {
    first: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Niklas', 'Tobias', 'Julian', 'Tim', 'Moritz'],
    last: ['Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Richter', 'Klein', 'Bauer'],
  },
  Italy: {
    first: ['Lorenzo', 'Matteo', 'Andrea', 'Marco', 'Federico', 'Davide', 'Luca', 'Simone', 'Riccardo', 'Gabriele'],
    last: ['Conti', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana'],
  },
  France: {
    first: ['Lucas', 'Théo', 'Antoine', 'Hugo', 'Maxime', 'Clément', 'Alexandre', 'Romain', 'Julien', 'Baptiste'],
    last: ['Bernard', 'Dubois', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Mercier', 'Blanc', 'Garnier', 'Faure'],
  },
};

const TARGET_SQUAD_COMPOSITION: Position[] = [
  'Goalkeeper',
  'Goalkeeper',
  'Centre Back',
  'Centre Back',
  'Centre Back',
  'Full Back',
  'Full Back',
  'Defensive Midfielder',
  'Defensive Midfielder',
  'Central Midfielder',
  'Central Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Winger',
  'Winger',
  'Striker',
  'Striker',
  'Striker',
];

function createPlayerFromSeed(
  seed: HistoricalPlayerSeed,
  clubId: string,
  clubReputation: number,
  seasonId: SeasonId
): Player {
  const age = calculateAgeForSeason(seed.dateOfBirth, seasonId);
  const baseLevel = tierBaseLevel(seed.tier, age, seed.potentialPeak);
  const { technical, physical, mental } = buildAttributesForPosition(
    seed.primaryPosition,
    baseLevel,
    `${seed.id}:${seasonId}`
  );
  const overallRating = calculateOverallRating(seed.primaryPosition, technical, physical, mental);
  const potential = Math.max(overallRating, Math.min(97, seed.potentialPeak));
  const startYr = seasonStartYear(seasonId);
  const contractLength = seededOffset(`${seed.id}:${seasonId}:con`, 2, 5);
  const skill1 = getNaturalSkillForPlayer(
    seed.primaryPosition,
    `${seed.id}:${seasonId}`,
    seed.defaultSkills?.[0] ?? null
  );
  const isSuperstar = seed.isSuperstar ?? (seed.tier === 'world_class' && overallRating >= 86);

  return {
    id: seed.id,
    fullName: seed.fullName,
    nationality: seed.nationality,
    dateOfBirth: seed.dateOfBirth,
    ageBySeason: { [seasonId]: age },
    age,
    primaryPosition: seed.primaryPosition,
    secondaryPositions: seed.secondaryPositions,
    overallRating,
    potential,
    technicalAttributes: technical,
    physicalAttributes: physical,
    mentalAttributes: mental,
    marketValue: estimateMarketValue(overallRating, age, potential),
    weeklyWage: estimateWeeklyWage(overallRating, clubReputation),
    contractExpiry: startYr + contractLength,
    preferredFoot: seed.preferredFoot,
    clubId,
    seasonId,
    fitness: seededOffset(`${seed.id}:${seasonId}:fit`, 92, 100),
    morale: seededOffset(`${seed.id}:${seasonId}:mor`, 74, 88),
    injuryWeeks: 0,
    recentForm: [],
    seasonStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    careerStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    developmentHistory: [
      {
        seasonId,
        matchday: 0,
        overall: overallRating,
        focus: 'Balanced',
        note: 'Season opening evaluation',
      },
    ],
    isHistoricalRecord: true,
    ratingSource: 'gameplay_estimated',
    loanedFromClubId: null,
    skill1,
    skill2: null,
    isSuperstar,
    superstarUnlockedReason: isSuperstar ? 'Historical marquee standing' : undefined,
  };
}

function createDepthPlayer(
  clubId: string,
  country: string,
  clubReputation: number,
  position: Position,
  slotNumber: number,
  seasonId: SeasonId,
  usedNames: Set<string>
): Player {
  const pool = COUNTRY_NAME_POOLS[country] ?? COUNTRY_NAME_POOLS.England;
  const seedKey = `depth:${clubId}:${seasonId}:${position}:${slotNumber}`;
  const baseFirstIdx = hashString(`${seedKey}:fn`) % pool.first.length;
  const baseLastIdx = hashString(`${seedKey}:ln`) % pool.last.length;
  let fullName = `${pool.first[baseFirstIdx]} ${pool.last[baseLastIdx]}`;
  for (let attempt = 1; attempt < pool.first.length * pool.last.length; attempt += 1) {
    if (!usedNames.has(fullName)) break;
    const fIdx = (baseFirstIdx + attempt) % pool.first.length;
    const lIdx = (baseLastIdx + Math.floor(attempt / pool.first.length) + attempt) % pool.last.length;
    fullName = `${pool.first[fIdx]} ${pool.last[lIdx]}`;
  }
  usedNames.add(fullName);

  const startYr = seasonStartYear(seasonId);
  const age = seededOffset(`${seedKey}:age`, 19, 30);
  const birthYear = startYr - age;
  const birthMonth = String(seededOffset(`${seedKey}:bm`, 1, 12)).padStart(2, '0');
  const birthDay = String(seededOffset(`${seedKey}:bd`, 1, 28)).padStart(2, '0');

  // Scale generated squad depth realistically to club stature while staying below marquee historical stars (max 79 OVR)
  const clampedRep = Math.max(70, Math.min(95, clubReputation));
  const repBaseline = Math.round(67 + ((clampedRep - 70) / 25) * 9); // 67 (rep 70) .. 76 (rep 95)
  const desiredOvr = Math.max(
    63,
    Math.min(79, repBaseline + seededOffset(`${seedKey}:ovr`, -3, 3))
  );

  // Offset positional build bias (-4) and run deterministic calibration so attributes match desiredOvr (<= 79)
  let baseLevel = desiredOvr - 4;
  let attrs = buildAttributesForPosition(position, baseLevel, seedKey);
  let overallRating = calculateOverallRating(
    position,
    attrs.technical,
    attrs.physical,
    attrs.mental
  );
  if (overallRating !== desiredOvr) {
    baseLevel += desiredOvr - overallRating;
    attrs = buildAttributesForPosition(position, baseLevel, seedKey);
    overallRating = calculateOverallRating(
      position,
      attrs.technical,
      attrs.physical,
      attrs.mental
    );
  }
  while (overallRating > 79 && baseLevel > 48) {
    baseLevel -= 1;
    attrs = buildAttributesForPosition(position, baseLevel, seedKey);
    overallRating = calculateOverallRating(
      position,
      attrs.technical,
      attrs.physical,
      attrs.mental
    );
  }

  const { technical, physical, mental } = attrs;
  const potential = Math.min(
    84,
    overallRating +
      (age <= 22 ? seededOffset(`${seedKey}:pot`, 4, 8) : seededOffset(`${seedKey}:pot`, 0, 2))
  );

  const secondaryMap: Record<Position, Position[]> = {
    Goalkeeper: [],
    'Centre Back': ['Full Back'],
    'Full Back': ['Centre Back', 'Winger'],
    'Defensive Midfielder': ['Central Midfielder', 'Centre Back'],
    'Central Midfielder': ['Defensive Midfielder', 'Attacking Midfielder'],
    'Attacking Midfielder': ['Central Midfielder', 'Winger'],
    Winger: ['Attacking Midfielder', 'Striker'],
    Striker: ['Winger'],
  };

  const naturalSkill = getNaturalSkillForPlayer(position, seedKey);

  return {
    id: `gen_${clubId}_${position.toLowerCase().replace(/\s+/g, '_')}_${slotNumber}`,
    fullName,
    nationality: country,
    dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
    ageBySeason: { [seasonId]: age },
    age,
    primaryPosition: position,
    secondaryPositions: secondaryMap[position].slice(0, 1),
    overallRating,
    potential,
    technicalAttributes: technical,
    physicalAttributes: physical,
    mentalAttributes: mental,
    marketValue: estimateMarketValue(overallRating, age, potential),
    weeklyWage: estimateWeeklyWage(overallRating, clubReputation),
    contractExpiry: startYr + seededOffset(`${seedKey}:con`, 1, 4),
    preferredFoot: seededOffset(`${seedKey}:foot`, 0, 4) === 0 ? 'Left' : 'Right',
    clubId,
    seasonId,
    fitness: seededOffset(`${seedKey}:fit`, 90, 100),
    morale: seededOffset(`${seedKey}:mor`, 70, 84),
    injuryWeeks: 0,
    recentForm: [],
    seasonStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    careerStats: {
      appearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      motmAwards: 0,
      averageRating: 0,
    },
    developmentHistory: [
      {
        seasonId,
        matchday: 0,
        overall: overallRating,
        focus: 'Balanced',
        note: 'Club squad depth evaluation',
      },
    ],
    isHistoricalRecord: false,
    ratingSource: 'gameplay_estimated',
    loanedFromClubId: null,
    skill1: naturalSkill,
    skill2: null,
    isSuperstar: false,
  };
}

export interface SeasonDatabaseBundle {
  seasonId: SeasonId;
  startDate: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  competitions: Record<string, Competition>;
  historicalTransfers: Transfer[];
}

export function buildSeasonDatabase(seasonId: SeasonId): SeasonDatabaseBundle {
  const seasonCfg = SEASON_CONFIGS[seasonId];
  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};
  const competitions: Record<string, Competition> = {};

  // 1. Instantiate all 50 clubs for the chosen season
  for (const entry of CLUBS_CATALOG) {
    const reputation = entry.reputationBySeason?.[seasonId] ?? entry.baseReputation;
    const baseBalance = Math.round(
      (Math.pow(entry.financialStrength, 1.55) * 95000) / 100000
    ) * 100000;
    const transferBudget = Math.round((baseBalance * 0.48) / 100000) * 100000;
    const wageBudget = Math.round((Math.pow(entry.financialStrength, 1.65) * 1150) / 1000) * 1000;

    clubs[entry.id] = {
      id: entry.id,
      name: entry.name,
      shortName: entry.shortName,
      country: entry.country,
      leagueId: entry.leagueId,
      foundedYear: entry.foundedYear,
      reputation,
      financialStrength: entry.financialStrength,
      stadiumName: entry.stadiumName,
      stadiumCapacity: entry.stadiumCapacity,
      squadIds: [],
      crest: entry.crest,
      balance: baseBalance,
      transferBudget,
      wageBudget,
      facilities: {
        trainingGround: reputation >= 88 ? 4 : reputation >= 80 ? 3 : 2,
        youthAcademy: reputation >= 87 ? 4 : reputation >= 79 ? 3 : 2,
        medicalCenter: reputation >= 86 ? 4 : 2,
        stadiumTier: entry.stadiumCapacity >= 65000 ? 4 : entry.stadiumCapacity >= 45000 ? 3 : 2,
      },
      seasonId,
      isHistoricalVerified: true,
    };
  }

  // 2. Populate verified historical players active in this exact season
  for (const seed of HISTORICAL_PLAYERS) {
    const matchingStint = seed.stints.find((st) => st.seasons.includes(seasonId));
    if (!matchingStint) continue;
    const club = clubs[matchingStint.clubId];
    if (!club) continue;

    const player = createPlayerFromSeed(seed, club.id, club.reputation, seasonId);
    players[player.id] = player;
    club.squadIds.push(player.id);
  }

  // 3. Complete every club squad to 18 balanced players using clearly marked generated depth players
  for (const club of Object.values(clubs)) {
    const existingPositions = club.squadIds.map((pid) => players[pid].primaryPosition);
    const neededPositions: Position[] = [...TARGET_SQUAD_COMPOSITION];

    for (const pos of existingPositions) {
      const idx = neededPositions.indexOf(pos);
      if (idx !== -1) {
        neededPositions.splice(idx, 1);
      }
    }

    const usedNames = new Set<string>(club.squadIds.map((pid) => players[pid].fullName));
    let slotCounter = 1;
    for (const pos of neededPositions) {
      const genPlayer = createDepthPlayer(
        club.id,
        club.country,
        club.reputation,
        pos,
        slotCounter,
        seasonId,
        usedNames
      );
      slotCounter += 1;
      players[genPlayer.id] = genPlayer;
      club.squadIds.push(genPlayer.id);
    }

    // Sort squadIds by overall rating desc
    club.squadIds.sort((a, b) => players[b].overallRating - players[a].overallRating);

    // Ensure starting wage budget leaves realistic headroom for signings
    const actualSquadWages = club.squadIds.reduce((sum, pid) => sum + players[pid].weeklyWage, 0);
    const headroomMultiplier = 1.2 + (club.financialStrength / 100) * 0.14;
    club.wageBudget = Math.max(
      club.wageBudget,
      Math.round((actualSquadWages * headroomMultiplier) / 1000) * 1000
    );
  }

  // 4. Build Competitions (5 Domestic Leagues + UCL + UEL)
  const rawComps = competitionsJson as Array<{
    id: string;
    name: string;
    shortName: string;
    country: string;
    competitionFormat: CompetitionFormat;
    tier: number;
  }>;

  for (const comp of rawComps) {
    let clubIds: string[] = [];
    if (comp.competitionFormat === 'league') {
      clubIds = Object.values(clubs)
        .filter((c) => c.leagueId === comp.id)
        .map((c) => c.id);
    } else if (comp.id === 'ucl') {
      clubIds = [...seasonCfg.uclClubIds];
    } else if (comp.id === 'uel') {
      clubIds = [...seasonCfg.uelClubIds];
    }

    const totalMatchdays =
      comp.competitionFormat === 'league'
        ? (clubIds.length - 1) * 2 // 18 matchdays for 10 clubs
        : 4; // Round of 16 -> QF -> SF -> Final

    competitions[comp.id] = {
      id: comp.id,
      name: comp.name,
      shortName: comp.shortName,
      country: comp.country,
      seasonId,
      clubIds,
      competitionFormat: comp.competitionFormat,
      tier: comp.tier,
      currentMatchday: 1,
      totalMatchdays,
      winnerClubId: null,
    };
  }

  // 5. Historical Transfers for context in Transfer History
  const historicalTransfers: Transfer[] = seasonCfg.historicalTransfers.map((tr, idx) => ({
    id: `hist_tr_${seasonId}_${idx}`,
    playerId: `hist_${idx}`,
    playerName: tr.playerName,
    fromClubId: tr.fromClubId,
    fromClubName: clubs[tr.fromClubId]?.name ?? tr.fromClubId,
    toClubId: tr.toClubId,
    toClubName: clubs[tr.toClubId]?.name ?? tr.toClubId,
    fee: tr.fee,
    weeklyWage: 0,
    contractYears: 4,
    type: 'permanent',
    seasonId,
    matchday: 0,
    transferWindow: tr.window,
    date: seasonCfg.startDate,
    isHistoricalSeed: true,
  }));

  return {
    seasonId,
    startDate: seasonCfg.startDate,
    clubs,
    players,
    competitions,
    historicalTransfers,
  };
}

export function validateAllHistoricalSeasons() {
  const seasons: SeasonId[] = ['2014/15', '2015/16', '2016/17', '2017/18', '2018/19'];
  return seasons.map((seasonId) => {
    const bundle = buildSeasonDatabase(seasonId);
    return validateSeasonDatabase(
      seasonId,
      bundle.clubs,
      bundle.players,
      bundle.competitions
    );
  });
}

export function validateCustomDatabaseImport(jsonText: string): {
  ok: boolean;
  message: string;
  clubsCount?: number;
  playersCount?: number;
} {
  try {
    const parsed = JSON.parse(jsonText) as {
      seasonId?: string;
      clubs?: Record<string, Club>;
      players?: Record<string, Player>;
      competitions?: Record<string, Competition>;
    };
    if (!parsed.seasonId || !parsed.clubs || !parsed.players || !parsed.competitions) {
      return {
        ok: false,
        message: 'JSON must include seasonId, clubs, players, and competitions objects.',
      };
    }
    const report = validateSeasonDatabase(
      parsed.seasonId,
      parsed.clubs,
      parsed.players,
      parsed.competitions,
      { allowGeneratedSeason: true }
    );
    if (!report.valid) {
      return {
        ok: false,
        message: `Validation failed (${report.issues.length} issues): ${report.issues[0]?.message}`,
      };
    }
    return {
      ok: true,
      message: `Validated ${report.clubsCount} clubs and ${report.playersCount} players for ${report.seasonId}.`,
      clubsCount: report.clubsCount,
      playersCount: report.playersCount,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}
