import React, { useState, useEffect, useMemo } from 'react';
import { Patient, HistoriaClinicaPediatrica, PatientDocument, MedicalEvolution, HospitalArea, Gender } from '../types';
import { ResumenEgresoDocument } from './ResumenEgresoDocument';
import { ConstanciaHospitalizacionDocument } from './ConstanciaHospitalizacionDocument';
import { NotaRecibimientoDocument } from './NotaRecibimientoDocument';
import { MedicalEvolutionDocument } from './MedicalEvolutionDocument';
import { OrdenesMedicasDocument } from './OrdenesMedicasDocument';
import { ResumenEvolutivoDocument } from './ResumenEvolutivoDocument';
import { calculateHospitalizationTime } from '../services/api';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import { PatientEvolutionsSummarySection, PatientEvolutionsCalendarTab } from './PatientEvolutionsCalendarView';
import { 
  Search, 
  UserCheck, 
  RefreshCw, 
  Eye, 
  Download, 
  AlertTriangle, 
  X,
  FileText,
  FileCheck,
  Stethoscope,
  Edit2,
  Printer,
  Scale,
  MessageSquare,
  CheckCircle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ClipboardList,
  Layers
} from 'lucide-react';

const AREAS_LIST: HospitalArea[] = [
  'Traumashock',
  'ÁREA DE OBSERVACIÓN',
  'Respiratorio',
  'Aislamiento',
  'Hospitalización'
];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function formatDateHeading(dateStr: string): string {
  if (!dateStr || dateStr === 'Sin fecha') return 'Sin fecha registrada';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  if (isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

interface Props {
  patients: Patient[];
  historias?: HistoriaClinicaPediatrica[];
  isVisitor?: boolean;
  onReadmitPatient: (patientId: string, mode?: 'correct_errors' | 'new_admission') => void;
  onOpenHistoriaClinicaForm: (patient?: Patient, defaultTab?: 'editor' | 'preview', openPrint?: boolean, specificHistoriaId?: string) => void;
  onOpenLaboratorios?: (patientId: string) => void;
  onUpdatePatient?: (updatedPatient: Patient) => void;
}

export const DischargedPatientsList: React.FC<Props> = ({ 
  patients, 
  historias = [], 
  isVisitor = false,
  onReadmitPatient, 
  onOpenHistoriaClinicaForm,
  onOpenLaboratorios: _onOpenLaboratorios,
  onUpdatePatient
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');
  const [areaFilter, setAreaFilter] = useState<'ALL' | HospitalArea>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState<boolean>(true);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Modals for Discharged Patients
  const [selectedProfilePatient, setSelectedProfilePatient] = useState<Patient | null>(null);
  const [selectedEgresoPatient, setSelectedEgresoPatient] = useState<Patient | null>(null);
  const [selectedConstanciaPatient, setSelectedConstanciaPatient] = useState<Patient | null>(null);
  const [selectedNotaRecibimientoPatient, setSelectedNotaRecibimientoPatient] = useState<Patient | null>(null);
  const [selectedResumenEvolutivoPatient, setSelectedResumenEvolutivoPatient] = useState<Patient | null>(null);
  const [returnToProfilePatient, setReturnToProfilePatient] = useState<Patient | null>(null);
  const [readmitModalPatient, setReadmitModalPatient] = useState<Patient | null>(null);
  const [dischargedProfileTab, setDischargedProfileTab] = useState<'expediente' | 'calendario_evoluciones'>('expediente');
  const [dischargedCalendarInitialDate, setDischargedCalendarInitialDate] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProfilePatient) {
      setDischargedProfileTab('expediente');
      setDischargedCalendarInitialDate(null);
    }
  }, [selectedProfilePatient]);

  // Evolution & Orders Document Viewers for Discharged Patients
  const [activePrintEvolution, setActivePrintEvolution] = useState<{ patient: Patient; evolution: MedicalEvolution } | null>(null);
  const [activeDownloadEvolution, setActiveDownloadEvolution] = useState<{ patient: Patient; evolution: MedicalEvolution } | null>(null);
  const [viewOrdenesEvolution, setViewOrdenesEvolution] = useState<{ patient: Patient; evolution: MedicalEvolution } | null>(null);

  const allDischargedPatients = useMemo(
    () => patients.filter(p => p.status === 'discharged'),
    [patients]
  );

  // Synchronize discharged patient modals when running interactive tutorial walkthroughs
  useEffect(() => {
    const onAltasModal = (ev: Event) => {
      const custom = ev as CustomEvent<{ modal?: 'none' | 'altas_profile' | 'altas_reingreso' }>;
      const modal = custom.detail?.modal || 'none';
      const targetPt = allDischargedPatients[0] || null;
      if (modal === 'none') {
        setSelectedProfilePatient(null);
        setReadmitModalPatient(null);
      } else if (modal === 'altas_profile' && targetPt) {
        setReadmitModalPatient(null);
        setSelectedProfilePatient(targetPt);
      } else if (modal === 'altas_reingreso' && targetPt) {
        setSelectedProfilePatient(null);
        setReadmitModalPatient(targetPt);
      }
    };
    const onCleanup = () => {
      setSelectedProfilePatient(null);
      setSelectedEgresoPatient(null);
      setSelectedConstanciaPatient(null);
      setSelectedNotaRecibimientoPatient(null);
      setSelectedResumenEvolutivoPatient(null);
      setReadmitModalPatient(null);
    };
    window.addEventListener('hmi_tutorial_altas_modal', onAltasModal);
    window.addEventListener('hmi_tutorial_cleanup', onCleanup);
    return () => {
      window.removeEventListener('hmi_tutorial_altas_modal', onAltasModal);
      window.removeEventListener('hmi_tutorial_cleanup', onCleanup);
    };
  }, [allDischargedPatients]);

  const getEffectiveDischargeDate = (p: Patient): string => {
    const raw = (p.dischargeDate || p.admissionDate || '').trim();
    return raw ? raw.slice(0, 10) : 'Sin fecha';
  };

  const dischargeCountByDate = useMemo(() => {
    const map: Record<string, Patient[]> = {};
    allDischargedPatients.forEach(p => {
      const d = getEffectiveDischargeDate(p);
      if (!map[d]) map[d] = [];
      map[d].push(p);
    });
    return map;
  }, [allDischargedPatients]);

  const readmissionEntriesByDate = useMemo(() => {
    const map: Record<string, Array<{
      patient: Patient;
      date: string;
      time?: string;
      area?: string;
      bedNumber?: string;
      reason?: string;
    }>> = {};
    const seen = new Set<string>();
    patients.forEach(p => {
      (p.readmissions || []).forEach(r => {
        const d = (r.date || '').trim().slice(0, 10);
        if (!d) return;
        const key = `${p.id}_${d}_${r.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!map[d]) map[d] = [];
        map[d].push({
          patient: p,
          date: d,
          time: r.time,
          area: r.area || p.area,
          bedNumber: r.bedNumber || p.bedNumber,
          reason: r.reason
        });
      });
      if (p.isReingreso && p.lastReadmissionDate) {
        const d = p.lastReadmissionDate.trim().slice(0, 10);
        if (d && !(map[d] || []).some(item => item.patient.id === p.id)) {
          if (!map[d]) map[d] = [];
          map[d].push({
            patient: p,
            date: d,
            time: p.admissionTime,
            area: p.area,
            bedNumber: p.bedNumber
          });
        }
      }
    });
    return map;
  }, [patients]);

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday-based offset: Sunday=0 -> 6, Monday=1 -> 0, etc.
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const cells: Array<{ day: number | null; dateStr: string }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateStr: `empty-start-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
    }
    return cells;
  }, [calendarMonth]);

  const dischargedPatients = useMemo(() => {
    return allDischargedPatients
      .filter(p => {
        if (genderFilter !== 'ALL' && p.gender !== genderFilter) return false;
        if (areaFilter !== 'ALL' && p.area !== areaFilter) return false;
        if (selectedDate && getEffectiveDischargeDate(p) !== selectedDate) return false;

        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const stayTime = calculateHospitalizationTime(p.admissionDate, p.admissionTime).formatted.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          p.medicalHistoryNumber.toLowerCase().includes(query) ||
          p.area.toLowerCase().includes(query) ||
          p.age.toLowerCase().includes(query) ||
          p.admissionDate.toLowerCase().includes(query) ||
          (p.dischargeDate && p.dischargeDate.toLowerCase().includes(query)) ||
          stayTime.includes(query) ||
          p.diagnoses.some(d => d.title.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => getEffectiveDischargeDate(b).localeCompare(getEffectiveDischargeDate(a)));
  }, [allDischargedPatients, genderFilter, areaFilter, selectedDate, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: Patient[] }> = [];
    const indexMap: Record<string, number> = {};
    dischargedPatients.forEach(p => {
      const dateKey = getEffectiveDischargeDate(p);
      if (indexMap[dateKey] === undefined) {
        indexMap[dateKey] = groups.length;
        groups.push({ date: dateKey, items: [p] });
      } else {
        groups[indexMap[dateKey]].items.push(p);
      }
    });
    return groups;
  }, [dischargedPatients]);

  const hasActiveFilters = Boolean(searchQuery.trim() || genderFilter !== 'ALL' || areaFilter !== 'ALL' || selectedDate);
  const clearAllFilters = () => {
    setSearchQuery('');
    setGenderFilter('ALL');
    setAreaFilter('ALL');
    setSelectedDate('');
  };

  return (
    <div className={`${themeTokens.cardSurface} border rounded-2xl p-3 sm:p-5 shadow-xs space-y-4 overflow-hidden`}>
      {/* Top Banner & Title */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${themeTokens.sectionDivider} pb-3`}>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className={`w-4 h-4 ${themeTokens.accentIcon}`} />
            Lista de Altas Médicas & Histórico de Egresos
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Visualización ordenada por fecha, filtros por sexo/área/fecha y calendario interactivo de pacientes dados de alta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCalendar(prev => !prev)}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all self-start md:self-auto cursor-pointer ${
            showCalendar
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{showCalendar ? 'Ocultar Calendario de Altas' : 'Mostrar Calendario de Altas'}</span>
        </button>
      </div>

      {/* INTERACTIVE DISCHARGE CALENDAR */}
      {showCalendar && (
        <div className={`${themeTokens.cardInnerSurface} border rounded-2xl p-3 sm:p-4 space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Calendario de Altas Médicas & Reingresos
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-500/30">
                Altas
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 font-black border border-orange-300 dark:border-orange-500/60 shadow-none dark:shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                Reingresos (Naranja Neón)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCalendarMonth(prev => {
                  const m = prev.month - 1;
                  return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
                })}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 min-w-[130px] text-center">
                {MONTHS_ES[calendarMonth.month]} {calendarMonth.year}
              </span>
              <button
                type="button"
                onClick={() => setCalendarMonth(prev => {
                  const m = prev.month + 1;
                  return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
                })}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
                }}
                className="px-2.5 py-1.5 rounded-lg bg-teal-600/15 hover:bg-teal-600/25 text-teal-600 dark:text-teal-300 border border-teal-500/30 text-[10px] font-black cursor-pointer"
              >
                Mes Actual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
            {WEEKDAYS_ES.map(w => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarCells.map(cell => {
              if (cell.day === null) {
                return <div key={cell.dateStr} className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-transparent" />;
              }
              const dayPatients = dischargeCountByDate[cell.dateStr] || [];
              const dayReingresos = readmissionEntriesByDate[cell.dateStr] || [];
              const count = dayPatients.length;
              const rCount = dayReingresos.length;
              const isSelected = selectedDate === cell.dateStr;
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              const tooltipParts: string[] = [];
              if (count > 0) tooltipParts.push(`${count} alta(s): ${dayPatients.map(p => `${p.lastName} ${p.firstName}`).join(', ')}`);
              if (rCount > 0) tooltipParts.push(`${rCount} reingreso(s): ${dayReingresos.map(r => `${r.patient.lastName} ${r.patient.firstName}`).join(', ')}`);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(prev => prev === cell.dateStr ? '' : cell.dateStr)}
                  title={tooltipParts.length > 0 ? `${cell.dateStr} · ${tooltipParts.join(' | ')}` : `Sin eventos el ${cell.dateStr}`}
                  className={`min-h-[48px] sm:min-h-[54px] rounded-xl border p-1 flex flex-col items-center justify-between transition-all cursor-pointer active:scale-95 ${
                    isSelected && rCount > 0
                      ? 'bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950 border-orange-400 dark:border-orange-300 shadow-sm dark:shadow-[0_0_18px_rgba(249,115,22,0.95)] ring-2 ring-orange-400 dark:ring-orange-300 font-black'
                      : isSelected
                      ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 border-emerald-400 dark:border-emerald-300 shadow-sm dark:shadow-[0_0_14px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400 dark:ring-emerald-300 font-black'
                      : rCount > 0
                      ? 'bg-orange-50/95 dark:bg-orange-500/25 border-orange-400 dark:border-orange-500 text-orange-800 dark:text-orange-200 shadow-xs dark:shadow-[0_0_14px_rgba(249,115,22,0.75)] hover:bg-orange-100/80 dark:hover:bg-orange-500/30 font-black'
                      : count > 0
                      ? 'bg-emerald-50/90 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/80 dark:hover:bg-emerald-500/25 font-bold'
                      : isToday
                      ? 'bg-teal-50/90 dark:bg-teal-500/10 border-teal-400 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  <span className="text-[11px] leading-none">{cell.day}</span>
                  {count > 0 || rCount > 0 ? (
                    <div className="flex flex-col items-center gap-0.5 w-full">
                      {rCount > 0 && (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-none dark:shadow-[0_0_8px_rgba(249,115,22,0.7)] ${
                          isSelected
                            ? 'bg-white/95 dark:bg-slate-950 text-orange-800 dark:text-orange-300'
                            : 'bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950'
                        }`}>
                          {rCount} reing.
                        </span>
                      )}
                      {count > 0 && (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                          isSelected
                            ? 'bg-white/95 dark:bg-slate-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-emerald-700 dark:bg-emerald-600 text-white'
                        }`}>
                          {count} {count === 1 ? 'alta' : 'altas'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[8px] opacity-40">·</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Neon Orange Panel for Selected Date Reingresos OR Month Summary */}
          {(() => {
            const monthPrefix = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}`;
            const monthReingresos = Object.entries(readmissionEntriesByDate)
              .filter(([d]) => d.startsWith(monthPrefix))
              .sort(([a], [b]) => b.localeCompare(a));

            if (selectedDate && (readmissionEntriesByDate[selectedDate]?.length || 0) > 0) {
              const items = readmissionEntriesByDate[selectedDate];
              return (
                <div className="mt-2 p-3 rounded-2xl bg-orange-50/90 dark:bg-orange-500/15 border border-orange-300 dark:border-orange-500/70 shadow-xs dark:shadow-[0_0_16px_rgba(249,115,22,0.35)] space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                      Reingresos registrados el {formatDateHeading(selectedDate)} ({items.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((item, idx) => (
                      <div key={`reing-day-${item.patient.id}-${idx}`} className="bg-white/95 dark:bg-slate-900/90 border border-orange-300 dark:border-orange-500/50 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-white truncate">
                            {item.patient.lastName}, {item.patient.firstName}
                          </p>
                          <p className="text-[10px] text-orange-700 dark:text-orange-300 font-bold truncate">
                            H.C: {item.patient.medicalHistoryNumber} · {item.area} {item.bedNumber ? `· ${item.bedNumber}` : ''}
                          </p>
                          {item.reason && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate italic">{item.reason}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProfilePatient(item.patient)}
                          className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 text-white dark:text-slate-950 font-black text-[10px] shrink-0 cursor-pointer"
                        >
                          Ver Perfil
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (!selectedDate && monthReingresos.length > 0) {
              const totalMonthReing = monthReingresos.reduce((acc, [, arr]) => acc + arr.length, 0);
              return (
                <div className="mt-2 p-2.5 rounded-xl bg-orange-50/80 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/40 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-black text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-orange-600 dark:text-orange-500" />
                    Reingresos en {MONTHS_ES[calendarMonth.month]} ({totalMonthReing}):
                  </span>
                  {monthReingresos.map(([d, arr]) => (
                    <button
                      key={`chip-reing-${d}`}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className="px-2 py-0.5 rounded-full bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950 font-black text-[10px] shadow-xs dark:shadow-[0_0_8px_rgba(249,115,22,0.6)] hover:scale-105 transition-transform cursor-pointer"
                    >
                      {d.slice(8, 10)}/{d.slice(5, 7)} ({arr.length})
                    </button>
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* CATEGORY FILTERS & SMART SEARCH BAR */}
      <div
        data-tutorial="altas-search-panel"
        className={`${themeTokens.cardInnerSurface} p-3 sm:p-4 rounded-xl border space-y-3`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium flex-wrap">
            <Filter className="w-4 h-4 text-emerald-500" />
            <span className="font-bold">Filtrar Altas Médicas:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {dischargedPatients.length} de {allDischargedPatients.length} egresados
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 dark:text-rose-300 border border-rose-500/30 text-[10px] font-black flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 absolute left-2.5 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                aria-label="Filtrar por fecha de egreso"
                className="w-full sm:w-auto pl-8 pr-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-xs font-semibold"
              />
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar nombre, historia, dx..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Category Pills: Sexo & Área */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
          {/* Sexo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mr-1">Sexo:</span>
            <button
              type="button"
              onClick={() => setGenderFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                genderFilter === 'ALL'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Todos ({allDischargedPatients.length})
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('M')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                genderFilter === 'M'
                  ? 'bg-sky-600 text-white border-sky-400 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Masculino ({allDischargedPatients.filter(p => p.gender === 'M').length})
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('F')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                genderFilter === 'F'
                  ? 'bg-pink-600 text-white border-pink-400 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Femenino ({allDischargedPatients.filter(p => p.gender === 'F').length})
            </button>
          </div>

          {/* Área */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mr-1">Área:</span>
            <button
              type="button"
              onClick={() => setAreaFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                areaFilter === 'ALL'
                  ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Todas
            </button>
            {AREAS_LIST.map(area => {
              const count = allDischargedPatients.filter(p => p.area === area).length;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setAreaFilter(area)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    areaFilter === area
                      ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500/40'
                  }`}
                >
                  {area === 'ÁREA DE OBSERVACIÓN' ? 'Observación' : area} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* EMPTY STATE */}
      {groupedByDate.length === 0 && (
        <div className="py-10 text-center text-slate-600 dark:text-slate-400 italic text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
          No se registran pacientes egresados con los filtros seleccionados.
        </div>
      )}

      {/* GROUPED BY DATE: MOBILE VIEW */}
      <div className="block md:hidden space-y-5">
        {groupedByDate.map(group => (
          <div key={'mob-grp-' + group.date} className="space-y-2.5">
            <div className="flex items-center justify-between bg-emerald-500/10 dark:bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 capitalize truncate">
                    {formatDateHeading(group.date)}
                  </p>
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">{group.date}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0">
                {group.items.length} {group.items.length === 1 ? 'alta' : 'altas'}
              </span>
            </div>

            {group.items.map(patient => (
              <div key={'dis-mob-' + patient.id} className="bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3 text-xs shadow-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {patient.lastName}, {patient.firstName}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      H.C: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{patient.medicalHistoryNumber}</span> · {patient.age} ·{' '}
                      <span className={patient.gender === 'F' ? 'text-pink-700 dark:text-pink-400 font-bold' : 'text-sky-700 dark:text-sky-400 font-bold'}>
                        {patient.gender === 'F' ? 'Femenino' : 'Masculino'}
                      </span>
                    </p>
                  </div>
                  <span className="bg-emerald-700 dark:bg-emerald-600 text-white font-black text-[11px] px-2.5 py-1 rounded-lg">
                    {patient.area}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-bold block text-[10px]">Fecha Ingreso:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.admissionDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-bold block text-[10px]">Fecha Egreso:</span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{patient.dischargeDate || 'Egresado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-bold block text-[10px]">Estancia Total:</span>
                    <span className="font-extrabold text-amber-700 dark:text-amber-400">{calculateHospitalizationTime(patient.admissionDate, patient.admissionTime).formatted}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase block">Diagnóstico al Egreso:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {patient.diagnoses.map(d => d.title).join('; ')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    data-tutorial="altas-btn-ver-perfil"
                    onClick={() => setSelectedProfilePatient(patient)}
                    className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-gradient-to-r dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400 text-white dark:text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-xs dark:shadow-[0_0_12px_rgba(6,182,212,0.6)] active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Perfil & Archivos
                  </button>
                  <button
                    onClick={() => setSelectedEgresoPatient(patient)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" /> Resumen de Egreso
                  </button>
                  {!isVisitor && (
                    <>
                      <button
                        type="button"
                        data-tutorial="altas-btn-reingresar"
                        onClick={() => setReadmitModalPatient(patient)}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Reingresar
                      </button>
                      <button
                        onClick={() => onOpenHistoriaClinicaForm(patient)}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 border border-slate-300 dark:border-slate-700 active:scale-95 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> Ver Historia
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* GROUPED BY DATE: DESKTOP VIEW */}
      <div className="hidden md:block space-y-5">
        {groupedByDate.map(group => (
          <div key={'desk-grp-' + group.date} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/25 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 capitalize">
                  Altas del {formatDateHeading(group.date)}
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">({group.date})</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                {group.items.length} {group.items.length === 1 ? 'paciente egresado' : 'pacientes egresados'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] bg-slate-50/70 dark:bg-slate-900/50">
                    <th className="py-2.5 px-3">Paciente</th>
                    <th className="py-2.5 px-2">Historia N°</th>
                    <th className="py-2.5 px-2">Área Previa</th>
                    <th className="py-2.5 px-2">Fechas & Estancia</th>
                    <th className="py-2.5 px-2">Diagnósticos de Alta</th>
                    <th className="py-2.5 px-3 text-right">Acciones de Egresados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {group.items.map(patient => (
                    <tr key={patient.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {patient.lastName}, {patient.firstName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {patient.age} ·{' '}
                          <span className={patient.gender === 'F' ? 'text-pink-500 font-bold' : 'text-sky-500 font-bold'}>
                            {patient.gender === 'F' ? 'Femenino (F)' : 'Masculino (M)'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-300">
                        {patient.medicalHistoryNumber}
                      </td>
                      <td className="py-3 px-2">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          {patient.area}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400 text-[11px]">
                        <div>Ingreso: <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.admissionDate}</span></div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">Egreso: {patient.dischargeDate || 'Registrado'}</div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Estancia: {calculateHospitalizationTime(patient.admissionDate, patient.admissionTime).formatted}</div>
                      </td>
                      <td className="py-3 px-2 max-w-xs text-[11px]">
                        {patient.diagnoses.map(d => d.title).join('; ')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            data-tutorial="altas-btn-ver-perfil"
                            onClick={() => setSelectedProfilePatient(patient)}
                            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-gradient-to-r dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400 dark:hover:from-cyan-300 dark:hover:to-emerald-300 text-white dark:text-slate-950 font-black text-[10.5px] flex items-center gap-1 shadow-xs dark:shadow-[0_0_12px_rgba(6,182,212,0.6)] transition-all active:scale-95 cursor-pointer"
                            title="Ver Perfil Completo del Paciente y Archivos"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Perfil & Archivos
                          </button>

                          <button
                            onClick={() => setSelectedEgresoPatient(patient)}
                            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[10.5px] flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                            title="Ver Resumen de Egreso Tamaño Carta"
                          >
                            <FileText className="w-3.5 h-3.5" /> Resumen de Egreso
                          </button>

                          {!isVisitor && (
                            <>
                              <button
                                type="button"
                                data-tutorial="altas-btn-reingresar"
                                onClick={() => setReadmitModalPatient(patient)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Reingresar Paciente"
                              >
                                <RefreshCw className="w-3 h-3" /> Reingresar
                              </button>

                              <button
                                onClick={() => onOpenHistoriaClinicaForm(patient)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                                title="Ver Historia Clínica"
                              >
                                <FileText className="w-4 h-4 text-teal-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: VER PERFIL & ARCHIVOS DEL PACIENTE EGRESADO */}
      {selectedProfilePatient && (
        <div className="fixed inset-0 bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-md z-[110] overflow-y-auto flex flex-col items-center p-4 no-print">
          <div data-tutorial="altas-profile-modal-content" className={`${themeTokens.cardSurface} border rounded-3xl ${dischargedProfileTab === 'calendario_evoluciones' ? 'max-w-7xl' : 'max-w-4xl'} w-full p-6 shadow-2xl space-y-6 my-8 transition-all`}>
            {/* Header: Title, Patient Name, Close X Button */}
            <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-4 flex-wrap gap-3`}>
              <div>
                <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-400">
                  Perfil del Paciente Egresado & Historial de Archivos
                </h3>
                <div className="mt-1">
                  <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-cyan-500/15 px-3.5 py-1.5 rounded-xl border border-teal-500/35 shadow-xs inline-block">
                    {selectedProfilePatient.lastName}, {selectedProfilePatient.firstName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setSelectedProfilePatient(null)}
                  className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-2 border-rose-400 dark:border-rose-500/80 shadow-xs dark:shadow-[0_0_15px_rgba(244,63,94,0.7)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center font-black"
                  title="Cerrar perfil"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats bar: Fecha Ingreso, Fecha Egreso, Estancia, Edad, Peso, Área Previa */}
            <div className={`grid grid-cols-2 sm:grid-cols-6 gap-2 ${themeTokens.cardInnerSurface} p-3 rounded-2xl text-[11px] font-bold border`}>
              <div>Fecha Ingreso: <span className="text-teal-700 dark:text-teal-400 font-mono block sm:inline">{selectedProfilePatient.admissionDate}</span></div>
              <div>Fecha Egreso: <span className="text-emerald-700 dark:text-emerald-400 font-mono block sm:inline">{selectedProfilePatient.dischargeDate || 'Egresado'}</span></div>
              <div>Estancia Total: <span className="text-amber-700 dark:text-amber-400 block sm:inline">{calculateHospitalizationTime(selectedProfilePatient.admissionDate, selectedProfilePatient.admissionTime).formatted}</span></div>
              <div>Edad: <span className="text-teal-700 dark:text-teal-400 block sm:inline">{selectedProfilePatient.age}</span></div>
              <div>Peso: <span className="text-teal-700 dark:text-teal-400 block sm:inline">{selectedProfilePatient.weightKg} kg</span></div>
              <div>Área Previa: <span className="text-teal-700 dark:text-teal-400 block sm:inline">{selectedProfilePatient.area}</span></div>
            </div>

            {/* Navigation Tabs: Expediente vs Calendario de Evoluciones & Órdenes Médicas */}
            <div className="flex items-center gap-2 flex-wrap bg-slate-100/90 dark:bg-slate-900/70 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                data-testid="discharged-profile-tab-expediente"
                onClick={() => setDischargedProfileTab('expediente')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dischargedProfileTab === 'expediente'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 text-violet-500" />
                <span>Expediente & Historial de Archivos</span>
              </button>
              <button
                type="button"
                data-testid="discharged-profile-tab-calendario"
                onClick={() => setDischargedProfileTab('calendario_evoluciones')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dischargedProfileTab === 'calendario_evoluciones'
                    ? 'bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Calendario de Evoluciones & Órdenes Médicas</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  dischargedProfileTab === 'calendario_evoluciones'
                    ? 'bg-white/20 text-white'
                    : 'bg-teal-500/15 text-teal-800 dark:text-teal-300'
                }`}>
                  {selectedProfilePatient.evolutions.length}
                </span>
              </button>
            </div>

            {dischargedProfileTab === 'calendario_evoluciones' ? (
              <PatientEvolutionsCalendarTab
                patient={selectedProfilePatient}
                initialSelectedDate={dischargedCalendarInitialDate}
                onBackToProfile={() => setDischargedProfileTab('expediente')}
                onOpenOrdenesModal={(ev) => setViewOrdenesEvolution({ patient: selectedProfilePatient, evolution: ev })}
                onOpenPrintEvolutionModal={(ev) => setActivePrintEvolution({ patient: selectedProfilePatient, evolution: ev })}
              />
            ) : (
            <div className="space-y-4">
              {/* Documento de Egreso: Resumen de Egreso */}
              <div className="space-y-2">
                <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" /> Documento de Egreso:
                </h4>
                <div className="bg-emerald-50/75 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                        <FileCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs">Resumen de Egreso</p>
                        <p className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">ALTA MÉDICA</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReturnToProfilePatient(selectedProfilePatient);
                        setSelectedEgresoPatient(selectedProfilePatient);
                        setSelectedProfilePatient(null);
                      }}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-[10.5px] font-black rounded-xl flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_12px_rgba(5,150,105,0.5)] transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> VER RESUMEN
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumen Evolutivo de Hospitalización (si aplica y no es visitante) */}
              {!isVisitor && (() => {
                const timeCalc = calculateHospitalizationTime(selectedProfilePatient.admissionDate, selectedProfilePatient.admissionTime);
                const isProlonged = timeCalc.days >= 7;
                const savedResumenes = selectedProfilePatient.resumenesEvolutivos || [];

                if (!isProlonged && savedResumenes.length === 0) return null;

                return (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-500" /> Resumen Evolutivo (Seguimiento Cada 7 Días):
                      </h4>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                        {isProlonged ? `Hospitalización Prolongada (${timeCalc.days} días)` : `Seguimiento Registrado`}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-slate-100 text-xs">
                            Resumen Evolutivo de Hospitalización
                          </p>
                          <p className="text-[9.5px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                            Cortes semanales · Control ponderal · Diagnósticos · Examen físico
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedResumenEvolutivoPatient(selectedProfilePatient)}
                        className="px-3.5 py-2 font-black text-[10.5px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md transition-all cursor-pointer self-end sm:self-auto"
                      >
                        <FileText className="w-3.5 h-3.5" /> VER RESUMEN EVOLUTIVO (7 DÍAS)
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Histórico de Evoluciones Diarias (Vista Mejorada + Acceso a Calendario & Órdenes) */}
              <PatientEvolutionsSummarySection
                patient={selectedProfilePatient}
                onOpenCalendarTab={(dateStr) => {
                  setDischargedCalendarInitialDate(dateStr || null);
                  setDischargedProfileTab('calendario_evoluciones');
                }}
                onOpenOrdenesModal={(ev) => setViewOrdenesEvolution({ patient: selectedProfilePatient, evolution: ev })}
                onOpenPrintEvolutionModal={(ev) => setActivePrintEvolution({ patient: selectedProfilePatient, evolution: ev })}
              />

              {/* Documentos Adjuntos y Laboratorios */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" /> Archivos y Documentos Registrados ({selectedProfilePatient.documents?.length || 0}):
                </h4>
                {selectedProfilePatient.documents && selectedProfilePatient.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProfilePatient.documents.map((doc: PatientDocument) => (
                      <div key={doc.id} className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-white">{doc.title}</p>
                          <p className="text-[10px] text-slate-500">Subido el {doc.uploadedAt} por {doc.uploadedBy}</p>
                        </div>
                        <a 
                          href={doc.dataUrl} 
                          download={doc.fileName}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    No se adjuntaron documentos adicionales durante la hospitalización de este paciente.
                  </div>
                )}
              </div>

              {/* Documento de Ingreso: Historia Clínica Pediátrica (al final) */}
              <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Documento de Ingreso:
                </h4>
                {(() => {
                  const isReing = Boolean(selectedProfilePatient.isReingreso || (selectedProfilePatient.readmissions && selectedProfilePatient.readmissions.length > 0));
                  const reingresoDateLabel = selectedProfilePatient.lastReadmissionDate || selectedProfilePatient.admissionDate || '';
                  const prevIds = (selectedProfilePatient.previousHistoriaIds || []).filter(id => id && id !== selectedProfilePatient.historiaClinicaId);
                  return (
                    <>
                      <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isReing
                          ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-300 dark:border-orange-500/50'
                          : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isReing ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2 flex-wrap">
                              <span>
                                {isReing
                                  ? `Historia Clínica Pediátrica de Reingreso (${reingresoDateLabel})`
                                  : 'Historia Clínica Pediátrica'}
                              </span>
                              {isReing && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-orange-500 text-slate-950 uppercase">
                                  Reingreso
                                </span>
                              )}
                            </p>
                            <p className={`text-[9.5px] font-bold uppercase ${isReing ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                              EXPEDIENTE COMPLETO DE ADMISIÓN (8 PÁGINAS)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end sm:self-auto">
                          {!isVisitor && (
                            <button
                              type="button"
                              onClick={() => onOpenHistoriaClinicaForm(selectedProfilePatient, 'editor', false, selectedProfilePatient.historiaClinicaId)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-400 text-[10px] font-black rounded-lg flex items-center gap-1.5 transition-all border border-slate-300 dark:border-slate-700 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" /> VER / EDITAR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenHistoriaClinicaForm(selectedProfilePatient, 'preview', true, selectedProfilePatient.historiaClinicaId)}
                            className={`px-3 py-1.5 text-white text-[10px] font-black rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                              isReing ? 'bg-orange-600 hover:bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-500'
                            }`}
                          >
                            <Printer className="w-3 h-3" /> IMPRESIÓN PROFESIONAL
                          </button>
                        </div>
                      </div>

                      {prevIds.map((prevId, pIdx) => {
                        const prevHist = historias.find(item => item.id === prevId);
                        const prevFecha = prevHist?.reingresoDate || prevHist?.fechaIngreso || selectedProfilePatient.readmissions?.[pIdx]?.previousAdmissionDate || 'Ingreso Anterior';
                        return (
                          <div key={prevId} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  Historia Clínica Pediátrica Anterior ({prevFecha})
                                </p>
                                <p className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold uppercase">
                                  EXPEDIENTE HISTÓRICO PREVIO AL REINGRESO
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 self-end sm:self-auto shrink-0">
                              {!isVisitor && (
                                <button
                                  type="button"
                                  onClick={() => onOpenHistoriaClinicaForm(selectedProfilePatient, 'editor', false, prevId)}
                                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> VER / EDITAR
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenHistoriaClinicaForm(selectedProfilePatient, 'preview', true, prevId)}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" /> IMPRIMIR ANTERIOR
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              {/* Constancia de Hospitalización (al final) */}
              {!isVisitor && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-500" /> Constancia de Hospitalización:
                  </h4>
                  <div className="bg-teal-50/75 dark:bg-teal-950/30 p-3.5 rounded-2xl border border-teal-200 dark:border-teal-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs">
                          {selectedProfilePatient.isReingreso
                            ? `Constancia de Hospitalización de Reingreso (${selectedProfilePatient.lastReadmissionDate || selectedProfilePatient.admissionDate})`
                            : 'Constancia de Hospitalización'}
                        </p>
                        <p className="text-[9.5px] text-teal-700 dark:text-teal-400 font-bold uppercase">FORMATO OFICIAL</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedConstanciaPatient(selectedProfilePatient)}
                      className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[10.5px] font-black rounded-xl flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_12px_rgba(13,148,136,0.5)] transition-all cursor-pointer self-end sm:self-auto"
                    >
                      <FileText className="w-3.5 h-3.5" /> GENERAR CONSTANCIA
                    </button>
                  </div>
                </div>
              )}

              {/* Nota de Recibimiento (al final) */}
              {!isVisitor && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" /> Nota de Recibimiento:
                  </h4>
                  <div className="bg-sky-50/75 dark:bg-sky-950/30 p-3.5 rounded-2xl border border-sky-200 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-sky-700 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-xs">Nota de Recibimiento del Paciente</p>
                        <p className="text-[9.5px] text-sky-700 dark:text-sky-400 font-bold uppercase">INFORME PDF 1 HOJA</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNotaRecibimientoPatient(selectedProfilePatient)}
                      className="px-3.5 py-2 bg-sky-700 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-[10.5px] font-black rounded-xl flex items-center gap-1.5 shadow-xs dark:shadow-[0_0_12px_rgba(2,132,199,0.5)] transition-all cursor-pointer self-end sm:self-auto"
                    >
                      <Printer className="w-3.5 h-3.5" /> NOTA DE RECIBIMIENTO
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedProfilePatient(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs cursor-pointer"
              >
                Cerrar Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS PARA VISUALIZAR Y DESCARGAR EVOLUCIONES ÓRDENES DE PACIENTES EGRESADOS */}
      {activePrintEvolution && (
        <MedicalEvolutionDocument
          patient={activePrintEvolution.patient}
          evolution={activePrintEvolution.evolution}
          onClose={() => setActivePrintEvolution(null)}
        />
      )}

      {activeDownloadEvolution && (
        <MedicalEvolutionDocument
          patient={activeDownloadEvolution.patient}
          evolution={activeDownloadEvolution.evolution}
          autoDownload={true}
          onClose={() => setActiveDownloadEvolution(null)}
        />
      )}

      {viewOrdenesEvolution && (
        <OrdenesMedicasDocument
          patient={viewOrdenesEvolution.patient}
          initialOrders={viewOrdenesEvolution.evolution.ordenesMedicas}
          initialFecha={viewOrdenesEvolution.evolution.ordenesFecha || viewOrdenesEvolution.evolution.date}
          initialHora={viewOrdenesEvolution.evolution.ordenesHora || viewOrdenesEvolution.evolution.time}
          initialPeso={viewOrdenesEvolution.evolution.ordenesPeso || `${viewOrdenesEvolution.patient.weightKg} kg`}
          doctorName={viewOrdenesEvolution.evolution.doctorName}
          readOnly={isVisitor}
          onClose={() => setViewOrdenesEvolution(null)}
        />
      )}

      {selectedResumenEvolutivoPatient && (
        <ResumenEvolutivoDocument
          patient={selectedResumenEvolutivoPatient}
          historia={historias.find(h => h.id === selectedResumenEvolutivoPatient.historiaClinicaId || h.patientId === selectedResumenEvolutivoPatient.id || h.numHistoria === selectedResumenEvolutivoPatient.medicalHistoryNumber)}
          onClose={() => setSelectedResumenEvolutivoPatient(null)}
        />
      )}

      {/* MODAL: RESUMEN DE EGRESO (TAMAÑO CARTA CON NUEVA PESTAÑA / IMPRESIÓN PROFESIONAL) */}
      {selectedEgresoPatient && (
        <ResumenEgresoDocument
          patient={selectedEgresoPatient}
          historia={historias.find(h => h.id === selectedEgresoPatient.historiaClinicaId || h.patientId === selectedEgresoPatient.id || h.numHistoria === selectedEgresoPatient.medicalHistoryNumber)}
          onUpdatePatient={(updated) => {
            setSelectedEgresoPatient(updated);
            if (returnToProfilePatient?.id === updated.id) setReturnToProfilePatient(updated);
            if (selectedProfilePatient?.id === updated.id) setSelectedProfilePatient(updated);
            if (onUpdatePatient) onUpdatePatient(updated);
          }}
          onClose={() => {
            setSelectedEgresoPatient(null);
            if (returnToProfilePatient) {
              setSelectedProfilePatient(returnToProfilePatient);
              setReturnToProfilePatient(null);
            }
          }}
        />
      )}

      {selectedConstanciaPatient && (
        <ConstanciaHospitalizacionDocument
          patient={selectedConstanciaPatient}
          historia={historias.find(h => h.id === selectedConstanciaPatient.historiaClinicaId || h.patientId === selectedConstanciaPatient.id || h.numHistoria === selectedConstanciaPatient.medicalHistoryNumber)}
          onClose={() => setSelectedConstanciaPatient(null)}
        />
      )}

      {/* MODAL 2 OPCIONES DE REINGRESO */}
      {readmitModalPatient && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-md z-[130] flex items-center justify-center p-4 no-print">
          <div data-tutorial="altas-reingreso-modal-content" className={`${themeTokens.cardSurface} border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5`}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-orange-500" />
                  Opciones de Reingreso Hospitalario
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Paciente: <strong className="text-slate-900 dark:text-white">{readmitModalPatient.lastName}, {readmitModalPatient.firstName}</strong> · H.C: <span className="font-mono font-bold">{readmitModalPatient.medicalHistoryNumber}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReadmitModalPatient(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  onReadmitPatient(readmitModalPatient.id, 'correct_errors');
                  setReadmitModalPatient(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer active:scale-[0.99] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    1. Reingresar para corregir errores
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase">
                    Todo Intacto
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-6">
                  Devuelve al paciente a Hospitalización conservando exactamente la misma historia clínica, fechas de ingreso, diagnósticos y evoluciones previas sin crear un nuevo episodio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onReadmitPatient(readmitModalPatient.id, 'new_admission');
                  setReadmitModalPatient(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-orange-400 dark:border-orange-500 bg-orange-50/90 dark:bg-orange-500/15 hover:bg-orange-100/90 dark:hover:bg-orange-500/25 shadow-xs dark:shadow-[0_0_16px_rgba(249,115,22,0.4)] transition-all cursor-pointer active:scale-[0.99] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600 dark:text-orange-500 shrink-0" />
                    2. Nuevo Ingreso (Historia Clínica de Reingreso)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950 text-[9px] font-black uppercase">
                    Reingreso
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed pl-6">
                  Mantiene la historia clínica y evoluciones anteriores en archivo y abre una nueva <strong>Historia Clínica Pediátrica de Reingreso</strong> (Fecha, Motivo, Enfermedad Actual, Diagnóstico de Admisión, Pág. 3, Pág. 4, Pág. 7 Laboratorios y Pág. 8 Resumen).
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setReadmitModalPatient(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedNotaRecibimientoPatient && (
        <NotaRecibimientoDocument
          patient={selectedNotaRecibimientoPatient}
          historia={historias.find(h => h.id === selectedNotaRecibimientoPatient.historiaClinicaId || h.patientId === selectedNotaRecibimientoPatient.id || h.numHistoria === selectedNotaRecibimientoPatient.medicalHistoryNumber)}
          onClose={() => setSelectedNotaRecibimientoPatient(null)}
        />
      )}

    </div>
  );
};
