import React from 'react';
import { HistoriaClinicaPediatrica } from '../types';
import { EXAMEN_FISICO_NORMAL, EXAMEN_FUNCIONAL_NORMAL, calculatePediatricPercentiles, getPediatricNormalPhysicalExam } from '../data/initialData';
import { openInstantWhitePrintPage, formatPrintDocumentTitle, type InstantPrintSheetInput } from '../utils/pdfPrinter';
import {
  sanitizeLabInputValue,
  normalizeOptionalTaDisplay,
  isNumericLabTest,
} from '../utils/clinicalInputSanitizers';

export interface InstantHistoriaPrintOptions {
  title?: string;
  fileName?: string;
  patientName?: string;
  onDownloadPdf?: () => Promise<void> | void;
  onClose?: () => void;
}

/**
 * Instant DOM printer for HistoriaClinicaPDFRenderer (#pdf-page-1 .. #pdf-page-8).
 * Clones the already-rendered Letter pages directly onto the clean white print page
 * in <20ms with full width and natural multi-page flow.
 */
export function printHistoriaClinicaDomInstant(options: InstantHistoriaPrintOptions = {}): boolean {
  if (typeof document === 'undefined') return false;

  const sheets: InstantPrintSheetInput[] = [];
  for (let page = 1; page <= 8; page++) {
    const pageElem = document.getElementById(`pdf-page-${page}`);
    if (pageElem) {
      sheets.push({
        element: pageElem,
        orientation: 'portrait',
        repeatHeaderOnOverflow: page !== 7,
      });
    }
  }

  if (sheets.length === 0) return false;

  const computedFileName =
    options.fileName ||
    formatPrintDocumentTitle('Historia Clinica', options.patientName || options.title || 'Paciente', {
      includeDateTime: true,
    });

  openInstantWhitePrintPage({
    sheets,
    title: options.title || 'Historia Clínica Pediátrica',
    fileName: computedFileName,
    onDownloadPdf: options.onDownloadPdf,
    onClose: options.onClose,
    fitEachSheetToOnePage: false,
    repeatHeaderOnOverflow: true,
  });

  return true;
}

export interface HistoriaLabSideCell {
  type: 'section' | 'item';
  title?: string;
  name?: string;
  ref?: string;
  isBlankSlot?: boolean;
}

export interface HistoriaLabPairRow {
  left: HistoriaLabSideCell;
  right: HistoriaLabSideCell;
}

export const HISTORIA_LAB_ALIASES: Record<string, string[]> = {
  'Hemoglobina': ['Hemoglobina', 'HEMOGLOBINA', 'HB'],
  'Hematocrito': ['Hematocrito', 'HEMATOCRITO', 'HTO'],
  'VCM': ['VCM'],
  'HCM': ['HCM'],
  'CHCM': ['CHCM'],
  'Leucocitos': ['Leucocitos', 'LEUCOCITOS', 'GLÓBULOS BLANCOS', 'GLOBULOS BLANCOS', 'LEU'],
  'Seg. Neutrófilos': ['Seg. Neutrófilos', 'NEUTRÓFILOS SEGMENTADOS', 'NEUTROFILOS %', 'NEUTRÓFILOS', 'SEG'],
  'Linfocitos': ['Linfocitos', 'LINFOCITOS', 'LINFOCITOS %', 'LIN'],
  'Monocitos': ['Monocitos', 'MONOCITOS', 'MONOCITOS %', 'MON'],
  'Eosinófilos': ['Eosinófilos', 'EOSINÓFILOS', 'EOSINOFILOS %'],
  'Plaquetas': ['Plaquetas', 'PLAQUETAS', 'PLT'],
  'Reticulocitos': ['Reticulocitos', 'RETICULOCITOS'],
  'TP': ['TP', 'PT'],
  'TTP': ['TTP', 'PTT'],
  'Fibrinógeno': ['Fibrinógeno', 'FIBRINÓGENO', 'FIBRINOGENO'],
  'Grupo y Rh': ['Grupo y Rh', 'GRUPO Y RH', 'TIPIAJE'],
  'VSG': ['VSG', 'VSG / VAS'],
  'Glicemia': ['Glicemia', 'GLICEMIA', 'GLUCOSA'],
  'Urea': ['Urea', 'UREA'],
  'BUN': ['BUN'],
  'Creatinina': ['Creatinina', 'CREATININA'],
  'Ácido Úrico': ['Ácido Úrico', 'ÁCIDO ÚRICO', 'ACIDO URICO'],
  'TGO (AST)': ['TGO (AST)', 'TGO', 'AST'],
  'TGP (ALT)': ['TGP (ALT)', 'TGP', 'ALT'],
  'Fosfatasa Alcalina': ['Fosfatasa Alcalina', 'FOSFATASA ALCALINA', 'FA'],
  'GGT': ['GGT'],
  'Bilirrubina Total': ['Bilirrubina Total', 'BILIRRUBINA TOTAL'],
  'Bilirrubina Directa': ['Bilirrubina Directa', 'BILIRRUBINA DIRECTA'],
  'Bilirrubina Indirecta': ['Bilirrubina Indirecta', 'BILIRRUBINA INDIRECTA'],
  'Proteínas Totales': ['Proteínas Totales', 'PROTEÍNAS TOTALES', 'PROTEINAS TOTALES'],
  'Albúmina': ['Albúmina', 'ALBÚMINA', 'ALBUMINA'],
  'Globulina': ['Globulina', 'GLOBULINAS', 'GLOBULINA'],
  'Amilasa': ['Amilasa', 'AMILASA'],
  'Lipasa': ['Lipasa', 'LIPASA'],
  'LDH': ['LDH', 'DESHIDROGENASA LÁCTICA', 'DESHIDROGENASA LACTICA'],
  'Colesterol Total': ['Colesterol Total', 'COLESTEROL', 'COLESTEROL TOTAL'],
  'Triglicéridos': ['Triglicéridos', 'TRIGLICÉRIDOS', 'TRIGLICERIDOS'],
  'PCR': ['PCR', 'PCR (Cuantitativa)', 'PCR (Cualitativa)'],
  'Procalcitonina': ['Procalcitonina', 'PROCALCITONINA', 'PCT'],
  'Sodio (Na)': ['Sodio (Na)', 'SODIO', 'Na+ (Gasometría)'],
  'Potasio (K)': ['Potasio (K)', 'POTASIO', 'K+ (Gasometría)'],
  'Cloro (Cl)': ['Cloro (Cl)', 'CLORO'],
  'Calcio (Ca) Total': ['Calcio (Ca) Total', 'CALCIO', 'CALCIO TOTAL'],
  'Calcio Iónico': ['Calcio Iónico', 'CALCIO IÓNICO', 'Ca++ (Gasometría)'],
  'Magnesio (Mg)': ['Magnesio (Mg)', 'MAGNESIO'],
  'Fósforo (P)': ['Fósforo (P)', 'FÓSFORO', 'FOSFORO'],
  'pH': ['pH', 'Ph', 'pH (Gasometría)'],
  'pCO2': ['pCO2', 'PCO2'],
  'pO2': ['pO2', 'PO2'],
  'HCO3': ['HCO3'],
  'TCO2': ['TCO2'],
  'EB': ['EB', 'E. BASE'],
  'SatO2': ['SatO2', 'SATO2', 'SO2'],
  'Lactato': ['Lactato', 'LACTATO'],
  'Uroanálisis': ['Uroanálisis', 'UROANÁLISIS'],
  'Densidad': ['Densidad', 'DENSIDAD', 'URO - DENSIDAD'],
  'pH Orina': ['pH Orina', 'URO - pH'],
  'Sedimento': ['Sedimento', 'SEDIMENTO', 'URO - LEUCO', 'URO - ERITRO', 'URO - BACT.'],
  'Coprológico': ['Coprológico', 'COPROANÁLISIS', 'COPROANÁLISIS (ROTAVIRUS, ADENOVIRUS)'],
  'Sangre Oculta': ['Sangre Oculta', 'COPRO - SANG. OCULTA'],
  'Hemocultivo': ['Hemocultivo', 'HEMOCULTIVO'],
  'Urocultivo': ['Urocultivo', 'UROCULTIVO'],
  'Coprocultivo': ['Coprocultivo', 'COPROCULTIVO'],
  'Cultivo LCR': ['Cultivo LCR', 'CULTIVO LCR'],
  'Cultivo Secreción': ['Cultivo Secreción', 'CULTIVO SECRECIÓN'],
  'Aspecto LCR': ['Aspecto LCR', 'ASPECTO LCR'],
  'Células LCR': ['Células LCR', 'CÉLULAS LCR'],
  'Glucosa LCR': ['Glucosa LCR', 'GLUCOSA LCR'],
  'Proteínas LCR': ['Proteínas LCR', 'PROTEÍNAS LCR'],
  'Pandy': ['Pandy', 'PANDY'],
  'VDRL / Sífilis': ['VDRL / Sífilis', 'VDRL'],
  'VIH': ['VIH', 'HIV'],
  'Panel Respiratorio': ['Panel Respiratorio', 'PANEL RESPIRATORIO', 'Panel Viral Respiratorio'],
  'Otros 1': ['Otros 1'],
  'Otros 2': ['Otros 2'],
  'Otros 3': ['Otros 3'],
};

export function getHistoriaLabValue(valores: Record<string, string> | undefined, canonicalName?: string): string {
  if (!valores || !canonicalName) return '';
  if (valores[canonicalName] !== undefined && valores[canonicalName] !== '') {
    return valores[canonicalName];
  }
  const candidates = HISTORIA_LAB_ALIASES[canonicalName] || [canonicalName];
  for (const k of candidates) {
    if (valores[k] !== undefined && valores[k] !== '') {
      return valores[k];
    }
  }
  return '';
}

export function setHistoriaLabValue(
  valores: Record<string, string> | undefined,
  canonicalName: string,
  newValue: string
): Record<string, string> {
  const next: Record<string, string> = { ...(valores || {}), [canonicalName]: newValue };
  const candidates = HISTORIA_LAB_ALIASES[canonicalName] || [];
  for (const k of candidates) {
    next[k] = newValue;
  }
  return next;
}

