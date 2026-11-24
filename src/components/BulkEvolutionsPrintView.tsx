import React, { useState, useEffect, useRef } from 'react';
import { Patient, MedicalEvolution } from '../types';
import { Printer, Download, ArrowLeft, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EvolutionSheetContent, renderElementSlicesToPdf } from './MedicalEvolutionDocument';
import { openInstantWhitePrintPage, formatPrintDocumentTitle } from '../utils/pdfPrinter';

export interface BulkEvolutionItem {
  patient: Patient;
  evolution: MedicalEvolution;
}

interface Props {
  items: BulkEvolutionItem[];
  autoDownload?: boolean;
  autoPrint?: boolean;
  onClose: () => void;
}

export function collectInlineStylesForPrint(): string {
  const chunks: string[] = [];
  Array.from(document.styleSheets).forEach(sheet => {
    try {
      if (sheet.cssRules) {
        const rulesText = Array.from(sheet.cssRules)
          .map(r => r.cssText)
          .join('\n');
        chunks.push(`<style>${rulesText}</style>`);
      }
    } catch {
      if (sheet.href) {
        chunks.push(`<link rel="stylesheet" href="${sheet.href}" />`);
      }
    }
  });
  if (chunks.length === 0) {
    return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');
  }
  return chunks.join('\n');
}

const ScaledSheetItem: React.FC<{
  patient: Patient;
  evolution: MedicalEvolution;
  activeScale: number;
  index: number;
  total: number;
  autoDownload: boolean;
}> = ({ patient, evolution, activeScale, index, total, autoDownload }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState(1056);

  useEffect(() => {
    if (autoDownload) return;
    const el = sheetRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.offsetHeight > 0) {
        setSheetHeight(el.offsetHeight);
      }
    };
    updateHeight();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeight);
      observer.observe(el);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [patient, evolution, autoDownload]);

  const isScaled = !autoDownload && activeScale !== 1;

  return (
    <div
      className="scaled-sheet-wrapper mx-auto relative print:w-full! print:h-auto!"
      style={
        isScaled
          ? {
              width: `${Math.round(816 * activeScale)}px`,
              height: `${Math.round(sheetHeight * activeScale)}px`,
            }
          : { width: '215.9mm' }
      }
    >
      {!autoDownload && total > 1 && (
        <div className="no-print mb-1.5 flex items-center justify-between px-2 py-1 rounded-lg bg-slate-800/90 text-white text-[10px] font-bold tracking-wide">
          <span className="truncate">
            #{index + 1} · Cama {patient.bedNumber} — {patient.lastName} {patient.firstName}
          </span>
          <span className="text-teal-300 shrink-0 ml-2">
            {evolution.date?.split('-').reverse().join('/') || ''} {evolution.time || ''}
          </span>
        </div>
      )}
      <div
        ref={sheetRef}
        className="bulk-evolution-sheet bg-white text-black w-[215.9mm] min-h-[279.4mm] p-[12mm_14mm] border border-slate-300 box-border font-sans relative print:border-none"
        style={{
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
          transform: isScaled ? `scale(${activeScale})` : 'none',
          transformOrigin: 'top left',
        }}
      >
        <EvolutionSheetContent patient={patient} evolution={evolution} />
      </div>
    </div>
  );
};

