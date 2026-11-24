import React, { useState, useEffect, useRef } from 'react';
import { Patient, MedicalEvolution } from '../types';
import { Printer, X, FileText, Download, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { calculateHospitalizationTime } from '../services/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import {
  openInstantWhitePrintPage,
  cleanupPdfPrintResources,
  formatPrintDocumentTitle,
  DEFAULT_PDF_DOWNLOAD_MARGIN_MM,
} from '../utils/pdfPrinter';
import { getPediatricNormalPhysicalExam } from '../data/initialData';

interface Props {
  patient: Patient;
  evolution: MedicalEvolution;
  autoDownload?: boolean;
  onClose: () => void;
}

export const parseDxHierarchy = (text: string) => {
  if (!text) return [];
  const lines = text.split('\n');
  const items: { text: string; level: 0 | 1 | 2 }[] = [];
  lines.forEach(raw => {
    if (!raw.trim()) return;
    const trimmed = raw.trim();
    const leadingSpaces = raw.search(/\S/);
    if (leadingSpaces >= 4 || /^\d+\.\d+\.\d+/.test(trimmed)) {
      items.push({ text: trimmed, level: 2 });
    } else if (leadingSpaces >= 2 || /^\d+\.\d+/.test(trimmed)) {
      items.push({ text: trimmed, level: 1 });
    } else {
      items.push({ text: trimmed, level: 0 });
    }
  });
  return items;
};

export const parseTxHierarchy = (text: string) => {
  if (!text) return [];
  const lines = text.split('\n');
  const items: { text: string; isChild: boolean }[] = [];
  lines.forEach(raw => {
    if (!raw.trim()) return;
    const trimmed = raw.trim();
    const leadingSpaces = raw.search(/\S/);
    const isChild = leadingSpaces >= 2 || /^[└•\-*]\s/.test(trimmed);
    items.push({
      text: trimmed.replace(/^[└├─•*]+\s*/, ''),
      isChild,
    });
  });
  return items;
};

