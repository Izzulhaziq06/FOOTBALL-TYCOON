import { CareerState, Club, FacilityLevels, FinancialTransaction, Player } from '../types';

export function calculateClubWeeklyWageBill(club: Club, players: Record<string, Player>): number {
  return club.squadIds.reduce((sum, id) => sum + (players[id]?.weeklyWage ?? 0), 0);
}

export function getFacilityUpgradeCost(
  facility: keyof FacilityLevels,
  currentLevel: number
): number {
  if (currentLevel >= 5) return 0;
  const baseByType: Record<keyof FacilityLevels, number> = {
    trainingGround: 4500000,
    youthAcademy: 4000000,
    medicalCenter: 3500000,
    stadiumTier: 9500000,
  };
  return Math.round(baseByType[facility] * Math.pow(1.65, currentLevel - 1));
}

export function getStadiumExpansionDetails(club: Club): {
  currentCapacity: number;
  addedSeats: number;
  cost: number;
  canUpgrade: boolean;
} {
  const tier = club.facilities.stadiumTier;
  const cost = getFacilityUpgradeCost('stadiumTier', tier);
  const addedSeats = tier >= 5 ? 0 : 6500 + tier * 1500;
  return {
    currentCapacity: club.stadiumCapacity,
    addedSeats,
    cost,
    canUpgrade: tier < 5,
  };
}

export function upgradeClubFacility(
  state: CareerState,
  facility: keyof FacilityLevels
): { ok: boolean; error?: string; nextState: CareerState } {
  const club = state.clubs[state.userClubId];
  if (!club) return { ok: false, error: 'Club not found.', nextState: state };

  const currentLevel = club.facilities[facility];
  if (currentLevel >= 5) {
    return { ok: false, error: 'Facility is already at maximum level (5).', nextState: state };
  }

  const cost = getFacilityUpgradeCost(facility, currentLevel);
  if (club.balance < cost) {
    return {
      ok: false,
      error: `Insufficient club balance. Required: €${(cost / 1_000_000).toFixed(1)}M.`,
      nextState: state,
    };
  }

  const isStadium = facility === 'stadiumTier';
  const expansion = isStadium ? getStadiumExpansionDetails(club) : null;

  const updatedClub: Club = {
    ...club,
    balance: club.balance - cost,
    stadiumCapacity: isStadium
      ? club.stadiumCapacity + (expansion?.addedSeats ?? 0)
      : club.stadiumCapacity,
    reputation: isStadium ? Math.min(99, club.reputation + 1) : club.reputation,
    facilities: {
      ...club.facilities,
      [facility]: currentLevel + 1,
    },
  };

  const facilityLabels: Record<keyof FacilityLevels, string> = {
    trainingGround: 'Training Ground',
    youthAcademy: 'Youth Academy',
    medicalCenter: 'Medical Center',
    stadiumTier: 'Stadium Expansion',
  };

  const tx: FinancialTransaction = {
    id: `tx_fac_${Date.now()}_${facility}`,
    date: state.currentDate,
    matchday: state.currentMatchday,
    category: isStadium ? 'Stadium Upgrade' : 'Facility Upgrade',
    description: `${facilityLabels[facility]} upgraded to Tier ${currentLevel + 1}`,
    amount: -cost,
    balanceAfter: updatedClub.balance,
  };

  return {
    ok: true,
    nextState: {
      ...state,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      transactions: [tx, ...state.transactions],
      news: [
        {
          id: `news_fac_${Date.now()}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Board' as const,
          headline: `${club.name} complete ${facilityLabels[facility]} upgrade`,
          summary: `${facilityLabels[facility]} is now Tier ${currentLevel + 1}${isStadium ? `, lifting capacity to ${updatedClub.stadiumCapacity.toLocaleString()}` : ''}.`,
          clubId: club.id,
        },
        ...state.news,
      ].slice(0, 60),
    },
  };
}

export function renewPlayerContract(
  state: CareerState,
  playerId: string,
  newWeeklyWage: number,
  extraYears: number
): { ok: boolean; error?: string; nextState: CareerState } {
  const club = state.clubs[state.userClubId];
  const player = state.players[playerId];
  if (!club || !player || player.clubId !== club.id) {
    return { ok: false, error: 'Player does not belong to your club.', nextState: state };
  }
  if (!Number.isFinite(newWeeklyWage) || newWeeklyWage < 2000) {
    return { ok: false, error: 'Weekly wage offer must be at least €2,000/wk.', nextState: state };
  }

  const seasonYear = parseInt(state.currentSeason.slice(0, 4), 10) || 2015;
  const newExpiry = Math.max(player.contractExpiry, seasonYear + extraYears);
  const signingBonus = Math.round(newWeeklyWage * 4);

  if (club.balance < signingBonus) {
    return { ok: false, error: 'Insufficient balance for signing bonus.', nextState: state };
  }

  const updatedClub: Club = {
    ...club,
    balance: club.balance - signingBonus,
  };
  const updatedPlayer: Player = {
    ...player,
    weeklyWage: newWeeklyWage,
    contractExpiry: newExpiry,
    morale: Math.min(98, player.morale + 10),
  };

  const tx: FinancialTransaction = {
    id: `tx_con_${Date.now()}_${player.id}`,
    date: state.currentDate,
    matchday: state.currentMatchday,
    category: 'Weekly Wages',
    description: `Contract renewal bonus for ${player.fullName} (until ${newExpiry})`,
    amount: -signingBonus,
    balanceAfter: updatedClub.balance,
  };

  return {
    ok: true,
    nextState: {
      ...state,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      players: { ...state.players, [player.id]: updatedPlayer },
      transactions: [tx, ...state.transactions],
      news: [
        {
          id: `news_con_${Date.now()}_${player.id}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Contract' as const,
          headline: `${player.fullName} signs contract extension at ${club.name}`,
          summary: `${player.fullName} commits until ${newExpiry} on €${newWeeklyWage.toLocaleString()}/wk.`,
          clubId: club.id,
          playerId: player.id,
        },
        ...state.news,
      ].slice(0, 60),
    },
  };
}
