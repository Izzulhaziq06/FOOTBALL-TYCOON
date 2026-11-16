import React, { Suspense, lazy, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ToastHost } from './components/shared/ToastHost';
import { MainMenu } from './pages/MainMenu';
import { NewCareer } from './pages/NewCareer';
import { Dashboard } from './pages/Dashboard';
import { useCareerStore } from './store/careerStore';
import { useUiStore } from './store/uiStore';

const Squad = lazy(() => import('./pages/Squad').then((m) => ({ default: m.Squad })));
const PlayerProfile = lazy(() =>
  import('./pages/PlayerProfile').then((m) => ({ default: m.PlayerProfile }))
);
const Tactics = lazy(() => import('./pages/Tactics').then((m) => ({ default: m.Tactics })));
const Transfers = lazy(() => import('./pages/Transfers').then((m) => ({ default: m.Transfers })));
const MatchCenter = lazy(() =>
  import('./pages/MatchCenter').then((m) => ({ default: m.MatchCenter }))
);
const Competitions = lazy(() =>
  import('./pages/Competitions').then((m) => ({ default: m.Competitions }))
);
const Club = lazy(() => import('./pages/Club').then((m) => ({ default: m.Club })));
const Finances = lazy(() => import('./pages/Finances').then((m) => ({ default: m.Finances })));
const SavesManager = lazy(() =>
  import('./pages/SavesManager').then((m) => ({ default: m.SavesManager }))
);
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const LoadingFallback: React.FC = () => (
  <div className="p-8 text-sm text-slate-400">Loading module...</div>
);

export default function App() {
  const { career, isHydrated, hydrate } = useCareerStore();
  const { screen, navigate } = useUiStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // If user is on a career screen without an active career loaded, bounce cleanly to Main Menu
  useEffect(() => {
    if (!isHydrated) return;
    const nonCareerScreens = new Set(['main_menu', 'new_career', 'saves', 'settings', 'about']);
    if (!career && !nonCareerScreens.has(screen)) {
      navigate('main_menu');
    }
  }, [isHydrated, career, screen, navigate]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-200 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="font-display text-3xl font-bold tracking-wider text-white">
            FOOTBALL TYCOON
          </div>
          <div className="text-xs text-slate-400">Initializing local database...</div>
        </div>
      </div>
    );
  }

  const renderStandalone = () => {
    if (screen === 'main_menu') return <MainMenu />;
    if (screen === 'new_career') return <NewCareer />;
    if (!career) {
      if (screen === 'saves') return <SavesManager />;
      if (screen === 'settings') return <Settings mode="settings" />;
      if (screen === 'about') return <Settings mode="about" />;
      return <MainMenu />;
    }
    return null;
  };

  const standalone = renderStandalone();

  return (
    <>
      {standalone ? (
        <Suspense fallback={<LoadingFallback />}>{standalone}</Suspense>
      ) : (
        <AppShell>
          <Suspense fallback={<LoadingFallback />}>
            {screen === 'dashboard' && <Dashboard />}
            {screen === 'squad' && <Squad />}
            {screen === 'player_profile' && <PlayerProfile />}
            {screen === 'tactics' && <Tactics />}
            {screen === 'transfers' && <Transfers />}
            {screen === 'match_center' && <MatchCenter />}
            {screen === 'competitions' && <Competitions />}
            {screen === 'club' && <Club />}
            {screen === 'finances' && <Finances />}
            {screen === 'saves' && <SavesManager />}
            {screen === 'settings' && <Settings mode="settings" />}
            {screen === 'about' && <Settings mode="about" />}
          </Suspense>
        </AppShell>
      )}
      <ToastHost />
    </>
  );
}
