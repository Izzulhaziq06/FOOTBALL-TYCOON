import { create } from 'zustand';
import {
  advanceMatchday,
  CreateAcademyPlayerInput,
  createAcademyPlayer,
  CreateCareerParams,
  createNewCareer,
  unlockOrRerollSkill2,
  unlockPlayerSuperstar,
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
  isRollingSkill: boolean;
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
  rollDevelopedSkill: (playerId: string) => Promise<{
    ok: boolean;
    error?: string;
    rolledSkill?: SkillId;
    previousSkill?: SkillId | null;
  }>;
  unlockSuperstar: (playerId: string) => Promise<{ ok: boolean; error?: string }>;
  createCustomPlayer: (
    input: CreateAcademyPlayerInput
  ) => Promise<{ ok: boolean; error?: string; player?: Player; tokensEarned?: number }>;

  commitMatchday: (userFixtureId?: string, userMatchResult?: MatchResult) => Promise<boolean>;
  rolloverSeason: () => Promise<boolean>;
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

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function sanitizeLoadedCareer(state: CareerState): CareerState {
  return {
    ...state,
    news: dedupeById(state.news),
    transactions: dedupeById(state.transactions),
  };
}

let skillRollInFlight = false;
let careerMutationInFlight = false;

export const useCareerStore = create<CareerStore>((set, get) => ({
  career: null,
  saves: [],
  settings: DEFAULT_APP_SETTINGS,
  isHydrated: false,
  isBusy: false,
  isRollingSkill: false,
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
    set({ career: sanitizeLoadedCareer(loaded), saves, lastPlayedFixtureId: null, isBusy: false });
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
    set({ career: sanitizeLoadedCareer(latest), saves, lastPlayedFixtureId: null, isBusy: false });
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

  rollDevelopedSkill: async (playerId) => {
    if (skillRollInFlight || careerMutationInFlight) {
      return { ok: false, error: 'Skill roll already in progress.' };
    }
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };

    const res = unlockOrRerollSkill2(current, playerId);
    if (!res.ok || !res.rolledSkill) {
      return { ok: false, error: res.error };
    }

    skillRollInFlight = true;
    set({ isRollingSkill: true });
    try {
      await queueSaveCareer(res.nextState, (saves) => set({ saves }));
      set({ career: res.nextState, isRollingSkill: false });
      return {
        ok: true,
        rolledSkill: res.rolledSkill,
        previousSkill: res.previousSkill,
      };
    } catch {
      set({ isRollingSkill: false });
      return {
        ok: false,
        error: 'Could not persist skill roll. No token was consumed.',
      };
    } finally {
      skillRollInFlight = false;
    }
  },

  unlockSuperstar: async (playerId) => {
    if (careerMutationInFlight || skillRollInFlight) {
      return { ok: false, error: 'Another career action is already in progress.' };
    }
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = unlockPlayerSuperstar(current, playerId);
    if (!res.ok) return { ok: false, error: res.error };

    careerMutationInFlight = true;
    set({ isBusy: true });
    try {
      if (get().settings.autosaveEnabled) {
        await queueSaveCareer(res.nextState, (saves) => set({ saves }));
      }
      set({ career: res.nextState, isBusy: false });
      return { ok: true };
    } catch {
      set({ isBusy: false });
      return {
        ok: false,
        error: 'Could not persist Superstar elevation. State was rolled back.',
      };
    } finally {
      careerMutationInFlight = false;
    }
  },

  createCustomPlayer: async (input) => {
    if (careerMutationInFlight || skillRollInFlight) {
      return { ok: false, error: 'Another career action is already in progress.' };
    }
    const current = get().career;
    if (!current) return { ok: false, error: 'No active career.' };
    const res = createAcademyPlayer(current, input);
    if (!res.ok || !res.player) return { ok: false, error: res.error };

    careerMutationInFlight = true;
    set({ isBusy: true });
    try {
      if (get().settings.autosaveEnabled) {
        await queueSaveCareer(res.nextState, (saves) => set({ saves }));
      }
      set({ career: res.nextState, isBusy: false });
      return { ok: true, player: res.player, tokensEarned: res.tokensEarned };
    } catch {
      set({ isBusy: false });
      return {
        ok: false,
        error: 'Could not persist academy promotion. State was rolled back.',
      };
    } finally {
      careerMutationInFlight = false;
    }
  },

  commitMatchday: async (userFixtureId, userMatchResult) => {
    if (careerMutationInFlight || skillRollInFlight) return false;
    const current = get().career;
    if (!current || current.currentMatchday > current.totalMatchdays) return false;

    const precomputed =
      userFixtureId && userMatchResult ? { [userFixtureId]: userMatchResult } : undefined;
    const nextCareer = advanceMatchday(current, precomputed);
    if (nextCareer === current) return false;

    careerMutationInFlight = true;
    set({ isBusy: true });
    try {
      if (get().settings.autosaveEnabled) {
        await queueSaveCareer(nextCareer, (saves) => set({ saves }));
      }
      set({
        career: nextCareer,
        lastPlayedFixtureId: userFixtureId ?? null,
        isBusy: false,
      });
      return true;
    } catch {
      set({ isBusy: false });
      return false;
    } finally {
      careerMutationInFlight = false;
    }
  },

  rolloverSeason: async () => {
    if (careerMutationInFlight || skillRollInFlight) return false;
    const current = get().career;
    if (
      !current ||
      current.currentMatchday <= current.totalMatchdays ||
      current.seasonHistory.some((h) => h.seasonId === current.currentSeason)
    ) {
      return false;
    }

    const nextCareer = advanceToNextSeason(current);
    if (nextCareer === current) return false;

    careerMutationInFlight = true;
    set({ isBusy: true });
    try {
      await queueSaveCareer(nextCareer, (saves) => set({ saves }));
      set({ career: nextCareer, lastPlayedFixtureId: null, isBusy: false });
      return true;
    } catch {
      set({ isBusy: false });
      return false;
    } finally {
      careerMutationInFlight = false;
    }
  },

  clearActiveCareer: () => set({ career: null, lastPlayedFixtureId: null }),
}));
