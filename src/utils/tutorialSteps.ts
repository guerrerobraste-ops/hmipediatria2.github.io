export type TutorialTourId =
  | 'historia_clinica'
  | 'tablero_camas'
  | 'evolucionar_paciente'
  | 'dar_alta_medica'
  | 'ver_documentos_paciente'
  | 'generar_ordenes_medicas'
  | 'descargar_imprimir_inicio'
  | 'imprimir_evolucion'
  | 'imprimir_historia_clinica'
  | 'imprimir_ordenes_medicas'
  | 'altas_buscar_reingresar'
  | 'tareas_guardia'
  | 'ver_estadisticas'
  | 'rol_guardias'
  | 'sonido_y_temas';

export type TutorialModalState =
  | 'none'
  | 'evolution'
  | 'evolution_print'
  | 'discharge'
  | 'resumen_egreso'
  | 'profile'
  | 'ordenes'
  | 'ordenes_builder'
  | 'altas_profile'
  | 'altas_reingreso';

export interface TutorialStepAction {
  label: string;
  targetStepId: string;
  variant?: 'primary' | 'secondary';
}

export interface TutorialStep {
  id: string;
  tourId: TutorialTourId;
  sectionLabel: string;
  title: string;
  message: string;
  targetSelector: string;
  /** Which main app tab must be active for this step */
  requiredAppTab?: 'inicio' | 'ward' | 'guardias' | 'altas' | 'tareas' | 'estadisticas';
  /** Whether HistoriaClinicaForm modal must be open */
  requiresHistoriaOpen?: boolean;
  /** Which HistoriaClinicaForm editor page (1-8) must be active */
  historiaPage?: number;
  /** Which HistoriaClinicaForm tab ('editor' | 'preview') must be active */
  historiaTab?: 'editor' | 'preview';
  /** Optional quick-fill panel field key to open automatically during Page 4 or Page 5 tutorial steps */
  openQuickFillField?: string;
  /** Optional interactive sub-panel state inside the Evolution modal during tutorial playback */
  evolutionUiState?: {
    editDxTx?: boolean;
    withO2?: boolean;
    withBalance?: boolean;
    editingExamField?: string | null;
  };
  /** Whether the Hospitalize modal inside HistoriaClinicaForm must be open */
  requiresHospitalizeModal?: boolean;
  /** Which interactive clinical modal/window should be open on the fictional patient */
  requiredModal?: TutorialModalState;
  /** Automatically expand the first admitted patient card on Inicio so action buttons are visible */
  expandFirstPatient?: boolean;
  /** Automatically open the Descargar panel on Inicio */
  openBulkDownloadMenu?: boolean;
  /** Automatically open the mobile brand icon quick menu on small viewports */
  openMobileBrandMenu?: boolean;
  /** If true, clicking the highlighted element itself advances the tour automatically */
  advanceOnTargetClick?: boolean;
  /** Optional branching decision buttons (e.g., "¿Tiene laboratorios?") */
  decisionActions?: TutorialStepAction[];
  /** Optional custom next step ID override */
  nextStepId?: string;
  /** Optional custom label for the primary Next button */
  nextLabel?: string;
  /** Preferred placement relative to target */
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left';
}

export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface CoachmarkCoords {
  top: number;
  left: number;
  placement: 'bottom' | 'top' | 'center';
  arrowLeftPx: number;
}

/**
 * Pure geometry helper: computes clamped viewport coordinates for the floating
 * tutorial message card so it never clips off-screen or covers the highlighted target.
 */
export function computeCoachmarkPosition(params: {
  targetRect: RectLike | null;
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left';
  margin?: number;
}): CoachmarkCoords {
  const {
    targetRect,
    cardWidth,
    cardHeight,
    viewportWidth,
    viewportHeight,
    preferredPlacement = 'bottom',
    margin = 14,
  } = params;

  const safeW = Math.min(cardWidth, Math.max(260, viewportWidth - margin * 2));
  const safeH = Math.min(cardHeight, Math.max(140, viewportHeight - margin * 2));

  if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
    return {
      top: Math.max(margin, Math.round((viewportHeight - safeH) / 2)),
      left: Math.max(margin, Math.round((viewportWidth - safeW) / 2)),
      placement: 'center',
      arrowLeftPx: Math.round(safeW / 2),
    };
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const clampedLeft = Math.max(
    margin,
    Math.min(viewportWidth - safeW - margin, Math.round(targetCenterX - safeW / 2))
  );
  const arrowLeftPx = Math.max(24, Math.min(safeW - 24, Math.round(targetCenterX - clampedLeft)));

  const spaceBelow = viewportHeight - targetRect.bottom - margin;
  const spaceAbove = targetRect.top - margin;

  const gap = 14;

  const tryBottom = () => ({
    top: Math.min(viewportHeight - safeH - margin, Math.round(targetRect.bottom + gap)),
    left: clampedLeft,
    placement: 'bottom' as const,
    arrowLeftPx,
  });

  const tryTop = () => ({
    top: Math.max(margin, Math.round(targetRect.top - safeH - gap)),
    left: clampedLeft,
    placement: 'top' as const,
    arrowLeftPx,
  });

  if (preferredPlacement === 'top') {
    if (spaceAbove >= safeH + gap) return tryTop();
    if (spaceBelow >= safeH + gap) return tryBottom();
  } else {
    if (spaceBelow >= safeH + gap) return tryBottom();
    if (spaceAbove >= safeH + gap) return tryTop();
  }

  // Fallback when target fills most of the viewport: dock cleanly at bottom or top
  if (spaceBelow >= spaceAbove) {
    return {
      top: Math.max(margin, viewportHeight - safeH - margin),
      left: clampedLeft,
      placement: 'bottom',
      arrowLeftPx,
    };
  }

  return {
    top: margin,
    left: clampedLeft,
    placement: 'top',
    arrowLeftPx,
  };
}

