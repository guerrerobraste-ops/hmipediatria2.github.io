import { HistoriaClinicaPediatrica, Patient } from '../types';

export type DoseUnit = 'mg' | 'ui' | 'gr' | 'mcg' | 'mEq' | 'gotas';
export type DoseBasis = 'dosis' | 'día';
export type DoseIntervalHours = '2' | '4' | '6' | '8' | '10' | '12' | '24';

export const DOSE_INTERVAL_OPTIONS: DoseIntervalHours[] = ['2', '4', '6', '8', '10', '12', '24'];

export interface DxNode {
  id: string;
  numberStr: string;
  text: string;
  level: number; // 1, 2, 3
}

export interface TxNode {
  id: string;
  numberStr: string;
  text: string;
  startDate?: string;
  doseValue?: string;
  doseUnit?: DoseUnit;
  doseBasis?: DoseBasis;
  doseIntervalHours?: DoseIntervalHours;
  isNoCumplido?: boolean;
  noCumplidoMotivo?: string;
  isCulminado?: boolean;
  culminadoDias?: number;
  culminatedDate?: string;
  /** Accumulated completed days from a previous course before being re-administered */
  priorCompletedDays?: number;
}

export const SINTOMATICO_LABEL = 'Sintomático';

export function isSintomaticoText(text?: string | null): boolean {
  const cleaned = (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\.+$/, '')
    .trim();
  return cleaned === '' || cleaned === 'sintomatico' || cleaned === 'tratamiento sintomatico';
}

export function normalizeTreatmentDisplay(text?: string | null): string {
  const raw = (text || '').trim();
  if (!raw || isSintomaticoText(raw)) {
    return SINTOMATICO_LABEL;
  }
  return raw;
}

export function calculateDiasCumplidos(startDateStr?: string, referenceDate?: Date): number {
  if (!startDateStr) return 1;
  const start = new Date(`${startDateStr}T00:00:00`);
  const now = referenceDate ? new Date(referenceDate.getTime()) : new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Number.isNaN(diffDays) ? 1 : diffDays);
}

/**
 * Calculates total active treatment days, continuing seamlessly from any
 * previously completed days (`priorCompletedDays`) without counting paused days.
 */
export function calculateTotalActiveDays(
  node: Pick<TxNode, 'startDate' | 'priorCompletedDays'>,
  referenceDate?: Date
): number {
  const prior = node.priorCompletedDays && node.priorCompletedDays > 0 ? node.priorCompletedDays : 0;
  return prior + calculateDiasCumplidos(node.startDate, referenceDate);
}

/**
 * Strips leading hierarchical numbering like "1.", "1.1.", "2.3.1", "1)", bullets, or tree glyphs
 * from a diagnosis suggestion string.
 */
export function stripDiagnosisNumbering(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  // Repeatedly strip tree symbols, bullets, or numeric prefixes (e.g. "1. ", "1.1. ", "2.1.3 ")
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^[├└│─•\-*]+\s*/, '')
      .replace(/^\d+(?:\.\d+)*\s*[\.\)\-:]?\s+/, '')
      .replace(/^\d+(?:\.\d+)+\.?\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim();
  }
  return cleaned;
}

/**
 * Extracts strictly the medication name from a treatment string, removing numbering,
 * pipe metadata (Dosis, Inicio, Día, NO CUMPLIDO, TRATAMIENTO CULMINADO),
 * and inline dosage/route/frequency instructions such as "50mg/kg/dosis EV c/6h".
 */
export function extractMedicationNameOnly(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Remove leading numbering or bullets
  text = text.replace(/^[•\-*]\s*/, '').replace(/^\d+(?:\.\d+)*\.?\s+/, '').trim();
  // Strip any pipe-delimited clinical metadata
  text = text.split('|')[0].trim();

  if (isSintomaticoText(text)) return '';

  // Remove inline dosage patterns like "50mg/kg/dosis EV c/6h", "100 mg/kg/día", "0.15mg/kg/dosis c/4h", "a 2 L/min", "a requerimiento"
  text = text
    .replace(
      /\s+\d+(?:[.,]\d+)?\s*(?:mg|ui|gr|g|mcg|mEq|meq|cc|ml|gotas|puff|puffs|l\/min)\b.*$/i,
      ''
    )
    .replace(/\s+\ba\s+\d+(?:[.,]\d+)?\s*(?:l\/min|ml\/h|cc\/h|gotas|mcg|mg)\b.*$/i, '')
    .replace(/\s+\ba\s+requerimiento\b.*$/i, '')
    .replace(/\s+\b(?:EV|IV|VO|IM|SC|SL|INH|NEB|SOS|PRN|OD|BID|TID|QID)\b.*$/i, '')
    .replace(/\s+\bc\/\s*\d+\s*h(?:oras?|rs?)?\b.*$/i, '')
    .replace(/\s+\bcada\s+\d+\s*h(?:oras?|rs?)?\b.*$/i, '')
    .replace(/[\s,;-]+$/, '')
    .trim();

  if (isSintomaticoText(text)) return '';
  return text;
}

