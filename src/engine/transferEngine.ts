import { CareerState, Club, Player, Position, Transfer } from '../types';
import { buildBestLineupForFormation } from './tacticsEngine';

export interface TransferSearchFilters {
  query: string;
  position: Position | 'All';
  minAge: number;
  maxAge: number;
  minOverall: number;
  maxOverall: number;
  minPotential: number;
  maxValue: number;
  clubId: string | 'All';
}

export interface TransferNegotiationSession {
  playerId: string;
  sellingClubId: string;
  buyingClubId: string;
  type: 'permanent' | 'loan';
  stage: 'fee' | 'wage' | 'completed' | 'collapsed';
  round: number;
  maxRounds: number;
  offeredFee: number;
  askingFee: number;
  offeredWage: number;
  askingWage: number;
  contractYears: number;
  statusMessage: string;
  aiFeedback: string;
}

export function searchTransferMarket(
  players: Record<string, Player>,
  userClubId: string,
  filters: TransferSearchFilters
): Player[] {
  const q = filters.query.trim().toLowerCase();

  return Object.values(players)
    .filter((p) => {
      if (p.clubId === userClubId) return false;
      if (q && !p.fullName.toLowerCase().includes(q) && !p.nationality.toLowerCase().includes(q)) {
        return false;
      }
      if (filters.position !== 'All' && p.primaryPosition !== filters.position) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (p.overallRating < filters.minOverall || p.overallRating > filters.maxOverall) return false;
      if (p.potential < filters.minPotential) return false;
      if (p.marketValue > filters.maxValue) return false;
      if (filters.clubId !== 'All' && p.clubId !== filters.clubId) return false;
      return true;
    })
    .sort((a, b) => b.overallRating - a.overallRating);
}

export function evaluateInitialTransferTerms(
  player: Player,
  sellingClub: Club,
  buyingClub: Club,
  type: 'permanent' | 'loan',
  currentSeasonYear: number
): {
  askingFee: number;
  askingWage: number;
  interested: boolean;
  reason: string;
} {
  const yearsLeft = Math.max(1, player.contractExpiry - currentSeasonYear);
  const contractFactor = yearsLeft === 1 ? 0.78 : yearsLeft === 2 ? 0.94 : 1.08 + (yearsLeft - 3) * 0.05;

  // Squad importance: top 3 players at club carry a premium
  const financialNeedFactor = sellingClub.financialStrength < 75 ? 0.92 : 1.05;
  const repGap = buyingClub.reputation - sellingClub.reputation;

  // Player interest check
  const interested =
    type === 'loan'
      ? buyingClub.reputation >= sellingClub.reputation - 18
      : buyingClub.reputation >= sellingClub.reputation - 14 || player.overallRating < 83;

  if (!interested) {
    return {
      askingFee: Math.round(player.marketValue * 1.45),
      askingWage: Math.round(player.weeklyWage * 1.25),
      interested: false,
      reason: `${player.fullName} prefers to remain at ${sellingClub.name} given the club reputation gap (${sellingClub.reputation} vs ${buyingClub.reputation}).`,
    };
  }

  const rawAsking =
    type === 'loan'
      ? Math.round((player.marketValue * 0.14) / 50000) * 50000
      : Math.round((player.marketValue * contractFactor * financialNeedFactor) / 100000) * 100000;

  const repWageBump = repGap > 4 ? 1.08 : 1.15;
  const askingWage = Math.max(3000, Math.round((player.weeklyWage * repWageBump) / 500) * 500);

  return {
    askingFee: Math.max(type === 'loan' ? 250000 : 500000, rawAsking),
    askingWage,
    interested: true,
    reason: `${sellingClub.name} are open to discussions for ${player.fullName}.`,
  };
}

