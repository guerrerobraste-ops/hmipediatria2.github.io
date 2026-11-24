import type { jsPDF } from 'jspdf';

export interface PrintPdfOptions {
  fileName?: string;
  title?: string;
  onClose?: () => void;
}

export type PdfPageOrientation = 'portrait' | 'landscape';

export interface InstantPrintSheetInput {
  element: HTMLElement;
  orientation?: PdfPageOrientation;
  /** Optional long patient/section header banner shown ONLY on screen (hidden on print) */
  bannerText?: string;
  /** Whether to repeat the top institutional header on Page 2+ if content overflows (default: true) */
  repeatHeaderOnOverflow?: boolean;
}

export interface InstantWhitePrintOptions {
  sheets: Array<HTMLElement | InstantPrintSheetInput>;
  title?: string;
  fileName?: string;
  /** Optional lazy PDF download handler invoked ONLY if the user clicks "Descargar PDF" */
  onDownloadPdf?: () => Promise<void> | void;
  /** Optional callback invoked when the user closes the white print page */
  onClose?: () => void;
  /** If true, shrinks a tall sheet onto 1 page; default is FALSE so content flows naturally onto Page 2+ at full width */
  fitEachSheetToOnePage?: boolean;
  /** Repeat top institutional header automatically on Page 2+ when overflowing (default: true) */
  repeatHeaderOnOverflow?: boolean;
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  orientation: PdfPageOrientation;
}

const VIEWER_MODAL_ID = 'hmi-pdf-print-viewer-modal';
const DIRECT_PRINT_PORTAL_ID = 'hmi-direct-print-portal';
const DYNAMIC_PAGE_STYLE_ID = 'hmi-pdf-dynamic-page-style';

const LETTER_PORTRAIT_HEIGHT_PX = 1060; // 279.4mm @ 96 DPI (1056px) + 4px tolerance
const LETTER_LANDSCAPE_HEIGHT_PX = 820; // 215.9mm @ 96 DPI (816px) + 4px tolerance

let activePdfBlobUrl: string | null = null;
let activeEscListener: ((e: KeyboardEvent) => void) | null = null;
let activeOnCloseCallback: (() => void) | null = null;
let activeDirectPrintCleanup: (() => void) | null = null;
let savedDocumentTitleBeforeViewer: string | null = null;

/**
 * Pure helper: normalizes a document title used for browser Print -> "Save as PDF"
 * filenames by stripping trailing .pdf and invalid filesystem characters while
 * preserving readable clinical metadata (type, patient, date/time).
 */
export function resolvePrintableDocumentTitle(
  rawName?: string,
  fallback = 'Documento Clinico'
): string {
  const cleaned = (rawName || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function applyPrintDocumentTitle(rawTitle?: string): string {
  const resolved = resolvePrintableDocumentTitle(rawTitle);
  if (typeof document !== 'undefined') {
    if (savedDocumentTitleBeforeViewer === null) {
      savedDocumentTitleBeforeViewer = document.title;
    }
    document.title = resolved;
  }
  return resolved;
}

/**
 * Pure helper: normalizes a PDF file name so it always ends with .pdf and has safe characters.
 */
export function sanitizePdfFileName(rawName?: string): string {
  const base = (rawName || 'DOCUMENTO_CLINICO')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.-]/g, '');
  return `${base || 'DOCUMENTO_CLINICO'}.pdf`;
}

/**
 * Pure helper: builds standardized print/save document titles:
 * - HC (Nombre del paciente)
 * - Evolucion (Nombre del paciente) (DD-MM-YYYY HH-MM)
 * - Ordenes Medicas (Nombre del paciente) (DD-MM-YYYY HH-MM)
 * etc.
 */
export function formatPrintDocumentTitle(
  docPrefix: string,
  patientName?: string,
  options?: { includeDateTime?: boolean; dateStr?: string; timeStr?: string; now?: Date }
): string {
  const cleanPrefix = (docPrefix || 'Documento').trim();
  const cleanPatient = (patientName || '')
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();

  const includeDateTime = options?.includeDateTime !== false;
  let stamp = '';
  if (includeDateTime) {
    const d = options?.now || new Date();
    const datePart = (options?.dateStr || '')
      .trim()
      .replace(/\//g, '-')
      .replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3-$2-$1') ||
      `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const rawTime = (options?.timeStr || '').trim();
    const timePart = rawTime
      ? rawTime.replace(/:/g, '-').replace(/[\\/*?"<>|]/g, '').trim()
      : `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
    stamp = `${datePart} ${timePart}`.trim();
  }

  const parts = [cleanPrefix];
  if (cleanPatient) parts.push(`(${cleanPatient})`);
  if (stamp) parts.push(`(${stamp})`);
  return parts.join(' ');
}

/**
 * Pure helper: computes whether a page is portrait or landscape.
 */
export function computePdfPageOrientation(width: number, height: number): PdfPageOrientation {
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Pure helper: computes a uniform scale factor (<= 1) so a tall sheet fits cleanly onto 1 Letter page.
 */
export function computeSheetFitScale(
  contentHeightPx: number,
  pageHeightPx: number,
  minScale = 0.45
): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0 || !Number.isFinite(pageHeightPx) || pageHeightPx <= 0) {
    return 1;
  }
  if (contentHeightPx <= pageHeightPx) return 1;
  return Math.max(minScale, Math.min(1, Number((pageHeightPx / contentHeightPx).toFixed(4))));
}

