import { CurrencyDisplay } from '../types';

const CURRENCY_RATES: Record<CurrencyDisplay, { symbol: string; mult: number }> = {
  EUR: { symbol: '€', mult: 1 },
  GBP: { symbol: '£', mult: 0.85 },
  USD: { symbol: '$', mult: 1.1 },
};

export function formatMoney(amountEur: number, currency: CurrencyDisplay = 'EUR'): string {
  const { symbol, mult } = CURRENCY_RATES[currency];
  const converted = amountEur * mult;
  const abs = Math.abs(converted);
  const sign = converted < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${Math.round(abs / 1_000)}K`;
  }
  return `${sign}${symbol}${Math.round(abs).toLocaleString()}`;
}

export function formatMoneyExact(amountEur: number, currency: CurrencyDisplay = 'EUR'): string {
  const { symbol, mult } = CURRENCY_RATES[currency];
  const converted = Math.round(amountEur * mult);
  const sign = converted < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(converted).toLocaleString()}`;
}

export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function playUiTone(type: 'whistle' | 'goal' | 'click', enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'goal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } else if (type === 'whistle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch {
    // Ignore audio context restrictions
  }
}
