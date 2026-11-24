export type HospitalArea = 
  | 'Traumashock' 
  | 'ÁREA DE OBSERVACIÓN' 
  | 'Respiratorio' 
  | 'Aislamiento' 
  | 'Hospitalización';

export type Gender = 'M' | 'F';

export interface DiagnosisItem {
  id: string;
  code?: string;
  title: string;
  subDiagnoses?: string[];
}

export interface PatientDocument {
  id: string;
  title: string;
  fileType: 'pdf' | 'image' | 'doc';
  dataUrl: string; // Base64 or object URL
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface OrdenMedicaItem {
  id: string;
  dosisCalculo?: string; // Columna izquierda: e.g. "40mg/kg/dosis"
  itemNumber: number;   // Columna central: 1, 2, 3, 4, 5...
  descripcion: string;   // Columna derecha: e.g. "Ingresar en Área de Trauma Shock"
}

export interface BalanceHidricoData {
  enabled: boolean;
  ingeridosCc: number;
  excretadosCc: number;
  balanceNetoCc: number;
  flujoUrinarioCcKgH: number;
  superficieCorporalM2: number;
  balanceCcM2Dia: number;
  interpretacionFU: string;
}

export interface MedicalEvolution {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  doctorName: string; // e.g., "Dr. Brayan"
  
  // Existing fields
  evolutionNote: string; // Detalle del estado de salud y cambios
  interrogatory24h?: string; // Interrogatorio en 24 horas
  medicalRoundSummary?: string; // Revista médica

  // New requirements
  diagnosesModified?: string;
  treatmentModified?: string;
  subjetivo?: string;
  objetivo?: string;
  comentariosPlan?: string; // Comentarios y Plan del Especialista / Revista médica
  
  // Órdenes Médicas asociadas
  ordenesMedicas?: OrdenMedicaItem[];
  ordenesFecha?: string;
  ordenesHora?: string;
  ordenesPeso?: string;

  // Balance Hídrico Pediátrico
  balanceHidrico?: BalanceHidricoData;

  // Examen Físico
  examenFisico: {
    piel: string;
    cabezaOjos: string;
    oidosOtoscopia: string;
    narizOrofaringe: string;
    cuello: string;
    toraxCP: string;
    cardiovascular?: string;
    abdomen: string;
    genitourinario: string;
    extremidades: string;
    neurologico: string;
  };

  vitalSigns?: {
    temp?: string;
    fc?: string;
    fr?: string;
    ta?: string;
    so2?: string;
    peso?: string;
    hasOxygenSupport?: boolean;
    o2Type?: 'Seco' | 'Húmedo';
    o2FlowLmin?: string;
    o2Modalidad?: string;
    fio2?: string;
    o2So2?: string;
  };
  evolvedInDay?: boolean;
  episodeNumber?: number;
  isReingreso?: boolean;
  createdAt: string;
}

export interface ReadmissionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  mode?: 'correct_errors' | 'new_admission';
  area?: HospitalArea;
  bedNumber?: string;
  historiaClinicaId?: string;
  previousHistoriaId?: string;
  previousAdmissionDate?: string;
  previousDischargeDate?: string;
  reason?: string;
  createdAt: string;
}

export interface DischargeSummaryData {
  fechaIngreso: string;
  fechaEgreso: string;
  numHistoria: string;
  diasHosp: string;
  nombres: string;
  apellidos: string;
  edad: string;
  sexo: Gender;
  pesoIngreso: string;
  pesoEgreso: string;
  diagnosticosIngreso: string;
  resumenEvolutivo: string;
  diagnosticosEgreso: string;
  seIndica: string;
  oxigenoFiO2: string;
  oxigenoDias: string;
  transfusionSi: boolean;
  transfusionNo: boolean;
  paraclinicos: {
    fecha: string;
    gb: string;
    hcto: string;
    plt: string;
    tipiaje: string;
    neu: string;
    seg: string;
    lin: string;
    vsg: string;
    urea: string;
    creatinina: string;
    acUrico: string;
    glicemia: string;
    protT: string;
    albumina: string;
    globulina: string;
    ptPaciente: string;
    ptControl: string;
    razon: string;
    pttControl: string;
    pttPaciente: string;
    diferencia: string;
    vih: string;
    vdrl: string;
    pcr: string;
    cultivo: string;
  };
  updatedAt: string;
}

