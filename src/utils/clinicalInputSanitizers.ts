/**
 * Shared pure input sanitizers for pediatric clinical forms:
 * - Signos Vitales (Historia Pediátrica Página 5 & Evolución Médica)
 * - Antropometría & Percentiles Pediátricos
 * - Laboratorios y Paraclínicos (Página 7 & Hoja Oficial PDF)
 */

export const NUMERIC_ONLY_LAB_CATEGORIES = new Set<string>([
  'Hematología y Coagulación',
  'Química Sanguínea',
  'Electrolitos y Minerales',
  'Gases Arteriales',
]);

export const NUMERIC_LAB_TEST_NAMES = new Set<string>([
  // Hematología y Coagulación
  'Hemoglobina',
  'Hematocrito',
  'VCM',
  'HCM',
  'CHCM',
  'Leucocitos',
  'Seg. Neutrófilos',
  'Linfocitos',
  'Monocitos',
  'Eosinófilos',
  'Plaquetas',
  'Reticulocitos',
  'TP',
  'TTP',
  'Fibrinógeno',
  'Grupo y Rh',
  'VSG',
  // Química Sanguínea
  'Glicemia',
  'Urea',
  'BUN',
  'Creatinina',
  'Ácido Úrico',
  'TGO (AST)',
  'TGP (ALT)',
  'Fosfatasa Alcalina',
  'GGT',
  'Bilirrubina Total',
  'Bilirrubina Directa',
  'Bilirrubina Indirecta',
  'Proteínas Totales',
  'Albúmina',
  'Globulina',
  'Amilasa',
  'Lipasa',
  'LDH',
  'Colesterol Total',
  'Triglicéridos',
  'PCR',
  'Procalcitonina',
  // Electrolitos y Minerales
  'Sodio (Na)',
  'Potasio (K)',
  'Cloro (Cl)',
  'Calcio (Ca) Total',
  'Calcio Iónico',
  'Magnesio (Mg)',
  'Fósforo (P)',
  // Gases Arteriales
  'pH',
  'pCO2',
  'pO2',
  'HCO3',
  'TCO2',
  'EB',
  'SatO2',
  'Lactato',
  // Orina y Heces (campos estrictamente numéricos)
  'Densidad',
  'pH Orina',
  // Microbiología, LCR y Serología (campos estrictamente numéricos)
  'Células LCR',
  'Glucosa LCR',
  'Proteínas LCR',
]);

export const SIGNED_NUMERIC_LAB_TEST_NAMES = new Set<string>(['EB']);

export const TEXT_ONLY_LAB_CATEGORIES = new Set<string>(['Panel Respiratorio']);
export const TEXT_ONLY_LAB_TEST_NAMES = new Set<string>(['Panel Respiratorio']);

/**
 * Keeps ONLY digits (0-9), a single decimal point (converting `,` to `.`),
 * and optionally a single leading minus sign (`-`) when `allowNegative` is true.
 * Strips all letters, spaces, units, and invalid symbols.
 */
export function sanitizeNumericDecimal(raw: string, allowNegative = false): string {
  if (!raw) return '';
  const normalized = raw.replace(/,/g, '.');
  let result = '';
  let hasDot = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      result += '.';
    } else if (allowNegative && ch === '-' && result.length === 0) {
      result += '-';
    }
  }

  return result;
}

/**
 * Blood pressure (TA) sanitizer:
 * - Allows ONLY digits (0-9) and at most one `/` separator (e.g. `100/60`).
 * - Strips all letters and invalid characters.
 * - Keeps empty values completely blank `""` without injecting defaults.
 */
export function sanitizeBloodPressure(raw: string): string {
  if (!raw) return '';
  let result = '';
  let hasSlash = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '/' && !hasSlash && result.length > 0) {
      hasSlash = true;
      result += '/';
    }
  }

  return result;
}

/**
 * Returns true if the given laboratory parameter must accept ONLY numbers.
 */
export function isNumericLabTest(testName: string, category?: string): boolean {
  if (category && TEXT_ONLY_LAB_CATEGORIES.has(category)) return false;
  if (TEXT_ONLY_LAB_TEST_NAMES.has(testName)) return false;
  if (category && NUMERIC_ONLY_LAB_CATEGORIES.has(category)) return true;
  return NUMERIC_LAB_TEST_NAMES.has(testName);
}

/**
 * Returns true if the given laboratory parameter is the free-text Respiratory Panel.
 */
export function isRespiratoryPanelTest(testName: string, category?: string): boolean {
  return (
    (category ? TEXT_ONLY_LAB_CATEGORIES.has(category) : false) ||
    TEXT_ONLY_LAB_TEST_NAMES.has(testName)
  );
}

/**
 * Sanitizes any lab input according to its category and test name.
 */
export function sanitizeLabInputValue(
  testName: string,
  rawValue: string,
  category?: string
): string {
  if (!rawValue) return '';
  if (isNumericLabTest(testName, category)) {
    return sanitizeNumericDecimal(rawValue, SIGNED_NUMERIC_LAB_TEST_NAMES.has(testName));
  }
  return rawValue;
}

/**
 * Formats optional blood pressure (TA) display: if blank/empty, always returns `""`
 * so nothing is printed or displayed when the user leaves TA empty.
 */
export function normalizeOptionalTaDisplay(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return trimmed;
}
