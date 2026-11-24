import { Patient, Bed, PersonalTask, HistoriaClinicaPediatrica, HospitalArea, MedicalEvolution, RolGuardiasData } from '../types';
import {
  resolveCanonicalPresenceKey,
  type UserPresenceRecord,
} from '../utils/userPresence';
import {
  applyRemoteAdminPasswordIfNewer,
  ADMIN_MASTER_PASSWORD_STORAGE_KEY,
  ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY,
} from '../utils/adminAuth';
import { syncDynamicPwaIcons } from '../utils/dynamicPwaIconSync';
import { INITIAL_BEDS } from '../data/initialData';
import {
  supabase,
  fetchPatientsFromSupabase,
  savePatientToSupabase,
  savePatientsBatchToSupabase,
  deletePatientFromSupabase,
  saveEvolutionToSupabase,
  saveEvolutionsBatchToSupabase,
  deleteEvolutionFromSupabase,
  fetchBedsFromSupabase,
  saveBedsToSupabase,
  fetchHistoriasFromSupabase,
  saveHistoriaToSupabase,
  saveHistoriasBatchToSupabase,
  fetchHistoriaByIdFromSupabase,
  deleteHistoriaFromSupabase,
  fetchTasksFromSupabase,
  saveTaskToSupabase,
  saveTasksToSupabase,
  deleteTaskFromSupabase,
  fetchGuardiasFromSupabase,
  saveGuardiasToSupabase,
  GUARDIAS_CONFIG_KEY,
  subscribeToSupabaseRealtime,
  upsertUserProfile,
  fetchPatientsMetaFromSupabase,
  savePatientsMetaToSupabase,
  PatientClinicalMetaEntry,
  fetchMaintenanceFromSupabase,
  saveMaintenanceToSupabase,
  MaintenanceConfig,
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_CONFIG_KEY,
  fetchAmbientSoundFromSupabase,
  saveAmbientSoundToSupabase,
  AMBIENT_SOUND_CONFIG_KEY,
  AmbientSoundSupabaseConfig,
  PANEL_CONTROL_CONFIG_KEY,
  PanelControlSupabaseConfig,
  fetchPanelControlFromSupabase,
  savePanelControlToSupabase,
  FULL_BACKUP_CONFIG_KEY,
  FullDatabaseBackupPayload,
  fetchFullDatabaseBackupFromSupabase,
  saveFullDatabaseBackupToSupabase,
  normalizePatientFromAny,
  normalizeEvolutionFromAny,
  normalizeBedFromAny,
  normalizeHistoriaFromAny,
  normalizeTaskFromAny,
  saveActivityLogsToSupabase
} from '../lib/supabase';
import { logDatabaseActivity, sanitizeSnapshotForLog, ActivityLog, importActivityLogs } from './activityLogger';
import { 
  getPatientsFromIDB, 
  savePatientsToIDB, 
  getBedsFromIDB, 
  saveBedsToIDB, 
  getHistoriasFromIDB, 
  saveHistoriasToIDB, 
  getTasksFromIDB, 
  saveTasksToIDB,
  getOfflineQueueFromIDB,
  saveOfflineQueueToIDB,
  getGuardiasFromIDB,
  saveGuardiasToIDB,
  normalizeGuardiasData,
  getAutoBackupsList,
  draftsStore,
  backupsStore
} from './storage';
import {
  isValidSeasonalStyle,
  saveSeasonalOverlayConfig,
  readSeasonalOverlayConfig
} from '../components/SeasonalOverlay';
import {
  SEASONAL_AUTO_VE_STORAGE_KEY,
  SEASONAL_AUTO_NIGHT_STORAGE_KEY,
  isSeasonalAutoVenezuelaEnabled,
  isSeasonalAutoNightEnabled,
  detectVenezuelaCalendarStyle
} from '../utils/seasonalTheme';
import {
  pickLatestPanelControl,
  buildNextPanelControlState,
  parseConfigTimestampMs
} from '../utils/panelControlSync';

function broadcastClinicalRealtime(type: string, payload: any): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel('hmi_clinical_realtime');
    ch.postMessage({ type, payload });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

// ==========================================
// OFFLINE QUEUE STRUCTURE & HELPERS
// ==========================================

export interface OfflineQueueItem {
  id: string;
  type: 
    | 'PATIENT_UPSERT' 
    | 'PATIENTS_BATCH' 
    | 'EVOLUTION_ADD' 
    | 'PATIENT_DELETE' 
    | 'BEDS_UPSERT' 
    | 'HISTORIA_UPSERT' 
    | 'HISTORIA_DELETE' 
    | 'TASKS_UPSERT' 
    | 'TASK_DELETE'
    | 'GUARDIAS_UPSERT';
  data: any;
  timestamp: string;
}

export async function enqueueOfflineAction(action: Omit<OfflineQueueItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const queue = await getOfflineQueueFromIDB();
    const item: OfflineQueueItem = {
      ...action,
      id: 'queue-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString()
    };
    queue.push(item);
    await saveOfflineQueueToIDB(queue);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hmi_queue_changed'));
    }
  } catch (err) {
    console.warn('Error enqueuing offline action:', err);
  }
}

function mergeEvolutionLists(lists: Array<MedicalEvolution[] | undefined>): MedicalEvolution[] {
  const byId = new Map<string, MedicalEvolution>();
  const all = lists.flatMap(list => (Array.isArray(list) ? list : []));
  for (const ev of all) {
    if (!ev || !ev.id) continue;
    const prev = byId.get(ev.id);
    if (!prev) {
      byId.set(ev.id, { ...ev, evolvedInDay: ev.evolvedInDay ?? true });
    } else {
      const prevTs = prev.createdAt || '';
      const nextTs = ev.createdAt || '';
      if (nextTs >= prevTs) {
        byId.set(ev.id, { ...prev, ...ev, evolvedInDay: ev.evolvedInDay ?? prev.evolvedInDay ?? true });
      }
    }
  }
  const byDate = new Map<string, MedicalEvolution>();
  const noDate: MedicalEvolution[] = [];
  for (const ev of byId.values()) {
    if (!ev.date) {
      noDate.push(ev);
      continue;
    }
    const existing = byDate.get(ev.date);
    if (!existing) {
      byDate.set(ev.date, ev);
    } else {
      const exKey = `${existing.time || ''}#${existing.createdAt || ''}`;
      const evKey = `${ev.time || ''}#${ev.createdAt || ''}`;
      if (evKey >= exKey) {
        byDate.set(ev.date, ev);
      }
    }
  }
  return [...byDate.values(), ...noDate].sort((a, b) => {
    const da = `${a.date || ''}T${a.time || '00:00'}`;
    const db = `${b.date || ''}T${b.time || '00:00'}`;
    return db.localeCompare(da);
  });
}

function mergePatientsWithLocalAndQueue(
  serverPatients: Patient[],
  cachedPatients: Patient[],
  queue: OfflineQueueItem[],
  remoteMeta: Record<string, PatientClinicalMetaEntry> = {}
): Patient[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const deletedIds = new Set<string>();
  const queuedPatients = new Map<string, Patient>();
  const queuedEvolutions = new Map<string, MedicalEvolution[]>();

  for (const item of queue) {
    if (item.type === 'PATIENT_DELETE' && item.data?.id) {
      deletedIds.add(item.data.id);
    } else if (item.type === 'PATIENT_UPSERT' && item.data?.id) {
      queuedPatients.set(item.data.id, item.data as Patient);
    } else if (item.type === 'PATIENTS_BATCH' && Array.isArray(item.data)) {
      for (const p of item.data as Patient[]) {
        if (p?.id) queuedPatients.set(p.id, p);
      }
    } else if (item.type === 'EVOLUTION_ADD' && item.data?.patientId) {
      const pid = item.data.patientId as string;
      if (item.data.patient) {
        queuedPatients.set(pid, item.data.patient as Patient);
      }
      if (item.data.evolution) {
        const arr = queuedEvolutions.get(pid) || [];
        arr.push(item.data.evolution as MedicalEvolution);
        queuedEvolutions.set(pid, arr);
      }
    }
  }

  const cachedMap = new Map<string, Patient>(cachedPatients.map(p => [p.id, p]));
  const serverMap = new Map<string, Patient>(serverPatients.map(p => [p.id, p]));
  const allIds = new Set<string>([
    ...serverPatients.map(p => p.id),
    ...cachedPatients.map(p => p.id),
    ...queuedPatients.keys()
  ]);

  const merged: Patient[] = [];
  for (const id of allIds) {
    if (deletedIds.has(id)) continue;
    const srv = serverMap.get(id);
    const loc = cachedMap.get(id);
    const qp = queuedPatients.get(id);
    const meta = remoteMeta[id];

    // Prefer newest base (or queued patient if pending sync)
    let base: Patient;
    if (qp) {
      base = { ...(srv || {}), ...(meta || {}), ...(loc || {}), ...qp };
    } else if (srv && loc) {
      const srvNewer = (srv.updatedAt || '') >= (loc.updatedAt || '');
      base = srvNewer ? { ...loc, ...srv } : { ...srv, ...loc };
      // Always preserve client-only fields that Supabase patients table does not store directly
      base.dischargeDate = loc.dischargeDate || meta?.dischargeDate || srv.dischargeDate;
      base.dischargeTime = loc.dischargeTime || meta?.dischargeTime || srv.dischargeTime;
      base.dischargeReason = loc.dischargeReason || meta?.dischargeReason || srv.dischargeReason;
      base.dischargeSummary = loc.dischargeSummary || srv.dischargeSummary;
      base.historiaClinicaId = loc.historiaClinicaId || meta?.historiaClinicaId || srv.historiaClinicaId;
      base.previousHistoriaIds = (loc.previousHistoriaIds && loc.previousHistoriaIds.length > 0)
        ? loc.previousHistoriaIds
        : (meta?.previousHistoriaIds || srv.previousHistoriaIds);
      base.isReingreso = loc.isReingreso ?? meta?.isReingreso ?? srv.isReingreso;
      base.readmissionMode = loc.readmissionMode ?? meta?.readmissionMode ?? srv.readmissionMode;
      base.readmissionCount = loc.readmissionCount ?? meta?.readmissionCount ?? srv.readmissionCount;
      base.lastReadmissionDate = loc.lastReadmissionDate || meta?.lastReadmissionDate || srv.lastReadmissionDate;
      base.readmissions = (loc.readmissions && loc.readmissions.length > 0)
        ? loc.readmissions
        : (meta?.readmissions || srv.readmissions);
      base.dischargeHistory = (loc.dischargeHistory && loc.dischargeHistory.length > 0)
        ? loc.dischargeHistory
        : (meta?.dischargeHistory || srv.dischargeHistory);
      base.ordenesMedicas = (loc.ordenesMedicas && loc.ordenesMedicas.length > 0) ? loc.ordenesMedicas : srv.ordenesMedicas;
      base.ordenesFecha = loc.ordenesFecha || srv.ordenesFecha;
      base.ordenesHora = loc.ordenesHora || srv.ordenesHora;
      base.ordenesPeso = loc.ordenesPeso || srv.ordenesPeso;
      base.resumenesEvolutivos = (loc.resumenesEvolutivos && loc.resumenesEvolutivos.length > 0) ? loc.resumenesEvolutivos : srv.resumenesEvolutivos;
    } else {
      const raw = (srv || loc || qp)!;
      base = meta ? {
        ...raw,
        historiaClinicaId: raw.historiaClinicaId || meta.historiaClinicaId,
        previousHistoriaIds: raw.previousHistoriaIds?.length ? raw.previousHistoriaIds : meta.previousHistoriaIds,
        isReingreso: raw.isReingreso ?? meta.isReingreso,
        readmissionMode: raw.readmissionMode ?? meta.readmissionMode,
        readmissionCount: raw.readmissionCount ?? meta.readmissionCount,
        lastReadmissionDate: raw.lastReadmissionDate || meta.lastReadmissionDate,
        readmissions: raw.readmissions?.length ? raw.readmissions : meta.readmissions,
        dischargeDate: raw.dischargeDate || meta.dischargeDate,
        dischargeTime: raw.dischargeTime || meta.dischargeTime,
        dischargeReason: raw.dischargeReason || meta.dischargeReason,
        dischargeHistory: raw.dischargeHistory?.length ? raw.dischargeHistory : meta.dischargeHistory,
      } : raw;
    }

    const combinedEvolutions = mergeEvolutionLists([
      queuedEvolutions.get(id),
      qp?.evolutions,
      loc?.evolutions,
      srv?.evolutions
    ]);

    const evolvedTodayByList = combinedEvolutions.some(e => e.date === todayStr);
    const evolvedTodayFlag = Boolean(
      evolvedTodayByList ||
      (base.evolucionadoHoy && base.ultimaEvolucionFecha === todayStr) ||
      (loc?.evolucionadoHoy && loc?.ultimaEvolucionFecha === todayStr)
    );

    merged.push({
      ...base,
      evolutions: combinedEvolutions,
      evolucionadoHoy: evolvedTodayFlag,
      ultimaEvolucionFecha: combinedEvolutions[0]?.date || base.ultimaEvolucionFecha
    });
  }

  return merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function mergeByUpdatedAt<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  primary: T[],
  secondary: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of secondary) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of primary) {
    if (!item?.id) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const prevTs = prev.updatedAt || prev.createdAt || '';
      const nextTs = item.updatedAt || item.createdAt || '';
      map.set(item.id, nextTs >= prevTs ? { ...prev, ...item } : { ...item, ...prev });
    }
  }
  return Array.from(map.values());
}

