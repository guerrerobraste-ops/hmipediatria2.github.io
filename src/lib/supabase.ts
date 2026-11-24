import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import type { 
  Patient, 
  Bed, 
  HistoriaClinicaPediatrica, 
  PersonalTask, 
  MedicalEvolution, 
  HospitalArea,
  UserProfile,
  RolGuardiasData
} from '../types';
import { INITIAL_BEDS, DEFAULT_HISTORIA_CLINICA } from '../data/initialData';
import { normalizeGuardiasData } from '../services/storage';

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };

// ==========================================
// 1. PATIENT MAPPING & CRUD (Table: 'patients')
// ==========================================

export function mapPatientFromRow(row: any, evolutions: MedicalEvolution[] = []): Patient {
  const patientEvolutions = evolutions
    .filter(e => e.patientId === row.id)
    .sort((a, b) => {
      const da = `${a.date || ''}T${a.time || '00:00'}`;
      const db = `${b.date || ''}T${b.time || '00:00'}`;
      return db.localeCompare(da);
    });
  const todayStr = new Date().toISOString().split('T')[0];
  const evolucionadoHoy = patientEvolutions.some(e => e.date === todayStr);

  return {
    id: String(row.id || ''),
    medicalHistoryNumber: String(row.medical_history_number || ''),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    age: String(row.age || ''),
    gender: (row.gender || 'M') as 'M' | 'F',
    weightKg: Number(row.weight_kg ?? 10),
    admissionDate: String(row.admission_date || todayStr),
    admissionTime: String(row.admission_time || '08:00'),
    area: (row.area || 'Hospitalización') as HospitalArea,
    bedNumber: String(row.bed_number || 'Cama 01'),
    status: (row.status || 'hospitalized') as 'hospitalized' | 'discharged',
    doctorInCharge: String(row.doctor_in_charge || ''),
    diagnoses: Array.isArray(row.diagnoses) ? row.diagnoses : [],
    treatment: String(row.treatment || ''),
    pendingExams: String(row.pending_exams || ''),
    documents: Array.isArray(row.documents) ? row.documents : [],
    evolutions: patientEvolutions,
    evolucionadoHoy,
    ultimaEvolucionFecha: patientEvolutions[0]?.date || undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function mapPatientToRow(patient: Patient): Record<string, any> {
  return {
    id: patient.id,
    medical_history_number: patient.medicalHistoryNumber || '',
    first_name: patient.firstName || '',
    last_name: patient.lastName || '',
    age: patient.age || '',
    gender: patient.gender || 'M',
    weight_kg: Number(patient.weightKg || 10),
    admission_date: patient.admissionDate || new Date().toISOString().split('T')[0],
    admission_time: patient.admissionTime || '08:00',
    area: patient.area || 'Hospitalización',
    bed_number: patient.bedNumber || 'Cama 01',
    status: patient.status || 'hospitalized',
    doctor_in_charge: patient.doctorInCharge || '',
    diagnoses: Array.isArray(patient.diagnoses) ? patient.diagnoses : [],
    treatment: patient.treatment || '',
    pending_exams: patient.pendingExams || '',
    documents: Array.isArray(patient.documents) ? patient.documents : [],
    updated_at: new Date().toISOString(),
  };
}

export async function fetchPatientsFromSupabase(): Promise<Patient[]> {
  try {
    const [patientsRes, evolutionsRes] = await Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('evolutions').select('*').order('date', { ascending: false })
    ]);

    if (patientsRes.error) {
      console.error('Error fetching patients from Supabase:', patientsRes.error);
      return [];
    }

    const allEvolutions = (evolutionsRes.data || []).map(mapEvolutionFromRow);
    return (patientsRes.data || []).map(row => mapPatientFromRow(row, allEvolutions));
  } catch (err) {
    console.error('Exception fetching patients from Supabase:', err);
    return [];
  }
}

export async function savePatientToSupabase(patient: Patient): Promise<Patient> {
  const row = mapPatientToRow(patient);
  const { error } = await supabase.from('patients').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving patient to Supabase:', error);
    throw error;
  }
  return patient;
}

export async function savePatientsBatchToSupabase(patients: Patient[]): Promise<void> {
  if (!patients.length) return;
  const rows = patients.map(mapPatientToRow);
  const { error } = await supabase.from('patients').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Error saving patients batch to Supabase:', error);
    throw error;
  }
}

export async function deletePatientFromSupabase(id: string): Promise<boolean> {
  try {
    // Delete associated evolutions first to respect foreign key constraint
    await supabase.from('evolutions').delete().eq('patient_id', id);

    // Free any bed assigned to this patient
    await supabase.from('beds')
      .update({ status: 'free', patient_id: null, patient_name: null, updated_at: new Date().toISOString() })
      .eq('patient_id', id);

    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) {
      console.error('Error deleting patient from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting patient from Supabase:', err);
    return false;
  }
}

// ==========================================
// 2. EVOLUTIONS MAPPING & CRUD (Table: 'evolutions')
// ==========================================

