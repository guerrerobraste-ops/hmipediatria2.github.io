import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLatestPanelControl,
  buildNextPanelControlState,
  shouldUnmuteOnGlobalAmbientChange,
  resolveEffectiveAmbientPlaying,
  hasAmbientSoundChanged,
  parseConfigTimestampMs,
} from './panelControlSync';

test('parseConfigTimestampMs parses ISO timestamps and handles invalid/empty gracefully', () => {
  assert.equal(parseConfigTimestampMs(undefined), 0);
  assert.equal(parseConfigTimestampMs(''), 0);
  assert.equal(parseConfigTimestampMs('invalid-date'), 0);
  assert.ok(parseConfigTimestampMs('2026-11-15T23:00:00.000Z') > 0);
});

test('pickLatestPanelControl picks the candidate with the newest updatedAt across sources', () => {
  const staleSupabase = {
    seasonalTheme: 'navidad',
    autoVenezuelaMode: false,
    updatedAt: '2026-11-15T20:00:00.000Z',
  };
  const newerExpress = {
    seasonalTheme: 'espacio',
    autoVenezuelaMode: false,
    ambientSound: { enabled: true, intensity: 0.65, updatedAt: '2026-11-15T23:05:00.000Z' },
    updatedAt: '2026-11-15T23:05:00.000Z',
  };

  const picked = pickLatestPanelControl([null, staleSupabase, newerExpress, undefined]);
  assert.equal(picked?.seasonalTheme, 'espacio');
  assert.equal(picked?.ambientSound?.enabled, true);
  assert.equal(picked?.ambientSound?.intensity, 0.65);
});

test('buildNextPanelControlState merges patch cleanly without leaking personal darkMode', () => {
  const current = {
    seasonalTheme: 'navidad',
    autoVenezuelaMode: true,
    autoNightShiftMode: true,
    darkMode: 'light',
    updatedAt: '2026-11-15T20:00:00.000Z',
  };

  const next = buildNextPanelControlState(
    current,
    { seasonalTheme: 'fondo_marino', autoVenezuelaMode: false },
    '2026-11-15T23:10:00.000Z'
  );

  assert.equal(next.seasonalTheme, 'fondo_marino');
  assert.equal(next.autoVenezuelaMode, false);
  assert.equal(next.autoNightShiftMode, true);
  assert.equal(next.darkMode, undefined);
  assert.equal(next.updatedAt, '2026-11-15T23:10:00.000Z');
});

test('buildNextPanelControlState preserves darkMode only when explicitly included in patch', () => {
  const next = buildNextPanelControlState(
    { seasonalTheme: 'normal', darkMode: 'dark' },
    { darkMode: 'light' },
    '2026-11-15T23:11:00.000Z'
  );
  assert.equal(next.darkMode, 'light');
});

test('shouldUnmuteOnGlobalAmbientChange unmutes only on global false -> true activation', () => {
  assert.equal(
    shouldUnmuteOnGlobalAmbientChange({ enabled: false }, { enabled: true }),
    true
  );
  assert.equal(
    shouldUnmuteOnGlobalAmbientChange({ enabled: true }, { enabled: true }),
    false
  );
  assert.equal(
    shouldUnmuteOnGlobalAmbientChange({ enabled: true }, { enabled: false }),
    false
  );
});

test('shouldUnmuteOnGlobalAmbientChange respects explicit user mute until re-tapped', () => {
  assert.equal(
    shouldUnmuteOnGlobalAmbientChange({ enabled: false }, { enabled: true }, true),
    false
  );
});

test('resolveEffectiveAmbientPlaying keeps audio active at startup and mutes only when user silences', () => {
  assert.equal(resolveEffectiveAmbientPlaying(false, true, false), true);
  assert.equal(resolveEffectiveAmbientPlaying(true, false, false), true);
  assert.equal(resolveEffectiveAmbientPlaying(true, true, true), false);
  assert.equal(resolveEffectiveAmbientPlaying(false, false, false), false);
});

test('hasAmbientSoundChanged detects changes in enabled, intensity, and updatedAt', () => {
  const base = { enabled: true, intensity: 0.4, updatedAt: '2026-11-15T23:00:00.000Z' };
  assert.equal(hasAmbientSoundChanged(base, { ...base }), false);
  assert.equal(hasAmbientSoundChanged(base, { ...base, enabled: false }), true);
  assert.equal(hasAmbientSoundChanged(base, { ...base, intensity: 0.75 }), true);
  assert.equal(
    hasAmbientSoundChanged(base, { ...base, updatedAt: '2026-11-15T23:00:01.000Z' }),
    true
  );
});
