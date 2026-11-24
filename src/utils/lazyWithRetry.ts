import React, { ComponentType, lazy } from 'react';

const CHUNK_RELOAD_GUARD_KEY = 'hmi_chunk_reload_attempted_v1';

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error || '');

  return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message
  );
}

export async function clearServiceWorkerCachesAndReload(
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const store = storage || window.sessionStorage;

  try {
    const alreadyAttempted = store.getItem(CHUNK_RELOAD_GUARD_KEY);
    if (alreadyAttempted === '1') {
      return false;
    }
    store.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
  } catch {
    // Ignore storage restriction errors
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map(name => window.caches.delete(name)));
    }
  } catch {
    // Best-effort cleanup
  }

  window.location.reload();
  return true;
}

export function resetChunkReloadGuard(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
  } catch {
    // Ignore
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importer();
      resetChunkReloadGuard();
      return mod;
    } catch (error) {
      if (isChunkLoadError(error)) {
        const reloaded = await clearServiceWorkerCachesAndReload();
        if (reloaded) {
          // Suspend briefly while browser reloads
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}