/**
 * Balanced clinical PDF download margins (10 mm = 1.0 cm per side, ~4.6% horizontal / ~3.6% vertical on Letter),
 * avoiding 0% edge-bleeding while preserving crisp legibility for dense clinical tables.
 */
export interface PdfMarginMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PDF_DOWNLOAD_MARGIN_MM: PdfMarginMm = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

export interface PdfImagePlacement {
  xMm: number;
  yMm: number;
  renderWidthMm: number;
  renderHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
}

/**
 * Pure helper: computes exact fitted coordinates inside a PDF page respecting margins
 * so downloaded PDFs never render at 0% margin or distort aspect ratio.
 */
export function computePdfImagePlacement(params: {
  canvasWidthPx: number;
  canvasHeightPx: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
  marginMm?: Partial<PdfMarginMm>;
  verticalAlign?: 'top' | 'center';
}): PdfImagePlacement {
  const pageWidthMm = params.pageWidthMm && params.pageWidthMm > 0 ? params.pageWidthMm : 215.9;
  const pageHeightMm = params.pageHeightMm && params.pageHeightMm > 0 ? params.pageHeightMm : 279.4;
  const margin: PdfMarginMm = {
    top: params.marginMm?.top ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.top,
    right: params.marginMm?.right ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.right,
    bottom: params.marginMm?.bottom ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.bottom,
    left: params.marginMm?.left ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.left,
  };

  const printableWidthMm = Math.max(10, pageWidthMm - margin.left - margin.right);
  const printableHeightMm = Math.max(10, pageHeightMm - margin.top - margin.bottom);

  const safeW = Math.max(1, params.canvasWidthPx || 1);
  const safeH = Math.max(1, params.canvasHeightPx || 1);

  const scale = Math.min(printableWidthMm / safeW, printableHeightMm / safeH);
  const renderWidthMm = Number((safeW * scale).toFixed(3));
  const renderHeightMm = Number((safeH * scale).toFixed(3));

  const xMm = Number((margin.left + Math.max(0, (printableWidthMm - renderWidthMm) / 2)).toFixed(3));
  const yMm =
    params.verticalAlign === 'center'
      ? Number((margin.top + Math.max(0, (printableHeightMm - renderHeightMm) / 2)).toFixed(3))
      : margin.top;

  return {
    xMm,
    yMm,
    renderWidthMm,
    renderHeightMm,
    printableWidthMm,
    printableHeightMm,
  };
}

export interface AddCanvasToPdfOptions {
  marginMm?: Partial<PdfMarginMm>;
  quality?: number;
  addNewPageFirst?: boolean;
  verticalAlign?: 'top' | 'center';
  clearCanvas?: boolean;
}

/**
 * Adds a rendered HTMLCanvasElement centered cleanly inside a single PDF page with proper clinical margins.
 */
export function addCanvasSinglePageWithMargin(
  pdf: Pick<jsPDF, 'addImage' | 'addPage' | 'internal'>,
  canvas: HTMLCanvasElement,
  options: AddCanvasToPdfOptions = {}
): PdfImagePlacement {
  if (options.addNewPageFirst) {
    pdf.addPage('letter', 'portrait');
  }

  const pageWidthMm = pdf.internal?.pageSize?.getWidth?.() || 215.9;
  const pageHeightMm = pdf.internal?.pageSize?.getHeight?.() || 279.4;

  const placement = computePdfImagePlacement({
    canvasWidthPx: canvas.width,
    canvasHeightPx: canvas.height,
    pageWidthMm,
    pageHeightMm,
    marginMm: options.marginMm,
    verticalAlign: options.verticalAlign,
  });

  const imgData = canvas.toDataURL('image/jpeg', options.quality ?? 0.92);
  pdf.addImage(
    imgData,
    'JPEG',
    placement.xMm,
    placement.yMm,
    placement.renderWidthMm,
    placement.renderHeightMm,
    undefined,
    'FAST'
  );

  if (options.clearCanvas !== false) {
    canvas.width = 0;
    canvas.height = 0;
  }

  return placement;
}

/**
 * Renders a tall HTMLCanvasElement across 1 or more Letter PDF pages,
 * slicing cleanly so EVERY page keeps clean top, bottom, left, and right margins without clipping.
 */
