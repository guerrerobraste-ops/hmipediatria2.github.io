import {
  getSeasonalAppIconMeta,
  normalizeSeasonalAppStyle,
} from './seasonalAppIcon';

export const STATIC_TAB_FAVICON_PATH = '/assets/aistudio/Icono_86bb4792.png';

/**
 * Pure helper to build the browser tab favicon URL.
 * Always returns the official HMI Pediatría icon regardless of the active seasonal style.
 */
export function buildSeasonalFaviconHref(_style?: string | null, _revision: number = 0): string {
  return STATIC_TAB_FAVICON_PATH;
}

/**
 * Synchronizes the browser's `<link rel="icon">`, `<link rel="apple-touch-icon">`,
 * `<link rel="manifest">`, and `<meta name="theme-color">` tags in real time.
 * The browser tab icon is strictly fixed to `/Icon/Icono.png`.
 */
export function syncDynamicPwaIcons(style?: string | null): void {
  if (typeof document === 'undefined') return;

  const safeStyle = normalizeSeasonalAppStyle(style);
  const meta = getSeasonalAppIconMeta(safeStyle);
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  // 1. Update theme-color meta tag
  let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    head.appendChild(themeMeta);
  }
  themeMeta.content = meta.themeColor;

  const fixedFaviconHref = STATIC_TAB_FAVICON_PATH;

  // 2. Ensure <link rel="icon"> & <link rel="shortcut icon"> point exclusively to /Icon/Icono.png
  const existingIcons = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link#hmi-favicon-icon, link#hmi-shortcut-icon'
  );
  if (existingIcons.length > 0) {
    existingIcons.forEach(link => {
      if (link.getAttribute('href') !== fixedFaviconHref) {
        link.href = fixedFaviconHref;
      }
    });
  } else {
    const newFavicon = document.createElement('link');
    newFavicon.id = 'hmi-favicon-icon';
    newFavicon.rel = 'icon';
    newFavicon.type = 'image/png';
    newFavicon.href = fixedFaviconHref;
    head.appendChild(newFavicon);
  }

  // 3. Ensure <link rel="apple-touch-icon"> points to /Icon/Icono.png
  let appleTouchLink = document.querySelector<HTMLLinkElement>(
    'link#hmi-apple-touch-icon, link[rel="apple-touch-icon"]'
  );
  if (!appleTouchLink) {
    appleTouchLink = document.createElement('link');
    appleTouchLink.id = 'hmi-apple-touch-icon';
    appleTouchLink.rel = 'apple-touch-icon';
    head.appendChild(appleTouchLink);
  }
  if (appleTouchLink.getAttribute('href') !== fixedFaviconHref) {
    appleTouchLink.href = fixedFaviconHref;
  }

  // 4. Update dynamic Web App Manifest link
  let manifestLink = document.querySelector<HTMLLinkElement>(
    'link#hmi-manifest-link, link[rel="manifest"]'
  );
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.id = 'hmi-manifest-link';
    manifestLink.rel = 'manifest';
    head.appendChild(manifestLink);
  }
  const targetManifestHref = `/api/manifest.webmanifest?style=${encodeURIComponent(safeStyle)}`;
  if (manifestLink.getAttribute('href') !== targetManifestHref) {
    manifestLink.href = targetManifestHref;
  }
}