export const BulkEvolutionsPrintView: React.FC<Props> = ({
  items,
  autoDownload = false,
  autoPrint = false,
  onClose,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [customScale, setCustomScale] = useState<number | null>(null);

  useEffect(() => {
    if (autoDownload) return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoDownload]);

  const isMobileViewport = viewportWidth < 860;
  const fitScale = isMobileViewport
    ? Math.min(1, Math.max(0.38, (viewportWidth - 16) / 816))
    : 1;
  const activeScale = customScale !== null ? customScale : fitScale;

  const printDateStr = items[0]?.evolution?.date
    ? items[0].evolution.date.split('-').reverse().join('-')
    : new Date().toLocaleDateString('es-VE').replace(/\//g, '-');

  useEffect(() => {
    return () => {
      document.body.classList.remove('hmi-printing-portal');
      const existingPortal = document.getElementById('hmi-direct-print-portal');
      if (existingPortal) existingPortal.remove();
    };
  }, []);

  const buildBulkEvolutionsPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const containerEl = document.getElementById('bulk-evolutions-sheets-container');
    if (!containerEl) return null;

    const sheetEls = Array.from(
      containerEl.querySelectorAll('.bulk-evolution-sheet')
    ) as HTMLElement[];
    if (sheetEls.length === 0) return null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    for (let i = 0; i < sheetEls.length; i++) {
      await renderElementSlicesToPdf(pdf, sheetEls[i], i > 0);
    }

    const fileName = `EVOLUCIONES_MEDICAS_${printDateStr}.pdf`.replace(/[^A-Z0-9_.-]/gi, '');
    return { pdf, fileName };
  };

  const handlePrintAll = () => {
    const containerEl = document.getElementById('bulk-evolutions-sheets-container');
    if (!containerEl) return;
    const sheetEls = Array.from(
      containerEl.querySelectorAll('.bulk-evolution-sheet')
    ) as HTMLElement[];
    if (sheetEls.length === 0) return;

    const sheetInputs = sheetEls.map((el, idx) => {
      const item = items[idx];
      const pt = item?.patient;
      const ev = item?.evolution;
      const bannerText = pt
        ? `#${idx + 1} · Cama ${pt.bedNumber} — ${pt.lastName}, ${pt.firstName} (${pt.area}) · ${ev?.date?.split('-').reverse().join('/') || ''} ${ev?.time || ''}`.trim()
        : undefined;
      return {
        element: el,
        bannerText,
        repeatHeaderOnOverflow: true,
      };
    });

    openInstantWhitePrintPage({
      sheets: sheetInputs,
      title: `Evoluciones Médicas (${items.length})`,
      fileName: formatPrintDocumentTitle('Evoluciones Medicas', `${items.length} pacientes`, { includeDateTime: true }),
      onDownloadPdf: handleDownloadPdf,
      onClose: autoPrint ? onClose : undefined,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const built = await buildBulkEvolutionsPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (error) {
      console.error('Error generando PDF masivo de evoluciones:', error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    if (autoDownload) {
      let cancelled = false;
      const rafId = requestAnimationFrame(() => {
        if (!cancelled) {
          handleDownloadPdf().then(() => {
            if (!cancelled) onClose();
          });
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }
    if (autoPrint) {
      let cancelled = false;
      const rafId = requestAnimationFrame(() => {
        if (!cancelled) {
          handlePrintAll();
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }
  }, [autoDownload, autoPrint]);

  return (
    <div
      id="bulk-evolutions-print-root"
      className={
        autoDownload
          ? 'fixed left-[-10000px] top-0 w-[215.9mm] bg-white text-black pointer-events-none z-[-1]'
          : 'fixed inset-0 z-[250] bg-slate-100 text-black flex flex-col overflow-hidden print:static print:overflow-visible print:bg-white'
      }
    >
      {/* Top Action Bar */}
      {!autoDownload && (
        <div className="w-full bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col gap-2 shrink-0 z-30 no-print shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                Evoluciones Diarias ({items.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrintAll}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Mobile Zoom & Navigation Controls */}
          {isMobileViewport && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80 text-[11px]">
              <span className="text-slate-500 font-semibold truncate">
                Vista móvil ({items.length} {items.length === 1 ? 'paciente' : 'pacientes'} · desliza para ver todo)
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setCustomScale(prev =>
                      Math.max(0.35, Number(((prev ?? activeScale) - 0.12).toFixed(2)))
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  title="Alejar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCustomScale(null)}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${
                    customScale === null
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  Ajustar ({Math.round(activeScale * 100)}%)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomScale(prev =>
                      prev === 1 ? null : 1
                    )
                  }
                  className={`px-2 py-1 rounded-lg font-bold ${
                    customScale === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomScale(prev =>
                      Math.min(1.4, Number(((prev ?? activeScale) + 0.12).toFixed(2)))
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  title="Acercar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full-Page Scrollable Container for All Evolution Sheets */}
      <div
        className={
          autoDownload
            ? 'w-full'
            : 'flex-1 w-full overflow-y-auto overflow-x-auto overscroll-contain py-3 sm:py-6 px-2 sm:px-4 pb-24 print:p-0 print:overflow-visible'
        }
        style={autoDownload ? undefined : { WebkitOverflowScrolling: 'touch' }}
      >
        <div
          id="bulk-evolutions-sheets-container"
          className="w-full flex flex-col gap-6 sm:gap-8 print:py-0 print:gap-0"
        >
          {items.map(({ patient: p, evolution: ev }, idx) => (
            <ScaledSheetItem
              key={`${p.id}-${ev.id || idx}`}
              patient={p}
              evolution={ev}
              activeScale={activeScale}
              index={idx}
              total={items.length}
              autoDownload={autoDownload}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
