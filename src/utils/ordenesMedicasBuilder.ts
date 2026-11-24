import { OrdenMedicaItem } from '../types';
import { sanitizeNumericDecimal } from './clinicalInputSanitizers';

export const HOSPITAL_AREA_OPTIONS = [
  'Traumashock',
  'Área de Observación',
  'Respiratorio',
  'Aislamiento',
  'Hospitalización',
  'Emergencia Pediátrica',
  'UCIP',
] as const;

export const DOSE_UNIT_OPTIONS = [
  'mg/kg/dosis',
  'mg/kg/día',
  'mg',
  'UI/kg/dosis',
  'UI',
  'ml/kg/dosis',
  'ml',
  'cc',
  'mcg/kg/dosis',
  'mcg',
  'gotas',
] as const;

export type DoseUnitOption = (typeof DOSE_UNIT_OPTIONS)[number];

export const DIET_OPTIONS = [
  'Dieta absoluta',
  'Lactancia Materna Exclusiva (LME)',
  'Con fórmula láctea',
  'Dieta mixta (LME + Fórmula)',
  'Dieta hipoglucídica',
  'Dieta hipoalergénica',
  'Dieta hiposódica',
  'Dieta líquida',
  'Dieta blanda',
  'Dieta completa acorde a la edad',
  'Dieta astringente',
  'Dieta hipercalórica / hiperproteica',
  'Otra dieta',
] as const;

export const POSITION_OPTIONS = [
  'Posición de Fowler (45°)',
  'Posición Semi-Fowler (30°)',
  'Posición Fowler alta (60°-90°)',
  'Decúbito dorsal (Supino)',
  'Decúbito lateral derecho',
  'Decúbito lateral izquierdo',
  'Decúbito prono (Ventral)',
  'Posición de Trendelenburg',
  'Posición Anti-Trendelenburg (Morestin)',
  'Posición de Sims',
  'Posición libre / Confort',
] as const;

export const OXYGEN_DEVICE_OPTIONS = [
  'Cánula nasal',
  'Mascarilla simple',
  'Mascarilla con reservorio',
  'Sistema Venturi',
  'CPAP',
  'Cánula de alto flujo (CNAF)',
  'Ventilación mecánica',
] as const;

export const MEDICATION_HOUR_OPTIONS = ['2', '4', '6', '8', '10', '12', '24'] as const;
export const NEBULIZATION_HOUR_OPTIONS = ['2', '4', '6', '8', '12', '24'] as const;

export const LAB_ORDER_PRESETS = [
  'Perfil 20',
  'Hematología Completa',
  'PCR cualitativa',
  'PCR cuantitativa',
  'VSG',
  'Electrolitos séricos',
  'Gases Arteriales (BT)',
  'Gases Venosos',
  'Química Sanguínea',
  'Perfil Hepático',
  'Perfil de Coagulación (TP, TPT)',
  'Examen de Orina',
  'Examen de Heces',
  'Hemocultivo',
  'Urocultivo',
  'Coprocultivo',
  'Panel Respiratorio',
  'Procalcitonina',
  'Grupo Sanguíneo y Rh',
] as const;

export const IMAGING_ORDER_PRESETS = [
  'Rx de tórax AP y L (BT)',
  'Rx de tórax AP',
  'Rx de abdomen simple',
  'Ecografía abdominal',
  'Ecografía pulmonar / pleural',
  'Ecografía renal y vías urinarias',
  'Ecocardiograma',
  'TAC de cráneo simple',
  'Rx de senos paranasales',
] as const;

export type MedicationHour = (typeof MEDICATION_HOUR_OPTIONS)[number];
export type NebulizationHour = (typeof NEBULIZATION_HOUR_OPTIONS)[number];

export interface MedicationOrderDraft {
  id: string;
  nombre: string;
  dosisCalculo: string;
  dosisNumero?: string;
  dosisUnidad?: string;
  cantidadMg: string;
  cantidadManualOverride?: boolean;
  unidad: 'mg' | 'mcg' | 'cc' | 'ml' | 'UI' | 'amp' | 'gotas';
  via: 'VEV' | 'VO' | 'IM' | 'SC';
  intervaloHoras: MedicationHour;
  esStat: boolean;
  soloStat: boolean;
}

