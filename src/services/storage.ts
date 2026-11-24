import localforage from 'localforage';
import { Patient, Bed, PersonalTask, HistoriaClinicaPediatrica, RolGuardiasData } from '../types';
import { getActivityLogs, MAX_LOGS, ActivityLog } from './activityLogger';

// Create separate localforage instances for clinical domain tables
export const patientsStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'patients'
});

export const bedsStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'beds'
});

export const historiasStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'historias'
});

export const tasksStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'tasks'
});

export const draftsStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'drafts'
});

export const backupsStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'backups'
});

export const queueStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'offlineQueue'
});

export const guardiasStore = localforage.createInstance({
  name: 'HMI_ClinicalDB',
  storeName: 'guardias'
});

export interface StorageStatus {
  isPersisted: boolean;
  quotaMB: number;
  usageMB: number;
  supported: boolean;
}

/**
 * Request persistent browser storage using navigator.storage.persist()
 */
export async function requestStoragePersistence(): Promise<StorageStatus> {
  let isPersisted = false;
  let usageMB = 0;
  let quotaMB = 0;
  const supported = Boolean(typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist);

  try {
    if (supported) {
      isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        isPersisted = await navigator.storage.persist();
      }
    }

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      usageMB = Number(((estimate.usage || 0) / (1024 * 1024)).toFixed(2));
      quotaMB = Number(((estimate.quota || 0) / (1024 * 1024)).toFixed(2));
    }
  } catch (e) {
    console.warn('Persistent storage request error:', e);
  }

  return { isPersisted, quotaMB, usageMB, supported };
}

// Key for offline queue list in queueStore
const OFFLINE_QUEUE_KEY = 'hmi_offline_queue_list';