export function addCanvasPaginatedWithMargin(
  pdf: Pick<jsPDF, 'addImage' | 'addPage' | 'internal'>,
  canvas: HTMLCanvasElement,
  options: AddCanvasToPdfOptions = {}
): number {
  const pageWidthMm = pdf.internal?.pageSize?.getWidth?.() || 215.9;
  const pageHeightMm = pdf.internal?.pageSize?.getHeight?.() || 279.4;
  const margin: PdfMarginMm = {
    top: options.marginMm?.top ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.top,
    right: options.marginMm?.right ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.right,
    bottom: options.marginMm?.bottom ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.bottom,
    left: options.marginMm?.left ?? DEFAULT_PDF_DOWNLOAD_MARGIN_MM.left,
  };

  const printableWidthMm = Math.max(10, pageWidthMm - margin.left - margin.right);
  const printableHeightMm = Math.max(10, pageHeightMm - margin.top - margin.bottom);
  const quality = options.quality ?? 0.92;

  const totalHeightMm = (canvas.height * printableWidthMm) / Math.max(1, canvas.width);
  if (totalHeightMm <= printableHeightMm + 1) {
    addCanvasSinglePageWithMargin(pdf, canvas, options);
    return 1;
  }

  const maxSlicePx = Math.max(10, Math.floor((printableHeightMm / printableWidthMm) * canvas.width));
  const minTrailingPx = Math.max(8, Math.round(canvas.width * 0.015));

  let srcY = 0;
  let pagesAdded = 0;

  while (srcY < canvas.height) {
    const remainingPx = canvas.height - srcY;
    if (pagesAdded > 0 && remainingPx <= minTrailingPx) {
      break;
    }

    const slicePx = Math.min(maxSlicePx, remainingPx);
    if (pagesAdded > 0 || options.addNewPageFirst) {
      pdf.addPage('letter', 'portrait');
    }

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slicePx;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      const sliceData = sliceCanvas.toDataURL('image/jpeg', quality);
      const sliceHeightMm = Number(((slicePx / canvas.width) * printableWidthMm).toFixed(3));
      pdf.addImage(
        sliceData,
        'JPEG',
        margin.left,
        margin.top,
        printableWidthMm,
        sliceHeightMm,
        undefined,
        'FAST'
      );
    }

    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
    srcY += slicePx;
    pagesAdded++;
  }

  if (options.clearCanvas !== false) {
    canvas.width = 0;
    canvas.height = 0;
  }

  return Math.max(1, pagesAdded);
}

/**
 * Pure helper: generates the exact @page CSS for the rendered PDF pages so portrait,
 * landscape, and mixed-orientation clinical documents print cleanly without browser headers/footers.
 */
export function buildDynamicPrintPageCss(orientations: PdfPageOrientation[]): string {
  const allLandscape = orientations.length > 0 && orientations.every(o => o === 'landscape');
  const defaultOrientation: PdfPageOrientation = allLandscape ? 'landscape' : 'portrait';
  return `
@page {
  size: letter ${defaultOrientation};
  margin: 0 !important;
}
@page hmi-pdf-landscape {
  size: letter landscape;
  margin: 0 !important;
}
`.trim();
}

/**
 * Kept for backwards compatibility with any caller/test checking mobile heuristics.
 */
export function isMobilePdfPrintFallbackNeeded(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent || '');
}

/**
 * Cleans up the white PDF viewer page, dynamic print CSS, Escape handler, and object URL.
 */
export function cleanupPdfPrintResources(): void {
  if (activeDirectPrintCleanup) {
    const fn = activeDirectPrintCleanup;
    activeDirectPrintCleanup = null;
    fn();
  }

  if (typeof window !== 'undefined' && activeEscListener) {
    window.removeEventListener('keydown', activeEscListener);
    activeEscListener = null;
  }

  if (typeof document !== 'undefined') {
    document.body.classList.remove('hmi-printing-pdf-sheets');
    document.body.classList.remove('hmi-printing-portal');
    const existingModal = document.getElementById(VIEWER_MODAL_ID);
    if (existingModal) existingModal.remove();
    const existingPortal = document.getElementById(DIRECT_PRINT_PORTAL_ID);
    if (existingPortal) existingPortal.remove();
    const existingStyle = document.getElementById(DYNAMIC_PAGE_STYLE_ID);
    if (existingStyle) existingStyle.remove();
    if (savedDocumentTitleBeforeViewer !== null) {
      document.title = savedDocumentTitleBeforeViewer;
      savedDocumentTitleBeforeViewer = null;
    }
  }

  if (activePdfBlobUrl) {
    try {
      URL.revokeObjectURL(activePdfBlobUrl);
    } catch {
      // Ignore revoke errors
    }
    activePdfBlobUrl = null;
  }

  activeOnCloseCallback = null;
}

function closeViewerAndNotify(): void {
  const cb = activeOnCloseCallback;
  cleanupPdfPrintResources();
  if (cb) cb();
}

/**
 * Triggers native printing of ONLY the pages inside the white print page.
 * Applies optional single-page fit scaling ONLY while printing so on-screen
 * display stays 100% native crisp HTML document format (never an image).
 */
function printWhiteViewerPages(
  orientations: PdfPageOrientation[],
  sheetRecords: Array<{ inner: HTMLElement; orientation: PdfPageOrientation }> = [],
  fitEachSheetToOnePage = false,
  printDocumentTitle?: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let styleEl = document.getElementById(DYNAMIC_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildDynamicPrintPageCss(orientations);

  const previousZooms: Array<{ el: HTMLElement; zoom: string }> = [];
  if (fitEachSheetToOnePage && sheetRecords.length > 0) {
    for (const rec of sheetRecords) {
      const targetHeight =
        rec.orientation === 'landscape' ? LETTER_LANDSCAPE_HEIGHT_PX : LETTER_PORTRAIT_HEIGHT_PX;
      const measuredHeight = rec.inner.scrollHeight;
      const scale = computeSheetFitScale(measuredHeight, targetHeight);
      const styleMap = rec.inner.style as unknown as Record<string, string>;
      previousZooms.push({ el: rec.inner, zoom: styleMap.zoom || '' });
      if (scale < 0.995) {
        styleMap.zoom = String(scale);
      }
    }
  }

  const previousTitle = document.title;
  const shouldRestoreTitleInFinish = savedDocumentTitleBeforeViewer === null;
  if (printDocumentTitle && printDocumentTitle.trim()) {
    document.title = resolvePrintableDocumentTitle(printDocumentTitle);
  }

  document.body.classList.add('hmi-printing-pdf-sheets');

  let cleaned = false;
  const finishPrint = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('hmi-printing-pdf-sheets');
    if (shouldRestoreTitleInFinish) {
      document.title = previousTitle;
    }
    for (const item of previousZooms) {
      (item.el.style as unknown as Record<string, string>).zoom = item.zoom;
    }
    window.removeEventListener('afterprint', finishPrint);
  };

  window.addEventListener('afterprint', finishPrint);

  requestAnimationFrame(() => {
    try {
      window.print();
    } finally {
      setTimeout(finishPrint, 1800);
    }
  });
}