export const HISTORIA_CLINICA_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'hc-01-inicio-btn',
    tourId: 'historia_clinica',
    sectionLabel: '🏥 Inicio · Práctica Ficticia',
    title: '📋 Abrir Historia Clínica',
    message: '👆 Toca aquí para abrir "Desarrollar historia clínica". 🧪 Practicarás con un paciente ficticio de ejemplo cuyos datos NO se guardarán en la base de datos.',
    targetSelector: '[data-tutorial="btn-desarrollar-historia"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: false,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir y continuar',
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-02-p1-intro',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '👶 Datos del Paciente',
    message: '📝 Acá pondrás los datos de filiación del paciente pediátrico. Te guiaremos campo por campo por las 8 páginas oficiales usando nuestro caso ficticio de práctica.',
    targetSelector: '[data-tutorial="p1-header"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-02b-acceso-rapido-dropdown',
    tourId: 'historia_clinica',
    sectionLabel: '🧭 Navegación Rápida · Barra Desplegable',
    title: '📋 Barra Desplegable de Acceso Rápido',
    message: '🧭 En lugar de muchos botones sueltos, usa esta barra desplegable para ver la lista organizada de todos los acápites (Págs. 1 a 8), buscar por nombre (ej. "tórax", "vacunas", "graffar") y saltar directo al acápite deseado.',
    targetSelector: '[data-tutorial="hc-quick-jump-dropdown"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-03-p1-sexo',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '👦👧 Sexo del Paciente',
    message: '✨ Selecciona el sexo del paciente (Niño o Niña). Esto adapta automáticamente los textos normales del Examen Funcional y del Examen Físico.',
    targetSelector: '[data-tutorial="p1-sexo"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-04-p1-apellidos',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '✍️ Apellidos del Paciente',
    message: '🔤 Escribe los apellidos completos del paciente en este campo (en la práctica ya cargamos datos ficticios para que pruebes libremente).',
    targetSelector: '[data-tutorial="p1-apellidos"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-05-p1-nombres',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🪪 Nombres del Paciente',
    message: '👤 Coloca los nombres completos del paciente tal como aparecen en su identificación o partida de nacimiento.',
    targetSelector: '[data-tutorial="p1-nombres"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-06-p1-num-historia',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🔢 N° de Historia Clínica',
    message: '🗂️ Escribe el número oficial de Historia Clínica asignado por admisión al paciente.',
    targetSelector: '[data-tutorial="p1-num-historia"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-07-p1-nacimiento-edad',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🎂 Nacimiento y Edad Automática',
    message: '📅 Coloca el Lugar y la Fecha de Nacimiento. ⚡ La edad exacta y el grupo etario pediátrico se calculan automáticamente.',
    targetSelector: '[data-tutorial="p1-nacimiento-edad"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-08-p1-ci-ingreso',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🕒 Cédula, Fecha y Hora de Ingreso',
    message: '🆔 Ingresa la Cédula / C.I. (si aplica) y verifica la Fecha y Hora exactas de Ingreso al servicio.',
    targetSelector: '[data-tutorial="p1-ci-ingreso"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-09-p1-direccion-telefono',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '📍 Dirección y Teléfono',
    message: '🏠 Completa la Dirección Habitacional y el 📱 Teléfono de Contacto del representante legal.',
    targetSelector: '[data-tutorial="p1-direccion-telefono"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-10-p1-emergencia',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🚨 Contacto de Emergencia',
    message: '👨‍👩‍👧 Coloca a quién avisar en caso de emergencia y su parentesco. 🔗 Este dato se sincroniza automáticamente con la Página 2.',
    targetSelector: '[data-tutorial="p1-emergencia"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-11-p1-motivos',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🩺 Motivo(s) de Admisión',
    message: '📌 Escribe de forma breve y clara el motivo o síntomas principales por los que ingresa el paciente.',
    targetSelector: '[data-tutorial="p1-motivos"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-12-p1-enfermedad-actual',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '📖 Enfermedad Actual',
    message: '✍️ Redacta la Enfermedad Actual ("Se trata de...") detallando inicio, síntomas y evolución cronológica del cuadro clínico.',
    targetSelector: '[data-tutorial="p1-enfermedad-actual"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'top',
  },
  {
    id: 'hc-13-p1-diagnosticos',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Filiación y Admisión',
    title: '🧬 Diagnóstico de Admisión',
    message: '🏷️ Agrega los diagnósticos de ingreso numerados (principal 1. y sub-diagnósticos 1.1 si corresponde).',
    targetSelector: '[data-tutorial="p1-diagnosticos"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'top',
  },
  {
    id: 'hc-14-p1-firmas',
    tourId: 'historia_clinica',
    sectionLabel: '📄 Parte I · Gestión de Firmas',
    title: '✒️ Gestión de Firmas Médicas Oficiales',
    message: '👨‍⚕️ 1) Escribe el nombre en "Firma del Médico de Admisión". 2) La "Firma del Médico del Servicio" se mantiene fija automáticamente con "Jospeth Perez" en toda Historia Clínica Pediátrica. 3) Cuando luego generes Órdenes Médicas para este paciente, sus firmas oficiales serán: Médico Residente, Enfermera y Residente superior o adjunto de guardia. ➡️ Continuamos a la Página 2.',
    targetSelector: '[data-tutorial="p1-firmas"]',
    requiresHistoriaOpen: true,
    historiaPage: 1,
    preferredPlacement: 'top',
  },

  // PÁGINA 2: REGLAMENTO DE HOSPITALIZACIÓN
  {
    id: 'hc-15-p2-nombre',
    tourId: 'historia_clinica',
    sectionLabel: '📜 Página 2 · Reglamento de Hospitalización',
    title: '✍️ Nombre / Firma Responsable',
    message: '🤝 En la Aceptación del Reglamento de Hospitalización, coloca el Nombre y Firma del representante responsable.',
    targetSelector: '[data-tutorial="p2-reglamento-nombre"]',
    requiresHistoriaOpen: true,
    historiaPage: 2,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-16-p2-ci',
    tourId: 'historia_clinica',
    sectionLabel: '📜 Página 2 · Reglamento de Hospitalización',
    title: '🪪 Cédula de Identidad',
    message: '🔢 Ingresa la Cédula de Identidad del representante que firma la aceptación.',
    targetSelector: '[data-tutorial="p2-reglamento-ci"]',
    requiresHistoriaOpen: true,
    historiaPage: 2,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-17-p2-parentesco',
    tourId: 'historia_clinica',
    sectionLabel: '📜 Página 2 · Reglamento de Hospitalización',
    title: '👪 Parentesco del Responsable',
    message: '💛 Indica el Parentesco del responsable (ej. Madre, Padre, Abuela). ➡️ Luego pasaremos a la Página 3.',
    targetSelector: '[data-tutorial="p2-reglamento-parentesco"]',
    requiresHistoriaOpen: true,
    historiaPage: 2,
    preferredPlacement: 'bottom',
  },

  // PÁGINA 3: INTERROGATORIO PEDIÁTRICO DESGLOSADO (8 ACÁPITES OFICIALES)
  {
    id: 'hc-18-p3-1-prenatal',
    tourId: 'historia_clinica',
    sectionLabel: '🤰 Página 3 · Interrogatorio (1/8)',
    title: '🤰 1. Antecedentes Prenatales y Obstétricos',
    message: '📋 Completa los datos del embarazo, número de controles prenatales y si hubo complicaciones obstétricas.',
    targetSelector: '#sec-interrogatorio-1-prenatal',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-19-p3-2-neonatal',
    tourId: 'historia_clinica',
    sectionLabel: '👶 Página 3 · Interrogatorio (2/8)',
    title: '👶 2. Período Neonatal',
    message: '⚖️ Registra el tipo de parto, peso y talla al nacer, llanto/respiración espontánea y evolución neonatal.',
    targetSelector: '#sec-interrogatorio-2-neonatal',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-20-p3-3-alimentacion',
    tourId: 'historia_clinica',
    sectionLabel: '🍼 Página 3 · Interrogatorio (3/8)',
    title: '🍼 3. Alimentación',
    message: '🥣 Anota la lactancia materna, fórmulas, ablactación y dieta actual del paciente.',
    targetSelector: '#sec-interrogatorio-3-alimentacion',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-21-p3-4-desarrollo',
    tourId: 'historia_clinica',
    sectionLabel: '🧸 Página 3 · Interrogatorio (4/8)',
    title: '🧸 4. Desarrollo Psicomotor',
    message: '🌟 Indica los hitos del desarrollo psicomotor (sostén cefálico, sedestación, marcha, lenguaje) acordes a la edad.',
    targetSelector: '#sec-interrogatorio-4-desarrollo',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-22-p3-5-habitos',
    tourId: 'historia_clinica',
    sectionLabel: '😴 Página 3 · Interrogatorio (5/8)',
    title: '😴 5. Hábitos Psicobiológicos',
    message: '🕒 Registra patrón de sueño, evacuaciones, micciones y hábitos diarios del niño.',
    targetSelector: '#sec-interrogatorio-5-habitos',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-23-p3-6-inmunizaciones',
    tourId: 'historia_clinica',
    sectionLabel: '💉 Página 3 · Interrogatorio (6/8)',
    title: '💉 6. Inmunizaciones y Pruebas',
    message: '✅ Marca las dosis del esquema de vacunación que el paciente tiene cumplidas según su tarjeta.',
    targetSelector: '#sec-interrogatorio-6-inmunizaciones',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-24-p3-7-personales',
    tourId: 'historia_clinica',
    sectionLabel: '🩹 Página 3 · Interrogatorio (7/8)',
    title: '🩹 7. Ant. Patológicos Personales',
    message: '⚠️ Anota enfermedades previas, alergias a medicamentos, cirugías u hospitalizaciones anteriores.',
    targetSelector: '#sec-interrogatorio-7-personales',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-25-p3-8-familiares',
    tourId: 'historia_clinica',
    sectionLabel: '👨‍👩‍👧‍👦 Página 3 · Interrogatorio (8/8)',
    title: '👨‍👩‍👧‍👦 8. Historia Familiar',
    message: '🧬 Completa los antecedentes de madre, padre, hermanos y abuelos. ➡️ Luego pasaremos al Examen Funcional.',
    targetSelector: '#sec-interrogatorio-8-familiares',
    requiresHistoriaOpen: true,
    historiaPage: 3,
    preferredPlacement: 'top',
  },

  // PÁGINA 4: EXAMEN FUNCIONAL (14 SISTEMAS)
  {
    id: 'hc-26-p4-seleccionar-aparato',
    tourId: 'historia_clinica',
    sectionLabel: '🔎 Página 4 · Examen Funcional (Paso 1/3)',
    title: '🧭 Paso 1: Elegir el Aparato en la Barra Desplegable',
    message: '📋 Los 14 sistemas ya vienen prellenados como normales según la edad y el sexo del paciente. Despliega esta barra de acceso rápido (o la barra general superior) para buscar y saltar directamente al sistema afectado.',
    targetSelector: '[data-tutorial="p4-sistemas-nav"]',
    requiresHistoriaOpen: true,
    historiaPage: 4,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-27-p4-desbloquear-madre',
    tourId: 'historia_clinica',
    sectionLabel: '🔎 Página 4 · Examen Funcional (Paso 2/3)',
    title: '🔓 Paso 2: Desbloquear y Bloquear Sin Perder Texto',
    message: '✍️ 1) Toca "Desbloquear" para cambiar automáticamente "Madre niega:" por "Madre refiere:" y escribir síntomas a mano. 2) Al terminar, toca "Bloquear" para proteger el cuadro contra cambios accidentales SIN borrar ni reiniciar lo que escribiste.',
    targetSelector: '[data-tutorial="p4-lock-btn-first"]',
    requiresHistoriaOpen: true,
    historiaPage: 4,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-27b-p4-restaurar-rapido',
    tourId: 'historia_clinica',
    sectionLabel: '🔎 Página 4 · Examen Funcional (Paso 3/3)',
    title: '⚡ Paso 3: Botón "Llenado rápido" y "Restaurar normal"',
    message: '✨ 1) Toca "Llenado rápido" en el sistema (o arriba para los 14) y selecciona botones de síntomas patológicos para redactar el hallazgo al instante. 2) Si necesitas volver al texto normal oficial, usa "Restaurar normal" en esa tarjeta o "Restaurar lo normal" arriba.',
    targetSelector: '[data-tutorial="p4-quickfill-btn-first"]',
    requiresHistoriaOpen: true,
    historiaPage: 4,
    preferredPlacement: 'bottom',
  },

  // PÁGINA 5: EXAMEN FÍSICO COMPLETO (ÍTEMS 1 AL 17)
  {
    id: 'hc-28-p5-signos-vitales',
    tourId: 'historia_clinica',
    sectionLabel: '🩺 Página 5 · Examen Físico (Paso 1/5)',
    title: '❤️ Paso 1: Signos Vitales de Ingreso',
    message: '🌡️ Registra los signos vitales medidos al ingreso: Temperatura (°C), FR, FC, TA y Saturación de O₂ (tanto sin O₂ como con O₂ suplementario si aplica).',
    targetSelector: '[data-tutorial="p5-signos-vitales"]',
    requiresHistoriaOpen: true,
    historiaPage: 5,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-29-p5-peso-talla',
    tourId: 'historia_clinica',
    sectionLabel: '🩺 Página 5 · Examen Físico (Paso 2/5)',
    title: '📏 Paso 2: Antropometría & Percentiles OMS',
    message: '⚖️ Escribe Peso (kg), Talla (cm) y circunferencias (CC, CA, CT). ⚡ Los percentiles pediátricos OMS (Peso/Edad, Talla/Edad y Peso/Talla) se calculan automáticamente.',
    targetSelector: '[data-tutorial="p5-antropometria-peso-talla"]',
    requiresHistoriaOpen: true,
    historiaPage: 5,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-30-p5-fisico-desbloquear',
    tourId: 'historia_clinica',
    sectionLabel: '🩺 Página 5 · Examen Físico (Paso 3/5)',
    title: '🔓 Paso 3: Desbloquear y Bloquear cada Acápite',
    message: '🩺 En cualquiera de los 17 acápites toca "Desbloquear" para habilitar la escritura libre. 🔒 Al pulsar "Bloquear" de nuevo, tu hallazgo patológico queda protegido en solo lectura SIN borrarse ni volver a normal.',
    targetSelector: '[data-tutorial="p5-fisico-lock-first"]',
    requiresHistoriaOpen: true,
    historiaPage: 5,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-30b-p5-rapido-torax',
    tourId: 'historia_clinica',
    sectionLabel: '🩺 Página 5 · Examen Físico (Paso 4/5)',
    title: '⚡ Paso 4: Llenado Rápido Semiológico (Ej. Tórax)',
    message: '✨ Toca "Llenado rápido" en cualquier acápite (aquí abrimos 10. Tórax y Pulmones en vivo): 1) Elige botones por fase semiológica — Inspección (tipo de tórax, expansibilidad, tiraje, retracción xifoidea), Palpación, Percusión y Auscultación (murmullo vesicular, sibilantes, roncus, crepitantes, subcrepitantes, bulosos, roce pleural). 2) El texto patológico se inserta solo y puedes complementarlo o bloquearlo.',
    targetSelector: '[data-tutorial="p5-torax-card"]',
    requiresHistoriaOpen: true,
    historiaPage: 5,
    openQuickFillField: 'toraxPulmonesFisico',
    preferredPlacement: 'top',
  },
  {
    id: 'hc-30c-p5-restaurar-normal',
    tourId: 'historia_clinica',
    sectionLabel: '🩺 Página 5 · Examen Físico (Paso 5/5)',
    title: '🔄 Paso 5: Botón "Restaurar normal"',
    message: '♻️ Si te equivocaste o un sistema resulta sin alteraciones, toca "Restaurar normal" en esa tarjeta (o "Restaurar lo normal" arriba para los 17 acápites) para recuperar el texto normal oficial. ➡️ Ahora pasamos a GRAFFAR.',
    targetSelector: '[data-tutorial="p5-fisico-restore-first"]',
    requiresHistoriaOpen: true,
    historiaPage: 5,
    preferredPlacement: 'bottom',
  },

  // PÁGINA 6: EVALUACIÓN SOCIOECONÓMICA GRAFFAR
  {
    id: 'hc-31-p6-graffar-a',
    tourId: 'historia_clinica',
    sectionLabel: '🏘️ Página 6 · GRAFFAR (Sección A)',
    title: '💼 A) Profesión del Jefe de Familia',
    message: '👆 Toca la opción que corresponda a la profesión u oficio del jefe de la familia.',
    targetSelector: '[data-tutorial="p6-graffar-a"]',
    requiresHistoriaOpen: true,
    historiaPage: 6,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-32-p6-graffar-b',
    tourId: 'historia_clinica',
    sectionLabel: '🏘️ Página 6 · GRAFFAR (Sección B)',
    title: '🎓 B) Nivel de Instrucción de la Madre',
    message: '📚 Toca la opción correspondiente al nivel educativo alcanzado por la madre.',
    targetSelector: '[data-tutorial="p6-graffar-b"]',
    requiresHistoriaOpen: true,
    historiaPage: 6,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-33-p6-graffar-c',
    tourId: 'historia_clinica',
    sectionLabel: '🏘️ Página 6 · GRAFFAR (Sección C)',
    title: '💵 C) Fuente de Ingreso',
    message: '💰 Toca la opción que describe la principal fuente de ingreso del hogar.',
    targetSelector: '[data-tutorial="p6-graffar-c"]',
    requiresHistoriaOpen: true,
    historiaPage: 6,
    preferredPlacement: 'top',
  },
  {
    id: 'hc-34-p6-graffar-d',
    tourId: 'historia_clinica',
    sectionLabel: '🏘️ Página 6 · GRAFFAR (Sección D)',
    title: '🏠 D) Condiciones de Alojamiento',
    message: '🧮 Toca la condición de vivienda. El puntaje total y el Estrato Social GRAFFAR (I a V) se calculan automáticamente y su cuadro impreso está ajustado para caber completo en su hoja.',
    targetSelector: '[data-tutorial="p6-graffar-d"]',
    requiresHistoriaOpen: true,
    historiaPage: 6,
    preferredPlacement: 'top',
  },

  // PÁGINA 7: LABORATORIOS Y PARACLÍNICOS (DECISIÓN INTERACTIVA)
  {
    id: 'hc-35-p7-pregunta-labs',
    tourId: 'historia_clinica',
    sectionLabel: '🧪 Página 7 · Laboratorios y Paraclínicos',
    title: '🔬 ¿El paciente tiene laboratorios?',
    message: '🧫 ¿Tienes resultados de laboratorios para registrar en esta historia? Si no tiene, salta directo al Resumen de Ingreso.',
    targetSelector: '[data-tutorial="p7-labs-header"]',
    requiresHistoriaOpen: true,
    historiaPage: 7,
    preferredPlacement: 'bottom',
    decisionActions: [
      {
        label: '🧪 Sí, registrar laboratorios',
        targetStepId: 'hc-36-p7-llenar-labs',
        variant: 'secondary',
      },
      {
        label: '⏭️ No tiene → Ir al Resumen',
        targetStepId: 'hc-37-p8-resumen-auto',
        variant: 'primary',
      },
    ],
  },
  {
    id: 'hc-36-p7-llenar-labs',
    tourId: 'historia_clinica',
    sectionLabel: '🧪 Página 7 · Laboratorios y Paraclínicos',
    title: '📊 Registrar Muestras de Laboratorio',
    message: '🧪 Selecciona la Muestra (o la Hoja Oficial completa) y anota los valores disponibles. Al terminar pulsa Siguiente para pasar al Resumen.',
    targetSelector: '[data-tutorial="p7-labs-samples"]',
    requiresHistoriaOpen: true,
    historiaPage: 7,
    nextStepId: 'hc-37-p8-resumen-auto',
    preferredPlacement: 'bottom',
  },

  // PÁGINA 8: RESUMEN DE INGRESO (AUTO-LLENADO EXCEPTO COMENTARIO)
  {
    id: 'hc-37-p8-resumen-auto',
    tourId: 'historia_clinica',
    sectionLabel: '📑 Página 8 · Resumen de Ingreso',
    title: '✨ Datos Llenados Automáticamente',
    message: '🤖 Todos los datos del Resumen de Ingreso se rellenan automáticamente (con la Fecha arriba junto a Servicio: PEDIATRÍA), excepto el campo Comentario que es manual.',
    targetSelector: '[data-tutorial="p8-resumen-header"]',
    requiresHistoriaOpen: true,
    historiaPage: 8,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-38-p8-comentario',
    tourId: 'historia_clinica',
    sectionLabel: '📑 Página 8 · Resumen de Ingreso',
    title: '💬 Comentario Manual',
    message: '✍️ Llena manualmente este campo con las observaciones finales de ingreso (o déjalo en blanco si lo completarás en papel).',
    targetSelector: '[data-tutorial="p8-comentario"]',
    requiresHistoriaOpen: true,
    historiaPage: 8,
    preferredPlacement: 'top',
  },
  {
    id: 'hc-38b-p8-vista-previa',
    tourId: 'historia_clinica',
    sectionLabel: '🖨️ Revisión, Firmas e Impresión · 8 Páginas',
    title: '👁️ Vista Previa, Firmas y PDF Automático',
    message: '🖨️ Toca "Vista Previa" para revisar las 8 páginas antes de imprimir o guardar PDF: verás la firma fija de "Jospeth Perez" en Pág. 1, GRAFFAR compacto en 1 hoja y la Fecha junto a Servicio en Resumen de Ingreso. El PDF se nombra automáticamente con los datos del paciente, fecha y hora (sin links).',
    targetSelector: '[data-tutorial="hc-tab-preview"]',
    requiresHistoriaOpen: true,
    historiaPage: 8,
    preferredPlacement: 'bottom',
  },

  // FINAL: INGRESAR PX -> SELECCIONAR ÁREA -> GUARDAR
  {
    id: 'hc-39-btn-ingresar-px',
    tourId: 'historia_clinica',
    sectionLabel: '🏥 Paso Final · Ingreso a Hospitalización',
    title: '🚀 Tocar Ingresar Px',
    message: '👆 Al terminar las 8 páginas, toca el botón "Ingresar Px" arriba para asignar el área hospitalaria y cama del paciente.',
    targetSelector: '[data-tutorial="btn-ingresar-px"]',
    requiresHistoriaOpen: true,
    historiaPage: 8,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Ingresar Px',
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-40-modal-area',
    tourId: 'historia_clinica',
    sectionLabel: '🛏️ Paso Final · Asignación de Área',
    title: '🏥 Seleccionar Área y Cama',
    message: '📍 Elige el Área hospitalaria (Traumashock, Observación, Respiratorio, Aislamiento u Hospitalización) y asigna el número de cama.',
    targetSelector: '[data-tutorial="modal-asignar-area"]',
    requiresHistoriaOpen: true,
    requiresHospitalizeModal: true,
    preferredPlacement: 'bottom',
  },
  {
    id: 'hc-41-modal-guardar',
    tourId: 'historia_clinica',
    sectionLabel: '🎉 Paso Final · Guardar e Indicaciones',
    title: '✅ Guardar Ingreso y Pasar a Órdenes Médicas',
    message: '💾 En un paciente real tocarías "Guardar & Asignar Cama". Luego, desde su tarjeta en Inicio, abre "Órdenes" para emitir sus Órdenes Médicas con cálculo por peso y las 3 firmas institucionales (Médico Residente, Enfermera y Residente superior o adjunto de guardia). 🧪 En esta práctica nada se guarda en la BD.',
    targetSelector: '[data-tutorial="modal-btn-guardar-cama"]',
    requiresHistoriaOpen: true,
    requiresHospitalizeModal: true,
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'top',
  },
];

