import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLIDAY_SEGAR_EXAMPLE_DRAFT,
  HOSPITAL_AREA_OPTIONS,
  buildOrdenesMedicasItems,
  calculateAutoMedicationQuantity,
  composeDosisCalculo,
  createInitialBuilderState,
  formatHidratacionFromFields,
  formatMedicationOrderLine,
  formatNebulizationOrderLine,
  formatOxygenOrderLine,
  inferQuantityUnitFromDoseUnit,
  normalizeHospitalAreaLabel,
} from './ordenesMedicasBuilder';

describe('ordenesMedicasBuilder', () => {
  it('formats oxygen orders for continuo and SOS SpO2 < 93%', () => {
    assert.equal(
      formatOxygenOrderLine({ mode: 'no', humedad: 'Húmedo', modalidad: 'Cánula nasal', flujo: '3' }),
      null
    );
    assert.equal(
      formatOxygenOrderLine({
        mode: 'continuo',
        humedad: 'Húmedo',
        modalidad: 'Mascarilla simple',
        flujo: '5',
      }),
      'Oxígeno húmedo por mascarilla simple a 5 litros por minuto continuo'
    );
    assert.equal(
      formatOxygenOrderLine({
        mode: 'sos',
        humedad: 'Seco',
        modalidad: 'Cánula nasal',
        flujo: '2',
      }),
      'Oxígeno seco por cánula nasal a 2 litros por minuto SOS SpO2 < 93%'
    );
  });

  it('formats Holiday Segar parenteral hydration in exact multi-line clinical layout', () => {
    const text = formatHidratacionFromFields(HOLIDAY_SEGAR_EXAMPLE_DRAFT);
    assert.equal(
      text,
      [
        'HP Holiday Segar (Hidratación Parenteral):',
        'Sol. Dextrosa 5%: 500 cc',
        'NaCl 20%: 8 ml | KCl: 27.2 ml',
        'G. Calcio 10%: 20.4 ml',
        'MgSO4: 2.4 ml → VEV c/8h a 69 ml/h a 1.15 gotas/Min por BIC',
      ].join('\n')
    );
  });

  it('calculates auto quantity from patient weight × numeric dose and composes 2-field dose label', () => {
    assert.equal(calculateAutoMedicationQuantity('12 kg', '5', 'mg/kg/dosis'), '60');
    assert.equal(calculateAutoMedicationQuantity('12.5', '15', 'mg/kg/dosis'), '187.5');
    assert.equal(calculateAutoMedicationQuantity('10 kg', '500', 'UI/kg/dosis'), '5000');
    assert.equal(calculateAutoMedicationQuantity('10 kg', '25', 'mg'), '250');
    assert.equal(composeDosisCalculo('5', 'mg/kg/dosis'), '5 mg/kg/dosis');
    assert.equal(inferQuantityUnitFromDoseUnit('UI/kg/dosis'), 'UI');
    assert.equal(inferQuantityUnitFromDoseUnit('ml/kg/dosis'), 'ml');
    assert.equal(normalizeHospitalAreaLabel('ÁREA DE OBSERVACIÓN'), 'Área de Observación');
    assert.ok(HOSPITAL_AREA_OPTIONS.includes('Traumashock'));
    assert.ok(HOSPITAL_AREA_OPTIONS.includes('Hospitalización'));
  });

  it('formats medications with VEV/VO, hours (2/4/6/8/10/12/24), and STAT variants', () => {
    assert.equal(
      formatMedicationOrderLine({
        id: '1',
        nombre: 'Hidrocortisona',
        dosisCalculo: '5 mg/kg/dosis',
        cantidadMg: '200',
        unidad: 'mg',
        via: 'VEV',
        intervaloHoras: '6',
        esStat: false,
        soloStat: false,
      }),
      'Hidrocortisona 200 mg VEV c/6h'
    );
    assert.equal(
      formatMedicationOrderLine({
        id: '2',
        nombre: 'Dipirona',
        dosisCalculo: '15 mg/kg/dosis',
        cantidadMg: '300',
        unidad: 'mg',
        via: 'VEV',
        intervaloHoras: '8',
        esStat: true,
        soloStat: true,
      }),
      'Dipirona 300 mg VEV STAT'
    );
    assert.equal(
      formatMedicationOrderLine({
        id: '3',
        nombre: 'Amoxicilina',
        dosisCalculo: '50 mg/kg/día',
        cantidadMg: '250',
        unidad: 'mg',
        via: 'VO',
        intervaloHoras: '10',
        esStat: true,
        soloStat: false,
      }),
      'Amoxicilina 250 mg VO STAT y luego c/10h'
    );
  });

  it('formats nebulization with Salbutamol, Bromuro de Ipratropio, Budesonida (3cc Sol 0.9%) and Hipertónica', () => {
    const line = formatNebulizationOrderLine({
      salbutamol: { enabled: true, gotas: '20', intervaloHoras: '2' },
      ipratropio: { enabled: true, gotas: '40', intervaloHoras: '4' },
      budesonida: { enabled: true, gotas: '20', intervaloHoras: '8' },
      hipertonicaEnabled: true,
      hipertonicaCc: '3',
      hipertonicaHoras: '6',
    });
    assert.ok(line?.includes('Salbutamol 20 gotas diluido en 3cc de Sol. 0.9% c/2h'));
    assert.ok(line?.includes('Bromuro de Ipratropio 40 gotas diluido en 3cc de Sol. 0.9% c/4h'));
    assert.ok(line?.includes('Budesonida 20 gotas diluido en 3cc de Sol. 0.9% c/8h'));
    assert.ok(line?.includes('Solución Hipertónica 3% 3cc c/6h'));
  });

  it('builds complete numbered medical orders from full guided builder state including 2-field dose', () => {
    const state = createInitialBuilderState('Respiratorio');
    state.dietaTipo = 'Lactancia Materna Exclusiva (LME)';
    state.posicion = 'Posición Semi-Fowler (30°)';
    state.oxigenoMode = 'sos';
    state.oxigenoHumedad = 'Húmedo';
    state.oxigenoModalidad = 'Cánula nasal';
    state.oxigenoFlujo = '2';
    state.monitorizacionContinua = true;
    state.requiereHidratacion = true;
    state.hidratacion = { ...HOLIDAY_SEGAR_EXAMPLE_DRAFT };
    state.requiereMedicamentos = true;
    state.medicamentos = [
      {
        id: 'm1',
        nombre: 'Hidrocortisona',
        dosisCalculo: '',
        dosisNumero: '5',
        dosisUnidad: 'mg/kg/dosis',
        cantidadMg: '100',
        unidad: 'mg',
        via: 'VEV',
        intervaloHoras: '6',
        esStat: false,
        soloStat: false,
      },
    ];
    state.requiereNebulizacion = true;
    state.nebulizacion.salbutamol = { enabled: true, gotas: '10', intervaloHoras: '4' };
    state.laboratoriosSeleccionados = ['Perfil 20', 'PCR cualitativa', 'Ferritina'];
    state.imagenologicosSeleccionados = ['Rx de tórax AP y L (BT)'];
    state.requiereBalanceHidrico = true;

    const items = buildOrdenesMedicasItems(state);
    assert.equal(items.length, 11);
    assert.equal(items[0].itemNumber, 1);
    assert.equal(items[0].descripcion, 'Ingresar paciente en Respiratorio');
    assert.equal(items[1].descripcion, 'Lactancia Materna Exclusiva (LME)');
    assert.equal(items[2].descripcion, 'Posición Semi-Fowler (30°)');
    assert.equal(
      items[3].descripcion,
      'Oxígeno húmedo por cánula nasal a 2 litros por minuto SOS SpO2 < 93%'
    );
    assert.equal(items[4].descripcion, 'Monitorización continua');
    assert.ok(items[5].descripcion.startsWith('HP Holiday Segar (Hidratación Parenteral):'));
    assert.equal(items[6].dosisCalculo, '5 mg/kg/dosis');
    assert.equal(items[6].descripcion, 'Hidrocortisona 100 mg VEV c/6h');
    assert.ok(items[7].descripcion.includes('Salbutamol 10 gotas diluido en 3cc de Sol. 0.9% c/4h'));
    assert.equal(items[8].descripcion, 'Laboratorios: Perfil 20, PCR cualitativa, Ferritina');
    assert.equal(items[9].descripcion, 'Imagenológicos: Rx de tórax AP y L (BT)');
    assert.equal(items[10].descripcion, 'Balance Hídrico: Control estricto de ingresos y egresos');
  });
});
