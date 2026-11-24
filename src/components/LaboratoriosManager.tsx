import React, { useState, useEffect, useRef } from 'react';
import { useSeasonalTheme } from '../utils/seasonalTheme';
import { Patient, HistoriaClinicaPediatrica } from '../types';
import { 
  PEDIATRIC_LAB_CONFIGS, 
  evaluateLabValue, 
  getPatientLabAlerts, 
} from '../utils/pediatricLabAlerts';
import { 
  FlaskConical, CheckCircle2, AlertTriangle, Calendar, 
  Save, ArrowLeft, Check, FileText, Zap, ArrowUp, Layers
} from 'lucide-react';

interface Props {
  patients: Patient[];
  historias: HistoriaClinicaPediatrica[];
  selectedPatientId?: string;
  onUpdateHistoria: (historia: HistoriaClinicaPediatrica) => void;
  onSelectPatient?: (patientId: string) => void;
  onOpenHistoriaClinicaForm?: (patient: Patient, tab?: 'editor' | 'preview') => void;
  onBackToWard?: () => void;
  readOnly?: boolean;
}

export const LaboratoriosManager: React.FC<Props> = ({
  patients,
  historias,
  selectedPatientId,
  onUpdateHistoria,
  onSelectPatient,
  onOpenHistoriaClinicaForm,
  onBackToWard,
  readOnly = false
}) => {
  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Active selected patient
  const [currentPatientId, setCurrentPatientId] = useState<string>(
    selectedPatientId || (patients.length > 0 ? patients[0].id : '')
  );

  useEffect(() => {
    if (selectedPatientId) {
      setCurrentPatientId(selectedPatientId);
    }
  }, [selectedPatientId]);

  const activePatient = patients.find(p => p.id === currentPatientId) || patients[0];

  // Find linked or matching Historia Clínica
  const activeHistoria = activePatient
    ? historias.find(h => h.id === activePatient.historiaClinicaId || h.numHistoria === activePatient.medicalHistoryNumber)
    : undefined;

  // Local state for the 8 columns of laboratories
  const [labColumns, setLabColumns] = useState<Array<{ fecha: string; valores: Record<string, string> }>>([]);
  const [observacionesOtros, setObservacionesOtros] = useState<string>('');
  const [activeColumnIdx, setActiveColumnIdx] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedSuccessBanner, setSavedSuccessBanner] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'focused' | 'matrix'>('focused');

  // Load existing lab data from HistoriaClinicaPediatrica (Page 7)
  useEffect(() => {
    if (activeHistoria && activeHistoria.laboratoriosColumnas) {
      const existing = [...activeHistoria.laboratoriosColumnas];
      while (existing.length < 8) {
        existing.push({ fecha: '', valores: {} });
      }
      setLabColumns(existing);
      setObservacionesOtros(activeHistoria.laboratoriosOtros || '');
    } else {
      setLabColumns(Array.from({ length: 8 }, () => ({ fecha: '', valores: {} })));
      setObservacionesOtros('');
    }
  }, [activePatient?.id, activeHistoria?.id]);

  const handleValueChange = (testName: string, val: string, colIdx: number) => {
    const updated = labColumns.map((col, idx) => {
      if (idx !== colIdx) return col;
      return {
        ...col,
        valores: {
          ...(col.valores || {}),
          [testName]: val
        }
      };
    });

    setLabColumns(updated);
    syncToHistoria(updated, observacionesOtros);
  };

  const handleDateChange = (dateVal: string, colIdx: number) => {
    const updated = labColumns.map((col, idx) => {
      if (idx !== colIdx) return col;
      return {
        ...col,
        fecha: dateVal
      };
    });

    setLabColumns(updated);
    syncToHistoria(updated, observacionesOtros);
  };

  const handleAutoFillNormalValues = (colIdx: number) => {
    const currentCols = [...labColumns];
    while (currentCols.length <= colIdx) {
      currentCols.push({ fecha: '', valores: {} });
    }

    const currentValores = { ...(currentCols[colIdx].valores || {}) };

    Object.entries(PEDIATRIC_LAB_CONFIGS).forEach(([testName, cfg]) => {
      if (!currentValores[testName] || currentValores[testName].trim() === '') {
        currentValores[testName] = cfg.normalValText;
      }
    });

    const updatedCol = {
      ...currentCols[colIdx],
      fecha: currentCols[colIdx].fecha || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }),
      valores: currentValores
    };

    const newCols = currentCols.map((c, i) => i === colIdx ? updatedCol : c);
    setLabColumns(newCols);
    syncToHistoria(newCols, observacionesOtros);

    setSavedSuccessBanner(true);
    setTimeout(() => setSavedSuccessBanner(false), 2500);
  };

  const handleSetSingleNormal = (testName: string, colIdx: number) => {
    const cfg = PEDIATRIC_LAB_CONFIGS[testName];
    if (!cfg) return;
    handleValueChange(testName, cfg.normalValText, colIdx);
  };

  const syncToHistoria = (
    columnsToSave: Array<{ fecha: string; valores: Record<string, string> }>,
    otrosText: string
  ) => {
    if (!activeHistoria) return;

    const updatedHistoria: HistoriaClinicaPediatrica = {
      ...activeHistoria,
      laboratoriosColumnas: columnsToSave,
      laboratoriosOtros: otrosText,
      updatedAt: new Date().toISOString()
    };

    onUpdateHistoria(updatedHistoria);
    setSavedSuccessBanner(true);
    setTimeout(() => setSavedSuccessBanner(false), 2000);
  };

  const activeAlerts = activePatient ? getPatientLabAlerts(activePatient, activeHistoria ? {
    ...activeHistoria,
    laboratoriosColumnas: labColumns
  } : undefined) : [];

  const allAnalytes = Object.keys(PEDIATRIC_LAB_CONFIGS);
  const categories = ['TODOS', 'Hematología', 'Química Sanguínea', 'Electrolitos', 'Coagulación', 'Perfil Lipídico', 'Gasometría & Otros'];

  const filteredAnalytes = allAnalytes.filter(testName => {
    const cfg = PEDIATRIC_LAB_CONFIGS[testName];
    if (selectedCategory !== 'TODOS' && cfg.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return testName.toLowerCase().includes(q) || cfg.category.toLowerCase().includes(q);
    }
    return true;
  });

  const { tokens: themeTokens } = useSeasonalTheme();
  return (
    <div ref={topRef} className="space-y-6">
      {/* Top Header & Patient Selection Bar */}
      <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 md:p-5 shadow-xs space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Módulo de Laboratorios Clínicos Pediátricos
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500 text-slate-950 uppercase">
                  Página 7 Sincronizada
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Seguimiento seriado de 8 columnas, valores de referencia pediátricos y detección automática de alertas fuera de rango.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onBackToWard && (
              <button
                onClick={onBackToWard}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a Camas
              </button>
            )}

            {activePatient && onOpenHistoriaClinicaForm && (
              <button
                onClick={() => onOpenHistoriaClinicaForm(activePatient, 'preview')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> Ver Historia Completa
              </button>
            )}
          </div>
        </div>

        {/* Patient Selector Strip */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
            Seleccionar Paciente Hospitalizado:
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {patients.map(p => {
              const isSelected = p.id === currentPatientId;
              const hasAlerts = p.id === activePatient?.id && activeAlerts.length > 0;

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setCurrentPatientId(p.id);
                    if (onSelectPatient) onSelectPatient(p.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-left border shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-500 shadow-md ring-2 ring-teal-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs">
                      {p.lastName}, {p.firstName}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      isSelected ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {p.bedNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] opacity-80 mt-0.5">
                    <span>H.C: {p.medicalHistoryNumber}</span>
                    <span>·</span>
                    <span>{p.age}</span>
                    {hasAlerts && (
                      <span className="flex items-center gap-0.5 text-amber-300 font-bold">
                        <AlertTriangle className="w-3 h-3" /> {activeAlerts.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Patient Banner & Alerts Bar */}
      {activePatient && (
        <div className="space-y-4">
          <div className={`${themeTokens.heroCard} border rounded-2xl p-4 shadow-sm dark:shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 font-black text-[10px] uppercase">
                  {activePatient.bedNumber} · {activePatient.area}
                </span>
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {activePatient.lastName}, {activePatient.firstName}
                </h3>
              </div>
              <p className="text-xs text-slate-700 dark:text-teal-200/90 font-medium mt-1">
                H.C: <span className="font-mono font-bold">{activePatient.medicalHistoryNumber}</span> · Edad: <span className="font-bold">{activePatient.age}</span> · Peso: <span className="font-bold">{activePatient.weightKg} kg</span> · Ingreso: {activePatient.admissionDate}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-100/90 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-black">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Sincronizado con Historia Clínica</span>
              </div>
            </div>
          </div>

          {/* Active Lab Alerts Header if any exist */}
          {activeAlerts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-900/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-bounce" />
                  <h4 className="font-black text-xs md:text-sm text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    Alertas de Laboratorio Detectadas ({activeAlerts.length} resultados fuera de rango)
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Estándares Pediátricos de Referencia
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-2 shadow-xs ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs">{alert.testName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
                        }`}>
                          {alert.alertTitle}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-black mt-1">
                        Valor: <span className="underline">{alert.currentValueText} {alert.unit}</span>
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Ref: {alert.referenceRangeText} · Muestra: {alert.sampleDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Controls: View Mode Switcher ("Cambiar vista") & 8 Sample Column Buttons */}
      <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 shadow-xs space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Column selector tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {Array.from({ length: 8 }).map((_, cIdx) => {
              const isSelected = activeColumnIdx === cIdx && viewMode === 'focused';
              const colDate = labColumns[cIdx]?.fecha;
              const hasValues = Object.keys(labColumns[cIdx]?.valores || {}).length > 0;

              return (
                <button
                  key={cIdx}
                  onClick={() => {
                    setActiveColumnIdx(cIdx);
                    setViewMode('focused');
                  }}
                  className={`px-3 py-2 rounded-xl text-center shrink-0 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-500 shadow-sm font-black ring-2 ring-teal-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 font-bold'
                  }`}
                >
                  <div className="text-xs">Muestra {cIdx + 1}</div>
                  <div className="text-[10px] opacity-80 font-mono">
                    {colDate || (hasValues ? 'Sin fecha' : 'Vacía')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cambiar vista & Quick Action Button */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Botón de Cambiar Vista requerido */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'matrix' ? 'focused' : 'matrix')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Cambiar entre Matriz de 8 columnas y Vista detallada"
            >
              <Layers className="w-4 h-4" />
              <span>Cambiar vista ({viewMode === 'matrix' ? 'Matriz' : 'Detallada'})</span>
            </button>

            {viewMode === 'focused' && (
              <button
                type="button"
                onClick={() => handleAutoFillNormalValues(activeColumnIdx)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                title="Rellena automáticamente los valores normales estándar pediátricos en esta muestra"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Rellenar Normales (Muestra {activeColumnIdx + 1})</span>
              </button>
            )}
          </div>
        </div>

        {/* Date and Details of current active column */}
        {viewMode === 'focused' && (
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-500" />
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Fecha / Hora de Toma (Muestra {activeColumnIdx + 1}):
              </label>
              <input
                type="text"
                placeholder="ej. 30/10/2026 07:00"
                value={labColumns[activeColumnIdx]?.fecha || ''}
                onChange={(e) => handleDateChange(e.target.value, activeColumnIdx)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Consejo: Puede hacer clic en <strong>"Poner Normal"</strong> al lado de cada parámetro.</span>
            </div>
          </div>
        )}

        {/* Category Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar parámetro (ej. Hemoglobina, Sodio)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: FOCUSED COLUMN LIST (VISTA DETALLADA) */}
      {viewMode === 'focused' && (
        <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 md:p-5 shadow-xs space-y-4`}>
          <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-3`}>
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>Vista Detallada — Muestra {activeColumnIdx + 1}</span>
              {labColumns[activeColumnIdx]?.fecha && (
                <span className="text-teal-700 dark:text-teal-400 font-mono">({labColumns[activeColumnIdx].fecha})</span>
              )}
            </h4>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">
              {filteredAnalytes.length} parámetros listados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAnalytes.map(testName => {
              const cfg = PEDIATRIC_LAB_CONFIGS[testName];
              const rawVal = labColumns[activeColumnIdx]?.valores?.[testName] || '';
              const evalRes = evaluateLabValue(testName, rawVal);

              return (
                <div
                  key={testName}
                  className={`p-3 rounded-xl border transition-all ${
                    evalRes.isAlert
                      ? evalRes.severity === 'critical'
                        ? 'bg-red-500/10 border-red-500/40 dark:bg-red-950/20'
                        : 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/20'
                      : rawVal.trim()
                        ? 'bg-teal-500/5 border-teal-500/30 dark:bg-teal-950/10'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">
                        {testName}
                      </span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold block mt-0.5">
                        Ref: {cfg.referenceText}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSetSingleNormal(testName, activeColumnIdx)}
                      className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/40 dark:hover:bg-teal-900/70 text-teal-700 dark:text-teal-300 rounded text-[10px] font-black border border-teal-200 dark:border-teal-700 transition-colors cursor-pointer"
                      title={`Poner valor normal (${cfg.normalValText})`}
                    >
                      Poner Normal ({cfg.normalValText})
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={rawVal}
                        onChange={(e) => handleValueChange(testName, e.target.value, activeColumnIdx)}
                        placeholder={`ej. ${cfg.normalValText}`}
                        className={`w-full font-mono text-xs font-bold rounded-lg px-3 py-1.5 outline-none transition-all border ${
                          evalRes.isAlert
                            ? evalRes.severity === 'critical'
                              ? 'border-red-500 bg-red-50/50 dark:bg-red-950/40 text-red-900 dark:text-red-100 focus:ring-2 focus:ring-red-400'
                              : 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 focus:ring-2 focus:ring-amber-400'
                            : rawVal.trim()
                              ? 'border-teal-500 bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 focus:ring-2 focus:ring-teal-400'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-teal-500'
                        }`}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                        {cfg.unit}
                      </span>
                    </div>

                    {evalRes.isAlert ? (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shrink-0 ${
                        evalRes.severity === 'critical'
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-amber-500 text-slate-950'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>{evalRes.alertTitle}</span>
                      </span>
                    ) : rawVal.trim() ? (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        <span>Normal</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Otros Exámenes y Observaciones Clínicas:
            </label>
            <textarea
              rows={3}
              value={observacionesOtros}
              onChange={(e) => {
                setObservacionesOtros(e.target.value);
                syncToHistoria(labColumns, e.target.value);
              }}
              placeholder="Resultados adicionales, cultivos, antibiograma, serologías o notas de laboratorio..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 2: COMPLETE 8-COLUMN SERIAL MATRIX (MATRIZ DE 8 COLUMNAS) */}
      {viewMode === 'matrix' && (
        <div className={`${themeTokens.cardSurface} border rounded-2xl p-4 md:p-5 shadow-xs space-y-4`}>
          <div className={`flex items-center justify-between border-b ${themeTokens.sectionDivider} pb-3`}>
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                Matriz de 8 Columnas (Seguimiento Seriado)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Idéntica a la Página 7 de la Historia Clínica Pediátrica. Edite directamente cualquier celda.
              </p>
            </div>
            <button
              onClick={() => setViewMode('focused')}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Cambiar a Vista Detallada
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-2.5 min-w-[200px] bg-slate-100 dark:bg-slate-950 sticky left-0 z-20">
                    Parámetro & Ref.
                  </th>
                  {Array.from({ length: 8 }).map((_, cIdx) => (
                    <th key={cIdx} className="p-2 min-w-[110px] text-center border-l border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] uppercase text-teal-600 dark:text-teal-400">
                        Muestra {cIdx + 1}
                      </div>
                      <input
                        type="text"
                        placeholder="Fecha"
                        value={labColumns[cIdx]?.fecha || ''}
                        onChange={(e) => handleDateChange(e.target.value, cIdx)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-[11px] text-center font-bold"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                {filteredAnalytes.map(testName => {
                  const cfg = PEDIATRIC_LAB_CONFIGS[testName];

                  return (
                    <tr key={testName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-2 font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800">
                        <div>{testName}</div>
                        <div className="text-[9px] text-teal-600 dark:text-teal-400 font-sans">
                          {cfg.referenceText}
                        </div>
                      </td>

                      {Array.from({ length: 8 }).map((_, cIdx) => {
                        const val = labColumns[cIdx]?.valores?.[testName] || '';
                        const evalRes = evaluateLabValue(testName, val);

                        return (
                          <td key={cIdx} className="p-1 border-l border-slate-100 dark:border-slate-800/60">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handleValueChange(testName, e.target.value, cIdx)}
                              className={`w-full p-1 text-center font-mono text-xs rounded border outline-none ${
                                evalRes.isAlert
                                  ? evalRes.severity === 'critical'
                                    ? 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 font-black'
                                    : 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-200 font-black'
                                  : val.trim()
                                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-700 dark:text-teal-300'
                                    : 'bg-transparent border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botones de Volver Arriba y Guardar Cambios */}
      <div className="flex items-center justify-between p-4 bg-teal-500/10 dark:bg-teal-950/20 border border-teal-500/30 rounded-2xl flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <div>
            <p className="text-xs font-black text-slate-900 dark:text-white">
              Sincronización Automática Bidireccional Activa
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Cualquier cambio guardado en esta sección se actualiza en tiempo real en la Página 7 de la Historia Clínica Pediátrica de {activePatient?.lastName}, {activePatient?.firstName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollToTop}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 border border-slate-300 dark:border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUp className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>Volver arriba</span>
          </button>

          <button
            type="button"
            onClick={() => {
              syncToHistoria(labColumns, observacionesOtros);
              setSavedSuccessBanner(true);
              setTimeout(() => setSavedSuccessBanner(false), 2000);
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savedSuccessBanner ? '¡Sincronizado!' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