export interface Patient {
  id: string;
  medicalHistoryNumber: string; // N° HISTORIA
  firstName: string;
  lastName: string;
  age: string; // e.g., "2 años 3 meses"
  gender: Gender;
  weightKg: number;
  admissionDate: string; // YYYY-MM-DD
  admissionTime: string; // HH:mm
  area: HospitalArea;
  bedNumber: string; // e.g., "Cama 02"
  status: 'hospitalized' | 'discharged' | 'transferred' | 'deceased';
  dischargeDate?: string;
  dischargeTime?: string;
  dischargeReason?: string;
  
  diagnoses: DiagnosisItem[];
  treatment: string;
  pendingExams: string;
  doctorInCharge: string;
  
  documents: PatientDocument[];
  evolutions: MedicalEvolution[];
  resumenesEvolutivos?: ResumenEvolutivo[];
  
  // Órdenes Médicas activas e independientes del paciente
  ordenesMedicas?: OrdenMedicaItem[];
  ordenesFecha?: string;
  ordenesHora?: string;
  ordenesPeso?: string;

  // Link to the full 8-page Historia Clinica if created + Reingreso history
  historiaClinicaId?: string;
  previousHistoriaIds?: string[];
  isReingreso?: boolean;
  readmissionMode?: 'correct_errors' | 'new_admission';
  readmissionCount?: number;
  lastReadmissionDate?: string;
  readmissions?: ReadmissionRecord[];
  dischargeHistory?: Array<{ date: string; time?: string; reason?: string }>;
  evolucionadoHoy?: boolean;
  ultimaEvolucionFecha?: string;
  dischargeSummary?: DischargeSummaryData;
  
  createdAt: string;
  updatedAt: string;
}

export interface ResumenEvolutivo {
  id: string;
  patientId: string;
  weekNumber: number; // 1, 2, 3...
  title: string; // e.g. "Resumen Evolutivo - Semana 1 (Días 1 a 7)"
  startDate: string;
  endDate: string;
  daysCount: number; // e.g. 7, 14, 21
  
  // 1. Diagnósticos
  diagnosticosIngreso: string;
  diagnosticosActuales: string;
  
  // 2. Tratamiento
  tratamientoActual: string;
  
  // 3. Examen Físico Actual
  examenFisicoActual: {
    piel: string;
    cabezaOjos: string;
    oidosOtoscopia: string;
    narizOrofaringe: string;
    cuello: string;
    toraxCP: string;
    cardiovascular?: string;
    abdomen: string;
    genitourinario: string;
    extremidades: string;
    neurologico: string;
  };
  
  // 4. Exámenes de Laboratorio desde su ingreso
  laboratoriosResumen: Array<{
    fecha: string;
    valores: Record<string, string>;
  }>;
  laboratoriosComentarios?: string;
  
  // 5. Comentarios diarios redactados de las evoluciones diarias
  comentariosDiarios: Array<{
    fecha: string;
    hora: string;
    doctor: string;
    nota: string;
    subjetivo?: string;
    objetivo?: string;
    comentarioPlan?: string;
  }>;
  
  // 6. Ganancia y control de peso en esos 7 días
  pesoIngresoKg: number;
  pesoActualKg: number;
  diferenciaPesoGramos: number; // Gramos netos ganados o perdidos
  gananciaDiariaPromedioGramos?: number; // Gramos promedio/día
  analisisPonderal: string;
  
  // 7. Comentario y Plan
  comentarioGeneral?: string;
  conductaPlan?: string;
  doctorName: string;
  jefeServicio?: string;
  
  createdAt: string;
  updatedAt?: string;
}

// 7-Page Historia Clínica Pediatric Data Structure
export interface HistoriaClinicaPediatrica {
  id: string;
  patientId?: string;
  
  // Page 1: Datos de Filiación y Admisión
  generoPatient?: 'niño' | 'niña';
  apellidos: string;
  nombres: string;
  numHistoria: string;
  edad: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  lugarFechaNacimiento: string;
  procedenciaEstado: string;
  nacionalidad: string;
  ci: string;
  direccionCompleta: string;
  telefono: string;
  fechaIngreso: string;
  horaIngreso: string;
  enCasoEmergenciaVisarA: string;
  parentescoEmergencia: string;
  direccionTelefonoEmergencia: string;
  