export const TABLERO_CAMAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'tb-01-inicio',
    tourId: 'tablero_camas',
    sectionLabel: '🏥 Inicio · Panel Principal',
    title: '📋 Desarrollar Historia Clínica',
    message: '🚀 Desde este botón principal inicias una nueva Historia Clínica Pediátrica de 8 páginas o continúas un borrador guardado.',
    targetSelector: '[data-tutorial="btn-desarrollar-historia"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: false,
    preferredPlacement: 'bottom',
  },
  {
    id: 'tb-02-sugerencias',
    tourId: 'tablero_camas',
    sectionLabel: '💡 Inicio · Feedback',
    title: '📬 Buzón de Sugerencias',
    message: '💬 Aquí puedes enviar ideas, reportes o mejoras directamente al equipo del sistema.',
    targetSelector: '[data-tutorial="btn-sugerencias"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: false,
    preferredPlacement: 'bottom',
  },
  {
    id: 'tb-03-tema',
    tourId: 'tablero_camas',
    sectionLabel: '🎨 Barra Superior · Apariencia',
    title: '🌙 Modo Claro, Nocturno y Automático',
    message: '☀️🌙 Toca este botón para alternar entre Modo Claro, Modo Nocturno (ideal para guardias de noche) o Modo Automático.',
    targetSelector: '[data-tutorial="btn-theme-mode"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: false,
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'evo-01-paciente',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🧪 Inicio · Paciente Ficticio',
    title: '👶 Paso 1: Seleccionar Paciente de Práctica',
    message: '🏥 Usaremos al paciente ficticio "Mateo Alejandro Pérez Demo (Tutorial)". Al tocar su tarjeta en Inicio se despliegan todas sus acciones clínicas.',
    targetSelector: '[data-tutorial="patient-btn-evolucionar"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    preferredPlacement: 'top',
  },
  {
    id: 'evo-02-btn',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Inicio · Evolución Diaria',
    title: '👆 Paso 2: Tocar el botón "Evolucionar"',
    message: '🩺 Toca ahora el botón "Evolucionar" (o pulsa "Abrir Evolución") para abrir la ventana completa de Evolución Médica y recorrer paso a paso cada sección.',
    targetSelector: '[data-tutorial="patient-btn-evolucionar"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Evolución Médica',
    preferredPlacement: 'top',
  },
  {
    id: 'evo-03-medico',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Paso 3',
    title: '👨‍⚕️ Médico que Evoluciona',
    message: '🪪 Verifica o escribe el nombre del médico responsable que realiza la evolución diaria del paciente.',
    targetSelector: '[data-tutorial="evo-doctor-field"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    preferredPlacement: 'bottom',
  },
  {
    id: 'evo-04-subjetivo-objetivo',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Paso 4',
    title: '📝 Subjetivo y Objetivo',
    message: '💬 En SUBJETIVO anota lo referido por el familiar en 24h (fiebre, apetito, síntomas) y en OBJETIVO el estado clínico general observado al evaluar al niño.',
    targetSelector: '[data-tutorial="evo-subjetivo-objetivo"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    preferredPlacement: 'bottom',
  },
  {
    id: 'evo-05-dx-tx',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Diagnósticos y Tratamiento',
    title: '✏️ Paso 5: Tocar "Modificar Diagnósticos y Tratamiento"',
    message: '👆 En vista previa ves los diagnósticos y medicamentos actuales. Toca el botón "✏️ Modificar Diagnósticos y Tratamiento" (o pulsa Siguiente) para abrir el editor completo de ambos bloques.',
    targetSelector: '[data-tutorial="evo-btn-modificar-dx-tx"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: false, withO2: false, withBalance: false, editingExamField: null },
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Editor Dx y Tto',
    preferredPlacement: 'bottom',
  },
  {
    id: 'evo-05b-dx-orden-subdx',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Editor · Diagnósticos, Sub-Dx y Orden',
    title: '🔀 Paso 6: Sub-Diagnósticos y Cambio de Orden',
    message: '📋 Dentro del editor de Diagnósticos puedes: 1) Cambiar el orden tocando el selector numérico a la izquierda (1., 2., …) — mueve automáticamente el diagnóstico principal junto con todos sus sub-diagnósticos. 2) Tocar "+ Sub" para agregar Sub-Dx (1.1) o Sub-Sub-Dx (1.1.1). 3) Usar "+ Diagnóstico Principal", autocompletado al escribir, "Recargar" o eliminar con la papelera.',
    targetSelector: '[data-tutorial="evo-dx-editor"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: true },
    preferredPlacement: 'bottom',
  },
  {
    id: 'evo-05c-tx-detalle',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Editor · Tratamiento Completo',
    title: '💊 Paso 7: Dosis, Días, No Cumplido, Culminado y Readministrar',
    message: '💉 En Tratamiento puedes: 1) Escribir el medicamento (con autocompletado) y configurar Dosis + unidad (mg, ui, gr, mcg, mEq o gotas sin /kg/), base (/día o /dosis) e intervalo (c/4h, c/6h, c/8h, c/12h, c/24h). 2) Ajustar la Fecha de Inicio para contar los días cumplidos automáticamente. 3) Marcar "(no cumplido)" y anotar la causa si faltó ese día. 4) Pulsar "Tratamiento culminado" para moverlo al final con fechas y días cumplidos, o "Readministrar" para continuar sumando días previos sin contar la pausa. 5) Usar "+ Tratamiento" (si queda vacío mostrará "Sintomático"). Al terminar toca "✓ Listo / Cerrar Editor".',
    targetSelector: '[data-tutorial="evo-tx-editor"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: true },
    preferredPlacement: 'top',
  },
  {
    id: 'evo-06-signos',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Signos Vitales',
    title: '❤️ Paso 8: Signos Vitales Pediátricos',
    message: '🌡️ Registra Temperatura, FC, FR, TA, SO₂ y Peso (solo números; las unidades están fijas). ✨ La barra superior muestra los rangos normales exactos para la edad del paciente y guarda los valores para la siguiente evolución.',
    targetSelector: '[data-tutorial="evo-signos-vitales"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: false, withO2: false, withBalance: false },
    preferredPlacement: 'bottom',
  },
  {
    id: 'evo-07-o2-parametros',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Apoyo Ventilatorio',
    title: '💨 Paso 9: Parámetros del Apoyo Ventilatorio (Con O₂)',
    message: '🌬️ Si el paciente recibe oxígeno, toca "Con O₂" y se despliegan los 5 Parámetros del Apoyo Ventilatorio: 1) Modalidad/Dispositivo (Cánula nasal, Mascarilla simple o con reservorio, Venturi, CPAP, CNAF o Ventilación mecánica). 2) Flujo en L/min. 3) Humedad (Seco o Húmedo). 4) FiO₂ (%). 5) SO₂ con O₂ (%). Si respira aire ambiente déjalo en "Sin O₂".',
    targetSelector: '[data-tutorial="evo-o2-params"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: false, withO2: true, withBalance: false },
    preferredPlacement: 'top',
  },
  {
    id: 'evo-07b-balance-24h',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Balance Hídrico 24h',
    title: '💧 Paso 10: Balance Hídrico (24 Horas)',
    message: '⚖️ Toca "Requiere BH" cuando el paciente amerite control hídrico: 1) Escribe Líquidos Ingeridos (cc/24h) y Líquidos Excretados (cc/24h). 2) Con el peso del paciente se calcula al instante el Balance Neto (cc), el Flujo Urinario (cc/kg/h) con su interpretación clínica (Euurico, Oliguria, Oliguria Severa o Poliuria), la Superficie Corporal (m²) y el Balance por SC (cc/m²/día).',
    targetSelector: '[data-tutorial="evo-balance-panel"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: false, withO2: false, withBalance: true },
    preferredPlacement: 'top',
  },
  {
    id: 'evo-08-examen',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Examen Físico (1/2)',
    title: '🔍 Paso 11: Seleccionar Sistema a Modificar',
    message: '📋 Todos los sistemas del Examen Físico del Día cargan automáticamente el texto previo para ahorrarte tiempo. Para modificar un hallazgo que cambió hoy (ej. Tórax y Pulmones), toca el botón con ícono de lápiz (Editar) en la esquina de esa tarjeta.',
    targetSelector: '[data-tutorial="evo-examen-edit-btn-torax"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editDxTx: false, withO2: false, withBalance: false, editingExamField: null },
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Edición de Tórax',
    preferredPlacement: 'top',
  },
  {
    id: 'evo-08b-examen-editar',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Examen Físico (2/2)',
    title: '✍️ Paso 12: Editar y Guardar el Examen Físico del Día',
    message: '📝 Al abrir un sistema, la tarjeta se expande a pantalla completa con cuadro autoexpandible para escribir los hallazgos del día cómodamente. Cuando termines, toca "Guardar" arriba o "Listo" abajo para cerrar la edición y conservar tus cambios.',
    targetSelector: '[data-tutorial="evo-examen-card-torax"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editingExamField: 'toraxCP' },
    preferredPlacement: 'top',
  },
  {
    id: 'evo-09-comentarios',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Comentarios y Plan',
    title: '👨‍⚕️ Paso 13: Comentarios y Plan del Especialista',
    message: '⚡ Anota las decisiones del pase de visita o usa los botones rápidos de revista médica con un solo toque.',
    targetSelector: '[data-tutorial="evo-comentarios-plan"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    evolutionUiState: { editingExamField: null },
    preferredPlacement: 'top',
  },
  {
    id: 'evo-10-ordenes',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🩺 Evolución Médica · Órdenes del Día',
    title: '📋 Paso 14: Órdenes Médicas del Día',
    message: '🟡 Desde aquí puedes abrir y actualizar directamente las Órdenes Médicas vinculadas a esta evolución sin perder lo escrito.',
    targetSelector: '[data-tutorial="evo-btn-ordenes"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    preferredPlacement: 'top',
  },
  {
    id: 'evo-11-guardar',
    tourId: 'evolucionar_paciente',
    sectionLabel: '🎉 Evolución Médica · Paso Final',
    title: '✅ Paso 15: Guardar Evolución',
    message: '💾 Por último pulsa "Guardar & Registrar Evolución" para dejar asentada la evolución del día. 🧪 En este tutorial práctico nada se guarda en la base de datos real. ¡Listo!',
    targetSelector: '[data-tutorial="evo-btn-guardar"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'top',
  },
];

