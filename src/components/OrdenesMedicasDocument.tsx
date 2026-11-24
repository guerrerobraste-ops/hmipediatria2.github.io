import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Patient, OrdenMedicaItem } from '../types';
import { 
  Printer, Download, ArrowLeft, Plus, Trash2, Save, 
  Sparkles, FileText, CheckCircle, Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  formatPrintDocumentTitle,
  openInstantWhitePrintPage,
  addCanvasSinglePageWithMargin,
  addCanvasPaginatedWithMargin,
} from '../utils/pdfPrinter';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import { OrdenesMedicasBuilder } from './OrdenesMedicasBuilder';

const ORDENES_LOCAL_DRAFT_PREFIX = 'hmi_ordenes_sheet_draft_v1_';

function loadLocalOrdenesDraft(patientId: string): {
  orders: OrdenMedicaItem[];
  fecha?: string;
  hora?: string;
  peso?: string;
} | null {
  if (!patientId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${ORDENES_LOCAL_DRAFT_PREFIX}${patientId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveLocalOrdenesDraft(
  patientId: string,
  payload: { orders: OrdenMedicaItem[]; fecha: string; hora: string; peso: string }
): void {
  if (!patientId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${ORDENES_LOCAL_DRAFT_PREFIX}${patientId}`,
      JSON.stringify({ ...payload, updatedAt: Date.now() })
    );
  } catch {}
}

function clearLocalOrdenesDraft(patientId: string): void {
  if (!patientId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${ORDENES_LOCAL_DRAFT_PREFIX}${patientId}`);
  } catch {}
}

interface Props {
  patient: Patient;
  evolutionDate?: string;
  evolutionTime?: string;
  doctorName?: string;
  initialOrders?: OrdenMedicaItem[];
  initialFecha?: string;
  initialHora?: string;
  initialPeso?: string;
  readOnly?: boolean;
  onSaveOrders?: (orders: OrdenMedicaItem[], fecha: string, hora: string, peso: string) => void;
  onAutoSaveOrders?: (orders: OrdenMedicaItem[], fecha: string, hora: string, peso: string) => void;
  onClose: () => void;
}

// Plantilla Modelo Oficial basada en el estándar del Hospital Materno Infantil Hugo Chávez Frías
export const OFFICIAL_DEFAULT_ORDERS: OrdenMedicaItem[] = [
  { id: 'ord-1', dosisCalculo: '', itemNumber: 1, descripcion: 'Ingresar en Área de Trauma Shock' },
  { id: 'ord-2', dosisCalculo: '', itemNumber: 2, descripcion: 'Dieta absoluta' },
  { id: 'ord-3', dosisCalculo: '', itemNumber: 3, descripcion: 'Posición de Fowler' },
  { id: 'ord-4', dosisCalculo: '40mg/kg/dosis', itemNumber: 4, descripcion: 'Monitorización continua' },
  { id: 'ord-5', dosisCalculo: '15mg/kg/dosis', itemNumber: 5, descripcion: 'Vancomicina: administrar ____mg + ____cc solución dextrosa al 5% IV c/8h' },
  { 
    id: 'ord-6', 
    dosisCalculo: '2mEq/kg/día\n2mEq/kg/día\n150mg/kg/día', 
    itemNumber: 6, 
    descripcion: 'HP Holiday Segar (Hidratación Parenteral): Sol. Dextrosa 5%: 500 cc | NaCl 20%: 8 ml | KCl: 27.2 ml | G. Calcio 10%: 20.4 ml | MgSO4: 2.4 ml → VEV c/8h a 69 ml/h (558 uP)' 
  },
  { id: 'ord-7', dosisCalculo: '5 mg/kg/dosis', itemNumber: 7, descripcion: 'Hidrocortisona 200 mg VEV c/6h' },
  { 
    id: 'ord-8', 
    dosisCalculo: '0.3mg/kg/dosis\n1mg/kg/dosis\n15mg/kg/dosis', 
    itemNumber: 8, 
    descripcion: 'Clorfenamina 1 amp (8 mg) VEV x 24h | Ranitidina 1 Amp c/8h VEV | Dipirona 1 Amp VEV c/8h SOS Fiebre o Dolor\nNBT: Salbutamol 20g + 3cc Sol 0.9% c/2h | Ipratropio 40g + 3cc c/2h | Budesonida 20g + 3cc c/8h' 
  },
  { id: 'ord-9', dosisCalculo: '', itemNumber: 9, descripcion: 'Laboratorios: Perfil 20, PCR cualitativa, Electrolitos séricos, Gases Arteriales (BT)' },
  { id: 'ord-10', dosisCalculo: '', itemNumber: 10, descripcion: 'Imagenológicos: Rx de tórax AP y L (BT)' },
  { id: 'ord-11', dosisCalculo: '', itemNumber: 11, descripcion: 'Balance Hídrico Control estricto de ingresos y egresos' },
  { id: 'ord-12', dosisCalculo: '', itemNumber: 12, descripcion: 'Cuidados propios de Enfermería' },
  { id: 'ord-13', dosisCalculo: '', itemNumber: 13, descripcion: 'Avisar Eventualidad' }
];

// Generates a fresh, completely independent copy of default orders with isolated IDs per patient
export const getFreshDefaultOrders = (): OrdenMedicaItem[] => {
  return OFFICIAL_DEFAULT_ORDERS.map((item, idx) => ({
    ...item,
    id: `ord-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
  }));
};

export function resolveUpdatedOrdersForPatient(patient: Patient): {
  orders: OrdenMedicaItem[];
  fecha: string;
  hora: string;
  peso: string;
} {
  const nowDate = new Date().toLocaleDateString('es-VE', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
  if (patient.ordenesMedicas && patient.ordenesMedicas.length > 0) {
    return {
      orders: patient.ordenesMedicas,
      fecha: patient.ordenesFecha || nowDate,
      hora: patient.ordenesHora || '8AM',
      peso: patient.ordenesPeso || (patient.weightKg ? `${patient.weightKg} kg` : '---'),
    };
  }
  const latestEvWithOrders = (patient.evolutions || []).find(
    e => e.ordenesMedicas && e.ordenesMedicas.length > 0
  );
  if (latestEvWithOrders?.ordenesMedicas && latestEvWithOrders.ordenesMedicas.length > 0) {
    return {
      orders: latestEvWithOrders.ordenesMedicas,
      fecha: latestEvWithOrders.ordenesFecha || latestEvWithOrders.date || nowDate,
      hora: latestEvWithOrders.ordenesHora || latestEvWithOrders.time || '8AM',
      peso:
        latestEvWithOrders.ordenesPeso ||
        latestEvWithOrders.vitalSigns?.peso ||
        (patient.weightKg ? `${patient.weightKg} kg` : '---'),
    };
  }
  return {
    orders: [],
    fecha: nowDate,
    hora: '8AM',
    peso: patient.weightKg ? `${patient.weightKg} kg` : '---',
  };
}

export const BulkOrdenesMedicasPrintView: React.FC<{
  patients: Patient[];
  doctorName?: string;
  autoDownload?: boolean;
  onClose: () => void;
}> = ({ patients, doctorName = 'Dr. Brayan Guerrero', autoDownload = false, onClose }) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const isPrintingPdf = false;

  const buildBulkOrdenesPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const container = document.getElementById('bulk-ordenes-medicas-container');
    if (!container) return null;

    const sheets = Array.from(
      container.querySelectorAll('.ordenes-medicas-bulk-sheet')
    ) as HTMLElement[];
    if (sheets.length === 0) return null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc, clonedElem) => {
          sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
        },
      });
      addCanvasSinglePageWithMargin(pdf, canvas, {
        addNewPageFirst: i > 0,
        quality: 0.92,
      });
    }

    const dateStr = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
    return { pdf, fileName: `ORDENES_MEDICAS_ACTUALIZADAS_${dateStr}.pdf` };
  };

  const handlePrintAll = () => {
    const container = document.getElementById('bulk-ordenes-medicas-container');
    if (!container) return;
    const sheets = Array.from(
      container.querySelectorAll('.ordenes-medicas-bulk-sheet')
    ) as HTMLElement[];
    if (sheets.length === 0) return;

    const title = formatPrintDocumentTitle(
      'Ordenes Medicas',
      `${patients.length} Pacientes`,
      { includeDateTime: true }
    );

    openInstantWhitePrintPage({
      sheets: sheets.map((element, idx) => {
        const pt = patients[idx];
        return {
          element,
          bannerText: pt
            ? `Paciente #${idx + 1} · Cama ${pt.bedNumber} — ${pt.lastName}, ${pt.firstName} (HC: ${pt.medicalHistoryNumber})`
            : undefined,
          repeatHeaderOnOverflow: true,
        };
      }),
      title,
      fileName: `${title}.pdf`,
      onDownloadPdf: handleDownloadPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf || isPrintingPdf) return;
    setIsExportingPdf(true);
    try {
      const built = await buildBulkOrdenesPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (err) {
      console.error('Error generando PDF masivo de Órdenes Médicas:', err);
    } finally {
      setIsExportingPdf(false);
    }
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
  }, [autoDownload]);

  return (
    <div
      className={
        autoDownload
          ? 'fixed left-[-10000px] top-0 w-[215.9mm] bg-white text-black pointer-events-none z-[-1]'
          : 'fixed inset-0 z-[250] bg-slate-100 text-black flex flex-col overflow-hidden'
      }
    >
      {!autoDownload && (
        <div className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 z-30 no-print shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Órdenes Médicas Actualizadas ({patients.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Todo</span>
            </button>
          </div>
        </div>
      )}

      <div
        className={
          autoDownload
            ? 'w-full'
            : 'flex-1 w-full overflow-y-auto overflow-x-auto py-4 sm:py-6 px-2 sm:px-4 pb-24 flex flex-col items-center'
        }
      >
        <div id="bulk-ordenes-medicas-container" className="flex flex-col gap-6 items-center">
          {patients.map((pt, idx) => {
            const { orders, fecha, hora, peso } = resolveUpdatedOrdersForPatient(pt);
            const ptDoctor =
              pt.evolutions?.[0]?.doctorName || pt.doctorInCharge || doctorName;
            return (
              <div key={pt.id} className="flex flex-col items-center">
                {!autoDownload && (
                  <div className="no-print w-full mb-1.5 px-3 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold flex items-center justify-between">
                    <span>
                      #{idx + 1} · Cama {pt.bedNumber} — {pt.lastName}, {pt.firstName}
                    </span>
                    <span className="text-amber-300">
                      {orders.length} indicaciones · {fecha}
                    </span>
                  </div>
                )}
                <div
                  className="ordenes-medicas-bulk-sheet bg-white text-black p-5 border-2 border-black font-sans w-[215.9mm] min-h-[279.4mm] flex flex-col justify-between box-border"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    fontFamily: 'Arial, sans-serif',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 mb-2 bg-white">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-12 h-7 shrink-0"
                          viewBox="0 0 120 80"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M 2 8 C 35 -2, 85 22, 118 6 L 118 28 C 85 44, 35 20, 2 30 Z"
                            fill="#FACC15"
                          />
                          <path
                            d="M 2 30 C 35 20, 85 44, 118 28 L 118 50 C 85 66, 35 42, 2 52 Z"
                            fill="#0033A0"
                          />
                          <path
                            d="M 2 52 C 35 42, 85 66, 118 50 L 118 72 C 85 88, 35 64, 2 74 Z"
                            fill="#DC2626"
                          />
                        </svg>
                        <div className="text-[8px] uppercase font-bold leading-tight text-black">
                          <p className="text-[#b91c1c] font-black tracking-wide">
                            Gobierno Bolivariano de Venezuela
                          </p>
                          <p className="text-slate-800 font-bold">
                            Ministerio del Poder Popular para la Salud
                          </p>
                          <p className="font-extrabold text-[#1e3a8a] text-[8.5px] mt-0.5">
                            Hospital Materno Infantil Comandante Supremo Hugo Rafael Chávez Frías
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end pl-2">
                        <img
                          src="/assets/aistudio/image_aff5875d.png"
                          alt="Logo Hospital Materno Infantil"
                          className="h-10 max-h-11 w-auto object-contain shrink-0"
                        />
                      </div>
                    </div>

                    <div className="border-2 border-black mb-2 text-[10px] font-bold">
                      <div className="grid grid-cols-12 border-b-2 border-black">
                        <div className="col-span-4 p-1.5 border-r-2 border-black uppercase">
                          FECHA: <span className="font-mono font-black">{fecha}</span>
                        </div>
                        <div className="col-span-4 p-1.5 border-r-2 border-black text-center font-black uppercase tracking-wider text-[11px] bg-slate-50">
                          ORDENES MEDICAS
                        </div>
                        <div className="col-span-4 p-1.5 font-black uppercase truncate bg-amber-50/60">
                          {pt.lastName.toUpperCase()}, {pt.firstName.toUpperCase()}
                        </div>
                      </div>
                      <div className="grid grid-cols-12">
                        <div className="col-span-4 p-1.5 border-r-2 border-black uppercase">
                          HORA: <span className="font-mono font-black">{hora}</span>
                        </div>
                        <div className="col-span-4 p-1.5 border-r-2 border-black uppercase">
                          PESO: <span className="font-mono font-black">{peso}</span>
                        </div>
                        <div className="col-span-4 p-1.5 uppercase flex items-center justify-between text-[9px] font-extrabold">
                          <span>
                            H.C: <strong className="font-mono">{pt.medicalHistoryNumber}</strong>
                          </span>
                          <span>Cama {pt.bedNumber}</span>
                        </div>
                      </div>
                    </div>

                    <table className="w-full border-2 border-black border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black bg-slate-100 text-[9px] font-black uppercase">
                          <th className="w-[90px] border-r-2 border-black p-1 text-center">
                            DOSIS
                          </th>
                          <th className="p-1 px-2 text-left">
                            LO QUE SE ADMINISTRA / INDICACIÓN MÉDICA
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((ord, oIdx) => (
                          <tr
                            key={ord.id || oIdx}
                            className="border-b border-black text-[9.5px] leading-snug"
                          >
                            <td className="w-[90px] border-r-2 border-black p-1 text-center font-bold align-top whitespace-pre-wrap">
                              {ord.dosisCalculo || ''}
                            </td>
                            <td className="p-1 px-2 align-top whitespace-pre-wrap">
                              <strong className="mr-1.5">{ord.itemNumber || oIdx + 1}.</strong>
                              <span>{ord.descripcion}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 pt-4 flex justify-between items-end text-center text-[9px] font-black text-black">
                    <div className="w-44 border-t border-black pt-1">
                      <p>MÉDICO RESIDENTE</p>
                      <p className="font-normal text-[8px]">{ptDoctor}</p>
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const OrdenesMedicasDocument: React.FC<Props> = ({
  patient,
  evolutionDate,
  evolutionTime,
  doctorName = 'Dr. Brayan',
  initialOrders,
  initialFecha,
  initialHora,
  initialPeso,
  readOnly = false,
  onSaveOrders,
  onAutoSaveOrders,
  onClose
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const now = new Date();
  const defaultFechaStr = initialFecha || evolutionDate || now.toLocaleDateString('es-VE', { year: '2-digit', month: '2-digit', day: '2-digit' });
  const defaultHoraStr = initialHora || evolutionTime || '8AM';
  const defaultPesoStr = initialPeso || (patient.weightKg ? `${patient.weightKg} kg` : '');

  const initialLocalDraft = !readOnly ? loadLocalOrdenesDraft(patient.id) : null;
  const [fecha, setFecha] = useState<string>(initialLocalDraft?.fecha || defaultFechaStr);
  const [hora, setHora] = useState<string>(initialLocalDraft?.hora || defaultHoraStr);
  const [peso, setPeso] = useState<string>(initialLocalDraft?.peso || defaultPesoStr);
  const zoomScale = 1;

  // Helper to resolve saved orders for this specific patient (empty if brand-new patient with no orders yet)
  const resolvePatientOrders = useCallback((): OrdenMedicaItem[] => {
    if (!readOnly) {
      const cached = loadLocalOrdenesDraft(patient.id);
      if (cached && cached.orders.length > 0) {
        return JSON.parse(JSON.stringify(cached.orders));
      }
    }
    if (initialOrders && initialOrders.length > 0) {
      return JSON.parse(JSON.stringify(initialOrders));
    }
    if (patient.ordenesMedicas && patient.ordenesMedicas.length > 0) {
      return JSON.parse(JSON.stringify(patient.ordenesMedicas));
    }
    const latestEvWithOrders = patient.evolutions?.find(e => e.ordenesMedicas && e.ordenesMedicas.length > 0);
    if (latestEvWithOrders?.ordenesMedicas && latestEvWithOrders.ordenesMedicas.length > 0) {
      return JSON.parse(JSON.stringify(latestEvWithOrders.ordenesMedicas));
    }
    return [];
  }, [initialOrders, patient.id, patient.ordenesMedicas, patient.evolutions, readOnly]);

  const initialResolved = resolvePatientOrders();
  const [orders, setOrders] = useState<OrdenMedicaItem[]>(initialResolved);
  const [showBuilder, setShowBuilder] = useState<boolean>(() => !readOnly && initialResolved.length === 0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    const onTutorialBuilder = (ev: Event) => {
      const custom = ev as CustomEvent<{ open?: boolean }>;
      setShowBuilder(Boolean(custom.detail?.open));
    };
    window.addEventListener('hmi_tutorial_ordenes_builder', onTutorialBuilder);
    return () => window.removeEventListener('hmi_tutorial_ordenes_builder', onTutorialBuilder);
  }, []);

  // Track patient ID switch to isolate state per patient
  const currentPatientId = useRef(patient.id);
  const isInitialLoad = useRef(true);
  const hasHydratedAsyncInitialOrders = useRef(initialResolved.length > 0);

  // Sync async cached orders (e.g. from IndexedDB) if they arrive shortly after modal opens
  useEffect(() => {
    if (
      !hasHydratedAsyncInitialOrders.current &&
      orders.length === 0 &&
      initialOrders &&
      initialOrders.length > 0
    ) {
      hasHydratedAsyncInitialOrders.current = true;
      isInitialLoad.current = true;
      setOrders(JSON.parse(JSON.stringify(initialOrders)));
      setShowBuilder(false);
    }
  }, [initialOrders, orders.length]);

  // Auto-resize textareas to completely eliminate inner scrollbars and keep rows compact
  const autoResizeTextareas = () => {
    const textareas = document.querySelectorAll('#ordenes-medicas-page textarea');
    textareas.forEach(ta => {
      const el = ta as HTMLTextAreaElement;
      el.style.height = 'auto';
      el.style.height = `${Math.max(20, el.scrollHeight)}px`;
    });
  };

  useEffect(() => {
    if (showBuilder) return;
    autoResizeTextareas();
    const timer = setTimeout(autoResizeTextareas, 50);
    return () => clearTimeout(timer);
  }, [orders, zoomScale, showBuilder]);

  // Synchronize state exclusively when opening or switching to a different patient
  useEffect(() => {
    if (currentPatientId.current !== patient.id) {
      currentPatientId.current = patient.id;
      isInitialLoad.current = true;
      const cached = !readOnly ? loadLocalOrdenesDraft(patient.id) : null;
      const nextResolved = resolvePatientOrders();
      hasHydratedAsyncInitialOrders.current = nextResolved.length > 0;
      setOrders(nextResolved);
      setShowBuilder(!readOnly && nextResolved.length === 0);
      setFecha(cached?.fecha || initialFecha || evolutionDate || now.toLocaleDateString('es-VE', { year: '2-digit', month: '2-digit', day: '2-digit' }));
      setHora(cached?.hora || initialHora || evolutionTime || '8AM');
      setPeso(cached?.peso || initialPeso || (patient.weightKg ? `${patient.weightKg} kg` : ''));
    }
  }, [patient.id, resolvePatientOrders, initialFecha, evolutionDate, initialHora, evolutionTime, initialPeso, patient.weightKg, readOnly]);

  // Silent local-cache-only draft protection (never writes to Supabase automatically; only Guardar persists to Supabase)
  useEffect(() => {
    if (readOnly || orders.length === 0) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveLocalOrdenesDraft(patient.id, { orders, fecha, hora, peso });
    }, 400);

    return () => clearTimeout(timer);
  }, [orders, fecha, hora, peso, patient.id, readOnly]);

  // Re-number items 1 to N consecutively
  const renumberOrders = (items: OrdenMedicaItem[]): OrdenMedicaItem[] => {
    return items.map((item, idx) => ({ ...item, itemNumber: idx + 1 }));
  };

  // Add row at the very end
  const handleAddOrder = () => {
    setOrders(prev => {
      const nextNum = prev.length + 1;
      const newItem: OrdenMedicaItem = {
        id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        dosisCalculo: '',
        itemNumber: nextNum,
        descripcion: ''
      };
      return [...prev, newItem];
    });

    // Auto-scroll down smoothly so the new row and footer are immediately in view
    setTimeout(() => {
      const scrollEl = document.getElementById('ordenes-scroll-viewport');
      if (scrollEl) {
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  // Insert a new row immediately below a specific row index
  const handleInsertRowBelow = (index: number) => {
    setOrders(prev => {
      const newRow: OrdenMedicaItem = {
        id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        dosisCalculo: '',
        itemNumber: index + 2,
        descripcion: ''
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, newRow);
      return renumberOrders(updated);
    });
  };

  // Remove a row
  const handleRemoveOrder = (id: string) => {
    setOrders(prev => {
      if (prev.length <= 1) {
        // Keep at least one empty row
        return [{ id: 'ord-' + Date.now(), dosisCalculo: '', itemNumber: 1, descripcion: '' }];
      }
      return renumberOrders(prev.filter(o => o.id !== id));
    });
  };

  const handleUpdateOrder = (id: string, field: 'dosisCalculo' | 'descripcion', value: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleGenerateFromBuilder = (generatedOrders: OrdenMedicaItem[], finalPeso?: string) => {
    const resolvedPeso = finalPeso !== undefined ? finalPeso : peso;
    if (finalPeso !== undefined && finalPeso !== peso) {
      setPeso(finalPeso);
    }
    hasHydratedAsyncInitialOrders.current = true;
    isInitialLoad.current = false;
    setOrders(generatedOrders);
    setShowBuilder(false);
    clearLocalOrdenesDraft(patient.id);
    if (onSaveOrders) {
      onSaveOrders(generatedOrders, fecha, hora, resolvedPeso);
    } else if (onAutoSaveOrders) {
      onAutoSaveOrders(generatedOrders, fecha, hora, resolvedPeso);
    }
    setSaveStatus('saved');
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      setSaveStatus('idle');
    }, 3000);
  };

  const handleSave = () => {
    if (orders.length === 0) return;
    clearLocalOrdenesDraft(patient.id);
    if (onSaveOrders) {
      onSaveOrders(orders, fecha, hora, peso);
    } else if (onAutoSaveOrders) {
      onAutoSaveOrders(orders, fecha, hora, peso);
    }
    setSaveStatus('saved');
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      setSaveStatus('idle');
    }, 2500);
  };

  const handleClose = () => {
    // Keep unsaved changes safely in device local cache without pushing to Supabase
    if (!readOnly && orders.length > 0) {
      saveLocalOrdenesDraft(patient.id, { orders, fecha, hora, peso });
    }
    onClose();
  };

  const isPrintingPdf = false;

  const buildOrdenesPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const pageElem = document.getElementById('ordenes-medicas-page');
    if (!pageElem) return null;

    const canvas = await html2canvas(pageElem, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElem) => {
        sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);

        const noPrintElements = clonedDoc.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.remove());

        const editContainers = clonedDoc.querySelectorAll('.edit-only-container');
        editContainers.forEach(el => ((el as HTMLElement).style.display = 'none'));

        const printContainers = clonedDoc.querySelectorAll('.print-only-container');
        printContainers.forEach(el => {
          (el as HTMLElement).style.display = 'block';
        });
      }
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
    addCanvasPaginatedWithMargin(pdf, canvas, { quality: 0.92 });

    const printDateStr = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
    const fileName = `ORDENES_MEDICAS_${(patient.lastName).toUpperCase()}_${(patient.firstName).toUpperCase()}_${printDateStr}.pdf`;
    return { pdf, fileName };
  };

  // Instant DOM White Print Page
  const handleDirectPrint = () => {
    const pageElem = document.getElementById('ordenes-medicas-page');
    if (!pageElem) return;
    const docTitle = formatPrintDocumentTitle(
      'Ordenes Medicas',
      `${patient.lastName} ${patient.firstName}`,
      { includeDateTime: true, dateStr: fecha, timeStr: hora }
    );
    openInstantWhitePrintPage({
      sheets: [pageElem],
      title: docTitle,
      fileName: `${docTitle}.pdf`,
      onDownloadPdf: handleExportPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  // Export PDF with html2canvas and jsPDF (strips all edit buttons and textareas before snapshot)
  const handleExportPdf = async () => {
    if (isDownloading || isPrintingPdf) return;
    setIsDownloading(true);
    try {
      const built = await buildOrdenesPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (e) {
      console.error('Error downloading PDF:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`fixed inset-0 w-full h-full ${themeTokens.rootCanvas} z-[160] flex flex-col overflow-hidden selection:bg-teal-500/30`}>
      {/* Top Bar Header - Ultra Compact & Fixed at Top */}
      <div className={`shrink-0 ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-2 sm:px-4 py-1.5 flex items-center justify-between z-30 shadow-sm dark:shadow-md no-print`}>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-500/50 shadow-xs dark:shadow-[0_0_12px_rgba(20,184,166,0.5)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shrink-0"
            title="Volver (guarda automáticamente)"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1 truncate">
                <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Órdenes Médicas</span>
                <span className="text-teal-700 dark:text-teal-300 font-semibold normal-case text-[10px] hidden sm:inline">
                  · {patient.lastName}, {patient.firstName} ({patient.medicalHistoryNumber})
                </span>
              </h2>

              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[9.5px] sm:text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                  <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Guardado</span>
                </span>
              )}
            </div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 font-medium sm:hidden truncate">
              {patient.lastName}, {patient.firstName} · Cama: {patient.bedNumber}
            </p>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div data-tutorial="ordenes-acciones-bar" className="flex items-center gap-1 sm:gap-2 shrink-0">
          {readOnly ? (
            <span className="px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30 text-[10px] sm:text-xs font-bold flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Modo Visualización</span>
            </span>
          ) : (
            <>
              {!showBuilder && (
                <button
                  type="button"
                  data-testid="ord-open-builder-btn"
                  data-tutorial="ordenes-asistente-btn"
                  onClick={() => setShowBuilder(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-400 dark:border-teal-500/50 text-[10.5px] sm:text-xs font-black flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Abrir asistente guiado para generar o regenerar órdenes médicas"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="md:hidden">Asistente</span>
                  <span className="hidden md:inline">Asistente Guiado</span>
                </button>
              )}
              {!showBuilder && orders.length > 0 && (
                <button
                  type="button"
                  data-testid="ord-save-btn"
                  onClick={handleSave}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] sm:text-xs font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="Guardar cambios de Órdenes Médicas en el servidor"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </button>
              )}
            </>
          )}

          {!showBuilder && orders.length > 0 && (
            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_15px_rgba(245,158,11,0.7)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all cursor-pointer"
              title="Imprimir documento de Órdenes Médicas en tamaño carta"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Imprimir</span>
            </button>
          )}
        </div>
      </div>

      {savedToast && (
        <div className="bg-emerald-600 text-white text-xs font-black py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-200 no-print">
          <CheckCircle className="w-3.5 h-3.5 text-white" /> ¡Órdenes Médicas guardadas con éxito para {patient.firstName} {patient.lastName}!
        </div>
      )}

      {/* Main Workspace Body - THE SINGLE SCROLL CONTAINER (both vertical and horizontal) */}
      <div 
        id="ordenes-scroll-viewport" 
        className="flex-1 w-full overflow-y-auto overflow-x-auto p-2 sm:p-6 pb-96"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y'
        }}
      >
        {showBuilder ? (
          <div data-tutorial="ordenes-builder-root">
            <OrdenesMedicasBuilder
              patient={patient}
              fecha={fecha}
              hora={hora}
              peso={peso}
              onChangeFecha={setFecha}
              onChangeHora={setHora}
              onChangePeso={setPeso}
              hasExistingOrders={orders.length > 0}
              onGenerateAndSave={handleGenerateFromBuilder}
              onCancelToSheet={orders.length > 0 ? () => setShowBuilder(false) : undefined}
            />
          </div>
        ) : orders.length === 0 && readOnly ? (
          <div className="max-w-lg mx-auto mt-16 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2 shadow-sm">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Sin Órdenes Médicas registradas
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Este paciente aún no tiene Órdenes Médicas desarrolladas.
            </p>
          </div>
        ) : (
        /* Document Sheet Wrapper - Preserves true 215.9mm paper width for full extensive row lines */
        <div 
          className="w-[215.9mm] min-w-[215.9mm] mx-auto min-h-max"
          style={{
            zoom: zoomScale !== 1 ? zoomScale : undefined,
          }}
        >
          <div
            id="ordenes-medicas-page"
            data-tutorial="ordenes-hoja-oficial"
            className="bg-white text-black p-4 sm:p-6 shadow-2xl border-2 border-black font-sans w-[215.9mm] min-w-[215.9mm] text-[10px] sm:text-[10.5px] leading-snug relative box-border"
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              fontFamily: 'Arial, sans-serif',
              width: '215.9mm',
              minWidth: '215.9mm',
              height: 'auto',
              minHeight: '279.4mm',
              maxHeight: 'none',
              overflow: 'visible'
            }}
          >
            {/* Header section with official Venezuelan Flag (8 Stars) & Hospital logo banner */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 mb-2 bg-white">
              <div className="flex items-center gap-2">
                <svg className="w-12 h-7 shrink-0 drop-shadow-xs" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Yellow Band */}
                  <path d="M 2 8 C 35 -2, 85 22, 118 6 L 118 28 C 85 44, 35 20, 2 30 Z" fill="#FACC15" />
                  {/* Blue Band */}
                  <path d="M 2 30 C 35 20, 85 44, 118 28 L 118 50 C 85 66, 35 42, 2 52 Z" fill="#0033A0" />
                  {/* Red Band */}
                  <path d="M 2 52 C 35 42, 85 66, 118 50 L 118 72 C 85 88, 35 64, 2 74 Z" fill="#DC2626" />

                  {/* 8 White Stars in Arc on Blue Band */}
                  <g fill="#FFFFFF">
                    <polygon points="38.0,40.5 38.6,41.7 39.9,41.7 38.8,42.5 39.2,43.7 38.0,42.9 36.8,43.7 37.2,42.5 36.1,41.7 37.4,41.7" />
                    <polygon points="44.5,38.0 45.1,39.2 46.4,39.2 45.3,40.0 45.7,41.2 44.5,40.4 43.3,41.2 43.7,40.0 42.6,39.2 43.9,39.2" />
                    <polygon points="51.5,36.2 52.1,37.4 53.4,37.4 52.3,38.2 52.7,39.4 51.5,38.6 50.3,39.4 50.7,38.2 49.6,37.4 50.9,37.4" />
                    <polygon points="58.8,35.2 59.4,36.4 60.7,36.4 59.6,37.2 60.0,38.4 58.8,37.6 57.6,38.4 58.0,37.2 56.9,36.4 58.2,36.4" />
                    <polygon points="66.2,35.2 66.8,36.4 68.1,36.4 67.0,37.2 67.4,38.4 66.2,37.6 65.0,38.4 65.4,37.2 64.3,36.4 65.6,36.4" />
                    <polygon points="73.5,36.2 74.1,37.4 75.4,37.4 74.3,38.2 74.7,39.4 73.5,38.6 72.3,39.4 72.7,38.2 71.6,37.4 72.9,37.4" />
                    <polygon points="80.5,38.0 81.1,39.2 82.4,39.2 81.3,40.0 81.7,41.2 80.5,40.4 79.3,41.2 79.7,40.0 78.6,39.2 79.9,39.2" />
                    <polygon points="87.0,40.5 87.6,41.7 88.9,41.7 87.8,42.5 88.2,43.7 87.0,42.9 85.8,43.7 86.2,42.5 85.1,41.7 86.4,41.7" />
                  </g>
                </svg>
                <div className="text-[8px] uppercase font-bold leading-tight text-black">
                  <p className="text-[#b91c1c] font-black tracking-wide">Gobierno Bolivariano de Venezuela</p>
                  <p className="text-slate-800 font-bold">Ministerio del Poder Popular para la Salud</p>
                  <p className="font-extrabold text-[#1e3a8a] text-[8.5px] mt-0.5">Hospital Materno Infantil Comandante Supremo Hugo Rafael Chávez Frías</p>
                </div>
              </div>
              <div className="flex items-center justify-end pl-2">
                <img 
                  src="/assets/aistudio/image_aff5875d.png" 
                  alt="Logo Hospital Materno Infantil" 
                  className="h-10 sm:h-12 max-h-12 w-auto object-contain shrink-0" 
                />
              </div>
            </div>

            {/* Top Table Box (FECHA, HORA, PESO, PACIENTE) - Compact */}
            <div className="border-2 border-black mb-2">
              <div className="grid grid-cols-12 border-b-2 border-black font-bold text-[10px] text-black">
                {/* FECHA */}
                <div className="col-span-4 p-1 sm:p-1.5 border-r-2 border-black uppercase flex items-center gap-1">
                  <span className="text-[9px] font-black">FECHA:</span>
                  <input
                    type="text"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="no-print font-mono font-black text-black bg-amber-50/50 border border-slate-300 rounded px-1 py-0 text-[10.5px] outline-none focus:border-teal-500 w-full"
                  />
                  <span className="hidden print:inline font-mono font-black text-[10px]">{fecha}</span>
                </div>

                {/* ORDENES MEDICAS TITLE */}
                <div className="col-span-4 p-1 sm:p-1.5 border-r-2 border-black text-center font-black uppercase tracking-wider text-[11px] flex items-center justify-center bg-slate-50">
                  ORDENES MEDICAS
                </div>

                {/* PACIENTE */}
                <div className="col-span-4 p-1 sm:p-1.5 font-black uppercase truncate flex items-center justify-between text-black bg-amber-50/60">
                  <span className="font-mono font-extrabold text-[10px] tracking-wide text-black truncate" title={`${patient.lastName}, ${patient.firstName}`}>
                    {patient.lastName.toUpperCase()}, {patient.firstName.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 font-bold text-[10px] text-black bg-white">
                {/* HORA */}
                <div className="col-span-4 p-1 sm:p-1.5 border-r-2 border-black uppercase flex items-center gap-1">
                  <span className="text-[9px] font-black">HORA:</span>
                  <input
                    type="text"
                    value={hora}
                    onChange={e => setHora(e.target.value)}
                    className="no-print font-mono font-black text-black bg-amber-50/50 border border-slate-300 rounded px-1 py-0 text-[10.5px] outline-none focus:border-teal-500 w-full"
                  />
                  <span className="hidden print:inline font-mono font-black text-[10px]">{hora}</span>
                </div>

                {/* PESO */}
                <div className="col-span-4 p-1 sm:p-1.5 border-r-2 border-black uppercase flex items-center gap-1">
                  <span className="text-[9px] font-black">PESO:</span>
                  <input
                    type="text"
                    value={peso}
                    onChange={e => setPeso(e.target.value)}
                    className="no-print font-mono font-black text-black bg-amber-50/50 border border-slate-300 rounded px-1 py-0 text-[10.5px] outline-none focus:border-teal-500 w-full"
                  />
                  <span className="hidden print:inline font-mono font-black text-[10px]">{peso}</span>
                </div>

                {/* HISTORIA & SERVICIO */}
                <div className="col-span-4 p-1 sm:p-1.5 uppercase flex items-center justify-between text-[9px] font-extrabold text-slate-800">
                  <span>H.C: <strong className="font-mono text-black">{patient.medicalHistoryNumber}</strong></span>
                  <span className="text-teal-900 bg-teal-50 px-1 py-0.5 rounded border border-teal-200 text-[8.5px] truncate max-w-[90px]">{patient.area}</span>
                </div>
              </div>
            </div>

            {/* Official 2-Column Table - Compact Rows */}
            <div className="border-2 border-black">
              {/* Table Header: 2 Columns */}
              <div className="flex border-b-2 border-black bg-slate-100 font-black text-[9px] uppercase text-black">
                {/* Column 1: DOSIS (Narrow, compact) */}
                <div className="w-[75px] sm:w-[90px] shrink-0 p-1 border-r-2 border-black text-center flex items-center justify-center">
                  DOSIS
                </div>
                {/* Column 2: LO QUE SE ADMINISTRA (Wide, extensive) */}
                <div className="flex-1 p-1 text-left flex items-center justify-between px-2 min-w-0">
                  <span>LO QUE SE ADMINISTRA / INDICACIÓN MÉDICA</span>
                </div>
              </div>

              {/* Compact Rows */}
              {orders.map((order, idx) => (
                <div 
                  key={order.id || idx} 
                  className={`flex border-b border-black min-h-[20px] items-stretch text-black group relative bg-white hover:bg-slate-50/50 ${
                    idx === orders.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  {/* Column 1: Dosis (mg/kg/día) - Compact & narrow, can be blank */}
                  <div className="w-[75px] sm:w-[90px] shrink-0 border-r-2 border-black py-0.5 px-1 text-[9px] font-bold text-slate-900 bg-white flex items-center justify-center text-center">
                    {/* Screen / Edit container */}
                    <div className="no-print edit-only-container w-full">
                      {readOnly ? (
                        <div className="w-full text-center font-bold text-[9px] text-slate-900 leading-tight py-1 select-text">
                          {order.dosisCalculo || '-'}
                        </div>
                      ) : (
                        <textarea
                          value={order.dosisCalculo || ''}
                          onInput={(e) => {
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = `${Math.max(20, e.currentTarget.scrollHeight)}px`;
                          }}
                          onChange={e => handleUpdateOrder(order.id, 'dosisCalculo', e.target.value)}
                          placeholder="Dosis..."
                          rows={1}
                          className="w-full bg-transparent border-0 text-center font-bold text-[9px] text-slate-900 focus:outline-none focus:bg-amber-100/50 resize-none leading-tight overflow-hidden p-0"
                          style={{ height: 'auto', minHeight: '20px' }}
                        />
                      )}
                    </div>

                    {/* Print-only clean text (strictly shown during print, zero duplication) */}
                    <div className="hidden print:block print-only-container w-full whitespace-pre-wrap font-bold leading-tight text-center text-[9px]">
                      {order.dosisCalculo}
                    </div>
                  </div>

                  {/* Column 2: Lo que se administra / Indicación (Wide, extensive) */}
                  <div className="flex-1 py-0.5 px-1.5 text-[9.5px] sm:text-[10px] font-medium text-black bg-white flex items-center justify-between gap-1.5 min-w-0">
                    {/* Number + Content */}
                    <div className="flex-1 flex items-start gap-1.5 min-w-0">
                      <span className="font-black text-[9.5px] sm:text-[10px] text-black shrink-0 pt-0.5 select-none">
                        {order.itemNumber || idx + 1}.
                      </span>

                      {/* Screen / Edit container */}
                      <div className="no-print edit-only-container flex-1 min-w-0">
                        {readOnly ? (
                          <div className="w-full font-medium text-[9.5px] sm:text-[10px] text-black leading-tight py-1 select-text whitespace-pre-wrap">
                            {order.descripcion}
                          </div>
                        ) : (
                          <textarea
                            value={order.descripcion || ''}
                            onInput={(e) => {
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = `${Math.max(20, e.currentTarget.scrollHeight)}px`;
                            }}
                            onChange={e => handleUpdateOrder(order.id, 'descripcion', e.target.value)}
                            placeholder="Escriba indicación, medicamento, vía, frecuencia..."
                            rows={1}
                            className="w-full bg-transparent border-0 font-medium text-[9.5px] sm:text-[10px] text-black focus:outline-none focus:bg-teal-50/70 resize-none leading-tight overflow-hidden p-0"
                            style={{ height: 'auto', minHeight: '20px' }}
                          />
                        )}
                      </div>

                      {/* Print-only clean text (strictly shown during print, zero duplication) */}
                      <div className="hidden print:block print-only-container flex-1 min-w-0 font-medium text-[9.5px] leading-tight whitespace-pre-wrap">
                        {order.descripcion}
                      </div>
                    </div>

                    {/* Row Action Buttons: Always VISIBLE when editing, strictly hidden on print or in readOnly */}
                    {!readOnly && (
                      <div className="no-print flex items-center gap-1 shrink-0 pl-1">
                        <button
                          type="button"
                          onClick={() => handleInsertRowBelow(idx)}
                          className="px-1.5 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-extrabold text-[8.5px] flex items-center gap-0.5 border border-teal-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title={`Insertar fila debajo del ítem ${order.itemNumber}`}
                        >
                          <Plus className="w-2.5 h-2.5 text-teal-600" />
                          <span>+ Fila</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveOrder(order.id)}
                          className="px-1 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[8.5px] flex items-center gap-0.5 border border-rose-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title={`Eliminar fila ${order.itemNumber}`}
                        >
                          <Trash2 className="w-2.5 h-2.5 text-rose-500" />
                          <span className="hidden sm:inline">Quitar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Add Row Bar (Visible in Editor, strictly hidden on print or in readOnly) */}
            {!readOnly && (
              <div className="no-print mt-3 mb-4 flex items-center justify-between p-2 bg-slate-50 border-2 border-dashed border-teal-400/60 rounded-xl">
                <button
                  type="button"
                  onClick={handleAddOrder}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Fila al Final
                </button>
                <div className="text-[10px] text-slate-600 font-bold">
                  Total órdenes: <strong className="text-teal-700 font-black">{orders.length}</strong>
                </div>
              </div>
            )}

            {/* Doctor Signature Line at Bottom - Compact */}
            <div className="mt-6 mb-4 flex justify-between items-end text-center text-[9px] font-black text-black">
              <div className="w-36 sm:w-44 border-t border-black pt-1">
                <p>MÉDICO RESIDENTE</p>
                <p className="font-normal text-[8px]">{doctorName}</p>
              </div>
              <div className="w-32 sm:w-40 border-t border-black pt-1">
                <p>ENFERMERA</p>
              </div>
              <div className="w-44 sm:w-52 border-t border-black pt-1">
                <p>RESIDENTE SUPERIOR O ADJUNTO DE GUARDIA</p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