  motivosAdmision: string;
  enfermedadActual: string; // "Se trata de..."
  diagnosticoAdmision: string;
  medicoAdmisionFirma: string;
  medicoServicioFirma: string;
  
  salidaCuracion: boolean;
  salidaMejoria: boolean;
  salidaMuerte: boolean;
  salidaOtrasCausas: string;
  diagnosticoClinicoFinal: string;
  intervencionTratamiento: string;
  fechaSalida: string;
  horaSalida: string;
  jefeServicioFirma: string;
  diagnosticoAnatomoPatologico: string;
  biopsia: string;
  autopsia: string;
  bedNumber: string;
  
  // Page 2: Reglamento y Exención
  reglamentoFecha: string;
  reglamentoFirma1: string;
  reglamentoCI1: string;
  reglamentoParentesco1: string;
  reglamentoTestigo: string;
  reglamentoCITestigo: string;
  
  exencionFecha: string;
  exencionFirma: string;
  exencionCI: string;
  exencionParentesco: string;
  exencionTestigo: string;
  exencionCITestigo: string;
  
  // Page 3: Interrogatorio Desglosado
  antecedentesPrenatales: string;
  prenatalEdadMadre?: string;
  prenatalHO_G?: string;
  prenatalHO_P?: string;
  prenatalHO_C?: string;
  prenatalHO_A?: string;
  prenatalControles?: string;
  prenatalComplicaciones?: string;
  prenatalSemanas?: string;
  prenatalTipoParto?: string;
  prenatalInstrumental?: string;
  prenatalInfecciones?: string;
  prenatalControlTipo?: 'bien' | 'mal';

  periodoNeonatal: string;
  neonatalRespEspontanea?: string;
  neonatalAsistenciaResp?: string;
  neonatalCianosis?: string;
  neonatalFiebre?: string;
  neonatalVomitos?: string;
  neonatalIctericia?: string;
  neonatalHemorragia?: string;
  neonatalConvulsiones?: string;
  neonatalMalformaciones?: string;
  neonatalOftalmia?: string;
  neonatalCoriza?: string;
  neonatalOtros?: string;
  neonatalCordonDias?: string;
  neonatalPesoNacer?: string;
  neonatalTallaNacer?: string;

  alimentacion: string;
  alimLmeMeses?: string;
  alimArtificialMeses?: string;
  alimMixtaMeses?: string;
  alimDesteteMeses?: string;
  alimCerealesMeses?: string;
  alimSopasMeses?: string;
  alimVegetalesMeses?: string;
  alimHuevosMeses?: string;
  alimCarnesMeses?: string;
  alimVitaminas?: string;
  alimProteinasSemana?: string;
  alimVegetalesSemana?: string;
  alimCarbohidratosSemana?: string;
  alimDulcesSemana?: string;
  alimFormulaNombre?: string;
  alimFormulaOz?: string;
  alimFormulaFrecuencia?: string;
  alimTipoLactancia?: 'LME' | 'Formula' | 'Mixta';
  alimHideLme?: boolean;
  alimHideDieta?: boolean;

  desarrolloTabulador: string;
  desarrolloCabezaMeses?: string;
  desarrolloSentoMeses?: string;
  desarrolloParoMeses?: string;
  desarrolloCaminoMeses?: string;
  desarrolloEsfinterMeses?: string;
  desarrolloDienteMeses?: string;
  desarrolloPalabrasMeses?: string;
  desarrolloGradoEscuela?: string;
  desarrolloProgresoEscuela?: string;
  desarrolloProgresoPeso?: string;

  habitosPsicologicos: string;
  habitosSuenoNocturno?: string;
  habitosSiestas?: string;
  habitosJuegos?: string;
  habitosSexuales?: string;
  habitosDigitosuccion?: string;
  habitosOnicofagia?: string;
  habitosRasgosPersonales?: string;
  habitosRecreacion?: string;
  habitosOcupacion?: string;

  inmunizacionesPruebas: string;
  vacunaViruela?: string;
  vacunaTosFerina?: string;
  vacunaDifteria?: string;
  vacunaTetanos?: string;
  vacunaTificas?: string;
  vacunaBcg?: string;
  vacunaHbNeonatal?: string;
  vacunaPoliomielitis?: string;
  vacunaAntiamarilica?: string;
  vacunaPentavalente?: string;
  vacunaRotavirus?: string;
  vacunaNeumococo?: string;
  vacunaInfluenza?: string;
  vacunaTrivalente?: string;
  vacunasOtras?: string;
  pruebaTuberculina?: string;
  tarjetaInn?: string;