/**
 * Deeply clones a live DOM clinical sheet in <5ms, freezing every input/textarea/select
 * value into crisp static text and stripping buttons/.no-print/.edit-only-container so the
 * white print page displays and prints native crisp vector typography (never an image).
 */
function prepareCleanPrintableClone(
  sourceEl: HTMLElement,
  orientation: PdfPageOrientation
): HTMLElement {
  const clone = sourceEl.cloneNode(true) as HTMLElement;

  // 1. Freeze form controls (textarea, select, input) from the live source DOM
  //    Remove any control marked no-print / print:hidden / edit-only-container so companion print:inline spans never duplicate.
  const HIDDEN_ON_PRINT_SELECTOR = '.no-print, .print-hidden, .print\\:hidden, .edit-only-container';

  const srcTextareas = sourceEl.querySelectorAll('textarea');
  const clnTextareas = clone.querySelectorAll('textarea');
  srcTextareas.forEach((srcTa, idx) => {
    const clnTa = clnTextareas[idx];
    if (!clnTa || !clnTa.parentNode) return;
    if (srcTa.closest(HIDDEN_ON_PRINT_SELECTOR)) {
      clnTa.remove();
      return;
    }
    const div = document.createElement('div');
    const cs = window.getComputedStyle(srcTa);
    div.textContent = srcTa.value;
    div.style.cssText = `white-space:pre-wrap;word-break:break-word;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};color:#000000;background:transparent;padding:${cs.padding};margin:0;width:100%;`;
    clnTa.parentNode.replaceChild(div, clnTa);
  });

  const srcSelects = sourceEl.querySelectorAll('select');
  const clnSelects = clone.querySelectorAll('select');
  srcSelects.forEach((srcSel, idx) => {
    const clnSel = clnSelects[idx];
    if (!clnSel || !clnSel.parentNode) return;
    if (srcSel.closest(HIDDEN_ON_PRINT_SELECTOR)) {
      clnSel.remove();
      return;
    }
    const span = document.createElement('span');
    const cs = window.getComputedStyle(srcSel);
    span.textContent = srcSel.options[srcSel.selectedIndex]?.text || srcSel.value || '';
    span.style.cssText = `display:inline-block;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};color:#000000;background:transparent;`;
    clnSel.parentNode.replaceChild(span, clnSel);
  });

  const srcInputs = sourceEl.querySelectorAll('input');
  const clnInputs = clone.querySelectorAll('input');
  srcInputs.forEach((srcIn, idx) => {
    const clnIn = clnInputs[idx];
    if (!clnIn || !clnIn.parentNode) return;
    if (srcIn.closest(HIDDEN_ON_PRINT_SELECTOR)) {
      clnIn.remove();
      return;
    }
    if (srcIn.type === 'checkbox' || srcIn.type === 'radio') {
      clnIn.checked = srcIn.checked;
      if (srcIn.checked) clnIn.setAttribute('checked', 'checked');
      else clnIn.removeAttribute('checked');
      clnIn.disabled = false;
      clnIn.style.pointerEvents = 'none';
      return;
    }
    const span = document.createElement('span');
    const cs = window.getComputedStyle(srcIn);
    span.textContent = srcIn.value || '';
    span.style.cssText = `display:inline-block;box-sizing:border-box;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};text-align:${cs.textAlign};color:#000000;background:transparent;min-height:1em;width:100%;max-width:100%;`;
    clnIn.parentNode.replaceChild(span, clnIn);
  });

  // 2. Strip UI chrome & reveal print-only blocks (e.g. OrdenesMedicasDocument FECHA/HORA/PESO & rows)
  clone.querySelectorAll('.no-print, .print-hidden, .print\\:hidden, .edit-only-container, button').forEach(el => {
    el.remove();
  });
  clone.querySelectorAll<HTMLElement>('.print-only-container, .print\\:block').forEach(el => {
    el.classList.remove('hidden');
    el.style.display = 'block';
  });
  clone.querySelectorAll<HTMLElement>('.print\\:inline').forEach(el => {
    el.classList.remove('hidden');
    el.style.display = 'inline';
  });
  clone.querySelectorAll<HTMLElement>('.print\\:inline-block').forEach(el => {
    el.classList.remove('hidden');
    el.style.display = 'inline-block';
  });
  clone.querySelectorAll<HTMLElement>('.print\\:flex').forEach(el => {
    el.classList.remove('hidden');
    el.style.display = 'flex';
  });

  // 3. Remove duplicate IDs from cloned subtree so live DOM queries remain unambiguous
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

  // 4. Normalize root geometry to occupy 100% width cleanly and flow naturally across pages
  clone.style.transform = 'none';
  clone.style.width = '100%';
  clone.style.minWidth = '0';
  clone.style.maxWidth = '100%';
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.background = '#ffffff';
  clone.style.color = '#000000';
  clone.style.position = 'relative';
  clone.style.left = 'auto';
  clone.style.top = 'auto';
  clone.style.userSelect = 'text';
  clone.style.boxSizing = 'border-box';

  return clone;
}