// ==========================================
// 1. INITIAL LOAD & SYNCHRONIZATION
// ==========================================

export async function syncAndRebuildLocalMemory(): Promise<{
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  guardias: RolGuardiasData;
}> {
  // Always load from local IndexedDB first to guarantee instant offline startup
  const [cachedPatients, cachedBeds, cachedHistorias, cachedTasks, cachedGuardias] = await Promise.all([
    getPatientsFromIDB(),
    getBedsFromIDB(),
    getHistoriasFromIDB(),
    getTasksFromIDB(),
    getGuardiasFromIDB()
  ]);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      patients: cachedPatients,
      beds: cachedBeds.length > 0 ? cachedBeds : INITIAL_BEDS,
      historias: cachedHistorias,
      tasks: cachedTasks,
      guardias: cachedGuardias
    };
  }

  try {
    // Flush any pending offline queue items BEFORE reading from Supabase so offline edits are never overwritten
    await syncOfflineQueue().catch(() => {});
    const remainingQueue = await getOfflineQueueFromIDB();

    // Attempt online fetch from Supabase (live tables + v3.2.0 full backup + panel control)
    const [
      serverPatients,
      beds,
      historias,
      tasks,
      serverGuardias,
      remoteMeta,
      fullBackupRes,
      remotePanelControl
    ] = await Promise.all([
      fetchPatientsFromSupabase(),
      fetchBedsFromSupabase(),
      fetchHistoriasFromSupabase(),
      fetchTasksFromSupabase(),
      fetchGuardiasFromSupabase(GUARDIAS_CONFIG_KEY),
      fetchPatientsMetaFromSupabase(),
      fetchFullDatabaseBackupFromSupabase(),
      fetchPanelControlFromSupabase()
    ]);

    // Check if v3.2.0 full backup should be hydrated (newer backup or empty local/live tables)
    let backupPatients: Patient[] = [];
    let backupBeds: Bed[] = [];
    let backupHistorias: HistoriaClinicaPediatrica[] = [];
    let backupTasks: PersonalTask[] = [];
    let backupGuardias: RolGuardiasData | null = null;
    let backupMeta: Record<string, PatientClinicalMetaEntry> = {};

    const lastAppliedBackupAt =
      typeof window !== 'undefined' ? (localStorage.getItem(FULL_BACKUP_APPLIED_AT_KEY) || '') : '';
    const backupEffectiveTs = fullBackupRes?.updatedAt || fullBackupRes?.payload?.timestamp || '';
    const isBackupNewer = Boolean(backupEffectiveTs && backupEffectiveTs > lastAppliedBackupAt);
    const isLocalSparse = cachedPatients.length === 0 || cachedHistorias.length === 0;
    const shouldHydrateBackup = Boolean(fullBackupRes?.payload && (isBackupNewer || isLocalSparse || serverPatients.length === 0));

    if (fullBackupRes?.payload) {
      const normalizedBackup = extractNormalizedDataFromBackup(fullBackupRes.payload);
      backupPatients = normalizedBackup.patients;
      backupBeds = normalizedBackup.beds;
      backupHistorias = normalizedBackup.historias;
      backupTasks = normalizedBackup.tasks;
      backupGuardias = normalizedBackup.guardias;
      backupMeta = normalizedBackup.patientsMeta;

      if (shouldHydrateBackup) {
        await hydrateSideStoresFromBackup(fullBackupRes.payload);
      }
    }

    // Apply Panel Control configurations cleanly: pick whichever is newer between app_panel_control and hmi_database_backup_full.panelControl
    const backupPanel = fullBackupRes?.payload?.panelControl;
    const panelTs = remotePanelControl?.updatedAt || '';
    const backupPanelTs = backupPanel?.updatedAt || backupEffectiveTs || '';

    if (remotePanelControl && (!backupPanel || panelTs >= backupPanelTs)) {
      applyPanelControlSettingsLocally(remotePanelControl);
    } else if (backupPanel) {
      applyPanelControlSettingsLocally({ ...backupPanel, updatedAt: backupPanelTs });
    } else if (remotePanelControl) {
      applyPanelControlSettingsLocally(remotePanelControl);
    }

    // Combine serverPatients + backupPatients cleanly (preserving both hospitalized and discharged patients and recent evolutions)
    const combinedMeta: Record<string, PatientClinicalMetaEntry> = {
      ...backupMeta,
      ...remoteMeta,
    };

    const effectiveServerPatients =
      backupPatients.length > 0
        ? mergePatientsWithLocalAndQueue(serverPatients, backupPatients, [], combinedMeta)
        : serverPatients;

    const mergedPatients =
      effectiveServerPatients && effectiveServerPatients.length > 0
        ? mergePatientsWithLocalAndQueue(effectiveServerPatients, cachedPatients, remainingQueue, combinedMeta)
        : cachedPatients;

    if (mergedPatients.length > 0) {
      await savePatientsToIDB(mergedPatients);
    }

    // If backup had patients/evolutions missing from live Supabase tables, seed them gently in background
    if (shouldHydrateBackup && backupPatients.length > 0) {
      const liveIds = new Set(serverPatients.map(p => p.id));
      const missingPatients = backupPatients.filter(p => !liveIds.has(p.id));
      if (missingPatients.length > 0) {
        savePatientsBatchToSupabase(missingPatients).catch(() => {});
        const missingEvs = missingPatients.flatMap(p => p.evolutions || []);
        if (missingEvs.length > 0) {
          saveEvolutionsBatchToSupabase(missingEvs).catch(() => {});
        }
        savePatientsMetaToSupabase(mergedPatients).catch(() => {});
      }
    }

    const hasPendingBeds = remainingQueue.some(q => q.type === 'BEDS_UPSERT');
    let finalBeds = (!hasPendingBeds && beds && beds.length > 0)
      ? beds
      : (cachedBeds.length > 0 ? cachedBeds : INITIAL_BEDS);
    if (!hasPendingBeds && backupBeds.length > 0) {
      finalBeds = mergeByUpdatedAt(beds || [], backupBeds);
    }
    if (!hasPendingBeds && finalBeds.length > 0) {
      await saveBedsToIDB(finalBeds);
    }

    const hasPendingHistorias = remainingQueue.some(q => q.type === 'HISTORIA_UPSERT' || q.type === 'HISTORIA_DELETE');
    let finalHistorias = (!hasPendingHistorias && historias && historias.length > 0)
      ? historias
      : cachedHistorias;
    if (!hasPendingHistorias && backupHistorias.length > 0) {
      finalHistorias = mergeByUpdatedAt(historias || [], backupHistorias);
      if (shouldHydrateBackup) {
        const liveHistIds = new Set((historias || []).map(h => h.id));
        const missingHist = backupHistorias.filter(h => !liveHistIds.has(h.id));
        if (missingHist.length > 0) {
          saveHistoriasBatchToSupabase(missingHist).catch(() => {});
        }
      }
    }
    if (!hasPendingHistorias && finalHistorias.length > 0) {
      await saveHistoriasToIDB(finalHistorias);
    }

    const hasPendingTasks = remainingQueue.some(q => q.type === 'TASKS_UPSERT' || q.type === 'TASK_DELETE');
    let finalTasks = (!hasPendingTasks && tasks && tasks.length > 0)
      ? tasks
      : cachedTasks;
    if (!hasPendingTasks && backupTasks.length > 0) {
      finalTasks = mergeByUpdatedAt(tasks || [], backupTasks);
      if (shouldHydrateBackup) {
        const liveTaskIds = new Set((tasks || []).map(t => t.id));
        const missingTasks = backupTasks.filter(t => !liveTaskIds.has(t.id));
        if (missingTasks.length > 0) {
          saveTasksToSupabase(missingTasks).catch(() => {});
        }
      }
    }
    if (!hasPendingTasks && finalTasks.length > 0) {
      await saveTasksToIDB(finalTasks);
    }

    const hasPendingGuardias = remainingQueue.some(q => q.type === 'GUARDIAS_UPSERT');
    let finalGuardias = cachedGuardias;
    if (!hasPendingGuardias) {
      if (serverGuardias && serverGuardias.grupos && serverGuardias.grupos.length > 0) {
        if (backupGuardias && (backupGuardias.updatedAt || '') > (serverGuardias.updatedAt || '')) {
          finalGuardias = normalizeGuardiasData(backupGuardias);
        } else {
          finalGuardias = normalizeGuardiasData(serverGuardias);
        }
        await saveGuardiasToIDB(finalGuardias);
      } else if (backupGuardias && backupGuardias.grupos && backupGuardias.grupos.length > 0) {
        finalGuardias = normalizeGuardiasData(backupGuardias);
        await saveGuardiasToIDB(finalGuardias);
      }
    }

    if (shouldHydrateBackup && backupEffectiveTs && typeof window !== 'undefined') {
      localStorage.setItem(FULL_BACKUP_APPLIED_AT_KEY, backupEffectiveTs);
    }

    return {
      patients: mergedPatients,
      beds: finalBeds,
      historias: finalHistorias,
      tasks: finalTasks,
      guardias: finalGuardias
    };
  } catch (err) {
    console.warn('Offline mode: Using cached IndexedDB data in syncAndRebuildLocalMemory:', err);
    return {
      patients: cachedPatients,
      beds: cachedBeds.length > 0 ? cachedBeds : INITIAL_BEDS,
      historias: cachedHistorias,
      tasks: cachedTasks,
      guardias: cachedGuardias
    };
  }
}

export async function getOfflineQueueCountApi(): Promise<number> {
  try {
    const q = await getOfflineQueueFromIDB();
    return q.length;
  } catch {
    return 0;
  }
}

export async function syncOfflineQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const queue = await getOfflineQueueFromIDB();
  if (!queue || !queue.length) return;

  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'PATIENT_UPSERT') {
        await savePatientToSupabase(item.data);
      } else if (item.type === 'PATIENTS_BATCH') {
        await savePatientsBatchToSupabase(item.data);
      } else if (item.type === 'EVOLUTION_ADD') {
        if (item.data.patient) {
          await savePatientToSupabase(item.data.patient);
        }
        if (item.data.evolution) {
          await saveEvolutionToSupabase(item.data.evolution);
        }
      } else if (item.type === 'PATIENT_DELETE') {
        await deletePatientFromSupabase(item.data.id);
      } else if (item.type === 'BEDS_UPSERT') {
        await saveBedsToSupabase(item.data);
      } else if (item.type === 'HISTORIA_UPSERT') {
        await saveHistoriaToSupabase(item.data);
      } else if (item.type === 'HISTORIA_DELETE') {
        await deleteHistoriaFromSupabase(item.data.id);
      } else if (item.type === 'TASKS_UPSERT') {
        await saveTasksToSupabase(item.data);
      } else if (item.type === 'TASK_DELETE') {
        await deleteTaskFromSupabase(item.data.id);
      } else if (item.type === 'GUARDIAS_UPSERT') {
        await saveGuardiasToSupabase(item.data, GUARDIAS_CONFIG_KEY);
      }
    } catch (err) {
      console.warn('Offline sync item failed, will retry later:', item.type, err);
      remaining.push(item);
    }
  }

  await saveOfflineQueueToIDB(remaining);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hmi_queue_changed'));
  }
}

// ==========================================
// 2. PATIENTS CRUD (Supabase Table: 'patients')
// ==========================================

export async function fetchPatientsApi(): Promise<Patient[]> {
  const cachedPatients = await getPatientsFromIDB();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return cachedPatients;
  }
  try {
    await syncOfflineQueue().catch(() => {});
    const [patients, queue, remoteMeta] = await Promise.all([
      fetchPatientsFromSupabase(),
      getOfflineQueueFromIDB(),
      fetchPatientsMetaFromSupabase()
    ]);
    if (patients && patients.length > 0) {
      const merged = mergePatientsWithLocalAndQueue(patients, cachedPatients, queue, remoteMeta);
      await savePatientsToIDB(merged);
      return merged;
    }
  } catch {}
  return cachedPatients;
}

