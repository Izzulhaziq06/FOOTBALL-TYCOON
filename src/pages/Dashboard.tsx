import React from 'react';
import { Calendar, Crosshair, FastForward, Play, TrendingUp, Users } from 'lucide-react';
import { calculateLeagueStandings } from '../engine/competitionEngine';
import { getNextUserFixture } from '../engine/careerEngine';
import { calculateClubWeeklyWageBill } from '../engine/financeEngine';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { ClubCrest } from '../components/shared/ClubCrest';
import { CompetitionEmblem } from '../components/shared/GamePrimitives';
import { formatMoney, formatOrdinal } from '../utils/format';

export const Dashboard: React.FC = () => {
  const { career, settings, isBusy, commitMatchday, rolloverSeason } = useCareerStore();
  const { navigate, pushToast } = useUiStore();

  if (!career) return null;

  const userClub = career.clubs[career.userClubId];
  const userLeague = career.competitions[career.userLeagueId];
  const standings = calculateLeagueStandings(userLeague, career.fixtures, career.clubs);
  const leaguePosIdx = standings.findIndex((r) => r.clubId === userClub.id);
  const leagueRow = standings[leaguePosIdx];
  const leaguePosition = leaguePosIdx >= 0 ? leaguePosIdx + 1 : 1;

  const squadPlayers = userClub.squadIds
    .map((id) => career.players[id])
    .filter(Boolean);
  const avgFitness = Math.round(
    squadPlayers.reduce((s, p) => s + p.fitness, 0) / Math.max(1, squadPlayers.length)
  );
  const injuredCount = squadPlayers.filter((p) => p.injuryWeeks > 0).length;
  const weeklyWages = calculateClubWeeklyWageBill(userClub, career.players);

  const nextFixture = getNextUserFixture(career);
  const nextOpponent = nextFixture
    ? career.clubs[
        nextFixture.homeClubId === userClub.id
          ? nextFixture.awayClubId
          : nextFixture.homeClubId
      ]
    : undefined;

  const recentResults = career.fixtures
    .filter(
      (f) =>
        f.seasonId === career.currentSeason &&
        f.status === 'completed' &&
        f.result !== null &&
        (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
    )
    .sort((a, b) => b.matchday - a.matchday)
    .slice(0, 5);

  const seasonFinished = career.currentMatchday > career.totalMatchdays;

  const handleQuickAdvance = async () => {
    const md = career.currentMatchday;
    const ok = await commitMatchday();
    if (ok) {
      pushToast('success', `Matchday ${md} simulated.`);
    } else {
      pushToast('error', 'Could not save matchday progress. Please retry.');
    }
  };

  const handleNextSeason = async () => {
    const ok = await rolloverSeason();
    if (ok) {
      pushToast('success', `Advanced to new career season.`);
    } else {
      pushToast('error', 'Season rollover could not be completed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Club Command & Matchday Broadcast Panel */}
      <section className="ft-broadcast-strip rounded-lg p-5 sm:p-6 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: userClub.crest.primaryColor }}
          aria-hidden="true"
        />
        <div className="pl-2 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <ClubCrest crest={userClub.crest} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400">
                <CompetitionEmblem competitionId={userLeague.id} size={18} />
                <span>{userLeague.name}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{career.currentSeason}</span>
                {career.isGeneratedSeason && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-amber-300">Generated Career Season</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F4F5F0] leading-none mt-1">
                {userClub.name}
              </h1>
              <div className="text-xs text-slate-400 mt-1.5 tabular-nums">
                {userClub.stadiumName} ({userClub.stadiumCapacity.toLocaleString()} seats) · Manager{' '}
                <span className="text-slate-200 font-medium">{career.manager.name}</span> ({career.manager.philosophy})
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {seasonFinished ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleNextSeason}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-[0_6px_20px_rgba(16,185,129,0.28)]"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Start Next Season</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => navigate('match_center')}
                  className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-[0_6px_20px_rgba(16,185,129,0.28)]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Play Matchday {career.currentMatchday}</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleQuickAdvance}
                  className="inline-flex items-center gap-2 rounded border border-slate-700/90 bg-[#0B1220] hover:bg-slate-800 disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200"
                >
                  <FastForward className="h-4 w-4 text-slate-400" />
                  <span>Quick Sim MD</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Primary Executive KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-emerald-500/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            League Standing
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-display text-3xl sm:text-4xl font-extrabold text-[#F4F5F0] tabular-nums leading-none">
              {formatOrdinal(leaguePosition)}
            </span>
            <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
              {leagueRow?.points ?? 0} pts
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400 font-mono tabular-nums">
            P {leagueRow?.played ?? 0} · W {leagueRow?.won ?? 0} D {leagueRow?.drawn ?? 0} L{' '}
            {leagueRow?.lost ?? 0} · GD {(leagueRow?.goalDifference ?? 0) >= 0 ? `+${leagueRow?.goalDifference ?? 0}` : leagueRow?.goalDifference}
          </div>
        </div>

        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-slate-600/80">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Club Balance
          </div>
          <div className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-[#F4F5F0] tabular-nums">
            {formatMoney(userClub.balance, settings.currency)}
          </div>
          <div className="mt-2.5 text-[11px] text-emerald-300 font-mono tabular-nums">
            Transfer Budget {formatMoney(userClub.transferBudget, settings.currency)}
          </div>
        </div>

        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-amber-500/70">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Weekly Wage Bill
          </div>
          <div className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-[#F4F5F0] tabular-nums">
            {formatMoney(weeklyWages, settings.currency)}
            <span className="text-xs text-slate-400 font-sans">/wk</span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400 font-mono tabular-nums">
            Cap {formatMoney(userClub.wageBudget, settings.currency)}/wk
          </div>
        </div>

        <div className="ft-panel rounded-lg p-4 border-t-2 border-t-sky-500/70">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Squad Readiness
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-mono text-xl sm:text-2xl font-bold text-[#F4F5F0] tabular-nums">
              {avgFitness}%
            </span>
            <span className="text-xs text-slate-300 font-mono tabular-nums">
              {squadPlayers.length} Players
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-400">
            {injuredCount === 0
              ? 'Full squad fit for matchday'
              : `${injuredCount} player(s) injured`}
          </div>
        </div>
      </section>

      {/* Main Two-Column Dugout & News Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Matchday Spotlight + Recent Form + Tactical Snapshot */}
        <div className="lg:col-span-7 space-y-6">
          {/* Next Fixture Broadcast Card */}
          <div className="ft-panel rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-emerald-400" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-[#F4F5F0] tracking-tight">
                  Next Fixture
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                {nextFixture ? `${nextFixture.date} · MD ${nextFixture.matchday}` : 'Season Complete'}
              </span>
            </div>

            {nextFixture && nextOpponent ? (
              <div className="ft-panel-inset rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center -space-x-2 shrink-0">
                    <ClubCrest crest={userClub.crest} size={42} />
                    <ClubCrest crest={nextOpponent.crest} size={42} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                      {career.competitions[nextFixture.competitionId]?.name}{' '}
                      {nextFixture.roundName ? `· ${nextFixture.roundName}` : ''}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-[#F4F5F0] truncate">
                      {nextFixture.homeClubId === userClub.id ? 'vs ' : '@ '}
                      {nextOpponent.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {nextFixture.homeClubId === userClub.id ? 'Home Fixture' : 'Away Fixture'} ·{' '}
                      {career.clubs[nextFixture.homeClubId]?.stadiumName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('tactics')}
                    className="rounded border border-slate-700 bg-[#101829] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
                  >
                    Adjust Tactics
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('match_center')}
                    className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    Match Prep
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 py-2">
                All fixtures for {career.currentSeason} have been completed. Advance to the next season to continue.
              </div>
            )}

            {/* Quick Tactical Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <button
                type="button"
                onClick={() => navigate('tactics')}
                className="flex items-center justify-between rounded border border-slate-800 bg-[#0B1220] hover:border-emerald-500/40 px-3 py-2 text-left"
              >
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
                  Formation
                </span>
                <span className="font-mono font-bold text-[#F4F5F0]">{career.tactics.formation}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('tactics')}
                className="flex items-center justify-between rounded border border-slate-800 bg-[#0B1220] hover:border-emerald-500/40 px-3 py-2 text-left"
              >
                <span className="text-slate-400">Mentality</span>
                <span className="font-mono font-semibold text-emerald-300 truncate ml-2">
                  {career.tactics.mentality}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('squad')}
                className="col-span-2 sm:col-span-1 flex items-center justify-between rounded border border-slate-800 bg-[#0B1220] hover:border-emerald-500/40 px-3 py-2 text-left"
              >
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                  Roster
                </span>
                <span className="font-mono font-bold text-[#F4F5F0]">{squadPlayers.length} Players</span>
              </button>
            </div>
          </div>

          {/* Recent Results */}
          <div className="ft-panel rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Recent Results</h2>
              <button
                type="button"
                onClick={() => navigate('competitions')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Full Standings
              </button>
            </div>
            {recentResults.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">
                No matches played yet this season. Play Matchday 1 to record your opening result.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {recentResults.map((fix) => {
                  const res = fix.result!;
                  const isHome = fix.homeClubId === userClub.id;
                  const userG = isHome ? res.homeGoals : res.awayGoals;
                  const oppG = isHome ? res.awayGoals : res.homeGoals;
                  const outcome = userG > oppG ? 'W' : userG < oppG ? 'L' : 'D';
                  const badgeStyle =
                    outcome === 'W'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : outcome === 'L'
                        ? 'bg-red-500/15 text-red-300 border-red-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
                  return (
                    <div
                      key={fix.id}
                      className="py-2.5 flex items-center justify-between text-sm gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`font-mono text-xs font-bold w-6 h-6 rounded-xs border flex items-center justify-center shrink-0 ${badgeStyle}`}
                        >
                          {outcome}
                        </span>
                        <span className="text-xs font-mono text-slate-500 w-10 shrink-0">
                          MD {fix.matchday}
                        </span>
                        <span className="truncate text-slate-200 font-medium">
                          {career.clubs[fix.homeClubId]?.name} vs{' '}
                          {career.clubs[fix.awayClubId]?.name}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#F4F5F0] tabular-nums shrink-0 bg-[#070B14] border border-slate-800 px-2.5 py-0.5 rounded-xs">
                        {res.homeGoals} - {res.awayGoals}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Board Objectives & Pressroom News */}
        <div className="lg:col-span-5 space-y-6">
          {/* Board Objectives */}
          <div className="ft-panel rounded-lg p-5 space-y-3">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Manager Objectives</h2>
            <div className="divide-y divide-slate-800/70">
              {career.objectives.map((obj) => (
                <div key={obj.id} className="py-3 first:pt-1 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#F4F5F0]">{obj.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{obj.targetDescription}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-[11px] font-mono uppercase font-bold ${
                        obj.status === 'on_track' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {obj.status === 'on_track' ? 'On Track' : 'Monitor'}
                    </div>
                    <div className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                      {obj.progressText}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Club News */}
          <div className="ft-panel rounded-lg p-5 space-y-3">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Club News</h2>
            <div className="divide-y divide-slate-800/70 max-h-[340px] overflow-y-auto pr-1">
              {Array.from(new Map(career.news.map((n) => [n.id, n])).values())
                .slice(0, 8)
                .map((item) => (
                <article key={item.id} className="py-3 first:pt-1">
                  <div className="text-[11px] text-emerald-400/90 font-mono uppercase tracking-wider">
                    {item.category} · MD {item.matchday} · {item.date}
                  </div>
                  <h3 className="text-sm font-semibold text-[#F4F5F0] mt-1">{item.headline}</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
