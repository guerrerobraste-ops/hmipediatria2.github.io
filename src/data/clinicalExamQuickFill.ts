export type SemiologicalPhase =
  | 'Inspección'
  | 'Palpación'
  | 'Percusión'
  | 'Auscultación'
  | 'Valoración'
  | 'Síntomas';

export interface QuickFillOption {
  id: string;
  label: string;
  text: string;
  isNormal?: boolean;
  /** When true inside a multi-select group, selecting this clears other options in the same group (and vice versa). */
  exclusive?: boolean;
}

export interface QuickFillGroup {
  id: string;
  label: string;
  phase: SemiologicalPhase;
  mode: 'single' | 'multi';
  /** Optional prefix placed before the joined options of this group when composing clinical prose */
  prefix?: string;
  options: QuickFillOption[];
}

export interface ExamQuickFillSection {
  fieldKey: string;
  sectionType: 'funcional' | 'fisico';
  title: string;
  leadPrefix?: string;
  groups: QuickFillGroup[];
}

export type QuickFillSelectionMap = Record<string, string[]>;

function joinSpanishList(items: string[]): string {
  const clean = items.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} y ${clean[clean.length - 1]}`;
}

function capitalizeFirst(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Pure toggle helper for selecting/deselecting an option in a quick-fill group.
 * Handles single-select, multi-select, and mutually exclusive "Sin ..." options.
 */
export function toggleQuickFillOption(
  group: QuickFillGroup,
  currentSelectedIds: string[],
  optionId: string
): string[] {
  const targetOption = group.options.find(o => o.id === optionId);
  if (!targetOption) return currentSelectedIds;

  const isSelected = currentSelectedIds.includes(optionId);

  if (group.mode === 'single') {
    return isSelected ? [] : [optionId];
  }

  if (isSelected) {
    return currentSelectedIds.filter(id => id !== optionId);
  }

  if (targetOption.exclusive) {
    return [optionId];
  }

  const exclusiveIds = new Set(group.options.filter(o => o.exclusive).map(o => o.id));
  const filtered = currentSelectedIds.filter(id => !exclusiveIds.has(id));
  return [...filtered, optionId];
}

/**
 * Composes natural, grammatically clean Venezuelan pediatric clinical prose
 * from the active quick-fill chip selections for a given section.
 */
export function composeQuickFillClinicalText(
  section: ExamQuickFillSection,
  selections: QuickFillSelectionMap
): string {
  if (section.sectionType === 'funcional') {
    const phrases: string[] = [];
    for (const group of section.groups) {
      const selectedIds = selections[group.id] || [];
      if (selectedIds.length === 0) continue;
      const texts = group.options
        .filter(o => selectedIds.includes(o.id))
        .map(o => o.text);
      if (texts.length === 0) continue;
      const joined = joinSpanishList(texts);
      phrases.push(group.prefix ? `${group.prefix}${joined}` : joined);
    }
    if (phrases.length === 0) return '';
    const lead = section.leadPrefix || 'Madre refiere: ';
    return `${lead}${joinSpanishList(phrases)}.`;
  }

  // Examen Físico: preserve semiological phase sequence (Inspección -> Palpación -> Percusión -> Auscultación -> Valoración)
  const phaseOrder: SemiologicalPhase[] = [
    'Valoración',
    'Inspección',
    'Palpación',
    'Percusión',
    'Auscultación',
    'Síntomas',
  ];

  const distinctPhasesInSection = new Set(section.groups.map(g => g.phase));
  const includePhaseLabels =
    distinctPhasesInSection.size > 1 &&
    (distinctPhasesInSection.has('Inspección') ||
      distinctPhasesInSection.has('Palpación') ||
      distinctPhasesInSection.has('Percusión') ||
      distinctPhasesInSection.has('Auscultación'));

  const phaseSentences: string[] = [];

  for (const phase of phaseOrder) {
    const groupsInPhase = section.groups.filter(g => g.phase === phase);
    const groupPhrases: string[] = [];

    for (const group of groupsInPhase) {
      const selectedIds = selections[group.id] || [];
      if (selectedIds.length === 0) continue;
      const selectedOptions = group.options.filter(o => selectedIds.includes(o.id));
      if (selectedOptions.length === 0) continue;

      // If an exclusive option (e.g., "sin tiraje", "sin estertores") is selected, render its text directly without double prefix
      if (selectedOptions.length === 1 && selectedOptions[0].exclusive) {
        groupPhrases.push(selectedOptions[0].text);
      } else {
        const joined = joinSpanishList(selectedOptions.map(o => o.text));
        groupPhrases.push(group.prefix ? `${group.prefix}${joined}` : joined);
      }
    }

    if (groupPhrases.length === 0) continue;
    const body = groupPhrases.join(', ');
    if (includePhaseLabels && phase !== 'Valoración' && phase !== 'Síntomas') {
      phaseSentences.push(`${phase}: ${capitalizeFirst(body)}.`);
    } else {
      phaseSentences.push(`${capitalizeFirst(body)}.`);
    }
  }

  return phaseSentences.join(' ');
}

/**
 * Merges newly composed quick-fill text with any extra manual notes the user may have
 * typed after the quick-fill block, without wiping user-written additions.
 */
export function mergeQuickFillWithManualNotes(
  currentValue: string,
  previousGenerated: string,
  nextGenerated: string
): string {
  const trimmedCurrent = (currentValue || '').trim();
  const trimmedPrev = (previousGenerated || '').trim();

  if (trimmedPrev && trimmedCurrent.startsWith(trimmedPrev)) {
    const suffix = trimmedCurrent.slice(trimmedPrev.length).trim();
    if (!nextGenerated) return suffix;
    return suffix ? `${nextGenerated} ${suffix}` : nextGenerated;
  }

  return nextGenerated;
}

// ============================================================================
// PÁGINA 4: EXAMEN FUNCIONAL (14 SISTEMAS) — LLENADO RÁPIDO PATOLÓGICO
// ============================================================================

export const EXAMEN_FUNCIONAL_QUICK_FILL: Record<string, ExamQuickFillSection> = {
  examenFuncionalGeneral: {
    fieldKey: 'examenFuncionalGeneral',
    sectionType: 'funcional',
    title: '1. Examen Funcional General',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_gen_sintomas',
        label: 'Síntomas generales',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'fiebre', label: 'Fiebre cuantificada', text: 'fiebre cuantificada' },
          { id: 'fiebre_no_cuant', label: 'Alza térmica no cuantificada', text: 'alza térmica no cuantificada' },
          { id: 'escalofrios', label: 'Escalofríos', text: 'escalofríos' },
          { id: 'hiporexia', label: 'Hiporexia / inapetencia', text: 'hiporexia' },
          { id: 'astenia', label: 'Astenia / decaimiento', text: 'astenia y decaimiento' },
          { id: 'perdida_peso', label: 'Pérdida de peso', text: 'pérdida de peso' },
          { id: 'sudoracion', label: 'Diaforesis / sudoración', text: 'diaforesis' },
          { id: 'irritabilidad', label: 'Irritabilidad', text: 'irritabilidad' },
        ],
      },
    ],
  },
  pielFuncional: {
    fieldKey: 'pielFuncional',
    sectionType: 'funcional',
    title: '2. Piel',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_piel_sintomas',
        label: 'Manifestaciones cutáneas',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'erupcion', label: 'Erupción / exantema', text: 'erupción cutánea' },
          { id: 'prurito', label: 'Prurito', text: 'prurito' },
          { id: 'palidez', label: 'Palidez', text: 'palidez cutáneo-mucosa' },
          { id: 'ictericia', label: 'Ictericia (tinte amarillo)', text: 'tinte ictérico en piel y mucosas' },
          { id: 'cianosis', label: 'Cianosis', text: 'cianosis perioral/distal' },
          { id: 'edemas', label: 'Edemas', text: 'edema localizado/generalizado' },
          { id: 'petequias', label: 'Petequias / equimosis', text: 'aparición de petequias/equimosis' },
          { id: 'lesiones', label: 'Lesiones pustulosas/vesiculares', text: 'lesiones vesiculopustulosas' },
        ],
      },
    ],
  },
  cabezaFuncional: {
    fieldKey: 'cabezaFuncional',
    sectionType: 'funcional',
    title: '3. Cabeza',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_cabeza_sintomas',
        label: 'Síntomas cefálicos',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'cefalea', label: 'Cefalea', text: 'cefalea' },
          { id: 'mareos', label: 'Mareos', text: 'mareos' },
          { id: 'sincope', label: 'Síncope', text: 'episodio sincopal' },
          { id: 'tce', label: 'Traumatismo craneal', text: 'antecedente de traumatismo craneoencefálico' },
          { id: 'abombamiento', label: 'Fontanela abombada', text: 'aumento de tensión en fontanela anterior' },
          { id: 'alopecia', label: 'Caída de cabello', text: 'caída excesiva de cabello' },
        ],
      },
    ],
  },
  ojosFuncional: {
    fieldKey: 'ojosFuncional',
    sectionType: 'funcional',
    title: '4. Ojos',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_ojos_sintomas',
        label: 'Síntomas oculares',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'secrecion', label: 'Secreción ocular', text: 'secreción ocular purulenta/mucosa' },
          { id: 'hiperemia', label: 'Ojo rojo', text: 'enrojecimiento ocular' },
          { id: 'lagrimeo', label: 'Epífora / lagrimeo', text: 'lagrimeo constante' },
          { id: 'fotofobia', label: 'Fotofobia', text: 'fotofobia' },
          { id: 'edema_palp', label: 'Edema palpebral', text: 'edema palpebral' },
          { id: 'vision_borrosa', label: 'Visión borrosa', text: 'disminución de agudeza visual' },
          { id: 'estrabismo', label: 'Estrabismo', text: 'desviación ocular' },
        ],
      },
    ],
  },
  oidosFuncional: {
    fieldKey: 'oidosFuncional',
    sectionType: 'funcional',
    title: '5. Oídos',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_oidos_sintomas',
        label: 'Síntomas otológicos',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'otalgia', label: 'Otalgia', text: 'otalgia' },
          { id: 'otorrea', label: 'Otorrea', text: 'otorrea purulenta/serosa' },
          { id: 'otorragia', label: 'Otorragia', text: 'otorragia' },
          { id: 'hipoacusia', label: 'Hipoacusia', text: 'disminución de la audición' },
          { id: 'traccion', label: 'Se toca las orejas', text: 'manipulación frecuente de pabellones auriculares' },
        ],
      },
    ],
  },
  narizFuncional: {
    fieldKey: 'narizFuncional',
    sectionType: 'funcional',
    title: '6. Nariz',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_nariz_sintomas',
        label: 'Síntomas nasales',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'rinorrea_hialina', label: 'Rinorrea hialina', text: 'rinorrea hialina anterior' },
          { id: 'rinorrea_muco', label: 'Rinorrea mucopurulenta', text: 'rinorrea mucopurulenta' },
          { id: 'congestion', label: 'Congestión nasal', text: 'obstrucción/congestión nasal' },
          { id: 'epistaxis', label: 'Epistaxis', text: 'epistaxis' },
          { id: 'estornudos', label: 'Estornudos frecuentes', text: 'estornudos en salva' },
          { id: 'prurito_nasal', label: 'Prurito nasal', text: 'prurito nasal' },
        ],
      },
    ],
  },
  bocaFuncional: {
    fieldKey: 'bocaFuncional',
    sectionType: 'funcional',
    title: '7. Boca',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_boca_sintomas',
        label: 'Síntomas bucofaríngeos',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'odinofagia', label: 'Odinofagia', text: 'odinofagia' },
          { id: 'disfagia', label: 'Disfagia', text: 'disfagia' },
          { id: 'sialorrea', label: 'Sialorrea', text: 'sialorrea abundante' },
          { id: 'aftas', label: 'Aftas / lesiones orales', text: 'lesiones aftosas en mucosa oral' },
          { id: 'monilia', label: 'Algodoncillo (Monilia)', text: 'placas blanquecinas en cavidad oral' },
          { id: 'odontalgia', label: 'Odontalgia', text: 'odontalgia' },
          { id: 'halitosis', label: 'Halitosis', text: 'halitosis' },
          { id: 'rechazo_toma', label: 'Rechazo a la succión/vía oral', text: 'dificultad para la succión y rechazo a la vía oral' },
        ],
      },
    ],
  },
  respiratorioFuncional: {
    fieldKey: 'respiratorioFuncional',
    sectionType: 'funcional',
    title: '8. Respiratorio',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_resp_sintomas',
        label: 'Síntomas respiratorios',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'tos_seca', label: 'Tos seca', text: 'tos seca en accesos' },
          { id: 'tos_humeda', label: 'Tos húmeda / productiva', text: 'tos húmeda productiva con movilización de secreciones' },
          { id: 'tos_crup', label: 'Tos perruna / disfónica', text: 'tos perruna/crup' },
          { id: 'disnea', label: 'Dificultad respiratoria', text: 'dificultad respiratoria progresiva' },
          { id: 'sibilancias', label: 'Sibilancias / pecho apretado', text: 'sibilancias audibles' },
          { id: 'estridor', label: 'Estridor inspiratorio', text: 'estridor inspiratorio' },
          { id: 'quejido', label: 'Quejido respiratorio', text: 'quejido respiratorio' },
          { id: 'aleteo', label: 'Aleteo nasal', text: 'aleteo nasal' },
          { id: 'tiraje', label: 'Hundimiento costal (tiraje)', text: 'tiraje costal visible' },
          { id: 'apnea', label: 'Pausas respiratorias / apnea', text: 'episodios de pausas respiratorias' },
        ],
      },
    ],
  },
  osteomioarticularFuncional: {
    fieldKey: 'osteomioarticularFuncional',
    sectionType: 'funcional',
    title: '9. Osteomioarticular',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_osteo_sintomas',
        label: 'Síntomas osteomioarticulares',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'artralgia', label: 'Artralgias', text: 'dolor articular (artralgias)' },
          { id: 'mialgia', label: 'Mialgias', text: 'dolor muscular (mialgias)' },
          { id: 'tumefaccion', label: 'Tumefacción articular', text: 'aumento de volumen articular' },
          { id: 'claudicacion', label: 'Claudicación / cojera', text: 'claudicación de la marcha' },
          { id: 'limitacion', label: 'Limitación funcional', text: 'limitación para movilizar extremidad' },
          { id: 'trauma', label: 'Traumatismo / caída', text: 'antecedente de traumatismo osteoarticular' },
        ],
      },
    ],
  },
  cardiovascularFuncional: {
    fieldKey: 'cardiovascularFuncional',
    sectionType: 'funcional',
    title: '10. Cardiovascular',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_cardio_sintomas',
        label: 'Síntomas cardiovasculares',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'fatiga_alim', label: 'Fatiga con la alimentación', text: 'fatiga y pausas frecuentes con la alimentación/succión' },
          { id: 'diaforesis_succion', label: 'Sudoración profusa al mamar', text: 'diaforesis cefálica durante las tomas' },
          { id: 'cianosis_llanto', label: 'Cianosis con el llanto', text: 'cianosis perioral con el llanto o esfuerzo' },
          { id: 'disnea_esfuerzo', label: 'Disnea de esfuerzo', text: 'disnea ante esfuerzos habituales' },
          { id: 'palpitaciones', label: 'Palpitaciones', text: 'palpitaciones' },
          { id: 'dolor_precordial', label: 'Dolor precordial', text: 'dolor precordial' },
          { id: 'frialdad', label: 'Frialdad distal', text: 'frialdad en extremidades' },
        ],
      },
    ],
  },
  gastrointestinalFuncional: {
    fieldKey: 'gastrointestinalFuncional',
    sectionType: 'funcional',
    title: '11. Gastrointestinal',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_gastro_sintomas',
        label: 'Síntomas gastrointestinales',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'vomitos', label: 'Vómitos alimentarios', text: 'vómitos de contenido alimentario' },
          { id: 'vomitos_biliosos', label: 'Vómitos biliosos', text: 'vómitos de aspecto bilioso' },
          { id: 'nauseas', label: 'Náuseas', text: 'náuseas' },
          { id: 'diarrea_liq', label: 'Evacuaciones líquidas', text: 'evacuaciones líquidas abundantes sin moco ni sangre' },
          { id: 'diarrea_moco', label: 'Evacuaciones con moco/sangre', text: 'evacuaciones diarreicas con moco y/o sangre' },
          { id: 'dolor_abd', label: 'Dolor abdominal', text: 'dolor abdominal tipo cólico' },
          { id: 'distension', label: 'Distensión abdominal', text: 'distensión abdominal' },
          { id: 'estrenimiento', label: 'Estreñimiento', text: 'ausencia de evacuaciones / estreñimiento' },
          { id: 'intolerancia', label: 'Intolerancia a la vía oral', text: 'intolerancia a la vía oral' },
        ],
      },
    ],
  },
  genitourinarioFuncional: {
    fieldKey: 'genitourinarioFuncional',
    sectionType: 'funcional',
    title: '12. Genitourinario',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_genito_sintomas',
        label: 'Síntomas genitourinarios',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'disuria', label: 'Disuria / llanto al orinar', text: 'disuria / llanto al orinar' },
          { id: 'polaquiuria', label: 'Polaquiuria', text: 'polaquiuria' },
          { id: 'oliguria', label: 'Oliguria / pañales secos', text: 'disminución del volumen urinario (oliguria)' },
          { id: 'orina_fetida', label: 'Orina fétida / turbia', text: 'orinas turbias y fétidas' },
          { id: 'hematuria', label: 'Hematuria', text: 'hematuria macroscópica' },
          { id: 'dolor_lumbar', label: 'Dolor lumbar', text: 'dolor lumbar' },
          { id: 'enuresis', label: 'Enuresis', text: 'enuresis' },
          { id: 'edema_escrotal', label: 'Inflamación escrotal', text: 'aumento de volumen/dolor escrotal' },
        ],
      },
    ],
  },
  ginecologicosFuncional: {
    fieldKey: 'ginecologicosFuncional',
    sectionType: 'funcional',
    title: '13. Ginecológicos',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_gine_sintomas',
        label: 'Síntomas ginecológicos',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'leucorrea', label: 'Flujo / leucorrea', text: 'flujo genital / leucorrea' },
          { id: 'prurito_vulv', label: 'Prurito vulvar', text: 'prurito vulvar' },
          { id: 'eritema_vulv', label: 'Eritema vulvar', text: 'eritema vulvar' },
          { id: 'sangrado', label: 'Sangrado genital', text: 'sangrado vaginal anormal' },
          { id: 'dismenorrea', label: 'Dismenorrea', text: 'dismenorrea' },
          { id: 'amenorrea', label: 'Irregularidad menstrual', text: 'alteración del ciclo menstrual' },
        ],
      },
    ],
  },
  nerviosoCentralFuncional: {
    fieldKey: 'nerviosoCentralFuncional',
    sectionType: 'funcional',
    title: '14. Nervioso Central',
    leadPrefix: 'Madre refiere: ',
    groups: [
      {
        id: 'ef_neuro_sintomas',
        label: 'Síntomas neurológicos',
        phase: 'Síntomas',
        mode: 'multi',
        options: [
          { id: 'somnolencia', label: 'Somnolencia', text: 'somnolencia excesiva' },
          { id: 'irritabilidad_nc', label: 'Irritabilidad inconsolable', text: 'irritabilidad inconsolable' },
          { id: 'convulsiones', label: 'Crisis convulsivas', text: 'episodio de crisis convulsivas tónico-clónicas' },
          { id: 'perdida_conciencia', label: 'Pérdida de conciencia', text: 'alteración del estado de conciencia' },
          { id: 'alt_marcha', label: 'Alteración de la marcha', text: 'inestabilidad/alteración de la marcha' },
          { id: 'debilidad', label: 'Debilidad de extremidades', text: 'disminución de fuerza en extremidades' },
          { id: 'trastorno_sueno', label: 'Trastornos del sueño', text: 'alteración del patrón del sueño' },
        ],
      },
    ],
  },
};

// ============================================================================
// PÁGINA 5: EXAMEN FÍSICO COMPLETO (18 ACÁPITES) — SEMIOLOGÍA POR FASES
// ============================================================================

export const EXAMEN_FISICO_QUICK_FILL: Record<string, ExamQuickFillSection> = {
  estadoGeneralFisico: {
    fieldKey: 'estadoGeneralFisico',
    sectionType: 'fisico',
    title: '1. Estado General',
    groups: [
      {
        id: 'eg_condiciones',
        label: 'Condiciones generales',
        phase: 'Valoración',
        mode: 'single',
        options: [
          { id: 'buenas', label: 'Buenas condiciones', text: 'paciente en buenas condiciones generales', isNormal: true },
          { id: 'regulares', label: 'Regulares condiciones', text: 'paciente en regulares condiciones generales' },
          { id: 'malas', label: 'Malas condiciones', text: 'paciente en malas condiciones generales' },
          { id: 'delicadas', label: 'Condiciones clínicas delicadas', text: 'paciente en condiciones clínicas delicadas' },
        ],
      },
      {
        id: 'eg_temperatura',
        label: 'Temperatura / respiración',
        phase: 'Valoración',
        mode: 'multi',
        options: [
          { id: 'afebril', label: 'Afebril al tacto', text: 'afebril al tacto', isNormal: true },
          { id: 'febril', label: 'Febril al tacto', text: 'febril al tacto' },
          { id: 'eupneico', label: 'Eupneico', text: 'eupneico', isNormal: true },
          { id: 'taquipneico', label: 'Taquipneico', text: 'taquipneico' },
          { id: 'disneico', label: 'Con dificultad respiratoria', text: 'con signos de dificultad respiratoria' },
        ],
      },
      {
        id: 'eg_hidratacion',
        label: 'Hidratación',
        phase: 'Valoración',
        mode: 'single',
        options: [
          { id: 'normohid', label: 'Normohidratado', text: 'normohidratado', isNormal: true },
          { id: 'dh_leve', label: 'Deshidratación leve', text: 'con signos de deshidratación leve' },
          { id: 'dh_mod', label: 'Deshidratación moderada', text: 'con signos de deshidratación moderada' },
          { id: 'dh_sev', label: 'Deshidratación severa', text: 'con signos de deshidratación severa' },
        ],
      },
      {
        id: 'eg_actitud',
        label: 'Actitud / estado neurológico general',
        phase: 'Valoración',
        mode: 'multi',
        options: [
          { id: 'activo', label: 'Activo y reactivo', text: 'activo y reactivo', isNormal: true },
          { id: 'decaido', label: 'Decaído / hipoactivo', text: 'decaído e hipoactivo' },
          { id: 'irritable', label: 'Irritable', text: 'irritable' },
          { id: 'somnoliento', label: 'Somnoliento / obnubilado', text: 'somnoliento' },
          { id: 'algico', label: 'Facies álgica', text: 'con facies álgica' },
        ],
      },
    ],
  },

  pielPaniculoFanerasFisico: {
    fieldKey: 'pielPaniculoFanerasFisico',
    sectionType: 'fisico',
    title: '2. Piel, Panículo Adiposo y Faneras',
    groups: [
      {
        id: 'piel_color',
        label: 'Coloración',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'normocol', label: 'Normocoloreada', text: 'piel normocoloreada', isNormal: true, exclusive: true },
          { id: 'palidez', label: 'Palidez cutáneo-mucosa', text: 'palidez cutáneo-mucosa' },
          { id: 'ictericia', label: 'Ictericia', text: 'tinte ictérico en piel y escleras' },
          { id: 'cianosis_per', label: 'Cianosis perioral/distal', text: 'cianosis perioral y distal' },
          { id: 'cianosis_cent', label: 'Cianosis central', text: 'cianosis central' },
          { id: 'piel_marmorea', label: 'Piel marmórea / reticulada', text: 'piel marmórea' },
        ],
      },
      {
        id: 'piel_lesiones',
        label: 'Lesiones dermatológicas',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'sin_lesiones', label: 'Sin lesiones', text: 'sin lesiones cutáneas', isNormal: true, exclusive: true },
          { id: 'exantema', label: 'Exantema maculopapular', text: 'exantema maculopapular generalizado' },
          { id: 'petequias', label: 'Petequias', text: 'petequias' },
          { id: 'equimosis', label: 'Equimosis', text: 'equimosis' },
          { id: 'vesiculas', label: 'Vesículas / pústulas', text: 'lesiones vesiculopustulosas' },
          { id: 'celulitis', label: 'Placa eritematosa / celulitis', text: 'placa eritematosa con signos de flogosis' },
          { id: 'habones', label: 'Habones / urticaria', text: 'lesiones habonosas urticariformes' },
          { id: 'descamacion', label: 'Piel seca / descamativa', text: 'piel seca y descamativa' },
        ],
      },
      {
        id: 'piel_palpacion',
        label: 'Turgor, temperatura y perfusión',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'turgor_ok', label: 'Turgor conservado', text: 'turgor y elasticidad conservados', isNormal: true },
          { id: 'pliegue_pos', label: 'Signo del pliegue (+)', text: 'signo del pliegue cutáneo positivo (regreso lento)' },
          { id: 'hipertermia', label: 'Caliente al tacto', text: 'hipertermia al tacto' },
          { id: 'frialdad_dist', label: 'Frialdad distal', text: 'frialdad distal' },
          { id: 'llenado_ok', label: 'Llenado capilar < 2 seg', text: 'llenado capilar menor a 2 segundos', isNormal: true },
          { id: 'llenado_prol', label: 'Llenado capilar > 3 seg', text: 'llenado capilar prolongado (> 3 segundos)' },
          { id: 'edema', label: 'Edema con fóvea (+)', text: 'edema con signo de fóvea positivo' },
          { id: 'paniculo_dism', label: 'Panículo adiposo disminuido', text: 'panículo adiposo disminuido' },
        ],
      },
    ],
  },

  cabezaFisico: {
    fieldKey: 'cabezaFisico',
    sectionType: 'fisico',
    title: '3. Cabeza',
    groups: [
      {
        id: 'cab_inspeccion',
        label: 'Conformación y facies',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'normocef', label: 'Normocéfala', text: 'normocéfala y simétrica', isNormal: true },
          { id: 'macrocef', label: 'Macrocefalia', text: 'macrocefalia' },
          { id: 'microcef', label: 'Microcefalia', text: 'microcefalia' },
          { id: 'asimetria', label: 'Asimetría / plagiocefalia', text: 'asimetría craneal' },
          { id: 'hematoma', label: 'Hematoma / aumento de volumen', text: 'aumento de volumen en cuero cabelludo (hematoma)' },
          { id: 'herida', label: 'Herida / escoriación', text: 'herida/escoriación en región cefálica' },
          { id: 'facies_alg', label: 'Facies febril / álgica', text: 'facies febril/álgica' },
        ],
      },
      {
        id: 'cab_palpacion',
        label: 'Fontanelas y suturas',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'font_normo', label: 'Fontanela normotensa', text: 'fontanela anterior normotensa', isNormal: true },
          { id: 'font_cerrada', label: 'Fontanelas cerradas', text: 'fontanelas cerradas', isNormal: true },
          { id: 'font_abomb', label: 'Fontanela abombada / tensa', text: 'fontanela anterior abombada y tensa' },
          { id: 'font_deprim', label: 'Fontanela deprimida', text: 'fontanela anterior deprimida' },
          { id: 'sut_diast', label: 'Diástasis de suturas', text: 'diástasis de suturas craneales' },
          { id: 'dolor_palp', label: 'Dolor a la palpación craneal', text: 'dolor a la palpación craneal' },
        ],
      },
    ],
  },

  ojosFisico: {
    fieldKey: 'ojosFisico',
    sectionType: 'fisico',
    title: '4. Ojos',
    groups: [
      {
        id: 'ojos_insp',
        label: 'Conjuntivas, escleras y párpados',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'conj_pal', label: 'Conjuntivas pálidas', text: 'conjuntivas hipocoloreadas/pálidas' },
          { id: 'conj_hip', label: 'Inyección conjuntival', text: 'hiperemia e inyección conjuntival' },
          { id: 'sec_pur', label: 'Secreción purulenta', text: 'secreción conjuntival purulenta' },
          { id: 'sec_hial', label: 'Secreción serosa/hialina', text: 'secreción ocular serosa' },
          { id: 'escl_ict', label: 'Escleras ictéricas', text: 'escleras ictéricas' },
          { id: 'enoftalmos', label: 'Enoftalmos (ojos hundidos)', text: 'ojos hundidos (enoftalmos)' },
          { id: 'sin_lagrimas', label: 'Llanto sin lágrimas', text: 'llanto sin lágrimas' },
          { id: 'edema_palp', label: 'Edema palpebral', text: 'edema palpebral' },
          { id: 'estrabismo', label: 'Estrabismo', text: 'estrabismo evidente' },
        ],
      },
      {
        id: 'ojos_pupilas',
        label: 'Pupilas y motilidad',
        phase: 'Valoración',
        mode: 'single',
        options: [
          { id: 'iso_normo', label: 'Isocóricas normorreactivas', text: 'pupilas isocóricas normorreactivas a la luz', isNormal: true },
          { id: 'aniso', label: 'Anisocoria', text: 'pupilas anisocóricas' },
          { id: 'miosis', label: 'Miosis', text: 'pupilas mióticas' },
          { id: 'midriasis', label: 'Midriasis', text: 'pupilas midriáticas' },
          { id: 'hiporreact', label: 'Hiporreactivas a la luz', text: 'pupilas hiporreactivas a la luz' },
        ],
      },
    ],
  },

  oidosFisico: {
    fieldKey: 'oidosFisico',
    sectionType: 'fisico',
    title: '5. Oídos',
    groups: [
      {
        id: 'oidos_insp',
        label: 'Otoscopia y conducto auditivo',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'mt_hiper', label: 'Tímpano hiperémico', text: 'membrana timpánica hiperémica y congestiva' },
          { id: 'mt_abomb', label: 'Tímpano abombado sin cono luminoso', text: 'membrana timpánica abombada con pérdida del cono luminoso' },
          { id: 'mt_perf', label: 'Perforación timpánica', text: 'perforación timpánica visible' },
          { id: 'otorrea', label: 'Otorrea purulenta', text: 'otorrea purulenta en conducto auditivo externo' },
          { id: 'otorragia', label: 'Otorragia', text: 'otorragia' },
          { id: 'cerumen', label: 'Tapón de cerumen', text: 'tapón de cerumen que dificulta otoscopia' },
        ],
      },
      {
        id: 'oidos_palp',
        label: 'Palpación tragal y mastoidea',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'trago_pos', label: 'Signo del trago (+)', text: 'dolor a la tracción del trago positivo' },
          { id: 'mastoides_pos', label: 'Dolor mastoideo / eritema', text: 'dolor y signos inflamatorios en región mastoidea' },
          { id: 'mastoides_neg', label: 'Mastoides indoloras', text: 'regiones mastoideas indoloras', isNormal: true },
        ],
      },
    ],
  },

  rinofaringeFisico: {
    fieldKey: 'rinofaringeFisico',
    sectionType: 'fisico',
    title: '6. Rinofaringe',
    groups: [
      {
        id: 'rino_insp',
        label: 'Fosas nasales y faringe',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'rinorrea_hial', label: 'Rinorrea hialina', text: 'rinorrea hialina anterior' },
          { id: 'rinorrea_pur', label: 'Rinorrea mucopurulenta', text: 'rinorrea mucopurulenta bilateral' },
          { id: 'obstruccion', label: 'Fosas nasales obstruidas', text: 'obstrucción nasal con mucosa congestiva' },
          { id: 'aleteo', label: 'Aleteo nasal', text: 'aleteo nasal presente' },
          { id: 'epistaxis', label: 'Epistaxis', text: 'sangrado nasal activo/costras hemáticas' },
          { id: 'faringe_hip', label: 'Faringe hiperémica', text: 'orofaringe hiperémica congestiva' },
          { id: 'amigd_hip', label: 'Amígdalas hipertróficas (G III-IV)', text: 'amígdalas hipertróficas grado III-IV' },
          { id: 'placas_exud', label: 'Placas exudativas amigdalinas', text: 'exudado blanquecino purulento en amígdalas' },
          { id: 'goteo_post', label: 'Descarga retronasal', text: 'descarga mucosa posterior en pared faríngea' },
        ],
      },
    ],
  },

  bocaFisico: {
    fieldKey: 'bocaFisico',
    sectionType: 'fisico',
    title: '7. Boca',
    groups: [
      {
        id: 'boca_insp',
        label: 'Mucosa, lengua, labios y encías',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'mucosa_seca', label: 'Mucosa oral seca', text: 'mucosa oral seca' },
          { id: 'mucosa_semihum', label: 'Mucosa semihúmeda', text: 'mucosa oral semihúmeda' },
          { id: 'lengua_sab', label: 'Lengua saburral / seca', text: 'lengua saburral y seca' },
          { id: 'muguet', label: 'Placas blanquecinas (Muguet)', text: 'placas blanquecinas compatibles con candidiasis oral (muguet)' },
          { id: 'aftas', label: 'Aftas / úlceras orales', text: 'úlceras/lesiones aftosas en mucosa oral' },
          { id: 'labios_secos', label: 'Labios secos / agrietados', text: 'labios secos con queilitis' },
          { id: 'caries', label: 'Caries dentales múltiples', text: 'caries activas en piezas dentarias' },
          { id: 'gingivitis', label: 'Gingivitis / sangrado', text: 'encías hiperémicas con gingivorragia' },
          { id: 'sialorrea', label: 'Sialorrea', text: 'sialorrea abundante' },
        ],
      },
    ],
  },

  cuelloFisico: {
    fieldKey: 'cuelloFisico',
    sectionType: 'fisico',
    title: '8. Cuello',
    groups: [
      {
        id: 'cuello_insp',
        label: 'Inspección y movilidad',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'simetrico', label: 'Simétrico y móvil', text: 'cuello cilíndrico, simétrico y móvil', isNormal: true },
          { id: 'rigidez', label: 'Rigidez de nuca', text: 'rigidez de nuca presente' },
          { id: 'torticolis', label: 'Tortícolis / limitación', text: 'limitación dolorosa a la movilización cervical' },
          { id: 'ingurgitacion', label: 'Ingurgitación yugular', text: 'ingurgitación yugular' },
          { id: 'masa_vis', label: 'Aumento de volumen cervical', text: 'aumento de volumen cervical visible' },
        ],
      },
      {
        id: 'cuello_palp',
        label: 'Palpación cervical',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'adenop_cerv', label: 'Adenopatías cervicales', text: 'adenopatías cervicales palpables' },
          { id: 'tiroides_palp', label: 'Tiroides palpable / bocio', text: 'glándula tiroides aumentada de tamaño' },
          { id: 'traquea_cent', label: 'Tráquea centrada', text: 'tráquea centrada y desplazable', isNormal: true },
          { id: 'traquea_desv', label: 'Tráquea desviada', text: 'desviación traqueal' },
          { id: 'dolor_cerv', label: 'Dolor a la palpación', text: 'dolor a la palpación cervical' },
        ],
      },
    ],
  },

  gangliosLinfaticosFisico: {
    fieldKey: 'gangliosLinfaticosFisico',
    sectionType: 'fisico',
    title: '9. Ganglios Linfáticos',
    groups: [
      {
        id: 'gang_cadena',
        label: 'Cadenas ganglionares comprometidas',
        phase: 'Palpación',
        mode: 'multi',
        prefix: 'adenomegalias palpables en cadenas ',
        options: [
          { id: 'sin_adeno', label: 'Sin adenomegalias', text: 'no se palpan adenomegalias patológicas', isNormal: true, exclusive: true },
          { id: 'cervicales', label: 'Cervicales anteriores/posteriores', text: 'cervicales' },
          { id: 'submandib', label: 'Submandibulares', text: 'submandibulares' },
          { id: 'retroauric', label: 'Retroauriculares / occipitales', text: 'retroauriculares/occipitales' },
          { id: 'supraclav', label: 'Supraclaviculares', text: 'supraclaviculares' },
          { id: 'axilares', label: 'Axilares', text: 'axilares' },
          { id: 'inguinales', label: 'Inguinales', text: 'inguinales' },
        ],
      },
      {
        id: 'gang_caract',
        label: 'Características palpatorias',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'moviles', label: 'Móviles y elásticas', text: 'de consistencia elástica y móviles' },
          { id: 'indoloras', label: 'Indoloras', text: 'indoloras' },
          { id: 'dolorosas', label: 'Dolorosas / signos de flogosis', text: 'dolorosas con signos inflamatorios locales' },
          { id: 'adheridas', label: 'Duras / adheridas a planos profundos', text: 'consistencia dura y adheridas a planos profundos' },
          { id: 'menores_1cm', label: 'Menores de 1 cm', text: 'menores de 1 cm' },
          { id: 'mayores_1_5cm', label: 'Mayores de 1.5 cm', text: 'mayores de 1.5 cm' },
        ],
      },
    ],
  },

  toraxPulmonesFisico: {
    fieldKey: 'toraxPulmonesFisico',
    sectionType: 'fisico',
    title: '10. Tórax y Pulmones',
    groups: [
      {
        id: 'torax_tipo',
        label: 'Tipo de tórax',
        phase: 'Inspección',
        mode: 'single',
        prefix: 'tórax ',
        options: [
          { id: 'normoconf', label: 'Simétrico / Normoconfigurado', text: 'simétrico normoconfigurado', isNormal: true },
          { id: 'cilindrico', label: 'Cilíndrico (lactante)', text: 'cilíndrico simétrico', isNormal: true },
          { id: 'tonel', label: 'En tonel / enfisematoso', text: 'en tonel (aumento de diámetro anteroposterior)' },
          { id: 'quilla', label: 'En quilla (Pectus carinatum)', text: 'en quilla (pectus carinatum)' },
          { id: 'embudo', label: 'En embudo (Pectus excavatum)', text: 'en embudo (pectus excavatum)' },
          { id: 'asimetrico', label: 'Asimétrico / abombado', text: 'asimétrico con abombamiento de hemitórax' },
        ],
      },
      {
        id: 'torax_expansibilidad',
        label: 'Expansibilidad torácica',
        phase: 'Inspección',
        mode: 'single',
        options: [
          { id: 'normoexp', label: 'Normoexpansible', text: 'normoexpansible', isNormal: true },
          { id: 'hipoexp', label: 'Hipoexpansible', text: 'hipoexpansible' },
          { id: 'hiperexp', label: 'Hiperexpansible', text: 'hiperexpansible' },
          { id: 'asimetrica', label: 'Expansibilidad asimétrica', text: 'con expansibilidad asimétrica' },
        ],
      },
      {
        id: 'torax_tiraje',
        label: 'Tiraje',
        phase: 'Inspección',
        mode: 'multi',
        prefix: 'con tiraje ',
        options: [
          { id: 'sin_tiraje', label: 'Sin tiraje', text: 'sin tiraje', isNormal: true, exclusive: true },
          { id: 'universal', label: 'Universal', text: 'universal' },
          { id: 'intercostal', label: 'Intercostal', text: 'intercostal' },
          { id: 'subcostal', label: 'Subcostal', text: 'subcostal' },
          { id: 'supraclavicular', label: 'Supraclavicular', text: 'supraclavicular' },
          { id: 'infraclavicular', label: 'Infraclavicular', text: 'infraclavicular' },
          { id: 'supraesternal', label: 'Supraesternal', text: 'supraesternal' },
        ],
      },
      {
        id: 'torax_retraccion',
        label: 'Retracción xifoidea y dificultad respiratoria',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'sin_retraccion', label: 'Sin retracción xifoidea', text: 'sin retracción xifoidea', isNormal: true, exclusive: true },
          { id: 'xifoidea_leve', label: 'Retracción xifoidea leve', text: 'retracción xifoidea leve' },
          { id: 'xifoidea_marcada', label: 'Retracción xifoidea marcada', text: 'retracción xifoidea marcada' },
          { id: 'aleteo_nasal', label: 'Aleteo nasal', text: 'aleteo nasal' },
          { id: 'quejido', label: 'Quejido espiratorio', text: 'quejido espiratorio' },
          { id: 'disociacion', label: 'Disociación toracoabdominal', text: 'disociación toracoabdominal' },
          { id: 'musc_acc', label: 'Uso de músculos accesorios', text: 'uso de musculatura accesoria' },
        ],
      },
      {
        id: 'torax_palpacion',
        label: 'Vibraciones vocales / Palpación',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'fremito_norm', label: 'Frémito vocal conservado', text: 'vibraciones vocales conservadas', isNormal: true },
          { id: 'fremito_dism', label: 'Frémito disminuido', text: 'vibraciones vocales disminuidas' },
          { id: 'fremito_aum', label: 'Frémito aumentado', text: 'vibraciones vocales aumentadas' },
          { id: 'fremito_abol', label: 'Frémito abolido', text: 'vibraciones vocales abolidas' },
          { id: 'dolor_costal', label: 'Dolor a la palpación torácica', text: 'dolor a la palpación de pared torácica' },
          { id: 'enfisema_sub', label: 'Enfisema subcutáneo', text: 'crepitación subcutánea (enfisema subcutáneo)' },
        ],
      },
      {
        id: 'torax_percusion',
        label: 'Sonoridad pulmonar',
        phase: 'Percusión',
        mode: 'single',
        options: [
          { id: 'claro_pulm', label: 'Claro pulmonar bilateral', text: 'sonoridad clara pulmonar bilateral', isNormal: true },
          { id: 'hipersonoridad', label: 'Hipersonoridad / timpanismo', text: 'hipersonoridad pulmonar' },
          { id: 'submatidez', label: 'Submatidez', text: 'submatidez pulmonar' },
          { id: 'matidez_der', label: 'Matidez en base derecha', text: 'matidez en base pulmonar derecha' },
          { id: 'matidez_izq', label: 'Matidez en base izquierda', text: 'matidez en base pulmonar izquierda' },
          { id: 'matidez_bilat', label: 'Matidez bibasal', text: 'matidez bibasal' },
        ],
      },
      {
        id: 'torax_mv',
        label: 'Murmullo vesicular',
        phase: 'Auscultación',
        mode: 'single',
        prefix: 'murmullo vesicular ',
        options: [
          { id: 'mv_audible', label: 'Audible bilateral', text: 'audible en ambos hemitórax', isNormal: true },
          { id: 'mv_dism_bilat', label: 'Disminuido bilateral', text: 'disminuido bilateralmente' },
          { id: 'mv_dism_der', label: 'Disminuido hemitórax derecho', text: 'disminuido en hemitórax derecho' },
          { id: 'mv_dism_izq', label: 'Disminuido hemitórax izquierdo', text: 'disminuido en hemitórax izquierdo' },
          { id: 'mv_aum', label: 'Aumentado / rudo', text: 'aumentado y rudo bilateral' },
          { id: 'mv_abol_der', label: 'Abolido en base derecha', text: 'abolido en base pulmonar derecha' },
          { id: 'mv_abol_izq', label: 'Abolido en base izquierda', text: 'abolido en base pulmonar izquierda' },
          { id: 'mv_abol_bilat', label: 'Abolido bilateral', text: 'abolido bilateralmente' },
        ],
      },
      {
        id: 'torax_estertores',
        label: 'Estertores y ruidos agregados',
        phase: 'Auscultación',
        mode: 'multi',
        prefix: 'con presencia de ',
        options: [
          { id: 'sin_est', label: 'Sin agregados', text: 'sin estertores ni ruidos sobreagregados', isNormal: true, exclusive: true },
          { id: 'sibilantes', label: 'Sibilantes', text: 'sibilantes espiratorios' },
          { id: 'roncus', label: 'Roncus', text: 'roncus' },
          { id: 'crepitantes', label: 'Crepitantes', text: 'crepitantes' },
          { id: 'subcrepitantes', label: 'Subcrepitantes', text: 'subcrepitantes' },
          { id: 'bulosos', label: 'Bulosos', text: 'estertores bulosos' },
          { id: 'roce_pleural', label: 'Roce pleural', text: 'roce pleural' },
          { id: 'transmitidos', label: 'Transmitidos de VAS', text: 'ruidos transmitidos de vías aéreas superiores' },
          { id: 'estridor', label: 'Estridor inspiratorio', text: 'estridor inspiratorio' },
          { id: 'soplo_tubarico', label: 'Soplo tubárico', text: 'soplo tubárico' },
        ],
      },
    ],
  },

  cardiovascularFisico: {
    fieldKey: 'cardiovascularFisico',
    sectionType: 'fisico',
    title: 'Cardiovascular (Corazón y Vasos)',
    groups: [
      {
        id: 'cv_insp',
        label: 'Región precordial',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'normodin', label: 'Precordio normodinámico', text: 'región precordial normodinámica', isNormal: true },
          { id: 'hiperdin', label: 'Precordio hiperdinámico', text: 'región precordial hiperdinámica' },
          { id: 'apex_vis', label: 'Ápex visible', text: 'choque de punta visible' },
          { id: 'abomb_prec', label: 'Abombamiento precordial', text: 'abombamiento precordial' },
        ],
      },
      {
        id: 'cv_palp',
        label: 'Ápex, frémito y pulsos periféricos',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'apex_ok', label: 'Ápex en 4to-5to EII LMC', text: 'ápex palpable en 4to-5to espacio intercostal izquierdo LMC', isNormal: true },
          { id: 'apex_desp', label: 'Ápex desplazado', text: 'ápex desplazado por fuera de línea medioclavicular' },
          { id: 'thrill', label: 'Frémito precordial (Thrill)', text: 'frémito precordial palpable' },
          { id: 'pulsos_ok', label: 'Pulsos simétricos y amplios', text: 'pulsos periféricos y femorales presentes, simétricos y de buena amplitud', isNormal: true },
          { id: 'pulsos_deb', label: 'Pulsos débiles / filiformes', text: 'pulsos periféricos débiles/filiformes' },
          { id: 'pulsos_salt', label: 'Pulsos saltones', text: 'pulsos periféricos saltones' },
          { id: 'llenado_ok', label: 'Llenado capilar < 2 seg', text: 'llenado capilar menor a 2 segundos', isNormal: true },
          { id: 'llenado_lento', label: 'Llenado capilar > 3 seg', text: 'llenado capilar enlentecido (> 3 segundos)' },
        ],
      },
      {
        id: 'cv_ruidos',
        label: 'Ruidos cardíacos',
        phase: 'Auscultación',
        mode: 'multi',
        prefix: 'ruidos cardíacos ',
        options: [
          { id: 'rc_norm', label: 'Rítmicos y normofonéticos', text: 'rítmicos, regulares y normofonéticos', isNormal: true },
          { id: 'taquicard', label: 'Taquicárdicos', text: 'taquicárdicos' },
          { id: 'bradicard', label: 'Bradicárdicos', text: 'bradicárdicos' },
          { id: 'arritm', label: 'Arrítmicos', text: 'arrítmicos' },
          { id: 'hipofon', label: 'Hipofonéticos', text: 'hipofonéticos' },
          { id: 'hiperfon', label: 'Hiperfonéticos', text: 'hiperfonéticos' },
          { id: 'galope', label: 'Ritmo de galope (R3/R4)', text: 'con ritmo de galope' },
          { id: 'desdobl', label: 'Desdoblamiento fijo R2', text: 'con desdoblamiento fijo del segundo ruido' },
        ],
      },
      {
        id: 'cv_soplos',
        label: 'Soplos y frotes',
        phase: 'Auscultación',
        mode: 'multi',
        options: [
          { id: 'sin_soplo', label: 'Sin soplos', text: 'sin soplos audibles', isNormal: true, exclusive: true },
          { id: 'soplo_s12', label: 'Soplo sistólico I-II/VI', text: 'soplo sistólico grado I-II/VI' },
          { id: 'soplo_s34', label: 'Soplo sistólico III-IV/VI', text: 'soplo sistólico grado III-IV/VI' },
          { id: 'soplo_diast', label: 'Soplo diastólico', text: 'soplo diastólico' },
          { id: 'soplo_cont', label: 'Soplo continuo', text: 'soplo continuo' },
          { id: 'frote_peric', label: 'Frote pericárdico', text: 'frote pericárdico audible' },
        ],
      },
    ],
  },

  abdomenFisico: {
    fieldKey: 'abdomenFisico',
    sectionType: 'fisico',
    title: '11. Abdomen',
    groups: [
      {
        id: 'abd_insp',
        label: 'Forma y aspecto abdominal',
        phase: 'Inspección',
        mode: 'multi',
        prefix: 'abdomen ',
        options: [
          { id: 'plano', label: 'Plano', text: 'plano', isNormal: true },
          { id: 'globoso', label: 'Globoso', text: 'globoso' },
          { id: 'distendido', label: 'Distendido', text: 'distendido' },
          { id: 'excavado', label: 'Excavado / en batea', text: 'excavado' },
          { id: 'hernia_umb', label: 'Hernia umbilical', text: 'con hernia umbilical reductible' },
          { id: 'circ_colat', label: 'Circulación colateral', text: 'con circulación colateral' },
          { id: 'cicatriz', label: 'Cicatriz quirúrgica', text: 'con cicatriz quirúrgica' },
        ],
      },
      {
        id: 'abd_ausc',
        label: 'Ruidos hidroaéreos (RHA)',
        phase: 'Auscultación',
        mode: 'single',
        options: [
          { id: 'rha_norm', label: 'RHA normoactivos', text: 'ruidos hidroaéreos presentes y normoactivos', isNormal: true },
          { id: 'rha_aum', label: 'RHA aumentados', text: 'ruidos hidroaéreos aumentados (hiperperistaltismo)' },
          { id: 'rha_dism', label: 'RHA disminuidos', text: 'ruidos hidroaéreos disminuidos' },
          { id: 'rha_abol', label: 'RHA abolidos', text: 'ruidos hidroaéreos abolidos (silencio abdominal)' },
        ],
      },
      {
        id: 'abd_perc',
        label: 'Sonoridad abdominal',
        phase: 'Percusión',
        mode: 'single',
        options: [
          { id: 'timp_norm', label: 'Timpanismo conservado', text: 'timpanismo abdominal conservado', isNormal: true },
          { id: 'hipertimp', label: 'Hipertimpanismo difuso', text: 'hipertimpanismo difuso' },
          { id: 'matidez_desp', label: 'Matidez desplazable (ascitis)', text: 'matidez desplazable en flancos (signo de ascitis)' },
          { id: 'matidez_loc', label: 'Matidez localizada', text: 'matidez localizada' },
        ],
      },
      {
        id: 'abd_palp',
        label: 'Palpación superficial, profunda y visceromegalias',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'blando', label: 'Blando y depresible', text: 'blando, depresible e indoloro', isNormal: true },
          { id: 'dolor_dif', label: 'Doloroso difuso', text: 'doloroso a la palpación difusa' },
          { id: 'dolor_fid', label: 'Dolor en FID', text: 'doloroso a la palpación en fosa ilíaca derecha' },
          { id: 'dolor_epig', label: 'Dolor en epigastrio', text: 'doloroso en epigastrio' },
          { id: 'dolor_meso', label: 'Dolor periumbilical', text: 'doloroso en mesogastrio/periumbilical' },
          { id: 'defensa', label: 'Defensa muscular / en tabla', text: 'con defensa muscular involuntaria' },
          { id: 'blumberg', label: 'Signo de Blumberg (+)', text: 'signo de Blumberg positivo (irritación peritoneal)' },
          { id: 'murphy', label: 'Signo de Murphy (+)', text: 'signo de Murphy positivo' },
          { id: 'hepato', label: 'Hepatomegalia', text: 'hepatomegalia palpable bajo reborde costal derecho' },
          { id: 'espleno', label: 'Esplenomegalia', text: 'esplenomegalia palpable' },
          { id: 'masa', label: 'Masa palpable', text: 'masa abdominal palpable' },
        ],
      },
    ],
  },

  urinarioFisico: {
    fieldKey: 'urinarioFisico',
    sectionType: 'fisico',
    title: '12. Urinario',
    groups: [
      {
        id: 'uri_palp_perc',
        label: 'Puñopercusión y puntos ureterales',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'pp_neg', label: 'Puñopercusión negativa', text: 'puñopercusión lumbar bilateral negativa', isNormal: true },
          { id: 'pp_der', label: 'Puñopercusión (+) derecha', text: 'puñopercusión lumbar derecha positiva' },
          { id: 'pp_izq', label: 'Puñopercusión (+) izquierda', text: 'puñopercusión lumbar izquierda positiva' },
          { id: 'pp_bilat', label: 'Puñopercusión (+) bilateral', text: 'puñopercusión lumbar bilateral positiva' },
          { id: 'p_uret', label: 'Puntos ureterales dolorosos', text: 'puntos ureterales superiores/medios dolorosos' },
          { id: 'globo', label: 'Globo vesical palpable', text: 'globo vesical palpable en hipogastrio' },
          { id: 'rinon_palp', label: 'Nefromegalia palpable', text: 'riñón palpable aumentado de tamaño' },
        ],
      },
    ],
  },

  genitalesFisico: {
    fieldKey: 'genitalesFisico',
    sectionType: 'fisico',
    title: '13. Genitales',
    groups: [
      {
        id: 'gen_insp_palp',
        label: 'Hallazgos genitales',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'dermatitis', label: 'Dermatitis del pañal', text: 'eritema/dermatitis del área del pañal' },
          { id: 'balanitis', label: 'Balanopostitis', text: 'eritema y edema prepucial (balanopostitis)' },
          { id: 'fimosis', label: 'Fimosis puntiforme', text: 'fimosis puntiforme' },
          { id: 'hidrocele', label: 'Hidrocele', text: 'aumento de volumen escrotal compatible con hidrocele' },
          { id: 'criptorquidia', label: 'Criptorquidia', text: 'testículo no descendido en bolsa escrotal' },
          { id: 'hernia_ing', label: 'Hernia inguinoescrotal', text: 'hernia inguinoescrotal' },
          { id: 'dolor_test', label: 'Edema / dolor testicular', text: 'edema y dolor testicular a la palpación' },
          { id: 'eritema_vulv', label: 'Eritema vulvar', text: 'eritema vulvar' },
          { id: 'flujo_vag', label: 'Flujo vaginal / leucorrea', text: 'presencia de flujo vaginal' },
          { id: 'sinequia', label: 'Sinequia de labios menores', text: 'sinequia de labios menores' },
        ],
      },
    ],
  },

  anoRectoFisico: {
    fieldKey: 'anoRectoFisico',
    sectionType: 'fisico',
    title: '14. Ano y Recto',
    groups: [
      {
        id: 'ano_insp',
        label: 'Región perianal',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'eritema_peri', label: 'Eritema perianal', text: 'eritema perianal marcado' },
          { id: 'fisura', label: 'Fisura anal', text: 'fisura anal visible' },
          { id: 'prolapso', label: 'Prolapso rectal', text: 'prolapso de mucosa rectal' },
          { id: 'absceso', label: 'Absceso / fístula perianal', text: 'aumento de volumen inflamatorio perianal' },
          { id: 'esfinter_hipo', label: 'Esfínter hipotónico', text: 'tono de esfínter anal disminuido' },
          { id: 'sangre', label: 'Restos hemáticos / melena', text: 'restos de sangre/melena en región perianal' },
        ],
      },
    ],
  },

  huesosArticulacionesMuslosFisico: {
    fieldKey: 'huesosArticulacionesMuslosFisico',
    sectionType: 'fisico',
    title: '15. Huesos, Articulaciones y Músculos',
    groups: [
      {
        id: 'osteo_insp',
        label: 'Inspección de extremidades y columna',
        phase: 'Inspección',
        mode: 'multi',
        options: [
          { id: 'simetricas', label: 'Extremidades simétricas', text: 'extremidades simétricas y eutróficas', isNormal: true },
          { id: 'tumefaccion', label: 'Tumefacción articular', text: 'aumento de volumen/tumefacción articular' },
          { id: 'flogosis', label: 'Signos de flogosis', text: 'eritema y calor local articular' },
          { id: 'deformidad', label: 'Deformidad ósea', text: 'deformidad ósea evidente' },
          { id: 'edema_mmii', label: 'Edema en miembros inferiores', text: 'edema bilateral en miembros inferiores' },
          { id: 'claudicacion', label: 'Claudicación de la marcha', text: 'claudicación a la deambulación' },
        ],
      },
      {
        id: 'osteo_palp',
        label: 'Palpación, tono y fuerza',
        phase: 'Palpación',
        mode: 'multi',
        options: [
          { id: 'dolor_mov', label: 'Dolor a la movilización', text: 'dolor y limitación a la movilización activa y pasiva' },
          { id: 'hipotonia', label: 'Hipotonía muscular', text: 'hipotonía muscular generalizada' },
          { id: 'hipertonia', label: 'Hipertonía / espasticidad', text: 'hipertonía muscular' },
          { id: 'fuerza_dism', label: 'Fuerza muscular disminuida', text: 'disminución de fuerza muscular' },
          { id: 'fuerza_ok', label: 'Fuerza 5/5 conservada', text: 'fuerza muscular 5/5 en las 4 extremidades', isNormal: true },
        ],
      },
    ],
  },

  neurologicoPsiquicoFisico: {
    fieldKey: 'neurologicoPsiquicoFisico',
    sectionType: 'fisico',
    title: '16. Neurológico y Psíquico',
    groups: [
      {
        id: 'neuro_conciencia',
        label: 'Estado de conciencia',
        phase: 'Valoración',
        mode: 'single',
        options: [
          { id: 'alerta', label: 'Consciente, alerta y orientado', text: 'paciente consciente, alerta y orientado', isNormal: true },
          { id: 'irritable', label: 'Irritable / llanto inconsolable', text: 'irritable con llanto de difícil consuelo' },
          { id: 'somnoliento', label: 'Somnoliento (despierta al estímulo)', text: 'somnoliento, despierta al estímulo verbal/táctil' },
          { id: 'estuporoso', label: 'Estuporoso / obnubilado', text: 'estuporoso, responde solo a estímulos dolorosos' },
          { id: 'comatoso', label: 'Comatoso', text: 'en estado de coma' },
        ],
      },
      {
        id: 'neuro_signos',
        label: 'Signos meníngeos, focalidad y reflejos',
        phase: 'Valoración',
        mode: 'multi',
        options: [
          { id: 'sin_meningeos', label: 'Sin signos meníngeos', text: 'sin signos de irritación meníngea', isNormal: true },
          { id: 'rigidez_nuca', label: 'Rigidez de nuca (+)', text: 'rigidez de nuca presente' },
          { id: 'kernig', label: 'Kernig (+)', text: 'signo de Kernig positivo' },
          { id: 'brudzinski', label: 'Brudzinski (+)', text: 'signo de Brudzinski positivo' },
          { id: 'postictal', label: 'Estado postictal / convulsiones', text: 'en período postictal posterior a crisis convulsiva' },
          { id: 'focalidad', label: 'Déficit motor focal / hemiparesia', text: 'déficit motor focal' },
          { id: 'hiporreflexia', label: 'Hiporreflexia', text: 'reflejos osteotendinosos disminuidos (hiporreflexia)' },
          { id: 'hiperreflexia', label: 'Hiperreflexia / clonus', text: 'hiperreflexia osteotendinosa' },
          { id: 'ataxia', label: 'Ataxia', text: 'ataxia / alteración de la coordinación' },
        ],
      },
    ],
  },

  sensorialesFisico: {
    fieldKey: 'sensorialesFisico',
    sectionType: 'fisico',
    title: '17. Sensoriales',
    groups: [
      {
        id: 'sens_hallazgos',
        label: 'Alteraciones sensoriales',
        phase: 'Valoración',
        mode: 'multi',
        options: [
          { id: 'sens_norm', label: 'Visión, audición y tacto conservados', text: 'agudeza visual, auditiva y sensibilidad táctil conservadas', isNormal: true, exclusive: true },
          { id: 'vis_dism', label: 'Disminución agudeza visual', text: 'disminución de la agudeza visual' },
          { id: 'fotofobia', label: 'Fotofobia', text: 'fotofobia' },
          { id: 'hipoacusia', label: 'Hipoacusia / respuesta auditiva disminuida', text: 'respuesta auditiva disminuida' },
          { id: 'hipoestesia', label: 'Hipoestesia / parestesias', text: 'hipoestesia/parestesias' },
          { id: 'hiperestesia', label: 'Hiperestesia / alodinia', text: 'hiperestesia cutánea' },
        ],
      },
    ],
  },
};

export function getQuickFillSection(
  sectionType: 'funcional' | 'fisico',
  fieldKey: string
): ExamQuickFillSection | null {
  return sectionType === 'funcional'
    ? EXAMEN_FUNCIONAL_QUICK_FILL[fieldKey] || null
    : EXAMEN_FISICO_QUICK_FILL[fieldKey] || null;
}
