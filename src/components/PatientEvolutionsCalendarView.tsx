import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Droplets,
  Eye,
  FileText,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Printer,
  Sparkles,
  Stethoscope,
  Thermometer,
  Wind,
} from 'lucide-react';
import { MedicalEvolution, Patient } from '../types';
import {
  buildMonthCalendarGrid,
  computeHospitalizationDayNumber,
  formatEvolutionSpanishDate,
  getAvailableEvolutionMonths,
  resolveOrdersForEvolution,
  shiftMonthKey,
} from '../utils/evolutionsCalendarHelpers';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface PatientEvolutionsViewProps {
  patient: Patient;
  onOpenOrdenesModal: (evolution: MedicalEvolution) => void;
  onOpenPrintEvolutionModal: (evolution: MedicalEvolution) => void;
  onOpenCalendarTab?: (initialDate?: string) => void;
  onBackToProfile?: () => void;
  initialSelectedDate?: string | null;
}

const EXAM_FIELD_LABELS: Array<{ key: keyof MedicalEvolution['examenFisico']; label: string }> = [
  { key: 'piel', label: 'Piel y Faneras' },
  { key: 'cabezaOjos', label: 'Cabeza y Ojos' },
  { key: 'oidosOtoscopia', label: 'Oídos / Otoscopia' },
  { key: 'narizOrofaringe', label: 'Nariz y Orofaringe' },
  { key: 'cuello', label: 'Cuello' },
  { key: 'toraxCP', label: 'Tórax y Pulmones' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'genitourinario', label: 'Genitourinario' },
  { key: 'extremidades', label: 'Extremidades' },
  { key: 'neurologico', label: 'Neurológico' },
];