export async function savePatientApi(patient: Patient, options?: { skipLog?: boolean }): Promise<Patient> {
  // Deduplicate evolutions within patient before saving
  if (Array.isArray(patient.evolutions)) {
    const seen = new Set<string>();
    patient.evolutions = patient.evolutions.filter(e => {
      if (!e || !e.id || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  // 1. ALWAYS SAVE TO INDEXEDDB FIRST IMMEDIATELY
  const currentPatients = await getPatientsFromIDB();
  const previousPatient = currentPatients.find(p => p.id === patient.id);
  const exists = Boolean(previousPatient);
  const updatedList = exists 
    ? currentPatients.map(p => p.id === patient.id ? patient : p)
    : [patient, ...currentPatients];
  await savePatientsToIDB(updatedList);

  // 2. ATTEMPT SUPABASE SAVE OR QUEUE
  try {
    await savePatientToSupabase(patient);
    savePatientsMetaToSupabase(updatedList).catch(() => {});
  } catch (err) {
    console.warn('Network issue saving patient to Supabase, enqueuing for offline sync:', err);
    await enqueueOfflineAction({
      type: 'PATIENT_UPSERT',
      data: patient
    });
  }

  if (!options?.skipLog) {
    try {
      const isAlta = previousPatient && previousPatient.status === 'hospitalized' && patient.status === 'discharged';
      const isAreaChange = previousPatient && previousPatient.area !== patient.area;
      const isReingreso = previousPatient && previousPatient.status === 'discharged' && patient.status === 'hospitalized';
      const changeCategory = !exists
        ? 'ingreso'
        : isAlta
        ? 'alta'
        : isReingreso
        ? 'reingreso'
        : isAreaChange
        ? 'traslado'
        : 'edicion_clinica';

      const description = !exists
        ? `Nuevo ingreso hospitalario: ${patient.lastName}, ${patient.firstName} (${patient.area} - ${patient.bedNumber})`
        : isAlta
        ? `Alta médica / Egreso: ${patient.lastName}, ${patient.firstName} (${patient.area} - ${patient.bedNumber})`
        : isReingreso
        ? `Reingreso registrado: ${patient.lastName}, ${patient.firstName} (${patient.area} - ${patient.bedNumber})`
        : isAreaChange
        ? `Cambio de área: ${patient.lastName}, ${patient.firstName} (${previousPatient.area} → ${patient.area})`
        : `Ficha clínica actualizada: ${patient.lastName}, ${patient.firstName} (${patient.area} - ${patient.bedNumber})`;

      logDatabaseActivity({
        module: 'pacientes',
        action: !exists ? 'INSERT' : (isAlta || isAreaChange || isReingreso) ? 'STATUS_CHANGE' : 'UPDATE',
        changeCategory,
        user: patient.doctorInCharge || 'Médico de Guardia',
        description,
        details: {
          entityType: 'patient_change',
          changeCategory,
          id: patient.id,
          patientId: patient.id,
          patientName: `${patient.lastName}, ${patient.firstName}`.trim(),
          historia: patient.medicalHistoryNumber,
          status: patient.status,
          beforeSnapshot: previousPatient ? sanitizeSnapshotForLog('patient_change', previousPatient) : null,
          snapshot: sanitizeSnapshotForLog('patient', patient)
        },
        severity: isAlta ? 'info' : !exists ? 'success' : 'info'
      });
    } catch (e) {
      console.warn('Logging skipped:', e);
    }
  }
  broadcastClinicalRealtime('PATIENTS_UPDATED', updatedList);
  return patient;
}

export async function savePatientsListApi(patientsList: Patient[], options?: { skipLog?: boolean }): Promise<void> {
  const prevPatients = await getPatientsFromIDB();
  const prevIds = new Set(prevPatients.map(p => p.id));
  const newlyAdded = patientsList.filter(p => p && p.id && !prevIds.has(p.id));

  // 1. Always save to IndexedDB immediately
  await savePatientsToIDB(patientsList);

  // 2. Attempt Supabase or queue
  try {
    await savePatientsBatchToSupabase(patientsList);
    savePatientsMetaToSupabase(patientsList).catch(() => {});
  } catch (err) {
    console.warn('Network issue saving patients list, enqueuing:', err);
    await enqueueOfflineAction({
      type: 'PATIENTS_BATCH',
      data: patientsList
    });
  }

  if (!options?.skipLog) {
    for (const np of newlyAdded) {
      try {
        logDatabaseActivity({
          module: 'pacientes',
          action: 'INSERT',
          changeCategory: 'ingreso',
          user: np.doctorInCharge || 'Médico de Guardia',
          description: `Nuevo ingreso hospitalario: ${np.lastName}, ${np.firstName} (${np.area} - ${np.bedNumber})`,
          details: {
            entityType: 'patient_change',
            changeCategory: 'ingreso',
            id: np.id,
            patientId: np.id,
            patientName: `${np.lastName}, ${np.firstName}`.trim(),
            historia: np.medicalHistoryNumber,
            status: np.status,
            beforeSnapshot: null,
            snapshot: sanitizeSnapshotForLog('patient', np)
          },
          severity: 'success'
        });
      } catch {}
    }
  }
  broadcastClinicalRealtime('PATIENTS_UPDATED', patientsList);
}

export async function deletePatientApi(id: string, options?: { skipLog?: boolean; actorName?: string }): Promise<boolean> {
  // 1. Remove from local IndexedDB immediately
  const current = await getPatientsFromIDB();
  const targetPatient = current.find(p => p.id === id);
  await savePatientsToIDB(current.filter(p => p.id !== id));

  // 2. Attempt delete from Supabase or queue
  let result = false;
  try {
    result = await deletePatientFromSupabase(id);
    if (!result) {
      await enqueueOfflineAction({ type: 'PATIENT_DELETE', data: { id } });
    }
  } catch {
    await enqueueOfflineAction({ type: 'PATIENT_DELETE', data: { id } });
  }

  if (!options?.skipLog && targetPatient) {
    try {
      const sanitizedBefore = sanitizeSnapshotForLog('patient_change', targetPatient);
      logDatabaseActivity({
        module: 'pacientes',
        action: 'DELETE',
        changeCategory: 'eliminacion',
        user: options?.actorName || targetPatient.doctorInCharge || 'Médico de Guardia',
        description: `Paciente eliminado: ${targetPatient.lastName}, ${targetPatient.firstName} (${targetPatient.area} - ${targetPatient.bedNumber})`,
        details: {
          entityType: 'patient_change',
          changeCategory: 'eliminacion',
          id,
          patientId: id,
          patientName: `${targetPatient.lastName}, ${targetPatient.firstName}`.trim(),
          beforeSnapshot: sanitizedBefore,
          snapshot: sanitizedBefore
        },
        severity: 'danger'
      });
    } catch {}
  }

  broadcastClinicalRealtime('PATIENTS_UPDATED', current.filter(p => p.id !== id));
  return true;
}

// ==========================================
// 3. EVOLUTIONS CRUD (Supabase Table: 'evolutions')
// ==========================================

export async function addPatientEvolutionApi(
  patientId: string,
  evolution: MedicalEvolution,
  options?: { beforePatientSnapshot?: Patient; skipLog?: boolean }
): Promise<Patient | null> {
  // 1. Find patient in local IndexedDB first (works 100% offline)
  let currentPatients = await getPatientsFromIDB();
  let patient = currentPatients.find(p => p.id === patientId);

  // If not found in IDB, try fetching from online if possible
  if (!patient) {
    try {
      const online = await fetchPatientsFromSupabase();
      patient = online.find(p => p.id === patientId);
      if (patient) {
        currentPatients = online;
      }
    } catch {}
  }

  if (!patient) {
    console.error(`Patient ${patientId} not found in local IDB or online`);
    return null;
  }

  const baseForRevert = options?.beforePatientSnapshot || patient;
  const hadTodayBefore = Boolean(
    baseForRevert.evolutions?.some(e => e && (e.id === evolution.id || e.date === evolution.date))
  );

  const normalizedEvolution: MedicalEvolution = {
    ...evolution,
    evolvedInDay: true
  };

  // Replace any previous evolution on the same date or with the same ID so updates persist cleanly
  const existingEvs = Array.isArray(patient.evolutions) ? patient.evolutions : [];
  const filteredEvs = existingEvs.filter(
    e => e && e.id !== normalizedEvolution.id && e.date !== normalizedEvolution.date
  );
  const updatedPatient: Patient = {
    ...patient,
    evolutions: [normalizedEvolution, ...filteredEvs],
    evolucionadoHoy: true,
    ultimaEvolucionFecha: normalizedEvolution.date,
    updatedAt: new Date().toISOString()
  };

  // 2. ALWAYS SAVE TO INDEXEDDB IMMEDIATELY (GUARANTEES NO EVOLUTION IS EVER LOST!)
  const updatedList = currentPatients.map(p => p.id === patientId ? updatedPatient : p);
  await savePatientsToIDB(updatedList);

  // 3. Attempt to save to Supabase online or enqueue for automatic sync
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineAction({
      type: 'EVOLUTION_ADD',
      data: { patientId, patient: updatedPatient, evolution: normalizedEvolution }
    });
  } else {
    try {
      await savePatientToSupabase(updatedPatient);
      try {
        await saveEvolutionToSupabase(normalizedEvolution);
      } catch (e) {
        console.warn('Notice saving evolution record, enqueuing for sync:', e);
        await enqueueOfflineAction({
          type: 'EVOLUTION_ADD',
          data: { patientId, patient: updatedPatient, evolution: normalizedEvolution }
        });
      }
    } catch (err) {
      console.warn('Offline: evolution saved locally in IndexedDB and queued for auto-sync:', err);
      await enqueueOfflineAction({
        type: 'EVOLUTION_ADD',
        data: { patientId, patient: updatedPatient, evolution: normalizedEvolution }
      });
    }
  }

  if (!options?.skipLog) {
    try {
      logDatabaseActivity({
        module: 'evoluciones',
        action: hadTodayBefore ? 'UPDATE' : 'INSERT',
        changeCategory: 'evolucion',
        user: normalizedEvolution.doctorName || 'Médico de Guardia',
        description: `${hadTodayBefore ? 'Evolución actualizada' : 'Evolución diaria registrada'} para ${updatedPatient.lastName}, ${updatedPatient.firstName} (${normalizedEvolution.date} ${normalizedEvolution.time})`,
        details: {
          entityType: 'patient_change',
          changeCategory: 'evolucion',
          patientId,
          evolutionId: normalizedEvolution.id,
          patientName: `${updatedPatient.lastName}, ${updatedPatient.firstName}`.trim(),
          evolvedInDay: true,
          signosVitales: normalizedEvolution.vitalSigns,
          beforeSnapshot: sanitizeSnapshotForLog('patient_change', baseForRevert),
          snapshot: normalizedEvolution
        },
        severity: 'success'
      });
    } catch {}
  }

  broadcastClinicalRealtime('PATIENTS_UPDATED', updatedList);
  return updatedPatient;
}

// ==========================================
// 4. BEDS CRUD (Supabase Table: 'beds')
// ==========================================

export async function fetchBedsApi(): Promise<Bed[]> {
  try {
    const beds = await fetchBedsFromSupabase();
    if (beds && beds.length > 0) {
      await saveBedsToIDB(beds);
      return beds;
    }
  } catch {}
  const cached = await getBedsFromIDB();
  return cached.length > 0 ? cached : INITIAL_BEDS;
}

export async function saveBedsApi(beds: Bed[]): Promise<Bed[]> {
  // 1. Save to IndexedDB immediately
  await saveBedsToIDB(beds);

  // 2. Attempt Supabase or queue
  try {
    await saveBedsToSupabase(beds);
  } catch (err) {
    console.warn('Network issue saving beds, enqueuing for offline sync:', err);
    await enqueueOfflineAction({
      type: 'BEDS_UPSERT',
      data: beds
    });
  }

  broadcastClinicalRealtime('BEDS_UPDATED', beds);
  return beds;
}

// ==========================================
// 5. HISTORIAS CLINICAS CRUD (Supabase Table: 'historias')
// ==========================================

export async function fetchHistoriasApi(): Promise<HistoriaClinicaPediatrica[]> {
  try {
    const online = await fetchHistoriasFromSupabase();
    if (online && online.length > 0) {
      await saveHistoriasToIDB(online);
      return online;
    }
  } catch {}
  return await getHistoriasFromIDB();
}

export async function fetchHistoriaByIdApi(id: string): Promise<HistoriaClinicaPediatrica | null> {
  const cached = await getHistoriasFromIDB();
  const found = cached.find(h => h.id === id);
  if (found) return found;
  return await fetchHistoriaByIdFromSupabase(id);
}

export async function saveHistoriaApi(historia: HistoriaClinicaPediatrica, options?: { skipLog?: boolean }): Promise<HistoriaClinicaPediatrica> {
  // 1. Save to IndexedDB immediately
  const current = await getHistoriasFromIDB();
  const previousHistoria = current.find(h => h.id === historia.id);
  const exists = Boolean(previousHistoria);
  const updated = exists ? current.map(h => h.id === historia.id ? historia : h) : [historia, ...current];
  await saveHistoriasToIDB(updated);

  // 2. Attempt Supabase or queue
  try {
    await saveHistoriaToSupabase(historia);
  } catch (err) {
    console.warn('Network issue saving historia, enqueuing for sync:', err);
    await enqueueOfflineAction({
      type: 'HISTORIA_UPSERT',
      data: historia
    });
  }

  if (!options?.skipLog) {
    try {
      const patientFullName = `${historia.apellidos || ''}, ${historia.nombres || ''}`.replace(/^,\s*/, '').trim() || 'Paciente';
      logDatabaseActivity({
        module: 'historias',
        action: exists ? 'UPDATE' : 'INSERT',
        changeCategory: 'historia',
        user: historia.medicoAdmisionFirma || historia.medicoServicioFirma || 'Médico de Guardia',
        description: exists
          ? `Historia Clínica actualizada: ${patientFullName} (N° ${historia.numHistoria || historia.id})`
          : `Nueva Historia Clínica creada: ${patientFullName} (N° ${historia.numHistoria || historia.id})`,
        details: {
          entityType: 'historia',
          changeCategory: 'historia',
          id: historia.id,
          patientId: historia.patientId,
          numHistoria: historia.numHistoria,
          beforeSnapshot: previousHistoria ? sanitizeSnapshotForLog('historia', previousHistoria) : null,
          snapshot: sanitizeSnapshotForLog('historia', historia)
        }
      });
    } catch {}
  }
  broadcastClinicalRealtime('HISTORIAS_UPDATED', updated);
  return historia;
}

export async function deleteHistoriaApi(id: string): Promise<boolean> {
  const current = await getHistoriasFromIDB();
  const targetHistoria = current.find(h => h.id === id);
  const nextHistorias = current.filter(h => h.id !== id);
  await saveHistoriasToIDB(nextHistorias);

  try {
    await deleteHistoriaFromSupabase(id);
  } catch {
    await enqueueOfflineAction({
      type: 'HISTORIA_DELETE',
      data: { id }
    });
  }

  try {
    logDatabaseActivity({
      module: 'historias',
      action: 'DELETE',
      user: targetHistoria?.medicoAdmisionFirma || 'Dr. Brayan',
      description: `Historia clínica ${targetHistoria?.numHistoria || id} eliminada de la base de datos`,
      details: {
        entityType: 'historia',
        id,
        snapshot: targetHistoria ? sanitizeSnapshotForLog('historia', targetHistoria) : undefined
      },
      severity: 'danger'
    });
  } catch {}
  broadcastClinicalRealtime('HISTORIAS_UPDATED', nextHistorias);
  return true;
}

// ==========================================
// 6. TASKS CRUD (Supabase Table: 'tasks')
// ==========================================

export async function fetchTasksApi(): Promise<PersonalTask[]> {
  try {
    const tasks = await fetchTasksFromSupabase();
    if (tasks && tasks.length > 0) {
      await saveTasksToIDB(tasks);
      return tasks;
    }
  } catch {}
  return await getTasksFromIDB();
}

export async function saveTasksApi(tasks: PersonalTask[]): Promise<PersonalTask[]> {
  const prevTasks = await getTasksFromIDB();
  const prevIds = new Set(prevTasks.map(t => t.id));
  const newlyAdded = tasks.filter(t => t && t.id && !prevIds.has(t.id));

  await saveTasksToIDB(tasks);
  try {
    await saveTasksToSupabase(tasks);
  } catch (err) {
    await enqueueOfflineAction({
      type: 'TASKS_UPSERT',
      data: tasks
    });
  }

  for (const nt of newlyAdded) {
    try {
      logDatabaseActivity({
        module: 'tareas',
        action: 'INSERT',
        user: 'Médico de Guardia',
        description: `Tarea de guardia "${nt.title}" registrada [Prioridad: ${nt.priority}]`,
        details: {
          entityType: 'task',
          id: nt.id,
          priority: nt.priority,
          completed: nt.completed,
          snapshot: nt
        }
      });
    } catch {}
  }

  broadcastClinicalRealtime('TASKS_UPDATED', tasks);
  return tasks;
}

export async function saveTaskApi(task: PersonalTask): Promise<PersonalTask> {
  const current = await getTasksFromIDB();
  const exists = current.some(t => t.id === task.id);
  const updated = exists ? current.map(t => t.id === task.id ? task : t) : [task, ...current];
  await saveTasksToIDB(updated);

  try {
    await saveTaskToSupabase(task);
  } catch (err) {
    await enqueueOfflineAction({
      type: 'TASKS_UPSERT',
      data: updated
    });
  }

  try {
    logDatabaseActivity({
      module: 'tareas',
      action: exists ? (task.completed ? 'STATUS_CHANGE' : 'UPDATE') : 'INSERT',
      user: 'Dr. Brayan',
      description: `Tarea de guardia "${task.title}" ${exists ? (task.completed ? 'completada' : 'actualizada') : 'registrada'} [Prioridad: ${task.priority}]`,
      details: {
        entityType: 'task',
        id: task.id,
        priority: task.priority,
        completed: task.completed,
        snapshot: task
      }
    });
  } catch {}
  broadcastClinicalRealtime('TASKS_UPDATED', updated);
  return task;
}

export async function deleteTaskApi(id: string): Promise<boolean> {
  const current = await getTasksFromIDB();
  const targetTask = current.find(t => t.id === id);
  await saveTasksToIDB(current.filter(t => t.id !== id));

  try {
    await deleteTaskFromSupabase(id);
  } catch {
    await enqueueOfflineAction({
      type: 'TASK_DELETE',
      data: { id }
    });
  }

  try {
    logDatabaseActivity({
      module: 'tareas',
      action: 'DELETE',
      user: 'Dr. Brayan',
      description: targetTask ? `Tarea de guardia "${targetTask.title}" eliminada` : `Tarea de guardia ${id} eliminada`,
      details: {
        entityType: 'task',
        id,
        snapshot: targetTask
      },
      severity: 'warning'
    });
  } catch {}
  broadcastClinicalRealtime('TASKS_UPDATED', current.filter(t => t.id !== id));
  return true;
}

// ==========================================
// 7. DOCUMENTS & UPLOADS
// ==========================================

export async function uploadDocumentApi(params: {
  patientId?: string;
  title: string;
  fileType: 'pdf' | 'image' | 'doc';
  fileName: string;
  dataUrl: string;
  uploadedBy: string;
}) {
  const newDoc = {
    id: 'doc-' + Date.now(),
    title: params.title || params.fileName,
    fileType: params.fileType || 'pdf',
    fileName: params.fileName,
    dataUrl: params.dataUrl,
    fileSize: `${(params.dataUrl.length / 1024 / 1024).toFixed(2)} MB`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.uploadedBy || 'Médico'
  };

  if (params.patientId) {
    let current = await getPatientsFromIDB();
    let patient = current.find(p => p.id === params.patientId);
    if (!patient) {
      try {
        const online = await fetchPatientsFromSupabase();
        patient = online.find(p => p.id === params.patientId);
      } catch {}
    }
    if (patient) {
      const updatedPatient: Patient = {
        ...patient,
        documents: [newDoc, ...(patient.documents || [])],
        updatedAt: new Date().toISOString()
      };
      await savePatientApi(updatedPatient);
    }
  }

  return { success: true, document: newDoc };
}

// ==========================================
// 7B. ROL DE GUARDIAS (Supabase system_configs + IndexedDB Offline-first)
// ==========================================

export async function fetchGuardiasApi(): Promise<RolGuardiasData> {
  const cached = await getGuardiasFromIDB();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return cached;
  }
  try {
    const remote = await fetchGuardiasFromSupabase(GUARDIAS_CONFIG_KEY);
    if (remote && Array.isArray(remote.grupos) && remote.grupos.length > 0) {
      await saveGuardiasToIDB(remote);
      return remote;
    }
  } catch (err) {
    console.warn('Fallback to local guardias cache:', err);
  }
  return cached;
}

export async function saveGuardiasApi(data: RolGuardiasData): Promise<RolGuardiasData> {
  const normalized = normalizeGuardiasData({
    ...data,
    updatedAt: new Date().toISOString()
  });
  await saveGuardiasToIDB(normalized);

  try {
    await saveGuardiasToSupabase(normalized, GUARDIAS_CONFIG_KEY);
  } catch (err) {
    console.warn('Guardias Supabase sync failed, enqueuing offline action:', err);
    await enqueueOfflineAction({
      type: 'GUARDIAS_UPSERT',
      data: normalized
    });
  }

  broadcastClinicalRealtime('GUARDIAS_UPDATED', normalized);
  return normalized;
}

// ==========================================
// 7C. RESTORE FROM ACTIVITY LOG SNAPSHOT
// ==========================================

export async function restoreActivityLogApi(log: ActivityLog): Promise<{ success: boolean; message: string }> {
  const details = log.details || {};
  let snapshot = details.snapshot;
  const hasExplicitBefore = 'beforeSnapshot' in details;
  const beforeSnapshot = details.beforeSnapshot;
  const entityType = details.entityType;
  const changeCategory = log.changeCategory || details.changeCategory;

  // Fallback search in auto-backups if snapshot wasn't stored on an older log entry
  if (!hasExplicitBefore && !snapshot && (details.id || details.patientId)) {
    try {
      const backups = await getAutoBackupsList();
      for (const b of backups) {
        if (log.module === 'pacientes' && details.id) {
          const found = b.patients?.find(p => p.id === details.id);
          if (found) { snapshot = found; break; }
        } else if (log.module === 'historias' && details.id) {
          const found = b.historias?.find(h => h.id === details.id);
          if (found) { snapshot = found; break; }
        } else if (log.module === 'tareas' && details.id) {
          const found = b.tasks?.find(t => t.id === details.id);
          if (found) { snapshot = found; break; }
        } else if (log.module === 'evoluciones' && details.patientId) {
          const foundPt = b.patients?.find(p => p.id === details.patientId);
          const foundEv = foundPt?.evolutions?.[0];
          if (foundEv) { snapshot = foundEv; break; }
        }
      }
    } catch {}
  }

  // Helper to sync bed occupancy cleanly for a restored patient state
  const syncBedsForPatientState = async (pt: Patient) => {
    const currentBeds = await getBedsFromIDB();
    let changed = false;
    const nextBeds = currentBeds.map(b => {
      if (pt.status === 'hospitalized' && b.area === pt.area && b.bedNumber === pt.bedNumber) {
        if (b.status === 'free' || b.patientId === pt.id) {
          changed = true;
          return {
            ...b,
            status: 'occupied' as const,
            patientId: pt.id,
            patientName: `${pt.lastName}, ${pt.firstName}`,
            updatedAt: new Date().toISOString()
          };
        }
      } else if (b.patientId === pt.id) {
        // Free bed if patient was discharged OR moved to a different bed/area
        if (pt.status !== 'hospitalized' || b.area !== pt.area || b.bedNumber !== pt.bedNumber) {
          changed = true;
          return {
            ...b,
            status: 'free' as const,
            patientId: undefined,
            patientName: undefined,
            updatedAt: new Date().toISOString()
          };
        }
      }
      return b;
    });
    if (changed) {
      await saveBedsApi(nextBeds);
    }
  };

  try {
    // 0. CLINICAL STATE REVERT WITH EXPLICIT beforeSnapshot (Evolución, Ingreso, Alta, Traslado, Reingreso, Edición Clínica)
    if (entityType === 'patient_change' || (hasExplicitBefore && log.module !== 'historias')) {
      const targetPatientId = details.patientId || details.id || beforeSnapshot?.id || snapshot?.id;

      // Case A: Revert a brand new Ingreso (patient did not exist before -> remove patient & free bed)
      if (beforeSnapshot === null && changeCategory === 'ingreso' && targetPatientId) {
        const currentBeds = await getBedsFromIDB();
        const nextBeds = currentBeds.map(b =>
          b.patientId === targetPatientId
            ? { ...b, status: 'free' as const, patientId: undefined, patientName: undefined, updatedAt: new Date().toISOString() }
            : b
        );
        await saveBedsApi(nextBeds);
        await deletePatientApi(targetPatientId, { skipLog: true });
        return {
          success: true,
          message: `Ingreso de "${details.patientName || targetPatientId}" revertido: paciente removido y cama liberada.`
        };
      }

      // Case B: Revert any mutation back to exact pre-change Patient snapshot
      if (beforeSnapshot && typeof beforeSnapshot === 'object') {
        const currentPatients = await getPatientsFromIDB();
        const currentPt = currentPatients.find(p => p.id === beforeSnapshot.id);
        const restoredPatient: Patient = {
          ...beforeSnapshot,
          // Preserve heavy documents from current patient if beforeSnapshot truncated base64 >12KB
          documents: currentPt?.documents?.length && (!beforeSnapshot.documents?.length || beforeSnapshot.documents.some((d: any) => d.dataUrl === ''))
            ? currentPt.documents
            : (beforeSnapshot.documents || []),
          updatedAt: new Date().toISOString()
        };

        // If reverting an evolución, remove added evolution(s) from Supabase 'evolutions' table that didn't exist in beforeSnapshot
        if (changeCategory === 'evolucion') {
          const prevEvIds = new Set((restoredPatient.evolutions || []).map(e => e.id));
          const removedEvIds: string[] = [];
          if (details.evolutionId && !prevEvIds.has(details.evolutionId)) {
            removedEvIds.push(details.evolutionId);
          }
          if (currentPt?.evolutions) {
            for (const ev of currentPt.evolutions) {
              if (ev?.id && !prevEvIds.has(ev.id) && !removedEvIds.includes(ev.id)) {
                removedEvIds.push(ev.id);
              }
            }
          }
          for (const evId of removedEvIds) {
            deleteEvolutionFromSupabase(evId).catch(() => {});
          }
          for (const ev of restoredPatient.evolutions || []) {
            saveEvolutionToSupabase(ev).catch(() => {});
          }
        }

        await savePatientApi(restoredPatient, { skipLog: true });
        await syncBedsForPatientState(restoredPatient);

        const labelByCat: Record<string, string> = {
          evolucion: 'Evolución médica revertida',
          alta: 'Alta médica revertida (paciente reintegrado a hospitalización)',
          traslado: `Cambio de área revertido (devuelto a ${restoredPatient.area})`,
          reingreso: 'Reingreso revertido al estado previo',
          eliminacion: 'Paciente eliminado restaurado en la base de datos',
          edicion_clinica: 'Cambios clínicos revertidos'
        };
        const actionMsg = labelByCat[changeCategory || ''] || 'Estado anterior restaurado';
        return {
          success: true,
          message: `${actionMsg} para "${restoredPatient.lastName}, ${restoredPatient.firstName}".`
        };
      }
    }

    // 1. Legacy / Direct Patient Snapshot Restore
    if (entityType === 'patient' || (log.module === 'pacientes' && snapshot?.firstName !== undefined)) {
      if (!snapshot) {
        return { success: false, message: 'No existe instantánea de paciente en este registro histórico para revertir.' };
      }
      const restoredPatient: Patient = {
        ...snapshot,
        updatedAt: new Date().toISOString()
      };
      await savePatientApi(restoredPatient, { skipLog: true });
      await syncBedsForPatientState(restoredPatient);
      return {
        success: true,
        message: `Paciente "${restoredPatient.firstName} ${restoredPatient.lastName}" restaurado correctamente en la base de datos.`
      };
    }

    // 2. Evolutions (fallback when beforeSnapshot wasn't present)
    if (entityType === 'evolution' || log.module === 'evoluciones') {
      const targetPatientId = details.patientId || snapshot?.patientId;
      if (!targetPatientId) {
        return { success: false, message: 'No se pudo identificar el paciente asociado a esta evolución.' };
      }

      const currentPatients = await getPatientsFromIDB();
      const parentPatient = currentPatients.find(p => p.id === targetPatientId);
      if (!snapshot && parentPatient?.evolutions?.length) {
        snapshot = parentPatient.evolutions[0];
      }
      if (!snapshot) {
        return { success: false, message: 'Este registro histórico antiguo no contiene copia de la evolución para restaurar.' };
      }
      if (!parentPatient) {
        return { success: false, message: 'El paciente padre de esta evolución no se encuentra en la base de datos. Restaure primero al paciente.' };
      }

      const restoredEv: MedicalEvolution = {
        ...snapshot,
        patientId: targetPatientId,
        evolvedInDay: true
      };
      await addPatientEvolutionApi(targetPatientId, restoredEv, { skipLog: true });
      return {
        success: true,
        message: `Evolución médica (${restoredEv.date}) de ${parentPatient.firstName} ${parentPatient.lastName} restaurada con éxito.`
      };
    }

    // 3. Historias Clínicas
    if (entityType === 'historia' || log.module === 'historias') {
      if (hasExplicitBefore && beforeSnapshot === null && details.id) {
        await deleteHistoriaApi(details.id);
        return {
          success: true,
          message: `Creación de Historia Clínica N° ${details.numHistoria || details.id} revertida y removida.`
        };
      }
      const targetHistoria = (hasExplicitBefore && beforeSnapshot) ? beforeSnapshot : snapshot;
      if (!targetHistoria) {
        return { success: false, message: 'Este registro histórico antiguo no contiene instantánea de la Historia Clínica para revertir.' };
      }
      const restoredHistoria: HistoriaClinicaPediatrica = {
        ...targetHistoria,
        updatedAt: new Date().toISOString()
      };
      await saveHistoriaApi(restoredHistoria, { skipLog: true });
      return {
        success: true,
        message: `Historia Clínica N° ${restoredHistoria.numHistoria || restoredHistoria.id} revertida al estado anterior.`
      };
    }

    // 4. Tasks
    if (entityType === 'task' || log.module === 'tareas') {
      if (!snapshot) {
        return { success: false, message: 'Este registro histórico antiguo no contiene los datos de la tarea para restaurar.' };
      }
      const restoredTask: PersonalTask = { ...snapshot };
      await saveTaskApi(restoredTask);
      return {
        success: true,
        message: `Tarea "${restoredTask.title}" restaurada correctamente.`
      };
    }

    // 5. Doctors
    if (entityType === 'doctor' || log.module === 'doctores') {
      if (!snapshot) {
        return { success: false, message: 'Este registro antiguo no incluye el perfil completo del médico para restaurar.' };
      }
      await upsertUserProfile({
        ...snapshot,
        updated_at: new Date().toISOString()
      });
      return {
        success: true,
        message: `Perfil médico de "${snapshot.full_name || snapshot.email}" restaurado correctamente.`
      };
    }

    // 6. Beds
    if (entityType === 'beds' || log.module === 'camas') {
      const bedsToRestore: Bed[] = Array.isArray(snapshot) && snapshot.length > 0 ? snapshot : INITIAL_BEDS;
      await saveBedsApi(bedsToRestore);
      return {
        success: true,
        message: `Distribución de ${bedsToRestore.length} camas reglamentarias restaurada en la base de datos.`
      };
    }

    return {
      success: false,
      message: 'Esta acción de registro no posee instantánea revertible.'
    };
  } catch (err: any) {
    console.error('Error restoring from activity log:', err);
    return {
      success: false,
      message: `Error al revertir acción: ${err?.message || 'Error inesperado'}`
    };
  }
}

// ==========================================
// 8. REALTIME SUBSCRIPTION (Supabase Realtime)
// ==========================================

export function subscribeToRealtimeEvents(onEvent: (event: { type: string; payload: any }) => void): () => void {
  // 1. Subscribe to Supabase Postgres Realtime changes
  const unsubscribeSupabase = subscribeToSupabaseRealtime(async (change) => {
    try {
      if (change.table === 'patients' || change.table === 'evolutions') {
        const [serverPatients, cachedPatients, queue, remoteMeta] = await Promise.all([
          fetchPatientsFromSupabase(),
          getPatientsFromIDB(),
          getOfflineQueueFromIDB(),
          fetchPatientsMetaFromSupabase()
        ]);
        const merged = mergePatientsWithLocalAndQueue(serverPatients, cachedPatients, queue, remoteMeta);
        if (merged.length > 0) {
          await savePatientsToIDB(merged);
          onEvent({ type: 'PATIENTS_UPDATED', payload: merged });
        }
      } else if (change.table === 'beds') {
        const beds = await fetchBedsFromSupabase();
        await saveBedsToIDB(beds);
        onEvent({ type: 'BEDS_UPDATED', payload: beds });
      } else if (change.table === 'historias') {
        const historias = await fetchHistoriasFromSupabase();
        await saveHistoriasToIDB(historias);
        onEvent({ type: 'HISTORIAS_UPDATED', payload: historias });
      } else if (change.table === 'tasks') {
        const tasks = await fetchTasksFromSupabase();
        await saveTasksToIDB(tasks);
        onEvent({ type: 'TASKS_UPDATED', payload: tasks });
      } else if (change.table === 'system_configs') {
        if (change.newRow?.key === MAINTENANCE_CONFIG_KEY && change.newRow?.value) {
          const rawVal =
            typeof change.newRow.value === 'string'
              ? JSON.parse(change.newRow.value)
              : change.newRow.value;
          const nextMaint: MaintenanceConfig = {
            enabled: Boolean(rawVal?.enabled),
            message: String(rawVal?.message || DEFAULT_MAINTENANCE_MESSAGE),
            updatedAt: String(rawVal?.updatedAt || change.newRow.updated_at || new Date().toISOString()),
            updatedBy: rawVal?.updatedBy ? String(rawVal.updatedBy) : undefined,
          };
          cacheLocalMaintenanceStatus(nextMaint);
          onEvent({ type: 'MAINTENANCE_UPDATED', payload: nextMaint });
        }

        if (change.newRow?.key === AMBIENT_SOUND_CONFIG_KEY && change.newRow?.value) {
          const rawVal =
            typeof change.newRow.value === 'string'
              ? JSON.parse(change.newRow.value)
              : change.newRow.value;
          const numInt = Number(rawVal?.intensity);
          const nextSound: AmbientSoundSupabaseConfig = {
            enabled: Boolean(rawVal?.enabled),
            intensity: Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : 0.4,
            updatedAt: String(rawVal?.updatedAt || change.newRow.updated_at || new Date().toISOString()),
            updatedBy: rawVal?.updatedBy ? String(rawVal.updatedBy) : undefined,
          };
          cacheLocalAmbientSoundConfig(nextSound);
          onEvent({ type: 'AMBIENT_SOUND_UPDATED', payload: nextSound });
        }

        if (change.newRow?.key === PANEL_CONTROL_CONFIG_KEY && change.newRow?.value) {
          const rawVal =
            typeof change.newRow.value === 'string'
              ? JSON.parse(change.newRow.value)
              : change.newRow.value;
          if (rawVal && typeof rawVal === 'object') {
            const applied = applyPanelControlSettingsLocally({
              ...rawVal,
              updatedAt: String(rawVal.updatedAt || change.newRow.updated_at || new Date().toISOString()),
            });
            onEvent({ type: 'PANEL_CONTROL_UPDATED', payload: applied });
          }
        }

        if (change.newRow?.key === FULL_BACKUP_CONFIG_KEY) {
          const syncRes = await syncFullDatabaseBackupFromSupabase({ forceApply: true });
          if (syncRes?.applied) {
            onEvent({ type: 'FULL_BACKUP_UPDATED', payload: syncRes });
          }
        }

        const [remoteGuardias, remoteMaintenance, remoteAmbientSound] = await Promise.all([
          fetchGuardiasFromSupabase(GUARDIAS_CONFIG_KEY),
          fetchMaintenanceFromSupabase(),
          fetchAmbientSoundFromSupabase(),
        ]);
        if (remoteGuardias) {
          await saveGuardiasToIDB(remoteGuardias);
          onEvent({ type: 'GUARDIAS_UPDATED', payload: remoteGuardias });
        }
        if (remoteMaintenance) {
          cacheLocalMaintenanceStatus(remoteMaintenance);
          onEvent({ type: 'MAINTENANCE_UPDATED', payload: remoteMaintenance });
        }
        if (remoteAmbientSound) {
          cacheLocalAmbientSoundConfig(remoteAmbientSound);
          onEvent({ type: 'AMBIENT_SOUND_UPDATED', payload: remoteAmbientSound });
        }
      }
    } catch (err) {
      console.warn('Realtime sync handler error:', err);
    }
  });

  // 2. Subscribe to Express Server-Sent Events (/api/events) for immediate same-server multi-client sync
  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (!parsed || !parsed.type) return;
          if (parsed.type === 'MAINTENANCE_UPDATED' && parsed.payload) {
            const nextMaint: MaintenanceConfig = {
              enabled: Boolean(parsed.payload.enabled),
              message: String(parsed.payload.message || DEFAULT_MAINTENANCE_MESSAGE),
              updatedAt: String(parsed.payload.updatedAt || new Date().toISOString()),
              updatedBy: parsed.payload.updatedBy ? String(parsed.payload.updatedBy) : undefined,
            };
            cacheLocalMaintenanceStatus(nextMaint);
            onEvent({ type: 'MAINTENANCE_UPDATED', payload: nextMaint });
          } else if (parsed.type === 'AMBIENT_SOUND_UPDATED' && parsed.payload) {
            const numInt = Number(parsed.payload.intensity);
            const nextSound: AmbientSoundSupabaseConfig = {
              enabled: Boolean(parsed.payload.enabled),
              intensity: Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : 0.4,
              updatedAt: String(parsed.payload.updatedAt || new Date().toISOString()),
              updatedBy: parsed.payload.updatedBy ? String(parsed.payload.updatedBy) : undefined,
            };
            cacheLocalAmbientSoundConfig(nextSound);
            onEvent({ type: 'AMBIENT_SOUND_UPDATED', payload: nextSound });
          } else if (parsed.type === 'PANEL_CONTROL_UPDATED' && parsed.payload) {
            const applied = applyPanelControlSettingsLocally(parsed.payload);
            onEvent({ type: 'PANEL_CONTROL_UPDATED', payload: applied });
          } else if (parsed.type === 'PRESENCE_UPDATED' && parsed.payload && typeof parsed.payload === 'object') {
            cacheLocalUserPresenceMap(parsed.payload);
            onEvent({ type: 'PRESENCE_UPDATED', payload: parsed.payload });
          } else if (
            parsed.type === 'PATIENTS_UPDATED' ||
            parsed.type === 'BEDS_UPDATED' ||
            parsed.type === 'TASKS_UPDATED' ||
            parsed.type === 'HISTORIAS_UPDATED' ||
            parsed.type === 'GUARDIAS_UPDATED' ||
            parsed.type === 'FULL_BACKUP_UPDATED'
          ) {
            onEvent({ type: parsed.type, payload: parsed.payload });
          }
        } catch {
          // Ignore malformed SSE packets
        }
      };
    } catch {
      // Ignore if SSE not reachable
    }
  }

  // 3. Subscribe to BroadcastChannel for 0ms cross-tab sync on the same browser
  let channel: BroadcastChannel | null = null;
  let clinicalChannel: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('hmi_maintenance_channel');
      channel.onmessage = (ev) => {
        if (ev?.data?.type === 'MAINTENANCE_UPDATED' && ev.data.payload) {
          cacheLocalMaintenanceStatus(ev.data.payload);
          onEvent({ type: 'MAINTENANCE_UPDATED', payload: ev.data.payload });
        } else if (ev?.data?.type === 'AMBIENT_SOUND_UPDATED' && ev.data.payload) {
          cacheLocalAmbientSoundConfig(ev.data.payload);
          onEvent({ type: 'AMBIENT_SOUND_UPDATED', payload: ev.data.payload });
        } else if (ev?.data?.type === 'PANEL_CONTROL_UPDATED' && ev.data.payload) {
          const applied = applyPanelControlSettingsLocally(ev.data.payload);
          onEvent({ type: 'PANEL_CONTROL_UPDATED', payload: applied });
        } else if (ev?.data?.type === 'PRESENCE_UPDATED' && ev.data.payload) {
          cacheLocalUserPresenceMap(ev.data.payload);
          onEvent({ type: 'PRESENCE_UPDATED', payload: ev.data.payload });
        }
      };
    } catch {
      // Ignore BroadcastChannel errors
    }

    try {
      clinicalChannel = new BroadcastChannel('hmi_clinical_realtime');
      clinicalChannel.onmessage = (ev) => {
        if (ev?.data?.type && ev.data.payload !== undefined) {
          onEvent({ type: ev.data.type, payload: ev.data.payload });
        }
      };
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  return () => {
    unsubscribeSupabase();
    if (eventSource) {
      eventSource.close();
    }
    if (channel) {
      channel.close();
    }
    if (clinicalChannel) {
      clinicalChannel.close();
    }
  };
}