export function mapEvolutionFromRow(row: any): MedicalEvolution {
  const rawVital = row.vital_signs && typeof row.vital_signs === 'object' ? { ...row.vital_signs } : {};
  const meta = rawVital.__meta && typeof rawVital.__meta === 'object' ? rawVital.__meta : {};
  if ('__meta' in rawVital) {
    delete rawVital.__meta;
  }

  return {
    id: String(row.id || ''),
    patientId: String(row.patient_id || ''),
    date: String(row.date || ''),
    time: String(row.time || ''),
    doctorName: String(row.doctor_name || ''),
    evolutionNote: String(row.evolution_note || ''),
    subjetivo: String(row.subjetivo || ''),
    objetivo: String(row.objetivo || ''),
    comentariosPlan: meta.comentariosPlan ? String(meta.comentariosPlan) : String(row.medical_round_summary || ''),
    ordenesMedicas: Array.isArray(meta.ordenesMedicas) ? meta.ordenesMedicas : undefined,
    ordenesFecha: meta.ordenesFecha ? String(meta.ordenesFecha) : undefined,
    ordenesHora: meta.ordenesHora ? String(meta.ordenesHora) : undefined,
    ordenesPeso: meta.ordenesPeso ? String(meta.ordenesPeso) : undefined,
    balanceHidrico: meta.balanceHidrico && typeof meta.balanceHidrico === 'object' ? meta.balanceHidrico : undefined,
    evolvedInDay: meta.evolvedInDay !== undefined ? Boolean(meta.evolvedInDay) : true,
    episodeNumber: meta.episodeNumber !== undefined ? Number(meta.episodeNumber) : undefined,
    isReingreso: meta.isReingreso !== undefined ? Boolean(meta.isReingreso) : undefined,
    examenFisico: {
      piel: String(row.examen_fisico?.piel || ''),
      cabezaOjos: String(row.examen_fisico?.cabezaOjos || ''),
      oidosOtoscopia: String(row.examen_fisico?.oidosOtoscopia || ''),
      narizOrofaringe: String(row.examen_fisico?.narizOrofaringe || ''),
      cuello: String(row.examen_fisico?.cuello || ''),
      toraxCP: String(row.examen_fisico?.toraxCP || ''),
      cardiovascular: String(row.examen_fisico?.cardiovascular || ''),
      abdomen: String(row.examen_fisico?.abdomen || ''),
      genitourinario: String(row.examen_fisico?.genitourinario || ''),
      extremidades: String(row.examen_fisico?.extremidades || ''),
      neurologico: String(row.examen_fisico?.neurologico || ''),
    },
    vitalSigns: rawVital,
    diagnosesModified: String(row.diagnoses_modified || ''),
    treatmentModified: String(row.treatment_modified || ''),
    interrogatory24h: String(row.interrogatory_24h || ''),
    medicalRoundSummary: String(row.medical_round_summary || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function mapEvolutionToRow(evolution: MedicalEvolution): Record<string, any> {
  const packedVitalSigns = {
    ...(evolution.vitalSigns || {}),
    __meta: {
      comentariosPlan: evolution.comentariosPlan || '',
      ordenesMedicas: evolution.ordenesMedicas || undefined,
      ordenesFecha: evolution.ordenesFecha || undefined,
      ordenesHora: evolution.ordenesHora || undefined,
      ordenesPeso: evolution.ordenesPeso || undefined,
      balanceHidrico: evolution.balanceHidrico || undefined,
      evolvedInDay: evolution.evolvedInDay ?? true,
      episodeNumber: evolution.episodeNumber,
      isReingreso: evolution.isReingreso,
    }
  };

  return {
    id: evolution.id,
    patient_id: evolution.patientId,
    date: evolution.date || new Date().toISOString().split('T')[0],
    time: evolution.time || '08:00',
    doctor_name: evolution.doctorName || 'Dr. Brayan',
    evolution_note: evolution.evolutionNote || '',
    subjetivo: evolution.subjetivo || '',
    objetivo: evolution.objetivo || '',
    examen_fisico: evolution.examenFisico || {},
    vital_signs: packedVitalSigns,
    diagnoses_modified: evolution.diagnosesModified || '',
    treatment_modified: evolution.treatmentModified || '',
    interrogatory_24h: evolution.interrogatory24h || '',
    medical_round_summary: evolution.medicalRoundSummary || evolution.comentariosPlan || '',
  };
}

export async function fetchEvolutionsByPatientId(patientId: string): Promise<MedicalEvolution[]> {
  try {
    const { data, error } = await supabase
      .from('evolutions')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching evolutions for patient:', error);
      return [];
    }
    return (data || []).map(mapEvolutionFromRow);
  } catch (err) {
    console.error('Exception fetching evolutions from Supabase:', err);
    return [];
  }
}

export async function saveEvolutionToSupabase(evolution: MedicalEvolution): Promise<MedicalEvolution> {
  const row = mapEvolutionToRow(evolution);
  const { error } = await supabase.from('evolutions').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving evolution to Supabase:', error);
    throw error;
  }
  return evolution;
}

export async function deleteEvolutionFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('evolutions').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ==========================================
// 3. BEDS MAPPING & CRUD (Table: 'beds')
// ==========================================

export function mapBedFromRow(row: any): Bed {
  return {
    id: String(row.id || ''),
    bedNumber: String(row.bed_number || ''),
    area: (row.area || 'Hospitalización') as HospitalArea,
    status: (row.status || 'free') as 'free' | 'occupied' | 'cleaning' | 'maintenance',
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    patientName: row.patient_name ? String(row.patient_name) : undefined,
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function mapBedToRow(bed: Bed): Record<string, any> {
  return {
    id: bed.id,
    bed_number: bed.bedNumber,
    area: bed.area,
    status: bed.status,
    patient_id: bed.patientId || null,
    patient_name: bed.patientName || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchBedsFromSupabase(): Promise<Bed[]> {
  try {
    const { data, error } = await supabase
      .from('beds')
      .select('*')
      .order('area', { ascending: true })
      .order('bed_number', { ascending: true });

    if (error) {
      console.error('Error fetching beds from Supabase:', error);
      return INITIAL_BEDS;
    }

    // If table is newly created with 0 beds, seed the official hospital bed setup
    if (!data || data.length === 0) {
      console.log('🌱 Seeding initial hospital beds into Supabase beds table...');
      const seedRows = INITIAL_BEDS.map(mapBedToRow);
      const seedRes = await supabase.from('beds').insert(seedRows).select();
      if (!seedRes.error && seedRes.data) {
        return seedRes.data.map(mapBedFromRow);
      }
      return INITIAL_BEDS;
    }

    return data.map(mapBedFromRow);
  } catch (err) {
    console.error('Exception fetching beds from Supabase:', err);
    return INITIAL_BEDS;
  }
}

export async function saveBedToSupabase(bed: Bed): Promise<Bed> {
  const row = mapBedToRow(bed);
  const { error } = await supabase.from('beds').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving bed to Supabase:', error);
    throw error;
  }
  return bed;
}

export async function saveBedsToSupabase(beds: Bed[]): Promise<Bed[]> {
  if (!beds.length) return beds;
  const rows = beds.map(mapBedToRow);
  const { error } = await supabase.from('beds').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Error saving beds to Supabase:', error);
    throw error;
  }
  return beds;
}

// ==========================================
// 4. HISTORIAS CLINICAS CRUD (Table: 'historias')
// ==========================================

export function mapHistoriaFromRow(row: any): HistoriaClinicaPediatrica {
  const prenatales = row.datos_prenatales || {};
  const neonatal = row.periodo_neonatal || {};
  const alimentacion = row.alimentacion_desarrollo || {};
  const antecedentes = row.antecedentes_personales_familiares || {};
  const funcional = row.examen_funcional || {};
  const fisico = row.examen_fisico_completo || {};
  const antropometria = row.antropometria_percentiles || {};
  const graffar = row.graffar || {};
  const resumen = row.resumen_ingreso || {};

  return {
    ...DEFAULT_HISTORIA_CLINICA,
    id: String(row.id || ''),
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    numHistoria: String(row.num_historia || ''),
    apellidos: String(row.apellidos || ''),
    nombres: String(row.nombres || ''),
    generoPatient: (row.genero_patient || 'niño') as 'niño' | 'niña',
    edad: String(row.edad || ''),
    fechaNacimiento: row.fecha_nacimiento || '',
    lugarFechaNacimiento: String(row.lugar_fecha_nacimiento || ''),
    fechaIngreso: String(row.fecha_ingreso || new Date().toISOString().split('T')[0]),
    horaIngreso: String(row.hora_ingreso || '08:00'),
    ci: String(row.ci || ''),
    telefono: String(row.telefono || ''),
    direccionCompleta: String(row.direccion_completa || ''),

    // Flatten nested JSON groups back into the official HistoriaClinicaPediatrica model
    ...prenatales,
    ...neonatal,
    ...alimentacion,
    ...antecedentes,
    ...funcional,
    ...fisico,
    ...antropometria,
    ...graffar,
    ...resumen,

    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function mapHistoriaToRow(h: HistoriaClinicaPediatrica): Record<string, any> {
  return {
    id: h.id,
    patient_id: h.patientId || null,
    num_historia: h.numHistoria || '',
    apellidos: h.apellidos || '',
    nombres: h.nombres || '',
    genero_patient: h.generoPatient || 'niño',
    edad: h.edad || '',
    fecha_nacimiento: h.fechaNacimiento || null,
    lugar_fecha_nacimiento: h.lugarFechaNacimiento || '',
    fecha_ingreso: h.fechaIngreso || new Date().toISOString().split('T')[0],
    hora_ingreso: h.horaIngreso || '08:00',
    ci: h.ci || '',
    telefono: h.telefono || '',
    direccion_completa: h.direccionCompleta || '',

    // Group sections into corresponding JSON columns
    datos_prenatales: {
      antecedentesPrenatales: h.antecedentesPrenatales || '',
      prenatalEdadMadre: h.prenatalEdadMadre || '',
      prenatalHO_G: h.prenatalHO_G || '0',
      prenatalHO_P: h.prenatalHO_P || '0',
      prenatalHO_C: h.prenatalHO_C || '0',
      prenatalHO_A: h.prenatalHO_A || '0',
      prenatalControles: h.prenatalControles || '',
      prenatalComplicaciones: h.prenatalComplicaciones || '',
      prenatalSemanas: h.prenatalSemanas || '',
      prenatalTipoParto: h.prenatalTipoParto || '',
      prenatalInstrumental: h.prenatalInstrumental || '',
      prenatalInfecciones: h.prenatalInfecciones || '',
      prenatalControlTipo: h.prenatalControlTipo || 'bien',
    },

    periodo_neonatal: {
      periodoNeonatal: h.periodoNeonatal || '',
      neonatalRespEspontanea: h.neonatalRespEspontanea || '',
      neonatalAsistenciaResp: h.neonatalAsistenciaResp || '',
      neonatalPesoNacer: h.neonatalPesoNacer || '',
      neonatalTallaNacer: h.neonatalTallaNacer || '',
      neonatalIctericia: h.neonatalIctericia || '',
      neonatalCianosis: h.neonatalCianosis || '',
      neonatalConvulsiones: h.neonatalConvulsiones || '',
      neonatalFiebre: h.neonatalFiebre || '',
      neonatalVomitos: h.neonatalVomitos || '',
      neonatalHemorragia: h.neonatalHemorragia || '',
      neonatalMalformaciones: h.neonatalMalformaciones || '',
      neonatalOftalmia: h.neonatalOftalmia || '',
      neonatalCoriza: h.neonatalCoriza || '',
      neonatalOtros: h.neonatalOtros || '',
      neonatalCordonDias: h.neonatalCordonDias || '',
    },

    alimentacion_desarrollo: {
      alimentacion: h.alimentacion || '',
      alimLmeMeses: h.alimLmeMeses || '',
      alimArtificialMeses: h.alimArtificialMeses || '',
      alimMixtaMeses: h.alimMixtaMeses || '',
      alimDesteteMeses: h.alimDesteteMeses || '',
      alimCerealesMeses: h.alimCerealesMeses || '',
      alimSopasMeses: h.alimSopasMeses || '',
      alimVegetalesMeses: h.alimVegetalesMeses || '',
      alimHuevosMeses: h.alimHuevosMeses || '',
      alimCarnesMeses: h.alimCarnesMeses || '',
      alimVitaminas: h.alimVitaminas || '',
      alimProteinasSemana: h.alimProteinasSemana || '',
      alimVegetalesSemana: h.alimVegetalesSemana || '',
      alimCarbohidratosSemana: h.alimCarbohidratosSemana || '',
      alimDulcesSemana: h.alimDulcesSemana || '',
      alimFormulaNombre: h.alimFormulaNombre || '',
      alimFormulaOz: h.alimFormulaOz || '',
      alimFormulaFrecuencia: h.alimFormulaFrecuencia || '',
      alimTipoLactancia: h.alimTipoLactancia || 'LME',
      alimHideLme: Boolean(h.alimHideLme),
      alimHideDieta: Boolean(h.alimHideDieta),
      desarrolloTabulador: h.desarrolloTabulador || '',
      desarrolloCabezaMeses: h.desarrolloCabezaMeses || '',
      desarrolloSentoMeses: h.desarrolloSentoMeses || '',
      desarrolloParoMeses: h.desarrolloParoMeses || '',
      desarrolloCaminoMeses: h.desarrolloCaminoMeses || '',
      desarrolloEsfinterMeses: h.desarrolloEsfinterMeses || '',
      desarrolloDienteMeses: h.desarrolloDienteMeses || '',
      desarrolloPalabrasMeses: h.desarrolloPalabrasMeses || '',
      desarrolloGradoEscuela: h.desarrolloGradoEscuela || '',
      desarrolloProgresoEscuela: h.desarrolloProgresoEscuela || '',
      desarrolloProgresoPeso: h.desarrolloProgresoPeso || '',
      habitosPsicologicos: h.habitosPsicologicos || '',
      habitosSuenoNocturno: h.habitosSuenoNocturno || '',
      habitosSiestas: h.habitosSiestas || '',
      habitosJuegos: h.habitosJuegos || '',
      habitosSexuales: h.habitosSexuales || '',
      habitosDigitosuccion: h.habitosDigitosuccion || '',
      habitosOnicofagia: h.habitosOnicofagia || '',
      habitosRasgosPersonales: h.habitosRasgosPersonales || '',
      habitosRecreacion: h.habitosRecreacion || '',
      habitosOcupacion: h.habitosOcupacion || '',
      inmunizacionesPruebas: h.inmunizacionesPruebas || '',
      vacunaViruela: h.vacunaViruela || '',
      vacunaTosFerina: h.vacunaTosFerina || '',
      vacunaDifteria: h.vacunaDifteria || '',
      vacunaTetanos: h.vacunaTetanos || '',
      vacunaTificas: h.vacunaTificas || '',
      vacunaBcg: h.vacunaBcg || '',
      vacunaHbNeonatal: h.vacunaHbNeonatal || '',
      vacunaPoliomielitis: h.vacunaPoliomielitis || '',
      vacunaAntiamarilica: h.vacunaAntiamarilica || '',
      vacunaPentavalente: h.vacunaPentavalente || '',
      vacunaRotavirus: h.vacunaRotavirus || '',
      vacunaNeumococo: h.vacunaNeumococo || '',
      vacunaInfluenza: h.vacunaInfluenza || '',
      vacunaTrivalente: h.vacunaTrivalente || '',
      vacunasOtras: h.vacunasOtras || '',
      pruebaTuberculina: h.pruebaTuberculina || '',
      tarjetaInn: h.tarjetaInn || '',
    },

    antecedentes_personales_familiares: {
      antecedentesPersonales: h.antecedentesPersonales || '',
      apCronicas: h.apCronicas || '',
      apInfecciosas: h.apInfecciosas || '',
      apHospitalizaciones: h.apHospitalizaciones || '',
      apTransfusiones: h.apTransfusiones || '',
      apQuirurgicos: h.apQuirurgicos || '',
      apTraumatismos: h.apTraumatismos || '',
      historiaFamiliar: h.historiaFamiliar || '',
      hfMadre: h.hfMadre || '',
      hfPadre: h.hfPadre || '',
      hfHermanos: h.hfHermanos || '',
      hfAbueloPaterno: h.hfAbueloPaterno || '',
      hfAbuelaPaterna: h.hfAbuelaPaterna || '',
      hfAbueloMaterno: h.hfAbueloMaterno || '',
      hfAbuelaMaterna: h.hfAbuelaMaterna || '',
      hfLinajeMaterno: h.hfLinajeMaterno || '',
      hfLinajePaterno: h.hfLinajePaterno || '',
    },

    examen_funcional: {
      examenFuncionalGeneral: h.examenFuncionalGeneral || '',
      pielFuncional: h.pielFuncional || '',
      cabezaFuncional: h.cabezaFuncional || '',
      ojosFuncional: h.ojosFuncional || '',
      oidosFuncional: h.oidosFuncional || '',
      narizFuncional: h.narizFuncional || '',
      bocaFuncional: h.bocaFuncional || '',
      respiratorioFuncional: h.respiratorioFuncional || '',
      osteomioarticularFuncional: h.osteomioarticularFuncional || '',
      cardiovascularFuncional: h.cardiovascularFuncional || '',
      gastrointestinalFuncional: h.gastrointestinalFuncional || '',
      genitourinarioFuncional: h.genitourinarioFuncional || '',
      ginecologicosFuncional: h.ginecologicosFuncional || '',
      nerviosoCentralFuncional: h.nerviosoCentralFuncional || '',
    },

    examen_fisico_completo: {
      temp: h.temp || '',
      fr: h.fr || '',
      fc: h.fc || '',
      ta: h.ta || '',
      so2: h.so2 || '',
      so2ConO2: h.so2ConO2 || '',
      peso: h.peso || '',
      talla: h.talla || '',
      cc: h.cc || '',
      ca: h.ca || '',
      ct: h.ct || '',
      percentil: h.percentil || '',
      pesoEdad: h.pesoEdad || '',
      tallaEdad: h.tallaEdad || '',
      pesoTalla: h.pesoTalla || '',
      estadoGeneralFisico: h.estadoGeneralFisico || '',
      pielPaniculoFanerasFisico: h.pielPaniculoFanerasFisico || '',
      cabezaFisico: h.cabezaFisico || '',
      ojosFisico: h.ojosFisico || '',
      oidosFisico: h.oidosFisico || '',
      rinofaringeFisico: h.rinofaringeFisico || '',
      bocaFisico: h.bocaFisico || '',
      cuelloFisico: h.cuelloFisico || '',
      gangliosLinfaticosFisico: h.gangliosLinfaticosFisico || '',
      toraxPulmonesFisico: h.toraxPulmonesFisico || '',
      cardiovascularFisico: h.cardiovascularFisico || '',
      abdomenFisico: h.abdomenFisico || '',
      urinarioFisico: h.urinarioFisico || '',
      genitalesFisico: h.genitalesFisico || '',
      anoRectoFisico: h.anoRectoFisico || '',
      huesosArticulacionesMuslosFisico: h.huesosArticulacionesMuslosFisico || '',
      neurologicoPsiquicoFisico: h.neurologicoPsiquicoFisico || '',
      sensorialesFisico: h.sensorialesFisico || '',
      fechaHoraExamenFisico: h.fechaHoraExamenFisico || '',
      examenPracticadoPor: h.examenPracticadoPor || '',
    },

    antropometria_percentiles: {
      peso: h.peso || '',
      talla: h.talla || '',
      cc: h.cc || '',
      ca: h.ca || '',
      ct: h.ct || '',
      percentil: h.percentil || '',
      pesoEdad: h.pesoEdad || '',
      tallaEdad: h.tallaEdad || '',
      pesoTalla: h.pesoTalla || '',
      percentilPesoTalla: h.percentilPesoTalla || '',
      percentilPesoEdad: h.percentilPesoEdad || '',
      percentilTallaEdad: h.percentilTallaEdad || '',
    },

    graffar: {
      graffarProfesionJefe: h.graffarProfesionJefe || '',
      graffarInstruccionMadre: h.graffarInstruccionMadre || '',
      graffarFuenteIngreso: h.graffarFuenteIngreso || '',
      graffarAlojamiento: h.graffarAlojamiento || '',
      graffarScoreA: h.graffarScoreA || 0,
      graffarScoreB: h.graffarScoreB || 0,
      graffarScoreC: h.graffarScoreC || 0,
      graffarScoreD: h.graffarScoreD || 0,
      graffarPuntajeTotal: h.graffarPuntajeTotal || 0,
      graffarEstrato: h.graffarEstrato || '',
      graffarResultado: h.graffarResultado || '',
    },

    resumen_ingreso: {
      motivosAdmision: h.motivosAdmision || '',
      enfermedadActual: h.enfermedadActual || '',
      diagnosticoAdmision: h.diagnosticoAdmision || '',
      intervencionTratamiento: h.intervencionTratamiento || '',
      diagnosticoClinicoFinal: h.diagnosticoClinicoFinal || '',
      resumenMotivoConsulta: h.resumenMotivoConsulta || '',
      resumenHistoriaEnfermedad: h.resumenHistoriaEnfermedad || '',
      resumenAntecedentesObstetricos: h.resumenAntecedentesObstetricos || '',
      resumenInmunizaciones: h.resumenInmunizaciones || '',
      resumenPatologicosPersonales: h.resumenPatologicosPersonales || '',
      resumenDiagnosticosIngreso: h.resumenDiagnosticosIngreso || '',
      resumenComentario: h.resumenComentario || '',
      laboratoriosColumnas: h.laboratoriosColumnas || [],
      laboratoriosOtros: h.laboratoriosOtros || '',
      isReingreso: Boolean(h.isReingreso),
      reingresoDate: h.reingresoDate || '',
      previousHistoriaId: h.previousHistoriaId || '',
      episodeNumber: h.episodeNumber || 1,
    },

    updated_at: new Date().toISOString(),
  };
}

export async function fetchHistoriasFromSupabase(): Promise<HistoriaClinicaPediatrica[]> {
  try {
    const { data, error } = await supabase
      .from('historias')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching historias from Supabase:', error);
      return [];
    }
    return (data || []).map(mapHistoriaFromRow);
  } catch (err) {
    console.error('Exception fetching historias from Supabase:', err);
    return [];
  }
}

export async function fetchHistoriaByIdFromSupabase(id: string): Promise<HistoriaClinicaPediatrica | null> {
  try {
    const { data, error } = await supabase
      .from('historias')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapHistoriaFromRow(data);
  } catch {
    return null;
  }
}

export async function saveHistoriaToSupabase(historia: HistoriaClinicaPediatrica): Promise<HistoriaClinicaPediatrica> {
  const row = mapHistoriaToRow(historia);
  const { error } = await supabase.from('historias').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving historia to Supabase:', error);
    throw error;
  }
  return historia;
}

export async function deleteHistoriaFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('historias').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ==========================================
// 5. TASKS CRUD (Table: 'tasks')
// ==========================================

export function mapTaskFromRow(row: any): PersonalTask {
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    description: row.description ? String(row.description) : undefined,
    category: (row.category || 'médica') as any,
    priority: (row.priority || 'media') as any,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    dueTime: row.due_time ? String(row.due_time) : undefined,
    completed: Boolean(row.completed),
    reminderActive: Boolean(row.reminder_active),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function mapTaskToRow(task: PersonalTask): Record<string, any> {
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    category: task.category || 'médica',
    priority: task.priority || 'media',
    due_date: task.dueDate || null,
    due_time: task.dueTime || null,
    completed: Boolean(task.completed),
    reminder_active: Boolean(task.reminderActive),
  };
}

export async function fetchTasksFromSupabase(): Promise<PersonalTask[]> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks from Supabase:', error);
      return [];
    }
    return (data || []).map(mapTaskFromRow);
  } catch (err) {
    console.error('Exception fetching tasks from Supabase:', err);
    return [];
  }
}