export const DAR_ALTA_MEDICA_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'alta-01-btn',
    tourId: 'dar_alta_medica',
    sectionLabel: '🏥 Inicio · Egreso Hospitalario',
    title: '👆 Paso 1: Tocar "Dar de Alta"',
    message: '👶 En la tarjeta de nuestro paciente ficticio "Mateo Alejandro Pérez Demo", toca el botón verde "Dar de Alta" para iniciar el egreso médico.',
    targetSelector: '[data-tutorial="patient-btn-alta"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Dar de Alta',
    preferredPlacement: 'top',
  },
  {
    id: 'alta-02-confirmar',
    tourId: 'dar_alta_medica',
    sectionLabel: '✅ Confirmación de Alta Médica',
    title: '🚀 Paso 2: Confirmar Alta & Egreso',
    message: '✅ Toca "CONFIRMAR ALTA & EGRESO" para egresar al paciente ficticio (solo en práctica, sin afectar la base de datos) y abrir automáticamente su hoja de Resumen de Egreso.',
    targetSelector: '[data-tutorial="discharge-confirm-btn"]',
    requiredAppTab: 'inicio',
    requiredModal: 'discharge',
    advanceOnTargetClick: true,
    nextLabel: 'Confirmar y abrir Resumen',
    preferredPlacement: 'top',
  },
  {
    id: 'alta-03-datos',
    tourId: 'dar_alta_medica',
    sectionLabel: '📄 Resumen de Egreso · Paso 3',
    title: '📋 Datos Generales y Fechas',
    message: '📅 Revisa en la parte superior de la hoja la Fecha de Ingreso, Fecha de Egreso, N° de Historia, Días de Hospitalización, Edad, Sexo y Peso (Ingreso/Egreso). Todos los campos son editables.',
    targetSelector: '[data-tutorial="resumen-egreso-datos"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alta-04-resumen-evolutivo',
    tourId: 'dar_alta_medica',
    sectionLabel: '📄 Resumen de Egreso · Paso 4',
    title: '✍️ Diagnósticos de Ingreso y Resumen Evolutivo',
    message: '📖 Verifica los Diagnósticos de Ingreso y redacta o ajusta el Resumen Evolutivo describiendo el tratamiento recibido y las condiciones clínicas al alta.',
    targetSelector: '[data-tutorial="resumen-egreso-resumen-evolutivo"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alta-05-btn-tto',
    tourId: 'dar_alta_medica',
    sectionLabel: '📄 Resumen de Egreso · Paso 5',
    title: '💊 Botón "Editar tto" (Indicaciones al Alta)',
    message: '📝 Toca "Editar tto" para abrir el editor rápido de indicaciones ambulatorias (SE INDICA): control por consulta externa, medicamentos calculados por peso y signos de alarma.',
    targetSelector: '[data-tutorial="resumen-egreso-btn-tto"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alta-06-btn-lab',
    tourId: 'dar_alta_medica',
    sectionLabel: '📄 Resumen de Egreso · Paso 6',
    title: '🧪 Botón "Lab" (Paraclínicos de Ingreso)',
    message: '🔬 Toca "Lab" para editar cómodamente los resultados de laboratorio de ingreso, cultivos, días de oxígeno y transfusiones.',
    targetSelector: '[data-tutorial="resumen-egreso-btn-lab"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alta-07-btn-dx',
    tourId: 'dar_alta_medica',
    sectionLabel: '📄 Resumen de Egreso · Paso 7',
    title: '🩺 Botón "Dx" (Diagnósticos de Egreso)',
    message: '🏷️ Toca "Dx" para editar los Diagnósticos de Egreso y asignar el estado de cada uno (RESUELTO, EN RESOLUCIÓN, MEJORADO o EN ESTUDIO).',
    targetSelector: '[data-tutorial="resumen-egreso-btn-dx"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alta-08-acciones',
    tourId: 'dar_alta_medica',
    sectionLabel: '🎉 Resumen de Egreso · Paso Final',
    title: '💾 Guardar, Word, PDF e Imprimir',
    message: '🖨️ En la barra superior puedes ajustar el zoom a tu pantalla, Guardar cambios, exportar a Word, descargar en PDF (ícono de descarga) o Imprimir en 1 hoja tamaño Carta. 🧪 Esta práctica no se guarda en la BD.',
    targetSelector: '[data-tutorial="resumen-egreso-acciones"]',
    requiredAppTab: 'inicio',
    requiredModal: 'resumen_egreso',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const VER_DOCUMENTOS_PACIENTE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'docs-01-btn',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Inicio · Expediente Clínico',
    title: '👆 Paso 1: Abrir "Ver Perfil & Archivos"',
    message: '👁️ Toca el botón morado "Ver Perfil & Archivos" de nuestro paciente ficticio para abrir su expediente completo y explorar todo lo que hay adentro.',
    targetSelector: '[data-tutorial="patient-btn-ver-perfil"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Perfil & Archivos',
    preferredPlacement: 'top',
  },
  {
    id: 'docs-02-resumen-7d',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 2',
    title: '📅 Resumen Evolutivo Semanal (7 días)',
    message: '📊 Aquí generas o consultas el Resumen Evolutivo cada 7 días de estancia con ganancia de peso semanal, laboratorios seriados y comentarios diarios.',
    targetSelector: '[data-tutorial="profile-resumen-evolutivo"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'bottom',
  },
  {
    id: 'docs-03-evoluciones',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 3',
    title: '🩺 Histórico de Evoluciones Diarias con Órdenes',
    message: '📖 Cada evolución muestra chips de signos vitales, soporte de oxígeno, balance hídrico, S-O-A-P y sus Órdenes Médicas asociadas en vista previa plegable.',
    targetSelector: '[data-tutorial="profile-evoluciones-list"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'bottom',
  },
  {
    id: 'docs-03b-calendario',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 3.1',
    title: '✨ Ver Calendario de Evoluciones & Órdenes',
    message: '📅 Toca este botón para abrir la nueva pestaña de calendario interactivo de evoluciones y órdenes médicas lado a lado.',
    targetSelector: '[data-tutorial="profile-btn-abrir-calendario"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'bottom',
  },
  {
    id: 'docs-04-adjuntos',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 4',
    title: '📎 Archivos Adjuntos (Labs, Rx, Ecos)',
    message: '🖼️ Aquí aparecen todos los PDF e imágenes subidos al paciente (como nuestro laboratorio ficticio de práctica). Toca "VER" para previsualizarlos al instante.',
    targetSelector: '[data-tutorial="profile-archivos-adjuntos"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'top',
  },
  {
    id: 'docs-05-historia',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 5',
    title: '📋 Historia Clínica de Ingreso (8 Páginas)',
    message: '🖨️ Toca "EDITAR" para modificar cualquier página de la Historia Clínica o "IMPRESIÓN PROFESIONAL" para abrir la vista lista para imprimir las 8 páginas.',
    targetSelector: '[data-tutorial="profile-historia-ingreso"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'top',
  },
  {
    id: 'docs-06-constancia',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 6',
    title: '🏥 Constancia de Hospitalización',
    message: '📄 Genera con un toque la Constancia de Hospitalización Oficial con membrete del Ministerio de Salud y los datos del paciente listos para imprimir.',
    targetSelector: '[data-tutorial="profile-constancia-hosp"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'top',
  },
  {
    id: 'docs-07-nota',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '📂 Expediente · Paso 7',
    title: '📝 Nota de Recibimiento (1 Hoja)',
    message: '📑 Abre la Nota de Recibimiento editable con los signos vitales, diagnósticos y tratamiento actualizados desde la última evolución.',
    targetSelector: '[data-tutorial="profile-nota-recibimiento"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    preferredPlacement: 'top',
  },
  {
    id: 'docs-08-referencia',
    tourId: 'ver_documentos_paciente',
    sectionLabel: '🎉 Expediente · Paso Final',
    title: '✨ Referencia Médica Especializada',
    message: '🚑 Aquí redactas automáticamente una Referencia Médica oficial indicando la especialidad destino y motivo. ¡Ya conoces todo el expediente del paciente!',
    targetSelector: '[data-tutorial="profile-referencia-medica"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'top',
  },
];

