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
import {
  CompetitionEmblem,
  GamePageHeader,
  MomentumComparisonBar,
} from '../components/shared/GamePrimitives';
import { formatMoney, playUiTone } from '../utils/format';

type MatchPhaseView = 'prep' | 'live' | 'report';

export const MatchCenter: React.FC = () => {
  const { career, settings, isBusy, commitMatchday, rolloverSeason, updateSettings } = useCareerStore();
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
      const md = career.currentMatchday;
      const ok = await commitMatchday();
      if (ok) {
        pushToast('success', `Matchday ${md} simulated.`);
      } else {
        pushToast('error', 'Could not save matchday progress. Please retry.');
      }
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

    const ok = await commitMatchday(nextFixture.id, result);
    if (!ok) {
      pushToast('error', 'Could not save match result. Please retry.');
      return;
    }
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
      const ok = await commitMatchday(fix.id, result);
      if (!ok) {
        pushToast('error', 'Could not save live match result. Please retry.');
        return;
      }
      setCompletedReport({ fixture: fix, result });
    }
    setIsPlaying(false);
    setView('report');
    playUiTone('whistle', settings.soundEffectsEnabled);
  };

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
      <div className="ft-panel rounded-lg p-8 text-center space-y-4 max-w-xl mx-auto mt-6">
        <Trophy className="h-12 w-12 text-emerald-400 mx-auto" />
        <h1 className="font-display text-4xl font-extrabold text-[#F4F5F0]">
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
            className="rounded border border-slate-700 bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white"
          >
            View Final Standings
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={async () => {
              const ok = await rolloverSeason();
              if (ok) {
                pushToast('success', 'New season initialized.');
              } else {
                pushToast('error', 'Season rollover could not be completed.');
              }
            }}
            className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
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
        <div className="ft-panel rounded-lg p-8 text-center space-y-4 max-w-xl mx-auto">
          <h1 className="font-display text-3xl font-extrabold text-[#F4F5F0]">
            Matchday {career.currentMatchday}
          </h1>
          <p className="text-sm text-slate-300">
            No scheduled fixture for {userClub.name} on this matchday. Advance to simulate other league fixtures.
          </p>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleQuickSim}
            className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
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
        <GamePageHeader
          eyebrow={`${comp?.name ?? 'Matchday'}${nextFixture.roundName ? ` · ${nextFixture.roundName}` : ''}`}
          title="Match Preparation"
          accentColor={userClub.crest.primaryColor}
          subtitle={
            <>
              Matchday {nextFixture.matchday} · {nextFixture.date}
              {currentUserFixtures.length > 1 && (
                <span className="block text-[11px] text-amber-300 mt-1">
                  Double-fixture matchday: remaining scheduled match simulates alongside this fixture.
                </span>
              )}
            </>
          }
          actions={
            <button
              type="button"
              onClick={() => navigate('tactics')}
              className="rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
            >
              Edit Lineup ({career.tactics.formation})
            </button>
          }
        />

        {/* Broadcast Matchup Card */}
        <section className="ft-broadcast-strip rounded-lg p-5 sm:p-7 space-y-6 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: homeClub.crest.primaryColor }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-1.5"
            style={{ backgroundColor: awayClub.crest.primaryColor }}
            aria-hidden="true"
          />

          <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
            <CompetitionEmblem competitionId={nextFixture.competitionId} size={20} />
            <span>{homeClub.stadiumName}</span>
          </div>

          <div className="grid grid-cols-3 items-center gap-3 sm:gap-6 text-center">
            <div className="flex flex-col items-center gap-2.5">
              <ClubCrest crest={homeClub.crest} size={68} />
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F5F0] leading-none">
                {homeClub.name}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Home · REP {homeClub.reputation}
              </div>
            </div>

            <div className="space-y-2">
              <div className="ft-chamfer-sm inline-block border border-slate-700/80 bg-[#070B14] px-4 py-1.5 font-display text-3xl sm:text-4xl font-extrabold text-emerald-400">
                VS
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {nextFixture.date}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <ClubCrest crest={awayClub.crest} size={68} />
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F5F0] leading-none">
                {awayClub.name}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Away · REP {awayClub.reputation}
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono uppercase tracking-wider">Speed:</span>
              {(['Normal', 'Fast', 'Instant'] as SimulationSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setSpeed(sp);
                    updateSettings({ simulationSpeed: sp });
                  }}
                  className={`px-3 py-1.5 rounded border font-semibold ${
                    speed === sp
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-[#070B14] text-slate-300'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleQuickSim}
                className="inline-flex items-center gap-2 rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <FastForward className="h-4 w-4 text-slate-300" />
                <span>Quick Simulate</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleStartLive}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[0_8px_22px_rgba(16,185,129,0.28)]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Live Match</span>
              </button>
            </div>
          </div>
        </section>

        {/* Starting XI Preview */}
        <section className="ft-panel rounded-lg p-5">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0] mb-3">
            Selected Starting XI ({career.tactics.formation} · {career.tactics.mentality})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs">
            {career.tactics.slots.map((slot) => {
              const p = slot.playerId ? career.players[slot.playerId] : undefined;
              return (
                <div
                  key={slot.slotIndex}
                  className="ft-panel-inset rounded px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="truncate text-slate-200 font-medium">
                    <span className="font-mono text-emerald-400 mr-1.5">{slot.label}</span>
                    {p?.fullName ?? 'Empty'}
                  </span>
                  <span className="font-mono text-[#F4F5F0] font-bold">
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
    const matchProgressPct = Math.min(100, Math.round((session.minute / 90) * 100));

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
        {/* Live Broadcast Scoreboard */}
        <section className="ft-broadcast-strip rounded-lg p-4 sm:p-6 space-y-4 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: session.home.club.crest.primaryColor }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-1.5"
            style={{ backgroundColor: session.away.club.crest.primaryColor }}
            aria-hidden="true"
          />

          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-mono text-slate-400">{session.home.club.stadiumName}</span>
            <span className="ft-chamfer-sm bg-emerald-500/15 border border-emerald-400/50 px-3 py-0.5 font-mono text-emerald-300 font-bold tabular-nums">
              {session.phase === 'HALF_TIME'
                ? 'HALF-TIME'
                : session.phase === 'FULL_TIME'
                  ? 'FULL-TIME'
                  : `${session.minute}'`}
            </span>
          </div>

          <div className="grid grid-cols-3 items-center gap-3 text-center py-1">
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <span className="font-display text-xl sm:text-3xl font-extrabold text-[#F4F5F0]">
                {session.home.club.name}
              </span>
              <ClubCrest crest={session.home.club.crest} size={46} />
            </div>

            <div className="ft-panel-inset rounded py-2 px-3 inline-block mx-auto font-mono text-4xl sm:text-5xl font-extrabold text-[#F4F5F0] tabular-nums tracking-tight">
              {session.homeScore} - {session.awayScore}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-start gap-3">
              <ClubCrest crest={session.away.club.crest} size={46} />
              <span className="font-display text-xl sm:text-3xl font-extrabold text-[#F4F5F0]">
                {session.away.club.name}
              </span>
            </div>
          </div>

          {/* Match Clock Progress Bar */}
          <div className="h-1 w-full bg-[#070B14] rounded-xs overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${matchProgressPct}%` }}
            />
          </div>

          {/* Live Playback Controls */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {session.phase === 'HALF_TIME' ? (
                <button
                  type="button"
                  onClick={() => {
                    stepLiveMatchMinute(session, userSide);
                    setIsPlaying(true);
                    setTickVersion((v) => v + 1);
                  }}
                  className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Start Second Half</span>
                </button>
              ) : session.phase === 'FULL_TIME' ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => finishLiveMatch(session)}
                  className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <span>Finish &amp; View Match Report</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="ft-chamfer-sm inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => finishLiveMatch(session)}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-slate-200"
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
                  className={`px-2.5 py-1 rounded border font-semibold ${
                    speed === sp
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-[#070B14] text-slate-400'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Commentary + Momentum Stats + Touchline Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Match Commentary Feed */}
          <div className="lg:col-span-7 ft-panel rounded-lg p-5 space-y-3">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
              Live Match Commentary
            </h2>
            <div className="h-80 overflow-y-auto divide-y divide-slate-800/70 pr-1 flex flex-col-reverse">
              <div className="divide-y divide-slate-800/70">
                {[...session.events].reverse().map((ev) => (
                  <div
                    key={ev.id}
                    className={`py-2.5 px-2 flex items-start gap-3 text-xs ${
                      ev.isGoal
                        ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400 text-emerald-200 font-semibold'
                        : 'text-slate-200'
                    }`}
                  >
                    <span className="font-mono text-emerald-400 font-bold w-11 shrink-0 tabular-nums">
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
            <div className="ft-panel rounded-lg p-5 space-y-3.5">
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Live Statistics</h2>
              <div className="space-y-3">
                <MomentumComparisonBar
                  label="Possession"
                  homeValue={`${session.homeStats.possession}%`}
                  awayValue={`${session.awayStats.possession}%`}
                  homeNum={session.homeStats.possession}
                  awayNum={session.awayStats.possession}
                  homeColor={session.home.club.crest.primaryColor}
                  awayColor="#64748B"
                />
                <MomentumComparisonBar
                  label="Shots"
                  homeValue={session.homeStats.shots}
                  awayValue={session.awayStats.shots}
                  homeNum={session.homeStats.shots}
                  awayNum={session.awayStats.shots}
                />
                <MomentumComparisonBar
                  label="On Target"
                  homeValue={session.homeStats.shotsOnTarget}
                  awayValue={session.awayStats.shotsOnTarget}
                  homeNum={session.homeStats.shotsOnTarget}
                  awayNum={session.awayStats.shotsOnTarget}
                />
                <MomentumComparisonBar
                  label="xG"
                  homeValue={session.homeStats.expectedGoals.toFixed(2)}
                  awayValue={session.awayStats.expectedGoals.toFixed(2)}
                  homeNum={Math.round(session.homeStats.expectedGoals * 100)}
                  awayNum={Math.round(session.awayStats.expectedGoals * 100)}
                />
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center text-xs font-mono tabular-nums">
                  <div className="ft-panel-inset rounded p-2">
                    <div className="text-[10px] text-slate-400">CORNERS</div>
                    <div className="font-bold text-[#F4F5F0] mt-0.5">
                      {session.homeStats.corners} - {session.awayStats.corners}
                    </div>
                  </div>
                  <div className="ft-panel-inset rounded p-2">
                    <div className="text-[10px] text-slate-400">FOULS</div>
                    <div className="font-bold text-[#F4F5F0] mt-0.5">
                      {session.homeStats.fouls} - {session.awayStats.fouls}
                    </div>
                  </div>
                  <div className="ft-panel-inset rounded p-2">
                    <div className="text-[10px] text-slate-400">CARDS</div>
                    <div className="font-bold text-amber-300 mt-0.5">
                      {session.homeStats.yellowCards} - {session.awayStats.yellowCards}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {session.phase !== 'FULL_TIME' && (
              <div className="ft-panel rounded-lg p-5 space-y-3">
                <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
                  Touchline Tactics &amp; Subs ({subsUsed}/3)
                </h2>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Mentality
                    </label>
                    <select
                      value={userTeam.tactics.mentality}
                      onChange={(e) => handleMentalityChange(e.target.value as Mentality)}
                      className="w-full rounded border border-slate-700 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
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
                      value={userTeam.tactics.pressing}
                      onChange={(e) => handlePressingChange(e.target.value as PressingIntensity)}
                      className="w-full rounded border border-slate-700 bg-[#070B14] px-2.5 py-2 text-[#F4F5F0]"
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
                        className="rounded border border-slate-700 bg-[#070B14] px-2 py-2 text-[#F4F5F0]"
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
                        className="rounded border border-slate-700 bg-[#070B14] px-2 py-2 text-[#F4F5F0]"
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
                      className="w-full rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 py-2 font-semibold text-[#F4F5F0]"
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
        <GamePageHeader
          eyebrow={`${career.competitions[fixture.competitionId]?.name ?? 'Matchday'} · Matchday ${fixture.matchday}`}
          title="Full-Time Match Report"
          accentColor={userClub.crest.primaryColor}
          subtitle={`Attendance ${result.attendance.toLocaleString()} · Gate ${formatMoney(result.gateReceipts, settings.currency)}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompetitionsTab('standings');
                  navigate('competitions');
                }}
                className="rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white"
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
                className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
              >
                Return to Dashboard
              </button>
            </div>
          }
        />

        {/* Score Header */}
        <section className="ft-broadcast-strip rounded-lg p-6 space-y-5 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: homeClub.crest.primaryColor }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-1.5"
            style={{ backgroundColor: awayClub.crest.primaryColor }}
            aria-hidden="true"
          />
          <div className="grid grid-cols-3 items-center text-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={homeClub.crest} size={60} />
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F5F0]">
                {homeClub.name}
              </span>
            </div>
            <div className="ft-panel-inset rounded py-2 px-4 inline-block mx-auto font-mono text-4xl sm:text-5xl font-extrabold text-[#F4F5F0] tabular-nums">
              {result.homeGoals} - {result.awayGoals}
            </div>
            <div className="flex flex-col items-center gap-2">
              <ClubCrest crest={awayClub.crest} size={60} />
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F5F0]">
                {awayClub.name}
              </span>
            </div>
          </div>

          {goals.length > 0 && (
            <div className="pt-4 border-t border-slate-800 flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-xs text-slate-200 font-mono">
              {goals.map((g) => (
                <span key={g.id}>
                  <span className="text-emerald-400 font-bold">{g.minute}&apos;</span>{' '}
                  {career.players[g.playerId ?? '']?.fullName} ({career.clubs[g.clubId]?.shortName})
                </span>
              ))}
            </div>
          )}

          {motm && (
            <div className="text-center text-xs text-amber-300 font-semibold flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>Player of the Match: {motm.fullName}</span>
            </div>
          )}
        </section>

        {/* Stats & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 ft-panel rounded-lg p-5 space-y-3.5">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
              Team Match Statistics
            </h2>
            <div className="space-y-3">
              <MomentumComparisonBar
                label="Possession"
                homeValue={`${result.homeStats.possession}%`}
                awayValue={`${result.awayStats.possession}%`}
                homeNum={result.homeStats.possession}
                awayNum={result.awayStats.possession}
              />
              <MomentumComparisonBar
                label="Shots"
                homeValue={result.homeStats.shots}
                awayValue={result.awayStats.shots}
                homeNum={result.homeStats.shots}
                awayNum={result.awayStats.shots}
              />
              <MomentumComparisonBar
                label="Shots on Target"
                homeValue={result.homeStats.shotsOnTarget}
                awayValue={result.awayStats.shotsOnTarget}
                homeNum={result.homeStats.shotsOnTarget}
                awayNum={result.awayStats.shotsOnTarget}
              />
              <MomentumComparisonBar
                label="Expected Goals (xG)"
                homeValue={result.homeStats.expectedGoals.toFixed(2)}
                awayValue={result.awayStats.expectedGoals.toFixed(2)}
                homeNum={Math.round(result.homeStats.expectedGoals * 100)}
                awayNum={Math.round(result.awayStats.expectedGoals * 100)}
              />
              <MomentumComparisonBar
                label="Passes Completed"
                homeValue={result.homeStats.passesCompleted}
                awayValue={result.awayStats.passesCompleted}
                homeNum={result.homeStats.passesCompleted}
                awayNum={result.awayStats.passesCompleted}
              />
              <MomentumComparisonBar
                label="Corners"
                homeValue={result.homeStats.corners}
                awayValue={result.awayStats.corners}
                homeNum={result.homeStats.corners}
                awayNum={result.awayStats.corners}
              />
            </div>
          </div>

          <div className="lg:col-span-7 ft-panel rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Key Match Events</h2>
              <button
                type="button"
                onClick={() => setView('prep')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Next Match Prep</span>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 text-xs">
              {result.events.map((ev) => (
                <div key={ev.id} className="py-2 flex gap-3">
                  <span className="font-mono text-emerald-400 font-bold w-10 shrink-0">
                    {ev.minute}&apos;
                  </span>
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
