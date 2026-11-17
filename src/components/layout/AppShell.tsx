import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Crosshair,
  ArrowLeftRight,
  Calendar,
  Trophy,
  Building2,
  Wallet,
  Settings,
  Save,
  Play,
  Menu,
  X,
  Home,
} from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { ActiveScreen, useUiStore } from '../../store/uiStore';
import { ClubCrest } from '../shared/ClubCrest';
import { CompetitionEmblem, GameBrandMark } from '../shared/GamePrimitives';
import { formatMoney } from '../../utils/format';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { career, settings, saveCurrentCareer } = useCareerStore();
  const {
    screen,
    competitionsTab,
    navigate,
    setCompetitionsTab,
    mobileNavOpen,
    setMobileNavOpen,
    pushToast,
  } = useUiStore();

  if (!career) return <>{children}</>;

  const userClub = career.clubs[career.userClubId];
  const userLeague = career.competitions[career.userLeagueId];
  const seasonFinished = career.currentMatchday > career.totalMatchdays;
  const seasonProgressPct = Math.min(
    100,
    Math.round(((career.currentMatchday - 1) / Math.max(1, career.totalMatchdays)) * 100)
  );

  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      active: boolean;
      onClick: () => void;
    }>;
  }> = [
    {
      groupLabel: 'Dugout',
      items: [
        {
          id: 'nav-dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-4 w-4" />,
          active: screen === 'dashboard',
          onClick: () => navigate('dashboard'),
        },
        {
          id: 'nav-squad',
          label: 'Squad',
          icon: <Users className="h-4 w-4" />,
          active: screen === 'squad' || screen === 'player_profile',
          onClick: () => navigate('squad'),
        },
        {
          id: 'nav-tactics',
          label: 'Tactics',
          icon: <Crosshair className="h-4 w-4" />,
          active: screen === 'tactics',
          onClick: () => navigate('tactics'),
        },
        {
          id: 'nav-transfers',
          label: 'Transfers',
          icon: <ArrowLeftRight className="h-4 w-4" />,
          active: screen === 'transfers',
          onClick: () => navigate('transfers'),
        },
      ],
    },
    {
      groupLabel: 'Competition',
      items: [
        {
          id: 'nav-fixtures',
          label: 'Fixtures',
          icon: <Calendar className="h-4 w-4" />,
          active: screen === 'competitions' && competitionsTab === 'fixtures',
          onClick: () => {
            setCompetitionsTab('fixtures');
            navigate('competitions');
          },
        },
        {
          id: 'nav-competitions',
          label: 'Competitions',
          icon: <Trophy className="h-4 w-4" />,
          active: screen === 'competitions' && competitionsTab !== 'fixtures',
          onClick: () => {
            if (competitionsTab === 'fixtures') setCompetitionsTab('standings');
            navigate('competitions');
          },
        },
      ],
    },
    {
      groupLabel: 'Club & Office',
      items: [
        {
          id: 'nav-club',
          label: 'Club',
          icon: <Building2 className="h-4 w-4" />,
          active: screen === 'club',
          onClick: () => navigate('club'),
        },
        {
          id: 'nav-finances',
          label: 'Finances',
          icon: <Wallet className="h-4 w-4" />,
          active: screen === 'finances',
          onClick: () => navigate('finances'),
        },
        {
          id: 'nav-saves',
          label: 'Career Saves',
          icon: <Save className="h-4 w-4" />,
          active: screen === 'saves',
          onClick: () => navigate('saves'),
        },
        {
          id: 'nav-settings',
          label: 'Career Settings',
          icon: <Settings className="h-4 w-4" />,
          active: screen === 'settings',
          onClick: () => navigate('settings'),
        },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);

  const handleQuickSave = async () => {
    await saveCurrentCareer();
    pushToast('success', `Saved "${career.saveName}" to browser storage.`);
  };

  return (
    <div className="min-h-screen ft-stadium-bg text-[#F4F5F0] flex flex-col lg:flex-row">
      {/* Desktop Left Game Command Rail */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/80 bg-[#0A101D]/98 z-30">
        {/* Game Brand Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800/80 bg-[#070B14]">
          <button
            type="button"
            onClick={() => navigate('main_menu')}
            className="flex items-center gap-2.5 text-left group focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <GameBrandMark size={28} />
            <div>
              <div className="font-display text-lg font-extrabold tracking-wider text-[#F4F5F0] leading-none group-hover:text-emerald-300 transition-colors">
                FOOTBALL TYCOON
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-400/90 mt-0.5">
                Career Command
              </div>
            </div>
          </button>
        </div>

        {/* Active Club Dossier Strip */}
        <div className="px-4 py-3.5 border-b border-slate-800/80 relative overflow-hidden bg-[#0E1627]/70">
          <div
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: userClub.crest.primaryColor }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-3 pl-1">
            <ClubCrest crest={userClub.crest} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#F4F5F0] truncate">{userClub.name}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {career.manager.name} · <span className="font-mono text-slate-300">REP {userClub.reputation}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pl-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
              <span>{career.currentSeason}</span>
              <span className="text-emerald-400">
                {seasonFinished
                  ? 'Season Complete'
                  : `Matchday ${career.currentMatchday} of ${career.totalMatchdays}`}
              </span>
            </div>
            <div className="h-1 w-full bg-[#070B14] rounded-xs overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${seasonFinished ? 100 : seasonProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Grouped Game Navigation */}
        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500 font-semibold">
                {group.groupLabel}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  id={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-[13px] font-medium transition-colors whitespace-nowrap relative ${
                    item.active
                      ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/35 shadow-[inset_2px_0_0_#10B981]'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-[#F4F5F0] border border-transparent'
                  }`}
                >
                  <span className={item.active ? 'text-emerald-400' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* System Footer Controls */}
        <div className="p-3 border-t border-slate-800/80 bg-[#070B14]/80 space-y-1.5">
          <button
            type="button"
            onClick={handleQuickSave}
            className="w-full flex items-center justify-center gap-2 rounded border border-slate-700/80 bg-[#11192B] px-3 py-2 text-xs font-semibold text-[#F4F5F0] hover:border-emerald-500/50 hover:bg-[#162138] transition-colors"
          >
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span>Save Career</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('main_menu')}
            className="w-full flex items-center justify-center gap-2 rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Broadcast & Matchday Command Strip */}
        <header className="sticky top-0 z-30 h-12 lg:h-16 border-b border-slate-800/80 bg-[#090E1A]/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="lg:hidden">
              <ClubCrest crest={userClub.crest} size={26} />
            </div>
            <div className="hidden lg:block">
              <CompetitionEmblem competitionId={userLeague.id} size={28} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#F4F5F0] truncate">
                <span className="truncate">{userClub.name}</span>
                <span className="hidden sm:inline text-slate-600">·</span>
                <span className="hidden sm:inline text-xs font-mono tabular-nums text-emerald-400">
                  {career.currentSeason}
                  {career.isGeneratedSeason ? ' (Generated)' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 tabular-nums font-mono">
                <span className="text-slate-200 font-semibold">
                  {seasonFinished
                    ? 'Season Complete'
                    : `MD ${career.currentMatchday}/${career.totalMatchdays}`}
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-slate-600">·</span>
                <span className="hidden md:inline">{career.currentDate}</span>
                <span aria-hidden="true" className="hidden md:inline text-slate-600">·</span>
                <span className="hidden sm:inline">
                  Budget {formatMoney(userClub.transferBudget, settings.currency)}
                </span>
                <span aria-hidden="true" className="hidden md:inline text-slate-600">·</span>
                <span className={`hidden md:inline ${career.transferWindowOpen ? 'text-emerald-400' : 'text-amber-300'}`}>
                  Window: {career.transferWindowLabel}
                </span>
                <span aria-hidden="true" className="hidden xl:inline text-slate-600">·</span>
                <span className="hidden xl:inline text-purple-300">
                  Tokens: {career.universalSkillTokens ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('match_center')}
              className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(16,185,129,0.28)]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{seasonFinished ? 'Season Review' : 'Matchday'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle menu"
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded border border-slate-700/80 bg-[#101829] text-slate-200"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Full Command Drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden fixed inset-0 top-12 z-40 bg-[#070B14]/98 backdrop-blur-md overflow-y-auto p-4 pb-24 space-y-5"
            >
              <div className="ft-panel rounded-lg p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ClubCrest crest={userClub.crest} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{userClub.name}</div>
                    <div className="text-xs font-mono text-emerald-400">
                      {career.currentSeason} · Budget {formatMoney(userClub.transferBudget, settings.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {allNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`flex items-center gap-3 rounded border px-3.5 py-3 text-sm font-semibold min-h-[46px] ${
                      item.active
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-800 bg-[#101829] text-slate-200'
                    }`}
                  >
                    <span className={item.active ? 'text-emerald-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleQuickSave}
                  className="flex-1 rounded border border-emerald-600/50 bg-emerald-950/30 py-3 text-sm font-semibold text-emerald-200 min-h-[46px]"
                >
                  Save Career
                </button>
                <button
                  type="button"
                  onClick={() => navigate('main_menu')}
                  className="flex-1 rounded border border-slate-800 bg-[#101829] py-3 text-sm font-medium text-slate-300 min-h-[46px]"
                >
                  Main Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workspace Viewport */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Compact Bottom Command Bar (56px, <= 15% viewport height) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-slate-800/90 bg-[#080D18]/98 backdrop-blur-md grid grid-cols-5"
      >
        {(
          [
            { label: 'Home', icon: <LayoutDashboard className="h-4 w-4" />, target: 'dashboard' as ActiveScreen },
            { label: 'Squad', icon: <Users className="h-4 w-4" />, target: 'squad' as ActiveScreen },
            { label: 'Tactics', icon: <Crosshair className="h-4 w-4" />, target: 'tactics' as ActiveScreen },
            { label: 'Match', icon: <Play className="h-4 w-4" />, target: 'match_center' as ActiveScreen },
            { label: 'Table', icon: <Trophy className="h-4 w-4" />, target: 'competitions' as ActiveScreen },
          ] as const
        ).map((tab) => {
          const isActive =
            screen === tab.target || (tab.target === 'squad' && screen === 'player_profile');
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.target)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold relative ${
                isActive ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-emerald-400" aria-hidden="true" />
              )}
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