// Exact 41-row side-by-side layout matching the official HISTORIA DE LABORATORIOS Y PARACLÍNICOS sheet
export const HISTORIA_LAB_PAIR_ROWS: HistoriaLabPairRow[] = [
  {
    left: { type: 'section', title: 'HEMATOLOGÍA Y COAGULACIÓN' },
    right: { type: 'section', title: 'ELECTROLITOS Y MINERALES' },
  },
  {
    left: { type: 'item', name: 'Hemoglobina', ref: '11.5 - 14.5 g/dL' },
    right: { type: 'item', name: 'Sodio (Na)', ref: '135 - 145 mEq/L' },
  },
  {
    left: { type: 'item', name: 'Hematocrito', ref: '33 - 43 %' },
    right: { type: 'item', name: 'Potasio (K)', ref: '3.5 - 5.0 mEq/L' },
  },
  {
    left: { type: 'item', name: 'VCM', ref: '78 - 100 fL' },
    right: { type: 'item', name: 'Cloro (Cl)', ref: '98 - 106 mEq/L' },
  },
  {
    left: { type: 'item', name: 'HCM', ref: '27 - 31 pg' },
    right: { type: 'item', name: 'Calcio (Ca) Total', ref: '8.5 - 10.5 mg/dL' },
  },
  {
    left: { type: 'item', name: 'CHCM', ref: '32 - 36 g/dL' },
    right: { type: 'item', name: 'Calcio Iónico', ref: '1.1 - 1.3 mmol/L' },
  },
  {
    left: { type: 'item', name: 'Leucocitos', ref: '5.0 - 12.0 10³/µL' },
    right: { type: 'item', name: 'Magnesio (Mg)', ref: '1.5 - 2.5 mEq/L' },
  },
  {
    left: { type: 'item', name: 'Seg. Neutrófilos', ref: '40 - 60 %' },
    right: { type: 'item', name: 'Fósforo (P)', ref: '3.0 - 5.5 mg/dL' },
  },
  {
    left: { type: 'item', name: 'Linfocitos', ref: '30 - 50 %' },
    right: { type: 'section', title: 'GASES ARTERIALES' },
  },
  {
    left: { type: 'item', name: 'Monocitos', ref: '2 - 8 %' },
    right: { type: 'item', name: 'pH', ref: '7.35 - 7.45' },
  },
  {
    left: { type: 'item', name: 'Eosinófilos', ref: '1 - 4 %' },
    right: { type: 'item', name: 'pCO2', ref: '35 - 45 mmHg' },
  },
  {
    left: { type: 'item', name: 'Plaquetas', ref: '150 - 450 10³/µL' },
    right: { type: 'item', name: 'pO2', ref: '80 - 100 mmHg' },
  },
  {
    left: { type: 'item', name: 'Reticulocitos', ref: '0.5 - 1.5 %' },
    right: { type: 'item', name: 'HCO3', ref: '22 - 26 mEq/L' },
  },
  {
    left: { type: 'item', name: 'TP', ref: '11 - 15 seg' },
    right: { type: 'item', name: 'TCO2', ref: '23 - 27 mmol/L' },
  },
  {
    left: { type: 'item', name: 'TTP', ref: '25 - 35 seg' },
    right: { type: 'item', name: 'EB', ref: '-2 a +2 mEq/L' },
  },
  {
    left: { type: 'item', name: 'Fibrinógeno', ref: '200 - 400 mg/dL' },
    right: { type: 'item', name: 'SatO2', ref: '> 95 %' },
  },
  {
    left: { type: 'item', name: 'Grupo y Rh', ref: '' },
    right: { type: 'item', name: 'Lactato', ref: '0.5 - 2.0 mmol/L' },
  },
  {
    left: { type: 'item', name: 'VSG', ref: '0 - 20 mm/h' },
    right: { type: 'section', title: 'ORINA Y HECES' },
  },
  {
    left: { type: 'section', title: 'QUÍMICA SANGUÍNEA' },
    right: { type: 'item', name: 'Uroanálisis', ref: '' },
  },
  {
    left: { type: 'item', name: 'Glicemia', ref: '70 - 100 mg/dL' },
    right: { type: 'item', name: 'Densidad', ref: '1.005 - 1.030' },
  },
  {
    left: { type: 'item', name: 'Urea', ref: '15 - 40 mg/dL' },
    right: { type: 'item', name: 'pH Orina', ref: '4.5 - 8.0' },
  },
  {
    left: { type: 'item', name: 'BUN', ref: '7 - 20 mg/dL' },
    right: { type: 'item', name: 'Sedimento', ref: '' },
  },
  {
    left: { type: 'item', name: 'Creatinina', ref: '0.3 - 0.7 mg/dL' },
    right: { type: 'item', name: 'Coprológico', ref: '' },
  },
  {
    left: { type: 'item', name: 'Ácido Úrico', ref: '2.0 - 5.5 mg/dL' },
    right: { type: 'item', name: 'Sangre Oculta', ref: 'Negativo' },
  },
  {
    left: { type: 'item', name: 'TGO (AST)', ref: '10 - 40 U/L' },
    right: { type: 'section', title: 'MICROBIOLOGÍA Y LCR' },
  },
  {
    left: { type: 'item', name: 'TGP (ALT)', ref: '10 - 40 U/L' },
    right: { type: 'item', name: 'Hemocultivo', ref: '' },
  },
  {
    left: { type: 'item', name: 'Fosfatasa Alcalina', ref: '40 - 400 U/L' },
    right: { type: 'item', name: 'Urocultivo', ref: '' },
  },
  {
    left: { type: 'item', name: 'GGT', ref: '5 - 40 U/L' },
    right: { type: 'item', name: 'Coprocultivo', ref: '' },
  },
  {
    left: { type: 'item', name: 'Bilirrubina Total', ref: '< 1.0 mg/dL' },
    right: { type: 'item', name: 'Cultivo LCR', ref: '' },
  },
  {
    left: { type: 'item', name: 'Bilirrubina Directa', ref: '< 0.3 mg/dL' },
    right: { type: 'item', name: 'Cultivo Secreción', ref: '' },
  },
  {
    left: { type: 'item', name: 'Bilirrubina Indirecta', ref: '< 0.7 mg/dL' },
    right: { type: 'item', name: 'Aspecto LCR', ref: 'Cristal de roca' },
  },
  {
    left: { type: 'item', name: 'Proteínas Totales', ref: '6.0 - 8.0 g/dL' },
    right: { type: 'item', name: 'Células LCR', ref: '0 - 5 /mm³' },
  },
  {
    left: { type: 'item', name: 'Albúmina', ref: '3.5 - 5.0 g/dL' },
    right: { type: 'item', name: 'Glucosa LCR', ref: '50 - 80 mg/dL' },
  },
  {
    left: { type: 'item', name: 'Globulina', ref: '2.0 - 3.5 g/dL' },
    right: { type: 'item', name: 'Proteínas LCR', ref: '15 - 45 mg/dL' },
  },
  {
    left: { type: 'item', name: 'Amilasa', ref: '20 - 110 U/L' },
    right: { type: 'item', name: 'Pandy', ref: 'Negativo' },
  },
  {
    left: { type: 'item', name: 'Lipasa', ref: '0 - 160 U/L' },
    right: { type: 'section', title: 'SEROLOGÍA / OTROS' },
  },
  {
    left: { type: 'item', name: 'LDH', ref: '140 - 280 U/L' },
    right: { type: 'item', name: 'VDRL / Sífilis', ref: 'No reactivo' },
  },
  {
    left: { type: 'item', name: 'Colesterol Total', ref: '< 200 mg/dL' },
    right: { type: 'item', name: 'VIH', ref: 'Negativo' },
  },
  {
    left: { type: 'item', name: 'Triglicéridos', ref: '< 150 mg/dL' },
    right: { type: 'section', title: 'PANEL RESPIRATORIO' },
  },
  {
    left: { type: 'item', name: 'PCR', ref: '< 5 mg/L' },
    right: { type: 'item', name: 'Panel Respiratorio', ref: '' },
  },
  {
    left: { type: 'item', name: 'Procalcitonina', ref: '< 0.5 ng/mL' },
    right: { type: 'item', name: 'Otros 3', ref: '', isBlankSlot: true },
  },
];

interface Props {
  data: HistoriaClinicaPediatrica;
  activePage?: number; // 1 to 7 or undefined for all
  editableLabs?: boolean;
  scaleMode?: 'fit' | '100' | '75' | number;
  onUpdateData?: (updatedData: HistoriaClinicaPediatrica) => void;
}

export function renderFormattedDiagnoses(rawText?: string) {
  const text = rawText?.trim() || '1.';
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // Group lines into blocks: each main diagnosis (1., 2., etc.) starts a block
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    const isMain = /^(\d+)\.\s*(?!\d)/.test(trimmed);
    if (isMain) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      if (currentBlock.length === 0) {
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
  });
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const col1Blocks: string[][] = [];
  const col2Blocks: string[][] = [];

  blocks.forEach((block, idx) => {
    if (idx < 5) {
      col1Blocks.push(block);
    } else {
      col2Blocks.push(block);
    }
  });

  const renderBlockList = (blocksArr: string[][]) => blocksArr.map((block, bIdx) => (
    <div key={bIdx} className="mb-1.5 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
      {block.map((line, lIdx) => {
        const trimmed = line.trim();
        const isMain = /^(\d+)\.\s*(?!\d)/.test(trimmed);
        return (
          <div
            key={lIdx}
            style={{ 
              pageBreakInside: 'avoid',
              fontFamily: 'Arial, Helvetica, sans-serif',
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}
            className={`py-0.2 leading-tight ${
              isMain 
                ? 'font-extrabold text-[9pt] text-[#000000]' 
                : 'font-normal text-[8.5pt] text-[#111111] pl-3'
            }`}
          >
            {line}
          </div>
        );
      })}
    </div>
  ));

  return (
    <div className="flex gap-4 w-full text-[#000000]">
      <div className="flex-1 min-w-0">
        {renderBlockList(col1Blocks)}
      </div>
      <div className="flex-1 min-w-0 border-l border-black/10 pl-2">
        {renderBlockList(col2Blocks)}
      </div>
    </div>
  );
}

export const HeaderBannerImage: React.FC = () => (
  <div className="w-full mb-2 no-break">
    <div className="flex items-center justify-between gap-2 border-b-2 border-[#b91c1c] pb-1.5 bg-white">
      {/* Left: Gobierno Bolivariano logo vector banner */}
      <div className="flex items-center gap-2">
        <svg className="w-12 h-8 shrink-0 drop-shadow-xs" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <div className="text-[9px] leading-tight font-bold uppercase text-[#000000]">
          <p className="text-[#b91c1c] font-extrabold text-[10px]">Gobierno Bolivariano de Venezuela</p>
          <p className="text-[#334155] font-semibold text-[9px]">Ministerio del Poder Popular <span className="font-extrabold text-[#000000]">para la Salud</span></p>
        </div>
      </div>

      {/* Center: Pediatria y Puericultura */}
      <div className="text-center px-1">
        <p className="text-[9px] font-extrabold text-[#dc2626] uppercase tracking-wider">PEDIATRÍA Y PUERICULTURA</p>
      </div>

      {/* Right: Hospital Materno Infantil Hugo Chavez */}
      <div className="text-right flex items-center gap-2 justify-end">
        <div>
          <p className="text-xs font-black text-[#000000] uppercase leading-none">Hospital</p>
          <p className="text-sm font-black text-[#000000] uppercase leading-tight">Materno Infantil</p>
          <p className="text-[8px] font-bold text-[#1e293b] leading-none uppercase">Comandante Supremo</p>
          <p className="text-[10px] font-extrabold text-[#dc2626] italic leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Hugo Rafael Chávez Frías
          </p>
        </div>
        {/* Logo icon */}
        <div className="w-8 h-8 rounded-full border border-[#dc2626] flex items-center justify-center bg-[#fef2f2] shrink-0">
          <svg className="w-5 h-5 text-[#dc2626]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
);

