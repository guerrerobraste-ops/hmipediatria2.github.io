import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SEASONAL_STYLES } from '../components/SeasonalOverlay';
import {
  HEADER_NEON_STYLE_MAP,
  getHeaderNeonMeta,
  getHeaderSurfaceNeonClass,
  getMobileNavSurfaceNeonClass,
  getMobileNavItemNeonClasses,
  getAudioButtonNeonClasses,
  hasAllSeasonalHeaderNeonPalettes,
} from './headerNeonStyles';

test('header neon style map covers all 17 seasonal styles completely', () => {
  assert.equal(hasAllSeasonalHeaderNeonPalettes(), true);
  assert.equal(Object.keys(HEADER_NEON_STYLE_MAP).length, ALL_SEASONAL_STYLES.length);

  for (const style of ALL_SEASONAL_STYLES) {
    const meta = getHeaderNeonMeta(style);
    assert.equal(meta.style, style);
    assert.ok(meta.neonAccentName.length > 0);
    assert.ok(meta.lightPrimaryHex.startsWith('#'));
    assert.ok(meta.darkPrimaryHex.startsWith('#'));
    assert.ok(meta.navHoverGlowClass.includes('drop-shadow-'));

    const headerClass = getHeaderSurfaceNeonClass(style);
    assert.ok(headerClass.includes('hmi-header-neon'));
    assert.ok(headerClass.includes(`header-neon-theme-${style}`));

    const mobileNavClass = getMobileNavSurfaceNeonClass(style);
    assert.ok(mobileNavClass.includes('hmi-mobile-nav-neon'));
    assert.ok(mobileNavClass.includes(`header-neon-theme-${style}`));
  }
});

test('mobile bottom nav item neon classes cover icon and text for active, inactive, and admin buttons', () => {
  const inactiveItem = getMobileNavItemNeonClasses(false, false);
  assert.ok(inactiveItem.buttonClasses.includes('hmi-mobile-nav-item'));
  assert.ok(!inactiveItem.buttonClasses.includes('hmi-mobile-nav-item-active'));
  assert.ok(inactiveItem.iconClasses.includes('hmi-mobile-nav-icon'));
  assert.ok(inactiveItem.labelClasses.includes('hmi-mobile-nav-label'));
  assert.ok(inactiveItem.labelClasses.includes('header-neon-text'));

  const activeItem = getMobileNavItemNeonClasses(true, false);
  assert.ok(activeItem.buttonClasses.includes('hmi-mobile-nav-item-active'));
  assert.ok(activeItem.iconClasses.includes('hmi-mobile-nav-icon-active'));
  assert.ok(activeItem.labelClasses.includes('header-neon-text-strong'));

  const adminItem = getMobileNavItemNeonClasses(true, true);
  assert.ok(adminItem.buttonClasses.includes('hmi-mobile-nav-admin'));
  assert.ok(adminItem.buttonClasses.includes('hmi-mobile-nav-item-active'));
  assert.ok(adminItem.iconClasses.includes('hmi-mobile-nav-icon-active'));
  assert.ok(adminItem.labelClasses.includes('header-neon-text-strong'));
});

test('audio button neon classes differentiate active playing and muted states cleanly', () => {
  const playing = getAudioButtonNeonClasses(true, 'navidad');
  const muted = getAudioButtonNeonClasses(false, 'navidad');

  assert.ok(playing.buttonClasses.includes('audio-btn-neon-playing'));
  assert.ok(playing.iconClasses.includes('drop-shadow-'));
  assert.ok(!playing.buttonClasses.includes('audio-btn-neon-muted'));

  assert.ok(muted.buttonClasses.includes('audio-btn-neon-muted'));
  assert.ok(muted.iconClasses.includes('drop-shadow-'));
  assert.ok(!muted.buttonClasses.includes('audio-btn-neon-playing'));
});
