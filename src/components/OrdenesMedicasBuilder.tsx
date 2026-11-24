import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OrdenMedicaItem, Patient } from '../types';
import {
  Activity,
  BedDouble,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Droplets,
  FlaskConical,
  Pill,
  Plus,
  RefreshCw,
  ScanLine,
  Scale,
  Sparkles,
  Trash2,
  Utensils,
  Wind,
  X,
} from 'lucide-react';
import {
  DIET_OPTIONS,
  DOSE_UNIT_OPTIONS,
  HOLIDAY_SEGAR_EXAMPLE_DRAFT,
  HOSPITAL_AREA_OPTIONS,
  IMAGING_ORDER_PRESETS,
  LAB_ORDER_PRESETS,
  MEDICATION_HOUR_OPTIONS,
  NEBULIZATION_HOUR_OPTIONS,
  OXYGEN_DEVICE_OPTIONS,
  POSITION_OPTIONS,
  OrdenesMedicasBuilderState,
  buildOrdenesMedicasItems,
  calculateAutoMedicationQuantity,
  composeDosisCalculo,
  createEmptyMedicationDraft,
  formatHidratacionFromFields,
  inferQuantityUnitFromDoseUnit,
  loadOrdenesBuilderState,
  saveOrdenesBuilderState,
} from '../utils/ordenesMedicasBuilder';
import { sanitizeNumericDecimal } from '../utils/clinicalInputSanitizers';

interface OrdenesMedicasBuilderProps {
  patient: Patient;
  fecha: string;
  hora: string;
  peso: string;
  onChangeFecha: (val: string) => void;
  onChangeHora: (val: string) => void;
  onChangePeso: (val: string) => void;
  hasExistingOrders: boolean;
  onGenerateAndSave: (orders: OrdenMedicaItem[], finalPeso?: string) => void;
  onCancelToSheet?: () => void;
}