export async function saveTaskToSupabase(task: PersonalTask): Promise<PersonalTask> {
  const row = mapTaskToRow(task);
  const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Error saving task to Supabase:', error);
    throw error;
  }
  return task;
}

export async function saveTasksToSupabase(tasks: PersonalTask[]): Promise<PersonalTask[]> {
  if (!tasks.length) return tasks;
  const rows = tasks.map(mapTaskToRow);
  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Error saving tasks to Supabase:', error);
    throw error;
  }
  return tasks;
}

export async function deleteTaskFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ==========================================
// 6. REALTIME SUBSCRIPTION (Supabase Channels)
// ==========================================

export function subscribeToSupabaseRealtime(
  onUpdate: (event: { table: string; eventType: string; newRow: any; oldRow: any }) => void
): () => void {
  const channel = supabase
    .channel('hmi-clinical-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload) => {
        onUpdate({
          table: payload.table,
          eventType: payload.eventType,
          newRow: payload.new,
          oldRow: payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==========================================
// 7. USER PROFILES & AUTH HELPERS
// ==========================================

const PROFILES_STORAGE_KEY = 'hmi_user_profiles_cache';

function getStoredProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredProfiles(profiles: UserProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('Could not cache user profiles in localStorage:', err);
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      return data as UserProfile;
    }
  } catch {
    // Fallback to local profile store
  }

  const list = getStoredProfiles();
  return list.find(p => p.id === userId) || null;
}

export type UpsertProfileResult = UserProfile & {
  success: boolean;
  data?: UserProfile;
  error?: any;
};

export async function upsertUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UpsertProfileResult> {
  let savedProfile: UserProfile = {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name || '',
    role_type: profile.role_type || 'Interno',
    role: profile.role || 'doctor',
    is_approved: profile.is_approved ?? false,
    is_admin: profile.is_admin ?? false,
    details: profile.details || {},
    updated_at: new Date().toISOString(),
    created_at: profile.created_at || new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(savedProfile, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      savedProfile = data as UserProfile;
    }
  } catch {
    // Fallback to local store
  }

  const list = getStoredProfiles();
  const nextList = [savedProfile, ...list.filter(p => p.id !== savedProfile.id)];
  setStoredProfiles(nextList);

  return {
    ...savedProfile,
    success: true,
    data: savedProfile,
  };
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setStoredProfiles(data as UserProfile[]);
      return data as UserProfile[];
    }
  } catch {
    // Fallback to local
  }

  return getStoredProfiles();
}

