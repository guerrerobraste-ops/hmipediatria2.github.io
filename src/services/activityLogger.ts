import { fetchActivityLogsFromSupabase, saveActivityLogsToSupabase } from '../lib/supabase';

/**
 * Activity & Audit Logger for Database and Clinical Actions
 * Tracks mutations across 'patients', 'evolutions', 'beds', 'historias', 'tasks', and doctor administration.
 * Enforces a strict maximum of 100 entries (auto-purging oldest beyond 100) and syncs with Supabase system_configs.
 */

export type ActivityModule = 'pacientes' | 'evoluciones' | 'camas' | 'historias' | 'tareas' | 'doctores' | 'seguridad';
export type ActivityAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'AUTH' | 'STATUS_CHANGE';
export type ActivitySeverity = 'info' | 'success' | 'warning' | 'danger';
export type ActivityEntityType = 'patient' | 'patient_change' | 'evolution' | 'historia' | 'task' | 'doctor' | 'beds' | 'guardias' | 'backup';
export type ActivityChangeCategory =
  | 'evolucion'
  | 'ingreso'
  | 'alta'
  | 'traslado'
  | 'reingreso'
  | 'edicion_clinica'
  | 'historia'
  | 'eliminacion';

export interface ActivityLog {
  id: string;
  timestamp: string;
  dateFormatted: string;
  module: ActivityModule;
  action: ActivityAction;
  changeCategory?: ActivityChangeCategory;
  user: string;
  description: string;
  details?: Record<string, any>;
  severity?: ActivitySeverity;
  reverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
}

const STORAGE_KEY = 'hmi_database_activity_logs_v1';
export const MAX_LOGS = 100;

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCloudSync(logs: ActivityLog[]): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    saveActivityLogsToSupabase(logs.slice(0, MAX_LOGS)).catch(() => {});
  }, 800);
}

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('es-VE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoStr;
  }
}

export function isJunkActivityLog(item: Partial<ActivityLog> | null | undefined): boolean {
  if (!item) return true;
  if (typeof item.id === 'string' && item.id.startsWith('log-seed-')) return true;
  if (item.module === 'seguridad' || item.action === 'AUTH') return true;
  const desc = (item.description || '').trim();
  if (!desc) return true;
  if (
    /distribución de camas actualizada/i.test(desc) ||
    /sembrado inicial/i.test(desc) ||
    /conexión inicial establecida/i.test(desc) ||
    /sincronización de censo/i.test(desc) ||
    /plantilla de historia clínica pediátrica oficial/i.test(desc) ||
    /estilo visual global cambiado/i.test(desc) ||
    /acceso autorizado concedido/i.test(desc) ||
    /intento fallido de acceso/i.test(desc) ||
    /sesión de administrador bloqueada/i.test(desc) ||
    /exportación completa de la base de datos/i.test(desc) ||
    /rol de guardias actualizado para/i.test(desc)
  ) {
    return true;
  }
  // Ignore non-specific bed status updates without a revertible patient/bed snapshot
  if (item.module === 'camas' && !item.changeCategory && !item.details?.beforeSnapshot && !item.details?.snapshot) {
    return true;
  }
  return false;
}

export function sanitizeSnapshotForLog(entityType: ActivityEntityType, payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  try {
    const clone = JSON.parse(JSON.stringify(payload));
    if (entityType === 'patient' || entityType === 'patient_change') {
      if (Array.isArray(clone.documents)) {
        clone.documents = clone.documents.map((doc: any) => ({
          ...doc,
          dataUrl: typeof doc?.dataUrl === 'string' && doc.dataUrl.length > 12000 ? '' : doc?.dataUrl
        }));
      }
      // Keep recent 15 evolutions in patient snapshot to keep log size compact while enabling clean reverts
      if (Array.isArray(clone.evolutions) && clone.evolutions.length > 15) {
        clone.evolutions = clone.evolutions.slice(0, 15);
      }
    }
    return clone;
  } catch {
    return payload;
  }
}

