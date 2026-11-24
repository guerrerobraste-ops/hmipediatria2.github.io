import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMEN_FUNCIONAL_QUICK_FILL,
  EXAMEN_FISICO_QUICK_FILL,
  toggleQuickFillOption,
  composeQuickFillClinicalText,
  mergeQuickFillWithManualNotes,
} from './clinicalExamQuickFill.ts';

test('all 14 Examen Funcional systems and 18 Examen Fisico items have quick-fill definitions', () => {
  assert.equal(Object.keys(EXAMEN_FUNCIONAL_QUICK_FILL).length, 14);
  assert.equal(Object.keys(EXAMEN_FISICO_QUICK_FILL).length, 18);
});

test('toggleQuickFillOption enforces single-select and exclusive option clearing in multi-select groups', () => {
  const torax = EXAMEN_FISICO_QUICK_FILL.toraxPulmonesFisico;
  const expansibilidad = torax.groups.find(g => g.id === 'torax_expansibilidad')!;
  const tiraje = torax.groups.find(g => g.id === 'torax_tiraje')!;

  // Single select replaces previous choice and toggles off on second click
  let expSel = toggleQuickFillOption(expansibilidad, [], 'hipoexp');
  assert.deepEqual(expSel, ['hipoexp']);
  expSel = toggleQuickFillOption(expansibilidad, expSel, 'hiperexp');
  assert.deepEqual(expSel, ['hiperexp']);
  expSel = toggleQuickFillOption(expansibilidad, expSel, 'hiperexp');
  assert.deepEqual(expSel, []);

  // Multi select accumulates pathological findings and clears "sin_tiraje" exclusive option
  let tirSel = toggleQuickFillOption(tiraje, [], 'sin_tiraje');
  assert.deepEqual(tirSel, ['sin_tiraje']);
  tirSel = toggleQuickFillOption(tiraje, tirSel, 'intercostal');
  assert.deepEqual(tirSel, ['intercostal']);
  tirSel = toggleQuickFillOption(tiraje, tirSel, 'subcostal');
  assert.deepEqual(tirSel, ['intercostal', 'subcostal']);
  tirSel = toggleQuickFillOption(tiraje, tirSel, 'sin_tiraje');
  assert.deepEqual(tirSel, ['sin_tiraje']);
});

test('composeQuickFillClinicalText produces structured Inspeccion, Palpacion, Percusion, Auscultacion prose for Torax y Pulmones', () => {
  const torax = EXAMEN_FISICO_QUICK_FILL.toraxPulmonesFisico;
  const text = composeQuickFillClinicalText(torax, {
    torax_tipo: ['tonel'],
    torax_expansibilidad: ['hipoexp'],
    torax_tiraje: ['intercostal', 'supraclavicular'],
    torax_retraccion: ['xifoidea_marcada'],
    torax_palpacion: ['fremito_dism'],
    torax_percusion: ['matidez_der'],
    torax_mv: ['mv_dism_der'],
    torax_estertores: ['sibilantes', 'crepitantes', 'roce_pleural'],
  });

  assert.match(text, /Inspección:.*en tonel.*hipoexpansible.*tiraje intercostal y supraclavicular.*retracción xifoidea marcada\./);
  assert.match(text, /Palpación: Vibraciones vocales disminuidas\./);
  assert.match(text, /Percusión: Matidez en base pulmonar derecha\./);
  assert.match(text, /Auscultación: Murmullo vesicular disminuido en hemitórax derecho, con presencia de sibilantes espiratorios, crepitantes y roce pleural\./);
});

test('composeQuickFillClinicalText formats Examen Funcional with Madre refiere prefix', () => {
  const resp = EXAMEN_FUNCIONAL_QUICK_FILL.respiratorioFuncional;
  const text = composeQuickFillClinicalText(resp, {
    ef_resp_sintomas: ['tos_humeda', 'disnea', 'sibilancias'],
  });
  assert.equal(
    text,
    'Madre refiere: tos húmeda productiva con movilización de secreciones, dificultad respiratoria progresiva y sibilancias audibles.'
  );
});

test('mergeQuickFillWithManualNotes preserves manually appended clinician notes when toggling chips', () => {
  const merged = mergeQuickFillWithManualNotes(
    'Inspección: Tórax simétrico. Nota adicional del residente.',
    'Inspección: Tórax simétrico.',
    'Inspección: Tórax simétrico, hipoexpansible.'
  );
  assert.equal(merged, 'Inspección: Tórax simétrico, hipoexpansible. Nota adicional del residente.');
});