// ==========================================
// 8B. GLOBAL MAINTENANCE MODE API
// ==========================================

const MAINTENANCE_STORAGE_KEY = 'hmi_app_maintenance_status';

export type { MaintenanceConfig };
export { DEFAULT_MAINTENANCE_MESSAGE };

export function getLocalMaintenanceStatus(): MaintenanceConfig {
  const fallback: MaintenanceConfig = {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: '',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed?.enabled),
      message: parsed?.message || DEFAULT_MAINTENANCE_MESSAGE,
      updatedAt: parsed?.updatedAt || '',
      updatedBy: parsed?.updatedBy,
    };
  } catch {
    return fallback;
  }
}

function isSameMaintenanceStatus(a: MaintenanceConfig, b: MaintenanceConfig): boolean {
  return (
    Boolean(a.enabled) === Boolean(b.enabled) &&
    (a.message || '') === (b.message || '') &&
    (a.updatedAt || '') === (b.updatedAt || '')
  );
}

export function cacheLocalMaintenanceStatus(status: MaintenanceConfig, broadcast: boolean = false): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getLocalMaintenanceStatus();
    if (!isSameMaintenanceStatus(prev, status)) {
      localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(status));
      window.dispatchEvent(new Event('hmi_maintenance_changed'));
    }
    if (broadcast && typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('hmi_maintenance_channel');
      ch.postMessage({ type: 'MAINTENANCE_UPDATED', payload: status });
      ch.close();
    }
  } catch {
    // Ignore storage errors
  }
}

