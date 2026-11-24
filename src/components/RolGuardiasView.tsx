import React, { useState, useMemo } from 'react';
import { RolGuardiasData, GuardiaGroup } from '../types';
import { getGroupIcon } from '../services/storage';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import {
  CalendarDays,
  Users,
  Search,
  MapPin,
  Stethoscope,
  Clock,
  ArrowLeft,
  Info,
  Sparkles,
} from 'lucide-react';

interface Props {
  guardias: RolGuardiasData;
  isAdmin?: boolean;
  isOnline?: boolean;
  onSyncGuardias?: () => Promise<void>;
  onOpenAdminGuardias?: () => void;
  onBackToWard?: () => void;
}

const DEFAULT_GUARDIA_AREAS: string[] = [
  'Triaje',
  'Hospitalización / Observación',
  'Sala de Parto / Quirófano',
  'Guardia General',
  'Control de Niño Sano / Nutrición'
];

interface AccentStyle {
  badge: string;
  border: string;
  pill: string;
  activeDay: string;
  dot: string;
  bannerCard: string;
  textAccent: string;
  softBg: string;
}

const GROUP_ACCENT_CLASSES: Record<string, AccentStyle> = {
  teal: {
    badge: 'bg-teal-100/90 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/40',
    border: 'border-teal-300 dark:border-teal-500/40',
    pill: 'bg-teal-700 dark:bg-teal-600 text-white',
    activeDay: 'bg-teal-700 dark:bg-teal-600 text-white border-teal-500 dark:border-teal-400 font-black ring-2 ring-teal-500/40 dark:ring-teal-300 shadow-sm scale-[1.03]',
    dot: 'bg-teal-600 dark:bg-teal-500',
    bannerCard: 'bg-teal-50/90 dark:bg-teal-950/60 border-teal-300 dark:border-teal-500/40',
    textAccent: 'text-teal-800 dark:text-teal-400',
    softBg: 'bg-teal-50/70 dark:bg-teal-500/10'
  },
  cyan: {
    badge: 'bg-cyan-100/90 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40',
    border: 'border-cyan-300 dark:border-cyan-500/40',
    pill: 'bg-cyan-700 dark:bg-cyan-600 text-white',
    activeDay: 'bg-cyan-700 dark:bg-cyan-600 text-white border-cyan-500 dark:border-cyan-400 font-black ring-2 ring-cyan-500/40 dark:ring-cyan-300 shadow-sm scale-[1.03]',
    dot: 'bg-cyan-600 dark:bg-cyan-500',
    bannerCard: 'bg-cyan-50/90 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-500/40',
    textAccent: 'text-cyan-800 dark:text-cyan-400',
    softBg: 'bg-cyan-50/70 dark:bg-cyan-500/10'
  },
  amber: {
    badge: 'bg-amber-100/90 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
    border: 'border-amber-300 dark:border-amber-500/40',
    pill: 'bg-amber-600 dark:bg-amber-500 text-white dark:text-slate-950',
    activeDay: 'bg-amber-600 dark:bg-amber-500 text-white dark:text-slate-950 border-amber-400 dark:border-amber-300 font-black ring-2 ring-amber-500/40 dark:ring-amber-200 shadow-sm scale-[1.03]',
    dot: 'bg-amber-600 dark:bg-amber-500',
    bannerCard: 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-500/40',
    textAccent: 'text-amber-800 dark:text-amber-300',
    softBg: 'bg-amber-50/70 dark:bg-amber-500/10'
  },
  indigo: {
    badge: 'bg-indigo-100/90 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40',
    border: 'border-indigo-300 dark:border-indigo-500/40',
    pill: 'bg-indigo-700 dark:bg-indigo-600 text-white',
    activeDay: 'bg-indigo-700 dark:bg-indigo-600 text-white border-indigo-500 dark:border-indigo-400 font-black ring-2 ring-indigo-500/40 dark:ring-indigo-300 shadow-sm scale-[1.03]',
    dot: 'bg-indigo-600 dark:bg-indigo-500',
    bannerCard: 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-500/40',
    textAccent: 'text-indigo-800 dark:text-indigo-300',
    softBg: 'bg-indigo-50/70 dark:bg-indigo-500/10'
  },
  emerald: {
    badge: 'bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
    border: 'border-emerald-300 dark:border-emerald-500/40',
    pill: 'bg-emerald-700 dark:bg-emerald-600 text-white',
    activeDay: 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-500 dark:border-emerald-400 font-black ring-2 ring-emerald-500/40 dark:ring-emerald-300 shadow-sm scale-[1.03]',
    dot: 'bg-emerald-600 dark:bg-emerald-500',
    bannerCard: 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40',
    textAccent: 'text-emerald-800 dark:text-emerald-400',
    softBg: 'bg-emerald-50/70 dark:bg-emerald-500/10'
  },
  rose: {
    badge: 'bg-rose-100/90 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
    border: 'border-rose-300 dark:border-rose-500/40',
    pill: 'bg-rose-700 dark:bg-rose-600 text-white',
    activeDay: 'bg-rose-700 dark:bg-rose-600 text-white border-rose-500 dark:border-rose-400 font-black ring-2 ring-rose-500/40 dark:ring-rose-300 shadow-sm scale-[1.03]',
    dot: 'bg-rose-600 dark:bg-rose-500',
    bannerCard: 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40',
    textAccent: 'text-rose-800 dark:text-rose-300',
    softBg: 'bg-rose-50/70 dark:bg-rose-500/10'
  }
};

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getShortGroupCode(nombreGrupo: string): string {
  const clean = nombreGrupo.trim();
  const romanOrNum = clean.match(/Grupo\s+([IVX]+|\d+|[A-Z]+)/i);
  if (romanOrNum) return `G-${romanOrNum[1]}`;
  return clean.replace(/Grupo\s+/i, 'G-').slice(0, 6);
}