export async function approveUserProfile(userId: string): Promise<boolean> {
  try {
    await supabase
      .from('profiles')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // Continue
  }

  const list = getStoredProfiles();
  const updated = list.map(p => p.id === userId ? { ...p, is_approved: true, updated_at: new Date().toISOString() } : p);
  setStoredProfiles(updated);
  return true;
}

export async function deleteUserProfile(userId: string): Promise<boolean> {
  try {
    await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
  } catch {
    // Continue
  }

  const list = getStoredProfiles();
  setStoredProfiles(list.filter(p => p.id !== userId));
  return true;
}

// ==========================================
// 8. SYSTEM CONFIGS: ROL DE GUARDIAS (Table: 'system_configs')
// ==========================================

export const GUARDIAS_CONFIG_KEY = 'cronograma_guardias_nov_2026';

export async function fetchGuardiasFromSupabase(
  configKey: string = GUARDIAS_CONFIG_KEY
): Promise<RolGuardiasData | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', configKey)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching guardias from Supabase system_configs:', error);
      return null;
    }

    if (!data || !data.value) return null;

    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!rawValue || typeof rawValue !== 'object' || !Array.isArray(rawValue.grupos)) {
      return null;
    }

    const normalized = normalizeGuardiasData({
      ...rawValue,
      updatedAt: rawValue.updatedAt || data.updated_at || new Date().toISOString()
    });
    return normalized;
  } catch (err) {
    console.warn('Exception fetching guardias from Supabase system_configs:', err);
    return null;
  }
}