export const GENERAR_ORDENES_MEDICAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'ord-01-btn',
    tourId: 'generar_ordenes_medicas',
    sectionLabel: '📋 Inicio · Órdenes Médicas',
    title: '👆 Paso 1: Abrir Órdenes Médicas',
    message: '🟡 Toca el botón "Órdenes" en la tarjeta del paciente ficticio para abrir su hoja oficial de Órdenes Médicas.',
    targetSelector: '[data-tutorial="patient-btn-ordenes"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Órdenes',
    preferredPlacement: 'top',
  },
  {
    id: 'ord-02-hoja',
    tourId: 'generar_ordenes_medicas',
    sectionLabel: '📄 Órdenes Médicas · Paso 2',
    title: '📑 Hoja Oficial Tamaño Carta',
    message: '✍️ Aquí ves la hoja oficial con indicaciones numeradas, columna de dosis/cálculo, fecha, hora, peso y las 3 firmas al pie: Médico Residente, Enfermera y Residente superior o adjunto de guardia.',
    targetSelector: '[data-tutorial="ordenes-hoja-oficial"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes',
    preferredPlacement: 'bottom',
  },
  {
    id: 'ord-03-asistente-btn',
    tourId: 'generar_ordenes_medicas',
    sectionLabel: '✨ Órdenes Médicas · Paso 3',
    title: '🧮 Abrir "Asistente Guiado"',
    message: '👆 Toca "Asistente Guiado" arriba para abrir el generador inteligente de órdenes pediátricas.',
    targetSelector: '[data-tutorial="ordenes-asistente-btn"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes',
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Asistente Guiado',
    preferredPlacement: 'bottom',
  },
  {
    id: 'ord-04-builder',
    tourId: 'generar_ordenes_medicas',
    sectionLabel: '✨ Asistente Guiado · Paso 4',
    title: '⚖️ Cálculo Automático por Peso',
    message: '💉 Dentro del Asistente eliges Área, dieta, posición, oxígeno, hidratación, antibióticos (con cálculo automático Peso × Dosis), nebulizaciones y laboratorios.',
    targetSelector: '[data-tutorial="ordenes-builder-root"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes_builder',
    preferredPlacement: 'bottom',
  },
  {
    id: 'ord-05-acciones',
    tourId: 'generar_ordenes_medicas',
    sectionLabel: '🎉 Órdenes Médicas · Paso Final',
    title: '💾 Guardar e Imprimir Órdenes',
    message: '🖨️ Al volver a la hoja usa "Guardar" e "Imprimir" para obtener tus Órdenes Médicas en tamaño Carta (al guardar como PDF usa automáticamente el nombre del paciente, fecha y hora). 🧪 En modo tutorial nada se guarda en la BD.',
    targetSelector: '[data-tutorial="ordenes-acciones-bar"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const DESCARGAR_IMPRIMIR_INICIO_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'dl-01-btn',
    tourId: 'descargar_imprimir_inicio',
    sectionLabel: '🖨️ Inicio · Impresión en Lote',
    title: '👆 Paso 1: Tocar "Descargar" en Inicio',
    message: '📥 Toca el botón "Descargar" en la barra de Inicio para abrir el menú de impresión masiva de pacientes hospitalizados.',
    targetSelector: '[data-tutorial="inicio-descargar-btn"]',
    requiredAppTab: 'inicio',
    advanceOnTargetClick: true,
    nextLabel: 'Abrir menú Descargar',
    preferredPlacement: 'bottom',
  },
  {
    id: 'dl-02-panel',
    tourId: 'descargar_imprimir_inicio',
    sectionLabel: '🎉 Inicio · Impresión en Lote',
    title: '🗂️ Imprimir Evoluciones, Órdenes y Notas en Lote',
    message: '⚡ Desde este panel puedes imprimir en 1 clic todas las Evoluciones de Hoy, Notas de Recibimiento y Órdenes Médicas, limpias sin enlaces web y con salto automático por paciente.',
    targetSelector: '[data-tutorial="inicio-descargar-panel"]',
    requiredAppTab: 'inicio',
    openBulkDownloadMenu: true,
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const IMPRIMIR_EVOLUCION_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'imp-evo-01-perfil',
    tourId: 'imprimir_evolucion',
    sectionLabel: '🖨️ Imprimir Evolución · Paso 1',
    title: '📂 Abrir "Ver Perfil & Archivos"',
    message: '👆 En la tarjeta del paciente ficticio en Inicio, toca el botón morado "Ver Perfil & Archivos" para acceder a su histórico de evoluciones diarias.',
    targetSelector: '[data-tutorial="patient-btn-ver-perfil"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Perfil & Archivos',
    preferredPlacement: 'top',
  },
  {
    id: 'imp-evo-02-visualizar',
    tourId: 'imprimir_evolucion',
    sectionLabel: '🖨️ Imprimir Evolución · Paso 2',
    title: '👁️ Tocar "Visualizar la evolución"',
    message: '🩺 Ubica la evolución diaria que deseas imprimir y toca "Visualizar la evolución" para abrir el documento oficial tamaño Carta.',
    targetSelector: '[data-tutorial="profile-btn-visualizar-evolucion"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    advanceOnTargetClick: true,
    nextLabel: 'Visualizar Evolución',
    preferredPlacement: 'bottom',
  },
  {
    id: 'imp-evo-03-hoja',
    tourId: 'imprimir_evolucion',
    sectionLabel: '🖨️ Imprimir Evolución · Paso 3',
    title: '📄 Revisar Hoja Oficial Tamaño Carta',
    message: '🔍 Verifica aquí los datos, signos vitales, diagnósticos, tratamiento, examen físico y comentarios antes de imprimir. En móvil puedes usar los controles de zoom arriba.',
    targetSelector: '[data-tutorial="evo-doc-sheet"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution_print',
    preferredPlacement: 'bottom',
  },
  {
    id: 'imp-evo-04-imprimir',
    tourId: 'imprimir_evolucion',
    sectionLabel: '🎉 Imprimir Evolución · Paso Final',
    title: '🖨️ Imprimir en Carta o Descargar PDF',
    message: '✅ Toca "Imprimir en Carta" para imprimir directo (o elegir "Guardar como PDF") o toca "Descargar PDF". Ambos guardan el documento limpio sin links ni fecha del navegador, con el nombre del paciente y fecha/hora.',
    targetSelector: '[data-tutorial="evo-doc-print-actions"]',
    requiredAppTab: 'inicio',
    requiredModal: 'evolution_print',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const IMPRIMIR_HISTORIA_CLINICA_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'imp-hc-01-perfil',
    tourId: 'imprimir_historia_clinica',
    sectionLabel: '🖨️ Imprimir Historia Clínica · Paso 1',
    title: '📂 Abrir "Ver Perfil & Archivos"',
    message: '👆 En la tarjeta del paciente ficticio en Inicio, toca "Ver Perfil & Archivos" para encontrar su Historia Clínica de Ingreso (8 páginas).',
    targetSelector: '[data-tutorial="patient-btn-ver-perfil"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Perfil & Archivos',
    preferredPlacement: 'top',
  },
  {
    id: 'imp-hc-02-btn',
    tourId: 'imprimir_historia_clinica',
    sectionLabel: '🖨️ Imprimir Historia Clínica · Paso 2',
    title: '📋 Tocar "IMPRESIÓN PROFESIONAL"',
    message: '🖨️ Baja hasta Documento de Ingreso y toca "IMPRESIÓN PROFESIONAL" para abrir la Vista Previa oficial de las 8 páginas listas para imprimir.',
    targetSelector: '[data-tutorial="profile-btn-impresion-historia"]',
    requiredAppTab: 'inicio',
    requiredModal: 'profile',
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Impresión Profesional',
    preferredPlacement: 'top',
  },
  {
    id: 'imp-hc-03-paginas',
    tourId: 'imprimir_historia_clinica',
    sectionLabel: '🖨️ Imprimir Historia Clínica · Paso 3',
    title: '📑 Revisar Todas (8) o Filtrar por Página',
    message: '👀 Selecciona "Todas (8)" para imprimir el expediente completo o revisa cada hoja (Filiación con firma fija Jospeth Perez, GRAFFAR compacto en 1 hoja, y Resumen de Ingreso con Fecha junto a Servicio).',
    targetSelector: '[data-tutorial="hc-preview-page-filter"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: true,
    historiaTab: 'preview',
    preferredPlacement: 'bottom',
  },
  {
    id: 'imp-hc-04-imprimir',
    tourId: 'imprimir_historia_clinica',
    sectionLabel: '🎉 Imprimir Historia Clínica · Paso Final',
    title: '🖨️ Imprimir PDF o Descargar PDF',
    message: '✅ Toca "Imprimir PDF" (para imprimir o Guardar como PDF desde el navegador) o "Descargar PDF". 📌 En ambos casos se guarda automáticamente con el nombre del paciente, "Historia Clinica", fecha y hora — sin links ni pies de página extra.',
    targetSelector: '[data-tutorial="hc-preview-print-actions"]',
    requiredAppTab: 'inicio',
    requiresHistoriaOpen: true,
    historiaTab: 'preview',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const IMPRIMIR_ORDENES_MEDICAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'imp-ord-01-btn',
    tourId: 'imprimir_ordenes_medicas',
    sectionLabel: '🖨️ Imprimir Órdenes Médicas · Paso 1',
    title: '🟡 Abrir "Órdenes" del Paciente',
    message: '👆 En la tarjeta del paciente ficticio en Inicio, toca el botón amarillo "Órdenes" para abrir directamente su hoja oficial de Órdenes Médicas.',
    targetSelector: '[data-tutorial="patient-btn-ordenes"]',
    requiredAppTab: 'inicio',
    requiredModal: 'none',
    expandFirstPatient: true,
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Órdenes Médicas',
    preferredPlacement: 'top',
  },
  {
    id: 'imp-ord-02-hoja',
    tourId: 'imprimir_ordenes_medicas',
    sectionLabel: '🖨️ Imprimir Órdenes Médicas · Paso 2',
    title: '📑 Verificar Indicaciones y Firmas',
    message: '✍️ Revisa todas las indicaciones numeradas, dosis por peso y las 3 casillas de firma al pie: Médico Residente, Enfermera y Residente superior o adjunto de guardia.',
    targetSelector: '[data-tutorial="ordenes-hoja-oficial"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes',
    preferredPlacement: 'bottom',
  },
  {
    id: 'imp-ord-03-acciones',
    tourId: 'imprimir_ordenes_medicas',
    sectionLabel: '🎉 Imprimir Órdenes Médicas · Paso Final',
    title: '🖨️ Imprimir en Carta o Guardar PDF',
    message: '✅ Toca "Imprimir" (tamaño Carta, limpio sin enlaces ni fecha del navegador) o "Descargar PDF". El archivo se nombra automáticamente con los datos del paciente, fecha y hora.',
    targetSelector: '[data-tutorial="ordenes-acciones-bar"]',
    requiredAppTab: 'inicio',
    requiredModal: 'ordenes',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const ALTAS_BUSCAR_REINGRESAR_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'altas-01-buscar',
    tourId: 'altas_buscar_reingresar',
    sectionLabel: '🔍 Altas Médicas · Paso 1',
    title: '📂 Buscar Paciente Dado de Alta',
    message: '🔎 En Altas Médicas usa esta barra (o el calendario) para ubicar pacientes egresados por nombre, historia o diagnóstico. 🧪 Aquí ves a nuestra paciente ficticia "Sofía Valentina Mendoza Demo".',
    targetSelector: '[data-tutorial="altas-search-panel"]',
    requiredAppTab: 'altas',
    requiredModal: 'none',
    preferredPlacement: 'bottom',
  },
  {
    id: 'altas-02-docs',
    tourId: 'altas_buscar_reingresar',
    sectionLabel: '👁️ Altas Médicas · Paso 2',
    title: '👆 Abrir "Ver Perfil & Archivos" del Egresado',
    message: '📁 Toca "Ver Perfil & Archivos" en la tarjeta de la paciente ficticia para abrir su archivo completo de egreso.',
    targetSelector: '[data-tutorial="altas-btn-ver-perfil"]',
    requiredAppTab: 'altas',
    requiredModal: 'none',
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Perfil Egresado',
    preferredPlacement: 'top',
  },
  {
    id: 'altas-03-perfil-contenido',
    tourId: 'altas_buscar_reingresar',
    sectionLabel: '📁 Perfil de Egresado · Paso 3',
    title: '📄 Documentos Archivados del Egreso',
    message: '🏥 Adentro puedes abrir e imprimir su Resumen de Egreso, Evoluciones, Órdenes Médicas, Historia Clínica de ingreso, Constancia y Nota de Recibimiento cuando lo necesites.',
    targetSelector: '[data-tutorial="altas-profile-modal-content"]',
    requiredAppTab: 'altas',
    requiredModal: 'altas_profile',
    preferredPlacement: 'bottom',
  },
  {
    id: 'altas-04-reingresar-btn',
    tourId: 'altas_buscar_reingresar',
    sectionLabel: '🔄 Altas Médicas · Paso 4',
    title: '👆 Tocar el botón "Reingresar"',
    message: '🔄 Ahora toca "Reingresar" para ver las dos opciones disponibles al devolver un paciente a hospitalización.',
    targetSelector: '[data-tutorial="altas-btn-reingresar"]',
    requiredAppTab: 'altas',
    requiredModal: 'none',
    advanceOnTargetClick: true,
    nextLabel: 'Abrir Reingresar',
    preferredPlacement: 'top',
  },
  {
    id: 'altas-05-reingresar-modal',
    tourId: 'altas_buscar_reingresar',
    sectionLabel: '🎉 Altas Médicas · Paso Final',
    title: '✨ Elegir Tipo de Reingreso',
    message: '1️⃣ "Corregir errores" devuelve todo intacto sin crear episodio nuevo. 2️⃣ "Nuevo Ingreso" archiva el ingreso previo y crea una Historia Clínica de Reingreso. 🧪 En práctica nada se guarda.',
    targetSelector: '[data-tutorial="altas-reingreso-modal-content"]',
    requiredAppTab: 'altas',
    requiredModal: 'altas_reingreso',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const TAREAS_GUARDIA_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'tar-01-form',
    tourId: 'tareas_guardia',
    sectionLabel: '✅ Tareas de Guardia · Paso 1',
    title: '➕ Agregar Nueva Tarea de Guardia',
    message: '📝 Escribe el pendiente de tu turno, elige la categoría (Guardia, Médica, Laboratorio, Alta o Personal), selecciona prioridad y pulsa "Agregar". 🧪 Aquí practicas en modo ficticio sin alterar tus tareas reales.',
    targetSelector: '[data-tutorial="tareas-add-form"]',
    requiredAppTab: 'tareas',
    preferredPlacement: 'bottom',
  },
  {
    id: 'tar-02-cats',
    tourId: 'tareas_guardia',
    sectionLabel: '🏷️ Tareas de Guardia · Paso 2',
    title: '🔎 Filtrar por Categoría',
    message: '📂 Usa estas pestañas para ver todas las tareas o enfocarte únicamente en pendientes de laboratorio, guardia o altas.',
    targetSelector: '[data-tutorial="tareas-categories"]',
    requiredAppTab: 'tareas',
    preferredPlacement: 'bottom',
  },
  {
    id: 'tar-03-list',
    tourId: 'tareas_guardia',
    sectionLabel: '🎉 Tareas de Guardia · Paso Final',
    title: '☑️ Marcar Tareas Completadas',
    message: '✅ Toca el círculo para tachar cada pendiente al completarlo o el ícono de papelera para borrarlo. ¡Así no se escapa ningún pendiente en tu guardia!',
    targetSelector: '[data-tutorial="tareas-list"]',
    requiredAppTab: 'tareas',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'top',
  },
];