/**
 * Wraps every cloned sheet in a semantic <table> with print-only top/bottom spacer rows
 * (<thead> / <tfoot>) and horizontal padding so @page { margin: 0 } eliminates browser
 * URL/date/page-number headers & footers while every printed page (including overflow pages)
 * preserves clean clinical margins. When repeatHeader is enabled and the first child is an
 * institutional header, it is also placed in <thead> so it repeats on continuation pages.
 */
function wrapWithPrintFlowFrame(
  clone: HTMLElement,
  repeatHeader: boolean,
  orientation: PdfPageOrientation
): HTMLElement {
  const children = Array.from(clone.children) as HTMLElement[];
  const firstEl = children[0];
  const firstText = (firstEl?.textContent || '').toUpperCase();
  const isInstitutionalHeader =
    repeatHeader &&
    children.length >= 2 &&
    Boolean(
      firstEl?.hasAttribute('data-print-repeat-header') ||
        firstEl?.classList.contains('header-banner') ||
        firstText.includes('GOBIERNO BOLIVARIANO') ||
        firstText.includes('HOSPITAL MATERNO INFANTIL') ||
        firstText.includes('MINISTERIO DEL PODER POPULAR')
    );

  const outer = document.createElement('div');
  outer.className = clone.className;
  outer.style.cssText = clone.style.cssText;

  const table = document.createElement('table');
  table.className = `hmi-print-flow-table ${orientation === 'landscape' ? 'hmi-print-flow-landscape' : ''}`.trim();
  table.style.cssText = 'width:100%;border-collapse:collapse;border:none;margin:0;padding:0;table-layout:fixed;';

  const thead = document.createElement('thead');
  thead.style.cssText = 'display:table-header-group;';

  // Print-only top margin spacer row (repeats at top of every printed page)
  const topSpacerTr = document.createElement('tr');
  topSpacerTr.className = 'hmi-print-spacer-row';
  const topSpacerTd = document.createElement('td');
  topSpacerTd.className = 'hmi-print-top-spacer';
  topSpacerTr.appendChild(topSpacerTd);
  thead.appendChild(topSpacerTr);

  if (isInstitutionalHeader && firstEl) {
    const headTr = document.createElement('tr');
    const headTd = document.createElement('td');
    headTd.className = 'hmi-print-flow-header-cell';
    headTd.style.cssText = 'padding:0 0 6px 0;border:none;vertical-align:top;';
    headTd.appendChild(firstEl);
    headTr.appendChild(headTd);
    thead.appendChild(headTr);
  }

  const tbody = document.createElement('tbody');
  const bodyTr = document.createElement('tr');
  const bodyTd = document.createElement('td');
  bodyTd.className = 'hmi-print-flow-body-cell';
  bodyTd.style.cssText = 'padding:0;border:none;vertical-align:top;';
  const startIdx = isInstitutionalHeader ? 1 : 0;
  if (children.length > startIdx) {
    for (let i = startIdx; i < children.length; i++) {
      bodyTd.appendChild(children[i]);
    }
  } else {
    while (clone.firstChild) {
      bodyTd.appendChild(clone.firstChild);
    }
  }
  bodyTr.appendChild(bodyTd);
  tbody.appendChild(bodyTr);

  const tfoot = document.createElement('tfoot');
  tfoot.style.cssText = 'display:table-footer-group;';
  const bottomSpacerTr = document.createElement('tr');
  bottomSpacerTr.className = 'hmi-print-spacer-row';
  const bottomSpacerTd = document.createElement('td');
  bottomSpacerTd.className = 'hmi-print-bottom-spacer';
  bottomSpacerTr.appendChild(bottomSpacerTd);
  tfoot.appendChild(bottomSpacerTr);

  table.appendChild(thead);
  table.appendChild(tbody);
  table.appendChild(tfoot);
  outer.appendChild(table);
  return outer;
}

/**
 * Shared builder for the clean full-screen WHITE print page shell.
 */