export const EvolutionSheetContent: React.FC<{
  patient: Patient;
  evolution: MedicalEvolution;
}> = ({ patient, evolution }) => {
  const dxHierarchy = parseDxHierarchy(evolution.diagnosesModified || '');
  const txHierarchy = parseTxHierarchy(evolution.treatmentModified || '');
  const timeCalc = calculateHospitalizationTime(patient.admissionDate, patient.admissionTime);

  return (
    <>
      {/* Header Banner Oficial */}
      <div className="pdf-avoid-break header-banner flex items-center justify-between border-b-2 border-[#b91c1c] pb-2 mb-3 bg-white text-black">
        <div className="flex items-center gap-3">
          <svg
            className="w-14 h-10 shrink-0"
            viewBox="0 0 120 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
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
            <p>
              Ministerio del Poder Popular <span className="font-bold">para la Salud</span>
            </p>
          </div>
        </div>
        <div className="text-center font-black text-[10px] uppercase tracking-tighter">
          <p className="text-[#dc2626]">PEDIATRÍA Y PUERICULTURA</p>
          <p className="text-[8px] text-slate-700 font-bold">HOSPITAL MATERNO INFANTIL</p>
          <h1 className="text-xs font-black uppercase tracking-widest mt-0.5 underline decoration-2 underline-offset-2 text-black">
            HOJA DE EVOLUCIÓN MÉDICA PEDIÁTRICA
          </h1>
        </div>
        <div className="text-right flex items-center justify-end">
          <img
            src="/assets/aistudio/image_aff5875d.png"
            alt="Logo Hospital Materno Infantil"
            className="h-10 sm:h-12 max-h-12 w-auto object-contain shrink-0"
          />
        </div>
      </div>

      {/* Patient Identification Header Bar */}
      <div className="pdf-avoid-break grid grid-cols-12 border-2 border-black text-[10px] mb-3 bg-slate-50 text-black">
        <div className="col-span-5 p-2 border-r border-b border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">
            APELLIDOS Y NOMBRES DEL PACIENTE:
          </span>
          <span className="font-bold uppercase text-xs">
            {patient.lastName}, {patient.firstName}
          </span>
        </div>
        <div className="col-span-2 p-2 border-r border-b border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">EDAD:</span>
          <span className="font-bold">{patient.age}</span>
        </div>
        <div className="col-span-2 p-2 border-r border-b border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">SEXO:</span>
          <span className="font-bold">{patient.gender}</span>
        </div>
        <div className="col-span-3 p-2 border-b border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">
            N° HISTORIA / CAMA:
          </span>
          <span className="font-bold font-mono">
            {patient.medicalHistoryNumber} / {patient.bedNumber}
          </span>
        </div>
        <div className="col-span-3 p-2 border-r border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">
            FECHA DE INGRESO:
          </span>
          <span className="font-bold font-mono">{patient.admissionDate}</span>
        </div>
        <div className="col-span-3 p-2 border-r border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">
            SERVICIO / ÁREA:
          </span>
          <span className="font-bold uppercase">{patient.area}</span>
        </div>
        <div className="col-span-2 p-2 border-r border-black">
          <span className="font-black block text-[8px] uppercase text-slate-600">PESO:</span>
          <span className="font-bold">
            {evolution.vitalSigns?.peso || `${patient.weightKg} kg`}
          </span>
        </div>
        <div className="col-span-4 p-2">
          <span className="font-black block text-[8px] uppercase text-slate-600">
            FECHA / HORA EVOLUCIÓN:
          </span>
          <span className="font-bold font-mono">
            {evolution.date} — {evolution.time}
          </span>
        </div>
      </div>

      {/* Días de Hospitalización */}
      <div className="pdf-avoid-break mb-2.5 border border-black p-2 bg-slate-100/70 flex items-center justify-between text-black">
        <span className="text-[10px] font-black uppercase tracking-wider">
          DÍAS DE HOSPITALIZACIÓN:
        </span>
        <span className="text-xs font-extrabold uppercase font-mono">{timeCalc.formatted}</span>
      </div>

      {/* Diagnósticos y Tratamiento en paralelo */}
      <div className="section-block grid grid-cols-12 border border-black mb-2.5 text-black">
        <div className="col-span-6 p-2.5 border-r border-black">
          <h3 className="pdf-avoid-break font-black text-[10.5px] uppercase mb-1.5 border-b border-black pb-1">
            DIAGNÓSTICOS ACTUALES:
          </h3>
          <div className="space-y-1 text-[10.5px] leading-snug">
            {dxHierarchy.length > 0 ? (
              dxHierarchy.map((item, i) => (
                <div
                  key={i}
                  className={`pdf-avoid-break ${
                    item.level === 0
                      ? 'font-black text-black mt-1'
                      : item.level === 1
                      ? 'pl-4 font-bold text-slate-900 flex items-start gap-1'
                      : 'pl-8 font-medium text-slate-800 italic flex items-start gap-1'
                  }`}
                >
                  {item.level === 1 && <span className="text-slate-600">├</span>}
                  {item.level === 2 && <span className="text-slate-500">└</span>}
                  <span>{item.text}</span>
                </div>
              ))
            ) : (
              <p className="pdf-avoid-break font-semibold whitespace-pre-wrap">
                {evolution.diagnosesModified || patient.diagnoses.map(d => d.title).join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="col-span-6 p-2.5">
          <h3 className="pdf-avoid-break font-black text-[10.5px] uppercase mb-1.5 border-b border-black pb-1">
            ÓRDENES MÉDICAS / TRATAMIENTO:
          </h3>
          <div className="space-y-1 text-[10.5px] leading-snug">
            {(() => {
              const rawTx = (evolution.treatmentModified || patient.treatment || '').trim();
              const isEmptyOrSintomatico =
                !rawTx ||
                rawTx
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/^\d+\.\s*/, '')
                  .replace(/\.+$/, '')
                  .trim() === 'sintomatico';

              if (isEmptyOrSintomatico) {
                return (
                  <p className="pdf-avoid-break font-bold text-black">
                    Sintomático
                  </p>
                );
              }

              if (txHierarchy.length > 0) {
                return txHierarchy.map((item, i) => {
                  const isCulminado = /TRATAMIENTO CULMINADO/i.test(item.text);
                  return (
                    <div
                      key={i}
                      className={`pdf-avoid-break ${
                        isCulminado
                          ? 'font-semibold text-slate-700 mt-1 flex items-start gap-1.5 bg-slate-100/90 py-0.5 px-1.5 rounded border-l-2 border-slate-500'
                          : !item.isChild
                          ? 'font-black text-black mt-1 flex items-start gap-1.5'
                          : 'pl-5 font-semibold text-slate-800 flex items-start gap-1.5 bg-slate-50/80 py-0.5 px-1.5 rounded border-l-2 border-black'
                      }`}
                    >
                      {!item.isChild ? (
                        <span className="text-black font-black">{isCulminado ? '✓' : '•'}</span>
                      ) : (
                        <span className="text-slate-600 font-bold">↳</span>
                      )}
                      <span>{item.text}</span>
                    </div>
                  );
                });
              }

              return (
                <p className="pdf-avoid-break font-medium whitespace-pre-wrap">
                  {rawTx}
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Subjetivo & Objetivo */}
      <div className="section-block space-y-2 mb-2 text-black bg-slate-50 p-3 border border-black">
        <div className="pdf-avoid-break flex gap-2">
          <span className="font-black shrink-0 uppercase text-[11px]">SUBJETIVO:</span>
          <p className="font-medium leading-normal text-[11px] whitespace-pre-wrap">
            {evolution.subjetivo || '---'}
          </p>
        </div>
        <div className="pdf-avoid-break flex gap-2 border-t border-slate-300 pt-2">
          <span className="font-black shrink-0 uppercase text-[11px]">OBJETIVO:</span>
          <p className="font-medium leading-normal text-[11px] whitespace-pre-wrap">
            {evolution.objetivo || '---'}
          </p>
        </div>
      </div>

      {/* Vital Signs Grid */}
      <div className="pdf-avoid-break grid grid-cols-7 border border-black text-center text-[10px] font-black uppercase mb-3 bg-slate-100 text-black">
        <div className="p-2 border-r border-black">
          FC
          <br />
          <span className="text-[11px] font-bold">{evolution.vitalSigns?.fc || '---'}</span>
        </div>
        <div className="p-2 border-r border-black">
          FR
          <br />
          <span className="text-[11px] font-bold">{evolution.vitalSigns?.fr || '---'}</span>
        </div>
        <div className="p-2 border-r border-black">
          T°
          <br />
          <span className="text-[11px] font-bold">{evolution.vitalSigns?.temp || '---'}</span>
        </div>
        <div className="p-2 border-r border-black">
          PA
          <br />
          <span className="text-[11px] font-bold">{evolution.vitalSigns?.ta?.trim() || ''}</span>
        </div>
        <div className="p-2 border-r border-black">
          SatO₂
          <br />
          <span className="text-[11px] font-bold">{evolution.vitalSigns?.so2 || '---'}</span>
        </div>
        <div className="p-2 border-r border-black">
          Peso
          <br />
          <span className="text-[11px] font-bold">
            {evolution.vitalSigns?.peso || `${patient.weightKg} kg`}
          </span>
        </div>
        <div className="p-2">
          Talla
          <br />
          <span className="text-[11px] font-bold">---</span>
        </div>
      </div>

      {/* Oxygen Support Row */}
      {evolution.vitalSigns?.hasOxygenSupport && (
        <div className="pdf-avoid-break border-x border-b border-black mb-3 flex items-center divide-x divide-black bg-slate-50">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">
              Apoyo de Oxígeno:
            </span>
            <span className="text-[10px] font-bold text-cyan-700">SÍ</span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">Modalidad:</span>
            <span className="text-[10px] font-bold">
              {evolution.vitalSigns.o2Modalidad || '---'}
            </span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">Flujo:</span>
            <span className="text-[10px] font-bold">
              {evolution.vitalSigns.o2FlowLmin || '---'} L/min
            </span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">FiO₂:</span>
            <span className="text-[10px] font-bold">{evolution.vitalSigns.fio2 || '21'}%</span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">SatO₂ con O₂:</span>
            <span className="text-[10px] font-bold">{evolution.vitalSigns.o2So2 || '---'}%</span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-slate-500">Humedad:</span>
            <span className="text-[10px] font-bold">{evolution.vitalSigns.o2Type || '---'}</span>
          </div>
        </div>
      )}

      {/* Balance Hídrico Row if enabled */}
      {evolution.balanceHidrico?.enabled && (
        <div className="pdf-avoid-break border border-black mb-3 bg-cyan-50/60 p-2.5 text-black text-[10px]">
          <div className="font-black text-[10.5px] uppercase border-b border-black pb-1 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              BALANCE HÍDRICO PEDIÁTRICO DE 24 HORAS
            </span>
            <span className="font-mono bg-cyan-200 border border-cyan-400 px-2 py-0.5 rounded text-[9.5px] font-extrabold text-cyan-900">
              {evolution.balanceHidrico.interpretacionFU}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center font-bold">
            <div className="bg-white p-1.5 border border-black rounded">
              <span className="block text-[8.5px] text-slate-600 uppercase">Ingeridos (24h)</span>
              <span className="text-emerald-700 font-black text-xs">
                {evolution.balanceHidrico.ingeridosCc} cc
              </span>
            </div>
            <div className="bg-white p-1.5 border border-black rounded">
              <span className="block text-[8.5px] text-slate-600 uppercase">Excretados (24h)</span>
              <span className="text-rose-700 font-black text-xs">
                {evolution.balanceHidrico.excretadosCc} cc
              </span>
            </div>
            <div className="bg-white p-1.5 border border-black rounded">
              <span className="block text-[8.5px] text-slate-600 uppercase">Balance Neto</span>
              <span
                className={`font-black text-xs ${
                  evolution.balanceHidrico.balanceNetoCc >= 0
                    ? 'text-emerald-800'
                    : 'text-amber-800'
                }`}
              >
                {evolution.balanceHidrico.balanceNetoCc > 0
                  ? `+${evolution.balanceHidrico.balanceNetoCc}`
                  : evolution.balanceHidrico.balanceNetoCc}{' '}
                cc
              </span>
            </div>
            <div className="bg-white p-1.5 border border-black rounded">
              <span className="block text-[8.5px] text-slate-600 uppercase">
                Flujo Urinario (FU)
              </span>
              <span className="text-cyan-900 font-black text-xs">
                {evolution.balanceHidrico.flujoUrinarioCcKgH} cc/kg/h
              </span>
            </div>
          </div>
          <div className="mt-2 text-[9px] font-extrabold text-slate-800 flex justify-between px-1">
            <span>
              Superficie Corporal (SC):{' '}
              <strong>{evolution.balanceHidrico.superficieCorporalM2} m²</strong>
            </span>
            <span>
              Balance por SC: <strong>{evolution.balanceHidrico.balanceCcM2Dia} cc/m²/día</strong>
            </span>
          </div>
        </div>
      )}

      {/* EXAMEN FÍSICO */}
      <div className="section-block">
        <div className="space-y-1.5 text-black mb-3">
          {([
            { key: 'piel', label: 'Piel y Faneras' },
            { key: 'cabezaOjos', label: 'Cabeza y Ojos' },
            { key: 'oidosOtoscopia', label: 'Oídos y Otoscopia' },
            { key: 'narizOrofaringe', label: 'Nariz y Orofaringe' },
            { key: 'cuello', label: 'Cuello' },
            { key: 'toraxCP', label: 'Tórax y Pulmones (CP)' },
            { key: 'cardiovascular', label: 'Cardiovascular' },
            { key: 'abdomen', label: 'Abdomen' },
            { key: 'genitourinario', label: 'Genitourinario' },
            { key: 'extremidades', label: 'Extremidades' },
            { key: 'neurologico', label: 'Neurológico' },
          ] as const).map((item, idx) => {
            const rawVal = evolution.examenFisico?.[item.key];
            const value =
              rawVal ||
              (item.key === 'cardiovascular'
                ? getPediatricNormalPhysicalExam(patient.age, patient.gender).cardiovascularFisico
                : '');
            const rowNode = (
              <div
                key={item.key}
                className={`${
                  idx > 0 ? 'pdf-avoid-break ' : ''
                }grid grid-cols-12 gap-3 text-[10.5px] border-b border-slate-200 pb-1`}
              >
                <div className="col-span-3 font-black uppercase">
                  {item.label}
                </div>
                <div className="col-span-9 font-medium leading-tight">
                  {value || 'Sin hallazgos patológicos descritos.'}
                </div>
              </div>
            );
            if (idx === 0) {
              return (
                <div key={item.key} className="pdf-avoid-break space-y-1.5">
                  <h2 className="font-black text-[11px] mb-2 border-b-2 border-black uppercase tracking-widest text-black">
                    EXAMEN FÍSICO
                  </h2>
                  {rowNode}
                </div>
              );
            }
            return rowNode;
          })}
        </div>
      </div>

      {/* Comentarios y Plan (Especialista) */}
      <div className="pdf-avoid-break section-block mb-4 p-3 border-2 border-black min-h-[120px] text-black bg-slate-50">
        <h3 className="font-black text-[11px] uppercase mb-1.5 tracking-wider border-b border-black pb-1">
          COMENTARIOS Y PLAN (ESPECIALISTA):
        </h3>
        <p className="font-medium whitespace-pre-wrap leading-relaxed text-[11px]">
          {evolution.comentariosPlan ||
            evolution.medicalRoundSummary ||
            'Se mantiene conducta médica actual según revista médica. Vigilancia clínica estrecha.'}
        </p>
      </div>

      {/* Doctor Signature Block */}
      <div className="pdf-avoid-break section-block flex justify-end pt-6 mt-4 border-t border-slate-300">
        <div className="text-center w-64 border-t border-black pt-2 text-black">
          <p className="font-black text-[11px] uppercase tracking-wide">{evolution.doctorName}</p>
          <p className="font-bold text-[9px] uppercase tracking-widest text-slate-700">
            Médico Residente
          </p>
          <p className="text-[8px] text-slate-500 font-mono mt-0.5">
            Fecha y Hora: {evolution.date} {evolution.time}
          </p>
        </div>
      </div>
    </>
  );
};

export async function renderElementSlicesToPdf(
  pdf: jsPDF,
  sourceEl: HTMLElement,
  addNewPageFirst: boolean
): Promise<void> {
  const pageWidthMm = 215.9;
  const pageHeightMm = 279.4;
  const leftMarginMm = DEFAULT_PDF_DOWNLOAD_MARGIN_MM.left;
  const rightMarginMm = DEFAULT_PDF_DOWNLOAD_MARGIN_MM.right;
  const topMarginMm = DEFAULT_PDF_DOWNLOAD_MARGIN_MM.top;
  const bottomMarginMm = DEFAULT_PDF_DOWNLOAD_MARGIN_MM.bottom;
  const printableWidthMm = pageWidthMm - leftMarginMm - rightMarginMm; // 195.9mm
  const printableHeightMm = pageHeightMm - topMarginMm - bottomMarginMm; // 259.4mm

  const domWidthPx = sourceEl.offsetWidth || 816;
  const pxPerMm = domWidthPx / printableWidthMm;
  const maxSliceHeightDomPx = printableHeightMm * pxPerMm;

  const docRect = sourceEl.getBoundingClientRect();
  const currentScale = docRect.width > 0 ? docRect.width / domWidthPx : 1;

  const blocks = Array.from(sourceEl.querySelectorAll('.pdf-avoid-break')) as HTMLElement[];
  const blockRanges = blocks
    .map(b => {
      const r = b.getBoundingClientRect();
      return {
        top: (r.top - docRect.top) / currentScale,
        bottom: (r.bottom - docRect.top) / currentScale,
        height: r.height / currentScale,
      };
    })
    .filter(r => r.height > 0);

  const canvas = await html2canvas(sourceEl, {
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
        clonedEl.style.paddingTop = '2mm';
        clonedEl.style.paddingBottom = '2mm';
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.border = 'none';
        clonedEl.style.transform = 'none';
      }
    },
  });

  const scaleFactor = canvas.width / domWidthPx;
  const totalDomHeightPx = canvas.height / scaleFactor;

  const slices: { startDomY: number; endDomY: number }[] = [];
  let currentDomY = 0;

  while (currentDomY < totalDomHeightPx - 2) {
    let targetEndDomY = currentDomY + maxSliceHeightDomPx;
    if (targetEndDomY >= totalDomHeightPx - 2) {
      slices.push({ startDomY: currentDomY, endDomY: totalDomHeightPx });
      break;
    }

    let adjustedEndDomY = targetEndDomY;
    for (const block of blockRanges) {
      if (block.top < adjustedEndDomY - 1 && block.bottom > adjustedEndDomY + 1) {
        if (block.top > currentDomY + 25) {
          adjustedEndDomY = block.top - 3;
        }
      }
    }

    if (adjustedEndDomY <= currentDomY + 10) {
      adjustedEndDomY = targetEndDomY;
    }

    slices.push({ startDomY: currentDomY, endDomY: adjustedEndDomY });
    currentDomY = adjustedEndDomY;
  }

  slices.forEach((slice, index) => {
    if (index > 0 || addNewPageFirst) {
      pdf.addPage('letter', 'portrait');
    }
    const sliceStartCanvasY = Math.max(0, Math.floor(slice.startDomY * scaleFactor));
    const sliceEndCanvasY = Math.min(canvas.height, Math.ceil(slice.endDomY * scaleFactor));
    const sliceCanvasHeight = sliceEndCanvasY - sliceStartCanvasY;

    if (sliceCanvasHeight <= 0) return;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceCanvasHeight;

    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sliceStartCanvasY,
        canvas.width,
        sliceCanvasHeight,
        0,
        0,
        canvas.width,
        sliceCanvasHeight
      );
      const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeightMm = Number(((sliceCanvasHeight / canvas.width) * printableWidthMm).toFixed(3));
      pdf.addImage(
        sliceImgData,
        'JPEG',
        leftMarginMm,
        topMarginMm,
        printableWidthMm,
        sliceHeightMm,
        undefined,
        'FAST'
      );
    }
    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
  });

  canvas.width = 0;
  canvas.height = 0;
}

export const MedicalEvolutionDocument: React.FC<Props> = ({
  patient,
  evolution,
  autoDownload = false,
  onClose,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [mobileZoomMode, setMobileZoomMode] = useState<'fit' | number>('fit');
  const [docNaturalHeight, setDocNaturalHeight] = useState<number>(1056);
  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.offsetHeight > 0) {
        setDocNaturalHeight(el.offsetHeight);
      }
    };
    updateHeight();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    if (ro) ro.observe(el);
    return () => ro?.disconnect();
  }, [patient, evolution]);

  const isMobileViewport = viewportWidth < 860;
  const fitScale = Math.min(1, Math.max(0.38, (viewportWidth - 16) / 816));
  const activeScale = isMobileViewport
    ? mobileZoomMode === 'fit'
      ? fitScale
      : mobileZoomMode
    : 1;

  const printDateStr = evolution.date
    ? evolution.date.split('-').reverse().join('-')
    : new Date().toLocaleDateString('es-VE').replace(/\//g, '-');

  useEffect(() => {
    return () => {
      cleanupPdfPrintResources();
    };
  }, []);

  const buildEvolutionPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const docEl = docRef.current || document.getElementById('evolution-continuous-doc');
    if (!docEl) return null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    await renderElementSlicesToPdf(pdf, docEl, false);

    const fileName = `EVOLUCION_MEDICA_${patient.lastName.toUpperCase()}_${patient.firstName.toUpperCase()}_${printDateStr}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_.-]/gi, '');
    return { pdf, fileName };
  };

  const handlePrint = () => {
    const docEl = docRef.current || document.getElementById('evolution-continuous-doc');
    if (!docEl) return;
    openInstantWhitePrintPage({
      sheets: [{ element: docEl, orientation: 'portrait', repeatHeaderOnOverflow: true }],
      title: `Evolución Médica — ${patient.lastName}, ${patient.firstName}`,
      fileName: formatPrintDocumentTitle('Evolucion', `${patient.lastName} ${patient.firstName}`, { includeDateTime: true }),
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const built = await buildEvolutionPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (error) {
      console.error('Error generando PDF de Evolución:', error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  React.useEffect(() => {
    if (autoDownload) {
      let cancelled = false;
      requestAnimationFrame(() => {
        if (!cancelled) {
          handleDownloadPdf().then(() => {
            if (!cancelled) onClose();
          });
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [autoDownload]);

  return (
    <div
      id={!autoDownload ? 'medical-evolution-viewer-overlay' : undefined}
      className={
        autoDownload
          ? 'fixed left-[-10000px] top-0 w-[215.9mm] bg-white text-black pointer-events-none z-[-1]'
          : 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex flex-col overflow-hidden print:p-0 print:bg-white print:overflow-visible'
      }
    >
      {/* Top Action Bar - Responsive for Mobile & Desktop */}
      {!autoDownload && (
        <div className="w-full bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 flex flex-col gap-2 shadow-2xl no-print z-30">
          <div className="max-w-[216mm] w-full mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
                  Visualización de Evolución
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold truncate sm:hidden">
                  {patient.lastName}, {patient.firstName} · {evolution.date}
                </p>
              </div>
            </div>

            <div data-tutorial="evo-doc-print-actions" className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer active:scale-95"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 sm:px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-lg shadow-teal-950/50 transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Imprimir en Carta</span>
                <span className="xs:hidden">Imprimir</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar</span>
              </button>
            </div>
          </div>

          {/* Mobile Zoom & Full-Page Navigation Controls */}
          {isMobileViewport && (
            <div className="max-w-[216mm] w-full mx-auto flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
              <span className="text-slate-400 font-bold truncate">
                Vista móvil ({Math.round(activeScale * 100)}%) · Desliza libremente
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileZoomMode('fit')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer transition-all ${
                    mobileZoomMode === 'fit'
                      ? 'bg-teal-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" /> Ajustar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMobileZoomMode(prev => {
                      const base = prev === 'fit' ? fitScale : prev;
                      return Math.max(0.4, Number((base - 0.15).toFixed(2)));
                    })
                  }
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Alejar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileZoomMode(1)}
                  className={`px-2 py-1 rounded-lg font-black text-[10px] cursor-pointer transition-all ${
                    mobileZoomMode === 1
                      ? 'bg-teal-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMobileZoomMode(prev => {
                      const base = prev === 'fit' ? fitScale : prev;
                      return Math.min(1.4, Number((base + 0.15).toFixed(2)));
                    })
                  }
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Acercar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable Viewport Container: allows smooth vertical & horizontal scrolling across the entire page */}
      <div
        className="flex-1 w-full overflow-y-auto overflow-x-auto overscroll-contain py-3 sm:py-6 px-2 sm:px-6 print:p-0 print:overflow-visible"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="mx-auto transition-all duration-150 print:w-full print:h-auto"
          style={
            !autoDownload && activeScale !== 1
              ? {
                  width: `${Math.round(816 * activeScale)}px`,
                  height: `${Math.round(docNaturalHeight * activeScale + 24)}px`,
                }
              : { width: '215.9mm' }
          }
        >
          <div
            ref={docRef}
            id="evolution-continuous-doc"
            data-tutorial="evo-doc-sheet"
            className="bg-white text-black w-[215.9mm] min-h-[279.4mm] p-[12mm_14mm] border border-slate-300 box-border font-sans relative print:border-none"
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              transform: !autoDownload && activeScale !== 1 ? `scale(${activeScale})` : 'none',
              transformOrigin: 'top left',
            }}
          >
            <EvolutionSheetContent patient={patient} evolution={evolution} />
          </div>
        </div>
      </div>
    </div>
  );
};