export const RolGuardiasView: React.FC<Props> = ({
  guardias,
  isAdmin = false,
  isOnline = true,
  onSyncGuardias,
  onOpenAdminGuardias,
  onBackToWard
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const now = new Date();
  const isCurrentCalendarMonth =
    now.getFullYear() === (guardias.anio || now.getFullYear()) &&
    now.getMonth() + 1 === (guardias.mesNumero || now.getMonth() + 1);
  const todayDay = isCurrentCalendarMonth ? now.getDate() : 1;

  const [selectedDay, setSelectedDay] = useState<number>(todayDay);
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { daysInMonth, leadingEmptyCells } = useMemo(() => {
    const year = guardias.anio || 2026;
    const month = guardias.mesNumero || 11;
    const total = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Dom..6=Sáb
    return {
      daysInMonth: Array.from({ length: total }, (_, i) => i + 1),
      leadingEmptyCells: Array.from({ length: firstWeekday }, (_, i) => i)
    };
  }, [guardias.anio, guardias.mesNumero]);

  const availableAreas = useMemo(() => {
    const set = new Set<string>(DEFAULT_GUARDIA_AREAS);
    (guardias.grupos || []).forEach(g => {
      (g.areas || []).forEach(a => {
        if (a && a.trim()) set.add(a.trim());
      });
      (g.miembros || []).forEach(m => {
        if (m.area && m.area.trim()) set.add(m.area.trim());
      });
    });
    return Array.from(set);
  }, [guardias.grupos]);

  const getGroupsForDay = (day: number): GuardiaGroup[] => {
    return (guardias.grupos || []).filter(g => Array.isArray(g.diasDelMes) && g.diasDelMes.includes(day));
  };

  const selectedDayGroups = useMemo(
    () => getGroupsForDay(selectedDay),
    [guardias.grupos, selectedDay]
  );

  const matchesArea = (group: GuardiaGroup, filter: string): boolean => {
    if (filter === 'ALL') return true;
    const target = filter.toLowerCase().trim();
    const areaMatches = (text: string) => {
      const lower = (text || '').toLowerCase().trim();
      return lower === target || lower.includes(target);
    };
    return (
      (group.areas || []).some(areaMatches) ||
      (group.miembros || []).some(m => areaMatches(m.area || ''))
    );
  };

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (guardias.grupos || []).filter(group => {
      if (groupFilter !== 'ALL' && group.id !== groupFilter) return false;
      if (!matchesArea(group, areaFilter)) return false;
      if (!q) return true;
      return (
        group.nombreGrupo.toLowerCase().includes(q) ||
        (group.jefeGuardia || '').toLowerCase().includes(q) ||
        (group.areas || []).some(a => a.toLowerCase().includes(q)) ||
        (group.miembros || []).some(
          m =>
            m.nombre.toLowerCase().includes(q) ||
            m.rol.toLowerCase().includes(q) ||
            (m.area || '').toLowerCase().includes(q)
        )
      );
    });
  }, [guardias.grupos, areaFilter, groupFilter, searchQuery]);

  return (
    <div className={`border rounded-2xl p-4 sm:p-6 shadow-xs space-y-6 transition-colors ${themeTokens.cardSurface}`}>
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 ${themeTokens.sectionDivider}`}>
        <div className="flex items-start gap-3">
          {onBackToWard && (
            <button
              type="button"
              onClick={onBackToWard}
              className="p-2 rounded-xl bg-black/5 dark:bg-slate-800 hover:bg-black/10 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              title="Volver al inicio"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className={`w-5 h-5 ${themeTokens.accentIcon}`} />
                Rol de Guardias · {guardias.mes || 'Noviembre 2026'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${themeTokens.accentBadge}`}>
                {(guardias.grupos || []).length} Grupos Activos
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isOnline
                  ? 'bg-emerald-600/12 text-emerald-800 dark:text-emerald-300 border-emerald-600/30'
                  : 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/30'
              }`}>
                {isOnline ? 'Sincronizado Supabase' : 'Modo Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {guardias.hospital || 'Hospital Materno Infantil'} · {guardias.servicio || 'Pediatría y Puericultura'} — Distribución mensual de guardias, equipos médicos y áreas asistenciales.
            </p>
          </div>
        </div>


      </div>

      {/* Guardia del Día Seleccionado Banner */}
      <div
        data-tutorial="guardias-today-banner"
        className={`border rounded-2xl p-4 space-y-3 shadow-xs dark:shadow-md ${themeTokens.cardInnerSurface}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${themeTokens.accentIcon}`} />
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${themeTokens.accentText}`}>
              {isCurrentCalendarMonth && selectedDay === todayDay
                ? `Guardia de Hoy · Día ${selectedDay} (${guardias.mes})`
                : `Guardia Programada · Día ${selectedDay} (${guardias.mes})`}
            </h3>
          </div>
          {isCurrentCalendarMonth && selectedDay !== todayDay && (
            <button
              type="button"
              onClick={() => setSelectedDay(todayDay)}
              className={`text-[11px] font-bold underline cursor-pointer ${themeTokens.accentText}`}
            >
              Ir al día de hoy ({todayDay})
            </button>
          )}
        </div>

        {selectedDayGroups.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 italic">
            No hay un grupo asignado específicamente al día {selectedDay} en el calendario actual.
          </p>
        ) : (
          <div className={`grid grid-cols-1 ${selectedDayGroups.length > 1 ? 'md:grid-cols-2' : ''} gap-3`}>
            {selectedDayGroups.map(grp => {
              const style = GROUP_ACCENT_CLASSES[grp.color || 'teal'] || GROUP_ACCENT_CLASSES.teal;
              const groupIcon = grp.icon || getGroupIcon(grp.nombreGrupo);
              return (
                <div key={'day-grp-' + grp.id} className={`${style.bannerCard} border rounded-xl p-3.5 space-y-2.5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 ${style.pill}`}>
                        <span>{groupIcon}</span>
                        <span>{grp.nombreGrupo}</span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {(grp.miembros || []).length} médicos de guardia
                      </span>
                    </div>
                    {grp.jefeGuardia && (
                      <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/35">
                        Jefe: {grp.jefeGuardia}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(grp.areas || []).map(area => (
                      <span
                        key={area}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700 flex items-center gap-1"
                      >
                        <MapPin className={`w-2.5 h-2.5 ${style.textAccent}`} /> {area}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {(grp.miembros || []).map(m => (
                      <div
                        key={m.id}
                        className="text-[11px] bg-white/95 dark:bg-slate-900/90 px-2.5 py-2 rounded-lg border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-1 shadow-2xs"
                      >
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                          <span className="truncate">{m.nombre}</span>
                        </span>
                        <span className={`text-[10px] font-bold ${style.textAccent} leading-tight`}>
                          {m.area}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Calendario Mensual de Guardias */}
      <div
        data-tutorial="guardias-calendar"
        className={`border rounded-2xl p-3.5 sm:p-4 space-y-3 ${themeTokens.cardInnerSurface}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className={`w-3.5 h-3.5 ${themeTokens.accentIcon}`} /> Calendario de Guardias ({guardias.mes}) — Toca un día para ver el equipo
          </h3>

          {/* Leyenda de los 6 grupos con sus iconos y colores */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            {(guardias.grupos || []).map(g => {
              const style = GROUP_ACCENT_CLASSES[g.color || 'teal'] || GROUP_ACCENT_CLASSES.teal;
              const gIcon = g.icon || getGroupIcon(g.nombreGrupo);
              const isGroupFiltered = groupFilter === g.id;
              return (
                <button
                  key={'leg-' + g.id}
                  type="button"
                  onClick={() => setGroupFilter(prev => (prev === g.id ? 'ALL' : g.id))}
                  title={`Filtrar por ${g.nombreGrupo}`}
                  className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                    isGroupFiltered ? style.pill + ' border-transparent shadow-sm' : style.badge + ' hover:opacity-90'
                  }`}
                >
                  <span>{gIcon}</span>
                  <span>{g.nombreGrupo}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cabecera Días de la Semana */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
          {WEEKDAY_LABELS.map(wd => (
            <div
              key={wd}
              className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-1"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Grilla Calendario 7 columnas */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 tabular-nums">
          {leadingEmptyCells.map(idx => (
            <div key={'empty-' + idx} className="min-h-[64px] sm:min-h-[76px] rounded-xl bg-transparent" />
          ))}

          {daysInMonth.map(day => {
            const grps = getGroupsForDay(day);
            const primary = grps[0];
            const style = primary
              ? GROUP_ACCENT_CLASSES[primary.color || 'teal'] || GROUP_ACCENT_CLASSES.teal
              : null;
            const isSelected = selectedDay === day;
            const isToday = isCurrentCalendarMonth && todayDay === day;
            const isDimmed =
              groupFilter !== 'ALL' && !grps.some(g => g.id === groupFilter);

            return (
              <button
                key={'cal-day-' + day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative p-1.5 sm:p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[64px] sm:min-h-[76px] shadow-xs ${
                  isSelected && style
                    ? style.activeDay
                    : isSelected
                    ? 'bg-teal-600 text-white border-teal-400 shadow-md scale-[1.03] font-black'
                    : style
                    ? `${style.badge} hover:opacity-95 ${isToday ? 'ring-2 ring-slate-900 dark:ring-white font-black' : ''}`
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                } ${isDimmed && !isSelected ? 'opacity-35' : ''}`}
              >
                <div className="w-full flex items-center justify-between gap-0.5">
                  <span className="text-xs sm:text-sm font-black leading-none">{day}</span>
                  {isToday && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                      isSelected ? 'bg-white/30 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    }`}>
                      Hoy
                    </span>
                  )}
                </div>

                <div className="w-full flex flex-col items-center justify-center gap-1 my-auto">
                  {primary ? (
                    <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/70 dark:bg-white/10 text-[11px] sm:text-xs font-black tracking-tight max-w-full shadow-2xs">
                      <span className="text-sm sm:text-base leading-none shrink-0">{primary.icon || getGroupIcon(primary.nombreGrupo)}</span>
                      <span className="truncate">{grps.map(g => getShortGroupCode(g.nombreGrupo)).join('/')}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">—</span>
                  )}
                  {primary && primary.miembros && primary.miembros.length > 0 && (
                    <span className="hidden md:block text-[8.5px] font-bold truncate max-w-full opacity-90 leading-tight">
                      {primary.miembros.map(m => m.nombre.replace(/^(Dr\.|Dra\.)\s*/i, '')).join(', ')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border ${themeTokens.cardInnerSurface}`}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="ALL">Todas las Áreas Asistenciales</option>
            {availableAreas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="ALL">Todos los Grupos</option>
            {(guardias.grupos || []).map(g => (
              <option key={g.id} value={g.id}>
                {(g.icon || getGroupIcon(g.nombreGrupo))} {g.nombreGrupo}
              </option>
            ))}
          </select>

          {(areaFilter !== 'ALL' || groupFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setAreaFilter('ALL');
                setGroupFilter('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar médico, rol, grupo o área..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className={`py-10 text-center text-xs text-slate-600 dark:text-slate-400 rounded-2xl border border-dashed ${themeTokens.cardInnerSurface}`}>
          No se encontraron grupos o médicos que coincidan con el filtro aplicado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map(group => {
            const style = GROUP_ACCENT_CLASSES[group.color || 'teal'] || GROUP_ACCENT_CLASSES.teal;
            const gIcon = group.icon || getGroupIcon(group.nombreGrupo);
            return (
              <div
                key={group.id}
                className={`border ${style.border} rounded-2xl p-4 space-y-3 shadow-xs ${themeTokens.cardInnerSurface}`}
              >
                <div className={`flex items-start justify-between gap-2 border-b pb-3 ${themeTokens.sectionDivider}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 ${style.pill}`}>
                        <span>{gIcon}</span>
                        <span>{group.nombreGrupo}</span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Users className={`w-3.5 h-3.5 ${themeTokens.accentIcon}`} /> {(group.miembros || []).length} médicos
                      </span>
                    </div>
                    {group.jefeGuardia && (
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1.5">
                        Jefe de Guardia: <span className={themeTokens.accentText}>{group.jefeGuardia}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Areas */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Áreas Asignadas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(group.areas || []).map(area => (
                      <span
                        key={area}
                        className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold flex items-center gap-1 ${style.badge}`}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Days of Month */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Días de Guardia ({guardias.mes}):
                  </span>
                  <div className="flex flex-wrap gap-1 tabular-nums">
                    {(group.diasDelMes || []).length > 0 ? (
                      group.diasDelMes.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDay(d)}
                          className={`w-7 h-7 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            d === selectedDay
                              ? style.pill + ' border-transparent shadow-sm'
                              : isCurrentCalendarMonth && d === todayDay
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/60 font-black'
                              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                          }`}
                        >
                          {d}
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] italic text-slate-500 dark:text-slate-400">Sin días asignados</span>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Integrantes del Equipo de Guardia:
                  </span>
                  {(group.miembros || []).length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">No hay integrantes asignados a este grupo.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {group.miembros.map(member => (
                        <div
                          key={member.id}
                          className="bg-white/95 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                            <Stethoscope className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{member.nombre}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${style.badge}`}>
                              {member.area}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Turnos adicionales importados en JSON */}
      {guardias.turnos && guardias.turnos.length > 0 && (
        <div className={`border rounded-2xl p-4 space-y-3 ${themeTokens.cardInnerSurface}`}>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Detalle de Turnos Específicos ({guardias.turnos.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-300 dark:border-slate-800 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Grupo</th>
                  <th className="py-2 px-2">Área</th>
                  <th className="py-2 px-2">Médico</th>
                  <th className="py-2 px-2">Rol</th>
                  <th className="py-2 px-2">Horario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {guardias.turnos.map(t => (
                  <tr key={t.id} className="hover:bg-white/75 dark:hover:bg-slate-900/60">
                    <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-slate-200">{t.fecha}</td>
                    <td className={`py-2 px-2 font-bold ${themeTokens.accentText}`}>{t.grupo}</td>
                    <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{t.area}</td>
                    <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">{t.medico}</td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{t.rol}</td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{t.horario || '24 horas'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className={`flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 px-3.5 py-2.5 rounded-xl border ${themeTokens.cardInnerSurface}`}>
          <Info className={`w-4 h-4 shrink-0 ${themeTokens.accentIcon}`} />
          <span>El administrador actualiza mensualmente el rol de guardias desde el Panel de Control (sincronizado con Supabase).</span>
        </div>
      )}
    </div>
  );
};