export async function getOfflineQueueFromIDB(): Promise<any[]> {
  try {
    const list = await queueStore.getItem<any[]>(OFFLINE_QUEUE_KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueueToIDB(queue: any[]): Promise<void> {
  try {
    await queueStore.setItem(OFFLINE_QUEUE_KEY, queue);
  } catch (e) {
    console.warn('Queue store error:', e);
  }
}

export async function clearOfflineQueueFromIDB(): Promise<void> {
  try {
    await queueStore.removeItem(OFFLINE_QUEUE_KEY);
  } catch (e) {
    console.warn('Clear queue error:', e);
  }
}

// Draft storage (Historia Clinica and Evolution Notes)
export async function getDraftFromIDB<T>(key: string): Promise<T | null> {
  try {
    return await draftsStore.getItem<T>(key);
  } catch {
    return null;
  }
}

export async function getDraftLastUpdated(key: string): Promise<string | null> {
  try {
    return await draftsStore.getItem<string>(`${key}_updated_at`);
  } catch {
    return null;
  }
}

let tutorialSandboxActive = false;

export function setTutorialSandboxStorageGuard(active: boolean): void {
  tutorialSandboxActive = active;
}

export async function saveDraftToIDB<T>(key: string, data: T): Promise<void> {
  if (tutorialSandboxActive || key.includes('tutorial-demo')) return;
  try {
    await draftsStore.setItem(key, data);
    await draftsStore.setItem(`${key}_updated_at`, new Date().toISOString());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hmi_draft_changed'));
    }
  } catch (e) {
    console.warn('Draft save error:', e);
  }
}

export async function removeDraftFromIDB(key: string): Promise<void> {
  if (tutorialSandboxActive || key.includes('tutorial-demo')) return;
  try {
    await draftsStore.removeItem(key);
    await draftsStore.removeItem(`${key}_updated_at`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hmi_draft_changed'));
    }
  } catch (e) {
    console.warn('Draft remove error:', e);
  }
}

export async function clearAllDraftsFromIDB(): Promise<void> {
  try {
    await draftsStore.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hmi_draft_changed'));
    }
  } catch (e) {
    console.warn('Draft clear all error:', e);
  }
}

// Patients store helpers
export async function getPatientsFromIDB(): Promise<Patient[]> {
  try {
    const data = await patientsStore.getItem<Patient[]>('all_patients');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function savePatientsToIDB(patients: Patient[]): Promise<void> {
  try {
    await patientsStore.setItem('all_patients', patients);
  } catch (e) {
    console.warn('Patients IDB save error:', e);
  }
}

// Beds store helpers
export async function getBedsFromIDB(): Promise<Bed[]> {
  try {
    const data = await bedsStore.getItem<Bed[]>('all_beds');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveBedsToIDB(beds: Bed[]): Promise<void> {
  try {
    await bedsStore.setItem('all_beds', beds);
  } catch (e) {
    console.warn('Beds IDB save error:', e);
  }
}

// Historias store helpers
export async function getHistoriasFromIDB(): Promise<HistoriaClinicaPediatrica[]> {
  try {
    const data = await historiasStore.getItem<HistoriaClinicaPediatrica[]>('all_historias');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveHistoriasToIDB(historias: HistoriaClinicaPediatrica[]): Promise<void> {
  try {
    await historiasStore.setItem('all_historias', historias);
  } catch (e) {
    console.warn('Historias IDB save error:', e);
  }
}

// Tasks store helpers
export async function getTasksFromIDB(): Promise<PersonalTask[]> {
  try {
    const data = await tasksStore.getItem<PersonalTask[]>('all_tasks');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveTasksToIDB(tasks: PersonalTask[]): Promise<void> {
  try {
    await tasksStore.setItem('all_tasks', tasks);
  } catch (e) {
    console.warn('Tasks IDB save error:', e);
  }
}

export const GUARDIAS_GROUP_COLORS = ['teal', 'cyan', 'amber', 'indigo', 'emerald', 'rose'] as const;

export const DEFAULT_ROL_GUARDIAS: RolGuardiasData = {
  mes: 'Noviembre 2026',
  anio: 2026,
  mesNumero: 11,
  hospital: 'Hospital Materno Infantil',
  servicio: 'Pediatría y Puericultura',
  grupos: [
    {
      id: 'grupo-1',
      nombreGrupo: 'Grupo I',
      color: 'teal',
      icon: '🌡️',
      areas: ['Triaje', 'Hospitalización / Observación'],
      miembros: [
        { id: 'g1-m1', nombre: 'Dra. Yelitza', rol: 'Médico de Guardia', area: 'Triaje' },
        { id: 'g1-m2', nombre: 'Dra. Yanerbys', rol: 'Médico de Guardia', area: 'Hospitalización / Observación' }
      ],
      diasDelMes: [6, 12, 18, 24, 30]
    },
    {
      id: 'grupo-2',
      nombreGrupo: 'Grupo II',
      color: 'cyan',
      icon: '💊',
      areas: ['Triaje', 'Hospitalización / Observación'],
      miembros: [
        { id: 'g2-m1', nombre: 'Dra. Mileidys', rol: 'Médico de Guardia', area: 'Triaje' },
        { id: 'g2-m2', nombre: 'Dra. Julia', rol: 'Médico de Guardia', area: 'Triaje' },
        { id: 'g2-m3', nombre: 'Dr. Brayan Guerrero', rol: 'Médico de Guardia', area: 'Hospitalización / Observación' }
      ],
      diasDelMes: [1, 7, 13, 19, 25]
    },
    {
      id: 'grupo-3',
      nombreGrupo: 'Grupo III',
      color: 'amber',
      icon: '🩺',
      areas: ['Triaje', 'Hospitalización / Observación / Sala de Parto / Quirófano'],
      miembros: [
        { id: 'g3-m1', nombre: 'Dra. Rismel', rol: 'Médico de Guardia', area: 'Triaje' },
        { id: 'g3-m2', nombre: 'Dra. Ana', rol: 'Médico de Guardia', area: 'Hospitalización / Observación / Sala de Parto / Quirófano' }
      ],
      diasDelMes: [2, 8, 14, 20, 26]
    },
    {
      id: 'grupo-4',
      nombreGrupo: 'Grupo IV',
      color: 'indigo',
      icon: '💉',
      areas: ['Sala de Parto / Quirófano', 'Guardia General'],
      miembros: [
        { id: 'g4-m1', nombre: 'Dr. Bacabú', rol: 'Médico de Guardia', area: 'Sala de Parto / Quirófano' },
        { id: 'g4-m2', nombre: 'Dra. Beatriz', rol: 'Médico de Guardia', area: 'Guardia General' }
      ],
      diasDelMes: [3, 9, 15, 21, 27]
    },
    {
      id: 'grupo-5',
      nombreGrupo: 'Grupo V',
      color: 'emerald',
      icon: '🧪',
      areas: ['Hospitalización / Observación', 'Guardia General'],
      miembros: [
        { id: 'g5-m1', nombre: 'Dra. Anzu', rol: 'Médico de Guardia', area: 'Hospitalización / Observación' },
        { id: 'g5-m2', nombre: 'Dra. Joselyn', rol: 'Médico de Guardia', area: 'Guardia General' }
      ],
      diasDelMes: [4, 10, 16, 22, 28]
    },
    {
      id: 'grupo-6',
      nombreGrupo: 'Grupo VI',
      color: 'rose',
      icon: '👶',
      areas: ['Control de Niño Sano / Nutrición', 'Hospitalización / Observación'],
      miembros: [
        { id: 'g6-m1', nombre: 'Dr. Armando', rol: 'Médico de Guardia', area: 'Control de Niño Sano / Nutrición' },
        { id: 'g6-m2', nombre: 'Dra. Nancy', rol: 'Médico de Guardia', area: 'Hospitalización / Observación' }
      ],
      diasDelMes: [5, 11, 17, 23, 29]
    }
  ],
  turnos: [],
  updatedAt: new Date().toISOString()
};

export function getGroupIcon(nombreGrupo: string): string {
  const clean = (nombreGrupo || '').toLowerCase();
  if (clean.includes('grupo i') || clean.includes('grupo 1') || clean.includes('g-i')) return '🌡️';
  if (clean.includes('grupo ii') || clean.includes('grupo 2') || clean.includes('g-ii')) return '💊';
  if (clean.includes('grupo iii') || clean.includes('grupo 3') || clean.includes('g-iii')) return '🩺';
  if (clean.includes('grupo iv') || clean.includes('grupo 4') || clean.includes('g-iv')) return '💉';
  if (clean.includes('grupo v') || clean.includes('grupo 5') || clean.includes('g-v')) return '🧪';
  if (clean.includes('grupo vi') || clean.includes('grupo 6') || clean.includes('g-vi')) return '👶';
  return '🏥';
}

function isLegacyDefaultGuardias(data: any): boolean {
  if (!data || !Array.isArray(data.grupos)) return false;
  if (data.grupos.length === 4) {
    const ids = new Set(data.grupos.map((g: any) => g?.id));
    if (ids.has('grp-a') && ids.has('grp-b') && ids.has('grp-c') && ids.has('grp-d')) {
      return true;
    }
  }
  return false;
}

export function normalizeGuardiasData(raw: any): RolGuardiasData {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.grupos)) {
    return DEFAULT_ROL_GUARDIAS;
  }
  if (isLegacyDefaultGuardias(raw)) {
    return DEFAULT_ROL_GUARDIAS;
  }

  return {
    mes: String(raw.mes || DEFAULT_ROL_GUARDIAS.mes),
    anio: Number(raw.anio) || 2026,
    mesNumero: Number(raw.mesNumero) || 11,
    hospital: String(raw.hospital || 'Hospital Materno Infantil'),
    servicio: String(raw.servicio || 'Pediatría y Puericultura'),
    grupos: raw.grupos.map((g: any, idx: number) => {
      const nombreGrp = String(g?.nombreGrupo || g?.nombre || g?.name || `Grupo ${idx + 1}`);
      const miembros = Array.isArray(g.miembros)
        ? g.miembros.map((m: any, mIdx: number) => ({
            id: String(m?.id || `g${idx + 1}-m${mIdx + 1}`),
            nombre: String(m?.nombre || m?.name || ''),
            rol: String(m?.rol || m?.role || 'Médico de Guardia'),
            area: String(m?.area || '')
          }))
        : [];
      const dias = Array.isArray(g.diasDelMes)
        ? g.diasDelMes.map((d: any) => Number(d)).filter((n: number) => !isNaN(n) && n >= 1 && n <= 31)
        : Array.isArray(g.dias)
        ? g.dias.map((d: any) => Number(d)).filter((n: number) => !isNaN(n) && n >= 1 && n <= 31)
        : [];
      const rawAreas = Array.isArray(g.areas) && g.areas.length > 0
        ? g.areas.map((a: any) => String(a))
        : Array.from(new Set(miembros.map((m: any) => m.area).filter(Boolean)));
      return {
        id: String(g?.id || `grupo-${idx + 1}`),
        nombreGrupo: nombreGrp,
        color: String(g?.color || GUARDIAS_GROUP_COLORS[idx % GUARDIAS_GROUP_COLORS.length]),
        icon: String(g?.icon || getGroupIcon(nombreGrp)),
        jefeGuardia: g?.jefeGuardia ? String(g.jefeGuardia) : undefined,
        areas: rawAreas,
        miembros,
        diasDelMes: Array.from(new Set<number>(dias)).sort((a, b) => a - b)
      };
    }),
    turnos: Array.isArray(raw.turnos) ? raw.turnos : [],
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };
}

export async function getGuardiasFromIDB(): Promise<RolGuardiasData> {
  try {
    const data = await guardiasStore.getItem<RolGuardiasData>('rol_guardias_actual');
    if (data && Array.isArray(data.grupos)) {
      if (isLegacyDefaultGuardias(data)) {
        await saveGuardiasToIDB(DEFAULT_ROL_GUARDIAS);
        return DEFAULT_ROL_GUARDIAS;
      }
      return normalizeGuardiasData(data);
    }
  } catch {}
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('hmi_rol_guardias_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.grupos)) {
          if (isLegacyDefaultGuardias(parsed)) {
            await saveGuardiasToIDB(DEFAULT_ROL_GUARDIAS);
            return DEFAULT_ROL_GUARDIAS;
          }
          return normalizeGuardiasData(parsed);
        }
      }
    } catch {}
  }
  return DEFAULT_ROL_GUARDIAS;
}

export async function saveGuardiasToIDB(data: RolGuardiasData): Promise<void> {
  const payload: RolGuardiasData = {
    ...normalizeGuardiasData(data),
    updatedAt: new Date().toISOString()
  };
  try {
    await guardiasStore.setItem('rol_guardias_actual', payload);
  } catch (e) {
    console.warn('Guardias IDB save error:', e);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hmi_rol_guardias_v1', JSON.stringify(payload));
      window.dispatchEvent(new Event('hmi_guardias_changed'));
    } catch {}
  }
}

// Auto Backup Engine & Snapshots
export interface BackupSnapshot {
  id: string;
  timestamp: string;
  patientsCount: number;
  bedsCount: number;
  historiasCount: number;
  tasksCount: number;
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  note?: string;
}

export async function saveAutoBackupSnapshot(data: {
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  note?: string;
}): Promise<BackupSnapshot> {
  const snapshot: BackupSnapshot = {
    id: 'backup-' + Date.now(),
    timestamp: new Date().toISOString(),
    patientsCount: data.patients.length,
    bedsCount: data.beds.length,
    historiasCount: data.historias.length,
    tasksCount: data.tasks.length,
    patients: data.patients,
    beds: data.beds,
    historias: data.historias,
    tasks: data.tasks,
    note: data.note || 'Copia de seguridad automática local (IndexedDB)'
  };

  try {
    const existing = (await backupsStore.getItem<BackupSnapshot[]>('snapshots')) || [];
    // Keep max 10 auto-backup snapshots in localForage
    const updated = [snapshot, ...existing.filter(s => s && s.id)].slice(0, 10);
    await backupsStore.setItem('snapshots', updated);
    await backupsStore.setItem('last_auto_backup_timestamp', snapshot.timestamp);
  } catch (e) {
    console.warn('Error saving auto-backup snapshot:', e);
  }

  return snapshot;
}

export async function getAutoBackupsList(): Promise<BackupSnapshot[]> {
  try {
    const snapshots = await backupsStore.getItem<BackupSnapshot[]>('snapshots');
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

export async function getLastAutoBackupTime(): Promise<string | null> {
  try {
    return await backupsStore.getItem<string>('last_auto_backup_timestamp');
  } catch {
    return null;
  }
}

export interface LatestBackupRecord {
  filename: string;
  timestamp: string;
  data: {
    patients: Patient[];
    beds: Bed[];
    historias: HistoriaClinicaPediatrica[];
    tasks: PersonalTask[];
  };
}

export async function saveLatestExportedBackup(filename: string, data: {
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
}): Promise<void> {
  try {
    const record = {
      filename,
      timestamp: new Date().toISOString(),
      data
    };
    await backupsStore.setItem('latest_exported_backup', record);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('historia_latest_db_backup', JSON.stringify(record));
      } catch (e) {
        console.warn('localStorage save backup error:', e);
      }
    }
  } catch (e) {
    console.warn('Error saving latest exported backup:', e);
  }
}

export async function getLatestExportedBackup(): Promise<LatestBackupRecord | null> {
  try {
    const record = await backupsStore.getItem<LatestBackupRecord>('latest_exported_backup');
    if (record && record.data && Array.isArray(record.data.patients) && record.data.patients.length > 0) {
      return record;
    }
  } catch {
    // fallback to localStorage
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('historia_latest_db_backup');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Array.isArray(parsed.data.patients)) {
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

// File System Access Directory Handle Storage
const FS_DB_NAME = 'HMI_FileSystemDB';
const FS_STORE_NAME = 'handles';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not available'));
    }
    const request = indexedDB.open(FS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(FS_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeDirectoryHandle(handle: any): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(FS_STORE_NAME, 'readwrite');
    tx.objectStore(FS_STORE_NAME).put(handle, 'downloads_dir');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Could not store directory handle:', e);
  }
}

export async function getStoredDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(FS_STORE_NAME, 'readonly');
    const req = tx.objectStore(FS_STORE_NAME).get('downloads_dir');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(FS_STORE_NAME, 'readwrite');
    tx.objectStore(FS_STORE_NAME).delete('downloads_dir');
  } catch (e) {
    console.warn('Could not clear stored directory handle:', e);
  }
}

export async function findLatestBackupInDirectory(dirHandle: any, allowRequestPermission: boolean = false): Promise<{ file: File; name: string; content: string } | null> {
  try {
    if (!dirHandle) return null;

    if (typeof dirHandle.queryPermission === 'function') {
      try {
        let perm = await dirHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
          if (!allowRequestPermission) {
            // Do not prompt the user automatically in background to avoid annoying browser permission dialogs
            return null;
          }
          try {
            perm = await dirHandle.requestPermission({ mode: 'read' });
          } catch (e) {
            return null;
          }
        }
        if (perm !== 'granted') return null;
      } catch (e) {
        return null;
      }
    }

    let newestFile: File | null = null;
    let newestName = '';
    let newestTime = 0;

    if (typeof dirHandle.entries === 'function') {
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const lower = name.toLowerCase();
          if (lower.endsWith('.json') && (
            lower.includes('backup') || 
            lower.includes('hmi') || 
            lower.includes('pediatria') || 
            lower.includes('pacientes') || 
            lower.includes('basededatos')
          )) {
            try {
              const file: File = await handle.getFile();
              let fileTime = file.lastModified;

              // Parse date from filename e.g. Backup_HMI_Pediatria_2026-11-07T21-34-51.json or HMI_BaseDeDatos_Pacientes_2026-11-07_12-58-39.json
              const match = name.match(/(\d{4}[-_]\d{2}[-_]\d{2}[T_]\d{2}[-_:]\d{2}[-_:]\d{2})/);
              if (match) {
                const normalized = match[1]
                  .replace(/_/g, 'T')
                  .replace(/T(\d{2})[-_](\d{2})[-_](\d{2})/, 'T$1:$2:$3');
                const t = Date.parse(normalized);
                if (!isNaN(t) && t > fileTime) {
                  fileTime = t;
                }
              }

              if (fileTime > newestTime) {
                newestTime = fileTime;
                newestFile = file;
                newestName = name;
              }
            } catch (err) {
              console.warn('Error reading file handle in directory:', name, err);
            }
          }
        }
      }
    }

    if (newestFile) {
      const content = await newestFile.text();
      return { file: newestFile, name: newestName, content };
    }
    return null;
  } catch (err) {
    console.warn('findLatestBackupInDirectory error:', err);
    return null;
  }
}