export async function fetchMaintenanceStatusApi(): Promise<MaintenanceConfig> {
  const [supabaseRes, apiRes] = await Promise.allSettled([
    fetchMaintenanceFromSupabase(),
    fetch('/api/maintenance', { cache: 'no-store' }).then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      return {
        enabled: Boolean(data?.enabled),
        message: String(data?.message || DEFAULT_MAINTENANCE_MESSAGE),
        updatedAt: String(data?.updatedAt || ''),
        updatedBy: data?.updatedBy ? String(data.updatedBy) : undefined,
      } as MaintenanceConfig;
    }),
  ]);

  const candidates: MaintenanceConfig[] = [];
  if (supabaseRes.status === 'fulfilled' && supabaseRes.value) {
    candidates.push(supabaseRes.value);
  }
  if (apiRes.status === 'fulfilled' && apiRes.value) {
    candidates.push(apiRes.value);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const latest = candidates[0];
    cacheLocalMaintenanceStatus(latest);
    return latest;
  }

  return getLocalMaintenanceStatus();
}

export async function saveMaintenanceStatusApi(
  enabled: boolean,
  message: string = DEFAULT_MAINTENANCE_MESSAGE,
  updatedBy: string = 'Administrador'
): Promise<MaintenanceConfig> {
  const payload: MaintenanceConfig = {
    enabled: Boolean(enabled),
    message: message.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  cacheLocalMaintenanceStatus(payload, true);

  const tasks: Promise<any>[] = [
    saveMaintenanceToSupabase(payload).catch((err) => {
      console.warn('Supabase maintenance save warning:', err);
    }),
    fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}),
  ];

  await Promise.all(tasks);
  return payload;
}

