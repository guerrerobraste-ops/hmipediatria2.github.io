import React, { useState, useEffect, useRef } from 'react';
import { HistoriaClinicaPediatrica, Patient, HospitalArea } from '../types';
import { 
  DEFAULT_HISTORIA_CLINICA, 
  getPediatricNormalPhysicalExam,
  getPediatricNormalFunctionalExam,
  determinePediatricAgeGroup,
  calculatePediatricPercentiles
} from '../data/initialData';
import {
  HistoriaClinicaPDFRenderer,
  HISTORIA_LAB_PAIR_ROWS,
  getHistoriaLabValue,
  setHistoriaLabValue,
  printHistoriaClinicaDomInstant,
} from './HistoriaClinicaPDFRenderer';
import { 
  FileText, Eye, Send, Download, ArrowLeft, Stethoscope, 
  Sparkles, Printer, Edit3, X, CheckCircle, Smartphone, Maximize2,
  ChevronDown, ChevronUp, RotateCcw, Trash2, AlertTriangle, Calculator, Check, ArrowUp, MoreHorizontal,
  Lock, Unlock, Copy, Calendar, Layers, ArrowRight, Plus, Minus, Search
} from 'lucide-react';
import { isTutorialDemoId } from '../utils/tutorialDemoData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AutoExpandingTextarea } from './AutoExpandingTextarea';
import { getDraftFromIDB, saveDraftToIDB, removeDraftFromIDB } from '../services/storage';
import { sanitizeCloneForHtml2Canvas } from '../utils/pdfSanitizer';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import {
  sanitizeNumericDecimal,
  sanitizeBloodPressure,
  sanitizeLabInputValue,
  isNumericLabTest,
  isRespiratoryPanelTest,
} from '../utils/clinicalInputSanitizers';
import { formatPrintDocumentTitle, addCanvasSinglePageWithMargin } from '../utils/pdfPrinter';
import { ClinicalExamQuickFillPanel } from './ClinicalExamQuickFillPanel';
import {
  getQuickFillSection,
  toggleQuickFillOption,
  composeQuickFillClinicalText,
  mergeQuickFillWithManualNotes,
  QuickFillGroup,
  QuickFillSelectionMap,
} from '../data/clinicalExamQuickFill';
import { HistoriaQuickJumpDropdown } from './HistoriaQuickJumpDropdown';

const FIXED_MEDICO_SERVICIO_FIRMA = 'Jospeth Perez';

function toRoman(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n) || n <= 0) return String(num);
  const lookup: { [key: string]: number } = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  let tempN = n;
  for (let i in lookup) {
    while (tempN >= lookup[i]) {
      roman += i;
      tempN -= lookup[i];
    }
  }
  return roman;
}

interface Props {
  initialData?: HistoriaClinicaPediatrica;
  initialTab?: 'editor' | 'preview';
  autoOpenPrint?: boolean;
  isResumeDraft?: boolean;
  readOnly?: boolean;
  onSave: (historia: HistoriaClinicaPediatrica, autoHospitalize?: { area: HospitalArea; bedNumber: string }) => void;
  onClose: () => void;
  existingPatients: Patient[];
  historias?: HistoriaClinicaPediatrica[];
}

const DRAFT_KEY = 'hmi_historia_draft_v2';

export function calculatePediatricAgeFromBirthDate(birthDateStr: string): string {
  if (!birthDateStr) return '';
  const cleanStr = birthDateStr.trim();
  let birthYear = 0;
  let birthMonth = 0;
  let birthDay = 0;

  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        birthYear = parseInt(parts[0], 10);
        birthMonth = parseInt(parts[1], 10) - 1;
        birthDay = parseInt(parts[2], 10);
      } else {
        birthDay = parseInt(parts[0], 10);
        birthMonth = parseInt(parts[1], 10) - 1;
        birthYear = parseInt(parts[2], 10);
      }
    }
  } else if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        birthYear = parseInt(parts[0], 10);
        birthMonth = parseInt(parts[1], 10) - 1;
        birthDay = parseInt(parts[2], 10);
      } else {
        birthDay = parseInt(parts[0], 10);
        birthMonth = parseInt(parts[1], 10) - 1;
        birthYear = parseInt(parts[2], 10);
      }
    }
  }
  if (!birthYear || isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return '';

  const now = new Date();
  const birth = new Date(birthYear, birthMonth, birthDay);
  if (isNaN(birth.getTime()) || birth > now) return '';

  let years = now.getFullYear() - birthYear;
  let months = now.getMonth() - birthMonth;
  let days = now.getDate() - birthDay;

  if (days < 0) {
    months--;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  if (totalDays < 30) {
    return `${totalDays} ${totalDays === 1 ? 'día' : 'días'}`;
  }

  const totalMonths = years * 12 + months;

  // Lactante (< 2 años): en meses y días
  if (totalMonths < 24) {
    const monthStr = `${totalMonths} ${totalMonths === 1 ? 'mes' : 'meses'}`;
    if (days > 0) {
      return `${monthStr} y ${days} ${days === 1 ? 'día' : 'días'}`;
    }
    return monthStr;
  }

  // Preescolar, escolar o adolescente (>= 2 años): en años y días
  const yearStr = `${years} ${years === 1 ? 'año' : 'años'}`;
  if (days > 0) {
    return `${yearStr} y ${days} ${days === 1 ? 'día' : 'días'}`;
  }
  return yearStr;
}

export const INTERROGATORIO_ACAPITES = [
  { id: 'sec-interrogatorio-1-prenatal', label: '1. Antecedentes Prenatales y Obstétricos', short: '1. Prenatales' },
  { id: 'sec-interrogatorio-2-neonatal', label: '2. Período Neonatal', short: '2. Neonatal' },
  { id: 'sec-interrogatorio-3-alimentacion', label: '3. Alimentación', short: '3. Alimentación' },
  { id: 'sec-interrogatorio-4-desarrollo', label: '4. Desarrollo Psicomotor', short: '4. Desarrollo' },
  { id: 'sec-interrogatorio-5-habitos', label: '5. Hábitos Psicobiológicos', short: '5. Hábitos' },
  { id: 'sec-interrogatorio-6-inmunizaciones', label: '6. Inmunizaciones y Pruebas', short: '6. Vacunas' },
  { id: 'sec-interrogatorio-7-personales', label: '7. Ant. Patológicos Personales', short: '7. Patológicos' },
  { id: 'sec-interrogatorio-8-familiares', label: '8. Historia Familiar', short: '8. Familiares' }
];

export const EXAMEN_FUNCIONAL_SISTEMAS = [
  { key: 'examenFuncionalGeneral' as const, label: '1. Examen Funcional General', short: '1. General' },
  { key: 'pielFuncional' as const, label: '2. Piel', short: '2. Piel' },
  { key: 'cabezaFuncional' as const, label: '3. Cabeza', short: '3. Cabeza' },
  { key: 'ojosFuncional' as const, label: '4. Ojos', short: '4. Ojos' },
  { key: 'oidosFuncional' as const, label: '5. Oídos', short: '5. Oídos' },
  { key: 'narizFuncional' as const, label: '6. Nariz', short: '6. Nariz' },
  { key: 'bocaFuncional' as const, label: '7. Boca', short: '7. Boca' },
  { key: 'respiratorioFuncional' as const, label: '8. Respiratorio', short: '8. Respiratorio' },
  { key: 'osteomioarticularFuncional' as const, label: '9. Osteomioarticular', short: '9. Osteomioart.' },
  { key: 'cardiovascularFuncional' as const, label: '10. Cardiovascular', short: '10. Cardiovascular' },
  { key: 'gastrointestinalFuncional' as const, label: '11. Gastrointestinal', short: '11. Gastrointestinal' },
  { key: 'genitourinarioFuncional' as const, label: '12. Genitourinario', short: '12. Genitourinario' },
  { key: 'ginecologicosFuncional' as const, label: '13. Ginecológicos', short: '13. Ginecológicos' },
  { key: 'nerviosoCentralFuncional' as const, label: '14. Nervioso Central', short: '14. Nervioso Central' }
];

export const EXAMEN_FISICO_ITEMS_LIST = [
  { key: 'estadoGeneralFisico' as const, label: '1. Estado General', short: '1. General' },
  { key: 'pielPaniculoFanerasFisico' as const, label: '2. Piel, Panículo Adiposo y Faneras', short: '2. Piel' },
  { key: 'cabezaFisico' as const, label: '3. Cabeza', short: '3. Cabeza' },
  { key: 'ojosFisico' as const, label: '4. Ojos', short: '4. Ojos' },
  { key: 'oidosFisico' as const, label: '5. Oídos', short: '5. Oídos' },
  { key: 'rinofaringeFisico' as const, label: '6. Rinofaringe', short: '6. Rinofaringe' },
  { key: 'bocaFisico' as const, label: '7. Boca', short: '7. Boca' },
  { key: 'cuelloFisico' as const, label: '8. Cuello', short: '8. Cuello' },
  { key: 'gangliosLinfaticosFisico' as const, label: '9. Ganglios Linfáticos', short: '9. Ganglios' },
  { key: 'toraxPulmonesFisico' as const, label: '10. Tórax y Pulmones', short: '10. Tórax/Pulmones' },
  { key: 'cardiovascularFisico' as const, label: 'Cardiovascular (Corazón y Vasos)', short: 'Cardiovascular' },
  { key: 'abdomenFisico' as const, label: '11. Abdomen', short: '11. Abdomen' },
  { key: 'urinarioFisico' as const, label: '12. Urinario', short: '12. Urinario' },
  { key: 'genitalesFisico' as const, label: '13. Genitales', short: '13. Genitales' },
  { key: 'anoRectoFisico' as const, label: '14. Ano y Recto', short: '14. Ano/Recto' },
  { key: 'huesosArticulacionesMuslosFisico' as const, label: '15. Huesos, Articulaciones y Músculos', short: '15. Osteomusc.' },
  { key: 'neurologicoPsiquicoFisico' as const, label: '16. Neurológico y Psíquico', short: '16. Neurológico' },
  { key: 'sensorialesFisico' as const, label: '17. Sensoriales', short: '17. Sensoriales' }
];

export const LAB_PANELS = [
  {
    category: 'Hematología y Coagulación',
    badge: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30',
    tests: [
      { name: 'Hemoglobina', alias: 'HEMOGLOBINA', unit: 'g/dL', ref: '11.5 - 14.5 g/dL', placeholder: '12.8' },
      { name: 'Hematocrito', alias: 'HEMATOCRITO', unit: '%', ref: '33 - 43 %', placeholder: '38' },
      { name: 'VCM', alias: 'VCM', unit: 'fL', ref: '78 - 100 fL', placeholder: '84' },
      { name: 'HCM', alias: 'HCM', unit: 'pg', ref: '27 - 31 pg', placeholder: '29' },
      { name: 'CHCM', alias: 'CHCM', unit: 'g/dL', ref: '32 - 36 g/dL', placeholder: '34' },
      { name: 'Leucocitos', alias: 'GLÓBULOS BLANCOS', unit: '10³/µL', ref: '5.0 - 12.0 10³/µL', placeholder: '8.5' },
      { name: 'Seg. Neutrófilos', alias: 'NEUTRÓFILOS SEGMENTADOS', unit: '%', ref: '40 - 60 %', placeholder: '55' },
      { name: 'Linfocitos', alias: 'LINFOCITOS', unit: '%', ref: '30 - 50 %', placeholder: '35' },
      { name: 'Monocitos', alias: 'MONOCITOS', unit: '%', ref: '2 - 8 %', placeholder: '5' },
      { name: 'Eosinófilos', alias: 'EOSINÓFILOS', unit: '%', ref: '1 - 4 %', placeholder: '2' },
      { name: 'Plaquetas', alias: 'PLAQUETAS', unit: '10³/µL', ref: '150 - 450 10³/µL', placeholder: '250' },
      { name: 'Reticulocitos', alias: 'RETICULOCITOS', unit: '%', ref: '0.5 - 1.5 %', placeholder: '1.0' },
      { name: 'TP', alias: 'PT', unit: 'seg', ref: '11 - 15 seg', placeholder: '13' },
      { name: 'TTP', alias: 'PTT', unit: 'seg', ref: '25 - 35 seg', placeholder: '29' },
      { name: 'Fibrinógeno', alias: 'FIBRINÓGENO', unit: 'mg/dL', ref: '200 - 400 mg/dL', placeholder: '300' },
      { name: 'Grupo y Rh', alias: 'GRUPO Y RH', unit: '', ref: 'Tipiaje', placeholder: 'O Rh+' },
      { name: 'VSG', alias: 'VSG / VAS', unit: 'mm/h', ref: '0 - 20 mm/h', placeholder: '10' },
    ]
  },
  {
    category: 'Química Sanguínea',
    badge: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
    tests: [
      { name: 'Glicemia', alias: 'GLICEMIA', unit: 'mg/dL', ref: '70 - 100 mg/dL', placeholder: '88' },
      { name: 'Urea', alias: 'UREA', unit: 'mg/dL', ref: '15 - 40 mg/dL', placeholder: '24' },
      { name: 'BUN', alias: 'BUN', unit: 'mg/dL', ref: '7 - 20 mg/dL', placeholder: '12' },
      { name: 'Creatinina', alias: 'CREATININA', unit: 'mg/dL', ref: '0.3 - 0.7 mg/dL', placeholder: '0.5' },
      { name: 'Ácido Úrico', alias: 'ÁCIDO ÚRICO', unit: 'mg/dL', ref: '2.0 - 5.5 mg/dL', placeholder: '3.5' },
      { name: 'TGO (AST)', alias: 'TGO', unit: 'U/L', ref: '10 - 40 U/L', placeholder: '25' },
      { name: 'TGP (ALT)', alias: 'TGP', unit: 'U/L', ref: '10 - 40 U/L', placeholder: '22' },
      { name: 'Fosfatasa Alcalina', alias: 'FOSFATASA ALCALINA', unit: 'U/L', ref: '40 - 400 U/L', placeholder: '180' },
      { name: 'GGT', alias: 'GGT', unit: 'U/L', ref: '5 - 40 U/L', placeholder: '15' },
      { name: 'Bilirrubina Total', alias: 'BILIRRUBINA TOTAL', unit: 'mg/dL', ref: '< 1.0 mg/dL', placeholder: '0.6' },
      { name: 'Bilirrubina Directa', alias: 'BILIRRUBINA DIRECTA', unit: 'mg/dL', ref: '< 0.3 mg/dL', placeholder: '0.2' },
      { name: 'Bilirrubina Indirecta', alias: 'BILIRRUBINA INDIRECTA', unit: 'mg/dL', placeholder: '0.4', ref: '< 0.7 mg/dL' },
      { name: 'Proteínas Totales', alias: 'PROTEÍNAS TOTALES', unit: 'g/dL', ref: '6.0 - 8.0 g/dL', placeholder: '6.8' },
      { name: 'Albúmina', alias: 'ALBÚMINA', unit: 'g/dL', ref: '3.5 - 5.0 g/dL', placeholder: '4.1' },
      { name: 'Globulina', alias: 'GLOBULINAS', unit: 'g/dL', ref: '2.0 - 3.5 g/dL', placeholder: '2.7' },
      { name: 'Amilasa', alias: 'AMILASA', unit: 'U/L', ref: '20 - 110 U/L', placeholder: '55' },
      { name: 'Lipasa', alias: 'LIPASA', unit: 'U/L', ref: '0 - 160 U/L', placeholder: '45' },
      { name: 'LDH', alias: 'DESHIDROGENASA LÁCTICA', unit: 'U/L', ref: '140 - 280 U/L', placeholder: '200' },
      { name: 'Colesterol Total', alias: 'COLESTEROL', unit: 'mg/dL', ref: '< 200 mg/dL', placeholder: '145' },
      { name: 'Triglicéridos', alias: 'TRIGLICÉRIDOS', unit: 'mg/dL', ref: '< 150 mg/dL', placeholder: '95' },
      { name: 'PCR', alias: 'PCR (Cuantitativa)', unit: 'mg/L', ref: '< 5 mg/L', placeholder: '1.2' },
      { name: 'Procalcitonina', alias: 'PROCALCITONINA', unit: 'ng/mL', ref: '< 0.5 ng/mL', placeholder: '0.1' },
    ]
  },
  {
    category: 'Electrolitos y Minerales',
    badge: 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/30',
    tests: [
      { name: 'Sodio (Na)', alias: 'SODIO', unit: 'mEq/L', ref: '135 - 145 mEq/L', placeholder: '138' },
      { name: 'Potasio (K)', alias: 'POTASIO', unit: 'mEq/L', ref: '3.5 - 5.0 mEq/L', placeholder: '4.2' },
      { name: 'Cloro (Cl)', alias: 'CLORO', unit: 'mEq/L', ref: '98 - 106 mEq/L', placeholder: '102' },
      { name: 'Calcio (Ca) Total', alias: 'CALCIO', unit: 'mg/dL', ref: '8.5 - 10.5 mg/dL', placeholder: '9.4' },
      { name: 'Calcio Iónico', alias: 'Ca++ (Gasometría)', unit: 'mmol/L', ref: '1.1 - 1.3 mmol/L', placeholder: '1.20' },
      { name: 'Magnesio (Mg)', alias: 'MAGNESIO', unit: 'mEq/L', ref: '1.5 - 2.5 mEq/L', placeholder: '2.0' },
      { name: 'Fósforo (P)', alias: 'FÓSFORO', unit: 'mg/dL', ref: '3.0 - 5.5 mg/dL', placeholder: '4.4' },
    ]
  },
  {
    category: 'Gases Arteriales',
    badge: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30',
    tests: [
      { name: 'pH', alias: 'Ph', unit: '', ref: '7.35 - 7.45', placeholder: '7.40' },
      { name: 'pCO2', alias: 'pCO2', unit: 'mmHg', ref: '35 - 45 mmHg', placeholder: '38' },
      { name: 'pO2', alias: 'PO2', unit: 'mmHg', ref: '80 - 100 mmHg', placeholder: '95' },
      { name: 'HCO3', alias: 'HCO3', unit: 'mEq/L', ref: '22 - 26 mEq/L', placeholder: '24' },
      { name: 'TCO2', alias: 'TCO2', unit: 'mmol/L', ref: '23 - 27 mmol/L', placeholder: '25' },
      { name: 'EB', alias: 'E. BASE', unit: 'mEq/L', ref: '-2 a +2 mEq/L', placeholder: '0' },
      { name: 'SatO2', alias: 'SatO2', unit: '%', ref: '> 95 %', placeholder: '98' },
      { name: 'Lactato', alias: 'Lactato', unit: 'mmol/L', ref: '0.5 - 2.0 mmol/L', placeholder: '1.1' },
    ]
  },
  {
    category: 'Orina y Heces',
    badge: 'bg-teal-100 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/30',
    tests: [
      { name: 'Uroanálisis', alias: 'UROANÁLISIS', unit: '', ref: 'Físico/Químico', placeholder: 'Normal' },
      { name: 'Densidad', alias: 'Densidad', unit: '', ref: '1.005 - 1.030', placeholder: '1.015' },
      { name: 'pH Orina', alias: 'URO - pH', unit: '', ref: '4.5 - 8.0', placeholder: '6.0' },
      { name: 'Sedimento', alias: 'Sedimento', unit: '', ref: 'Microscópico', placeholder: 'Leucocitos 0-2 xc' },
      { name: 'Coprológico', alias: 'COPROANÁLISIS', unit: '', ref: 'Parasitológico', placeholder: 'No se observan parásitos' },
      { name: 'Sangre Oculta', alias: 'COPRO - SANG. OCULTA', unit: '', ref: 'Negativo', placeholder: 'Negativo' },
    ]
  },
  {
    category: 'Microbiología, LCR y Serología',
    badge: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
    tests: [
      { name: 'Hemocultivo', alias: 'HEMOCULTIVO', unit: '', ref: 'Sin crecimiento', placeholder: 'Sin crecimiento' },
      { name: 'Urocultivo', alias: 'UROCULTIVO', unit: '', ref: 'Sin crecimiento', placeholder: 'Sin crecimiento' },
      { name: 'Coprocultivo', alias: 'COPROCULTIVO', unit: '', ref: 'Sin crecimiento', placeholder: 'Sin crecimiento' },
      { name: 'Cultivo LCR', alias: 'Cultivo LCR', unit: '', ref: 'Sin crecimiento', placeholder: 'Sin crecimiento' },
      { name: 'Cultivo Secreción', alias: 'Cultivo Secreción', unit: '', ref: 'Sin crecimiento', placeholder: 'Sin crecimiento' },
      { name: 'Aspecto LCR', alias: 'Aspecto LCR', unit: '', ref: 'Cristal de roca', placeholder: 'Cristal de roca' },
      { name: 'Células LCR', alias: 'Células LCR', unit: '/mm³', ref: '0 - 5 /mm³', placeholder: '2' },
      { name: 'Glucosa LCR', alias: 'Glucosa LCR', unit: 'mg/dL', ref: '50 - 80 mg/dL', placeholder: '60' },
      { name: 'Proteínas LCR', alias: 'Proteínas LCR', unit: 'mg/dL', ref: '15 - 45 mg/dL', placeholder: '25' },
      { name: 'Pandy', alias: 'Pandy', unit: '', ref: 'Negativo', placeholder: 'Negativo' },
      { name: 'VDRL / Sífilis', alias: 'VDRL / Sífilis', unit: '', ref: 'No reactivo', placeholder: 'No reactivo' },
      { name: 'VIH', alias: 'VIH', unit: '', ref: 'Negativo', placeholder: 'Negativo' },
    ]
  },
  {
    category: 'Panel Respiratorio',
    badge: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30',
    tests: [
      {
        name: 'Panel Respiratorio',
        alias: 'PANEL RESPIRATORIO',
        unit: '',
        ref: '',
        placeholder: 'Ej. VSR positivo, Influenza A negativo, Rinovirus...'
      },
    ]
  }
];

export const VACUNACION_ESQUEMA = [
  { id: 'rn', label: 'Al nacer: BCG + HB neonatal', key: 'Al nacer' },
  { id: '2m', label: '2 meses: Pentavalente (1ra), Polio (1ra), Neumococo (1ra), Rotavirus (1ra)', key: '2 meses' },
  { id: '4m', label: '4 meses: Pentavalente (2da), Polio (2da), Neumococo (2da), Rotavirus (2da)', key: '4 meses' },
  { id: '6m', label: '6 meses: Pentavalente (3ra), Polio (3ra), Neumococo (3ra), Influenza', key: '6 meses' },
  { id: '1a', label: '1 año: Fiebre Amarilla, SRP Trivalente Viral, Refuerzo Neumococo', key: '1 año' }
];

/**
 * Safely prepares and merges a Historia Clinica with pediatric normal defaults:
 * - Preserves ALL existing non-empty values (especially Examen Físico, Examen Funcional, Interrogatorio)
 * - Only fills blank/empty fields with age/gender appropriate defaults
 * - Automatically unlocks fields that contain custom non-default edits
 * - Sanitizes all text fields so SyntheticEvents or invalid objects are never retained
 */
export function prepareHistoriaData(
  source: Partial<HistoriaClinicaPediatrica> | undefined,
  defaultGender: 'niño' | 'niña' = 'niño'
): { data: HistoriaClinicaPediatrica; unlocked: Record<string, boolean> } {
  const effGender = (source?.generoPatient as 'niño' | 'niña') || defaultGender;
  const effAge = source?.edad || (source?.fechaNacimiento ? calculatePediatricAgeFromBirthDate(source.fechaNacimiento) : '');
  const normalPhys = getPediatricNormalPhysicalExam(effAge, effGender);
  const normalFunc = getPediatricNormalFunctionalExam(effAge, effGender);

  const base: HistoriaClinicaPediatrica = {
    ...DEFAULT_HISTORIA_CLINICA,
    ...normalPhys,
    ...normalFunc,
    ...(source || {}),
    id: source?.id || ('hc-' + Date.now()),
    generoPatient: effGender,
    edad: effAge || source?.edad || '',
    fechaIngreso: source?.fechaIngreso || new Date().toISOString().split('T')[0],
    horaIngreso: source?.horaIngreso || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  };

  const unlocked: Record<string, boolean> = { ...(source?.customizedExamFields || {}) };

  // Preserve user physical exam values; only populate default if completely empty or missing
  EXAMEN_FISICO_ITEMS_LIST.forEach(item => {
    const rawVal = source ? (source as any)[item.key] : undefined;
    const defaultVal = normalPhys[item.key] || '';
    if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
      let cleanedVal = rawVal;
      if (item.key === 'estadoGeneralFisico' && !source?.customizedExamFields?.estadoGeneralFisico) {
        cleanedVal = cleanedVal
          .replace(/en regulares\/buenas condiciones generales/gi, 'en regulares condiciones generales')
          .replace(/en buenas condiciones generales/gi, 'en regulares condiciones generales')
          .replace(/febril\/afebril al tacto/gi, 'afebril al tacto');
      }
      (base as any)[item.key] = cleanedVal;
      if (source?.customizedExamFields?.[item.key] || cleanedVal.trim() !== defaultVal.trim()) {
        unlocked[item.key] = true;
      }
    } else if (rawVal !== undefined && source?.customizedExamFields?.[item.key]) {
      (base as any)[item.key] = rawVal;
      unlocked[item.key] = true;
    } else {
      (base as any)[item.key] = defaultVal;
    }
  });

  // Preserve user functional exam values; only populate default if completely empty or missing
  EXAMEN_FUNCIONAL_SISTEMAS.forEach(item => {
    const rawVal = source ? (source as any)[item.key] : undefined;
    const defaultVal = normalFunc[item.key] || '';
    if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
      (base as any)[item.key] = rawVal;
      if (source?.customizedExamFields?.[item.key] || rawVal.trim() !== defaultVal.trim()) {
        unlocked[item.key] = true;
      }
    } else if (rawVal !== undefined && source?.customizedExamFields?.[item.key]) {
      (base as any)[item.key] = rawVal;
      unlocked[item.key] = true;
    } else {
      (base as any)[item.key] = defaultVal;
    }
  });

  // Sanitize text fields that might have received event objects
  const sanitizeStr = (v: any, fallback = ''): string => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (v && typeof v === 'object' && v.target && typeof v.target.value === 'string') return v.target.value;
    return fallback;
  };

  base.resumenComentario = sanitizeStr(base.resumenComentario);
  base.resumenHistoriaEnfermedad = sanitizeStr(base.resumenHistoriaEnfermedad, 'Se trata de...');
  base.resumenRxTorax = sanitizeStr(base.resumenRxTorax);
  base.resumenDiagnosticosIngreso = sanitizeStr(base.resumenDiagnosticosIngreso);
  base.motivosAdmision = sanitizeStr(base.motivosAdmision);
  base.enfermedadActual = sanitizeStr(base.enfermedadActual);
  base.diagnosticoAdmision = sanitizeStr(base.diagnosticoAdmision);

  const defaultDocSig = resolveRegisteredDoctorSignatureName();
  if (!sanitizeStr(base.medicoAdmisionFirma).trim() || base.medicoAdmisionFirma.trim() === 'Dr. Brayan' || base.medicoAdmisionFirma.trim() === 'Administrador') {
    base.medicoAdmisionFirma = defaultDocSig;
  }
  base.medicoServicioFirma = FIXED_MEDICO_SERVICIO_FIRMA;
  if (!sanitizeStr(base.examenPracticadoPor).trim() || base.examenPracticadoPor.trim() === 'Dr. Brayan' || base.examenPracticadoPor.trim() === 'Administrador') {
    base.examenPracticadoPor = defaultDocSig;
  }

  // Sync Emergency Contact & Parentesco (Page 1 <-> Page 2)
  const respName = sanitizeStr(base.enCasoEmergenciaVisarA).trim() || sanitizeStr(base.reglamentoFirma1).trim() || sanitizeStr(base.exencionFirma).trim();
  if (respName) {
    if (!sanitizeStr(base.enCasoEmergenciaVisarA).trim()) base.enCasoEmergenciaVisarA = respName;
    if (!sanitizeStr(base.reglamentoFirma1).trim()) base.reglamentoFirma1 = respName;
  }
  const respParentesco = sanitizeStr(base.parentescoEmergencia).trim() || sanitizeStr(base.reglamentoParentesco1).trim() || sanitizeStr(base.exencionParentesco).trim();
  if (respParentesco) {
    if (!sanitizeStr(base.parentescoEmergencia).trim()) base.parentescoEmergencia = respParentesco;
    if (!sanitizeStr(base.reglamentoParentesco1).trim()) base.reglamentoParentesco1 = respParentesco;
  }

  if (!sanitizeStr(base.desarrolloTabulador).trim()) {
    const fmtDev = (v: string | undefined, def: string) => {
      const clean = sanitizeStr(v).trim();
      if (!clean) return `${def} meses`;
      if (clean.toLowerCase().includes('aún') || clean.toLowerCase().includes('aun')) return 'aún no desarrollado';
      return `${clean} meses`;
    };
    base.desarrolloTabulador = [
      `Sostén cefálico: ${fmtDev(base.desarrolloCabezaMeses, '3')},`,
      `se sentó: ${fmtDev(base.desarrolloSentoMeses, '6')},`,
      `se paró: ${fmtDev(base.desarrolloParoMeses, '10')},`,
      `caminó: ${fmtDev(base.desarrolloCaminoMeses, '12')},`,
      `control de esfínter: ${fmtDev(base.desarrolloEsfinterMeses, '24')},`,
      `primer diente: ${fmtDev(base.desarrolloDienteMeses, '7')},`,
      `primeras palabras: ${fmtDev(base.desarrolloPalabrasMeses, '10')}.`
    ].join('\n');
  }
  base.customizedExamFields = unlocked;

  return { data: base, unlocked };
}

