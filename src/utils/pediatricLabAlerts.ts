import { Patient, HistoriaClinicaPediatrica } from '../types';

export interface LabReferenceConfig {
  name: string;
  category: 'Hematología' | 'Química Sanguínea' | 'Electrolitos' | 'Gasometría & Otros' | 'Coagulación' | 'Perfil Lipídico';
  unit: string;
  min: number;
  max: number;
  criticalMin?: number;
  criticalMax?: number;
  normalValText: string;
  referenceText: string;
  lowAlert: string;
  highAlert: string;
  criticalLowAlert?: string;
  criticalHighAlert?: string;
}

export interface LabAlertItem {
  id: string;
  sampleDate: string;
  sampleColumnIdx: number;
  testName: string;
  category: string;
  currentValue: number;
  currentValueText: string;
  unit: string;
  referenceRangeText: string;
  status: 'low' | 'high' | 'critical_low' | 'critical_high';
  severity: 'warning' | 'critical';
  alertTitle: string;
  recommendation?: string;
}

// Complete pediatric reference standards matching user request
export const PEDIATRIC_LAB_CONFIGS: Record<string, LabReferenceConfig> = {
  'LEUCOCITOS': {
    name: 'LEUCOCITOS',
    category: 'Hematología',
    unit: '10³/µL',
    min: 4.8,
    max: 10.8,
    criticalMin: 3.0,
    criticalMax: 25.0,
    normalValText: '7.5',
    referenceText: '4.8 - 10.8',
    lowAlert: 'Leucopenia',
    highAlert: 'Leucocitosis',
    criticalLowAlert: 'Leucopenia Severa',
    criticalHighAlert: 'Leucocitosis Severa'
  },
  'GLÓBULOS BLANCOS': {
    name: 'GLÓBULOS BLANCOS',
    category: 'Hematología',
    unit: '10³/µL',
    min: 4.8,
    max: 10.8,
    criticalMin: 3.0,
    criticalMax: 25.0,
    normalValText: '7.5',
    referenceText: '4.8 - 10.8',
    lowAlert: 'Leucopenia',
    highAlert: 'Leucocitosis'
  },
  'NEUTROFILOS %': {
    name: 'NEUTROFILOS %',
    category: 'Hematología',
    unit: '%',
    min: 39.3,
    max: 73.7,
    normalValText: '55',
    referenceText: '39.3 - 73.7',
    lowAlert: 'Neutropenia',
    highAlert: 'Neutrofilia'
  },
  'LINFOCITOS %': {
    name: 'LINFOCITOS %',
    category: 'Hematología',
    unit: '%',
    min: 18.0,
    max: 48.3,
    normalValText: '32',
    referenceText: '18 - 48.3',
    lowAlert: 'Linfopenia',
    highAlert: 'Linfocitosis'
  },
  'MONOSITOS %': {
    name: 'MONOSITOS %',
    category: 'Hematología',
    unit: '%',
    min: 4.40,
    max: 12.7,
    normalValText: '8.0',
    referenceText: '4.40 - 12.7',
    lowAlert: 'Monocitopenia',
    highAlert: 'Monocitosis'
  },
  'EOSINOFILOS %': {
    name: 'EOSINOFILOS %',
    category: 'Hematología',
    unit: '%',
    min: 0.6,
    max: 7.30,
    normalValText: '3.0',
    referenceText: '0,6 - 7.30',
    lowAlert: 'Eosinopenia',
    highAlert: 'Eosinofilia'
  },
  'BASOFILOS %': {
    name: 'BASOFILOS %',
    category: 'Hematología',
    unit: '%',
    min: 0.2,
    max: 1.0,
    normalValText: '0.5',
    referenceText: '0,2 - 1,0',
    lowAlert: 'Basopenia',
    highAlert: 'Basofilia'
  },
  'PLAQUETAS': {
    name: 'PLAQUETAS',
    category: 'Hematología',
    unit: '10³/µL',
    min: 155,
    max: 366,
    criticalMin: 50,
    criticalMax: 700,
    normalValText: '250',
    referenceText: '155 - 366',
    lowAlert: 'Trombocitopenia',
    highAlert: 'Trombocitosis',
    criticalLowAlert: 'Trombocitopenia Severa',
    criticalHighAlert: 'Trombocitosis Severa'
  },
  'HEMOGLOBINA': {
    name: 'HEMOGLOBINA',
    category: 'Hematología',
    unit: 'g/dL',
    min: 12.9,
    max: 14.2,
    criticalMin: 7.5,
    criticalMax: 18.0,
    normalValText: '13.5',
    referenceText: '12.9 - 14.2 / RN 14 - 20',
    lowAlert: 'Anemia',
    highAlert: 'Policitemia',
    criticalLowAlert: 'Anemia Severa'
  },
  'HEMATOCRITO': {
    name: 'HEMATOCRITO',
    category: 'Hematología',
    unit: '%',
    min: 37.7,
    max: 53.3,
    criticalMin: 22.0,
    criticalMax: 60.0,
    normalValText: '42',
    referenceText: '37.7 - 53.3 / RN 43 - 63',
    lowAlert: 'Hematocrito Bajo',
    highAlert: 'Hemoconcentración'
  },
  'PCR': {
    name: 'PCR',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 0.0,
    max: 0.5,
    criticalMax: 5.0,
    normalValText: '0.2',
    referenceText: '0,0 - 0,5',
    lowAlert: 'Normal',
    highAlert: 'PCR Elevada (Proceso Inflamatorio / Infeccioso)',
    criticalHighAlert: 'PCR Muy Elevada (Infección Severa)'
  },
  'VAS': {
    name: 'VAS',
    category: 'Gasometría & Otros',
    unit: '',
    min: 0,
    max: 100,
    normalValText: '0',
    referenceText: 'VAS',
    lowAlert: 'Normal',
    highAlert: 'Alterado'
  },
  'PT': {
    name: 'PT',
    category: 'Coagulación',
    unit: 'seg',
    min: 10.6,
    max: 14.6,
    criticalMax: 20.0,
    normalValText: '12.0',
    referenceText: '10,6 – 14,6',
    lowAlert: 'PT Acortado',
    highAlert: 'PT Prolongado (Riesgo de Sangrado)'
  },
  'PTT': {
    name: 'PTT',
    category: 'Coagulación',
    unit: 'seg',
    min: 22.8,
    max: 34.8,
    criticalMax: 50.0,
    normalValText: '28.0',
    referenceText: '22,8 – 34,8',
    lowAlert: 'PTT Acortado',
    highAlert: 'PTT Prolongado'
  },
  'FIBRINÓGENO': {
    name: 'FIBRINÓGENO',
    category: 'Coagulación',
    unit: 'mg/dL',
    min: 200,
    max: 400,
    criticalMin: 100,
    normalValText: '300',
    referenceText: 'Fibrinógeno',
    lowAlert: 'Hipofibrinogenemia',
    highAlert: 'Hiperfibrinogenemia'
  },
  'GLICEMIA': {
    name: 'GLICEMIA',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 70,
    max: 110,
    criticalMin: 55,
    criticalMax: 200,
    normalValText: '88',
    referenceText: '70 - 110',
    lowAlert: 'Hipoglicemia',
    highAlert: 'Hiperglicemia',
    criticalLowAlert: 'Hipoglicemia Crítica'
  },
  'BUN': {
    name: 'BUN',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 15,
    max: 38,
    criticalMax: 60,
    normalValText: '22',
    referenceText: '15 - 38',
    lowAlert: 'BUN Bajo',
    highAlert: 'BUN Elevado (Azotemia)'
  },
  'CREATININA': {
    name: 'CREATININA',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 0.70,
    max: 1.50,
    criticalMax: 2.2,
    normalValText: '0.90',
    referenceText: '0,70 – 1,50',
    lowAlert: 'Baja',
    highAlert: 'Creatinina Elevada (Injuria Renal)'
  },
  'ACIDO URICO': {
    name: 'ACIDO URICO',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 2.0,
    max: 6.0,
    normalValText: '4.0',
    referenceText: 'Ácido Úrico',
    lowAlert: 'Hipouricemia',
    highAlert: 'Hiperuricemia'
  },
  'AMILASA': {
    name: 'AMILASA',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 30,
    max: 110,
    criticalMax: 300,
    normalValText: '60',
    referenceText: 'Amilasa',
    lowAlert: 'Baja',
    highAlert: 'Amilasa Elevada (Pancreatitis)'
  },
  'LIPASA': {
    name: 'LIPASA',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 10,
    max: 140,
    criticalMax: 400,
    normalValText: '40',
    referenceText: 'Lipasa',
    lowAlert: 'Baja',
    highAlert: 'Lipasa Elevada (Pancreatitis)'
  },
  'SODIO': {
    name: 'SODIO',
    category: 'Electrolitos',
    unit: 'mEq/L',
    min: 135,
    max: 145,
    criticalMin: 125,
    criticalMax: 155,
    normalValText: '139',
    referenceText: '135 - 145',
    lowAlert: 'Hiponatremia',
    highAlert: 'Hipernatremia',
    criticalLowAlert: 'Hiponatremia Severa'
  },
  'POTASIO': {
    name: 'POTASIO',
    category: 'Electrolitos',
    unit: 'mEq/L',
    min: 3.5,
    max: 5.0,
    criticalMin: 2.8,
    criticalMax: 6.2,
    normalValText: '4.2',
    referenceText: '3,5 – 5,0',
    lowAlert: 'Hipopotasemia',
    highAlert: 'Hiperpotasemia',
    criticalLowAlert: 'Hipopotasemia Crítica'
  },
  'CLORO': {
    name: 'CLORO',
    category: 'Electrolitos',
    unit: 'mEq/L',
    min: 95,
    max: 110,
    criticalMin: 85,
    criticalMax: 120,
    normalValText: '102',
    referenceText: '95 - 110',
    lowAlert: 'Hipocloremia',
    highAlert: 'Hipercloremia'
  },
  'CALCIO': {
    name: 'CALCIO',
    category: 'Electrolitos',
    unit: 'mg/dL',
    min: 8.1,
    max: 10.2,
    criticalMin: 7.0,
    criticalMax: 12.0,
    normalValText: '9.2',
    referenceText: '8,1 – 10,2',
    lowAlert: 'Hipocalcemia',
    highAlert: 'Hipercalcemia'
  },
  'FOSFORO': {
    name: 'FOSFORO',
    category: 'Electrolitos',
    unit: 'mg/dL',
    min: 2.5,
    max: 5.0,
    normalValText: '3.8',
    referenceText: '2,5 – 5,0',
    lowAlert: 'Hipofosfatemia',
    highAlert: 'Hiperfosfatemia'
  },
  'MAGNESIO': {
    name: 'MAGNESIO',
    category: 'Electrolitos',
    unit: 'mg/dL',
    min: 1.3,
    max: 2.5,
    criticalMin: 1.0,
    normalValText: '1.9',
    referenceText: '1,3-2,5',
    lowAlert: 'Hipomagnesemia',
    highAlert: 'Hipermagnesemia'
  },
  'DESHIDROGENASA LACTICA': {
    name: 'DESHIDROGENASA LACTICA',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 140,
    max: 271,
    criticalMax: 500,
    normalValText: '200',
    referenceText: '140 - 271',
    lowAlert: 'Baja',
    highAlert: 'LDH Elevada'
  },
  'PROTEÍNAS TOTALES': {
    name: 'PROTEÍNAS TOTALES',
    category: 'Química Sanguínea',
    unit: 'g/dL',
    min: 6.4,
    max: 8.9,
    normalValText: '7.2',
    referenceText: '6,4 – 8,9',
    lowAlert: 'Hipoproteinemia',
    highAlert: 'Hiperproteinemia'
  },
  'ALBÚMINA': {
    name: 'ALBÚMINA',
    category: 'Química Sanguínea',
    unit: 'g/dL',
    min: 3.5,
    max: 5.7,
    criticalMin: 2.5,
    normalValText: '4.2',
    referenceText: '3,5 – 5,7',
    lowAlert: 'Hipoalbuminemia',
    highAlert: 'Hiperalbuminemia'
  },
  'GLOBULINAS': {
    name: 'GLOBULINAS',
    category: 'Química Sanguínea',
    unit: 'g/dL',
    min: 2.5,
    max: 4.8,
    normalValText: '3.0',
    referenceText: '2,5 – 4,8',
    lowAlert: 'Bajas',
    highAlert: 'Elevadas'
  },
  'ALB/GLOB': {
    name: 'ALB/GLOB',
    category: 'Química Sanguínea',
    unit: '',
    min: 1.0,
    max: 2.20,
    normalValText: '1.4',
    referenceText: '1,0 – 2, 20',
    lowAlert: 'Invertida',
    highAlert: 'Elevada'
  },
  'BILIRRUBINA TOTAL': {
    name: 'BILIRRUBINA TOTAL',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 0.10,
    max: 1.50,
    criticalMax: 5.0,
    normalValText: '0.8',
    referenceText: '0,10 – 1,50 RN 1-6',
    lowAlert: 'Normal',
    highAlert: 'Hiperbilirrubinemia'
  },
  'BILIRRUBINA DIRECTA': {
    name: 'BILIRRUBINA DIRECTA',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 0.05,
    max: 0.30,
    normalValText: '0.15',
    referenceText: '0,05 – 0,30',
    lowAlert: 'Normal',
    highAlert: 'Directa Elevada'
  },
  'BILIRRUBINA INDIRECTA': {
    name: 'BILIRRUBINA INDIRECTA',
    category: 'Química Sanguínea',
    unit: 'mg/dL',
    min: 0.05,
    max: 1.25,
    normalValText: '0.5',
    referenceText: '0,05 – 1,25',
    lowAlert: 'Normal',
    highAlert: 'Indirecta Elevada'
  },
  'TGO': {
    name: 'TGO',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 13,
    max: 39,
    criticalMax: 150,
    normalValText: '24',
    referenceText: '13 - 39',
    lowAlert: 'Normal',
    highAlert: 'TGO Elevada'
  },
  'TGP': {
    name: 'TGP',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 7,
    max: 52,
    criticalMax: 150,
    normalValText: '25',
    referenceText: '7 - 52',
    lowAlert: 'Normal',
    highAlert: 'TGP Elevada'
  },
  'LDH Colesterol': {
    name: 'LDH Colesterol',
    category: 'Perfil Lipídico',
    unit: 'mg/dL',
    min: 30,
    max: 85,
    normalValText: '50',
    referenceText: '30 - 85',
    lowAlert: 'Bajo',
    highAlert: 'Elevado'
  },
  'LDL Colesterol': {
    name: 'LDL Colesterol',
    category: 'Perfil Lipídico',
    unit: 'mg/dL',
    min: 36,
    max: 178,
    normalValText: '90',
    referenceText: '36 - 178',
    lowAlert: 'Bajo',
    highAlert: 'LDL Elevado'
  },
  'VLDL': {
    name: 'VLDL',
    category: 'Perfil Lipídico',
    unit: 'mg/dL',
    min: 25,
    max: 125,
    normalValText: '60',
    referenceText: '25 - 125',
    lowAlert: 'Bajo',
    highAlert: 'VLDL Elevado'
  },
  'COLESTEROL': {
    name: 'COLESTEROL',
    category: 'Perfil Lipídico',
    unit: 'mg/dL',
    min: 0,
    max: 200,
    criticalMax: 240,
    normalValText: '150',
    referenceText: '0 – 200',
    lowAlert: 'Bajo',
    highAlert: 'Colesterol Elevado'
  },
  'TRIGLICÉRIDOS': {
    name: 'TRIGLICÉRIDOS',
    category: 'Perfil Lipídico',
    unit: 'mg/dL',
    min: 36,
    max: 165,
    criticalMax: 300,
    normalValText: '90',
    referenceText: '36 - 165',
    lowAlert: 'Bajo',
    highAlert: 'Triglicéridos Elevados'
  },
  'CK': {
    name: 'CK',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 20,
    max: 200,
    criticalMax: 500,
    normalValText: '80',
    referenceText: 'CK',
    lowAlert: 'Baja',
    highAlert: 'CK Elevada'
  },
  'CK-MB': {
    name: 'CK-MB',
    category: 'Química Sanguínea',
    unit: 'U/L',
    min: 0,
    max: 25,
    criticalMax: 50,
    normalValText: '10',
    referenceText: 'CK-MB',
    lowAlert: 'Normal',
    highAlert: 'CK-MB Elevada'
  },
  'Ph': {
    name: 'Ph',
    category: 'Gasometría & Otros',
    unit: 'pH',
    min: 7.35,
    max: 7.45,
    criticalMin: 7.20,
    criticalMax: 7.55,
    normalValText: '7.40',
    referenceText: '7,35 – 7,45',
    lowAlert: 'Acidosis',
    highAlert: 'Alcalosis',
    criticalLowAlert: 'Acidemia Severa'
  },
  'pCO2': {
    name: 'pCO2',
    category: 'Gasometría & Otros',
    unit: 'mmHg',
    min: 32.0,
    max: 48.0,
    criticalMin: 20,
    criticalMax: 65,
    normalValText: '40.0',
    referenceText: '32,0 – 48,0 RN 35- 45',
    lowAlert: 'Hipocapnia',
    highAlert: 'Hipercapnia'
  },
  'PO2': {
    name: 'PO2',
    category: 'Gasometría & Otros',
    unit: 'mmHg',
    min: 83.0,
    max: 108,
    criticalMin: 60,
    normalValText: '95',
    referenceText: '83,0 – 108 RN 50 - 90',
    lowAlert: 'Hipoxemia',
    highAlert: 'Hiperoxia'
  },
  'HCO3': {
    name: 'HCO3',
    category: 'Gasometría & Otros',
    unit: 'mEq/L',
    min: 21,
    max: 28,
    criticalMin: 14,
    criticalMax: 36,
    normalValText: '24',
    referenceText: '21 - 28',
    lowAlert: 'Bicarbonato Bajo',
    highAlert: 'Bicarbonato Elevado'
  },
  'E. BASE': {
    name: 'E. BASE',
    category: 'Gasometría & Otros',
    unit: 'mEq/L',
    min: -3.0,
    max: 3.0,
    criticalMin: -8.0,
    criticalMax: 8.0,
    normalValText: '0.0',
    referenceText: '-3,0 – 3.0',
    lowAlert: 'Exceso de Base Negativo (Acidosis)',
    highAlert: 'Exceso de Base Positivo (Alcalosis)'
  },
  'NA (Gasometría)': {
    name: 'NA (Gasometría)',
    category: 'Electrolitos',
    unit: 'mEq/L',
    min: 135,
    max: 145,
    normalValText: '139',
    referenceText: '135 145',
    lowAlert: 'Hiponatremia',
    highAlert: 'Hipernatremia'
  },
  'K (gasometría)': {
    name: 'K (gasometría)',
    category: 'Electrolitos',
    unit: 'mEq/L',
    min: 3.5,
    max: 5,
    normalValText: '4.2',
    referenceText: '3,5 - 5',
    lowAlert: 'Hipopotasemia',
    highAlert: 'Hiperpotasemia'
  },
  'Ca++': {
    name: 'Ca++',
    category: 'Electrolitos',
    unit: 'mmol/L',
    min: 1.15,
    max: 1.29,
    normalValText: '1.22',
    referenceText: '1.15 – 1,29',
    lowAlert: 'Hipocalcemia iónica',
    highAlert: 'Hipercalcemia iónica'
  },
  'FIO2': {
    name: 'FIO2',
    category: 'Gasometría & Otros',
    unit: '%',
    min: 21,
    max: 100,
    normalValText: '21',
    referenceText: 'FIO2',
    lowAlert: 'Normal',
    highAlert: 'Elevado'
  }
};