export async function saveGuardiasToSupabase(
  guardias: RolGuardiasData,
  configKey: string = GUARDIAS_CONFIG_KEY
): Promise<RolGuardiasData> {
  const payload = normalizeGuardiasData({
    ...guardias,
    updatedAt: new Date().toISOString()
  });

  const { error } = await supabase
    .from('system_configs')
    .upsert(
      {
        key: configKey,
        value: payload,
        updated_at: payload.updatedAt
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving guardias to Supabase system_configs:', error);
    throw error;
  }

  return payload;
}

// ==========================================
// 9. SYSTEM CONFIGS: HISTORIAL DE ACTIVIDAD (MAX 100)
// ==========================================

export const ACTIVITY_LOGS_CONFIG_KEY = 'activity_logs_history';

export async function fetchActivityLogsFromSupabase(
  configKey: string = ACTIVITY_LOGS_CONFIG_KEY
): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', configKey)
      .maybeSingle();

    if (error || !data || !data.value) return null;
    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (Array.isArray(rawValue)) {
      return rawValue.slice(0, 100);
    }
    if (rawValue && Array.isArray(rawValue.logs)) {
      return rawValue.logs.slice(0, 100);
    }
    return null;
  } catch (err) {
    console.warn('Exception fetching activity logs from Supabase system_configs:', err);
    return null;
  }
}

export async function saveActivityLogsToSupabase(
  logs: any[],
  configKey: string = ACTIVITY_LOGS_CONFIG_KEY
): Promise<void> {
  try {
    const trimmed = Array.isArray(logs) ? logs.slice(0, 100) : [];
    const { error } = await supabase
      .from('system_configs')
      .upsert(
        {
          key: configKey,
          value: { logs: trimmed, maxLogs: 100, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );
    if (error) {
      console.warn('Notice saving activity logs to Supabase system_configs:', error);
    }
  } catch (err) {
    console.warn('Exception saving activity logs to Supabase:', err);
  }
}

// ==========================================
// 10. SYSTEM CONFIGS: PATIENTS READMISSIONS & DISCHARGE META
// ==========================================

export const PATIENTS_META_CONFIG_KEY = 'patients_clinical_meta';

export type PatientClinicalMetaEntry = {
  historiaClinicaId?: string;
  previousHistoriaIds?: string[];
  isReingreso?: boolean;
  readmissionMode?: 'correct_errors' | 'new_admission';
  readmissionCount?: number;
  lastReadmissionDate?: string;
  readmissions?: any[];
  dischargeDate?: string;
  dischargeTime?: string;
  dischargeReason?: string;
  dischargeHistory?: Array<{ date: string; time?: string; reason?: string }>;
};

export async function fetchPatientsMetaFromSupabase(): Promise<Record<string, PatientClinicalMetaEntry>> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value')
      .eq('key', PATIENTS_META_CONFIG_KEY)
      .maybeSingle();

    if (error || !data || !data.value) return {};
    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      return (rawValue.patients && typeof rawValue.patients === 'object') ? rawValue.patients : rawValue;
    }
    return {};
  } catch {
    return {};
  }
}

export async function savePatientsMetaToSupabase(patients: Patient[]): Promise<void> {
  try {
    const map: Record<string, PatientClinicalMetaEntry> = {};
    for (const p of patients) {
      if (!p?.id) continue;
      if (
        p.isReingreso ||
        p.readmissionMode ||
        (p.readmissions && p.readmissions.length > 0) ||
        (p.previousHistoriaIds && p.previousHistoriaIds.length > 0) ||
        p.dischargeDate ||
        (p.dischargeHistory && p.dischargeHistory.length > 0) ||
        p.historiaClinicaId
      ) {
        map[p.id] = {
          historiaClinicaId: p.historiaClinicaId,
          previousHistoriaIds: p.previousHistoriaIds,
          isReingreso: p.isReingreso,
          readmissionMode: p.readmissionMode,
          readmissionCount: p.readmissionCount,
          lastReadmissionDate: p.lastReadmissionDate,
          readmissions: p.readmissions,
          dischargeDate: p.dischargeDate,
          dischargeTime: p.dischargeTime,
          dischargeReason: p.dischargeReason,
          dischargeHistory: p.dischargeHistory,
        };
      }
    }
    await supabase
      .from('system_configs')
      .upsert(
        {
          key: PATIENTS_META_CONFIG_KEY,
          value: { patients: map, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
  } catch {
    // Non-blocking background metadata sync
  }
}

// ==========================================
// 11. SYSTEM CONFIGS: GLOBAL MAINTENANCE MODE
// ==========================================

export const MAINTENANCE_CONFIG_KEY = 'app_maintenance_mode';
export const DEFAULT_MAINTENANCE_MESSAGE =
  'Página en mantenimiento, por favor espere que el desarrollador repare el sistema, gracias por su paciencia :)';

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  updatedAt: string;
  updatedBy?: string;
}

export async function fetchMaintenanceFromSupabase(): Promise<MaintenanceConfig | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', MAINTENANCE_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching maintenance config from Supabase:', error);
      return null;
    }

    if (!data || !data.value) return null;

    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!rawValue || typeof rawValue !== 'object') return null;

    return {
      enabled: Boolean(rawValue.enabled),
      message: String(rawValue.message || DEFAULT_MAINTENANCE_MESSAGE),
      updatedAt: String(rawValue.updatedAt || data.updated_at || new Date().toISOString()),
      updatedBy: rawValue.updatedBy ? String(rawValue.updatedBy) : undefined,
    };
  } catch (err) {
    console.warn('Exception fetching maintenance config from Supabase:', err);
    return null;
  }
}