  antecedentesPersonales: string;
  apCronicas?: string;
  apInfecciosas?: string;
  apHospitalizaciones?: string;
  apTransfusiones?: string;
  apQuirurgicos?: string;
  apTraumatismos?: string;

  historiaFamiliar: string;
  hfMadre?: string;
  hfMadreEdad?: string;
  hfMadreVivo?: 'Vivo' | 'Fallecido';
  hfMadreCausa?: string;
  hfPadre?: string;
  hfPadreEdad?: string;
  hfPadreVivo?: 'Vivo' | 'Fallecido';
  hfPadreCausa?: string;
  hfHermanos?: string;
  hfHermanosEdad?: string;
  hfHermanosVivo?: 'Vivo' | 'Fallecido';
  hfHermanosCausa?: string;
  hfAbueloPaterno?: string;
  hfAbueloPaternoEdad?: string;
  hfAbueloPaternoVivo?: 'Vivo' | 'Fallecido';
  hfAbueloPaternoCausa?: string;
  hfAbuelaPaterna?: string;
  hfAbuelaPaternaEdad?: string;
  hfAbuelaPaternaVivo?: 'Vivo' | 'Fallecido';
  hfAbuelaPaternaCausa?: string;
  hfAbueloMaterno?: string;
  hfAbueloMaternoEdad?: string;
  hfAbueloMaternoVivo?: 'Vivo' | 'Fallecido';
  hfAbueloMaternoCausa?: string;
  hfAbuelaMaterna?: string;
  hfAbuelaMaternaEdad?: string;
  hfAbuelaMaternaVivo?: 'Vivo' | 'Fallecido';
  hfAbuelaMaternaCausa?: string;
  hfLinajeMaterno?: string;
  hfLinajePaterno?: string;
  
  // Page 4: Examen Funcional (Can keep standard normal or override with pathology)
  examenFuncionalGeneral: string;
  pielFuncional: string;
  cabezaFuncional: string;
  ojosFuncional: string;
  oidosFuncional: string;
  narizFuncional: string;
  bocaFuncional: string;
  respiratorioFuncional: string;
  osteomioarticularFuncional: string;
  cardiovascularFuncional: string;
  gastrointestinalFuncional: string;
  genitourinarioFuncional: string;
  ginecologicosFuncional: string;
  nerviosoCentralFuncional: string;
  
  // Page 5: Examen Físico Parte III Completo (Items 1 al 17)
  temp: string;
  fr: string;
  fc: string;
  ta: string;
  so2: string;
  so2ConO2: string;
  peso: string;
  talla: string;
  cc?: string; // Perímetro Cefálico
  ca?: string; // Perímetro Abdominal
  ct?: string; // Perímetro Torácico
  percentil: string;
  pesoEdad: string;
  tallaEdad: string;
  pesoTalla: string;
  percentilPesoTalla?: string;
  percentilPesoEdad?: string;
  percentilTallaEdad?: string;
  
  estadoGeneralFisico: string;
  pielPaniculoFanerasFisico: string;
  cabezaFisico: string;
  ojosFisico: string;
  oidosFisico: string;
  rinofaringeFisico: string;
  bocaFisico: string;
  cuelloFisico: string;
  gangliosLinfaticosFisico: string;
  toraxPulmonesFisico: string;
  cardiovascularFisico?: string;
  abdomenFisico: string;
  urinarioFisico: string;
  genitalesFisico: string;
  anoRectoFisico: string;
  huesosArticulacionesMuslosFisico: string;
  neurologicoPsiquicoFisico: string;
  sensorialesFisico: string;
  fechaHoraExamenFisico: string;
  examenPracticadoPor: string;
  
  // Page 6: Evaluación Socioeconómica GRAFFAR (Méndez Castellano)
  graffarProfesionJefe: string; // a1 - a5
  graffarInstruccionMadre: string; // b1 - b5
  graffarFuenteIngreso: string; // c1 - c5
  graffarAlojamiento: string; // d1 - d5
  graffarResultado: string; // I: 4-6, II: 7-9, III: 10-12, IV: 13-16, V: 17-20
  graffarScoreA?: number; // 1-5
  graffarScoreB?: number; // 1-5
  graffarScoreC?: number; // 1-5
  graffarScoreD?: number; // 1-5
  graffarPuntajeTotal?: number; // 4-20
  graffarEstrato?: string; // 'I' | 'II' | 'III' | 'IV' | 'V'
  
