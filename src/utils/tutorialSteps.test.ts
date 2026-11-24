import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTutorialStepsByTour,
  HISTORIA_CLINICA_TUTORIAL_STEPS,
  EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS,
  IMPRIMIR_EVOLUCION_TUTORIAL_STEPS,
  IMPRIMIR_HISTORIA_CLINICA_TUTORIAL_STEPS,
  IMPRIMIR_ORDENES_MEDICAS_TUTORIAL_STEPS,
  GENERAR_ORDENES_MEDICAS_TUTORIAL_STEPS,
  TutorialTourId,
} from './tutorialSteps';

test('getTutorialStepsByTour returns non-empty unique steps for every tour including print tutorials', () => {
  const allTours: TutorialTourId[] = [
    'historia_clinica',
    'tablero_camas',
    'evolucionar_paciente',
    'dar_alta_medica',
    'ver_documentos_paciente',
    'generar_ordenes_medicas',
    'descargar_imprimir_inicio',
    'imprimir_evolucion',
    'imprimir_historia_clinica',
    'imprimir_ordenes_medicas',
    'altas_buscar_reingresar',
    'tareas_guardia',
    'ver_estadisticas',
    'rol_guardias',
    'sonido_y_temas',
  ];

  for (const tourId of allTours) {
    const steps = getTutorialStepsByTour(tourId);
    assert.ok(steps.length >= 2, `Tour ${tourId} should have at least 2 steps`);
    const ids = new Set(steps.map(s => s.id));
    assert.equal(ids.size, steps.length, `Tour ${tourId} must have unique step IDs`);
    for (const s of steps) {
      assert.equal(s.tourId, tourId);
      assert.ok(s.targetSelector.length > 0);
      assert.ok(s.message.length > 0);
    }
  }
});

test('Historia Clinica tutorial stays synced with Jospeth Perez, non-destructive lock, quick fill, restore normal, Ordenes signatures, and Resumen Fecha', () => {
  const combined = HISTORIA_CLINICA_TUTORIAL_STEPS.map(s => `${s.title} ${s.message}`).join('\n');
  assert.match(combined, /Jospeth Perez/);
  assert.match(combined, /Enfermera/);
  assert.match(combined, /Residente superior o adjunto de guardia/);
  assert.match(combined, /Bloquear/i);
  assert.match(combined, /SIN borrar/i);
  assert.match(combined, /Restaurar normal/i);
  assert.match(combined, /Llenado rápido/i);
  assert.match(combined, /Inspección/i);
  assert.match(combined, /Palpación/i);
  assert.match(combined, /Percusión/i);
  assert.match(combined, /Auscultación/i);
  assert.match(combined, /Fecha junto a Servicio|Fecha arriba junto a Servicio/i);

  const toraxStep = HISTORIA_CLINICA_TUTORIAL_STEPS.find(s => s.id === 'hc-30b-p5-rapido-torax');
  assert.ok(toraxStep);
  assert.equal(toraxStep.openQuickFillField, 'toraxPulmonesFisico');

  const restoreStep = HISTORIA_CLINICA_TUTORIAL_STEPS.find(s => s.id === 'hc-30c-p5-restaurar-normal');
  assert.ok(restoreStep);
  assert.equal(restoreStep.targetSelector, '[data-tutorial="p5-fisico-restore-first"]');

  const dropdownStep = HISTORIA_CLINICA_TUTORIAL_STEPS.find(s => s.id === 'hc-02b-acceso-rapido-dropdown');
  assert.ok(dropdownStep);
  assert.equal(dropdownStep.targetSelector, '[data-tutorial="hc-quick-jump-dropdown"]');
  assert.match(dropdownStep.message, /barra desplegable/i);
});

test('Evolucionar paciente tutorial explains Dx/Sub-Dx/order, full Tratamiento, Apoyo Ventilatorio, Balance Hídrico 24h, and editing Examen Físico del Día', () => {
  const combined = EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS.map(s => `${s.title} ${s.message}`).join('\n');
  assert.match(combined, /Sub-Dx|Sub-Diagnósticos/i);
  assert.match(combined, /Cambiar el orden|Cambio de Orden/i);
  assert.match(combined, /no cumplido/i);
  assert.match(combined, /Tratamiento culminado/i);
  assert.match(combined, /Readministrar/i);
  assert.match(combined, /Parámetros del Apoyo Ventilatorio/i);
  assert.match(combined, /Balance Hídrico \(24 Horas\)/i);
  assert.match(combined, /Flujo Urinario/i);
  assert.match(combined, /Examen Físico del Día/i);

  const dxStep = EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS.find(s => s.id === 'evo-05b-dx-orden-subdx');
  assert.equal(dxStep?.evolutionUiState?.editDxTx, true);

  const o2Step = EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS.find(s => s.id === 'evo-07-o2-parametros');
  assert.equal(o2Step?.evolutionUiState?.withO2, true);

  const bhStep = EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS.find(s => s.id === 'evo-07b-balance-24h');
  assert.equal(bhStep?.evolutionUiState?.withBalance, true);

  const examEditStep = EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS.find(s => s.id === 'evo-08b-examen-editar');
  assert.equal(examEditStep?.evolutionUiState?.editingExamField, 'toraxCP');
});

test('Print tutorials cover Evolucion, Historia Clinica (preview tab), and Ordenes Medicas with updated signatures', () => {
  assert.ok(IMPRIMIR_EVOLUCION_TUTORIAL_STEPS.some(s => s.requiredModal === 'evolution_print'));
  assert.ok(IMPRIMIR_HISTORIA_CLINICA_TUTORIAL_STEPS.some(s => s.historiaTab === 'preview'));
  assert.ok(IMPRIMIR_ORDENES_MEDICAS_TUTORIAL_STEPS.some(s => s.requiredModal === 'ordenes'));

  const ordenesPrintCopy = IMPRIMIR_ORDENES_MEDICAS_TUTORIAL_STEPS.map(s => s.message).join(' ');
  assert.match(ordenesPrintCopy, /Enfermera/);
  assert.match(ordenesPrintCopy, /Residente superior o adjunto de guardia/);

  const generarOrdenesCopy = GENERAR_ORDENES_MEDICAS_TUTORIAL_STEPS.map(s => s.message).join(' ');
  assert.match(generarOrdenesCopy, /Enfermera/);
  assert.match(generarOrdenesCopy, /Residente superior o adjunto de guardia/);
});
