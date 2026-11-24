import React, { useState, useRef, useEffect } from 'react';
import { Patient, HistoriaClinicaPediatrica, DischargeSummaryData, DiagnosisItem } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import {
  Printer,
  Download,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  FileText,
  Edit3,
  Plus,
  Trash2,
  X,
  Check,
  Save,
  FlaskConical,
  Stethoscope,
  ClipboardList,
  Smartphone,
  ChevronDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  formatPrintDocumentTitle,
  openInstantWhitePrintPage,
  addCanvasSinglePageWithMargin,
} from '../utils/pdfPrinter';
import { useSeasonalTheme } from '../utils/seasonalTheme';

export const DX_EGRESO_STATUS_OPTIONS = ['Resuelto', 'En resolución', 'En estudio'] as const;
export type DxEgresoStatus = (typeof DX_EGRESO_STATUS_OPTIONS)[number];

const DX_STATUS_TRAILING_REGEX = /\s*(?:[—–\-]\s*|\(\s*)?(Resuelto|En resolución|En estudio)\s*\)?\.?\s*$/i;

function extractDiagnosisStatus(line: string): { base: string; status: DxEgresoStatus | '' } {
  const trimmed = line.trim();
  const match = trimmed.match(DX_STATUS_TRAILING_REGEX);
  if (!match) return { base: trimmed, status: '' };
  const rawStatus = match[1].toLowerCase();
  const normalized: DxEgresoStatus =
    rawStatus === 'resuelto'
      ? 'Resuelto'
      : rawStatus === 'en estudio'
      ? 'En estudio'
      : 'En resolución';
  const base = trimmed.slice(0, match.index).replace(/[\s—–\-]+$/, '').trim();
  return { base, status: normalized };
}

function applyDiagnosisStatusToLine(line: string, status: DxEgresoStatus | ''): string {
  const { base } = extractDiagnosisStatus(line);
  if (!base) return status || '';
  return status ? `${base} — ${status}` : base;
}

function formatDiagnosisHtmlWithBoldStatus(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\r?\n/)
    .map(line =>
      line.replace(
        /(\s*(?:—|–|-|\()?\s*)(Resuelto|En resolución|En estudio)(\)?\.?\s*)$/i,
        '$1<strong>$2</strong>$3'
      )
    )
    .join('\n');
}

interface Props {
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  onUpdatePatient?: (updatedPatient: Patient) => void;
  onClose: () => void;
}

function parseNumberedLines(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];
  return rawText
    .split(/\r?\n/)
    .map(l => l.trim().replace(/^\d+[\.\)]\s*/, ''))
    .filter(Boolean);
}

function serializeNumberedLines(items: string[]): string {
  return items
    .map(s => s.trim())
    .filter(Boolean)
    .map((item, idx) => `${idx + 1}. ${item}`)
    .join('\n');
}

interface AutoGrowModalTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const AutoGrowModalTextarea: React.FC<AutoGrowModalTextareaProps> = ({ value, onChange, placeholder, className }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(62, el.scrollHeight + 6)}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={e => {
        onChange(e.target.value);
        resize();
      }}
      placeholder={placeholder}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  );
};

export const ResumenEgresoDocument: React.FC<Props> = ({ patient, historia, onUpdatePatient, onClose }) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);
  const now = new Date();
  const dischargeDateStr = patient.dischargeDate || now.toISOString().split('T')[0];
  const savedSum = patient.dischargeSummary;

  // Latest evolution
  const latestEvolution = patient.evolutions && patient.evolutions.length > 0 ? patient.evolutions[0] : null;

  // Numerical Weight Calculation for pediatric dosage
  const rawWeight = patient.weightKg || (latestEvolution?.vitalSigns?.peso ? parseFloat(latestEvolution.vitalSigns.peso.replace(/[^\d.]/g, '')) : 10);
  const safeWeight = isNaN(rawWeight) || rawWeight <= 0 ? 10 : rawWeight;
  const paracetamolCcValue = safeWeight * 0.625;
  const paracetamolCc = paracetamolCcValue.toFixed(1);
  const useParacetamolTablet = safeWeight > 30 || paracetamolCcValue >= 15;

  // Demographic / General Data state
  const [fechaIngreso, setFechaIngreso] = useState<string>(savedSum?.fechaIngreso ?? (historia?.fechaIngreso || patient.admissionDate || ''));
  const [fechaEgreso, setFechaEgreso] = useState<string>(savedSum?.fechaEgreso ?? dischargeDateStr);
  const [numHistoria, setNumHistoria] = useState<string>(savedSum?.numHistoria ?? (patient.medicalHistoryNumber || ''));
  const [diasHosp, setDiasHosp] = useState<string>(savedSum?.diasHosp ?? `${timeCalc.days || 1}`);
  const [nombres, setNombres] = useState<string>(savedSum?.nombres ?? (patient.firstName || ''));
  const [apellidos, setApellidos] = useState<string>(savedSum?.apellidos ?? (patient.lastName || ''));
  const [edad, setEdad] = useState<string>(savedSum?.edad ?? (patient.age || ''));
  const [sexo, setSexo] = useState<'M' | 'F'>(savedSum?.sexo ?? (patient.gender || 'M'));
  const [pesoIngreso, setPesoIngreso] = useState<string>(savedSum?.pesoIngreso ?? (patient.weightKg ? `${patient.weightKg} kg` : ''));
  const [pesoEgreso, setPesoEgreso] = useState<string>(savedSum?.pesoEgreso ?? (latestEvolution?.vitalSigns?.peso || (patient.weightKg ? `${patient.weightKg} kg` : '')));

  // 1. Diagnósticos de Ingreso
  const defaultDiagIngreso = patient.diagnoses && patient.diagnoses.length > 0
    ? patient.diagnoses.map((d, i) => `${i + 1}. ${d.title}`).join('\n')
    : '1. Sepsis punto de partida respiratorio';
  const [diagnosticosIngreso, setDiagnosticosIngreso] = useState<string>(savedSum?.diagnosticosIngreso ?? defaultDiagIngreso);

  // 2. Resumen Evolutivo y Evaluación de Egreso Clínica Pediátrica Completa
  const currentTreatment = latestEvolution?.treatmentModified?.trim() || patient.treatment?.trim() || 'antibioticoterapia parenteral y soporte clínico integral';
  
  const generateRichEvaluation = () => {
    const totalDays = timeCalc.days || 1;
    return `Se evalúa paciente en estables condiciones generales, posterior a evolución clínica favorable y paraclínicos dentro de límites aceptables, se indica alta médica el cual llevó ${totalDays} día(s) de hospitalización recibiendo tratamiento con ${currentTreatment}. Posterior al alta recibirá tratamiento ambulatorio.`;
  };

  const [resumenEvolutivo, setResumenEvolutivo] = useState<string>(savedSum?.resumenEvolutivo ?? generateRichEvaluation());

  // 3. Paraclínicos de Ingreso
  const labCol = historia?.laboratoriosColumnas && historia.laboratoriosColumnas.length > 0 ? historia.laboratoriosColumnas[0] : null;
  const labVals = labCol?.valores || {};
  const savedLabs = savedSum?.paraclinicos;

  const [labFecha, setLabFecha] = useState<string>(savedLabs?.fecha ?? (labCol?.fecha || patient.admissionDate || ''));
  const [labGB, setLabGB] = useState<string>(savedLabs?.gb ?? (labVals['GLÓBULOS BLANCOS'] || labVals['Leucocitos'] || labVals['GB'] || labVals['Glóbulos Blancos'] || ''));
  const [labHcto, setLabHcto] = useState<string>(savedLabs?.hcto ?? (labVals['HEMATOCRITO'] || labVals['Hematocrito'] || labVals['Hcto'] || ''));
  const [labPlt, setLabPlt] = useState<string>(savedLabs?.plt ?? (labVals['PLAQUETAS'] || labVals['Plaquetas'] || labVals['Plt'] || ''));
  const [labTipiaje, setLabTipiaje] = useState<string>(savedLabs?.tipiaje ?? (labVals['Tipiaje'] || labVals['Grupo'] || ''));
  const [labNeu, setLabNeu] = useState<string>(savedLabs?.neu ?? (labVals['Neutrófilos'] || labVals['Neu'] || ''));
  const [labSeg, setLabSeg] = useState<string>(savedLabs?.seg ?? (labVals['NEUTRÓFILOS SEGMENTADOS'] || labVals['Segmentados'] || labVals['Seg'] || ''));
  const [labLin, setLabLin] = useState<string>(savedLabs?.lin ?? (labVals['LINFOCITOS'] || labVals['Linfocitos'] || labVals['Lin'] || ''));
  const [labVSG, setLabVSG] = useState<string>(savedLabs?.vsg ?? (labVals['VSG'] || ''));
  const [labUrea, setLabUrea] = useState<string>(savedLabs?.urea ?? (labVals['UREA'] || labVals['Urea'] || ''));
  const [labCreatinina, setLabCreatinina] = useState<string>(savedLabs?.creatinina ?? (labVals['CREATININA'] || labVals['Creatinina'] || ''));
  const [labAcUrico, setLabAcUrico] = useState<string>(savedLabs?.acUrico ?? (labVals['Ácido Úrico'] || labVals['Ac Urico'] || ''));
  const [labGlicemia, setLabGlicemia] = useState<string>(savedLabs?.glicemia ?? (labVals['GLICEMIA'] || labVals['Glicemia'] || ''));
  const [labProtT, setLabProtT] = useState<string>(savedLabs?.protT ?? (labVals['PROTEÍNAS TOTALES'] || labVals['Proteínas Totales'] || labVals['Prot T'] || ''));
  const [labAlbumina, setLabAlbumina] = useState<string>(savedLabs?.albumina ?? (labVals['ALBÚMINA'] || labVals['Albúmina'] || ''));
  const [labGlobulina, setLabGlobulina] = useState<string>(savedLabs?.globulina ?? (labVals['GLOBULINAS'] || labVals['Globulina'] || ''));
  const [labPTPaciente, setLabPTPaciente] = useState<string>(savedLabs?.ptPaciente ?? (labVals['PT Paciente'] || labVals['PT'] || ''));
  const [labPTControl, setLabPTControl] = useState<string>(savedLabs?.ptControl ?? (labVals['PT Control'] || ''));
  const [labRazon, setLabRazon] = useState<string>(savedLabs?.razon ?? (labVals['Razón'] || ''));
  const [labPTTControl, setLabPTTControl] = useState<string>(savedLabs?.pttControl ?? (labVals['PTT Control'] || ''));
  const [labPTTPaciente, setLabPTTPaciente] = useState<string>(savedLabs?.pttPaciente ?? (labVals['PTT Paciente'] || labVals['PTT'] || ''));
  const [labDiferencia, setLabDiferencia] = useState<string>(savedLabs?.diferencia ?? (labVals['Diferencia'] || ''));
  const [labVIH, setLabVIH] = useState<string>(savedLabs?.vih ?? (labVals['VIH'] || ''));
  const [labVDRL, setLabVDRL] = useState<string>(savedLabs?.vdrl ?? (labVals['VDRL'] || ''));
  const [labPCR, setLabPCR] = useState<string>(savedLabs?.pcr ?? (labVals['PCR'] || ''));
  const [labCultivo, setLabCultivo] = useState<string>(savedLabs?.cultivo ?? (labVals['Cultivo'] || ''));

  // Oxígeno Terapia y Transfusiones
  const [oxigenoFiO2, setOxigenoFiO2] = useState<string>(savedSum?.oxigenoFiO2 ?? (latestEvolution?.vitalSigns?.hasOxygenSupport ? (latestEvolution.vitalSigns.fio2 || '21%') : ''));
  const [oxigenoDias, setOxigenoDias] = useState<string>(savedSum?.oxigenoDias ?? (latestEvolution?.vitalSigns?.hasOxygenSupport ? `${timeCalc.days || 1}` : ''));
  const [transfusionSi, setTransfusionSi] = useState<boolean>(savedSum ? savedSum.transfusionSi : false);
  const [transfusionNo, setTransfusionNo] = useState<boolean>(savedSum ? savedSum.transfusionNo : true);

  // 4. Diagnósticos de Egreso
  const defaultDiagEgreso = latestEvolution?.diagnosesModified?.trim() || defaultDiagIngreso;
  const [diagnosticosEgreso, setDiagnosticosEgreso] = useState<string>(savedSum?.diagnosticosEgreso ?? defaultDiagEgreso);

  // 5. Se Indica
  const paracetamolInstruction = useParacetamolTablet
    ? "2. Paracetamol (Acetaminofén) 500mg vía oral cada 6 horas solo en caso de fiebre (≥ 38.0°C) o dolor."
    : `2. Paracetamol (Acetaminofén) jarabe 120 mg/5 mL: Administrar ${paracetamolCc} cc vía oral cada 6 horas solo en caso de fiebre (≥ 38.0°C) o dolor.`;

  const defaultIndicaciones = 