const DEFAULT_MAIN_DIAGNOSES: string[] = [
  'IRB (Infección Respiratoria Baja)',
  'IRA (Infección Respiratoria Aguda)',
  'Bronquiolitis Aguda',
  'Neumonía Adquirida en la Comunidad (NAC)',
  'Síndrome Febril',
  'Gastroenteritis Aguda (GEA)',
  'Crisis Asmática',
  'Sepsis de Origen Respiratorio',
  'Infección del Tracto Urinario (ITU)',
  'Celulitis Periorbitaria',
  'Síndrome Convulsivo',
  'Dengue con Signos de Alarma',
];

const DEFAULT_SUB_DIAGNOSES: string[] = [
  'Deshidratación Leve',
  'Deshidratación Moderada',
  'Deshidratación Severa',
  'Insuficiencia Respiratoria Aguda',
  'Sibilancias Recurrentes',
  'Derrame Pleural Paraneumónico',
  'Anemia Microcítica Hipocrómica',
  'Desequilibrio Hidroelectrolítico',
  'Acidosis Metabólica Compensada',
  'Etiología Viral a Descartar',
  'Etiología Bacteriana a Descartar',
  'Sobreinfección Bacteriana',
];

const DEFAULT_MEDICATION_NAMES: string[] = [
  'Ampicilina Sulbactam',
  'Ceftriaxona',
  'Cefotaxima',
  'Amikacina',
  'Vancomicina',
  'Meropenem',
  'Clindamicina',
  'Azitromicina',
  'Hidrocortisona',
  'Dexametasona',
  'Metilprednisolona',
  'Salbutamol nebulizado',
  'Budesonida nebulizada',
  'Bromuro de Ipratropio',
  'Dipirona',
  'Acetaminofén',
  'Ibuprofeno',
  'Ondansetrón',
  'Omeprazol',
  'Furosemida',
  'Solución 0.45% + Dextrosa 5%',
  'Solución Fisiológica 0.9%',
  'Oxigenoterapia por cánula nasal',
];

export interface SeparatedDiagnosisSuggestions {
  mainSuggestions: string[];
  subSuggestions: string[];
}

/**
 * Builds non-overlapping, prefix-free suggestions separated strictly into
 * Main Diagnoses (level 1) and Sub-Diagnoses (level 2/3).
 */
export function buildSeparatedDiagnosisSuggestions(
  patients: Patient[],
  historias: HistoriaClinicaPediatrica[]
): SeparatedDiagnosisSuggestions {
  const mainMap = new Map<string, string>();
  const subMap = new Map<string, string>();

  const addMain = (raw?: string) => {
    if (!raw) return;
    const cleaned = stripDiagnosisNumbering(raw);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!mainMap.has(key)) mainMap.set(key, cleaned);
  };

  const addSub = (raw?: string) => {
    if (!raw) return;
    const cleaned = stripDiagnosisNumbering(raw);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!subMap.has(key)) subMap.set(key, cleaned);
  };

  const classifyMultiLine = (text?: string) => {
    if (!text) return;
    text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const leadingSpaces = line.search(/\S/);
      const isSub =
        /^\d+\.\d+/.test(trimmed) ||
        leadingSpaces >= 2 ||
        /^[├└]/.test(trimmed);
      if (isSub) {
        addSub(trimmed);
      } else {
        addMain(trimmed);
      }
    });
  };

  patients.forEach(p => {
    p.diagnoses?.forEach(d => {
      if (d.title?.trim()) {
        classifyMultiLine(d.title);
      }
      d.subDiagnoses?.forEach(sd => {
        if (sd?.trim()) addSub(sd);
      });
    });
    p.evolutions?.forEach(ev => {
      if (ev.diagnosesModified) {
        classifyMultiLine(ev.diagnosesModified);
      }
    });
  });

  historias.forEach(h => {
    if (h.diagnosticoAdmision?.trim()) classifyMultiLine(h.diagnosticoAdmision);
    if (h.diagnosticoClinicoFinal?.trim()) classifyMultiLine(h.diagnosticoClinicoFinal);
  });

  DEFAULT_MAIN_DIAGNOSES.forEach(addMain);
  DEFAULT_SUB_DIAGNOSES.forEach(addSub);

  // Guarantee strict separation: a sub-diagnosis never appears in mainSuggestions and vice versa.
  // If a string appeared in both, keep it in its natural bucket (default sub stays sub; otherwise main wins).
  const defaultSubKeys = new Set(DEFAULT_SUB_DIAGNOSES.map(s => s.toLowerCase()));
  for (const key of Array.from(subMap.keys())) {
    if (mainMap.has(key)) {
      if (defaultSubKeys.has(key)) {
        mainMap.delete(key);
      } else {
        subMap.delete(key);
      }
    }
  }

  return {
    mainSuggestions: Array.from(mainMap.values()),
    subSuggestions: Array.from(subMap.values()),
  };
}

