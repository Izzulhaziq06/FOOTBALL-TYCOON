import React, { useMemo, useState } from 'react';
import {
  calculateLeagueStandings,
  getCompetitionStatLeaders,
} from '../engine/competitionEngine';
import { useCareerStore } from '../store/careerStore';
import { CompetitionsSubTab, useUiStore } from '../store/uiStore';
import { ClubCrest } from '../components/shared/ClubCrest';

export const Competitions: React.FC = () => {
  const { career } = useCareerStore();
  const { competitionsTab, setCompetitionsTab, openPlayerProfile } = useUiStore();

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    career?.userLeagueId ?? 'epl'
  );
  const [selectedCupId, setSelectedCupId] = useState<'ucl' | 'uel'>('ucl');
  const [selectedFixtureMd, setSelectedFixtureMd] = useState<number>(
    career?.currentMatchday ?? 1
  );

  React.useEffect(() => {
    if (career) {
      setSelectedLeagueId(career.userLeagueId);
      setSelectedFixtureMd(Math.min(career.currentMatchday, career.totalMatchdays));
    }
  }, [career?.id, career?.currentMatchday]);

  if (!career) return null;

  const leagues = Object.values(career.competitions).filter(
    (c) => c.competitionFormat === 'league'
  );
  const activeLeague = career.competitions[selectedLeagueId] ?? leagues[0];

  const standings = useMemo(
    () => calculateLeagueStandings(activeLeague, career.fixtures, career.clubs),
    [activeLeague, career.fixtures, career.clubs]
  );

  const statLeaders = useMemo(
    () => getCompetitionStatLeaders(activeLeague, career.players, career.clubs),
    [activeLeague, career.players, career.clubs]
  );

  const topScorers = useMemo(
    () => [...statLeaders].sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating).slice(0, 12),
    [statLeaders]
  );

  const topAssists = useMemo(
    () => [...statLeaders].sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 12),
    [statLeaders]
  );

  const topCleanSheets = useMemo(
    () =>
      [...statLeaders]
        .filter((r) => r.position === 'Goalkeeper' || r.position === 'Centre Back')
        .sort((a, b) => b.cleanSheets - a.cleanSheets)
        .slice(0, 10),
    [statLeaders]
  );

  const leagueFixturesForMd = career.fixtures.filter(
    (f) =>
      f.seasonId === career.currentSeason &&
      f.competitionId === activeLeague.id &&
      f.matchday === selectedFixtureMd
  );

  const cupComp = career.competitions[selectedCupId];
  const cupFixtures = career.fixtures
    .filter((f) => f.seasonId === career.currentSeason && f.competitionId === selectedCupId)
    .sort((a, b) => a.matchday - b.matchday);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Competitions & Calendar</h1>
          <p className="text-xs text-slate-400">
            {career.currentSeason} · Matchday {Math.min(career.currentMatchday, career.totalMatchdays)}/{career.totalMatchdays}
            {career.isGeneratedSeason ? ' · Generated Career Season' : ''}
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-1 p-1 rounded-md border border-slate-800 bg-[#121824]">
          {(
            [
              ['standings', 'Standings'],
              ['fixtures', 'Fixtures'],
              ['continental', 'UCL & UEL'],
              ['stats', 'Stats Centre'],
            ] as Array<[CompetitionsSubTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCompetitionsTab(id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold ${
                competitionsTab === id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* League Selector Bar (for Standings, Fixtures, Stats) */}
      {competitionsTab !== 'continental' && (
        <div className="flex flex-wrap gap-2">
          {leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedLeagueId(l.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium ${
                activeLeague.id === l.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-[#121824] text-slate-300 hover:text-white'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>
      )}

      {/* STANDINGS */}
      {competitionsTab === 'standings' && (
        <div className="rounded-lg border border-slate-800 bg-[#121824] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">{activeLeague.name}</h2>
            <span className="text-xs text-slate-400">Tie-breakers: Pts · GD · GF</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-[#0E1420] text-xs text-slate-400">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-10">#</th>
                  <th className="py-3 px-3">Club</th>
                  <th className="py-3 px-2.5 text-right">P</th>
                  <th className="py-3 px-2.5 text-right">W</th>
                  <th className="py-3 px-2.5 text-right">D</th>
                  <th className="py-3 px-2.5 text-right">L</th>
                  <th className="py-3 px-2.5 text-right">GF</th>
                  <th className="py-3 px-2.5 text-right">GA</th>
                  <th className="py-3 px-2.5 text-right">GD</th>
                  <th className="py-3 px-3 text-right">Pts</th>
                  <th className="py-3 pl-3 pr-4 text-right">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 tabular-nums">
                {standings.map((row, idx) => {
                  const club = career.clubs[row.clubId];
                  const isUser = row.clubId === career.userClubId;
                  return (
                    <tr
                      key={row.clubId}
                      className={isUser ? 'bg-emerald-500/10' : 'hover:bg-slate-800/35'}
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          {club && <ClubCrest crest={club.crest} size={24} />}
                          <span className={`font-medium ${isUser ? 'text-emerald-300 font-semibold' : 'text-white'}`}>
                            {row.clubName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.played}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.won}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.drawn}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.lost}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.goalsFor}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{row.goalsAgainst}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">
                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {row.points}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs">
                        {row.form.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          row.form.map((f, i) => (
                            <span
                              key={i}
                              className={`ml-1 ${
                                f === 'W'
                                  ? 'text-emerald-400'
                                  : f === 'L'
                                    ? 'text-red-400'
                                    : 'text-amber-300'
                              }`}
                            >
                              {f}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FIXTURES CALENDAR */}
      {competitionsTab === 'fixtures' && (
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-white">
              {activeLeague.name} Fixtures
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={selectedFixtureMd <= 1}
                onClick={() => setSelectedFixtureMd((m) => Math.max(1, m - 1))}
                className="rounded border border-slate-700 bg-slate-900 disabled:opacity-40 px-3 py-1.5 text-white"
              >
                Prev MD
              </button>
              <span className="font-mono text-slate-200 px-2 tabular-nums">
                Matchday {selectedFixtureMd}/{activeLeague.totalMatchdays}
              </span>
              <button
                type="button"
                disabled={selectedFixtureMd >= activeLeague.totalMatchdays}
                onClick={() =>
                  setSelectedFixtureMd((m) => Math.min(activeLeague.totalMatchdays, m + 1))
                }
                className="rounded border border-slate-700 bg-slate-900 disabled:opacity-40 px-3 py-1.5 text-white"
              >
                Next MD
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-800/70">
            {leagueFixturesForMd.map((fix) => {
              const h = career.clubs[fix.homeClubId];
              const a = career.clubs[fix.awayClubId];
              return (
                <div
                  key={fix.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2.5 flex-1 justify-end text-right min-w-0">
                    <span className="truncate font-medium text-white">{h?.name}</span>
                    {h && <ClubCrest crest={h.crest} size={24} />}
                  </div>

                  <div className="w-24 text-center font-mono font-bold text-white shrink-0 tabular-nums">
                    {fix.status === 'completed' && fix.result
                      ? `${fix.result.homeGoals} - ${fix.result.awayGoals}`
                      : fix.date.slice(5)}
                  </div>

                  <div className="flex items-center gap-2.5 flex-1 justify-start min-w-0">
                    {a && <ClubCrest crest={a.crest} size={24} />}
                    <span className="truncate font-medium text-white">{a?.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTINENTAL KNOCKOUT CUPS */}
      {competitionsTab === 'continental' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['ucl', 'uel'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCupId(id)}
                className={`px-4 py-2 rounded-md border text-xs font-semibold ${
                  selectedCupId === id
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-[#121824] text-slate-300'
                }`}
              >
                {career.competitions[id]?.name}
              </button>
            ))}
          </div>

          <div className="rounded-md border border-amber-800/60 bg-amber-950/25 px-4 py-3 text-xs text-amber-200 leading-relaxed">
            <span className="font-semibold text-amber-300">Simplified Continental Format:</span>{' '}
            UCL and UEL run as a 16-club knockout bracket seeded from the 50-club starter database
            rather than full historical 32-club or 48-club group stages.
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white">{cupComp?.name}</h2>
              {cupComp?.winnerClubId && (
                <span className="text-xs font-semibold text-emerald-400">
                  Winner: {career.clubs[cupComp.winnerClubId]?.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cupFixtures.map((fix) => {
                const h = career.clubs[fix.homeClubId];
                const a = career.clubs[fix.awayClubId];
                return (
                  <div
                    key={fix.id}
                    className="rounded-md border border-slate-800 bg-[#0B0F17] p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex justify-between text-slate-400 font-mono">
                      <span>{fix.roundName ?? `MD ${fix.matchday}`}</span>
                      <span>{fix.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-medium text-white">
                      <span>{h?.name}</span>
                      <span className="font-mono font-bold tabular-nums">
                        {fix.result
                          ? `${fix.result.homeGoals} - ${fix.result.awayGoals}`
                          : 'vs'}
                      </span>
                      <span>{a?.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STATISTICS CENTRE */}
      {competitionsTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Top Scorers</h2>
            {topScorers.length === 0 ? (
              <p className="text-xs text-slate-400">Play matches to populate goal leaders.</p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {topScorers.map((r, idx) => (
                  <button
                    key={r.playerId}
                    type="button"
                    onClick={() => openPlayerProfile(r.playerId, 'competitions')}
                    className="w-full py-2 flex items-center justify-between text-left hover:text-emerald-300"
                  >
                    <span className="truncate pr-2">
                      <span className="font-mono text-slate-500 mr-2">{idx + 1}.</span>
                      <span className="font-medium text-white">{r.playerName}</span>{' '}
                      <span className="text-slate-400">({r.clubName})</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {r.goals}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Assist Leaders</h2>
            {topAssists.length === 0 ? (
              <p className="text-xs text-slate-400">Play matches to populate assist leaders.</p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {topAssists.map((r, idx) => (
                  <button
                    key={r.playerId}
                    type="button"
                    onClick={() => openPlayerProfile(r.playerId, 'competitions')}
                    className="w-full py-2 flex items-center justify-between text-left hover:text-emerald-300"
                  >
                    <span className="truncate pr-2">
                      <span className="font-mono text-slate-500 mr-2">{idx + 1}.</span>
                      <span className="font-medium text-white">{r.playerName}</span>{' '}
                      <span className="text-slate-400">({r.clubName})</span>
                    </span>
                    <span className="font-mono font-bold text-sky-400 tabular-nums">
                      {r.assists}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">Clean Sheets</h2>
            {topCleanSheets.length === 0 ? (
              <p className="text-xs text-slate-400">Play matches to populate defensive leaders.</p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {topCleanSheets.map((r, idx) => (
                  <button
                    key={r.playerId}
                    type="button"
                    onClick={() => openPlayerProfile(r.playerId, 'competitions')}
                    className="w-full py-2 flex items-center justify-between text-left hover:text-emerald-300"
                  >
                    <span className="truncate pr-2">
                      <span className="font-mono text-slate-500 mr-2">{idx + 1}.</span>
                      <span className="font-medium text-white">{r.playerName}</span>{' '}
                      <span className="text-slate-400">({r.clubName})</span>
                    </span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {r.cleanSheets}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