function renderVitalSignsStrip(ev: MedicalEvolution, fallbackWeightKg?: number) {
  const vs = ev.vitalSigns;
  const chips: Array<{ label: string; value: string; colorClass: string }> = [];

  if (vs?.temp) {
    chips.push({
      label: 'Temp',
      value: `${vs.temp.replace(/°C/gi, '').trim()} °C`,
      colorClass: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/30',
    });
  }
  if (vs?.fc) {
    chips.push({
      label: 'FC',
      value: `${vs.fc.replace(/lpm|bpm/gi, '').trim()} lpm`,
      colorClass: 'bg-pink-500/12 text-pink-800 dark:text-pink-300 border-pink-500/30',
    });
  }
  if (vs?.fr) {
    chips.push({
      label: 'FR',
      value: `${vs.fr.replace(/rpm/gi, '').trim()} rpm`,
      colorClass: 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
    });
  }
  if (vs?.ta && vs.ta !== '0') {
    chips.push({
      label: 'TA',
      value: `${vs.ta.replace(/mmHg/gi, '').trim()} mmHg`,
      colorClass: 'bg-indigo-500/12 text-indigo-800 dark:text-indigo-300 border-indigo-500/30',
    });
  }
  if (vs?.so2) {
    chips.push({
      label: 'SatO₂',
      value: `${vs.so2.replace(/%/g, '').trim()}%`,
      colorClass: 'bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-500/30',
    });
  }
  const weightVal = vs?.peso || (fallbackWeightKg ? `${fallbackWeightKg}` : '');
  if (weightVal) {
    chips.push({
      label: 'Peso',
      value: `${String(weightVal).replace(/kg/gi, '').trim()} kg`,
      colorClass: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    });
  }

  if (chips.length === 0 && !vs?.hasOxygenSupport && !ev.balanceHidrico?.enabled) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {chips.map(chip => (
        <span
          key={chip.label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${chip.colorClass}`}
        >
          <span className="opacity-75 font-semibold">{chip.label}:</span>
          <span className="font-mono font-black">{chip.value}</span>
        </span>
      ))}
      {vs?.hasOxygenSupport && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-black bg-sky-500/18 text-sky-900 dark:text-sky-200 border border-sky-500/40">
          <Wind className="w-3 h-3" />
          <span>
            O₂ {vs.o2Modalidad || 'Suplementario'} ({vs.o2FlowLmin || '3'} L/min · FiO₂ {vs.fio2 || '21'}%)
          </span>
        </span>
      )}
      {ev.balanceHidrico?.enabled && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-black bg-teal-500/18 text-teal-900 dark:text-teal-200 border border-teal-500/40">
          <Droplets className="w-3 h-3" />
          <span>
            BH 24h: {ev.balanceHidrico.balanceNetoCc >= 0 ? `+${ev.balanceHidrico.balanceNetoCc}` : ev.balanceHidrico.balanceNetoCc} cc · FU {ev.balanceHidrico.flujoUrinarioCcKgH.toFixed(1)} cc/kg/h
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * 1. Enhanced Summary List inside "Perfil del Paciente & Historial de Archivos"
 * Includes the button to switch to the dedicated "Calendario de Evoluciones & Órdenes Médicas" tab,
 * richer visual cards, vital signs chips, and inline expandable medical orders preview.
 */
export const PatientEvolutionsSummarySection: React.FC<PatientEvolutionsViewProps> = ({
  patient,
  onOpenOrdenesModal,
  onOpenPrintEvolutionModal,
  onOpenCalendarTab,
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const [expandedOrdersByEvId, setExpandedOrdersByEvId] = useState<Record<string, boolean>>({});

  const isCurrentReingreso = Boolean(
    patient.isReingreso || (patient.readmissions && patient.readmissions.length > 0)
  );
  const latestReingresoDate =
    patient.lastReadmissionDate || patient.readmissions?.[0]?.date || patient.admissionDate;
  const currentEpisodeNum = (patient.readmissionCount || 0) + 1;

  const isNewEpEv = (evItem: MedicalEvolution) => {
    if (!isCurrentReingreso) return true;
    if (evItem.episodeNumber !== undefined) return evItem.episodeNumber >= currentEpisodeNum;
    if (evItem.isReingreso) return true;
    if (latestReingresoDate && evItem.date && evItem.date >= latestReingresoDate) return true;
    return false;
  };

  const firstOldIdx = isCurrentReingreso
    ? patient.evolutions.findIndex(evItem => !isNewEpEv(evItem))
    : -1;

  return (
    <div data-tutorial="profile-evoluciones-list" className="space-y-3">
      {/* Section Header with Prominent Button to Open the Calendar & Visual Evolutions Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10 p-3 rounded-2xl border border-teal-500/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Histórico de Evoluciones Diarias
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/35">
                {patient.evolutions.length} {patient.evolutions.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Explora el resumen rápido o abre la pestaña interactiva con calendario y órdenes médicas integradas.
            </p>
          </div>
        </div>

        {onOpenCalendarTab && (
          <button
            type="button"
            data-testid="open-evolutions-calendar-tab"
            data-tutorial="profile-btn-abrir-calendario"
            onClick={() => onOpenCalendarTab()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:via-cyan-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Ver Calendario de Evoluciones & Órdenes Médicas</span>
          </button>
        )}
      </div>

      {patient.evolutions.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          No hay evoluciones diarias registradas para este paciente.
        </p>
      ) : (
        <div className="space-y-3 max-h-[54vh] overflow-y-auto pr-1">
          {patient.evolutions.map((ev, idx) => {
            const formattedDate = formatEvolutionSpanishDate(ev.date);
            const showSeparatorBeforeThis = isCurrentReingreso && idx === firstOldIdx;
            const isReingresoEv = isCurrentReingreso && isNewEpEv(ev);
            const refAdmDate = isReingresoEv ? latestReingresoDate : patient.admissionDate;
            const stayDay = computeHospitalizationDayNumber(ev.date, refAdmDate);
            const resolvedOrders = resolveOrdersForEvolution(patient, ev);
            const isOrdersExpanded = Boolean(expandedOrdersByEvId[ev.id]);

            return (
              <React.Fragment key={ev.id}>
                {showSeparatorBeforeThis && (
                  <div className="relative py-2 my-1 flex items-center gap-3">
                    <div className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-orange-400" />
                    <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/60 text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap">
                      {firstOldIdx === 0
                        ? `Reingreso (${latestReingresoDate}) · Evoluciones anteriores abajo`
                        : `Separación Reingreso (${latestReingresoDate}) ↑ · Ingreso Anterior ↓`}
                    </span>
                    <div className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-orange-500 to-orange-400" />
                  </div>
                )}

                <div
                  className={`${themeTokens.cardSurface} p-4 rounded-2xl border shadow-xs space-y-3 transition-all ${
                    isReingresoEv
                      ? 'border-orange-400 dark:border-orange-500/45'
                      : 'border-slate-200/90 dark:border-slate-700/80 hover:border-teal-500/50'
                  }`}
                >
                  {/* Top Bar: Date Badge, Stay Day, Doctor & Action Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenCalendarTab?.(ev.date)}
                        title="Abrir este día en el Calendario de Evoluciones"
                        className={`bg-gradient-to-br rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center shrink-0 border-2 transition-transform hover:scale-105 cursor-pointer ${
                          isReingresoEv
                            ? 'from-orange-50 via-amber-50 to-teal-50 dark:from-orange-950/70 dark:to-teal-950/70 border-orange-400 dark:border-orange-500/60'
                            : 'from-teal-50 via-cyan-50 to-emerald-50 dark:from-teal-950/80 dark:to-cyan-950/80 border-teal-400 dark:border-teal-500/60'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            isReingresoEv ? 'text-orange-700 dark:text-orange-400' : 'text-teal-700 dark:text-teal-400'
                          }`}
                        >
                          {formattedDate.monthShort}
                        </span>
                        <span
                          className={`text-2xl font-black leading-none py-0.5 ${
                            isReingresoEv ? 'text-orange-800 dark:text-orange-200' : 'text-teal-800 dark:text-teal-200'
                          }`}
                        >
                          {formattedDate.dayNum}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-400 font-mono">
                          {formattedDate.year}
                        </span>
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {formattedDate.fullFormatted}
                          </span>
                          <span className="px-2 py-0.5 bg-teal-500/15 text-teal-800 dark:text-teal-300 text-[10px] font-mono font-black rounded-lg border border-teal-500/35">
                            <Clock className="w-2.5 h-2.5 inline mr-1" />
                            {ev.time} hrs
                          </span>
                          {stayDay !== null && (
                            <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 text-[10px] font-black rounded-lg border border-indigo-500/35">
                              Día {stayDay} de estancia
                            </span>
                          )}
                          {isReingresoEv && (
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 text-[9px] font-black uppercase rounded-md border border-orange-400 dark:border-orange-500/50">
                              Reingreso
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 flex-wrap">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>
                            Médico: <strong className="text-slate-900 dark:text-white font-black">{ev.doctorName}</strong>
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-amber-700 dark:text-amber-300 font-extrabold">
                            📋 {resolvedOrders.orders.length} órdenes médicas asociadas
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                      {onOpenCalendarTab && (
                        <button
                          type="button"
                          onClick={() => onOpenCalendarTab(ev.date)}
                          className="px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 border border-indigo-500/40 font-black text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Ver esta evolución junto con su calendario y órdenes médicas"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Ver en Calendario</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenOrdenesModal(ev)}
                        className="ordenes-btn-neon-yellow px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 border border-yellow-300 hover:scale-[1.02] active:scale-95 transition-all font-black text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-950" /> Órdenes Médicas
                      </button>
                      <button
                        type="button"
                        data-tutorial={idx === 0 ? 'profile-btn-visualizar-evolucion' : undefined}
                        onClick={() => onOpenPrintEvolutionModal(ev)}
                        className="px-3.5 py-2 rounded-xl bg-teal-100/90 hover:bg-teal-200 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 text-teal-900 dark:text-teal-300 border-2 border-teal-400 dark:border-teal-500/80 shadow-xs hover:scale-[1.02] active:scale-95 transition-all font-black text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> Visualizar la evolución
                      </button>
                    </div>
                  </div>

                  {/* Vital Signs Chips */}
                  {renderVitalSignsStrip(ev, patient.weightKg)}

                  {/* Clinical SOAP Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="font-black text-teal-700 dark:text-teal-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Subjetivo (24 Horas)
                      </span>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-3">
                        {ev.subjetivo || ev.interrogatory24h || 'Paciente evaluado durante la guardia sin eventualidades subjetivas reportadas.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <span className="font-black text-cyan-700 dark:text-cyan-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <HeartPulse className="w-3 h-3" /> Objetivo & Hallazgos
                      </span>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-3">
                        {ev.objetivo || ev.evolutionNote || 'Signos vitales y examen físico documentados en la hoja de evolución.'}
                      </p>
                    </div>
                  </div>

                  {(ev.comentariosPlan || ev.medicalRoundSummary) && (
                    <div className="bg-amber-50/90 dark:bg-amber-950/35 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs space-y-1">
                      <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500" /> Comentarios y Plan (Revista Médica):
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {ev.comentariosPlan || ev.medicalRoundSummary}
                      </p>
                    </div>
                  )}

                  {/* Inline Collapsible Preview of Associated Órdenes Médicas */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrdersByEvId(prev => ({ ...prev, [ev.id]: !prev[ev.id] }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/18 border border-amber-500/35 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          Órdenes Médicas de esta Evolución ({resolvedOrders.orders.length} indicaciones)
                        </span>
                      </span>
                      <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <span>{isOrdersExpanded ? 'Ocultar órdenes' : 'Ver órdenes aquí'}</span>
                        {isOrdersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </button>

                    {isOrdersExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-amber-400/50 dark:border-amber-500/40 space-y-1.5 animate-quick-jump-slide-in">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Fecha: {resolvedOrders.fecha} · Hora: {resolvedOrders.hora} · Peso: {resolvedOrders.peso} kg
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenOrdenesModal(ev)}
                            className="text-[10.5px] font-black text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                          >
                            Abrir Hoja Oficial Carta →
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-56 overflow-y-auto pr-1">
                          {resolvedOrders.orders.map(ord => (
                            <div key={ord.id} className="py-1.5 flex items-start gap-2.5 text-[11px]">
                              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                {ord.itemNumber}
                              </span>
                              <div className="min-w-0 flex-1">
                                {ord.dosisCalculo && (
                                  <span className="inline-block mr-2 px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-800 dark:text-teal-300 font-mono font-bold text-[10px] border border-teal-500/30">
                                    {ord.dosisCalculo.replace(/\n/g, ' | ')}
                                  </span>
                                )}
                                <span className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line">
                                  {ord.descripcion}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 2. Full Dedicated Tab: "Calendario de Evoluciones & Órdenes Médicas"
 * Displays an interactive monthly calendar of evolutions on the left/top and a rich,
 * pleasant visual view of each evolution side-by-side with its associated Órdenes Médicas.
 */
export const PatientEvolutionsCalendarTab: React.FC<PatientEvolutionsViewProps> = ({
  patient,
  onOpenOrdenesModal,
  onOpenPrintEvolutionModal,
  onBackToProfile,
  initialSelectedDate = null,
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const availableMonths = useMemo(() => getAvailableEvolutionMonths(patient), [patient]);

  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => {
    if (initialSelectedDate && /^\d{4}-\d{2}-\d{2}$/.test(initialSelectedDate)) {
      return initialSelectedDate.slice(0, 7);
    }
    return availableMonths[0]?.monthKey || new Date().toISOString().slice(0, 7);
  });

  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(initialSelectedDate);
  const [expandedExamByEvId, setExpandedExamByEvId] = useState<Record<string, boolean>>({});
  const [layoutMode, setLayoutMode] = useState<'integrated' | 'compact'>('integrated');

  const calendarCells = useMemo(
    () => buildMonthCalendarGrid(activeMonthKey, patient),
    [activeMonthKey, patient]
  );

  const activeMonthMeta = useMemo(() => {
    const [yStr, mStr] = activeMonthKey.split('-');
    const formatted = formatEvolutionSpanishDate(`${yStr}-${mStr}-01`);
    return `${formatted.monthFull} ${formatted.year}`;
  }, [activeMonthKey]);

  // Unique evolved dates sorted newest first
  const evolvedDatesList = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of patient.evolutions || []) {
      if (ev.date) {
        map.set(ev.date, (map.get(ev.date) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [patient.evolutions]);

  const visibleEvolutions = useMemo(() => {
    const all = patient.evolutions || [];
    if (!selectedDateFilter) return all;
    return all.filter(ev => ev.date === selectedDateFilter);
  }, [patient.evolutions, selectedDateFilter]);

  const handleSelectDateOnCalendar = (dateStr: string) => {
    setSelectedDateFilter(prev => (prev === dateStr ? null : dateStr));
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setActiveMonthKey(dateStr.slice(0, 7));
    }
  };

  return (
    <div data-tutorial="profile-calendario-evoluciones-view" className="space-y-5 animate-quick-jump-slide-in">
      {/* Top Action & Summary Banner */}
      <div className={`${themeTokens.cardSurface} p-4 rounded-2xl border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div className="flex items-start sm:items-center gap-3 flex-wrap">
          {onBackToProfile && (
            <button
              type="button"
              onClick={onBackToProfile}
              className="px-3.5 py-2 rounded-xl bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Perfil & Archivos</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/40 text-[10px] font-black uppercase tracking-wider">
                Calendario Clínico Interactivo
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Ingreso: <strong className="font-mono text-slate-900 dark:text-white">{patient.admissionDate}</strong>
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
              Calendario de Evoluciones Diarias & Órdenes Médicas — {patient.lastName}, {patient.firstName}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLayoutMode('integrated')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                layoutMode === 'integrated'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Evolución + Órdenes Lado a Lado</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('compact')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                layoutMode === 'compact'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Vista Compacta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Calendar (Left) + Visual Evolutions with Medical Orders (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: MONTHLY CALENDAR OF EVOLUTIONS */}
        <div className={`${themeTokens.cardSurface} xl:col-span-4 p-4 rounded-2xl border shadow-sm space-y-4 xl:sticky xl:top-4`}>
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-300" />
              </div>
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Calendario de Evoluciones
                </h5>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Toca un día con evolución para filtrar
                </p>
              </div>
            </div>
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter(null)}
                className="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-800 dark:text-teal-300 border border-teal-500/35 text-[10.5px] font-black cursor-pointer"
              >
                Ver todas ({patient.evolutions.length})
              </button>
            )}
          </div>

          {/* Month Selector Bar */}
          <div className="flex items-center justify-between gap-2 bg-slate-100/80 dark:bg-slate-900/70 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveMonthKey(prev => shiftMonthKey(prev, -1))}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {activeMonthMeta}
            </span>
            <button
              type="button"
              onClick={() => setActiveMonthKey(prev => shiftMonthKey(prev, 1))}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Month Pills for Months with Evolutions */}
          {availableMonths.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {availableMonths.map(m => (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => setActiveMonthKey(m.monthKey)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 transition-all cursor-pointer ${
                    activeMonthKey === m.monthKey
                      ? 'bg-teal-600 text-white border-teal-500'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {m.shortLabel} ({m.evolutionsCount})
                </button>
              ))}
            </div>
          )}

          {/* 7-Column Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div
                key={day}
                className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-1"
              >
                {day}
              </div>
            ))}

            {/* 42 Calendar Day Cells */}
            {calendarCells.map(cell => {
              const hasEv = cell.evolutions.length > 0;
              const isSelected = selectedDateFilter === cell.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => hasEv && handleSelectDateOnCalendar(cell.dateStr)}
                  disabled={!hasEv}
                  title={
                    hasEv
                      ? `${cell.dateStr}: ${cell.evolutions.length} evolución(es) · ${cell.ordersCount} órdenes médicas`
                      : cell.isAdmissionDate
                        ? `${cell.dateStr}: Fecha de Ingreso`
                        : cell.dateStr
                  }
                  className={`relative min-h-[54px] p-1 rounded-xl border flex flex-col items-center justify-between transition-all ${
                    !cell.isCurrentMonth ? 'opacity-35' : ''
                  } ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-400 ring-2 ring-teal-400 shadow-md scale-[1.03] cursor-pointer'
                      : hasEv
                        ? cell.isReingresoDate
                          ? 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-950 dark:text-orange-100 border-orange-400 dark:border-orange-500/60 cursor-pointer hover:scale-[1.02]'
                          : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-950 dark:text-teal-100 border-teal-400/80 dark:border-teal-500/60 cursor-pointer hover:scale-[1.02]'
                        : cell.isAdmissionDate
                          ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-400/50 cursor-default'
                          : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 border-slate-200/60 dark:border-slate-800/60 cursor-default'
                  }`}
                >
                  <div className="w-full flex items-center justify-between px-0.5">
                    <span className={`text-xs font-black font-mono ${isSelected ? 'text-white' : ''}`}>
                      {cell.dayNumber}
                    </span>
                    {cell.isAdmissionDate && (
                      <span
                        className={`text-[8px] font-black px-1 rounded ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300'
                        }`}
                      >
                        ING
                      </span>
                    )}
                  </div>

                  {hasEv ? (
                    <div className="w-full flex flex-col items-center gap-0.5">
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                          isSelected
                            ? 'bg-white text-teal-900'
                            : 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                        }`}
                      >
                        {cell.evolutions.length} evol.
                      </span>
                      {cell.hasOrders && (
                        <span
                          className={`text-[8px] font-extrabold leading-none ${
                            isSelected ? 'text-amber-200' : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          📋 Órdenes
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[8px] opacity-0">·</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-500/30 border border-teal-500 inline-block" />
              Día con Evolución + Órdenes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-500/25 border border-indigo-500 inline-block" />
              Fecha de Ingreso (ING)
            </span>
          </div>

          {/* Quick Chronological Date Pills List */}
          {evolvedDatesList.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Fechas con Evolución ({evolvedDatesList.length} días):
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter(null)}
                  className={`text-[10px] font-black cursor-pointer ${
                    selectedDateFilter === null
                      ? 'text-teal-600 dark:text-teal-400 underline'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Mostrar todas
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {evolvedDatesList.map(([dateStr, count]) => {
                  const fmt = formatEvolutionSpanishDate(dateStr);
                  const stayDay = computeHospitalizationDayNumber(dateStr, patient.admissionDate);
                  const active = selectedDateFilter === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleSelectDateOnCalendar(dateStr)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-teal-500/60'
                      }`}
                    >
                      <span>
                        {fmt.dayNum} {fmt.monthShort}
                      </span>
                      {stayDay !== null && (
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300'}`}>
                          Día {stayDay}
                        </span>
                      )}
                      {count > 1 && <span className="opacity-80">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RICH VISUAL EVOLUTIONS + SIDE-BY-SIDE ÓRDENES MÉDICAS */}
        <div className="xl:col-span-8 space-y-4">
          {/* Active Filter Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {selectedDateFilter
                  ? `Evoluciones del ${formatEvolutionSpanishDate(selectedDateFilter).fullFormatted} (${visibleEvolutions.length})`
                  : `Todas las Evoluciones Registradas con sus Órdenes Médicas (${visibleEvolutions.length})`}
              </span>
            </div>
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter(null)}
                className="text-xs font-black text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
              >
                ← Ver línea de tiempo completa ({patient.evolutions.length})
              </button>
            )}
          </div>

          {visibleEvolutions.length === 0 ? (
            <div className={`${themeTokens.cardSurface} p-8 rounded-2xl border text-center space-y-2`}>
              <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                No hay evoluciones registradas en la fecha seleccionada
              </p>
              {selectedDateFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter(null)}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-black cursor-pointer"
                >
                  Mostrar todas las evoluciones
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {visibleEvolutions.map((ev, idx) => {
                const fmtDate = formatEvolutionSpanishDate(ev.date);
                const stayDay = computeHospitalizationDayNumber(ev.date, patient.admissionDate);
                const resolvedOrders = resolveOrdersForEvolution(patient, ev);
                const isExamOpen = Boolean(expandedExamByEvId[ev.id]);

                const populatedExamEntries = EXAM_FIELD_LABELS.filter(
                  item => ev.examenFisico && Boolean(ev.examenFisico[item.key]?.trim())
                );

                return (
                  <div
                    key={ev.id}
                    className={`${themeTokens.cardSurface} rounded-3xl border-2 border-slate-200/90 dark:border-slate-700/90 shadow-md overflow-hidden transition-all`}
                  >
                    {/* Card Top Banner */}
                    <div className="bg-gradient-to-r from-teal-500/15 via-cyan-500/10 to-amber-500/15 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2 border-2 border-teal-500/60 flex flex-col items-center justify-center shrink-0 shadow-xs">
                          <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400">
                            {fmtDate.monthShort}
                          </span>
                          <span className="text-2xl font-black leading-none py-0.5 text-slate-900 dark:text-white">
                            {fmtDate.dayNum}
                          </span>
                          <span className="text-[9px] font-mono font-extrabold text-slate-500">
                            {fmtDate.year}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                              {fmtDate.fullFormatted}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-teal-600 text-white text-[10.5px] font-mono font-black">
                              {ev.time} hrs
                            </span>
                            {stayDay !== null && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border border-indigo-500/40 text-[10.5px] font-black">
                                Día {stayDay} de Hospitalización
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              Médico: <strong className="text-slate-900 dark:text-white font-black">{ev.doctorName}</strong>
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-amber-800 dark:text-amber-300 font-black flex items-center gap-1">
                              <ClipboardList className="w-3.5 h-3.5" />
                              {resolvedOrders.orders.length} Órdenes Médicas
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenOrdenesModal(ev)}
                          className="ordenes-btn-neon-yellow px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 border border-yellow-300 font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-950" />
                          <span>Hoja de Órdenes (PDF)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPrintEvolutionModal(ev)}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Hoja de Evolución (PDF)</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Body: Side-by-Side Evolution + Medical Orders */}
                    <div
                      className={`p-4 grid gap-4 ${
                        layoutMode === 'integrated' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
                      }`}
                    >
                      {/* Sub-column A: Clinical Evolution Details */}
                      <div className={`${layoutMode === 'integrated' ? 'lg:col-span-7' : ''} space-y-3`}>
                        {/* Vital Signs Strip */}
                        {renderVitalSignsStrip(ev, patient.weightKg)}

                        {/* Subjetivo */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5" />
                              1. Subjetivo (Evolución 24 Horas)
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                            {ev.subjetivo || ev.interrogatory24h || 'Sin eventualidades subjetivas reportadas en las últimas 24 horas.'}
                          </p>
                        </div>

                        {/* Objetivo */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                              <HeartPulse className="w-3.5 h-3.5" />
                              2. Objetivo & Examen Físico del Día
                            </span>
                            {populatedExamEntries.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedExamByEvId(prev => ({ ...prev, [ev.id]: !prev[ev.id] }))
                                }
                                className="text-[10.5px] font-black text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>
                                  {isExamOpen
                                    ? 'Ocultar desglose por sistemas'
                                    : `Ver examen por sistemas (${populatedExamEntries.length})`}
                                </span>
                                {isExamOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                            {ev.objetivo || ev.evolutionNote || 'Paciente hemodinámicamente estable, examen físico documentado por aparatos y sistemas.'}
                          </p>

                          {isExamOpen && populatedExamEntries.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-quick-jump-slide-in">
                              {populatedExamEntries.map(item => (
                                <div
                                  key={item.key}
                                  className="p-2 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px]"
                                >
                                  <span className="font-black text-teal-800 dark:text-teal-300 block text-[10px] uppercase">
                                    {item.label}
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {ev.examenFisico[item.key]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Diagnósticos y Tratamiento de la Evolución */}
                        {(ev.diagnosesModified || ev.treatmentModified) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {ev.diagnosesModified && (
                              <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300 block">
                                  Diagnósticos del Día
                                </span>
                                <p className="text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                                  {ev.diagnosesModified}
                                </p>
                              </div>
                            )}
                            {ev.treatmentModified && (
                              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                                  Tratamiento Cumplido
                                </span>
                                <p className="text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                                  {ev.treatmentModified}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Comentarios y Plan / Revista Médica */}
                        {(ev.comentariosPlan || ev.medicalRoundSummary) && (
                          <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300/80 dark:border-amber-700/60 space-y-1">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              3. Comentarios y Plan (Revista Médica)
                            </span>
                            <p className="text-xs text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed font-medium">
                              {ev.comentariosPlan || ev.medicalRoundSummary}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Sub-column B: Associated Órdenes Médicas Card */}
                      <div
                        data-tutorial={idx === 0 ? 'calendar-card-ordenes-panel' : undefined}
                        className={`${
                          layoutMode === 'integrated' ? 'lg:col-span-5' : ''
                        } rounded-2xl border-2 border-amber-400/70 dark:border-amber-500/45 bg-gradient-to-b from-amber-50/60 via-white to-white dark:from-amber-950/25 dark:via-slate-900/90 dark:to-slate-900/95 flex flex-col overflow-hidden shadow-xs`}
                      >
                        <div className="px-3.5 py-2.5 bg-amber-400/20 dark:bg-amber-500/15 border-b border-amber-300/70 dark:border-amber-700/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-amber-800 dark:text-amber-300 shrink-0" />
                            <div>
                              <h6 className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200">
                                Órdenes Médicas Asociadas
                              </h6>
                              <p className="text-[10px] font-bold text-amber-800/90 dark:text-amber-300/80 font-mono">
                                Fecha: {resolvedOrders.fecha} · {resolvedOrders.hora} hrs · Peso: {resolvedOrders.peso} kg
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenOrdenesModal(ev)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10.5px] transition-all cursor-pointer shrink-0"
                          >
                            Ver Hoja →
                          </button>
                        </div>

                        <div className="p-3 divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto">
                          {resolvedOrders.orders.map(ord => (
                            <div key={ord.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5 text-xs">
                              <span className="w-5 h-5 rounded-md bg-amber-500/25 text-amber-950 dark:text-amber-200 font-mono font-black text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/40">
                                {ord.itemNumber}
                              </span>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                {ord.dosisCalculo && (
                                  <div>
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-800 dark:text-teal-300 font-mono font-bold text-[10px] border border-teal-500/30">
                                      Cálculo: {ord.dosisCalculo.replace(/\n/g, ' | ')}
                                    </span>
                                  </div>
                                )}
                                <p className="text-[11.5px] text-slate-800 dark:text-slate-100 font-medium leading-snug whitespace-pre-line">
                                  {ord.descripcion}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