// ==========================================
// 8C. GLOBAL AMBIENT SOUND CONFIG API
// ==========================================

const AMBIENT_SOUND_STORAGE_KEY = 'hmi_ambient_sound_config';
const AMBIENT_SOUND_USER_MUTED_KEY = 'hmi_ambient_sound_user_muted';

export type AmbientSoundConfig = AmbientSoundSupabaseConfig;

export function getLocalAmbientSoundConfig(): AmbientSoundConfig {
  const fallback: AmbientSoundConfig = {
    enabled: true,
    intensity: 0.45,
    updatedAt: '',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(AMBIENT_SOUND_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const numInt = Number(parsed?.intensity);
    return {
      enabled: Boolean(parsed?.enabled),
      intensity: Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : 0.4,
      updatedAt: String(parsed?.updatedAt || ''),
      updatedBy: parsed?.updatedBy ? String(parsed.updatedBy) : undefined,
    };
  } catch {
    return fallback;
  }
}

function isSameAmbientSoundConfig(a: AmbientSoundConfig, b: AmbientSoundConfig): boolean {
  return (
    Boolean(a.enabled) === Boolean(b.enabled) &&
    Math.abs((a.intensity ?? 0.4) - (b.intensity ?? 0.4)) < 0.005 &&
    (a.updatedAt || '') === (b.updatedAt || '')
  );
}

export function cacheLocalAmbientSoundConfig(
  config: AmbientSoundConfig,
  broadcast: boolean = false
): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getLocalAmbientSoundConfig();
    if (!isSameAmbientSoundConfig(prev, config)) {
      localStorage.setItem(AMBIENT_SOUND_STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new Event('hmi_ambient_sound_changed'));
    }
    if (broadcast && typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('hmi_maintenance_channel');
      ch.postMessage({ type: 'AMBIENT_SOUND_UPDATED', payload: config });
      ch.close();
    }
  } catch {
    // Ignore storage errors
  }
}

export async function fetchAmbientSoundConfigApi(): Promise<AmbientSoundConfig> {
  const [supabaseRes, apiRes] = await Promise.allSettled([
    fetchAmbientSoundFromSupabase(),
    fetch('/api/ambient-sound', { cache: 'no-store' }).then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      const numInt = Number(data?.intensity);
      return {
        enabled: Boolean(data?.enabled),
        intensity: Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : 0.4,
        updatedAt: String(data?.updatedAt || ''),
        updatedBy: data?.updatedBy ? String(data.updatedBy) : undefined,
      } as AmbientSoundConfig;
    }),
  ]);

  const candidates: AmbientSoundConfig[] = [];
  if (supabaseRes.status === 'fulfilled' && supabaseRes.value) {
    candidates.push(supabaseRes.value);
  }
  if (apiRes.status === 'fulfilled' && apiRes.value) {
    candidates.push(apiRes.value);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const latest = candidates[0];
    cacheLocalAmbientSoundConfig(latest);
    return latest;
  }

  return getLocalAmbientSoundConfig();
}

export async function saveAmbientSoundConfigApi(
  enabled: boolean,
  intensity: number,
  updatedBy: string = 'Administrador'
): Promise<AmbientSoundConfig> {
  const numInt = Number(intensity);
  const payload: AmbientSoundConfig = {
    enabled: Boolean(enabled),
    intensity: Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : 0.4,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  cacheLocalAmbientSoundConfig(payload, true);

  await Promise.all([
    saveAmbientSoundToSupabase(payload).catch((err) => {
      console.warn('Supabase ambient sound save warning:', err);
    }),
    fetch('/api/ambient-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}),
  ]);

  return payload;
}

export function getUserAmbientSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AMBIENT_SOUND_USER_MUTED_KEY) === 'true';
}

export function setUserAmbientSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AMBIENT_SOUND_USER_MUTED_KEY, muted ? 'true' : 'false');
  window.dispatchEvent(new Event('hmi_ambient_sound_mute_changed'));
}

// ==========================================
// 8C-2. USER PRESENCE & LAST SIGN-IN API
// ==========================================

const USER_PRESENCE_STORAGE_KEY = 'hmi_user_presence_map';

export type { UserPresenceRecord };

export function getLocalUserPresenceMap(): Record<string, UserPresenceRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USER_PRESENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function cacheLocalUserPresenceMap(
  presenceMap: Record<string, UserPresenceRecord>,
  broadcast: boolean = false
): void {
  if (typeof window === 'undefined' || !presenceMap || typeof presenceMap !== 'object') return;
  try {
    localStorage.setItem(USER_PRESENCE_STORAGE_KEY, JSON.stringify(presenceMap));
    window.dispatchEvent(new Event('hmi_presence_changed'));
    if (broadcast && typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('hmi_maintenance_channel');
      ch.postMessage({ type: 'PRESENCE_UPDATED', payload: presenceMap });
      ch.close();
    }
  } catch {
    // Ignore storage errors
  }
}

export async function fetchUserPresenceApi(): Promise<Record<string, UserPresenceRecord>> {
  try {
    const res = await fetch('/api/presence', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        cacheLocalUserPresenceMap(data);
        return data;
      }
    }
  } catch {
    // Fallback to local cache
  }
  return getLocalUserPresenceMap();
}

export async function reportUserPresenceHeartbeatApi(params: {
  profileId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  isAdmin?: boolean;
  event?: 'login' | 'heartbeat';
}): Promise<void> {
  const key = resolveCanonicalPresenceKey(params);
  if (key === 'unknown') return;

  const nowIso = new Date().toISOString();
  const localMap = getLocalUserPresenceMap();
  const existing = localMap[key];
  const updatedLocal: Record<string, UserPresenceRecord> = {
    ...localMap,
    [key]: {
      key,
      profileId: params.profileId || existing?.profileId,
      username: params.username || existing?.username,
      email: params.email || existing?.email,
      fullName: params.fullName || existing?.fullName,
      isAdmin: params.isAdmin || existing?.isAdmin,
      isOnline: true,
      lastLoginAt: params.event === 'login' || !existing?.lastLoginAt ? nowIso : existing.lastLoginAt,
      lastSeenAt: nowIso,
      updatedAt: nowIso,
    },
  };
  cacheLocalUserPresenceMap(updatedLocal, true);

  try {
    const res = await fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.presence && typeof json.presence === 'object') {
        cacheLocalUserPresenceMap(json.presence);
      }
    }
  } catch {
    // Keep optimistic local presence when offline
  }

  // Best-effort persist last_sign_in_at on login to Supabase profiles table if profileId exists
  if (params.event === 'login' && params.profileId && typeof navigator !== 'undefined' && navigator.onLine) {
    const targetProfileId = params.profileId;
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, details')
          .eq('id', targetProfileId)
          .maybeSingle();
        if (!data) return;
        const nextDetails = {
          ...(data.details && typeof data.details === 'object' ? data.details : {}),
          last_sign_in_at: nowIso,
          last_seen_at: nowIso,
        };
        await supabase
          .from('profiles')
          .update({ details: nextDetails, updated_at: nowIso })
          .eq('id', targetProfileId);
      } catch {
        // Best-effort only
      }
    })();
  }
}

export async function reportUserPresenceLogoutApi(params: {
  profileId?: string;
  username?: string;
  email?: string;
  isAdmin?: boolean;
}): Promise<void> {
  const key = resolveCanonicalPresenceKey(params);
  if (key === 'unknown') return;

  const nowIso = new Date().toISOString();
  const localMap = getLocalUserPresenceMap();
  const existing = localMap[key];
  if (existing) {
    cacheLocalUserPresenceMap(
      {
        ...localMap,
        [key]: {
          ...existing,
          isOnline: false,
          lastSeenAt: nowIso,
          updatedAt: nowIso,
        },
      },
      true
    );
  }

  try {
    const res = await fetch('/api/presence/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.presence && typeof json.presence === 'object') {
        cacheLocalUserPresenceMap(json.presence);
      }
    }
  } catch {
    // Best-effort
  }
}

export function sendUserPresenceBeaconLogout(params: {
  profileId?: string;
  username?: string;
  email?: string;
  isAdmin?: boolean;
}): void {
  if (typeof window === 'undefined') return;
  const key = resolveCanonicalPresenceKey(params);
  if (key === 'unknown') return;

  const payloadStr = JSON.stringify(params);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payloadStr], { type: 'application/json' });
      navigator.sendBeacon('/api/presence/logout', blob);
    } else {
      void fetch('/api/presence/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: payloadStr,
      });
    }
  } catch {
    // Ignore unload errors
  }
}

// ==========================================
// 8D. PANEL DE CONTROL GLOBAL & FULL BACKUP v3.2.0 HYDRATION
// ==========================================

const FULL_BACKUP_APPLIED_AT_KEY = 'hmi_full_backup_applied_at';
const PANEL_CONTROL_LOCAL_KEY = 'hmi_panel_control_cache';

export type { PanelControlSupabaseConfig, FullDatabaseBackupPayload };
export { FULL_BACKUP_CONFIG_KEY, PANEL_CONTROL_CONFIG_KEY };

