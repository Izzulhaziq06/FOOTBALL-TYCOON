import React, { useState } from 'react';
import { Play, PlusCircle, FolderOpen, Settings, Info, ShieldCheck } from 'lucide-react';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';

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
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Editorial Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 h-16 border-b border-slate-800/80 bg-[#0E1420]/90">
        <span className="font-display text-2xl font-bold tracking-wider text-white whitespace-nowrap shrink-0">
          FOOTBALL TYCOON
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            New Career
          </button>
          <button
            type="button"
            onClick={() => navigate('saves')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Load Career
          </button>
          <button
            type="button"
            onClick={() => navigate('settings')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => navigate('about')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            About
          </button>
        </nav>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            Start Career
          </button>
        </div>
      </header>

      {/* Main Split Hero */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-6 lg:px-12 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
          <div className="space-y-5">
            <div className="text-xs font-medium tracking-wide text-emerald-400">
              Historical Era · 2014/15 – 2018/19 · Local-First Simulation
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[1.02]">
              Build Your Club. Control Your Legacy.
            </h1>
            <p className="text-base leading-relaxed text-slate-300 max-w-xl">
              Step into the dugout across five landmark European football seasons. Shape tactical
              systems, negotiate transfers, balance the wage bill, develop academy talent, and
              simulate every matchday locally in your browser.
            </p>
          </div>

          {/* Primary Menu Actions */}
          <div className="space-y-3 max-w-md">
            {(latestSave || career) && (
              <button
                type="button"
                onClick={handleContinue}
                className="w-full flex items-center justify-between rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-3.5 text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Play className="h-5 w-5 fill-current text-white shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">Continue Career</div>
                    <div className="text-xs text-emerald-100 truncate">
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
              className={`w-full flex items-center gap-3 rounded-md px-5 py-3.5 text-left font-semibold transition-colors ${
                latestSave || career
                  ? 'border border-slate-700 bg-[#121824] hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <PlusCircle className="h-5 w-5 shrink-0" />
              <span>New Career</span>
            </button>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('saves')}
                className="flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-[#121824] hover:bg-slate-800 px-3 py-3 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
              >
                <FolderOpen className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Load ({saves.length})</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('settings')}
                className="flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-[#121824] hover:bg-slate-800 px-3 py-3 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
              >
                <Settings className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('about')}
                className="flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-[#121824] hover:bg-slate-800 px-3 py-3 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
              >
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <span>About</span>
              </button>
            </div>
          </div>

          {/* Grounded Coverage Strip */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-sm">
            <div>
              <div className="font-mono text-xl font-semibold text-white tabular-nums">5</div>
              <div className="text-xs text-slate-400">Historical Seasons</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold text-white tabular-nums">50</div>
              <div className="text-xs text-slate-400">Top-Flight Clubs</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold text-white tabular-nums">7</div>
              <div className="text-xs text-slate-400">Competitions</div>
            </div>
          </div>
        </div>

        {/* Hero Visual Panel */}
        <div className="lg:col-span-6 relative rounded-lg overflow-hidden border border-slate-800 bg-[#121824] min-h-[280px] lg:min-h-[440px]">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_stadium_night_1794859587399.jpg"
              alt="Floodlit European football stadium pitch at night"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0F172A] via-[#0B291E] to-[#0B0F17]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-6 space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>IndexedDB Local Persistence · Offline-Ready</span>
            </div>
            <p className="text-sm text-slate-200 max-w-md">
              Deterministic match simulation, 8 formation systems, live matchday tactical shifts,
              and multi-season career progression stored privately on your device.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
