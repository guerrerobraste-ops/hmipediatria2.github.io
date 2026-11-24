import React, { useState, useEffect, useMemo } from 'react';
import { Patient, HistoriaClinicaPediatrica, MedicalEvolution, OrdenMedicaItem } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import { Printer, Download, ArrowLeft, Loader2, ClipboardList, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  openInstantWhitePrintPage,
  formatPrintDocumentTitle,
  addCanvasSinglePageWithMargin,
  type InstantPrintSheetInput,
} from '../utils/pdfPrinter';

function getLatestEvolution(patient: Patient): MedicalEvolution | null {
  const evolutions = patient.evolutions || [];
  if (evolutions.length === 0) return null;
  const sorted = [...evolutions].sort((a, b) => {
    const aKey = `${a.date || ''}T${a.time || '00:00'}#${a.createdAt || ''}`;
    const bKey = `${b.date || ''}T${b.time || '00:00'}#${b.createdAt || ''}`;
    return bKey.localeCompare(aKey);
  });
  return sorted[0] || null;
}

function formatDateVe(iso?: string): string {
  if (!iso) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function formatTime12h(): string {
  const now = new Date();
  let h = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function formatStayLong(admissionDate: string, admissionTime?: string): string {
  const calc = calculateHospitalizationTime(admissionDate, admissionTime);
  if (calc.days === 0) {
    if (calc.remainingHours === 0) return `${calc.minutes} min (Ingreso reciente)`;
    return `${calc.remainingHours} ${calc.remainingHours === 1 ? 'hora' : 'horas'}, ${calc.minutes} min`;
  }
  return `${calc.days} ${calc.days === 1 ? 'día' : 'días'}, ${calc.remainingHours} ${calc.remainingHours === 1 ? 'hora' : 'horas'}`;
}

function appendUnitIfMissing(raw: string | undefined, unit: string, pattern: RegExp): string {
  const val = (raw || '').trim();
  if (!val) return '---';
  if (pattern.test(val)) return val;
  return `${val}${unit.startsWith('%') ? '' : ' '}${unit}`;
}

function parseDiagnosesForBulk(
  patient: Patient,
  latestEv: MedicalEvolution | null,
  historia?: HistoriaClinicaPediatrica
): Array<{ key: string; text: string; isSub: boolean }> {
  const lines: Array<{ key: string; text: string; isSub: boolean }> = [];

  if (latestEv?.diagnosesModified?.trim()) {
    let idxCounter = 1;
    latestEv.diagnosesModified
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach((line, i) => {
        const subMatch = line.match(/^(\d+(?:\.\d+)+)\.?\s*(.*)$/);
        const mainMatch = line.match(/^(\d+)\.?\s+(.*)$/);
        if (subMatch) {
          lines.push({ key: `sub-${i}`, text: `${subMatch[1]}. ${subMatch[2]}`, isSub: true });
        } else if (mainMatch) {
          lines.push({ key: `main-${i}`, text: `${mainMatch[1]}. ${mainMatch[2]}`, isSub: false });
          idxCounter = parseInt(mainMatch[1], 10) + 1;
        } else {
          lines.push({ key: `plain-${i}`, text: `${idxCounter++}. ${line}`, isSub: false });
        }
      });
    if (lines.length > 0) return lines;
  }

  if (patient.diagnoses?.length) {
    patient.diagnoses.forEach((d, idx) => {
      const t = (d.title || '').trim();
      if (!t) return;
      const isSub = /^\d+\.\d+/.test(t);
      const hasNum = /^\d+[\.\-\)]\s*/.test(t);
      lines.push({ key: `p-${idx}`, text: hasNum || isSub ? t : `${idx + 1}. ${t}`, isSub });
      d.subDiagnoses?.forEach((sd, sIdx) => {
        const cs = (sd || '').trim();
        if (!cs) return;
        lines.push({
          key: `ps-${idx}-${sIdx}`,
          text: /^\d+\.\d+/.test(cs) ? cs : `${idx + 1}.${sIdx + 1}. ${cs}`,
          isSub: true,
        });
      });
    });
    if (lines.length > 0) return lines;
  }

  if (historia?.diagnosticoAdmision?.trim()) {
    historia.diagnosticoAdmision
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        lines.push({
          key: `hc-${idx}`,
          text: /^\d+[\.\)]\s*/.test(line) ? line : `${idx + 1}. ${line}`,
          isSub: /^\d+\.\d+/.test(line),
        });
      });
    if (lines.length > 0) return lines;
  }

  return [{ key: 'def', text: '1. En evaluación clínica por el servicio de pediatría.', isSub: false }];
}

