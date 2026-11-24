import { MedicalEvolution, OrdenMedicaItem, Patient } from '../types';
import { OFFICIAL_DEFAULT_ORDERS } from '../components/OrdenesMedicasDocument';

export interface CalendarDayCell {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  evolutions: MedicalEvolution[];
  hasOrders: boolean;
  ordersCount: number;
  isAdmissionDate: boolean;
  isReingresoDate: boolean;
  isDischargeDate: boolean;
}

export interface MonthOption {
  monthKey: string; // YYYY-MM
  year: number;
  monthIndex: number; // 0..11
  label: string; // e.g. "Noviembre 2026"
  shortLabel: string; // e.g. "NOV 2026"
  evolutionsCount: number;
}

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const SPANISH_MONTHS_SHORT = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

const SPANISH_WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function formatEvolutionSpanishDate(dateStr?: string): {
  dayNum: string;
  monthShort: string;
  monthFull: string;
  year: string;
  weekdayShort: string;
  fullFormatted: string;
} {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      dayNum: '--',
      monthShort: 'FECHA',
      monthFull: 'Fecha',
      year: '----',
      weekdayShort: '',
      fullFormatted: dateStr || 'Sin fecha',
    };
  }
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
  const day = parseInt(dStr, 10);
  const utcDate = new Date(Date.UTC(year, monthIdx, day));
  const weekdayShort = SPANISH_WEEKDAYS_SHORT[utcDate.getUTCDay()] || '';

  return {
    dayNum: dStr,
    monthShort: SPANISH_MONTHS_SHORT[monthIdx],
    monthFull: SPANISH_MONTHS[monthIdx],
    year: yStr,
    weekdayShort,
    fullFormatted: `${weekdayShort} ${day} de ${SPANISH_MONTHS[monthIdx]} ${yStr}`,
  };
}

export function computeHospitalizationDayNumber(
  evolutionDate?: string,
  referenceAdmissionDate?: string
): number | null {
  if (
    !evolutionDate ||
    !referenceAdmissionDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(evolutionDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(referenceAdmissionDate)
  ) {
    return null;
  }
  const [ey, em, ed] = evolutionDate.split('-').map(Number);
  const [ay, am, ad] = referenceAdmissionDate.split('-').map(Number);
  const evMs = Date.UTC(ey, em - 1, ed);
  const admMs = Date.UTC(ay, am - 1, ad);
  const diffDays = Math.floor((evMs - admMs) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays + 1 : null;
}

export function resolveOrdersForEvolution(
  patient: Patient,
  evolution: MedicalEvolution
): {
  orders: OrdenMedicaItem[];
  source: 'evolution' | 'patient' | 'standard';
  fecha: string;
  hora: string;
  peso: string;
} {
  const fecha = evolution.ordenesFecha || evolution.date || patient.ordenesFecha || patient.admissionDate || '';
  const hora = evolution.ordenesHora || evolution.time || patient.ordenesHora || '08:00';
  const peso =
    evolution.ordenesPeso ||
    evolution.vitalSigns?.peso ||
    patient.ordenesPeso ||
    (patient.weightKg ? `${patient.weightKg}` : '');

  if (Array.isArray(evolution.ordenesMedicas) && evolution.ordenesMedicas.length > 0) {
    return {
      orders: evolution.ordenesMedicas,
      source: 'evolution',
      fecha,
      hora,
      peso,
    };
  }

  if (Array.isArray(patient.ordenesMedicas) && patient.ordenesMedicas.length > 0) {
    return {
      orders: patient.ordenesMedicas,
      source: 'patient',
      fecha,
      hora,
      peso,
    };
  }

  return {
    orders: OFFICIAL_DEFAULT_ORDERS,
    source: 'standard',
    fecha,
    hora,
    peso,
  };
}

export function getAvailableEvolutionMonths(patient: Patient): MonthOption[] {
  const countsByMonth = new Map<string, number>();

  for (const ev of patient.evolutions || []) {
    if (ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
      const monthKey = ev.date.slice(0, 7);
      countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + 1);
    }
  }

  if (patient.admissionDate && /^\d{4}-\d{2}-\d{2}$/.test(patient.admissionDate)) {
    const admMonth = patient.admissionDate.slice(0, 7);
    if (!countsByMonth.has(admMonth)) {
      countsByMonth.set(admMonth, 0);
    }
  }

  if (countsByMonth.size === 0) {
    const now = new Date();
    const fallbackKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    countsByMonth.set(fallbackKey, 0);
  }

  return Array.from(countsByMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, count]) => {
      const [yStr, mStr] = monthKey.split('-');
      const year = parseInt(yStr, 10);
      const monthIndex = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
      return {
        monthKey,
        year,
        monthIndex,
        label: `${SPANISH_MONTHS[monthIndex]} ${year}`,
        shortLabel: `${SPANISH_MONTHS_SHORT[monthIndex]} ${year}`,
        evolutionsCount: count,
      };
    });
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const monthIdx = (parseInt(mStr, 10) || 1) - 1;
  const d = new Date(Date.UTC(year, monthIdx + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthCalendarGrid(monthKey: string, patient: Patient): CalendarDayCell[] {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const monthIndex = Math.max(0, Math.min(11, (parseInt(mStr, 10) || 1) - 1));

  const evolutionsByDate = new Map<string, MedicalEvolution[]>();
  for (const ev of patient.evolutions || []) {
    if (!ev.date) continue;
    const list = evolutionsByDate.get(ev.date) || [];
    list.push(ev);
    evolutionsByDate.set(ev.date, list);
  }

  const reingresoDates = new Set<string>();
  if (patient.lastReadmissionDate) reingresoDates.add(patient.lastReadmissionDate);
  for (const r of patient.readmissions || []) {
    if (r.date) reingresoDates.add(r.date);
  }

  // First day of month in UTC
  const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6 offset
  const mondayFirstOffset = (firstDayUtc.getUTCDay() + 6) % 7;

  const startUtc = new Date(Date.UTC(year, monthIndex, 1 - mondayFirstOffset));
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(
      Date.UTC(startUtc.getUTCFullYear(), startUtc.getUTCMonth(), startUtc.getUTCDate() + i)
    );
    const cy = cellDate.getUTCFullYear();
    const cm = cellDate.getUTCMonth();
    const cd = cellDate.getUTCDate();
    const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(cd).padStart(2, '0')}`;
    const dayEvs = evolutionsByDate.get(dateStr) || [];
    const firstEvOrders = dayEvs.length > 0 ? resolveOrdersForEvolution(patient, dayEvs[0]).orders : [];

    cells.push({
      dateStr,
      dayNumber: cd,
      isCurrentMonth: cy === year && cm === monthIndex,
      evolutions: dayEvs,
      hasOrders: dayEvs.length > 0 && firstEvOrders.length > 0,
      ordersCount: firstEvOrders.length,
      isAdmissionDate: patient.admissionDate === dateStr,
      isReingresoDate: reingresoDates.has(dateStr),
      isDischargeDate: Boolean(patient.dischargeDate && patient.dischargeDate === dateStr),
    });
  }

  return cells;
}