export async function pickAndStoreDownloadsDirectory(): Promise<{
  success: boolean;
  handle?: any;
  latestBackup?: { file: File; name: string; content: string } | null;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return { success: false, error: 'File System Access API no está disponible en este navegador.' };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      id: 'hmi_downloads_folder',
      mode: 'read',
      startIn: 'downloads'
    });

    await storeDirectoryHandle(handle);
    const latestBackup = await findLatestBackupInDirectory(handle, true);

    return {
      success: true,
      handle,
      latestBackup
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Operación cancelada por el usuario.' };
    }
    return { success: false, error: err.message || 'Error al seleccionar la carpeta.' };
  }
}

// JSON Backup File Export & Import (Manual Backup)
export async function downloadBackupJSON(data: {
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  guardias?: RolGuardiasData;
  activityLogs?: ActivityLog[];
}): Promise<{ success: boolean; method: 'filesystem' | 'download'; filename: string }> {
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `Backup_HMI_Pediatria_${timestampStr}.json`;

  const todayDateStr = now.toISOString().split('T')[0];
  const enrichedPatients = data.patients.map(p => {
    const evs = Array.isArray(p.evolutions) ? p.evolutions : [];
    const latestEv = evs[0];
    const evolucionadoHoy = Boolean(p.evolucionadoHoy) || evs.some(e => e && e.date === todayDateStr);
    return {
      ...p,
      evolucionadoHoy,
      ultimaEvolucionFecha: latestEv?.date || p.ultimaEvolucionFecha || null,
      fechaUltimaEvolucion: latestEv?.date || p.admissionDate || null,
      horaUltimaEvolucion: latestEv?.time || p.admissionTime || null,
      medicoUltimaEvolucion: latestEv?.doctorName || p.doctorInCharge || null,
      totalEvoluciones: evs.length,
      evolutions: evs,
      dischargeSummary: p.dischargeSummary || null
    };
  });

  const guardiasData = data.guardias || (await getGuardiasFromIDB());
  const logsSnapshot = (data.activityLogs || getActivityLogs()).slice(0, MAX_LOGS);

  const payload = {
    appName: 'Hospital Materno Infantil Sistema de gestion de pacientes hospitalizados.',
    exportVersion: '2.7',
    exportDate: now.toISOString(),
    stats: {
      totalPatients: data.patients.length,
      hospitalizedPatients: data.patients.filter(p => p.status === 'hospitalized').length,
      dischargedPatients: data.patients.filter(p => p.status === 'discharged').length,
      evolucionadosHoyCount: enrichedPatients.filter(p => p.status === 'hospitalized' && p.evolucionadoHoy).length,
      pendientesEvolucionHoyCount: enrichedPatients.filter(p => p.status === 'hospitalized' && !p.evolucionadoHoy).length,
      totalBeds: data.beds.length,
      totalHistorias: data.historias.length,
      totalTasks: data.tasks.length,
      guardiasGrupos: guardiasData.grupos?.length || 0,
      activityLogsCount: logsSnapshot.length,
      insertLogsCount: logsSnapshot.filter(l => l.action === 'INSERT').length
    },
    data: {
      patients: enrichedPatients,
      beds: data.beds,
      historias: data.historias,
      tasks: data.tasks,
      guardias: guardiasData,
      activityLogs: logsSnapshot
    }
  };

  const jsonStr = JSON.stringify(payload, null, 2);

  try {
    let dirHandle = await getStoredDirectoryHandle();

    if (dirHandle) {
      if (typeof dirHandle.queryPermission === 'function') {
        let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          perm = await dirHandle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          dirHandle = null;
        }
      }
    }

    if (dirHandle && typeof dirHandle.getFileHandle === 'function') {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();

      await saveAutoBackupSnapshot({
        patients: data.patients,
        beds: data.beds,
        historias: data.historias,
        tasks: data.tasks,
        note: `Exportado automáticamente a carpeta vinculada (${filename})`
      });
      await saveLatestExportedBackup(filename, data);

      return { success: true, method: 'filesystem', filename };
    }
  } catch (err) {
    console.warn('File System Access write error:', err);
  }

  // Browser Blob download fallback
  try {
    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      await saveAutoBackupSnapshot({
        patients: data.patients,
        beds: data.beds,
        historias: data.historias,
        tasks: data.tasks,
        note: `Descarga manual JSON (${filename})`
      });
      await saveLatestExportedBackup(filename, data);

      return { success: true, method: 'download', filename };
    }
  } catch (err) {
    console.warn('Blob download fallback error:', err);
  }

  return { success: false, method: 'download', filename: '' };
}

