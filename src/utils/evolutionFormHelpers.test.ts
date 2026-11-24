import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripDiagnosisNumbering,
  extractMedicationNameOnly,
  buildSeparatedDiagnosisSuggestions,
  buildMedicationNameSuggestions,
  parseTreatmentText,
  serializeTreatmentNodes,
  markTreatmentCulminado,
  readministrarTreatment,
  calculateTotalActiveDays,
  SINTOMATICO_LABEL,
  normalizeTreatmentDisplay,
  TxNode,
} from './evolutionFormHelpers';

test('stripDiagnosisNumbering removes hierarchical numeric prefixes cleanly', () => {
  assert.equal(stripDiagnosisNumbering('1. Neumonía Adquirida en la Comunidad'), 'Neumonía Adquirida en la Comunidad');
  assert.equal(stripDiagnosisNumbering('1.1. Deshidratación Moderada'), 'Deshidratación Moderada');
  assert.equal(stripDiagnosisNumbering('   2.3.1 Etiología Viral'), 'Etiología Viral');
  assert.equal(stripDiagnosisNumbering('├ 1.2 Sibilancias Recurrentes'), 'Sibilancias Recurrentes');
});

test('extractMedicationNameOnly strips dosages, routes, and intervals', () => {
  assert.equal(extractMedicationNameOnly('Ampicilina Sulbactam 50mg/kg/dosis EV c/6h'), 'Ampicilina Sulbactam');
  assert.equal(extractMedicationNameOnly('Ceftriaxona 100mg/kg/día EV c/12h'), 'Ceftriaxona');
  assert.equal(extractMedicationNameOnly('Salbutamol nebulizado 0.15mg/kg/dosis c/4h'), 'Salbutamol nebulizado');
  assert.equal(extractMedicationNameOnly('Dipirona 15mg/kg/dosis EV SOS T° > 38.5°C'), 'Dipirona');
  assert.equal(extractMedicationNameOnly('1. Cefotaxima | Dosis: 150 mg/kg/día | Día 3'), 'Cefotaxima');
  assert.equal(extractMedicationNameOnly('Sintomático'), '');
});

test('buildSeparatedDiagnosisSuggestions separates main Dx and sub-Dx with zero numbering prefixes and zero overlap', () => {
  const patients: any[] = [
    {
      diagnoses: [
        {
          id: 'd1',
          title: '1. Neumonía Basal Derecha',
          subDiagnoses: ['1.1. Insuficiencia Respiratoria Leve', '1.2 Derrame Pleural'],
        },
        {
          id: 'd2',
          title: '2.1. Hipokalemia Leve',
        },
      ],
      evolutions: [
        {
          diagnosesModified: '1. Bronquiolitis Viral\n   1.1 Deshidratación Moderada',
        },
      ],
    },
  ];
  const historias: any[] = [
    {
      diagnosticoAdmision: '1. Síndrome Febril Prolongado\n   1.1 Anemia Secundaria',
    },
  ];

  const { mainSuggestions, subSuggestions } = buildSeparatedDiagnosisSuggestions(patients, historias);

  assert.ok(mainSuggestions.includes('Neumonía Basal Derecha'));
  assert.ok(mainSuggestions.includes('Bronquiolitis Viral'));
  assert.ok(mainSuggestions.includes('Síndrome Febril Prolongado'));

  assert.ok(subSuggestions.includes('Insuficiencia Respiratoria Leve'));
  assert.ok(subSuggestions.includes('Derrame Pleural'));
  assert.ok(subSuggestions.includes('Hipokalemia Leve'));
  assert.ok(subSuggestions.includes('Anemia Secundaria'));

  // No numeric prefixes in either bucket
  for (const s of [...mainSuggestions, ...subSuggestions]) {
    assert.equal(/^\d+\./.test(s), false, `Unexpected numeric prefix in suggestion: ${s}`);
  }

  // Zero overlap between mainSuggestions and subSuggestions
  const mainLower = new Set(mainSuggestions.map(s => s.toLowerCase()));
  for (const sub of subSuggestions) {
    assert.equal(mainLower.has(sub.toLowerCase()), false, `Sub-diagnosis leaked into mainSuggestions: ${sub}`);
  }
});