export async function saveMaintenanceToSupabase(
  config: MaintenanceConfig
): Promise<MaintenanceConfig> {
  const payload: MaintenanceConfig = {
    enabled: Boolean(config.enabled),
    message: config.message || DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: config.updatedAt || new Date().toISOString(),
    updatedBy: config.updatedBy || 'Administrador',
  };

  const { error } = await supabase
    .from('system_configs')
    .upsert(
      {
        key: MAINTENANCE_CONFIG_KEY,
        value: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving maintenance config to Supabase:', error);
    throw error;
  }

  return payload;
}

// ==========================================
// 12. SYSTEM CONFIGS: GLOBAL AMBIENT SOUND
// ==========================================

export const AMBIENT_SOUND_CONFIG_KEY = 'app_ambient_sound';

export interface AmbientSoundSupabaseConfig {
  enabled: boolean;
  intensity: number;
  updatedAt: string;
  updatedBy?: string;
}

export async function fetchAmbientSoundFromSupabase(): Promise<AmbientSoundSupabaseConfig | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', AMBIENT_SOUND_CONFIG_KEY)
      .maybeSingle();

    if (error || !data || !data.value) return null;

    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!rawValue || typeof rawValue !== 'object') return null;

    const numIntensity = Number(rawValue.intensity);
    return {
      enabled: Boolean(rawValue.enabled),
      intensity: Number.isFinite(numIntensity) ? Math.min(1, Math.max(0.05, numIntensity)) : 0.4,
      updatedAt: String(rawValue.updatedAt || data.updated_at || new Date().toISOString()),
      updatedBy: rawValue.updatedBy ? String(rawValue.updatedBy) : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveAmbientSoundToSupabase(
  config: AmbientSoundSupabaseConfig
): Promise<AmbientSoundSupabaseConfig> {
  const numIntensity = Number(config.intensity);
  const payload: AmbientSoundSupabaseConfig = {
    enabled: Boolean(config.enabled),
    intensity: Number.isFinite(numIntensity) ? Math.min(1, Math.max(0.05, numIntensity)) : 0.4,
    updatedAt: config.updatedAt || new Date().toISOString(),
    updatedBy: config.updatedBy || 'Administrador',
  };

  const { error } = await supabase
    .from('system_configs')
    .upsert(
      {
        key: AMBIENT_SOUND_CONFIG_KEY,
        value: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving ambient sound config to Supabase:', error);
    throw error;
  }

  return payload;
}

// ==========================================
// 13. SYSTEM CONFIGS: PANEL DE CONTROL GLOBAL
// ==========================================

export const PANEL_CONTROL_CONFIG_KEY = 'app_panel_control';

export interface PanelControlSupabaseConfig {
  seasonalTheme?: string;
  autoVenezuelaMode?: boolean;
  autoNightShiftMode?: boolean;
  seasonalOverlayConfig?: Record<string, any>;
  ambientSound?: {
    enabled?: boolean;
    intensity?: number;
    updatedAt?: string;
    updatedBy?: string;
  };
  maintenanceMode?: {
    enabled?: boolean;
    message?: string;
    updatedAt?: string;
    updatedBy?: string;
  };
  darkMode?: string | boolean;
  adminMasterPassword?: string;
  adminMasterPasswordUpdatedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export async function fetchPanelControlFromSupabase(): Promise<PanelControlSupabaseConfig | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', PANEL_CONTROL_CONFIG_KEY)
      .maybeSingle();

    if (error || !data || !data.value) return null;

    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!rawValue || typeof rawValue !== 'object') return null;

    return {
      ...rawValue,
      updatedAt: String(rawValue.updatedAt || data.updated_at || new Date().toISOString()),
    };
  } catch (err) {
    console.warn('Exception fetching panel control config from Supabase:', err);
    return null;
  }
}