export function getLocalPanelControlSnapshot(): PanelControlSupabaseConfig {
  if (typeof window === 'undefined') {
    return {
      seasonalTheme: 'navidad',
      autoVenezuelaMode: true,
      autoNightShiftMode: true,
      darkMode: 'dark',
    };
  }
  let cached: PanelControlSupabaseConfig = {};
  try {
    const raw = localStorage.getItem(PANEL_CONTROL_LOCAL_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  const autoVeRaw = localStorage.getItem(SEASONAL_AUTO_VE_STORAGE_KEY);
  const autoNightRaw = localStorage.getItem(SEASONAL_AUTO_NIGHT_STORAGE_KEY);
  const autoVe = autoVeRaw !== null ? autoVeRaw === 'true' : Boolean(cached.autoVenezuelaMode);
  const autoNight = autoNightRaw !== null ? autoNightRaw === 'true' : (cached.autoNightShiftMode ?? true);
  const storedTheme = localStorage.getItem('hmi_seasonal_theme');
  const resolvedTheme = isValidSeasonalStyle(storedTheme)
    ? storedTheme
    : isValidSeasonalStyle(cached.seasonalTheme)
    ? cached.seasonalTheme
    : detectVenezuelaCalendarStyle(new Date(), autoNight).style;

  const storedAdminPassword = localStorage.getItem(ADMIN_MASTER_PASSWORD_STORAGE_KEY);
  const storedAdminPasswordUpdatedAt = localStorage.getItem(ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY);

  return {
    ...cached,
    seasonalTheme: resolvedTheme,
    autoVenezuelaMode: autoVe,
    autoNightShiftMode: autoNight,
    seasonalOverlayConfig: readSeasonalOverlayConfig(),
    ambientSound: getLocalAmbientSoundConfig(),
    maintenanceMode: getLocalMaintenanceStatus(),
    darkMode: localStorage.getItem('hmi_dark_mode') || (typeof cached.darkMode === 'string' ? cached.darkMode : 'dark'),
    ...(storedAdminPassword && storedAdminPassword.trim().length >= 4
      ? {
          adminMasterPassword: storedAdminPassword.trim(),
          ...(storedAdminPasswordUpdatedAt ? { adminMasterPasswordUpdatedAt: storedAdminPasswordUpdatedAt } : {}),
        }
      : {}),
  };
}

export function applyPanelControlSettingsLocally(
  panelControl: PanelControlSupabaseConfig | null | undefined,
  options?: { broadcast?: boolean }
): PanelControlSupabaseConfig {
  if (!panelControl || typeof panelControl !== 'object' || typeof window === 'undefined') {
    return getLocalPanelControlSnapshot();
  }

  let themeChanged = false;

  // 1. Auto Venezuela & Night Shift flags
  if (typeof panelControl.autoVenezuelaMode === 'boolean') {
    const nextVal = panelControl.autoVenezuelaMode ? 'true' : 'false';
    if (localStorage.getItem(SEASONAL_AUTO_VE_STORAGE_KEY) !== nextVal) {
      localStorage.setItem(SEASONAL_AUTO_VE_STORAGE_KEY, nextVal);
      themeChanged = true;
    }
  }
  if (typeof panelControl.autoNightShiftMode === 'boolean') {
    const nextVal = panelControl.autoNightShiftMode ? 'true' : 'false';
    if (localStorage.getItem(SEASONAL_AUTO_NIGHT_STORAGE_KEY) !== nextVal) {
      localStorage.setItem(SEASONAL_AUTO_NIGHT_STORAGE_KEY, nextVal);
      themeChanged = true;
    }
  }

  // 2. Active Seasonal Style (e.g. 'navidad')
  const autoVeNow = isSeasonalAutoVenezuelaEnabled();
  const autoNightNow = isSeasonalAutoNightEnabled();
  const desiredTheme = isValidSeasonalStyle(panelControl.seasonalTheme)
    ? panelControl.seasonalTheme
    : autoVeNow
    ? detectVenezuelaCalendarStyle(new Date(), autoNightNow).style
    : undefined;

  if (desiredTheme) {
    const effectiveTheme = autoVeNow
      ? detectVenezuelaCalendarStyle(new Date(), autoNightNow).style
      : desiredTheme;
    if (localStorage.getItem('hmi_seasonal_theme') !== effectiveTheme) {
      localStorage.setItem('hmi_seasonal_theme', effectiveTheme);
      themeChanged = true;
    }
    document.documentElement.setAttribute('data-seasonal', effectiveTheme);
    syncDynamicPwaIcons(effectiveTheme);
  } else if (autoVeNow) {
    const detected = detectVenezuelaCalendarStyle(new Date(), autoNightNow).style;
    if (localStorage.getItem('hmi_seasonal_theme') !== detected) {
      localStorage.setItem('hmi_seasonal_theme', detected);
      themeChanged = true;
    }
    document.documentElement.setAttribute('data-seasonal', detected);
    syncDynamicPwaIcons(detected);
  }

  if (themeChanged) {
    window.dispatchEvent(new Event('hmi_seasonal_theme_changed'));
  }

  // 3. Seasonal Overlay Config (falling icons, opacity, count, speed)
  if (panelControl.seasonalOverlayConfig && typeof panelControl.seasonalOverlayConfig === 'object') {
    const currentOverlay = readSeasonalOverlayConfig();
    const incomingJson = JSON.stringify(panelControl.seasonalOverlayConfig);
    const currentJson = JSON.stringify(currentOverlay);
    if (incomingJson !== currentJson) {
      saveSeasonalOverlayConfig({
        ...currentOverlay,
        ...(panelControl.seasonalOverlayConfig as any),
      });
    }
  }

  // 4. Ambient Sound (override if incoming has newer or valid timestamp when local has none or differs)
  if (panelControl.ambientSound && typeof panelControl.ambientSound === 'object') {
    const localSound = getLocalAmbientSoundConfig();
    const inSoundTs = String(panelControl.ambientSound.updatedAt || panelControl.updatedAt || '');
    const numInt = Number(panelControl.ambientSound.intensity);
    const resolvedInt = Number.isFinite(numInt) ? Math.min(1, Math.max(0.05, numInt)) : localSound.intensity;
    const nextSoundPayload: AmbientSoundConfig = {
      enabled: Boolean(panelControl.ambientSound.enabled),
      intensity: resolvedInt,
      updatedAt: inSoundTs || new Date().toISOString(),
      updatedBy: panelControl.ambientSound.updatedBy,
    };
    const inMs = parseConfigTimestampMs(inSoundTs);
    const localMs = parseConfigTimestampMs(localSound.updatedAt);
    if (
      !localSound.updatedAt ||
      inMs > localMs ||
      (inMs === localMs && !isSameAmbientSoundConfig(localSound, nextSoundPayload))
    ) {
      cacheLocalAmbientSoundConfig(nextSoundPayload);
    }
  }

  // 5. Maintenance Mode
  if (panelControl.maintenanceMode && typeof panelControl.maintenanceMode === 'object') {
    const localMaint = getLocalMaintenanceStatus();
    const inMaintTs = String(panelControl.maintenanceMode.updatedAt || panelControl.updatedAt || '');
    const inMs = parseConfigTimestampMs(inMaintTs);
    const localMs = parseConfigTimestampMs(localMaint.updatedAt);
    if (!localMaint.updatedAt || inMs > localMs) {
      cacheLocalMaintenanceStatus({
        enabled: Boolean(panelControl.maintenanceMode.enabled),
        message: String(panelControl.maintenanceMode.message || DEFAULT_MAINTENANCE_MESSAGE),
        updatedAt: inMaintTs || new Date().toISOString(),
        updatedBy: panelControl.maintenanceMode.updatedBy,
      });
    }
  }

  // 6. Dark / Light mode
  if (panelControl.darkMode !== undefined) {
    const modeStr =
      panelControl.darkMode === true || panelControl.darkMode === 'dark'
        ? 'dark'
        : panelControl.darkMode === false || panelControl.darkMode === 'light'
        ? 'light'
        : null;
    if (modeStr && localStorage.getItem('hmi_dark_mode') !== modeStr) {
      localStorage.setItem('hmi_dark_mode', modeStr);
      if (modeStr === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new Event('hmi_dark_mode_changed'));
    }
  }

  // 7. Admin master password (sync latest password rotation & invalidate older passwords)
  applyRemoteAdminPasswordIfNewer(
    panelControl.adminMasterPassword,
    panelControl.adminMasterPasswordUpdatedAt || panelControl.updatedAt
  );

  const localSnap = getLocalPanelControlSnapshot();
  const normalizedSnapshot: PanelControlSupabaseConfig = {
    ...localSnap,
    updatedAt: String(panelControl.updatedAt || new Date().toISOString()),
    updatedBy: panelControl.updatedBy || 'Administrador',
  };
  if (panelControl.darkMode === undefined) {
    delete normalizedSnapshot.darkMode;
  }

  try {
    localStorage.setItem(PANEL_CONTROL_LOCAL_KEY, JSON.stringify(normalizedSnapshot));
  } catch {}

  if (options?.broadcast && typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel('hmi_maintenance_channel');
      ch.postMessage({ type: 'PANEL_CONTROL_UPDATED', payload: normalizedSnapshot });
      ch.close();
    } catch {}
  }

  return normalizedSnapshot;
}

export async function fetchPanelControlApi(): Promise<PanelControlSupabaseConfig> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getLocalPanelControlSnapshot();
  }
  try {
    const [supabaseRes, apiRes] = await Promise.allSettled([
      fetchPanelControlFromSupabase(),
      fetch('/api/panel-control', { cache: 'no-store' }).then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || typeof data !== 'object') return null;
        return data as PanelControlSupabaseConfig;
      }),
    ]);

    const remoteCandidates: PanelControlSupabaseConfig[] = [];
    if (supabaseRes.status === 'fulfilled' && supabaseRes.value) {
      remoteCandidates.push(supabaseRes.value);
    }
    if (apiRes.status === 'fulfilled' && apiRes.value) {
      remoteCandidates.push(apiRes.value);
    }

    const latestRemote = pickLatestPanelControl(remoteCandidates);
    if (latestRemote) {
      let localParsed: PanelControlSupabaseConfig | null = null;
      try {
        const localRaw = localStorage.getItem(PANEL_CONTROL_LOCAL_KEY);
        if (localRaw) localParsed = JSON.parse(localRaw) as PanelControlSupabaseConfig;
      } catch {}

      const remoteMs = parseConfigTimestampMs(latestRemote.updatedAt);
      const localMs = parseConfigTimestampMs(localParsed?.updatedAt);
      if (!localParsed?.updatedAt || remoteMs > localMs) {
        return applyPanelControlSettingsLocally(latestRemote);
      }
      return localParsed;
    }
  } catch {}
  return getLocalPanelControlSnapshot();
}

export async function savePanelControlApi(
  patch: Partial<PanelControlSupabaseConfig>
): Promise<PanelControlSupabaseConfig> {
  const current = getLocalPanelControlSnapshot();
  const next = buildNextPanelControlState(current, patch, new Date().toISOString());

  applyPanelControlSettingsLocally(next, { broadcast: true });

  const [apiResult] = await Promise.allSettled([
    fetch('/api/panel-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.panelControl || null) as PanelControlSupabaseConfig | null;
    }),
    savePanelControlToSupabase(next).catch((err) => {
      console.warn('Warning saving panel control to Supabase:', err);
    }),
  ]);

  if (apiResult.status === 'fulfilled' && apiResult.value) {
    return applyPanelControlSettingsLocally(apiResult.value);
  }

  return next;
}

function extractNormalizedDataFromBackup(backup: FullDatabaseBackupPayload): {
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  guardias: RolGuardiasData | null;
  patientsMeta: Record<string, PatientClinicalMetaEntry>;
  evolutionsCount: number;
} {
  const tables = backup.tables || {};
  const metaMap: Record<string, PatientClinicalMetaEntry> =
    tables.patientsClinicalMeta && typeof tables.patientsClinicalMeta === 'object'
      ? tables.patientsClinicalMeta
      : {};

  const flatEvolutions: MedicalEvolution[] = Array.isArray(tables.evolutions)
    ? tables.evolutions
        .map(normalizeEvolutionFromAny)
        .filter((e): e is MedicalEvolution => Boolean(e))
    : [];

  const patients: Patient[] = Array.isArray(tables.patients)
    ? tables.patients
        .map(raw => normalizePatientFromAny(raw, flatEvolutions, metaMap))
        .filter((p): p is Patient => Boolean(p))
    : [];

  const beds: Bed[] = Array.isArray(tables.beds)
    ? tables.beds
        .map(normalizeBedFromAny)
        .filter((b): b is Bed => Boolean(b))
    : [];

  const historias: HistoriaClinicaPediatrica[] = Array.isArray(tables.historias)
    ? tables.historias
        .map(normalizeHistoriaFromAny)
        .filter((h): h is HistoriaClinicaPediatrica => Boolean(h))
    : [];

  const tasks: PersonalTask[] = Array.isArray(tables.tasks)
    ? tables.tasks
        .map(normalizeTaskFromAny)
        .filter((t): t is PersonalTask => Boolean(t))
    : [];

  const guardias: RolGuardiasData | null =
    tables.guardias && Array.isArray(tables.guardias.grupos)
      ? normalizeGuardiasData(tables.guardias)
      : null;

  return {
    patients,
    beds,
    historias,
    tasks,
    guardias,
    patientsMeta: metaMap,
    evolutionsCount: flatEvolutions.length,
  };
}