export function resolveRegisteredDoctorSignatureName(): string {
  if (typeof window !== 'undefined') {
    const role = (localStorage.getItem('hmi_user_role') || '').trim().toLowerCase();
    const username = (localStorage.getItem('hmi_username') || '').trim().toLowerCase();
    const savedName = (localStorage.getItem('hmi_user_name') || '').trim();
    const savedGender = localStorage.getItem('hmi_user_gender') === 'F' ? 'F' : 'M';

    if (
      role === 'admin' ||
      username === 'admin' ||
      savedName.toLowerCase() === 'administrador' ||
      savedName.toLowerCase() === 'dr. brayan'
    ) {
      return 'Dr. Brayan Guerrero';
    }

    if (savedName) {
      if (/^(dr\.?|dra\.?)\s+/i.test(savedName)) return savedName;
      return `${savedGender === 'F' ? 'Dra.' : 'Dr.'} ${savedName}`;
    }

    if (username) {
      return `${savedGender === 'F' ? 'Dra.' : 'Dr.'} ${username}`;
    }
  }
  return 'Dr. Brayan Guerrero';
}

export const PRENATAL_PATOLOGIAS_KEYS = ['ITU', 'ITV', 'Diabetes', 'HTA'] as const;
export type PrenatalPatologiaKey = typeof PRENATAL_PATOLOGIAS_KEYS[number];

export interface PrenatalPatologiaItemState {
  selected: boolean;
  tratada: 'tratada' | 'no tratada';
  medicamento: string;
}

export type PrenatalPatologiasMap = Record<PrenatalPatologiaKey, PrenatalPatologiaItemState>;

function formatSpanishConjunction(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

export function buildPrenatalInfeccionesText(state: PrenatalPatologiasMap): string {
  const selectedKeys = PRENATAL_PATOLOGIAS_KEYS.filter(k => state[k]?.selected);
  const unselectedKeys = PRENATAL_PATOLOGIAS_KEYS.filter(k => !state[k]?.selected);

  if (selectedKeys.length === 0) {
    return `Niega ${formatSpanishConjunction([...PRENATAL_PATOLOGIAS_KEYS])}`;
  }

  const selectedDescriptions = selectedKeys.map(k => {
    const item = state[k];
    if (item.tratada === 'tratada') {
      const med = (item.medicamento || '').trim();
      return med ? `${k} tratada (${med})` : `${k} tratada`;
    }
    return `${k} no tratada`;
  });

  const refierePart = `Refiere ${selectedDescriptions.join(', ')}`;
  if (unselectedKeys.length === 0) {
    return refierePart;
  }
  return `${refierePart}. Niega ${formatSpanishConjunction([...unselectedKeys])}`;
}

function parsePrenatalPatologiasFromText(rawText?: string): PrenatalPatologiasMap {
  const initial: PrenatalPatologiasMap = {
    ITU: { selected: false, tratada: 'tratada', medicamento: '' },
    ITV: { selected: false, tratada: 'tratada', medicamento: '' },
    Diabetes: { selected: false, tratada: 'tratada', medicamento: '' },
    HTA: { selected: false, tratada: 'tratada', medicamento: '' },
  };
  const text = (rawText || '').trim();
  if (!text) return initial;

  // Extract only the "Refiere ..." segment before any "Niega ..." segment
  const refierePart = text.split(/\.?\s*\bniega\b/i)[0] || '';
  if (!/\brefiere\b/i.test(refierePart) && /^\s*niega\b/i.test(text)) {
    return initial;
  }

  const targetSegment = refierePart || text;
  PRENATAL_PATOLOGIAS_KEYS.forEach(key => {
    const regex = new RegExp(`\\b${key}\\b(?:\\s+(no\\s+tratada|tratada))?(?:\\s*\\(([^)]*)\\))?`, 'i');
    const match = targetSegment.match(regex);
    if (match) {
      const tratadaRaw = (match[1] || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const isNoTratada = tratadaRaw === 'no tratada';
      const med = !isNoTratada && match[2] ? match[2].trim() : '';
      initial[key] = {
        selected: true,
        tratada: isNoTratada ? 'no tratada' : 'tratada',
        medicamento: med,
      };
    }
  });

  return initial;
}

interface DxNode {
  id: string;
  numberStr: string;
  text: string;
  level: number; // 1, 2, 3
}

function parseDiagnosesText(text: string): DxNode[] {
  if (!text) return [{ id: 'd-1', numberStr: '1.', text: '', level: 1 }];
  const lines = text.split(/\r?\n/);
  const nodes: DxNode[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([\d\.]+)\s*(.*)$/);
    if (match) {
      const numStr = match[1].replace(/\.$/, '');
      const content = match[2] || '';
      const dots = (numStr.match(/\./g) || []).length;
      nodes.push({
        id: 'dx-' + idx + '-' + Math.random().toString(36).substring(2, 6),
        numberStr: numStr,
        text: content,
        level: dots === 0 ? 1 : dots === 1 ? 2 : 3
      });
    } else {
      nodes.push({
        id: 'dx-' + idx + '-' + Math.random().toString(36).substring(2, 6),
        numberStr: String(nodes.length + 1),
        text: trimmed,
        level: 1
      });
    }
  });
  return nodes.length > 0 ? nodes : [{ id: 'd-1', numberStr: '1.', text: '', level: 1 }];
}

function serializeDiagnosesNodes(nodes: DxNode[]): string {
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;

  const lines: string[] = [];
  nodes.forEach((node) => {
    if (node.level === 1) {
      mainCount++;
      subCount = 0;
      subSubCount = 0;
      node.numberStr = `${mainCount}.`;
      lines.push(`${node.numberStr} ${node.text}`);
    } else if (node.level === 2) {
      subCount++;
      subSubCount = 0;
      node.numberStr = `${mainCount}.${subCount}`;
      lines.push(`   ${node.numberStr} ${node.text}`);
    } else {
      subSubCount++;
      node.numberStr = `${mainCount}.${subCount}.${subSubCount}`;
      lines.push(`     ${node.numberStr} ${node.text}`);
    }
  });
  return lines.join('\n');
}