function createWhiteViewerShell(title: string, subtitle: string, showDownloadButton = false) {
  const overlay = document.createElement('div');
  overlay.id = VIEWER_MODAL_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.setAttribute('data-render-mode', 'native-dom');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:999999;background:#ffffff;color:#0f172a;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;overflow:hidden;';

  const toolbar = document.createElement('div');
  toolbar.className = 'hmi-pdf-viewer-toolbar no-print';
  toolbar.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:#ffffff;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;flex-shrink:0;box-shadow:0 1px 3px rgba(15,23,42,0.06);';

  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = 'display:flex;align-items:center;gap:12px;min-width:0;flex:1;';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.setAttribute('data-testid', 'pdf-viewer-close-btn');
  backBtn.textContent = '← Volver';
  backBtn.style.cssText =
    'padding:9px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;box-shadow:none;';
  backBtn.onclick = () => closeViewerAndNotify();

  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'display:flex;flex-direction:column;min-width:0;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titleEl.textContent = title;

  const metaEl = document.createElement('div');
  metaEl.style.cssText = 'font-size:11px;font-weight:600;color:#64748b;margin-top:2px;';
  metaEl.textContent = subtitle;

  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(metaEl);
  leftGroup.appendChild(backBtn);
  leftGroup.appendChild(titleWrap);

  const rightGroup = document.createElement('div');
  rightGroup.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0;';

  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.setAttribute('data-testid', 'pdf-viewer-print-btn');
  printBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg><span>Imprimir</span>';
  printBtn.style.cssText =
    'display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:10px;border:none;background:#0d9488;color:#ffffff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 2px 6px rgba(13,148,136,0.28);';

  let downloadBtn: HTMLButtonElement | null = null;
  rightGroup.appendChild(printBtn);

  if (showDownloadButton) {
    downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.setAttribute('data-testid', 'pdf-viewer-download-btn');
    downloadBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Descargar PDF</span>';
    downloadBtn.style.cssText =
      'display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;color:#1e293b;font-weight:700;font-size:13px;cursor:pointer;box-shadow:none;';
    rightGroup.appendChild(downloadBtn);
  }

  toolbar.appendChild(leftGroup);
  toolbar.appendChild(rightGroup);

  const stage = document.createElement('div');
  stage.id = 'hmi-pdf-pages-stage';
  stage.style.cssText =
    'flex:1;overflow-y:auto;overflow-x:auto;background:#ffffff;padding:20px 16px 48px;display:flex;flex-direction:column;align-items:center;gap:24px;-webkit-overflow-scrolling:touch;';

  overlay.appendChild(toolbar);
  overlay.appendChild(stage);

  activeEscListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeViewerAndNotify();
    }
  };
  window.addEventListener('keydown', activeEscListener);

  return { overlay, stage, metaEl, printBtn, downloadBtn };
}

/**
 * INSTANT (<20ms) White Print Page directly from live DOM clinical sheet(s).
 * Renders the EXACT native HTML document format (never an <img> or canvas snapshot),
 * matching "Visualización de Evolución" cleanly on a pure white background with an
 * instant "Imprimir" button (no download button) that invokes window.print().
 */
export function openInstantWhitePrintPage(options: InstantWhitePrintOptions): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const normalizedSheets: InstantPrintSheetInput[] = options.sheets
    .map(item => (item instanceof HTMLElement ? { element: item } : item))
    .filter(item => !!item.element);

  if (normalizedSheets.length === 0) return;

  const title = options.title || 'Documento Clínico';
  // Default FALSE: documents occupy 100% page width and overflow naturally onto Page 2+
  const fitEachSheetToOnePage = options.fitEachSheetToOnePage === true;
  const defaultRepeatHeader = options.repeatHeaderOnOverflow !== false;

  cleanupPdfPrintResources();
  const printDocTitle = applyPrintDocumentTitle(options.fileName || options.title || 'Documento Clínico');
  activeOnCloseCallback = options.onClose || null;

  const totalPages = normalizedSheets.length;
  const subtitle =
    totalPages === 1
      ? 'Formato documento nativo · Ancho completo (fluye automáticamente a 2da hoja si excede)'
      : `${totalPages} documentos/páginas · Ancho completo listo para imprimir`;

  // Strictly print-only white page (no download button, pure native HTML document format)
  const { overlay, stage, printBtn } = createWhiteViewerShell(title, subtitle, false);

  const orientations: PdfPageOrientation[] = [];
  const clonedSheetRecords: Array<{
    inner: HTMLElement;
    orientation: PdfPageOrientation;
  }> = [];

  normalizedSheets.forEach((sheetInput, idx) => {
    const rect = sheetInput.element.getBoundingClientRect();
    const orientation: PdfPageOrientation =
      sheetInput.orientation ||
      (rect.width > 0 && rect.height > 0 && rect.width > rect.height * 1.15 ? 'landscape' : 'portrait');
    orientations.push(orientation);

    const wrapper = document.createElement('div');
    wrapper.className = 'hmi-pdf-page-wrapper';
    wrapper.setAttribute('data-page-number', String(idx + 1));
    wrapper.setAttribute('data-orientation', orientation);
    wrapper.setAttribute('data-native-document', 'true');
    wrapper.style.cssText =
      'width:100%;display:flex;flex-direction:column;align-items:stretch;gap:8px;';

    // Screen-only long patient banner (for bulk print from Inicio) OR page counter
    if (sheetInput.bannerText) {
      const banner = document.createElement('div');
      banner.className = 'hmi-pdf-patient-banner no-print';
      banner.setAttribute('data-testid', `print-patient-banner-${idx}`);
      banner.style.cssText =
        'width:100%;padding:8px 16px;border-radius:10px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:800;letter-spacing:0.3px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(15,23,42,0.12);';
      const leftSpan = document.createElement('span');
      leftSpan.textContent = sheetInput.bannerText;
      const rightSpan = document.createElement('span');
      rightSpan.style.cssText = 'font-size:11px;font-weight:700;color:#5eead4;white-space:nowrap;margin-left:12px;';
      rightSpan.textContent = `${idx + 1} de ${totalPages} · Solo visible en pantalla`;
      banner.appendChild(leftSpan);
      banner.appendChild(rightSpan);
      wrapper.appendChild(banner);
    } else if (totalPages > 1) {
      const caption = document.createElement('div');
      caption.className = 'hmi-pdf-page-caption no-print';
      caption.style.cssText =
        'font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.3px;text-align:center;';
      caption.textContent = `Página ${idx + 1} de ${totalPages}`;
      wrapper.appendChild(caption);
    }

    const sheet = document.createElement('div');
    sheet.className = 'hmi-pdf-page-sheet';
    // Occupy the full width of the white page cleanly
    sheet.style.cssText =
      'width:100%;max-width:100%;background:#ffffff;border:1px solid #cbd5e1;box-shadow:0 4px 16px rgba(15,23,42,0.06);overflow:visible;margin:0 auto;box-sizing:border-box;';

    const inner = document.createElement('div');
    inner.className = 'hmi-pdf-dom-sheet-inner';
    inner.style.cssText = 'width:100%;background:#ffffff;color:#000000;overflow:visible;box-sizing:border-box;';

    let cleanClone = prepareCleanPrintableClone(sheetInput.element, orientation);
    cleanClone.style.border = 'none';

    const shouldRepeatHeader =
      sheetInput.repeatHeaderOnOverflow !== undefined
        ? sheetInput.repeatHeaderOnOverflow
        : defaultRepeatHeader;
    cleanClone = wrapWithPrintFlowFrame(cleanClone, shouldRepeatHeader, orientation);

    inner.appendChild(cleanClone);
    sheet.appendChild(inner);
    wrapper.appendChild(sheet);
    stage.appendChild(wrapper);

    clonedSheetRecords.push({ inner, orientation });
  });

  document.body.appendChild(overlay);

  printBtn.onclick = () => {
    printWhiteViewerPages(orientations, clonedSheetRecords, fitEachSheetToOnePage, printDocTitle);
  };
}