export function parseLabNumber(valStr: string | undefined): number | null {
  if (!valStr || typeof valStr !== 'string') return null;
  const clean = valStr.trim().replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!clean || clean === '.' || clean === '-') return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

export function evaluateLabValue(testName: string, rawValue: string): {
  isAlert: boolean;
  status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  severity: 'normal' | 'warning' | 'critical';
  alertTitle: string;
  config: LabReferenceConfig | null;
} {
  const normKey = Object.keys(PEDIATRIC_LAB_CONFIGS).find(
    k => k.toLowerCase() === testName.toLowerCase() ||
         k.replace(/\s/g, '').toLowerCase() === testName.replace(/\s/g, '').toLowerCase()
  );

  if (!normKey) {
    return { isAlert: false, status: 'normal', severity: 'normal', alertTitle: '', config: null };
  }

  const config = PEDIATRIC_LAB_CONFIGS[normKey];
  const num = parseLabNumber(rawValue);

  if (num === null) {
    return { isAlert: false, status: 'normal', severity: 'normal', alertTitle: '', config };
  }

  if (config.criticalLowAlert && config.criticalMin !== undefined && num < config.criticalMin) {
    return {
      isAlert: true,
      status: 'critical_low',
      severity: 'critical',
      alertTitle: config.criticalLowAlert,
      config
    };
  }

  if (config.criticalHighAlert && config.criticalMax !== undefined && num > config.criticalMax) {
    return {
      isAlert: true,
      status: 'critical_high',
      severity: 'critical',
      alertTitle: config.criticalHighAlert,
      config
    };
  }

  if (num < config.min) {
    return {
      isAlert: true,
      status: 'low',
      severity: 'warning',
      alertTitle: config.lowAlert,
      config
    };
  }

  if (num > config.max) {
    return {
      isAlert: true,
      status: 'high',
      severity: 'warning',
      alertTitle: config.highAlert,
      config
    };
  }

  return { isAlert: false, status: 'normal', severity: 'normal', alertTitle: 'Dentro de rango', config };
}

