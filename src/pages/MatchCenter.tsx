import React, { useEffect, useRef, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  RefreshCw,
  Shield,
  Trophy,
} from 'lucide-react';
import {
  applyLiveSubstitution,
  createLiveMatchSession,
  finalizeLiveMatchSession,
  LiveMatchSession,
  simulateMatchQuick,
  stepLiveMatchMinute,
  updateLiveMatchTactics,
} from '../engine/matchEngine';
import { buildDefaultTactics } from '../engine/tacticsEngine';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Fixture, MatchResult, Mentality, PressingIntensity, SimulationSpeed } from '../types';
import { ClubCrest } from '../components/shared/ClubCrest';
import { formatMoney, playUiTone } from '../utils/format';

type MatchPhaseView = 'prep' | 'live' | 'report';

export const MatchCenter: React.FC = () => {
  const { career, settings, commitMatchday, rolloverSeason, updateSettings } = useCareerStore();
  const { navigate, setCompetitionsTab, pushToast } = useUiStore();

  const [view, setView] = useState<MatchPhaseView>('prep');
  const [session, setSession] = useState<LiveMatchSession | null>(null);
  const [, setTickVersion] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimulationSpeed>(settings.simulationSpeed);
  const [completedReport, setCompletedReport] = useState<{
    fixture: Fixture;
    result: MatchResult;
  } | null>(null);

  const [subOutSlotIdx, setSubOutSlotIdx] = useState<number>(1);
  const [subInPlayerId, setSubInPlayerId] = useState<string>('');

  const sessionRef = useRef<LiveMatchSession | null>(null);
  sessionRef.current = session;

  if (!career) return null;

  const userClub = career.clubs[career.userClubId];
  const seasonFinished = career.currentMatchday > career.totalMatchdays;

  const currentUserFixtures = career.fixtures.filter(
    (f) =>
      f.seasonId === career.currentSeason &&
      f.matchday === career.currentMatchday &&
      f.status === 'scheduled' &&
      (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
  );

  const nextFixture = currentUserFixtures[0];

  const handleStartLive = () => {
    if (!nextFixture) return;
    const homeClub = career.clubs[nextFixture.homeClubId];
    const awayClub = career.clubs[nextFixture.awayClubId];
    const isUserHome = homeClub.id === userClub.id;

    const homeTac = isUserHome
      ? career.tactics
      : buildDefaultTactics(homeClub, career.players, '4-3-3');
    const awayTac = !isUserHome
      ? career.tactics
      : buildDefaultTactics(awayClub, career.players, '4-2-3-1');

    const newSession = createLiveMatchSession(
      nextFixture,
      homeClub,
      awayClub,
      homeTac,
      awayTac,
      career.players,
      career.seedCounter + career.currentMatchday * 97
    );
    // Step 1 immediately to kick-off
    stepLiveMatchMinute(newSession, isUserHome ? 'home' : 'away');
    playUiTone('whistle', settings.soundEffectsEnabled);

    setSession(newSession);
    setView('live');
    setIsPlaying(true);

    const userSideSubs = isUserHome
      ? newSession.home.tactics.substituteIds
      : newSession.away.tactics.substituteIds;
    setSubInPlayerId(userSideSubs[0] ?? '');
  };

  const handleQuickSim = async () => {
    if (!nextFixture) {
      await commitMatchday();
      pushToast('success', `Matchday ${career.currentMatchday} simulated.`);
      return;
    }

    const homeClub = career.clubs[nextFixture.homeClubId];
    const awayClub = career.clubs[nextFixture.awayClubId];
    const isUserHome = homeClub.id === userClub.id;

    const result = simulateMatchQuick(
      nextFixture,
      homeClub,
      awayClub,
      career.players,
      career.seedCounter + career.currentMatchday * 97,
      isUserHome ? career.tactics : undefined,
      !isUserHome ? career.tactics : undefined
    );

    await commitMatchday(nextFixture.id, result);
    setCompletedReport({ fixture: nextFixture, result });
    setView('report');
    playUiTone('whistle', settings.soundEffectsEnabled);
  };

  const finishLiveMatch = async (activeSession: LiveMatchSession) => {
    const userSide: 'home' | 'away' =
      activeSession.home.club.id === userClub.id ? 'home' : 'away';
    const result = finalizeLiveMatchSession(activeSession, userSide);
    const fix = career.fixtures.find((f) => f.id === activeSession.fixtureId);
    if (fix) {
      await commitMatchday(fix.id, result);
      setCompletedReport({ fixture: fix, result });
    }
    setIsPlaying(false);
    setView('report');
    playUiTone('whistle', settings.soundEffectsEnabled);
  };

  // Live simulation interval loop
  useEffect(() => {
    if (view !== 'live' || !isPlaying || !sessionRef.current) return;

    const cur = sessionRef.current;
    if (cur.phase === 'HALF_TIME' || cur.phase === 'FULL_TIME') {
      setIsPlaying(false);
      return;
    }

    if (speed === 'Instant') {
      const activePhases = new Set(['PRE_MATCH', 'FIRST_HALF', 'SECOND_HALF']);
      while (activePhases.has(cur.phase)) {
        stepLiveMatchMinute(cur, cur.home.club.id === userClub.id ? 'home' : 'away');
      }
      setTickVersion((v) => v + 1);
      setIsPlaying(false);
      return;
    }

    const intervalMs = speed === 'Fast' ? 45 : 170;
    const timer = window.setInterval(() => {
      const s = sessionRef.current;
      if (!s) return;
      const prevGoals = s.homeScore + s.awayScore;
      stepLiveMatchMinute(s, s.home.club.id === userClub.id ? 'home' : 'away');
      if (s.homeScore + s.awayScore > prevGoals) {
        playUiTone('goal', settings.soundEffectsEnabled);
      }
      setTickVersion((v) => v + 1);

      if (s.phase === 'HALF_TIME' || s.phase === 'FULL_TIME') {
        setIsPlaying(false);
        playUiTone('whistle', settings.soundEffectsEnabled);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [view, isPlaying, speed, userClub.id, settings.soundEffectsEnabled]);

  // Season Complete View
  if (seasonFinished && view !== 'report') {
    return (
      <div className="rounded-lg border border-slate-800 bg-[#121824] p-8 text-center space-y-4 max-w-xl mx-auto mt-6">
        <Trophy className="h-10 w-10 text-emerald-400 mx-auto" />
        <h1 className="font-display text-3xl font-bold text-white">
          {career.currentSeason} Season Complete
        </h1>
        <p className="text-sm text-slate-300">
          All {career.totalMatchdays} matchdays have been played. Review final standings or progress
          to the next career season.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setCompetitionsTab('standings');
              navigate('competitions');
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            View Final Standings
          </button>
          <button
            type="button"
            onClick={async () => {
              await rolloverSeason();
              pushToast('success', 'New season initialized.');
            }}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Start Next Season
          </button>
        </div>
      </div>
    );
  }

  // ==================== 1. MATCH PREPARATION ====================
  if (view === 'prep') {
    if (!nextFixture) {
      return (
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-8 text-center space-y-4 max-w-xl mx-auto">
          <h1 className="font-display text-3xl font-bold text-white">
            Matchday {career.currentMatchday}
          </h1>
          <p className="text-sm text-slate-300">
            No scheduled fixture for {userClub.name} on this matchday. Advance to simulate other league fixtures.
          </p>
          <button
            type="button"
            onClick={handleQuickSim}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Advance Matchday
          </button>
        </div>
      );
    }

    const homeClub = career.clubs[nextFixture.homeClubId];
    const awayClub = career.clubs[nextFixture.awayClubId];
    const comp = career.competitions[nextFixture.competitionId];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Match Preparation</h1>
            <p className="text-xs text-slate-400">
              {comp?.name} {nextFixture.roundName ? `· ${nextFixture.roundName}` : ''} · Matchday{' '}
              {nextFixture.matchday} · {nextFixture.date}
            </p>
            {currentUserFixtures.length > 1 && (
              <p className="text-[11px] text-amber-300 mt-1">
                Double-fixture matchday: remaining scheduled match simulates alongside this fixture.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('tactics')}
            className="rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 self-start"
          >
            Edit Lineup ({career.tactics.formation})
          </button>
        </div>

        {/* Matchup Card */}
        <section className="rounded-lg border border-slate-800 bg-[#121824] p-6 space-y-6">
          <div className="grid grid-cols-3 items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={homeClub.crest} size={64} />
              <div className="font-display text-2xl font-bold text-white">{homeClub.name}</div>
              <div className="text-xs text-slate-400">Home · REP {homeClub.reputation}</div>
            </div>

            <div className="space-y-1">
              <div className="font-display text-4xl font-bold text-slate-500">VS</div>
              <div className="text-xs text-slate-400">{homeClub.stadiumName}</div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={awayClub.crest} size={64} />
              <div className="font-display text-2xl font-bold text-white">{awayClub.name}</div>
              <div className="text-xs text-slate-400">Away · REP {awayClub.reputation}</div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Simulation Speed:</span>
              {(['Normal', 'Fast', 'Instant'] as SimulationSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setSpeed(sp);
                    updateSettings({ simulationSpeed: sp });
                  }}
                  className={`px-3 py-1.5 rounded border font-medium ${
                    speed === sp
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-[#0B0F17] text-slate-300'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleQuickSim}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <FastForward className="h-4 w-4 text-slate-300" />
                <span>Quick Simulate</span>
              </button>
              <button
                type="button"
                onClick={handleStartLive}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Live Match</span>
              </button>
            </div>
          </div>
        </section>

        {/* Starting XI Preview */}
        <section className="rounded-lg border border-slate-800 bg-[#121824] p-5">
          <h2 className="font-display text-xl font-bold text-white mb-3">
            Selected Starting XI ({career.tactics.formation} · {career.tactics.mentality})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
            {career.tactics.slots.map((slot) => {
              const p = slot.playerId ? career.players[slot.playerId] : undefined;
              return (
                <div
                  key={slot.slotIndex}
                  className="rounded border border-slate-800 bg-[#0B0F17] px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="truncate text-slate-200">
                    <span className="font-mono text-slate-400 mr-1.5">{slot.label}</span>
                    {p?.fullName ?? 'Empty'}
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {p?.overallRating ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // ==================== 2. LIVE MATCH SIMULATION ====================
  if (view === 'live' && session) {
    const userSide: 'home' | 'away' = session.home.club.id === userClub.id ? 'home' : 'away';
    const userTeam = userSide === 'home' ? session.home : session.away;
    const subsUsed = userSide === 'home' ? session.homeSubsUsed : session.awaySubsUsed;

    const handleMentalityChange = (mentality: Mentality) => {
      updateLiveMatchTactics(session, userSide, { ...userTeam.tactics, mentality });
      setTickVersion((v) => v + 1);
    };

    const handlePressingChange = (pressing: PressingIntensity) => {
      updateLiveMatchTactics(session, userSide, { ...userTeam.tactics, pressing });
      setTickVersion((v) => v + 1);
    };

    const handleMakeSub = () => {
      if (!subInPlayerId) return;
      const ok = applyLiveSubstitution(session, userSide, subOutSlotIdx, subInPlayerId);
      if (ok) {
        const remainingSubs = userTeam.tactics.substituteIds;
        setSubInPlayerId(remainingSubs[0] ?? '');
        setTickVersion((v) => v + 1);
        pushToast('info', 'Substitution made.');
      } else {
        pushToast('warning', 'Maximum 3 substitutions reached or invalid selection.');
      }
    };

    return (
      <div className="space-y-5">
        {/* Live Scoreboard */}
        <section className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{session.home.club.stadiumName}</span>
            <span className="font-mono text-emerald-400 font-semibold tabular-nums">
              {session.phase === 'HALF_TIME'
                ? 'HALF-TIME'
                : session.phase === 'FULL_TIME'
                  ? 'FULL-TIME'
                  : `${session.minute}'`}
            </span>
          </div>

          <div className="grid grid-cols-3 items-center gap-3 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <span className="font-display text-xl sm:text-2xl font-bold text-white">
                {session.home.club.name}
              </span>
              <ClubCrest crest={session.home.club.crest} size={42} />
            </div>

            <div className="font-mono text-4xl sm:text-5xl font-bold text-white tabular-nums">
              {session.homeScore} - {session.awayScore}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-start gap-3">
              <ClubCrest crest={session.away.club.crest} size={42} />
              <span className="font-display text-xl sm:text-2xl font-bold text-white">
                {session.away.club.name}
              </span>
            </div>
          </div>

          {/* Live Playback Controls */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {session.phase === 'HALF_TIME' ? (
                <button
                  type="button"
                  onClick={() => {
                    stepLiveMatchMinute(session, userSide);
                    setIsPlaying(true);
                    setTickVersion((v) => v + 1);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Start Second Half</span>
                </button>
              ) : session.phase === 'FULL_TIME' ? (
                <button
                  type="button"
                  onClick={() => finishLiveMatch(session)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold text-white"
                >
                  <span>Finish & View Match Report</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => finishLiveMatch(session)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200"
                  >
                    <FastForward className="h-3.5 w-3.5" />
                    <span>Sim to Full-Time</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {(['Normal', 'Fast', 'Instant'] as SimulationSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeed(sp)}
                  className={`px-2.5 py-1 rounded border ${
                    speed === sp
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-[#0B0F17] text-slate-400'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stats + Commentary + Touchline Adjustments */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Match Commentary Feed */}
          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Live Match Commentary</h2>
            <div className="h-80 overflow-y-auto divide-y divide-slate-800/70 pr-1 flex flex-col-reverse">
              <div className="divide-y divide-slate-800/70">
                {[...session.events].reverse().map((ev) => (
                  <div
                    key={ev.id}
                    className={`py-2.5 flex items-start gap-3 text-xs ${
                      ev.isGoal ? 'text-emerald-300 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    <span className="font-mono text-slate-400 w-10 shrink-0 tabular-nums">
                      {ev.minute}&apos;{ev.addedTime ? `+${ev.addedTime}` : ''}
                    </span>
                    <span className="leading-relaxed">{ev.commentary}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Stats & Touchline Tactics */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
              <h2 className="font-display text-xl font-bold text-white">Live Statistics</h2>
              <div className="space-y-2.5 text-xs tabular-nums">
                {[
                  ['Possession', `${session.homeStats.possession}%`, `${session.awayStats.possession}%`],
                  ['Shots', session.homeStats.shots, session.awayStats.shots],
                  ['On Target', session.homeStats.shotsOnTarget, session.awayStats.shotsOnTarget],
                  ['xG', session.homeStats.expectedGoals.toFixed(2), session.awayStats.expectedGoals.toFixed(2)],
                  ['Corners', session.homeStats.corners, session.awayStats.corners],
                  ['Fouls', session.homeStats.fouls, session.awayStats.fouls],
                  ['Yellow Cards', session.homeStats.yellowCards, session.awayStats.yellowCards],
                ].map(([label, hVal, aVal]) => (
                  <div key={String(label)} className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="font-mono font-semibold text-white w-14">{hVal}</span>
                    <span className="text-slate-400">{label}</span>
                    <span className="font-mono font-semibold text-white w-14 text-right">{aVal}</span>
                  </div>
                ))}
              </div>
            </div>

            {session.phase !== 'FULL_TIME' && (
              <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  Touchline Tactics & Subs ({subsUsed}/3)
                </h2>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Mentality</label>
                    <select
                      value={userTeam.tactics.mentality}
                      onChange={(e) => handleMentalityChange(e.target.value as Mentality)}
                      className="w-full rounded border border-slate-700 bg-[#0B0F17] px-2.5 py-1.5 text-white"
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
                      value={userTeam.tactics.pressing}
                      onChange={(e) => handlePressingChange(e.target.value as PressingIntensity)}
                      className="w-full rounded border border-slate-700 bg-[#0B0F17] px-2.5 py-1.5 text-white"
                    >
                      {(['Low', 'Medium', 'High', 'Aggressive'] as PressingIntensity[]).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {subsUsed < 3 && userTeam.tactics.substituteIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={subOutSlotIdx}
                        onChange={(e) => setSubOutSlotIdx(Number(e.target.value))}
                        aria-label="Player off"
                        className="rounded border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
                      >
                        {userTeam.tactics.slots.map((s) => {
                          const p = s.playerId ? career.players[s.playerId] : null;
                          return (
                            <option key={s.slotIndex} value={s.slotIndex}>
                              Off: {p?.fullName ?? s.label} ({Math.round(session.stamina[s.playerId ?? ''] ?? 80)}%)
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={subInPlayerId}
                        onChange={(e) => setSubInPlayerId(e.target.value)}
                        aria-label="Player on"
                        className="rounded border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-white"
                      >
                        {userTeam.tactics.substituteIds.map((pid) => (
                          <option key={pid} value={pid}>
                            On: {career.players[pid]?.fullName} ({career.players[pid]?.overallRating})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleMakeSub}
                      className="w-full rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 py-1.5 font-semibold text-white"
                    >
                      Confirm Substitution
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== 3. MATCH REPORT ====================
  if (view === 'report' && completedReport) {
    const { fixture, result } = completedReport;
    const homeClub = career.clubs[fixture.homeClubId];
    const awayClub = career.clubs[fixture.awayClubId];
    const motm = career.players[result.motmPlayerId];
    const goals = result.events.filter((e) => e.type === 'GOAL');

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Full-Time Match Report</h1>
            <p className="text-xs text-slate-400">
              {career.competitions[fixture.competitionId]?.name} · Matchday {fixture.matchday} ·
              Attendance {result.attendance.toLocaleString()} · Gate{' '}
              {formatMoney(result.gateReceipts, settings.currency)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCompetitionsTab('standings');
                navigate('competitions');
              }}
              className="rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white"
            >
              View Standings
            </button>
            <button
              type="button"
              onClick={() => {
                setView('prep');
                setSession(null);
                navigate('dashboard');
              }}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Return to Dashboard
            </button>
          </div>
        </div>

        {/* Score Header */}
        <section className="rounded-lg border border-slate-800 bg-[#121824] p-6 space-y-5">
          <div className="grid grid-cols-3 items-center text-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={homeClub.crest} size={56} />
              <span className="font-display text-2xl font-bold text-white">{homeClub.name}</span>
            </div>
            <div className="font-mono text-5xl font-bold text-white tabular-nums">
              {result.homeGoals} - {result.awayGoals}
            </div>
            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={awayClub.crest} size={56} />
              <span className="font-display text-2xl font-bold text-white">{awayClub.name}</span>
            </div>
          </div>

          {goals.length > 0 && (
            <div className="pt-4 border-t border-slate-800 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-300">
              {goals.map((g) => (
                <span key={g.id}>
                  {g.minute}&apos; {career.players[g.playerId ?? '']?.fullName} (
                  {career.clubs[g.clubId]?.shortName})
                </span>
              ))}
            </div>
          )}

          {motm && (
            <div className="text-center text-xs text-emerald-400 flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>Player of the Match: {motm.fullName}</span>
            </div>
          )}
        </section>

        {/* Stats & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Team Match Statistics</h2>
            <div className="space-y-2.5 text-xs tabular-nums">
              {[
                ['Possession', `${result.homeStats.possession}%`, `${result.awayStats.possession}%`],
                ['Shots', result.homeStats.shots, result.awayStats.shots],
                ['Shots on Target', result.homeStats.shotsOnTarget, result.awayStats.shotsOnTarget],
                ['Expected Goals (xG)', result.homeStats.expectedGoals.toFixed(2), result.awayStats.expectedGoals.toFixed(2)],
                ['Passes Completed', result.homeStats.passesCompleted, result.awayStats.passesCompleted],
                ['Corners', result.homeStats.corners, result.awayStats.corners],
                ['Fouls', result.homeStats.fouls, result.awayStats.fouls],
                ['Yellow Cards', result.homeStats.yellowCards, result.awayStats.yellowCards],
              ].map(([label, h, a]) => (
                <div key={String(label)} className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="font-mono font-semibold text-white w-16">{h}</span>
                  <span className="text-slate-400">{label}</span>
                  <span className="font-mono font-semibold text-white w-16 text-right">{a}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Key Match Events</h2>
              <button
                type="button"
                onClick={() => setView('prep')}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Next Match Prep</span>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 text-xs">
              {result.events.map((ev) => (
                <div key={ev.id} className="py-2 flex gap-3">
                  <span className="font-mono text-slate-400 w-10 shrink-0">{ev.minute}&apos;</span>
                  <span className={ev.isGoal ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
                    {ev.commentary}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