export function startTransferNegotiation(
  state: CareerState,
  playerId: string,
  type: 'permanent' | 'loan'
): TransferNegotiationSession {
  const player = state.players[playerId];
  const sellingClub = state.clubs[player.clubId];
  const buyingClub = state.clubs[state.userClubId];
  const seasonYear = parseInt(state.currentSeason.slice(0, 4), 10) || 2015;

  if (player.clubId === buyingClub.id || buyingClub.squadIds.includes(playerId)) {
    return {
      playerId,
      sellingClubId: sellingClub.id,
      buyingClubId: buyingClub.id,
      type,
      stage: 'collapsed',
      round: 1,
      maxRounds: 4,
      offeredFee: 0,
      askingFee: player.marketValue,
      offeredWage: player.weeklyWage,
      askingWage: player.weeklyWage,
      contractYears: 0,
      statusMessage: 'Player is already in your squad.',
      aiFeedback: `${player.fullName} is already registered with ${buyingClub.name}.`,
    };
  }

  const evalRes = evaluateInitialTransferTerms(player, sellingClub, buyingClub, type, seasonYear);

  return {
    playerId,
    sellingClubId: sellingClub.id,
    buyingClubId: buyingClub.id,
    type,
    stage: evalRes.interested ? 'fee' : 'collapsed',
    round: 1,
    maxRounds: 4,
    offeredFee: Math.round((evalRes.askingFee * 0.85) / 100000) * 100000,
    askingFee: evalRes.askingFee,
    offeredWage: evalRes.askingWage,
    askingWage: evalRes.askingWage,
    contractYears: type === 'loan' ? 1 : 4,
    statusMessage: evalRes.interested ? 'Submit your opening club offer.' : 'Talks could not begin.',
    aiFeedback: evalRes.reason,
  };
}

export function submitFeeOffer(
  session: TransferNegotiationSession,
  offeredFee: number,
  buyingClub: Club
): TransferNegotiationSession {
  if (session.stage !== 'fee') return session;

  if (offeredFee > buyingClub.transferBudget) {
    return {
      ...session,
      statusMessage: 'Insufficient transfer budget for this offer.',
      aiFeedback: `Your available transfer budget is €${(buyingClub.transferBudget / 1_000_000).toFixed(1)}M.`,
    };
  }

  if (offeredFee >= session.askingFee * 0.94) {
    return {
      ...session,
      offeredFee,
      stage: 'wage',
      round: 1,
      statusMessage: 'Club fee agreed! Proceed to personal terms.',
      aiFeedback: `The selling club accepted €${(offeredFee / 1_000_000).toFixed(2)}M. Now agree wages and contract length with the player.`,
    };
  }

  if (session.round >= session.maxRounds) {
    return {
      ...session,
      offeredFee,
      stage: 'collapsed',
      statusMessage: 'Negotiations collapsed.',
      aiFeedback: 'The selling club walked away after failing to reach a fee agreement.',
    };
  }

  // Insultingly low bid (< 65% of asking)
  if (offeredFee < session.askingFee * 0.62) {
    return {
      ...session,
      offeredFee,
      round: session.round + 1,
      statusMessage: 'Offer rejected outright.',
      aiFeedback: `That bid is well below valuation. Come closer to €${(session.askingFee / 1_000_000).toFixed(2)}M.`,
    };
  }

  // Counteroffer halfway toward asking
  const counterFee =
    Math.round(((session.askingFee * 0.65 + offeredFee * 0.35) / 100000)) * 100000;

  return {
    ...session,
    offeredFee,
    askingFee: counterFee,
    round: session.round + 1,
    statusMessage: 'Counteroffer received.',
    aiFeedback: `The selling club countered at €${(counterFee / 1_000_000).toFixed(2)}M. Accept or revise your bid.`,
  };
}

export function submitWageOffer(
  session: TransferNegotiationSession,
  offeredWage: number,
  contractYears: number,
  buyingClub: Club,
  currentWeeklyWagesTotal: number
): TransferNegotiationSession {
  if (session.stage !== 'wage') return session;

  if (currentWeeklyWagesTotal + offeredWage > buyingClub.wageBudget * 1.15) {
    return {
      ...session,
      statusMessage: 'Wage budget ceiling exceeded.',
      aiFeedback: 'Board wage controls prevent exceeding 115% of the club wage budget.',
    };
  }

  const lengthBonus = contractYears >= 4 ? 0.95 : 1.03;
  if (offeredWage >= session.askingWage * lengthBonus * 0.92) {
    return {
      ...session,
      offeredWage,
      contractYears,
      stage: 'completed',
      statusMessage: 'Personal terms agreed! Ready to finalize.',
      aiFeedback: `Player accepted €${offeredWage.toLocaleString()}/wk on a ${contractYears}-year deal.`,
    };
  }

  if (session.round >= session.maxRounds) {
    return {
      ...session,
      offeredWage,
      stage: 'collapsed',
      statusMessage: 'Personal terms collapsed.',
      aiFeedback: 'The player agent broke off wage discussions.',
    };
  }

  const counterWage =
    Math.round(((session.askingWage * 0.6 + offeredWage * 0.4) / 500)) * 500;

  return {
    ...session,
    offeredWage,
    askingWage: counterWage,
    contractYears,
    round: session.round + 1,
    statusMessage: 'Wage counterproposal received.',
    aiFeedback: `The player's representative asks for €${counterWage.toLocaleString()}/wk.`,
  };
}