export const VER_ESTADISTICAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'est-01-header',
    tourId: 'ver_estadisticas',
    sectionLabel: '📊 Estadísticas · Paso 1',
    title: '🏥 Resumen del Servicio de Pediatría',
    message: '📈 En la pestaña Estadísticas visualizas en tiempo real la actividad clínica, ocupación y métricas epidemiológicas del servicio.',
    targetSelector: '[data-tutorial="stats-header"]',
    requiredAppTab: 'estadisticas',
    preferredPlacement: 'bottom',
  },
  {
    id: 'est-02-kpis',
    tourId: 'ver_estadisticas',
    sectionLabel: '🎉 Estadísticas · Paso Final',
    title: '📉 Ingresos, Reingresos y Gráficas',
    message: '👶 Consulta ingresos de la semana y del mes, contador de reingresos, distribución por sexo y áreas, tiempos de estancia y diagnósticos o tratamientos más frecuentes.',
    targetSelector: '[data-tutorial="stats-kpis"]',
    requiredAppTab: 'estadisticas',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export const ROL_GUARDIAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'grd-01-hoy',
    tourId: 'rol_guardias',
    sectionLabel: '📅 Rol de Guardias · Paso 1',
    title: '👥 Guardia del Día y Áreas Asignadas',
    message: '🩺 Este panel muestra el equipo de guardia del día seleccionado, el jefe de guardia y el área asistencial asignada a cada residente y especialista.',
    targetSelector: '[data-tutorial="guardias-today-banner"]',
    requiredAppTab: 'guardias',
    preferredPlacement: 'bottom',
  },
  {
    id: 'grd-02-cal',
    tourId: 'rol_guardias',
    sectionLabel: '🎉 Rol de Guardias · Paso Final',
    title: '🗓️ Explorar Días y Filtrar por Grupo',
    message: '👆 Toca cualquier fecha del calendario para consultar qué equipo cubre ese día, o selecciona un grupo arriba para resaltar todas sus guardias del mes.',
    targetSelector: '[data-tutorial="guardias-calendar"]',
    requiredAppTab: 'guardias',
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'top',
  },
];