export const HistoriaClinicaForm: React.FC<Props> = ({ 
  initialData, 
  initialTab = 'editor',
  autoOpenPrint = false,
  isResumeDraft = false,
  readOnly = false,
  onSave, 
  onClose, 
  existingPatients,
  historias
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  // Initialize formData & unlocked fields preserving all saved exams and customizations
  const [formData, setFormData] = useState<HistoriaClinicaPediatrica>(() => {
    return prepareHistoriaData(initialData).data;
  });

  const [dxNodes, setDxNodes] = useState<Array<{ id: string; numberStr: string; text: string; level: number }>>(() => {
    return parseDiagnosesText(initialData?.diagnosticoAdmision || '');
  });

  const handleAddDxMain = () => {
    const nextNodes = [...dxNodes, { id: 'dx-' + Date.now(), numberStr: '', text: '', level: 1 }];
    setDxNodes(nextNodes);
    handleChange('diagnosticoAdmision', serializeDiagnosesNodes(nextNodes));
  };

  const handleAddDxSub = (index: number) => {
    const nextNodes = [...dxNodes];
    nextNodes.splice(index + 1, 0, { id: 'dx-' + Date.now(), numberStr: '', text: '', level: 2 });
    setDxNodes(nextNodes);
    handleChange('diagnosticoAdmision', serializeDiagnosesNodes(nextNodes));
  };

  const handleAddDxSubSub = (index: number) => {
    const nextNodes = [...dxNodes];
    nextNodes.splice(index + 1, 0, { id: 'dx-' + Date.now(), numberStr: '', text: '', level: 3 });
    setDxNodes(nextNodes);
    handleChange('diagnosticoAdmision', serializeDiagnosesNodes(nextNodes));
  };

  const handleUpdateDxNodeText = (index: number, text: string) => {
    const nextNodes = [...dxNodes];
    nextNodes[index].text = text;
    setDxNodes(nextNodes);
    handleChange('diagnosticoAdmision', serializeDiagnosesNodes(nextNodes));
  };

  const handleDeleteDxNode = (index: number) => {
    const nextNodes = dxNodes.filter((_, i) => i !== index);
    const finalNodes = nextNodes.length > 0 ? nextNodes : [{ id: 'dx-1', numberStr: '1.', text: '', level: 1 }];
    setDxNodes(finalNodes);
    handleChange('diagnosticoAdmision', serializeDiagnosesNodes(finalNodes));
  };

  // Track which fields are unlocked/customized for manual modification (Page 4 & 5)
  const [unlockedExamFields, setUnlockedExamFields] = useState<Record<string, boolean>>(() => {
    return initialData?.customizedExamFields || prepareHistoriaData(initialData).unlocked;
  });

  const [prenatalPatologias, setPrenatalPatologias] = useState<PrenatalPatologiasMap>(() =>
    parsePrenatalPatologiasFromText(initialData?.prenatalInfecciones)
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  const isEditingExisting = Boolean(
    initialData && (
      initialData.patientId ||
      historias?.some(h => h.id === initialData.id)
    )
  );

  // Sync formData when initialData or mode changes (strictly isolated: New vs Edit)
  useEffect(() => {
    if (initialData) {
      const { data, unlocked } = prepareHistoriaData(initialData);
      setFormData(data);
      setPrenatalPatologias(parsePrenatalPatologiasFromText(data.prenatalInfecciones));
      setDxNodes(parseDiagnosesText(initialData.diagnosticoAdmision || ''));
      setUnlockedExamFields(initialData.customizedExamFields || unlocked);
    } else if (!isResumeDraft) {
      const { data } = prepareHistoriaData(undefined);
      setFormData(data);
      setPrenatalPatologias(parsePrenatalPatologiasFromText(data.prenatalInfecciones));
      setDxNodes([{ id: 'd-1', numberStr: '1.', text: '', level: 1 }]);
      setUnlockedExamFields({});
    }
  }, [initialData?.id, isResumeDraft]);

  // Load draft ONLY if explicit draft resume for a new history, or isolated per-patient draft
  useEffect(() => {
    // When creating a brand-new history without resuming a draft, start completely clean
    if (!initialData && !isResumeDraft) {
      return;
    }

    // If an existing saved history was provided in initialData and is in the database,
    // DO NOT overwrite it with stale drafts or global drafts!
    if (initialData && !isResumeDraft && initialData.id && historias?.some(h => h.id === initialData.id)) {
      const pKey = initialData.patientId || initialData.id;
      saveDraftToIDB(`historia_draft_${pKey}`, initialData);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(initialData));
      }
      return;
    }

    const patientKey = initialData?.patientId || initialData?.id;
    const draftIdbKey = patientKey ? `historia_draft_${patientKey}` : DRAFT_KEY;
    const isNewHistory = !initialData || (initialData.id && !historias?.find(h => h.id === initialData.id));

    // Only for explicit draft resume or unsaved patient draft, look up IDB and emergency localStorage
    Promise.all([
      getDraftFromIDB<HistoriaClinicaPediatrica>(draftIdbKey),
      isNewHistory && isResumeDraft ? getDraftFromIDB<HistoriaClinicaPediatrica>(DRAFT_KEY) : null
    ]).then(([patientDraft, globalDraft]) => {
      let saved = patientDraft;
      if (!saved && globalDraft && isResumeDraft && !isEditingExisting) {
        const patientMismatch = initialData?.patientId && globalDraft.patientId && initialData.patientId !== globalDraft.patientId;
        if (!patientMismatch) saved = globalDraft;
      }

      // Fallback to localStorage emergency backup ONLY if explicit resume
      if (!saved && isResumeDraft && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(patientKey ? `historia_backup_${patientKey}` : 'historia_last_active_backup');
          if (raw) saved = JSON.parse(raw);
        } catch {}
      }

      if (saved && typeof saved === 'object') {
        const patientMismatch = initialData?.patientId && saved.patientId && initialData.patientId !== saved.patientId;
        if (!patientMismatch) {
          const { data: preparedDraft, unlocked: preparedUnlocked } = prepareHistoriaData(saved);
          setFormData(prev => ({
            ...prev,
            ...preparedDraft,
            id: initialData?.id || preparedDraft.id || prev.id,
            patientId: initialData?.patientId || preparedDraft.patientId || prev.patientId,
            nombres: preparedDraft.nombres || prev.nombres,
            apellidos: preparedDraft.apellidos || prev.apellidos,
            numHistoria: preparedDraft.numHistoria || prev.numHistoria,
            edad: preparedDraft.edad || prev.edad
          }));
          setDxNodes(parseDiagnosesText(preparedDraft.diagnosticoAdmision || ''));
          setUnlockedExamFields(prev => ({ ...prev, ...preparedUnlocked, ...(saved.customizedExamFields || {}) }));
          setDraftLoaded(true);
          setTimeout(() => setDraftLoaded(false), 4000);
        }
      }
    });
  }, [initialData?.id, isResumeDraft]);

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>(
    readOnly ? 'preview' : autoOpenPrint ? 'preview' : (initialTab || 'editor')
  );

  useEffect(() => {
    if (readOnly) {
      setActiveTab('preview');
    } else if (autoOpenPrint) {
      setActiveTab('preview');
    } else {
      setActiveTab(initialTab || 'editor');
    }
  }, [initialTab, autoOpenPrint, readOnly, isResumeDraft]);

  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [selectedLabSampleIdx, setSelectedLabSampleIdx] = useState<number | 'all'>(0);
  const [expandedLabPanels, setExpandedLabPanels] = useState<Record<string, boolean>>({});
  const [labSearchQuery, setLabSearchQuery] = useState<string>('');
  const [highlightedLabTest, setHighlightedLabTest] = useState<string | null>(null);
  const [previewScaleMode, setPreviewScaleMode] = useState<'fit' | number>('fit');

  const getLabTestElementId = (testName: string) =>
    `lab-test-card-${testName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`;

  const jumpToLabTest = (category: string, testName: string) => {
    if (selectedLabSampleIdx === 'all') {
      setSelectedLabSampleIdx(0);
    }
    setExpandedLabPanels(prev => ({ ...prev, [category]: true }));
    setHighlightedLabTest(testName);
    setTimeout(() => {
      const cardId = getLabTestElementId(testName);
      const el = document.getElementById(cardId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputEl = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (inputEl) inputEl.focus();
      }
      setTimeout(() => {
        setHighlightedLabTest(prev => (prev === testName ? null : prev));
      }, 2200);
    }, 100);
  };
  const [previewPageFilter, setPreviewPageFilter] = useState<number | 'all'>('all');
  const [showAutoHospitalizeModal, setShowAutoHospitalizeModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [showMoreActionsModal, setShowMoreActionsModal] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<HospitalArea>('ÁREA DE OBSERVACIÓN');
  const [selectedBed, setSelectedBed] = useState<string>('Cama 01');

  // Interactive Tutorial Bridge: sync editor page, preview tab, quick-fill panel & Hospitalize modal
  useEffect(() => {
    const handleTutorialSetPage = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          page?: number;
          tab?: 'editor' | 'preview';
          openQuickFillField?: string;
          closeHospitalizeModal?: boolean;
        }>
      ).detail;
      if (detail?.tab === 'preview') {
        setActiveTab('preview');
        setPreviewPageFilter('all');
      } else if (detail?.page && detail.page >= 1 && detail.page <= 8) {
        setActiveTab('editor');
        setActivePageNum(detail.page);
      }
      if (detail?.openQuickFillField !== undefined) {
        if (detail.openQuickFillField) {
          setOpenQuickFillFields({ [detail.openQuickFillField]: true });
        } else {
          setOpenQuickFillFields({});
        }
      }
      if (detail?.closeHospitalizeModal) {
        setShowAutoHospitalizeModal(false);
      }
    };
    const handleTutorialOpenHospitalize = () => {
      setShowMoreActionsModal(false);
      setShowAutoHospitalizeModal(true);
    };
    window.addEventListener('hmi_tutorial_set_historia_page', handleTutorialSetPage);
    window.addEventListener('hmi_tutorial_open_hospitalize_modal', handleTutorialOpenHospitalize);
    return () => {
      window.removeEventListener('hmi_tutorial_set_historia_page', handleTutorialSetPage);
      window.removeEventListener('hmi_tutorial_open_hospitalize_modal', handleTutorialOpenHospitalize);
    };
  }, []);

  useEffect(() => {
    if (showAutoHospitalizeModal) {
      window.dispatchEvent(new CustomEvent('hmi_tutorial_hospitalize_modal_opened'));
    }
  }, [showAutoHospitalizeModal]);

  // Interactive quick-fill drawer state for Page 4 (Examen Funcional) and Page 5 (Examen Físico)
  const [openQuickFillFields, setOpenQuickFillFields] = useState<Record<string, boolean>>({});
  const [quickFillSelections, setQuickFillSelections] = useState<Record<string, QuickFillSelectionMap>>({});
  const quickFillLastGeneratedRef = useRef<Record<string, string>>({});

  const isAnyFuncionalQuickFillOpen = EXAMEN_FUNCIONAL_SISTEMAS.some(
    sec => !!openQuickFillFields[sec.key]
  );
  const isAnyFisicoQuickFillOpen = EXAMEN_FISICO_ITEMS_LIST.some(
    sec => !!openQuickFillFields[sec.key]
  );

  useEffect(() => {
    const perc = calculatePediatricPercentiles(formData.peso, formData.talla, formData.edad, formData.generoPatient);
    if (
      perc.pesoEdad !== formData.percentilPesoEdad ||
      perc.tallaEdad !== formData.percentilTallaEdad ||
      perc.pesoTalla !== formData.percentilPesoTalla
    ) {
      setFormData(prev => ({
        ...prev,
        percentilPesoEdad: perc.pesoEdad,
        percentilTallaEdad: perc.tallaEdad,
        percentilPesoTalla: perc.pesoTalla,
        pesoEdad: perc.pesoEdad,
        tallaEdad: perc.tallaEdad,
        pesoTalla: perc.pesoTalla
      }));
    }
  }, [formData.peso, formData.talla, formData.edad, formData.generoPatient]);

  useEffect(() => {
    if (autoOpenPrint) {
      setActiveTab('preview');
      const timer = setTimeout(() => {
        handlePrintPdfDocument();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoOpenPrint]);

  const scrollToTopOfForm = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleZoomIn = () => {
    const currentScale = typeof previewScaleMode === 'number' ? previewScaleMode : 1;
    setPreviewScaleMode(Math.min(2.5, currentScale + 0.1));
  };

  const handleZoomOut = () => {
    const currentScale = typeof previewScaleMode === 'number' ? previewScaleMode : 1;
    setPreviewScaleMode(Math.max(0.3, currentScale - 0.1));
  };

  const handleSetScaleMode = (mode: 'fit' | number) => {
    setPreviewScaleMode(mode);
  };

  const quickJumpToSection = (pageNum: number, elementId?: string) => {
    setActivePageNum(pageNum);
    if (elementId) {
      setTimeout(() => {
        const el =
          elementId.startsWith('[') || elementId.startsWith('#') || elementId.startsWith('.')
            ? (document.querySelector(elementId) as HTMLElement | null)
            : document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-teal-400', 'bg-teal-950/40', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-teal-400', 'bg-teal-950/40');
          }, 2200);
        }
      }, 150);
    } else {
      scrollToTopOfForm();
    }
  };

  // Silent local-cache backup to protect against accidental exits (never auto-saves to Supabase)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const serialized = JSON.parse(JSON.stringify(formData));
        if (!isEditingExisting) {
          saveDraftToIDB(DRAFT_KEY, serialized);
          if (typeof window !== 'undefined') {
            localStorage.setItem('historia_last_active_backup', JSON.stringify(serialized));
            window.dispatchEvent(new Event('hmi_draft_changed'));
          }
        }
        
        const pKey = formData.patientId || formData.id;
        if (pKey) {
          saveDraftToIDB(`historia_draft_${pKey}`, serialized);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(serialized));
          }
        }
      } catch (e) {
        console.warn('Local cache backup error:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData, isEditingExisting]);

  // Synchronous emergency backup on browser exit or window close
  useEffect(() => {
    const handleEmergencyBackup = () => {
      try {
        const pKey = formData.patientId || formData.id || 'active';
        localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(formData));
        if (!isEditingExisting) {
          localStorage.setItem('historia_last_active_backup', JSON.stringify(formData));
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleEmergencyBackup);
    window.addEventListener('pagehide', handleEmergencyBackup);
    return () => {
      window.removeEventListener('beforeunload', handleEmergencyBackup);
      window.removeEventListener('pagehide', handleEmergencyBackup);
    };
  }, [formData, isEditingExisting]);

  const handleChange = (field: keyof HistoriaClinicaPediatrica, value: any) => {
    // Strictly sanitize value to ensure SyntheticEvents or invalid objects never enter state
    let cleanValue = value;
    if (value && typeof value === 'object') {
      if ('target' in value && value.target && typeof value.target.value === 'string') {
        cleanValue = value.target.value;
      } else if (value instanceof Date || Array.isArray(value)) {
        cleanValue = value;
      } else {
        cleanValue = '';
      }
    }
    if (typeof cleanValue === 'object' && cleanValue !== null && !(cleanValue instanceof Date) && !Array.isArray(cleanValue)) {
      cleanValue = '';
    }

    // If modifying an exam field (physical or functional), flag it as unlocked/customized
    const isPhys = EXAMEN_FISICO_ITEMS_LIST.some(item => item.key === field);
    const isFunc = EXAMEN_FUNCIONAL_SISTEMAS.some(item => item.key === field);
    if (isPhys || isFunc) {
      setUnlockedExamFields(prev => ({ ...prev, [field]: true }));
    }

    setFormData(prev => {
      const newCustomized = { ...(prev.customizedExamFields || {}) };
      if (isPhys || isFunc) {
        newCustomized[field] = true;
      }

      const newData: HistoriaClinicaPediatrica = { 
        ...prev, 
        [field]: cleanValue,
        customizedExamFields: newCustomized
      };
      
      // Auto-sync Summary Fields (Bidirectional)
      const syncMap: Record<string, string> = {
        'motivosAdmision': 'resumenMotivoConsulta',
        'enfermedadActual': 'resumenHistoriaEnfermedad',
        'antecedentesPrenatales': 'resumenAntecedentesObstetricos',
        'inmunizacionesPruebas': 'resumenInmunizaciones',
        'antecedentesPersonales': 'resumenPatologicosPersonales',
        'hfHermanos': 'resumenHermanos',
        'hfMadre': 'resumenMadre',
        'hfPadre': 'resumenPadre',
        'hfAbueloPaterno': 'resumenAbueloPaterno',
        'hfAbuelaPaterna': 'resumenAbuelaPaterna',
        'hfAbueloMaterno': 'resumenAbueloMaterno',
        'hfAbuelaMaterna': 'resumenAbuelaMaterna',
        'peso': 'resumenExamenPeso',
        'talla': 'resumenExamenTalla',
        'fr': 'resumenExamenFr',
        'fc': 'resumenExamenFc',
        'temp': 'resumenExamenTemp',
        'so2': 'resumenExamenSo2',
        'ta': 'resumenExamenTa',
        'pesoEdad': 'resumenPercentilPe',
        'pesoTalla': 'resumenPercentilPt',
        'diagnosticoAdmision': 'resumenDiagnosticosIngreso'
      };

      // Handle simple text/string sync
      for (const [source, target] of Object.entries(syncMap)) {
        if (field === source) {
          (newData as any)[target] = cleanValue;
        } else if (field === target) {
          (newData as any)[source] = cleanValue;
        }
      }

      // Handle Fecha de Nacimiento / Edad / Sexo -> Auto calculate Edad and adapt ONLY untouched/default exams
      if (field === 'fechaNacimiento' || field === 'edad' || field === 'generoPatient') {
        let ageStr = newData.edad || '';
        if (field === 'fechaNacimiento') {
          const computedAge = calculatePediatricAgeFromBirthDate(cleanValue);
          if (computedAge) {
            ageStr = computedAge;
            newData.edad = computedAge;
          }
          const place = newData.lugarNacimiento || '';
          newData.lugarFechaNacimiento = place ? `${place}, ${cleanValue}` : cleanValue;
        } else if (field === 'edad') {
          ageStr = String(cleanValue || '');
        }

        // Adapt ONLY fields that haven't been customized/unlocked by the doctor
        const normalPhys = getPediatricNormalPhysicalExam(ageStr, newData.generoPatient || 'niño');
        const normalFunc = getPediatricNormalFunctionalExam(ageStr, newData.generoPatient || 'niño');

        Object.keys(normalPhys).forEach(k => {
          if (!unlockedExamFields[k] && !newCustomized[k] && !prev.customizedExamFields?.[k]) {
            (newData as any)[k] = normalPhys[k];
          }
        });
        Object.keys(normalFunc).forEach(k => {
          if (!unlockedExamFields[k] && !newCustomized[k] && !prev.customizedExamFields?.[k]) {
            (newData as any)[k] = normalFunc[k];
          }
        });
      }

      // Bidirectional sync between Page 1 (EN CASO DE EMERGENCIA VISAR A: / PARENTESCO) and Page 2 (Reglamento & Exención)
      if (field === 'reglamentoFirma1') {
        newData.enCasoEmergenciaVisarA = cleanValue;
        if (!newData.exencionFirma || newData.exencionFirma === prev.reglamentoFirma1) {
          newData.exencionFirma = cleanValue;
        }
      } else if (field === 'reglamentoParentesco1') {
        newData.parentescoEmergencia = cleanValue;
        if (!newData.exencionParentesco || newData.exencionParentesco === prev.reglamentoParentesco1) {
          newData.exencionParentesco = cleanValue;
        }
      } else if (field === 'exencionFirma') {
        newData.enCasoEmergenciaVisarA = cleanValue;
        if (!newData.reglamentoFirma1 || newData.reglamentoFirma1 === prev.exencionFirma) {
          newData.reglamentoFirma1 = cleanValue;
        }
      } else if (field === 'exencionParentesco') {
        newData.parentescoEmergencia = cleanValue;
        if (!newData.reglamentoParentesco1 || newData.reglamentoParentesco1 === prev.exencionParentesco) {
          newData.reglamentoParentesco1 = cleanValue;
        }
      } else if (field === 'enCasoEmergenciaVisarA') {
        newData.reglamentoFirma1 = cleanValue;
        if (!newData.exencionFirma || newData.exencionFirma === prev.enCasoEmergenciaVisarA) {
          newData.exencionFirma = cleanValue;
        }
      } else if (field === 'parentescoEmergencia') {
        newData.reglamentoParentesco1 = cleanValue;
        if (!newData.exencionParentesco || newData.exencionParentesco === prev.parentescoEmergencia) {
          newData.exencionParentesco = cleanValue;
        }
      }

      // Handle Lugar de Nacimiento -> update lugarFechaNacimiento
      if (field === 'lugarNacimiento') {
        const birthDate = newData.fechaNacimiento || '';
        newData.lugarFechaNacimiento = cleanValue ? (birthDate ? `${cleanValue}, ${birthDate}` : cleanValue) : birthDate;
      }

      // Special Sync for Laboratories (Sync Column 1 to Summary Lab Fields)
      if (field === 'laboratoriosColumnas') {
        const firstCol = cleanValue?.[0]?.valores;
        if (firstCol) {
          const leu = getHistoriaLabValue(firstCol, 'Leucocitos');
          const seg = getHistoriaLabValue(firstCol, 'Seg. Neutrófilos');
          const lin = getHistoriaLabValue(firstCol, 'Linfocitos');
          const mon = getHistoriaLabValue(firstCol, 'Monocitos');
          const hb = getHistoriaLabValue(firstCol, 'Hemoglobina');
          const hto = getHistoriaLabValue(firstCol, 'Hematocrito');
          const vcm = getHistoriaLabValue(firstCol, 'VCM');
          const hcm = getHistoriaLabValue(firstCol, 'HCM');
          const plt = getHistoriaLabValue(firstCol, 'Plaquetas');
          const vsg = getHistoriaLabValue(firstCol, 'VSG');
          const pcr = getHistoriaLabValue(firstCol, 'PCR');

          if (leu) newData.resumenLabLeu = leu;
          if (seg) newData.resumenLabSeg = seg;
          if (lin) newData.resumenLabLin = lin;
          if (mon) newData.resumenLabMon = mon;
          if (hb) newData.resumenLabHb = hb;
          if (hto) newData.resumenLabHto = hto;
          if (vcm) newData.resumenLabVcm = vcm;
          if (hcm) newData.resumenLabHcm = hcm;
          if (plt) newData.resumenLabPlt = plt;
          if (vsg) newData.resumenLabVsg = vsg;
          if (pcr) newData.resumenLabPcr = pcr;
        }
      }

      return newData;
    });
  };

  // Reset all fields to initial default template
  const handleResetAllData = () => {
    const freshData: HistoriaClinicaPediatrica = {
      ...DEFAULT_HISTORIA_CLINICA,
      id: 'hc-' + Date.now(),
      fechaIngreso: new Date().toISOString().split('T')[0],
      horaIngreso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    };
    setFormData(freshData);
    removeDraftFromIDB(DRAFT_KEY);
    setShowResetConfirmModal(false);
  };

  // Synchronized sub-field updaters for Interrogatorio
  const updatePrenatal = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      let merged = { ...prev, ...updates };
      if (updates.prenatalTipoParto === 'eutócico') {
        const currentInst = (merged.prenatalInstrumental || '').trim().toLowerCase();
        if (currentInst === 'cesárea' || currentInst === 'cesarea') {
          merged.prenatalInstrumental = '';
        }
      }
      
      // Auto-adjust G/P/C/A to ensure sum <= G
      const g = parseInt(merged.prenatalHO_G || '0', 10);
      let p = parseInt(merged.prenatalHO_P || '0', 10);
      let c = parseInt(merged.prenatalHO_C || '0', 10);
      let a = parseInt(merged.prenatalHO_A || '0', 10);

      // Enforce the constraints: P <= G, P+C <= G, P+C+A <= G
      if (p > g) p = g;
      if (p + c > g) c = g - p;
      if (p + c + a > g) a = g - p - c;

      merged.prenatalHO_P = String(p);
      merged.prenatalHO_C = String(c);
      merged.prenatalHO_A = String(a);

      const edadM = merged.prenatalEdadMadre || '30';
      const hoG = merged.prenatalHO_G ? toRoman(merged.prenatalHO_G) + 'G' : '0G';
      const hoP = merged.prenatalHO_P ? toRoman(merged.prenatalHO_P) + 'P' : '0P';
      const hoC = merged.prenatalHO_C ? toRoman(merged.prenatalHO_C) + 'C' : '0C';
      const hoA = merged.prenatalHO_A ? toRoman(merged.prenatalHO_A) + 'A' : '0A';
      const hoComplete = [hoG, hoP, hoC, hoA].filter(Boolean).join(' ');

      const controlesNum = Number(merged.prenatalControles || '6');
      const controlStatus = merged.prenatalControlTipo === 'mal' ? 'mal controlado' : 'bien controlado';
      const infeccionesRaw = (merged.prenatalInfecciones || '').trim();
      const infecciones = infeccionesRaw
        ? (/^(refiere|niega)\b/i.test(infeccionesRaw) ? infeccionesRaw : `refiere ${infeccionesRaw}`)
        : 'Niega ITU, ITV, Diabetes y HTA';
      const sem = merged.prenatalSemanas || '39';
      const tipoParto = merged.prenatalTipoParto || 'eutócico';
      const instrumentalRaw = (merged.prenatalInstrumental || '').trim();

      let partoClause = `por parto ${tipoParto}`;
      if (tipoParto === 'eutócico') {
        if (instrumentalRaw && !/^ces[aá]rea$/i.test(instrumentalRaw)) {
          partoClause = `por parto ${tipoParto} (${instrumentalRaw})`;
        }
      } else {
        const inst = instrumentalRaw || 'cesárea';
        partoClause = `por parto ${tipoParto} (${inst})`;
      }
      
      const comp = `Producto de madre de ${edadM} años de edad HO ${hoComplete}, embarazo ${controlStatus} #${controlesNum}, ${infecciones}, producto obtenido de las ${sem} semanas de gestación ${partoClause}. Sin complicaciones durante el parto.`;
      return { 
        ...merged, 
        antecedentesPrenatales: comp,
        resumenAntecedentesObstetricos: comp
      };
    });
  };

  const handleUpdatePrenatalPatologia = (
    key: PrenatalPatologiaKey,
    patch: Partial<PrenatalPatologiaItemState>
  ) => {
    setPrenatalPatologias(prev => {
      const next: PrenatalPatologiasMap = {
        ...prev,
        [key]: {
          ...prev[key],
          ...patch,
        },
      };
      const nextText = buildPrenatalInfeccionesText(next);
      updatePrenatal({ prenatalInfecciones: nextText });
      return next;
    });
  };

  const handleResetPrenatalPatologiasNiega = () => {
    const cleanMap: PrenatalPatologiasMap = {
      ITU: { selected: false, tratada: 'tratada', medicamento: '' },
      ITV: { selected: false, tratada: 'tratada', medicamento: '' },
      Diabetes: { selected: false, tratada: 'tratada', medicamento: '' },
      HTA: { selected: false, tratada: 'tratada', medicamento: '' },
    };
    setPrenatalPatologias(cleanMap);
    updatePrenatal({ prenatalInfecciones: buildPrenatalInfeccionesText(cleanMap) });
  };

  const updateNeonatal = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const resp = merged.neonatalRespEspontanea === 'No' ? 'no lloró ni respiró al nacer' : 'lloró y respiró al nacer';
      
      const signs = [];
      if (merged.neonatalConvulsiones === 'Si') signs.push('convulsiones');
      if (merged.neonatalCianosis === 'Si') signs.push('cianosis');
      if (merged.neonatalIctericia === 'Si') signs.push('ictericia');
      
      const signsText = signs.length > 0 ? `refiere ${signs.join(', ')}` : 'niega convulsiones cianosis e ictericia';
      const cordonRaw = (merged.neonatalCordonDias || '7').trim();
      const pesoRaw = (merged.neonatalPesoNacer || '3000').trim();
      const tallaRaw = (merged.neonatalTallaNacer || '50').trim();

      const cordonText = cordonRaw.toLowerCase().includes('no recuerda')
        ? 'caída del cordón umbilical: No recuerda'
        : `caída del cordón umbilical a los ${cordonRaw} días`;
      const pesoText = pesoRaw.toLowerCase().includes('no recuerda')
        ? 'peso al nacer: No recuerda'
        : `peso al nacer ${pesoRaw} g`;
      const tallaText = tallaRaw.toLowerCase().includes('no recuerda')
        ? 'talla al nacer: No recuerda'
        : `talla al nacer ${tallaRaw} cm`;

      const comp = `Recién nacido que ${resp}, niega, ${signsText} ${cordonText} tamizaje neonatal no recuerda ${pesoText} ${tallaText}.`;
      return { ...merged, periodoNeonatal: comp };
    });
  };

  const updateAlimentacion = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const lme = merged.alimLmeMeses || '6';
      let lactanciaPrefix = '';
      
      const oz = merged.alimFormulaOz || '';
      const freq = merged.alimFormulaFrecuencia || '';
      let detailPart = '. ';
      if (oz && freq) {
        detailPart = ` (${oz} Oz cada ${freq} horas). `;
      } else if (oz) {
        detailPart = ` (${oz} Oz). `;
      } else if (freq) {
        detailPart = ` (cada ${freq} horas). `;
      }
      
      if (merged.alimTipoLactancia === 'LME') lactanciaPrefix = 'Lactancia Materna Exclusiva (LME). ';
      else if (merged.alimTipoLactancia === 'Formula') lactanciaPrefix = `Lactancia Artificial con fórmula ${merged.alimFormulaNombre || ''}${detailPart}`;
      else if (merged.alimTipoLactancia === 'Mixta') lactanciaPrefix = `Lactancia Mixta${detailPart}`;

      const lmePart = merged.alimHideLme ? '' : `Alimentación con LME hasta los ${lme} meses, `;
      const dietaPart = merged.alimHideDieta ? '' : `Dieta actual: proteínas ${merged.alimProteinasSemana || '2/7'}, vegetales ${merged.alimVegetalesSemana || '4/7'}, carbohidratos ${merged.alimCarbohidratosSemana || '7/7'}, dulces ${merged.alimDulcesSemana || '1/7'}.`;
      
      const middlePart = (merged.alimHideLme && merged.alimHideDieta) ? '' : 'inicia alimentación complementaria con sopa papilla jugo vegetales huevos carnes. ';
      
      const comp = `${lactanciaPrefix}${lmePart}${middlePart}${dietaPart}`.trim().replace(/\s\s+/g, ' ');
      return { ...merged, alimentacion: comp };
    });
  };

  const updateDesarrollo = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const formatDev = (val: string | undefined, def: string) => {
        const clean = (val || '').trim();
        if (!clean) return `${def} meses`;
        if (clean.toLowerCase().includes('aún') || clean.toLowerCase().includes('aun')) return 'aún no desarrollado';
        return `${clean} meses`;
      };
      const comp = [
        `Sostén cefálico: ${formatDev(merged.desarrolloCabezaMeses, '3')},`,
        `se sentó: ${formatDev(merged.desarrolloSentoMeses, '6')},`,
        `se paró: ${formatDev(merged.desarrolloParoMeses, '10')},`,
        `caminó: ${formatDev(merged.desarrolloCaminoMeses, '12')},`,
        `control de esfínter: ${formatDev(merged.desarrolloEsfinterMeses, '24')},`,
        `primer diente: ${formatDev(merged.desarrolloDienteMeses, '7')},`,
        `primeras palabras: ${formatDev(merged.desarrolloPalabrasMeses, '10')}.`
      ].join('\n');
      return { ...merged, desarrolloTabulador: comp };
    });
  };

  const updateHabitos = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const digito = merged.habitosDigitosuccion === 'Si' ? 'presenta dígito succión' : 'niega dígito succión';
      const onico = merged.habitosOnicofagia === 'Si' ? 'presenta onicofagia' : 'niega onicofagia';
      const juegos = merged.habitosJuegos ? `juegos: ${merged.habitosJuegos}, ` : '';
      const comp = `Sueño nocturno de ${merged.habitosSuenoNocturno || '8'} horas, siestas: ${merged.habitosSiestas || '2'} horas, ${juegos}${digito}, ${onico}.`;
      return { ...merged, habitosPsicologicos: comp };
    });
  };

  const handleToggleVacunaBlock = (blockLabel: string) => {
    setFormData(prev => {
      const current = prev.vacunasOtras || '';
      // Split by ". " but also handle ";" if any from previous versions
      let parts = current.split(/[.;]\s+/).map(p => p.trim()).filter(Boolean);
      
      const blockPrefix = blockLabel.split(':')[0];
      const exists = parts.find(p => p.startsWith(blockPrefix));
      
      if (exists) {
        // Remove it
        parts = parts.filter(p => !p.startsWith(blockPrefix));
      } else {
        // Add it
        parts.push(blockLabel);
      }

      // Re-order based on our defined schema
      const ordered = VACUNACION_ESQUEMA
        .map(b => parts.find(p => p.startsWith(b.key)) )
        .filter(Boolean) as string[];
      
      // Keep any manual text that doesn't match our blocks
      const extra = parts.filter(p => !VACUNACION_ESQUEMA.some(b => p.startsWith(b.key)));
      const finalParts = [...ordered, ...extra];
      
      const newOtras = finalParts.join('. ');
      
      const updates: any = { vacunasOtras: newOtras };
      
      const hasKeywordInFinal = (kw: string) =>
        finalParts.some(p => p.toLowerCase().includes(kw.toLowerCase()));

      // Sync boolean flags (including Pentavalente for 2, 4, and 6 months!)
      if (blockLabel.includes('BCG')) updates.vacunaBcg = hasKeywordInFinal('BCG') ? 'Si' : 'No';
      if (blockLabel.includes('Pentavalente')) {
        const hasPenta = hasKeywordInFinal('Pentavalente');
        updates.vacunaPentavalente = hasPenta ? 'Si' : 'No';
        updates.vacunaDifteria = hasPenta ? 'Si' : 'No';
        updates.vacunaTosFerina = hasPenta ? 'Si' : 'No';
        updates.vacunaTetanos = hasPenta ? 'Si' : 'No';
      }
      if (blockLabel.includes('Polio')) updates.vacunaPoliomielitis = hasKeywordInFinal('Polio') ? 'Si' : 'No';
      if (blockLabel.includes('Rotavirus')) updates.vacunaRotavirus = hasKeywordInFinal('Rotavirus') ? 'Si' : 'No';
      if (blockLabel.includes('Neumococo')) updates.vacunaNeumococo = hasKeywordInFinal('Neumococo') ? 'Si' : 'No';
      if (blockLabel.includes('Influenza')) updates.vacunaInfluenza = hasKeywordInFinal('Influenza') ? 'Si' : 'No';
      if (blockLabel.includes('Fiebre Amarilla') || blockLabel.includes('Antiamarílica')) {
        updates.vacunaAntiamarilica = (hasKeywordInFinal('Fiebre Amarilla') || hasKeywordInFinal('Antiamarílica')) ? 'Si' : 'No';
      }
      if (blockLabel.includes('Trivalente')) updates.vacunaTrivalente = hasKeywordInFinal('Trivalente') ? 'Si' : 'No';
      if (blockLabel.includes('HB neonatal')) updates.vacunaHbNeonatal = hasKeywordInFinal('HB neonatal') ? 'Si' : 'No';

      const merged = { ...prev, ...updates };
      
      // Compute summary (logic from updateInmunizaciones)
      const vacKeys = ['vacunaBcg', 'vacunaPoliomielitis', 'vacunaDifteria', 'vacunaTosFerina', 'vacunaTetanos', 'vacunaTificas', 'vacunaViruela'];
      const allComplete = vacKeys.every(k => (merged as any)[k] === 'Si');
      const vacStatus = allComplete ? 'Madre refiere vacunación completa' : 'Madre refiere vacunación incompleta.';
      const otrasText = merged.vacunasOtras ? ` ${merged.vacunasOtras}` : '';
      const tarjeta = merged.tarjetaInn === 'No posee' ? 'no posee tarjeta de vacunacion' : 'posee tarjeta de vacunacion';
      const comp = `${vacStatus}${otrasText} ${tarjeta}`;
      
      return { 
        ...merged, 
        inmunizacionesPruebas: comp,
        resumenInmunizaciones: comp
      };
    });
  };

  const updateInmunizaciones = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const vacKeys = ['vacunaBcg', 'vacunaPoliomielitis', 'vacunaDifteria', 'vacunaTosFerina', 'vacunaTetanos', 'vacunaTificas', 'vacunaViruela'];
      const allComplete = vacKeys.every(k => (merged as any)[k] === 'Si');
      const vacStatus = allComplete ? 'Madre refiere vacunación completa' : 'Madre refiere vacunación incompleta.';
      const otras = merged.vacunasOtras ? ` ${merged.vacunasOtras}` : '';
      const tarjeta = merged.tarjetaInn === 'No posee' ? 'no posee tarjeta de vacunacion' : 'posee tarjeta de vacunacion';
      const comp = `${vacStatus}${otras} ${tarjeta}`;
      return { 
        ...merged, 
        inmunizacionesPruebas: comp,
        resumenInmunizaciones: comp
      };
    });
  };

  const updateAntecedentesPersonales = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const comp = `Enfermedades crónicas: ${merged.apCronicas || 'No refiere'}. Hospitalizaciones previas: ${merged.apHospitalizaciones || 'No refiere'}. Transfusiones sanguíneas: ${merged.apTransfusiones || 'No refiere'}. Intervenciones quirúrgicas: ${merged.apQuirurgicos || 'No refiere'}. Traumatismos: ${merged.apTraumatismos || 'No refiere'}.`;
      const customized = { ...(prev.customizedExamFields || {}) };
      Object.keys(updates).forEach(k => { customized[k] = true; });
      customized['antecedentesPersonales'] = true;
      customized['resumenPatologicosPersonales'] = true;
      return { 
        ...merged, 
        antecedentesPersonales: comp,
        resumenPatologicosPersonales: comp,
        customizedExamFields: customized
      };
    });
  };
  const updateHistoriaFamiliar = (updates: Partial<HistoriaClinicaPediatrica>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updates };
      const comp = `Madre: ${merged.hfMadre || 'No refiere'}. Padre: ${merged.hfPadre || 'No refiere'}. Abuelo Paterno: ${merged.hfAbueloPaterno || 'No refiere'}. Abuela Paterna: ${merged.hfAbuelaPaterna || 'No refiere'}. Abuelo Materno: ${merged.hfAbueloMaterno || 'No refiere'}. Abuela Materna: ${merged.hfAbuelaMaterna || 'No refiere'}. Hermanos: ${merged.hfHermanos || 'No refiere'}.`;
      const customized = { ...(prev.customizedExamFields || {}) };
      Object.keys(updates).forEach(k => { customized[k] = true; });
      customized['historiaFamiliar'] = true;
      return { 
        ...merged, 
        historiaFamiliar: comp,
        resumenMadre: merged.hfMadre || merged.resumenMadre || '',
        resumenPadre: merged.hfPadre || merged.resumenPadre || '',
        resumenAbueloPaterno: merged.hfAbueloPaterno || merged.resumenAbueloPaterno || '',
        resumenAbuelaPaterna: merged.hfAbuelaPaterna || merged.resumenAbuelaPaterna || '',
        resumenAbueloMaterno: merged.hfAbueloMaterno || merged.resumenAbueloMaterno || '',
        resumenAbuelaMaterna: merged.hfAbuelaMaterna || merged.resumenAbuelaMaterna || '',
        resumenHermanos: merged.hfHermanos || merged.resumenHermanos || '',
        customizedExamFields: customized
      };
    });
  };

  // GRAFFAR Automatic Scoring Calculator
  const handleGraffarScoreChange = (criteria: 'A' | 'B' | 'C' | 'D', score: number, description: string) => {
    setFormData(prev => {
      const scoreA = criteria === 'A' ? score : (prev.graffarScoreA || 1);
      const scoreB = criteria === 'B' ? score : (prev.graffarScoreB || 1);
      const scoreC = criteria === 'C' ? score : (prev.graffarScoreC || 3);
      const scoreD = criteria === 'D' ? score : (prev.graffarScoreD || 1);
      const totalScore = scoreA + scoreB + scoreC + scoreD;

      let estrato = 'I';
      let resultado = 'I: 4-6';
      if (totalScore >= 17) {
        estrato = 'V';
        resultado = 'V: 17-20 (Pobreza Crítica / Extrema)';
      } else if (totalScore >= 13) {
        estrato = 'IV';
        resultado = 'IV: 13-16 (Pobreza Relativa)';
      } else if (totalScore >= 10) {
        estrato = 'III';
        resultado = 'III: 10-12 (Estrato Medio Bajo)';
      } else if (totalScore >= 7) {
        estrato = 'II';
        resultado = 'II: 7-9 (Estrato Medio Alto)';
      } else {
        estrato = 'I';
        resultado = 'I: 4-6 (Estrato Alto)';
      }

      return {
        ...prev,
        ...(criteria === 'A' ? { graffarScoreA: score, graffarProfesionJefe: description } : {}),
        ...(criteria === 'B' ? { graffarScoreB: score, graffarInstruccionMadre: description } : {}),
        ...(criteria === 'C' ? { graffarScoreC: score, graffarFuenteIngreso: description } : {}),
        ...(criteria === 'D' ? { graffarScoreD: score, graffarAlojamiento: description } : {}),
        graffarPuntajeTotal: totalScore,
        graffarEstrato: estrato,
        graffarResultado: resultado
      };
    });
  };


  const handleToggleSectionLock = (field: keyof HistoriaClinicaPediatrica, section: 'funcional' | 'fisico') => {
    const fieldKey = field as string;
    const isCurrentlyUnlocked = !!unlockedExamFields[fieldKey];
    const age = formData.edad;
    const gender = formData.generoPatient || 'niño';
    const normalDict = section === 'funcional' 
      ? getPediatricNormalFunctionalExam(age, gender) 
      : getPediatricNormalPhysicalExam(age, gender);
    const normalText = normalDict[fieldKey] || '';

    if (isCurrentlyUnlocked) {
      // Lock the textarea in place WITHOUT erasing or restoring normal text
      setUnlockedExamFields(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
      const currentText = String(formData[field] ?? '').trim();
      if (currentText && currentText !== normalText.trim()) {
        setFormData(prev => ({
          ...prev,
          customizedExamFields: {
            ...(prev.customizedExamFields || {}),
            [fieldKey]: true,
          },
        }));
      }
    } else {
      // Unlock for free editing
      setUnlockedExamFields(prev => ({ ...prev, [fieldKey]: true }));
      if (section === 'funcional') {
        let val = formData[field] !== undefined ? String(formData[field]) : normalText;
        if (val.includes('Madre niega:')) {
          val = val.replace(/Madre niega:/g, 'Madre refiere:');
          handleChange(field, val);
        }
      }
    }
  };

  const handleRestoreSingleExamToNormal = (field: keyof HistoriaClinicaPediatrica, section: 'funcional' | 'fisico') => {
    const age = formData.edad;
    const gender = formData.generoPatient || 'niño';
    const normalDict = section === 'funcional'
      ? getPediatricNormalFunctionalExam(age, gender)
      : getPediatricNormalPhysicalExam(age, gender);
    const normalText = normalDict[field as any] || '';

    handleChange(field, normalText);
    setUnlockedExamFields(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
    setFormData(prev => {
      const nextCustom = { ...(prev.customizedExamFields || {}) };
      delete nextCustom[field as string];
      return { ...prev, [field]: normalText, customizedExamFields: nextCustom };
    });
    setQuickFillSelections(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
    delete quickFillLastGeneratedRef.current[field as string];
  };

  const handleToggleQuickFillPanel = (fieldKey: string) => {
    setOpenQuickFillFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const handleToggleQuickFillAll = (section: 'funcional' | 'fisico') => {
    const list = section === 'funcional' ? EXAMEN_FUNCIONAL_SISTEMAS : EXAMEN_FISICO_ITEMS_LIST;
    const anyOpen = section === 'funcional' ? isAnyFuncionalQuickFillOpen : isAnyFisicoQuickFillOpen;
    setOpenQuickFillFields(prev => {
      const next = { ...prev };
      list.forEach(sec => {
        next[sec.key] = !anyOpen;
      });
      return next;
    });
  };

  const handleToggleQuickFillOptionForField = (
    field: keyof HistoriaClinicaPediatrica,
    sectionType: 'funcional' | 'fisico',
    group: QuickFillGroup,
    optionId: string
  ) => {
    const fieldKey = field as string;
    const sectionDef = getQuickFillSection(sectionType, fieldKey);
    if (!sectionDef) return;

    const currentFieldMap = quickFillSelections[fieldKey] || {};
    const currentGroupIds = currentFieldMap[group.id] || [];
    const nextGroupIds = toggleQuickFillOption(group, currentGroupIds, optionId);
    const nextFieldMap: QuickFillSelectionMap = {
      ...currentFieldMap,
      [group.id]: nextGroupIds,
    };

    setQuickFillSelections(prev => ({
      ...prev,
      [fieldKey]: nextFieldMap,
    }));

    const prevGenerated = quickFillLastGeneratedRef.current[fieldKey] || '';
    const nextGenerated = composeQuickFillClinicalText(sectionDef, nextFieldMap);
    quickFillLastGeneratedRef.current[fieldKey] = nextGenerated;

    // Automatically unlock the field when using Quick Fill
    setUnlockedExamFields(prev => ({ ...prev, [fieldKey]: true }));

    setFormData(prev => {
      const normalDict = sectionType === 'funcional'
        ? getPediatricNormalFunctionalExam(prev.edad, prev.generoPatient || 'niño')
        : getPediatricNormalPhysicalExam(prev.edad, prev.generoPatient || 'niño');
      const normalText = normalDict[fieldKey] || '';
      const nextText = nextGenerated
        ? mergeQuickFillWithManualNotes(String(prev[field] || ''), prevGenerated, nextGenerated)
        : normalText;
      const nextCustom = { ...(prev.customizedExamFields || {}), [fieldKey]: true };
      return {
        ...prev,
        [field]: nextText,
        customizedExamFields: nextCustom,
      };
    });
  };

  const handleClearQuickFillForField = (
    field: keyof HistoriaClinicaPediatrica,
    sectionType: 'funcional' | 'fisico'
  ) => {
    const fieldKey = field as string;
    setQuickFillSelections(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    delete quickFillLastGeneratedRef.current[fieldKey];
    handleRestoreSingleExamToNormal(field, sectionType);
  };

  const handleResetAllFuncionalToNormal = () => {
    const normalFunc = getPediatricNormalFunctionalExam(formData.edad, formData.generoPatient || 'niño');
    setFormData(prev => {
      const nextCustom = { ...(prev.customizedExamFields || {}) };
      EXAMEN_FUNCIONAL_SISTEMAS.forEach(s => delete nextCustom[s.key]);
      return {
        ...prev,
        ...normalFunc,
        customizedExamFields: nextCustom
      };
    });
    // Clear functional field locks and quick-fill selections
    const newLocks = { ...unlockedExamFields };
    Object.keys(normalFunc).forEach(k => delete newLocks[k]);
    setUnlockedExamFields(newLocks);
    setQuickFillSelections(prev => {
      const next = { ...prev };
      EXAMEN_FUNCIONAL_SISTEMAS.forEach(s => {
        delete next[s.key];
        delete quickFillLastGeneratedRef.current[s.key];
      });
      return next;
    });
  };

  const handleResetAllFisicoToNormal = () => {
    const normalPhys = getPediatricNormalPhysicalExam(formData.edad, formData.generoPatient || 'niño');
    setFormData(prev => {
      const nextCustom = { ...(prev.customizedExamFields || {}) };
      EXAMEN_FISICO_ITEMS_LIST.forEach(s => delete nextCustom[s.key]);
      return {
        ...prev,
        ...normalPhys,
        customizedExamFields: nextCustom
      };
    });
    // Clear physical field locks and quick-fill selections
    const newLocks = { ...unlockedExamFields };
    Object.keys(normalPhys).forEach(k => delete newLocks[k]);
    setUnlockedExamFields(newLocks);
    setQuickFillSelections(prev => {
      const next = { ...prev };
      EXAMEN_FISICO_ITEMS_LIST.forEach(s => {
        delete next[s.key];
        delete quickFillLastGeneratedRef.current[s.key];
      });
      return next;
    });
  };

  const handleGenderSelect = (gender: 'niño' | 'niña') => {
    setFormData(prev => {
      const normalPhys = getPediatricNormalPhysicalExam(prev.edad, gender);
      const normalFunc = getPediatricNormalFunctionalExam(prev.edad, gender);
      const updated = { ...prev, generoPatient: gender };
      Object.keys(normalPhys).forEach(k => {
        if (!unlockedExamFields[k] && !prev.customizedExamFields?.[k]) {
          (updated as any)[k] = normalPhys[k];
        }
      });
      Object.keys(normalFunc).forEach(k => {
        if (!unlockedExamFields[k] && !prev.customizedExamFields?.[k]) {
          (updated as any)[k] = normalFunc[k];
        }
      });
      return updated;
    });
  };

  // Handle Close / Back Button with Automatic Save & Isolated Draft Preservation
  const handleBackAndSaveDraft = () => {
    if (isTutorialDemoId(formData.id) || isTutorialDemoId(formData.patientId)) {
      onClose();
      return;
    }
    const dataToSave: HistoriaClinicaPediatrica = {
      ...formData,
      customizedExamFields: { ...(formData.customizedExamFields || {}), ...unlockedExamFields },
      updatedAt: new Date().toISOString()
    };
    try {
      const serialized = JSON.parse(JSON.stringify(dataToSave));
      if (!isEditingExisting) {
        saveDraftToIDB(DRAFT_KEY, serialized);
        if (typeof window !== 'undefined') {
          localStorage.setItem('historia_last_active_backup', JSON.stringify(serialized));
          window.dispatchEvent(new Event('hmi_draft_changed'));
        }
      }
      const pKey = formData.patientId || formData.id;
      if (pKey) {
        saveDraftToIDB(`historia_draft_${pKey}`, serialized);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(serialized));
        }
      }
    } catch (e) {
      console.warn('Draft backup error on exit:', e);
    }
    // Only auto-persist to DB when editing an existing record or when the user already typed patient identity
    if (isEditingExisting || formData.nombres?.trim() || formData.apellidos?.trim() || formData.numHistoria?.trim()) {
      onSave(dataToSave);
    }
    onClose();
  };

  const buildHistoriaClinicaPdf = async (): Promise<{ pdf: jsPDF; fileName: string }> => {
    if (activeTab !== 'preview') {
      setActiveTab('preview');
    }

    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      await (document as any).fonts.ready.catch(() => {});
    }

    if (!document.getElementById('pdf-page-1') || !document.getElementById('pdf-page-8')) {
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 60));
        if (document.getElementById('pdf-page-1') && document.getElementById('pdf-page-8')) {
          break;
        }
      }
    }

    // OBLIGATORIAMENTE Tamaño Carta (Letter: 215.9mm x 279.4mm)
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });
    let renderedPages = 0;

    for (let page = 1; page <= 8; page++) {
      const pageElem = document.getElementById(`pdf-page-${page}`);
      if (!pageElem) continue;

      const canvas = await html2canvas(pageElem, {
        scale: 1.45,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedElem) => {
          sanitizeCloneForHtml2Canvas(clonedDoc, clonedElem);

          const clonedPage = (clonedElem || clonedDoc.getElementById(`pdf-page-${page}`)) as HTMLElement | null;
          if (clonedPage) {
            clonedPage.style.transform = 'none';
            clonedPage.style.width = '215.9mm';
            clonedPage.style.maxWidth = 'none';
            clonedPage.style.boxShadow = 'none';
            clonedPage.style.margin = '0';
          }
        }
      });

      if (renderedPages > 0) pdf.addPage('letter', 'p');
      addCanvasSinglePageWithMargin(pdf, canvas, { quality: 0.92 });
      renderedPages++;
    }

    if (renderedPages === 0) {
      throw new Error('No se encontraron páginas de la historia clínica para generar el PDF.');
    }

    const buildHistoriaDocumentTitle = () => {
      const fullName = `${formData.apellidos || ''} ${formData.nombres || ''}`.trim() || 'Paciente';
      const hcNum = (formData.numHistoria || '').trim();
      const patientLabel = hcNum ? `${fullName} - HC ${hcNum}` : fullName;
      return formatPrintDocumentTitle('Historia Clinica', patientLabel, {
        includeDateTime: true,
      });
    };

    const fileName = `${buildHistoriaDocumentTitle()}.pdf`;
    return { pdf, fileName };
  };

  // Export High-Precision CARTA (Letter) PDF with jsPDF and html2canvas (Obligatoriamente Tamaño Carta)
  const handleExportPdf = async () => {
    if (isGeneratingPdf) return;
    setPdfExportError(null);
    setIsGeneratingPdf(true);
    try {
      const { pdf, fileName } = await buildHistoriaClinicaPdf();
      pdf.save(fileName);
    } catch (e: any) {
      console.error('Error generating PDF:', e);
      setPdfExportError(`No se pudo generar el PDF (${e?.message || 'error inesperado'}). Intente nuevamente.`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Instant DOM print of all 8 Letter pages (zero html2canvas/jsPDF conversion wait)
  const handlePrintPdfDocument = async () => {
    setPdfExportError(null);
    const fullName = `${formData.apellidos || ''} ${formData.nombres || ''}`.trim() || 'Paciente';
    const hcNum = (formData.numHistoria || '').trim();
    const patientLabel = hcNum ? `${fullName} - HC ${hcNum}` : fullName;
    const title = formatPrintDocumentTitle('Historia Clinica', patientLabel, {
      includeDateTime: true,
    });
    const fileName = `${title}.pdf`;

    if (activeTab !== 'preview') {
      setPreviewPageFilter('all');
      setActiveTab('preview');
    }

    const tryOpen = () =>
      printHistoriaClinicaDomInstant({
        title,
        fileName,
        patientName: patientLabel,
        onDownloadPdf: handleExportPdf,
      });

    if (tryOpen()) return;

    // Wait 1-2 frames if we just switched from 'editor' to 'preview'
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (tryOpen()) return;
    }
  };

  // WhatsApp share
  const handleShareWhatsApp = () => {
    const text = `🏥 *HISTORIA CLÍNICA PEDIÁTRICA*\n*Hospital Materno Infantil Comandante Supremo Hugo Rafael Chávez Frías*\n\n` +
      `👤 *Paciente:* ${formData.apellidos} ${formData.nombres}\n` +
      `📋 *N° Historia:* ${formData.numHistoria} | *Edad:* ${formData.edad}\n` +
      `📅 *Fecha de Ingreso:* ${formData.fechaIngreso} ${formData.horaIngreso}\n` +
      `🚨 *Motivo de Admisión:* ${formData.motivosAdmision}\n\n` +
      `🩺 *Enfermedad Actual:* ${formData.enfermedadActual}\n\n` +
      `📌 *Diagnósticos:* ${formData.diagnosticoAdmision}\n` +
      `💊 *Tratamiento / Plan:* ${formData.intervencionTratamiento || 'En esquema'}\n\n` +
      `✍️ *Médico Tratante:* ${FIXED_MEDICO_SERVICIO_FIRMA}`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleFinalSave = (autoHospitalize?: { area: HospitalArea; bedNumber: string }) => {
    const dataToSave: HistoriaClinicaPediatrica = {
      ...formData,
      medicoServicioFirma: FIXED_MEDICO_SERVICIO_FIRMA,
      customizedExamFields: { ...(formData.customizedExamFields || {}), ...unlockedExamFields },
      updatedAt: new Date().toISOString()
    };
    try {
      const serialized = JSON.parse(JSON.stringify(dataToSave));
      const pKey = formData.patientId || formData.id;
      if (pKey) {
        saveDraftToIDB(`historia_draft_${pKey}`, serialized);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(serialized));
        }
      }
      if (!isEditingExisting) {
        removeDraftFromIDB(DRAFT_KEY);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('historia_last_active_backup');
          window.dispatchEvent(new Event('hmi_draft_changed'));
        }
      }
    } catch {}
    onSave(dataToSave, autoHospitalize);
    onClose();
  };

  const handleManualSave = async () => {
    setSaveStatus('saving');
    const dataToSave: HistoriaClinicaPediatrica = {
      ...formData,
      customizedExamFields: { ...(formData.customizedExamFields || {}), ...unlockedExamFields },
      updatedAt: new Date().toISOString()
    };
    try {
      const serialized = JSON.parse(JSON.stringify(dataToSave));
      if (!isEditingExisting) {
        await removeDraftFromIDB(DRAFT_KEY);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('historia_last_active_backup');
          window.dispatchEvent(new Event('hmi_draft_changed'));
        }
      }
      const pKey = formData.patientId || formData.id;
      if (pKey) {
        await saveDraftToIDB(`historia_draft_${pKey}`, serialized);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`historia_backup_${pKey}`, JSON.stringify(serialized));
        }
      }
      onSave(dataToSave);
      setFormData(dataToSave);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (e) {
      console.warn('Manual save error:', e);
      onSave(dataToSave);
      setFormData(dataToSave);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 w-full h-full min-h-screen z-[150] overflow-y-auto flex flex-col transition-colors ${themeTokens.rootCanvas}`}
    >
      {/* Top Bar Controls (Hidden during print via no-print) - Permanente y fija */}
      <div className={`no-print sticky top-0 backdrop-blur-md border-b px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 z-[90] shadow-sm dark:shadow-lg ${themeTokens.headerSurface} text-slate-900 dark:text-white`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleBackAndSaveDraft}
            title="Guardar automáticamente y volver"
            className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all duration-300 shadow-sm dark:shadow-[0_0_18px_rgba(20,184,166,0.65)] ${themeTokens.primaryButton}`}
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.75]" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white truncate">
              <FileText className={`w-3.5 h-3.5 shrink-0 ${formData.isReingreso ? 'text-orange-600 dark:text-orange-400' : themeTokens.accentIcon}`} />
              <span className="truncate">
                {formData.isReingreso
                  ? (historias?.some(h => h.id === formData.id) ? 'Editar Historia de Reingreso' : 'Historia Pediátrica de Reingreso')
                  : (initialData ? 'Editar Historia' : 'Historia Pediátrica')}
              </span>
              {formData.isReingreso && (
                <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/50 text-[9px] font-black uppercase shrink-0">
                  Reingreso
                </span>
              )}
            </h2>
            <div className="text-[10px] truncate">
              {saveStatus === 'saved' ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Guardado ({lastSavedTime})
                </span>
              ) : (
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                  Borrador protegido en el dispositivo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Mode Tabs, Guardar Button, and Mostrar Más */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mode Tabs */}
          {readOnly ? (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold ${themeTokens.accentBadge}`}>
              <Eye className="w-3.5 h-3.5" />
              <span>Vista Previa (Solo Lectura)</span>
            </div>
          ) : (
            <div className="flex p-0.5 sm:p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 text-[11px] sm:text-xs cursor-pointer ${
                  activeTab === 'editor' ? themeTokens.activePill : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Redactar Datos</span>
                <span className="sm:hidden">Datos</span>
              </button>
              <button
                type="button"
                data-tutorial="hc-tab-preview"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 text-[11px] sm:text-xs cursor-pointer ${
                  activeTab === 'preview' ? themeTokens.activePill : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vista Previa</span>
                <span className="sm:hidden">Vista</span>
              </button>
            </div>
          )}

          {/* Botón Principal: ACTUALIZAR / GUARDAR / INGRESAR PX / REINGRESAR PX */}
          {!readOnly && (() => {
            const isAdmitted = existingPatients.some(p => 
              (formData.patientId && p.id === formData.patientId) || 
              (formData.numHistoria && p.medicalHistoryNumber && p.medicalHistoryNumber.toLowerCase().trim() === formData.numHistoria.toLowerCase().trim())
            );
            const isNewReingresoNotSavedYet = Boolean(formData.isReingreso && !historias?.some(h => h.id === formData.id));

            if (isNewReingresoNotSavedYet) {
              return (
                <button
                  type="button"
                  data-tutorial="btn-ingresar-px"
                  onClick={() => setShowAutoHospitalizeModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 dark:bg-orange-500/25 dark:hover:bg-orange-500/35 text-white dark:text-orange-300 border-2 border-orange-600 dark:border-orange-500 font-black text-xs flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_18px_rgba(249,115,22,0.8)] transition-all active:scale-95 cursor-pointer"
                  title="Guardar Historia Clínica de Reingreso y asignar cama en Hospitalización"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="uppercase tracking-wider">Reingresar Px</span>
                </button>
              );
            }

            if (!isAdmitted && !initialData) {
              return (
                <button
                  type="button"
                  data-tutorial="btn-ingresar-px"
                  onClick={() => setShowAutoHospitalizeModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 text-white dark:text-orange-400 border-2 border-orange-600 dark:border-orange-500/80 font-black text-xs flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_15px_rgba(249,115,22,0.7)] transition-all active:scale-95 cursor-pointer"
                  title="Ingresar paciente al sistema"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="uppercase tracking-wider">Ingresar Px</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                data-tutorial="btn-ingresar-px"
                onClick={handleManualSave}
                disabled={saveStatus === 'saving'}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 text-white dark:text-teal-300 border-2 border-teal-700 dark:border-teal-500/80 font-black text-xs flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_15px_rgba(20,184,166,0.7)] transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                title="Guardar todos los cambios y actualizar copia de seguridad"
              >
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="uppercase tracking-wider">
                  {saveStatus === 'saving' ? 'Guardando...' : (initialData ? 'Actualizar' : 'Guardar')}
                </span>
              </button>
            );
          })()}

          {/* Botón Mostrar Más -> Despliega la ventana flotante de acciones */}
          <button
            type="button"
            onClick={() => setShowMoreActionsModal(prev => !prev)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Mostrar más acciones disponibles"
          >
            <MoreHorizontal className={`w-4 h-4 ${themeTokens.accentIcon}`} />
            <span className="hidden xs:inline">Más</span>
          </button>
        </div>
      </div>

      {/* VENTANA FLOTANTE DE ACCIONES (MOSTRAR MÁS) */}
      {showMoreActionsModal && (
        <div 
          className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowMoreActionsModal(false)}
        >
          <div 
            className={`border rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3.5 text-xs animate-in zoom-in-95 duration-150 text-slate-900 dark:text-white ${themeTokens.cardSurface}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-2.5 ${themeTokens.sectionDivider}`}>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${themeTokens.accentIcon}`} /> Acciones de Historia
              </span>
              <button
                type="button"
                onClick={() => setShowMoreActionsModal(false)}
                className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 hover:rotate-90 transition-all duration-200 active:scale-90 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowMoreActionsModal(false);
                  setShowAutoHospitalizeModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-600/20 dark:hover:bg-orange-600/30 text-orange-800 dark:text-orange-400 border border-orange-300 dark:border-orange-500/50 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ingresar Px</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreActionsModal(false);
                  handleFinalSave();
                }}
                className={`w-full py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm dark:shadow-[0_0_15px_rgba(20,184,166,0.7)] transition-all active:scale-95 cursor-pointer ${themeTokens.primaryButton}`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>ACTUALIZAR HISTORIA CLÍNICA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreActionsModal(false);
                  handleExportPdf();
                }}
                disabled={isGeneratingPdf}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF (8 Páginas)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreActionsModal(false);
                  handlePrintPdfDocument();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm dark:shadow-[0_0_20px_rgba(52,211,153,0.85)] border border-amber-600/30 dark:border-emerald-200/80"
              >
                <Printer className="w-4 h-4 text-slate-950 font-extrabold dark:animate-pulse" />
                <span>Imprimir Documento PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreActionsModal(false);
                  handleShareWhatsApp();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Compartir en WhatsApp</span>
              </button>

              <div className={`border-t pt-2 ${themeTokens.sectionDivider}`}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActionsModal(false);
                    setShowResetConfirmModal(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  title="Borrar todo y reiniciar datos"
                >
                  <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Borrar y Reiniciar Todo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">

        {/* EDITOR TAB */}
        {activeTab === 'editor' && (
          <div className="no-print space-y-6">
            {draftLoaded && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 p-2.5 rounded-xl flex items-center gap-2 text-xs font-bold">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Borrador recuperado automáticamente. Puedes continuar con la edición.</span>
              </div>
            )}

            {formData.isReingreso && (
              <div className="bg-orange-50 dark:bg-gradient-to-r dark:from-orange-500/15 dark:via-amber-500/10 dark:to-orange-500/15 border-2 border-orange-400 dark:border-orange-500/60 rounded-2xl p-3.5 sm:p-4 shadow-sm dark:shadow-[0_0_20px_rgba(249,115,22,0.25)] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-orange-800 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      Nuevo Ingreso — Historia Clínica Pediátrica de Reingreso ({formData.fechaIngreso})
                    </h4>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                      Los datos de filiación están cargados. Complete los campos de este nuevo reingreso; la historia anterior y sus evoluciones previas permanecen intactas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAutoHospitalizeModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 text-white dark:text-slate-950 font-black text-xs shadow-sm dark:shadow-[0_0_14px_rgba(249,115,22,0.75)] transition-all active:scale-95 shrink-0 cursor-pointer"
                  >
                    Confirmar Reingreso & Área
                  </button>
                </div>
              </div>
            )}
            {/* Section Page Navigation Buttons */}
            <div className={`flex items-center gap-2 border p-2.5 rounded-2xl text-xs overflow-x-auto no-scrollbar w-full ${themeTokens.cardSurface}`}>
              {[
                '1. Filiación & Admisión',
                '2. Reglamento & Exención',
                '3. Interrogatorio (8 Acápites)',
                '4. Examen Funcional (14 Sistemas)',
                '5. Examen Físico Completo (1 al 17)',
                '6. Evaluación Socioeconómica GRAFFAR',
                '7. Laboratorios (8 Columnas)',
                '8. Resumen de Ingreso'
              ].map((title, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePageNum(idx + 1)}
                  className={`px-3.5 py-2.5 rounded-xl font-bold shrink-0 min-h-[42px] transition-all text-xs sm:text-sm cursor-pointer border ${
                    activePageNum === idx + 1
                      ? `${themeTokens.activePill} border-transparent`
                      : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Pág {idx + 1}: {title}
                </button>
              ))}
            </div>

            {/* Global Quick Jump Dropdown Bar (replaces individual quick-jump buttons) */}
            <HistoriaQuickJumpDropdown
              activePageNum={activePageNum}
              onSelectJump={quickJumpToSection}
              label="Acceso Rápido a Acápites de la Historia Clínica"
              placeholder="Despliega para elegir o buscar cualquier acápite (Págs. 1 a 8)..."
              dataTutorial="hc-quick-jump-dropdown"
              dataTestId="toggle-botones-rapidos"
            />

            {/* PAGE 1 FORM */}
            {activePageNum === 1 && (
              <div className={`border rounded-2xl p-5 space-y-4 shadow-sm dark:shadow-lg ${themeTokens.cardSurface}`}>
                <h3 data-tutorial="p1-header" className={`text-sm font-black uppercase tracking-wide border-b pb-2 flex items-center gap-2 ${themeTokens.accentText} ${themeTokens.sectionDivider}`}>
                  <span className="w-3 h-3 rounded-full bg-teal-600 dark:bg-teal-500 inline-block shadow-xs"></span> Parte I: Datos de Filiación y Admisión
                </h3>

                <div data-tutorial="p1-sexo" className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border ${themeTokens.cardInnerSurface}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sexo del Paciente (Afecta Examen Funcional y Físico automáticamente):</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenderSelect('niño')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        formData.generoPatient === 'niño'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      👦 Niño
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenderSelect('niña')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        formData.generoPatient === 'niña'
                          ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      👧 Niña
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div data-tutorial="p1-apellidos">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Apellidos del Paciente</label>
                    <input
                      type="text"
                      value={formData.apellidos}
                      onChange={e => handleChange('apellidos', e.target.value)}
                      placeholder="e.g. Pérez"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>
                  <div data-tutorial="p1-nombres">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Nombres del Paciente</label>
                    <input
                      type="text"
                      value={formData.nombres}
                      onChange={e => handleChange('nombres', e.target.value)}
                      placeholder="e.g. Juan"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>
                  <div data-tutorial="p1-num-historia">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">N° de Historia Clínica</label>
                    <input
                      type="text"
                      value={formData.numHistoria}
                      onChange={e => handleChange('numHistoria', e.target.value)}
                      placeholder="123456"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Fila 2: Lugar y Fecha de Nacimiento con Cálculo Automático de Edad */}
                <div data-tutorial="p1-nacimiento-edad" className={`p-3.5 rounded-xl border space-y-3 text-xs ${themeTokens.cardInnerSurface}`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-teal-700 dark:text-teal-300 font-bold mb-1 flex items-center justify-between">
                        <span>Lugar de Nacimiento</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Ciudad, Estado</span>
                      </label>
                      <input
                        type="text"
                        value={formData.lugarNacimiento || ''}
                        onChange={e => handleChange('lugarNacimiento', e.target.value)}
                        placeholder="e.g. Caracas, Dto. Capital"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-teal-700 dark:text-teal-300 font-bold mb-1 flex items-center justify-between">
                        <span>Fecha de Nacimiento</span>
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">Auto-calcula edad</span>
                      </label>
                      <input
                        type="date"
                        value={formData.fechaNacimiento || ''}
                        onChange={e => handleChange('fechaNacimiento', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-teal-500/60 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                        <span>Edad (Calculada / Editable)</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Meses/Días o Años/Días</span>
                      </label>
                      <input
                        type="text"
                        value={formData.edad}
                        onChange={e => handleChange('edad', e.target.value)}
                        placeholder="e.g. 4 años y 10 días"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold text-teal-700 dark:text-teal-300"
                      />
                    </div>
                  </div>

                  {/* Dynamic Pediatric Age Group Indicator & Quick Presets */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-teal-500/30 dark:border-teal-500/20">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Grupo Etario Pediátrico:
                      </span>
                      <span className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                        determinePediatricAgeGroup(formData.edad) === 'lactante'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                          : determinePediatricAgeGroup(formData.edad) === 'preescolar'
                          ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                          : determinePediatricAgeGroup(formData.edad) === 'escolar'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40'
                      }`}>
                        {determinePediatricAgeGroup(formData.edad)}
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 hidden sm:inline">
                        (Adapta automáticamente los 17 acápites físicos y 14 funcionales)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 mr-1">Rápido:</span>
                      <button
                        type="button"
                        onClick={() => handleChange('edad', '8 meses y 15 días')}
                        className="px-2 py-0.5 rounded bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-slate-700 cursor-pointer transition-all"
                      >
                        🍼 Lactante
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('edad', '4 años')}
                        className="px-2 py-0.5 rounded bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-[10px] font-semibold text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-slate-700 cursor-pointer transition-all"
                      >
                        🧒 Preescolar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('edad', '8 años')}
                        className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-slate-700 cursor-pointer transition-all"
                      >
                        🎒 Escolar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('edad', '14 años')}
                        className="px-2 py-0.5 rounded bg-purple-50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-[10px] font-semibold text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-slate-700 cursor-pointer transition-all"
                      >
                        🧑 Adolescente
                      </button>
                    </div>
                  </div>
                </div>

                <div data-tutorial="p1-ci-ingreso" className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Cédula / C.I.</label>
                    <input
                      type="text"
                      value={formData.ci}
                      onChange={e => handleChange('ci', e.target.value)}
                      placeholder="23456789"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${formData.isReingreso ? 'text-orange-700 dark:text-orange-400 font-black' : 'text-slate-600 dark:text-slate-400'}`}>
                      {formData.isReingreso ? 'Fecha de Reingreso / Ingreso' : 'Fecha de Ingreso'}
                    </label>
                    <input
                      type="date"
                      value={formData.fechaIngreso}
                      onChange={e => handleChange('fechaIngreso', e.target.value)}
                      className={`w-full bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none ${
                        formData.isReingreso ? 'border-2 border-orange-500/70 focus:border-orange-500 font-bold' : 'border border-slate-300 dark:border-slate-700 focus:border-teal-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Hora de Ingreso</label>
                    <input
                      type="time"
                      value={formData.horaIngreso}
                      onChange={e => handleChange('horaIngreso', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">LUGAR Y FECHA DE NACIMIENTO (PDF):</label>
                    <div className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                      {formData.lugarFechaNacimiento || 'Pendiente de registrar'}
                    </div>
                  </div>
                </div>

                <div data-tutorial="p1-direccion-telefono" className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Dirección Completa</label>
                    <input
                      type="text"
                      value={formData.direccionCompleta}
                      onChange={e => handleChange('direccionCompleta', e.target.value)}
                      placeholder="e.g. El valle el mango"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Teléfono de Contacto</label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={e => handleChange('telefono', e.target.value)}
                      placeholder="04141234567"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div data-tutorial="p1-emergencia" className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      EN CASO DE EMERGENCIA VISAR A: <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">(Sincronizado con Pág. 2 Responsable)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.enCasoEmergenciaVisarA || formData.reglamentoFirma1 || ''}
                      onChange={e => handleChange('enCasoEmergenciaVisarA', e.target.value)}
                      placeholder="ej. María Pérez"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      PARENTESCO: <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">(Sincronizado con Pág. 2 Parentesco)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.parentescoEmergencia || formData.reglamentoParentesco1 || ''}
                      onChange={e => handleChange('parentescoEmergencia', e.target.value)}
                      placeholder="ej. Madre"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>
                </div>

                <div className="text-xs space-y-3 pt-2">
                  <div data-tutorial="p1-motivos">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Motivo(s) de Admisión</label>
                    <input
                      type="text"
                      value={formData.motivosAdmision}
                      onChange={e => handleChange('motivosAdmision', e.target.value)}
                      placeholder="e.g. Tos seca, dificultad para respirar"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>

                  <div data-tutorial="p1-enfermedad-actual">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Enfermedad Actual ("Se trata de...")</label>
                    <AutoExpandingTextarea
                      minHeight={140}
                      value={formData.enfermedadActual}
                      onChange={e => handleChange('enfermedadActual', e.target.value)}
                      placeholder='Se trata de paciente lactante menor...'
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 leading-relaxed font-medium text-xs sm:text-sm"
                    />
                  </div>

                  <div data-tutorial="p1-diagnosticos">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-2 flex items-center justify-between flex-wrap gap-1">
                      <span>Diagnóstico de Admisión (Estructura Jerárquica)</span>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-normal">Soporta Dx Principal (1.), Sub-Dx (1.1) y Sub-Sub-Dx (1.2.1)</span>
                    </label>

                    <div className={`space-y-2 p-4 rounded-2xl border ${themeTokens.cardInnerSurface}`}>
                      {dxNodes.map((node, index) => (
                        <div 
                          key={node.id} 
                          className={`flex items-start gap-2 transition-all ${
                            node.level === 1 ? 'pl-0' : node.level === 2 ? 'pl-6 sm:pl-8' : 'pl-12 sm:pl-16'
                          }`}
                        >
                          <span className="font-mono font-black text-xs text-teal-700 dark:text-teal-400 shrink-0 min-w-[36px] pt-2">
                            {node.numberStr}
                          </span>
                          <textarea
                            ref={el => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${Math.max(38, el.scrollHeight)}px`;
                              }
                            }}
                            rows={1}
                            value={node.text}
                            onChange={e => {
                              handleUpdateDxNodeText(index, e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(38, e.target.scrollHeight)}px`;
                            }}
                            placeholder={node.level === 1 ? 'Agregar diagnóstico principal...' : node.level === 2 ? 'Agregar sub-diagnóstico...' : 'Agregar sub-sub-diagnóstico...'}
                            className={`flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-xs focus:outline-none focus:border-teal-500 whitespace-pre-wrap break-words overflow-hidden resize-none leading-snug ${
                              node.level === 1 ? 'font-bold text-slate-900 dark:text-teal-200' : node.level === 2 ? 'font-semibold text-slate-800 dark:text-teal-100/90' : 'text-slate-700 dark:text-slate-200'
                            }`}
                          />
                          <div className="flex items-center gap-1 shrink-0 pt-1">
                            {node.level < 3 && (
                              <button
                                type="button"
                                onClick={() => node.level === 1 ? handleAddDxSub(index) : handleAddDxSubSub(index)}
                                className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-600/20 hover:bg-teal-100 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 rounded-lg text-[10px] font-bold border border-teal-300 dark:border-teal-500/30 transition-all cursor-pointer"
                                title={node.level === 1 ? 'Agregar Sub-Diagnóstico (1.1)' : 'Agregar Sub-Sub-Diagnóstico (1.2.1)'}
                              >
                                + Sub-Dx
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteDxNode(index)}
                              className="p-1.5 bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-transparent rounded-lg transition-all cursor-pointer"
                              title="Eliminar diagnóstico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className={`pt-2 flex items-center justify-between gap-2 border-t ${themeTokens.sectionDivider}`}>
                        <button
                          type="button"
                          onClick={handleAddDxMain}
                          className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${themeTokens.primaryButton}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Agregar Diagnóstico Principal</span>
                        </button>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                          Total: {dxNodes.length} ítems jerárquicos
                        </span>
                      </div>
                    </div>
                  </div>

                  <div data-tutorial="p1-firmas" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Firma Médico de Admisión</label>
                      <input
                        type="text"
                        value={
                          formData.medicoAdmisionFirma &&
                          formData.medicoAdmisionFirma !== 'Dr. Brayan' &&
                          formData.medicoAdmisionFirma !== 'Administrador'
                            ? formData.medicoAdmisionFirma
                            : resolveRegisteredDoctorSignatureName()
                        }
                        onChange={e => handleChange('medicoAdmisionFirma', e.target.value)}
                        placeholder={resolveRegisteredDoctorSignatureName()}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Firma del Médico del Servicio</label>
                      <input
                        type="text"
                        value={FIXED_MEDICO_SERVICIO_FIRMA}
                        readOnly
                        className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none font-bold cursor-default"
                      />
                    </div>
                </div>
              </div>

              <div className={`pt-4 border-t flex justify-end ${themeTokens.sectionDivider}`}>
                <button
                  type="button"
                  onClick={scrollToTopOfForm}
                  className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.75)] transition-all duration-300 active:scale-95 cursor-pointer ${themeTokens.primaryButton}`}
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.75]" />
                  <span>⬆️ Volver arriba</span>
                </button>
              </div>
            </div>
          )}

            {/* PAGE 2 FORM: REGLAMENTO & EXENCIÓN */}
            {activePageNum === 2 && (
              <div className={`border rounded-2xl p-5 space-y-6 text-xs shadow-sm dark:shadow-lg ${themeTokens.cardSurface}`}>
                <div className={`border-b pb-3 ${themeTokens.sectionDivider}`}>
                  <h3 className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block shadow-xs"></span> Página 2: Reglamento de Hospitalización y Exención de Responsabilidad
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Consentimientos firmados al momento del ingreso hospitalario.
                  </p>
                </div>

                {/* Sección 1: Reglamento */}
                <div className={`p-4 rounded-xl border space-y-3 ${themeTokens.cardInnerSurface}`}>
                  <h4 className={`font-bold uppercase text-xs tracking-wider ${themeTokens.accentText}`}>
                    1. Aceptación del Reglamento de Hospitalización
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Fecha</label>
                      <input
                        type="date"
                        value={formData.reglamentoFecha}
                        onChange={e => handleChange('reglamentoFecha', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div data-tutorial="p2-reglamento-nombre">
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nombre / Firma Responsable</label>
                      <input
                        type="text"
                        value={formData.reglamentoFirma1}
                        onChange={e => handleChange('reglamentoFirma1', e.target.value)}
                        placeholder="ej. María Pérez"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div data-tutorial="p2-reglamento-ci">
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Cédula de Identidad</label>
                      <input
                        type="text"
                        value={formData.reglamentoCI1}
                        onChange={e => handleChange('reglamentoCI1', e.target.value)}
                        placeholder="ej. V-12.345.678"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div data-tutorial="p2-reglamento-parentesco">
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Parentesco</label>
                      <input
                        type="text"
                        value={formData.reglamentoParentesco1}
                        onChange={e => handleChange('reglamentoParentesco1', e.target.value)}
                        placeholder="ej. Madre"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Testigo Institucional</label>
                      <input
                        type="text"
                        value={formData.reglamentoTestigo}
                        onChange={e => handleChange('reglamentoTestigo', e.target.value)}
                        placeholder="ej. Lic. Carmen Silva"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">C.I. Testigo</label>
                      <input
                        type="text"
                        value={formData.reglamentoCITestigo}
                        onChange={e => handleChange('reglamentoCITestigo', e.target.value)}
                        placeholder="ej. V-14.321.654"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 2: Exención */}
                <div className={`p-4 rounded-xl border space-y-3 ${themeTokens.cardInnerSurface}`}>
                  <h4 className={`font-bold uppercase text-xs tracking-wider ${themeTokens.accentText}`}>
                    2. Documento de Exención de Responsabilidad
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Fecha</label>
                      <input
                        type="date"
                        value={formData.exencionFecha}
                        onChange={e => handleChange('exencionFecha', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nombre / Firma Responsable</label>
                      <input
                        type="text"
                        value={formData.exencionFirma}
                        onChange={e => handleChange('exencionFirma', e.target.value)}
                        placeholder="ej. María Pérez"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Cédula de Identidad</label>
                      <input
                        type="text"
                        value={formData.exencionCI}
                        onChange={e => handleChange('exencionCI', e.target.value)}
                        placeholder="ej. V-12.345.678"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Parentesco</label>
                      <input
                        type="text"
                        value={formData.exencionParentesco}
                        onChange={e => handleChange('exencionParentesco', e.target.value)}
                        placeholder="ej. Madre"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Testigo Institucional</label>
                      <input
                        type="text"
                        value={formData.exencionTestigo}
                        onChange={e => handleChange('exencionTestigo', e.target.value)}
                        placeholder="ej. Lic. Carmen Silva"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">C.I. Testigo</label>
                      <input
                        type="text"
                        value={formData.exencionCITestigo}
                        onChange={e => handleChange('exencionCITestigo', e.target.value)}
                        placeholder="ej. V-14.321.654"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className={`pt-4 border-t flex justify-end ${themeTokens.sectionDivider}`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.75)] transition-all duration-300 active:scale-95 cursor-pointer ${themeTokens.primaryButton}`}
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.75]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 3 FORM: INTERROGATORIO (8 ACÁPITES DESGLOSADOS E INTUITIVOS) */}
            {activePageNum === 3 && (
              <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 sm:p-5 space-y-6 text-xs shadow-sm dark:shadow-lg`}>
                <div className="border-b border-violet-500/30 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-violet-500 inline-block shadow-xs"></span> Página 3: Interrogatorio Pediátrico Desglosado (8 Acápites Oficiales)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Llene los campos específicos; el sistema genera y sincroniza automáticamente la redacción clínica para el PDF oficial.
                    </p>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 border rounded-full font-bold self-start ${themeTokens.accentBadge}`}>
                    Auto-sincronizado
                  </span>
                </div>

                {/* Quick sub-navigation dropdown for 8 Acápites */}
                <div className={`pb-2.5 border-b ${themeTokens.sectionDivider}`}>
                  <HistoriaQuickJumpDropdown
                    activePageNum={activePageNum}
                    scopedPage={3}
                    compact
                    onSelectJump={quickJumpToSection}
                    label="Ir a acápite del Interrogatorio (8)"
                    placeholder="Despliega para saltar a cualquiera de los 8 acápites de la Página 3..."
                  />
                </div>

                {/* 1. ANTECEDENTES PRENATALES Y OBSTÉTRICOS */}
                <div id="sec-interrogatorio-1-prenatal" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      1. Antecedentes Prenatales y Obstétricos
                    </span>
                  </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Producto de madre de: (años)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formData.prenatalEdadMadre || ''}
                            onChange={e => updatePrenatal({ prenatalEdadMadre: e.target.value.replace(/\D/g, '') })}
                            placeholder="30"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                          <span className="text-[10px] text-slate-600 dark:text-slate-500 font-bold whitespace-nowrap">años de edad</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold text-[11px]">HO (Gesta / Para / Cesáreas / Abortos)</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { key: 'prenatalHO_G' as const, label: 'G' },
                            { key: 'prenatalHO_P' as const, label: 'P' },
                            { key: 'prenatalHO_C' as const, label: 'C' },
                            { key: 'prenatalHO_A' as const, label: 'A' },
                          ].map(ho => {
                            const gestas = parseInt(formData.prenatalHO_G || '0', 10);
                            const paras = parseInt(formData.prenatalHO_P || '0', 10);
                            const cesareas = parseInt(formData.prenatalHO_C || '0', 10);
                            
                            let maxVal = 15;
                            if (ho.key !== 'prenatalHO_G') {
                              if (ho.key === 'prenatalHO_P') maxVal = gestas;
                              else if (ho.key === 'prenatalHO_C') maxVal = gestas - paras;
                              else if (ho.key === 'prenatalHO_A') maxVal = gestas - paras - cesareas;
                            }
                            if (maxVal < 0) maxVal = 0;

                            return (
                              <div key={ho.key} className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-600 dark:text-slate-500 font-bold mb-0.5">{ho.label}</span>
                                <select
                                  value={formData[ho.key] || ''}
                                  onChange={e => updatePrenatal({ [ho.key]: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-slate-900 dark:text-white text-center font-bold text-xs outline-none focus:border-teal-500"
                                >
                                  {/* Removing empty option as per 'siempre deja el numero 0' request */}
                                  <option value="0">0</option>
                                  {Array.from({ length: maxVal }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Control Prenatal</label>
                      <div className="flex gap-2">
                        {['bien', 'mal'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updatePrenatal({ prenatalControlTipo: val as any })}
                            className={`flex-1 py-2 rounded-lg font-bold border transition-all text-[11px] cursor-pointer ${
                              (formData.prenatalControlTipo || 'bien') === val
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {val === 'bien' ? 'Bien Controlado' : 'Mal Controlado'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">N° Controles Prenatales</label>
                      <input
                        type="number"
                        value={formData.prenatalControles || ''}
                        onChange={e => updatePrenatal({ prenatalControles: e.target.value })}
                        placeholder="ej. 6"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 space-y-2 pt-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-slate-700 dark:text-slate-300 font-bold text-xs">
                          Infecciones / Patologías (ITU, ITV, Diabetes, HTA) — Seleccione las que refiere (las no seleccionadas se marcan como Niega):
                        </label>
                        <button
                          type="button"
                          onClick={handleResetPrenatalPatologiasNiega}
                          className="px-2.5 py-1 rounded-lg bg-teal-600/12 dark:bg-teal-500/20 hover:bg-teal-600/20 dark:hover:bg-teal-500/30 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/40 text-[10px] font-black transition-all cursor-pointer"
                        >
                          ✓ Niega Todas
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {PRENATAL_PATOLOGIAS_KEYS.map(patKey => {
                          const itemState = prenatalPatologias[patKey] || {
                            selected: false,
                            tratada: 'tratada',
                            medicamento: '',
                          };
                          return (
                            <div
                              key={patKey}
                              className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                itemState.selected
                                  ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-500 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdatePrenatalPatologia(patKey, {
                                    selected: !itemState.selected,
                                  })
                                }
                                className={`w-full py-1.5 px-2.5 rounded-lg font-black text-xs border transition-all flex items-center justify-between cursor-pointer ${
                                  itemState.selected
                                    ? 'bg-teal-600 text-white border-teal-500'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span>{patKey}</span>
                                <span className="text-[10px] font-bold">
                                  {itemState.selected ? 'Refiere ✓' : 'Niega'}
                                </span>
                              </button>

                              {itemState.selected && (
                                <div className="space-y-1.5 pt-0.5">
                                  <div className="grid grid-cols-2 gap-1">
                                    {(['tratada', 'no tratada'] as const).map(statusOpt => (
                                      <button
                                        key={statusOpt}
                                        type="button"
                                        onClick={() =>
                                          handleUpdatePrenatalPatologia(patKey, {
                                            tratada: statusOpt,
                                          })
                                        }
                                        className={`py-1 px-1.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                          itemState.tratada === statusOpt
                                            ? statusOpt === 'tratada'
                                              ? 'bg-emerald-600 text-white border-emerald-500'
                                              : 'bg-amber-600 text-white border-amber-500'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                                        }`}
                                      >
                                        {statusOpt === 'tratada' ? 'Tratada' : 'No tratada'}
                                      </button>
                                    ))}
                                  </div>

                                  {itemState.tratada === 'tratada' && (
                                    <input
                                      type="text"
                                      value={itemState.medicamento}
                                      onChange={e =>
                                        handleUpdatePrenatalPatologia(patKey, {
                                          medicamento: e.target.value,
                                        })
                                      }
                                      placeholder="Poner medicamento..."
                                      className="w-full bg-white dark:bg-slate-900 border border-teal-500/60 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 dark:text-white font-semibold placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={formData.prenatalInfecciones || ''}
                        onChange={e => updatePrenatal({ prenatalInfecciones: e.target.value })}
                        placeholder="ej. Niega ITU, ITV, Diabetes y HTA"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Semanas al Nacer</label>
                        <input
                          type="number"
                          value={formData.prenatalSemanas || ''}
                          onChange={e => updatePrenatal({ prenatalSemanas: e.target.value })}
                          placeholder="39"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Tipo de Parto</label>
                        <div className="flex gap-2">
                          {['eutócico', 'distócico'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updatePrenatal({ prenatalTipoParto: val })}
                              className={`flex-1 py-2 rounded-lg font-bold border transition-all text-[11px] cursor-pointer ${
                                (formData.prenatalTipoParto || 'eutócico') === val
                                  ? 'bg-teal-600 text-white border-teal-500'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {val.charAt(0).toUpperCase() + val.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Motivo / Tipo (Cesárea, Instrumentado, etc.):</label>
                        <input
                          type="text"
                          value={formData.prenatalInstrumental || ''}
                          onChange={e => updatePrenatal({ prenatalInstrumental: e.target.value })}
                          placeholder={(formData.prenatalTipoParto || 'eutócico') === 'eutócico' ? 'Opcional (sin cesárea automática)' : 'Cesárea segmentaria por...'}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.antecedentesPrenatales}
                      onChange={e => handleChange('antecedentesPrenatales', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 2. PERIODO NEONATAL */}
                <div id="sec-interrogatorio-2-neonatal" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      2. Período Neonatal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Respiración Espontánea al Nacer</label>
                      <div className="flex gap-2">
                        {['Si', 'No'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateNeonatal({ neonatalRespEspontanea: val })}
                            className={`flex-1 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                              (formData.neonatalRespEspontanea || 'Si') === val
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold text-[11px]">Caída del cordón umbilical</label>
                        <button
                          type="button"
                          onClick={() => updateNeonatal({ neonatalCordonDias: 'No recuerda' })}
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all cursor-pointer ${
                            (formData.neonatalCordonDias || '').toLowerCase() === 'no recuerda'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-teal-600/12 dark:bg-teal-500/20 hover:bg-teal-600/20 text-teal-800 dark:text-teal-300 border-teal-600/30'
                          }`}
                        >
                          No recuerda
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.neonatalCordonDias || ''}
                          onChange={e => updateNeonatal({ neonatalCordonDias: e.target.value })}
                          placeholder="7"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 shrink-0 font-semibold">días</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold text-[11px]">Peso al Nacer (g)</label>
                        <button
                          type="button"
                          onClick={() => updateNeonatal({ neonatalPesoNacer: 'No recuerda' })}
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all cursor-pointer ${
                            (formData.neonatalPesoNacer || '').toLowerCase() === 'no recuerda'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-teal-600/12 dark:bg-teal-500/20 hover:bg-teal-600/20 text-teal-800 dark:text-teal-300 border-teal-600/30'
                          }`}
                        >
                          No recuerda
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.neonatalPesoNacer || ''}
                        onChange={e => updateNeonatal({ neonatalPesoNacer: e.target.value })}
                        placeholder="3000"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold text-[11px]">Talla al Nacer (cm)</label>
                        <button
                          type="button"
                          onClick={() => updateNeonatal({ neonatalTallaNacer: 'No recuerda' })}
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all cursor-pointer ${
                            (formData.neonatalTallaNacer || '').toLowerCase() === 'no recuerda'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-teal-600/12 dark:bg-teal-500/20 hover:bg-teal-600/20 text-teal-800 dark:text-teal-300 border-teal-600/30'
                          }`}
                        >
                          No recuerda
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.neonatalTallaNacer || ''}
                        onChange={e => updateNeonatal({ neonatalTallaNacer: e.target.value })}
                        placeholder="50"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Signos Patológicos Presentes al Nacer:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'neonatalCianosis' as const, label: 'Cianosis' },
                        { key: 'neonatalIctericia' as const, label: 'Ictericia' },
                        { key: 'neonatalConvulsiones' as const, label: 'Convulsiones' },
                      ].map(item => {
                        const isYes = formData[item.key] === 'Si';
                        return (
                          <div key={item.key} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700">
                            <span className="font-medium text-slate-800 dark:text-slate-300">{item.label}</span>
                            <button
                              type="button"
                              onClick={() => updateNeonatal({ [item.key]: isYes ? 'No' : 'Si' })}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                isYes ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {isYes ? 'SI' : 'NO'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.periodoNeonatal}
                      onChange={e => handleChange('periodoNeonatal', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 3. ALIMENTACIÓN */}
                <div id="sec-interrogatorio-3-alimentacion" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2 flex-wrap gap-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      3. Alimentación (Meses en Número & Dieta Actual Semanal)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const lmeText = 'Solamente LME';
                        setFormData(prev => ({
                          ...prev,
                          alimLmeMeses: prev.alimLmeMeses || '6',
                          alimentacion: lmeText
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-teal-600/12 dark:bg-teal-500/20 hover:bg-teal-600/20 dark:hover:bg-teal-500/30 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/40 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Describir que se alimenta solamente con LME"
                    >
                      <Check className="w-3 h-3" />
                      <span>Solamente LME</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-slate-700 dark:text-slate-400 mb-1.5 font-semibold">Tipo de Lactancia</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { key: 'LME', label: 'LME' },
                          { key: 'Formula', label: 'Fórmula' },
                          { key: 'Mixta', label: 'Mixta' },
                        ].map(tipo => (
                          <button
                            key={tipo.key}
                            type="button"
                            onClick={() => updateAlimentacion({ alimTipoLactancia: tipo.key as any })}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all border cursor-pointer ${
                              formData.alimTipoLactancia === tipo.key
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {tipo.label}
                          </button>
                        ))}
                      </div>
                  {formData.alimTipoLactancia && formData.alimTipoLactancia !== 'LME' && (
                    <div className="mt-2 space-y-2">
                      {formData.alimTipoLactancia === 'Formula' && (
                        <input
                          type="text"
                          value={formData.alimFormulaNombre || ''}
                          onChange={e => updateAlimentacion({ alimFormulaNombre: e.target.value })}
                          placeholder="Nombre de la fórmula..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5">
                          <input
                            type="number"
                            value={formData.alimFormulaOz || ''}
                            onChange={e => updateAlimentacion({ alimFormulaOz: e.target.value })}
                            placeholder="Oz"
                            className="w-full bg-transparent text-slate-900 dark:text-white text-xs font-bold focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">Oz</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5">
                          <span className="text-[10px] text-slate-500 font-bold">cada</span>
                          <input
                            type="number"
                            value={formData.alimFormulaFrecuencia || ''}
                            onChange={e => updateAlimentacion({ alimFormulaFrecuencia: e.target.value })}
                            placeholder="hrs"
                            className="w-full bg-transparent text-slate-900 dark:text-white text-xs font-bold focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">hrs</span>
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold">LME (meses)</label>
                        <button
                          type="button"
                          onClick={() => updateAlimentacion({ alimHideLme: !formData.alimHideLme })}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer ${
                            formData.alimHideLme 
                              ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/40' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-rose-600 dark:hover:text-rose-400'
                          }`}
                        >
                          {formData.alimHideLme ? 'QUITADO' : 'QUITAR'}
                        </button>
                      </div>
                      <input
                        type="number"
                        disabled={formData.alimHideLme}
                        value={formData.alimLmeMeses || ''}
                        onChange={e => updateAlimentacion({ alimLmeMeses: e.target.value })}
                        placeholder="ej. 6"
                        className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold transition-opacity placeholder:text-slate-400 dark:placeholder:text-slate-500 ${formData.alimHideLme ? 'opacity-30' : 'opacity-100'}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold">Dieta Actual (días por semana 0/7):</label>
                        <button
                          type="button"
                          onClick={() => updateAlimentacion({ alimHideDieta: !formData.alimHideDieta })}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer ${
                            formData.alimHideDieta 
                              ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/40' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-rose-600 dark:hover:text-rose-400'
                          }`}
                        >
                          {formData.alimHideDieta ? 'QUITADO' : 'QUITAR'}
                        </button>
                      </div>
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition-opacity ${formData.alimHideDieta ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                        {[
                          { key: 'alimProteinasSemana' as const, label: 'Proteínas', defaultVal: '2/7' },
                          { key: 'alimVegetalesSemana' as const, label: 'Vegetales', defaultVal: '4/7' },
                          { key: 'alimCarbohidratosSemana' as const, label: 'Carbohidratos', defaultVal: '7/7' },
                          { key: 'alimDulcesSemana' as const, label: 'Dulces', defaultVal: '1/7' },
                        ].map(d => {
                            const value = formData[d.key] || d.defaultVal;
                            const numerator = value.split('/')[0] || '0';
                            
                            return (
                              <div key={d.key} className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl p-2 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{d.label}</span>
                                  <span className="text-[10.5px] font-black text-teal-800 dark:text-teal-300 bg-teal-600/12 dark:bg-teal-500/15 border border-teal-600/25 dark:border-teal-500/30 px-2 py-0.5 rounded-md">
                                    {numerator}/7
                                  </span>
                                </div>
                                <div className="grid grid-cols-8 gap-1">
                                  {['0', '1', '2', '3', '4', '5', '6', '7'].map(dayNum => {
                                    const active = numerator === dayNum;
                                    return (
                                      <button
                                        key={dayNum}
                                        type="button"
                                        onClick={() => updateAlimentacion({ [d.key]: `${dayNum}/7` })}
                                        className={`py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer border active:scale-95 ${
                                          active
                                            ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 border-teal-500 dark:border-teal-300 shadow-xs dark:shadow-[0_0_10px_rgba(20,184,166,0.6)]'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                      >
                                        {dayNum}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.alimentacion}
                      onChange={e => handleChange('alimentacion', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 4. DESARROLLO */}
                <div id="sec-interrogatorio-4-desarrollo" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      4. Desarrollo Psicomotor (Meses en Número)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {[
                      { key: 'desarrolloCabezaMeses' as const, label: 'Sostén Cefálico', defaultVal: '3' },
                      { key: 'desarrolloSentoMeses' as const, label: 'Se Sentó', defaultVal: '6' },
                      { key: 'desarrolloParoMeses' as const, label: 'Se Paró', defaultVal: '10' },
                      { key: 'desarrolloCaminoMeses' as const, label: 'Caminó', defaultVal: '12' },
                      { key: 'desarrolloEsfinterMeses' as const, label: 'Control Esfínter', defaultVal: '24' },
                      { key: 'desarrolloDienteMeses' as const, label: 'Primer Diente', defaultVal: '7' },
                      { key: 'desarrolloPalabrasMeses' as const, label: 'Primeras Palabras', defaultVal: '10' },
                    ].map(item => (
                      <div key={item.key} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700 flex flex-col justify-between">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-400 text-[10px] mb-1 font-semibold">{item.label}</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formData[item.key] || ''}
                              onChange={e => updateDesarrollo({ [item.key]: e.target.value.replace(/\D/g, '') })}
                              placeholder={item.defaultVal}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500/70 font-bold text-center text-xs"
                            />
                            <span className="text-[10px] text-slate-500">m</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateDesarrollo({ [item.key]: 'Aún no desarrollado' })}
                          className="mt-1.5 w-full text-[8.5px] py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/35 dark:border-amber-500/30 font-bold transition-all cursor-pointer truncate"
                          title="Marcar como aún no desarrollado"
                        >
                          Aún no desarrollado
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.desarrolloTabulador}
                      onChange={e => handleChange('desarrolloTabulador', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 5. HÁBITOS PSICOLÓGICOS */}
                <div id="sec-interrogatorio-5-habitos" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      5. Hábitos Psicológicos
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Sueño Nocturno</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={formData.habitosSuenoNocturno || ''}
                        onChange={e => {
                          const val = Math.min(24, parseInt(e.target.value || '0', 10));
                          updateHabitos({ habitosSuenoNocturno: String(val) });
                        }}
                        placeholder="ej. 8"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Siestas</label>
                      <input
                        type="number"
                        min="0"
                        max={24 - parseInt(formData.habitosSuenoNocturno || '0', 10)}
                        value={formData.habitosSiestas || ''}
                        onChange={e => {
                          const sleep = parseInt(formData.habitosSuenoNocturno || '0', 10);
                          const val = Math.min(24 - sleep, parseInt(e.target.value || '0', 10));
                          updateHabitos({ habitosSiestas: String(val) });
                        }}
                        placeholder="ej. 2"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Juegos</label>
                      <input
                        type="text"
                        value={formData.habitosJuegos || ''}
                        onChange={e => updateHabitos({ habitosJuegos: e.target.value })}
                        placeholder="ej. Juegos acorde a la edad"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Digitosucción (Chupa dedo)</label>
                      <div className="flex gap-2">
                        {['No', 'Si'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateHabitos({ habitosDigitosuccion: val })}
                            className={`flex-1 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                              (formData.habitosDigitosuccion || 'No') === val
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Onicofagia (Come uñas)</label>
                      <div className="flex gap-2">
                        {['No', 'Si'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateHabitos({ habitosOnicofagia: val })}
                            className={`flex-1 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                              (formData.habitosOnicofagia || 'No') === val
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.habitosPsicologicos}
                      onChange={e => handleChange('habitosPsicologicos', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 6. INMUNIZACIONES Y PRUEBAS */}
                <div id="sec-interrogatorio-6-inmunizaciones" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      6. Inmunizaciones y Pruebas
                    </span>
                  </div>

                  {/* Esquema Cronológico de Vacunación Venezolana */}
                  <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-teal-600/30 dark:border-teal-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-extrabold text-teal-800 dark:text-teal-300 text-xs flex items-center gap-1.5">
                        🇻🇪 Esquema de Vacunación Venezolana (Cronológico por Edad)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const completoStr = VACUNACION_ESQUEMA.map(b => b.label).join('. ');
                          updateInmunizaciones({
                            vacunaBcg: 'Si',
                            vacunaPoliomielitis: 'Si',
                            vacunaDifteria: 'Si',
                            vacunaTosFerina: 'Si',
                            vacunaTetanos: 'Si',
                            vacunasOtras: completoStr,
                            tarjetaInn: 'Posee tarjeta'
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10.5px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Esquema Completo para la Edad</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-[11px]">
                      {VACUNACION_ESQUEMA.map(block => {
                        const isAdded = (formData.vacunasOtras || '').includes(block.key);
                        
                        // Explicit classes to avoid JIT interpolation issues
                        let borderClass = 'border-slate-300 dark:border-slate-700/50';
                        let textClass = 'text-slate-700 dark:text-slate-300';
                        let bgClass = 'bg-slate-500/10';
                        let hoverClass = 'hover:bg-slate-500/20';
                        let accentTextClass = 'text-slate-600 dark:text-slate-400';

                        if (block.id === 'rn') {
                          borderClass = 'border-amber-500/40';
                          textClass = 'text-amber-800 dark:text-amber-300';
                          bgClass = 'bg-amber-500/15 dark:bg-amber-500/20';
                          hoverClass = 'hover:bg-amber-500/25 dark:hover:bg-amber-500/30';
                          accentTextClass = 'text-amber-800 dark:text-amber-300';
                        } else if (block.id === '2m') {
                          borderClass = 'border-sky-500/40';
                          textClass = 'text-sky-800 dark:text-sky-300';
                          bgClass = 'bg-sky-500/15 dark:bg-sky-500/20';
                          hoverClass = 'hover:bg-sky-500/25 dark:hover:bg-sky-500/30';
                          accentTextClass = 'text-sky-800 dark:text-sky-300';
                        } else if (block.id === '4m') {
                          borderClass = 'border-indigo-500/40';
                          textClass = 'text-indigo-800 dark:text-indigo-300';
                          bgClass = 'bg-indigo-500/15 dark:bg-indigo-500/20';
                          hoverClass = 'hover:bg-indigo-500/25 dark:hover:bg-indigo-500/30';
                          accentTextClass = 'text-indigo-800 dark:text-indigo-300';
                        } else if (block.id === '6m') {
                          borderClass = 'border-purple-500/40';
                          textClass = 'text-purple-800 dark:text-purple-300';
                          bgClass = 'bg-purple-500/15 dark:bg-purple-500/20';
                          hoverClass = 'hover:bg-purple-500/25 dark:hover:bg-purple-500/30';
                          accentTextClass = 'text-purple-800 dark:text-purple-300';
                        } else if (block.id === '1a') {
                          borderClass = 'border-emerald-500/40';
                          textClass = 'text-emerald-800 dark:text-emerald-300';
                          bgClass = 'bg-emerald-500/15 dark:bg-emerald-500/20';
                          hoverClass = 'hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30';
                          accentTextClass = 'text-emerald-800 dark:text-emerald-300';
                        }

                        const ageLabel = block.id === 'rn' ? 'Al Nacer' : block.id === '2m' ? '2 Meses' : block.id === '4m' ? '4 Meses' : block.id === '6m' ? '6 Meses' : '1 Año (12 m)';
                        const subtitle = block.id === 'rn' ? 'RN' : block.id === '1a' ? 'Refuerzo' : block.id === '2m' ? '1ra Dosis' : block.id === '4m' ? '2da Dosis' : '3ra Dosis';
                        const vaccines = block.label.split(': ')[1].split(', ');

                        return (
                          <div key={block.id} className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700/80 space-y-2 flex flex-col justify-between group transition-all hover:border-slate-400 dark:hover:border-slate-600">
                            <div>
                              <div className={`${accentTextClass} font-black border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between`}>
                                <span>{ageLabel}</span>
                                <span className="text-[9px] text-slate-500 uppercase">{subtitle}</span>
                              </div>
                              <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 mt-1.5 list-disc list-inside">
                                {vaccines.map((v, i) => <li key={i}>{v}</li>)}
                              </ul>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleVacunaBlock(block.label)}
                              className={`w-full py-1.5 rounded-lg text-[9px] font-black transition-all cursor-pointer border flex items-center justify-center gap-1 shadow-xs active:scale-95 ${
                                isAdded 
                                  ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20' 
                                  : `${bgClass} ${textClass} ${borderClass} ${hoverClass}`
                              }`}
                            >
                              {isAdded ? <Trash2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              <span>{isAdded ? 'QUITAR' : 'AGREGAR'} {ageLabel.toUpperCase()}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] pt-1">Vacunación Obligatoria e Institucional:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'vacunaBcg' as const, label: 'BCG' },
                      { key: 'vacunaHbNeonatal' as const, label: 'HB Neonatal' },
                      { key: 'vacunaPoliomielitis' as const, label: 'Polio' },
                      { key: 'vacunaDifteria' as const, label: 'Difteria' },
                      { key: 'vacunaTosFerina' as const, label: 'Tos Ferina' },
                      { key: 'vacunaTetanos' as const, label: 'Tétanos' },
                      { key: 'vacunaTificas' as const, label: 'Tíficas' },
                      { key: 'vacunaViruela' as const, label: 'Viruela' },
                      { key: 'vacunaAntiamarilica' as const, label: 'Antiamarílica' },
                      { key: 'vacunaPentavalente' as const, label: 'Pentavalente' },
                      { key: 'vacunaRotavirus' as const, label: 'Rotavirus' },
                      { key: 'vacunaNeumococo' as const, label: 'Neumococo' },
                      { key: 'vacunaInfluenza' as const, label: 'Influenza' },
                      { key: 'vacunaTrivalente' as const, label: 'Trivalente Viral' },
                    ].map(v => {
                      const isYes = formData[v.key as keyof HistoriaClinicaPediatrica] === 'Si';
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => updateInmunizaciones({ [v.key]: isYes ? 'No' : 'Si' })}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isYes 
                              ? 'bg-teal-600 text-white border-teal-500 shadow-xs' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {isYes ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {v.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Otras Vacunas</label>
                      <input
                        type="text"
                        value={formData.vacunasOtras || ''}
                        onChange={e => updateInmunizaciones({ vacunasOtras: e.target.value })}
                        placeholder="ej. Pentavalente, Trivalente Viral"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Tarjeta de Vacunación del INN</label>
                      <div className="flex gap-2">
                        {['Posee tarjeta', 'No posee'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateInmunizaciones({ tarjetaInn: val })}
                            className={`flex-1 py-2 rounded-lg font-bold border transition-all text-[11px] cursor-pointer ${
                              (formData.tarjetaInn || 'Posee tarjeta') === val
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.inmunizacionesPruebas}
                      onChange={e => handleChange('inmunizacionesPruebas', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 7. ANTECEDENTES PERSONALES */}
                <div id="sec-interrogatorio-7-personales" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      7. Antecedentes Personales Patológicos (con botón "No refiere" o escribir)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'apCronicas' as const, label: 'Enfermedades Crónicas No Transmisibles' },
                      { key: 'apHospitalizaciones' as const, label: 'Hospitalizaciones Previas' },
                      { key: 'apTransfusiones' as const, label: 'Transfusiones Sanguíneas' },
                      { key: 'apQuirurgicos' as const, label: 'Intervenciones Quirúrgicas' },
                      { key: 'apTraumatismos' as const, label: 'Traumatismos' },
                    ].map(item => (
                      <div key={item.key} className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <label className="font-semibold text-slate-800 dark:text-slate-300 text-[11px]">{item.label}</label>
                          <button
                            type="button"
                            onClick={() => updateAntecedentesPersonales({ [item.key]: 'No refiere' })}
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 shrink-0 cursor-pointer"
                          >
                            No refiere
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData[item.key] || ''}
                          onChange={e => updateAntecedentesPersonales({ [item.key]: e.target.value })}
                          placeholder="No refiere / Describa patología"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={70}
                      value={formData.antecedentesPersonales}
                      onChange={e => handleChange('antecedentesPersonales', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* 8. HISTORIA FAMILIAR */}
                <div id="sec-interrogatorio-8-familiares" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3 scroll-mt-24 transition-all`}>
                  <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2 flex-wrap gap-2`}>
                    <span className="font-black text-xs uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      8. Historia Familiar (con opción rápida "No refiere" / escribir)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateHistoriaFamiliar({
                          hfMadre: 'Sano / APS', hfMadreVivo: 'Vivo',
                          hfPadre: 'Sano / APS', hfPadreVivo: 'Vivo',
                          hfAbueloPaterno: 'Sano / APS', hfAbueloPaternoVivo: 'Vivo',
                          hfAbuelaPaterna: 'Sano / APS', hfAbuelaPaternaVivo: 'Vivo',
                          hfAbueloMaterno: 'Sano / APS', hfAbueloMaternoVivo: 'Vivo',
                          hfAbuelaMaterna: 'Sano / APS', hfAbuelaMaternaVivo: 'Vivo',
                          hfHermanos: 'Sano / APS', hfHermanosVivo: 'Vivo'
                        })}
                        className="text-[10px] bg-teal-600/12 dark:bg-teal-600/20 hover:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 px-2 py-1 rounded-lg border border-teal-600/30 dark:border-teal-500/30 font-bold cursor-pointer"
                      >
                        Todos Sano / APS
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHistoriaFamiliar({
                          hfMadre: 'No refiere',
                          hfPadre: 'No refiere',
                          hfAbueloPaterno: 'No refiere',
                          hfAbuelaPaterna: 'No refiere',
                          hfAbueloMaterno: 'No refiere',
                          hfAbuelaMaterna: 'No refiere',
                          hfHermanos: 'No refiere'
                        })}
                        className="text-[10px] bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold cursor-pointer"
                      >
                        Todos No refiere
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'hfMadre' as const, label: 'Madre', type: 'detailed', ageKey: 'hfMadreEdad', statusKey: 'hfMadreVivo', causeKey: 'hfMadreCausa' },
                      { key: 'hfPadre' as const, label: 'Padre', type: 'detailed', ageKey: 'hfPadreEdad', statusKey: 'hfPadreVivo', causeKey: 'hfPadreCausa' },
                      { key: 'hfAbueloPaterno' as const, label: 'Abuelo Paterno', type: 'detailed', ageKey: 'hfAbueloPaternoEdad', statusKey: 'hfAbueloPaternoVivo', causeKey: 'hfAbueloPaternoCausa' },
                      { key: 'hfAbuelaPaterna' as const, label: 'Abuela Paterna', type: 'detailed', ageKey: 'hfAbuelaPaternaEdad', statusKey: 'hfAbuelaPaternaVivo', causeKey: 'hfAbuelaPaternaCausa' },
                      { key: 'hfAbueloMaterno' as const, label: 'Abuelo Materno', type: 'detailed', ageKey: 'hfAbueloMaternoEdad', statusKey: 'hfAbueloMaternoVivo', causeKey: 'hfAbueloMaternoCausa' },
                      { key: 'hfAbuelaMaterna' as const, label: 'Abuela Materna', type: 'detailed', ageKey: 'hfAbuelaMaternaEdad', statusKey: 'hfAbuelaMaternaVivo', causeKey: 'hfAbuelaMaternaCausa' },
                      { key: 'hfHermanos' as const, label: 'Hermanos', type: 'detailed', ageKey: 'hfHermanosEdad', statusKey: 'hfHermanosVivo', causeKey: 'hfHermanosCausa' },
                    ].map(item => (
                      <div key={item.key} className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-slate-800 dark:text-slate-300 text-[11px]">{item.label}</label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                updateHistoriaFamiliar({ 
                                  [item.key]: 'Sano / APS', 
                                  [item.statusKey!]: 'Vivo'
                                });
                              }}
                              className="text-[9.5px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                            >
                              Sano
                            </button>
                            <button
                              type="button"
                              onClick={() => updateHistoriaFamiliar({ [item.key]: 'No refiere' })}
                              className="text-[9.5px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                            >
                              No refiere
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="grid grid-cols-2 gap-2">
                            {item.key !== 'hfHermanos' && (
                              <div>
                                <label className="block text-[9px] text-slate-600 dark:text-slate-500 font-bold uppercase">Edad (solo número)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={(formData as any)[item.ageKey!] || ''}
                                  onChange={e => updateHistoriaFamiliar({ [item.ageKey!]: e.target.value.replace(/\D/g, '') })}
                                  placeholder="Ej: 32"
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white text-[11px] font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-[9px] text-slate-600 dark:text-slate-500 font-bold uppercase">Estado</label>
                              <select
                                value={(formData as any)[item.statusKey!] || 'Vivo'}
                                onChange={e => updateHistoriaFamiliar({ [item.statusKey!]: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-slate-900 dark:text-white text-[11px] font-medium"
                              >
                                <option value="Vivo">Vivo</option>
                                <option value="Fallecido">Fallecido</option>
                              </select>
                            </div>
                          </div>
                          {(formData as any)[item.statusKey!] === 'Fallecido' && (
                            <div>
                              <label className="block text-[9px] text-slate-600 dark:text-slate-500 font-bold uppercase">Causa de muerte</label>
                              <input
                                type="text"
                                value={(formData as any)[item.causeKey!] || ''}
                                onChange={e => updateHistoriaFamiliar({ [item.causeKey!]: e.target.value })}
                                placeholder="Causa"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white text-[11px] font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-[9px] text-slate-600 dark:text-slate-500 font-bold uppercase">Antecedentes</label>
                            <input
                              type="text"
                              value={formData[item.key] || ''}
                              onChange={e => updateHistoriaFamiliar({ [item.key]: e.target.value })}
                              placeholder="APS / Patologías"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white text-[11px] font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`mt-2 pt-2 border-t ${themeTokens.sectionDivider}`}>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Texto Final Compuesto para el PDF:</label>
                    <AutoExpandingTextarea
                      minHeight={80}
                      value={formData.historiaFamiliar}
                      onChange={e => handleChange('historiaFamiliar', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 4 FORM: EXAMEN FUNCIONAL */}
            {activePageNum === 4 && (
              <div className={`border rounded-2xl p-5 space-y-4 transition-all shadow-sm dark:shadow-lg ${themeTokens.cardSurface}`}>
                <div className={`border-b ${themeTokens.sectionDivider} pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wide flex items-center gap-2 ${themeTokens.accentText}`}>
                      <Stethoscope className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                      Página 4: Examen Funcional (14 Sistemas)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Texto oficial normal cargado según edad y sexo. Desbloquea cada sistema para editar o usa Llenado rápido; al bloquear se protege tu texto sin borrarlo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetAllFuncionalToNormal}
                      title="Cargar y restaurar el texto normal oficial en los 14 sistemas"
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-600/12 dark:bg-teal-600/20 hover:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/40 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      Restaurar lo normal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleQuickFillAll('funcional')}
                      title="Desplegar u ocultar el llenado rápido patológico en los 14 sistemas"
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs ${
                        isAnyFuncionalQuickFillOpen
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-indigo-600/12 dark:bg-indigo-500/20 hover:bg-indigo-600/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Llenado rápido
                    </button>
                  </div>
                </div>

                {/* Quick sub-navigation dropdown for 14 Sistemas Funcionales */}
                <div className={`pb-2.5 border-b ${themeTokens.sectionDivider}`}>
                  <HistoriaQuickJumpDropdown
                    activePageNum={activePageNum}
                    scopedPage={4}
                    compact
                    dataTutorial="p4-sistemas-nav"
                    onSelectJump={quickJumpToSection}
                    label="Ir a sistema del Examen Funcional (14)"
                    placeholder="Despliega para saltar a cualquiera de los 14 sistemas funcionales..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {EXAMEN_FUNCIONAL_SISTEMAS.map((sec, secIdx) => {
                    const normalText = getPediatricNormalFunctionalExam(formData.edad, formData.generoPatient || 'niño')[sec.key] || '';
                    const isUnlocked = !!unlockedExamFields[sec.key];
                    const isTextEqualToNormal = (formData[sec.key] || '').trim() === normalText.trim();
                    const isModified = isUnlocked || (!isTextEqualToNormal && Boolean(formData[sec.key]));
                    const isQuickFillOpen = !!openQuickFillFields[sec.key];
                    const quickFillSection = getQuickFillSection('funcional', sec.key);

                    return (
                      <div 
                        key={sec.key} 
                        id={`sec-funcional-${sec.key}`}
                        className={`border rounded-xl p-3.5 transition-all scroll-mt-24 ${
                          isModified 
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/50 shadow-sm ring-1 ring-amber-400/40 dark:ring-amber-500/30' 
                            : `${themeTokens.cardInnerSurface} hover:border-slate-400 dark:hover:border-slate-600`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <span className={`font-bold ${isUnlocked ? 'text-amber-900 dark:text-amber-200 font-extrabold' : 'text-slate-800 dark:text-slate-200'}`}>{sec.label}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              data-tutorial={secIdx === 0 ? 'p4-lock-btn-first' : undefined}
                              onClick={() => handleToggleSectionLock(sec.key, 'funcional')}
                              title={isUnlocked ? 'Bloquear este sistema conservando el texto escrito' : 'Desbloquear este sistema para editar libremente'}
                              className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs ${
                                isUnlocked
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-emerald-600/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-600/30 dark:border-emerald-500/30'
                              }`}
                            >
                              {isUnlocked ? (
                                <><Lock className="w-2.5 h-2.5" /> Bloquear</>
                              ) : (
                                <><Unlock className="w-2.5 h-2.5" /> Desbloquear</>
                              )}
                            </button>
                            <button
                              type="button"
                              data-tutorial={secIdx === 0 ? 'p4-restore-btn-first' : undefined}
                              onClick={() => handleRestoreSingleExamToNormal(sec.key, 'funcional')}
                              title="Restaurar este sistema a su texto normal"
                              className="text-[9.5px] font-black px-2 py-0.5 rounded-full border bg-teal-600/10 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-600/30 dark:border-teal-500/30 hover:bg-teal-600/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Restaurar normal
                            </button>
                            {quickFillSection && (
                              <button
                                type="button"
                                data-tutorial={secIdx === 0 ? 'p4-quickfill-btn-first' : undefined}
                                onClick={() => handleToggleQuickFillPanel(sec.key)}
                                className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                                  isQuickFillOpen
                                    ? 'bg-indigo-600 text-white border-indigo-500'
                                    : 'bg-indigo-600/12 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/35 hover:bg-indigo-600/20'
                                }`}
                              >
                                <Sparkles className="w-2.5 h-2.5" /> Llenado rápido
                              </button>
                            )}
                          </div>
                        </div>

                        {isQuickFillOpen && quickFillSection && (
                          <ClinicalExamQuickFillPanel
                            section={quickFillSection}
                            selections={quickFillSelections[sec.key] || {}}
                            onToggleOption={(group, optionId) =>
                              handleToggleQuickFillOptionForField(sec.key, 'funcional', group, optionId)
                            }
                            onClearSelections={() => handleClearQuickFillForField(sec.key, 'funcional')}
                          />
                        )}

                        <div className="relative">
                          <AutoExpandingTextarea
                            minHeight={150}
                            readOnly={!isUnlocked}
                            value={formData[sec.key] !== undefined ? formData[sec.key] : normalText}
                            onChange={e => handleChange(sec.key, e.target.value)}
                            placeholder={normalText}
                            className={`w-full rounded-lg p-3 text-sm transition-all font-medium leading-relaxed ${
                              isUnlocked
                                ? 'bg-white dark:bg-amber-950 text-amber-950 dark:text-amber-100 border-2 border-amber-500 dark:border-amber-400 focus:border-amber-600 dark:focus:border-amber-300 focus:ring-2 focus:ring-amber-400/40 shadow-inner'
                                : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700/80 cursor-not-allowed opacity-85'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 5 FORM: EXAMEN FÍSICO COMPLETO (ÍTEMS 1 AL 17) */}
            {activePageNum === 5 && (
              <div className={`border rounded-2xl p-5 space-y-4 transition-all shadow-sm dark:shadow-lg ${themeTokens.cardSurface}`}>
                <div className={`border-b ${themeTokens.sectionDivider} pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wide flex items-center gap-2 ${themeTokens.accentText}`}>
                      <Stethoscope className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                      Página 5: Examen Físico Completo (Ítems 1 al 17)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Texto oficial normal cargado según edad y sexo. Desbloquea cada acápite o usa Llenado rápido semiológico; al bloquear se protege el texto sin borrarlo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetAllFisicoToNormal}
                      title="Restaurar el texto normal oficial en los 17 acápites"
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-600/12 dark:bg-teal-600/20 hover:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/40 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      Restaurar lo normal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleQuickFillAll('fisico')}
                      title="Desplegar u ocultar el llenado rápido semiológico en todo el Examen Físico"
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs ${
                        isAnyFisicoQuickFillOpen
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-indigo-600/12 dark:bg-indigo-500/20 hover:bg-indigo-600/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Llenado rápido
                    </button>
                  </div>
                </div>

                {/* Quick sub-navigation dropdown for 17 Ítems de Examen Físico */}
                <div className={`pb-2.5 border-b ${themeTokens.sectionDivider}`}>
                  <HistoriaQuickJumpDropdown
                    activePageNum={activePageNum}
                    scopedPage={5}
                    compact
                    onSelectJump={quickJumpToSection}
                    label="Ir a acápite del Examen Físico (Signos, Antropometría e ítems 1 al 17)"
                    placeholder="Despliega para saltar a Signos Vitales, Antropometría o ítems 1 al 17..."
                  />
                </div>

                {/* Signos Vitales y Antropometría Divididos */}
                <div className="space-y-3">
                  {/* Card 1: Signos Vitales */}
                  <div data-tutorial="p5-signos-vitales" className={`${themeTokens.cardInnerSurface} p-3.5 rounded-xl border space-y-2`}>
                    <h4 className="text-xs font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Signos Vitales
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Temp (°C)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.temp}
                          onChange={e => handleChange('temp', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="37"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">FR (x')</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.fr}
                          onChange={e => handleChange('fr', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">FC (x')</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.fc}
                          onChange={e => handleChange('fc', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">TA (mmHg)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.ta}
                          onChange={e => handleChange('ta', sanitizeBloodPressure(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder=""
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold whitespace-nowrap">SO2 (%) sin O2</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.so2}
                            onChange={e => handleChange('so2', sanitizeNumericDecimal(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            placeholder="98"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold whitespace-nowrap">SO2 (%) con O2</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.so2ConO2 || ''}
                            onChange={e => handleChange('so2ConO2', sanitizeNumericDecimal(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            placeholder="99"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Antropometría & Percentiles Calculados Automáticamente */}
                  <div data-tutorial="p5-antropometria-peso-talla" className={`${themeTokens.cardInnerSurface} p-3.5 rounded-xl border space-y-2`}>
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between flex-wrap gap-1">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Antropometría & Percentiles Pediatrícos
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal normal-case">Cálculo automático según edad ({formData.edad || '12 meses'})</span>
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 mb-1 font-bold">Peso (kg)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.peso}
                          onChange={e => handleChange('peso', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-amber-500/50 dark:border-amber-500/40 rounded-lg px-2.5 py-1.5 text-amber-800 dark:text-amber-200 font-black placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 mb-1 font-bold">Talla (cm)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.talla}
                          onChange={e => handleChange('talla', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-amber-500/50 dark:border-amber-500/40 rounded-lg px-2.5 py-1.5 text-amber-800 dark:text-amber-200 font-black placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="75"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">CC (cm - Cefálico)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.cc || ''}
                          onChange={e => handleChange('cc', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="46"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">CA (cm - Abdominal)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.ca || ''}
                          onChange={e => handleChange('ca', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="44"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">CT (cm - Torácico)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.ct || ''}
                          onChange={e => handleChange('ct', sanitizeNumericDecimal(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="45"
                        />
                      </div>
                    </div>

                    {/* Resumen de Percentiles */}
                    {(() => {
                      const perc = calculatePediatricPercentiles(formData.peso, formData.talla, formData.edad, formData.generoPatient);
                      return (
                        <div className={`grid grid-cols-3 gap-2 pt-2 border-t ${themeTokens.sectionDivider} text-center text-xs`}>
                          <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">Peso / Edad (P/E)</span>
                            <span className="font-black text-amber-700 dark:text-amber-300 text-sm">{formData.percentilPesoEdad || perc.pesoEdad}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">Talla / Edad (T/E)</span>
                            <span className="font-black text-amber-700 dark:text-amber-300 text-sm">{formData.percentilTallaEdad || perc.tallaEdad}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">Peso / Talla (P/T)</span>
                            <span className="font-black text-amber-700 dark:text-amber-300 text-sm">{formData.percentilPesoTalla || perc.pesoTalla}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 17 Ítems de Examen Físico */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {EXAMEN_FISICO_ITEMS_LIST.map((sec, secIdx) => {
                    const normalText = getPediatricNormalPhysicalExam(formData.edad, formData.generoPatient || 'niño')[sec.key] || '';
                    const isUnlocked = !!unlockedExamFields[sec.key];
                    const isTextEqualToNormal = (formData[sec.key] || '').trim() === normalText.trim();
                    const isModified = isUnlocked || (!isTextEqualToNormal && Boolean(formData[sec.key]));
                    const isQuickFillOpen = !!openQuickFillFields[sec.key];
                    const quickFillSection = getQuickFillSection('fisico', sec.key);

                    return (
                      <div 
                        key={sec.key} 
                        id={`sec-fisico-${sec.key}`}
                        data-tutorial={sec.key === 'toraxPulmonesFisico' ? 'p5-torax-card' : undefined}
                        className={`border rounded-xl p-3.5 transition-all scroll-mt-24 ${
                          isModified 
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/50 shadow-sm ring-1 ring-amber-400/40 dark:ring-amber-500/30' 
                            : `${themeTokens.cardInnerSurface} hover:border-slate-400 dark:hover:border-slate-600`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <span className={`font-bold ${isUnlocked ? 'text-amber-900 dark:text-amber-200 font-extrabold' : 'text-slate-800 dark:text-slate-200'}`}>{sec.label}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              data-tutorial={secIdx === 0 ? 'p5-fisico-lock-first' : undefined}
                              onClick={() => handleToggleSectionLock(sec.key, 'fisico')}
                              title={isUnlocked ? 'Bloquear este acápite conservando el texto escrito' : 'Desbloquear este acápite para editar libremente'}
                              className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs ${
                                isUnlocked
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-emerald-600/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-600/30 dark:border-emerald-500/30'
                              }`}
                            >
                              {isUnlocked ? (
                                <><Lock className="w-2.5 h-2.5" /> Bloquear</>
                              ) : (
                                <><Unlock className="w-2.5 h-2.5" /> Desbloquear</>
                              )}
                            </button>
                            <button
                              type="button"
                              data-tutorial={secIdx === 0 ? 'p5-fisico-restore-first' : undefined}
                              onClick={() => handleRestoreSingleExamToNormal(sec.key, 'fisico')}
                              title="Restaurar este acápite a su texto normal"
                              className="text-[9.5px] font-black px-2 py-0.5 rounded-full border bg-teal-600/10 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-600/30 dark:border-teal-500/30 hover:bg-teal-600/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Restaurar normal
                            </button>
                            {quickFillSection && (
                              <button
                                type="button"
                                data-tutorial={sec.key === 'toraxPulmonesFisico' ? 'p5-torax-quickfill-btn' : undefined}
                                onClick={() => handleToggleQuickFillPanel(sec.key)}
                                className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                                  isQuickFillOpen
                                    ? 'bg-indigo-600 text-white border-indigo-500'
                                    : 'bg-indigo-600/12 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/35 hover:bg-indigo-600/20'
                                }`}
                              >
                                <Sparkles className="w-2.5 h-2.5" /> Llenado rápido
                              </button>
                            )}
                          </div>
                        </div>

                        {isQuickFillOpen && quickFillSection && (
                          <ClinicalExamQuickFillPanel
                            section={quickFillSection}
                            selections={quickFillSelections[sec.key] || {}}
                            onToggleOption={(group, optionId) =>
                              handleToggleQuickFillOptionForField(sec.key, 'fisico', group, optionId)
                            }
                            onClearSelections={() => handleClearQuickFillForField(sec.key, 'fisico')}
                          />
                        )}

                        <div className="relative">
                          <AutoExpandingTextarea
                            minHeight={150}
                            readOnly={!isUnlocked}
                            value={formData[sec.key] !== undefined ? formData[sec.key] : normalText}
                            onChange={e => handleChange(sec.key, e.target.value)}
                            placeholder={normalText}
                            className={`w-full rounded-lg p-2.5 text-xs transition-all font-medium leading-relaxed ${
                              isUnlocked
                                ? 'bg-white dark:bg-amber-950 text-amber-950 dark:text-amber-100 border-2 border-amber-500 dark:border-amber-400 focus:border-amber-600 dark:focus:border-amber-300 focus:ring-2 focus:ring-amber-400/40 shadow-inner'
                                : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700/80 cursor-not-allowed opacity-85'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 6 FORM: EXCLUSIVA PARA EVALUACIÓN SOCIOECONÓMICA GRAFFAR */}
            {activePageNum === 6 && (
              <div className={`${themeTokens.cardSurface} border rounded-2xl p-5 space-y-6 text-xs shadow-sm dark:shadow-lg`}>
                <div className="border-b border-amber-500/30 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      Página 6: Evaluación Socioeconómica GRAFFAR
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Método Méndez Castellano. Seleccione el número (1 a 5) en cada categoría para calcular automáticamente el puntaje y el estrato social.
                    </p>
                  </div>

                  {/* Puntaje y Estrato Badge */}
                  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/60 dark:to-emerald-900/60 border border-teal-600/30 dark:border-teal-500/40 rounded-2xl p-3 flex items-center gap-4 shadow-sm dark:shadow-lg">
                    <div>
                      <span className="block text-[10px] text-teal-800 dark:text-teal-300 uppercase font-bold tracking-wider">Puntaje Total:</span>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">{formData.graffarPuntajeTotal || 6} / 20</span>
                    </div>
                    <div className="border-l border-teal-600/25 dark:border-teal-500/30 pl-4">
                      <span className="block text-[10px] text-teal-800 dark:text-teal-300 uppercase font-bold tracking-wider">Estrato Social:</span>
                      <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                        Estrato {formData.graffarEstrato || 'I'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 Categorías A, B, C, D */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Categoría A */}
                  <div data-tutorial="p6-graffar-a" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3`}>
                    <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                      <span className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                        A) Profesión del Jefe de la Familia
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${themeTokens.accentBadge}`}>
                        {formData.graffarScoreA || 1} pt(s)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { score: 1, label: 'a.1. Profesión Universitaria' },
                        { score: 2, label: 'a.2. Profesión Técnica o Mediano Comerciante' },
                        { score: 3, label: 'a.3. Empleado sin Profesión Universitaria, Pequeño Comerciante' },
                        { score: 4, label: 'a.4. Obrero Especializado' },
                        { score: 5, label: 'a.5. Obrero No Especializado' },
                      ].map(opt => {
                        const isSelected = (formData.graffarScoreA || 1) === opt.score;
                        return (
                          <button
                            key={opt.score}
                            type="button"
                            onClick={() => handleGraffarScoreChange('A', opt.score, opt.label)}
                            className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600/15 dark:bg-teal-600/30 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Categoría B */}
                  <div data-tutorial="p6-graffar-b" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3`}>
                    <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                      <span className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                        B) Nivel de Instrucción de la Madre
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${themeTokens.accentBadge}`}>
                        {formData.graffarScoreB || 1} pt(s)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { score: 1, label: 'b.1. Enseñanza Universitaria' },
                        { score: 2, label: 'b.2. Enseñanza Secundaria Completa o Técnica Superior' },
                        { score: 3, label: 'b.3. Enseñanza secundaria incompleta o técnico Inferior' },
                        { score: 4, label: 'b.4. Enseñanza Primaria' },
                        { score: 5, label: 'b.5. Analfabeta' },
                      ].map(opt => {
                        const isSelected = (formData.graffarScoreB || 1) === opt.score;
                        return (
                          <button
                            key={opt.score}
                            type="button"
                            onClick={() => handleGraffarScoreChange('B', opt.score, opt.label)}
                            className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600/15 dark:bg-teal-600/30 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Categoría C */}
                  <div data-tutorial="p6-graffar-c" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3`}>
                    <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                      <span className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                        C) Fuente de Ingreso
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${themeTokens.accentBadge}`}>
                        {formData.graffarScoreC || 3} pt(s)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { score: 1, label: 'c.1. Fortuna Heredada' },
                        { score: 2, label: 'c.2. Honorarios Profesionales' },
                        { score: 3, label: 'c.3. Sueldo Mensual' },
                        { score: 4, label: 'c.4. Salario Semanal por Tarea por Destajo' },
                        { score: 5, label: 'c.5. Donaciones de Origen Público' },
                      ].map(opt => {
                        const isSelected = (formData.graffarScoreC || 3) === opt.score;
                        return (
                          <button
                            key={opt.score}
                            type="button"
                            onClick={() => handleGraffarScoreChange('C', opt.score, opt.label)}
                            className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600/15 dark:bg-teal-600/30 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Categoría D */}
                  <div data-tutorial="p6-graffar-d" className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-3`}>
                    <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-2`}>
                      <span className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                        D) Condiciones de Alojamiento
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${themeTokens.accentBadge}`}>
                        {formData.graffarScoreD || 1} pt(s)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { score: 1, label: 'd.1. Vivienda con Óptimas Condiciones Sanitarias' },
                        { score: 2, label: 'd.2. Viviendas Óptimas' },
                        { score: 3, label: 'd.3. Buenas Condiciones Sanitarias en Espacio Reducido' },
                        { score: 4, label: 'd.4. Ambiente Reducido y Falta de Condiciones Sanitarias' },
                        { score: 5, label: 'd.5. Rancho o Vivienda en una sola Habitación.' },
                      ].map(opt => {
                        const isSelected = (formData.graffarScoreD || 1) === opt.score;
                        return (
                          <button
                            key={opt.score}
                            type="button"
                            onClick={() => handleGraffarScoreChange('D', opt.score, opt.label)}
                            className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600/15 dark:bg-teal-600/30 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Escala Oficial de Resultados */}
                <div className={`${themeTokens.cardInnerSurface} p-4 rounded-2xl border space-y-2`}>
                  <span className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide text-xs">
                    Escala de Resultados Oficial:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    {[
                      { range: 'I: 4-6', desc: 'Estrato I (Clase Alta)', min: 4, max: 6 },
                      { range: 'II: 7-9', desc: 'Estrato II (Medio Alto)', min: 7, max: 9 },
                      { range: 'III: 10-12', desc: 'Estrato III (Medio Bajo)', min: 10, max: 12 },
                      { range: 'IV: 13-16', desc: 'Estrato IV (Pobreza Relativa)', min: 13, max: 16 },
                      { range: 'V: 17-20', desc: 'Estrato V (Pobreza Crítica)', min: 17, max: 20 },
                    ].map(scale => {
                      const currentTotal = formData.graffarPuntajeTotal || 6;
                      const isActive = currentTotal >= scale.min && currentTotal <= scale.max;
                      return (
                        <div
                          key={scale.range}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isActive
                              ? 'bg-teal-600/15 dark:bg-teal-600/30 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-white font-black shadow-sm ring-1 ring-teal-500 dark:ring-teal-400'
                              : 'bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="block font-black text-sm">{scale.range}</span>
                          <span className="block text-[10px] mt-0.5">{scale.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2">
                    <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Resumen / Resultado para Impresión:</label>
                    <input
                      type="text"
                      value={formData.graffarResultado}
                      onChange={e => handleChange('graffarResultado', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 7 FORM: LABORATORIOS */}
            {activePageNum === 7 && (
              <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 sm:p-5 space-y-5 text-xs shadow-sm dark:shadow-lg`}>
                <div data-tutorial="p7-labs-header" className="border-b border-emerald-500/30 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                      Página 7: Historia de Laboratorios y Paraclínicos (1 Sola Hoja)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Modelo oficial en una sola hoja (Hematología, Química, Electrolitos, Gases, Orina/Heces, Microbiología/LCR y Serología).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLabSampleIdx(selectedLabSampleIdx === 'all' ? 0 : 'all')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                        selectedLabSampleIdx === 'all'
                          ? `${themeTokens.activePill} border-transparent`
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{selectedLabSampleIdx === 'all' ? 'Ver por Muestra Individual' : 'Ver Hoja Oficial (1 Sola Hoja)'}</span>
                    </button>
                  </div>
                </div>

                {/* Sample Selector Tabs */}
                <div data-tutorial="p7-labs-samples" className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-bold px-1">
                    <span>Seleccione Muestra o Vista de Hoja Completa:</span>
                    {typeof selectedLabSampleIdx === 'number' ? (
                      <span className={themeTokens.accentText}>
                        Editando: Muestra {selectedLabSampleIdx + 1}
                      </span>
                    ) : (
                      <span className={themeTokens.accentText}>
                        Vista: Hoja Oficial Completa (2 Bloques en 1 Hoja)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedLabSampleIdx('all')}
                      className={`px-3.5 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
                        selectedLabSampleIdx === 'all'
                          ? `${themeTokens.activePill} border-transparent font-black`
                          : 'bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>📋 Hoja Oficial (1 Sola Hoja)</span>
                    </button>
                    {Array.from({ length: 7 }).map((_, colIdx) => {
                      const isSelected = selectedLabSampleIdx === colIdx;
                      const dateStr = formData.laboratoriosColumnas?.[colIdx]?.fecha?.trim();
                      const hasValues = Object.keys(formData.laboratoriosColumnas?.[colIdx]?.valores || {}).length > 0;

                      return (
                        <button
                          key={colIdx}
                          type="button"
                          onClick={() => setSelectedLabSampleIdx(colIdx)}
                          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? `${themeTokens.activePill} border-transparent font-black scale-102`
                              : hasValues
                              ? 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              : 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-300/80 dark:border-slate-700/60 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>Muestra {colIdx + 1}</span>
                          {dateStr ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              isSelected ? 'bg-black/20 dark:bg-slate-950 text-white dark:text-teal-300' : 'bg-slate-100 dark:bg-slate-900 text-teal-700 dark:text-teal-400 border border-slate-300 dark:border-slate-700'
                            }`}>
                              {dateStr}
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-60 font-normal">
                              (Fecha)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SINGLE SAMPLE COMFORTABLE VIEW */}
                {typeof selectedLabSampleIdx === 'number' && (
                  <div className="space-y-4">
                    {/* Active Sample Header Bar */}
                    <div className={`${themeTokens.cardInnerSurface} border rounded-2xl p-4 shadow-sm space-y-3`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border ${themeTokens.accentBadge}`}>
                            M{selectedLabSampleIdx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                              Registros de Muestra {selectedLabSampleIdx + 1}
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              Ingrese los resultados en las casillas de cada categoría oficial.
                            </p>
                          </div>
                        </div>

                        {/* Date field for this sample */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5">
                            <Calendar className={`w-3.5 h-3.5 shrink-0 ${themeTokens.accentIcon}`} />
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Fecha:</label>
                            <input
                              type="text"
                              placeholder="ej. 15/11/2026"
                              value={formData.laboratoriosColumnas?.[selectedLabSampleIdx]?.fecha || ''}
                              onChange={(e) => {
                                const updatedCols = [...(formData.laboratoriosColumnas || [])];
                                while (updatedCols.length <= selectedLabSampleIdx) {
                                  updatedCols.push({ fecha: '', valores: {} });
                                }
                                updatedCols[selectedLabSampleIdx] = {
                                  ...updatedCols[selectedLabSampleIdx],
                                  fecha: e.target.value
                                };
                                handleChange('laboratoriosColumnas', updatedCols);
                              }}
                              className="bg-transparent text-slate-900 dark:text-white font-mono font-bold text-xs sm:text-sm focus:outline-none w-28 sm:w-32 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date();
                              const formatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                              const updatedCols = [...(formData.laboratoriosColumnas || [])];
                              while (updatedCols.length <= selectedLabSampleIdx) {
                                updatedCols.push({ fecha: '', valores: {} });
                              }
                              updatedCols[selectedLabSampleIdx] = {
                                ...updatedCols[selectedLabSampleIdx],
                                fecha: formatted
                              };
                              handleChange('laboratoriosColumnas', updatedCols);
                            }}
                            title="Colocar fecha de hoy"
                            className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                          >
                            Hoy
                          </button>
                        </div>
                      </div>

                      {/* Sample Navigation Buttons & Copy Helper */}
                      <div className={`flex items-center justify-between border-t ${themeTokens.sectionDivider} pt-3 flex-wrap gap-2`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={selectedLabSampleIdx <= 0}
                            onClick={() => setSelectedLabSampleIdx(selectedLabSampleIdx - 1)}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Muestra Anterior (M{selectedLabSampleIdx})</span>
                          </button>

                          <button
                            type="button"
                            disabled={selectedLabSampleIdx >= 6}
                            onClick={() => setSelectedLabSampleIdx(selectedLabSampleIdx + 1)}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>Muestra Siguiente (M{selectedLabSampleIdx + 2})</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {selectedLabSampleIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const prevValores = formData.laboratoriosColumnas?.[selectedLabSampleIdx - 1]?.valores || {};
                              const updatedCols = [...(formData.laboratoriosColumnas || [])];
                              while (updatedCols.length <= selectedLabSampleIdx) {
                                updatedCols.push({ fecha: '', valores: {} });
                              }
                              updatedCols[selectedLabSampleIdx] = {
                                ...updatedCols[selectedLabSampleIdx],
                                valores: { ...prevValores }
                              };
                              handleChange('laboratoriosColumnas', updatedCols);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-teal-600/12 dark:bg-teal-500/10 hover:bg-teal-600/20 dark:hover:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                            <span>Copiar valores de Muestra {selectedLabSampleIdx}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lab Search & Direct Jump Bar */}
                    {(() => {
                      const normalizedQuery = labSearchQuery.trim().toLowerCase();
                      const labMatches = normalizedQuery
                        ? LAB_PANELS.flatMap(panel =>
                            panel.tests
                              .filter(
                                t =>
                                  t.name.toLowerCase().includes(normalizedQuery) ||
                                  t.alias.toLowerCase().includes(normalizedQuery) ||
                                  panel.category.toLowerCase().includes(normalizedQuery)
                              )
                              .map(t => ({ category: panel.category, test: t }))
                          )
                        : [];

                      return (
                        <div className={`${themeTokens.cardInnerSurface} border rounded-2xl p-3.5 space-y-2.5`}>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                data-testid="lab-search-input"
                                value={labSearchQuery}
                                onChange={(e) => setLabSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && labMatches.length > 0) {
                                    e.preventDefault();
                                    jumpToLabTest(labMatches[0].category, labMatches[0].test.name);
                                  }
                                }}
                                placeholder="Buscar examen de laboratorio (ej. Hemoglobina, Sodio, pH, Panel Respiratorio)..."
                                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                              />
                              {labSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setLabSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  aria-label="Limpiar búsqueda"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              data-testid="lab-search-jump-btn"
                              disabled={labMatches.length === 0}
                              onClick={() => {
                                if (labMatches.length > 0) {
                                  jumpToLabTest(labMatches[0].category, labMatches[0].test.name);
                                }
                              }}
                              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Ir al examen</span>
                            </button>
                          </div>

                          {normalizedQuery && (
                            <div className="pt-1">
                              {labMatches.length === 0 ? (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                  No se encontraron exámenes para &ldquo;{labSearchQuery}&rdquo;.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                  {labMatches.slice(0, 12).map((m, idx) => (
                                    <button
                                      key={`${m.category}-${m.test.name}-${idx}`}
                                      type="button"
                                      onClick={() => jumpToLabTest(m.category, m.test.name)}
                                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-teal-950/60 border border-teal-500/40 text-slate-800 dark:text-slate-100 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                      <span>{m.test.name}</span>
                                      <span className="text-[9.5px] text-teal-700 dark:text-teal-400 font-semibold">
                                        ({m.category})
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Grouped Collapsible Clinical Panels (Collapsed by default, expand on click) */}
                    <div className="space-y-3">
                      {LAB_PANELS.map((panel, pIdx) => {
                        const isExpanded = Boolean(expandedLabPanels[panel.category]);
                        const filledCount = panel.tests.reduce((acc, test) => {
                          const v = getHistoriaLabValue(
                            formData.laboratoriosColumnas?.[selectedLabSampleIdx]?.valores,
                            test.name
                          );
                          return acc + (v.trim() ? 1 : 0);
                        }, 0);

                        return (
                          <div
                            key={pIdx}
                            data-lab-panel={panel.category}
                            className={`${themeTokens.cardInnerSurface} border rounded-2xl overflow-hidden transition-all`}
                          >
                            <button
                              type="button"
                              data-testid={`lab-panel-toggle-${pIdx}`}
                              onClick={() =>
                                setExpandedLabPanels(prev => ({
                                  ...prev,
                                  [panel.category]: !prev[panel.category],
                                }))
                              }
                              aria-expanded={isExpanded}
                              className="w-full flex items-center justify-between gap-2 p-3.5 sm:p-4 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            >
                              <span className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide flex items-center gap-2 min-w-0">
                                <span className="truncate">{panel.category}</span>
                                {filledCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 text-[10px] font-black tabular-nums">
                                    {filledCount}/{panel.tests.length}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${panel.badge}`}>
                                  {panel.tests.length} {panel.tests.length === 1 ? 'Parámetro' : 'Parámetros'}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className={`p-4 pt-3 border-t ${themeTokens.sectionDivider}`}>
                                <div className={panel.tests.length === 1 ? 'grid grid-cols-1 gap-3.5' : 'grid grid-cols-1 md:grid-cols-2 gap-3.5'}>
                                  {panel.tests.map((test, tIdx) => {
                                    const currentVal = getHistoriaLabValue(
                                      formData.laboratoriosColumnas?.[selectedLabSampleIdx]?.valores,
                                      test.name
                                    );
                                    const isNumeric = isNumericLabTest(test.name, panel.category);
                                    const isRespPanel = isRespiratoryPanelTest(test.name, panel.category);
                                    const cardId = getLabTestElementId(test.name);
                                    const isHighlighted = highlightedLabTest === test.name;

                                    return (
                                      <div
                                        key={tIdx}
                                        id={cardId}
                                        className={`bg-white dark:bg-slate-900/90 border rounded-xl p-3 space-y-1.5 transition-all scroll-mt-24 ${
                                          isHighlighted
                                            ? 'border-teal-500 ring-2 ring-teal-500/40 bg-teal-50/40 dark:bg-teal-950/30'
                                            : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <label className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                            {test.name}
                                          </label>
                                          <span className="text-[10px] text-teal-700 dark:text-teal-400/80 font-mono shrink-0">
                                            {isRespPanel ? 'Solo texto' : isNumeric ? `${test.ref} · Solo números` : test.ref}
                                          </span>
                                        </div>

                                        <div className="relative">
                                          <input
                                            type="text"
                                            inputMode={isNumeric ? 'decimal' : 'text'}
                                            placeholder={test.placeholder || '--'}
                                            value={currentVal}
                                            onChange={(e) => {
                                              const sanitized = sanitizeLabInputValue(
                                                test.name,
                                                e.target.value,
                                                panel.category
                                              );
                                              const updatedCols = [...(formData.laboratoriosColumnas || [])];
                                              while (updatedCols.length <= selectedLabSampleIdx) {
                                                updatedCols.push({ fecha: '', valores: {} });
                                              }
                                              const nextValores = setHistoriaLabValue(
                                                updatedCols[selectedLabSampleIdx].valores,
                                                test.name,
                                                sanitized
                                              );
                                              updatedCols[selectedLabSampleIdx] = {
                                                ...updatedCols[selectedLabSampleIdx],
                                                valores: nextValores
                                              };
                                              handleChange('laboratoriosColumnas', updatedCols);
                                            }}
                                            className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-teal-800 dark:text-teal-300 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 ${
                                              isRespPanel ? 'text-sm font-semibold' : 'text-base sm:text-lg font-mono font-bold'
                                            }`}
                                          />
                                          {test.unit && (
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono pointer-events-none">
                                              {test.unit}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OFFICIAL 1-SHEET 2-COLUMN COMPARATIVE VIEW (HISTORIA DE LABORATORIOS Y PARACLÍNICOS) */}
                {selectedLabSampleIdx === 'all' && (
                  <div className="space-y-3">
                    <div className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 ${themeTokens.cardInnerSurface} p-3 rounded-xl border`}>
                      {Array.from({ length: 7 }).map((_, colIdx) => (
                        <div key={colIdx}>
                          <label className="block text-[10px] text-teal-800 dark:text-teal-300 font-bold mb-1">Fecha {colIdx + 1} (M{colIdx + 1})</label>
                          <input
                            type="text"
                            placeholder="ej. 15/11"
                            value={formData.laboratoriosColumnas?.[colIdx]?.fecha || ''}
                            onChange={(e) => {
                              const updatedCols = [...(formData.laboratoriosColumnas || [])];
                              while (updatedCols.length <= colIdx) {
                                updatedCols.push({ fecha: '', valores: {} });
                              }
                              updatedCols[colIdx] = {
                                ...updatedCols[colIdx],
                                fecha: e.target.value
                              };
                              handleChange('laboratoriosColumnas', updatedCols);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-slate-900 dark:text-white text-center font-bold text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Interactive Hoja Oficial 2 Columnas */}
                    <div className="overflow-x-auto rounded-xl border border-slate-400 dark:border-slate-700 bg-white text-black p-3 shadow-inner">
                      <div className="text-center font-black uppercase text-sm tracking-wide mb-2 text-black">
                        HISTORIA DE LABORATORIOS Y PARACLÍNICOS
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold mb-2 pb-1 border-b border-black text-black">
                        <div>Paciente: <span className="underline">{formData.apellidos} {formData.nombres}</span></div>
                        <div>H.C.: <span className="underline">{formData.numHistoria || '______'}</span></div>
                        <div>Servicio/Cama: <span className="underline">PEDIATRÍA / {formData.bedNumber || '____'}</span></div>
                      </div>
                      <table className="w-full border-collapse text-[11px] min-w-[920px]" style={{ border: '1px solid #000000', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '14.0%' }} />
                          <col style={{ width: '10.75%' }} />
                          {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <col key={`ed-lcol-${i}`} style={{ width: '5.914%' }} />
                          ))}
                          <col style={{ width: '0.70%' }} />
                          <col style={{ width: '10.20%' }} />
                          <col style={{ width: '8.15%' }} />
                          {[0, 1, 2, 3].map(i => (
                            <col key={`ed-rcol-${i}`} style={{ width: '3.70%' }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr style={{ backgroundColor: '#d9d9d9' }}>
                            <th className="p-1 text-center font-bold text-black border border-black">Examen</th>
                            <th className="p-1 text-center font-bold text-black border border-black">V.R.</th>
                            <th colSpan={7} className="p-1 text-center font-bold text-black border border-black">Fecha (M1 - M7)</th>
                            <th className="border border-black bg-[#d9d9d9]" />
                            <th className="p-1 text-center font-bold text-black border border-black">Examen</th>
                            <th className="p-1 text-center font-bold text-black border border-black">V.R.</th>
                            <th colSpan={4} className="p-1 text-center font-bold text-black border border-black">Fecha (M1 - M4)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {HISTORIA_LAB_PAIR_ROWS.map((pair, rIdx) => (
                            <tr key={`ed-pair-${rIdx}`} className="bg-white">
                              {pair.left.type === 'section' ? (
                                <td colSpan={9} className="px-2 py-1 font-black uppercase text-black border border-black" style={{ backgroundColor: '#b4c6e7' }}>
                                  {pair.left.title}
                                </td>
                              ) : (
                                <>
                                  <td className="px-1.5 py-0.5 font-semibold text-black border border-black truncate">{pair.left.name}</td>
                                  <td className="px-1 py-0.5 text-center text-[10px] text-slate-800 border border-black truncate">{pair.left.ref || ''}</td>
                                  {[0, 1, 2, 3, 4, 5, 6].map((colIdx) => {
                                    const val = getHistoriaLabValue(formData.laboratoriosColumnas?.[colIdx]?.valores, pair.left.name);
                                    const leftIsNum = pair.left.name ? isNumericLabTest(pair.left.name) : false;
                                    return (
                                      <td key={`ed-l-${rIdx}-${colIdx}`} className="p-0 border border-black">
                                        <input
                                          type="text"
                                          inputMode={leftIsNum ? 'decimal' : 'text'}
                                          value={val}
                                          placeholder={`M${colIdx + 1}`}
                                          onChange={(e) => {
                                            const sanitized = pair.left.name
                                              ? sanitizeLabInputValue(pair.left.name, e.target.value)
                                              : e.target.value;
                                            const updatedCols = [...(formData.laboratoriosColumnas || [])];
                                            while (updatedCols.length <= colIdx) {
                                              updatedCols.push({ fecha: '', valores: {} });
                                            }
                                            updatedCols[colIdx] = {
                                              ...updatedCols[colIdx],
                                              valores: setHistoriaLabValue(updatedCols[colIdx].valores, pair.left.name!, sanitized),
                                            };
                                            handleChange('laboratoriosColumnas', updatedCols);
                                          }}
                                          className="w-full h-6 text-center bg-transparent text-black font-mono font-bold text-[11px] focus:outline-none focus:bg-amber-100/80 placeholder:text-slate-300"
                                        />
                                      </td>
                                    );
                                  })}
                                </>
                              )}

                              <td className="border border-black bg-white" />

                              {pair.right.type === 'section' ? (
                                <td colSpan={6} className="px-2 py-1 font-black uppercase text-black border border-black" style={{ backgroundColor: '#b4c6e7' }}>
                                  {pair.right.title}
                                </td>
                              ) : (
                                <>
                                  <td className="px-1.5 py-0.5 font-semibold text-black border border-black truncate">
                                    {pair.right.isBlankSlot ? '' : pair.right.name}
                                  </td>
                                  <td className="px-1 py-0.5 text-center text-[10px] text-slate-800 border border-black truncate">{pair.right.ref || ''}</td>
                                  {[0, 1, 2, 3].map((colIdx) => {
                                    const val = getHistoriaLabValue(formData.laboratoriosColumnas?.[colIdx]?.valores, pair.right.name);
                                    const rightIsNum = pair.right.name ? isNumericLabTest(pair.right.name) : false;
                                    return (
                                      <td key={`ed-r-${rIdx}-${colIdx}`} className="p-0 border border-black">
                                        <input
                                          type="text"
                                          inputMode={rightIsNum ? 'decimal' : 'text'}
                                          value={val}
                                          placeholder={`M${colIdx + 1}`}
                                          onChange={(e) => {
                                            const sanitized = pair.right.name
                                              ? sanitizeLabInputValue(pair.right.name, e.target.value)
                                              : e.target.value;
                                            const updatedCols = [...(formData.laboratoriosColumnas || [])];
                                            while (updatedCols.length <= colIdx) {
                                              updatedCols.push({ fecha: '', valores: {} });
                                            }
                                            updatedCols[colIdx] = {
                                              ...updatedCols[colIdx],
                                              valores: setHistoriaLabValue(updatedCols[colIdx].valores, pair.right.name!, sanitized),
                                            };
                                            handleChange('laboratoriosColumnas', updatedCols);
                                          }}
                                          className="w-full h-6 text-center bg-transparent text-black font-mono font-bold text-[11px] focus:outline-none focus:bg-amber-100/80 placeholder:text-slate-300"
                                        />
                                      </td>
                                    );
                                  })}
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Otros Exámenes y Observaciones</label>
                  <AutoExpandingTextarea
                    minHeight={80}
                    value={formData.laboratoriosOtros}
                    onChange={e => handleChange('laboratoriosOtros', e.target.value)}
                    placeholder="Escriba los resultados de laboratorios adicionales, cultivos o observaciones..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-teal-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}

            {/* PAGE 8 FORM: RESUMEN DE INGRESO */}
            {activePageNum === 8 && (
              <div className={`${themeTokens.cardSurface} border rounded-2xl p-5 space-y-6 text-xs shadow-sm dark:shadow-lg`}>
                <div data-tutorial="p8-resumen-header" className="border-b border-rose-500/30 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-xs"></span> Página 8: Resumen de Ingreso
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Resumen ejecutivo del expediente clínico para visualización rápida.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const firstCol = prev.laboratoriosColumnas?.[0]?.valores || {};
                        return {
                          ...prev,
                          resumenMotivoConsulta: prev.motivosAdmision || prev.resumenMotivoConsulta || '',
                          resumenHistoriaEnfermedad: prev.enfermedadActual || prev.resumenHistoriaEnfermedad || '',
                          resumenAntecedentesObstetricos: prev.antecedentesPrenatales || prev.resumenAntecedentesObstetricos || '',
                          resumenInmunizaciones: prev.inmunizacionesPruebas || prev.resumenInmunizaciones || '',
                          resumenPatologicosPersonales: prev.antecedentesPersonales || prev.resumenPatologicosPersonales || '',
                          resumenHermanos: prev.hfHermanos || prev.resumenHermanos || '',
                          resumenMadre: prev.hfMadre || prev.resumenMadre || '',
                          resumenPadre: prev.hfPadre || prev.resumenPadre || '',
                          resumenAbueloPaterno: prev.hfAbueloPaterno || prev.resumenAbueloPaterno || '',
                          resumenAbuelaPaterna: prev.hfAbuelaPaterna || prev.resumenAbuelaPaterna || '',
                          resumenAbueloMaterno: prev.hfAbueloMaterno || prev.resumenAbueloMaterno || '',
                          resumenAbuelaMaterna: prev.hfAbuelaMaterna || prev.resumenAbuelaMaterna || '',
                          resumenExamenPeso: prev.peso || prev.resumenExamenPeso || '',
                          resumenExamenTalla: prev.talla || prev.resumenExamenTalla || '',
                          resumenExamenFr: prev.fr || prev.resumenExamenFr || '',
                          resumenExamenFc: prev.fc || prev.resumenExamenFc || '',
                          resumenExamenTemp: prev.temp || prev.resumenExamenTemp || '',
                          resumenExamenSo2: prev.so2 || prev.resumenExamenSo2 || '',
                          resumenExamenTa: prev.ta || prev.resumenExamenTa || '',
                          resumenPercentilPe: prev.pesoEdad || prev.resumenPercentilPe || '',
                          resumenPercentilPt: prev.pesoTalla || prev.resumenPercentilPt || '',
                          resumenDiagnosticosIngreso: prev.diagnosticoAdmision || prev.resumenDiagnosticosIngreso || '',
                          // Labs synced from the official HISTORIA DE LABORATORIOS Y PARACLÍNICOS model
                          resumenLabLeu: getHistoriaLabValue(firstCol, 'Leucocitos') || prev.resumenLabLeu || '',
                          resumenLabSeg: getHistoriaLabValue(firstCol, 'Seg. Neutrófilos') || prev.resumenLabSeg || '',
                          resumenLabLin: getHistoriaLabValue(firstCol, 'Linfocitos') || prev.resumenLabLin || '',
                          resumenLabMon: getHistoriaLabValue(firstCol, 'Monocitos') || prev.resumenLabMon || '',
                          resumenLabHb: getHistoriaLabValue(firstCol, 'Hemoglobina') || prev.resumenLabHb || '',
                          resumenLabHto: getHistoriaLabValue(firstCol, 'Hematocrito') || prev.resumenLabHto || '',
                          resumenLabVcm: getHistoriaLabValue(firstCol, 'VCM') || prev.resumenLabVcm || '',
                          resumenLabHcm: getHistoriaLabValue(firstCol, 'HCM') || prev.resumenLabHcm || '',
                          resumenLabPlt: getHistoriaLabValue(firstCol, 'Plaquetas') || prev.resumenLabPlt || '',
                          resumenLabVsg: getHistoriaLabValue(firstCol, 'VSG') || prev.resumenLabVsg || '',
                          resumenLabPcr: getHistoriaLabValue(firstCol, 'PCR') || prev.resumenLabPcr || '',
                        };
                      });
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-600/12 dark:bg-teal-600/20 hover:bg-teal-600/20 dark:hover:bg-teal-600/30 text-teal-800 dark:text-teal-300 border border-teal-600/30 dark:border-teal-500/40 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Sincronizar con expediente completo
                  </button>
                </div>

                <div className={`${themeTokens.cardInnerSurface} p-4 rounded-xl border space-y-4`}>
                  {/* Summary Header synced with Page 1 */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-white/80 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-300 dark:border-slate-700/50 mb-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase">Nombre Completo</label>
                      <input 
                        type="text" 
                        value={`${formData.apellidos}, ${formData.nombres}`} 
                        readOnly 
                        className="w-full bg-transparent border-none text-teal-800 dark:text-teal-300 font-bold p-0 text-xs focus:ring-0" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase">Cama</label>
                      <input 
                        type="text" 
                        value={formData.bedNumber} 
                        onChange={e => handleChange('bedNumber', e.target.value)} 
                        className="w-full bg-transparent border-none text-slate-900 dark:text-white font-bold p-0 text-xs focus:ring-0" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase">Edad</label>
                      <input 
                        type="text" 
                        value={formData.edad} 
                        onChange={e => handleChange('edad', e.target.value)} 
                        className="w-full bg-transparent border-none text-slate-900 dark:text-white font-bold p-0 text-xs focus:ring-0" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase">Servicio</label>
                      <input
                        type="text"
                        value="PEDIATRÍA"
                        readOnly
                        className="w-full bg-transparent border-none text-slate-900 dark:text-white font-bold p-0 text-xs focus:ring-0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase">
                        {formData.isReingreso ? 'Fecha Reingreso' : 'Fecha'}
                      </label>
                      <input 
                        type="text" 
                        value={formData.fechaIngreso} 
                        onChange={e => handleChange('fechaIngreso', e.target.value)} 
                        className="w-full bg-transparent border-none text-slate-900 dark:text-white font-bold p-0 text-xs focus:ring-0" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase">Motivo de la Consulta</label>
                      <input
                        type="text"
                        value={formData.resumenMotivoConsulta}
                        onChange={e => handleChange('resumenMotivoConsulta', e.target.value)}
                        placeholder="ej. Fiebre y dificultad respiratoria"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase">Historia de la Enfermedad Actual</label>
                      <AutoExpandingTextarea
                        minHeight={110}
                        value={formData.resumenHistoriaEnfermedad}
                        onChange={e => handleChange('resumenHistoriaEnfermedad', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white font-medium leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase">Antecedentes Obstétricos</label>
                      <input
                        type="text"
                        value={formData.resumenAntecedentesObstetricos}
                        onChange={e => handleChange('resumenAntecedentesObstetricos', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase">Inmunizaciones</label>
                      <input
                        type="text"
                        value={formData.resumenInmunizaciones}
                        onChange={e => handleChange('resumenInmunizaciones', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase">Ant. Patológicos Personales</label>
                      <input
                        type="text"
                        value={formData.resumenPatologicosPersonales}
                        onChange={e => handleChange('resumenPatologicosPersonales', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className={`block text-teal-800 dark:text-teal-300 font-black uppercase text-[10px] tracking-widest border-b ${themeTokens.sectionDivider} pb-1`}>Antecedentes Patológicos Familiares</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white/80 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                         <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold mb-1">Madre / Abuelos Maternos</label>
                         <div className="flex gap-2">
                           <input type="text" value={formData.resumenMadre} onChange={e => handleChange('resumenMadre', e.target.value)} placeholder="Madre" className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                           <input type="text" value={formData.resumenAbuelaMaterna} onChange={e => handleChange('resumenAbuelaMaterna', e.target.value)} placeholder="Abuela M." className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                           <input type="text" value={formData.resumenAbueloMaterno} onChange={e => handleChange('resumenAbueloMaterno', e.target.value)} placeholder="Abuelo M." className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                         </div>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                         <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold mb-1">Padre / Abuelos Paternos</label>
                         <div className="flex gap-2">
                           <input type="text" value={formData.resumenPadre} onChange={e => handleChange('resumenPadre', e.target.value)} placeholder="Padre" className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                           <input type="text" value={formData.resumenAbuelaPaterna} onChange={e => handleChange('resumenAbuelaPaterna', e.target.value)} placeholder="Abuela P." className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                           <input type="text" value={formData.resumenAbueloPaterno} onChange={e => handleChange('resumenAbueloPaterno', e.target.value)} placeholder="Abuelo P." className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                         </div>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                         <label className="block text-[10px] text-slate-600 dark:text-slate-500 font-bold mb-1">Hermanos</label>
                         <input type="text" value={formData.resumenHermanos} onChange={e => handleChange('resumenHermanos', e.target.value)} placeholder="Detalle hermanos" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className={`block text-teal-800 dark:text-teal-300 font-black uppercase text-[10px] tracking-widest border-b ${themeTokens.sectionDivider} pb-1`}>Examen Físico de Ingreso & Percentiles</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">Peso</label><input type="text" inputMode="decimal" value={formData.resumenExamenPeso} onChange={e => handleChange('resumenExamenPeso', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">Talla</label><input type="text" inputMode="decimal" value={formData.resumenExamenTalla} onChange={e => handleChange('resumenExamenTalla', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">FR</label><input type="text" inputMode="decimal" value={formData.resumenExamenFr} onChange={e => handleChange('resumenExamenFr', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">FC</label><input type="text" inputMode="decimal" value={formData.resumenExamenFc} onChange={e => handleChange('resumenExamenFc', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">Temp</label><input type="text" inputMode="decimal" value={formData.resumenExamenTemp} onChange={e => handleChange('resumenExamenTemp', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">SO2</label><input type="text" inputMode="decimal" value={formData.resumenExamenSo2} onChange={e => handleChange('resumenExamenSo2', sanitizeNumericDecimal(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">TA</label><input type="text" inputMode="numeric" value={formData.resumenExamenTa} onChange={e => handleChange('resumenExamenTa', sanitizeBloodPressure(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">TE</label><input type="text" value={formData.resumenExamenTe} onChange={e => handleChange('resumenExamenTe', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">PE (Percentil)</label><input type="text" value={formData.resumenPercentilPe} onChange={e => handleChange('resumenPercentilPe', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                      <div><label className="text-[10px] text-slate-600 dark:text-slate-500 font-bold">PT (Percentil)</label><input type="text" value={formData.resumenPercentilPt} onChange={e => handleChange('resumenPercentilPt', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white" /></div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className={`block text-teal-800 dark:text-teal-300 font-black uppercase text-[10px] tracking-widest border-b ${themeTokens.sectionDivider} pb-1`}>Paraclínicos de Ingreso</label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {['Leu', 'Seg', 'Lin', 'Mon', 'Hb', 'Hto', 'Vcm', 'Hcm', 'Plt', 'Vsg', 'Pcr'].map(l => (
                        <div key={l}>
                          <label className="text-[9px] text-slate-600 dark:text-slate-500 font-bold uppercase">{l}</label>
                          <input 
                            type="text" 
                            value={(formData as any)[`resumenLab${l}`] || ''} 
                            onChange={e => handleChange(`resumenLab${l}` as keyof HistoriaClinicaPediatrica, e.target.value)} 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white text-[10px]" 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="pt-2">
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase text-[10px]">RX de Tórax</label>
                      <AutoExpandingTextarea
                        minHeight={60}
                        value={formData.resumenRxTorax}
                        onChange={e => handleChange('resumenRxTorax', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className={`block text-teal-800 dark:text-teal-300 font-black uppercase text-[10px] tracking-widest border-b ${themeTokens.sectionDivider} pb-1`}>Conclusión de Ingreso</label>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold uppercase text-[10px]">Diagnósticos de Ingreso</label>
                      <AutoExpandingTextarea
                        minHeight={70}
                        value={formData.resumenDiagnosticosIngreso}
                        onChange={e => handleChange('resumenDiagnosticosIngreso', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div data-tutorial="p8-comentario">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 dark:text-slate-400 font-semibold uppercase text-[10px]">Comentario</label>
                        <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium italic">Espacio amplio para redacción o escritura manual al imprimir</span>
                      </div>
                      <AutoExpandingTextarea
                        minHeight={120}
                        placeholder="Espacio amplio para comentario o dejar en blanco para escribir a mano..."
                        value={formData.resumenComentario}
                        onChange={e => handleChange('resumenComentario', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-xs leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>

                <div className={`pt-4 border-t ${themeTokens.sectionDivider} flex justify-end`}>
                  <button
                    type="button"
                    onClick={scrollToTopOfForm}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 dark:from-teal-500 dark:via-cyan-500 dark:to-emerald-500 hover:from-teal-500 hover:to-emerald-500 text-white dark:text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm dark:shadow-[0_0_22px_rgba(20,184,166,0.85)] dark:hover:shadow-[0_0_30px_rgba(6,182,212,1)] ring-2 ring-teal-500/40 dark:ring-teal-400 transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                    <span>⬆️ Volver arriba</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className={`w-full max-w-full overflow-hidden rounded-2xl ${themeTokens.cardSurface} border p-3 sm:p-5 shadow-sm dark:shadow-lg`}>
            {/* PDF Viewport & Zoom Toolbar */}
            <div className={`no-print border-b ${themeTokens.sectionDivider} pb-3 mb-4 space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                {/* Mobile & Desktop Scale Controls */}
                <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1.5 ${themeTokens.cardInnerSurface} p-2 sm:p-1 rounded-2xl border sm:rounded-xl text-xs w-full sm:w-auto`}>
                  {/* Zoom Group - Takes precedence on mobile */}
                  <div className="flex items-center justify-between sm:justify-start bg-white dark:bg-slate-900/80 p-1 rounded-xl border border-slate-300 dark:border-slate-700/60 sm:shadow-inner">
                    <button
                      onClick={handleZoomOut}
                      className="p-2.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors border-r border-slate-200 dark:border-slate-700/50 active:scale-95 flex-1 sm:flex-none justify-center flex items-center cursor-pointer"
                      title="Reducir tamaño"
                    >
                      <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <div className={`px-3 sm:px-2 font-mono font-bold min-w-[60px] sm:min-w-[50px] text-center text-[13px] sm:text-[11px] ${themeTokens.accentText}`}>
                      {typeof previewScaleMode === 'number' ? Math.round(previewScaleMode * 100) : '100'}%
                    </div>
                    <button
                      onClick={handleZoomIn}
                      className="p-2.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors border-l border-slate-200 dark:border-slate-700/50 active:scale-95 flex-1 sm:flex-none justify-center flex items-center cursor-pointer"
                      title="Aumentar tamaño"
                    >
                      <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>

                  {/* Mode Selector - Grid on mobile */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-1.5">
                    <button
                      onClick={() => handleSetScaleMode('fit')}
                      className={`px-3 py-2.5 sm:py-2 rounded-xl sm:rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[36px] border cursor-pointer ${
                        previewScaleMode === 'fit'
                          ? `${themeTokens.activePill} border-transparent`
                          : 'bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="whitespace-nowrap">Pantalla</span>
                    </button>

                    <button
                      onClick={() => handleSetScaleMode(1)}
                      className={`px-3 py-2.5 sm:py-2 rounded-xl sm:rounded-lg font-black flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[36px] border cursor-pointer ${
                        previewScaleMode === 1
                          ? 'bg-orange-600 dark:bg-orange-500 text-white border-orange-500 dark:border-orange-400 shadow-sm dark:shadow-[0_0_20px_rgba(249,115,22,0.9)]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Maximize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span>100%</span>
                    </button>
                  </div>

                  {/* Action Group: Ver Impresión + Descargar PDF */}
                  <div data-tutorial="hc-preview-print-actions" className="w-full sm:w-auto flex flex-wrap items-center gap-1.5 mt-1 sm:mt-0 sm:ml-1">
                    <button
                      type="button"
                      onClick={() => handlePrintPdfDocument()}
                      className="flex-1 sm:flex-initial px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg font-black flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[36px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 dark:from-amber-400 dark:via-orange-400 dark:to-amber-300 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-sm dark:shadow-[0_0_20px_rgba(251,146,60,0.85)] dark:hover:shadow-[0_0_28px_rgba(251,146,60,1)] active:scale-[0.98] cursor-pointer border border-amber-400/80 dark:border-amber-200/80"
                    >
                      <Printer className="w-4 h-4 text-slate-950 font-black dark:animate-pulse shrink-0" />
                      <span className="whitespace-nowrap">Imprimir PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={isGeneratingPdf}
                      className={`flex-1 sm:flex-initial px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg font-black flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[36px] ${themeTokens.primaryButton} shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer`}
                      title="Descargar Historia Clínica en PDF"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {pdfExportError && (
                <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2">
                  <span>{pdfExportError}</span>
                  <button
                    type="button"
                    onClick={() => setPdfExportError(null)}
                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Page Filter Tabs for Easy Mobile Navigation */}
              <div data-tutorial="hc-preview-page-filter" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Páginas:
                </span>
                <button
                  onClick={() => setPreviewPageFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all min-h-[36px] cursor-pointer ${
                    previewPageFilter === 'all'
                      ? `${themeTokens.activePill}`
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Todas (8)
                </button>
                {[
                  { num: 1, label: '1. Filiación' },
                  { num: 2, label: '2. Reglamento' },
                  { num: 3, label: '3. Anamnesis' },
                  { num: 4, label: '4. Funcional' },
                  { num: 5, label: '5. Físico I' },
                  { num: 6, label: '6. Físico II' },
                  { num: 7, label: '7. Laboratorios' },
                  { num: 8, label: '8. Resumen Ingreso' }
                ].map(p => (
                  <button
                    key={p.num}
                    onClick={() => setPreviewPageFilter(p.num)}
                    className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all min-h-[36px] cursor-pointer ${
                      previewPageFilter === p.num
                        ? `${themeTokens.activePill}`
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Mobile guidance prompt */}
              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>
                  {previewScaleMode === 'fit' 
                    ? '📱 Vista ajustada al ancho del dispositivo sin desbordamiento. Los márgenes y tipografías se conservan idénticos al original.' 
                    : '🔍 Vista 100% Real: Desliza horizontalmente con el dedo para revisar detalles o llenar laboratorios.'}
                </span>
                <span className={`hidden sm:inline font-medium ${themeTokens.accentText}`}>
                  Hospital Materno Infantil Comandante Supremo Hugo Rafael Chávez Frías
                </span>
              </div>
            </div>

            {/* Render with Scaled & Responsive Container */}
            <div className="w-full max-w-full overflow-auto flex justify-center py-4 bg-slate-200/60 dark:bg-slate-950/20 rounded-xl min-h-[60vh] touch-pan-x touch-pan-y">
              <div className="inline-block p-2 sm:p-4">
              <HistoriaClinicaPDFRenderer 
                data={formData} 
                activePage={(isGeneratingPdf || previewPageFilter === 'all') ? undefined : previewPageFilter}
                editableLabs={true}
                scaleMode={previewScaleMode}
                onUpdateData={(updated) => setFormData(updated)}
              />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING SAVE & HOSPITALIZE MODAL - FIXED INSET-0 Z-[100] ALWAYS CENTERED */}
      {showAutoHospitalizeModal && (
        <div className="no-print fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${themeTokens.cardSurface} border rounded-3xl max-w-md w-full p-6 space-y-5 text-slate-900 dark:text-white shadow-xl dark:shadow-2xl animate-in fade-in zoom-in duration-200`}>
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-3`}>
              <h3 className={`text-base font-black flex items-center gap-2 ${formData.isReingreso ? 'text-orange-600 dark:text-orange-400' : themeTokens.accentText}`}>
                <CheckCircle className={`w-5 h-5 ${formData.isReingreso ? 'text-orange-600 dark:text-orange-400' : themeTokens.accentIcon}`} />
                {formData.isReingreso ? 'Confirmar Reingreso a Hospitalización' : 'Guardar e Ingresar a Hospitalización'}
              </h3>
              <button
                onClick={() => setShowAutoHospitalizeModal(false)}
                className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-500 hover:rotate-90 transition-all duration-200 active:scale-90 cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {formData.isReingreso
                ? <>Seleccione el área y cama para completar el <strong>Nuevo Ingreso (Reingreso Clínico)</strong> de <strong>{formData.apellidos || 'Paciente'} {formData.nombres}</strong>:</>
                : <>¿Desea ingresar a <strong>{formData.apellidos || 'Paciente'} {formData.nombres}</strong> directamente al tablero visual de camas hospitalizadas?</>
              }
            </p>

            <div data-tutorial="modal-asignar-area" className={`space-y-3 text-xs ${themeTokens.cardInnerSurface} p-3.5 rounded-2xl border`}>
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1 font-bold">Asignar Área Hospitalaria</label>
                <select
                  value={selectedArea}
                  onChange={e => setSelectedArea(e.target.value as HospitalArea)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-semibold"
                >
                  <option value="Traumashock">Traumashock</option>
                  <option value="ÁREA DE OBSERVACIÓN">ÁREA DE OBSERVACIÓN</option>
                  <option value="Respiratorio">Respiratorio</option>
                  <option value="Aislamiento">Aislamiento</option>
                  <option value="Hospitalización">Hospitalización</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1 font-bold">Número de Cama</label>
                <input
                  type="text"
                  value={selectedBed}
                  onChange={e => setSelectedBed(e.target.value)}
                  placeholder="e.g. Cama 01, Trauma-2"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* BUTTON CONTROLS INCLUDING 'SEGUIR EDITANDO' */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => setShowAutoHospitalizeModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <Edit3 className={`w-4 h-4 ${themeTokens.accentIcon}`} />
                Seguir Editando Paciente
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleFinalSave()}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  {formData.isReingreso ? 'Reingresar (Misma Área)' : 'Solo Guardar Historia'}
                </button>
                <button
                  data-tutorial="modal-btn-guardar-cama"
                  onClick={() => handleFinalSave({ area: selectedArea, bedNumber: selectedBed })}
                  className={`py-2.5 rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer ${
                    formData.isReingreso
                      ? 'bg-orange-600 hover:bg-orange-500 text-white dark:bg-orange-500 dark:hover:bg-orange-400 dark:text-slate-950 dark:shadow-[0_0_15px_rgba(249,115,22,0.6)]'
                      : `${themeTokens.primaryButton}`
                  }`}
                >
                  {formData.isReingreso ? 'Confirmar Reingreso & Cama' : 'Guardar & Asignar Cama'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xs no-print">
          <div className={`${themeTokens.cardSurface} border border-rose-300 dark:border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-xl dark:shadow-2xl space-y-4 text-center`}>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-300 dark:border-rose-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">¿Borrar todo y reiniciar datos?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Esta acción borrará todos los datos redactados en la Historia Clínica Pediátrica y reiniciará los valores a la plantilla oficial inicial. Se eliminará también el borrador guardado en este dispositivo.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetAllData}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors shadow-sm dark:shadow-lg dark:shadow-rose-900/30 cursor-pointer"
              >
                Sí, Borrar y Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