export function parseBackupJSON(jsonContent: string): {
  valid: boolean;
  error?: string;
  data?: {
    patients: Patient[];
    beds: Bed[];
    historias: HistoriaClinicaPediatrica[];
    tasks: PersonalTask[];
    guardias?: RolGuardiasData;
    activityLogs?: ActivityLog[];
  };
} {
  try {
    const parsed = JSON.parse(jsonContent);
    const contentData = parsed.data || parsed.tables || parsed;

    if (!contentData || typeof contentData !== 'object') {
      return { valid: false, error: 'El archivo JSON no posee una estructura de respaldo médica válida.' };
    }

    const patients = Array.isArray(contentData.patients) ? contentData.patients : [];
    const beds = Array.isArray(contentData.beds) ? contentData.beds : [];
    const historias = Array.isArray(contentData.historias) ? contentData.historias : [];
    const tasks = Array.isArray(contentData.tasks) ? contentData.tasks : [];
    const guardias = contentData.guardias && typeof contentData.guardias === 'object' ? contentData.guardias : undefined;
    const activityLogs = Array.isArray(contentData.activityLogs) ? contentData.activityLogs.slice(0, MAX_LOGS) : undefined;

    if (patients.length === 0 && beds.length === 0 && historias.length === 0 && !guardias && !activityLogs) {
      return { valid: false, error: 'El archivo JSON está vacío o no contiene registros válidos de pacientes.' };
    }

    return {
      valid: true,
      data: { patients, beds, historias, tasks, guardias, activityLogs }
    };
  } catch (e: any) {
    return { valid: false, error: 'Error al interpretar el archivo JSON: ' + (e.message || 'Formato corrupto') };
  }
}

export async function clearAllDatabaseMemoryFromIDB(): Promise<void> {
  try {
    await patientsStore.clear();
    await bedsStore.clear();
    await historiasStore.clear();
    await tasksStore.clear();
    await backupsStore.clear();
    await draftsStore.clear();
    await queueStore.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('latest_backup_meta');
      localStorage.removeItem('hmi_auto_backups_list');
      localStorage.removeItem('auto_export_always');
    }
  } catch (e) {
    console.warn('Error clearing all database memory:', e);
  }
}

