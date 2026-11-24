import type { PanelControlSupabaseConfig } from '../lib/supabase';

export function parseConfigTimestampMs(iso?: string | null): number {
  if (!iso || typeof iso !== 'string') return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickLatestPanelControl(
  candidates: Array<PanelControlSupabaseConfig | null | undefined>
): PanelControlSupabaseConfig | null {
  const valid = candidates.filter(
    (c): c is PanelControlSupabaseConfig => Boolean(c && typeof c === 'object')
  );
  if (valid.length === 0) return null;

  let best = valid[0];
  let bestTs = parseConfigTimestampMs(best.updatedAt);

  for (let i = 1; i < valid.length; i++) {
    const candidate = valid[i];
    const ts = parseConfigTimestampMs(candidate.updatedAt);
    if (ts > bestTs) {
      best = candidate;
      bestTs = ts;
    } else if (ts === bestTs && (candidate.updatedAt || '') > (best.updatedAt || '')) {
      best = candidate;
    }
  }

  return best;
}

export function buildNextPanelControlState(
  current: PanelControlSupabaseConfig,
  patch: Partial<PanelControlSupabaseConfig>,
  nowIso: string = new Date().toISOString()
): PanelControlSupabaseConfig {
  // Never overwrite other users' personal dark/light preference unless explicitly provided in patch
  const { darkMode: _ignoredLocalDarkMode, ...restCurrent } = current;
  const next: PanelControlSupabaseConfig = {
    ...restCurrent,
    ...patch,
    updatedAt: patch.updatedAt || nowIso,
    updatedBy: patch.updatedBy || 'Administrador',
  };

  if (patch.darkMode === undefined) {
    delete next.darkMode;
  }

  return next;
}

export function shouldUnmuteOnGlobalAmbientChange(
  prev: { enabled?: boolean; updatedAt?: string } | null | undefined,
  next: { enabled?: boolean; updatedAt?: string } | null | undefined,
  userExplicitlyMuted: boolean = false
): boolean {
  if (userExplicitlyMuted) return false;
  if (!next?.enabled) return false;
  if (!prev?.enabled) return true;
  return false;
}

export function resolveEffectiveAmbientPlaying(
  globalEnabled: boolean,
  userLocalSoundOverride: boolean,
  userSoundMuted: boolean
): boolean {
  return (Boolean(globalEnabled) || Boolean(userLocalSoundOverride)) && !Boolean(userSoundMuted);
}

export function hasAmbientSoundChanged(
  prev: { enabled?: boolean; intensity?: number; updatedAt?: string } | null | undefined,
  next: { enabled?: boolean; intensity?: number; updatedAt?: string } | null | undefined
): boolean {
  if (!next) return false;
  if (!prev) return true;
  if (Boolean(prev.enabled) !== Boolean(next.enabled)) return true;
  const prevInt = typeof prev.intensity === 'number' ? prev.intensity : 0.4;
  const nextInt = typeof next.intensity === 'number' ? next.intensity : 0.4;
  if (Math.abs(prevInt - nextInt) >= 0.005) return true;
  if ((prev.updatedAt || '') !== (next.updatedAt || '')) return true;
  return false;
}
