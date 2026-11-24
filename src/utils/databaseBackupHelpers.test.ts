import test from 'node:test';
import assert from 'node:assert';
import {
  CURRENT_DATABASE_BACKUP_VERSION,
  collectTutorialCatalogSnapshot,
  hydrateLocalStorageFromBackupTables
} from './databaseBackupHelpers';

test('Database backup helpers v3.3.0 version and tutorial catalog', () => {
  assert.equal(CURRENT_DATABASE_BACKUP_VERSION, '3.3.0');
  const catalog = collectTutorialCatalogSnapshot();
  assert.ok(catalog.length >= 12, 'Must have at least 12 tutorial tours');
  const historiaTour = catalog.find(t => t.tourId === 'historia_clinica');
  assert.ok(historiaTour);
  assert.ok(historiaTour.stepsCount > 0);

  const ordenesTour = catalog.find(t => t.tourId === 'generar_ordenes_medicas');
  assert.ok(ordenesTour);
  assert.ok(ordenesTour.stepsCount > 0);
});

test('hydrateLocalStorageFromBackupTables handles record safely', () => {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      length: 0,
      getItem(k: string) { return store.get(k) || null; },
      setItem(k: string, v: string) { store.set(k, v); this.length = store.size; },
      removeItem(k: string) { store.delete(k); this.length = store.size; },
      key(i: number) { return Array.from(store.keys())[i] || null; }
    }
  };
  const mockState = {
    'hmi_test_backup_key_v1': 'test_value_123',
  };
  const count = hydrateLocalStorageFromBackupTables(mockState);
  assert.ok(count >= 0);
  assert.equal(window.localStorage.getItem('hmi_test_backup_key_v1'), 'test_value_123');
  window.localStorage.removeItem('hmi_test_backup_key_v1');
  delete (globalThis as any).window;
});