export function executeCompletedTransfer(
  state: CareerState,
  session: TransferNegotiationSession
): { ok: boolean; error?: string; nextState: CareerState; transfer?: Transfer } {
  if (session.stage !== 'completed') {
    return { ok: false, error: 'Negotiation is not finalized.', nextState: state };
  }

  const buyingClub = state.clubs[session.buyingClubId];
  const sellingClub = state.clubs[session.sellingClubId];
  const player = state.players[session.playerId];

  if (!buyingClub || !sellingClub || !player) {
    return { ok: false, error: 'Invalid club or player reference.', nextState: state };
  }

  if (player.clubId === buyingClub.id || buyingClub.squadIds.includes(player.id)) {
    return { ok: false, error: `${player.fullName} is already registered at ${buyingClub.name}.`, nextState: state };
  }

  if (!state.transferWindowOpen) {
    return { ok: false, error: 'The transfer window is currently closed.', nextState: state };
  }

  if (buyingClub.transferBudget < session.offeredFee || buyingClub.balance < session.offeredFee) {
    return { ok: false, error: 'Insufficient transfer budget or club balance.', nextState: state };
  }

  if (sellingClub.squadIds.length <= 15) {
    return {
      ok: false,
      error: `${sellingClub.name} cannot sell below the minimum 15-player squad threshold.`,
      nextState: state,
    };
  }

  const nextClubs = { ...state.clubs };
  const nextPlayers = { ...state.players };

  const updatedBuying: Club = {
    ...buyingClub,
    balance: buyingClub.balance - session.offeredFee,
    transferBudget: buyingClub.transferBudget - session.offeredFee,
    squadIds: [...buyingClub.squadIds, player.id],
  };

  const updatedSelling: Club = {
    ...sellingClub,
    balance: sellingClub.balance + session.offeredFee,
    transferBudget: sellingClub.transferBudget + Math.round(session.offeredFee * 0.6),
    squadIds: sellingClub.squadIds.filter((id) => id !== player.id),
  };

  const seasonYear = parseInt(state.currentSeason.slice(0, 4), 10) || 2015;
  const updatedPlayer: Player = {
    ...player,
    clubId: buyingClub.id,
    weeklyWage: session.offeredWage,
    contractExpiry:
      session.type === 'loan' ? seasonYear + 1 : seasonYear + session.contractYears,
    morale: Math.min(95, player.morale + 8),
    loanedFromClubId: session.type === 'loan' ? sellingClub.id : null,
    loanMatchesRemaining: session.type === 'loan' ? 18 : undefined,
  };

  nextClubs[buyingClub.id] = updatedBuying;
  nextClubs[sellingClub.id] = updatedSelling;
  nextPlayers[player.id] = updatedPlayer;

  const transferRecord: Transfer = {
    id: `tr_${state.currentSeason}_md${state.currentMatchday}_${player.id}`,
    playerId: player.id,
    playerName: player.fullName,
    fromClubId: sellingClub.id,
    fromClubName: sellingClub.name,
    toClubId: buyingClub.id,
    toClubName: buyingClub.name,
    fee: session.offeredFee,
    weeklyWage: session.offeredWage,
    contractYears: session.contractYears,
    type: session.type,
    seasonId: state.currentSeason,
    matchday: state.currentMatchday,
    transferWindow: state.transferWindowLabel === 'Winter' ? 'Winter' : 'Summer',
    date: state.currentDate,
  };

  const nextTransactions = [
    {
      id: `tx_tr_${Date.now()}_${player.id}`,
      date: state.currentDate,
      matchday: state.currentMatchday,
      category: 'Transfer Fee' as const,
      description: `${session.type === 'loan' ? 'Loan fee' : 'Signed'} ${player.fullName} from ${sellingClub.name}`,
      amount: -session.offeredFee,
      balanceAfter: updatedBuying.balance,
    },
    ...state.transactions,
  ];

  const nextNews = [
    {
      id: `news_tr_${Date.now()}_${player.id}`,
      date: state.currentDate,
      matchday: state.currentMatchday,
      category: 'Transfer' as const,
      headline: `${buyingClub.name} complete ${session.type} move for ${player.fullName}`,
      summary: `${player.fullName} joins ${buyingClub.name} from ${sellingClub.name} for €${(session.offeredFee / 1_000_000).toFixed(2)}M on €${session.offeredWage.toLocaleString()}/wk.`,
      clubId: buyingClub.id,
      playerId: player.id,
    },
    ...state.news,
  ].slice(0, 60);

  return {
    ok: true,
    transfer: transferRecord,
    nextState: {
      ...state,
      clubs: nextClubs,
      players: nextPlayers,
      transfers: [transferRecord, ...state.transfers],
      transactions: nextTransactions,
      news: nextNews,
    },
  };
}