/**
 * Builds medication-name-only suggestions (no dosages, routes, or frequency suffixes).
 */
export function buildMedicationNameSuggestions(
  patients: Patient[],
  historias: HistoriaClinicaPediatrica[]
): string[] {
  const medMap = new Map<string, string>();
  const addMed = (raw?: string) => {
    if (!raw) return;
    const nameOnly = extractMedicationNameOnly(raw);
    if (!nameOnly) return;
    const key = nameOnly.toLowerCase();
    if (!medMap.has(key)) medMap.set(key, nameOnly);
  };

  patients.forEach(p => {
    if (p.treatment) {
      p.treatment.split(/\r?\n/).forEach(addMed);
    }
    p.evolutions?.forEach(ev => {
      if (ev.treatmentModified) {
        ev.treatmentModified.split(/\r?\n/).forEach(addMed);
      }
    });
  });

  historias.forEach(h => {
    if (h.intervencionTratamiento) {
      h.intervencionTratamiento.split(/\r?\n/).forEach(addMed);
    }
  });

  DEFAULT_MEDICATION_NAMES.forEach(addMed);

  return Array.from(medMap.values());
}

export function parseTreatmentText(text: string, referenceDate?: Date): TxNode[] {
  const todayStr = (referenceDate || new Date()).toISOString().split('T')[0];
  const emptyDefault: TxNode[] = [
    {
      id: 't-1',
      numberStr: '1.',
      text: '',
      startDate: todayStr,
      doseValue: '',
      doseUnit: 'mg',
      doseBasis: 'día',
      doseIntervalHours: '6',
      isNoCumplido: false,
      noCumplidoMotivo: '',
      isCulminado: false,
    },
  ];

  if (!text || isSintomaticoText(text)) return emptyDefault;

  const lines = text.split(/\r?\n/);
  const nodes: TxNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || isSintomaticoText(trimmed)) return;

    const match = trimmed.match(/^([\d.]+)\s*(.*)$/);
    let numStr = String(idx + 1);
    let rawContent = trimmed;
    if (match) {
      numStr = match[1].replace(/\.$/, '');
      rawContent = match[2] || '';
    }

    // Parse Start Date if embedded: | Inicio: 2026-11-08
    let startDate: string | undefined;
    const dateMatch =
      rawContent.match(/\|\s*Inicio:\s*(\d{4}-\d{2}-\d{2})/i) ||
      rawContent.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      startDate = dateMatch[1];
    }

    // Parse Dose if embedded: | Dosis: 50 mg/kg/dosis c/6h OR | Dosis: 15 gotas/dosis c/4h
    let doseValue = '';
    let doseUnit: DoseUnit = 'mg';
    let doseBasis: DoseBasis = 'día';
    let doseIntervalHours: DoseIntervalHours = '6';

    const doseMatch = rawContent.match(
      /\|\s*Dosis:\s*([\d.]+)\s*(mg|ui|gr|g|mcg|mEq|gotas)(?:\/kg)?\/(dosis|día|dia)(?:\s*c\/(\d+)h)?/i
    );
    if (doseMatch) {
      doseValue = doseMatch[1];
      const u = doseMatch[2].toLowerCase();
      doseUnit = (u === 'g' ? 'gr' : u === 'meq' ? 'mEq' : u) as DoseUnit;
      const b = doseMatch[3].toLowerCase();
      doseBasis = b === 'dosis' ? 'dosis' : 'día';
      if (doseMatch[4] && DOSE_INTERVAL_OPTIONS.includes(doseMatch[4] as DoseIntervalHours)) {
        doseIntervalHours = doseMatch[4] as DoseIntervalHours;
      }
    } else {
      const standaloneInterval = rawContent.match(/\|\s*c\/(\d+)h\b/i);
      if (
        standaloneInterval &&
        DOSE_INTERVAL_OPTIONS.includes(standaloneInterval[1] as DoseIntervalHours)
      ) {
        doseBasis = 'dosis';
        doseIntervalHours = standaloneInterval[1] as DoseIntervalHours;
      }
    }

    // Parse Culminado: | TRATAMIENTO CULMINADO | Inicio: YYYY-MM-DD | Culminación: YYYY-MM-DD | X días cumplidos
    const isCulminado = /\|\s*TRATAMIENTO CULMINADO\b/i.test(rawContent);
    let culminadoDias: number | undefined;
    const diasCumplidosMatch = rawContent.match(/\|\s*(\d+)\s*d[ií]as?\s*cumplidos?\b/i);
    if (diasCumplidosMatch) {
      culminadoDias = Math.max(1, parseInt(diasCumplidosMatch[1], 10));
    }
    let culminatedDate: string | undefined;
    const culmDateMatch = rawContent.match(/\|\s*Culminaci[oó]n:\s*(\d{4}-\d{2}-\d{2})/i);
    if (culmDateMatch) {
      culminatedDate = culmDateMatch[1];
    }

    // Parse accumulated prior days from a re-administered course: | Acumulado: 2d
    let priorCompletedDays: number | undefined;
    const priorMatch = rawContent.match(/\|\s*Acumulado:\s*(\d+)d\b/i);
    if (priorMatch) {
      const parsedPrior = parseInt(priorMatch[1], 10);
      if (!Number.isNaN(parsedPrior) && parsedPrior > 0) {
        priorCompletedDays = parsedPrior;
      }
    }

    // Parse No Cumplido if embedded: | NO CUMPLIDO HOY: motivo
    let isNoCumplido = false;
    let noCumplidoMotivo = '';
    const ncMatch = rawContent.match(/\|\s*NO CUMPLIDO HOY(?::\s*([^|]+))?/i);
    if (ncMatch) {
      isNoCumplido = true;
      noCumplidoMotivo = ncMatch[1]?.trim() || '';
    }

    const cleanText = rawContent
      .split('|')[0]
      .trim();

    if (!cleanText) return;

    nodes.push({
      id: `tx-node-${idx}-${numStr}`,
      numberStr: `${nodes.length + 1}.`,
      text: cleanText,
      startDate: startDate || todayStr,
      doseValue,
      doseUnit,
      doseBasis,
      doseIntervalHours,
      isNoCumplido: isCulminado ? false : isNoCumplido,
      noCumplidoMotivo: isCulminado ? '' : noCumplidoMotivo,
      isCulminado,
      culminadoDias: isCulminado
        ? culminadoDias || calculateDiasCumplidos(startDate || todayStr, referenceDate)
        : undefined,
      culminatedDate: isCulminado ? culminatedDate : undefined,
      priorCompletedDays: isCulminado ? undefined : priorCompletedDays,
    });
  });

  return nodes.length > 0 ? nodes : emptyDefault;
}

