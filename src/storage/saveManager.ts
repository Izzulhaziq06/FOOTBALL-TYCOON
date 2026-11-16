import { getDefaultSkillsForPlayer, SKILL_MAP } from '../engine/skills';
import { AppSettings, CareerState, Player, SaveSummary } from '../types';
import {
  idbDeleteCareer,
  idbGetAllCareers,
  idbGetCareer,
  idbGetSetting,
  idbPutCareer,
  idbPutSetting,
} from './indexedDB';

export const CURRENT_SAVE_VERSION = '1.1.0';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  simulationSpeed: 'Normal',
  currency: 'EUR',
  autosaveEnabled: true,
  soundEffectsEnabled: true,
};

export function validateCareerSavePayload(raw: unknown): raw is CareerState {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<CareerState>;
  if (!obj.id || !obj.userClubId || !obj.clubs || !obj.players || !obj.competitions) {
    return false;
  }
  if (!obj.clubs[obj.userClubId] || !obj.tactics || !Array.isArray(obj.fixtures)) {
    return false;
  }
  return true;
}

export function migrateCareerSave(raw: CareerState): CareerState {
  const migratedPlayers: Record<string, Player> = {};
  for (const [id, player] of Object.entries(raw.players)) {
    const defaults = getDefaultSkillsForPlayer(player.primaryPosition, player.id);
    const hasSkill1Key = 'skill1' in player && (player.skill1 === null || Boolean(player.skill1 && SKILL_MAP[player.skill1]));
    const hasSkill2Key = 'skill2' in player && (player.skill2 === null || Boolean(player.skill2 && SKILL_MAP[player.skill2]));
    const skill1 = hasSkill1Key ? player.skill1 : defaults.skill1;
    let skill2 = hasSkill2Key ? player.skill2 : defaults.skill2;
    if (skill1 && skill2 && skill1 === skill2) {
      skill2 = null;
    }

    migratedPlayers[id] = {
      ...player,
      skill1,
      skill2,
      isSuperstar:
        typeof player.isSuperstar === 'boolean'
          ? player.isSuperstar
          : Boolean(player.isHistoricalRecord && player.overallRating >= 88),
    };
  }

  const migrated: CareerState = {
    ...raw,
    saveVersion: CURRENT_SAVE_VERSION,
    players: migratedPlayers,
    trainingFocus: raw.trainingFocus ?? 'Balanced',
    trainingReports: Array.isArray(raw.trainingReports) ? raw.trainingReports : [],
    seasonHistory: Array.isArray(raw.seasonHistory) ? raw.seasonHistory : [],
    objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
    news: Array.isArray(raw.news) ? raw.news : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    transfers: Array.isArray(raw.transfers) ? raw.transfers : [],
    isGeneratedSeason: Boolean(raw.isGeneratedSeason),
    seedCounter: typeof raw.seedCounter === 'number' ? raw.seedCounter : 1001,
  };
  return migrated;
}

export async function saveCareer(career: CareerState): Promise<CareerState> {
  const toSave: CareerState = {
    ...career,
    saveVersion: CURRENT_SAVE_VERSION,
    lastPlayedAt: new Date().toISOString(),
  };
  await idbPutCareer(toSave);
  await idbPutSetting('lastActiveCareerId', toSave.id);
  return toSave;
}

export async function loadCareer(careerId: string): Promise<CareerState | null> {
  const raw = await idbGetCareer<CareerState>(careerId);
  if (!raw || !validateCareerSavePayload(raw)) return null;
  const migrated = migrateCareerSave(raw);
  await idbPutSetting('lastActiveCareerId', migrated.id);
  return migrated;
}

export async function listCareerSaves(): Promise<SaveSummary[]> {
  const all = await idbGetAllCareers<CareerState>();
  return all
    .filter(validateCareerSavePayload)
    .map((c) => ({
      id: c.id,
      saveName: c.saveName,
      clubId: c.userClubId,
      clubName: c.clubs[c.userClubId]?.name ?? c.userClubId,
      currentSeason: c.currentSeason,
      currentMatchday: c.currentMatchday,
      managerName: c.manager.name,
      lastPlayedAt: c.lastPlayedAt,
      saveVersion: c.saveVersion || CURRENT_SAVE_VERSION,
    }))
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

export async function renameCareerSave(careerId: string, newName: string): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const career = await loadCareer(careerId);
  if (!career) return false;
  await idbPutCareer({ ...career, saveName: trimmed, lastPlayedAt: new Date().toISOString() });
  return true;
}

export async function deleteCareerSave(careerId: string): Promise<void> {
  await idbDeleteCareer(careerId);
  const lastId = await idbGetSetting<string>('lastActiveCareerId');
  if (lastId === careerId) {
    await idbPutSetting('lastActiveCareerId', null);
  }
}

export async function getLastActiveCareer(): Promise<CareerState | null> {
  const lastId = await idbGetSetting<string | null>('lastActiveCareerId');
  if (lastId) {
    const found = await loadCareer(lastId);
    if (found) return found;
  }
  const all = await listCareerSaves();
  if (all.length > 0) {
    return loadCareer(all[0].id);
  }
  return null;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await idbPutSetting('appSettings', settings);
}

export async function loadAppSettings(): Promise<AppSettings> {
  const stored = await idbGetSetting<Partial<AppSettings>>('appSettings');
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(stored ?? {}),
  };
}