export async function savePanelControlToSupabase(
  config: PanelControlSupabaseConfig
): Promise<PanelControlSupabaseConfig> {
  const payload: PanelControlSupabaseConfig = {
    ...config,
    updatedAt: config.updatedAt || new Date().toISOString(),
    updatedBy: config.updatedBy || 'Administrador',
  };

  const { error } = await supabase
    .from('system_configs')
    .upsert(
      {
        key: PANEL_CONTROL_CONFIG_KEY,
        value: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving panel control config to Supabase:', error);
    throw error;
  }

  return payload;
}

// ==========================================
// 14. SYSTEM CONFIGS: FULL BACKUP v3.2.0 ('hmi_database_backup_full')
// ==========================================

export const FULL_BACKUP_CONFIG_KEY = 'hmi_database_backup_full';

export interface FullDatabaseBackupPayload {
  app?: string;
  timestamp?: string;
  version?: string;
  supabaseProject?: string;
  stats?: Record<string, any>;
  panelControl?: PanelControlSupabaseConfig & Record<string, any>;
  tables?: {
    patients?: any[];
    evolutions?: any[];
    beds?: any[];
    historias?: any[];
    tasks?: any[];
    profiles?: any[];
    guardias?: any;
    activityLogs?: any[];
    patientsClinicalMeta?: Record<string, PatientClinicalMetaEntry>;
    systemConfigs?: any[];
    maintenanceStatus?: MaintenanceConfig | null;
    ambientSoundConfig?: AmbientSoundSupabaseConfig | null;
    drafts?: Record<string, any>;
    offlineQueue?: any[];
    localStorageState?: Record<string, any>;
    autoBackups?: any[];
    latestExportedBackup?: any;
  };
}

export function normalizeEvolutionFromAny(raw: any): MedicalEvolution | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const patientId = String(raw.patientId || raw.patient_id || '').trim();
  if (!id || !patientId) return null;

  // If raw row comes directly from Supabase snake_case format
  if ('patient_id' in raw || 'vital_signs' in raw || 'doctor_name' in raw || 'evolution_note' in raw) {
    const mapped = mapEvolutionFromRow({ ...raw, id, patient_id: patientId });
    return {
      ...mapped,
      comentariosPlan: raw.comentariosPlan || mapped.comentariosPlan,
      ordenesMedicas: Array.isArray(raw.ordenesMedicas) ? raw.ordenesMedicas : mapped.ordenesMedicas,
      ordenesFecha: raw.ordenesFecha || mapped.ordenesFecha,
      ordenesHora: raw.ordenesHora || mapped.ordenesHora,
      ordenesPeso: raw.ordenesPeso || mapped.ordenesPeso,
      balanceHidrico: raw.balanceHidrico || mapped.balanceHidrico,
      evolvedInDay: raw.evolvedInDay !== undefined ? Boolean(raw.evolvedInDay) : mapped.evolvedInDay,
      episodeNumber: raw.episodeNumber !== undefined ? Number(raw.episodeNumber) : mapped.episodeNumber,
      isReingreso: raw.isReingreso !== undefined ? Boolean(raw.isReingreso) : mapped.isReingreso,
    };
  }

  return {
    id,
    patientId,
    date: String(raw.date || new Date().toISOString().split('T')[0]),
    time: String(raw.time || '08:00'),
    doctorName: String(raw.doctorName || 'Médico de Guardia'),
    evolutionNote: String(raw.evolutionNote || ''),
    subjetivo: String(raw.subjetivo || ''),
    objetivo: String(raw.objetivo || ''),
    comentariosPlan: raw.comentariosPlan !== undefined ? String(raw.comentariosPlan) : String(raw.medicalRoundSummary || ''),
    ordenesMedicas: Array.isArray(raw.ordenesMedicas) ? raw.ordenesMedicas : undefined,
    ordenesFecha: raw.ordenesFecha ? String(raw.ordenesFecha) : undefined,
    ordenesHora: raw.ordenesHora ? String(raw.ordenesHora) : undefined,
    ordenesPeso: raw.ordenesPeso ? String(raw.ordenesPeso) : undefined,
    balanceHidrico: raw.balanceHidrico && typeof raw.balanceHidrico === 'object' ? raw.balanceHidrico : undefined,
    evolvedInDay: raw.evolvedInDay !== undefined ? Boolean(raw.evolvedInDay) : true,
    episodeNumber: raw.episodeNumber !== undefined ? Number(raw.episodeNumber) : undefined,
    isReingreso: raw.isReingreso !== undefined ? Boolean(raw.isReingreso) : undefined,
    examenFisico: {
      piel: String(raw.examenFisico?.piel || ''),
      cabezaOjos: String(raw.examenFisico?.cabezaOjos || ''),
      oidosOtoscopia: String(raw.examenFisico?.oidosOtoscopia || ''),
      narizOrofaringe: String(raw.examenFisico?.narizOrofaringe || ''),
      cuello: String(raw.examenFisico?.cuello || ''),
      toraxCP: String(raw.examenFisico?.toraxCP || ''),
      cardiovascular: String(raw.examenFisico?.cardiovascular || ''),
      abdomen: String(raw.examenFisico?.abdomen || ''),
      genitourinario: String(raw.examenFisico?.genitourinario || ''),
      extremidades: String(raw.examenFisico?.extremidades || ''),
      neurologico: String(raw.examenFisico?.neurologico || ''),
    },
    vitalSigns: raw.vitalSigns && typeof raw.vitalSigns === 'object' ? raw.vitalSigns : {
      temp: '',
      fc: '',
      fr: '',
      ta: '',
      so2: '',
      peso: '',
    },
    diagnosesModified: raw.diagnosesModified ? String(raw.diagnosesModified) : '',
    treatmentModified: raw.treatmentModified ? String(raw.treatmentModified) : '',
    interrogatory24h: raw.interrogatory24h ? String(raw.interrogatory24h) : '',
    medicalRoundSummary: raw.medicalRoundSummary ? String(raw.medicalRoundSummary) : '',
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export function normalizePatientFromAny(
  raw: any,
  flatEvolutions: MedicalEvolution[] = [],
  metaMap: Record<string, PatientClinicalMetaEntry> = {}
): Patient | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;

  const embeddedEvs = Array.isArray(raw.evolutions)
    ? raw.evolutions
        .map((e: any) => normalizeEvolutionFromAny({ ...e, patientId: e?.patientId || e?.patient_id || id }))
        .filter((e: MedicalEvolution | null): e is MedicalEvolution => Boolean(e))
    : [];

  const matchingFlatEvs = flatEvolutions.filter(e => e.patientId === id);

  // Deduplicate evolutions by ID (preferring newest createdAt / richest metadata)
  const evById = new Map<string, MedicalEvolution>();
  for (const ev of [...matchingFlatEvs, ...embeddedEvs]) {
    const existing = evById.get(ev.id);
    if (!existing || (ev.createdAt || '') >= (existing.createdAt || '')) {
      evById.set(ev.id, ev);
    }
  }
  const mergedEvolutions = Array.from(evById.values()).sort((a, b) => {
    const da = `${a.date || ''}T${a.time || '00:00'}`;
    const db = `${b.date || ''}T${b.time || '00:00'}`;
    return db.localeCompare(da);
  });

  const isSnakeCase = 'first_name' in raw || 'last_name' in raw || 'medical_history_number' in raw || 'bed_number' in raw;
  const baseMapped: Patient = isSnakeCase
    ? mapPatientFromRow(raw, mergedEvolutions)
    : {
        id,
        medicalHistoryNumber: String(raw.medicalHistoryNumber || ''),
        firstName: String(raw.firstName || ''),
        lastName: String(raw.lastName || ''),
        age: String(raw.age || ''),
        gender: (raw.gender || 'M') as 'M' | 'F',
        weightKg: Number(raw.weightKg ?? 10),
        admissionDate: String(raw.admissionDate || new Date().toISOString().split('T')[0]),
        admissionTime: String(raw.admissionTime || '08:00'),
        area: (raw.area || 'Hospitalización') as HospitalArea,
        bedNumber: String(raw.bedNumber || 'Cama 01'),
        status: (raw.status || 'hospitalized') as 'hospitalized' | 'discharged',
        doctorInCharge: String(raw.doctorInCharge || ''),
        diagnoses: Array.isArray(raw.diagnoses) ? raw.diagnoses : [],
        treatment: String(raw.treatment || ''),
        pendingExams: String(raw.pendingExams || ''),
        documents: Array.isArray(raw.documents) ? raw.documents : [],
        evolutions: mergedEvolutions,
        createdAt: String(raw.createdAt || new Date().toISOString()),
        updatedAt: String(raw.updatedAt || new Date().toISOString()),
      };

  const meta = metaMap[id];
  const todayStr = new Date().toISOString().split('T')[0];
  const ultimaEvolucionFecha = mergedEvolutions[0]?.date || raw.ultimaEvolucionFecha || raw.fechaUltimaEvolucion || undefined;
  const evolucionadoHoy = Boolean(
    mergedEvolutions.some(e => e.date === todayStr) ||
    (raw.evolucionadoHoy && ultimaEvolucionFecha === todayStr)
  );

  return {
    ...baseMapped,
    firstName: raw.firstName ? String(raw.firstName) : baseMapped.firstName,
    lastName: raw.lastName ? String(raw.lastName) : baseMapped.lastName,
    medicalHistoryNumber: raw.medicalHistoryNumber ? String(raw.medicalHistoryNumber) : baseMapped.medicalHistoryNumber,
    admissionDate: raw.admissionDate ? String(raw.admissionDate) : baseMapped.admissionDate,
    admissionTime: raw.admissionTime ? String(raw.admissionTime) : baseMapped.admissionTime,
    bedNumber: raw.bedNumber ? String(raw.bedNumber) : baseMapped.bedNumber,
    doctorInCharge: raw.doctorInCharge ? String(raw.doctorInCharge) : baseMapped.doctorInCharge,
    pendingExams: raw.pendingExams !== undefined ? String(raw.pendingExams) : baseMapped.pendingExams,
    weightKg: raw.weightKg !== undefined ? Number(raw.weightKg) : baseMapped.weightKg,
    historiaClinicaId: raw.historiaClinicaId || raw.historia_clinica_id || meta?.historiaClinicaId || undefined,
    previousHistoriaIds: Array.isArray(raw.previousHistoriaIds) && raw.previousHistoriaIds.length > 0
      ? raw.previousHistoriaIds
      : meta?.previousHistoriaIds,
    isReingreso: raw.isReingreso ?? meta?.isReingreso ?? undefined,
    readmissionMode: raw.readmissionMode ?? meta?.readmissionMode ?? undefined,
    readmissionCount: raw.readmissionCount ?? meta?.readmissionCount ?? undefined,
    lastReadmissionDate: raw.lastReadmissionDate || meta?.lastReadmissionDate || undefined,
    readmissions: Array.isArray(raw.readmissions) && raw.readmissions.length > 0 ? raw.readmissions : meta?.readmissions,
    dischargeDate: raw.dischargeDate || raw.discharge_date || meta?.dischargeDate || undefined,
    dischargeTime: raw.dischargeTime || raw.discharge_time || meta?.dischargeTime || undefined,
    dischargeReason: raw.dischargeReason || raw.discharge_reason || meta?.dischargeReason || undefined,
    dischargeSummary: raw.dischargeSummary || undefined,
    dischargeHistory: Array.isArray(raw.dischargeHistory) && raw.dischargeHistory.length > 0
      ? raw.dischargeHistory
      : meta?.dischargeHistory,
    ordenesMedicas: Array.isArray(raw.ordenesMedicas) ? raw.ordenesMedicas : undefined,
    ordenesFecha: raw.ordenesFecha || undefined,
    ordenesHora: raw.ordenesHora || undefined,
    ordenesPeso: raw.ordenesPeso || undefined,
    resumenesEvolutivos: Array.isArray(raw.resumenesEvolutivos) ? raw.resumenesEvolutivos : undefined,
    evolutions: mergedEvolutions,
    evolucionadoHoy,
    ultimaEvolucionFecha: ultimaEvolucionFecha || undefined,
    createdAt: String(raw.createdAt || raw.created_at || baseMapped.createdAt),
    updatedAt: String(raw.updatedAt || raw.updated_at || baseMapped.updatedAt),
  };
}

export function normalizeBedFromAny(raw: any): Bed | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  if ('bed_number' in raw || 'patient_id' in raw || 'patient_name' in raw) {
    return mapBedFromRow(raw);
  }
  return {
    id: String(raw.id),
    bedNumber: String(raw.bedNumber || ''),
    area: (raw.area || 'Hospitalización') as HospitalArea,
    status: (raw.status || 'free') as 'free' | 'occupied' | 'cleaning' | 'maintenance',
    patientId: raw.patientId ? String(raw.patientId) : undefined,
    patientName: raw.patientName ? String(raw.patientName) : undefined,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function normalizeHistoriaFromAny(raw: any): HistoriaClinicaPediatrica | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  if (
    'num_historia' in raw ||
    'datos_prenatales' in raw ||
    'periodo_neonatal' in raw ||
    'examen_fisico_completo' in raw
  ) {
    return mapHistoriaFromRow(raw);
  }
  return {
    ...DEFAULT_HISTORIA_CLINICA,
    ...raw,
    id: String(raw.id),
    patientId: raw.patientId ? String(raw.patientId) : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function normalizeTaskFromAny(raw: any): PersonalTask | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  if ('due_date' in raw || 'due_time' in raw || 'reminder_active' in raw) {
    return mapTaskFromRow(raw);
  }
  return {
    id: String(raw.id),
    title: String(raw.title || ''),
    description: raw.description ? String(raw.description) : undefined,
    category: (raw.category || 'médica') as any,
    priority: (raw.priority || 'media') as any,
    dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
    dueTime: raw.dueTime ? String(raw.dueTime) : undefined,
    completed: Boolean(raw.completed),
    reminderActive: Boolean(raw.reminderActive),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export async function saveEvolutionsBatchToSupabase(evolutions: MedicalEvolution[]): Promise<void> {
  if (!evolutions.length) return;
  const rows = evolutions.map(mapEvolutionToRow);
  const { error } = await supabase.from('evolutions').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn('Warning batch upserting evolutions to Supabase:', error);
  }
}

export async function saveHistoriasBatchToSupabase(historias: HistoriaClinicaPediatrica[]): Promise<void> {
  if (!historias.length) return;
  const rows = historias.map(mapHistoriaToRow);
  const { error } = await supabase.from('historias').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn('Warning batch upserting historias to Supabase:', error);
  }
}

export async function fetchFullDatabaseBackupFromSupabase(): Promise<{
  payload: FullDatabaseBackupPayload;
  updatedAt: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('key, value, updated_at')
      .eq('key', FULL_BACKUP_CONFIG_KEY)
      .maybeSingle();

    if (error || !data || !data.value) return null;

    const rawValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!rawValue || typeof rawValue !== 'object') return null;

    const effectiveUpdatedAt = String(
      data.updated_at || rawValue.timestamp || rawValue.panelControl?.updatedAt || new Date().toISOString()
    );

    return {
      payload: rawValue as FullDatabaseBackupPayload,
      updatedAt: effectiveUpdatedAt,
    };
  } catch (err) {
    console.warn('Exception fetching full backup from Supabase system_configs:', err);
    return null;
  }
}