function parseTreatmentsForBulk(
  patient: Patient,
  latestEv: MedicalEvolution | null
): Array<{ numero: string; medicamento: string; dosis: string; diaTratamiento: string }> {
  const rawText = (latestEv?.treatmentModified || patient.treatment || '').trim();
  const normalized = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\.+$/, '')
    .trim();

  if (!rawText || normalized === 'sintomatico') {
    return [
      {
        numero: '1',
        medicamento: 'Sintomático',
        dosis: 'Según indicación',
        diaTratamiento: 'Vigente',
      },
    ];
  }

  const rows: Array<{ numero: string; medicamento: string; dosis: string; diaTratamiento: string }> = [];
  rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .forEach((line, idx) => {
      const numMatch = line.match(/^(\d+)\.?\s*(.*)$/);
      const rowNum = numMatch ? numMatch[1] : String(idx + 1);
      const content = numMatch ? numMatch[2] : line;

      const doseMatch = content.match(/\|\s*Dosis:\s*([^|]+)/i);
      const startMatch = content.match(/\|\s*Inicio:\s*(\d{4}-\d{2}-\d{2})/i);
      const culmDateMatch = content.match(/\|\s*Culminaci[oó]n:\s*(\d{4}-\d{2}-\d{2})/i);
      const dayMatch = content.match(/\|\s*(D[ií]a\s*\d+(?:\s*\([^)]+\))?)/i);
      const ncMatch = content.match(/\|\s*NO CUMPLIDO HOY(?::\s*([^|]+))?/i);
      const culmMatch = content.match(/\|\s*TRATAMIENTO CULMINADO\b/i);
      const diasCumplidosMatch = content.match(/\|\s*(\d+\s*d[ií]as?\s*cumplidos?)\b/i);

      const medName = content.split('|')[0].trim();
      const doseStr = doseMatch ? doseMatch[1].trim() : 'Según indicación';

      let dayStr = 'En curso';
      if (culmMatch) {
        const sLabel = startMatch ? `Inicio: ${formatDateVe(startMatch[1])}` : '';
        const eLabel = culmDateMatch ? `Culminación: ${formatDateVe(culmDateMatch[1])}` : '';
        const dLabel = diasCumplidosMatch ? diasCumplidosMatch[1].trim() : '';
        dayStr = ['Culminado', sLabel, eLabel, dLabel].filter(Boolean).join(' · ');
      } else if (dayMatch && startMatch) {
        dayStr = `${dayMatch[1].trim()} (Inicio: ${formatDateVe(startMatch[1])})`;
      } else if (dayMatch) {
        dayStr = dayMatch[1].trim();
      } else if (startMatch) {
        dayStr = `Inicio: ${formatDateVe(startMatch[1])}`;
      }

      if (ncMatch) {
        dayStr += ncMatch[1]?.trim() ? ` · No cumplido (${ncMatch[1].trim()})` : ' · No cumplido hoy';
      }

      rows.push({
        numero: rowNum,
        medicamento: `${rowNum}. ${medName || content}`,
        dosis: doseStr,
        diaTratamiento: dayStr,
      });
    });

  return rows.length > 0
    ? rows
    : [{ numero: '1', medicamento: 'Sintomático', dosis: 'Según indicación', diaTratamiento: 'Vigente' }];
}

export interface ResolvedPatientOrders {
  patient: Patient;
  orders: OrdenMedicaItem[];
  fecha: string;
  hora: string;
  peso: string;
  doctorName: string;
}

