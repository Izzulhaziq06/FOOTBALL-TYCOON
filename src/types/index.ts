export type SeasonId = '2014/15' | '2015/16' | '2016/17' | '2017/18' | '2018/19';

export type Position =
  | 'Goalkeeper'
  | 'Centre Back'
  | 'Full Back'
  | 'Defensive Midfielder'
  | 'Central Midfielder'
  | 'Attacking Midfielder'
  | 'Winger'
  | 'Striker';

export type PositionCode = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';

export type FormationName =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '4-1-4-1'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '4-3-1-2';

export type Mentality =
  | 'Very Defensive'
  | 'Defensive'
  | 'Balanced'
  | 'Attacking'
  | 'Very Attacking';

export type PressingIntensity = 'Low' | 'Medium' | 'High' | 'Aggressive';
export type DefensiveLine = 'Deep' | 'Balanced' | 'High';
export type PassingStyle = 'Short' | 'Mixed' | 'Direct';
export type TacticalWidth = 'Narrow' | 'Balanced' | 'Wide';
export type TacticalTempo = 'Slow' | 'Balanced' | 'Fast';
export type TrainingFocus = 'Balanced' | 'Attacking' | 'Defensive' | 'Physical' | 'Technical';
export type SimulationSpeed = 'Normal' | 'Fast' | 'Instant';
export type CurrencyDisplay = 'EUR' | 'GBP' | 'USD';

export interface TechnicalAttributes {
  passing: number;
  shooting: number;
  finishing: number;
  dribbling: number;
  crossing: number;
  tackling: number;
  ballControl: number;
  heading: number;
  goalkeeping?: number;
}

export interface PhysicalAttributes {
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  jumping: number;
}

export interface MentalAttributes {
  vision: number;
  positioning: number;
  decisions: number;
  composure: number;
  leadership: number;
  workRate: number;
}

export interface CrestIdentifier {
  shape: 'shield' | 'circle' | 'diamond' | 'banner';
  pattern: 'solid' | 'vertical' | 'horizontal' | 'diagonal' | 'halves' | 'cross' | 'diamond';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  monogram: string;
}

export interface FacilityLevels {
  trainingGround: number; // 1-5
  youthAcademy: number; // 1-5
  medicalCenter: number; // 1-5
  stadiumTier: number; // 1-5
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string;
  leagueId: string;
  foundedYear: number;
  reputation: number; // 1-100
  financialStrength: number; // 1-100
  stadiumName: string;
  stadiumCapacity: number;
  squadIds: string[];
  crest: CrestIdentifier;
  balance: number; // EUR
  transferBudget: number; // EUR
  wageBudget: number; // EUR/week
  facilities: FacilityLevels;
  seasonId: SeasonId | string;
  isHistoricalVerified: boolean;
}

export interface PlayerSeasonStats {
  appearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  motmAwards: number;
  averageRating: number;
}

export interface DevelopmentEntry {
  seasonId: string;
  matchday: number;
  overall: number;
  focus: TrainingFocus;
  note: string;
}

import type { SkillId } from '../engine/skills';

export interface Player {
  id: string;
  fullName: string;
  nationality: string;
  dateOfBirth: string;
  ageBySeason: Record<string, number>;
  age: number;
  primaryPosition: Position;
  secondaryPositions: Position[];
  overallRating: number;
  potential: number;
  technicalAttributes: TechnicalAttributes;
  physicalAttributes: PhysicalAttributes;
  mentalAttributes: MentalAttributes;
  skill1: SkillId | null; // Blue Slot
  skill2: SkillId | null; // Purple Slot
  isSuperstar: boolean;
  superstarUnlockedReason?: string;
  isCustomAcademyPlayer?: boolean;
  marketValue: number; // EUR
  weeklyWage: number; // EUR
  contractExpiry: number; // Year e.g. 2018
  preferredFoot: 'Right' | 'Left' | 'Both';
  clubId: string;
  seasonId: SeasonId | string;
  fitness: number; // 1-100
  morale: number; // 1-100
  injuryWeeks: number;
  injuryDescription?: string;
  recentForm: number[]; // last 5 match ratings (5.0 - 10.0)
  seasonStats: PlayerSeasonStats;
  careerStats: PlayerSeasonStats;
  developmentHistory: DevelopmentEntry[];
  isHistoricalRecord: boolean; // true = real historical club-season link; false = generated club depth
  ratingSource: 'gameplay_estimated';
  loanedFromClubId?: string | null;
  loanMatchesRemaining?: number;
}

export type CompetitionFormat = 'league' | 'knockout';

export interface Competition {
  id: string;
  name: string;
  shortName: string;
  country: string;
  seasonId: SeasonId | string;
  clubIds: string[];
  competitionFormat: CompetitionFormat;
  tier: number;
  currentMatchday: number;
  totalMatchdays: number;
  winnerClubId?: string | null;
}

export type MatchEventType =
  | 'KICK_OFF'
  | 'PASS'
  | 'ATTACK'
  | 'CHANCE'
  | 'SHOT'
  | 'SAVE'
  | 'GOAL'
  | 'ASSIST'
  | 'CORNER'
  | 'FOUL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'SUBSTITUTION'
  | 'INJURY'
  | 'HALF_TIME'
  | 'FULL_TIME';

export interface MatchEvent {
  id: string;
  minute: number;
  addedTime?: number;
  type: MatchEventType;
  clubId: string;
  playerId?: string;
  secondaryPlayerId?: string; // Assist provider, subbed off player, or fouled player
  commentary: string;
  isGoal?: boolean;
  isOnTarget?: boolean;
  homeScoreAfter: number;
  awayScoreAfter: number;
}

