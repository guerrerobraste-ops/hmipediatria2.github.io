import React, { useState, useMemo } from 'react';
import { Patient, HistoriaClinicaPediatrica, MedicalEvolution } from '../types';
import { calculateHospitalizationTime } from '../services/api';
import {
  Printer,
  Download,
  ArrowLeft,
  X,
  FileEdit,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  FileCheck2
} from 'lucide-react';
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

interface ParsedTreatmentRow {
  numero: string;
  medicamento: string;
  dosis: string;
  diaTratamiento: string;
}

interface ParsedDiagnosisLine {
  key: string;
  text: string;
  isSub: boolean;
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

function formatCurrentTime12h(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatCurrentDateVe(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatIsoDateToVe(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function calcDaysSinceIso(isoDate: string): number {
  const start = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, isNaN(diffDays) ? 1 : diffDays);
}

function formatHospitalStayLong(admissionDate: string, admissionTime?: string): string {
  const calc = calculateHospitalizationTime(admissionDate, admissionTime);
  if (calc.days === 0) {
    if (calc.remainingHours === 0) {
      return `${calc.minutes} min (Ingreso reciente)`;
    }
    return `${calc.remainingHours} ${calc.remainingHours === 1 ? 'hora' : 'horas'}, ${calc.minutes} min`;
  }
  const dayLabel = calc.days === 1 ? '1 día' : `${calc.days} días`;
  const hourLabel = calc.remainingHours === 1 ? '1 hora' : `${calc.remainingHours} horas`;
  return `${dayLabel}, ${hourLabel}`;
}

function appendUnitIfMissing(raw: string | undefined, unit: string, pattern: RegExp): string {
  const val = (raw || '').trim();
  if (!val) return '---';
  if (pattern.test(val)) return val;
  return `${val}${unit.startsWith('%') ? '' : ' '}${unit}`;
}

function buildParsedDiagnoses(
  patient: Patient,
  latestEv: MedicalEvolution | null,
  historia?: HistoriaClinicaPediatrica
): ParsedDiagnosisLine[] {
  const lines: ParsedDiagnosisLine[] = [];

  if (latestEv?.diagnosesModified && latestEv.diagnosesModified.trim()) {
    const rawLines = latestEv.diagnosesModified
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    let fallbackIdx = 1;
    rawLines.forEach((line, idx) => {
      const subMatch = line.match(/^(\d+(?:\.\d+)+)\.?\s*(.*)$/);
      const mainMatch = line.match(/^(\d+)\.?\s+(.*)$/);
      if (subMatch) {
        lines.push({
          key: `dx-sub-${idx}`,
          text: `${subMatch[1]}. ${subMatch[2]}`,
          isSub: true
        });
      } else if (mainMatch) {
        lines.push({
          key: `dx-main-${idx}`,
          text: `${mainMatch[1]}. ${mainMatch[2]}`,
          isSub: false
        });
        fallbackIdx = parseInt(mainMatch[1], 10) + 1;
      } else {
        lines.push({
          key: `dx-plain-${idx}`,
          text: `${fallbackIdx++}. ${line}`,
          isSub: false
        });
      }
    });
    if (lines.length > 0) return lines;
  }

  if (patient.diagnoses && patient.diagnoses.length > 0) {
    patient.diagnoses.forEach((diag, idx) => {
      const rawTitle = (diag.title || '').trim();
      if (!rawTitle) return;
      const isAlreadySub = /^\d+\.\d+/.test(rawTitle);
      const hasMainNumber = /^\d+[\.\-\)]\s*/.test(rawTitle);
      const displayTitle = hasMainNumber || isAlreadySub ? rawTitle : `${idx + 1}. ${rawTitle}`;

      lines.push({
        key: `pt-dx-${diag.id || idx}`,
        text: displayTitle,
        isSub: isAlreadySub
      });

      if (diag.subDiagnoses && diag.subDiagnoses.length > 0) {
        diag.subDiagnoses.forEach((sub, sIdx) => {
          const cleanSub = (sub || '').trim();
          if (!cleanSub) return;
          const subHasNum = /^\d+\.\d+/.test(cleanSub);
          lines.push({
            key: `pt-dx-sub-${idx}-${sIdx}`,
            text: subHasNum ? cleanSub : `${idx + 1}.${sIdx + 1}. ${cleanSub}`,
            isSub: true
          });
        });
      }
    });
    if (lines.length > 0) return lines;
  }

  if (historia?.diagnosticoAdmision && historia.diagnosticoAdmision.trim()) {
    historia.diagnosticoAdmision
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        const hasNum = /^\d+[\.\)]\s*/.test(line);
        lines.push({
          key: `hc-dx-${idx}`,
          text: hasNum ? line : `${idx + 1}. ${line}`,
          isSub: /^\d+\.\d+/.test(line)
        });
      });
    if (lines.length > 0) return lines;
  }

  return [{ key: 'dx-default', text: '1. En evaluación clínica por el servicio de pediatría.', isSub: false }];
}