export function serializeTreatmentNodes(nodes: TxNode[], referenceDate?: Date): string {
  const validNodes = nodes.filter(node => node.text.trim().length > 0);
  if (validNodes.length === 0) {
    return SINTOMATICO_LABEL;
  }

  // Keep active treatments first and culminated treatments at the end
  const activeNodes = validNodes.filter(n => !n.isCulminado);
  const culminatedNodes = validNodes.filter(n => Boolean(n.isCulminado));
  const ordered = [...activeNodes, ...culminatedNodes];

  const todayStr = (referenceDate || new Date()).toISOString().split('T')[0];

  const lines: string[] = [];
  ordered.forEach((node, idx) => {
    const numberStr = `${idx + 1}.`;
    const lineText = node.text.split('|')[0].trim();

    const tags: string[] = [];
    if (node.doseValue && String(node.doseValue).trim() !== '') {
      const basis = node.doseBasis || 'día';
      const unit = node.doseUnit || 'mg';
      const intervalSuffix =
        basis === 'dosis' ? ` c/${node.doseIntervalHours || '6'}h` : '';
      const perWeightSegment = unit === 'gotas' ? '/' : '/kg/';
      tags.push(`Dosis: ${node.doseValue} ${unit}${perWeightSegment}${basis}${intervalSuffix}`);
    } else if (node.doseBasis === 'dosis' && node.doseIntervalHours) {
      tags.push(`c/${node.doseIntervalHours}h`);
    }

    if (node.isCulminado) {
      const start = node.startDate || todayStr;
      const end = node.culminatedDate || todayStr;
      const dias = node.culminadoDias || calculateTotalActiveDays(node, referenceDate);
      tags.push('TRATAMIENTO CULMINADO');
      tags.push(`Inicio: ${start}`);
      tags.push(`Culminación: ${end}`);
      tags.push(`${dias} ${dias === 1 ? 'día cumplido' : 'días cumplidos'}`);
    } else {
      if (node.startDate) {
        const dias = calculateTotalActiveDays(node, referenceDate);
        if (node.priorCompletedDays && node.priorCompletedDays > 0) {
          tags.push(`Inicio: ${node.startDate}`);
          tags.push(`Acumulado: ${node.priorCompletedDays}d`);
        }
        tags.push(`Día ${dias}`);
      }
      if (node.isNoCumplido) {
        tags.push(
          `NO CUMPLIDO HOY${node.noCumplidoMotivo?.trim() ? `: ${node.noCumplidoMotivo.trim()}` : ''}`
        );
      }
    }

    if (tags.length > 0) {
      lines.push(`${numberStr} ${lineText} | ${tags.join(' | ')}`);
    } else {
      lines.push(`${numberStr} ${lineText}`);
    }
  });

  return lines.join('\n');
}