`1. Reevaluación clínica ambulatoria por Consulta Externa de Pediatría en 7 días.
${paracetamolInstruction}
3. Control de Niño Sano según cronograma del esquema de Puericultura y Vacunación.
4. Dieta habitual balanceada acorde a la edad, adecuada hidratación oral y reposo relativo en casa.
5. Continuar medidas generales de higiene y cumplimiento estricto del tratamiento prescrito.`;
  const [seIndica, setSeIndica] = useState<string>(savedSum?.seIndica ?? defaultIndicaciones);
  const [openInlineDxStatusIdx, setOpenInlineDxStatusIdx] = useState<number | null>(null);
  const [openModalDxStatusIdx, setOpenModalDxStatusIdx] = useState<number | null>(null);

  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const LETTER_WIDTH_PX = 816; // 215.9mm at 96 DPI
  const computeFitScale = (viewportWidth?: number) => {
    const w = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
    if (w < 848) {
      return Number(Math.max(0.3, Math.min(1, (w - 16) / LETTER_WIDTH_PX)).toFixed(3));
    }
    return 1;
  };
  const [zoomScale, setZoomScale] = useState<number>(() => computeFitScale());
  const [sheetHeightPx, setSheetHeightPx] = useState<number>(1056);
  const manualZoomRef = useRef<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [saveNotice, setSaveNotice] = useState<string>('');

  // Comfortable Mobile Editor Modals
  const [showIndicaModal, setShowIndicaModal] = useState<boolean>(false);
  const [indicaItemsDraft, setIndicaItemsDraft] = useState<string[]>([]);

  const [showLabsModal, setShowLabsModal] = useState<boolean>(false);
  const [labsDraft, setLabsDraft] = useState({
    fecha: '', gb: '', hcto: '', plt: '', tipiaje: '',
    neu: '', seg: '', lin: '', vsg: '',
    urea: '', creatinina: '', acUrico: '', glicemia: '',
    protT: '', albumina: '', globulina: '',
    ptPaciente: '', ptControl: '', razon: '', pttControl: '', pttPaciente: '',
    diferencia: '', vih: '', vdrl: '', pcr: '', cultivo: '',
    oxigenoFiO2: '', oxigenoDias: '', transfusionSi: false, transfusionNo: true
  });

  const [showDxEgresoModal, setShowDxEgresoModal] = useState<boolean>(false);
  const [dxEgresoItemsDraft, setDxEgresoItemsDraft] = useState<string[]>([]);

  // Pinch-to-zoom refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  // Auto-fit sheet width cleanly on mobile/tablet and keep scaled container height accurate
  useEffect(() => {
    const updateFit = () => {
      if (manualZoomRef.current) return;
      const containerWidth = scrollContainerRef.current?.clientWidth || window.innerWidth;
      setZoomScale(computeFitScale(containerWidth));
    };
    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const syncHeight = () => {
      const h = el.scrollHeight || el.offsetHeight || 1056;
      setSheetHeightPx(Math.max(1056, h));
    };
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [diagnosticosIngreso, resumenEvolutivo, diagnosticosEgreso, seIndica]);

  // Listen for interactive tutorial cleanup / modal controls
  useEffect(() => {
    const onCleanup = () => {
      setShowIndicaModal(false);
      setShowLabsModal(false);
      setShowDxEgresoModal(false);
    };
    window.addEventListener('hmi_tutorial_cleanup', onCleanup);
    return () => window.removeEventListener('hmi_tutorial_cleanup', onCleanup);
  }, []);

  const handleTouchStartPinch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = zoomScale;
    }
  };

  const handleTouchMovePinch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDistRef.current;
      const next = Math.max(0.3, Math.min(2.4, Number((pinchStartScaleRef.current * ratio).toFixed(2))));
      manualZoomRef.current = true;
      setZoomScale(next);
    }
  };

  const handleTouchEndPinch = () => {
    pinchStartDistRef.current = null;
  };

  // Build snapshot & persist to Patient
  const persistDischargeSummary = (overrides?: Partial<DischargeSummaryData>) => {
    const nextSeIndica = overrides?.seIndica ?? seIndica;
    const nextDxEgreso = overrides?.diagnosticosEgreso ?? diagnosticosEgreso;
    const nextLabs = overrides?.paraclinicos ?? {
      fecha: labFecha,
      gb: labGB,
      hcto: labHcto,
      plt: labPlt,
      tipiaje: labTipiaje,
      neu: labNeu,
      seg: labSeg,
      lin: labLin,
      vsg: labVSG,
      urea: labUrea,
      creatinina: labCreatinina,
      acUrico: labAcUrico,
      glicemia: labGlicemia,
      protT: labProtT,
      albumina: labAlbumina,
      globulina: labGlobulina,
      ptPaciente: labPTPaciente,
      ptControl: labPTControl,
      razon: labRazon,
      pttControl: labPTTControl,
      pttPaciente: labPTTPaciente,
      diferencia: labDiferencia,
      vih: labVIH,
      vdrl: labVDRL,
      pcr: labPCR,
      cultivo: labCultivo
    };

    const summarySnapshot: DischargeSummaryData = {
      fechaIngreso,
      fechaEgreso,
      numHistoria,
      diasHosp,
      nombres,
      apellidos,
      edad,
      sexo,
      pesoIngreso,
      pesoEgreso,
      diagnosticosIngreso,
      resumenEvolutivo,
      diagnosticosEgreso: nextDxEgreso,
      seIndica: nextSeIndica,
      oxigenoFiO2: overrides?.oxigenoFiO2 ?? oxigenoFiO2,
      oxigenoDias: overrides?.oxigenoDias ?? oxigenoDias,
      transfusionSi: overrides?.transfusionSi ?? transfusionSi,
      transfusionNo: overrides?.transfusionNo ?? transfusionNo,
      paraclinicos: nextLabs,
      updatedAt: new Date().toISOString()
    };

    if (onUpdatePatient) {
      const parsedDxItems: DiagnosisItem[] = parseNumberedLines(nextDxEgreso).map((title, idx) => ({
        id: patient.diagnoses?.[idx]?.id || `dx-egr-${Date.now()}-${idx}`,
        title
      }));
      onUpdatePatient({
        ...patient,
        diagnoses: parsedDxItems.length > 0 ? parsedDxItems : patient.diagnoses,
        dischargeSummary: summarySnapshot,
        updatedAt: new Date().toISOString()
      });
      setSaveNotice('Cambios guardados en la base de datos y listos para exportar a .JSON');
      setTimeout(() => setSaveNotice(''), 3500);
    }
  };

  // Auto-resize textareas so they NEVER have scrollbars
  const diagIngresoRef = useRef<HTMLTextAreaElement>(null);
  const resumenRef = useRef<HTMLTextAreaElement>(null);
  const diagEgresoRef = useRef<HTMLTextAreaElement>(null);
  const seIndicaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(28, el.scrollHeight)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight(diagIngresoRef.current);
    adjustTextareaHeight(resumenRef.current);
    adjustTextareaHeight(diagEgresoRef.current);
    adjustTextareaHeight(seIndicaRef.current);
  }, [diagnosticosIngreso, resumenEvolutivo, diagnosticosEgreso, seIndica, showIndicaModal, showDxEgresoModal, showLabsModal, zoomScale]);

  const handleOpenIndicaEditor = () => {
    const parsed = parseNumberedLines(seIndica);
    setIndicaItemsDraft(parsed.length > 0 ? parsed : ['']);
    setShowIndicaModal(true);
  };

  const handleApplyIndicaModal = () => {
    const formatted = serializeNumberedLines(indicaItemsDraft);
    setSeIndica(formatted);
    setShowIndicaModal(false);
    persistDischargeSummary({ seIndica: formatted });
  };

  const handleOpenLabsEditor = () => {
    setLabsDraft({
      fecha: labFecha, gb: labGB, hcto: labHcto, plt: labPlt, tipiaje: labTipiaje,
      neu: labNeu, seg: labSeg, lin: labLin, vsg: labVSG,
      urea: labUrea, creatinina: labCreatinina, acUrico: labAcUrico, glicemia: labGlicemia,
      protT: labProtT, albumina: labAlbumina, globulina: labGlobulina,
      ptPaciente: labPTPaciente, ptControl: labPTControl, razon: labRazon,
      pttControl: labPTTControl, pttPaciente: labPTTPaciente,
      diferencia: labDiferencia, vih: labVIH, vdrl: labVDRL, pcr: labPCR, cultivo: labCultivo,
      oxigenoFiO2, oxigenoDias, transfusionSi, transfusionNo
    });
    setShowLabsModal(true);
  };

  const handleApplyLabsModal = () => {
    setLabFecha(labsDraft.fecha);
    setLabGB(labsDraft.gb);
    setLabHcto(labsDraft.hcto);
    setLabPlt(labsDraft.plt);
    setLabTipiaje(labsDraft.tipiaje);
    setLabNeu(labsDraft.neu);
    setLabSeg(labsDraft.seg);
    setLabLin(labsDraft.lin);
    setLabVSG(labsDraft.vsg);
    setLabUrea(labsDraft.urea);
    setLabCreatinina(labsDraft.creatinina);
    setLabAcUrico(labsDraft.acUrico);
    setLabGlicemia(labsDraft.glicemia);
    setLabProtT(labsDraft.protT);
    setLabAlbumina(labsDraft.albumina);
    setLabGlobulina(labsDraft.globulina);
    setLabPTPaciente(labsDraft.ptPaciente);
    setLabPTControl(labsDraft.ptControl);
    setLabRazon(labsDraft.razon);
    setLabPTTControl(labsDraft.pttControl);
    setLabPTTPaciente(labsDraft.pttPaciente);
    setLabDiferencia(labsDraft.diferencia);
    setLabVIH(labsDraft.vih);
    setLabVDRL(labsDraft.vdrl);
    setLabPCR(labsDraft.pcr);
    setLabCultivo(labsDraft.cultivo);
    setOxigenoFiO2(labsDraft.oxigenoFiO2);
    setOxigenoDias(labsDraft.oxigenoDias);
    setTransfusionSi(labsDraft.transfusionSi);
    setTransfusionNo(labsDraft.transfusionNo);
    setShowLabsModal(false);
    persistDischargeSummary({
      oxigenoFiO2: labsDraft.oxigenoFiO2,
      oxigenoDias: labsDraft.oxigenoDias,
      transfusionSi: labsDraft.transfusionSi,
      transfusionNo: labsDraft.transfusionNo,
      paraclinicos: {
        fecha: labsDraft.fecha, gb: labsDraft.gb, hcto: labsDraft.hcto, plt: labsDraft.plt, tipiaje: labsDraft.tipiaje,
        neu: labsDraft.neu, seg: labsDraft.seg, lin: labsDraft.lin, vsg: labsDraft.vsg,
        urea: labsDraft.urea, creatinina: labsDraft.creatinina, acUrico: labsDraft.acUrico, glicemia: labsDraft.glicemia,
        protT: labsDraft.protT, albumina: labsDraft.albumina, globulina: labsDraft.globulina,
        ptPaciente: labsDraft.ptPaciente, ptControl: labsDraft.ptControl, razon: labsDraft.razon,
        pttControl: labsDraft.pttControl, pttPaciente: labsDraft.pttPaciente,
        diferencia: labsDraft.diferencia, vih: labsDraft.vih, vdrl: labsDraft.vdrl, pcr: labsDraft.pcr, cultivo: labsDraft.cultivo
      }
    });
  };

  const handleOpenDxEgresoEditor = () => {
    const parsed = parseNumberedLines(diagnosticosEgreso);
    setDxEgresoItemsDraft(parsed.length > 0 ? parsed : ['']);
    setShowDxEgresoModal(true);
  };

  const handleApplyDxEgresoModal = () => {
    const formatted = serializeNumberedLines(dxEgresoItemsDraft);
    setDiagnosticosEgreso(formatted);
    setShowDxEgresoModal(false);
    setOpenModalDxStatusIdx(null);
    persistDischargeSummary({ diagnosticosEgreso: formatted });
  };

  const handleSetInlineDxStatus = (idx: number, status: DxEgresoStatus | '') => {
    const lines = parseNumberedLines(diagnosticosEgreso);
    if (idx < 0 || idx >= lines.length) return;
    lines[idx] = applyDiagnosisStatusToLine(lines[idx], status);
    const updated = serializeNumberedLines(lines);
    setDiagnosticosEgreso(updated);
    setOpenInlineDxStatusIdx(null);
  };

  // Export to Microsoft Word (.doc) with correct XML/HTML format that opens cleanly in Word
  const handleExportWord = () => {
    const htmlWordContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <title>Resumen de Egreso - ${patient.lastName}, ${patient.firstName}</title>
        <style>
          @page {
            size: 215.9mm 279.4mm;
            margin: 15mm 15mm 15mm 15mm;
          }
          body {
            font-family: 'Arial', sans-serif;
            font-size: 12pt;
            color: #000000;
            line-height: 1.2;
          }
          h1 {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 10pt;
            text-decoration: underline;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10pt;
          }
          td {
            border: 1px solid #000000;
            padding: 4pt 6pt;
            vertical-align: top;
            font-size: 12pt;
          }
          .section-header {
            font-weight: bold;
            text-transform: uppercase;
            background-color: #f3f4f6;
            padding: 4pt;
            border: 1px solid #000000;
            margin-top: 10pt;
            font-size: 12pt;
          }
          .content-block {
            border: 1px solid #000000;
            padding: 6pt;
            min-height: 50pt;
            margin-bottom: 10pt;
            font-size: 12pt;
            white-space: pre-wrap;
          }
          .label { font-weight: bold; }
          .footer-table td {
            border: none;
            border-top: 1px solid #000000;
            text-align: center;
            padding-top: 5pt;
            width: 33%;
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 15pt;">
          GOBIERNO BOLIVARIANO DE VENEZUELA · MINISTERIO DEL PODER POPULAR PARA LA SALUD<br/>
          HOSPITAL MATERNO INFANTIL COMANDANTE SUPREMO HUGO RAFAEL CHÁVEZ FRÍAS<br/>
          PEDIATRÍA Y PUERICULTURA
        </div>

        <h1>RESUMEN DE EGRESO</h1>

        <table>
          <tr>
            <td><span class="label">FECHA DE INGRESO:</span> ${fechaIngreso}</td>
            <td><span class="label">FECHA DE EGRESO:</span> ${fechaEgreso}</td>
            <td><span class="label">Nº HISTORIA:</span> ${numHistoria}</td>
          </tr>
          <tr>
            <td colspan="2"><span class="label">NOMBRES Y APELLIDOS:</span> ${nombres.toUpperCase()} ${apellidos.toUpperCase()}</td>
            <td><span class="label">DÍAS HOSP:</span> ${diasHosp}</td>
          </tr>
          <tr>
            <td><span class="label">EDAD:</span> ${edad}</td>
            <td><span class="label">SEXO:</span> [${sexo === 'M' ? 'X' : ' '}] M &nbsp;&nbsp; [${sexo === 'F' ? 'X' : ' '}] F</td>
            <td><span class="label">PESO (ING/EGR):</span> ${pesoIngreso} / ${pesoEgreso}</td>
          </tr>
        </table>

        <div class="section-header">Diagnósticos de Ingreso:</div>
        <div class="content-block">${diagnosticosIngreso}</div>

        <div class="section-header">Resumen Evolutivo & Evaluación de Egreso:</div>
        <div class="content-block">${resumenEvolutivo}</div>

        <div class="section-header">Paraclínicos de Ingreso (Fecha: ${labFecha}):</div>
        <table>
          <tr>
            <td><span class="label">GB:</span> ${labGB}</td>
            <td><span class="label">Hcto:</span> ${labHcto}</td>
            <td><span class="label">Plt:</span> ${labPlt}</td>
            <td><span class="label">Tipiaje:</span> ${labTipiaje}</td>
          </tr>
          <tr>
            <td><span class="label">Neu:</span> ${labNeu}</td>
            <td><span class="label">Seg:</span> ${labSeg}</td>
            <td><span class="label">Lin:</span> ${labLin}</td>
            <td><span class="label">VSG:</span> ${labVSG}</td>
          </tr>
          <tr>
            <td><span class="label">Urea:</span> ${labUrea}</td>
            <td><span class="label">Creatinina:</span> ${labCreatinina}</td>
            <td><span class="label">Ác. Úrico:</span> ${labAcUrico}</td>
            <td><span class="label">Glicemia:</span> ${labGlicemia}</td>
          </tr>
          <tr>
            <td><span class="label">Prot. T:</span> ${labProtT}</td>
            <td><span class="label">Albúmina:</span> ${labAlbumina}</td>
            <td><span class="label">Globulina:</span> ${labGlobulina}</td>
            <td><span class="label">PT Pac:</span> ${labPTPaciente}</td>
          </tr>
          <tr>
            <td><span class="label">PT Ctrl:</span> ${labPTControl}</td>
            <td><span class="label">Razón:</span> ${labRazon}</td>
            <td><span class="label">PTT Ctrl:</span> ${labPTTControl}</td>
            <td><span class="label">PTT Pac:</span> ${labPTTPaciente}</td>
          </tr>
          <tr>
            <td><span class="label">Diferencia:</span> ${labDiferencia}</td>
            <td><span class="label">VIH:</span> ${labVIH}</td>
            <td><span class="label">VDRL:</span> ${labVDRL}</td>
            <td><span class="label">PCR:</span> ${labPCR}</td>
          </tr>
          <tr>
            <td colspan="4"><span class="label">Cultivo:</span> ${labCultivo || 'Sin aislamientos'} &nbsp;|&nbsp; <span class="label">Oxígeno:</span> ${oxigenoFiO2 || 'N/A'} &nbsp;|&nbsp; <span class="label">Transfusiones:</span> [${transfusionSi ? 'X' : ' '}] Sí [${transfusionNo ? 'X' : ' '}] No</td>
          </tr>
        </table>

        <div class="section-header">Diagnósticos de Egreso:</div>
        <div class="content-block">${formatDiagnosisHtmlWithBoldStatus(diagnosticosEgreso)}</div>

        <div class="section-header">Se Indica:</div>
        <div class="content-block">${seIndica}</div>

        <br/><br/>
        <table class="footer-table">
          <tr>
            <td>MÉDICO RESIDENTE<br/><span style="font-weight: normal; font-size: 11pt;">${patient.doctorInCharge || 'Dr. Brayan'}</span></td>
            <td>JEFE DE SERVICIO<br/><span style="font-weight: normal; font-size: 11pt;">Pediatría y Puericultura</span></td>
            <td>SELLO INSTITUCIONAL</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlWordContent], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RESUMEN_EGRESO_${patient.lastName.toUpperCase()}_${patient.firstName.toUpperCase()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert inputs & textareas into clean printable DOM nodes with 10.5pt Arial size
  const preparePrintableClone = (docElement: HTMLElement): HTMLElement => {
    const clone = docElement.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.zoom = '1';

    // Replace inputs with plain text spans
    const originalInputs = docElement.querySelectorAll<HTMLInputElement>('input');
    const clonedInputs = clone.querySelectorAll<HTMLInputElement>('input');
    clonedInputs.forEach((clonedInput, idx) => {
      const orig = originalInputs[idx];
      if (!orig) return;
      const span = document.createElement('span');
      if (orig.type === 'checkbox') {
        span.textContent = orig.checked ? '[X]' : '[ ]';
        span.style.fontFamily = 'Arial, sans-serif';
        span.style.fontWeight = 'bold';
        span.style.fontSize = '10.5pt';
      } else {
        span.textContent = orig.value || ' ';
        span.style.borderBottom = '1px dotted #000000';
        span.style.padding = '0 2px';
        span.style.display = 'inline-block';
        span.style.minWidth = orig.style.width || '20px';
        span.style.fontSize = '10.5pt';
        span.style.fontWeight = 'normal';
        span.style.fontFamily = 'Arial, sans-serif';
      }
      clonedInput.parentNode?.replaceChild(span, clonedInput);
    });

    // Replace textareas with clean printable divs (normal weight, bold only for key status words)
    const originalTextareas = docElement.querySelectorAll<HTMLTextAreaElement>('textarea');
    const clonedTextareas = clone.querySelectorAll<HTMLTextAreaElement>('textarea');
    clonedTextareas.forEach((clonedTa, idx) => {
      const orig = originalTextareas[idx];
      if (!orig) return;
      const div = document.createElement('div');
      if (orig.dataset.dxEgreso === 'true') {
        div.innerHTML = formatDiagnosisHtmlWithBoldStatus(orig.value);
      } else {
        div.textContent = orig.value;
      }
      div.style.whiteSpace = 'pre-wrap';
      div.style.borderBottom = '1px dotted #000000';
      div.style.fontSize = '10pt';
      div.style.fontFamily = 'Arial, sans-serif';
      div.style.lineHeight = '1.25';
      div.style.color = '#000000';
      div.style.fontWeight = 'normal';
      div.style.padding = '1px 0';
      div.style.overflow = 'visible';
      div.style.height = 'auto';
      clonedTa.parentNode?.replaceChild(div, clonedTa);
    });

    // Remove no-print buttons
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    return clone;
  };

  const handleExportPdf = async () => {
    setIsDownloading(true);
    try {
      const buildResumenEgresoPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
        const pageElem = document.getElementById('resumen-egreso-page');
        if (!pageElem) return null;

        const printableClone = preparePrintableClone(pageElem);
        printableClone.style.transform = 'none';
        printableClone.style.zoom = '1';
        printableClone.style.width = '215.9mm';
        printableClone.style.maxWidth = '215.9mm';
        printableClone.style.minHeight = '0';
        printableClone.style.height = 'auto';
        printableClone.style.boxShadow = 'none';
        printableClone.style.border = 'none';
        printableClone.style.padding = '5mm 8mm';
        printableClone.style.fontFamily = 'Arial, sans-serif';
        printableClone.style.fontSize = '9.8pt';
        printableClone.style.position = 'fixed';
        printableClone.style.left = '-9999px';
        printableClone.style.top = '0';
        document.body.appendChild(printableClone);

        const canvas = await html2canvas(printableClone, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc, clonedElem) => {
            sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
          },
        });

        document.body.removeChild(printableClone);

        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
        addCanvasSinglePageWithMargin(pdf, canvas, { quality: 0.92 });

        const printDateStr = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
        return {
          pdf,
          fileName: `RESUMEN_EGRESO_${(patient.lastName).toUpperCase()}_${(patient.firstName).toUpperCase()}_${printDateStr}.pdf`,
        };
      };

      const built = await buildResumenEgresoPdf();
      if (built) {
        built.pdf.save(built.fileName);
      }
    } catch (e) {
      console.error('Error downloading PDF:', e);
      setSaveNotice('No se pudo descargar el PDF directamente. Intente nuevamente.');
      setTimeout(() => setSaveNotice(''), 4000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintPdf = () => {
    const pageElem = document.getElementById('resumen-egreso-page');
    if (!pageElem) return;
    const docTitle = formatPrintDocumentTitle(
      'Resumen de Egreso',
      `${apellidos || patient.lastName} ${nombres || patient.firstName}`,
      { includeDateTime: true }
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

  return (
    <div className="fixed inset-0 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md z-[100] flex flex-col items-stretch justify-start overflow-hidden font-sans">
      {/* Top Action Bar (Fixed, No Scroll) */}
      <div className={`no-print ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-3 sm:px-6 py-2 flex flex-col gap-2 z-20 shadow-sm dark:shadow-lg shrink-0`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" /> <span>Volver</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">Resumen de Egreso</h2>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate">{apellidos}, {nombres}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" data-tutorial="resumen-egreso-acciones">
            {/* Zoom Controls */}
            <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  manualZoomRef.current = true;
                  setZoomScale(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))));
                }}
                className="p-1 sm:p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                title="Reducir tamaño"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <span className={`text-[10px] font-mono font-bold w-8 sm:w-9 text-center ${themeTokens.accentText}`}>
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  manualZoomRef.current = true;
                  setZoomScale(prev => Math.min(2.4, Number((prev + 0.1).toFixed(2))));
                }}
                className="p-1 sm:p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                title="Aumentar tamaño"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  manualZoomRef.current = false;
                  const containerWidth = scrollContainerRef.current?.clientWidth || window.innerWidth;
                  setZoomScale(computeFitScale(containerWidth));
                }}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                title="Ajustar al ancho de la pantalla"
              >
                <Smartphone className="w-3 h-3" />
                <span className="hidden sm:inline">Ajustar</span>
              </button>
            </div>

            {onUpdatePatient && (
              <button
                type="button"
                onClick={() => persistDischargeSummary()}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 shadow-sm dark:shadow-md transition-all cursor-pointer whitespace-nowrap"
                title="Guardar cambios en la base de datos"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Guardar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportWord}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black flex items-center gap-1 shadow-sm dark:shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato Word"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Word</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isDownloading}
              aria-label="Descargar PDF"
              className="p-1.5 sm:p-2 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm dark:shadow-md transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              title={isDownloading ? 'Descargando PDF...' : 'Descargar documento en PDF'}
            >
              <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm dark:shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="Imprimir documento PDF de Resumen de Egreso (1 Hoja)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>

        {/* MOBILE-FRIENDLY QUICK EDITOR BUTTONS FOR PLAN (SE INDICA), PARACLÍNICOS & DX DE EGRESO */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2" data-tutorial="resumen-egreso-quick-editors">
          <button
            type="button"
            data-tutorial="resumen-egreso-btn-tto"
            onClick={handleOpenIndicaEditor}
            className="px-2 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-600/25 dark:hover:bg-teal-600/40 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-400/50 font-black text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Editar Indicaciones y Tratamiento al Egreso (SE INDICA)"
          >
            <ClipboardList className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300 shrink-0" />
            <span className="truncate">Editar tto</span>
          </button>

          <button
            type="button"
            data-tutorial="resumen-egreso-btn-lab"
            onClick={handleOpenLabsEditor}
            className="px-2 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/25 dark:hover:bg-indigo-600/40 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-400/50 font-black text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Editar Paraclínicos de Ingreso (Laboratorios)"
          >
            <FlaskConical className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300 shrink-0" />
            <span className="truncate">Lab</span>
          </button>

          <button
            type="button"
            data-tutorial="resumen-egreso-btn-dx"
            onClick={handleOpenDxEgresoEditor}
            className="px-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/35 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-400/50 font-black text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Editar Diagnósticos de Egreso"
          >
            <Stethoscope className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <span className="truncate">Dx</span>
          </button>
        </div>

        {saveNotice && (
          <div className="bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/50 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}
      </div>

      {/* Main Single Page Document Container with Full Horizontal/Vertical Touch Pan & Pinch-to-Zoom */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStartPinch}
        onTouchMove={handleTouchMovePinch}
        onTouchEnd={handleTouchEndPinch}
        className="flex-1 w-full overflow-auto bg-slate-200/70 dark:bg-slate-900/60 p-2 sm:p-4"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        <div
          className="mx-auto relative"
          style={{
            width: `${Math.ceil(LETTER_WIDTH_PX * zoomScale)}px`,
            height: `${Math.ceil(sheetHeightPx * zoomScale)}px`,
            minHeight: `${Math.ceil(1056 * zoomScale)}px`,
          }}
        >
          <div
            ref={sheetRef}
            id="resumen-egreso-page"
            data-tutorial="resumen-egreso-hoja"
            className="pdf-page-container bg-white text-[#000000] px-6 sm:px-8 py-6 sm:py-8 shadow-2xl border border-black box-border relative flex flex-col overflow-visible shrink-0"
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '12pt',
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top left',
              width: '816px',
              minWidth: '816px',
              maxWidth: 'none',
              minHeight: '1056px',
            }}
          >
          {/* HEADER: Institutional Logos & Title */}
          <div className="header-banner border-b border-black pb-1 mb-1" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between text-[9px] sm:text-[10pt] uppercase font-bold leading-tight text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="flex items-center gap-1.5">
                <svg className="w-10 h-6 shrink-0" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 2 8 C 35 -2, 85 22, 118 6 L 118 28 C 85 44, 35 20, 2 30 Z" fill="#FACC15" />
                  <path d="M 2 30 C 35 20, 85 44, 118 28 L 118 50 C 85 66, 35 42, 2 52 Z" fill="#0033A0" />
                  <path d="M 2 52 C 35 42, 85 66, 118 50 L 118 72 C 85 88, 35 64, 2 74 Z" fill="#DC2626" />
                </svg>
                <div>
                  <p className="text-[#b91c1c] font-black" style={{ fontSize: '9pt' }}>Gobierno Bolivariano de Venezuela</p>
                  <p style={{ fontSize: '8.5pt' }}>Ministerio del Poder Popular para la Salud</p>
                </div>
              </div>
              <div className="text-center font-black text-[#dc2626] tracking-tighter" style={{ fontSize: '9.5pt' }}>
                <p>PEDIATRÍA Y PUERICULTURA</p>
              </div>
              <div className="text-right leading-none">
                <p className="font-black" style={{ fontSize: '9pt' }}>Hospital Materno Infantil</p>
                <p style={{ fontSize: '8.5pt' }} className="font-bold">Comandante Supremo</p>
                <p className="font-black text-[#dc2626] italic font-serif" style={{ fontSize: '9.5pt' }}>Hugo Rafael Chávez Frías</p>
              </div>
            </div>

            <div className="text-center my-1.5">
              <h1 className="font-black uppercase tracking-widest text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '15pt' }}>
                RESUMEN DE EGRESO
              </h1>
            </div>
          </div>

          {/* GRID: Patient Demographics & Admission Data (Normal body values, Bold labels only) */}
          <div data-tutorial="resumen-egreso-datos" className="section-block border border-black p-1.5 text-[11pt] leading-tight space-y-1.5 mb-1.5 bg-white font-normal" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
            <div className="grid grid-cols-12 gap-1 items-center">
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>FECHA DE INGRESO:</span>
                <input 
                  type="text" 
                  value={fechaIngreso} 
                  onChange={e => setFechaIngreso(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>FECHA DE EGRESO:</span>
                <input 
                  type="text" 
                  value={fechaEgreso} 
                  onChange={e => setFechaEgreso(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>Nº HISTORIA:</span>
                <input 
                  type="text" 
                  value={numHistoria} 
                  onChange={e => setNumHistoria(e.target.value)} 
                  className="font-semibold border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1 items-center">
              <div className="col-span-5 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>NOMBRES:</span>
                <input 
                  type="text" 
                  value={nombres} 
                  onChange={e => setNombres(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none uppercase"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-5 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>APELLIDOS:</span>
                <input 
                  type="text" 
                  value={apellidos} 
                  onChange={e => setApellidos(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none uppercase"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>Días Hosp:</span>
                <input 
                  type="text" 
                  value={diasHosp} 
                  onChange={e => setDiasHosp(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 w-full bg-transparent focus:outline-none text-center"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1 items-center">
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>EDAD:</span>
                <input 
                  type="text" 
                  value={edad} 
                  onChange={e => setEdad(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="font-bold" style={{ fontSize: '10.5pt' }}>SEXO:</span>
                <label className="flex items-center gap-0.5 cursor-pointer font-normal" style={{ fontSize: '10.5pt' }}>
                  <input 
                    type="checkbox" 
                    checked={sexo === 'M'} 
                    onChange={() => setSexo('M')} 
                    className="w-3.5 h-3.5 text-black rounded"
                  /> M
                </label>
                <label className="flex items-center gap-0.5 cursor-pointer font-normal" style={{ fontSize: '10.5pt' }}>
                  <input 
                    type="checkbox" 
                    checked={sexo === 'F'} 
                    onChange={() => setSexo('F')} 
                    className="w-3.5 h-3.5 text-black rounded"
                  /> F
                </label>
              </div>
              <div className="col-span-3 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10pt' }}>PESO (ING):</span>
                <input 
                  type="text" 
                  value={pesoIngreso} 
                  onChange={e => setPesoIngreso(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
              <div className="col-span-3 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '10pt' }}>PESO (EGR):</span>
                <input 
                  type="text" 
                  value={pesoEgreso} 
                  onChange={e => setPesoEgreso(e.target.value)} 
                  className="font-normal border-b border-dotted border-black px-1 flex-1 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '10.5pt' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: DIAGNÓSTICOS DE INGRESO */}
          <div className="section-block mb-1.5" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold uppercase tracking-tight" style={{ fontSize: '11.5pt', fontFamily: 'Arial, sans-serif' }}>DIAGNÓSTICOS DE INGRESO:</span>
              <span className="text-[9pt] text-slate-500 font-mono no-print">(editable)</span>
            </div>
            <textarea
              ref={diagIngresoRef}
              rows={1}
              value={diagnosticosIngreso}
              onChange={e => {
                setDiagnosticosIngreso(e.target.value);
                adjustTextareaHeight(e.target);
              }}
              className="w-full bg-transparent border-b border-dotted border-black/80 p-0.5 font-normal leading-tight resize-none overflow-hidden focus:outline-none focus:bg-amber-50/20"
              style={{ overflow: 'hidden', fontFamily: 'Arial, sans-serif', fontSize: '11pt', fontWeight: 400 }}
              placeholder="1. Diagnóstico de ingreso..."
            />
          </div>

          {/* SECTION 2: RESUMEN EVOLUTIVO Y EVALUACIÓN DE EGRESO */}
          <div data-tutorial="resumen-egreso-resumen-evolutivo" className="section-block mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold uppercase tracking-tight" style={{ fontSize: '11.5pt', fontFamily: 'Arial, sans-serif' }}>RESUMEN EVOLUTIVO & EVALUACIÓN DE EGRESO:</span>
              <span className="text-[9pt] text-slate-500 font-mono no-print">(evaluación clínica de egreso principal)</span>
            </div>
            <textarea
              ref={resumenRef}
              rows={4}
              value={resumenEvolutivo}
              onChange={e => {
                setResumenEvolutivo(e.target.value);
                adjustTextareaHeight(e.target);
              }}
              className="w-full bg-transparent border-b border-dotted border-black/80 p-1 font-normal leading-relaxed resize-none overflow-hidden focus:outline-none focus:bg-amber-50/20 text-justify"
              style={{ overflow: 'hidden', fontFamily: 'Arial, sans-serif', fontSize: '11pt', fontWeight: 400 }}
              placeholder="Evaluación clínica del paciente posterior a recibir tratamiento..."
            />
          </div>

          {/* SECTION 3: PARACLÍNICOS DE INGRESO (Compacto para mayor espacio clínico) */}
          <div className="section-block border border-black p-1 mb-1 bg-white" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>
            <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 font-black" style={{ fontSize: '9.5pt' }}>
              <span>PARACLÍNICOS DE INGRESO</span>
              <div className="flex items-center gap-1 font-normal" style={{ fontSize: '9pt' }}>
                <span>Fecha:</span>
                <input 
                  type="text" 
                  value={labFecha} 
                  onChange={e => setLabFecha(e.target.value)} 
                  className="font-bold border-b border-dotted border-black px-1 w-20 bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}
                  placeholder="DD/MM/AAAA"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-x-1.5 gap-y-0.5">
              {/* Row 1 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>GB:</span>
                <input type="text" value={labGB} onChange={e => setLabGB(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Hcto:</span>
                <input type="text" value={labHcto} onChange={e => setLabHcto(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Plt:</span>
                <input type="text" value={labPlt} onChange={e => setLabPlt(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Tipiaje:</span>
                <input type="text" value={labTipiaje} onChange={e => setLabTipiaje(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>

              {/* Row 2 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Neu:</span>
                <input type="text" value={labNeu} onChange={e => setLabNeu(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Seg:</span>
                <input type="text" value={labSeg} onChange={e => setLabSeg(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Lin:</span>
                <input type="text" value={labLin} onChange={e => setLabLin(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>VSG:</span>
                <input type="text" value={labVSG} onChange={e => setLabVSG(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>

              {/* Row 3 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Urea:</span>
                <input type="text" value={labUrea} onChange={e => setLabUrea(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Creat:</span>
                <input type="text" value={labCreatinina} onChange={e => setLabCreatinina(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Ac.Ur:</span>
                <input type="text" value={labAcUrico} onChange={e => setLabAcUrico(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Glicem:</span>
                <input type="text" value={labGlicemia} onChange={e => setLabGlicemia(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>

              {/* Row 4 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Prot.T:</span>
                <input type="text" value={labProtT} onChange={e => setLabProtT(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Alb:</span>
                <input type="text" value={labAlbumina} onChange={e => setLabAlbumina(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Glob:</span>
                <input type="text" value={labGlobulina} onChange={e => setLabGlobulina(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>PT Pac:</span>
                <input type="text" value={labPTPaciente} onChange={e => setLabPTPaciente(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>

              {/* Row 5 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>PT Ctl:</span>
                <input type="text" value={labPTControl} onChange={e => setLabPTControl(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Razón:</span>
                <input type="text" value={labRazon} onChange={e => setLabRazon(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>PTT Ctl:</span>
                <input type="text" value={labPTTControl} onChange={e => setLabPTTControl(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>PTT Pac:</span>
                <input type="text" value={labPTTPaciente} onChange={e => setLabPTTPaciente(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>

              {/* Row 6 */}
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>Dif:</span>
                <input type="text" value={labDiferencia} onChange={e => setLabDiferencia(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>VIH:</span>
                <input type="text" value={labVIH} onChange={e => setLabVIH(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-10 text-right shrink-0" style={{ fontSize: '8.5pt' }}>VDRL:</span>
                <input type="text" value={labVDRL} onChange={e => setLabVDRL(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-bold w-11 text-right shrink-0" style={{ fontSize: '8.5pt' }}>PCR:</span>
                <input type="text" value={labPCR} onChange={e => setLabPCR(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1.5 mt-1 items-center border-t border-black pt-0.5">
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '8.5pt' }}>CULTIVO:</span>
                <input type="text" value={labCultivo} onChange={e => setLabCultivo(e.target.value)} className="border-b border-dotted border-black flex-1 min-w-0 px-0.5 bg-transparent focus:outline-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} placeholder="Sin aislamientos..." />
              </div>
              <div className="col-span-4 flex items-center gap-1">
                <span className="font-bold" style={{ fontSize: '8.5pt' }}>OXÍGENO:</span>
                <input type="text" value={oxigenoFiO2} onChange={e => setOxigenoFiO2(e.target.value)} className="border-b border-dotted border-black w-12 px-0.5 bg-transparent focus:outline-none text-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} placeholder="FiO2" />
                <span className="font-bold" style={{ fontSize: '8pt' }}>DIAS:</span>
                <input type="text" value={oxigenoDias} onChange={e => setOxigenoDias(e.target.value)} className="border-b border-dotted border-black w-7 px-0.5 bg-transparent focus:outline-none text-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }} />
              </div>
              <div className="col-span-4 flex items-center gap-1.5 justify-end">
                <span className="font-bold" style={{ fontSize: '8pt' }}>TRANSFUSIONES:</span>
                <label className="flex items-center gap-0.5 cursor-pointer font-bold" style={{ fontSize: '8.5pt' }}>
                  <input type="checkbox" checked={transfusionSi} onChange={() => { setTransfusionSi(!transfusionSi); setTransfusionNo(transfusionSi); }} className="w-3 h-3 text-black rounded" /> SÍ
                </label>
                <label className="flex items-center gap-0.5 cursor-pointer font-bold" style={{ fontSize: '8.5pt' }}>
                  <input type="checkbox" checked={transfusionNo} onChange={() => { setTransfusionNo(!transfusionNo); setTransfusionSi(transfusionNo); }} className="w-3 h-3 text-black rounded" /> NO
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 4: DIAGNÓSTICOS DE EGRESO */}
          <div className="section-block mb-1.5" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold uppercase tracking-tight" style={{ fontSize: '11.5pt', fontFamily: 'Arial, sans-serif' }}>DIAGNÓSTICOS DE EGRESO:</span>
              <button
                type="button"
                onClick={handleOpenDxEgresoEditor}
                className="no-print px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 text-[9pt] font-bold flex items-center gap-1 cursor-pointer"
                title="Editar Diagnósticos de Egreso"
              >
                <Edit3 className="w-3 h-3" /> Dx
              </button>
            </div>
            <textarea
              ref={diagEgresoRef}
              data-dx-egreso="true"
              rows={1}
              value={diagnosticosEgreso}
              onChange={e => {
                setDiagnosticosEgreso(e.target.value);
                adjustTextareaHeight(e.target);
              }}
              className="no-print w-full bg-transparent border-b border-dotted border-black/80 p-0.5 font-normal leading-tight resize-none overflow-hidden focus:outline-none focus:bg-amber-50/20"
              style={{ overflow: 'hidden', fontFamily: 'Arial, sans-serif', fontSize: '11pt', fontWeight: 400 }}
              placeholder="1. Diagnóstico de egreso final..."
            />
            {/* Clean print view with bold status keywords */}
            <div
              className="hidden print:block border-b border-dotted border-black/80 p-0.5 font-normal leading-tight whitespace-pre-wrap"
              style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', fontWeight: 400 }}
            >
              {parseNumberedLines(diagnosticosEgreso).map((line, idx) => {
                const { base, status } = extractDiagnosisStatus(line);
                return (
                  <div key={idx}>
                    <span>{idx + 1}. {base}</span>
                    {status && (
                      <>
                        {' — '}
                        <strong className="font-bold">{status}</strong>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Quick expandable status dropdown per diagnosis (screen only) */}
            {parseNumberedLines(diagnosticosEgreso).length > 0 && (
              <div className="no-print mt-1.5 space-y-1">
                {parseNumberedLines(diagnosticosEgreso).map((line, idx) => {
                  const { base, status } = extractDiagnosisStatus(line);
                  const isOpen = openInlineDxStatusIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 text-[9.5pt] bg-amber-50/60 border border-amber-200/80 rounded-lg px-2 py-1"
                    >
                      <span className="truncate font-normal text-slate-900">
                        {idx + 1}. {base}{' '}
                        {status && <strong className="font-bold text-slate-950">— {status}</strong>}
                      </span>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          data-testid={`dx-egreso-status-btn-${idx}`}
                          onClick={() => setOpenInlineDxStatusIdx(isOpen ? null : idx)}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 border border-amber-400 text-amber-950 text-[8.5pt] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{status || 'Estado'}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div
                            data-testid={`dx-egreso-status-menu-${idx}`}
                            className="absolute right-0 top-full mt-1 z-30 w-36 rounded-lg border border-slate-300 bg-white shadow-lg py-1"
                          >
                            {DX_EGRESO_STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                data-testid={`dx-egreso-status-opt-${idx}-${opt}`}
                                onClick={() => handleSetInlineDxStatus(idx, opt)}
                                className={`w-full px-2.5 py-1.5 text-left text-[9pt] font-bold flex items-center justify-between cursor-pointer ${
                                  status === opt
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'text-slate-800 hover:bg-amber-50'
                                }`}
                              >
                                <span>{opt}</span>
                                {status === opt && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                            {status && (
                              <button
                                type="button"
                                onClick={() => handleSetInlineDxStatus(idx, '')}
                                className="w-full px-2.5 py-1 text-left text-[8.5pt] text-rose-600 hover:bg-rose-50 border-t border-slate-100 cursor-pointer"
                              >
                                Quitar estado
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 5: SE INDICA */}
          <div className="section-block mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold uppercase tracking-tight" style={{ fontSize: '11.5pt', fontFamily: 'Arial, sans-serif' }}>SE INDICA:</span>
              <button
                type="button"
                onClick={handleOpenIndicaEditor}
                className="no-print px-2 py-0.5 rounded bg-teal-100 hover:bg-teal-200 text-teal-900 border border-teal-400 text-[9pt] font-bold flex items-center gap-1 cursor-pointer"
                title="Editar Indicaciones y Tratamiento al Egreso"
              >
                <Edit3 className="w-3 h-3" /> Editar tto
              </button>
            </div>
            <textarea
              ref={seIndicaRef}
              rows={4}
              value={seIndica}
              onChange={e => {
                setSeIndica(e.target.value);
                adjustTextareaHeight(e.target);
              }}
              className="w-full bg-transparent border-b border-dotted border-black/80 p-1 font-normal leading-relaxed resize-none overflow-hidden focus:outline-none focus:bg-amber-50/20"
              style={{ overflow: 'hidden', fontFamily: 'Arial, sans-serif', fontSize: '11pt', fontWeight: 400 }}
              placeholder="Indicaciones médicas al alta..."
            />
          </div>

          {/* FOOTER: Signatures Block */}
          <div className="section-block mt-auto pt-4 border-t border-black">
            <div className="grid grid-cols-3 gap-6 text-center text-[10pt] font-black uppercase" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-black mb-1 min-h-[30px] flex items-end justify-center">
                  <span className="text-[11pt] font-bold">{patient.doctorInCharge || 'Dr. Brayan'}</span>
                </div>
                <p style={{ fontSize: '9pt' }}>MÉDICO RESIDENTE</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-black mb-1 min-h-[30px] flex items-end justify-center font-bold">
                  PEDIATRÍA
                </div>
                <p style={{ fontSize: '9pt' }}>JEFE DE SERVICIO</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-black mb-1 min-h-[30px] flex items-end justify-center font-bold">
                  H.M.I.C.S.H.C
                </div>
                <p style={{ fontSize: '9pt' }}>SELLO INSTITUCIONAL</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDITAR SE INDICA (Lista cómoda para agregar, editar o eliminar indicaciones) */}
      {showIndicaModal && (
        <div className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-sm z-[130] flex items-center justify-center p-3 sm:p-4">
          <div className={`${themeTokens.cardSurface} border rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-white`}>
            <div className={`px-4 py-3 border-b ${themeTokens.sectionDivider} flex items-center justify-between ${themeTokens.headerSurface}`}>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Editar Indicaciones (SE INDICA)</h3>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-400">Agregue tratamientos, edite textos o elimine ítems cómodamente.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndicaModal(false)}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {indicaItemsDraft.map((item, idx) => (
                <div key={idx} className={`${themeTokens.cardInnerSurface} border rounded-2xl p-2.5 flex items-start gap-2`}>
                  <span className="font-mono font-black text-xs text-teal-700 dark:text-teal-300 pt-2 min-w-[24px]">{idx + 1}.</span>
                  <AutoGrowModalTextarea
                    value={item}
                    onChange={val => {
                      const next = [...indicaItemsDraft];
                      next[idx] = val;
                      setIndicaItemsDraft(next);
                    }}
                    placeholder="Escriba la indicación médica o tratamiento..."
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed min-h-[62px]"
                  />
                  <button
                    type="button"
                    onClick={() => setIndicaItemsDraft(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/35 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 cursor-pointer shrink-0"
                    title="Eliminar indicación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setIndicaItemsDraft(prev => [...prev, ''])}
                className="w-full py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 border border-dashed border-teal-400 dark:border-teal-500/50 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Agregar Nueva Indicación / Tratamiento
              </button>
            </div>

            <div className={`px-4 py-3 border-t ${themeTokens.sectionDivider} flex items-center justify-between gap-2 ${themeTokens.headerSurface}`}>
              <button
                type="button"
                onClick={() => setIndicaItemsDraft(parseNumberedLines(defaultIndicaciones))}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Restaurar Sugeridas
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIndicaModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyIndicaModal}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Aplicar y Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PARACLÍNICOS DE INGRESO (Editor numérico rápido para móvil) */}
      {showLabsModal && (
        <div className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-sm z-[130] flex items-center justify-center p-3 sm:p-4">
          <div className={`${themeTokens.cardSurface} border rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-white`}>
            <div className={`px-4 py-3 border-b ${themeTokens.sectionDivider} flex items-center justify-between ${themeTokens.headerSurface}`}>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Paraclínicos de Ingreso</h3>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-400">Ingrese valores numéricos de laboratorio, oxígeno y transfusiones.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLabsModal(false)}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'fecha', label: 'Fecha Labs', numeric: false, placeholder: 'DD/MM/AAAA' },
                  { key: 'gb', label: 'GB (/mm³)', numeric: true, placeholder: '8500' },
                  { key: 'hcto', label: 'Hcto (%)', numeric: true, placeholder: '38.5' },
                  { key: 'plt', label: 'Plt (/mm³)', numeric: true, placeholder: '250000' },
                  { key: 'tipiaje', label: 'Tipiaje', numeric: false, placeholder: 'O+' },
                  { key: 'neu', label: 'Neu (%)', numeric: true, placeholder: '60' },
                  { key: 'seg', label: 'Seg (%)', numeric: true, placeholder: '55' },
                  { key: 'lin', label: 'Lin (%)', numeric: true, placeholder: '35' },
                  { key: 'vsg', label: 'VSG', numeric: true, placeholder: '12' },
                  { key: 'urea', label: 'Urea', numeric: true, placeholder: '24' },
                  { key: 'creatinina', label: 'Creatinina', numeric: true, placeholder: '0.6' },
                  { key: 'acUrico', label: 'Ác. Úrico', numeric: true, placeholder: '3.5' },
                  { key: 'glicemia', label: 'Glicemia', numeric: true, placeholder: '90' },
                  { key: 'protT', label: 'Prot. Totales', numeric: true, placeholder: '6.8' },
                  { key: 'albumina', label: 'Albúmina', numeric: true, placeholder: '4.0' },
                  { key: 'globulina', label: 'Globulina', numeric: true, placeholder: '2.8' },
                  { key: 'ptPaciente', label: 'PT Paciente', numeric: true, placeholder: '12.5' },
                  { key: 'ptControl', label: 'PT Control', numeric: true, placeholder: '12.0' },
                  { key: 'razon', label: 'Razón / INR', numeric: true, placeholder: '1.0' },
                  { key: 'pttControl', label: 'PTT Control', numeric: true, placeholder: '30' },
                  { key: 'pttPaciente', label: 'PTT Paciente', numeric: true, placeholder: '31' },
                  { key: 'diferencia', label: 'Diferencia', numeric: true, placeholder: '1' },
                  { key: 'vih', label: 'VIH', numeric: false, placeholder: 'No reactivo' },
                  { key: 'vdrl', label: 'VDRL', numeric: false, placeholder: 'No reactivo' },
                  { key: 'pcr', label: 'PCR', numeric: true, placeholder: '6' },
                ].map(f => (
                  <div key={f.key} className={`${themeTokens.cardInnerSurface} border rounded-xl p-2`}>
                    <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">{f.label}</label>
                    <input
                      type="text"
                      inputMode={f.numeric ? 'decimal' : 'text'}
                      value={(labsDraft as any)[f.key]}
                      onChange={e => setLabsDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t ${themeTokens.sectionDivider}`}>
                <div className={`${themeTokens.cardInnerSurface} border rounded-xl p-2.5`}>
                  <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">Cultivo</label>
                  <input
                    type="text"
                    value={labsDraft.cultivo}
                    onChange={e => setLabsDraft(prev => ({ ...prev, cultivo: e.target.value }))}
                    placeholder="Sin aislamientos..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold text-xs"
                  />
                </div>
                <div className={`${themeTokens.cardInnerSurface} border rounded-xl p-2.5 grid grid-cols-2 gap-2`}>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">Oxígeno FiO2</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={labsDraft.oxigenoFiO2}
                      onChange={e => setLabsDraft(prev => ({ ...prev, oxigenoFiO2: e.target.value }))}
                      placeholder="40%"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">Días O2</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={labsDraft.oxigenoDias}
                      onChange={e => setLabsDraft(prev => ({ ...prev, oxigenoDias: e.target.value.replace(/\D/g, '') }))}
                      placeholder="3"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-bold text-xs"
                    />
                  </div>
                </div>
                <div className={`${themeTokens.cardInnerSurface} border rounded-xl p-2.5`}>
                  <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">Transfusiones</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLabsDraft(prev => ({ ...prev, transfusionSi: true, transfusionNo: false }))}
                      className={`py-1.5 rounded-lg font-black border text-xs cursor-pointer ${
                        labsDraft.transfusionSi ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      SÍ
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabsDraft(prev => ({ ...prev, transfusionSi: false, transfusionNo: true }))}
                      className={`py-1.5 rounded-lg font-black border text-xs cursor-pointer ${
                        labsDraft.transfusionNo ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`px-4 py-3 border-t ${themeTokens.sectionDivider} flex items-center justify-end gap-2 ${themeTokens.headerSurface}`}>
              <button
                type="button"
                onClick={() => setShowLabsModal(false)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyLabsModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" /> Aplicar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR DIAGNÓSTICOS DE EGRESO */}
      {showDxEgresoModal && (
        <div className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-sm z-[130] flex items-center justify-center p-3 sm:p-4">
          <div className={`${themeTokens.cardSurface} border rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-white`}>
            <div className={`px-4 py-3 border-b ${themeTokens.sectionDivider} flex items-center justify-between ${themeTokens.headerSurface}`}>
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Diagnósticos de Egreso</h3>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-400">Actualice los diagnósticos definitivos al momento del alta médica.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDxEgresoModal(false)}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {dxEgresoItemsDraft.map((dx, idx) => {
                const { status } = extractDiagnosisStatus(dx);
                const isStatusMenuOpen = openModalDxStatusIdx === idx;
                return (
                  <div key={idx} className={`${themeTokens.cardInnerSurface} border rounded-2xl p-2.5 space-y-2`}>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300 pt-2 min-w-[24px]">{idx + 1}.</span>
                      <AutoGrowModalTextarea
                        value={dx}
                        onChange={val => {
                          const next = [...dxEgresoItemsDraft];
                          next[idx] = val;
                          setDxEgresoItemsDraft(next);
                        }}
                        placeholder="Escriba el diagnóstico de egreso..."
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed min-h-[62px]"
                      />
                      <button
                        type="button"
                        onClick={() => setDxEgresoItemsDraft(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/35 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 cursor-pointer shrink-0"
                        title="Eliminar diagnóstico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-end pl-7">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenModalDxStatusIdx(isStatusMenuOpen ? null : idx)}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-400/60 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Estado: {status || 'Seleccionar'}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isStatusMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 z-40 w-40 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
                            {DX_EGRESO_STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const next = [...dxEgresoItemsDraft];
                                  next[idx] = applyDiagnosisStatusToLine(next[idx], opt);
                                  setDxEgresoItemsDraft(next);
                                  setOpenModalDxStatusIdx(null);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                                  status === opt
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'text-slate-800 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>{opt}</span>
                                {status === opt && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                            {status && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...dxEgresoItemsDraft];
                                  next[idx] = applyDiagnosisStatusToLine(next[idx], '');
                                  setDxEgresoItemsDraft(next);
                                  setOpenModalDxStatusIdx(null);
                                }}
                                className="w-full px-3 py-1 text-left text-[11px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                              >
                                Quitar estado
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setDxEgresoItemsDraft(prev => [...prev, ''])}
                className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-dashed border-amber-400 dark:border-amber-500/50 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Agregar Diagnóstico de Egreso
              </button>
            </div>

            <div className={`px-4 py-3 border-t ${themeTokens.sectionDivider} flex items-center justify-end gap-2 ${themeTokens.headerSurface}`}>
              <button
                type="button"
                onClick={() => setShowDxEgresoModal(false)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyDxEgresoModal}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" /> Aplicar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
