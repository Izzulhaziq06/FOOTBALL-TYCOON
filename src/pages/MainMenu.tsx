import React, { useState } from 'react';
import { Play, PlusCircle, FolderOpen, Settings, Info, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { CompetitionEmblem, GameBrandMark } from '../components/shared/GamePrimitives';

const FEATURED_COMPS = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'ucl', 'uel'];

export const MainMenu: React.FC = () => {
  const { saves, continueLatestCareer, career } = useCareerStore();
  const { navigate, pushToast } = useUiStore();
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const latestSave = saves[0];

  const handleContinue = async () => {
    if (career) {
      navigate('dashboard');
      return;
    }
    const ok = await continueLatestCareer();
    if (ok) {
      navigate('dashboard');
    } else {
      pushToast('info', 'No saved career found. Start a new career to begin.');
    }
  };

  return (
    <div className="min-h-screen ft-stadium-bg ft-tactical-grid text-[#F4F5F0] flex flex-col">
      {/* Broadcast Top Bar */}
      <header className="flex items-center justify-between gap-6 px-4 sm:px-8 lg:px-12 h-16 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md">
        <div className="flex items-center gap-3 shrink-0">
          <GameBrandMark size={30} />
          <div>
            <span className="font-display text-2xl font-extrabold tracking-wider text-[#F4F5F0] whitespace-nowrap leading-none block">
              FOOTBALL TYCOON
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-widest text-slate-300">
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
          >
            New Career
          </button>
          <button
            type="button"
            onClick={() => navigate('saves')}
            className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
          >
            Load Career
          </button>
          <button
            type="button"
            onClick={() => navigate('settings')}
            className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => navigate('about')}
            className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
          >
            About
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="ft-chamfer-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(16,185,129,0.25)]"
          >
            Start Career
          </button>
        </div>
      </header>

      {/* Main Split Stadium Command Center */}
      <main className="flex-1 max-w-[1340px] w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-emerald-300">
              <span>Historical Football Management · 2014/15 – 2018/19</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-[64px] font-extrabold tracking-tight text-[#F4F5F0] leading-[0.98]">
              Build Your Club.{' '}
              <span className="text-emerald-400">Control Your Legacy.</span>
            </h1>

            <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-xl">
              Step into the dugout across five landmark European football seasons. Shape tactical
              systems, negotiate transfers, balance the wage bill, promote academy graduates, and
              simulate every matchday locally on your device.
            </p>
          </div>

          {/* Primary Game Menu Console */}
          <div className="space-y-3 max-w-md">
            {(latestSave || career) && (
              <button
                type="button"
                onClick={handleContinue}
                className="ft-chamfer w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 px-5 py-4 text-left transition-colors shadow-[0_10px_28px_rgba(16,185,129,0.24)]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded bg-black/25 flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 fill-current text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-xl font-bold uppercase tracking-wide text-white leading-none">
                      Continue Career
                    </div>
                    <div className="text-xs font-mono text-emerald-100 truncate mt-1">
                      {career
                        ? `${career.clubs[career.userClubId]?.name} · ${career.currentSeason} · MD ${career.currentMatchday}`
                        : `${latestSave.clubName} · ${latestSave.currentSeason} · MD ${latestSave.currentMatchday}`}
                    </div>
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('new_career')}
              className={`ft-chamfer-sm w-full flex items-center gap-3.5 px-5 py-3.5 text-left font-bold transition-colors ${
                latestSave || career
                  ? 'border border-slate-700/90 bg-[#11192B] hover:border-emerald-500/50 hover:bg-[#162138] text-[#F4F5F0]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_10px_28px_rgba(16,185,129,0.24)]'
              }`}
            >
              <PlusCircle
                className={`h-5 w-5 shrink-0 ${
                  latestSave || career ? 'text-emerald-400' : 'text-white'
                }`}
              />
              <div>
                <div className="font-display text-lg uppercase tracking-wide leading-none">
                  New Career
                </div>
                <div
                  className={`text-[11px] font-normal mt-0.5 ${
                    latestSave || career ? 'text-slate-400' : 'text-emerald-50/95'
                  }`}
                >
                  Select historical season, league, club &amp; manager profile
                </div>
              </div>
            </button>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('saves')}
                className="flex items-center justify-center gap-2 rounded border border-slate-800 bg-[#0E1626] hover:border-slate-600 hover:bg-[#141F35] px-3 py-3 text-xs font-semibold text-slate-200 transition-colors min-h-[44px]"
              >
                <FolderOpen className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Load ({saves.length})</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('settings')}
                className="flex items-center justify-center gap-2 rounded border border-slate-800 bg-[#0E1626] hover:border-slate-600 hover:bg-[#141F35] px-3 py-3 text-xs font-semibold text-slate-200 transition-colors min-h-[44px]"
              >
                <Settings className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('about')}
                className="flex items-center justify-center gap-2 rounded border border-slate-800 bg-[#0E1626] hover:border-slate-600 hover:bg-[#141F35] px-3 py-3 text-xs font-semibold text-slate-200 transition-colors min-h-[44px]"
              >
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <span>About</span>
              </button>
            </div>
          </div>

          {/* Grounded Coverage Strip */}
          <div className="ft-panel rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-display text-3xl font-extrabold text-[#F4F5F0] tabular-nums leading-none">
                5
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Historical Seasons</div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="font-display text-3xl font-extrabold text-emerald-400 tabular-nums leading-none">
                50
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Top-Flight Clubs</div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="font-display text-3xl font-extrabold text-[#F4F5F0] tabular-nums leading-none">
                7
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Competitions</div>
            </div>
          </div>
        </div>

        {/* Hero Stadium Broadcast Frame */}
        <div className="lg:col-span-6 relative rounded-lg overflow-hidden border border-slate-800/90 bg-[#0B1220] min-h-[300px] lg:min-h-[480px] flex flex-col justify-end shadow-2xl">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_stadium_night_1794859587399.jpg"
              alt="Floodlit European football stadium pitch at night"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#0B291E] to-[#070B14]" />
          )}

          {/* Measured Broadcast Scrims */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14]/55 via-transparent to-transparent" />

          {/* Top Competition Medallion Bar */}
          <div className="relative z-10 p-5 sm:p-6 mb-auto flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 bg-[#070B14]/85 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 rounded">
              {FEATURED_COMPS.map((id) => (
                <CompetitionEmblem key={id} competitionId={id} size={22} />
              ))}
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-[#070B14]/85 backdrop-blur-sm border border-emerald-500/35 px-2.5 py-1 rounded text-[11px] font-mono text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Offline-Ready IndexedDB
            </span>
          </div>

          {/* Bottom Matchday Dossier */}
          <div className="relative z-10 p-5 sm:p-6 space-y-3 border-t border-white/10 bg-[#070B14]/80 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-emerald-300">
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                UCL &amp; UEL Knockouts
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                25 Playstyle Skills &amp; Youth Academy
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 max-w-lg leading-relaxed">
              Deterministic minute-by-minute simulation, 8 tactical formations, live touchline
              adjustments, and persistent multi-season progression stored directly in your browser.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
