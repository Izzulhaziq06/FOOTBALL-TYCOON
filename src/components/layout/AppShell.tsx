import React from 'react';
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
  const seasonFinished = career.currentMatchday > career.totalMatchdays;

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
  }> = [
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
  ];

  const handleQuickSave = async () => {
    await saveCurrentCareer();
    pushToast('success', `Saved "${career.saveName}" to browser storage.`);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/80 bg-[#0E1420]">
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => navigate('main_menu')}
            className="text-left focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <span className="font-display text-xl font-bold tracking-wider text-white">
              FOOTBALL TYCOON
            </span>
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-800/70 flex items-center gap-3">
          <ClubCrest crest={userClub.crest} size={38} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{userClub.name}</div>
            <div className="text-xs text-slate-400 truncate">
              {career.manager.name} · {userClub.reputation} REP
            </div>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={item.id}
              type="button"
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                item.active
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={handleQuickSave}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span>Save Career</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('main_menu')}
            className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Club & Season Bar */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 border-b border-slate-800/80 bg-[#0E1420]/95 backdrop-blur-sm px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden">
              <ClubCrest crest={userClub.crest} size={28} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white truncate">
                <span className="truncate">{userClub.name}</span>
                <span className="hidden sm:inline text-slate-600">·</span>
                <span className="hidden sm:inline text-xs font-mono tabular-nums text-emerald-400">
                  {career.currentSeason}
                  {career.isGeneratedSeason ? ' (Generated)' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                <span>
                  {seasonFinished
                    ? 'Season Complete'
                    : `MD ${career.currentMatchday}/${career.totalMatchdays}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="hidden md:inline">{career.currentDate}</span>
                <span aria-hidden="true" className="hidden md:inline">·</span>
                <span className="hidden sm:inline">
                  Budget {formatMoney(userClub.transferBudget, settings.currency)}
                </span>
                <span aria-hidden="true" className="hidden md:inline">·</span>
                <span className="hidden md:inline">
                  Window: {career.transferWindowLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('match_center')}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{seasonFinished ? 'Season Review' : 'Matchday'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle menu"
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-slate-700 bg-slate-900 text-slate-200"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 top-14 z-40 bg-[#0B0F17]/98 overflow-y-auto p-4 pb-24">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`flex items-center gap-3 rounded-md border px-3.5 py-3 text-sm font-medium min-h-[44px] ${
                    item.active
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-[#121824] text-slate-200'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleQuickSave}
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 py-3 text-sm font-semibold text-white min-h-[44px]"
              >
                Save Career
              </button>
              <button
                type="button"
                onClick={() => navigate('main_menu')}
                className="flex-1 rounded-md border border-slate-800 bg-[#121824] py-3 text-sm font-medium text-slate-300 min-h-[44px]"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Compact Bottom Navigation (<= 56px height) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-slate-800 bg-[#0E1420]/95 backdrop-blur-sm grid grid-cols-5"
      >
        {(
          [
            { label: 'Home', icon: <LayoutDashboard className="h-4 w-4" />, screen: 'dashboard' as ActiveScreen },
            { label: 'Squad', icon: <Users className="h-4 w-4" />, screen: 'squad' as ActiveScreen },
            { label: 'Tactics', icon: <Crosshair className="h-4 w-4" />, screen: 'tactics' as ActiveScreen },
            { label: 'Match', icon: <Play className="h-4 w-4" />, screen: 'match_center' as ActiveScreen },
            { label: 'Table', icon: <Trophy className="h-4 w-4" />, screen: 'competitions' as ActiveScreen },
          ] as const
        ).map((tab) => {
          const isActive = screen === tab.screen;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.screen)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