export interface DirectDomPrintOptions {
  sheets: Array<HTMLElement | InstantPrintSheetInput>;
  /** Automatically scale any sheet taller than 1 Letter page so each sheet prints on 1 exact page */
  fitEachSheetToOnePage?: boolean;
  /** Optional document title / filename used by browser "Save as PDF" */
  title?: string;
  fileName?: string;
}

/**
 * DIRECT SYNCHRONOUS PRINT (0ms loading screen, 0 intermediate overlays):
 * Clones the live clinical DOM sheet(s) into a print-only portal (#hmi-direct-print-portal,
 * hidden on @media screen) and invokes window.print() immediately inside the user click gesture
 * so the browser opens the native print screen right away.
 */
export function printDomSheetsDirectly(options: DirectDomPrintOptions): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const normalizedSheets: InstantPrintSheetInput[] = options.sheets
    .map(item => (item instanceof HTMLElement ? { element: item } : item))
    .filter(item => !!item.element);

  if (normalizedSheets.length === 0) return;

  const fitEachSheetToOnePage = options.fitEachSheetToOnePage !== false;

  cleanupPdfPrintResources();

  const previousTitle = document.title;
  const directPrintTitle = options.fileName || options.title;
  if (directPrintTitle) {
    document.title = resolvePrintableDocumentTitle(directPrintTitle);
  }

  const portal = document.createElement('div');
  portal.id = DIRECT_PRINT_PORTAL_ID;
  portal.setAttribute('aria-hidden', 'true');

  const orientations: PdfPageOrientation[] = [];

  normalizedSheets.forEach((sheetInput, idx) => {
    const el = sheetInput.element;
    const unscaledWidth = el.offsetWidth || el.scrollWidth;
    const unscaledHeight = el.scrollHeight || el.offsetHeight;
    const orientation: PdfPageOrientation =
      sheetInput.orientation ||
      (unscaledWidth > 0 && unscaledHeight > 0 && unscaledWidth > unscaledHeight * 1.15 ? 'landscape' : 'portrait');
    orientations.push(orientation);

    const sheetWrap = document.createElement('div');
    sheetWrap.className = 'hmi-direct-print-sheet';
    sheetWrap.setAttribute('data-page-number', String(idx + 1));
    sheetWrap.setAttribute('data-orientation', orientation);

    const inner = document.createElement('div');
    inner.className = 'hmi-direct-print-sheet-inner';

    const cleanClone = prepareCleanPrintableClone(el, orientation);
    cleanClone.style.border = 'none';

    if (fitEachSheetToOnePage && unscaledHeight > 0) {
      const targetHeight =
        orientation === 'landscape' ? LETTER_LANDSCAPE_HEIGHT_PX : LETTER_PORTRAIT_HEIGHT_PX;
      const scale = computeSheetFitScale(unscaledHeight, targetHeight);
      if (scale < 0.995) {
        (inner.style as unknown as Record<string, string>).zoom = String(scale);
      }
    }

    inner.appendChild(cleanClone);
    sheetWrap.appendChild(inner);
    portal.appendChild(sheetWrap);
  });

  let styleEl = document.getElementById(DYNAMIC_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildDynamicPrintPageCss(orientations);

  document.body.appendChild(portal);
  document.body.classList.add('hmi-printing-portal');

  // Force synchronous layout flush before triggering native print dialog
  void portal.offsetHeight;

  let cleaned = false;
  const printMql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
  const onMqlChange = (e: MediaQueryListEvent) => {
    if (!e.matches) finishDirectPrint();
  };

  const finishDirectPrint = () => {
    if (cleaned) return;
    cleaned = true;
    activeDirectPrintCleanup = null;
    window.removeEventListener('afterprint', finishDirectPrint);
    if (printMql && typeof printMql.removeEventListener === 'function') {
      printMql.removeEventListener('change', onMqlChange);
    }
    document.body.classList.remove('hmi-printing-portal');
    if (directPrintTitle) {
      document.title = previousTitle;
    }
    const existingPortal = document.getElementById(DIRECT_PRINT_PORTAL_ID);
    if (existingPortal) existingPortal.remove();
    const existingStyle = document.getElementById(DYNAMIC_PAGE_STYLE_ID);
    if (existingStyle) existingStyle.remove();
  };

  activeDirectPrintCleanup = finishDirectPrint;
  window.addEventListener('afterprint', finishDirectPrint, { once: true });
  if (printMql && typeof printMql.addEventListener === 'function') {
    printMql.addEventListener('change', onMqlChange);
  }

  window.print();
}