test('buildMedicationNameSuggestions contains only medication names without dosages', () => {
  const patients: any[] = [
    {
      treatment: '1. Ampicilina Sulbactam 50mg/kg/dosis EV c/6h | Día 2\n2. Acetaminofén 15mg/kg/dosis VO SOS',
    },
  ];
  const meds = buildMedicationNameSuggestions(patients, []);
  assert.ok(meds.includes('Ampicilina Sulbactam'));
  assert.ok(meds.includes('Acetaminofén'));
  for (const m of meds) {
    assert.equal(/\d+\s*mg\/kg/i.test(m), false, `Dosage leaked into medication suggestion: ${m}`);
    assert.equal(/c\/\d+h/i.test(m), false, `Interval leaked into medication suggestion: ${m}`);
  }
});

test('empty treatments serialize to Sintomático and parse back to an empty editable row', () => {
  const refDate = new Date('2026-11-18T12:00:00');
  const emptyNodes: TxNode[] = [
    { id: 't-1', numberStr: '1.', text: '   ', startDate: '2026-11-18', doseValue: '', doseUnit: 'mg', doseBasis: 'día' },
  ];
  assert.equal(serializeTreatmentNodes(emptyNodes, refDate), SINTOMATICO_LABEL);
  assert.equal(normalizeTreatmentDisplay(''), SINTOMATICO_LABEL);
  assert.equal(normalizeTreatmentDisplay('Sintomático'), SINTOMATICO_LABEL);

  const parsed = parseTreatmentText(SINTOMATICO_LABEL, refDate);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, '');
});

test('doseBasis=dosis serializes and parses hour interval (2, 4, 6, 8, 10, 12, 24)', () => {
  const refDate = new Date('2026-11-18T12:00:00');
  const nodes: TxNode[] = [
    {
      id: 'tx-1',
      numberStr: '1.',
      text: 'Ampicilina Sulbactam',
      startDate: '2026-11-16',
      doseValue: '50',
      doseUnit: 'mg',
      doseBasis: 'dosis',
      doseIntervalHours: '8',
    },
  ];
  const serialized = serializeTreatmentNodes(nodes, refDate);
  assert.equal(serialized, '1. Ampicilina Sulbactam | Dosis: 50 mg/kg/dosis c/8h | Día 3');

  const reparsed = parseTreatmentText(serialized, refDate);
  assert.equal(reparsed.length, 1);
  assert.equal(reparsed[0].text, 'Ampicilina Sulbactam');
  assert.equal(reparsed[0].doseValue, '50');
  assert.equal(reparsed[0].doseUnit, 'mg');
  assert.equal(reparsed[0].doseBasis, 'dosis');
  assert.equal(reparsed[0].doseIntervalHours, '8');
});

test('gotas unit omits /kg/ for nebulized medications and round-trips cleanly', () => {
  const refDate = new Date('2026-11-18T12:00:00');
  const nodes: TxNode[] = [
    {
      id: 'tx-neb',
      numberStr: '1.',
      text: 'Salbutamol nebulizado',
      startDate: '2026-11-18',
      doseValue: '15',
      doseUnit: 'gotas',
      doseBasis: 'dosis',
      doseIntervalHours: '4',
    },
  ];
  const serialized = serializeTreatmentNodes(nodes, refDate);
  assert.equal(serialized, '1. Salbutamol nebulizado | Dosis: 15 gotas/dosis c/4h | Día 1');
  assert.equal(serialized.includes('/kg'), false, 'gotas must never include /kg');

  const reparsed = parseTreatmentText(serialized, refDate);
  assert.equal(reparsed[0].doseValue, '15');
  assert.equal(reparsed[0].doseUnit, 'gotas');
  assert.equal(reparsed[0].doseBasis, 'dosis');
  assert.equal(reparsed[0].doseIntervalHours, '4');
});

