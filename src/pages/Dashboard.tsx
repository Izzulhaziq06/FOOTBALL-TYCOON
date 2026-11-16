import React from 'react';
import { Calendar, FastForward, Play, TrendingUp } from 'lucide-react';
import { calculateLeagueStandings } from '../engine/competitionEngine';
import { getNextUserFixture } from '../engine/careerEngine';
import { calculateClubWeeklyWageBill } from '../engine/financeEngine';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { ClubCrest } from '../components/shared/ClubCrest';
import { formatMoney, formatOrdinal } from '../utils/format';

export const Dashboard: React.FC = () => {
  const { career, settings, commitMatchday, rolloverSeason } = useCareerStore();
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
    await commitMatchday();
    pushToast('success', `Matchday ${career.currentMatchday} simulated.`);
  };

  const handleNextSeason = async () => {
    await rolloverSeason();
    pushToast('success', `Advanced to new career season.`);
  };

  return (
    <div className="space-y-6">
      {/* Club Identity Header Strip */}
      <section className="rounded-lg border border-slate-800 bg-[#121824] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ClubCrest crest={userClub.crest} size={56} />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{userLeague.name}</span>
              <span aria-hidden="true">·</span>
              <span>{career.currentSeason}</span>
              {career.isGeneratedSeason && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">Generated Career Season</span>
                </>
              )}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
              {userClub.name}
            </h1>
            <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {userClub.stadiumName} ({userClub.stadiumCapacity.toLocaleString()} seats) · Manager{' '}
              {career.manager.name} ({career.manager.philosophy})
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {seasonFinished ? (
            <button
              type="button"
              onClick={handleNextSeason}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Start Next Season</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('match_center')}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Play Matchday {career.currentMatchday}</span>
              </button>
              <button
                type="button"
                onClick={handleQuickAdvance}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200"
              >
                <FastForward className="h-4 w-4 text-slate-400" />
                <span>Quick Sim MD</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* Primary KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">League Standing</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-3xl font-bold text-white tabular-nums">
              {formatOrdinal(leaguePosition)}
            </span>
            <span className="font-mono text-sm text-emerald-400 tabular-nums">
              {leagueRow?.points ?? 0} pts
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            P {leagueRow?.played ?? 0} · W {leagueRow?.won ?? 0} D {leagueRow?.drawn ?? 0} L{' '}
            {leagueRow?.lost ?? 0} · GF/GA {leagueRow?.goalsFor ?? 0}/{leagueRow?.goalsAgainst ?? 0}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Club Balance</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
            {formatMoney(userClub.balance, settings.currency)}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            Transfer Budget {formatMoney(userClub.transferBudget, settings.currency)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Weekly Wage Bill</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
            {formatMoney(weeklyWages, settings.currency)}
            <span className="text-xs text-slate-400 font-sans">/wk</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            Wage Cap {formatMoney(userClub.wageBudget, settings.currency)}/wk
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="text-xs text-slate-400">Squad Readiness</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-white tabular-nums">
              {avgFitness}%
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {squadPlayers.length} Players
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {injuredCount === 0
              ? 'Full squad fit for selection'
              : `${injuredCount} player(s) currently injured`}
          </div>
        </div>
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Next Fixture + Recent Results + Mini Table */}
        <div className="lg:col-span-7 space-y-6">
          {/* Next Fixture */}
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Next Fixture</h2>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {nextFixture ? `${nextFixture.date} · MD ${nextFixture.matchday}` : 'Season Complete'}
              </span>
            </div>

            {nextFixture && nextOpponent ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-4">
                  <ClubCrest crest={nextOpponent.crest} size={46} />
                  <div>
                    <div className="text-xs text-emerald-400 font-medium">
                      {career.competitions[nextFixture.competitionId]?.name}{' '}
                      {nextFixture.roundName ? `· ${nextFixture.roundName}` : ''}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {nextFixture.homeClubId === userClub.id ? 'vs ' : '@ '}
                      {nextOpponent.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {nextFixture.homeClubId === userClub.id ? 'Home' : 'Away'} ·{' '}
                      {career.clubs[nextFixture.homeClubId]?.stadiumName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('tactics')}
                    className="rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200"
                  >
                    Adjust Tactics
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('match_center')}
                    className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
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
          </div>

          {/* Recent Results */}
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Recent Results</h2>
              <button
                type="button"
                onClick={() => navigate('competitions')}
                className="text-xs text-emerald-400 hover:underline"
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
                  const outcomeColor =
                    outcome === 'W'
                      ? 'text-emerald-400'
                      : outcome === 'L'
                        ? 'text-red-400'
                        : 'text-amber-300';
                  return (
                    <div
                      key={fix.id}
                      className="py-2.5 flex items-center justify-between text-sm gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-mono font-bold w-4 ${outcomeColor}`}>
                          {outcome}
                        </span>
                        <span className="text-xs font-mono text-slate-500 w-10 shrink-0">
                          MD {fix.matchday}
                        </span>
                        <span className="truncate text-slate-200">
                          {career.clubs[fix.homeClubId]?.name} vs{' '}
                          {career.clubs[fix.awayClubId]?.name}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                        {res.homeGoals} - {res.awayGoals}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Manager Objectives & Club News */}
        <div className="lg:col-span-5 space-y-6">
          {/* Board Objectives */}
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Manager Objectives</h2>
            <div className="divide-y divide-slate-800/70">
              {career.objectives.map((obj) => (
                <div key={obj.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{obj.title}</div>
                    <div className="text-xs text-slate-400">{obj.targetDescription}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-medium ${
                        obj.status === 'on_track' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {obj.status === 'on_track' ? 'On Track' : 'Monitor'}
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums">{obj.progressText}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Club News */}
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Club News</h2>
            <div className="divide-y divide-slate-800/70 max-h-[340px] overflow-y-auto pr-1">
              {career.news.slice(0, 8).map((item) => (
                <article key={item.id} className="py-3 first:pt-1">
                  <div className="text-[11px] text-slate-400 font-mono">
                    {item.category} · MD {item.matchday} · {item.date}
                  </div>
                  <h3 className="text-sm font-semibold text-white mt-0.5">{item.headline}</h3>
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
