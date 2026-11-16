import { create } from 'zustand';
import {
  advanceMatchday,
  CreateAcademyPlayerInput,
  createAcademyPlayer,
  CreateCareerParams,
  createNewCareer,
  unlockPlayerSuperstar,
  updatePlayerSkills,
} from '../engine/careerEngine';
import { SkillId } from '../engine/skills';
import {
  renewPlayerContract,
  upgradeClubFacility,
} from '../engine/financeEngine';
import { advanceToNextSeason } from '../engine/progressionEngine';
import { validateTactics } from '../engine/tacticsEngine';
import {
  executeCompletedTransfer,
  sellUserPlayer,
  TransferNegotiationSession,
} from '../engine/transferEngine';
import {
  DEFAULT_APP_SETTINGS,
  deleteCareerSave,
  getLastActiveCareer,
  listCareerSaves,
  loadAppSettings,
  loadCareer,
  renameCareerSave,
  saveAppSettings,
  saveCareer,
} from '../storage/saveManager';
import {
  AppSettings,
  CareerState,
  ClubTactics,
  FacilityLevels,
  MatchResult,
  Player,
  SaveSummary,
  TrainingFocus,
} from '../types';

interface CareerStore {
  career: CareerState | null;
  saves: SaveSummary[];
  settings: AppSettings;
  isHydrated: boolean;
  isBusy: boolean;
  lastPlayedFixtureId: string | null;

  hydrate: () => Promise<void>;
  refreshSaves: () => Promise<void>;
  startNewCareer: (params: CreateCareerParams) => Promise<CareerState>;
  loadSavedCareer: (id: string) => Promise<boolean>;
  continueLatestCareer: () => Promise<boolean>;
  saveCurrentCareer: (customName?: string) => Promise<void>;
  renameSave: (id: string, newName: string) => Promise<boolean>;
  deleteSave: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  updateTactics: (tactics: ClubTactics) => Promise<{ ok: boolean; errors: string[] }>;
  setTrainingFocus: (focus: TrainingFocus) => Promise<void>;
  completeTransfer: (
    session: TransferNegotiationSession
  ) => Promise<{ ok: boolean; error?: string }>;
  sellPlayer: (playerId: string) => Promise<{ ok: boolean; error?: string; fee?: number }>;
  upgradeFacility: (facility: keyof FacilityLevels) => Promise<{ ok: boolean; error?: string }>;
  renewContract: (
    playerId: string,
    weeklyWage: number,
    years: number
  ) => Promise<{ ok: boolean; error?: string }>;
  customizePlayerSkills: (
    playerId: string,
    skill1: SkillId | null,
    skill2: SkillId | null
  ) => Promise<{ ok: boolean; error?: string }>;
  unlockSuperstar: (playerId: string) => Promise<{ ok: boolean; error?: string }>;
  createCustomPlayer: (
    input: CreateAcademyPlayerInput
  ) => Promise<{ ok: boolean; error?: string; player?: Player }>;

  commitMatchday: (userFixtureId?: string, userMatchResult?: MatchResult) => Promise<void>;
  rolloverSeason: () => Promise<void>;
  clearActiveCareer: () => void;
}

let persistQueue: Promise<void> = Promise.resolve();

function queueSaveCareer(state: CareerState, onDone?: (saves: SaveSummary[]) => void): Promise<void> {
  const task = persistQueue.then(async () => {
    await saveCareer(state);
    if (onDone) {
      const saves = await listCareerSaves();
      onDone(saves);
    }
  });
  persistQueue = task.catch(() => {});
  return task;
}

