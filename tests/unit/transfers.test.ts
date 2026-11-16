import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../../src/engine/careerEngine';
import {
  executeCompletedTransfer,
  startTransferNegotiation,
  submitFeeOffer,
  submitWageOffer,
} from '../../src/engine/transferEngine';

describe('Transfer Market & Negotiation Engine', () => {
  it('completes a valid permanent transfer and updates club budgets, squads, and history', () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'chelsea',
      managerName: 'Test Manager',
      managerNationality: 'England',
      philosophy: 'Balanced',
    });

    const targetId = 'carlos_vela'; // Real Sociedad player
    const startingBudget = career.clubs['chelsea'].transferBudget;
    const startingSquadSize = career.clubs['chelsea'].squadIds.length;

    let session = startTransferNegotiation(career, targetId, 'permanent');
    expect(session.stage).toBe('fee');

    session = submitFeeOffer(session, session.askingFee, career.clubs['chelsea']);
    expect(session.stage).toBe('wage');

    session = submitWageOffer(session, session.askingWage, 4, career.clubs['chelsea'], 1_000_000);
    expect(session.stage).toBe('completed');

    const res = executeCompletedTransfer(career, session);
    expect(res.ok).toBe(true);
    expect(res.nextState.players[targetId].clubId).toBe('chelsea');
    expect(res.nextState.clubs['chelsea'].squadIds.length).toBe(startingSquadSize + 1);
    expect(res.nextState.clubs['chelsea'].transferBudget).toBe(
      startingBudget - session.offeredFee
    );
    expect(res.nextState.transfers[0].playerId).toBe(targetId);
  });

  it('prevents offers exceeding transfer budget and supports loan deals', () => {
    const career = createNewCareer({
      seasonId: '2014/15',
      clubId: 'west_ham',
      managerName: 'Test Manager',
      managerNationality: 'England',
      philosophy: 'Pragmatic',
    });

    // Insufficient budget rejection
    const expensiveSession = startTransferNegotiation(career, 'lionel_messi', 'permanent');
    if (expensiveSession.stage === 'fee') {
      const overBid = submitFeeOffer(
        expensiveSession,
        career.clubs['west_ham'].transferBudget + 5_000_000,
        career.clubs['west_ham']
      );
      expect(overBid.stage).toBe('fee');
      expect(overBid.statusMessage).toContain('Insufficient');
    }

    // Valid loan transfer
    let loan = startTransferNegotiation(career, 'carlos_vela', 'loan');
    expect(loan.type).toBe('loan');
    if (loan.stage === 'fee') {
      loan = submitFeeOffer(loan, loan.askingFee, career.clubs['west_ham']);
      loan = submitWageOffer(loan, loan.askingWage, 1, career.clubs['west_ham'], 500_000);
      const loanRes = executeCompletedTransfer(career, loan);
      expect(loanRes.ok).toBe(true);
      expect(loanRes.nextState.players['carlos_vela'].loanedFromClubId).toBe('sociedad');
    }
  });
});