/**
 * Marks the treatment at `index` as culminated, computes completed days (including any prior course),
 * records both startDate and culminatedDate, and moves it to the end of the treatment list.
 */
export function markTreatmentCulminado(
  nodes: TxNode[],
  index: number,
  referenceDate?: Date
): TxNode[] {
  if (index < 0 || index >= nodes.length) return nodes;
  const todayStr = (referenceDate || new Date()).toISOString().split('T')[0];
  const target = nodes[index];
  if (!target || !target.text.trim()) return nodes;

  const start = target.startDate || todayStr;
  const dias = calculateTotalActiveDays({ startDate: start, priorCompletedDays: target.priorCompletedDays }, referenceDate);

  const culminatedNode: TxNode = {
    ...target,
    startDate: start,
    culminatedDate: todayStr,
    isCulminado: true,
    culminadoDias: dias,
    priorCompletedDays: undefined,
    isNoCumplido: false,
    noCumplidoMotivo: '',
  };

  const remaining = nodes.filter((_, i) => i !== index);
  const active = remaining.filter(n => !n.isCulminado);
  const alreadyCulminated = remaining.filter(n => Boolean(n.isCulminado));

  const reordered = [...active, ...alreadyCulminated, culminatedNode].map((n, idx) => ({
    ...n,
    numberStr: `${idx + 1}.`,
  }));

  return reordered;
}

/**
 * Re-administers a previously culminated treatment: reactivates it as of `referenceDate`
 * while preserving `priorCompletedDays` so the day count continues seamlessly without counting paused days.
 * Example: 2 completed days -> paused 3 days -> re-administered today -> Día 3.
 */
export function readministrarTreatment(
  nodes: TxNode[],
  index: number,
  referenceDate?: Date
): TxNode[] {
  if (index < 0 || index >= nodes.length) return nodes;
  const target = nodes[index];
  if (!target || !target.isCulminado) return nodes;

  const todayStr = (referenceDate || new Date()).toISOString().split('T')[0];
  const priorDays = target.culminadoDias || calculateDiasCumplidos(target.startDate, referenceDate);

  const reactivatedNode: TxNode = {
    ...target,
    isCulminado: false,
    culminadoDias: undefined,
    culminatedDate: undefined,
    startDate: todayStr,
    priorCompletedDays: priorDays,
    isNoCumplido: false,
    noCumplidoMotivo: '',
  };

  const remaining = nodes.filter((_, i) => i !== index);
  const active = remaining.filter(n => !n.isCulminado);
  const culminated = remaining.filter(n => Boolean(n.isCulminado));

  return [...active, reactivatedNode, ...culminated].map((n, idx) => ({
    ...n,
    numberStr: `${idx + 1}.`,
  }));
}