export interface TeamMatchStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  passesCompleted: number;
  expectedGoals: number;
}

export interface PlayerMatchRating {
  playerId: string;
  clubId: string;
  rating: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: MatchEvent[];
  playerRatings: PlayerMatchRating[];
  motmPlayerId: string;
  attendance: number;
  gateReceipts: number;
  seed: number;
}

export interface Fixture {
  id: string;
  competitionId: string;
  seasonId: string;
  matchday: number;
  roundName?: string; // e.g. 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'
  homeClubId: string;
  awayClubId: string;
  date: string; // YYYY-MM-DD
  result: MatchResult | null;
  status: 'scheduled' | 'completed';
}

export interface Transfer {
  id: string;
  playerId: string;
  playerName: string;
  fromClubId: string;
  fromClubName: string;
  toClubId: string;
  toClubName: string;
  fee: number;
  weeklyWage: number;
  contractYears: number;
  type: 'permanent' | 'loan';
  seasonId: string;
  matchday: number;
  transferWindow: 'Summer' | 'Winter';
  date: string;
  isHistoricalSeed?: boolean;
}

export interface TacticalSlot {
  slotIndex: number; // 0..10
  rolePosition: Position;
  label: string;
  x: number; // 0..100 pitch percentage left->right
  y: number; // 0..100 pitch percentage top(attack)->bottom(GK)
  playerId: string | null;
}

export interface ClubTactics {
  formation: FormationName;
  slots: TacticalSlot[];
  substituteIds: string[];
  captainId: string | null;
  penaltyTakerId: string | null;
  freeKickTakerId: string | null;
  cornerTakerId: string | null;
  mentality: Mentality;
  pressing: PressingIntensity;
  defensiveLine: DefensiveLine;
  passing: PassingStyle;
  width: TacticalWidth;
  tempo: TacticalTempo;
}

export interface LeagueStandingRow {
  clubId: string;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface FinancialTransaction {
  id: string;
  date: string;
  matchday: number;
  category:
    | 'Matchday Gate'
    | 'Weekly Wages'
    | 'Transfer Fee'
    | 'Prize Money'
    | 'Facility Upgrade'
    | 'Stadium Upgrade'
    | 'Sponsor & Broadcast';
  description: string;
  amount: number; // positive = income, negative = expense
  balanceAfter: number;
}

export interface NewsItem {
  id: string;
  date: string;
  matchday: number;
  category: 'Transfer' | 'Match' | 'Injury' | 'Board' | 'Development' | 'Contract' | 'Competition';
  headline: string;
  summary: string;
  clubId?: string;
  playerId?: string;
}

export interface TrainingReport {
  id: string;
  matchday: number;
  date: string;
  focus: TrainingFocus;
  improvedPlayers: Array<{
    playerId: string;
    playerName: string;
    attribute: string;
    oldOverall: number;
    newOverall: number;
  }>;
  summary: string;
}

export interface ManagerObjective {
  id: string;
  title: string;
  targetDescription: string;
  progressText: string;
  status: 'on_track' | 'at_risk' | 'completed' | 'failed';
}

export interface ManagerProfile {
  name: string;
  nationality: string;
  philosophy: 'Possession' | 'Counter-Attack' | 'High Press' | 'Balanced' | 'Pragmatic';
  reputation: number;
  matchesManaged: number;
  wins: number;
  draws: number;
  losses: number;
  trophiesWon: number;
}

export interface SeasonArchive {
  seasonId: string;
  isGeneratedSeason: boolean;
  leagueName: string;
  leaguePosition: number;
  points: number;
  leagueWinnerName: string;
  uclWinnerName?: string;
  uelWinnerName?: string;
  topScorerName?: string;
  topScorerGoals?: number;
}

export interface CareerState {
  id: string;
  saveName: string;
  saveVersion: string;
  createdAt: string;
  lastPlayedAt: string;
  startingHistoricalSeason: SeasonId;
  currentSeason: string;
  isGeneratedSeason: boolean;
  currentMatchday: number;
  totalMatchdays: number;
  currentDate: string;
  transferWindowOpen: boolean;
  transferWindowLabel: 'Summer' | 'Winter' | 'Closed';
  userClubId: string;
  userLeagueId: string;
  manager: ManagerProfile;
  tactics: ClubTactics;
  trainingFocus: TrainingFocus;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  competitions: Record<string, Competition>;
  fixtures: Fixture[];
  transfers: Transfer[];
  transactions: FinancialTransaction[];
  news: NewsItem[];
  trainingReports: TrainingReport[];
  objectives: ManagerObjective[];
  seasonHistory: SeasonArchive[];
  seedCounter: number;
}

export interface SaveSummary {
  id: string;
  saveName: string;
  clubId: string;
  clubName: string;
  currentSeason: string;
  currentMatchday: number;
  managerName: string;
  lastPlayedAt: string;
  saveVersion: string;
}

export interface AppSettings {
  simulationSpeed: SimulationSpeed;
  currency: CurrencyDisplay;
  autosaveEnabled: boolean;
  soundEffectsEnabled: boolean;
}

export interface HistoricalSeasonMetadata {
  seasonId: SeasonId;
  title: string;
  description: string;
  availableCompetitions: string[];
  availableClubsCount: number;
  availablePlayersCount: number;
  verifiedHistoricalPlayersCount: number;
  completenessLabel: string;
  completenessNote: string;
}

export interface HistoricalManifest {
  project: string;
  schemaVersion: string;
  disclaimer: string;
  verifiedFields: string[];
  estimatedGameplayFields: string[];
  seasons: HistoricalSeasonMetadata[];
}