/**
 * Resolves the latest updated Medical Orders for a hospitalized patient.
 */
export function resolveUpdatedOrdersForPatient(
  patient: Patient,
  fallbackDoctorName: string = 'Dr. Brayan'
): ResolvedPatientOrders | null {
  const latestEv = getLatestEvolution(patient);
  const sortedEvs = [...(patient.evolutions || [])]
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = `${a.date || ''}T${a.time || '00:00'}#${a.createdAt || ''}`;
      const bKey = `${b.date || ''}T${b.time || '00:00'}#${b.createdAt || ''}`;
      return bKey.localeCompare(aKey);
    });
  const latestWithOrders = sortedEvs.find(e => e.ordenesMedicas && e.ordenesMedicas.length > 0);

  const orders =
    patient.ordenesMedicas && patient.ordenesMedicas.length > 0
      ? patient.ordenesMedicas
      : latestWithOrders?.ordenesMedicas && latestWithOrders.ordenesMedicas.length > 0
      ? latestWithOrders.ordenesMedicas
      : [];

  if (orders.length === 0) return null;

  const fecha =
    patient.ordenesFecha ||
    latestWithOrders?.ordenesFecha ||
    latestEv?.date ||
    new Date().toISOString().split('T')[0];
  const hora =
    patient.ordenesHora ||
    latestWithOrders?.ordenesHora ||
    latestEv?.time ||
    formatTime12h();
  const peso =
    patient.ordenesPeso ||
    latestWithOrders?.ordenesPeso ||
    latestEv?.vitalSigns?.peso ||
    (patient.weightKg ? `${patient.weightKg} kg` : '---');
  const doctorName = latestWithOrders?.doctorName || latestEv?.doctorName || fallbackDoctorName;

  return { patient, orders, fecha, hora, peso, doctorName };
}

/**
 * Renders a list of sheet elements into a Letter PDF where EACH element fits strictly onto 1 single sheet.
 */
async function buildSheetsSinglePageEachPdf(sheetEls: HTMLElement[]): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: true,
  });

  for (let i = 0; i < sheetEls.length; i++) {
    const el = sheetEls[i];

    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 900,
      onclone: (docClone, clonedEl) => {
        sanitizeCloneForHtml2Canvas(docClone, clonedEl);
        if (clonedEl) {
          clonedEl.style.width = '215.9mm';
          clonedEl.style.minHeight = 'auto';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.border = 'none';
          clonedEl.style.transform = 'none';
        }
      },
    });

    addCanvasSinglePageWithMargin(pdf, canvas, {
      addNewPageFirst: i > 0,
      quality: 0.92,
    });
  }

  return pdf;
}

async function exportSheetsSinglePageEachToPdf(sheetEls: HTMLElement[], fileName: string): Promise<void> {
  const pdf = await buildSheetsSinglePageEachPdf(sheetEls);
  pdf.save(fileName);
}

function printSheetsSinglePageEachInstant(
  sheets: Array<HTMLElement | InstantPrintSheetInput>,
  title: string,
  fileName: string,
  onDownloadPdf?: () => Promise<void>,
  onClose?: () => void
): void {
  openInstantWhitePrintPage({
    sheets,
    title,
    fileName,
    onDownloadPdf,
    onClose,
    fitEachSheetToOnePage: false,
    repeatHeaderOnOverflow: true,
  });
}

/* =========================================================================
 * 1. BULK NOTAS DE RECIBIMIENTO (Todos los pacientes hospitalizados)
 * ========================================================================= */
interface BulkNotasProps {
  patients: Patient[];
  historias: HistoriaClinicaPediatrica[];
  autoDownload?: boolean;
  autoPrint?: boolean;
  onClose: () => void;
}