export const SONIDO_Y_TEMAS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'st-01-sound',
    tourId: 'sonido_y_temas',
    sectionLabel: '🔊 Barra Superior · Audio Ambiental',
    title: '🎵 Omitir o Activar Sonido',
    message: '🔇🔊 Toca este botón de altavoz (en móvil dentro del menú del ícono superior izquierdo) para silenciar o activar el sonido ambiental cuando desees.',
    targetSelector: '[data-tutorial="btn-ambient-sound"]',
    requiredAppTab: 'inicio',
    openMobileBrandMenu: true,
    preferredPlacement: 'bottom',
  },
  {
    id: 'st-02-theme',
    tourId: 'sonido_y_temas',
    sectionLabel: '🎉 Barra Superior · Temas',
    title: '☀️🌙 Cambiar Modo Claro, Nocturno o Automático',
    message: '🎨 Toca este selector para alternar al instante entre Modo Claro, Modo Nocturno (descansa tu vista en guardias nocturnas) o Modo Automático.',
    targetSelector: '[data-tutorial="btn-theme-mode"]',
    requiredAppTab: 'inicio',
    openMobileBrandMenu: true,
    nextLabel: 'Finalizar Tutorial',
    preferredPlacement: 'bottom',
  },
];

export function getTutorialStepsByTour(tourId: TutorialTourId): TutorialStep[] {
  switch (tourId) {
    case 'tablero_camas':
      return TABLERO_CAMAS_TUTORIAL_STEPS;
    case 'evolucionar_paciente':
      return EVOLUCIONAR_PACIENTE_TUTORIAL_STEPS;
    case 'dar_alta_medica':
      return DAR_ALTA_MEDICA_TUTORIAL_STEPS;
    case 'ver_documentos_paciente':
      return VER_DOCUMENTOS_PACIENTE_TUTORIAL_STEPS;
    case 'generar_ordenes_medicas':
      return GENERAR_ORDENES_MEDICAS_TUTORIAL_STEPS;
    case 'descargar_imprimir_inicio':
      return DESCARGAR_IMPRIMIR_INICIO_TUTORIAL_STEPS;
    case 'imprimir_evolucion':
      return IMPRIMIR_EVOLUCION_TUTORIAL_STEPS;
    case 'imprimir_historia_clinica':
      return IMPRIMIR_HISTORIA_CLINICA_TUTORIAL_STEPS;
    case 'imprimir_ordenes_medicas':
      return IMPRIMIR_ORDENES_MEDICAS_TUTORIAL_STEPS;
    case 'altas_buscar_reingresar':
      return ALTAS_BUSCAR_REINGRESAR_TUTORIAL_STEPS;
    case 'tareas_guardia':
      return TAREAS_GUARDIA_TUTORIAL_STEPS;
    case 'ver_estadisticas':
      return VER_ESTADISTICAS_TUTORIAL_STEPS;
    case 'rol_guardias':
      return ROL_GUARDIAS_TUTORIAL_STEPS;
    case 'sonido_y_temas':
      return SONIDO_Y_TEMAS_TUTORIAL_STEPS;
    case 'historia_clinica':
    default:
      return HISTORIA_CLINICA_TUTORIAL_STEPS;
  }
}
