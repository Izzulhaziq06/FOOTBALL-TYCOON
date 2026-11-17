import React from 'react';

export const GameBrandMark: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ft-brand-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="50%" stopColor="#0E1523" />
        <stop offset="100%" stopColor="#070B14" />
      </linearGradient>
      <linearGradient id="ft-brand-edge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <path
      d="M32 4 L56 12 V31 C56 46.5 44.5 56.8 32 60.5 C19.5 56.8 8 46.5 8 31 V12 Z"
      fill="url(#ft-brand-metal)"
      stroke="url(#ft-brand-edge)"
      strokeWidth="2.8"
    />
    <path
      d="M32 9.5 L50.5 16 V30.5 C50.5 43 41.2 51.5 32 54.6 C22.8 51.5 13.5 43 13.5 30.5 V16 Z"
      fill="none"
      stroke="rgba(244,245,240,0.16)"
      strokeWidth="1"
    />
    {/* Pitch center line + circle motif */}
    <line x1="16" y1="32" x2="48" y2="32" stroke="#10B981" strokeWidth="1.6" strokeOpacity="0.65" />
    <circle cx="32" cy="32" r="8" fill="none" stroke="#10B981" strokeWidth="1.8" />
    <path
      d="M25 22 H39 M32 22 V44"
      stroke="#F4F5F0"
      strokeWidth="3.2"
      strokeLinecap="square"
    />
  </svg>
);

export const CompetitionEmblem: React.FC<{
  competitionId: string;
  size?: number;
  className?: string;
}> = ({ competitionId, size = 28, className = '' }) => {
  const palette: Record<string, { bg: string; ring: string; accent: string; code: string }> = {
    epl: { bg: '#0F1A38', ring: '#10B981', accent: '#F4F5F0', code: 'EPL' },
    laliga: { bg: '#2A1215', ring: '#F59E0B', accent: '#F4F5F0', code: 'LL' },
    bundesliga: { bg: '#2B0D12', ring: '#EF4444', accent: '#F4F5F0', code: 'BL' },
    seriea: { bg: '#0C213A', ring: '#38BDF8', accent: '#F4F5F0', code: 'SA' },
    ligue1: { bg: '#13241A', ring: '#34D399', accent: '#F4F5F0', code: 'L1' },
    ucl: { bg: '#0A1633', ring: '#94A3B8', accent: '#F4F5F0', code: 'UCL' },
    uel: { bg: '#241409', ring: '#F59E0B', accent: '#FDE68A', code: 'UEL' },
  };
  const cfg = palette[competitionId] ?? {
    bg: '#111827',
    ring: '#10B981',
    accent: '#F4F5F0',
    code: competitionId.slice(0, 3).toUpperCase(),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polygon
        points="20,2 36,10 36,28 20,38 4,28 4,10"
        fill={cfg.bg}
        stroke={cfg.ring}
        strokeWidth="2"
      />
      <polygon
        points="20,6 32,12.5 32,26 20,34 8,26 8,12.5"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
      <text
        x="20"
        y="23.5"
        textAnchor="middle"
        fill={cfg.accent}
        fontSize={cfg.code.length >= 3 ? '9.5' : '11'}
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
        letterSpacing="0.6"
      >
        {cfg.code}
      </text>
    </svg>
  );
};

export const OvrBadge: React.FC<{
  rating: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ rating, label, size = 'md' }) => {
  const tier =
    rating >= 85
      ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300'
      : rating >= 78
        ? 'border-emerald-500/45 bg-emerald-950/50 text-emerald-200'
        : rating >= 70
          ? 'border-slate-500/50 bg-slate-800/70 text-[#F4F5F0]'
          : 'border-slate-700 bg-slate-900/80 text-slate-300';

  if (size === 'lg') {
    return (
      <div
        className={`ft-chamfer-sm border px-3.5 py-2 text-center min-w-[68px] ${tier}`}
      >
        {label && (
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {label}
          </div>
        )}
        <div className="font-display text-3xl font-extrabold leading-none tabular-nums">
          {rating}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ft-chamfer-sm border font-mono font-bold tabular-nums ${tier} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs min-w-[32px]' : 'px-2.5 py-1 text-sm min-w-[38px]'
      }`}
    >
      {rating}
    </span>
  );
};

export const GamePageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  accentColor?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, accentColor = '#10B981', actions }) => (
  <div className="ft-broadcast-strip rounded-lg px-4 py-4 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 w-1"
      style={{ backgroundColor: accentColor }}
      aria-hidden="true"
    />
    <div className="pl-2 min-w-0">
      {eyebrow && (
        <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-emerald-400 font-semibold">
          {eyebrow}
        </div>
      )}
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F5F0] leading-none mt-0.5">
        {title}
      </h1>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">{subtitle}</div>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 pl-2 md:pl-0">{actions}</div>}
  </div>
);

export const MomentumComparisonBar: React.FC<{
  label: string;
  homeValue: string | number;
  awayValue: string | number;
  homeNum: number;
  awayNum: number;
  homeColor?: string;
  awayColor?: string;
}> = ({
  label,
  homeValue,
  awayValue,
  homeNum,
  awayNum,
  homeColor = '#10B981',
  awayColor = '#64748B',
}) => {
  const total = Math.max(1, homeNum + awayNum);
  const homePct = Math.round((homeNum / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span className="font-mono font-bold text-[#F4F5F0] w-14">{homeValue}</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
          {label}
        </span>
        <span className="font-mono font-bold text-[#F4F5F0] w-14 text-right">{awayValue}</span>
      </div>
      <div className="h-1.5 w-full rounded-sm bg-[#070B14] overflow-hidden flex gap-0.5">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${homePct}%`, backgroundColor: homeColor }}
        />
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
        />
      </div>
    </div>
  );
};
