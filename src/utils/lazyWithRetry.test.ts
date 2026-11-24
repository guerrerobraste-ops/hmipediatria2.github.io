import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError } from './lazyWithRetry';

test('isChunkLoadError detects Vite, Safari, and Chromium dynamic module load failures', () => {
  assert.equal(
    isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/HistoriaClinicaForm-abc.js')),
    true
  );
  assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 12 failed.')), true);
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/index.css')), true);
  assert.equal(isChunkLoadError(new Error('Unexpected token in user form')), false);
});
