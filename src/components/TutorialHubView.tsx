import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Compass,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FlaskConical,
  Layers,
  Play,
  Printer,
  RefreshCw,
  Settings2,
  Stethoscope,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  TutorialTourId,
  HISTORIA_CLINICA_TUTORIAL_STEPS,
  getTutorialStepsByTour,
} from '../utils/tutorialSteps';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface TutorialHubViewProps {
  onStartTour: (tourId: TutorialTourId) => void;
  onBackToInicio: () => void;
  isVisitor?: boolean;
}

export type TutorialHubCategoryId =
  | 'all'
  | 'gestion_clinica'
  | 'impresion_documentos'
  | 'administracion';

interface WorkflowTutorialCard {
  id: TutorialTourId;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
}

export interface TutorialCategorySection {
  id: Exclude<TutorialHubCategoryId, 'all'>;
  title: string;
  subtitle: string;
  shortLabel: string;
  accentBorder: string;
  accentHeader: string;
  accentButton: string;
  headerIcon: React.ReactNode;
  items: WorkflowTutorialCard[];
}

export const TUTORIAL_CATEGORY_SECTIONS: TutorialCategorySection[] = [
  {
    id: 'gestion_clinica',
    title: '🩺 Gestión Clínica',
    subtitle:
      'Flujos asistenciales paso a paso: redacción de Historia Clínica con llenado rápido semiológico y firmas oficiales, Evoluciones diarias, Órdenes Médicas, Altas y Reingresos.',
    shortLabel: '🩺 Gestión Clínica',
    accentBorder: 'border-teal-300/80 dark:border-teal-500/40',
    accentHeader: 'text-teal-800 dark:text-teal-300',
    accentButton: 'bg-teal-600 hover:bg-teal-500 text-white',
    headerIcon: <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
    items: [
      {
        id: 'historia_clinica',
        title: '📋 Desarrollar historia clínica (Paso a Paso)',
        description:
          '🏥 Recorre las 8 páginas oficiales: Filiación y firma fija de Jospeth Perez, Reglamento, Interrogatorio, Examen Funcional y Físico (Desbloquear/Bloquear sin borrar, Llenado rápido semiológico y Restaurar normal), GRAFFAR, Laboratorios, Resumen de Ingreso, Vista Previa e ingreso a cama con enlace a Órdenes Médicas.',
        badge: 'Guía Principal · 8 Páginas',
        icon: <FilePlus2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />,
      },
      {
        id: 'evolucionar_paciente',
        title: '🩺 Evolucionar paciente',
        description:
          '📝 Abre Evolución Médica con un paciente ficticio y recorre en vivo cada bloque: Subjetivo/Objetivo, Editor de Diagnósticos (Sub-Dx y cambio de orden), Tratamiento completo (dosis, no cumplido, culminado, readministrar), Signos Vitales, Parámetros del Apoyo Ventilatorio, Balance Hídrico 24h, cómo modificar el Examen Físico del Día, Plan y Órdenes.',
        badge: 'Inicio · Evolución Diaria',
        icon: <Stethoscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      },
      {
        id: 'generar_ordenes_medicas',
        title: '🧮 Generar Órdenes Médicas',
        description:
          '📋 Abre Órdenes Médicas y su Asistente Guiado para ver el cálculo automático de dosis por peso, nebulizaciones, laboratorios y la gestión de firmas (Médico Residente, Enfermera y Residente superior o adjunto de guardia).',
        badge: 'Inicio · Indicaciones',
        icon: <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      },
      {
        id: 'dar_alta_medica',
        title: '✅ Dar de alta médica y Resumen de Egreso',
        description:
          '📄 Confirma el alta del paciente ficticio, abre el Resumen de Egreso y aprende paso a paso a llenar datos, Editar tto, Lab, Dx e imprimir en 1 hoja.',
        badge: 'Inicio · Egresos',
        icon: <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      },
      {
        id: 'altas_buscar_reingresar',
        title: '🔄 Buscar dado de alta, ver docs y reingresar',
        description:
          '🔍 Ubica a la paciente ficticia egresada, abre su perfil archivado y conoce las dos opciones del modal Reingresar (Corregir errores vs Nuevo Ingreso).',
        badge: 'Altas Médicas',
        icon: <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />,
      },
    ],
  },
  {
    id: 'impresion_documentos',
    title: '🖨️ Impresión y Documentos',
    subtitle:
      'Guías interactivas para visualizar el expediente completo e imprimir o guardar en PDF Evoluciones, Historias Clínicas (8 páginas), Órdenes Médicas y lotes masivos con nombre automático.',
    shortLabel: '🖨️ Impresión y Documentos',
    accentBorder: 'border-amber-300/80 dark:border-amber-500/40',
    accentHeader: 'text-amber-800 dark:text-amber-300',
    accentButton: 'bg-amber-600 hover:bg-amber-500 text-white',
    headerIcon: <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    items: [
      {
        id: 'imprimir_evolucion',
        title: '🩺 Imprimir Evolución Médica',
        description:
          '📄 Abre el perfil del paciente ficticio, toca "Visualizar la evolución" en tamaño Carta y aprende a imprimir o guardar el PDF limpio con datos del paciente, fecha y hora.',
        badge: 'Imprimir · Evolución',
        icon: <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />,
      },
      {
        id: 'imprimir_historia_clinica',
        title: '📋 Imprimir Historia Clínica (8 Páginas)',
        description:
          '🖨️ Abre Impresión Profesional desde el perfil, revisa Todas (8) o cada página (firma fija Jospeth Perez, GRAFFAR compacto, Resumen con Fecha junto a Servicio) e imprime o guarda el PDF.',
        badge: 'Imprimir · Historia Clínica',
        icon: <FilePlus2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
      },
      {
        id: 'imprimir_ordenes_medicas',
        title: '📝 Imprimir Órdenes Médicas',
        description:
          '🟡 Abre la hoja oficial de Órdenes Médicas, verifica dosis y firmas (Médico Residente, Enfermera, Residente superior o adjunto de guardia) e imprime en Carta o guarda PDF.',
        badge: 'Imprimir · Órdenes',
        icon: <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      },
      {
        id: 'descargar_imprimir_inicio',
        title: '📥 Imprimir en Lote desde Descargar',
        description:
          '⚡ Despliega el menú Descargar en Inicio para imprimir en lote todas las Evoluciones de Hoy, Órdenes Médicas y Notas de Recibimiento en 1 clic.',
        badge: 'Imprimir · Masivo',
        icon: <Download className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />,
      },
      {
        id: 'ver_documentos_paciente',
        title: '📂 Ver documentos del paciente (Expediente)',
        description:
          '👁️ Abre "Ver Perfil & Archivos" y explora adentro cada documento: Resumen 7 días, Evoluciones, Órdenes, Adjuntos, Historia Clínica, Constancia, Nota de Recibimiento y Referencia.',
        badge: 'Documentos · Expediente',
        icon: <Eye className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />,
      },
    ],
  },
  {
    id: 'administracion',
    title: '🏥 Administración',
    subtitle:
      'Organización operativa del servicio y ajustes personales: tareas de guardia, estadísticas epidemiológicas, rol de guardias, sonido ambiental y temas de pantalla.',
    shortLabel: '🏥 Administración',
    accentBorder: 'border-sky-300/80 dark:border-sky-500/40',
    accentHeader: 'text-sky-800 dark:text-sky-300',
    accentButton: 'bg-sky-600 hover:bg-sky-500 text-white',
    headerIcon: <Settings2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
    items: [
      {
        id: 'tareas_guardia',
        title: '✅ Agregar Tareas de Guardia',
        description:
          '📌 Aprende a crear, filtrar y completar pendientes de guardia por categoría y prioridad usando tareas ficticias de práctica.',
        badge: 'Tareas de Guardia',
        icon: <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />,
      },
      {
        id: 'ver_estadisticas',
        title: '📊 Ver Estadísticas del Servicio',
        description:
          '📈 Explora los indicadores de ingresos semanales/mensuales, reingresos, distribución por áreas y diagnósticos más frecuentes.',
        badge: 'Estadísticas',
        icon: <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />,
      },
      {
        id: 'rol_guardias',
        title: '📅 Ver Rol de Guardias y áreas',
        description:
          '👥 Revisa qué equipo está de guardia hoy, el área asignada a cada médico y navega por el calendario mensual.',
        badge: 'Rol de Guardias',
        icon: <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      },
      {
        id: 'sonido_y_temas',
        title: '🎵 Omitir sonido y cambiar de temas',
        description:
          '🌙 Silencia o activa el sonido ambiental y alterna entre Modo Claro, Modo Nocturno y Modo Automático.',
        badge: 'Ajustes de Pantalla',
        icon: <Volume2 className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />,
      },
      {
        id: 'tablero_camas',
        title: '🧭 Botones Principales de Inicio y Pantalla',
        description:
          '⚡ Guía rápida para ubicar el ingreso de historias, el buzón de sugerencias y el selector de tema en la barra superior.',
        badge: 'Guía Rápida',
        icon: <ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />,
      },
    ],
  },
];

