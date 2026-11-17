import React, { useMemo, useState } from 'react';
import {
  calculateLeagueStandings,
  getCompetitionStatLeaders,
} from '../engine/competitionEngine';
import { useCareerStore } from '../store/careerStore';
import { CompetitionsSubTab, useUiStore } from '../store/uiStore';
import { ClubCrest } from '../components/shared/ClubCrest';
import { CompetitionEmblem, GamePageHeader } from '../components/shared/GamePrimitives';

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
      <GamePageHeader
        eyebrow={`${career.currentSeason} · European Football`}
        title="Competitions & Calendar"
        subtitle={
          <span className="font-mono">
            Matchday {Math.min(career.currentMatchday, career.totalMatchdays)}/{career.totalMatchdays}
            {career.isGeneratedSeason ? ' · Generated Career Season' : ''}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-1 p-1 rounded border border-slate-800 bg-[#080D18]">
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
        }
      />

      {/* League Selector Bar */}
      {competitionsTab !== 'continental' && (
        <div className="flex flex-wrap gap-2">
          {leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedLeagueId(l.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${
                activeLeague.id === l.id
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-[#0D1422] text-slate-300 hover:text-white'
              }`}
            >
              <CompetitionEmblem competitionId={l.id} size={20} />
              <span>{l.shortName}</span>
            </button>
          ))}
        </div>
      )}

      {/* STANDINGS */}
      {competitionsTab === 'standings' && (
        <div className="ft-panel rounded-lg overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-[#090E1A]">
            <div className="flex items-center gap-2.5">
              <CompetitionEmblem competitionId={activeLeague.id} size={26} />
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
                {activeLeague.name}
              </h2>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-400" /> Top 4 UCL
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 bg-sky-400" /> UEL
              </span>
              <span className="hidden sm:inline">Pts · GD · GF</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-[#080D18] text-[11px] font-mono uppercase tracking-wider text-slate-400">
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
                  const rank = idx + 1;
                  const zoneAccent =
                    rank <= 4
                      ? 'border-l-2 border-l-emerald-400'
                      : rank <= 6
                        ? 'border-l-2 border-l-sky-400'
                        : rank >= standings.length - 1
                          ? 'border-l-2 border-l-red-500/80'
                          : '';
                  return (
                    <tr
                      key={row.clubId}
                      className={`${zoneAccent} ${isUser ? 'bg-emerald-500/12' : 'hover:bg-white/[0.03]'}`}
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono text-xs font-bold text-slate-400">
                        {rank}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          {club && <ClubCrest crest={club.crest} size={24} />}
                          <span className={`font-semibold ${isUser ? 'text-emerald-300' : 'text-[#F4F5F0]'}`}>
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
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#F4F5F0]">
                        {row.points}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono text-[11px]">
                        {row.form.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          row.form.map((f, i) => (
                            <span
                              key={i}
                              className={`ml-1 inline-block w-4 text-center rounded-xs font-bold ${
                                f === 'W'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : f === 'L'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-amber-500/20 text-amber-300'
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
        <div className="ft-panel rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CompetitionEmblem competitionId={activeLeague.id} size={24} />
              <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
                {activeLeague.name} Fixtures
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={selectedFixtureMd <= 1}
                onClick={() => setSelectedFixtureMd((m) => Math.max(1, m - 1))}
                className="rounded border border-slate-700 bg-[#0B1220] disabled:opacity-40 px-3 py-1.5 font-semibold text-white"
              >
                Prev MD
              </button>
              <span className="font-mono text-emerald-300 px-2 tabular-nums font-bold">
                Matchday {selectedFixtureMd}/{activeLeague.totalMatchdays}
              </span>
              <button
                type="button"
                disabled={selectedFixtureMd >= activeLeague.totalMatchdays}
                onClick={() =>
                  setSelectedFixtureMd((m) => Math.min(activeLeague.totalMatchdays, m + 1))
                }
                className="rounded border border-slate-700 bg-[#0B1220] disabled:opacity-40 px-3 py-1.5 font-semibold text-white"
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
                    <span className="truncate font-semibold text-[#F4F5F0]">{h?.name}</span>
                    {h && <ClubCrest crest={h.crest} size={24} />}
                  </div>

                  <div className="w-20 sm:w-24 text-center font-mono font-bold text-[#F4F5F0] shrink-0 tabular-nums bg-[#070B14] border border-slate-800 rounded py-1">
                    {fix.status === 'completed' && fix.result
                      ? `${fix.result.homeGoals} - ${fix.result.awayGoals}`
                      : fix.date.slice(5)}
                  </div>

                  <div className="flex items-center gap-2.5 flex-1 justify-start min-w-0">
                    {a && <ClubCrest crest={a.crest} size={24} />}
                    <span className="truncate font-semibold text-[#F4F5F0]">{a?.name}</span>
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
          <div className="flex flex-wrap gap-2">
            {(['ucl', 'uel'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCupId(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded border text-xs font-bold ${
                  selectedCupId === id
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-[#0D1422] text-slate-300'
                }`}
              >
                <CompetitionEmblem competitionId={id} size={20} />
                <span>{career.competitions[id]?.name}</span>
              </button>
            ))}
          </div>

          <div className="rounded border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-xs text-amber-200 leading-relaxed">
            <span className="font-bold text-amber-300">Simplified Continental Format:</span>{' '}
            UCL and UEL run as a 16-club knockout bracket seeded from the 50-club starter database
            rather than full historical 32-club or 48-club group stages.
          </div>

          <div className="ft-panel rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <CompetitionEmblem competitionId={selectedCupId} size={32} />
                <h2 className="font-display text-2xl font-extrabold text-[#F4F5F0]">
                  {cupComp?.name}
                </h2>
              </div>
              {cupComp?.winnerClubId && (
                <span className="text-xs font-mono font-bold text-emerald-400">
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
                    className="ft-panel-inset rounded p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex justify-between text-emerald-400/90 font-mono">
                      <span>{fix.roundName ?? `MD ${fix.matchday}`}</span>
                      <span className="text-slate-400">{fix.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-[#F4F5F0] gap-2">
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        {h && <ClubCrest crest={h.crest} size={20} />}
                        <span className="truncate">{h?.name}</span>
                      </span>
                      <span className="font-mono font-bold tabular-nums px-2 py-0.5 rounded bg-[#0E1626] shrink-0">
                        {fix.result
                          ? `${fix.result.homeGoals} - ${fix.result.awayGoals}`
                          : 'vs'}
                      </span>
                      <span className="flex items-center gap-2 min-w-0 truncate justify-end">
                        <span className="truncate">{a?.name}</span>
                        {a && <ClubCrest crest={a.crest} size={20} />}
                      </span>
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
          <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-emerald-500/70">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Top Scorers</h2>
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
                      <span className="font-semibold text-[#F4F5F0]">{r.playerName}</span>{' '}
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

          <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-sky-500/70">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Assist Leaders</h2>
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
                      <span className="font-semibold text-[#F4F5F0]">{r.playerName}</span>{' '}
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

          <div className="ft-panel rounded-lg p-5 space-y-3 border-t-2 border-t-amber-500/70">
            <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">Clean Sheets</h2>
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
                      <span className="font-semibold text-[#F4F5F0]">{r.playerName}</span>{' '}
                      <span className="text-slate-400">({r.clubName})</span>
                    </span>
                    <span className="font-mono font-bold text-[#F4F5F0] tabular-nums">
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