test('markTreatmentCulminado records start and culmination dates and moves item to end', () => {
  const refDate = new Date('2026-11-18T12:00:00');
  const nodes: TxNode[] = [
    {
      id: 'tx-1',
      numberStr: '1.',
      text: 'Ceftriaxona',
      startDate: '2026-11-12',
      doseValue: '100',
      doseUnit: 'mg',
      doseBasis: 'día',
    },
    {
      id: 'tx-2',
      numberStr: '2.',
      text: 'Acetaminofén',
      startDate: '2026-11-17',
      doseValue: '15',
      doseUnit: 'mg',
      doseBasis: 'dosis',
      doseIntervalHours: '6',
    },
  ];

  const updated = markTreatmentCulminado(nodes, 0, refDate);
  assert.equal(updated.length, 2);
  // Active medication is now first, culminated medication moved to end
  assert.equal(updated[0].text, 'Acetaminofén');
  assert.equal(updated[0].isCulminado, undefined);
  assert.equal(updated[1].text, 'Ceftriaxona');
  assert.equal(updated[1].isCulminado, true);
  assert.equal(updated[1].culminadoDias, 7);
  assert.equal(updated[1].startDate, '2026-11-12');
  assert.equal(updated[1].culminatedDate, '2026-11-18');

  const serialized = serializeTreatmentNodes(updated, refDate);
  assert.ok(
    serialized.includes(
      '2. Ceftriaxona | Dosis: 100 mg/kg/día | TRATAMIENTO CULMINADO | Inicio: 2026-11-12 | Culminación: 2026-11-18 | 7 días cumplidos'
    ),
    `Unexpected serialized culminated output: ${serialized}`
  );

  // Round-trip parse preserves culmination, startDate, culminatedDate, and completed days
  const reparsed = parseTreatmentText(serialized, refDate);
  assert.equal(reparsed[1].text, 'Ceftriaxona');
  assert.equal(reparsed[1].isCulminado, true);
  assert.equal(reparsed[1].startDate, '2026-11-12');
  assert.equal(reparsed[1].culminatedDate, '2026-11-18');
  assert.equal(reparsed[1].culminadoDias, 7);
});

test('readministrarTreatment resumes day counter seamlessly without counting paused days', () => {
  // Started Nov 10, culminated Nov 11 -> 2 days completed
  const nodes: TxNode[] = [
    {
      id: 'tx-1',
      numberStr: '1.',
      text: 'Ceftriaxona',
      startDate: '2026-11-10',
      doseValue: '100',
      doseUnit: 'mg',
      doseBasis: 'día',
    },
  ];
  const culminated = markTreatmentCulminado(nodes, 0, new Date('2026-11-11T12:00:00'));
  assert.equal(culminated[0].culminadoDias, 2);
  assert.equal(culminated[0].culminatedDate, '2026-11-11');

  // Paused 3 days (Nov 12, 13, 14). Re-administered on Nov 15 -> must display Día 3!
  const resumedDate = new Date('2026-11-15T12:00:00');
  const resumed = readministrarTreatment(culminated, 0, resumedDate);
  assert.equal(resumed[0].isCulminado, false);
  assert.equal(resumed[0].priorCompletedDays, 2);
  assert.equal(resumed[0].startDate, '2026-11-15');
  assert.equal(calculateTotalActiveDays(resumed[0], resumedDate), 3);

  const serialized = serializeTreatmentNodes(resumed, resumedDate);
  assert.ok(serialized.includes('Día 3'), `Expected Día 3 in ${serialized}`);
  assert.ok(serialized.includes('Acumulado: 2d'), `Expected Acumulado: 2d in ${serialized}`);

  // Round-trip next day (Nov 16) -> must advance to Día 4!
  const nextDay = new Date('2026-11-16T12:00:00');
  const reparsed = parseTreatmentText(serialized, nextDay);
  assert.equal(reparsed[0].priorCompletedDays, 2);
  assert.equal(calculateTotalActiveDays(reparsed[0], nextDay), 4);
});