export function getPatientLabAlerts(
  patient: Patient,
  historia?: HistoriaClinicaPediatrica
): LabAlertItem[] {
  const alerts: LabAlertItem[] = [];
  const labCols = historia?.laboratoriosColumnas || [];

  labCols.forEach((col, colIdx) => {
    if (!col || !col.valores) return;
    const colDate = col.fecha || `Muestra ${colIdx + 1}`;

    Object.entries(col.valores).forEach(([testName, valStr]) => {
      if (!valStr || !valStr.trim()) return;

      const evalRes = evaluateLabValue(testName, valStr);
      if (evalRes.isAlert && evalRes.config) {
        const numVal = parseLabNumber(valStr) || 0;
        alerts.push({
          id: `alert-${colIdx}-${testName}`,
          sampleDate: colDate,
          sampleColumnIdx: colIdx + 1,
          testName: evalRes.config.name,
          category: evalRes.config.category,
          currentValue: numVal,
          currentValueText: valStr.trim(),
          unit: evalRes.config.unit,
          referenceRangeText: evalRes.config.referenceText,
          status: evalRes.status as 'low' | 'high' | 'critical_low' | 'critical_high',
          severity: evalRes.severity as 'warning' | 'critical',
          alertTitle: evalRes.alertTitle,
          recommendation: evalRes.severity === 'critical'
            ? '⚠️ Requiere valoración y conducta médica inmediata'
            : 'Evaluar en contexto clínico y contrastar con controles previos'
        });
      }
    });
  });

  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.sampleColumnIdx - a.sampleColumnIdx;
  });
}