export const TutorialHubView: React.FC<TutorialHubViewProps> = ({
  onStartTour,
  onBackToInicio,
}) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const [selectedCategory, setSelectedCategory] = useState<TutorialHubCategoryId>('all');

  const totalGuidesCount = TUTORIAL_CATEGORY_SECTIONS.reduce(
    (sum, sec) => sum + sec.items.length,
    0
  );

  const visibleSections =
    selectedCategory === 'all'
      ? TUTORIAL_CATEGORY_SECTIONS
      : TUTORIAL_CATEGORY_SECTIONS.filter(sec => sec.id === selectedCategory);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Strip */}
      <div className={`rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 ${themeTokens.cardSurface}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <BookOpen className="w-4 h-4" />
              <span>🎓 Centro de Guías Interactivas</span>
              <span aria-hidden="true">·</span>
              <span>💬 Mensajes flotantes paso a paso</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Tutorial de Uso de la Plataforma
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              ✨ Selecciona una categoría (<strong>Gestión Clínica</strong>, <strong>Impresión y Documentos</strong> o <strong>Administración</strong>) o toca cualquier guía interactiva para abrir la ventana real y aprender paso a paso.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToInicio}
            className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </button>
        </div>

        {/* Sandbox Safety Notice */}
        <div className="rounded-xl bg-teal-50/90 dark:bg-teal-950/40 border border-teal-300/80 dark:border-teal-500/40 px-4 py-3 flex items-start gap-2.5 text-xs text-teal-900 dark:text-teal-200">
          <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            <strong>🧪 Modo Práctica con Paciente Ficticio:</strong> Todos los tutoriales usan datos ficticios de ejemplo (<em>Mateo Alejandro Pérez Demo</em> y <em>Sofía Valentina Mendoza Demo</em>). <strong>Ningún dato del tutorial se guarda en la base de datos</strong>; puedes practicar con total tranquilidad.
          </p>
        </div>

        {/* Category Filter Navigation */}
        <div className="pt-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            data-testid="tutorial-cat-tab-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              selectedCategory === 'all'
                ? `${themeTokens.activePill} border-transparent shadow-xs`
                : 'bg-white dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todas ({totalGuidesCount})</span>
          </button>

          {TUTORIAL_CATEGORY_SECTIONS.map(section => (
            <button
              key={section.id}
              type="button"
              data-testid={`tutorial-cat-tab-${section.id}`}
              onClick={() => setSelectedCategory(section.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                selectedCategory === section.id
                  ? `${themeTokens.activePill} border-transparent shadow-xs`
                  : 'bg-white dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500/50'
              }`}
            >
              <span>{section.shortLabel}</span>
              <span className="text-[10px] opacity-80 font-mono">({section.items.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Featured Walkthrough Card: Historia Clínica */}
      {(selectedCategory === 'all' || selectedCategory === 'gestion_clinica') && (
        <div className={`rounded-2xl border p-5 sm:p-6 shadow-xs ${themeTokens.cardSurface}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
                <span>⭐ Guía Principal Paso a Paso</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {HISTORIA_CLINICA_TUTORIAL_STEPS.length} pasos guiados
                </span>
                <span aria-hidden="true">·</span>
                <span>🧪 Paciente ficticio</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <FilePlus2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>📋 Desarrollar historia clínica</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                🏥 Guía completa por las 8 páginas oficiales: Filiación y gestión de firmas (<strong>Jospeth Perez</strong> fija en Historia Clínica y firmas institucionales de <strong>Órdenes Médicas</strong>), Examen Funcional y Examen Físico con <strong>Desbloquear/Bloquear sin borrar</strong>, <strong>Llenado rápido semiológico</strong> (Inspección, Palpación, Percusión y Auscultación) y <strong>Restaurar normal</strong>, GRAFFAR, Laboratorios, Resumen de Ingreso, Vista Previa e ingreso a cama.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                data-testid="tutorial-start-historia-btn"
                onClick={() => onStartTour('historia_clinica')}
                className={`min-h-[44px] px-6 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap ${themeTokens.primaryButton}`}
                title="Iniciar tutorial guiado de Desarrollar historia clínica con paciente ficticio"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Desarrollar historia clínica</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categorized Interactive Tutorial Sections */}
      <div className="space-y-6">
        {visibleSections.map(section => (
          <section
            key={section.id}
            data-testid={`tutorial-section-${section.id}`}
            className="space-y-3"
          >
            <div className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 ${themeTokens.cardSurface} ${section.accentBorder}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/70">
                <div className="space-y-1">
                  <h2 className={`text-sm sm:text-base font-black flex items-center gap-2 ${section.accentHeader}`}>
                    {section.headerIcon}
                    <span>{section.title}</span>
                    <span className="text-[11px] font-mono font-bold opacity-75">
                      ({section.items.length})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {section.subtitle}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>👆 Toca una guía para practicar en vivo</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {section.items.map(item => {
                  const stepsCount = getTutorialStepsByTour(item.id).length;
                  return (
                    <div
                      key={item.id}
                      data-testid={`tutorial-card-${item.id}`}
                      className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between gap-3.5 transition-colors ${themeTokens.cardInnerSurface}`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>{item.badge}</span>
                          <span className="font-mono tabular-nums">
                            {stepsCount} {stepsCount === 1 ? 'paso' : 'pasos'}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          {item.icon}
                          <span>{item.title}</span>
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          data-testid={`tutorial-start-${item.id}-btn`}
                          onClick={() => onStartTour(item.id)}
                          className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 ${section.accentButton}`}
                          title={`Iniciar tutorial interactivo: ${item.title}`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Iniciar guía</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
