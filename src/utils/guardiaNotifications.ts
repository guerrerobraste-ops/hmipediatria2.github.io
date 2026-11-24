import type { RolGuardiasData, GuardiaGroup } from '../types';
import { getVenezuelaNowParts } from './seasonalTheme';

export type GuardiaNotificationSource = 'scheduled_12pm' | 'admin_broadcast' | 'admin_test';

export interface GuardiaNotificationMemberSummary {
  nombre: string;
  rol: string;
  area?: string;
}

export interface GuardiaNotificationGroupSummary {
  id: string;
  nombreGrupo: string;
  icon: string;
  color: string;
  jefeGuardia?: string;
  areas: string[];
  miembros: GuardiaNotificationMemberSummary[];
}

export interface GuardiaNotificationPayload {
  id: string;
  source: GuardiaNotificationSource;
  title: string;
  subtitle: string;
  customMessage?: string;
  dayNumber: number;
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // e.g., "Lunes, 23 de Noviembre de 2026"
  timeLabel: string; // e.g., "12:00 PM"
  hospital: string;
  servicio: string;
  groups: GuardiaNotificationGroupSummary[];
  sentBy?: string;
  createdAt: string; // ISO timestamp
}

export const GUARDIA_12PM_SHOWN_DATE_KEY = 'hmi_guardia_12pm_shown_date';
export const GUARDIA_LAST_BROADCAST_ID_KEY = 'hmi_guardia_last_broadcast_id';
export const GUARDIA_LOCAL_NOTIFICATION_CACHE_KEY = 'hmi_guardia_latest_notification_cache';
export const MAX_BROADCAST_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const FALLBACK_GROUP_ICONS: Record<string, string> = {
  teal: '🌡️',
  cyan: '💊',
  amber: '🩺',
  indigo: '🏥',
  emerald: '👶',
  rose: '💙',
};

export function resolveNotificationGroupIcon(group: Pick<GuardiaGroup, 'icon' | 'color' | 'nombreGrupo'>): string {
  if (group.icon && group.icon.trim()) return group.icon.trim();
  const colorKey = (group.color || '').toLowerCase();
  if (FALLBACK_GROUP_ICONS[colorKey]) return FALLBACK_GROUP_ICONS[colorKey];
  const lower = (group.nombreGrupo || '').toLowerCase();
  if (lower.includes('vi') || lower.includes('6')) return '💙';
  if (lower.includes('iv') || lower.includes('4')) return '🏥';
  if (lower.includes('iii') || lower.includes('3')) return '🩺';
  if (lower.includes('ii') || lower.includes('2')) return '💊';
  if (lower.includes('v') || lower.includes('5')) return '👶';
  return '🌡️';
}

export function formatGuardiaDateLabel(year: number, month: number, day: number): string {
  const safeMonth = Math.max(1, Math.min(12, Math.floor(month || 1)));
  const safeDay = Math.max(1, Math.min(31, Math.floor(day || 1)));
  const dateObj = new Date(year, safeMonth - 1, safeDay);
  const weekday = WEEKDAYS_ES[dateObj.getDay()] || '';
  const monthName = MONTHS_ES[safeMonth - 1] || '';
  return `${weekday}, ${safeDay} de ${monthName} de ${year}`;
}

export function formatTime12h(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(Math.max(0, Math.min(59, minute))).padStart(2, '0')} ${suffix}`;
}

export function resolveGuardiaGroupsForDay(
  guardias: RolGuardiasData | null | undefined,
  dayOfMonth: number
): GuardiaNotificationGroupSummary[] {
  if (!guardias || !Array.isArray(guardias.grupos)) return [];

  return guardias.grupos
    .filter(group => Array.isArray(group.diasDelMes) && group.diasDelMes.includes(dayOfMonth))
    .map(group => ({
      id: group.id,
      nombreGrupo: group.nombreGrupo || 'Grupo de Guardia',
      icon: resolveNotificationGroupIcon(group),
      color: group.color || 'teal',
      jefeGuardia: group.jefeGuardia?.trim() || undefined,
      areas: Array.isArray(group.areas) ? group.areas.filter(Boolean) : [],
      miembros: Array.isArray(group.miembros)
        ? group.miembros
            .filter(m => m && m.nombre && m.nombre.trim())
            .map(m => ({
              nombre: m.nombre.trim(),
              rol: m.rol?.trim() || 'Médico de Guardia',
              area: m.area?.trim() || undefined,
            }))
        : [],
    }));
}

export function buildGuardiaNotificationPayload(params: {
  guardias: RolGuardiasData;
  source: GuardiaNotificationSource;
  now?: Date;
  customMessage?: string;
  sentBy?: string;
  targetDay?: number;
  id?: string;
}): GuardiaNotificationPayload {
  const now = params.now || new Date();
  const ve = getVenezuelaNowParts(now);

  const year = params.guardias.anio || ve.year;
  const month = params.guardias.mesNumero || ve.month;
  const dayNumber =
    typeof params.targetDay === 'number' && params.targetDay >= 1 && params.targetDay <= 31
      ? Math.floor(params.targetDay)
      : ve.day;

  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
  const dateLabel = formatGuardiaDateLabel(year, month, dayNumber);
  const timeLabel =
    params.source === 'scheduled_12pm'
      ? '12:00 PM'
      : formatTime12h(ve.hour, ve.minute);

  const groups = resolveGuardiaGroupsForDay(params.guardias, dayNumber);
  const trimmedMsg = params.customMessage?.trim() || undefined;

  let title = 'Guardia Médica del Día';
  let subtitle = 'Recordatorio diario de las 12:00 PM';

  if (params.source === 'scheduled_12pm') {
    title = 'Guardia Médica de Hoy · 12:00 PM';
    subtitle =
      groups.length > 0
        ? `Equipo médico asignado para hoy (${dateLabel})`
        : `Consulta el Rol de Guardias para el día ${dayNumber}`;
  } else if (params.source === 'admin_broadcast') {
    title = 'Aviso Oficial · Guardia Médica de Hoy';
    subtitle = `Enviado a todos los usuarios por ${params.sentBy || 'Administrador'}`;
  } else {
    title = 'Prueba · Notificación de Guardia Médica';
    subtitle = 'Vista previa local (visible solo para ti)';
  }

  const generatedId =
    params.id ||
    `guardia-notif-${params.source}-${dateKey}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: generatedId,
    source: params.source,
    title,
    subtitle,
    customMessage: trimmedMsg,
    dayNumber,
    dateKey,
    dateLabel,
    timeLabel,
    hospital: params.guardias.hospital || 'Hospital Materno Infantil',
    servicio: params.guardias.servicio || 'Pediatría y Puericultura',
    groups,
    sentBy: params.sentBy,
    createdAt: now.toISOString(),
  };
}