export interface NebulizationDrugDraft {
  enabled: boolean;
  gotas: string;
  intervaloHoras: NebulizationHour;
}

export interface NebulizationOrderConfig {
  salbutamol: NebulizationDrugDraft;
  ipratropio: NebulizationDrugDraft;
  budesonida: NebulizationDrugDraft;
  hipertonicaEnabled: boolean;
  hipertonicaCc: string;
  hipertonicaHoras: NebulizationHour;
}

export interface HidratacionStructuredDraft {
  titulo: string;
  solucionBase: string;
  nacl20Ml: string;
  kclMl: string;
  gCalcio10Ml: string;
  mgso4Ml: string;
  viaRitmo: string;
}

export interface OrdenesMedicasBuilderState {
  areaIngreso: string;
  dietaTipo: string;
  dietaDetalle: string;
  posicion: string;
  oxigenoMode: 'no' | 'continuo' | 'sos';
  oxigenoHumedad: 'Húmedo' | 'Seco';
  oxigenoModalidad: string;
  oxigenoFlujo: string;
  monitorizacionContinua: boolean;
  requiereHidratacion: boolean;
  hidratacionDosisCalculo: string;
  hidratacion: HidratacionStructuredDraft;
  hidratacionTextoLibre: string;
  hidratacionUsarTextoLibre: boolean;
  requiereMedicamentos: boolean;
  medicamentos: MedicationOrderDraft[];
  requiereNebulizacion: boolean;
  nebulizacion: NebulizationOrderConfig;
  laboratoriosSeleccionados: string[];
  imagenologicosSeleccionados: string[];
  requiereBalanceHidrico: boolean;
}

export const createEmptyMedicationDraft = (): MedicationOrderDraft => ({
  id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  nombre: '',
  dosisCalculo: '',
  dosisNumero: '',
  dosisUnidad: 'mg/kg/dosis',
  cantidadMg: '',
  cantidadManualOverride: false,
  unidad: 'mg',
  via: 'VEV',
  intervaloHoras: '8',
  esStat: false,
  soloStat: false,
});