/**
 * Lazily loads pdfjs-dist for callers that already have a pre-built jsPDF instance.
 */
async function loadPdfJs() {
  const [pdfjsLib, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  const workerUrl = (workerMod as { default?: string }).default;
  if (workerUrl && pdfjsLib.GlobalWorkerOptions.workerSrc !== workerUrl) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return pdfjsLib;
}

async function renderPdfBytesToPages(pdfBytes: Uint8Array): Promise<RenderedPdfPage[]> {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;

  const pages: RenderedPdfPage[] = [];
  const renderScale = 1.5;

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        continue;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pages.push({
        pageNumber: pageNum,
        dataUrl,
        width: viewport.width,
        height: viewport.height,
        orientation: computePdfPageOrientation(viewport.width, viewport.height),
      });

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}

/**
 * Fallback white-page renderer for any caller that passes a pre-built jsPDF object.
 */
export async function printPdfDocument(
  pdf: jsPDF,
  options: PrintPdfOptions = {}
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const title = options.title || 'Documento Clínico PDF';

  cleanupPdfPrintResources();
  const printDocTitle = applyPrintDocumentTitle(options.fileName || options.title || 'Documento Clínico PDF');
  activeOnCloseCallback = options.onClose || null;

  const arrayBuffer = pdf.output('arraybuffer');
  const pdfBytes = new Uint8Array(arrayBuffer);
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfBlob);
  activePdfBlobUrl = blobUrl;

  const { overlay, stage, metaEl, printBtn } = createWhiteViewerShell(
    title,
    'Cargando páginas del documento...',
    false
  );

  printBtn.disabled = true;
  printBtn.style.opacity = '0.65';

  const loadingBox = document.createElement('div');
  loadingBox.style.cssText =
    'margin:64px auto;text-align:center;color:#475569;font-size:14px;font-weight:700;';
  loadingBox.textContent = 'Renderizando documento PDF listo para imprimir...';
  stage.appendChild(loadingBox);

  document.body.appendChild(overlay);

  try {
    const pages = await renderPdfBytesToPages(pdfBytes);
    if (!document.getElementById(VIEWER_MODAL_ID)) return;

    stage.innerHTML = '';
    const orientations: PdfPageOrientation[] = [];

    for (const pg of pages) {
      orientations.push(pg.orientation);

      const wrapper = document.createElement('div');
      wrapper.className = 'hmi-pdf-page-wrapper';
      wrapper.setAttribute('data-page-number', String(pg.pageNumber));
      wrapper.setAttribute('data-orientation', pg.orientation);
      wrapper.style.cssText =
        'width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;';

      if (pages.length > 1) {
        const caption = document.createElement('div');
        caption.className = 'hmi-pdf-page-caption no-print';
        caption.style.cssText =
          'font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.3px;';
        caption.textContent = `Página ${pg.pageNumber} de ${pages.length}`;
        wrapper.appendChild(caption);
      }

      const sheet = document.createElement('div');
      sheet.className = 'hmi-pdf-page-sheet';
      const maxWidthPx = pg.orientation === 'landscape' ? '1060px' : '820px';
      sheet.style.cssText = `width:100%;max-width:${maxWidthPx};background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;box-shadow:0 4px 18px rgba(15,23,42,0.08);overflow:hidden;`;

      const img = document.createElement('img');
      img.src = pg.dataUrl;
      img.alt = `${title} — Página ${pg.pageNumber}`;
      img.style.cssText = 'display:block;width:100%;height:auto;background:#ffffff;';

      sheet.appendChild(img);
      wrapper.appendChild(sheet);
      stage.appendChild(wrapper);
    }

    const totalPages = pages.length;
    metaEl.textContent =
      totalPages === 1
        ? '1 página · Documento PDF listo para imprimir'
        : `${totalPages} páginas · Documento PDF listo para imprimir`;

    printBtn.disabled = false;
    printBtn.style.opacity = '1';
    printBtn.onclick = () => printWhiteViewerPages(orientations, [], false, printDocTitle);
  } catch (err) {
    console.error('Error renderizando páginas del PDF en la vista de impresión:', err);
    if (!document.getElementById(VIEWER_MODAL_ID)) return;

    stage.innerHTML = '';
    const errorBox = document.createElement('div');
    errorBox.style.cssText =
      'margin:48px auto;max-width:460px;padding:24px;border-radius:14px;border:1px solid #e2e8f0;background:#f8fafc;text-align:center;color:#0f172a;';
    errorBox.innerHTML =
      '<div style="font-weight:800;font-size:15px;margin-bottom:8px;">No se pudo previsualizar el PDF en pantalla</div><div style="font-size:13px;color:#475569;">Puedes descargarlo directamente con el botón "Descargar PDF" en la barra superior para imprimirlo.</div>';
    stage.appendChild(errorBox);

    metaEl.textContent = 'Vista previa no disponible · Usa Descargar PDF';
    printBtn.disabled = true;
    printBtn.style.opacity = '0.45';
  }
}