function buildParsedTreatments(patient: Patient, latestEv: MedicalEvolution | null): ParsedTreatmentRow[] {
  const rawText = (latestEv?.treatmentModified || patient.treatment || '').trim();
  const rows: ParsedTreatmentRow[] = [];

  if (rawText) {
    const normalizedCheck = rawText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/\.+$/, '')
      .trim();
    if (normalizedCheck === 'sintomatico') {
      return [
        {
          numero: '1',
          medicamento: 'Sintomático',
          dosis: 'Según indicación',
          diaTratamiento: 'Vigente',
        },
      ];
    }

    const rawLines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    rawLines.forEach((line, idx) => {
      const numMatch = line.match(/^(\d+)\.?\s*(.*)$/);
      const rowNum = numMatch ? numMatch[1] : String(idx + 1);
      const content = numMatch ? numMatch[2] : line;

      const dosePipeMatch = content.match(/\|\s*Dosis:\s*([^|]+)/i);
      const startPipeMatch = content.match(/\|\s*Inicio:\s*(\d{4}-\d{2}-\d{2})/i);
      const dayPipeMatch = content.match(/\|\s*(D[ií]a\s*\d+(?:\s*\([^)]+\))?)/i);
      const noCumplidoMatch = content.match(/\|\s*NO CUMPLIDO HOY(?::\s*([^|]+))?/i);
      const culminadoMatch = content.match(/\|\s*TRATAMIENTO CULMINADO\b/i);
      const diasCumplidosMatch = content.match(/\|\s*(\d+\s*d[ií]as?\s*cumplidos?)\b/i);

      let medName = content
        .replace(/\|\s*Dosis:[^|]*/gi, '')
        .replace(/\|\s*Inicio:[^|]*/gi, '')
        .replace(/\|\s*D[ií]a\s*\d+[^|]*/gi, '')
        .replace(/\|\s*NO CUMPLIDO HOY[^|]*/gi, '')
        .replace(/\|\s*TRATAMIENTO CULMINADO[^|]*/gi, '')
        .replace(/\|\s*\d+\s*d[ií]as?\s*cumplidos?[^|]*/gi, '')
        .trim();

      let doseStr = dosePipeMatch ? dosePipeMatch[1].trim() : '';

      // If no pipe-separated dose was provided, detect inline pediatric dose pattern
      if (!doseStr) {
        const inlineDoseMatch = medName.match(
          /\b(\d+(?:[.,]\d+)?\s*(?:mg|ui|gr|g|mcg|mEq|cc|ml)\s*\/?\s*(?:kg)?\s*\/?\s*(?:dosis|d[ií]a|h)?(?:\s*(?:EV|VO|IM|SC|IV|c\/\d+h|BID|TID|QID|OD))?)\b/i
        );
        if (inlineDoseMatch && inlineDoseMatch.index !== undefined) {
          doseStr = inlineDoseMatch[1].trim();
          const withoutDose = (
            medName.slice(0, inlineDoseMatch.index) +
            ' ' +
            medName.slice(inlineDoseMatch.index + inlineDoseMatch[0].length)
          )
            .replace(/\s{2,}/g, ' ')
            .replace(/^[\s,-]+|[\s,-]+$/g, '')
            .trim();
          if (withoutDose) {
            medName = withoutDose;
          }
        }
      }

      let dayStr = '';
      if (culminadoMatch) {
        const startLabel = startPipeMatch ? `Inicio: ${formatIsoDateToVe(startPipeMatch[1])}` : '';
        const daysLabel = diasCumplidosMatch ? diasCumplidosMatch[1].trim() : '';
        dayStr = ['Culminado', startLabel, daysLabel].filter(Boolean).join(' · ');
      } else if (dayPipeMatch && startPipeMatch) {
        dayStr = `${dayPipeMatch[1].trim()} (Inicio: ${formatIsoDateToVe(startPipeMatch[1])})`;
      } else if (startPipeMatch) {
        const dias = calcDaysSinceIso(startPipeMatch[1]);
        dayStr = `Día ${dias} (Inicio: ${formatIsoDateToVe(startPipeMatch[1])})`;
      } else if (dayPipeMatch) {
        dayStr = dayPipeMatch[1].trim();
      } else {
        dayStr = 'En curso';
      }

      if (noCumplidoMatch) {
        const motivo = noCumplidoMatch[1]?.trim();
        dayStr += motivo ? ` · No cumplido (${motivo})` : ' · No cumplido hoy';
      }

      rows.push({
        numero: rowNum,
        medicamento: `${rowNum}. ${medName || content}`,
        dosis: doseStr || 'Según indicación',
        diaTratamiento: dayStr
      });
    });

    if (rows.length > 0) return rows;
  }

  // Fallback to active medical orders if treatment text is empty
  const orders = patient.ordenesMedicas || latestEv?.ordenesMedicas || [];
  if (orders.length > 0) {
    orders.slice(0, 10).forEach((ord, idx) => {
      rows.push({
        numero: String(ord.itemNumber || idx + 1),
        medicamento: `${ord.itemNumber || idx + 1}. ${ord.descripcion}`,
        dosis: ord.dosisCalculo?.trim() || 'Según orden',
        diaTratamiento: 'Indicación vigente'
      });
    });
    return rows;
  }

  return [
    {
      numero: '1',
      medicamento: '1. Sin esquema farmacológico especificado al recibimiento.',
      dosis: '---',
      diaTratamiento: '---'
    }
  ];
}

