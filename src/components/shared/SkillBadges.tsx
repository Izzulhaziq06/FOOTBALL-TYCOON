import React from 'react';
import { Star } from 'lucide-react';
import { getSkillById, SKILL_CATALOGUE, SkillId } from '../../engine/skills';
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
      className="inline-flex items-center justify-center shrink-0 text-amber-400"
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
    <div className="inline-flex flex-wrap items-center gap-1">
      {s1 && (
        <span
          title={`Blue Skill 1: ${s1.name} — ${s1.description}`}
          className={`inline-flex items-center rounded border border-sky-500/45 bg-sky-500/15 font-medium text-sky-200 ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-sm bg-sky-400 mr-1.5 shrink-0" />
          {s1.name}
        </span>
      )}
      {s2 && (
        <span
          title={`Purple Skill 2: ${s2.name} — ${s2.description}`}
          className={`inline-flex items-center rounded border border-purple-500/45 bg-purple-500/15 font-medium text-purple-200 ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-sm bg-purple-400 mr-1.5 shrink-0" />
          {s2.name}
        </span>
      )}
    </div>
  );
};

export const SkillSlotCard: React.FC<{
  slotLabel: 'Skill 1 (Blue)' | 'Skill 2 (Purple)';
  tone: 'blue' | 'purple';
  value: SkillId | null;
  blockedValue: SkillId | null;
  editable?: boolean;
  onChange?: (next: SkillId | null) => void;
  selectAriaLabel?: string;
}> = ({
  slotLabel,
  tone,
  value,
  blockedValue,
  editable = false,
  onChange,
  selectAriaLabel,
}) => {
  const skill = getSkillById(value);
  const borderAccent =
    tone === 'blue' ? 'border-sky-500/50 bg-sky-950/20' : 'border-purple-500/50 bg-purple-950/20';
  const labelAccent = tone === 'blue' ? 'text-sky-300' : 'text-purple-300';
  const dotAccent = tone === 'blue' ? 'bg-sky-400' : 'bg-purple-400';

  return (
    <div className={`rounded-lg border ${borderAccent} p-4 space-y-2.5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${dotAccent}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${labelAccent}`}>
            {slotLabel}
          </span>
        </div>
        {skill && (
          <span className="text-[11px] font-mono text-slate-400">{skill.category}</span>
        )}
      </div>

      {editable && onChange ? (
        <select
          aria-label={selectAriaLabel ?? slotLabel}
          value={value ?? ''}
          onChange={(e) => onChange((e.target.value || null) as SkillId | null)}
          className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm font-medium text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Empty (No Skill)</option>
          {SKILL_CATALOGUE.map((def) => {
            const isBlocked = blockedValue === def.id;
            return (
              <option key={def.id} value={def.id} disabled={isBlocked}>
                {def.name} ({def.category}){isBlocked ? ' — Equipped in other slot' : ''}
              </option>
            );
          })}
        </select>
      ) : (
        <div className="text-base font-semibold text-white">
          {skill ? skill.name : 'Empty Slot'}
        </div>
      )}

      {skill ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-300 leading-relaxed">{skill.description}</p>
          <div className="text-[11px] font-mono text-slate-400">
            Effect: {skill.simulationEffectSummary}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          No playstyle modifier equipped in this slot.
        </p>
      )}
    </div>
  );
};