function resolveDefaultDoctorSignature(): string {
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

export const HistoriaClinicaPDFRenderer: React.FC<Props> = ({
  data,
  activePage,
  editableLabs = true,
  scaleMode = 'fit',
  onUpdateData
}) => {
  const defaultDoctorSig = resolveDefaultDoctorSignature();
  const [containerWidth, setContainerWidth] = React.useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 800;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

// Standard US Letter (Carta: 215.9mm x 279.4mm) Dimensions and uniform body styling
const LETTER_PAGE_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #000000',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '9.5pt',
  width: '215.9mm',
  maxWidth: '100%',
  minHeight: '279.4mm',
  height: 'auto',
  boxSizing: 'border-box',
  overflow: 'visible',
  position: 'relative',
  padding: '8mm 9mm 10mm 9mm',
};

  // Compute scale for Letter size (816px width at 96 DPI)
  let scale = 1;
  if (typeof scaleMode === 'number') {
    scale = scaleMode;
  } else if (scaleMode === '100') {
    scale = 1;
  } else if (scaleMode === '75') {
    scale = 0.75;
  } else if (scaleMode === 'fit') {
    if (containerWidth < 850) {
      // 816px is standard Letter 215.9mm width at 96 DPI
      const availableW = Math.max(280, containerWidth - 36);
      scale = Math.min(1, Math.max(0.35, availableW / 816));
    } else {
      scale = 1;
    }
  }

  const renderScaled = (content: React.ReactNode, pageNum: number) => {
    if (scale >= 0.98) {
      return (
        <div key={pageNum} className="w-full flex justify-center py-2 overflow-x-auto no-scrollbar">
          {content}
        </div>
      );
    }

    const scaledHeight = Math.ceil(1056 * scale);
    return (
      <div
        key={pageNum}
        className="pdf-page-scale-wrapper w-full flex justify-center overflow-hidden my-2"
        style={{
          height: `${scaledHeight + 6}px`
        }}
      >
        <div
          style={{
            width: '816px',
            height: '1056px',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            flexShrink: 0
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  // Helper for lab column updates
  const handleLabDateChange = (colIdx: number, newFecha: string) => {
    if (!onUpdateData) return;
    const currentCols = [...(data.laboratoriosColumnas || [])];
    while (currentCols.length < 8) {
      currentCols.push({ fecha: '', valores: {} });
    }
    currentCols[colIdx] = {
      ...currentCols[colIdx],
      fecha: newFecha
    };
    onUpdateData({
      ...data,
      laboratoriosColumnas: currentCols
    });
  };

  const handleLabValueChange = (colIdx: number, rowName: string, newVal: string) => {
    if (!onUpdateData) return;
    const sanitizedVal = sanitizeLabInputValue(rowName, newVal);
    const currentCols = [...(data.laboratoriosColumnas || [])];
    while (currentCols.length < 8) {
      currentCols.push({ fecha: '', valores: {} });
    }
    const currentValores = setHistoriaLabValue(currentCols[colIdx].valores, rowName, sanitizedVal);
    currentCols[colIdx] = {
      ...currentCols[colIdx],
      valores: currentValores
    };
    onUpdateData({
      ...data,
      laboratoriosColumnas: currentCols
    });
  };

  const renderPageFooter = (_pageNum: number) => null;

  // Page 1: PARTE I - Filiación & Admisión
  const renderPage1 = () => (
    <div id="pdf-page-1" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
      <HeaderBannerImage />

      <div className="text-center my-2">
        <h1 className="text-[14pt] font-black tracking-wide uppercase text-[#000000] leading-tight">
          {data.isReingreso ? 'HISTORIA CLÍNICA PEDIÁTRICA DE REINGRESO' : 'HISTORIA CLÍNICA PEDIÁTRICA'}
        </h1>
        <h2 className="text-[11pt] font-bold uppercase text-[#000000] mt-0.5">
          PARTE I{data.isReingreso ? ' — NUEVO REINGRESO' : ''}
        </h2>
      </div>

      {/* Grid Filiacion */}
      <div className="text-[9.5pt] mb-2.5 leading-snug" style={{ border: '1px solid #000000' }}>
        <div className="grid grid-cols-12" style={{ borderBottom: '1px solid #000000' }}>
          <div className="col-span-5 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold uppercase">APELLIDOS:</span> <span className="font-normal text-[#000000]">{data.apellidos || '___________________'}</span>
          </div>
          <div className="col-span-5 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold uppercase">NOMBRES:</span> <span className="font-normal text-[#000000]">{data.nombres || '___________________'}</span>
          </div>
          <div className="col-span-2 p-1.5 text-center min-w-0 break-words" style={{ backgroundColor: '#f2f2f2' }}>
            <span className="font-bold text-[8pt] uppercase block">N° HISTORIA</span>
            <span className="text-[10.5pt] text-[#000000] font-bold font-mono">{data.numHistoria || '________'}</span>
          </div>
        </div>

        <div className="grid grid-cols-12" style={{ borderBottom: '1px solid #000000' }}>
          <div className="col-span-3 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">EDAD:</span> <span className="text-[#000000] font-normal">{data.edad || '______'}</span>
          </div>
          <div className="col-span-7 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">LUGAR Y FECHA DE NACIMIENTO:</span> <span className="text-[#000000] font-normal">{data.lugarFechaNacimiento || (data.lugarNacimiento || data.fechaNacimiento ? `${data.lugarNacimiento || ''}${data.lugarNacimiento && data.fechaNacimiento ? ', ' : ''}${data.fechaNacimiento || ''}` : '_______________________')}</span>
          </div>
          <div className="col-span-2 p-1.5 text-center min-w-0 break-words" style={{ backgroundColor: '#f2f2f2' }}>
            <span className="font-bold text-[7.5pt] uppercase block">{data.isReingreso ? 'FECHA REINGRESO' : 'FECHA INGRESO'}</span>
            <span className="text-[8.5pt] text-[#000000] font-normal">{data.fechaIngreso || '_______'}</span>
          </div>
        </div>

        <div className="grid grid-cols-12" style={{ borderBottom: '1px solid #000000' }}>
          <div className="col-span-4 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">PROCEDENCIA POR ESTADO:</span> <span className="text-[#000000] font-normal">{data.procedenciaEstado || 'Distrito Capital'}</span>
          </div>
          <div className="col-span-3 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">NACIONALIDAD:</span> <span className="text-[#000000] font-normal">{data.nacionalidad || 'Venezolana'}</span>
          </div>
          <div className="col-span-3 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">CI:</span> <span className="text-[#000000] font-normal">{data.ci || '___________'}</span>
          </div>
          <div className="col-span-2 p-1.5 text-center min-w-0 break-words" style={{ backgroundColor: '#f2f2f2' }}>
            <span className="font-bold text-[8pt] uppercase block">Hora</span>
            <span className="text-[8.5pt] text-[#000000] font-normal">{data.horaIngreso || '_______'}</span>
          </div>
        </div>

        <div className="grid grid-cols-12" style={{ borderBottom: '1px solid #000000' }}>
          <div className="col-span-8 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">DIRECCIÓN COMPLETA:</span> <span className="text-[#000000] font-normal">{data.direccionCompleta || '__________________________________________'}</span>
          </div>
          <div className="col-span-4 p-1.5 min-w-0 break-words">
            <span className="font-bold">TELÉFONO:</span> <span className="text-[#000000] font-normal">{data.telefono || '_____________'}</span>
          </div>
        </div>

        <div className="grid grid-cols-12">
          <div className="col-span-8 p-1.5 min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
            <span className="font-bold">EN CASO DE EMERGENCIA VISAR A:</span> <span className="text-[#000000] font-normal">{data.enCasoEmergenciaVisarA || data.reglamentoFirma1 || data.exencionFirma || '___________________________'}</span>
          </div>
          <div className="col-span-4 p-1.5 min-w-0 break-words">
            <span className="font-bold">PARENTESCO:</span> <span className="text-[#000000] font-normal">{data.parentescoEmergencia || data.reglamentoParentesco1 || data.exencionParentesco || 'Madre'}</span>
          </div>
        </div>
      </div>

      <div className="pt-1.5 mb-2 text-[9.5pt]" style={{ borderTop: '2px solid #000000' }}>
        <p className="break-words"><span className="font-bold uppercase">MOTIVO(S) DE ADMISIÓN:</span> <span className="font-normal text-[#000000] ml-1">{data.motivosAdmision || '________________________________________________________________'}</span></p>
      </div>

      <div className="p-2 min-h-[100px] mb-2 text-[9.5pt] break-words" style={{ border: '1px solid #000000' }}>
        <p className="font-bold text-[10pt] uppercase mb-1">ENFERMEDAD ACTUAL:</p>
        <p className="text-[#000000] leading-relaxed font-normal whitespace-pre-wrap break-words">{data.enfermedadActual || 'Se trata de '}</p>
      </div>

      <div className="p-2 min-h-[75px] mb-3 text-[9.5pt] break-words" style={{ border: '1px solid #000000' }}>
        <p className="font-bold text-[10pt] uppercase mb-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>DIAGNÓSTICO DE ADMISIÓN:</p>
        {renderFormattedDiagnoses(data.diagnosticoAdmision)}
      </div>

      <div className="grid grid-cols-2 gap-8 my-3 text-center text-[9pt]">
        <div className="border-t border-black pt-1">
          <div className="mb-0.5 py-0.5 font-normal text-[#000000]">
            {(data.medicoAdmisionFirma && data.medicoAdmisionFirma !== 'Dr. Brayan' && data.medicoAdmisionFirma !== 'Administrador')
              ? data.medicoAdmisionFirma
              : defaultDoctorSig}
          </div>
          <p className="font-bold uppercase text-[8.5pt]">Firma de Médico de Admisión</p>
        </div>
        <div className="border-t border-black pt-1">
          <div className="mb-0.5 py-0.5 font-normal text-[#000000]">
            Jospeth Perez
          </div>
          <p className="font-bold uppercase text-[8.5pt]">Firma del Médico del Servicio</p>
        </div>
      </div>

      <div className="pt-2 text-[9.5pt] space-y-2" style={{ borderTop: '2px solid #000000' }}>
        <div className="flex gap-4 items-center flex-wrap">
          <span><strong className="font-bold">Salida por Curación:</strong> <span className="font-normal">{data.salidaCuracion ? 'X' : '_____'}</span></span>
          <span><strong className="font-bold">Mejoría:</strong> <span className="font-normal">{data.salidaMejoria ? 'X' : '_____'}</span></span>
          <span><strong className="font-bold">Muerte:</strong> <span className="font-normal">{data.salidaMuerte ? 'X' : '_____'}</span></span>
          <span><strong className="font-bold">Otras Causas:</strong> <span className="font-normal">{data.salidaOtrasCausas || '________________'}</span></span>
        </div>

        {/* Diagnóstico Clínico Final: Siempre vacío según requerimiento */}
        <div className="border-b border-black pb-1">
          <p className="font-bold uppercase text-[9pt]">Diagnóstico Clínico Final:</p>
        </div>

        {/* Intervención o Tratamiento: Siempre vacío según requerimiento */}
        <div className="border-b border-black pb-1">
          <p className="font-bold uppercase text-[9pt]">Intervención o Tratamiento:</p>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 text-[9pt]">
          <div><span className="font-bold">Fecha de Salida:</span> <span className="font-normal">{data.fechaSalida || '____________'}</span></div>
          <div><span className="font-bold">Hora:</span> <span className="font-normal">{data.horaSalida || '__________'}</span></div>
          <div className="text-center"><p className="font-bold uppercase border-t border-black pt-1 text-[8.5pt]">Firma Jefe de Servicio</p></div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 text-[8.5pt]">
          <div className="col-span-1"><span className="font-bold uppercase">Dx Anatomo-Patológico:</span> <br/><span className="font-normal">{data.diagnosticoAnatomoPatologico || '________'}</span></div>
          <div><span className="font-bold uppercase">Biopsia:</span> <br/><span className="font-normal">{data.biopsia || '________'}</span></div>
          <div><span className="font-bold uppercase">Autopsia:</span> <br/><span className="font-normal">{data.autopsia || '________'}</span></div>
        </div>
      </div>
      {renderPageFooter(1)}
    </div>
  );

  // Page 2: REGLAMENTO DE PACIENTES
  const renderPage2 = () => (
    <div id="pdf-page-2" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
      <HeaderBannerImage />

      <div className="text-center my-3">
        <h1 className="text-[14pt] font-black tracking-wide uppercase">HISTORIA CLÍNICA PEDIÁTRICA</h1>
        <h2 className="text-[11pt] font-bold uppercase">PARTE I</h2>
        <h3 className="text-[10.5pt] font-bold uppercase text-[#000000] mt-0.5 border-b border-black inline-block px-3">REGLAMENTO DE PACIENTES</h3>
      </div>

      <div className="mt-4 space-y-4 text-justify leading-relaxed text-[9.5pt] font-normal">
        <p>
          <strong className="font-bold uppercase">Artículo 1.-</strong> Todo familiar, conviene en someterse a las normas en relación con los pacientes que ingresen al servicio, especialmente las que rigen sobre indicaciones médicas, tratamientos, disposiciones clínicas, regímenes de visita y otros procederes médicos.
        </p>

        <div className="text-right my-4 text-[9.5pt]">
          <strong className="font-bold">Fecha:</strong> <span className="font-normal text-[#000000] px-4" style={{ borderBottom: '1.5px solid #000000' }}>{data.reglamentoFecha || data.fechaIngreso || '____________'}</span>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-2 text-[9.5pt]">
          <div className="space-y-3">
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">Responsable:</span> <span className="font-normal">{data.reglamentoFirma1 || data.enCasoEmergenciaVisarA || '________________'}</span></p>
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">Cédula:</span> <span className="font-normal">{data.reglamentoCI1 || '________________'}</span></p>
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">Parentesco:</span> <span className="font-normal">{data.reglamentoParentesco1 || data.parentescoEmergencia || '________________'}</span></p>
          </div>
          <div className="flex items-end justify-center">
            <div className="w-full text-center border-t border-black pt-1 uppercase font-bold text-[8.5pt]">Huella Dactilar</div>
          </div>
        </div>

        <div className="pt-3 text-[9.5pt]">
          <p><span className="font-bold uppercase">Testigo Institucional:</span> <span className="font-normal border-b border-black px-3">{data.reglamentoTestigo || '________________'}</span> <span className="font-bold uppercase ml-4">CI:</span> <span className="font-normal border-b border-black px-3">{data.reglamentoCITestigo || '________________'}</span></p>
        </div>
      </div>

      <div className="my-5 pt-4" style={{ borderTop: '2px solid #000000' }}>
        <h2 className="font-black text-center text-[11pt] uppercase mb-3 tracking-wide">EXENCIÓN DE RESPONSABILIDAD POR SALIDA DEL PACIENTE</h2>

        <p className="text-justify leading-relaxed text-[9.5pt] font-normal italic">
          El suscrito certifica que la persona cuyo nombre aparece en el adverso de esta hoja, egresa de la institución contra opinión médica, y hace constar que, habiendo sido advertido, a familiares y/o representantes de los riesgos que esto implica, libera de toda responsabilidad a los médicos tratantes y a la institución por las consecuencias que ello pueda resultar.
        </p>

        <div className="text-right my-4 text-[9.5pt]">
          <strong className="font-bold">Fecha:</strong> <span className="font-normal text-[#000000] px-4" style={{ borderBottom: '1.5px solid #000000' }}>{data.exencionFecha || '____________'}</span>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-2 text-[9.5pt]">
          <div className="space-y-3">
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">Firma:</span> <span className="font-normal">{data.exencionFirma || data.enCasoEmergenciaVisarA || '________________'}</span></p>
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">CI:</span> <span className="font-normal">{data.exencionCI || '________________'}</span></p>
            <p className="border-b border-black pb-1"><span className="font-bold uppercase">Parentesco:</span> <span className="font-normal">{data.exencionParentesco || data.parentescoEmergencia || '________________'}</span></p>
          </div>
          <div className="space-y-3">
             <p className="border-b border-black pb-1"><span className="font-bold uppercase">Testigo:</span> <span className="font-normal">{data.exencionTestigo || '________________'}</span></p>
             <p className="border-b border-black pb-1"><span className="font-bold uppercase">CI Testigo:</span> <span className="font-normal">{data.exencionCITestigo || '________________'}</span></p>
          </div>
        </div>
      </div>
      {renderPageFooter(2)}
    </div>
  );

  // Page 3: INTERROGATORIO
  const renderPage3 = () => (
    <div id="pdf-page-3" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
      <HeaderBannerImage />

      <div className="text-center my-2">
        <h1 className="text-[14pt] font-black tracking-wide uppercase">HISTORIA CLÍNICA PEDIÁTRICA</h1>
        <h2 className="text-[11pt] font-bold uppercase">INTERROGATORIO (ANAMNESIS)</h2>
      </div>

      <div className="text-[9.5pt]" style={{ border: '1px solid #000000' }}>
        {[
          { 
            id: '1', 
            title: 'ANTECEDENTES PRENATALES Y OBSTÉTRICOS', 
            items: 'Controles, Complicaciones, Parto a Término/Pretérmino, Normal/Instrumental/Anestesia',
            content: data.antecedentesPrenatales 
          },
          { 
            id: '2', 
            title: 'PERIODO NEONATAL', 
            items: 'Respiración espontánea, Cianosis, Fiebre, Vómitos, Ictericia, Malformaciones, Peso/Talla al nacer',
            content: data.periodoNeonatal 
          },
          { 
            id: '3', 
            title: 'ALIMENTACIÓN', 
            items: 'Natural (LME), Artificial, Mixta, Destete, Ablactación (Cereales, Sopas, Carnes), Dieta Actual',
            content: data.alimentacion 
          },
          { 
            id: '4', 
            title: 'DESARROLLO PSICOMOTOR', 
            items: 'Sostén cefálico, Sedestación, Bipedestación, Marcha, Control esfínteres, Primeras palabras',
            content: data.desarrolloTabulador 
          },
          { 
            id: '5', 
            title: 'HÁBITOS PSICOLÓGICOS', 
            items: 'Sueño, Siestas, Juegos, Digitosucción, Onicofagia, Rasgos de personalidad, Ocupación',
            content: data.habitosPsicologicos 
          },
          { 
            id: '6', 
            title: 'INMUNIZACIONES Y PRUEBAS', 
            items: 'Polio, Pentavalente, BCG, Trivalente Viral, Fiebre Amarilla, Tarjeta INN',
            content: data.inmunizacionesPruebas 
          },
          { 
            id: '7', 
            title: 'ANTECEDENTES PERSONALES', 
            items: 'Enf. Crónicas, Infecciosas, Hospitalizaciones previas, Quirúrgicos, Traumatismos, Alergias',
            content: data.antecedentesPersonales 
          },
          { 
            id: '8', 
            title: 'HISTORIA FAMILIAR', 
            items: 'Estado de salud Madre, Padre, Hermanos. Linaje Materno y Paterno (APS / Patologías)',
            content: data.historiaFamiliar 
          }
        ].map((sec, idx) => (
          <div key={sec.id} className="grid grid-cols-12" style={{ borderBottom: idx < 7 ? '1px solid #000000' : 'none' }}>
            <div className="col-span-4 p-2 uppercase bg-[#f2f2f2] min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
              <p className="font-bold text-[#000000] text-[8.5pt] leading-tight mb-0.5">{sec.id}. {sec.title}</p>
              <p className="text-[7.5pt] font-normal leading-tight text-[#333333] italic normal-case">{sec.items}</p>
            </div>
            <div className="col-span-8 p-2 text-[#000000] font-normal whitespace-pre-wrap leading-snug text-[9.5pt] min-w-0 break-words">
              {sec.content || 'Sin hallazgos patológicos descritos por el familiar.'}
            </div>
          </div>
        ))}
      </div>
      {renderPageFooter(3)}
    </div>
  );

  // Page 4: EXAMEN FUNCIONAL
  const renderPage4 = () => (
    <div id="pdf-page-4" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
      <HeaderBannerImage />

      <div className="text-center my-1.5">
        <h1 className="text-[14pt] font-black tracking-wide uppercase">HISTORIA CLÍNICA PEDIÁTRICA</h1>
        <h2 className="text-[11pt] font-bold uppercase">EXAMEN FUNCIONAL</h2>
      </div>

      <div className="text-[9.5pt]" style={{ border: '1px solid #000000' }}>
        {[
          { key: 'examenFuncionalGeneral' as const, title: '1. EXAMEN FUNCIONAL GENERAL', items: 'Fiebre, Nutrición, Pérdida de Peso, Aumento de Peso, Sudores Nocturnos, Temblores', content: data.examenFuncionalGeneral },
          { key: 'pielFuncional' as const, title: '2. PIEL', items: 'Cianosis, Edemas, Erupciones, Pigmentaciones, Prurito, Otros', content: data.pielFuncional },
          { key: 'cabezaFuncional' as const, title: '3. CABEZA', items: 'Síncope, Cefalea, Mareos, Caída del cabello, Traumas, Otros', content: data.cabezaFuncional },
          { key: 'ojosFuncional' as const, title: '4. OJOS', items: 'Amaurosis, Anteojos, Cansancio ocular, Diplopía, Dolor, Fotofobia, Lagrimeo', content: data.ojosFuncional },
          { key: 'oidosFuncional' as const, title: '5. OIDOS', items: 'Dolor, Secreciones, Sordera, Tinnitus, Vértigo, Otros', content: data.oidosFuncional },
          { key: 'narizFuncional' as const, title: '6. NARIZ', items: 'Secreción nasal, Epistaxis, Obstrucción, Sinusitis, Catarros', content: data.narizFuncional },
          { key: 'bocaFuncional' as const, title: '7. BOCA', items: 'Dientes, Halitosis, Mucosa, Otros', content: data.bocaFuncional },
          { key: 'respiratorioFuncional' as const, title: '8. RESPIRATORIO', items: 'Disnea, Tos, Esputos, Hemoptisis, Dolor en el Pecho', content: data.respiratorioFuncional },
          { key: 'osteomioarticularFuncional' as const, title: '9. OSTEOMIOARTICULAR', items: 'Artralgias, Debilidad, Dolores óseos, Deformidad, Otros', content: data.osteomioarticularFuncional },
          { key: 'cardiovascularFuncional' as const, title: '10. CARDIOVASCULAR', items: 'Angustia, Disnea, Dolor, Palpitaciones, Taquicardia', content: data.cardiovascularFuncional },
          { key: 'gastrointestinalFuncional' as const, title: '11. GASTROINTESTINAL', items: 'Apetito, Constipación, Diarrea, Dolor, Hernias, Nauseas, Vómitos', content: data.gastrointestinalFuncional },
          { key: 'genitourinarioFuncional' as const, title: '12. GENITOURINARIO', items: 'Enuresis, Hematuria, Dolor, Incontinencia, Micciones, Nicturia, Piuria', content: data.genitourinarioFuncional },
          { key: 'ginecologicosFuncional' as const, title: '13. GINECOLOGICOS', items: 'Menarquia, Flujo, Partos, Dispareunia, Otros', content: data.ginecologicosFuncional },
          { key: 'nerviosoCentralFuncional' as const, title: '14. NERVIOSO CENTRAL', items: 'Convulsiones, Temblor, Marcha, Parálisis, Estática, Estado emocional', content: data.nerviosoCentralFuncional },
        ].map((sec, idx) => (
          <div key={idx} className="grid grid-cols-12" style={{ borderBottom: idx < 13 ? '1px solid #000000' : 'none' }}>
            <div className="col-span-4 py-1.5 px-2 uppercase bg-[#f2f2f2] min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
              <p className="font-bold text-[#000000] text-[8.5pt] leading-tight mb-0.5">{sec.title}</p>
              <p className="text-[7.2pt] font-normal leading-tight text-[#444444] normal-case italic">{sec.items}</p>
            </div>
            <div className="col-span-8 py-1.5 px-2 text-[#000000] font-normal whitespace-pre-wrap leading-snug text-[9.5pt] min-w-0 break-words">
              {sec.content || EXAMEN_FUNCIONAL_NORMAL[sec.key] || 'Sin alteraciones funcionales referidas.'}
            </div>
          </div>
        ))}
      </div>
      {renderPageFooter(4)}
    </div>
  );

  // Page 5: PARTE III - EXAMEN FÍSICO COMPLETO (Ítems 1 al 9)
  const renderPage5 = () => {
    return (
      <div id="pdf-page-5" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
        <HeaderBannerImage />

        <div className="text-center my-1.5">
          <h1 className="text-[14pt] font-black tracking-wide uppercase">HISTORIA CLÍNICA PEDIÁTRICA</h1>
          <h2 className="text-[11pt] font-bold uppercase">PARTE III — EXAMEN FÍSICO</h2>
        </div>

        {/* Signos Vitales y Antropometría Divididos */}
        <div className="mb-2 space-y-1 text-[8.5pt]" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Signos Vitales */}
          <div className="p-1 grid grid-cols-6 gap-1 text-center" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc' }}>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">TEMP:</span> <span className="font-normal">{data.temp || '37'}°C</span></div>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">FR:</span> <span className="font-normal">{data.fr || '20'} x'</span></div>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">FC:</span> <span className="font-normal">{data.fc || '100'} x'</span></div>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">TA:</span> <span className="font-normal">{normalizeOptionalTaDisplay(data.ta)}</span></div>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">SO2(s):</span> <span className="font-normal">{data.so2 || '98'}%</span></div>
            <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">SO2(c):</span> <span className="font-normal">{data.so2ConO2 || '___'}%</span></div>
          </div>

          {/* Antropometría y Percentiles */}
          {(() => {
            const perc = calculatePediatricPercentiles(data.peso, data.talla, data.edad, data.generoPatient);
            const pesoEdadVal = data.percentilPesoEdad || data.pesoEdad || perc.pesoEdad;
            const tallaEdadVal = data.percentilTallaEdad || data.tallaEdad || perc.tallaEdad;
            const pesoTallaVal = data.percentilPesoTalla || data.pesoTalla || perc.pesoTalla;

            return (
              <div className="p-1 grid grid-cols-8 gap-1 text-center text-[8pt]" style={{ border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                <div className="min-w-0 break-words"><span className="font-bold">PESO:</span> <span className="font-normal">{data.peso || '___'} kg</span></div>
                <div className="min-w-0 break-words"><span className="font-bold">TALLA:</span> <span className="font-normal">{data.talla || '___'} cm</span></div>
                <div className="min-w-0 break-words"><span className="font-bold">CC:</span> <span className="font-normal">{data.cc || '___'} cm</span></div>
                <div className="min-w-0 break-words"><span className="font-bold">CA:</span> <span className="font-normal">{data.ca || '___'} cm</span></div>
                <div className="min-w-0 break-words"><span className="font-bold">CT:</span> <span className="font-normal">{data.ct || '___'} cm</span></div>
                <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">P/E:</span> <span className="font-normal">{pesoEdadVal}</span></div>
                <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">T/E:</span> <span className="font-normal">{tallaEdadVal}</span></div>
                <div className="min-w-0 break-words"><span className="font-bold text-[#000000]">P/T:</span> <span className="font-normal">{pesoTallaVal}</span></div>
              </div>
            );
          })()}
        </div>

        {(() => {
          const normalPhys = getPediatricNormalPhysicalExam(data.edad, data.generoPatient || 'niño');
          return (
            <div className="text-[9.5pt]" style={{ border: '1px solid #000000', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {[
                { title: '1. ESTADO GENERAL', items: 'Condiciones Generales, Nutrición y Desarrollo', fieldKey: 'estadoGeneralFisico', content: data.estadoGeneralFisico },
                { title: '2. PIEL PANÍCULO ADIPOSO Y FANERAS', items: 'Color, Humedad, Hidratación, Contextura, Pigmentación, Equimosis, Petequias, Cianosis, Erupción, Panículo adiposo, Vascularización, Cicatrices, Úlceras, Fístulas, Faneras', fieldKey: 'pielPaniculoFanerasFisico', content: data.pielPaniculoFanerasFisico },
                { title: '3. CABEZA', items: 'Configuración, Fontanelas, Suturas, Circunferencia, Craneotabes, Cabellos', fieldKey: 'cabezaFisico', content: data.cabezaFisico },
                { title: '4. OJOS', items: 'Conjuntivitis, Esclerótica, Cornea, Pupila, Movimientos, Desviaciones, Nistagmo, Ptosis, Exoftalmos, Oftalmoscopios', fieldKey: 'ojosFisico', content: data.ojosFisico },
                { title: '5. OIDOS', items: 'Pabellón, Canal externo, Tímpano, Audición, Secreciones, Mastoides, Dolor', fieldKey: 'oidosFisico', content: data.oidosFisico },
                { title: '6. RINOFARINGE', items: 'Fosas nasales, Mucosas, Secreción nasal, Tabique, Senos accesorios, Amigdalitis, Faringe, Adenoides, Secreción Posnatal', fieldKey: 'rinofaringeFisico', content: data.rinofaringeFisico },
                { title: '7. BOCA', items: 'Aliento, Labios, Dientes, Encías, Mucosas, Lengua, Conductos salivares', fieldKey: 'bocaFisico', content: data.bocaFisico },
                { title: '8. CUELLO', items: 'Movilidad, Tumoración, Tiroides, Vasos, Tráquea', fieldKey: 'cuelloFisico', content: data.cuelloFisico },
                { title: '9. GANGLIOS LINFÁTICOS', items: 'Cervicales, Occipitales, Supraclaviculares, Axilares, Inguinales', fieldKey: 'gangliosLinfaticosFisico', content: data.gangliosLinfaticosFisico },
              ].map((sec, idx) => (
                <div key={idx} className="grid grid-cols-12" style={{ borderBottom: idx < 8 ? '1px solid #000000' : 'none' }}>
                  <div className="col-span-4 py-1 px-1.5 uppercase bg-[#f2f2f2] min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
                    <p className="font-bold text-[#000000] text-[8.5pt] leading-tight">{sec.title}</p>
                    <p className="text-[7pt] font-normal leading-tight text-[#333333] normal-case italic">{sec.items}</p>
                  </div>
                  <div className="col-span-8 py-1 px-1.5 text-[#000000] font-normal whitespace-pre-wrap leading-snug text-[9.5pt] min-w-0 break-words">
                    {sec.content || normalPhys[sec.fieldKey] || EXAMEN_FISICO_NORMAL[sec.fieldKey] || 'Normal, sin hallazgos patológicos.'}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="flex justify-between py-1 px-2 mt-2 text-[9pt]" style={{ border: '1px solid #000000', backgroundColor: '#f2f2f2' }}>
          <div><span className="font-bold">Fecha/Hora:</span> <span className="font-normal">{data.fechaHoraExamenFisico || '__________'}</span></div>
          <div><span className="font-bold">Practicado por:</span> <span className="font-normal border-b border-black px-4">{data.examenPracticadoPor || 'Dr. Brayan'}</span></div>
        </div>

        {renderPageFooter(5)}
      </div>
    );
  };

  // Page 6: EXAMEN FÍSICO COMPLETO (Ítems 10 al 17) Y EVALUACIÓN SOCIOECONÓMICA GRAFFAR
  const renderPage6 = () => {
    const scoreA = data.graffarScoreA || 1;
    const scoreB = data.graffarScoreB || 1;
    const scoreC = data.graffarScoreC || 3;
    const scoreD = data.graffarScoreD || 1;
    const totalScore = data.graffarPuntajeTotal || (scoreA + scoreB + scoreC + scoreD);
    const resultado = data.graffarResultado || (
      totalScore <= 6 ? 'I: 4-6' :
      totalScore <= 9 ? 'II: 7-9' :
      totalScore <= 12 ? 'III: 10-12' :
      totalScore <= 16 ? 'IV: 13-16' : 'V: 17-20'
    );

    return (
      <div id="pdf-page-6" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
        <HeaderBannerImage />

        {(() => {
          const normalPhys = getPediatricNormalPhysicalExam(data.edad, data.generoPatient || 'niño');
          const p6Items = [
            { title: '10. TORAX Y PULMONES', items: 'Forma, Simetría, Expansión, Percusión, Ruidos Adventicios, Respiración x min', fieldKey: 'toraxPulmonesFisico', content: data.toraxPulmonesFisico },
            { title: 'CARDIOVASCULAR', items: 'Región Precordial, Ápex, Ruidos Cardíacos, Soplos, Pulsos Periféricos, Llenado Capilar, FC x min', fieldKey: 'cardiovascularFisico', content: data.cardiovascularFisico },
            { title: '11. ABDOMEN', items: 'Circunferencia, Aspecto, Peristalcia, Cicatrices, Dolor, Hiperestesia, Contractura, Defensa, Tumoraciones, Ascitis, Hígado, Bazo', fieldKey: 'abdomenFisico', content: data.abdomenFisico },
            { title: '12. URINARIO', items: 'Riñones, Puntos Dolorosos, Micción, Orina', fieldKey: 'urinarioFisico', content: data.urinarioFisico },
            { title: '13. GENITALES', items: 'Cicatrices, Lesiones, Secreciones, Escroto, Epidídimo, Conducto deferente, Testículos, Próstata, Vesículas seminales, Ovarios, Externos', fieldKey: 'genitalesFisico', content: data.genitalesFisico },
            { title: '14. ANO Y RECTO', items: 'Fisura, Fistula, Prolapso, Esfínter, Tumoraciones, Hemorroides, Eritema anal, Tacto Rectal, Rectoscopia', fieldKey: 'anoRectoFisico', content: data.anoRectoFisico },
            { title: '15. HUESOS, ARTICULACIONES, MUSLOS', items: 'Deformidades, Inflamación, Epífisis, Sensibilidad, Limitación de movimiento, Masas musculares, Dedos hipocráticos', fieldKey: 'huesosArticulacionesMuslosFisico', content: data.huesosArticulacionesMuslosFisico },
            { title: '16. NEUROLÓGICO Y PSIQUICO', items: 'Motilidad, Reflejos, Sensibilidad objetiva, Coordinación, Tróficos, Lenguaje, Escritura, Orientación, Psiquismo', fieldKey: 'neurologicoPsiquicoFisico', content: data.neurologicoPsiquicoFisico },
            { title: '17. SENSORIALES', items: 'Visión, Audición, Olor, Gusto', fieldKey: 'sensorialesFisico', content: data.sensorialesFisico },
          ];
          return (
            <div className="text-[8.5pt] mb-1.5" style={{ border: '1px solid #000000', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {p6Items.map((sec, idx) => (
                <div key={idx} className="grid grid-cols-12" style={{ borderBottom: idx < p6Items.length - 1 ? '1px solid #000000' : 'none' }}>
                  <div className="col-span-4 py-0.5 px-1.5 uppercase bg-[#f2f2f2] min-w-0 break-words" style={{ borderRight: '1px solid #000000' }}>
                    <p className="font-bold text-[#000000] text-[7.6pt] leading-tight">{sec.title}</p>
                    <p className="text-[6pt] font-normal leading-tight text-[#333333] normal-case italic">{sec.items}</p>
                  </div>
                  <div className="col-span-8 py-0.5 px-1.5 text-[#000000] font-normal whitespace-pre-wrap leading-tight text-[8.4pt] min-w-0 break-words">
                    {sec.content || normalPhys[sec.fieldKey] || EXAMEN_FISICO_NORMAL[sec.fieldKey] || 'Normal, sin hallazgos patológicos.'}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Bloque compacto de EVALUACIÓN SOCIOECONÓMICA GRAFFAR diseñado para caber íntegramente en la Hoja 6 */}
        <div className="pdf-avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div className="text-center mt-1.5 pt-1 border-t-2 border-black flex items-baseline justify-center gap-2">
            <h1 className="text-[9.5pt] font-black tracking-wide uppercase text-[#000000] leading-tight">EVALUACIÓN SOCIOECONÓMICA</h1>
            <span className="text-[9pt] font-bold tracking-widest uppercase text-[#000000]">— GRAFFAR</span>
          </div>

          <div className="p-1.5 mt-1 mb-1" style={{ border: '1px solid #000000', backgroundColor: '#ffffff' }}>
            <div className="grid grid-cols-2 gap-1.5 text-[6.8px] leading-[1.15]">
              {/* Columna Izquierda: A y B */}
              <div className="space-y-1" style={{ borderRight: '1px solid #000000', paddingRight: '0.35rem' }}>
                <div>
                  <div className="flex items-center justify-between font-black uppercase text-[7px] pb-0.5 border-b border-black">
                    <span>A) Profesión del Jefe de la Familia</span>
                    <span className="text-[#000000] bg-slate-100 px-1 rounded border border-black text-[6.5px]">Pts: {scoreA}</span>
                  </div>
                  <div className="mt-0.5 space-y-0 text-[6.6px]">
                    <p className={scoreA === 1 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>a.1. Profesión Universitaria</p>
                    <p className={scoreA === 2 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>a.2. Profesión Técnica o Mediano Comerciante</p>
                    <p className={scoreA === 3 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>a.3. Empleado sin Prof. Universitaria, Pequeño Comerciante</p>
                    <p className={scoreA === 4 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>a.4. Obrero Especializado</p>
                    <p className={scoreA === 5 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>a.5. Obrero No Especializado</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between font-black uppercase text-[7px] pb-0.5 border-b border-black">
                    <span>B) Nivel de Instrucción de la Madre</span>
                    <span className="text-[#000000] bg-slate-100 px-1 rounded border border-black text-[6.5px]">Pts: {scoreB}</span>
                  </div>
                  <div className="mt-0.5 space-y-0 text-[6.6px]">
                    <p className={scoreB === 1 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>b.1. Enseñanza Universitaria</p>
                    <p className={scoreB === 2 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>b.2. Enseñanza Secundaria Completa o Técnica Superior</p>
                    <p className={scoreB === 3 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>b.3. Enseñanza secundaria incompleta o técnico Inferior</p>
                    <p className={scoreB === 4 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>b.4. Enseñanza Primaria</p>
                    <p className={scoreB === 5 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>b.5. Analfabeta</p>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: C y D */}
              <div className="space-y-1">
                <div>
                  <div className="flex items-center justify-between font-black uppercase text-[7px] pb-0.5 border-b border-black">
                    <span>C) Fuente de Ingreso</span>
                    <span className="text-[#000000] bg-slate-100 px-1 rounded border border-black text-[6.5px]">Pts: {scoreC}</span>
                  </div>
                  <div className="mt-0.5 space-y-0 text-[6.6px]">
                    <p className={scoreC === 1 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>c.1. Fortuna Heredada</p>
                    <p className={scoreC === 2 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>c.2. Honorarios Profesionales</p>
                    <p className={scoreC === 3 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>c.3. Sueldo Mensual</p>
                    <p className={scoreC === 4 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>c.4. Salario Semanal por Tarea por Destajo</p>
                    <p className={scoreC === 5 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>c.5. Donaciones de Origen Público</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between font-black uppercase text-[7px] pb-0.5 border-b border-black">
                    <span>D) Condiciones de Alojamiento</span>
                    <span className="text-[#000000] bg-slate-100 px-1 rounded border border-black text-[6.5px]">Pts: {scoreD}</span>
                  </div>
                  <div className="mt-0.5 space-y-0 text-[6.6px]">
                    <p className={scoreD === 1 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>d.1. Vivienda con Óptimas Condiciones Sanitarias</p>
                    <p className={scoreD === 2 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>d.2. Viviendas Óptimas</p>
                    <p className={scoreD === 3 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>d.3. Buenas Condiciones Sanitarias en Espacio Reducido</p>
                    <p className={scoreD === 4 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>d.4. Ambiente Reducido y Falta de Condiciones Sanitarias</p>
                    <p className={scoreD === 5 ? 'font-bold bg-slate-200 px-0.5 rounded' : 'text-[#000000]'}>d.5. Rancho o Vivienda en una sola Habitación.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Renglón compacto de Resultado y Estratificación */}
            <div className="mt-1 pt-1 border-t border-black flex flex-wrap items-center justify-between gap-1 text-[7.2px]">
              <div className="flex items-center gap-1 font-black">
                <span className="uppercase">Resultado:</span>
                <span className={`px-1 rounded border ${resultado.includes('I:') ? 'bg-slate-200 border-black font-black' : 'border-slate-300'}`}>I: 4-6</span>
                <span className={`px-1 rounded border ${resultado.includes('II:') ? 'bg-slate-200 border-black font-black' : 'border-slate-300'}`}>II: 7-9</span>
                <span className={`px-1 rounded border ${resultado.includes('III:') ? 'bg-slate-200 border-black font-black' : 'border-slate-300'}`}>III: 10-12</span>
                <span className={`px-1 rounded border ${resultado.includes('IV:') ? 'bg-slate-200 border-black font-black' : 'border-slate-300'}`}>IV: 13-16</span>
                <span className={`px-1 rounded border ${resultado.includes('V:') ? 'bg-slate-200 border-black font-black' : 'border-slate-300'}`}>V: 17-20</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#000000]">
                  Total: <strong className="font-black">{totalScore} pts</strong> · Estrato <strong>{resultado.split(':')[0]}</strong>
                </span>
                <span className="inline-block px-1.5 py-0.5 bg-black text-white font-black text-[6.8px] rounded uppercase tracking-wider">
                  {resultado.includes('I:') ? 'Clase Alta' :
                   resultado.includes('II:') ? 'Clase Media Alta' :
                   resultado.includes('III:') ? 'Clase Media Baja' :
                   resultado.includes('IV:') ? 'Pobreza Relativa' : 'Pobreza Crítica'}
                </span>
              </div>
            </div>
          </div>

          {/* Firma del evaluador compacta */}
          <div className="mt-3 flex justify-between items-end text-[8.5px] font-bold pt-2">
            <div className="text-center w-52 border-t border-black pt-0.5">
              <p>Firma y Sello del Médico Evaluador</p>
              <p className="text-[7.8px] font-normal text-slate-700">{data.examenPracticadoPor || 'Dr. Brayan'}</p>
            </div>
            <div className="text-center w-52 border-t border-black pt-0.5">
              <p>Trabajo Social / Servicio</p>
              <p className="text-[7.8px] font-normal text-slate-700">Hospital Materno Infantil Hugo Chávez</p>
            </div>
          </div>
        </div>
        {renderPageFooter(6)}
      </div>
    );
  };

  // Page 7: HISTORIA DE LABORATORIOS Y PARACLÍNICOS (Modelo Oficial 2 Columnas en 1 Sola Hoja)
  const renderPage7 = () => {
    const leftSampleCols = [0, 1, 2, 3, 4, 5, 6]; // 7 date/value columns on Left Half (2/3 of sheet)
    const rightSampleCols = [0, 1, 2, 3]; // 4 date/value columns on Right Half (1/3 of sheet)
    const patientFullName = `${data.apellidos || ''} ${data.nombres || ''}`.trim();
    const servicioCamaText = data.bedNumber ? `PEDIATRÍA / ${data.bedNumber}` : 'PEDIATRÍA';
    const hasAnyDate = (data.laboratoriosColumnas || []).some(c => Boolean(c?.fecha?.trim()));

    return (
      <div
        id="pdf-page-7"
        className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font"
        style={{
          ...LETTER_PAGE_STYLE,
          padding: '4.5mm 4.5mm 6mm 4.5mm',
          height: 'auto',
          minHeight: '275mm',
          maxHeight: 'none',
          overflow: 'visible',
        }}
      >
        <div className="w-full h-full flex flex-col justify-between">
          <div>
            {/* Título Oficial Centrado */}
            <div className="text-center mb-1">
              <h1
                className="font-black uppercase tracking-wide text-[#000000]"
                style={{ fontSize: '11.5pt', lineHeight: 1.15, fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                HISTORIA DE LABORATORIOS Y PARACLÍNICOS
              </h1>
            </div>

            {/* Línea de Identificación del Paciente */}
            <div
              className="flex items-end justify-between gap-2 mb-1 text-[#000000]"
              style={{ fontSize: '8pt', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1.2 }}
            >
              <div className="flex items-end flex-1 min-w-0">
                <span className="font-bold mr-1 shrink-0">Paciente:</span>
                <span
                  className="font-normal flex-1 truncate px-1"
                  style={{ borderBottom: '1px solid #000000', minHeight: '13px' }}
                >
                  {patientFullName}
                </span>
              </div>
              <div className="flex items-end w-[24%] shrink-0">
                <span className="font-bold mr-1 shrink-0">H.C.:</span>
                <span
                  className="font-normal flex-1 truncate px-1 text-center"
                  style={{ borderBottom: '1px solid #000000', minHeight: '13px' }}
                >
                  {data.numHistoria || ''}
                </span>
              </div>
              <div className="flex items-end w-[27%] shrink-0">
                <span className="font-bold mr-1 shrink-0">Servicio/Cama:</span>
                <span
                  className="font-normal flex-1 truncate px-1 text-center"
                  style={{ borderBottom: '1px solid #000000', minHeight: '13px' }}
                >
                  {servicioCamaText}
                </span>
              </div>
            </div>

            {/* Tabla Principal de 2 Bloques Paralelos (41 Filas Compactas con Valores Referenciales visibles) */}
            <table
              className="w-full border-collapse text-[#000000]"
              style={{
                border: '1px solid #000000',
                tableLayout: 'fixed',
                fontSize: '6pt',
                lineHeight: 1.05,
                fontFamily: 'Arial, Helvetica, sans-serif',
              }}
            >
              <colgroup>
                {/* Bloque Izquierdo (~63.5%): Examen (13.2%) + V.R. (11.8%) + 7 Fechas (7 x 5.5% = 38.5%) */}
                <col style={{ width: '13.2%' }} />
                <col style={{ width: '11.8%' }} />
                {leftSampleCols.map(i => (
                  <col key={`lcol-${i}`} style={{ width: '5.5%' }} />
                ))}
                {/* Separador Central (0.5%) */}
                <col style={{ width: '0.5%' }} />
                {/* Bloque Derecho (~36.0%): Examen (10.8%) + V.R. (9.2%) + 4 Fechas (4 x 4.0% = 16.0%) */}
                <col style={{ width: '10.8%' }} />
                <col style={{ width: '9.2%' }} />
                {rightSampleCols.map(i => (
                  <col key={`rcol-${i}`} style={{ width: '4.0%' }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#d9d9d9', height: '16px' }}>
                  <th
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '1px 2px' }}
                  >
                    Examen
                  </th>
                  <th
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '1px 2px' }}
                  >
                    V.R.
                  </th>
                  <th
                    colSpan={leftSampleCols.length}
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '0px' }}
                  >
                    {!hasAnyDate && !editableLabs ? (
                      <span>Fecha</span>
                    ) : (
                      <div className="w-full">
                        <div className="text-[6pt] font-bold leading-none py-[0.5px] border-b border-black/40">
                          Fecha
                        </div>
                        <div className="grid grid-cols-7">
                          {leftSampleCols.map((colIdx) => {
                            const dateStr = data.laboratoriosColumnas?.[colIdx]?.fecha || '';
                            return (
                              <div
                                key={`lh-date-${colIdx}`}
                                className="border-r last:border-r-0 border-black/50 text-center"
                              >
                                {editableLabs ? (
                                  <input
                                    type="text"
                                    value={dateStr}
                                    onChange={(e) => handleLabDateChange(colIdx, e.target.value)}
                                    placeholder=""
                                    className="w-full text-center bg-transparent font-bold text-black text-[5.6pt] leading-none py-[0.5px] focus:outline-none focus:bg-white"
                                  />
                                ) : (
                                  <span className="text-[5.6pt] font-bold leading-none">{dateStr}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </th>
                  <th
                    style={{
                      borderTop: '1px solid #000000',
                      borderBottom: '1px solid #000000',
                      borderLeft: '1px solid #000000',
                      borderRight: '1px solid #000000',
                      backgroundColor: '#d9d9d9',
                      padding: 0,
                    }}
                  />
                  <th
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '1px 2px' }}
                  >
                    Examen
                  </th>
                  <th
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '1px 2px' }}
                  >
                    V.R.
                  </th>
                  <th
                    colSpan={rightSampleCols.length}
                    className="font-bold text-center"
                    style={{ border: '1px solid #000000', backgroundColor: '#d9d9d9', padding: '0px' }}
                  >
                    {!hasAnyDate && !editableLabs ? (
                      <span>Fecha</span>
                    ) : (
                      <div className="w-full">
                        <div className="text-[6pt] font-bold leading-none py-[0.5px] border-b border-black/40">
                          Fecha
                        </div>
                        <div className="grid grid-cols-4">
                          {rightSampleCols.map((colIdx) => {
                            const dateStr = data.laboratoriosColumnas?.[colIdx]?.fecha || '';
                            return (
                              <div
                                key={`rh-date-${colIdx}`}
                                className="border-r last:border-r-0 border-black/50 text-center"
                              >
                                {editableLabs ? (
                                  <input
                                    type="text"
                                    value={dateStr}
                                    onChange={(e) => handleLabDateChange(colIdx, e.target.value)}
                                    placeholder=""
                                    className="w-full text-center bg-transparent font-bold text-black text-[5.6pt] leading-none py-[0.5px] focus:outline-none focus:bg-white"
                                  />
                                ) : (
                                  <span className="text-[5.6pt] font-bold leading-none">{dateStr}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {HISTORIA_LAB_PAIR_ROWS.map((pair, rowIdx) => {
                  const leftCell = pair.left;
                  const rightCell = pair.right;

                  return (
                    <tr key={`lab-pair-${rowIdx}`} style={{ height: '21.2px', backgroundColor: '#ffffff' }}>
                      {/* LEFT SIDE */}
                      {leftCell.type === 'section' ? (
                        <td
                          colSpan={2 + leftSampleCols.length}
                          className="font-black uppercase text-left text-[#000000]"
                          style={{
                            border: '1px solid #000000',
                            backgroundColor: '#b4c6e7',
                            padding: '1px 4px',
                            fontSize: '6.6pt',
                          }}
                        >
                          {leftCell.title}
                        </td>
                      ) : (
                        <>
                          <td
                            className="font-normal text-left text-[#000000] truncate"
                            style={{ border: '1px solid #000000', padding: '0.5px 3px' }}
                          >
                            {leftCell.name}
                          </td>
                          <td
                            className="text-center text-[#222222] truncate"
                            style={{ border: '1px solid #000000', padding: '0.5px 2px', fontSize: '6pt' }}
                          >
                            {leftCell.ref || ''}
                          </td>
                          {leftSampleCols.map((colIdx) => {
                            const val = getHistoriaLabValue(
                              data.laboratoriosColumnas?.[colIdx]?.valores,
                              leftCell.name
                            );
                            return (
                              <td
                                key={`lval-${rowIdx}-${colIdx}`}
                                className="text-center font-bold text-[#000000]"
                                style={{ border: '1px solid #000000', padding: '0px' }}
                              >
                                {editableLabs && leftCell.name ? (
                                  <input
                                    type="text"
                                    inputMode={isNumericLabTest(leftCell.name) ? 'decimal' : 'text'}
                                    value={val}
                                    onChange={(e) => handleLabValueChange(colIdx, leftCell.name!, e.target.value)}
                                    placeholder=""
                                    className="w-full h-full text-center bg-transparent font-bold text-black text-[6.3pt] focus:outline-none focus:bg-amber-50/70"
                                  />
                                ) : (
                                  <span>{val}</span>
                                )}
                              </td>
                            );
                          })}
                        </>
                      )}

                      {/* CENTER DIVIDER COLUMN */}
                      <td
                        style={{
                          borderTop: '1px solid #000000',
                          borderBottom: '1px solid #000000',
                          borderLeft: '1px solid #000000',
                          borderRight: '1px solid #000000',
                          backgroundColor: '#ffffff',
                          padding: 0,
                        }}
                      />

                      {/* RIGHT SIDE */}
                      {rightCell.type === 'section' ? (
                        <td
                          colSpan={2 + rightSampleCols.length}
                          className="font-black uppercase text-left text-[#000000]"
                          style={{
                            border: '1px solid #000000',
                            backgroundColor: '#b4c6e7',
                            padding: '1px 3px',
                            fontSize: '6.2pt',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rightCell.title}
                        </td>
                      ) : (
                        <>
                          <td
                            className="font-normal text-left text-[#000000] truncate"
                            style={{ border: '1px solid #000000', padding: '0.5px 2px', fontSize: '5.8pt', whiteSpace: 'nowrap' }}
                          >
                            {rightCell.isBlankSlot ? '' : rightCell.name}
                          </td>
                          <td
                            className="text-center text-[#222222] truncate"
                            style={{ border: '1px solid #000000', padding: '0.5px 1.5px', fontSize: '5.4pt', whiteSpace: 'nowrap' }}
                          >
                            {rightCell.ref || ''}
                          </td>
                          {rightSampleCols.map((colIdx) => {
                            const val = getHistoriaLabValue(
                              data.laboratoriosColumnas?.[colIdx]?.valores,
                              rightCell.name
                            );
                            return (
                              <td
                                key={`rval-${rowIdx}-${colIdx}`}
                                className="text-center font-bold text-[#000000]"
                                style={{ border: '1px solid #000000', padding: '0px' }}
                              >
                                {editableLabs && rightCell.name ? (
                                  <input
                                    type="text"
                                    inputMode={isNumericLabTest(rightCell.name) ? 'decimal' : 'text'}
                                    value={val}
                                    onChange={(e) => handleLabValueChange(colIdx, rightCell.name!, e.target.value)}
                                    placeholder=""
                                    className="w-full h-full text-center bg-transparent font-bold text-black text-[6.3pt] focus:outline-none focus:bg-amber-50/70"
                                  />
                                ) : (
                                  <span>{val}</span>
                                )}
                              </td>
                            );
                          })}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {data.laboratoriosOtros && data.laboratoriosOtros.trim() && (
              <div
                className="mt-1 px-1.5 py-0.5 text-[6.5pt] leading-tight"
                style={{ border: '1px solid #000000', backgroundColor: '#ffffff' }}
              >
                <span className="font-black uppercase mr-1">OBSERVACIONES:</span>
                <span className="font-semibold text-black">{data.laboratoriosOtros}</span>
              </div>
            )}
          </div>

          {renderPageFooter(7)}
        </div>
      </div>
    );
  };

  // Page 8: RESUMEN DE INGRESO
  const renderPage8 = () => (
    <div id="pdf-page-8" className="pdf-page-container shadow-md mx-auto text-[#000000] pdf-document-font" style={LETTER_PAGE_STYLE}>
      <HeaderBannerImage />
      <div className="text-center my-1.5">
        <h1 className="text-[14pt] font-black tracking-wide uppercase text-[#000000] border-b-2 border-black inline-block px-4">
          {data.isReingreso ? 'RESUMEN DE INGRESO (REINGRESO)' : 'RESUMEN DE INGRESO'}
        </h1>
      </div>

      {/* Header Resumen */}
      <div className="grid grid-cols-[2.2fr_0.85fr_0.95fr_1.15fr_1.25fr] border border-black mb-1.5 text-[8.5pt]">
        <div className="py-1 px-1.5 border-r border-black min-w-0 break-words"><span className="font-bold uppercase">NOMBRE:</span> <span className="font-normal">{data.apellidos} {data.nombres}</span></div>
        <div className="py-1 px-1.5 border-r border-black min-w-0 break-words"><span className="font-bold uppercase">CAMA:</span> <span className="font-normal">{data.bedNumber || '____'}</span></div>
        <div className="py-1 px-1.5 border-r border-black min-w-0 break-words"><span className="font-bold uppercase">EDAD:</span> <span className="font-normal">{data.edad}</span></div>
        <div className="py-1 px-1.5 border-r border-black min-w-0 break-words"><span className="font-bold uppercase">SERVICIO:</span> <span className="font-normal">PEDIATRÍA</span></div>
        <div className="py-1 px-1.5 min-w-0 break-words uppercase"><span className="font-bold">{data.isReingreso ? 'FECHA REING.:' : 'FECHA:'}</span> <span className="font-normal">{data.fechaIngreso}</span></div>
      </div>

      <div className="space-y-1.5 text-[9.5pt]">
        {/* Motivo y Enfermedad */}
        <div className="border border-black">
          <div className="py-0.5 px-1.5 border-b border-black bg-slate-50 uppercase font-black text-[9px]">MOTIVO DE LA CONSULTA:</div>
          <div className="py-1 px-1.5 min-h-[22px] font-medium leading-tight">{data.resumenMotivoConsulta || '____________________________________________________________________________________'}</div>
        </div>

        <div className="border border-black">
          <div className="py-0.5 px-1.5 border-b border-black bg-slate-50 uppercase font-black text-[9px]">HISTORIA DE LA ENFERMEDAD ACTUAL:</div>
          <div className="py-1 px-1.5 min-h-[55px] font-medium leading-tight whitespace-pre-wrap">
            {typeof data.resumenHistoriaEnfermedad === 'string' && data.resumenHistoriaEnfermedad ? data.resumenHistoriaEnfermedad : 'Se trata de...'}
          </div>
        </div>

        {/* Antecedentes */}
        <div className="grid grid-cols-3 border border-black text-[8.5px]">
          <div className="py-0.5 px-1 border-r border-black">
            <p className="font-black uppercase mb-0.5 border-b border-black">ANT. OBSTÉTRICOS:</p>
            <p className="font-medium">{data.resumenAntecedentesObstetricos || '_____'}</p>
          </div>
          <div className="py-0.5 px-1 border-r border-black">
            <p className="font-black uppercase mb-0.5 border-b border-black">INMUNIZACIONES:</p>
            <p className="font-medium">{data.resumenInmunizaciones || '_____'}</p>
          </div>
          <div className="py-0.5 px-1">
            <p className="font-black uppercase mb-0.5 border-b border-black">ANT. PATOLÓGICOS PERSONALES:</p>
            <p className="font-medium">{data.resumenPatologicosPersonales || '_____'}</p>
          </div>
        </div>

        {/* Patologicos Familiares */}
        <div className="border border-black text-[8.5px]">
           <div className="py-0.5 px-1 border-b border-black bg-slate-50 uppercase font-black text-center text-[8.5px]">ANTECEDENTES PATOLÓGICOS FAMILIARES</div>
           <div className="grid grid-cols-12">
             <div className="col-span-4 py-0.5 px-1 border-r border-black">MADRE: {data.resumenMadre || '____'}</div>
             <div className="col-span-4 py-0.5 px-1 border-r border-black">ABUELA MATERNA: {data.resumenAbuelaMaterna || '____'}</div>
             <div className="col-span-4 py-0.5 px-1">ABUELO MATERNO: {data.resumenAbueloMaterno || '____'}</div>
             
             <div className="col-span-4 py-0.5 px-1 border-t border-r border-black">PADRE: {data.resumenPadre || '____'}</div>
             <div className="col-span-4 py-0.5 px-1 border-t border-r border-black">ABUELA PATERNA: {data.resumenAbuelaPaterna || '____'}</div>
             <div className="col-span-4 py-0.5 px-1 border-t">ABUELO PATERNO: {data.resumenAbueloPaterno || '____'}</div>
             
             <div className="col-span-12 py-0.5 px-1 border-t">HERMANOS: {data.resumenHermanos || '____'}</div>
           </div>
        </div>

        {/* Examen Fisico */}
        <div className="border border-black text-[9px]">
           <div className="py-0.5 px-1 border-b border-black bg-slate-50 uppercase font-black text-center text-[9px]">EXAMEN FÍSICO DE INGRESO</div>
           <div className="grid grid-cols-5 text-center font-bold">
             <div className="py-0.5 px-0.5 border-r border-b border-black">PESO: {data.resumenExamenPeso || '____'}</div>
             <div className="py-0.5 px-0.5 border-r border-b border-black">TALLA: {data.resumenExamenTalla || '____'}</div>
             <div className="py-0.5 px-0.5 border-r border-b border-black">FR: {data.resumenExamenFr || '____'}</div>
             <div className="py-0.5 px-0.5 border-r border-b border-black">FC: {data.resumenExamenFc || '____'}</div>
             <div className="py-0.5 px-0.5 border-b border-black">TEMP: {data.resumenExamenTemp || '____'}°C</div>
             
             <div className="py-0.5 px-0.5 border-r border-black">SO2: {data.resumenExamenSo2 || '____'}%</div>
             <div className="py-0.5 px-0.5 border-r border-black">TA: {normalizeOptionalTaDisplay(data.resumenExamenTa)}</div>
             <div className="py-0.5 px-0.5 border-r border-black">TE: {data.resumenExamenTe || '____'}</div>
             <div className="py-0.5 px-0.5 border-r border-black">PE%: {data.resumenPercentilPe || '____'}</div>
             <div className="py-0.5 px-0.5">PT%: {data.resumenPercentilPt || '____'}</div>
           </div>
        </div>

        {/* Paraclínicos */}
        <div className="border border-black text-[8.5px]">
           <div className="py-0.5 px-1 border-b border-black bg-slate-50 uppercase font-black text-center text-[8.5px]">PARACLÍNICOS DE INGRESO</div>
           <div className="grid grid-cols-6 text-center font-bold border-b border-black">
              <div className="py-0.5 px-0.5 border-r border-black">LEU: {data.resumenLabLeu || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">SEG: {data.resumenLabSeg || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">LIN: {data.resumenLabLin || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">MON: {data.resumenLabMon || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">HB: {data.resumenLabHb || '____'}</div>
              <div className="py-0.5 px-0.5">HTO: {data.resumenLabHto || '____'}</div>
           </div>
           <div className="grid grid-cols-5 text-center font-bold">
              <div className="py-0.5 px-0.5 border-r border-black">VCM: {data.resumenLabVcm || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">HCM: {data.resumenLabHcm || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">PLT: {data.resumenLabPlt || '____'}</div>
              <div className="py-0.5 px-0.5 border-r border-black">VSG: {data.resumenLabVsg || '____'}</div>
              <div className="py-0.5 px-0.5">PCR: {data.resumenLabPcr || '____'}</div>
           </div>
        </div>

        <div className="border border-black">
          <div className="py-0.5 px-1.5 border-b border-black bg-slate-50 uppercase font-black text-[9px]">RX DE TÓRAX:</div>
          <div className="py-1 px-1.5 min-h-[30px] font-medium leading-tight whitespace-pre-wrap">
            {typeof data.resumenRxTorax === 'string' && data.resumenRxTorax.trim() ? data.resumenRxTorax : 'Líneas de redacción...'}
          </div>
        </div>

        {/* Conclusion Diagnósticos de Ingreso con 2 columnas, Arial, negrita en dx principal, normal en sub dx */}
        <div className="border border-black overflow-hidden">
          <div className="py-0.5 px-1.5 border-b border-black bg-slate-50 uppercase font-black text-[9px]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>DIAGNÓSTICOS DE INGRESO:</div>
          <div className="py-1.5 px-2 min-h-[45px] max-h-[160px] leading-tight overflow-hidden">
            {renderFormattedDiagnoses(data.resumenDiagnosticosIngreso)}
          </div>
        </div>

        {/* Comentario Amplio (Sin PLAN: VER ÓRDENES MÉDICAS, espacio generoso para escribir a mano) */}
        <div className="border border-black">
           <div className="py-0.5 px-1.5 border-b border-black bg-slate-50 uppercase font-black text-[9px]">COMENTARIO:</div>
           <div className="py-1.5 px-2 min-h-[110px] font-medium leading-relaxed whitespace-pre-wrap text-[10px]">
             {typeof data.resumenComentario === 'string' && data.resumenComentario.trim() && data.resumenComentario !== '[object Object]' ? data.resumenComentario : (
               <div className="h-full flex flex-col justify-around text-slate-300 pointer-events-none select-none">
                 <div className="border-b border-dotted border-slate-300 w-full h-5"></div>
                 <div className="border-b border-dotted border-slate-300 w-full h-5"></div>
                 <div className="border-b border-dotted border-slate-300 w-full h-5"></div>
                 <div className="border-b border-dotted border-slate-300 w-full h-5"></div>
               </div>
             )}
           </div>
        </div>
      </div>
      
      {/* Signature */}
      <div className="mt-4 text-center text-[9.5px] font-bold">
         <div className="w-56 border-t border-black pt-0.5 mx-auto">
            <p className="uppercase">{data.examenPracticadoPor || 'DR. BRAYAN'}</p>
            <p className="text-[8px] uppercase">Médico que Elabora Resumen</p>
         </div>
      </div>
      {renderPageFooter(8)}
    </div>
  );

  return (
    <div className="pdf-preview-wrapper pdf-document-font w-full flex flex-col items-center">
      {(!activePage || activePage === 1) && renderScaled(renderPage1(), 1)}
      {(!activePage || activePage === 2) && renderScaled(renderPage2(), 2)}
      {(!activePage || activePage === 3) && renderScaled(renderPage3(), 3)}
      {(!activePage || activePage === 4) && renderScaled(renderPage4(), 4)}
      {(!activePage || activePage === 5) && renderScaled(renderPage5(), 5)}
      {(!activePage || activePage === 6) && renderScaled(renderPage6(), 6)}
      {(!activePage || activePage === 7) && renderScaled(renderPage7(), 7)}
      {(!activePage || activePage === 8) && renderScaled(renderPage8(), 8)}
    </div>
  );
};