export const NotaRecibimientoSheetContent: React.FC<{
  patient: Patient;
  historia?: HistoriaClinicaPediatrica;
  customSubjetivo?: string;
  customObjetivo?: string;
  customNotaAdicional?: string;
  customFecha?: string;
  customHora?: string;
}> = ({
  patient,
  historia,
  customSubjetivo,
  customObjetivo,
  customNotaAdicional = '',
  customFecha,
  customHora,
}) => {
  const latestEv = useMemo(() => getLatestEvolution(patient), [patient]);
  const fechaNota = customFecha ?? formatCurrentDateVe();
  const horaNota = customHora ?? formatCurrentTime12h();

  const subjetivoText =
    customSubjetivo !== undefined
      ? customSubjetivo
      : latestEv?.subjetivo?.trim() || historia?.motivosAdmision?.trim() || '';

  const objetivoText =
    customObjetivo !== undefined
      ? customObjetivo
      : latestEv?.objetivo?.trim() || historia?.estadoGeneralFisico?.trim() || '';

  const diasHospFormatted = useMemo(
    () => formatHospitalStayLong(patient.admissionDate, patient.admissionTime),
    [patient.admissionDate, patient.admissionTime]
  );

  const areaDisplay = useMemo(() => {
    const clean = (patient.area || 'Hospitalización').replace(/^ÁREA DE\s+/i, '');
    return `Servicio de Pediatría — Área de ${clean}`;
  }, [patient.area]);

  const vitalsDisplay = useMemo(() => {
    const evVitals = latestEv?.vitalSigns;
    const fcRaw = evVitals?.fc || historia?.fc || '';
    const frRaw = evVitals?.fr || historia?.fr || '';
    const tempRaw = evVitals?.temp || historia?.temp || '';
    const paRaw = evVitals?.ta || historia?.ta || '';
    const satRaw =
      (evVitals?.hasOxygenSupport ? evVitals?.o2So2 || evVitals?.so2 : evVitals?.so2) ||
      historia?.so2 ||
      '';
    const pesoRaw =
      evVitals?.peso || (patient.weightKg ? String(patient.weightKg) : historia?.peso || '');

    return {
      fc: appendUnitIfMissing(fcRaw, 'BPM', /bpm|lpm/i),
      fr: appendUnitIfMissing(frRaw, 'RPM', /rpm/i),
      temp: appendUnitIfMissing(tempRaw, '°C', /°c|\bc\b/i),
      pa: appendUnitIfMissing(paRaw, 'mmHg', /mmhg/i),
      satO2: appendUnitIfMissing(satRaw, '%', /%/),
      peso: appendUnitIfMissing(pesoRaw, 'kg', /kg/i),
    };
  }, [latestEv, historia, patient.weightKg]);

  const parsedDiagnoses = useMemo(
    () => buildParsedDiagnoses(patient, latestEv, historia),
    [patient, latestEv, historia]
  );

  const parsedTreatments = useMemo(
    () => buildParsedTreatments(patient, latestEv),
    [patient, latestEv]
  );

  return (
    <div
      className="nota-recibimiento-sheet bg-white text-[#1e293b] border border-[#cbd5e1] shrink-0 flex flex-col justify-between"
      style={{
        width: '215.9mm',
        minHeight: '279.4mm',
        padding: '15mm 18mm 14mm 18mm',
        backgroundColor: '#ffffff',
        color: '#1e293b',
        fontFamily: 'Calibri, Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <h1
            style={{
              color: '#164e78',
              fontSize: '16.5pt',
              fontWeight: 800,
              letterSpacing: '0.4px',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            NOTA DE RECIBIMIENTO DEL PACIENTE
          </h1>
          <p
            style={{
              color: '#64748b',
              fontSize: '10pt',
              margin: '4px 0 0 0',
              fontWeight: 500,
            }}
          >
            {areaDisplay}
          </p>
        </div>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '16px',
            fontSize: '10pt',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: '50%',
                  padding: '6px 10px',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  borderLeft: '2px solid #94a3b8',
                }}
              >
                <strong style={{ color: '#164e78' }}>Fecha:</strong>{' '}
                <span style={{ color: '#0f172a' }}>{fechaNota || '---'}</span>
              </td>
              <td style={{ width: '50%', padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                <strong style={{ color: '#164e78' }}>Hora:</strong>{' '}
                <span style={{ color: '#0f172a' }}>{horaNota || '---'}</span>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  borderLeft: '2px solid #94a3b8',
                }}
              >
                <strong style={{ color: '#164e78' }}>Paciente:</strong>{' '}
                <span style={{ color: '#0f172a' }}>
                  {patient.lastName}, {patient.firstName}
                </span>
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                <strong style={{ color: '#164e78' }}>Historia Clínica (HC N°):</strong>{' '}
                <span style={{ color: '#0f172a' }}>{patient.medicalHistoryNumber || '---'}</span>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  borderLeft: '2px solid #94a3b8',
                }}
              >
                <strong style={{ color: '#164e78' }}>Edad:</strong>{' '}
                <span style={{ color: '#0f172a' }}>{patient.age || '---'}</span>
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                <strong style={{ color: '#164e78' }}>Sexo:</strong>{' '}
                <span style={{ color: '#0f172a' }}>
                  {patient.gender === 'M' ? 'Masculino (M)' : 'Femenino (F)'}
                </span>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '6px 10px',
                  borderRight: '1px solid #cbd5e1',
                  borderLeft: '2px solid #94a3b8',
                }}
              >
                <strong style={{ color: '#164e78' }}>Servicio / Cama:</strong>{' '}
                <span style={{ color: '#0f172a' }}>
                  {patient.area} / {patient.bedNumber}
                </span>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <strong style={{ color: '#164e78' }}>Días Hospitalización:</strong>{' '}
                <span style={{ color: '#0f172a' }}>{diasHospFormatted}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '14px' }}>
          <h2
            style={{
              color: '#164e78',
              fontSize: '11pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              borderBottom: '1px solid #94a3b8',
              paddingBottom: '3px',
              margin: '0 0 8px 0',
            }}
          >
            EVOLUCIÓN CLÍNICA AL RECIBIMIENTO
          </h2>
          <p
            style={{
              fontSize: '10pt',
              lineHeight: 1.45,
              margin: '0 0 7px 0',
              whiteSpace: 'pre-wrap',
            }}
          >
            <strong style={{ color: '#0f172a' }}>Subjetivo:</strong>{' '}
            <span>{subjetivoText.trim() || '---'}</span>
          </p>
          <p style={{ fontSize: '10pt', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' }}>
            <strong style={{ color: '#0f172a' }}>Objetivo:</strong>{' '}
            <span>{objetivoText.trim() || '---'}</span>
          </p>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <h2
            style={{
              color: '#164e78',
              fontSize: '11pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              borderBottom: '1px solid #94a3b8',
              paddingBottom: '3px',
              margin: '0 0 9px 0',
            }}
          >
            SIGNOS VITALES Y ANTROPOMETRÍA
          </h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10pt',
              textAlign: 'center',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#164e78', color: '#ffffff' }}>
                <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>FC</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>FR</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>T°</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '19%' }}>PA</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '15.6%' }}>SatO₂</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, width: '15.6%' }}>Peso</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 700 }}>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.fc}</td>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.fr}</td>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.temp}</td>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.pa}</td>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.satO2}</td>
                <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1' }}>{vitalsDisplay.peso}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <h2
            style={{
              color: '#164e78',
              fontSize: '11pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              borderBottom: '1px solid #94a3b8',
              paddingBottom: '3px',
              margin: '0 0 8px 0',
            }}
          >
            DIAGNÓSTICOS DE INGRESO / RECIBIMIENTO
          </h2>
          <div style={{ fontSize: '10pt', lineHeight: 1.45, color: '#1e293b' }}>
            {parsedDiagnoses.map(item => (
              <div
                key={item.key}
                style={{
                  paddingLeft: item.isSub ? '28px' : '12px',
                  marginBottom: '2px',
                }}
              >
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: customNotaAdicional.trim() ? '14px' : '10px' }}>
          <h2
            style={{
              color: '#164e78',
              fontSize: '11pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              borderBottom: '1px solid #94a3b8',
              paddingBottom: '3px',
              margin: '0 0 8px 0',
            }}
          >
            TRATAMIENTO INDICADO
          </h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10pt',
              border: '1px solid #94a3b8',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#edf4fa', color: '#164e78' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '36%' }}>
                  Medicamento
                </th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '28%' }}>
                  Dosis
                </th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', width: '36%' }}>
                  Día de Tratamiento
                </th>
              </tr>
            </thead>
            <tbody>
              {parsedTreatments.map((row, idx) => (
                <tr key={`${row.numero}-${idx}`} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    {row.medicamento}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    {row.dosis}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    {row.diaTratamiento}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customNotaAdicional.trim().length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <h2
              style={{
                color: '#164e78',
                fontSize: '10.5pt',
                fontWeight: 800,
                textTransform: 'uppercase',
                borderBottom: '1px solid #94a3b8',
                paddingBottom: '3px',
                margin: '0 0 6px 0',
              }}
            >
              NOTA ADICIONAL
            </h2>
            <p
              style={{
                fontSize: '10pt',
                lineHeight: 1.45,
                color: '#0f172a',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {customNotaAdicional.trim()}
            </p>
          </div>
        )}
      </div>

      <div style={{ paddingTop: '28px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', width: '270px', borderTop: '1px solid #334155', paddingTop: '6px' }}>
          <p style={{ fontSize: '9.5pt', color: '#475569', margin: 0, fontWeight: 600 }}>
            Médico Residente / Firma y Sello
          </p>
        </div>
      </div>
    </div>
  );
};

export const BulkNotasRecibimientoPrintView: React.FC<{
  patients: Patient[];
  historias: HistoriaClinicaPediatrica[];
  autoDownload?: boolean;
  onClose: () => void;
}> = ({ patients, historias, autoDownload = false, onClose }) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handlePrintAll = () => {
    const container = document.getElementById('bulk-notas-recibimiento-container');
    if (!container) return;
    const sheets = Array.from(
      container.querySelectorAll('.nota-recibimiento-sheet')
    ) as HTMLElement[];
    if (sheets.length === 0) return;

    const sheetInputs = sheets.map((el, idx) => {
      const pt = patients[idx];
      return {
        element: el,
        bannerText: pt
          ? `#${idx + 1} · Cama ${pt.bedNumber} — ${pt.lastName}, ${pt.firstName} (${pt.area}) · Nota de Recibimiento`
          : undefined,
        repeatHeaderOnOverflow: true,
      };
    });

    openInstantWhitePrintPage({
      sheets: sheetInputs,
      title: `Notas de Recibimiento (${patients.length})`,
      fileName: formatPrintDocumentTitle('Notas de Recibimiento', `${patients.length} pacientes`, { includeDateTime: true }),
      onDownloadPdf: handleDownloadPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    const container = document.getElementById('bulk-notas-recibimiento-container');
    if (!container) return;

    const sheets = Array.from(
      container.querySelectorAll('.nota-recibimiento-sheet')
    ) as HTMLElement[];
    if (sheets.length === 0) return;

    setIsExportingPdf(true);
    try {
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
            if (clonedElem) {
              clonedElem.style.border = 'none';
              clonedElem.style.boxShadow = 'none';
            }
          },
        });
        addCanvasSinglePageWithMargin(pdf, canvas, {
          addNewPageFirst: i > 0,
          quality: 0.92,
        });
      }

      const dateStr = formatCurrentDateVe().replace(/\//g, '-');
      pdf.save(`NOTAS_RECIBIMIENTO_HOSPITALIZADOS_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generando PDF masivo de Notas de Recibimiento:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  React.useEffect(() => {
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
              Notas de Recibimiento — Pacientes Ingresados ({patients.length})
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
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Todo (1 Hoja c/u)</span>
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
        <div id="bulk-notas-recibimiento-container" className="flex flex-col gap-6 items-center">
          {patients.map((pt, idx) => {
            const hist = historias.find(
              h =>
                h.id === pt.historiaClinicaId ||
                h.patientId === pt.id ||
                h.numHistoria === pt.medicalHistoryNumber
            );
            return (
              <div key={pt.id} className="flex flex-col items-center">
                {!autoDownload && (
                  <div className="no-print w-full mb-1.5 px-3 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-bold flex items-center justify-between">
                    <span>
                      #{idx + 1} · Cama {pt.bedNumber} — {pt.lastName}, {pt.firstName}
                    </span>
                    <span className="text-sky-300">HC: {pt.medicalHistoryNumber}</span>
                  </div>
                )}
                <NotaRecibimientoSheetContent patient={pt} historia={hist} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const NotaRecibimientoDocument: React.FC<Props> = ({ patient, historia, onClose }) => {
  const latestEv = useMemo(() => getLatestEvolution(patient), [patient]);

  const initialSubjetivo = useMemo(() => {
    if (latestEv?.subjetivo && latestEv.subjetivo.trim()) return latestEv.subjetivo.trim();
    if (historia?.motivosAdmision && historia.motivosAdmision.trim()) return historia.motivosAdmision.trim();
    return '';
  }, [latestEv, historia]);

  const initialObjetivo = useMemo(() => {
    if (latestEv?.objetivo && latestEv.objetivo.trim()) return latestEv.objetivo.trim();
    if (historia?.estadoGeneralFisico && historia.estadoGeneralFisico.trim()) return historia.estadoGeneralFisico.trim();
    return '';
  }, [latestEv, historia]);

  const [subjetivoText, setSubjetivoText] = useState<string>(initialSubjetivo);
  const [objetivoText, setObjetivoText] = useState<string>(initialObjetivo);
  const [notaAdicional, setNotaAdicional] = useState<string>('');
  const [fechaNota, setFechaNota] = useState<string>(() => formatCurrentDateVe());
  const [horaNota, setHoraNota] = useState<string>(() => formatCurrentTime12h());
  const [showEditorPanel, setShowEditorPanel] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const diasHospFormatted = useMemo(
    () => formatHospitalStayLong(patient.admissionDate, patient.admissionTime),
    [patient.admissionDate, patient.admissionTime]
  );

  const areaDisplay = useMemo(() => {
    const clean = (patient.area || 'Hospitalización').replace(/^ÁREA DE\s+/i, '');
    return `Servicio de Pediatría — Área de ${clean}`;
  }, [patient.area]);

  const vitalsDisplay = useMemo(() => {
    const evVitals = latestEv?.vitalSigns;
    const fcRaw = evVitals?.fc || historia?.fc || '';
    const frRaw = evVitals?.fr || historia?.fr || '';
    const tempRaw = evVitals?.temp || historia?.temp || '';
    const paRaw = evVitals?.ta || historia?.ta || '';
    const satRaw = (evVitals?.hasOxygenSupport ? evVitals?.o2So2 || evVitals?.so2 : evVitals?.so2) || historia?.so2 || '';
    const pesoRaw = evVitals?.peso || (patient.weightKg ? String(patient.weightKg) : historia?.peso || '');

    return {
      fc: appendUnitIfMissing(fcRaw, 'BPM', /bpm|lpm/i),
      fr: appendUnitIfMissing(frRaw, 'RPM', /rpm/i),
      temp: appendUnitIfMissing(tempRaw, '°C', /°c|\bc\b/i),
      pa: appendUnitIfMissing(paRaw, 'mmHg', /mmhg/i),
      satO2: appendUnitIfMissing(satRaw, '%', /%/),
      peso: appendUnitIfMissing(pesoRaw, 'kg', /kg/i)
    };
  }, [latestEv, historia, patient.weightKg]);

  const parsedDiagnoses = useMemo(
    () => buildParsedDiagnoses(patient, latestEv, historia),
    [patient, latestEv, historia]
  );

  const parsedTreatments = useMemo(
    () => buildParsedTreatments(patient, latestEv),
    [patient, latestEv]
  );

  const handleResetFromLastEvolution = () => {
    setSubjetivoText(initialSubjetivo);
    setObjetivoText(initialObjetivo);
  };

  const isPrintingPdf = false;

  const buildNotaPdf = async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const docElement = document.getElementById('nota-recibimiento-doc');
    if (!docElement) return null;

    const canvas = await html2canvas(docElement, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElem) => {
        sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);
        if (clonedElem) {
          clonedElem.style.border = 'none';
          clonedElem.style.boxShadow = 'none';
        }
      }
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
    addCanvasSinglePageWithMargin(pdf, canvas, { quality: 0.92 });

    const safeLast = (patient.lastName || 'PACIENTE').replace(/\s+/g, '_').toUpperCase();
    const safeFirst = (patient.firstName || '').replace(/\s+/g, '_').toUpperCase();
    const safeDate = fechaNota.replace(/\//g, '-');
    return {
      pdf,
      fileName: `NOTA_RECIBIMIENTO_${safeLast}_${safeFirst}_${safeDate}.pdf`,
    };
  };

  const handleExportPdf = async () => {
    if (isDownloading || isPrintingPdf) return;
    setIsDownloading(true);
    try {
      const built = await buildNotaPdf();
      if (!built) return;
      built.pdf.save(built.fileName);
    } catch (e) {
      console.error('Error al generar PDF de Nota de Recibimiento:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const docElement = document.getElementById('nota-recibimiento-doc');
    if (!docElement) return;
    openInstantWhitePrintPage({
      sheets: [docElement],
      title: `Nota de Recibimiento — ${patient.lastName}, ${patient.firstName}`,
      fileName: formatPrintDocumentTitle('Nota de Recibimiento', `${patient.lastName} ${patient.firstName}`, { includeDateTime: true }),
      onDownloadPdf: handleExportPdf,
      fitEachSheetToOnePage: false,
      repeatHeaderOnOverflow: true,
    });
  };

  const { tokens: themeTokens } = useSeasonalTheme();

  return (
    <div className="fixed inset-0 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md z-[150] overflow-y-auto flex flex-col items-center">
      {/* Barra superior de acciones */}
      <div className={`no-print sticky top-0 ${themeTokens.headerSurface} border-b text-slate-900 dark:text-white w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-30 shadow-sm dark:shadow-xl flex-wrap gap-2`}>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/50 shadow-xs dark:shadow-[0_0_12px_rgba(56,189,248,0.45)] hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Volver
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Nota de Recibimiento
              </h2>
              <span className="bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                PDF 1 Hoja Carta
              </span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
              {patient.lastName}, {patient.firstName} · H.C: {patient.medicalHistoryNumber || '---'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEditorPanel(prev => !prev)}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">{showEditorPanel ? 'Ocultar Editor' : 'Editar Subjetivo / Objetivo'}</span>
            {showEditorPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isDownloading}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500/20 text-white dark:text-indigo-200 border-2 border-indigo-500 dark:border-indigo-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(99,102,241,0.55)] dark:hover:shadow-[0_0_24px_rgba(99,102,241,0.9)] hover:scale-105 transition-all font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-white dark:text-indigo-300" />
            <span>{isDownloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs dark:shadow-[0_0_15px_rgba(14,165,233,0.65)] hover:scale-105 transition-all cursor-pointer"
            title="Imprimir documento PDF de Nota de Recibimiento en tamaño Carta"
          >
            <Printer className="w-4 h-4 text-white dark:text-slate-950" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-2 border-rose-400 dark:border-rose-500/80 shadow-xs dark:shadow-[0_0_14px_rgba(244,63,94,0.65)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            title="Cerrar documento"
          >
            <X className="w-5 h-5 text-rose-700 dark:text-rose-300" />
          </button>
        </div>
      </div>

      {/* Panel de Edición Previo a la Impresión / PDF */}
      {showEditorPanel && (
        <div className="no-print w-full max-w-4xl px-3 sm:px-6 pt-4">
          <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 sm:p-5 shadow-lg dark:shadow-2xl space-y-4`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${themeTokens.sectionDivider} pb-3`}>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-300 uppercase tracking-wide flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Redacción previa antes de imprimir o descargar PDF
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {latestEv
                    ? `Cargado automáticamente de la última evolución (${latestEv.date} · ${latestEv.time} hrs). Puede editar Subjetivo, Objetivo o agregar una nota final.`
                    : 'Este paciente no tiene evoluciones registradas aún. Puede redactar Subjetivo, Objetivo y una nota opcional.'}
                </p>
              </div>
              {latestEv && (
                <button
                  type="button"
                  onClick={handleResetFromLastEvolution}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-slate-300 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar última evolución
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Fecha de Recibimiento
                </label>
                <input
                  type="text"
                  value={fechaNota}
                  onChange={e => setFechaNota(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Hora de Recibimiento
                </label>
                <input
                  type="text"
                  value={horaNota}
                  onChange={e => setHoraNota(e.target.value)}
                  placeholder="Ej: 4:00 PM"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 mb-1">
                  Subjetivo (editable)
                </label>
                <textarea
                  rows={4}
                  value={subjetivoText}
                  onChange={e => setSubjetivoText(e.target.value)}
                  placeholder="Ej: Madre refiere mejoría clínica respecto a su ingreso. Niega emesis, diarrea, fiebre o dolor."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed outline-none resize-y"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 mb-1">
                  Objetivo (editable)
                </label>
                <textarea
                  rows={4}
                  value={objetivoText}
                  onChange={e => setObjetivoText(e.target.value)}
                  placeholder="Ej: Paciente evaluado en regulares condiciones generales, afebril, eupneico, activo, reactivo..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed outline-none resize-y"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                Nota adicional al final (opcional — dejar en blanco si no desea agregar nada)
              </label>
              <textarea
                rows={2}
                value={notaAdicional}
                onChange={e => setNotaAdicional(e.target.value)}
                placeholder="Escriba aquí alguna observación o nota final al recibimiento (opcional)..."
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed outline-none resize-y"
              />
            </div>
          </div>
        </div>
      )}

      {/* Vista previa exacta de la Hoja Carta (1 página) */}
      <div className="w-full px-2 sm:px-6 py-4 sm:py-6 overflow-x-auto flex justify-start md:justify-center">
        <div
          id="nota-recibimiento-doc"
          className="bg-white text-[#1e293b] shadow-2xl border border-[#cbd5e1] shrink-0 flex flex-col justify-between"
          style={{
            width: '215.9mm',
            minHeight: '279.4mm',
            padding: '15mm 18mm 14mm 18mm',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontFamily: 'Calibri, Arial, Helvetica, sans-serif',
            boxSizing: 'border-box'
          }}
        >
          <div>
            {/* Título Institucional */}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <h1
                style={{
                  color: '#164e78',
                  fontSize: '16.5pt',
                  fontWeight: 800,
                  letterSpacing: '0.4px',
                  margin: 0,
                  textTransform: 'uppercase'
                }}
              >
                NOTA DE RECIBIMIENTO DEL PACIENTE
              </h1>
              <p
                style={{
                  color: '#64748b',
                  fontSize: '10pt',
                  margin: '4px 0 0 0',
                  fontWeight: 500
                }}
              >
                {areaDisplay}
              </p>
            </div>

            {/* Tabla de Datos del Paciente */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '16px',
                fontSize: '10pt',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1'
              }}
            >
              <tbody>
                <tr>
                  <td style={{ width: '50%', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                    <strong style={{ color: '#164e78' }}>Fecha:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{fechaNota || '---'}</span>
                  </td>
                  <td style={{ width: '50%', padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                    <strong style={{ color: '#164e78' }}>Hora:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{horaNota || '---'}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                    <strong style={{ color: '#164e78' }}>Paciente:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{patient.lastName}, {patient.firstName}</span>
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                    <strong style={{ color: '#164e78' }}>Historia Clínica (HC N°):</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{patient.medicalHistoryNumber || '---'}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                    <strong style={{ color: '#164e78' }}>Edad:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{patient.age || '---'}</span>
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #cbd5e1' }}>
                    <strong style={{ color: '#164e78' }}>Sexo:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>
                      {patient.gender === 'M' ? 'Masculino (M)' : 'Femenino (F)'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}>
                    <strong style={{ color: '#164e78' }}>Servicio / Cama:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{patient.area} / {patient.bedNumber}</span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <strong style={{ color: '#164e78' }}>Días Hospitalización:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{diasHospFormatted}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Sección: Evolución Clínica al Recibimiento */}
            <div style={{ marginBottom: '14px' }}>
              <h2
                style={{
                  color: '#164e78',
                  fontSize: '11pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #94a3b8',
                  paddingBottom: '3px',
                  margin: '0 0 8px 0'
                }}
              >
                EVOLUCIÓN CLÍNICA AL RECIBIMIENTO
              </h2>

              <p style={{ fontSize: '10pt', lineHeight: 1.45, margin: '0 0 7px 0', whiteSpace: 'pre-wrap' }}>
                <strong style={{ color: '#0f172a' }}>Subjetivo:</strong>{' '}
                <span>{subjetivoText.trim() || '---'}</span>
              </p>

              <p style={{ fontSize: '10pt', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' }}>
                <strong style={{ color: '#0f172a' }}>Objetivo:</strong>{' '}
                <span>{objetivoText.trim() || '---'}</span>
              </p>
            </div>

            {/* Sección: Signos Vitales y Antropometría */}
            <div style={{ marginBottom: '14px' }}>
              <h2
                style={{
                  color: '#164e78',
                  fontSize: '11pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #94a3b8',
                  paddingBottom: '3px',
                  margin: '0 0 9px 0'
                }}
              >
                SIGNOS VITALES Y ANTROPOMETRÍA
              </h2>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10pt',
                  textAlign: 'center',
                  border: '1px solid #cbd5e1'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#164e78', color: '#ffffff' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>FC</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>FR</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '16.6%' }}>T°</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '19%' }}>PA</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, borderRight: '1px solid #2b6591', width: '15.6%' }}>SatO₂</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, width: '15.6%' }}>Peso</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 700 }}>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.fc}</td>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.fr}</td>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.temp}</td>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.pa}</td>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0' }}>{vitalsDisplay.satO2}</td>
                    <td style={{ padding: '7px 8px', borderTop: '1px solid #cbd5e1' }}>{vitalsDisplay.peso}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sección: Diagnósticos de Ingreso / Recibimiento */}
            <div style={{ marginBottom: '14px' }}>
              <h2
                style={{
                  color: '#164e78',
                  fontSize: '11pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #94a3b8',
                  paddingBottom: '3px',
                  margin: '0 0 8px 0'
                }}
              >
                DIAGNÓSTICOS DE INGRESO / RECIBIMIENTO
              </h2>

              <div style={{ fontSize: '10pt', lineHeight: 1.45, color: '#1e293b' }}>
                {parsedDiagnoses.map(item => (
                  <div
                    key={item.key}
                    style={{
                      paddingLeft: item.isSub ? '28px' : '12px',
                      marginBottom: '2px'
                    }}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Sección: Tratamiento Indicado */}
            <div style={{ marginBottom: notaAdicional.trim() ? '14px' : '10px' }}>
              <h2
                style={{
                  color: '#164e78',
                  fontSize: '11pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #94a3b8',
                  paddingBottom: '3px',
                  margin: '0 0 8px 0'
                }}
              >
                TRATAMIENTO INDICADO
              </h2>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10pt',
                  border: '1px solid #94a3b8'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#edf4fa', color: '#164e78' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '36%' }}>
                      Medicamento
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', width: '28%' }}>
                      Dosis
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, borderBottom: '1px solid #94a3b8', width: '36%' }}>
                      Día de Tratamiento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTreatments.map((row, idx) => (
                    <tr key={`${row.numero}-${idx}`} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        {row.medicamento}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        {row.dosis}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        {row.diaTratamiento}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Nota Adicional Opcional (solo se muestra si el médico escribió texto) */}
            {notaAdicional.trim().length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <h2
                  style={{
                    color: '#164e78',
                    fontSize: '10.5pt',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #94a3b8',
                    paddingBottom: '3px',
                    margin: '0 0 6px 0'
                  }}
                >
                  NOTA ADICIONAL
                </h2>
                <p
                  style={{
                    fontSize: '10pt',
                    lineHeight: 1.45,
                    color: '#0f172a',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}
                >
                  {notaAdicional.trim()}
                </p>
              </div>
            )}
          </div>

          {/* Firma al pie de la hoja */}
          <div style={{ paddingTop: '28px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', width: '270px', borderTop: '1px solid #334155', paddingTop: '6px' }}>
              <p style={{ fontSize: '9.5pt', color: '#475569', margin: 0, fontWeight: 600 }}>
                Médico Residente / Firma y Sello
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