export const OrdenesMedicasBuilder: React.FC<OrdenesMedicasBuilderProps> = ({
  patient,
  fecha,
  hora,
  peso,
  onChangeFecha,
  onChangeHora,
  onChangePeso,
  hasExistingOrders,
  onGenerateAndSave,
  onCancelToSheet,
}) => {
  const [state, setState] = useState<OrdenesMedicasBuilderState>(() =>
    loadOrdenesBuilderState(patient.id, patient.area)
  );
  const [customLabInput, setCustomLabInput] = useState('');
  const [customImagingInput, setCustomImagingInput] = useState('');
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  // Persist builder state permanently per patient so reopening never loses prior selections
  useEffect(() => {
    saveOrdenesBuilderState(patient.id, state);
  }, [patient.id, state]);

  // Reload if patient switches
  useEffect(() => {
    setState(loadOrdenesBuilderState(patient.id, patient.area));
  }, [patient.id, patient.area]);

  // Close area dropdown on outside click
  useEffect(() => {
    if (!areaDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setAreaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [areaDropdownOpen]);

  // Recalculate auto-computed medication quantities whenever peso changes (for non-overridden rows)
  useEffect(() => {
    setState(prev => {
      let changed = false;
      const nextMeds = prev.medicamentos.map(m => {
        if (m.cantidadManualOverride || !m.dosisNumero) return m;
        const autoQty = calculateAutoMedicationQuantity(peso, m.dosisNumero, m.dosisUnidad);
        if (autoQty && autoQty !== m.cantidadMg) {
          changed = true;
          return { ...m, cantidadMg: autoQty };
        }
        return m;
      });
      return changed ? { ...prev, medicamentos: nextMeds } : prev;
    });
  }, [peso]);

  const previewOrders = useMemo(() => buildOrdenesMedicasItems(state), [state]);

  const toggleLab = (lab: string) => {
    setState(prev => {
      const exists = prev.laboratoriosSeleccionados.includes(lab);
      return {
        ...prev,
        laboratoriosSeleccionados: exists
          ? prev.laboratoriosSeleccionados.filter(x => x !== lab)
          : [...prev.laboratoriosSeleccionados, lab],
      };
    });
  };

  const handleAddCustomLab = () => {
    const clean = customLabInput.trim();
    if (!clean) return;
    setState(prev => ({
      ...prev,
      laboratoriosSeleccionados: prev.laboratoriosSeleccionados.includes(clean)
        ? prev.laboratoriosSeleccionados
        : [...prev.laboratoriosSeleccionados, clean],
    }));
    setCustomLabInput('');
  };

  const toggleImaging = (img: string) => {
    setState(prev => {
      const exists = prev.imagenologicosSeleccionados.includes(img);
      return {
        ...prev,
        imagenologicosSeleccionados: exists
          ? prev.imagenologicosSeleccionados.filter(x => x !== img)
          : [...prev.imagenologicosSeleccionados, img],
      };
    });
  };

  const handleAddCustomImaging = () => {
    const clean = customImagingInput.trim();
    if (!clean) return;
    setState(prev => ({
      ...prev,
      imagenologicosSeleccionados: prev.imagenologicosSeleccionados.includes(clean)
        ? prev.imagenologicosSeleccionados
        : [...prev.imagenologicosSeleccionados, clean],
    }));
    setCustomImagingInput('');
  };

  const updateHidratacionField = (
    field: keyof OrdenesMedicasBuilderState['hidratacion'],
    value: string
  ) => {
    setState(prev => {
      const nextH = { ...prev.hidratacion, [field]: value };
      return {
        ...prev,
        hidratacion: nextH,
        hidratacionUsarTextoLibre: false,
        hidratacionTextoLibre: formatHidratacionFromFields(nextH),
      };
    });
  };

  const handleLoadHolidaySegarExample = () => {
    setState(prev => ({
      ...prev,
      requiereHidratacion: true,
      hidratacion: { ...HOLIDAY_SEGAR_EXAMPLE_DRAFT },
      hidratacionUsarTextoLibre: false,
      hidratacionTextoLibre: formatHidratacionFromFields(HOLIDAY_SEGAR_EXAMPLE_DRAFT),
    }));
  };

  const handleEnableAllThreeNeb = () => {
    setState(prev => ({
      ...prev,
      requiereNebulizacion: true,
      nebulizacion: {
        ...prev.nebulizacion,
        salbutamol: { ...prev.nebulizacion.salbutamol, enabled: true },
        ipratropio: { ...prev.nebulizacion.ipratropio, enabled: true },
        budesonida: { ...prev.nebulizacion.budesonida, enabled: true },
      },
    }));
  };

  const handleSubmit = () => {
    saveOrdenesBuilderState(patient.id, state);
    const generated = buildOrdenesMedicasItems(state);
    onGenerateAndSave(generated, peso);
  };

  return (
    <div
      data-testid="ordenes-medicas-builder"
      className="max-w-4xl mx-auto space-y-5 pb-20 text-slate-900 dark:text-slate-100"
    >
      {/* Intro Banner */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-800/70 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
              <ClipboardList className="w-4 h-4" />
              <span>Desarrollo Guiado de Órdenes Médicas</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {patient.lastName}, {patient.firstName}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Configura cada fila paso a paso. Tus selecciones quedan guardadas permanentemente y puedes volver a generar órdenes en cualquier momento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasExistingOrders && (
              <button
                type="button"
                data-testid="ord-builder-regenerate-top-btn"
                onClick={handleSubmit}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Volver a generar órdenes</span>
              </button>
            )}
            {hasExistingOrders && onCancelToSheet && (
              <button
                type="button"
                onClick={onCancelToSheet}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Volver a hoja guardada</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadata strip: Fecha, Hora, Peso */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Fecha
            </label>
            <input
              type="text"
              value={fecha}
              onChange={e => onChangeFecha(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Hora
            </label>
            <input
              type="text"
              value={hora}
              onChange={e => onChangeHora(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Peso del Paciente
            </label>
            <input
              type="text"
              data-testid="ord-builder-peso"
              value={peso}
              onChange={e => onChangePeso(e.target.value)}
              placeholder="Ej. 12 kg"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* FILA 1: ÁREA DE INGRESO */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            1
          </span>
          <BedDouble className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            Área de Ingreso
          </h4>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
            Ingresar paciente en:
          </span>
          <div ref={areaDropdownRef} className="relative flex-1">
            <button
              type="button"
              data-testid="ord-builder-area-dropdown-btn"
              onClick={() => setAreaDropdownOpen(prev => !prev)}
              className="w-full rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2 hover:border-teal-500 transition-colors cursor-pointer"
            >
              <span className="truncate">{state.areaIngreso || 'Seleccionar área de ingreso...'}</span>
              <ChevronDown
                className={`w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 transition-transform ${
                  areaDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {areaDropdownOpen && (
              <div
                data-testid="ord-builder-area-dropdown-menu"
                className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1.5 max-h-64 overflow-y-auto"
              >
                {HOSPITAL_AREA_OPTIONS.map(areaOpt => {
                  const selected = state.areaIngreso.toLowerCase() === areaOpt.toLowerCase();
                  return (
                    <button
                      key={areaOpt}
                      type="button"
                      data-testid={`ord-builder-area-option-${areaOpt}`}
                      onClick={() => {
                        setState(prev => ({ ...prev, areaIngreso: areaOpt }));
                        setAreaDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        selected
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-800 dark:text-slate-100 hover:bg-teal-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{areaOpt}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5 px-2.5">
                  <input
                    type="text"
                    data-testid="ord-builder-area"
                    value={state.areaIngreso}
                    onChange={e => setState(prev => ({ ...prev, areaIngreso: e.target.value }))}
                    placeholder="O escribir otra área..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FILA 2: DIETA */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            2
          </span>
          <Utensils className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            ¿Qué tipo de dieta tendrá el paciente?
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map(diet => {
            const active = state.dietaTipo === diet;
            return (
              <button
                key={diet}
                type="button"
                onClick={() => setState(prev => ({ ...prev, dietaTipo: diet }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                }`}
              >
                {diet}
              </button>
            );
          })}
        </div>
        <div>
          <input
            type="text"
            value={state.dietaDetalle}
            onChange={e => setState(prev => ({ ...prev, dietaDetalle: e.target.value }))}
            placeholder={
              state.dietaTipo === 'Otra dieta'
                ? 'Escribe el tipo de dieta...'
                : 'Detalle adicional opcional (ej. 3 oz c/3h, a libre demanda, sin lactosa...)'
            }
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
        </div>
      </section>

      {/* FILA 3: POSICIÓN */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            3
          </span>
          <BedDouble className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            Posición del Paciente
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {POSITION_OPTIONS.map(pos => {
            const active = state.posicion === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setState(prev => ({ ...prev, posicion: pos }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                }`}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </section>

      {/* FILA 4: OXÍGENO */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            4
          </span>
          <Wind className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            ¿Requiere Oxígeno?
          </h4>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'no', label: 'No requiere' },
              { id: 'continuo', label: 'Sí · Continuo' },
              { id: 'sos', label: 'Sí · SOS (SpO2 < 93%)' },
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              data-testid={`ord-builder-o2-${opt.id}`}
              onClick={() => setState(prev => ({ ...prev, oxigenoMode: opt.id }))}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                state.oxigenoMode === opt.id
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-cyan-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {state.oxigenoMode !== 'no' && (
          <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Tipo de Oxígeno
              </label>
              <div className="flex gap-1 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 p-1 rounded-lg">
                {(['Húmedo', 'Seco'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, oxigenoHumedad: t }))}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      state.oxigenoHumedad === t
                        ? t === 'Húmedo'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-amber-500 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Modalidad / Dispositivo
              </label>
              <select
                value={state.oxigenoModalidad}
                onChange={e => setState(prev => ({ ...prev, oxigenoModalidad: e.target.value }))}
                className="w-full rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                {OXYGEN_DEVICE_OPTIONS.map(dev => (
                  <option key={dev} value={dev}>
                    {dev}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Flujo (Litros / min)
              </label>
              <div className="flex items-center rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 overflow-hidden">
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="ord-builder-o2-flow"
                  value={state.oxigenoFlujo}
                  onChange={e =>
                    setState(prev => ({
                      ...prev,
                      oxigenoFlujo: sanitizeNumericDecimal(e.target.value),
                    }))
                  }
                  placeholder="3"
                  className="w-full px-2.5 py-2 text-xs font-bold text-right text-slate-900 dark:text-white bg-transparent outline-none"
                />
                <span className="px-2.5 py-2 text-[10px] font-extrabold bg-cyan-100 dark:bg-cyan-900/60 text-cyan-900 dark:text-cyan-200 border-l border-cyan-200 dark:border-cyan-700">
                  L/min
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* FILA 5: MONITORIZACIÓN CONTINUA */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            5
          </span>
          <Activity className="w-4 h-4 text-rose-500 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            ¿Requiere Monitorización Continua?
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="ord-builder-monit-no"
            onClick={() => setState(prev => ({ ...prev, monitorizacionContinua: false }))}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
              !state.monitorizacionContinua
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            No
          </button>
          <button
            type="button"
            data-testid="ord-builder-monit-si"
            onClick={() => setState(prev => ({ ...prev, monitorizacionContinua: true }))}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
              state.monitorizacionContinua
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Sí, agregar
          </button>
        </div>
      </section>

      {/* FILA 6: HIDRATACIÓN PARENTERAL */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
              6
            </span>
            <Droplets className="w-4 h-4 text-sky-500 shrink-0" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Hidratación Parenteral (HP)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, requiereHidratacion: false }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                !state.requiereHidratacion
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              No
            </button>
            <button
              type="button"
              data-testid="ord-builder-hp-si"
              onClick={() => setState(prev => ({ ...prev, requiereHidratacion: true }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                state.requiereHidratacion
                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Sí, agregar HP
            </button>
          </div>
        </div>

        {state.requiereHidratacion && (
          <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-sky-900 dark:text-sky-200">
                Llena los campos o escribe directamente el texto de la hidratación:
              </span>
              <button
                type="button"
                data-testid="ord-builder-hp-example"
                onClick={handleLoadHolidaySegarExample}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Cargar ejemplo Holiday Segar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Esquema / Título
                </label>
                <input
                  type="text"
                  value={state.hidratacion.titulo}
                  onChange={e => updateHidratacionField('titulo', e.target.value)}
                  placeholder="HP Holiday Segar (Hidratación Parenteral)"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Solución Base
                </label>
                <input
                  type="text"
                  value={state.hidratacion.solucionBase}
                  onChange={e => updateHidratacionField('solucionBase', e.target.value)}
                  placeholder="Sol. Dextrosa 5%: 500 cc"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Columna Dosis (opcional)
                </label>
                <input
                  type="text"
                  value={state.hidratacionDosisCalculo}
                  onChange={e =>
                    setState(prev => ({ ...prev, hidratacionDosisCalculo: e.target.value }))
                  }
                  placeholder="Ej. 2mEq/kg/día"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  NaCl 20% (ml)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.hidratacion.nacl20Ml}
                  onChange={e =>
                    updateHidratacionField('nacl20Ml', sanitizeNumericDecimal(e.target.value))
                  }
                  placeholder="8"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  KCl (ml)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.hidratacion.kclMl}
                  onChange={e =>
                    updateHidratacionField('kclMl', sanitizeNumericDecimal(e.target.value))
                  }
                  placeholder="27.2"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  G. Calcio 10% (ml)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.hidratacion.gCalcio10Ml}
                  onChange={e =>
                    updateHidratacionField('gCalcio10Ml', sanitizeNumericDecimal(e.target.value))
                  }
                  placeholder="20.4"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  MgSO4 (ml)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.hidratacion.mgso4Ml}
                  onChange={e =>
                    updateHidratacionField('mgso4Ml', sanitizeNumericDecimal(e.target.value))
                  }
                  placeholder="2.4"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Vía, Frecuencia y Ritmo (→)
                </label>
                <input
                  type="text"
                  value={state.hidratacion.viaRitmo}
                  onChange={e => updateHidratacionField('viaRitmo', e.target.value)}
                  placeholder="VEV c/8h a 69 ml/h a 1.15 gotas/Min por BIC"
                  className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Texto final de Hidratación (editable directamente)
              </label>
              <textarea
                rows={5}
                data-testid="ord-builder-hp-text"
                value={
                  state.hidratacionUsarTextoLibre
                    ? state.hidratacionTextoLibre
                    : formatHidratacionFromFields(state.hidratacion)
                }
                onChange={e =>
                  setState(prev => ({
                    ...prev,
                    hidratacionUsarTextoLibre: true,
                    hidratacionTextoLibre: e.target.value,
                  }))
                }
                placeholder={`HP Holiday Segar (Hidratación Parenteral):\nSol. Dextrosa 5%: 500 cc\nNaCl 20%: 8 ml | KCl: 27.2 ml\nG. Calcio 10%: 20.4 ml\nMgSO4: 2.4 ml → VEV c/8h a 69 ml/h a 1.15 gotas/Min por BIC`}
                className="w-full rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 p-2.5 text-xs font-mono leading-relaxed text-slate-900 dark:text-white outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}
      </section>

      {/* FILA 7: MEDICAMENTOS */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
              7
            </span>
            <Pill className="w-4 h-4 text-indigo-500 shrink-0" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              ¿Desea agregar medicamentos?
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="ord-builder-meds-no"
              onClick={() => setState(prev => ({ ...prev, requiereMedicamentos: false }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                !state.requiereMedicamentos
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              No
            </button>
            <button
              type="button"
              data-testid="ord-builder-meds-si"
              onClick={() => setState(prev => ({ ...prev, requiereMedicamentos: true }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                state.requiereMedicamentos
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Sí
            </button>
          </div>
        </div>

        {state.requiereMedicamentos && (
          <div className="space-y-3">
            {state.medicamentos.map((med, idx) => (
              <div
                key={med.id}
                className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                    Medicamento #{idx + 1}
                  </span>
                  {state.medicamentos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          medicamentos: prev.medicamentos.filter(m => m.id !== med.id),
                        }))
                      }
                      className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Medicamento
                    </label>
                    <input
                      type="text"
                      data-testid={`ord-builder-med-name-${idx}`}
                      value={med.nombre}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          medicamentos: prev.medicamentos.map(m =>
                            m.id === med.id ? { ...m, nombre: e.target.value } : m
                          ),
                        }))
                      }
                      placeholder="Ej. Hidrocortisona"
                      className="w-full rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Dosis (columna DOSIS)
                    </label>
                    <div className="flex rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 overflow-hidden">
                      <input
                        type="text"
                        inputMode="decimal"
                        data-testid={`ord-builder-med-dose-num-${idx}`}
                        value={med.dosisNumero ?? ''}
                        onChange={e => {
                          const nextNum = sanitizeNumericDecimal(e.target.value);
                          const unit = med.dosisUnidad || 'mg/kg/dosis';
                          const autoQty = calculateAutoMedicationQuantity(peso, nextNum, unit);
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id
                                ? {
                                    ...m,
                                    dosisNumero: nextNum,
                                    dosisUnidad: unit,
                                    dosisCalculo: composeDosisCalculo(nextNum, unit),
                                    cantidadMg: autoQty,
                                    cantidadManualOverride: false,
                                  }
                                : m
                            ),
                          }));
                        }}
                        placeholder="Ej. 5"
                        className="w-20 sm:w-24 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white bg-transparent outline-none"
                      />
                      <select
                        data-testid={`ord-builder-med-dose-unit-${idx}`}
                        value={med.dosisUnidad || 'mg/kg/dosis'}
                        onChange={e => {
                          const nextUnit = e.target.value;
                          const num = med.dosisNumero ?? '';
                          const nextQtyUnit = inferQuantityUnitFromDoseUnit(nextUnit);
                          const autoQty = calculateAutoMedicationQuantity(peso, num, nextUnit);
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id
                                ? {
                                    ...m,
                                    dosisUnidad: nextUnit,
                                    dosisCalculo: composeDosisCalculo(num, nextUnit),
                                    unidad: nextQtyUnit,
                                    cantidadMg: m.cantidadManualOverride ? m.cantidadMg : autoQty,
                                  }
                                : m
                            ),
                          }));
                        }}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border-l border-indigo-200 dark:border-indigo-700 outline-none"
                      >
                        {DOSE_UNIT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Cuántos mg / Cantidad (Peso × Dosis)
                    </label>
                    <div className="flex rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 overflow-hidden">
                      <input
                        type="text"
                        inputMode="decimal"
                        data-testid={`ord-builder-med-mg-${idx}`}
                        value={med.cantidadMg}
                        onChange={e =>
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id
                                ? {
                                    ...m,
                                    cantidadMg: sanitizeNumericDecimal(e.target.value),
                                    cantidadManualOverride: true,
                                  }
                                : m
                            ),
                          }))
                        }
                        placeholder="Auto (editable)"
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white bg-transparent outline-none"
                      />
                      <select
                        value={med.unidad}
                        onChange={e =>
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id
                                ? {
                                    ...m,
                                    unidad: e.target.value as
                                      | 'mg'
                                      | 'mcg'
                                      | 'cc'
                                      | 'ml'
                                      | 'UI'
                                      | 'amp'
                                      | 'gotas',
                                  }
                                : m
                            ),
                          }))
                        }
                        className="px-2 py-1.5 text-xs font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border-l border-indigo-200 dark:border-indigo-700 outline-none"
                      >
                        <option value="mg">mg</option>
                        <option value="mcg">mcg</option>
                        <option value="cc">cc</option>
                        <option value="ml">ml</option>
                        <option value="UI">UI</option>
                        <option value="amp">amp</option>
                        <option value="gotas">gotas</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Vía + Intervalo + STAT */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mr-1">
                      Vía:
                    </span>
                    {(['VEV', 'VO', 'IM', 'SC'] as const).map(via => (
                      <button
                        key={via}
                        type="button"
                        onClick={() =>
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id ? { ...m, via } : m
                            ),
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border cursor-pointer transition-all ${
                          med.via === via
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        {via}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mr-1">
                      Cada cuántas horas:
                    </span>
                    {MEDICATION_HOUR_OPTIONS.map(hr => (
                      <button
                        key={hr}
                        type="button"
                        disabled={med.esStat && med.soloStat}
                        onClick={() =>
                          setState(prev => ({
                            ...prev,
                            medicamentos: prev.medicamentos.map(m =>
                              m.id === med.id ? { ...m, intervaloHoras: hr } : m
                            ),
                          }))
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer transition-all disabled:opacity-40 ${
                          med.intervaloHoras === hr && !(med.esStat && med.soloStat)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        c/{hr}h
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      ¿STAT?:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          medicamentos: prev.medicamentos.map(m =>
                            m.id === med.id ? { ...m, esStat: false, soloStat: false } : m
                          ),
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        !med.esStat
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          medicamentos: prev.medicamentos.map(m =>
                            m.id === med.id ? { ...m, esStat: true, soloStat: true } : m
                          ),
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        med.esStat && med.soloStat
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Solo STAT
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          medicamentos: prev.medicamentos.map(m =>
                            m.id === med.id ? { ...m, esStat: true, soloStat: false } : m
                          ),
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        med.esStat && !med.soloStat
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      STAT + c/{med.intervaloHoras}h
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              data-testid="ord-builder-add-med"
              onClick={() =>
                setState(prev => ({
                  ...prev,
                  medicamentos: [...prev.medicamentos, createEmptyMedicationDraft()],
                }))
              }
              className="px-3.5 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar otro medicamento</span>
            </button>
          </div>
        )}
      </section>

      {/* FILA 8: NEBULIZACIÓN */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
              8
            </span>
            <Wind className="w-4 h-4 text-emerald-500 shrink-0" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              ¿Requerirá Nebulización (NBT)?
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, requiereNebulizacion: false }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                !state.requiereNebulizacion
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              No
            </button>
            <button
              type="button"
              data-testid="ord-builder-neb-si"
              onClick={() => setState(prev => ({ ...prev, requiereNebulizacion: true }))}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                state.requiereNebulizacion
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Sí
            </button>
          </div>
        </div>

        {state.requiereNebulizacion && (
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                Selecciona uno o los 3 fármacos (siempre diluido en 3cc de Sol. 0.9%):
              </span>
              <button
                type="button"
                data-testid="ord-builder-neb-all3"
                onClick={handleEnableAllThreeNeb}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Seleccionar los 3
              </button>
            </div>

            {(
              [
                { key: 'salbutamol', label: 'Salbutamol' },
                { key: 'ipratropio', label: 'Bromuro de Ipratropio' },
                { key: 'budesonida', label: 'Budesonida' },
              ] as const
            ).map(drug => {
              const cfg = state.nebulizacion[drug.key];
              return (
                <div
                  key={drug.key}
                  className={`p-3 rounded-xl border transition-all ${
                    cfg.enabled
                      ? 'bg-white dark:bg-slate-900 border-emerald-400 dark:border-emerald-600'
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={e =>
                          setState(prev => ({
                            ...prev,
                            nebulizacion: {
                              ...prev.nebulizacion,
                              [drug.key]: {
                                ...prev.nebulizacion[drug.key],
                                enabled: e.target.checked,
                              },
                            },
                          }))
                        }
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {drug.label}
                      </span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Diluido en 3cc de Sol. 0.9%
                    </span>
                  </div>

                  {cfg.enabled && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                          Gotas:
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cfg.gotas}
                          onChange={e =>
                            setState(prev => ({
                              ...prev,
                              nebulizacion: {
                                ...prev.nebulizacion,
                                [drug.key]: {
                                  ...prev.nebulizacion[drug.key],
                                  gotas: sanitizeNumericDecimal(e.target.value),
                                },
                              },
                            }))
                          }
                          placeholder="10"
                          className="w-16 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-black text-center text-slate-900 dark:text-white outline-none"
                        />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          gotas + 3cc Sol. 0.9%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {NEBULIZATION_HOUR_OPTIONS.map(hr => (
                          <button
                            key={hr}
                            type="button"
                            onClick={() =>
                              setState(prev => ({
                                ...prev,
                                nebulizacion: {
                                  ...prev.nebulizacion,
                                  [drug.key]: {
                                    ...prev.nebulizacion[drug.key],
                                    intervaloHoras: hr,
                                  },
                                },
                              }))
                            }
                            className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                              cfg.intervaloHoras === hr
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            c/{hr}h
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Solución Hipertónica */}
            <div className="p-3 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                  ¿Desea agregar Solución Hipertónica (3%)?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setState(prev => ({
                        ...prev,
                        nebulizacion: { ...prev.nebulizacion, hipertonicaEnabled: false },
                      }))
                    }
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                      !state.nebulizacion.hipertonicaEnabled
                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    data-testid="ord-builder-neb-hipertonica-si"
                    onClick={() =>
                      setState(prev => ({
                        ...prev,
                        nebulizacion: { ...prev.nebulizacion, hipertonicaEnabled: true },
                      }))
                    }
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                      state.nebulizacion.hipertonicaEnabled
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Sí, agregar
                  </button>
                </div>
              </div>

              {state.nebulizacion.hipertonicaEnabled && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                      Volumen:
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={state.nebulizacion.hipertonicaCc}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          nebulizacion: {
                            ...prev.nebulizacion,
                            hipertonicaCc: sanitizeNumericDecimal(e.target.value),
                          },
                        }))
                      }
                      className="w-16 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-black text-center text-slate-900 dark:text-white outline-none"
                    />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      cc
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {NEBULIZATION_HOUR_OPTIONS.map(hr => (
                      <button
                        key={hr}
                        type="button"
                        onClick={() =>
                          setState(prev => ({
                            ...prev,
                            nebulizacion: { ...prev.nebulizacion, hipertonicaHoras: hr },
                          }))
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                          state.nebulizacion.hipertonicaHoras === hr
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        c/{hr}h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* FILA 9: LABORATORIOS */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            9
          </span>
          <FlaskConical className="w-4 h-4 text-violet-500 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            ¿Qué Laboratorios desea pedir?
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          {LAB_ORDER_PRESETS.map(lab => {
            const active = state.laboratoriosSeleccionados.includes(lab);
            return (
              <button
                key={lab}
                type="button"
                onClick={() => toggleLab(lab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                }`}
              >
                {active && <Check className="w-3.5 h-3.5" />}
                <span>{lab}</span>
              </button>
            );
          })}
        </div>

        {/* Custom lab input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            data-testid="ord-builder-custom-lab"
            value={customLabInput}
            onChange={e => setCustomLabInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomLab();
              }
            }}
            placeholder="Escribir otro examen de laboratorio (ej. Ferritina, Dengue NS1)..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-violet-500"
          />
          <button
            type="button"
            data-testid="ord-builder-add-lab-btn"
            onClick={handleAddCustomLab}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>

        {state.laboratoriosSeleccionados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {state.laboratoriosSeleccionados.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200 text-[11px] font-bold"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => toggleLab(item)}
                  className="hover:text-rose-600 cursor-pointer"
                  aria-label={`Quitar ${item}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* FILA 10: IMAGENOLÓGICOS */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            10
          </span>
          <ScanLine className="w-4 h-4 text-blue-500 shrink-0" />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            Estudios Imagenológicos
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          {IMAGING_ORDER_PRESETS.map(img => {
            const active = state.imagenologicosSeleccionados.includes(img);
            return (
              <button
                key={img}
                type="button"
                onClick={() => toggleImaging(img)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                {active && <Check className="w-3.5 h-3.5" />}
                <span>{img}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            data-testid="ord-builder-custom-img"
            value={customImagingInput}
            onChange={e => setCustomImagingInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomImaging();
              }
            }}
            placeholder="Escribir otro estudio imagenológico..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            data-testid="ord-builder-add-img-btn"
            onClick={handleAddCustomImaging}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>

        {state.imagenologicosSeleccionados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {state.imagenologicosSeleccionados.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 text-[11px] font-bold"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => toggleImaging(item)}
                  className="hover:text-rose-600 cursor-pointer"
                  aria-label={`Quitar ${item}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* FILA 11: BALANCE HÍDRICO */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            11
          </span>
          <Scale className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              ¿Desea agregar Balance Hídrico?
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Control estricto de ingresos y egresos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, requiereBalanceHidrico: false }))}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
              !state.requiereBalanceHidrico
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            No
          </button>
          <button
            type="button"
            data-testid="ord-builder-bh-si"
            onClick={() => setState(prev => ({ ...prev, requiereBalanceHidrico: true }))}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
              state.requiereBalanceHidrico
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Sí, agregar
          </button>
        </div>
      </section>

      {/* LIVE SUMMARY PREVIEW & SAVE CTA */}
      <section className="rounded-2xl border-2 border-teal-500/70 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-teal-800 dark:text-teal-300">
            Vista Previa de Órdenes a Generar ({previewOrders.length} indicaciones)
          </h4>
        </div>
        <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/60">
          {previewOrders.map(ord => (
            <div key={ord.id} className="flex text-xs">
              <div className="w-24 shrink-0 px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {ord.dosisCalculo || '—'}
              </div>
              <div className="flex-1 px-3 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                <strong className="mr-1.5 text-teal-700 dark:text-teal-400">{ord.itemNumber}.</strong>
                {ord.descripcion}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {hasExistingOrders && onCancelToSheet && (
            <button
              type="button"
              onClick={onCancelToSheet}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            data-testid="ord-builder-submit"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            {hasExistingOrders ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Volver a generar órdenes</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Generar y Guardar Órdenes Médicas</span>
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
};
