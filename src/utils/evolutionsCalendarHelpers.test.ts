import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarGrid,
  computeHospitalizationDayNumber,
  formatEvolutionSpanishDate,
  getAvailableEvolutionMonths,
  resolveOrdersForEvolution,
  shiftMonthKey,
} from './evolutionsCalendarHelpers';
import { Patient } from '../types';

const mockPatient: Patient = {
  id: 'test-patient-1',
  medicalHistoryNumber: 'HC-2026-001',
  firstName: 'Sofía',
  lastName: 'Mendoza',
  age: '5 años',
  weightKg: 18.5,
  area: 'Hospitalización',
  bedNumber: 'Cama 04',
  admissionDate: '2026-11-01',
  admissionTime: '10:00',
  gender: 'F',
  status: 'hospitalized',
  diagnoses: [{ id: 'dx-1', title: 'Bronconeumonía' }],
  treatment: 'Ampicilina/Sulbactam',
  pendingExams: 'Ninguno',
  doctorInCharge: 'Dr. Jospeth Perez',
  evolutions: [
    {
      id: 'ev-1',
      patientId: 'test-patient-1',
      date: '2026-11-22',
      time: '08:00',
      doctorName: 'Dr. Jospeth Perez',
      evolutionNote: 'Evolución favorable',
      subjetivo: 'Paciente estable',
      objetivo: 'Afebril, buena entrada de aire',
      comentariosPlan: 'Continuar tratamiento antibiótico',
      examenFisico: {
        piel: 'Sana',
        cabezaOjos: 'Normocéfalo',
        oidosOtoscopia: 'Normal',
        narizOrofaringe: 'Normal',
        cuello: 'Normal',
        toraxCP: 'Normal',
        abdomen: 'Normal',
        genitourinario: 'Normal',
        extremidades: 'Normal',
        neurologico: 'Normal',
      },
      ordenesMedicas: [
        { id: 'ord-1', itemNumber: 1, descripcion: 'Dieta pediátrica acorde a la edad' },
      ],
      createdAt: '2026-11-22T08:00:00.000Z',
    },
    {
      id: 'ev-2',
      patientId: 'test-patient-1',
      date: '2026-11-21',
      time: '08:30',
      doctorName: 'Dr. Jospeth Perez',
      evolutionNote: 'Evolución día 2',
      subjetivo: 'Tos leve',
      objetivo: 'Estable',
      examenFisico: {
        piel: 'Sana',
        cabezaOjos: 'Normocéfalo',
        oidosOtoscopia: 'Normal',
        narizOrofaringe: 'Normal',
        cuello: 'Normal',
        toraxCP: 'Normal',
        abdomen: 'Normal',
        genitourinario: 'Normal',
        extremidades: 'Normal',
        neurologico: 'Normal',
      },
      createdAt: '2026-11-21T08:30:00.000Z',
    },
  ],
  ordenesMedicas: [],
  documents: [],
  resumenesEvolutivos: [],
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-22T08:00:00.000Z',
};

test('formatEvolutionSpanishDate formats YYYY-MM-DD into Spanish day, month, and weekday', () => {
  const formatted = formatEvolutionSpanishDate('2026-11-22');
  assert.equal(formatted.dayNum, '22');
  assert.equal(formatted.monthShort, 'NOV');
  assert.equal(formatted.monthFull, 'Noviembre');
  assert.equal(formatted.year, '2026');
  assert.ok(formatted.fullFormatted.includes('Noviembre 2026'));
});

test('computeHospitalizationDayNumber computes 1-indexed stay day accurately', () => {
  assert.equal(computeHospitalizationDayNumber('2026-11-20', '2026-11-20'), 1);
  assert.equal(computeHospitalizationDayNumber('2026-11-22', '2026-11-20'), 3);
  assert.equal(computeHospitalizationDayNumber('2026-11-18', '2026-11-20'), null);
});

test('buildMonthCalendarGrid builds 42 Monday-first cells and marks evolved days with medical orders', () => {
  const months = getAvailableEvolutionMonths(mockPatient);
  assert.ok(months.length >= 1);

  const grid = buildMonthCalendarGrid(months[0].monthKey, mockPatient);
  assert.equal(grid.length, 42);

  const evolvedCells = grid.filter(c => c.evolutions.length > 0);
  assert.ok(evolvedCells.length >= 2);
  assert.equal(evolvedCells[0].hasOrders, true);
  assert.ok(evolvedCells[0].ordersCount > 0);
});

test('resolveOrdersForEvolution returns evolution orders or falls back cleanly so orders are always visible', () => {
  const firstEvolution = mockPatient.evolutions[0];
  const resolved = resolveOrdersForEvolution(mockPatient, firstEvolution);
  assert.equal(resolved.source, 'evolution');
  assert.ok(resolved.orders.length > 0);

  const secondEvolution = mockPatient.evolutions[1];
  const fallbackResolved = resolveOrdersForEvolution(mockPatient, secondEvolution);
  assert.equal(fallbackResolved.source, 'standard');
  assert.ok(fallbackResolved.orders.length > 0);

  assert.equal(shiftMonthKey('2026-11', 1), '2026-12');
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
});