async function hydrateSideStoresFromBackup(backup: FullDatabaseBackupPayload): Promise<void> {
  const tables = backup.tables || {};

  // 1. User profiles cache
  if (Array.isArray(tables.profiles) && tables.profiles.length > 0) {
    try {
      const existingRaw = localStorage.getItem('hmi_user_profiles_cache');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const map = new Map<string, any>();
      for (const p of Array.isArray(existing) ? existing : []) if (p?.id) map.set(p.id, p);
      for (const p of tables.profiles) {
        if (!p?.id) continue;
        const prev = map.get(p.id);
        if (!prev || (p.updated_at || '') >= (prev.updated_at || '')) {
          map.set(p.id, p);
        }
      }
      localStorage.setItem('hmi_user_profiles_cache', JSON.stringify(Array.from(map.values())));
    } catch {}
  }

  // 2. Activity Logs (max 100)
  if (Array.isArray(tables.activityLogs) && tables.activityLogs.length > 0) {
    try {
      importActivityLogs(tables.activityLogs, false);
    } catch {}
  }

  // 3. Maintenance & Ambient Sound snapshots from tables (fallback if not inside panelControl)
  if (tables.maintenanceStatus && typeof tables.maintenanceStatus === 'object') {
    const localMaint = getLocalMaintenanceStatus();
    const inTs = String(tables.maintenanceStatus.updatedAt || '');
    if (!localMaint.updatedAt || inTs > localMaint.updatedAt) {
      cacheLocalMaintenanceStatus(tables.maintenanceStatus);
    }
  }
  if (tables.ambientSoundConfig && typeof tables.ambientSoundConfig === 'object') {
    const localSound = getLocalAmbientSoundConfig();
    const inTs = String(tables.ambientSoundConfig.updatedAt || '');
    if (!localSound.updatedAt || inTs > localSound.updatedAt) {
      cacheLocalAmbientSoundConfig(tables.ambientSoundConfig);
    }
  }

  // 4. Drafts (IndexedDB + localStorage) — only fill missing keys to preserve newer active local edits
  if (tables.drafts && typeof tables.drafts === 'object') {
    for (const [k, val] of Object.entries(tables.drafts)) {
      try {
        if (k.startsWith('idb:')) {
          const idbKey = k.slice(4);
          const existing = await draftsStore.getItem(idbKey);
          if (!existing && val !== null && val !== undefined) {
            await draftsStore.setItem(idbKey, val);
          }
        } else if (k.startsWith('ls:')) {
          const lsKey = k.slice(3);
          if (!localStorage.getItem(lsKey) && val !== null && val !== undefined) {
            localStorage.setItem(lsKey, typeof val === 'string' ? val : JSON.stringify(val));
          }
        }
      } catch {}
    }
  }

  // 5. AutoBackups snapshots (merge up to 10)
  if (Array.isArray(tables.autoBackups) && tables.autoBackups.length > 0) {
    try {
      const existing = (await backupsStore.getItem<any[]>('snapshots')) || [];
      const map = new Map<string, any>();
      for (const s of [...existing, ...tables.autoBackups]) {
        if (s?.id && !map.has(s.id)) map.set(s.id, s);
      }
      const merged = Array.from(map.values())
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 10);
      await backupsStore.setItem('snapshots', merged);
    } catch {}
  }

  // 6. Buzón de Sugerencias (merge suggestions from backup if present)
  const backupSuggestions = Array.isArray((tables as any).suggestions)
    ? (tables as any).suggestions
    : Array.isArray((backup as any).buzonSugerencias)
    ? (backup as any).buzonSugerencias
    : [];
  if (backupSuggestions.length > 0 && typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem('hmi_page_suggestions');
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const map = new Map<string, any>();
      for (const item of [...backupSuggestions, ...(Array.isArray(existingList) ? existingList : [])]) {
        if (item?.id) map.set(item.id, item);
      }
      const mergedSuggestions = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      localStorage.setItem('hmi_page_suggestions', JSON.stringify(mergedSuggestions));
      window.dispatchEvent(new Event('hmi_suggestions_updated'));
    } catch {}
  }
}

export async function syncFullDatabaseBackupFromSupabase(options?: {
  forceApply?: boolean;
  seedLiveTables?: boolean;
}): Promise<{
  applied: boolean;
  version?: string;
  updatedAt?: string;
  patients: Patient[];
  beds: Bed[];
  historias: HistoriaClinicaPediatrica[];
  tasks: PersonalTask[];
  guardias: RolGuardiasData;
  panelControl?: PanelControlSupabaseConfig;
}> {
  const [cachedPatients, cachedBeds, cachedHistorias, cachedTasks, cachedGuardias] = await Promise.all([
    getPatientsFromIDB(),
    getBedsFromIDB(),
    getHistoriasFromIDB(),
    getTasksFromIDB(),
    getGuardiasFromIDB(),
  ]);

  const remoteBackup = await fetchFullDatabaseBackupFromSupabase();
  if (!remoteBackup?.payload) {
    return {
      applied: false,
      patients: cachedPatients,
      beds: cachedBeds.length > 0 ? cachedBeds : INITIAL_BEDS,
      historias: cachedHistorias,
      tasks: cachedTasks,
      guardias: cachedGuardias,
    };
  }

  const effectiveTs = remoteBackup.updatedAt || remoteBackup.payload.timestamp || new Date().toISOString();
  const lastAppliedAt =
    typeof window !== 'undefined' ? (localStorage.getItem(FULL_BACKUP_APPLIED_AT_KEY) || '') : '';

  if (!options?.forceApply && lastAppliedAt && effectiveTs <= lastAppliedAt && cachedPatients.length > 0) {
    return {
      applied: false,
      version: remoteBackup.payload.version,
      updatedAt: effectiveTs,
      patients: cachedPatients,
      beds: cachedBeds.length > 0 ? cachedBeds : INITIAL_BEDS,
      historias: cachedHistorias,
      tasks: cachedTasks,
      guardias: cachedGuardias,
    };
  }

  const extracted = extractNormalizedDataFromBackup(remoteBackup.payload);
  await hydrateSideStoresFromBackup(remoteBackup.payload);

  // Merge with live/cached clinical records (preserving any records with newer updatedAt)
  const queue = await getOfflineQueueFromIDB();
  const mergedPatients =
    extracted.patients.length > 0
      ? mergePatientsWithLocalAndQueue(extracted.patients, cachedPatients, queue, extracted.patientsMeta)
      : cachedPatients;

  const finalBeds = extracted.beds.length > 0 ? mergeByUpdatedAt(extracted.beds, cachedBeds) : cachedBeds;
  const finalHistorias =
    extracted.historias.length > 0 ? mergeByUpdatedAt(extracted.historias, cachedHistorias) : cachedHistorias;
  const finalTasks =
    extracted.tasks.length > 0 ? mergeByUpdatedAt(extracted.tasks, cachedTasks) : cachedTasks;
  const finalGuardias = extracted.guardias || cachedGuardias;

  await Promise.all([
    mergedPatients.length > 0 ? savePatientsToIDB(mergedPatients) : Promise.resolve(),
    finalBeds.length > 0 ? saveBedsToIDB(finalBeds) : Promise.resolve(),
    finalHistorias.length > 0 ? saveHistoriasToIDB(finalHistorias) : Promise.resolve(),
    finalTasks.length > 0 ? saveTasksToIDB(finalTasks) : Promise.resolve(),
    extracted.guardias ? saveGuardiasToIDB(extracted.guardias) : Promise.resolve(),
  ]);

  let appliedPanel: PanelControlSupabaseConfig | undefined;
  if (remoteBackup.payload.panelControl) {
    appliedPanel = applyPanelControlSettingsLocally(
      {
        ...remoteBackup.payload.panelControl,
        updatedAt: remoteBackup.payload.panelControl.updatedAt || effectiveTs,
      },
      { broadcast: true }
    );
  }

  if (options?.seedLiveTables !== false && typeof navigator !== 'undefined' && navigator.onLine) {
    Promise.allSettled([
      mergedPatients.length > 0 ? savePatientsBatchToSupabase(mergedPatients) : Promise.resolve(),
      ...mergedPatients.map(p =>
        p.evolutions?.length ? saveEvolutionsBatchToSupabase(p.evolutions) : Promise.resolve()
      ),
      finalBeds.length > 0 ? saveBedsToSupabase(finalBeds) : Promise.resolve(),
      finalHistorias.length > 0 ? saveHistoriasBatchToSupabase(finalHistorias) : Promise.resolve(),
      finalTasks.length > 0 ? saveTasksToSupabase(finalTasks) : Promise.resolve(),
      extracted.guardias ? saveGuardiasToSupabase(extracted.guardias, GUARDIAS_CONFIG_KEY) : Promise.resolve(),
      savePatientsMetaToSupabase(mergedPatients),
      appliedPanel ? savePanelControlToSupabase(appliedPanel) : Promise.resolve(),
    ]).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(FULL_BACKUP_APPLIED_AT_KEY, effectiveTs);
  }

  return {
    applied: true,
    version: remoteBackup.payload.version || '3.2.0',
    updatedAt: effectiveTs,
    patients: mergedPatients,
    beds: finalBeds,
    historias: finalHistorias,
    tasks: finalTasks,
    guardias: finalGuardias,
    panelControl: appliedPanel,
  };
}

export async function pushFullDatabaseBackupToSupabase(
  backupPayload: FullDatabaseBackupPayload
): Promise<{ version: string; updatedAt: string }> {
  const res = await saveFullDatabaseBackupToSupabase(backupPayload);
  if (typeof window !== 'undefined') {
    localStorage.setItem(FULL_BACKUP_APPLIED_AT_KEY, res.updatedAt);
  }
  if (backupPayload.panelControl) {
    await savePanelControlApi(backupPayload.panelControl);
  }
  return {
    version: res.payload.version || '3.2.0',
    updatedAt: res.updatedAt,
  };
}

// Also export saveActivityLogsToSupabase usage to keep imports clean if needed
export { saveActivityLogsToSupabase };

// ==========================================
// 9. CLINICAL HELPERS
// ==========================================

export function calculateHospitalizationTime(admissionDateStr: string, admissionTimeStr: string = '08:00'): {
  totalHours: number;
  days: number;
  remainingHours: number;
  minutes: number;
  formatted: string;
} {
  try {
    const [year, month, day] = admissionDateStr.split('-').map(Number);
    const [hours, minutes] = (admissionTimeStr || '08:00').split(':').map(Number);

    const admissionDate = new Date(year, month - 1, day, hours || 0, minutes || 0);
    const now = new Date();

    const diffMs = Math.max(0, now.getTime() - admissionDate.getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);

    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;

    let formatted = '';
    if (days === 0) {
      if (remainingHours === 0) {
        formatted = `${remainingMinutes}m (Ingreso reciente)`;
      } else {
        formatted = `${remainingHours}h ${remainingMinutes}m (Día 1)`;
      }
    } else if (days === 1) {
      formatted = `1 día, ${remainingHours}h`;
    } else {
      formatted = `${days} días, ${remainingHours}h`;
    }

    return { totalHours, days, remainingHours, minutes: remainingMinutes, formatted };
  } catch {
    return { totalHours: 0, days: 0, remainingHours: 0, minutes: 0, formatted: '1 día' };
  }
}

export function generateWhatsAppReport(patients: Patient[], areas: HospitalArea[]): string {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dateStr = now.toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

  const activePatients = patients.filter(p => p.status === 'hospitalized');
  const ingresosJornada = patients.filter(p => p.admissionDate === todayStr).length;
  const egresosJornada = patients.filter(p => p.status === 'discharged' && p.dischargeDate === todayStr).length;

  let report = `🏥 *HOSPITAL MATERNO INFANTIL* 🏥\n`;
  report += `👶 *SERVICIO DE PEDIATRÍA* 👶\n`;
  report += `🗓️ *Fecha:* ${dateStr}  ⏰ *Hora:* ${timeStr}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  areas.forEach(area => {
    const areaPatients = activePatients.filter(p => p.area === area);
    const areaEmoji = area === 'Traumashock' ? '⚡🚨' : area === 'Respiratorio' ? '🫁🌬️' : area === 'Aislamiento' ? '🛡️☣️' : area === 'ÁREA DE OBSERVACIÓN' ? '🔍⏰' : '🛏️🏥';
    
    if (areaPatients.length > 0) {
      report += `${areaEmoji} *ÁREA: ${area.toUpperCase()}* (${areaPatients.length} pac.) ${areaEmoji}\n`;

      areaPatients.forEach((p, idx) => {
        const timeCalc = calculateHospitalizationTime(p.admissionDate, p.admissionTime);
        
        report += `\n*${idx + 1}. 👶 ${p.firstName} ${p.lastName}* 🛏️ *(${p.bedNumber})*\n`;
        report += `  📄 *H.C.:* ${p.medicalHistoryNumber} | \n`;
        report += ` 👤 *Edad:* ${p.age} | \n`;
        report += ` 🚻 *Sexo:* ${p.gender}\n`;
        report += ` ⚖️ *Peso:* ${p.weightKg} kg\n`;
        report += `  ⏱️ *Estancia:* ${timeCalc.formatted} \n`;
        
        if (timeCalc.days >= 7) {
          report += `⚠️ *(Hospitalización Prolongada ≥7D)*\n`;
        }
        
        report += `\n  📌 *Diagnósticos:* \n`;
        if (p.diagnoses && p.diagnoses.length > 0) {
          p.diagnoses.forEach((diag, dIdx) => {
            report += `     \u{1FA7A} ${dIdx + 1}. ${diag.title}\n`;
            if (diag.subDiagnoses && diag.subDiagnoses.length > 0) {
              diag.subDiagnoses.forEach((sub, sIdx) => {
                report += `     \u{1FA7A} ${dIdx + 1}.${sIdx + 1} ${sub}\n`;
              });
            }
          });
        } else {
          report += `     \u{1FA7A} 1. En evaluación clínica\n`;
        }

        report += `\n  💊 *Tratamiento / Esquema:* \n`;
        if (p.treatment && p.treatment.trim()) {
          const tLines = p.treatment
            .split(/\r?\n|;/)
            .map(line => line.trim())
            .filter(Boolean);
          if (tLines.length > 0) {
            tLines.forEach((tLine, tIdx) => {
              const cleanItem = tLine.replace(/^\d+[\.\-\)]\s*/, '').trim();
              report += `         ${tIdx + 1}. ${cleanItem}\n`;
            });
          } else {
            report += `         1. ${p.treatment.trim()}\n`;
          }
        } else {
          report += `         1. Hidratación parenteral / En evaluación médica\n`;
        }
      });
      report += `\n`;
    }
  });

  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `📥 Ingresos de la jornada: ${ingresosJornada} 👶\n`;
  report += `📤 Egresos de la jornada: ${egresosJornada} 🏥\n`;
  report += `📊 Total Pacientes Hospitalizados: ${activePatients.length} 👶\n`;

  return report;
}