export function parseWeightKg(pesoStr: string): number | null {
  if (!pesoStr) return null;
  const cleaned = pesoStr.replace(',', '.');
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

export function composeDosisCalculo(dosisNumero?: string, dosisUnidad?: string): string {
  const num = (dosisNumero || '').trim();
  const unit = (dosisUnidad || '').trim();
  if (!num) return '';
  return unit ? `${num} ${unit}` : num;
}

export function inferQuantityUnitFromDoseUnit(
  dosisUnidad?: string
): MedicationOrderDraft['unidad'] {
  const u = (dosisUnidad || '').toLowerCase();
  if (u.startsWith('ui')) return 'UI';
  if (u.startsWith('mcg')) return 'mcg';
  if (u.startsWith('ml')) return 'ml';
  if (u === 'cc') return 'cc';
  if (u === 'gotas') return 'gotas';
  return 'mg';
}

export function calculateAutoMedicationQuantity(
  pesoStr: string,
  dosisNumero?: string,
  _dosisUnidad?: string
): string {
  const doseVal = parseFloat((dosisNumero || '').replace(',', '.'));
  if (!Number.isFinite(doseVal) || doseVal <= 0) return '';
  const weightKg = parseWeightKg(pesoStr);
  const result = weightKg !== null ? weightKg * doseVal : doseVal;
  if (!Number.isFinite(result)) return '';
  const rounded = Math.round(result * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function normalizeHospitalAreaLabel(area?: string): string {
  const raw = (area || '').trim();
  if (!raw) return 'Hospitalización';
  if (raw.toUpperCase() === 'ÁREA DE OBSERVACIÓN' || raw.toUpperCase() === 'AREA DE OBSERVACION') {
    return 'Área de Observación';
  }
  return raw;
}

const BUILDER_STORAGE_PREFIX = 'hmi_ordenes_builder_state_v1_';

export function saveOrdenesBuilderState(
  patientId: string,
  state: OrdenesMedicasBuilderState
): void {
  if (!patientId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${BUILDER_STORAGE_PREFIX}${patientId}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOrdenesBuilderState(
  patientId: string,
  fallbackArea: string
): OrdenesMedicasBuilderState {
  const base = createInitialBuilderState(normalizeHospitalAreaLabel(fallbackArea));
  if (!patientId || typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(`${BUILDER_STORAGE_PREFIX}${patientId}`);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<OrdenesMedicasBuilderState>;
    const mergedMeds =
      Array.isArray(parsed.medicamentos) && parsed.medicamentos.length > 0
        ? parsed.medicamentos.map(m => {
            const existingNum = m.dosisNumero;
            const existingUnit = m.dosisUnidad;
            let num = existingNum;
            let unit = existingUnit;
            if ((num === undefined || num === '') && m.dosisCalculo) {
              const match = m.dosisCalculo.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
              if (match) {
                num = match[1].replace(',', '.');
                unit = match[2]?.trim() || 'mg/kg/dosis';
              }
            }
            return {
              ...createEmptyMedicationDraft(),
              ...m,
              dosisNumero: num || '',
              dosisUnidad: unit || 'mg/kg/dosis',
            };
          })
        : base.medicamentos;
    return {
      ...base,
      ...parsed,
      hidratacion: {
        ...base.hidratacion,
        ...(parsed.hidratacion || {}),
      },
      nebulizacion: {
        ...base.nebulizacion,
        ...(parsed.nebulizacion || {}),
        salbutamol: {
          ...base.nebulizacion.salbutamol,
          ...(parsed.nebulizacion?.salbutamol || {}),
        },
        ipratropio: {
          ...base.nebulizacion.ipratropio,
          ...(parsed.nebulizacion?.ipratropio || {}),
        },
        budesonida: {
          ...base.nebulizacion.budesonida,
          ...(parsed.nebulizacion?.budesonida || {}),
        },
      },
      medicamentos: mergedMeds,
      laboratoriosSeleccionados: Array.isArray(parsed.laboratoriosSeleccionados)
        ? parsed.laboratoriosSeleccionados
        : base.laboratoriosSeleccionados,
      imagenologicosSeleccionados: Array.isArray(parsed.imagenologicosSeleccionados)
        ? parsed.imagenologicosSeleccionados
        : base.imagenologicosSeleccionados,
    };
  } catch {
    return base;
  }
}

export function formatHidratacionFromFields(h: HidratacionStructuredDraft): string {
  const lines: string[] = [];
  const titulo = h.titulo.trim() || 'HP Holiday Segar (Hidratación Parenteral)';
  lines.push(`${titulo.replace(/:+$/, '')}:`);

  if (h.solucionBase.trim()) {
    lines.push(h.solucionBase.trim());
  }

  const electrolytesLine: string[] = [];
  if (h.nacl20Ml.trim()) electrolytesLine.push(`NaCl 20%: ${h.nacl20Ml.trim()} ml`);
  if (h.kclMl.trim()) electrolytesLine.push(`KCl: ${h.kclMl.trim()} ml`);
  if (electrolytesLine.length > 0) {
    lines.push(electrolytesLine.join(' | '));
  }

  if (h.gCalcio10Ml.trim()) {
    lines.push(`G. Calcio 10%: ${h.gCalcio10Ml.trim()} ml`);
  }

  const mgPart = h.mgso4Ml.trim() ? `MgSO4: ${h.mgso4Ml.trim()} ml` : '';
  const viaPart = h.viaRitmo.trim();
  if (mgPart && viaPart) {
    lines.push(`${mgPart} → ${viaPart}`);
  } else if (mgPart) {
    lines.push(mgPart);
  } else if (viaPart) {
    lines.push(`→ ${viaPart}`);
  }

  return lines.join('\n');
}

export const HOLIDAY_SEGAR_EXAMPLE_DRAFT: HidratacionStructuredDraft = {
  titulo: 'HP Holiday Segar (Hidratación Parenteral)',
  solucionBase: 'Sol. Dextrosa 5%: 500 cc',
  nacl20Ml: '8',
  kclMl: '27.2',
  gCalcio10Ml: '20.4',
  mgso4Ml: '2.4',
  viaRitmo: 'VEV c/8h a 69 ml/h a 1.15 gotas/Min por BIC',
};

export function createInitialBuilderState(patientArea: string): OrdenesMedicasBuilderState {
  const cleanArea = normalizeHospitalAreaLabel(patientArea);
  const initialHidratacion: HidratacionStructuredDraft = {
    titulo: 'HP Holiday Segar (Hidratación Parenteral)',
    solucionBase: '',
    nacl20Ml: '',
    kclMl: '',
    gCalcio10Ml: '',
    mgso4Ml: '',
    viaRitmo: '',
  };

  return {
    areaIngreso: cleanArea,
    dietaTipo: 'Dieta absoluta',
    dietaDetalle: '',
    posicion: 'Posición de Fowler (45°)',
    oxigenoMode: 'no',
    oxigenoHumedad: 'Húmedo',
    oxigenoModalidad: 'Cánula nasal',
    oxigenoFlujo: '3',
    monitorizacionContinua: false,
    requiereHidratacion: false,
    hidratacionDosisCalculo: '',
    hidratacion: initialHidratacion,
    hidratacionTextoLibre: formatHidratacionFromFields(HOLIDAY_SEGAR_EXAMPLE_DRAFT),
    hidratacionUsarTextoLibre: false,
    requiereMedicamentos: false,
    medicamentos: [createEmptyMedicationDraft()],
    requiereNebulizacion: false,
    nebulizacion: {
      salbutamol: { enabled: false, gotas: '10', intervaloHoras: '4' },
      ipratropio: { enabled: false, gotas: '20', intervaloHoras: '6' },
      budesonida: { enabled: false, gotas: '10', intervaloHoras: '12' },
      hipertonicaEnabled: false,
      hipertonicaCc: '3',
      hipertonicaHoras: '6',
    },
    laboratoriosSeleccionados: [],
    imagenologicosSeleccionados: [],
    requiereBalanceHidrico: false,
  };
}

export function formatOxygenOrderLine(params: {
  mode: 'no' | 'continuo' | 'sos';
  humedad: 'Húmedo' | 'Seco';
  modalidad: string;
  flujo: string;
}): string | null {
  if (params.mode === 'no') return null;
  const humedadStr = params.humedad === 'Seco' ? 'seco' : 'húmedo';
  const modalidadStr = (params.modalidad || 'cánula nasal').trim().toLowerCase();
  const cleanFlujo = sanitizeNumericDecimal(params.flujo || '') || '3';
  const base = `Oxígeno ${humedadStr} por ${modalidadStr} a ${cleanFlujo} litros por minuto`;
  if (params.mode === 'sos') {
    return `${base} SOS SpO2 < 93%`;
  }
  return `${base} continuo`;
}

export function formatMedicationOrderLine(med: MedicationOrderDraft): string | null {
  const nombre = med.nombre.trim();
  if (!nombre) return null;

  const qty = med.cantidadMg.trim();
  const qtySegment = qty ? ` ${qty} ${med.unidad}` : '';
  const viaSegment = ` ${med.via}`;

  let scheduleSegment = '';
  if (med.esStat) {
    scheduleSegment = med.soloStat ? ' STAT' : ` STAT y luego c/${med.intervaloHoras}h`;
  } else {
    scheduleSegment = ` c/${med.intervaloHoras}h`;
  }

  return `${nombre}${qtySegment}${viaSegment}${scheduleSegment}`.trim();
}

export function formatNebulizationOrderLine(config: NebulizationOrderConfig): string | null {
  const entries: string[] = [];

  if (config.salbutamol.enabled) {
    const gotas = sanitizeNumericDecimal(config.salbutamol.gotas) || '10';
    entries.push(
      `Salbutamol ${gotas} gotas diluido en 3cc de Sol. 0.9% c/${config.salbutamol.intervaloHoras}h`
    );
  }

  if (config.ipratropio.enabled) {
    const gotas = sanitizeNumericDecimal(config.ipratropio.gotas) || '20';
    entries.push(
      `Bromuro de Ipratropio ${gotas} gotas diluido en 3cc de Sol. 0.9% c/${config.ipratropio.intervaloHoras}h`
    );
  }

  if (config.budesonida.enabled) {
    const gotas = sanitizeNumericDecimal(config.budesonida.gotas) || '10';
    entries.push(
      `Budesonida ${gotas} gotas diluido en 3cc de Sol. 0.9% c/${config.budesonida.intervaloHoras}h`
    );
  }

  if (config.hipertonicaEnabled) {
    const cc = sanitizeNumericDecimal(config.hipertonicaCc) || '3';
    entries.push(`Solución Hipertónica 3% ${cc}cc c/${config.hipertonicaHoras}h`);
  }

  if (entries.length === 0) return null;
  if (entries.length === 1) return `Nebulización (NBT): ${entries[0]}`;
  return `Nebulización (NBT):\n• ${entries.join('\n• ')}`;
}

/**
 * Pure builder converting the guided medical orders form into numbered
 * official OrdenMedicaItem[] rows ready to persist on the patient record.
 */
export function buildOrdenesMedicasItems(state: OrdenesMedicasBuilderState): OrdenMedicaItem[] {
  const rows: { dosisCalculo: string; descripcion: string }[] = [];

  // 1. Área de ingreso
  const area = state.areaIngreso.trim() || 'Hospitalización';
  rows.push({
    dosisCalculo: '',
    descripcion: `Ingresar paciente en ${area}`,
  });

  // 2. Dieta
  if (state.dietaTipo) {
    const detail = state.dietaDetalle.trim();
    const dietaDesc =
      state.dietaTipo === 'Otra dieta'
        ? detail
          ? `Dieta: ${detail}`
          : 'Dieta acorde a indicación médica'
        : detail
        ? `${state.dietaTipo} (${detail})`
        : state.dietaTipo;
    rows.push({
      dosisCalculo: '',
      descripcion: dietaDesc,
    });
  }

  // 3. Posición
  if (state.posicion.trim()) {
    rows.push({
      dosisCalculo: '',
      descripcion: state.posicion.trim(),
    });
  }

  // 4. Oxígeno (continuo o SOS)
  const o2Line = formatOxygenOrderLine({
    mode: state.oxigenoMode,
    humedad: state.oxigenoHumedad,
    modalidad: state.oxigenoModalidad,
    flujo: state.oxigenoFlujo,
  });
  if (o2Line) {
    rows.push({
      dosisCalculo: '',
      descripcion: o2Line,
    });
  }

  // 5. Monitorización continua
  if (state.monitorizacionContinua) {
    rows.push({
      dosisCalculo: '',
      descripcion: 'Monitorización continua',
    });
  }

  // 6. Hidratación Parenteral (HP)
  if (state.requiereHidratacion) {
    const hpText = state.hidratacionUsarTextoLibre
      ? state.hidratacionTextoLibre.trim()
      : formatHidratacionFromFields(state.hidratacion).trim();
    if (hpText) {
      rows.push({
        dosisCalculo: state.hidratacionDosisCalculo.trim(),
        descripcion: hpText,
      });
    }
  }

  // 7. Medicamentos
  if (state.requiereMedicamentos) {
    state.medicamentos.forEach(med => {
      const formatted = formatMedicationOrderLine(med);
      if (formatted) {
        const composedDose = composeDosisCalculo(med.dosisNumero, med.dosisUnidad);
        rows.push({
          dosisCalculo: (composedDose || med.dosisCalculo || '').trim(),
          descripcion: formatted,
        });
      }
    });
  }

  // 8. Nebulización (NBT)
  if (state.requiereNebulizacion) {
    const nbtLine = formatNebulizationOrderLine(state.nebulizacion);
    if (nbtLine) {
      rows.push({
        dosisCalculo: '',
        descripcion: nbtLine,
      });
    }
  }

  // 9. Laboratorios
  if (state.laboratoriosSeleccionados.length > 0) {
    rows.push({
      dosisCalculo: '',
      descripcion: `Laboratorios: ${state.laboratoriosSeleccionados.join(', ')}`,
    });
  }

  // 10. Imagenológicos
  if (state.imagenologicosSeleccionados.length > 0) {
    rows.push({
      dosisCalculo: '',
      descripcion: `Imagenológicos: ${state.imagenologicosSeleccionados.join(', ')}`,
    });
  }

  // 11. Balance Hídrico
  if (state.requiereBalanceHidrico) {
    rows.push({
      dosisCalculo: '',
      descripcion: 'Balance Hídrico: Control estricto de ingresos y egresos',
    });
  }

  const stamp = Date.now();
  return rows.map((row, idx) => ({
    id: `ord-${stamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    dosisCalculo: row.dosisCalculo,
    itemNumber: idx + 1,
    descripcion: row.descripcion,
  }));
}