export function sellUserPlayer(
  state: CareerState,
  playerId: string
): { ok: boolean; error?: string; nextState: CareerState; fee?: number } {
  const userClub = state.clubs[state.userClubId];
  const player = state.players[playerId];
  if (!userClub || !player || player.clubId !== userClub.id) {
    return { ok: false, error: 'Player not found in your squad.', nextState: state };
  }
  if (player.loanedFromClubId) {
    return { ok: false, error: 'Loaned-in players cannot be sold permanently by your club.', nextState: state };
  }
  if (!state.transferWindowOpen) {
    return { ok: false, error: 'The transfer window is currently closed.', nextState: state };
  }
  if (userClub.squadIds.length <= 15) {
    return {
      ok: false,
      error: 'Cannot sell below the 15-player minimum squad size.',
      nextState: state,
    };
  }

  // Find a solvent AI buyer
  const buyer = Object.values(state.clubs)
    .filter((c) => c.id !== userClub.id && c.transferBudget >= player.marketValue * 0.85)
    .sort((a, b) => Math.abs(a.reputation - userClub.reputation) - Math.abs(b.reputation - userClub.reputation))[0];

  if (!buyer) {
    return {
      ok: false,
      error: 'No club currently has the budget to meet the valuation.',
      nextState: state,
    };
  }

  const fee = Math.round((player.marketValue * 0.95) / 100000) * 100000;
  const nextClubs = { ...state.clubs };
  const nextPlayers = { ...state.players };

  const updatedUserClub: Club = {
    ...userClub,
    balance: userClub.balance + fee,
    transferBudget: userClub.transferBudget + Math.round(fee * 0.65),
    squadIds: userClub.squadIds.filter((id) => id !== player.id),
  };
  const updatedBuyer: Club = {
    ...buyer,
    balance: buyer.balance - fee,
    transferBudget: buyer.transferBudget - fee,
    squadIds: [...buyer.squadIds, player.id],
  };

  nextClubs[userClub.id] = updatedUserClub;
  nextClubs[buyer.id] = updatedBuyer;
  nextPlayers[player.id] = { ...player, clubId: buyer.id };

  // Refresh tactics if sold player was in starting XI or subs
  const wasInTactics =
    state.tactics.slots.some((s) => s.playerId === player.id) ||
    state.tactics.substituteIds.includes(player.id);
  let nextTactics = state.tactics;
  if (wasInTactics) {
    const rebuilt = buildBestLineupForFormation(updatedUserClub, nextPlayers, state.tactics.formation);
    nextTactics = {
      ...state.tactics,
      slots: rebuilt.slots,
      substituteIds: rebuilt.substituteIds,
    };
  }

  const transferRecord: Transfer = {
    id: `tr_sell_${state.currentSeason}_md${state.currentMatchday}_${player.id}`,
    playerId: player.id,
    playerName: player.fullName,
    fromClubId: userClub.id,
    fromClubName: userClub.name,
    toClubId: buyer.id,
    toClubName: buyer.name,
    fee,
    weeklyWage: player.weeklyWage,
    contractYears: 3,
    type: 'permanent',
    seasonId: state.currentSeason,
    matchday: state.currentMatchday,
    transferWindow: state.transferWindowLabel === 'Winter' ? 'Winter' : 'Summer',
    date: state.currentDate,
  };

  return {
    ok: true,
    fee,
    nextState: {
      ...state,
      clubs: nextClubs,
      players: nextPlayers,
      tactics: nextTactics,
      transfers: [transferRecord, ...state.transfers],
      transactions: [
        {
          id: `tx_sell_${Date.now()}_${player.id}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Transfer Fee',
          description: `Sold ${player.fullName} to ${buyer.name}`,
          amount: fee,
          balanceAfter: updatedUserClub.balance,
        },
        ...state.transactions,
      ],
      news: [
        {
          id: `news_sell_${Date.now()}_${player.id}`,
          date: state.currentDate,
          matchday: state.currentMatchday,
          category: 'Transfer' as const,
          headline: `${player.fullName} departs ${userClub.name} for ${buyer.name}`,
          summary: `${userClub.name} agreed a €${(fee / 1_000_000).toFixed(2)}M sale of ${player.fullName}.`,
          clubId: userClub.id,
          playerId: player.id,
        },
        ...state.news,
      ].slice(0, 60),
    },
  };
}
