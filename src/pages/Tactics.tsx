import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, RotateCcw, Sparkles } from 'lucide-react';
import {
  ALL_FORMATIONS,
  buildBestLineupForFormation,
  FORMATION_TEMPLATES,
  validateTactics,
} from '../engine/tacticsEngine';
import { calculateEffectiveRatingForSlot, POSITION_CODES } from '../engine/ratings';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { GamePageHeader, OvrBadge } from '../components/shared/GamePrimitives';
import { SkillSlotTags, SuperstarStar } from '../components/shared/SkillBadges';
import {
  ClubTactics,
  DefensiveLine,
  FormationName,
  Mentality,
  PassingStyle,
  PressingIntensity,
  TacticalTempo,
  TacticalWidth,
} from '../types';

export const Tactics: React.FC = () => {
  const { career, updateTactics } = useCareerStore();
  const { pushToast } = useUiStore();

  const [draft, setDraft] = useState<ClubTactics | null>(
    career ? structuredClone(career.tactics) : null
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

  const userClub = career ? career.clubs[career.userClubId] : null;

  React.useEffect(() => {
    if (career) {
      setDraft(structuredClone(career.tactics));
      setSelectedPlayerId(null);
    }
  }, [career?.id, career?.currentSeason, userClub?.squadIds.length]);

  if (!career || !draft || !userClub) return null;

  const validation = useMemo(
    () => validateTactics(draft, userClub, career.players),
    [draft, userClub, career.players]
  );

  const starterIds = useMemo(
    () => new Set(draft.slots.map((s) => s.playerId).filter(Boolean) as string[]),
    [draft.slots]
  );

  const subIds = useMemo(() => new Set(draft.substituteIds), [draft.substituteIds]);

  const squadPlayers = useMemo(
    () =>
      userClub.squadIds
        .map((id) => career.players[id])
        .filter(Boolean)
        .sort((a, b) => b.overallRating - a.overallRating),
    [userClub.squadIds, career.players]
  );

  const handleFormationChange = (formation: FormationName) => {
    const templates = FORMATION_TEMPLATES[formation];
    const currentStarters = draft.slots.map((s) => s.playerId).filter(Boolean) as string[];
    const newSlots = templates.map((tpl, idx) => ({
      ...tpl,
      playerId: currentStarters[idx] ?? null,
    }));
    setDraft({ ...draft, formation, slots: newSlots });
    setSelectedPlayerId(null);
  };

  const handleAutoPick = () => {
    const best = buildBestLineupForFormation(userClub, career.players, draft.formation);
    setDraft({
      ...draft,
      slots: best.slots,
      substituteIds: best.substituteIds,
    });
    setSelectedPlayerId(null);
    pushToast('info', `Auto-picked best XI for ${draft.formation}.`);
  };

  const swapOrAssignPlayer = (targetSlotIndex: number, incomingPlayerId: string) => {
    const nextSlots = draft.slots.map((s) => ({ ...s }));
    let nextSubs = [...draft.substituteIds];

    const incomingSlotIdx = nextSlots.findIndex((s) => s.playerId === incomingPlayerId);
    const outgoingPlayerId = nextSlots[targetSlotIndex].playerId;

    if (incomingSlotIdx !== -1) {
      nextSlots[incomingSlotIdx].playerId = outgoingPlayerId;
      nextSlots[targetSlotIndex].playerId = incomingPlayerId;
    } else {
      nextSlots[targetSlotIndex].playerId = incomingPlayerId;
      const incomingSubIdx = nextSubs.indexOf(incomingPlayerId);
      if (incomingSubIdx !== -1 && outgoingPlayerId) {
        nextSubs[incomingSubIdx] = outgoingPlayerId;
      } else {
        nextSubs = nextSubs.filter((id) => id !== incomingPlayerId);
        if (outgoingPlayerId && nextSubs.length < 7 && !nextSubs.includes(outgoingPlayerId)) {
          nextSubs.push(outgoingPlayerId);
        }
      }
    }

    setDraft({
      ...draft,
      slots: nextSlots,
      substituteIds: nextSubs,
    });
    setSelectedPlayerId(null);
  };

  const handleSlotClick = (slotIndex: number) => {
    const slotPlayerId = draft.slots[slotIndex].playerId;
    if (!selectedPlayerId) {
      if (slotPlayerId) setSelectedPlayerId(slotPlayerId);
      return;
    }
    if (selectedPlayerId === slotPlayerId) {
      setSelectedPlayerId(null);
      return;
    }
    swapOrAssignPlayer(slotIndex, selectedPlayerId);
  };

  const handleToggleBench = (playerId: string) => {
    if (starterIds.has(playerId)) return;
    if (subIds.has(playerId)) {
      setDraft({
        ...draft,
        substituteIds: draft.substituteIds.filter((id) => id !== playerId),
      });
    } else if (draft.substituteIds.length < 7) {
      setDraft({
        ...draft,
        substituteIds: [...draft.substituteIds, playerId],
      });
    } else {
      pushToast('warning', 'Bench is full (maximum 7 substitutes).');
    }
  };

  const handleSave = async () => {
    const res = await updateTactics(draft);
    if (res.ok) {
      pushToast('success', `Tactics saved (${draft.formation}).`);
    } else {
      pushToast('error', res.errors[0] ?? 'Invalid tactical setup.');
    }
  };

  const startersForDropdown = draft.slots
    .map((s) => (s.playerId ? career.players[s.playerId] : null))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GamePageHeader
        eyebrow={`${userClub.name} · Tactical Board`}
        title="Tactical Editor"
        accentColor={userClub.crest.primaryColor}
        subtitle={
          <span>
            Drag players onto pitch slots or tap any player then tap a position to swap · Effective XI Rating:{' '}
            <span className="font-mono text-emerald-400 font-bold">
              {validation.effectiveTeamRating}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OvrBadge rating={validation.effectiveTeamRating} label="XI" size="sm" />
            <button
              type="button"
              onClick={handleAutoPick}
              className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Auto-Pick Best XI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(structuredClone(career.tactics));
                setSelectedPlayerId(null);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="ft-chamfer-sm inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Tactics</span>
            </button>
          </div>
        }
      />

      {/* Validation & Out-of-Position Warnings */}
      {(!validation.valid || validation.outOfPositionWarnings.length > 0) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 p-4 space-y-1.5 text-xs">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-300 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
          {validation.outOfPositionWarnings.map((w) => (
            <div key={w.slotIndex} className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>
                Out of natural position: {w.playerName} ({w.playerPrimaryPosition}) deployed at{' '}
                {w.slotLabel} ({w.requiredPosition})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main Tactical Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Hero Pitch Canvas (6 cols) */}
        <div className="xl:col-span-6 space-y-3.5">
          {/* Formation Selector Console */}
          <div className="ft-panel rounded-lg p-2 flex flex-wrap gap-1.5">
            {ALL_FORMATIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormationChange(f)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
                  draft.formation === f
                    ? 'bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
                    : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Interactive Tactical Pitch */}
          <div className="ft-pitch-turf relative w-full aspect-[4/5] max-h-[620px] rounded-lg border border-emerald-500/30 overflow-hidden select-none shadow-2xl">
            {/* Pitch Markings SVG */}
            <svg
              viewBox="0 0 100 125"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
            >
              {/* Outer Touchline */}
              <rect x="4" y="4" width="92" height="117" fill="none" stroke="#E2E8F0" strokeWidth="0.65" />
              {/* Halfway Line & Center Circle */}
              <line x1="4" y1="62.5" x2="96" y2="62.5" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="62.5" r="11.5" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="62.5" r="0.9" fill="#E2E8F0" />
              {/* Top Penalty Area & Arc */}
              <rect x="23" y="4" width="54" height="18" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <rect x="36" y="4" width="28" height="7" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="15.5" r="0.7" fill="#E2E8F0" />
              <path d="M 41 22 A 10 10 0 0 0 59 22" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              {/* Bottom Penalty Area & Arc */}
              <rect x="23" y="103" width="54" height="18" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <rect x="36" y="114" width="28" height="7" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="109.5" r="0.7" fill="#E2E8F0" />
              <path d="M 41 103 A 10 10 0 0 1 59 103" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              {/* Corner Arcs */}
              <path d="M 4 7 A 3 3 0 0 0 7 4" fill="none" stroke="#E2E8F0" strokeWidth="0.55" />
              <path d="M 93 4 A 3 3 0 0 0 96 7" fill="none" stroke="#E2E8F0" strokeWidth="0.55" />
              <path d="M 4 118 A 3 3 0 0 1 7 121" fill="none" stroke="#E2E8F0" strokeWidth="0.55" />
              <path d="M 93 121 A 3 3 0 0 1 96 118" fill="none" stroke="#E2E8F0" strokeWidth="0.55" />
            </svg>

            {/* Tactical Player Pitch Tokens */}
            {draft.slots.map((slot) => {
              const p = slot.playerId ? career.players[slot.playerId] : undefined;
              const isSelected = Boolean(p && selectedPlayerId === p.id);
              const effRating = p
                ? calculateEffectiveRatingForSlot(p, slot.rolePosition)
                : 0;
              const outOfPos = p && p.primaryPosition !== slot.rolePosition;

              return (
                <button
                  key={slot.slotIndex}
                  type="button"
                  draggable={Boolean(p)}
                  onDragStart={() => p && setDraggedPlayerId(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedPlayerId) {
                      swapOrAssignPlayer(slot.slotIndex, draggedPlayerId);
                      setDraggedPlayerId(null);
                    }
                  }}
                  onClick={() => handleSlotClick(slot.slotIndex)}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group focus:outline-none"
                >
                  <div
                    className={`ft-chamfer-sm w-10 h-10 sm:w-11 sm:h-11 flex flex-col items-center justify-center font-mono text-xs font-bold border-2 transition-transform shadow-[0_6px_16px_rgba(0,0,0,0.65)] ${
                      isSelected
                        ? 'scale-110 border-white bg-emerald-500 text-slate-950'
                        : outOfPos
                          ? 'border-amber-400 bg-[#121824]/95 text-amber-300'
                          : 'border-emerald-400/90 bg-[#0A1120]/95 text-[#F4F5F0] group-hover:scale-105'
                    }`}
                  >
                    <span className="leading-none">{p ? effRating : '—'}</span>
                    <span className="text-[8px] opacity-75 leading-none mt-0.5">{slot.label}</span>
                  </div>
                  <div className="mt-1 px-1.5 py-0.5 rounded-xs bg-[#070B14]/92 border border-slate-700/80 text-[10px] sm:text-[11px] font-semibold text-[#F4F5F0] max-w-[104px] truncate inline-flex items-center gap-1 shadow">
                    <span className="truncate">
                      {p ? p.fullName.split(' ').slice(-1)[0] : 'Empty'}
                    </span>
                    <SuperstarStar isSuperstar={p?.isSuperstar} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls & Squad Assignment (6 cols) */}
        <div className="xl:col-span-6 space-y-5">
          {/* Tactical Sliders / Selectors */}
          <div className="ft-panel rounded-lg p-5 space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
              Tactical Instructions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Mentality
                </label>
                <select
                  value={draft.mentality}
                  onChange={(e) => setDraft({ ...draft, mentality: e.target.value as Mentality })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Very Defensive', 'Defensive', 'Balanced', 'Attacking', 'Very Attacking'] as Mentality[]).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Pressing
                </label>
                <select
                  value={draft.pressing}
                  onChange={(e) =>
                    setDraft({ ...draft, pressing: e.target.value as PressingIntensity })
                  }
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Low', 'Medium', 'High', 'Aggressive'] as PressingIntensity[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Defensive Line
                </label>
                <select
                  value={draft.defensiveLine}
                  onChange={(e) =>
                    setDraft({ ...draft, defensiveLine: e.target.value as DefensiveLine })
                  }
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Deep', 'Balanced', 'High'] as DefensiveLine[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Passing Style
                </label>
                <select
                  value={draft.passing}
                  onChange={(e) => setDraft({ ...draft, passing: e.target.value as PassingStyle })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Short', 'Mixed', 'Direct'] as PassingStyle[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Width
                </label>
                <select
                  value={draft.width}
                  onChange={(e) => setDraft({ ...draft, width: e.target.value as TacticalWidth })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Narrow', 'Balanced', 'Wide'] as TacticalWidth[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Tempo
                </label>
                <select
                  value={draft.tempo}
                  onChange={(e) => setDraft({ ...draft, tempo: e.target.value as TacticalTempo })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
                >
                  {(['Slow', 'Balanced', 'Fast'] as TacticalTempo[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Roles: Captain & Set Pieces */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Captain
                </label>
                <select
                  value={draft.captainId ?? ''}
                  onChange={(e) => setDraft({ ...draft, captainId: e.target.value })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2 py-1.5 text-[#F4F5F0]"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Penalties
                </label>
                <select
                  value={draft.penaltyTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, penaltyTakerId: e.target.value })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2 py-1.5 text-[#F4F5F0]"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Free Kicks
                </label>
                <select
                  value={draft.freeKickTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, freeKickTakerId: e.target.value })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2 py-1.5 text-[#F4F5F0]"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Corners
                </label>
                <select
                  value={draft.cornerTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, cornerTakerId: e.target.value })}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-2 py-1.5 text-[#F4F5F0]"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Squad Selection & Substitutes */}
          <div className="ft-panel rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
                Squad &amp; Substitutes ({draft.substituteIds.length}/7)
              </h2>
              {selectedPlayerId && (
                <span className="text-xs font-mono text-emerald-400">
                  Selected: {career.players[selectedPlayerId]?.fullName} — tap a pitch slot
                </span>
              )}
            </div>

            <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-800/70">
              {squadPlayers.map((p) => {
                const isStarter = starterIds.has(p.id);
                const isSub = subIds.has(p.id);
                const isSelected = selectedPlayerId === p.id;
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggedPlayerId(p.id)}
                    className={`py-2 px-2 flex items-center justify-between gap-3 rounded transition-colors ${
                      isSelected ? 'bg-emerald-500/15' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPlayerId(isSelected ? null : p.id)
                      }
                      className="flex items-center gap-3 text-left min-w-0 flex-1"
                    >
                      <span className="font-mono text-xs font-bold w-8 text-slate-400">
                        {POSITION_CODES[p.primaryPosition]}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[#F4F5F0] truncate">
                            {p.fullName}
                          </span>
                          <SuperstarStar isSuperstar={p.isSuperstar} />
                        </div>
                        <SkillSlotTags player={p} compact />
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                        {p.overallRating}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {p.fitness}%
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {isStarter ? (
                        <span className="text-[11px] font-mono font-bold text-emerald-400 px-2">
                          XI
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleBench(p.id)}
                          className={`rounded border px-2.5 py-1 text-[11px] font-semibold ${
                            isSub
                              ? 'border-sky-400/50 bg-sky-500/15 text-sky-300'
                              : 'border-slate-700 bg-[#070B14] text-slate-300 hover:text-white'
                          }`}
                        >
                          {isSub ? 'Sub' : 'Add Sub'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
