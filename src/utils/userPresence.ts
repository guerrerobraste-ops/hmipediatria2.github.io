import type { UserProfile } from '../types';

export const PRESENCE_ONLINE_TTL_MS = 45_000;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;

export interface UserPresenceRecord {
  key: string;
  profileId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  isAdmin?: boolean;
  isOnline: boolean;
  lastLoginAt: string;
  lastSeenAt: string;
  updatedAt?: string;
}

export interface ResolvedProfilePresence {
  isOnline: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  formattedLastLogin: string;
}

export function normalizePresenceToken(val?: string | null): string {
  return String(val || '').trim().toLowerCase();
}

export function isAdminIdentity(profile?: Pick<UserProfile, 'is_admin' | 'email' | 'role' | 'details'> | null): boolean {
  if (!profile) return false;
  const email = normalizePresenceToken(profile.email);
  const username = normalizePresenceToken(profile.details?.username);
  return Boolean(
    profile.is_admin ||
      profile.role === 'admin' ||
      email === 'guerrerobraste@gmail.com' ||
      username === 'admin'
  );
}

export function resolveCanonicalPresenceKey(input: {
  profileId?: string;
  username?: string;
  email?: string;
  isAdmin?: boolean;
}): string {
  const pid = String(input.profileId || '').trim();
  if (pid) return `id:${pid}`;

  const uname = normalizePresenceToken(input.username);
  if (uname) return `user:${uname}`;

  const email = normalizePresenceToken(input.email);
  if (email) return `email:${email}`;

  if (input.isAdmin) return 'user:admin';
  return 'unknown';
}

export function parsePresenceTimestampMs(iso?: string | null): number {
  if (!iso || typeof iso !== 'string') return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPresenceRecordOnline(
  record: Pick<UserPresenceRecord, 'isOnline' | 'lastSeenAt'> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!record || !record.isOnline) return false;
  const seenMs = parsePresenceTimestampMs(record.lastSeenAt);
  if (seenMs <= 0) return false;
  return nowMs - seenMs <= PRESENCE_ONLINE_TTL_MS;
}

export function formatLastLoginSpanish(
  iso?: string | null,
  nowMs: number = Date.now()
): string {
  const ts = parsePresenceTimestampMs(iso);
  if (ts <= 0) return 'Sin sesión registrada';

  try {
    const target = new Date(ts);
    const now = new Date(nowMs);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfTarget) / 86_400_000);

    const timeStr = target.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (diffDays === 0) {
      return `Hoy, ${timeStr}`;
    }
    if (diffDays === 1) {
      return `Ayer, ${timeStr}`;
    }

    const dateStr = target.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return 'Sin sesión registrada';
  }
}

export function resolveProfilePresence(
  profile: Pick<UserProfile, 'id' | 'email' | 'role' | 'is_admin' | 'details' | 'updated_at'>,
  presenceMap: Record<string, UserPresenceRecord> | null | undefined,
  nowMs: number = Date.now()
): ResolvedProfilePresence {
  const safeMap = presenceMap && typeof presenceMap === 'object' ? presenceMap : {};
  const profileId = String(profile.id || '').trim();
  const profileUsername = normalizePresenceToken(profile.details?.username);
  const profileEmail = normalizePresenceToken(profile.email);
  const profileIsAdmin = isAdminIdentity(profile);

  const candidates: UserPresenceRecord[] = [];
  for (const record of Object.values(safeMap)) {
    if (!record || typeof record !== 'object') continue;
    const recId = String(record.profileId || '').trim();
    const recUser = normalizePresenceToken(record.username);
    const recEmail = normalizePresenceToken(record.email);
    const recKey = String(record.key || '').trim();

    const matchesId = Boolean(profileId && (recId === profileId || recKey === `id:${profileId}`));
    const matchesUsername = Boolean(
      profileUsername && (recUser === profileUsername || recKey === `user:${profileUsername}`)
    );
    const matchesEmail = Boolean(
      profileEmail && (recEmail === profileEmail || recKey === `email:${profileEmail}`)
    );
    const matchesAdminAlias = Boolean(
      profileIsAdmin && (recUser === 'admin' || recKey === 'user:admin' || Boolean(record.isAdmin))
    );

    if (matchesId || matchesUsername || matchesEmail || matchesAdminAlias) {
      candidates.push(record);
    }
  }

  candidates.sort((a, b) => {
    const aOnline = isPresenceRecordOnline(a, nowMs) ? 1 : 0;
    const bOnline = isPresenceRecordOnline(b, nowMs) ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
    return parsePresenceTimestampMs(b.lastSeenAt) - parsePresenceTimestampMs(a.lastSeenAt);
  });

  const bestRecord = candidates[0] || null;
  const fallbackLoginIso =
    (typeof profile.details?.last_sign_in_at === 'string' && profile.details.last_sign_in_at) ||
    (typeof profile.details?.last_seen_at === 'string' && profile.details.last_seen_at) ||
    null;

  const bestLoginMs = Math.max(
    parsePresenceTimestampMs(bestRecord?.lastLoginAt),
    parsePresenceTimestampMs(fallbackLoginIso)
  );
  const resolvedLastLoginAt = bestLoginMs > 0 ? new Date(bestLoginMs).toISOString() : null;

  const onlineFromRecord = isPresenceRecordOnline(bestRecord, nowMs);
  const resolvedLastSeenAt = bestRecord?.lastSeenAt || fallbackLoginIso;

  return {
    isOnline: onlineFromRecord,
    lastLoginAt: resolvedLastLoginAt,
    lastSeenAt: resolvedLastSeenAt,
    formattedLastLogin: formatLastLoginSpanish(resolvedLastLoginAt, nowMs),
  };
}