export async function saveFullDatabaseBackupToSupabase(
  payload: FullDatabaseBackupPayload
): Promise<{ payload: FullDatabaseBackupPayload; updatedAt: string }> {
  const updatedAt = payload.timestamp || new Date().toISOString();
  const normalizedPayload: FullDatabaseBackupPayload = {
    ...payload,
    version: payload.version || '3.2.0',
    timestamp: updatedAt,
  };

  const { error } = await supabase
    .from('system_configs')
    .upsert(
      {
        key: FULL_BACKUP_CONFIG_KEY,
        value: normalizedPayload,
        updated_at: updatedAt,
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving full database backup to Supabase:', error);
    throw error;
  }

  return { payload: normalizedPayload, updatedAt };
}

// ==========================================
// BUZÓN DE SUGERENCIAS AL DESARROLLADOR
// ==========================================
export interface PageSuggestion {
  id: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  message: string;
  createdAt: string;
  dateFormatted: string;
  isRead?: boolean;
}

const SUGGESTIONS_STORAGE_KEY = 'hmi_page_suggestions';
const SUGGESTIONS_CONFIG_KEY = 'hmi_page_suggestions';

export function getLocalSuggestions(): PageSuggestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUGGESTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalSuggestions(list: PageSuggestion[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('hmi_suggestions_updated'));
  } catch (err) {
    console.warn('Error saving local suggestions:', err);
  }
}

export async function fetchSuggestionsApi(): Promise<PageSuggestion[]> {
  const local = getLocalSuggestions();
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', SUGGESTIONS_CONFIG_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const remoteList = Array.isArray(data.value)
        ? data.value
        : typeof data.value === 'string'
        ? JSON.parse(data.value)
        : Array.isArray(data.value?.items)
        ? data.value.items
        : [];

      if (Array.isArray(remoteList)) {
        const mergedMap = new Map<string, PageSuggestion>();
        for (const item of remoteList) {
          if (item && item.id) mergedMap.set(item.id, item);
        }
        for (const item of local) {
          if (item && item.id) {
            const existing = mergedMap.get(item.id);
            mergedMap.set(item.id, existing ? { ...existing, ...item } : item);
          }
        }
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        saveLocalSuggestions(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Error fetching suggestions from Supabase:', err);
  }
  return local.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function syncSuggestionsToSupabase(list: PageSuggestion[]): Promise<void> {
  try {
    await supabase
      .from('system_configs')
      .upsert(
        {
          key: SUGGESTIONS_CONFIG_KEY,
          value: list,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
  } catch (err) {
    console.warn('Error syncing suggestions to Supabase:', err);
  }
}

export async function submitSuggestionApi(input: {
  userName: string;
  userEmail?: string;
  userRole?: string;
  message: string;
  dateFormatted?: string;
}): Promise<PageSuggestion[]> {
  const now = new Date();
  const formatted =
    input.dateFormatted?.trim() ||
    now.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const newSuggestion: PageSuggestion = {
    id: `sug-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    userName: input.userName.trim() || 'Usuario',
    userEmail: input.userEmail,
    userRole: input.userRole,
    message: input.message.trim(),
    createdAt: now.toISOString(),
    dateFormatted: formatted,
    isRead: false,
  };

  const current = await fetchSuggestionsApi().catch(() => getLocalSuggestions());
  const updated = [newSuggestion, ...current.filter((s) => s.id !== newSuggestion.id)];
  saveLocalSuggestions(updated);
  await syncSuggestionsToSupabase(updated);
  return updated;
}

export async function markSuggestionReadApi(id: string, isRead = true): Promise<PageSuggestion[]> {
  const current = getLocalSuggestions();
  const updated = current.map((s) => (s.id === id ? { ...s, isRead } : s));
  saveLocalSuggestions(updated);
  await syncSuggestionsToSupabase(updated);
  return updated;
}

export async function deleteSuggestionApi(id: string): Promise<PageSuggestion[]> {
  const current = getLocalSuggestions();
  const updated = current.filter((s) => s.id !== id);
  saveLocalSuggestions(updated);
  await syncSuggestionsToSupabase(updated);
  return updated;
}




