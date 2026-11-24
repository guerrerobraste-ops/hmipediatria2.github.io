import { getTutorialStepsByTour, TutorialTourId } from './tutorialSteps';

export const CURRENT_DATABASE_BACKUP_VERSION = '3.3.0';

export function collectLocalStorageBuilderStatesAndDrafts(): Record<string, any> {
  const result: Record<string, any> = {};
  if (typeof window === 'undefined') return result;
  try {
    const ls = window.localStorage;
    const keys = typeof ls.key === 'function' && typeof ls.length === 'number'
      ? Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter(Boolean) as string[]
      : Object.keys(ls);

    for (const k of keys) {
      if (!k) continue;
      if (
        k.startsWith('hmi_') ||
        k.startsWith('historia_') ||
        k === 'latest_backup_meta' ||
        k === 'auto_export_always'
      ) {
        const raw = ls.getItem(k);
        if (raw !== null) {
          try {
            result[k] = JSON.parse(raw);
          } catch {
            result[k] = raw;
          }
        }
      }
    }
  } catch {}
  return result;
}

export function collectTutorialCatalogSnapshot(): Array<{ tourId: TutorialTourId; title: string; stepsCount: number }> {
  return [
    { tourId: 'historia_clinica', title: 'Historia Clínica Pediátrica Oficial (8 Acápites)', stepsCount: getTutorialStepsByTour('historia_clinica').length },
    { tourId: 'tablero_camas', title: 'Tablero de Camas por Áreas de Hospitalización', stepsCount: getTutorialStepsByTour('tablero_camas').length },
    { tourId: 'evolucionar_paciente', title: 'Evolución Médica Diaria', stepsCount: getTutorialStepsByTour('evolucionar_paciente').length },
    { tourId: 'dar_alta_medica', title: 'Resumen de Egreso y Alta Médica', stepsCount: getTutorialStepsByTour('dar_alta_medica').length },
    { tourId: 'ver_documentos_paciente', title: 'Perfil del Paciente & Historial de Archivos', stepsCount: getTutorialStepsByTour('ver_documentos_paciente').length },
    { tourId: 'generar_ordenes_medicas', title: 'Asistente Guiado de Órdenes Médicas', stepsCount: getTutorialStepsByTour('generar_ordenes_medicas').length },
    { tourId: 'descargar_imprimir_inicio', title: 'Impresión y Descarga Documental', stepsCount: getTutorialStepsByTour('descargar_imprimir_inicio').length },
    { tourId: 'altas_buscar_reingresar', title: 'Pacientes Egresados y Reingresos', stepsCount: getTutorialStepsByTour('altas_buscar_reingresar').length },
    { tourId: 'tareas_guardia', title: 'Tareas de Guardia Asistenciales', stepsCount: getTutorialStepsByTour('tareas_guardia').length },
    { tourId: 'ver_estadisticas', title: 'Estadísticas Clínicas & Gráficos', stepsCount: getTutorialStepsByTour('ver_estadisticas').length },
    { tourId: 'rol_guardias', title: 'Rol de Guardias & Calendario', stepsCount: getTutorialStepsByTour('rol_guardias').length },
    { tourId: 'sonido_y_temas', title: 'Audio Ambiental & Selector de Tema', stepsCount: getTutorialStepsByTour('sonido_y_temas').length },
  ];
}

export function hydrateLocalStorageFromBackupTables(localStorageState: Record<string, any>): number {
  if (typeof window === 'undefined' || !localStorageState || typeof localStorageState !== 'object') {
    return 0;
  }
  let restoredCount = 0;
  const ls = window.localStorage;
  for (const [k, val] of Object.entries(localStorageState)) {
    try {
      if (val !== undefined && val !== null) {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        if (!ls.getItem(k)) {
          ls.setItem(k, strVal);
          restoredCount++;
        }
      }
    } catch {}
  }
  return restoredCount;
}
