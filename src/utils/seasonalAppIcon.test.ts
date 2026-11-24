import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_SEASONAL_APP_STYLES,
  SEASONAL_APP_ICON_META,
  getSeasonalAppIconMeta,
  getSeasonalIconPaths,
  buildSeasonalWebManifest,
} from './seasonalAppIcon';
import { buildSeasonalFaviconHref } from './dynamicPwaIconSync';

test('all 17 seasonal styles have distinct themed app icon metadata and valid PWA manifests', () => {
  assert.equal(Object.keys(SEASONAL_APP_ICON_META).length, ALL_SEASONAL_APP_STYLES.length);

  for (const style of ALL_SEASONAL_APP_STYLES) {
    const meta = getSeasonalAppIconMeta(style);
    assert.equal(meta.style, style);
    assert.ok(meta.themeColor.startsWith('#'));
    assert.ok(meta.backgroundColor.startsWith('#'));
    assert.ok(meta.primaryEmoji.length > 0);

    const manifest = buildSeasonalWebManifest(style);
    assert.equal(manifest.id, '/');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.short_name.length <= 12);
    assert.equal(manifest.theme_color, meta.themeColor);
    assert.equal(manifest.icons.length, 3);
    assert.equal(manifest.icons[0].sizes, '192x192');
    assert.equal(manifest.icons[0].purpose, 'any');
    assert.equal(manifest.icons[1].sizes, '512x512');
    assert.equal(manifest.icons[1].purpose, 'any');
    assert.equal(manifest.icons[2].sizes, '512x512');
    assert.equal(manifest.icons[2].purpose, 'maskable');

    const paths = getSeasonalIconPaths(style);
    assert.equal(paths.icon192, '/pwa-192x192.png');
    assert.equal(paths.icon512, '/pwa-512x512.png');
    assert.equal(paths.iconMaskable512, '/pwa-maskable-512x512.png');
    assert.equal(paths.icon180, '/apple-touch-icon.png');

    const favHref1 = buildSeasonalFaviconHref(style, 10);
    const favHref2 = buildSeasonalFaviconHref(style, 11);
    assert.equal(favHref1, '/assets/aistudio/Icono_86bb4792.png');
    assert.equal(favHref2, '/assets/aistudio/Icono_86bb4792.png');
  }
});

test('all official HMI Pediatría PWA PNG icon files exist on disk in public/', () => {
  const paths = getSeasonalIconPaths('normal');
  for (const relUrl of Object.values(paths)) {
    const fullPath = path.join(process.cwd(), 'public', relUrl.replace(/^\//, ''));
    assert.equal(fs.existsSync(fullPath), true, `Missing official PWA icon PNG: ${fullPath}`);
  }
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'public', 'assets', 'aistudio', 'Icono_86bb4792.png')),
    true
  );
});
