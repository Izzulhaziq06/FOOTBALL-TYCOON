import React from 'react';
import { Dices, Lock, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getSkillById, SkillId } from '../../engine/skills';
import { Player } from '../../types';

export const SuperstarStar: React.FC<{
  isSuperstar?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ isSuperstar, size = 'sm' }) => {
  if (!isSuperstar) return null;
  const dim =
    size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]"
      title="Superstar Player"
      aria-label="Superstar"
    >
      <Star className={`${dim} fill-amber-400 text-amber-300`} />
    </span>
  );
};

export const SkillSlotTags: React.FC<{
  player: Pick<Player, 'skill1' | 'skill2'>;
  compact?: boolean;
}> = ({ player, compact = false }) => {
  const s1 = getSkillById(player.skill1);
  const s2 = getSkillById(player.skill2);
  if (!s1 && !s2) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {s1 && (
        <span
          title={`Natural Skill (Blue): ${s1.name} — ${s1.description}`}
          className={`inline-flex items-center rounded-sm border border-sky-400/35 bg-[#0C1D33] font-medium text-sky-200 ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <span className="h-1.5 w-1.5 bg-sky-400 mr-1.5 shrink-0" />
          {s1.name}
        </span>
      )}
      {s2 && (
        <span
          title={`Developed Skill (Purple): ${s2.name} — ${s2.description}`}
          className={`inline-flex items-center rounded-sm border border-purple-400/35 bg-[#1B1330] font-medium text-purple-200 ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <span className="h-1.5 w-1.5 bg-purple-400 mr-1.5 shrink-0" />
          {s2.name}
        </span>
      )}
    </div>
  );
};

export const SkillSlotCard: React.FC<{
  mode: 'natural' | 'developed';
  value: SkillId | null;
  isUserPlayer?: boolean;
  tokenCount?: number;
  eligibleCount?: number;
  isRolling?: boolean;
  revealKey?: number;
  onUnlockOrReroll?: () => void;
}> = ({
  mode,
  value,
  isUserPlayer = false,
  tokenCount = 0,
  eligibleCount = 0,
  isRolling = false,
  revealKey = 0,
  onUnlockOrReroll,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const skill = getSkillById(value);
  const isNatural = mode === 'natural';

  const borderAccent = isNatural
    ? 'border-sky-400/35 bg-[#0A1629]'
    : skill
      ? 'border-purple-400/45 bg-[#161029]'
      : 'border-slate-700/70 bg-[#0B1020]';
  const labelAccent = isNatural ? 'text-sky-300' : 'text-purple-300';
  const dotAccent = isNatural ? 'bg-sky-400' : skill ? 'bg-purple-400' : 'bg-slate-500';
  const slotTitle = isNatural ? 'Natural Skill (Blue)' : 'Developed Skill (Purple)';

  return (
    <div
      data-testid={isNatural ? 'natural-skill-card' : 'developed-skill-card'}
      className={`rounded-md border ${borderAccent} p-4 flex flex-col justify-between gap-3 relative overflow-hidden`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 ${dotAccent}`} />
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${labelAccent}`}>
              {slotTitle}
            </span>
          </div>
          {isNatural ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-sky-300 border border-sky-400/30 bg-sky-950/40 px-2 py-0.5 rounded-sm">
              <ShieldCheck className="h-3 w-3" />
              Permanent
            </span>
          ) : skill ? (
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-200 border border-purple-400/30 bg-purple-950/40 px-2 py-0.5 rounded-sm">
              {skill.category}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border border-slate-700 bg-slate-900/70 px-2 py-0.5 rounded-sm">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>

        <motion.div
          key={`${mode}-${value ?? 'locked'}-${revealKey}`}
          initial={
            !isNatural && revealKey > 0 && !shouldReduceMotion
              ? { opacity: 0.35, y: 6, scale: 0.97 }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-xl font-bold text-[#F4F5F0]">
              {skill ? skill.name : 'Developed Slot Locked'}
            </div>
            {isNatural && skill && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {skill.category}
              </span>
            )}
          </div>

          {skill ? (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-300 leading-relaxed">{skill.description}</p>
              <div className="text-[11px] font-mono text-slate-400 pt-1.5 border-t border-white/5">
                {skill.simulationEffectSummary}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlock with 1 Universal Skill Token to randomly roll an eligible playstyle from{' '}
              <span className="font-mono text-slate-200">{eligibleCount}</span> position-compatible
              skills (excludes Natural Skill).
            </p>
          )}
        </motion.div>
      </div>

      {isNatural ? (
        <div className="text-[11px] text-slate-400 pt-2 border-t border-white/5">
          Innate player trait assigned at career start. Permanent and cannot be changed.
        </div>
      ) : isUserPlayer && onUnlockOrReroll ? (
        <div className="pt-2 border-t border-white/5 space-y-2">
          <button
            type="button"
            disabled={tokenCount < 1 || isRolling}
            onClick={onUnlockOrReroll}
            className={`ft-chamfer-sm w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              tokenCount < 1 || isRolling
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : skill
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {skill ? <Dices className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>
              {isRolling
                ? 'Rolling Skill...'
                : skill
                  ? 'Reroll Developed Skill (1 Token)'
                  : 'Unlock Developed Skill (1 Token)'}
            </span>
          </button>
          {tokenCount < 1 ? (
            <p className="text-[11px] text-amber-300/90 leading-snug">
              0 Universal Skill Tokens available. Earn tokens via +1 OVR training breakthroughs,
              Academy promotions, match milestones, and season targets.
            </p>
          ) : skill ? (
            <p className="text-[11px] text-slate-400">
              Unlimited rerolls available ({eligibleCount} distinct eligible skills in pool).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