export const useCareerStore = create<CareerStore>((set, get) => ({
  career: null,
  saves: [],
  settings: DEFAULT_APP_SETTINGS,
  isHydrated: false,
  isBusy: false,
  lastPlayedFixtureId: null,

  hydrate: async () => {
    const [saves, settings] = await Promise.all([listCareerSaves(), loadAppSettings()]);
    set({ saves, settings, isHydrated: true });
  },

  refreshSaves: async () => {
    const saves = await listCareerSaves();
    set({ saves });
  },

  startNewCareer: async (params) => {
    set({ isBusy: true });
    try {
      const newCareer = createNewCareer(params);
      const saved = await saveCareer(newCareer);
      const saves = await listCareerSaves();
      set({ career: saved, saves, lastPlayedFixtureId: null, isBusy: false });
      return saved;
    } catch (err) {
      set({ isBusy: false });
      throw err;
    }
  },

  loadSavedCareer: async (id) => {
    set({ isBusy: true });
    const loaded = await loadCareer(id);
    if (!loaded) {
      set({ isBusy: false });
      return false;
    }
    const saves = await listCareerSaves();
    set({ career: loaded, saves, lastPlayedFixtureId: null, isBusy: false });
    return true;
  },

  continueLatestCareer: async () => {
    set({ isBusy: true });
    const latest = await getLastActiveCareer();
    if (!latest) {
      set({ isBusy: false });
      return false;
    }
    const saves = await listCareerSaves();
    set({ career: latest, saves, lastPlayedFixtureId: null, isBusy: false });
    return true;
  },

  saveCurrentCareer: async (customName) => {
    const current = get().career;
    if (!current) return;
    const updated = customName ? { ...current, saveName: customName } : current;
    set({ career: updated });
    await queueSaveCareer(updated, (saves) => set({ saves }));
  },

  renameSave: async (id, newName) => {
    const ok = await renameCareerSave(id, newName);
    if (ok) {
      const current = get().career;
      const saves = await listCareerSaves();
      set({
        saves,
        career: current && current.id === id ? { ...current, saveName: newName.trim() } : current,
      });
    }
    return ok;
  },

  deleteSave: async (id) => {
    await deleteCareerSave(id);
    const current = get().career;
    const saves = await listCareerSaves();
    set({
      saves,
      career: current?.id === id ? null : current,
    });
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial };
    await saveAppSettings(next);
    set({ settings: next });
  },

  updateTactics: async (tactics) => {
    const current = get().career;
    if (!current) return { ok: false, errors: ['No active career'] };
    const club = current.clubs[current.userClubId];
    const validation = validateTactics(tactics, club, current.players);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }
    const nextCareer: CareerState = { ...current, tactics };
    set({ career: nextCareer });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(nextCareer, (saves) => set({ saves }));
    }
    return { ok: true, errors: [] };
  },

  setTrainingFocus: async (trainingFocus) => {
    const current = get().career;
    if (!current) return;
    const nextCareer = { ...current, trainingFocus };
    set({ career: nextCareer });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(nextCareer);
    }
  },

  completeTransfer: async (session) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = executeCompletedTransfer(current, session);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
    }
    return { ok: true };
  },

  sellPlayer: async (playerId) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = sellUserPlayer(current, playerId);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
    }
    return { ok: true, fee: res.fee };
  },

  upgradeFacility: async (facility) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = upgradeClubFacility(current, facility);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState);
    }
    return { ok: true };
  },

  renewContract: async (playerId, weeklyWage, years) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = renewPlayerContract(current, playerId, weeklyWage, years);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState);
    }
    return { ok: true };
  },

  customizePlayerSkills: async (playerId, skill1, skill2) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = updatePlayerSkills(current, playerId, skill1, skill2);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
    }
    return { ok: true };
  },

  unlockSuperstar: async (playerId) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = unlockPlayerSuperstar(current, playerId);
    if (!res.ok) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
    }
    return { ok: true };
  },

  createCustomPlayer: async (input) => {
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = createAcademyPlayer(current, input);
    if (!res.ok || !res.player) return { ok: false, error: res.error };
    set({ career: res.nextState });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
    }
    return { ok: true, player: res.player };
  },

  commitMatchday: async (userFixtureId, userMatchResult) => {
    const current = get().career;
    if (!current) return;
    const precomputed =
      userFixtureId && userMatchResult ? { [userFixtureId]: userMatchResult } : undefined;
    const nextCareer = advanceMatchday(current, precomputed);
    set({
      career: nextCareer,
      lastPlayedFixtureId: userFixtureId ?? null,
    });
    if (get().settings.autosaveEnabled) {
      await queueSaveCareer(nextCareer, (saves) => set({ saves }));
    }
  },

  rolloverSeason: async () => {
    const current = get().career;
    if (!current) return;
    const nextCareer = advanceToNextSeason(current);
    set({ career: nextCareer, lastPlayedFixtureId: null });
    await queueSaveCareer(nextCareer, (saves) => set({ saves }));
  },

  clearActiveCareer: () => set({ career: null, lastPlayedFixtureId: null }),
}));
