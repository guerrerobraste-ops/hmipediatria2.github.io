import React, { useState, useMemo, useEffect } from 'react';
import { Patient, HistoriaClinicaPediatrica, MedicalEvolution } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import {
  Printer,
  Download,
  ArrowLeft,
  X,
  Sparkles,
  Loader2,
  Edit3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
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
import { getPediatricNormalPhysicalExam } from '../data/initialData';

function ensureMotivoIntegrated(generatedText: string, userMotivo: string): string {
  const cleanGenerated = (generatedText || '').trim();
  const cleanUser = (userMotivo || '').trim().replace(/\.+$/, '');
  if (!cleanUser) return cleanGenerated;
  const normGen = cleanGenerated.toLowerCase();
  const normUser = cleanUser.toLowerCase();
  if (normGen.includes(normUser)) {
    return cleanGenerated;
  }
  const base = cleanGenerated.replace(/\.+$/, '');
  return base
    ? `${base}. Motivo específico de referencia: ${cleanUser}.`
    : `Motivo específico de referencia: ${cleanUser}.`;
}

interface Props {
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  doctorName?: string;
  onClose: () => void;
}

export interface ReferenciaExamenFisico {
  general: string;
  pielFaneras: string;
  orlCuello: string;
  cardiopulmonarAbdomen: string;
  extremidades: string;
  neurologico: string;
}

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

function formatCurrentDateVe(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrentTimeVe12h(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const isPm = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${isPm ? 'p. m.' : 'a. m.'}`;
}

function formatHospitalStayShort(admissionDate: string, admissionTime?: string): string {
  const calc = calculateHospitalizationTime(admissionDate, admissionTime);
  const formattedAdm = admissionDate
    ? admissionDate.split('-').reverse().join('/')
    : '---';
  if (calc.days === 0) {
    return `${calc.remainingHours} horas (Ingreso: ${formattedAdm})`;
  }
  const dayStr = calc.days === 1 ? '1 día' : `${calc.days} días`;
  const hrStr = calc.remainingHours === 1 ? '1 hora' : `${calc.remainingHours} horas`;
  return `${dayStr}, ${hrStr} (Ingreso: ${formattedAdm})`;
}

function appendVitalUnit(raw: string | undefined, unit: string, pattern: RegExp): string {
  const val = (raw || '').trim();
  if (!val) return '---';
  if (pattern.test(val)) return val;
  return `${val}${unit.startsWith('%') ? '' : ' '}${unit}`;
}

function buildDiagnosesList(
  patient: Patient,
  latestEv: MedicalEvolution | null,
  historia?: HistoriaClinicaPediatrica
): string[] {
  const list: string[] = [];

  if (latestEv?.diagnosesModified && latestEv.diagnosesModified.trim()) {
    const lines = latestEv.diagnosesModified
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    lines.forEach((line, idx) => {
      const hasNumber = /^\d+(?:\.\d+)*[\.\)]?\s+/.test(line);
      list.push(hasNumber ? line : `${idx + 1}. ${line}`);
    });
    if (list.length > 0) return list;
  }

  if (patient.diagnoses && patient.diagnoses.length > 0) {
    patient.diagnoses.forEach((d, idx) => {
      const title = (d.title || '').trim();
      if (!title) return;
      const hasNumber = /^\d+(?:\.\d+)*[\.\)]?\s+/.test(title);
      list.push(hasNumber ? title : `${idx + 1}. ${title}`);
      if (d.subDiagnoses && d.subDiagnoses.length > 0) {
        d.subDiagnoses.forEach((sub, sIdx) => {
          const cleanSub = (sub || '').trim();
          if (!cleanSub) return;
          const subHasNum = /^\d+\.\d+/.test(cleanSub);
          list.push(subHasNum ? cleanSub : `${idx + 1}.${sIdx + 1}. ${cleanSub}`);
        });
      }
    });
    if (list.length > 0) return list;
  }

  if (historia?.diagnosticoAdmision && historia.diagnosticoAdmision.trim()) {
    historia.diagnosticoAdmision
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        const hasNumber = /^\d+(?:\.\d+)*[\.\)]?\s+/.test(line);
        list.push(hasNumber ? line : `${idx + 1}. ${line}`);
      });
    if (list.length > 0) return list;
  }

  return ['1. Paciente pediátrico en evaluación clínica intrahospitalaria.'];
}

function formatBedLabel(bedNumber?: string): string {
  const raw = (bedNumber || '').trim();
  if (!raw) return 'Cama ---';
  return /^cama\b/i.test(raw) ? raw : `Cama ${raw}`;
}

function joinExamSentences(parts: Array<string | undefined>): string {
  const cleaned = parts
    .map(p => (p || '').trim().replace(/\.+$/g, ''))
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  return `${cleaned.join('. ')}.`;
}

function buildDeterministicClinicalFallback(params: {
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  latestEv: MedicalEvolution | null;
  servicioReferido: string;
  motivoInput: string;
  diagnosesList: string[];
}) {
  const { patient, historia, latestEv, servicioReferido, motivoInput, diagnosesList } = params;
  const cleanArea = (servicioReferido || 'Especialidad Pediátrica').trim();
  const bedLabel = formatBedLabel(patient?.bedNumber);
  const safeAge = (patient?.age || 'edad pediátrica').trim();
  const safeGender = patient?.gender === 'F' ? 'F' : 'M';
  const genderLabel = safeGender === 'F' ? 'femenina' : 'masculino';
  const mainDxSummary = (diagnosesList || [])
    .slice(0, 3)
    .map(d => String(d || '').replace(/^\d+(?:\.\d+)*\.?\s*/, ''))
    .filter(Boolean)
    .join(', ');

  const rawTreatment = String(latestEv?.treatmentModified || patient?.treatment || 'Sintomático').trim();
  const cleanTreatmentInline = rawTreatment
    .split(/\r?\n/)
    .map(l =>
      l
        .replace(/^\d+\.?\s*/, '')
        .replace(/\|\s*Inicio:\s*\d{4}-\d{2}-\d{2}/gi, '')
        .replace(/\|\s*/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('; ');

  const motivoReferencia = motivoInput.trim()
    ? `Se solicita valoración especializada y conducta terapéutica conjunta por el servicio de ${cleanArea} para paciente pediátrico ${genderLabel} de ${safeAge} de edad, quien cursa con diagnóstico de ${mainDxSummary || 'patología en estudio'}, actualmente hospitalizado en el Servicio de Pediatría (${bedLabel}), cumpliendo esquema terapéutico con ${cleanTreatmentInline || 'tratamiento médico instaurado'}. Motivo específico de interconsulta: ${motivoInput.trim()}.`
    : `Se solicita valoración especializada y conducta terapéutica conjunta por el servicio de ${cleanArea} para paciente pediátrico ${genderLabel} de ${safeAge} de edad, quien cursa con cuadro clínico de ${mainDxSummary || 'patología pediátrica intrahospitalaria'}, actualmente hospitalizado en el Servicio de Pediatría (${bedLabel}), recibiendo tratamiento médico a base de ${cleanTreatmentInline || 'manejo sintomático y vigilancia clínica'}.`;

  const admissionDateVe = patient?.admissionDate
    ? patient.admissionDate.split('-').reverse().join('/')
    : 'su ingreso';
  const baseEnfermedad =
    historia?.enfermedadActual?.trim() ||
    historia?.resumenHistoriaEnfermedad?.trim() ||
    `Paciente pediátrico ${genderLabel} de ${safeAge} de edad, quien ingresó al servicio de hospitalización pediátrica en fecha ${admissionDateVe} por presentar cuadro clínico compatible con ${mainDxSummary || 'su diagnóstico de ingreso'}.`;

  const latestEvolNarrative =
    latestEv?.subjetivo || latestEv?.objetivo
      ? ` Durante su estancia hospitalaria ha recibido tratamiento con ${cleanTreatmentInline || 'manejo médico indicado'}. A la evaluación actual: ${[
          latestEv?.subjetivo ? `${latestEv.subjetivo.trim()}` : '',
          latestEv?.objetivo ? `${latestEv.objetivo.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' ')}`
      : ` Cumple tratamiento intrahospitalario con ${cleanTreatmentInline || 'manejo sintomático'}. Actualmente hemodinámicamente estable, bajo vigilancia clínica continua por el servicio de pediatría.`;

  const enfermedadActualEvolucion = `${baseEnfermedad}${latestEvolNarrative}`;

  let normalExam: ReturnType<typeof getPediatricNormalPhysicalExam> | null = null;
  try {
    normalExam = getPediatricNormalPhysicalExam(safeAge, safeGender);
  } catch {
    normalExam = null;
  }
  const evExam = latestEv?.examenFisico;

  const examenFisicoPertinente: ReferenciaExamenFisico = {
    general:
      latestEv?.objetivo?.trim() ||
      historia?.estadoGeneralFisico?.trim() ||
      'Regulares condiciones generales, afebril al momento de la evaluación, eupneico, hidratado, activo.',
    pielFaneras:
      evExam?.piel?.trim() ||
      historia?.pielPaniculoFanerasFisico?.trim() ||
      normalExam?.pielPaniculoFanerasFisico ||
      'Morena, normotérmica, turgor y elasticidad conservados, llenado capilar < 2 segundos.',
    orlCuello:
      joinExamSentences([
        evExam?.cabezaOjos || historia?.cabezaFisico,
        evExam?.oidosOtoscopia || historia?.oidosFisico,
        evExam?.narizOrofaringe || historia?.rinofaringeFisico,
        evExam?.cuello || historia?.cuelloFisico,
      ]) ||
      'Normocéfalo, pupilas isocóricas normorreactivas, conductos auditivos permeables, fosas nasales permeables, cuello móvil sin adenopatías.',
    cardiopulmonarAbdomen:
      joinExamSentences([
        evExam?.toraxCP || historia?.toraxPulmonesFisico,
        evExam?.cardiovascular || historia?.cardiovascularFisico,
        evExam?.abdomen || historia?.abdomenFisico,
      ]) ||
      'Tórax simétrico normoexpansible, murmullo vesicular audible en ambos campos pulmonares, ruidos cardíacos rítmicos sin soplos. Abdomen blando, depresible, no doloroso, ruidos hidroaéreos presentes.',
    extremidades:
      evExam?.extremidades?.trim() ||
      historia?.huesosArticulacionesMuslosFisico?.trim() ||
      normalExam?.huesosArticulacionesMuslosFisico ||
      'Simétricas, eutróficas, móviles, sin edemas ni lesiones activas.',
    neurologico:
      evExam?.neurologico?.trim() ||
      historia?.neurologicoPsiquicoFisico?.trim() ||
      normalExam?.neurologicoPsiquicoFisico ||
      'Consciente, activo, reactivo, orientado, fuerza muscular y reflejos osteotendinosos conservados.',
  };

  const planConductaSolicitada: string[] = [
    `Valoración clínica integral por el servicio de ${cleanArea}.`,
    motivoInput.trim()
      ? `Evaluación especializada respecto a: ${motivoInput.trim()}.`
      : `Considerar ajuste, optimización o recomendaciones sobre el esquema terapéutico actual.`,
    `Sugerencias diagnósticas, terapéuticas y seguimiento conjunto intrahospitalario / ambulatorio.`,
  ];

  return {
    motivoReferencia,
    enfermedadActualEvolucion,
    examenFisicoPertinente,
    planConductaSolicitada,
  };
}

const COMMON_REFERRAL_AREAS = [
  'Infectología Pediátrica',
  'Neumonología Pediátrica',
  'Cardiología Pediátrica',
  'Cirugía Pediátrica',
  'Nefrología Pediátrica',
  'Neurología Pediátrica',
  'Gastroenterología Pediátrica',
  'Hematología / Oncología',
  'Endocrinología Pediátrica',
  'Traumatología y Ortopedia',
  'Otorrinolaringología (ORL)',
  'Oftalmología Pediátrica',
  'Dermatología Pediátrica',
  'Terapia Intensiva (UTIP)',
  'Nutrición y Dietética',
];

export const ReferenciaMedicaDocument: React.FC<Props> = ({
  patient,
  historia,
  doctorName,
  onClose,
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const latestEv = useMemo(() => getLatestEvolution(patient), [patient]);

  // Step 1: Configuration modal ("ventana para escribir a qué área se desea referir y el motivo")
  const [showPromptModal, setShowPromptModal] = useState<boolean>(true);
  const [servicioReferido, setServicioReferido] = useState<string>('Infectología Pediátrica');
  const [motivoInput, setMotivoInput] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiStatusBadge, setAiStatusBadge] = useState<'idle' | 'ai_success' | 'fallback'>('idle');
  const [showInlineEditor, setShowInlineEditor] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const isPrintingPdf = false;

  const [fechaEmision, setFechaEmision] = useState<string>(() => formatCurrentDateVe());
  const [horaEmision, setHoraEmision] = useState<string>(() => formatCurrentTimeVe12h());

  const resolvedDoctorName = useMemo(() => {
    const raw =
      doctorName ||
      latestEv?.doctorName ||
      historia?.medicoServicioFirma ||
      historia?.medicoAdmisionFirma ||
      patient.doctorInCharge ||
      'Dr. Brayan Stiven Guerrero Silva';
    if (raw.toLowerCase().includes('brayan guerrero')) {
      return 'Dr. Brayan Stiven Guerrero Silva';
    }
    return raw;
  }, [doctorName, latestEv, historia, patient.doctorInCharge]);

  const [firmaMedicoNombre, setFirmaMedicoNombre] = useState<string>(resolvedDoctorName);

  const diagnosesList = useMemo(
    () => buildDiagnosesList(patient, latestEv, historia),
    [patient, latestEv, historia]
  );

  const estanciaHosp = useMemo(
    () => formatHospitalStayShort(patient.admissionDate, patient.admissionTime),
    [patient.admissionDate, patient.admissionTime]
  );

  const vitalsDisplay = useMemo(() => {
    const evVitals = latestEv?.vitalSigns;
    const fcRaw = evVitals?.fc || historia?.fc || '100';
    const frRaw = evVitals?.fr || historia?.fr || '24';
    const tempRaw = evVitals?.temp || historia?.temp || '36.8';
    const taRaw = evVitals?.ta || historia?.ta || '95/60';
    const satRaw =
      (evVitals?.hasOxygenSupport ? evVitals?.o2So2 || evVitals?.so2 : evVitals?.so2) ||
      historia?.so2 ||
      '98';
    const pesoRaw =
      evVitals?.peso ||
      (patient.weightKg ? `${patient.weightKg} kg` : historia?.peso ? `${historia.peso} kg` : '---');

    return {
      fc: appendVitalUnit(fcRaw, 'lpm', /lpm|bpm/i),
      fr: appendVitalUnit(frRaw, 'rpm', /rpm/i),
      temp: appendVitalUnit(tempRaw, '°C', /°c|\bc\b/i),
      ta: appendVitalUnit(taRaw, 'mmHg', /mmhg/i),
      satO2: appendVitalUnit(satRaw, '%', /%/),
      peso: pesoRaw.toLowerCase().includes('kg') ? pesoRaw : `${pesoRaw} kg`,
    };
  }, [latestEv, historia, patient.weightKg]);

  const initialFallback = useMemo(
    () =>
      buildDeterministicClinicalFallback({
        patient,
        historia,
        latestEv,
        servicioReferido,
        motivoInput,
        diagnosesList,
      }),
    [patient, historia, latestEv, servicioReferido, motivoInput, diagnosesList]
  );

  const [motivoReferenciaText, setMotivoReferenciaText] = useState<string>(
    initialFallback.motivoReferencia
  );
  const [enfermedadEvolucionText, setEnfermedadEvolucionText] = useState<string>(
    initialFallback.enfermedadActualEvolucion
  );
  const [examenFisico, setExamenFisico] = useState<ReferenciaExamenFisico>(
    initialFallback.examenFisicoPertinente
  );
  const [diagnosesEditableText, setDiagnosesEditableText] = useState<string>(
    diagnosesList.join('\n')
  );
  const [planSolicitadoText, setPlanSolicitadoText] = useState<string>(
    initialFallback.planConductaSolicitada.join('\n')
  );

  const handleGenerateReference = async () => {
    if (isGeneratingAi) return;
    const cleanTarget = servicioReferido.trim() || 'Especialidad Pediátrica';
    setServicioReferido(cleanTarget);
    setFechaEmision(formatCurrentDateVe());
    setHoraEmision(formatCurrentTimeVe12h());
    setDiagnosesEditableText(diagnosesList.join('\n'));
    setIsGeneratingAi(true);

    // Prepare deterministic clinical fallback first so the reference is always complete
    const fallbackData = buildDeterministicClinicalFallback({
      patient,
      historia,
      latestEv,
      servicioReferido: cleanTarget,
      motivoInput,
      diagnosesList,
    });

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      try {
        controller?.abort();
      } catch {
        // Ignore abort errors
      }
    }, 15000);

    try {
      const response = await fetch('/api/gemini/referencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          servicioReferido: cleanTarget,
          motivoUsuario: motivoInput.trim(),
          patientName: `${patient.lastName || ''}, ${patient.firstName || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Paciente Pediátrico',
          medicalHistoryNumber: patient.medicalHistoryNumber || '---',
          age: patient.age || '---',
          gender: patient.gender === 'F' ? 'Femenino' : 'Masculino',
          weightKg: vitalsDisplay.peso,
          admissionDate: patient.admissionDate || '---',
          bedNumber: patient.bedNumber || '---',
          area: patient.area || 'Hospitalización',
          estanciaHosp,
          vitalSigns: {
            fc: vitalsDisplay.fc,
            fr: vitalsDisplay.fr,
            temp: vitalsDisplay.temp,
            ta: vitalsDisplay.ta,
            so2: vitalsDisplay.satO2,
          },
          examenFisico: latestEv?.examenFisico || {},
          diagnoses: diagnosesList,
          treatment: latestEv?.treatmentModified || patient.treatment || 'Sintomático',
          latestSubjetivo: latestEv?.subjetivo || '',
          latestObjetivo: latestEv?.objetivo || '',
          enfermedadActual:
            historia?.enfermedadActual || historia?.resumenHistoriaEnfermedad || '',
          doctorName: firmaMedicoNombre,
        }),
      });

      let result: any = null;
      if (response.ok) {
        try {
          result = await response.json();
        } catch {
          result = null;
        }
      }

      if (result?.aiGenerated && result?.data) {
        const aiData = result.data;
        const resolvedMotivo = ensureMotivoIntegrated(
          aiData.motivoReferencia?.trim() || fallbackData.motivoReferencia,
          motivoInput
        );
        setMotivoReferenciaText(resolvedMotivo);
        setEnfermedadEvolucionText(
          aiData.enfermedadActualEvolucion?.trim() || fallbackData.enfermedadActualEvolucion
        );
        setExamenFisico({
          general:
            aiData.examenFisicoPertinente?.general?.trim() ||
            fallbackData.examenFisicoPertinente.general,
          pielFaneras:
            aiData.examenFisicoPertinente?.pielFaneras?.trim() ||
            fallbackData.examenFisicoPertinente.pielFaneras,
          orlCuello:
            aiData.examenFisicoPertinente?.orlCuello?.trim() ||
            fallbackData.examenFisicoPertinente.orlCuello,
          cardiopulmonarAbdomen:
            aiData.examenFisicoPertinente?.cardiopulmonarAbdomen?.trim() ||
            fallbackData.examenFisicoPertinente.cardiopulmonarAbdomen,
          extremidades:
            aiData.examenFisicoPertinente?.extremidades?.trim() ||
            fallbackData.examenFisicoPertinente.extremidades,
          neurologico:
            aiData.examenFisicoPertinente?.neurologico?.trim() ||
            fallbackData.examenFisicoPertinente.neurologico,
        });
        if (
          Array.isArray(aiData.planConductaSolicitada) &&
          aiData.planConductaSolicitada.length > 0
        ) {
          const planLines = [...aiData.planConductaSolicitada];
          const cleanMotivo = motivoInput.trim().replace(/\.+$/, '');
          if (
            cleanMotivo &&
            !planLines.some(line => String(line).toLowerCase().includes(cleanMotivo.toLowerCase()))
          ) {
            planLines.push(`Evaluación y conducta específica respecto a: ${cleanMotivo}.`);
          }
          setPlanSolicitadoText(planLines.join('\n'));
        } else {
          setPlanSolicitadoText(fallbackData.planConductaSolicitada.join('\n'));
        }
        setAiStatusBadge('ai_success');
      } else {
        setMotivoReferenciaText(ensureMotivoIntegrated(fallbackData.motivoReferencia, motivoInput));
        setEnfermedadEvolucionText(fallbackData.enfermedadActualEvolucion);
        setExamenFisico(fallbackData.examenFisicoPertinente);
        setPlanSolicitadoText(fallbackData.planConductaSolicitada.join('\n'));
        setAiStatusBadge('fallback');
      }
    } catch {
      setMotivoReferenciaText(ensureMotivoIntegrated(fallbackData.motivoReferencia, motivoInput));
      setEnfermedadEvolucionText(fallbackData.enfermedadActualEvolucion);
      setExamenFisico(fallbackData.examenFisicoPertinente);
      setPlanSolicitadoText(fallbackData.planConductaSolicitada.join('\n'));
      setAiStatusBadge('fallback');
    } finally {
      clearTimeout(timeoutId);
      setIsGeneratingAi(false);
      setShowPromptModal(false);
    }
  };

  useEffect(() => {
    return () => {
      document.body.classList.remove('hmi-printing-portal');
      const existingPortal = document.getElementById('hmi-direct-print-portal');
      if (existingPortal) existingPortal.remove();
    };
  }, []);

  const buildReferenciaPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const docEl = document.getElementById('referencia-medica-official-doc');
    if (!docEl) return null;

    const canvas = await html2canvas(docEl, {
      scale: 1.6,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElem) => {
        sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
        if (clonedElem) {
          clonedElem.style.border = 'none';
          clonedElem.style.boxShadow = 'none';
        }
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    addCanvasSinglePageWithMargin(pdf, canvas, { quality: 0.94 });

    const safeSpecialty = (servicioReferido || 'ESPECIALIDAD')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const safeLast = (patient.lastName || 'PACIENTE').toUpperCase().replace(/\s+/g, '_');
    const safeFirst = (patient.firstName || '').toUpperCase().replace(/\s+/g, '_');
    return {
      pdf,
      fileName: `Referencia_${safeSpecialty}_${safeFirst}_${safeLast}.pdf`,
    };
  };

  const handleDownloadPdf = async () => {
    if (isDownloading || isPrintingPdf) return;
    setIsDownloading(true);
    try {
      const built = await buildReferenciaPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (err) {
      console.error('Error al descargar PDF de Referencia Médica:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const docEl = document.getElementById('referencia-medica-official-doc');
    if (!docEl) return;
    const docTitle = formatPrintDocumentTitle(
      `Referencia Medica ${servicioReferido}`,
      `${patient.lastName} ${patient.firstName}`,
      { includeDateTime: true }
    );
    openInstantWhitePrintPage({
      sheets: [docEl],
      title: docTitle,
      fileName: `${docTitle}.pdf`,
      onDownloadPdf: handleDownloadPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const parsedDiagnosesForRender = useMemo(
    () =>
      diagnosesEditableText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean),
    [diagnosesEditableText]
  );

  const parsedPlanForRender = useMemo(
    () =>
      planSolicitadoText
        .split(/\r?\n/)
        .map(l => l.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean),
    [planSolicitadoText]
  );

  return (
    <div className="fixed inset-0 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md z-[165] overflow-y-auto flex flex-col items-center">
      {/* MODAL FLOTANTE PARA ESCRIBIR EL ÁREA A REFERIR Y EL MOTIVO */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-slate-900/75 dark:bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto no-print">
          <div
            className={`${themeTokens.cardSurface} border border-indigo-300 dark:border-indigo-500/40 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 dark:bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Referencia Médica para Especialidad
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Paciente: <strong>{patient.lastName}, {patient.firstName}</strong> · H.C: {patient.medicalHistoryNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                  ¿A qué Área o Servicio desea referir al paciente?
                </label>
                <input
                  type="text"
                  value={servicioReferido}
                  onChange={e => setServicioReferido(e.target.value)}
                  placeholder="Ej: Infectología Pediátrica, Cardiología Pediátrica, Cirugía..."
                  className="w-full bg-white dark:bg-slate-950 border-2 border-indigo-300 dark:border-indigo-500/50 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {COMMON_REFERRAL_AREAS.map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setServicioReferido(area)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        servicioReferido.toLowerCase() === area.toLowerCase()
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                  Motivo de la Referencia (se integrará directamente en el documento clínico)
                </label>
                <textarea
                  rows={3}
                  data-testid="referencia-motivo-input"
                  value={motivoInput}
                  onChange={e => setMotivoInput(e.target.value)}
                  placeholder="Ej: Valoración especializada, optimización de esquema antimicrobiano y seguimiento conjunto..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none resize-y leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="referencia-generar-btn"
                onClick={handleGenerateReference}
                disabled={isGeneratingAi || !servicioReferido.trim()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/30 transition-all cursor-pointer active:scale-95"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Desarrollando Referencia...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Desarrollar Referencia Automática</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DE ACCIONES */}
      <div
        className={`no-print sticky top-0 ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-30 shadow-sm dark:shadow-xl flex-wrap gap-2`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/50 shadow-xs hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Volver
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Referencia Médica para {servicioReferido}
              </h2>
              {aiStatusBadge === 'fallback' && (
                <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  Generada desde Historia Clínica
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
              {patient.lastName}, {patient.firstName} · H.C: {patient.medicalHistoryNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 font-black text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cambiar Área / Regenerar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInlineEditor(prev => !prev)}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">
              {showInlineEditor ? 'Ocultar Editor' : 'Editar Texto'}
            </span>
            {showInlineEditor ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/50 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PANEL DE EDICIÓN RÁPIDA OPCIONAL */}
      {showInlineEditor && (
        <div className="no-print w-full max-w-4xl px-3 sm:px-6 pt-4">
          <div
            className={`${themeTokens.cardSurface} border rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 text-xs`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Servicio Referido
                </label>
                <input
                  type="text"
                  value={servicioReferido}
                  onChange={e => setServicioReferido(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Fecha de Emisión
                </label>
                <input
                  type="text"
                  value={fechaEmision}
                  onChange={e => setFechaEmision(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Médico que Refiere
                </label>
                <input
                  type="text"
                  value={firmaMedicoNombre}
                  onChange={e => setFirmaMedicoNombre(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 mb-1">
                2. Motivo de Referencia
              </label>
              <textarea
                rows={3}
                value={motivoReferenciaText}
                onChange={e => setMotivoReferenciaText(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 mb-1">
                3. Enfermedad Actual y Evolución
              </label>
              <textarea
                rows={4}
                value={enfermedadEvolucionText}
                onChange={e => setEnfermedadEvolucionText(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 mb-1">
                  4. Diagnósticos Actuales (1 por línea)
                </label>
                <textarea
                  rows={4}
                  value={diagnosesEditableText}
                  onChange={e => setDiagnosesEditableText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 mb-1">
                  5. Plan y Conducta Solicitada (1 por línea)
                </label>
                <textarea
                  rows={4}
                  value={planSolicitadoText}
                  onChange={e => setPlanSolicitadoText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOJA OFICIAL DE REFERENCIA MÉDICA (IDÉNTICA AL PDF ADJUNTO) */}
      <div className="w-full px-2 sm:px-6 py-4 sm:py-6 overflow-x-auto flex justify-start md:justify-center">
        <div
          id="referencia-medica-official-doc"
          className="bg-white text-[#0f172a] shadow-2xl border border-[#cbd5e1] shrink-0 flex flex-col justify-between"
          style={{
            width: '215.9mm',
            minHeight: '279.4mm',
            padding: '13mm 16mm 14mm 16mm',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Arial, Helvetica, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div>
            {/* Membrete Institucional Centrado */}
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '8.5pt',
                  fontWeight: 700,
                  color: '#475569',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                REPÚBLICA BOLIVARIANA DE VENEZUELA
              </p>
              <p
                style={{
                  margin: '1px 0 0 0',
                  fontSize: '8.5pt',
                  fontWeight: 700,
                  color: '#475569',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                MINISTERIO DEL PODER POPULAR PARA LA SALUD
              </p>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  color: '#1e293b',
                  textTransform: 'uppercase',
                }}
              >
                HOSPITAL MATERNO INFANTIL COMANDANTE SUPREMO &ldquo;HUGO CHÁVEZ FRÍAS&rdquo;
              </p>
              <p
                style={{
                  margin: '1px 0 0 0',
                  fontSize: '8.8pt',
                  fontWeight: 700,
                  color: '#334155',
                  textTransform: 'uppercase',
                }}
              >
                SERVICIO DE PEDIATRÍA Y PUERICULTURA — HOSPITALIZACIÓN
              </p>

              <h1
                style={{
                  margin: '9px 0 0 0',
                  fontSize: '13.5pt',
                  fontWeight: 900,
                  color: '#1b365d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                REFERENCIA MEDICA PARA {(servicioReferido || 'ESPECIALIDAD').toUpperCase()}
              </h1>
            </div>

            {/* Tabla Superior de Emisión y Servicios */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '12px',
                fontSize: '9.2pt',
                backgroundColor: '#f1f5f9',
                border: '1px solid #94a3b8',
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      width: '50%',
                      padding: '5px 9px',
                      borderBottom: '1px solid #94a3b8',
                      borderRight: '1px solid #94a3b8',
                    }}
                  >
                    <strong style={{ color: '#0f172a' }}>Fecha de Emisión:</strong>{' '}
                    <span>{fechaEmision}</span>
                  </td>
                  <td
                    style={{
                      width: '50%',
                      padding: '5px 9px',
                      borderBottom: '1px solid #94a3b8',
                    }}
                  >
                    <strong style={{ color: '#0f172a' }}>Hora:</strong>{' '}
                    <span>{horaEmision}</span>
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: '5px 9px',
                      borderRight: '1px solid #94a3b8',
                    }}
                  >
                    <strong style={{ color: '#0f172a' }}>Servicio que Refiere:</strong>{' '}
                    <span>
                      Hospitalización Pediátrica ({formatBedLabel(patient.bedNumber)})
                    </span>
                  </td>
                  <td style={{ padding: '5px 9px' }}>
                    <strong style={{ color: '#0f172a' }}>Servicio Referido:</strong>{' '}
                    <span>{servicioReferido}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 1. IDENTIFICACIÓN DEL PACIENTE */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  backgroundColor: '#1b365d',
                  color: '#ffffff',
                  padding: '4px 9px',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                1. IDENTIFICACIÓN DEL PACIENTE
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '9.2pt',
                  border: '1px solid #94a3b8',
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        width: '44%',
                        padding: '5px 8px',
                        borderBottom: '1px solid #cbd5e1',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      <strong>Apellidos y Nombres:</strong> {patient.lastName},{' '}
                      {patient.firstName}
                    </td>
                    <td
                      style={{
                        width: '28%',
                        padding: '5px 8px',
                        borderBottom: '1px solid #cbd5e1',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      <strong>Historia Clínica N°:</strong>{' '}
                      {patient.medicalHistoryNumber || '---'}
                    </td>
                    <td
                      style={{
                        width: '28%',
                        padding: '5px 8px',
                        borderBottom: '1px solid #cbd5e1',
                      }}
                    >
                      <strong>Sexo:</strong>{' '}
                      {patient.gender === 'F' ? 'Femenino' : 'Masculino'}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: '5px 8px',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      <strong>Edad:</strong> {patient.age}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      <strong>Peso Actual:</strong> {vitalsDisplay.peso}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <strong>Estancia Hosp.:</strong> {estanciaHosp}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. MOTIVO DE REFERENCIA */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  backgroundColor: '#1b365d',
                  color: '#ffffff',
                  padding: '4px 9px',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  marginBottom: '6px',
                }}
              >
                2. MOTIVO DE REFERENCIA
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '9.3pt',
                  lineHeight: 1.45,
                  textAlign: 'justify',
                  color: '#0f172a',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {motivoReferenciaText}
              </p>
            </div>

            {/* 3. RESUMEN CLÍNICO Y EVOLUCIÓN */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  backgroundColor: '#1b365d',
                  color: '#ffffff',
                  padding: '4px 9px',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  marginBottom: '6px',
                }}
              >
                3. RESUMEN CLÍNICO Y EVOLUCIÓN
              </div>

              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '9.3pt',
                  lineHeight: 1.45,
                  textAlign: 'justify',
                  color: '#0f172a',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <strong>Enfermedad Actual y Evolución:</strong>{' '}
                {enfermedadEvolucionText}
              </p>

              {/* Tabla de Signos Vitales */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '8.8pt',
                  textAlign: 'center',
                  border: '1px solid #94a3b8',
                  marginBottom: '8px',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#cbd5e1', color: '#0f172a' }}>
                    <th
                      style={{
                        padding: '4px 6px',
                        fontWeight: 800,
                        borderRight: '1px solid #94a3b8',
                        width: '20%',
                      }}
                    >
                      FC
                    </th>
                    <th
                      style={{
                        padding: '4px 6px',
                        fontWeight: 800,
                        borderRight: '1px solid #94a3b8',
                        width: '20%',
                      }}
                    >
                      FR
                    </th>
                    <th
                      style={{
                        padding: '4px 6px',
                        fontWeight: 800,
                        borderRight: '1px solid #94a3b8',
                        width: '20%',
                      }}
                    >
                      Temperatura
                    </th>
                    <th
                      style={{
                        padding: '4px 6px',
                        fontWeight: 800,
                        borderRight: '1px solid #94a3b8',
                        width: '20%',
                      }}
                    >
                      TA
                    </th>
                    <th style={{ padding: '4px 6px', fontWeight: 800, width: '20%' }}>
                      SatO₂ (AA)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <td
                      style={{
                        padding: '4px 6px',
                        borderTop: '1px solid #94a3b8',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      {vitalsDisplay.fc}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        borderTop: '1px solid #94a3b8',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      {vitalsDisplay.fr}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        borderTop: '1px solid #94a3b8',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      {vitalsDisplay.temp}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        borderTop: '1px solid #94a3b8',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      {vitalsDisplay.ta}
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid #94a3b8' }}>
                      {vitalsDisplay.satO2}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Examen Físico Pertinente */}
              <div style={{ fontSize: '9pt', lineHeight: 1.4, color: '#0f172a' }}>
                <p style={{ margin: '0 0 3px 0', fontWeight: 800 }}>
                  Examen Físico Pertinente:
                </p>
                <div style={{ paddingLeft: '10px' }}>
                  <p style={{ margin: '0 0 2px 0' }}>
                    • <strong>General:</strong> {examenFisico.general}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    • <strong>Piel y Faneras:</strong> {examenFisico.pielFaneras}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    • <strong>ORL y Cuello:</strong> {examenFisico.orlCuello}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    • <strong>Cardiopulmonar y Abdomen:</strong>{' '}
                    {examenFisico.cardiopulmonarAbdomen}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    • <strong>Extremidades:</strong> {examenFisico.extremidades}
                  </p>
                  <p style={{ margin: 0 }}>
                    • <strong>Neurológico:</strong> {examenFisico.neurologico}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. DIAGNÓSTICOS ACTUALES */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  backgroundColor: '#1b365d',
                  color: '#ffffff',
                  padding: '4px 9px',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  marginBottom: '6px',
                }}
              >
                4. DIAGNÓSTICOS ACTUALES
              </div>
              <div
                style={{
                  fontSize: '9.2pt',
                  lineHeight: 1.4,
                  color: '#0f172a',
                  paddingLeft: '8px',
                }}
              >
                {parsedDiagnosesForRender.map((dx, idx) => (
                  <p key={idx} style={{ margin: '0 0 2px 0' }}>
                    {dx}
                  </p>
                ))}
              </div>
            </div>

            {/* 5. PLAN Y CONDUCTA SOLICITADA */}
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  backgroundColor: '#1b365d',
                  color: '#ffffff',
                  padding: '4px 9px',
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  marginBottom: '6px',
                }}
              >
                5. PLAN Y CONDUCTA SOLICITADA
              </div>
              <div
                style={{
                  fontSize: '9.2pt',
                  lineHeight: 1.4,
                  color: '#0f172a',
                  paddingLeft: '10px',
                }}
              >
                {parsedPlanForRender.map((item, idx) => (
                  <p key={idx} style={{ margin: '0 0 2px 0' }}>
                    • {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Firma Médica Centrada al Pie */}
          <div
            style={{
              paddingTop: '18px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                width: '300px',
                borderTop: '1px solid #1e293b',
                paddingTop: '5px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  color: '#0f172a',
                }}
              >
                {firmaMedicoNombre}
              </p>
              <p
                style={{
                  margin: '1px 0 0 0',
                  fontSize: '8.5pt',
                  color: '#334155',
                  fontWeight: 600,
                }}
              >
                Médico Residente de Pediatría y Puericultura
              </p>
              <p
                style={{
                  margin: '1px 0 0 0',
                  fontSize: '8pt',
                  color: '#475569',
                }}
              >
                Hospital Materno Infantil Comandante Supremo &ldquo;Hugo Chávez Frías&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