/**
 * Checks whether the automatic 12:00 PM (Venezuela time) duty notification should trigger.
 * Fires during the 12:00 PM hour (12:00 - 12:59) once per calendar day.
 */
export function shouldTriggerNoonGuardiaNotification(
  now: Date = new Date(),
  lastShownDateKey: string | null = null
): { shouldTrigger: boolean; dateKey: string; veHour: number; veMinute: number; veDay: number } {
  const ve = getVenezuelaNowParts(now);
  const dateKey = `${ve.year}-${String(ve.month).padStart(2, '0')}-${String(ve.day).padStart(2, '0')}`;
  const isNoonHour = ve.hour === 12;
  const alreadyShownToday = lastShownDateKey === dateKey;
  return {
    shouldTrigger: isNoonHour && !alreadyShownToday,
    dateKey,
    veHour: ve.hour,
    veMinute: ve.minute,
    veDay: ve.day,
  };
}

/**
 * Idempotent guard for incoming global broadcasts so each user sees a broadcast once
 * and ignores stale broadcasts older than MAX_BROADCAST_AGE_MS.
 */
export function shouldDisplayIncomingBroadcast(
  notification: GuardiaNotificationPayload | null | undefined,
  lastSeenBroadcastId: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!notification || typeof notification !== 'object') return false;
  if (!notification.id || typeof notification.id !== 'string') return false;
  if (notification.source !== 'admin_broadcast') return false;
  if (lastSeenBroadcastId && notification.id === lastSeenBroadcastId) return false;

  const createdMs = Date.parse(notification.createdAt || '');
  if (!Number.isFinite(createdMs)) return false;
  if (nowMs - createdMs > MAX_BROADCAST_AGE_MS) return false;

  return true;
}

export function normalizeIncomingGuardiaNotification(
  raw: unknown
): GuardiaNotificationPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  const source = obj.source;
  if (source !== 'scheduled_12pm' && source !== 'admin_broadcast' && source !== 'admin_test') {
    return null;
  }

  const rawGroups = Array.isArray(obj.groups) ? obj.groups : [];
  const groups: GuardiaNotificationGroupSummary[] = rawGroups
    .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
    .map((g, idx) => ({
      id: typeof g.id === 'string' && g.id ? g.id : `group-${idx + 1}`,
      nombreGrupo: typeof g.nombreGrupo === 'string' && g.nombreGrupo ? g.nombreGrupo : 'Grupo de Guardia',
      icon: typeof g.icon === 'string' && g.icon ? g.icon : '🩺',
      color: typeof g.color === 'string' && g.color ? g.color : 'teal',
      jefeGuardia: typeof g.jefeGuardia === 'string' && g.jefeGuardia.trim() ? g.jefeGuardia.trim() : undefined,
      areas: Array.isArray(g.areas) ? g.areas.map(a => String(a)).filter(Boolean) : [],
      miembros: Array.isArray(g.miembros)
        ? g.miembros
            .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object' && m.nombre))
            .map(m => ({
              nombre: String(m.nombre).trim(),
              rol: typeof m.rol === 'string' && m.rol.trim() ? m.rol.trim() : 'Médico de Guardia',
              area: typeof m.area === 'string' && m.area.trim() ? m.area.trim() : undefined,
            }))
        : [],
    }));

  return {
    id: obj.id.trim(),
    source,
    title: typeof obj.title === 'string' && obj.title ? obj.title : 'Guardia Médica del Día',
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle : '',
    customMessage:
      typeof obj.customMessage === 'string' && obj.customMessage.trim()
        ? obj.customMessage.trim()
        : undefined,
    dayNumber: typeof obj.dayNumber === 'number' && Number.isFinite(obj.dayNumber) ? obj.dayNumber : 1,
    dateKey: typeof obj.dateKey === 'string' ? obj.dateKey : '',
    dateLabel: typeof obj.dateLabel === 'string' ? obj.dateLabel : '',
    timeLabel: typeof obj.timeLabel === 'string' ? obj.timeLabel : '12:00 PM',
    hospital: typeof obj.hospital === 'string' ? obj.hospital : 'Hospital Materno Infantil',
    servicio: typeof obj.servicio === 'string' ? obj.servicio : 'Pediatría y Puericultura',
    groups,
    sentBy: typeof obj.sentBy === 'string' && obj.sentBy.trim() ? obj.sentBy.trim() : undefined,
    createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : new Date().toISOString(),
  };
}
