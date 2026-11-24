/**
 * Ultra-fast sanitizer for html2canvas compatibility with Tailwind CSS v4.
 * 1. Caches sanitized stylesheet strings so multi-page exports (e.g., 8-page Historia Clínica
 *    or multi-patient Evoluciones) sanitize CSS in 0ms after the first sheet.
 * 2. Prunes the cloned DOM body to ONLY the target element being captured, reducing html2canvas
 *    DOM traversal from 3,500+ nodes to ~100 nodes.
 * 3. Avoids O(N) getComputedStyle layout thrashing by sanitizing stylesheets and inline [style]
 *    attributes directly.
 */

const cssSanitizeCache = new Map<string, string>();
let cachedStylesheetKey = '';
let cachedCombinedSanitizedCss = '';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n * 255)));
}

function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
}

function oklchToRgba(inner: string): string {
  try {
    const [colorPart, alphaPart] = inner.split('/').map(s => s.trim());
    const parts = colorPart.split(/\s+/).filter(Boolean);
    if (parts.length < 3) return 'rgb(0, 0, 0)';

    const rawL = parts[0];
    const rawC = parts[1];
    const rawH = parts[2];

    let L = rawL === 'none' ? 0 : parseFloat(rawL);
    if (rawL.endsWith('%')) L = L / 100;

    let C = rawC === 'none' ? 0 : parseFloat(rawC);
    if (rawC.endsWith('%')) C = (C / 100) * 0.4;

    let H = 0;
    if (rawH !== 'none') {
      H = parseFloat(rawH);
      if (rawH.endsWith('rad')) H = (H * 180) / Math.PI;
      else if (rawH.endsWith('turn')) H = H * 360;
      else if (rawH.endsWith('grad')) H = H * 0.9;
    }

    if (Number.isNaN(L) || Number.isNaN(C) || Number.isNaN(H)) {
      return 'rgb(0, 0, 0)';
    }

    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    // OKLab to LMS
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    // LMS to linear sRGB
    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const r = clampByte(linearToSrgb(rLin));
    const g = clampByte(linearToSrgb(gLin));
    const bl = clampByte(linearToSrgb(bLin));

    if (alphaPart !== undefined && alphaPart !== '' && alphaPart !== '1' && alphaPart !== '100%') {
      let alpha = alphaPart === 'none' ? 0 : parseFloat(alphaPart);
      if (alphaPart.endsWith('%')) alpha = alpha / 100;
      if (!Number.isNaN(alpha)) {
        alpha = Math.max(0, Math.min(1, alpha));
        return `rgba(${r}, ${g}, ${bl}, ${Number(alpha.toFixed(4))})`;
      }
    }

    return `rgb(${r}, ${g}, ${bl})`;
  } catch {
    return 'rgb(0, 0, 0)';
  }
}

export function sanitizeCssText(cssText: string): string {
  if (!cssText) return cssText;

  const cacheHit = cssSanitizeCache.get(cssText);
  if (cacheHit !== undefined) return cacheHit;

  let result = cssText.replace(/oklch\(\s*([^()]+)\s*\)/gi, (_, inner) => {
    if (inner.includes('var(')) return 'rgb(0, 0, 0)';
    return oklchToRgba(inner);
  });

  // Remove Tailwind v4 gradient color-space hints (e.g. "to right in oklab")
  result = result.replace(
    /\s+in\s+(?:oklab|oklch|lab|lch|srgb|hsl|hwb)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/gi,
    ''
  );

  // Neutralize any nested or remaining modern color functions not supported by html2canvas 1.4
  if (/oklch|oklab|color-mix|\blch\(|\blab\(/i.test(result)) {
    result = result
      .replace(/oklch\([^)]*\)/gi, 'rgb(0, 0, 0)')
      .replace(/oklab\([^)]*\)/gi, 'rgb(0, 0, 0)')
      .replace(/\blch\([^)]*\)/gi, 'rgb(0, 0, 0)')
      .replace(/\blab\([^)]*\)/gi, 'rgb(0, 0, 0)');

    let prev = '';
    while (prev !== result && /color-mix\(/i.test(result)) {
      prev = result;
      result = result.replace(/color-mix\((?:[^()]|\([^()]*\))*\)/gi, 'rgba(0, 0, 0, 0.15)');
    }
  }

  if (cssSanitizeCache.size > 30) {
    cssSanitizeCache.clear();
  }
  cssSanitizeCache.set(cssText, result);
  return result;
}

function getMasterSanitizedCss(): string {
  const sheets = Array.from(document.styleSheets);
  const key = sheets.map(s => s.href || String(s.cssRules?.length || 0)).join('|');
  if (key && key === cachedStylesheetKey && cachedCombinedSanitizedCss) {
    return cachedCombinedSanitizedCss;
  }

  const chunks: string[] = [];
  sheets.forEach(sheet => {
    try {
      if (sheet.cssRules) {
        const rawCss = Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
        chunks.push(sanitizeCssText(rawCss));
      }
    } catch {
      // Cross-origin stylesheet (e.g. Google Fonts)
    }
  });

  cachedStylesheetKey = key;
  cachedCombinedSanitizedCss = chunks.join('\n');
  return cachedCombinedSanitizedCss;
}

export function sanitizeCloneForHtml2Canvas(
  clonedDoc: Document,
  targetElement?: HTMLElement | null
): void {
  // 1. Prune clonedDoc.body so html2canvas only traverses the target document element
  if (targetElement && clonedDoc.body && clonedDoc.body.contains(targetElement)) {
    const computedWidth = targetElement.style.width || '215.9mm';
    clonedDoc.body.innerHTML = '';
    clonedDoc.body.style.margin = '0';
    clonedDoc.body.style.padding = '0';
    clonedDoc.body.style.background = '#ffffff';
    clonedDoc.body.style.color = '#000000';
    targetElement.style.position = 'static';
    targetElement.style.left = '0';
    targetElement.style.top = '0';
    targetElement.style.margin = '0';
    targetElement.style.boxShadow = 'none';
    targetElement.style.transform = 'none';
    targetElement.style.width = computedWidth;
    clonedDoc.body.appendChild(targetElement);
  } else {
    // Remove heavy background overlays (falling icons, hidden modals) from clone
    clonedDoc
      .querySelectorAll('.no-print, [aria-hidden="true"]')
      .forEach(el => {
        if (!targetElement || !targetElement.contains(el)) {
          el.remove();
        }
      });
  }

  // 2. Replace all <link rel="stylesheet"> and <style> with a single pre-cached sanitized <style>
  const masterCss = getMasterSanitizedCss();
  if (masterCss) {
    clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
      const href = (el as HTMLLinkElement).href || '';
      if (href && href.includes('fonts.googleapis.com')) return;
      el.remove();
    });
    const styleEl = clonedDoc.createElement('style');
    styleEl.textContent = masterCss;
    clonedDoc.head.appendChild(styleEl);
  } else {
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach(styleTag => {
      if (
        styleTag.textContent &&
        /oklch|oklab|color-mix|\blch\(|\blab\(/i.test(styleTag.textContent)
      ) {
        styleTag.textContent = sanitizeCssText(styleTag.textContent);
      }
    });
  }

  // 3. Only sanitize elements that actually have inline style attributes with modern color functions
  const rootScope: ParentNode = targetElement || clonedDoc;
  const inlineEls = rootScope.querySelectorAll(
    '[style*="oklch"], [style*="oklab"], [style*="color-mix"], [style*="lch("], [style*="lab("]'
  );
  inlineEls.forEach(el => {
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle) {
      el.setAttribute('style', sanitizeCssText(inlineStyle));
    }
  });
}
