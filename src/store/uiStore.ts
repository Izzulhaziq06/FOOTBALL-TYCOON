import { create } from 'zustand';

export type ActiveScreen =
  | 'main_menu'
  | 'new_career'
  | 'saves'
  | 'settings'
  | 'about'
  | 'dashboard'
  | 'squad'
  | 'player_profile'
  | 'tactics'
  | 'transfers'
  | 'match_center'
  | 'competitions'
  | 'club'
  | 'finances';

export type CompetitionsSubTab = 'standings' | 'fixtures' | 'continental' | 'stats';
export type ClubSubTab = 'overview' | 'training' | 'academy' | 'facilities' | 'stadium';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface UiStore {
  screen: ActiveScreen;
  previousScreen: ActiveScreen;
  selectedPlayerId: string | null;
  competitionsTab: CompetitionsSubTab;
  clubTab: ClubSubTab;
  mobileNavOpen: boolean;
  toasts: ToastMessage[];
  navigate: (screen: ActiveScreen) => void;
  openPlayerProfile: (playerId: string, returnScreen?: ActiveScreen) => void;
  setCompetitionsTab: (tab: CompetitionsSubTab) => void;
  setClubTab: (tab: ClubSubTab) => void;
  setMobileNavOpen: (open: boolean) => void;
  pushToast: (tone: ToastMessage['tone'], text: string) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  screen: 'main_menu',
  previousScreen: 'dashboard',
  selectedPlayerId: null,
  competitionsTab: 'standings',
  clubTab: 'overview',
  mobileNavOpen: false,
  toasts: [],
  navigate: (screen) =>
    set((s) => ({
      previousScreen: s.screen !== screen ? s.screen : s.previousScreen,
      screen,
      mobileNavOpen: false,
    })),
  openPlayerProfile: (playerId, returnScreen) =>
    set((s) => ({
      selectedPlayerId: playerId,
      previousScreen: returnScreen ?? s.screen,
      screen: 'player_profile',
      mobileNavOpen: false,
    })),
  setCompetitionsTab: (competitionsTab) => set({ competitionsTab }),
  setClubTab: (clubTab) => set({ clubTab }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  pushToast: (tone, text) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, text }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3800);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
