import { parseConfigTimestampMs } from './panelControlSync';

export const DEFAULT_MASTER_ADMIN_PASSWORD = 'Bg250997';
export const ADMIN_MASTER_PASSWORD_STORAGE_KEY = 'hmi_admin_master_password';
export const ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY = 'hmi_admin_master_password_updated_at';

export function getMasterAdminPassword(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(ADMIN_MASTER_PASSWORD_STORAGE_KEY);
      if (stored && stored.trim().length >= 4) {
        return stored.trim();
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return DEFAULT_MASTER_ADMIN_PASSWORD;
}

export function verifyMasterAdminPassword(candidate: string, currentMaster?: string): boolean {
  if (typeof candidate !== 'string') return false;
  const cleanCandidate = candidate.trim();
  if (!cleanCandidate) return false;
  const activePassword = (currentMaster || getMasterAdminPassword()).trim();
  return cleanCandidate === activePassword;
}

export function setMasterAdminPasswordLocal(nextPassword: string, updatedAtIso?: string): void {
  if (typeof window === 'undefined') return;
  const clean = nextPassword.trim();
  if (clean.length < 4) return;
  try {
    localStorage.setItem(ADMIN_MASTER_PASSWORD_STORAGE_KEY, clean);
    localStorage.setItem(
      ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY,
      updatedAtIso || new Date().toISOString()
    );
  } catch {
    // Ignore storage write errors
  }
}

export function applyRemoteAdminPasswordIfNewer(
  remotePassword?: string | null,
  remoteUpdatedAt?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof remotePassword !== 'string') return false;
  const cleanRemote = remotePassword.trim();
  if (cleanRemote.length < 4) return false;

  try {
    const localPass = localStorage.getItem(ADMIN_MASTER_PASSWORD_STORAGE_KEY);
    const localUpdatedAt = localStorage.getItem(ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY);
    const remoteMs = parseConfigTimestampMs(remoteUpdatedAt);
    const localMs = parseConfigTimestampMs(localUpdatedAt);

    // Apply when no local password was rotated yet, or when remote password has newer/equal timestamp
    if (!localPass || !localUpdatedAt || (remoteMs > 0 && remoteMs >= localMs)) {
      if (localPass !== cleanRemote || (remoteMs > 0 && remoteMs > localMs)) {
        localStorage.setItem(ADMIN_MASTER_PASSWORD_STORAGE_KEY, cleanRemote);
        if (remoteUpdatedAt) {
          localStorage.setItem(ADMIN_MASTER_PASSWORD_UPDATED_AT_KEY, remoteUpdatedAt);
        }
        return true;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return false;
}

export interface PasswordRotationValidation {
  ok: boolean;
  error?: string;
  nextPassword?: string;
  updatedAt?: string;
}

export function validateAndComputeAdminPasswordChange(params: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  activePassword?: string;
}): PasswordRotationValidation {
  const active = (params.activePassword ?? getMasterAdminPassword()).trim();
  const cleanCurrent = (params.currentPassword || '').trim();
  const cleanNew = (params.newPassword || '').trim();
  const cleanConfirm = (params.confirmPassword || '').trim();

  if (cleanCurrent !== active) {
    return {
      ok: false,
      error: 'La contraseña actual del administrador es incorrecta.',
    };
  }

  if (cleanNew.length < 4) {
    return {
      ok: false,
      error: 'La nueva contraseña debe tener al menos 4 caracteres.',
    };
  }

  if (cleanNew !== cleanConfirm) {
    return {
      ok: false,
      error: 'La nueva contraseña y su confirmación no coinciden.',
    };
  }

  if (cleanNew === active) {
    return {
      ok: false,
      error: 'La nueva contraseña debe ser diferente a la contraseña actual.',
    };
  }

  return {
    ok: true,
    nextPassword: cleanNew,
    updatedAt: new Date().toISOString(),
  };
}
