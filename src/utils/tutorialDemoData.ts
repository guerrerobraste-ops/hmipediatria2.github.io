import {
  Bed,
  HistoriaClinicaPediatrica,
  MedicalEvolution,
  OrdenMedicaItem,
  Patient,
  PersonalTask,
} from '../types';
import { DEFAULT_HISTORIA_CLINICA, getPediatricNormalPhysicalExam } from '../data/initialData';

export const TUTORIAL_DEMO_PATIENT_ID = 'tutorial-demo-patient-1';
export const TUTORIAL_DEMO_DISCHARGED_ID = 'tutorial-demo-discharged-1';
export const TUTORIAL_DEMO_HC_ID = 'tutorial-demo-hc-1';
export const TUTORIAL_DEMO_DISCHARGED_HC_ID = 'tutorial-demo-hc-2';

export function isTutorialDemoId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith('tutorial-demo-');
}

// Inline lightweight SVG preview so clicking "VER" on the fictional attached lab works instantaneously offline
const DEMO_LAB_SVG_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" fill="#ffffff"/>
      <rect x="20" y="20" width="600" height="380" rx="14" fill="#f8fafc" stroke="#0d9488" stroke-width="2"/>
      <text x="44" y="64" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#0f172a">LABORATORIO DE PRÁCTICA (PACIENTE FICTICIO)</text>
      <text x="44" y="92" font-family="Arial,sans-serif" font-size="13" fill="#475569">Paciente: Mateo Alejandro Pérez Demo · HC: DEMO-2026-001 · Solo tutorial</text>
      <line x1="44" y1="112" x2="596" y2="112" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="44" y="150" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#0f766e">Hematología Completa:</text>
      <text x="44" y="182" font-family="monospace" font-size="14" fill="#1e293b">• Glóbulos Blancos (GB):  12.400 /mm³   (Seg: 64% · Lin: 32%)</text>
      <text x="44" y="210" font-family="monospace" font-size="14" fill="#1e293b">• Hemoglobina (Hb):       11.8 g/dL     (Hcto: 35.4%)</text>
      <text x="44" y="238" font-family="monospace" font-size="14" fill="#1e293b">• Plaquetas (Plt):        315.000 /mm³</text>
      <text x="44" y="266" font-family="monospace" font-size="14" fill="#1e293b">• PCR Cuantitativa:       18.5 mg/L     (VSG: 22 mm/h)</text>
      <text x="44" y="308" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#0d9488">Documento ficticio generado únicamente para el Tutorial Interactivo.</text>
      <text x="44" y="334" font-family="Arial,sans-serif" font-size="12" fill="#64748b">Ningún dato de esta práctica se guarda en la base de datos hospitalaria.</text>
    </svg>`
  );

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export interface TutorialSandboxData {
  patients: Patient[];
  historias: HistoriaClinicaPediatrica[];
  beds: Bed[];
  tasks: PersonalTask[];
  historiaDraft: HistoriaClinicaPediatrica;
}

export function createTutorialSandboxData(): TutorialSandboxData {
  const today = isoDateDaysAgo(0);
  const yesterday = isoDateDaysAgo(1);
  const threeDaysAgo = isoDateDaysAgo(3);
  const fiveDaysAgo = isoDateDaysAgo(5);
  const nowIso = new Date().toISOString();

  const demoOrders: OrdenMedicaItem[] = [
    {
      id: 'tutorial-demo-ord-1',
      itemNumber: 1,
      dosisCalculo: '',
      descripcion: 'Hospitalizar en Servicio de Pediatría — Cama Demo-01 (Práctica).',
    },
    {
      id: 'tutorial-demo-ord-2',
      itemNumber: 2,
      dosisCalculo: '',
      descripcion: 'Dieta blanda pediátrica acorde a la edad y líquidos orales a tolerancia.',
    },
    {
      id: 'tutorial-demo-ord-3',
      itemNumber: 3,
      dosisCalculo: '150 mg/kg/día',
      descripcion: 'Ampicilina/Sulbactam: Administrar 540 mg EV diluidos en 20 cc de Sol. 0.9% cada 6 horas.',
    },
    {
      id: 'tutorial-demo-ord-4',
      itemNumber: 4,
      dosisCalculo: '15 mg/kg/dosis',
      descripcion: 'Acetaminofén jarabe 120 mg/5 mL: Administrar 9 cc VO SOS fiebre ≥ 38.0 °C.',
    },
    {
      id: 'tutorial-demo-ord-5',
      itemNumber: 5,
      dosisCalculo: '',
      descripcion: 'Control de signos vitales cada 6 horas y vigilancia de patrón respiratorio.',
    },
  ];

  const baseExam = {
    piel: 'Normotérmica, normohidratada, llenado capilar < 2 segundos, sin lesiones.',
    cabezaOjos: 'Normocéfalo, pupilas isocóricas normorreactivas a la luz.',
    oidosOtoscopia: 'Conductos auditivos permeables, membranas timpánicas perladas sin abombamiento.',
    narizOrofaringe: 'Fosas nasales permeables, orofaringe levemente hiperémica sin exudados.',
    cuello: 'Móvil, simétrico, sin adenomegalias palpables.',
    toraxCP: 'Tórax simétrico, normoexpansible, ruidos respiratorios presentes con escasos crepitantes finos en base derecha, sin tiraje.',
    cardiovascular: 'Ruidos cardíacos rítmicos, normofonéticos, sin soplos.',
    abdomen: 'Blando, depresible, no doloroso a la palpación, ruidos hidroaéreos presentes.',
    genitourinario: 'Genitales externos normoconfigurados, diuresis conservada.',
    extremidades: 'Simétricas, móviles, sin edemas.',
    neurologico: 'Activo, vigil, reactivo, tono y fuerza muscular conservados.',
  };

  const demoEvolutionYesterday: MedicalEvolution = {
    id: 'tutorial-demo-ev-1',
    patientId: TUTORIAL_DEMO_PATIENT_ID,
    date: yesterday,
    time: '08:30',
    doctorName: 'Dra. Carolina Práctica (R2)',
    evolutionNote: 'Paciente de práctica en 2do día de antibioticoterapia con evolución clínica favorable.',
    subjetivo: 'Madre refiere disminución de la fiebre y mejor tolerancia a la vía oral durante las últimas 24 horas.',
    objetivo: 'Paciente activo, afebril, hidratado, saturando 98% a aire ambiente, sin signos de dificultad respiratoria.',
    diagnosesModified: '1. Neumonía Adquirida en la Comunidad (NAC) basal derecha\n2. Deshidratación leve en resolución',
    treatmentModified: '1. Ampicilina/Sulbactam 150 mg/kg/día EV c/6h\n2. Acetaminofén 15 mg/kg/dosis VO SOS fiebre',
    comentariosPlan: 'En revista médica con especialista de guardia el mismo decide mantener esquema antibiótico y evaluar control de hematología.',
    medicalRoundSummary: 'Mantener esquema antibiótico y evaluar control de hematología.',
    ordenesMedicas: demoOrders,
    ordenesFecha: yesterday,
    ordenesHora: '08:45',
    ordenesPeso: '14.5 kg',
    examenFisico: baseExam,
    vitalSigns: {
      temp: '36.7',
      fc: '104',
      fr: '24',
      ta: '95/60',
      so2: '98',
      peso: '14.5',
      hasOxygenSupport: false,
    },
    evolvedInDay: true,
    createdAt: nowIso,
  };

  const hospitalizedDemoPatient: Patient = {
    id: TUTORIAL_DEMO_PATIENT_ID,
    medicalHistoryNumber: 'DEMO-2026-001',
    firstName: 'Mateo Alejandro',
    lastName: 'Pérez Demo (Tutorial)',
    age: '3 años 4 meses',
    gender: 'M',
    weightKg: 14.5,
    admissionDate: threeDaysAgo,
    admissionTime: '10:15',
    area: 'Hospitalización',
    bedNumber: 'Cama Demo-01',
    status: 'hospitalized',
    diagnoses: [
      {
        id: 'tutorial-demo-dx-1',
        title: 'Neumonía Adquirida en la Comunidad (NAC) basal derecha',
        subDiagnoses: ['Sin derrame pleural'],
      },
      {
        id: 'tutorial-demo-dx-2',
        title: 'Deshidratación leve en resolución',
      },
    ],
    treatment:
      '1. Ampicilina/Sulbactam 150 mg/kg/día EV c/6h\n2. Acetaminofén 15 mg/kg/dosis VO SOS fiebre ≥ 38°C\n3. Hidratación oral a tolerancia',
    pendingExams: 'Control de Hematología Completa y PCR (Práctica)',
    doctorInCharge: 'Dra. Carolina Práctica (R2)',
    documents: [
      {
        id: 'tutorial-demo-doc-1',
        title: 'Hematología de Ingreso (Práctica)',
        fileType: 'image',
        dataUrl: DEMO_LAB_SVG_DATA_URL,
        fileName: 'lab_ingreso_practica.svg',
        fileSize: '42 KB',
        uploadedAt: threeDaysAgo,
        uploadedBy: 'Dra. Carolina Práctica',
      },
    ],
    evolutions: [demoEvolutionYesterday],
    ordenesMedicas: demoOrders,
    ordenesFecha: yesterday,
    ordenesHora: '08:45',
    ordenesPeso: '14.5 kg',
    historiaClinicaId: TUTORIAL_DEMO_HC_ID,
    evolucionadoHoy: false,
    ultimaEvolucionFecha: yesterday,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const dischargedDemoPatient: Patient = {
    id: TUTORIAL_DEMO_DISCHARGED_ID,
    medicalHistoryNumber: 'DEMO-2026-002',
    firstName: 'Sofía Valentina',
    lastName: 'Mendoza Demo (Tutorial)',
    age: '1 año 8 meses',
    gender: 'F',
    weightKg: 10.8,
    admissionDate: fiveDaysAgo,
    admissionTime: '14:20',
    area: 'Hospitalización',
    bedNumber: 'Cama Demo-02',
    status: 'discharged',
    dischargeDate: today,
    dischargeTime: '11:00',
    dischargeReason: 'Alta Médica por Mejoría Clínica (Práctica)',
    diagnoses: [
      {
        id: 'tutorial-demo-dis-dx-1',
        title: 'Bronquiolitis aguda moderada — RESUELTO',
      },
      {
        id: 'tutorial-demo-dis-dx-2',
        title: 'Sibilancias recurrentes en seguimiento — MEJORADO',
      },
    ],
    treatment: '1. Salbutamol inhalador con espaciador SOS\n2. Lavados nasales con solución fisiológica',
    pendingExams: 'Control por Consulta Externa en 7 días',
    doctorInCharge: 'Dr. Luis Práctica (R3)',
    documents: [
      {
        id: 'tutorial-demo-dis-doc-1',
        title: 'Rx de Tórax de Ingreso (Práctica)',
        fileType: 'image',
        dataUrl: DEMO_LAB_SVG_DATA_URL,
        fileName: 'rx_torax_practica.svg',
        fileSize: '38 KB',
        uploadedAt: fiveDaysAgo,
        uploadedBy: 'Dr. Luis Práctica',
      },
    ],
    evolutions: [
      {
        ...demoEvolutionYesterday,
        id: 'tutorial-demo-dis-ev-1',
        patientId: TUTORIAL_DEMO_DISCHARGED_ID,
        doctorName: 'Dr. Luis Práctica (R3)',
        subjetivo: 'Madre refiere excelente descanso nocturno, sin tos ni dificultad respiratoria.',
        objetivo: 'Lactante mayor activa, afebril, normoventilada bilateral sin sibilancias, SO2 99% aire ambiente.',
        diagnosesModified: '1. Bronquiolitis aguda moderada en resolución',
        treatmentModified: '1. Lavados nasales con solución 0.9%\n2. Medidas generales',
        comentariosPlan: 'Paciente en óptimas condiciones clínicas. Se decide alta médica con indicaciones ambulatorias.',
      },
    ],
    ordenesMedicas: demoOrders.slice(0, 3),
    historiaClinicaId: TUTORIAL_DEMO_DISCHARGED_HC_ID,
    dischargeSummary: {
      fechaIngreso: fiveDaysAgo,
      fechaEgreso: today,
      numHistoria: 'DEMO-2026-002',
      diasHosp: '5 días',
      nombres: 'Sofía Valentina',
      apellidos: 'Mendoza Demo (Tutorial)',
      edad: '1 año 8 meses',
      sexo: 'F',
      pesoIngreso: '10.6 kg',
      pesoEgreso: '10.8 kg',
      diagnosticosIngreso: '1. Bronquiolitis aguda moderada',
      resumenEvolutivo:
        'Lactante mayor femenina de 1 año 8 meses (paciente ficticia de tutorial) ingresada por cuadro de dificultad respiratoria leve y sibilancias. Recibió oxigenoterapia de bajo flujo durante 24 horas y medidas de soporte con evolución clínica satisfactoria, logrando destete completo de oxígeno y adecuada tolerancia oral, por lo que se decide egreso médico.',
      diagnosticosEgreso: '1. Bronquiolitis aguda moderada — RESUELTO',
      seIndica:
        '1. Reevaluación clínica ambulatoria por Consulta Externa de Pediatría en 7 días.\n2. Lavados nasales frecuentes con solución fisiológica 0.9%.\n3. Signos de alarma respiratoria explicados a la madre.',
      oxigenoFiO2: '28%',
      oxigenoDias: '1',
      transfusionSi: false,
      transfusionNo: true,
      paraclinicos: {
        fecha: fiveDaysAgo,
        gb: '10.200',
        hcto: '34.8%',
        plt: '298.000',
        tipiaje: 'O+',
        neu: '48%',
        seg: '46%',
        lin: '48%',
        vsg: '14',
        urea: '18',
        creatinina: '0.4',
        acUrico: '3.1',
        glicemia: '86',
        protT: '6.5',
        albumina: '4.1',
        globulina: '2.4',
        ptPaciente: '12.1',
        ptControl: '12.0',
        razon: '1.01',
        pttControl: '29.0',
        pttPaciente: '30.2',
        diferencia: '1.2',
        vih: 'NR',
        vdrl: 'NR',
        pcr: '6.2',
        cultivo: 'Sin aislamientos',
      },
      updatedAt: nowIso,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const normalExam = getPediatricNormalPhysicalExam('3 años 4 meses', 'niño');

  const demoHistoria: HistoriaClinicaPediatrica = {
    ...DEFAULT_HISTORIA_CLINICA,
    id: TUTORIAL_DEMO_HC_ID,
    patientId: TUTORIAL_DEMO_PATIENT_ID,
    numHistoria: 'DEMO-2026-001',
    apellidos: 'Pérez Demo (Tutorial)',
    nombres: 'Mateo Alejandro',
    generoPatient: 'niño',
    fechaNacimiento: '2023-07-10',
    edad: '3 años 4 meses',
    lugarNacimiento: 'Caracas',
    direccionCompleta: 'Av. Principal El Valle (Dirección Ficticia de Práctica)',
    telefono: '0412-0000000',
    fechaIngreso: threeDaysAgo,
    horaIngreso: '10:15',
    motivosAdmision: 'Fiebre persistente de 48 horas y tos productiva (caso ficticio de práctica).',
    enfermedadActual:
      'Preescolar masculino de 3 años 4 meses (datos ficticios para tutorial) cuya madre refiere inicio de enfermedad actual hace 3 días caracterizado por alzas térmicas cuantificadas en 38.8 °C y tos húmeda, motivo por el cual acude al servicio de emergencia pediátrica donde se decide su ingreso.',
    diagnosticoAdmision: '1. Neumonía Adquirida en la Comunidad (NAC) basal derecha\n2. Deshidratación leve',
    enCasoEmergenciaVisarA: 'María Demo (Madre ficticia)',
    parentescoEmergencia: 'Madre',
    direccionTelefonoEmergencia: '0412-0000000',
    peso: '14.5',
    talla: '98',
    temp: '36.7',
    fc: '104',
    fr: '24',
    so2: '98',
    ta: '95/60',
    ...normalExam,
    toraxPulmonesFisico:
      'Tórax simétrico, normoexpansible, murmullo vesicular presente con discretos crepitantes finos en base pulmonar derecha.',
    examenPracticadoPor: 'Dra. Carolina Práctica (R2)',
    graffarScoreA: 2,
    graffarScoreB: 2,
    graffarScoreC: 3,
    graffarScoreD: 2,
    graffarPuntajeTotal: 9,
    graffarResultado: 'II: 7-9',
    laboratoriosColumnas: [
      {
        fecha: threeDaysAgo,
        valores: {
          'Glóbulos Blancos': '12.400',
          'Hemoglobina': '11.8',
          'Hematocrito': '35.4',
          'Plaquetas': '315.000',
          'Segmentados': '64',
          'Linfocitos': '32',
          'PCR': '18.5',
          'Glicemia': '92',
        },
      },
    ],
    resumenDiagnosticosIngreso: '1. Neumonía Adquirida en la Comunidad (NAC) basal derecha',
    resumenComentario: 'Caso ficticio generado exclusivamente para practicar el uso de la plataforma.',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const demoDischargedHistoria: HistoriaClinicaPediatrica = {
    ...demoHistoria,
    id: TUTORIAL_DEMO_DISCHARGED_HC_ID,
    patientId: TUTORIAL_DEMO_DISCHARGED_ID,
    numHistoria: 'DEMO-2026-002',
    apellidos: 'Mendoza Demo (Tutorial)',
    nombres: 'Sofía Valentina',
    generoPatient: 'niña',
    edad: '1 año 8 meses',
    peso: '10.8',
    talla: '82',
    fechaIngreso: fiveDaysAgo,
    diagnosticoAdmision: '1. Bronquiolitis aguda moderada',
  };

  // Fresh fictional prefilled Historia Clínica for the "Crear Historia Clínica" guided tour
  const historiaDraft: HistoriaClinicaPediatrica = {
    ...demoHistoria,
    id: 'tutorial-demo-hc-new',
    patientId: undefined,
    numHistoria: 'DEMO-2026-999',
    apellidos: 'Rodríguez Demo (Práctica)',
    nombres: 'Lucas Sebastián',
    edad: '2 años 6 meses',
    peso: '13.2',
    talla: '91',
    fechaIngreso: today,
  };

  const beds: Bed[] = [
    {
      id: 'tutorial-demo-bed-1',
      bedNumber: 'Cama Demo-01',
      area: 'Hospitalización',
      status: 'occupied',
      patientId: TUTORIAL_DEMO_PATIENT_ID,
      patientName: 'Pérez Demo (Tutorial), Mateo Alejandro',
      updatedAt: nowIso,
    },
    {
      id: 'tutorial-demo-bed-2',
      bedNumber: 'Cama Demo-02',
      area: 'Hospitalización',
      status: 'free',
      updatedAt: nowIso,
    },
    {
      id: 'tutorial-demo-bed-3',
      bedNumber: 'Cama Demo-03',
      area: 'Traumashock',
      status: 'free',
      updatedAt: nowIso,
    },
  ];

  const tasks: PersonalTask[] = [
    {
      id: 'tutorial-demo-task-1',
      title: 'Revisar hematología de control — Mateo Pérez Demo (Práctica)',
      description: 'Tarea ficticia de ejemplo para aprender a gestionar pendientes de guardia.',
      category: 'pendiente_lab',
      priority: 'alta',
      dueDate: today,
      dueTime: '18:00',
      completed: false,
      reminderActive: true,
      createdAt: nowIso,
    },
    {
      id: 'tutorial-demo-task-2',
      title: 'Entregar Resumen de Egreso de práctica en archivo',
      description: 'Ejemplo de pendiente de alta médica que no se guarda en la base de datos.',
      category: 'alta',
      priority: 'media',
      dueDate: today,
      dueTime: '20:00',
      completed: false,
      reminderActive: false,
      createdAt: nowIso,
    },
  ];

  return {
    patients: [hospitalizedDemoPatient, dischargedDemoPatient],
    historias: [demoHistoria, demoDischargedHistoria],
    beds,
    tasks,
    historiaDraft,
  };
}
