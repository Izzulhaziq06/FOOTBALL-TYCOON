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
    // Keep existing GK in slot 0, remap remaining slots by position match or order
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
      // Swap two starters on the pitch
      nextSlots[incomingSlotIdx].playerId = outgoingPlayerId;
      nextSlots[targetSlotIndex].playerId = incomingPlayerId;
    } else {
      // Incoming is from subs or reserves
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Tactical Editor</h1>
          <p className="text-xs text-slate-400">
            Drag players onto pitch slots or tap any player then tap a position to swap · Effective XI Rating:{' '}
            <span className="font-mono text-emerald-400 font-semibold">
              {validation.effectiveTeamRating}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoPick}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200"
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
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Save Tactics</span>
          </button>
        </div>
      </div>

      {/* Validation & Out-of-Position Warnings */}
      {(!validation.valid || validation.outOfPositionWarnings.length > 0) && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/25 p-4 space-y-1.5 text-xs">
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
        {/* Pitch Visualization (6 cols) */}
        <div className="xl:col-span-6 space-y-4">
          {/* Formation Selector Strip */}
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-[#121824] p-2">
            {ALL_FORMATIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormationChange(f)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                  draft.formation === f
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Interactive Pitch */}
          <div className="relative w-full aspect-[4/5] max-h-[600px] rounded-lg border border-emerald-900/60 overflow-hidden bg-gradient-to-b from-[#0C3522] via-[#0F3D28] to-[#0B2D1D] select-none">
            {/* Pitch Markings SVG */}
            <svg
              viewBox="0 0 100 125"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-35"
            >
              <rect x="4" y="4" width="92" height="117" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <line x1="4" y1="62.5" x2="96" y2="62.5" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="62.5" r="11" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <circle cx="50" cy="62.5" r="0.8" fill="#E2E8F0" />
              {/* Top penalty area */}
              <rect x="24" y="4" width="52" height="18" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <rect x="36" y="4" width="28" height="7" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              {/* Bottom penalty area */}
              <rect x="24" y="103" width="52" height="18" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
              <rect x="36" y="114" width="28" height="7" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
            </svg>

            {/* Player Nodes */}
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
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group focus:outline-none`}
                >
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-transform ${
                      isSelected
                        ? 'scale-110 border-white bg-emerald-500 text-slate-950'
                        : outOfPos
                          ? 'border-amber-400 bg-[#121824]/95 text-amber-300'
                          : 'border-emerald-400 bg-[#0E1420]/95 text-white group-hover:scale-105'
                    }`}
                  >
                    {p ? effRating : '—'}
                  </div>
                  <div className="mt-1 px-1.5 py-0.5 rounded bg-[#0B0F17]/90 border border-slate-700/80 text-[10px] sm:text-[11px] font-medium text-white max-w-[100px] truncate inline-flex items-center gap-1">
                    <span className="truncate">
                      {slot.label} · {p ? p.fullName.split(' ').slice(-1)[0] : 'Empty'}
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
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">Tactical Instructions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Mentality</label>
                <select
                  value={draft.mentality}
                  onChange={(e) => setDraft({ ...draft, mentality: e.target.value as Mentality })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
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
                <label className="block text-slate-400 mb-1">Pressing</label>
                <select
                  value={draft.pressing}
                  onChange={(e) =>
                    setDraft({ ...draft, pressing: e.target.value as PressingIntensity })
                  }
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
                >
                  {(['Low', 'Medium', 'High', 'Aggressive'] as PressingIntensity[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Defensive Line</label>
                <select
                  value={draft.defensiveLine}
                  onChange={(e) =>
                    setDraft({ ...draft, defensiveLine: e.target.value as DefensiveLine })
                  }
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
                >
                  {(['Deep', 'Balanced', 'High'] as DefensiveLine[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Passing Style</label>
                <select
                  value={draft.passing}
                  onChange={(e) => setDraft({ ...draft, passing: e.target.value as PassingStyle })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
                >
                  {(['Short', 'Mixed', 'Direct'] as PassingStyle[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Width</label>
                <select
                  value={draft.width}
                  onChange={(e) => setDraft({ ...draft, width: e.target.value as TacticalWidth })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
                >
                  {(['Narrow', 'Balanced', 'Wide'] as TacticalWidth[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Tempo</label>
                <select
                  value={draft.tempo}
                  onChange={(e) => setDraft({ ...draft, tempo: e.target.value as TacticalTempo })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-white"
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
                <label className="block text-slate-400 mb-1">Captain</label>
                <select
                  value={draft.captainId ?? ''}
                  onChange={(e) => setDraft({ ...draft, captainId: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Penalties</label>
                <select
                  value={draft.penaltyTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, penaltyTakerId: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Free Kicks</label>
                <select
                  value={draft.freeKickTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, freeKickTakerId: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
                >
                  {startersForDropdown.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Corners</label>
                <select
                  value={draft.cornerTakerId ?? ''}
                  onChange={(e) => setDraft({ ...draft, cornerTakerId: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
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
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">
                Squad & Substitutes ({draft.substituteIds.length}/7)
              </h2>
              {selectedPlayerId && (
                <span className="text-xs text-emerald-400">
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
                      isSelected ? 'bg-emerald-500/15' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPlayerId(isSelected ? null : p.id)
                      }
                      className="flex items-center gap-3 text-left min-w-0 flex-1"
                    >
                      <span className="font-mono text-xs w-8 text-slate-400">
                        {POSITION_CODES[p.primaryPosition]}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white truncate">
                            {p.fullName}
                          </span>
                          <SuperstarStar isSuperstar={p.isSuperstar} />
                        </div>
                        <SkillSlotTags player={p} compact />
                      </div>
                      <span className="font-mono text-xs text-emerald-400 tabular-nums">
                        {p.overallRating}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {p.fitness}%
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {isStarter ? (
                        <span className="text-[11px] font-medium text-emerald-400 px-2">
                          XI
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleBench(p.id)}
                          className={`rounded border px-2.5 py-1 text-[11px] font-medium ${
                            isSub
                              ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                              : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
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