export const BulkNotasRecibimientoPrintView: React.FC<BulkNotasProps> = ({
  patients,
  historias,
  autoDownload = false,
  autoPrint = false,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const fechaHoy = useMemo(() => formatDateVe(), []);
  const horaHoy = useMemo(() => formatTime12h(), []);

  useEffect(() => {
    return () => {
      document.body.classList.remove('hmi-printing-portal');
      const p = document.getElementById('hmi-direct-print-portal');
      if (p) p.remove();
    };
  }, []);

  const isPrintingPdf = false;

  const handleDownloadPdf = async () => {
    if (isExporting || isPrintingPdf) return;
    const container = document.getElementById('bulk-notas-recibimiento-container');
    if (!container) return;
    const sheetEls = Array.from(container.querySelectorAll('.bulk-nota-sheet')) as HTMLElement[];
    if (sheetEls.length === 0) return;

    setIsExporting(true);
    try {
      const dateFile = fechaHoy.replace(/\//g, '-');
      await exportSheetsSinglePageEachToPdf(sheetEls, `NOTAS_DE_RECIBIMIENTO_${dateFile}.pdf`);
    } catch (err) {
      console.error('Error generando PDF masivo de Notas de Recibimiento:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    const container = document.getElementById('bulk-notas-recibimiento-container');
    if (!container) return;
    const sheetEls = Array.from(container.querySelectorAll('.bulk-nota-sheet')) as HTMLElement[];
    if (sheetEls.length === 0) return;

    const sheetInputs: InstantPrintSheetInput[] = sheetEls.map((el, idx) => {
      const pt = patients[idx];
      return {
        element: el,
        bannerText: pt
          ? `#${idx + 1} · Cama ${pt.bedNumber} — ${pt.lastName}, ${pt.firstName} (${pt.area}) · Nota de Recibimiento`
          : undefined,
        repeatHeaderOnOverflow: true,
      };
    });

    printSheetsSinglePageEachInstant(
      sheetInputs,
      `Notas de Recibimiento (${patients.length})`,
      formatPrintDocumentTitle('Notas de Recibimiento', `${patients.length} pacientes`, { includeDateTime: true }),
      handleDownloadPdf,
      autoPrint ? onClose : undefined
    );
  };

  useEffect(() => {
    if (autoDownload) {
      let cancelled = false;
      const raf = requestAnimationFrame(() => {
        if (!cancelled) {
          handleDownloadPdf().then(() => {
            if (!cancelled) onClose();
          });
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    if (autoPrint) {
      let cancelled = false;
      const raf = requestAnimationFrame(() => {
        if (!cancelled) {
          handlePrintPdf();
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
  }, [autoDownload, autoPrint]);

  return (
    <div
      className={
        autoDownload
          ? 'fixed left-[-10000px] top-0 w-[215.9mm] bg-white text-black pointer-events-none z-[-1]'
          : 'fixed inset-0 z-[260] bg-slate-100 text-black flex flex-col overflow-hidden print:static print:overflow-visible print:bg-white'
      }
    >
      {!autoDownload && (
        <div className="w-full bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 z-30 no-print shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                Notas de Recibimiento ({patients.length}) · 1 hoja por paciente
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      )}

      <div
        className={
          autoDownload
            ? 'w-full'
            : 'flex-1 w-full overflow-y-auto overflow-x-auto py-4 px-2 sm:px-4 pb-24 print:p-0 print:overflow-visible'
        }
      >
        <div
          id="bulk-notas-recibimiento-container"
          className="w-full flex flex-col items-center gap-6 print:gap-0"
        >
          {patients.map((pt, idx) => {
            const latestEv = getLatestEvolution(pt);
            const historia = historias.find(
              h =>
                h.id === pt.historiaClinicaId ||
                h.patientId === pt.id ||
                (h.numHistoria && h.numHistoria === pt.medicalHistoryNumber)
            );
            const dxList = parseDiagnosesForBulk(pt, latestEv, historia);
            const txList = parseTreatmentsForBulk(pt, latestEv);
            const vs = latestEv?.vitalSigns;
            const fc = appendUnitIfMissing(vs?.fc, 'lpm', /lpm|bpm|x/i);
            const fr = appendUnitIfMissing(vs?.fr, 'rpm', /rpm|x/i);
            const temp = appendUnitIfMissing(vs?.temp, '°C', /°|c/i);
            const sat = appendUnitIfMissing(vs?.so2, '%', /%/);
            const ta = appendUnitIfMissing(vs?.ta, 'mmHg', /mmhg/i);
            const pesoVal = vs?.peso || (pt.weightKg ? `${pt.weightKg} kg` : '---');
            const subjetivo =
              latestEv?.subjetivo?.trim() ||
              'Madre o representante refiere evolución clínica acorde al motivo de ingreso, sin intercurrencias agudas inmediatas.';
            const objetivo =
              latestEv?.objetivo?.trim() ||
              'Paciente pediátrico evaluado en regulares condiciones generales, afebril al tacto, eupneico, hidratado y hemodinámicamente estable.';
            const areaDisplay =
              pt.area === 'Hospitalización'
                ? 'Servicio de Pediatría — Hospitalización'
                : `Servicio de Pediatría — ${pt.area}`;

            return (
              <div key={pt.id || idx} className="w-[215.9mm] mx-auto">
                {!autoDownload && patients.length > 1 && (
                  <div className="no-print mb-1.5 flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold">
                    <span className="truncate">
                      #{idx + 1} · Cama {pt.bedNumber} — {pt.lastName}, {pt.firstName}
                    </span>
                    <span className="text-sky-300 shrink-0 ml-2">{pt.area}</span>
                  </div>
                )}

                <div
                  className="bulk-nota-sheet bg-white text-[#1e293b] w-[215.9mm] min-h-[270mm] p-[11mm_14mm] border border-slate-300 shadow-md box-border flex flex-col justify-between"
                  style={{ fontFamily: 'Calibri, Arial, Helvetica, sans-serif' }}
                >
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                      <h1
                        style={{
                          color: '#164e78',
                          fontSize: '15pt',
                          fontWeight: 800,
                          letterSpacing: '0.4px',
                          margin: 0,
                          textTransform: 'uppercase',
                        }}
                      >
                        NOTA DE RECIBIMIENTO DEL PACIENTE
                      </h1>
                      <p style={{ color: '#64748b', fontSize: '9.5pt', margin: '3px 0 0 0', fontWeight: 500 }}>
                        {areaDisplay}
                      </p>
                    </div>

                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        marginBottom: '12px',
                        fontSize: '9.5pt',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ width: '50%', padding: '5px 8px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                            <strong style={{ color: '#164e78' }}>Fecha:</strong> {fechaHoy}
                          </td>
                          <td style={{ width: '50%', padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                            <strong style={{ color: '#164e78' }}>Hora:</strong> {horaHoy}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                            <strong style={{ color: '#164e78' }}>Paciente:</strong> {pt.lastName}, {pt.firstName}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                            <strong style={{ color: '#164e78' }}>Historia Clínica (HC N°):</strong> {pt.medicalHistoryNumber || '---'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                            <strong style={{ color: '#164e78' }}>Edad / Sexo:</strong> {pt.age} ({pt.gender === 'F' ? 'Femenino' : 'Masculino'})
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1' }}>
                            <strong style={{ color: '#164e78' }}>Peso:</strong> {pesoVal}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '5px 8px', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                            <strong style={{ color: '#164e78' }}>Fecha de Ingreso:</strong> {formatDateVe(pt.admissionDate)} · Cama {pt.bedNumber}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <strong style={{ color: '#164e78' }}>Estancia:</strong> {formatStayLong(pt.admissionDate, pt.admissionTime)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ marginBottom: '10px' }}>
                      <h2 style={{ color: '#164e78', fontSize: '10.5pt', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #94a3b8', paddingBottom: '2px', margin: '0 0 6px 0' }}>
                        EVALUACIÓN CLÍNICA DE RECIBIMIENTO
                      </h2>
                      <p style={{ fontSize: '9.5pt', lineHeight: 1.4, margin: '0 0 5px 0' }}>
                        <strong style={{ color: '#164e78' }}>Subjetivo:</strong> {subjetivo}
                      </p>
                      <p style={{ fontSize: '9.5pt', lineHeight: 1.4, margin: 0 }}>
                        <strong style={{ color: '#164e78' }}>Objetivo:</strong> {objetivo}
                      </p>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <h2 style={{ color: '#164e78', fontSize: '10.5pt', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #94a3b8', paddingBottom: '2px', margin: '0 0 6px 0' }}>
                        SIGNOS VITALES
                      </h2>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', textAlign: 'center', border: '1px solid #94a3b8' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#edf4fa', color: '#164e78' }}>
                            <th style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #94a3b8' }}>FC</th>
                            <th style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #94a3b8' }}>FR</th>
                            <th style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #94a3b8' }}>T°</th>
                            <th style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #94a3b8' }}>SatO₂</th>
                            <th style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #94a3b8' }}>TA</th>
                            <th style={{ padding: '4px', borderBottom: '1px solid #94a3b8' }}>Peso</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '5px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{fc}</td>
                            <td style={{ padding: '5px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{fr}</td>
                            <td style={{ padding: '5px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{temp}</td>
                            <td style={{ padding: '5px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{sat}</td>
                            <td style={{ padding: '5px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{ta}</td>
                            <td style={{ padding: '5px', fontWeight: 600 }}>{pesoVal}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <h2 style={{ color: '#164e78', fontSize: '10.5pt', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #94a3b8', paddingBottom: '2px', margin: '0 0 6px 0' }}>
                        DIAGNÓSTICOS DE INGRESO / RECIBIMIENTO
                      </h2>
                      <div style={{ fontSize: '9.5pt', lineHeight: 1.4 }}>
                        {dxList.map(item => (
                          <div key={item.key} style={{ paddingLeft: item.isSub ? '24px' : '10px', marginBottom: '2px' }}>
                            {item.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h2 style={{ color: '#164e78', fontSize: '10.5pt', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #94a3b8', paddingBottom: '2px', margin: '0 0 6px 0' }}>
                        TRATAMIENTO INDICADO
                      </h2>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', border: '1px solid #94a3b8' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#edf4fa', color: '#164e78' }}>
                            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '38%' }}>Medicamento</th>
                            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '27%' }}>Dosis</th>
                            <th style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid #94a3b8', width: '35%' }}>Día de Tratamiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txList.map((row, rIdx) => (
                            <tr key={`${row.numero}-${rIdx}`}>
                              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.medicamento}</td>
                              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.dosis}</td>
                              <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0' }}>{row.diaTratamiento}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', width: '260px', borderTop: '1px solid #334155', paddingTop: '5px' }}>
                      <p style={{ fontSize: '9pt', color: '#475569', margin: 0, fontWeight: 600 }}>
                        Médico Residente / Firma y Sello
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
 * 2. BULK ÓRDENES MÉDICAS (Únicamente Órdenes Médicas Actualizadas por Paciente)
 * ========================================================================= */
interface BulkOrdenesProps {
  items: ResolvedPatientOrders[];
  autoDownload?: boolean;
  autoPrint?: boolean;
  onClose: () => void;
}

export const BulkOrdenesMedicasPrintView: React.FC<BulkOrdenesProps> = ({
  items,
  autoDownload = false,
  autoPrint = false,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    return () => {
      document.body.classList.remove('hmi-printing-portal');
      const p = document.getElementById('hmi-direct-print-portal');
      if (p) p.remove();
    };
  }, []);

  const isPrintingPdf = false;

  const handleDownloadPdf = async () => {
    if (isExporting || isPrintingPdf) return;
    const container = document.getElementById('bulk-ordenes-medicas-container');
    if (!container) return;
    const sheetEls = Array.from(container.querySelectorAll('.bulk-orden-sheet')) as HTMLElement[];
    if (sheetEls.length === 0) return;

    setIsExporting(true);
    try {
      const dateFile = formatDateVe().replace(/\//g, '-');
      await exportSheetsSinglePageEachToPdf(sheetEls, `ORDENES_MEDICAS_ACTUALIZADAS_${dateFile}.pdf`);
    } catch (err) {
      console.error('Error generando PDF masivo de Órdenes Médicas:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    const container = document.getElementById('bulk-ordenes-medicas-container');
    if (!container) return;
    const sheetEls = Array.from(container.querySelectorAll('.bulk-orden-sheet')) as HTMLElement[];
    if (sheetEls.length === 0) return;

    const sheetInputs: InstantPrintSheetInput[] = sheetEls.map((el, idx) => {
      const item = items[idx];
      const pt = item?.patient;
      return {
        element: el,
        bannerText: pt
          ? `#${idx + 1} · Cama ${pt.bedNumber} — ${pt.lastName}, ${pt.firstName} (${pt.area}) · ${item.orders.length} indicaciones`
          : undefined,
        repeatHeaderOnOverflow: true,
      };
    });

    printSheetsSinglePageEachInstant(
      sheetInputs,
      `Órdenes Médicas Actualizadas (${items.length})`,
      formatPrintDocumentTitle('Ordenes Medicas', `${items.length} pacientes`, { includeDateTime: true }),
      handleDownloadPdf,
      autoPrint ? onClose : undefined
    );
  };

  useEffect(() => {
    if (autoDownload) {
      let cancelled = false;
      const raf = requestAnimationFrame(() => {
        if (!cancelled) {
          handleDownloadPdf().then(() => {
            if (!cancelled) onClose();
          });
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    if (autoPrint) {
      let cancelled = false;
      const raf = requestAnimationFrame(() => {
        if (!cancelled) {
          handlePrintPdf();
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
  }, [autoDownload, autoPrint]);

  return (
    <div
      className={
        autoDownload
          ? 'fixed left-[-10000px] top-0 w-[215.9mm] bg-white text-black pointer-events-none z-[-1]'
          : 'fixed inset-0 z-[260] bg-slate-100 text-black flex flex-col overflow-hidden print:static print:overflow-visible print:bg-white'
      }
    >
      {!autoDownload && (
        <div className="w-full bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 z-30 no-print shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                Órdenes Médicas Actualizadas ({items.length}) · 1 hoja por paciente
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      )}

      <div
        className={
          autoDownload
            ? 'w-full'
            : 'flex-1 w-full overflow-y-auto overflow-x-auto py-4 px-2 sm:px-4 pb-24 print:p-0 print:overflow-visible'
        }
      >
        <div
          id="bulk-ordenes-medicas-container"
          className="w-full flex flex-col items-center gap-6 print:gap-0"
        >
          {items.map(({ patient: pt, orders, fecha, hora, peso, doctorName }, idx) => (
            <div key={pt.id || idx} className="w-[215.9mm] mx-auto">
              {!autoDownload && items.length > 1 && (
                <div className="no-print mb-1.5 flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold">
                  <span className="truncate">
                    #{idx + 1} · Cama {pt.bedNumber} — {pt.lastName}, {pt.firstName} ({orders.length} ítems)
                  </span>
                  <span className="text-amber-300 shrink-0 ml-2">
                    {formatDateVe(fecha)} {hora}
                  </span>
                </div>
              )}

              <div
                className="bulk-orden-sheet bg-white text-black w-[215.9mm] min-h-[270mm] p-[10mm_12mm] border border-slate-300 shadow-md box-border flex flex-col justify-between"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                <div>
                  {/* Membrete Institucional */}
                  <div className="flex items-center justify-between border-b-2 border-[#b91c1c] pb-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-12 h-8 shrink-0" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 2 8 C 35 -2, 85 22, 118 6 L 118 28 C 85 44, 35 20, 2 30 Z" fill="#FACC15" />
                        <path d="M 2 30 C 35 20, 85 44, 118 28 L 118 50 C 85 66, 35 42, 2 52 Z" fill="#0033A0" />
                        <path d="M 2 52 C 35 42, 85 66, 118 50 L 118 72 C 85 88, 35 64, 2 74 Z" fill="#DC2626" />
                      </svg>
                      <div className="text-[8.5px] uppercase font-black leading-tight text-black">
                        <p className="text-[#b91c1c]">Gobierno Bolivariano de Venezuela</p>
                        <p>Ministerio del Poder Popular para la Salud</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[9.5px] font-black text-[#dc2626] uppercase">PEDIATRÍA Y PUERICULTURA</p>
                      <p className="text-[8px] font-bold text-slate-700 uppercase">HOSPITAL MATERNO INFANTIL</p>
                      <h1 className="text-xs font-black uppercase tracking-widest mt-0.5 underline decoration-2 underline-offset-2 text-black">
                        ÓRDENES MÉDICAS
                      </h1>
                    </div>
                    <div className="flex items-center justify-end">
                      <img
                        src="/assets/aistudio/image_aff5875d.png"
                        alt="Logo Hospital Materno Infantil"
                        className="h-10 max-h-10 w-auto object-contain shrink-0"
                      />
                    </div>
                  </div>

                  {/* Cuadro de Identificación del Paciente */}
                  <div className="grid grid-cols-12 border-2 border-black text-[9.5px] mb-2.5 bg-slate-50">
                    <div className="col-span-6 p-1.5 border-r border-b border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">APELLIDOS Y NOMBRES:</span>
                      <span className="font-bold uppercase text-[11px]">{pt.lastName}, {pt.firstName}</span>
                    </div>
                    <div className="col-span-2 p-1.5 border-r border-b border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">EDAD / SEXO:</span>
                      <span className="font-bold">{pt.age} ({pt.gender})</span>
                    </div>
                    <div className="col-span-2 p-1.5 border-r border-b border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">PESO:</span>
                      <span className="font-bold">{peso}</span>
                    </div>
                    <div className="col-span-2 p-1.5 border-b border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">HISTORIA / CAMA:</span>
                      <span className="font-bold font-mono">{pt.medicalHistoryNumber} / {pt.bedNumber}</span>
                    </div>
                    <div className="col-span-5 p-1.5 border-r border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">SERVICIO / ÁREA:</span>
                      <span className="font-bold uppercase">{pt.area}</span>
                    </div>
                    <div className="col-span-4 p-1.5 border-r border-black">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">FECHA Y HORA DE ÓRDENES:</span>
                      <span className="font-bold font-mono">{formatDateVe(fecha)} — {hora}</span>
                    </div>
                    <div className="col-span-3 p-1.5">
                      <span className="font-black block text-[7.5px] uppercase text-slate-600">INGRESO:</span>
                      <span className="font-bold font-mono">{formatDateVe(pt.admissionDate)}</span>
                    </div>
                  </div>

                  {/* Tabla de Órdenes Médicas */}
                  <div className="border-2 border-black">
                    <div className="flex bg-slate-200 border-b-2 border-black text-[9px] font-black uppercase text-black">
                      <div className="w-[95px] shrink-0 border-r-2 border-black p-1 text-center">DOSIS / CÁLCULO</div>
                      <div className="flex-1 p-1 px-2 text-left">LO QUE SE ADMINISTRA / INDICACIÓN MÉDICA</div>
                    </div>

                    {orders.map((order, oIdx) => (
                      <div
                        key={order.id || oIdx}
                        className={`flex border-b border-black text-black bg-white ${
                          oIdx === orders.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <div className="w-[95px] shrink-0 border-r-2 border-black py-1 px-1.5 text-[8.5px] font-bold text-center flex items-center justify-center whitespace-pre-wrap leading-tight">
                          {order.dosisCalculo || ''}
                        </div>
                        <div className="flex-1 py-1 px-2 text-[9.5px] font-medium whitespace-pre-wrap leading-snug">
                          {order.descripcion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Firmas al pie */}
                <div className="pt-6 mt-4 flex justify-between items-end text-center text-[8.5px] font-black text-black">
                  <div className="w-44 border-t border-black pt-1">
                    <p>MÉDICO RESIDENTE</p>
                    <p className="font-normal text-[8px]">{doctorName}</p>
                  </div>
                  <div className="w-40 border-t border-black pt-1">
                    <p>ENFERMERA</p>
                  </div>
                  <div className="w-52 border-t border-black pt-1">
                    <p>RESIDENTE SUPERIOR O ADJUNTO DE GUARDIA</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