  // Page 7: Laboratorios
  laboratoriosColumnas: Array<{
    fecha: string;
    valores: Record<string, string>;
  }>;
  laboratoriosOtros: string;

  // Page 8: Resumen de Ingreso
  resumenMotivoConsulta: string;
  resumenHistoriaEnfermedad: string;
  resumenAntecedentesObstetricos: string;
  resumenInmunizaciones: string;
  resumenPatologicosPersonales: string;
  resumenMadre: string;
  resumenAbuelaMaterna: string;
  resumenAbueloMaterno: string;
  resumenPadre: string;
  resumenAbuelaPaterna: string;
  resumenAbueloPaterno: string;
  resumenHermanos: string;
  resumenExamenPeso: string;
  resumenExamenTalla: string;
  resumenExamenFr: string;
  resumenExamenFc: string;
  resumenExamenTemp: string;
  resumenExamenSo2: string;
  resumenExamenTa: string;
  resumenExamenTe: string;
  resumenExamenPt: string;
  resumenPercentilPe: string;
  resumenPercentilPt: string;
  resumenLabLeu: string;
  resumenLabSeg: string;
  resumenLabLin: string;
  resumenLabMon: string;
  resumenLabHb: string;
  resumenLabHto: string;
  resumenLabVcm: string;
  resumenLabHcm: string;
  resumenLabPlt: string;
  resumenLabVsg: string;
  resumenLabPcr: string;
  resumenRxTorax: string;
  resumenDiagnosticosIngreso: string;
  resumenComentario: string;
  
  customizedExamFields?: Record<string, boolean>;
  isReingreso?: boolean;
  reingresoDate?: string;
  previousHistoriaId?: string;
  episodeNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTask {
  id: string;
  title: string;
  description?: string;
  category: 'médica' | 'guardia' | 'pendiente_lab' | 'alta' | 'personal';
  priority: 'alta' | 'media' | 'baja';
  dueDate?: string;
  dueTime?: string;
  completed: boolean;
  reminderActive: boolean;
  createdAt: string;
}

export interface Bed {
  id: string;
  bedNumber: string; // e.g. "Cama 01"
  area: HospitalArea;
  status: 'free' | 'occupied' | 'cleaning' | 'maintenance';
  patientId?: string;
  patientName?: string;
  updatedAt: string;
}

export type MedicalRoleType = 'Interno' | 'Residente' | 'Especialista' | 'Otro' | 'Pendiente';

export interface UserProfile {
  id: string; // Matches auth.uid()
  email: string;
  full_name: string;
  role_type: MedicalRoleType;
  role?: 'admin' | 'doctor' | string;
  is_approved?: boolean;
  is_admin?: boolean;
  can_edit_data?: boolean;
  details: {
    can_edit_data?: boolean;
    firstName?: string;
    lastName?: string;
    gender?: Gender;
    // Interno
    universidad?: string;
    anoCursado?: string;
    // Residente
    areaClinica?: string;
    anoResidencia?: 'R1' | 'R2' | 'R3' | string;
    // Especialista
    especialidad?: string;
    // Otro
    funcionOtro?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export interface GuardiaMember {
  id: string;
  nombre: string;
  rol: 'Especialista' | 'Residente' | 'Interno' | 'Otro' | string;
  area: HospitalArea | string;
}

export interface GuardiaGroup {
  id: string;
  nombreGrupo: string; // e.g., "Grupo A", "Guardia 1"
  color?: string;
  icon?: string;
  jefeGuardia?: string;
  areas: string[];
  miembros: GuardiaMember[];
  diasDelMes: number[]; // Day numbers of the month (1..31)
}

export interface GuardiaShiftEntry {
  id: string;
  fecha: string; // YYYY-MM-DD
  grupo: string;
  area: HospitalArea | string;
  rol: string;
  medico: string;
  horario?: string;
  notas?: string;
}

export interface RolGuardiasData {
  mes: string; // e.g., "Noviembre 2026"
  anio: number;
  mesNumero: number; // 1-12
  hospital?: string;
  servicio?: string;
  grupos: GuardiaGroup[];
  turnos: GuardiaShiftEntry[];
  updatedAt: string;
}
