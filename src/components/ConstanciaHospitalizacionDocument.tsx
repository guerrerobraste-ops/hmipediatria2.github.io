import React, { useState } from 'react';
import { Patient, HistoriaClinicaPediatrica } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import { Printer, Download, ArrowLeft, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  openInstantWhitePrintPage,
  formatPrintDocumentTitle,
  addCanvasSinglePageWithMargin,
} from '../utils/pdfPrinter';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface Props {
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  onClose: () => void;
}

export const ConstanciaHospitalizacionDocument: React.FC<Props> = ({ patient, historia, onClose }) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const printDate = new Date().toLocaleDateString('es-VE');
  const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const isPrintingPdf = false;

  const buildConstanciaPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const docElement = document.getElementById('constancia-doc');
    if (!docElement) return null;

    const canvas = await html2canvas(docElement, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElem) => {
        sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
      }
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
    addCanvasSinglePageWithMargin(pdf, canvas, { quality: 0.92 });

    const printDateStr = printDate.replace(/\//g, '-');
    return {
      pdf,
      fileName: `CONSTANCIA_HOSPITALIZACION_${patient.lastName.toUpperCase()}_${patient.firstName.toUpperCase()}_${printDateStr}.pdf`,
    };
  };

  const handleExportPdf = async () => {
    if (isDownloading || isPrintingPdf) return;
    setIsDownloading(true);
    try {
      const built = await buildConstanciaPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (e) {
      console.error('Error al generar PDF de constancia:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const docElement = document.getElementById('constancia-doc');
    if (!docElement) return;
    openInstantWhitePrintPage({
      sheets: [docElement],
      title: `Constancia de Hospitalización — ${patient.lastName}, ${patient.firstName}`,
      fileName: formatPrintDocumentTitle('Constancia', `${patient.lastName} ${patient.firstName}`, { includeDateTime: true }),
      onDownloadPdf: handleExportPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md z-[150] overflow-y-auto flex flex-col items-center">
      {/* Top Action Bar */}
      <div className={`no-print sticky top-0 ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-20 shadow-sm dark:shadow-xl flex-wrap gap-2`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-500/50 shadow-xs dark:shadow-[0_0_12px_rgba(20,184,166,0.5)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Volver
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Constancia de Hospitalización</h2>
              <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                Documento Oficial Pediátrico
              </span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
              {patient.lastName}, {patient.firstName} · H.C: {patient.medicalHistoryNumber} · Emisión: {printDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isDownloading}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500/20 text-white dark:text-indigo-300 border-2 border-indigo-500 dark:border-indigo-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(99,102,241,0.6)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.9)] hover:scale-105 transition-all font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-white dark:text-indigo-400" />
            <span>{isDownloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs dark:shadow-[0_0_15px_rgba(16,185,129,0.7)] dark:animate-pulse hover:animate-none hover:scale-105 transition-all cursor-pointer"
            title="Imprimir documento PDF oficial en papel tamaño Carta"
          >
            <Printer className="w-4 h-4 text-white dark:text-slate-950" />
            <span>Imprimir Constancia</span>
          </button>

          {/* Botón X animado en neón */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-2 border-rose-400 dark:border-rose-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(244,63,94,0.7)] dark:hover:shadow-[0_0_25px_rgba(244,63,94,1)] hover:rotate-90 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer ml-1"
            title="Cerrar documento"
          >
            <X className="w-5 h-5 text-rose-700 dark:text-rose-300" />
          </button>
        </div>
      </div>

      {/* Main Document View */}
      <div className="p-2 sm:p-6 md:p-8 w-full max-w-4xl flex justify-center">
        <div 
          id="constancia-doc"
          className="bg-white text-black p-6 sm:p-10 w-[215.9mm] min-h-[279.4mm] shadow-2xl border border-black font-sans leading-relaxed my-2 relative"
          style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12pt' }}
        >
          {/* Header Banner - Idéntico a las evoluciones médicas */}
          <div className="header-banner flex items-center justify-between border-b-2 border-[#b91c1c] pb-2 mb-4 bg-white">
            <div className="flex items-center gap-3">
              <svg className="w-14 h-10 shrink-0 drop-shadow-xs" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 2 8 C 35 -2, 85 22, 118 6 L 118 28 C 85 44, 35 20, 2 30 Z" fill="#FACC15" />
                <path d="M 2 30 C 35 20, 85 44, 118 28 L 118 50 C 85 66, 35 42, 2 52 Z" fill="#0033A0" />
                <path d="M 2 52 C 35 42, 85 66, 118 50 L 118 72 C 85 88, 35 64, 2 74 Z" fill="#DC2626" />
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
              <div className="text-[9px] uppercase font-black leading-tight text-black">
                <p className="text-[#b91c1c]">Gobierno Bolivariano de Venezuela</p>
                <p>Ministerio del Poder Popular <span className="font-bold">para la Salud</span></p>
              </div>
            </div>
            <div className="text-center font-black text-[10px] uppercase tracking-tighter">
              <p className="text-[#dc2626]">PEDIATRÍA Y PUERICULTURA</p>
              <p className="text-[8px] text-slate-700 font-bold">HOSPITAL MATERNO INFANTIL</p>
            </div>
            <div className="text-right flex items-center justify-end">
              <img 
                src="/assets/aistudio/image_aff5875d.png" 
                alt="Logo Hospital Materno Infantil" 
                className="h-10 sm:h-12 max-h-12 w-auto object-contain shrink-0" 
              />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="font-black text-[16pt] uppercase tracking-wider text-black border-b-2 border-black inline-block pb-1">
              CONSTANCIA DE HOSPITALIZACIÓN
            </h1>
            <p className="text-[9pt] font-mono text-slate-600 font-bold mt-1">
              DOCUMENTO MÉDICO INSTITUCIONAL · EMISIÓN: {printDate}
            </p>
          </div>

          <p className="mb-6 text-[11pt] text-justify leading-relaxed">
            Quien suscribe, Médico Residente / Especialista adscrito al <strong>Servicio de Pediatría y Puericultura</strong> del Hospital Materno Infantil, 
            hace constar por medio de la presente que el paciente pediátrico cuyos datos se detallan a continuación se encuentra formalmente{' '}
            {patient.isReingreso ? (
              <strong>reingresado (Reingreso Clínico)</strong>
            ) : (
              <strong>ingresado</strong>
            )}{' '}
            en el área de hospitalización de esta entidad nosocomial:
          </p>

          {/* Tabla de Ficha e Identificación del Paciente */}
          <div className="border-2 border-black p-4 mb-6 rounded-lg bg-slate-50 space-y-2 text-[11pt]">
            <div className="grid grid-cols-12 gap-2 border-b border-slate-300 pb-2">
              <div className="col-span-8">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Nombres y Apellidos del Paciente:</span>
                <strong className="text-[12pt] text-black">{patient.lastName.toUpperCase()}, {patient.firstName.toUpperCase()}</strong>
              </div>
              <div className="col-span-4 border-l border-slate-300 pl-3">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Cédula / Historia Clínica:</span>
                <strong className="font-mono text-[12pt] text-black">{patient.medicalHistoryNumber}</strong>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 border-b border-slate-300 pb-2">
              <div className="col-span-3">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Edad:</span>
                <strong className="text-black">{patient.age}</strong>
              </div>
              <div className="col-span-2 border-l border-slate-300 pl-2">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Sexo:</span>
                <strong className="text-black">{patient.gender === 'M' ? 'Masculino' : 'Femenino'}</strong>
              </div>
              <div className="col-span-3 border-l border-slate-300 pl-2">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Peso de {patient.isReingreso ? 'Reingreso' : 'Ingreso'}:</span>
                <strong className="text-black">{patient.weightKg} kg</strong>
              </div>
              <div className="col-span-4 border-l border-slate-300 pl-2">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Estancia Hospitalaria:</span>
                <strong className="text-teal-800">{timeCalc.formatted}</strong>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 pt-1">
              <div className="col-span-6">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">
                  {patient.isReingreso ? 'Fecha y Hora de Reingreso:' : 'Fecha y Hora de Admisión:'}
                </span>
                <strong className="text-black">{patient.admissionDate} — {patient.admissionTime || '08:00'} hrs</strong>
              </div>
              <div className="col-span-6 border-l border-slate-300 pl-3">
                <span className="font-black uppercase text-slate-600 text-[9pt] block">Servicio / Ubicación Actual:</span>
                <strong className="text-black">{patient.area} · Cama Nº {patient.bedNumber}</strong>
              </div>
            </div>
          </div>

          <p className="mb-6 text-[11pt] text-justify leading-relaxed">
            El paciente antes mencionado permanece ingresado en nuestro servicio recibiendo evaluación médica diaria, monitoreo hemodinámico continuo, 
            estudios paraclínicos correspondientes y esquema terapéutico de acuerdo a las pautas del protocolo institucional.
          </p>

          {/* Sección Diagnósticos */}
          <div className="mb-6 border border-black p-3 rounded-md bg-white">
            <h3 className="font-black text-[11pt] uppercase border-b-2 border-black pb-1 mb-2 text-black flex items-center justify-between">
              <span>DIAGNÓSTICOS DE INGRESO Y EVOLUCIÓN CLÍNICA</span>
            </h3>
            <ul className="list-disc pl-6 space-y-1 text-[10.5pt] font-bold text-black">
              {patient.diagnoses && patient.diagnoses.length > 0 ? (
                patient.diagnoses.map((d, i) => (
                  <li key={i}>{d.title}</li>
                ))
              ) : (
                <li>En estudio evolutivo por el servicio de pediatría.</li>
              )}
            </ul>
          </div>

          {/* Sección Tratamiento Intrahospitalario */}
          <div className="mb-6 border border-black p-3 rounded-md bg-white">
            <h3 className="font-black text-[11pt] uppercase border-b-2 border-black pb-1 mb-2 text-black">
              TRATAMIENTO Y CONDUCTA INTRAHOSPITALARIA
            </h3>
            <p className="text-[10.5pt] font-medium whitespace-pre-wrap leading-relaxed text-black">
              {patient.treatment || 'Esquema farmacológico de soporte, terapia endovenosa y seguimiento médico continuo.'}
            </p>
          </div>

          <p className="mb-12 text-[11pt] text-justify leading-relaxed">
            Se expide la presente constancia a solicitud de los familiares / representantes legales del paciente para los fines administrativos, 
            laborales, escolares o institucionales que consideren pertinentes.
          </p>

          {/* Firma Médica Oficial */}
          <div className="mt-12 pt-6 flex justify-center">
            <div className="text-center w-72 border-t-2 border-black pt-2 text-black">
              <p className="font-black text-[11pt] uppercase tracking-wide">Dr. {patient.doctorInCharge || 'Brayan Guerrero'}</p>
              <p className="font-bold text-[9.5pt] uppercase text-slate-700">Médico Residente / Especialista de Guardia</p>
              <p className="text-[8.5pt] text-slate-500 font-mono mt-0.5">Servicio de Pediatría y Puericultura</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