function persistLogsLocally(logs: ActivityLog[]): ActivityLog[] {
  const capped = logs.slice(0, MAX_LOGS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Quota fallback: drop heavy afterSnapshot first, then old snapshots (>25) so recent beforeSnapshots always stay intact for revert
    try {
      const compacted = capped.map((item, idx) => {
        if (item.details) {
          const nextDetails = { ...item.details };
          if (nextDetails.afterSnapshot) {
            delete nextDetails.afterSnapshot;
          }
          if (idx >= 25) {
            delete nextDetails.snapshot;
            delete nextDetails.beforeSnapshot;
          }
          return { ...item, details: nextDetails };
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
      return compacted;
    } catch (innerErr) {
      console.warn('Could not save activity logs to localStorage:', innerErr);
    }
  }
  return capped;
}

function normalizeAndCapLogs(list: any[]): ActivityLog[] {
  const byId = new Map<string, ActivityLog>();
  for (const item of list) {
    if (!item || !item.id) continue;
    if (isJunkActivityLog(item)) continue;
    if (!byId.has(item.id)) {
      byId.set(item.id, {
        ...item,
        timestamp: item.timestamp || new Date().toISOString(),
        dateFormatted: item.dateFormatted || formatTimestamp(item.timestamp || new Date().toISOString()),
        user: item.user || 'Médico',
        description: item.description || ''
      });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, MAX_LOGS);
}

export function getActivityLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const cleaned = normalizeAndCapLogs(parsed);
    if (cleaned.length !== parsed.length || parsed.length > MAX_LOGS) {
      return persistLogsLocally(cleaned);
    }
    return cleaned;
  } catch (err) {
    console.error('Error reading activity logs from storage:', err);
    return [];
  }
}

export function logDatabaseActivity(
  entry: Omit<ActivityLog, 'id' | 'timestamp' | 'dateFormatted'>
): ActivityLog {
  const now = new Date().toISOString();
  const newLog: ActivityLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    timestamp: now,
    dateFormatted: formatTimestamp(now),
    module: entry.module,
    action: entry.action,
    changeCategory: entry.changeCategory,
    user: entry.user || 'Dr. Brayan',
    description: entry.description,
    details: entry.details,
    severity: entry.severity || (entry.action === 'DELETE' ? 'danger' : entry.action === 'INSERT' ? 'success' : 'info')
  };

  if (isJunkActivityLog(newLog)) {
    return newLog;
  }

  try {
    const existing = getActivityLogs();
    const updated = persistLogsLocally([newLog, ...existing].slice(0, MAX_LOGS));
    scheduleCloudSync(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hmi_activity_logged', { detail: newLog }));
    }
  } catch (err) {
    console.warn('Could not save activity log:', err);
  }

  return newLog;
}

export function markActivityLogReverted(logId: string, revertedBy: string = 'Administrador'): ActivityLog[] {
  const current = getActivityLogs();
  const updated = current.map(item =>
    item.id === logId
      ? { ...item, reverted: true, revertedAt: new Date().toISOString(), revertedBy }
      : item
  );
  const saved = persistLogsLocally(updated);
  scheduleCloudSync(saved);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hmi_activity_logged', { detail: null }));
  }
  return saved;
}

export function importActivityLogs(incomingLogs: any[], replace: boolean = false): ActivityLog[] {
  if (!Array.isArray(incomingLogs)) return getActivityLogs();
  const current = replace ? [] : getActivityLogs();
  const merged = normalizeAndCapLogs([...incomingLogs, ...current]);
  const saved = persistLogsLocally(merged);
  scheduleCloudSync(saved);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hmi_activity_logged', { detail: null }));
  }
  return saved;
}

export async function syncActivityLogsWithSupabase(): Promise<ActivityLog[]> {
  const local = getActivityLogs();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return local;
  }
  try {
    const remote = await fetchActivityLogsFromSupabase();
    if (!remote) {
      if (local.length > 0) {
        await saveActivityLogsToSupabase(local.slice(0, MAX_LOGS));
      }
      return local;
    }
    const merged = normalizeAndCapLogs([...local, ...remote]);
    const saved = persistLogsLocally(merged);
    if (merged.length !== remote.length || merged[0]?.id !== remote[0]?.id) {
      await saveActivityLogsToSupabase(saved);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hmi_activity_logged', { detail: null }));
    }
    return saved;
  } catch {
    return local;
  }
}

export function clearActivityLogs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    if (typeof navigator === 'undefined' || navigator.onLine) {
      saveActivityLogsToSupabase([]).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hmi_activity_logged', { detail: null }));
    }
  } catch (err) {
    console.error('Error clearing activity logs:', err);
  }
}

function triggerBlobDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportLogsAsJson(): void {
  const logs = getActivityLogs().slice(0, MAX_LOGS);
  triggerBlobDownload(
    JSON.stringify(logs, null, 2),
    'application/json;charset=utf-8',
    `auditoria_bd_hmi_${new Date().toISOString().split('T')[0]}.json`
  );
}

export function exportLogsAsCsv(): void {
  const logs = getActivityLogs().slice(0, MAX_LOGS);
  const headers = ['ID', 'Fecha y Hora', 'Modulo', 'Accion', 'Usuario', 'Descripcion', 'Severidad'];
  const rows = logs.map(l => [
    l.id,
    `"${l.dateFormatted}"`,
    l.module,
    l.action,
    `"${(l.user || '').replace(/"/g, '""')}"`,
    `"${(l.description || '').replace(/"/g, '""')}"`,
    l.severity || 'info'
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  triggerBlobDownload(
    csvContent,
    'text/csv;charset=utf-8',
    `auditoria_bd_hmi_${new Date().toISOString().split('T')[0]}.csv`
  );
}

