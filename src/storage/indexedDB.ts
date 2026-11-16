const DB_NAME = 'football_tycoon_db';
const DB_VERSION = 1;
const STORE_CAREERS = 'careers';
const STORE_SETTINGS = 'settings';

const memoryFallbackCareers = new Map<string, unknown>();
const memoryFallbackSettings = new Map<string, unknown>();

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CAREERS)) {
        db.createObjectStore(STORE_CAREERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function idbPutCareer<T extends { id: string }>(record: T): Promise<void> {
  if (!hasIndexedDB()) {
    memoryFallbackCareers.set(record.id, structuredClone(record));
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAREERS, 'readwrite');
    tx.objectStore(STORE_CAREERS).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save career'));
    };
  });
}

export async function idbGetCareer<T>(id: string): Promise<T | null> {
  if (!hasIndexedDB()) {
    const found = memoryFallbackCareers.get(id);
    return found ? (structuredClone(found) as T) : null;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAREERS, 'readonly');
    const req = tx.objectStore(STORE_CAREERS).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to load career'));
    };
  });
}

export async function idbGetAllCareers<T>(): Promise<T[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryFallbackCareers.values()).map((v) => structuredClone(v) as T);
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAREERS, 'readonly');
    const req = tx.objectStore(STORE_CAREERS).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to list careers'));
    };
  });
}

export async function idbDeleteCareer(id: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryFallbackCareers.delete(id);
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAREERS, 'readwrite');
    tx.objectStore(STORE_CAREERS).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to delete career'));
    };
  });
}

export async function idbPutSetting(key: string, value: unknown): Promise<void> {
  if (!hasIndexedDB()) {
    memoryFallbackSettings.set(key, value);
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save setting'));
    };
  });
}

export async function idbGetSetting<T>(key: string): Promise<T | null> {
  if (!hasIndexedDB()) {
    return (memoryFallbackSettings.get(key) as T | undefined) ?? null;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => {
      db.close();
      const row = req.result as { key: string; value: T } | undefined;
      resolve(row ? row.value : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to load setting'));
    };
  });
}

export function clearMemoryFallbackForTests(): void {
  memoryFallbackCareers.clear();
  memoryFallbackSettings.clear();
}
