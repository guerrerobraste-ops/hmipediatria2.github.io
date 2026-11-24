import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizePdfFileName,
  resolvePrintableDocumentTitle,
  formatPrintDocumentTitle,
  isMobilePdfPrintFallbackNeeded,
  computePdfPageOrientation,
  computeSheetFitScale,
  buildDynamicPrintPageCss,
  DEFAULT_PDF_DOWNLOAD_MARGIN_MM,
  computePdfImagePlacement,
} from './pdfPrinter.ts';

test('sanitizePdfFileName normalizes spaces, special chars, and .pdf suffix', () => {
  assert.equal(sanitizePdfFileName('Nota de Recibimiento.pdf'), 'Nota_de_Recibimiento.pdf');
  assert.equal(sanitizePdfFileName('  Órdenes Médicas (2026)  '), 'rdenes_Mdicas_2026.pdf');
  assert.equal(sanitizePdfFileName(''), 'DOCUMENTO_CLINICO.pdf');
  assert.equal(sanitizePdfFileName(undefined), 'DOCUMENTO_CLINICO.pdf');
});

test('resolvePrintableDocumentTitle preserves clinical accents/patient metadata while stripping .pdf and invalid filename chars', () => {
  assert.equal(
    resolvePrintableDocumentTitle('Historia Clinica (Pérez Mateo - HC 12345) (20-11-2026 22-35).pdf'),
    'Historia Clinica (Pérez Mateo - HC 12345) (20-11-2026 22-35)'
  );
  assert.equal(
    resolvePrintableDocumentTitle('  HC / Test: "Paciente"*.pdf  '),
    'HC Test Paciente'
  );
  assert.equal(resolvePrintableDocumentTitle(''), 'Documento Clinico');
});

test('formatPrintDocumentTitle formats HC and dated document titles properly', () => {
  assert.equal(
    formatPrintDocumentTitle('HC', 'Mateo Pérez', { includeDateTime: false }),
    'HC (Mateo Pérez)'
  );
  const datedHc = formatPrintDocumentTitle('Historia Clinica', 'Pérez Mateo - HC 4821', {
    includeDateTime: true,
    now: new Date(2026, 10, 20, 21, 50),
  });
  assert.equal(datedHc, 'Historia Clinica (Pérez Mateo - HC 4821) (20-11-2026 21-50)');
  const dated = formatPrintDocumentTitle('Evolucion', 'Sofía Rojas', {
    includeDateTime: true,
    now: new Date(2026, 4, 15, 9, 5),
  });
  assert.equal(dated, 'Evolucion (Sofía Rojas) (15-05-2026 09-05)');
});

test('computePdfPageOrientation accurately distinguishes portrait vs landscape PDF pages', () => {
  assert.equal(computePdfPageOrientation(612, 792), 'portrait');
  assert.equal(computePdfPageOrientation(792, 612), 'landscape');
  assert.equal(computePdfPageOrientation(600, 600), 'portrait');
});

test('computeSheetFitScale keeps short sheets at 1 and scales tall sheets proportionally', () => {
  assert.equal(computeSheetFitScale(900, 1044), 1);
  assert.equal(computeSheetFitScale(1044, 1044), 1);
  assert.equal(computeSheetFitScale(2088, 1044), 0.5);
  assert.equal(computeSheetFitScale(5000, 1044), 0.45); // respects minScale floor
  assert.equal(computeSheetFitScale(0, 1044), 1);
});

test('buildDynamicPrintPageCss configures clean Letter orientation with zero @page margins to hide browser headers/footers', () => {
  const portraitCss = buildDynamicPrintPageCss(['portrait', 'portrait']);
  assert.match(portraitCss, /size:\s*letter portrait/);
  assert.match(portraitCss, /margin:\s*0 !important/);

  const landscapeCss = buildDynamicPrintPageCss(['landscape']);
  assert.match(landscapeCss, /size:\s*letter landscape/);

  const mixedCss = buildDynamicPrintPageCss(['portrait', 'landscape']);
  assert.match(mixedCss, /size:\s*letter portrait/);
  assert.match(mixedCss, /@page hmi-pdf-landscape/);
});

test('DEFAULT_PDF_DOWNLOAD_MARGIN_MM and computePdfImagePlacement enforce balanced non-zero clinical margins', () => {
  assert.ok(DEFAULT_PDF_DOWNLOAD_MARGIN_MM.top >= 10);
  assert.ok(DEFAULT_PDF_DOWNLOAD_MARGIN_MM.right >= 10);
  assert.ok(DEFAULT_PDF_DOWNLOAD_MARGIN_MM.bottom >= 10);
  assert.ok(DEFAULT_PDF_DOWNLOAD_MARGIN_MM.left >= 10);

  // Exact Letter proportion sheet (215.9 x 279.4 ratio -> 816 x 1056 px)
  const exactFit = computePdfImagePlacement({
    canvasWidthPx: 816,
    canvasHeightPx: 1056,
  });
  assert.equal(exactFit.printableWidthMm, 195.9);
  assert.equal(exactFit.printableHeightMm, 259.4);
  assert.ok(exactFit.xMm >= 10, `expected left margin >= 10mm, got ${exactFit.xMm}`);
  assert.ok(exactFit.yMm >= 10, `expected top margin >= 10mm, got ${exactFit.yMm}`);
  assert.ok(215.9 - (exactFit.xMm + exactFit.renderWidthMm) >= 9.9, 'right margin must be >= 10mm');
  assert.ok(279.4 - (exactFit.yMm + exactFit.renderHeightMm) >= 9.9, 'bottom margin must be >= 10mm');

  // Very tall sheet shrinks proportionally to fit inside bottom margin
  const tallFit = computePdfImagePlacement({
    canvasWidthPx: 816,
    canvasHeightPx: 2000,
  });
  assert.equal(tallFit.renderHeightMm, 259.4);
  assert.ok(tallFit.xMm > 10, 'narrowed tall sheet should be horizontally centered inside margins');
  assert.ok(tallFit.yMm === 10);
});

test('isMobilePdfPrintFallbackNeeded detects mobile browsers and keeps desktop direct print', () => {
  assert.equal(
    isMobilePdfPrintFallbackNeeded('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
    true
  );
  assert.equal(
    isMobilePdfPrintFallbackNeeded('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'),
    true
  );
  assert.equal(
    isMobilePdfPrintFallbackNeeded('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'),
    false
  );
});
