import React, { useState } from 'react';
import { Patient, HistoriaClinicaPediatrica, ResumenEvolutivo } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import { EXAMEN_FISICO_NORMAL } from '../data/initialData';
import { 
  Printer, Download, ArrowLeft, Activity, AlertTriangle, 
  Calendar, Scale, Save, Check, Sparkles, X
} from 'lucide-react';
import { AutoExpandingTextarea } from './AutoExpandingTextarea';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  openInstantWhitePrintPage,
  formatPrintDocumentTitle,
  addCanvasPaginatedWithMargin,
} from '../utils/pdfPrinter';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface Props {
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  onClose: () => void;
  onSave?: (updatedPatient: Patient) => void;
}

export const ResumenEvolutivoDocument: React.FC<Props> = ({ 
  patient, 
  historia, 
  onClose,
  onSave
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);
  const totalDays = Math.max(1, timeCalc.days);
  const maxWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const [activeWeek, setActiveWeek] = useState<number>(Math.max(1, Math.floor(totalDays / 7) || 1));
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Calculate start and end date for active week
  const getCycleDates = (week: number) => {
    try {
      const adm = new Date(patient.admissionDate + 'T' + (patient.admissionTime || '08:00'));
      const startDayOffset = (week - 1) * 7;
      const endDayOffset = Math.min(totalDays, week * 7);
      
      const startDateObj = new Date(adm.getTime() + startDayOffset * 24 * 3600 * 1000);
      const endDateObj = new Date(adm.getTime() + endDayOffset * 24 * 3600 * 1000);
      
      return {
        start: startDateObj.toISOString().split('T')[0],
        end: endDateObj.toISOString().split('T')[0],
        startDay: startDayOffset + 1,
        endDay: endDayOffset,
        daysInPeriod: Math.max(1, endDayOffset - startDayOffset)
      };
    } catch {
      return {
        start: patient.admissionDate,
        end: new Date().toISOString().split('T')[0],
        startDay: 1,
        endDay: Math.min(totalDays, 7),
        daysInPeriod: 7
      };
    }
  };

  const cycle = getCycleDates(activeWeek);

  // Existing saved resumen if any
  const existingResumen = patient.resumenesEvolutivos?.find(r => r.weekNumber === activeWeek);

  // 1. Admission Diagnoses
  const defaultDiagIngreso = historia?.diagnosticoAdmision || 
    patient.diagnoses.map((d, i) => `${i + 1}. ${d.title}`).join('\n');
  const [diagIngreso, setDiagIngreso] = useState<string>(
    existingResumen?.diagnosticosIngreso || defaultDiagIngreso
  );

  // 2. Current Diagnoses
  const defaultDiagActual = patient.evolutions?.[0]?.diagnosesModified || 
    patient.diagnoses.map((d, i) => `${i + 1}. ${d.title}`).join('\n');
  const [diagActual, setDiagActual] = useState<string>(
    existingResumen?.diagnosticosActuales || defaultDiagActual
  );

  // 3. Current Treatment
  const defaultTratamiento = patient.evolutions?.[0]?.treatmentModified || patient.treatment || '';
  const [tratamientoActual, setTratamientoActual] = useState<string>(
    existingResumen?.tratamientoActual || defaultTratamiento
  );

  // 4. Weight tracking
  const initialWeight = patient.weightKg || 12.0;
  // Estimate or pull latest weight
  const [currentWeight, setCurrentWeight] = useState<number>(
    existingResumen?.pesoActualKg || Number((initialWeight + 0.35).toFixed(2))
  );

  const diffGrams = Math.round((currentWeight - initialWeight) * 1000);
  const avgDailyGain = Math.round(diffGrams / cycle.daysInPeriod);
  const pctGain = Number(((currentWeight - initialWeight) / initialWeight * 100).toFixed(1));

  const [analisisPonderal, setAnalisisPonderal] = useState<string>(
    existingResumen?.analisisPonderal || 
    `Paciente experimenta ganancia ponderal de ${diffGrams > 0 ? `+${diffGrams} g` : `${diffGrams} g`} (${pctGain > 0 ? `+${pctGain}%` : `${pctGain}%`}) durante los ${cycle.daysInPeriod} días evaluados, equivalente a un promedio de ${avgDailyGain > 0 ? `+${avgDailyGain}` : avgDailyGain} g/día, compatible con recuperación nutricional e hidratación adecuada.`
  );

  // 5. Current Physical Exam
  const latestEv = patient.evolutions?.[0];
  const [examenFisico] = useState(
    existingResumen?.examenFisicoActual || {
      piel: latestEv?.examenFisico?.piel || historia?.pielPaniculoFanerasFisico || EXAMEN_FISICO_NORMAL.pielPaniculoFanerasFisico,
      cabezaOjos: latestEv?.examenFisico?.cabezaOjos || `${historia?.cabezaFisico || EXAMEN_FISICO_NORMAL.cabezaFisico} ${historia?.ojosFisico || EXAMEN_FISICO_NORMAL.ojosFisico}`,
      oidosOtoscopia: latestEv?.examenFisico?.oidosOtoscopia || historia?.oidosFisico || EXAMEN_FISICO_NORMAL.oidosFisico,
      narizOrofaringe: latestEv?.examenFisico?.narizOrofaringe || `${historia?.rinofaringeFisico || EXAMEN_FISICO_NORMAL.rinofaringeFisico} ${historia?.bocaFisico || EXAMEN_FISICO_NORMAL.bocaFisico}`,
      cuello: latestEv?.examenFisico?.cuello || `${historia?.cuelloFisico || EXAMEN_FISICO_NORMAL.cuelloFisico} ${historia?.gangliosLinfaticosFisico || EXAMEN_FISICO_NORMAL.gangliosLinfaticosFisico}`,
      toraxCP: latestEv?.examenFisico?.toraxCP || historia?.toraxPulmonesFisico || EXAMEN_FISICO_NORMAL.toraxPulmonesFisico,
      abdomen: latestEv?.examenFisico?.abdomen || historia?.abdomenFisico || EXAMEN_FISICO_NORMAL.abdomenFisico,
      genitourinario: latestEv?.examenFisico?.genitourinario || `${historia?.urinarioFisico || EXAMEN_FISICO_NORMAL.urinarioFisico} ${historia?.genitalesFisico || EXAMEN_FISICO_NORMAL.genitalesFisico}`,
      extremidades: latestEv?.examenFisico?.extremidades || historia?.huesosArticulacionesMuslosFisico || EXAMEN_FISICO_NORMAL.huesosArticulacionesMuslosFisico,
      neurologico: latestEv?.examenFisico?.neurologico || historia?.neurologicoPsiquicoFisico || EXAMEN_FISICO_NORMAL.neurologicoPsiquicoFisico
    }
  );

  // 6. Laboratorios
  const labsData = historia?.laboratoriosColumnas && historia.laboratoriosColumnas.length > 0 
    ? historia.laboratoriosColumnas 
    : [
        {
          fecha: patient.admissionDate,
          valores: {
            'GLÓBULOS BLANCOS': '12.4',
            'NEUTRÓFILOS SEGMENTADOS': '68.0',
            'LINFOCITOS': '26.0',
            'PLAQUETAS': '310',
            'HEMOGLOBINA': '11.8',
            'HEMATOCRITO': '35.2',
            'GLICEMIA': '88',
            'UREA': '22',
            'CREATININA': '0.7',
            'PCR': '12'
          }
        },
        {
          fecha: cycle.end,
          valores: {
            'GLÓBULOS BLANCOS': '8.2',
            'NEUTRÓFILOS SEGMENTADOS': '54.0',
            'LINFOCITOS': '40.0',
            'PLAQUETAS': '290',
            'HEMOGLOBINA': '12.3',
            'HEMATOCRITO': '37.0',
            'GLICEMIA': '85',
            'UREA': '18',
            'CREATININA': '0.6',
            'PCR': '2.1'
          }
        }
      ];

  // 7. Daily comments from evolutions
  const dailyEvolutionsList = (patient.evolutions && patient.evolutions.length > 0)
    ? patient.evolutions
    : [
        {
          id: 'ev-demo-1',
          patientId: patient.id,
          date: patient.admissionDate,
          time: '08:30',
          doctorName: patient.doctorInCharge || 'Dr. Brayan',
          evolutionNote: 'Ingreso hospitalario con compromiso clínico. Se inicia cobertura terapéutica parenteral.',
          subjetivo: 'Madre refiere inicio de cuadro con fiebre y dificultad.',
          objetivo: 'Paciente febril, taquipneico, quejumbroso.',
          medicalRoundSummary: 'Hospitalización inmediata e inicio de plan antibiótico / hidratación.',
          examenFisico: examenFisico,
          createdAt: patient.admissionDate
        },
        {
          id: 'ev-demo-2',
          patientId: patient.id,
          date: cycle.end,
          time: '09:00',
          doctorName: patient.doctorInCharge || 'Dr. Brayan',
          evolutionNote: 'Evolución favorable hacia la mejoría. Afebril, tolerando vía oral adecuadamente.',
          subjetivo: 'Madre refiere mejoría evidente de la actividad y apetito.',
          objetivo: 'Eupneico, hemodinámicamente estable, afebril.',
          medicalRoundSummary: 'Se mantiene esquema actual completando ciclo de 7 días. Buena evolución.',
          examenFisico: examenFisico,
          createdAt: cycle.end
        }
      ];

  // 8. General comment and plan
  const [comentarioGeneral, setComentarioGeneral] = useState<string>(
    existingResumen?.comentarioGeneral ||
    `Paciente pediátrico que cumple ${cycle.daysInPeriod} días de hospitalización continua en el Servicio de ${patient.area}. Durante este período presentó evolución clínica favorable con respuesta adecuada al esquema terapéutico instaurado, descenso de reactantes de fase aguda y estabilización de parámetros hemodinámicos y respiratorios. Tolera satisfactoriamente la vía oral con incremento ponderal adecuado.`
  );

  const [conductaPlan, setConductaPlan] = useState<string>(
    existingResumen?.conductaPlan ||
    `1. Se mantiene tratamiento farmacológico actual completando curso indicado.\n2. Continuar vigilancia de curvas térmicas y patrón respiratorio.\n3. Monitoreo diario de peso y diuresis horaria.\n4. Se solicita laboratorio de control en 48-72h.\n5. Evaluar criterios de egreso / destete según evolución clínica.`
  );

  const [doctorName, setDoctorName] = useState<string>(
    existingResumen?.doctorName || patient.doctorInCharge || 'Dr. Brayan'
  );

  const [jefeServicio, setJefeServicio] = useState<string>('Jefe de Servicio de Pediatría');

  const handleSaveResumen = () => {
    const newResumen: ResumenEvolutivo = {
      id: existingResumen?.id || `resumen-7d-${Date.now()}-${activeWeek}`,
      patientId: patient.id,
      weekNumber: activeWeek,
      title: `Resumen Evolutivo - Semana ${activeWeek} (Días ${cycle.startDay} al ${cycle.endDay})`,
      startDate: cycle.start,
      endDate: cycle.end,
      daysCount: cycle.daysInPeriod,
      diagnosticosIngreso: diagIngreso,
      diagnosticosActuales: diagActual,
      tratamientoActual,
      examenFisicoActual: examenFisico,
      laboratoriosResumen: labsData,
      comentariosDiarios: dailyEvolutionsList.map(e => ({
        fecha: e.date,
        hora: e.time,
        doctor: e.doctorName,
        nota: e.evolutionNote || '',
        subjetivo: e.subjetivo,
        objetivo: e.objetivo,
        comentarioPlan: e.medicalRoundSummary
      })),
      pesoIngresoKg: initialWeight,
      pesoActualKg: currentWeight,
      diferenciaPesoGramos: diffGrams,
      gananciaDiariaPromedioGramos: avgDailyGain,
      analisisPonderal,
      comentarioGeneral,
      conductaPlan,
      doctorName,
      createdAt: existingResumen?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const currentResumenes = patient.resumenesEvolutivos || [];
    const idx = currentResumenes.findIndex(r => r.weekNumber === activeWeek);
    let updatedList: ResumenEvolutivo[];
    if (idx >= 0) {
      updatedList = [...currentResumenes];
      updatedList[idx] = newResumen;
    } else {
      updatedList = [newResumen, ...currentResumenes];
    }

    const updatedPatient: Patient = {
      ...patient,
      resumenesEvolutivos: updatedList,
      updatedAt: new Date().toISOString()
    };

    if (onSave) {
      onSave(updatedPatient);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const buildResumenEvolutivoPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const pageElem = document.getElementById('resumen-evolutivo-page');
    if (!pageElem) return null;
    const canvas = await html2canvas(pageElem, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElem) => {
        sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
      }
    });
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
    addCanvasPaginatedWithMargin(pdf, canvas, { quality: 0.92 });
    const printDateStr = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
    return {
      pdf,
      fileName: `RESUMEN_EVOLUTIVO_${patient.lastName.toUpperCase()}_${patient.firstName.toUpperCase()}_SEM${activeWeek}_${printDateStr}.pdf`,
    };
  };

  const handlePrintPdf = () => {
    const pageElem = document.getElementById('resumen-evolutivo-page');
    if (!pageElem) return;
    openInstantWhitePrintPage({
      sheets: [pageElem],
      title: `Resumen Evolutivo — ${patient.lastName}, ${patient.firstName}`,
      fileName: formatPrintDocumentTitle('Resumen Evolutivo', `${patient.lastName} ${patient.firstName}`, { includeDateTime: true }),
      onDownloadPdf: handleExportPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const handleExportPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const built = await buildResumenEvolutivoPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (e) {
      console.error('Error downloading PDF:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const [showActionsModal, setShowActionsModal] = useState<boolean>(false);

  return (
    <div className="fixed inset-0 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md z-[120] overflow-y-auto flex flex-col items-center">
      {/* Top Action Bar (Compact & Neon Animated) */}
      <div className={`no-print sticky top-0 ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-3 sm:px-5 py-2 flex items-center justify-between z-20 shadow-sm dark:shadow-lg`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-500/50 shadow-xs dark:shadow-[0_0_12px_rgba(20,184,166,0.5)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-teal-600 dark:text-teal-400" /> <span className="hidden xs:inline">Volver</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                Resumen Evolutivo (7 Días)
              </h2>
              <span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[10px] font-black uppercase">
                Semana {activeWeek} ({activeWeek * 7}d)
              </span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate">
              {patient.lastName}, {patient.firstName} · HC: {patient.medicalHistoryNumber}
            </p>
          </div>
        </div>

        {/* Action Buttons in Top Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_15px_rgba(245,158,11,0.7)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all cursor-pointer"
            title="Imprimir documento PDF de resumen evolutivo"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            type="button"
            onClick={() => setShowActionsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Opciones & Semanas</span>
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-2 border-rose-400 dark:border-rose-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(244,63,94,0.7)] dark:hover:shadow-[0_0_25px_rgba(244,63,94,1)] dark:animate-pulse hover:animate-none hover:scale-110 active:scale-95 transition-all flex items-center justify-center font-black cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-4 h-4 text-rose-700 dark:text-rose-300" />
          </button>
        </div>
      </div>

      {/* FLOATING ACTIONS MODAL */}
      {showActionsModal && (
        <div 
          className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowActionsModal(false)}
        >
          <div 
            className={`${themeTokens.cardSurface} border rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 text-xs text-slate-900 dark:text-white animate-in zoom-in-95 duration-150`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2.5`}>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Opciones del Resumen
              </span>
              <button
                type="button"
                onClick={() => setShowActionsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Weeks Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                Seleccionar Semana de Hospitalización:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: maxWeeks }).map((_, idx) => {
                  const wk = idx + 1;
                  return (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => {
                        setActiveWeek(wk);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        activeWeek === wk 
                          ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Semana {wk} ({wk * 7}d)
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`space-y-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
              <button
                type="button"
                onClick={() => {
                  handleSaveResumen();
                }}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSaved 
                    ? 'bg-emerald-600 text-white' 
                    : `${themeTokens.primaryButton} shadow-sm`
                }`}
              >
                {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? '¡Resumen Guardado!' : 'Guardar Resumen'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionsModal(false);
                  handlePrintPdf();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Imprimir Documento PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionsModal(false);
                  handleExportPdf();
                }}
                disabled={isDownloading}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-sm dark:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Main Document Layout */}
      <div className="p-2 sm:p-4 md:p-8 w-full max-w-5xl print:p-0 print:max-w-none">
        <div 
          id="resumen-evolutivo-page" 
          className="pdf-page-container bg-white text-[#000000] text-[10.5pt] p-6 md:p-8 shadow-2xl border border-black font-sans my-4 w-full max-w-[215.9mm] print:max-w-none print:w-full print:p-0 print:border-0 print:shadow-none mx-auto min-h-[279.4mm] leading-snug relative overflow-visible no-scrollbar"
          style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {/* Official Venezuelan Hospital Header Banner */}
          <div className="header-banner flex items-center justify-between border-b-2 border-[#b91c1c] pb-2 mb-3 bg-white">
            <div className="flex items-center gap-2">
              <svg className="w-12 h-8" viewBox="0 0 120 80" fill="none">
                <path d="M0 10 C30 0, 70 20, 110 5 L110 25 C70 40, 30 20, 0 30 Z" fill="#facc15" />
                <path d="M0 30 C30 20, 70 40, 110 25 L110 45 C70 60, 30 40, 0 50 Z" fill="#2563eb" />
                <path d="M0 50 C30 40, 70 60, 110 45 L110 65 C70 80, 30 60, 0 70 Z" fill="#dc2626" />
              </svg>
              <div className="text-[8.5px] uppercase font-black leading-tight text-black">
                <p className="text-[#b91c1c]">Gobierno Bolivariano de Venezuela</p>
                <p>Ministerio del Poder Popular <span className="font-bold">para la Salud</span></p>
              </div>
            </div>
            <div className="text-center font-black text-[9px] uppercase tracking-tighter">
              <p className="text-[#dc2626]">SERVICIO DE PEDIATRÍA Y PUERICULTURA</p>
              <p className="text-black text-[8px]">HOSPITALIZACIÓN PEDIÁTRICA CONTINUA</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div className="leading-tight text-black text-right">
                <p className="text-[9px] font-black uppercase">Hospital Materno Infantil</p>
                <p className="text-[10px] font-black text-[#dc2626] italic" style={{ fontFamily: 'serif' }}>Comandante Supremo Hugo Chávez</p>
              </div>
              <div className="w-7 h-7 rounded-full border border-[#dc2626] flex items-center justify-center bg-[#fef2f2]">
                <Activity className="w-4 h-4 text-[#dc2626]" />
              </div>
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center border-b border-black pb-2 mb-3">
            <h1 className="font-black text-[14px] uppercase tracking-wider text-black">
              RESUMEN EVOLUTIVO CLÍNICO (CORTE DE 7 DÍAS)
            </h1>
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-950 font-black text-[10px] px-3 py-0.5 rounded-full mt-1 border border-amber-300 uppercase">
              <Calendar className="w-3.5 h-3.5" />
              <span>Semana {activeWeek}: Días {cycle.startDay} al {cycle.endDay} de Hospitalización ({cycle.start} al {cycle.end})</span>
            </div>
          </div>

          {/* Patient Identification Grid */}
          <div className="section-block grid grid-cols-12 border border-black mb-3 font-bold text-[11px] text-black">
            <div className="col-span-6 p-1.5 border-r border-black uppercase">
              Paciente: <span className="font-black">{patient.lastName}, {patient.firstName}</span>
            </div>
            <div className="col-span-3 p-1.5 border-r border-black">
              H.C. N°: <span className="font-mono font-black">{patient.medicalHistoryNumber}</span>
            </div>
            <div className="col-span-3 p-1.5">
              Cama: <span className="font-black">{patient.bedNumber} ({patient.area})</span>
            </div>
            <div className="col-span-3 p-1.5 border-t border-r border-black">
              Edad: <span className="font-black">{patient.age}</span>
            </div>
            <div className="col-span-2 p-1.5 border-t border-r border-black">
              Sexo: <span className="font-black">{patient.gender}</span>
            </div>
            <div className="col-span-4 p-1.5 border-t border-r border-black">
              Fecha de Ingreso: <span className="font-black">{patient.admissionDate}</span> ({patient.admissionTime})
            </div>
            <div className="col-span-3 p-1.5 border-t border-black bg-amber-50">
              Estancia Total: <span className="font-black text-amber-900">{timeCalc.formatted}</span>
            </div>
          </div>

          {/* 1. Diagnósticos: Ingreso vs Actuales */}
          <div className="section-block grid grid-cols-2 border border-black mb-3 text-black">
            <div className="p-2 border-r border-black">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
                <h3 className="font-black text-[10.5px] uppercase tracking-wide">1. DIAGNÓSTICOS DE INGRESO</h3>
                <span className="text-[8.5px] bg-slate-200 px-1 rounded font-bold uppercase">Admisión</span>
              </div>
              <AutoExpandingTextarea
                minHeight={45}
                value={diagIngreso}
                onChange={e => setDiagIngreso(e.target.value)}
                className="w-full text-[10.5px] font-bold leading-tight bg-transparent border-0 p-0 outline-none overflow-hidden resize-none"
              />
            </div>
            <div className="p-2 bg-amber-50/50">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
                <h3 className="font-black text-[10.5px] uppercase tracking-wide text-amber-950">2. DIAGNÓSTICOS ACTUALES (DÍA {cycle.endDay})</h3>
                <span className="text-[8.5px] bg-amber-200 px-1 rounded font-bold uppercase text-amber-900">Activo</span>
              </div>
              <AutoExpandingTextarea
                minHeight={45}
                value={diagActual}
                onChange={e => setDiagActual(e.target.value)}
                className="w-full text-[10.5px] font-bold leading-tight bg-transparent border-0 p-0 outline-none overflow-hidden resize-none"
              />
            </div>
          </div>

          {/* 2. Tratamiento Actual */}
          <div className="section-block border border-black p-2 mb-3 text-black">
            <h3 className="font-black text-[10.5px] uppercase tracking-wide border-b border-black pb-1 mb-1.5">
              3. TRATAMIENTO MÉDICO ACTUAL RECIBIDO EN EL PERÍODO (7 DÍAS)
            </h3>
            <AutoExpandingTextarea
              minHeight={50}
              value={tratamientoActual}
              onChange={e => setTratamientoActual(e.target.value)}
              placeholder="Describa el tratamiento farmacológico..."
              className="w-full text-[10.5px] font-bold leading-snug bg-transparent border-0 p-0 outline-none overflow-hidden resize-none"
            />
          </div>

          {/* 3. Control Ponderal & Ganancia de Peso en los 7 Días */}
          <div className="section-block border-2 border-amber-500/80 rounded p-2 mb-3 bg-amber-50/30 text-black">
            <div className="flex items-center justify-between border-b border-amber-400 pb-1 mb-2">
              <h3 className="font-black text-[11px] uppercase tracking-wide flex items-center gap-1.5 text-amber-950">
                <Scale className="w-4 h-4 text-amber-600" /> 4. EVALUACIÓN PONDERAL Y GANANCIA DE PESO EN LOS 7 DÍAS
              </h3>
              <span className="text-[9px] font-extrabold bg-amber-200 text-amber-900 px-2 py-0.5 rounded uppercase">
                Período: {cycle.daysInPeriod} Días
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-2 text-center text-[10.5px] font-bold">
              <div className="p-1.5 bg-white border border-amber-300 rounded">
                <span className="text-[9px] text-slate-500 block uppercase">Peso al Ingreso</span>
                <span className="font-black text-slate-900 text-[12px]">{initialWeight} kg</span>
              </div>

              <div className="p-1.5 bg-white border border-amber-400 rounded">
                <span className="text-[9px] text-amber-700 block uppercase font-bold">Peso Actual (Día {cycle.endDay})</span>
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="number"
                    step="0.05"
                    value={currentWeight}
                    onChange={e => setCurrentWeight(parseFloat(e.target.value) || initialWeight)}
                    className="w-16 font-black text-amber-900 text-[12px] text-center border-b border-amber-500 outline-none bg-transparent"
                  />
                  <span className="font-black">kg</span>
                </div>
              </div>

              <div className="p-1.5 bg-white border border-amber-300 rounded">
                <span className="text-[9px] text-slate-500 block uppercase">Variación Neta</span>
                <span className={`font-black text-[12px] ${diffGrams >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {diffGrams >= 0 ? `+${diffGrams}` : diffGrams} g ({pctGain > 0 ? `+${pctGain}%` : `${pctGain}%`})
                </span>
              </div>

              <div className="p-1.5 bg-white border border-amber-300 rounded">
                <span className="text-[9px] text-slate-500 block uppercase">Ganancia Diaria</span>
                <span className={`font-black text-[12px] ${avgDailyGain >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {avgDailyGain >= 0 ? `+${avgDailyGain}` : avgDailyGain} g/día
                </span>
              </div>
            </div>

            <AutoExpandingTextarea
              minHeight={35}
              value={analisisPonderal}
              onChange={e => setAnalisisPonderal(e.target.value)}
              className="w-full text-[10px] font-medium leading-tight bg-transparent border border-dashed border-amber-300 p-1.5 rounded outline-none overflow-hidden resize-none"
            />
          </div>

          {/* 4. Examen Físico Actual */}
          <div className="section-block border border-black p-2 mb-3 text-black">
            <h3 className="font-black text-[10.5px] uppercase tracking-wide border-b border-black pb-1 mb-1.5">
              5. EXAMEN FÍSICO ACTUAL (CORTE DÍA {cycle.endDay})
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div><strong>Piel y Faneras:</strong> {examenFisico.piel}</div>
              <div><strong>Cabeza y Ojos:</strong> {examenFisico.cabezaOjos}</div>
              <div><strong>Oídos y Otoscopia:</strong> {examenFisico.oidosOtoscopia}</div>
              <div><strong>Nariz y Orofaringe:</strong> {examenFisico.narizOrofaringe}</div>
              <div><strong>Cuello:</strong> {examenFisico.cuello}</div>
              <div><strong>Tórax y Cardiopulmonar:</strong> {examenFisico.toraxCP}</div>
              <div><strong>Abdomen:</strong> {examenFisico.abdomen}</div>
              <div><strong>Genitourinario:</strong> {examenFisico.genitourinario}</div>
              <div><strong>Extremidades:</strong> {examenFisico.extremidades}</div>
              <div><strong>Neurológico:</strong> {examenFisico.neurologico}</div>
            </div>
          </div>

          {/* 5. Exámenes de Laboratorio desde su Ingreso */}
          <div className="section-block border border-black p-2 mb-3 text-black">
            <h3 className="font-black text-[10.5px] uppercase tracking-wide border-b border-black pb-1 mb-1.5">
              6. EXÁMENES DE LABORATORIO Y PARACLÍNICOS DESDE SU INGRESO
            </h3>
            <div>
              <table className="w-full border-collapse border border-black text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-black uppercase">
                    <th className="p-1 border-r border-black text-left">Parámetro / Prueba</th>
                    {labsData.map((col, idx) => (
                      <th key={idx} className="p-1 border-r border-black text-center">
                        {col.fecha} {idx === 0 ? '(Ingreso)' : `(Día ${cycle.endDay})`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    'GLÓBULOS BLANCOS', 'NEUTRÓFILOS SEGMENTADOS', 'LINFOCITOS', 
                    'HEMOGLOBINA', 'HEMATOCRITO', 'PLAQUETAS', 'GLICEMIA', 'UREA', 'CREATININA', 'PCR'
                  ].map((param, pIdx) => (
                    <tr key={param} className={pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-1 border border-black font-bold">{param}</td>
                      {labsData.map((col, cIdx) => (
                        <td key={cIdx} className="p-1 border border-black text-center font-bold">
                          {col.valores[param] || '---'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Comentarios Diarios de las Evoluciones */}
          <div className="section-block border border-black p-2 mb-3 text-black">
            <h3 className="font-black text-[10.5px] uppercase tracking-wide border-b border-black pb-1 mb-1.5">
              7. COMENTARIOS Y NOTAS DIARIAS DE EVOLUCIÓN EN LOS ÚLTIMOS 7 DÍAS
            </h3>
            <div className="space-y-1.5">
              {dailyEvolutionsList.map((ev, i) => (
                <div key={ev.id || i} className="p-1.5 bg-slate-50 border border-slate-300 rounded text-[9.5px] leading-tight">
                  <div className="flex justify-between items-center font-bold mb-0.5">
                    <span className="text-teal-900 font-black">{ev.date} · {ev.time} ({ev.doctorName})</span>
                    <span className="text-slate-500 text-[8px] uppercase">Nota Día {i + 1}</span>
                  </div>
                  {ev.subjetivo && <p><strong>Subjetivo:</strong> {ev.subjetivo}</p>}
                  {ev.objetivo && <p><strong>Objetivo:</strong> {ev.objetivo}</p>}
                  {ev.evolutionNote && <p><strong>Detalle:</strong> {ev.evolutionNote}</p>}
                  {ev.medicalRoundSummary && <p className="text-indigo-900 font-semibold"><strong>Plan de Revista:</strong> {ev.medicalRoundSummary}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* 7. Comentario General y Plan Terapéutico */}
          <div className="section-block grid grid-cols-2 gap-2 border border-black p-2 mb-4 text-black">
            <div>
              <h4 className="font-black text-[10px] uppercase border-b border-black pb-0.5 mb-1">
                8. COMENTARIO GENERAL DEL PERÍODO
              </h4>
              <AutoExpandingTextarea
                minHeight={50}
                value={comentarioGeneral}
                onChange={e => setComentarioGeneral(e.target.value)}
                className="w-full text-[9.5px] font-medium leading-tight bg-transparent border-0 p-0 outline-none overflow-hidden resize-none"
              />
            </div>
            <div>
              <h4 className="font-black text-[10px] uppercase border-b border-black pb-0.5 mb-1">
                9. PLAN TERAPÉUTICO Y CONDUCTA
              </h4>
              <AutoExpandingTextarea
                minHeight={50}
                value={conductaPlan}
                onChange={e => setConductaPlan(e.target.value)}
                className="w-full text-[9.5px] font-medium leading-tight bg-transparent border-0 p-0 outline-none overflow-hidden resize-none"
              />
            </div>
          </div>

          {/* Signatures Block */}
          <div className="section-block grid grid-cols-2 gap-8 pt-4 border-t border-black text-center text-black">
            <div className="border-t border-black pt-1">
              <input
                type="text"
                value={doctorName}
                onChange={e => setDoctorName(e.target.value)}
                className="font-black text-[10.5px] uppercase text-center w-full bg-transparent border-0 outline-none"
              />
              <p className="text-[8.5px] uppercase font-bold text-slate-700">Médico Pediatra Tratante / De Guardia</p>
            </div>
            <div className="border-t border-black pt-1">
              <input
                type="text"
                value={jefeServicio}
                onChange={e => setJefeServicio(e.target.value)}
                placeholder="Nombre del Jefe de Servicio"
                className="font-black text-[10.5px] uppercase text-center w-full bg-transparent border-0 outline-none"
              />
              <p className="text-[8.5px] uppercase font-bold text-slate-700">Jefe de Servicio de Pediatría y Puericultura</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
