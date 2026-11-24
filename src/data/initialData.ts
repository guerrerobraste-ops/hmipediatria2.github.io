import type { Patient, Bed, PersonalTask, HistoriaClinicaPediatrica } from '../types/index.ts';

// Age Group Type
export type PediatricAgeGroup = 'lactante' | 'preescolar' | 'escolar' | 'adolescente';

export function determinePediatricAgeGroup(ageStr?: string): PediatricAgeGroup {
  if (!ageStr) return 'lactante';
  const lower = ageStr.toLowerCase().trim();

  // 1. Check for years first! (e.g. "5 años", "5 años y 10 días", "5a", "1 año")
  const matchYears = lower.match(/(\d+)\s*(?:año|ano|a(?:ñ|n)os?|\ba\b)/);
  if (matchYears) {
    const years = parseInt(matchYears[1], 10);
    if (years < 2) return 'lactante';
    if (years <= 5) return 'preescolar';
    if (years <= 11) return 'escolar';
    return 'adolescente';
  }

  // 2. Check for months (e.g. "8 meses", "18 meses", "8m")
  const matchMonths = lower.match(/(\d+)\s*(?:mes|meses|\bm\b)/);
  if (matchMonths) {
    const months = parseInt(matchMonths[1], 10);
    if (months < 24) return 'lactante';
    if (months <= 60) return 'preescolar';
    if (months <= 132) return 'escolar';
    return 'adolescente';
  }

  // 3. Check for days (without years or months) (e.g. "15 días", "25 dias", "10d")
  if (lower.includes('día') || lower.includes('dia') || lower.includes('d')) {
    return 'lactante';
  }

  // 4. Raw numeric input (e.g. user types "5" or "10")
  const num = parseInt(lower.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    if (num < 2) return 'lactante';
    if (num <= 5) return 'preescolar';
    if (num <= 11) return 'escolar';
    return 'adolescente';
  }

  return 'lactante';
}

export function getPediatricAgeGroupLabel(ageStr?: string): string {
  if (!ageStr) return 'Lactante';
  const lower = ageStr.toLowerCase().trim();

  const matchDays = lower.match(/(\d+)\s*(?:día|dia|días|dias|\bd\b)/);
  if (matchDays) {
    const days = parseInt(matchDays[1], 10);
    if (days <= 28) return 'Neonato';
    return 'Lactante Menor';
  }

  const matchMonths = lower.match(/(\d+)\s*(?:mes|meses|\bm\b)/);
  if (matchMonths) {
    const months = parseInt(matchMonths[1], 10);
    if (months <= 12) return 'Lactante Menor';
    if (months <= 24) return 'Lactante Mayor';
    if (months <= 60) return 'Preescolar';
    if (months <= 132) return 'Escolar';
    return 'Adolescente';
  }

  const matchYears = lower.match(/(\d+)\s*(?:año|ano|años|anos|\ba\b)/);
  if (matchYears) {
    const years = parseInt(matchYears[1], 10);
    if (years < 1) return 'Lactante Menor';
    if (years < 2) return 'Lactante Mayor';
    if (years <= 5) return 'Preescolar';
    if (years <= 11) return 'Escolar';
    return 'Adolescente';
  }

  const num = parseInt(lower.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    if (num < 1) return 'Lactante Menor';
    if (num < 2) return 'Lactante Mayor';
    if (num <= 5) return 'Preescolar';
    if (num <= 11) return 'Escolar';
    return 'Adolescente';
  }

  return 'Lactante';
}

export function calculatePediatricPercentiles(
  pesoStr?: string,
  tallaStr?: string,
  ageStr?: string,
  gender?: string
): { pesoEdad: string; tallaEdad: string; pesoTalla: string } {
  const peso = parseFloat((pesoStr || '').replace(',', '.'));
  const talla = parseFloat((tallaStr || '').replace(',', '.'));

  if (isNaN(peso) && isNaN(talla)) {
    return { pesoEdad: 'P50', tallaEdad: 'P50', pesoTalla: 'P50' };
  }

  let months = 12;
  if (ageStr) {
    const lower = ageStr.toLowerCase().trim();
    const matchYears = lower.match(/(\d+)\s*(?:año|ano|años|anos|\ba\b)/);
    const matchMonths = lower.match(/(\d+)\s*(?:mes|meses|\bm\b)/);
    const matchDays = lower.match(/(\d+)\s*(?:día|dia|días|dias|\bd\b)/);

    if (matchYears) {
      months = parseInt(matchYears[1], 10) * 12;
    } else if (matchMonths) {
      months = parseInt(matchMonths[1], 10);
    } else if (matchDays) {
      months = parseInt(matchDays[1], 10) / 30;
    } else {
      const num = parseInt(lower.replace(/\D/g, ''), 10);
      if (!isNaN(num)) months = num <= 18 ? num : num * 12;
    }
  }

  const isMale = gender === 'niño' || gender === 'M';

  let medianWeight = 10;
  if (months <= 1) medianWeight = isMale ? 3.8 : 3.6;
  else if (months <= 6) medianWeight = 3.5 + months * 0.7;
  else if (months <= 12) medianWeight = 7.5 + (months - 6) * 0.45;
  else if (months <= 60) medianWeight = 10 + (months - 12) * 0.18;
  else medianWeight = 18.5 + (months - 60) * 0.25;

  let medianHeight = 75;
  if (months <= 1) medianHeight = isMale ? 51 : 50;
  else if (months <= 12) medianHeight = 50 + months * 2.1;
  else if (months <= 60) medianHeight = 75 + (months - 12) * 0.73;
  else medianHeight = 110 + (months - 60) * 0.46;

  const formatPercentile = (actual: number, median: number): string => {
    if (isNaN(actual) || actual <= 0) return 'P50';
    const ratio = actual / median;
    if (ratio < 0.8) return '< P3';
    if (ratio < 0.87) return 'P3 - P10';
    if (ratio < 0.93) return 'P10 - P25';
    if (ratio < 0.97) return 'P25 - P50';
    if (ratio >= 0.97 && ratio <= 1.03) return 'P50';
    if (ratio <= 1.07) return 'P50 - P75';
    if (ratio <= 1.14) return 'P75 - P90';
    if (ratio <= 1.22) return 'P90 - P97';
    return '> P97';
  };

  const pesoEdad = !isNaN(peso) ? formatPercentile(peso, medianWeight) : 'P50';
  const tallaEdad = !isNaN(talla) ? formatPercentile(talla, medianHeight) : 'P50';

  let pesoTalla = 'P50';
  if (!isNaN(peso) && !isNaN(talla) && talla > 0) {
    const expectedWeightForHeight = Math.pow(talla / 100, 2) * (isMale ? 16.5 : 16.2);
    pesoTalla = formatPercentile(peso, expectedWeightForHeight);
  }

  return { pesoEdad, tallaEdad, pesoTalla };
}

export function getPediatricNormalFunctionalExam(ageStr?: string, gender?: 'niño' | 'niña' | 'M' | 'F'): Record<string, string> {
  const isMale = gender === 'niño' || gender === 'M';
  const group = determinePediatricAgeGroup(ageStr);

  let neuroFunc = '';
  let cardioFunc = '';
  let respFunc = '';
  let gastroFunc = '';
  let osteoFunc = '';
  let bocaFunc = '';
  let genitoFunc = '';

  if (group === 'lactante') {
    neuroFunc = 'Madre niega: Irritabilidad inconsolable, somnolencia extrema, sobresaltos anormales, convulsiones o retraso en pautas motoras (sostén cefálico/sedestación).';
    cardioFunc = 'Madre niega: Fatiga o sudoración profusa con la lactancia/succión, pausas en la alimentación, cianosis perioral con el llanto o frialdad distal.';
    respFunc = 'Madre niega: Estridor inspiratorio, quejido respiratorio, aleteo nasal, tos en accesos, sibilancias o dificultad respiratoria en reposo.';
    gastroFunc = 'Madre niega: Regurgitaciones patológicas frecuentes, vómitos lácteos explosivos, cólicos severos, diarrea, constipación o rechazo a la toma.';
    osteoFunc = 'Madre niega: Asimetría o limitación en el movimiento de extremidades, resistencia o llanto al cambiar pañal o movilizar miembros.';
    bocaFunc = 'Madre niega: Dificultad para el agarre del pezón o mamadera, dolor al succionar, sangrado gingival o lesiones blanquecinas en mucosa oral (Monilia).';
    genitoFunc = isMale
      ? 'Madre niega: Llanto al orinar, orinas oscuras o fétidas, pañales secos prolongados (>6 horas), chorro débil o inflamación escrotal.'
      : 'Madre niega: Llanto al orinar, orinas concentradas o fétidas, pañales secos prolongados (>6 horas), flujo vaginal o eritema vulvar.';
  } else if (group === 'preescolar') {
    neuroFunc = 'Madre niega: Convulsiones, alteraciones en la marcha, regresión en pautas del lenguaje o control de esfínteres, terrores nocturnos o cambios bruscos de conducta.';
    cardioFunc = 'Madre niega: Fatiga fácil ante el juego activo habitual, dolor precordial, palpitaciones o síncope.';
    respFunc = 'Madre niega: Tos persistente diurna o nocturna, sibilancias recurrentes ("pecho apretado"), tirajes o dificultad respiratoria al correr.';
    gastroFunc = 'Madre niega: Vómitos recurrentes, dolor abdominal periumbilical, diarreas, constipación, encopresis o anorexia.';
    osteoFunc = 'Madre niega: Claudicación o cojera de la marcha, caídas frecuentes, dolores osteoarticulares o deformidades posturales.';
    bocaFunc = 'Madre niega: Odontalgias en dentición temporal, sangrado de encías, halitosis, bruxismo o disfagia.';
    genitoFunc = isMale
      ? 'Madre niega: Disuria, polaquiuria, enuresis nocturna secundaria, chorro miccional entrecortado, dolor testicular o hematuria.'
      : 'Madre niega: Disuria, polaquiuria, incontinencia urinaria diurna o nocturna, prurito vulvar o secreciones genitales.';
  } else if (group === 'escolar') {
    neuroFunc = 'Madre/Paciente niega: Cefalea matutina o pulsátil, mareos, síncope, convulsiones, dificultades de aprendizaje escolar o trastornos del sueño.';
    cardioFunc = 'Paciente niega: Palpitaciones, disnea de esfuerzo ante actividades deportivas, dolor u opresión torácica o mareos al incorporarse.';
    respFunc = 'Madre/Paciente niega: Disnea de esfuerzo, tos con expectoración, opresión torácica, silbidos respiratorios o necesidad de nebulizaciones frecuentes.';
    gastroFunc = 'Paciente niega: Dolor abdominal recurrente, náuseas, vómitos, pirosis, diarrea, estreñimiento o alteraciones del apetito.';
    osteoFunc = 'Paciente niega: Dolores de crecimiento incapacitantes, artralgias, tumefacción articular, dolor en columna o dificultad para la actividad física.';
    bocaFunc = 'Madre niega: Dolor en piezas dentarias en recambio, caries activas dolorosas, sangrado gingival al cepillado o dificultad masticatoria.';
    genitoFunc = isMale
      ? 'Madre/Paciente niega: Disuria, polaquiuria, enuresis, dolor testicular o genital, hematuria o dificultad miccional.'
      : 'Madre/Paciente niega: Disuria, polaquiuria, dolor hipogástrico, hematuria, prurito o flujo vaginal.';
  } else {
    // Adolescente
    neuroFunc = 'Paciente niega: Cefalea tensional o migrañosa, mareos, vértigo, síncope, crisis convulsivas, trastornos del sueño o déficit de concentración.';
    cardioFunc = 'Paciente niega: Palpitaciones paroxísticas, dolor precordial, opresión torácica durante el ejercicio o mareos al estar de pie prolongado.';
    respFunc = 'Paciente niega: Disnea de esfuerzo, tos crónica, hemoptisis, opresión en el pecho o ruidos respiratorios audibles.';
    gastroFunc = 'Paciente niega: Epigastralgia, pirosis, reflujo gastroesofágico, náuseas, vómitos, intolerancias alimentarias o alteración en el ritmo evacuatorio.';
    osteoFunc = 'Paciente niega: Dolores articulares post-ejercicio, lumbalgia, artralgias o limitación en arcos de movilidad.';
    bocaFunc = 'Paciente niega: Odontalgia, dolor en terceros molares, gingivorragia, aftas bucales recurrentes o disfagia.';
    genitoFunc = isMale
      ? 'Paciente niega: Disuria, polaquiuria, dolor escrotal o testicular, hematuria, secreciones uretrales patológicas o nicturia.'
      : 'Paciente niega: Disuria, polaquiuria, dolor pélvico o lumbar, hematuria o prurito genital.';
  }

  return {
    examenFuncionalGeneral: 'Madre niega: Fiebre, pérdida o aumento anómalo de peso, astenia, sudoración nocturna, temblores u otros síntomas generales.',
    pielFuncional: 'Madre niega: Cianosis, edemas, erupciones cutáneas, ictericia, prurito o lesiones dermatológicas.',
    cabezaFuncional: 'Madre niega: Cefalea, mareos, síncope, traumatismos craneoencefálicos o caída excesiva de cabello.',
    ojosFuncional: 'Madre niega: Alteraciones en agudeza visual, fotofobia, secreciones oculares o estrabismo.',
    oidosFuncional: 'Madre niega: Otalgia, otorrea, hipoacusia o ruidos anormales.',
    narizFuncional: 'Madre niega: Rinorrea anterior o posterior, epistaxis, congestión nasal frecuente o estornudos en salva.',
    bocaFuncional: bocaFunc,
    respiratorioFuncional: respFunc,
    osteomioarticularFuncional: osteoFunc,
    cardiovascularFuncional: cardioFunc,
    gastrointestinalFuncional: gastroFunc,
    genitourinarioFuncional: genitoFunc,
    ginecologicosFuncional: isMale
      ? 'No aplica por corresponder al sexo masculino.'
      : group === 'adolescente'
      ? 'Menarquia, ritmo menstrual y antecedentes gineco-obstétricos acordes a edad cronológica; niega leucorrea patológica o dismenorrea severa.'
      : 'Prepuberal. Madre niega flujo genital, sinequia de labios menores o sangrado vaginal.',
    nerviosoCentralFuncional: neuroFunc
  };
}

export function getPediatricNormalPhysicalExam(ageStr?: string, gender?: 'niño' | 'niña' | 'M' | 'F'): Record<string, string> {
  const isMale = gender === 'niño' || gender === 'M';
  const group = determinePediatricAgeGroup(ageStr);
  const ageGroupLabel = getPediatricAgeGroupLabel(ageStr);

  let estadoGeneralText = `Paciente (${ageGroupLabel}) en regulares condiciones generales, afebril, eupneico, normohidratado, activo, reactivo y colaborador con el examen físico. Estado nutricional y pondoestatural acorde a edad y sexo.`;
  let cabezaText = '';
  let bocaText = '';
  let toraxText = '';
  let cardiovascularText = '';
  let abdomenText = '';
  let osteoText = '';
  let genitalesText = '';
  let neuroText = '';
  let sensorialText = '';

  if (group === 'lactante') {
    estadoGeneralText = 'Lactante en regulares condiciones generales, afebril al tacto, eupneico, normohidratado, vigil y reactivo a estímulos del entorno. Desarrollo pondoestatural adecuado para edad cronológica y sexo.';
    cabezaText = 'Normocéfala, simétrica, sin exostosis ni deformidades. Fontanela anterior normotensa (abierta ~1.5 x 1.5 cm en lactante menor o permeable cerrando en lactante mayor), fontanela posterior cerrada o puntiforme. Suturas afrontadas. Perímetro cefálico acorde a percentil para edad. Ausencia de craneotabes.';
    bocaText = 'Aliento no fétido. Labios simétricos, normohidratados, sin fisuras ni queilitis. Encías de coloración rosada normal. Dentición primaria en erupción o ausente acorde a meses de edad. Mucosa bucal y lingual húmedas, sin algodoncillo (Monilia) ni aftas. Reflejo de succión y deglución normales.';
    toraxText = 'Tórax simétrico, cilíndrico, normoexpansible. Ausencia de tiraje intercostal, subcostal o retracción xifoidea. Murmullo vesicular audible en ambos hemitórax, sin estertores, roncus ni sibilancias. Frecuencia respiratoria dentro de límites normales para lactante (30-40 rpm).';
    cardiovascularText = 'Región precordial normodinámica, ápex no visible, palpable en 4to espacio intercostal izquierdo con línea medioclavicular (4to EII LMC). Ruidos cardíacos rítmicos, regulares y normofonéticos, sin soplos audibles ni galope. Pulsos periféricos y femorales presentes, simétricos y de buena amplitud. Llenado capilar menor a 2 segundos. Frecuencia cardíaca acorde a lactante (110-150 lpm).';
    abdomenText = 'Ligeramente globoso por características anatómicas del lactante, blando, depresible, no doloroso a la palpación superficial ni profunda. Peristaltismo presente y normoactivo. Cicatriz umbilical limpia y cerrada sin signos de infección ni hernia incarcerada. Hígado palpable a 1-2 cm bajo reborde costal (hallazgo fisiológico en lactantes). Bazo no palpable.';
    osteoText = 'Extremidades simétricas, móviles, tono y trofismo adecuados. Maniobras de Ortolani y Barlow negativas, caderas estables, pliegues glúteos e inguinales simétricos. Sin deformidades óseas ni limitaciones articulares.';
    neuroText = 'Lactante activo, reactivo a estímulos auditivos y visuales, conecta con el examinador y su madre. Reflejos arcaicos (Moro, succión, prensión palmar y plantar) presentes o en proceso de integración acorde a meses cumplidos. Sostén y tono muscular acordes a sus hitos de desarrollo psicomotor. Llanto enérgico y consolable.';
    sensorialText = 'Fijación y seguimiento visual de objetos y rostros presentes. Respuesta auditiva conservada con parpadeo o giro cefálico ante sonidos. Sensibilidad táctil conservada.';
  } else if (group === 'preescolar') {
    estadoGeneralText = 'Paciente preescolar en regulares condiciones generales, afebril, eupneico, normohidratado, activo, reactivo y colaborador con el examen físico. Estado nutricional y pondoestatural acorde a edad y sexo.';
    cabezaText = 'Normocéfala, simétrica, sin exostosis ni hundimientos. Fontanelas completamente cerradas, suturas consolidadas. Facies simétrica y colaboradora. Circunferencia cefálica dentro de percentiles esperados.';
    bocaText = 'Aliento no fétido. Labios rosados, íntegros. Dentición decidua (temporal) completa (20 piezas), sin caries evidentes ni defectos de esmalte. Encías sanas sin sangrado. Faringe y amígdalas Grado I-II sin placas exudativas.';
    toraxText = 'Tórax simétrico, normoexpansible. Expansión torácica simétrica sin tirajes ni dificultad respiratoria. Murmullo vesicular audible y limpio en ambos campos pulmonares, sin ruidos adventicios. Frecuencia respiratoria normal para edad preescolar (20-30 rpm).';
    cardiovascularText = 'Región precordial normodinámica, ápex no visible, palpable en 4to-5to espacio intercostal izquierdo con línea medioclavicular. Ruidos cardíacos rítmicos, regulares y de buen tono, sin soplos ni desdoblamientos patológicos. Pulsos periféricos simétricos y sincrónicos. Llenado capilar menor a 2 segundos. Frecuencia cardíaca acorde a edad preescolar (90-120 lpm).';
    abdomenText = 'Blando, suave, depresible, no doloroso a la palpación superficial ni profunda. Ruidos hidroaéreos normales. Sin visceromegalias (hígado y bazo no palpables) ni masas palpables.';
    osteoText = 'Extremidades simétricas, normotróficas. Marcha independiente simétrica y coordinada. Arcos de movilidad articular activos y pasivos conservados sin dolor ni limitación. Genu valgo fisiológico leve acorde a la edad preescolar.';
    neuroText = 'Paciente consciente, orientado en su entorno, activo, colaborador durante el examen físico. Marcha independiente simétrica y coordinada. Lenguaje expresivo y comprensivo fluido acorde a edad cronológica. Reflejos osteotendinosos simétricos ++/++++. Sin signos meníngeos.';
    sensorialText = 'Agudeza visual y auditiva conservadas. Reconoce formas y colores, responde a estímulos auditivos suaves. Sensibilidad táctil preservada.';
  } else if (group === 'escolar') {
    estadoGeneralText = 'Paciente escolar en regulares condiciones generales, afebril, eupneico, hidratado, colaborador y comunicativo. Estado nutricional y desarrollo pondoestatural armónico para la edad y sexo.';
    cabezaText = 'Normocéfala, simétrica, sin exostosis ni deformidades. Fontanelas completamente cerradas. Cabello de adecuada implantación y distribución.';
    bocaText = 'Aliento no fétido. Labios húmedos e íntegros. Dentición mixta en recambio fisiológico, adecuada alineación e higiene bucal, sin caries activas. Encías normales. Faringe normocoloreada sin exudados.';
    toraxText = 'Tórax elíptico, simétrico, normoexpansible. Murmullo vesicular audible bilateral sin estertores ni ruidos sobreagregados. Frecuencia respiratoria adecuada para edad escolar (16-22 rpm).';
    cardiovascularText = 'Región precordial normodinámica, ápex no visible, palpable en 5to espacio intercostal izquierdo con línea medioclavicular (5to EII LMC). Ruidos cardíacos rítmicos, regulares y normofonéticos, sin soplos, frotes ni galope. Pulsos periféricos simétricos y normoamplios. Llenado capilar menor a 2 segundos. Frecuencia cardíaca normal para edad escolar (75-105 lpm).';
    abdomenText = 'Plano, blando, depresible, no doloroso a la palpación. Peristaltismo normoactivo en los cuatro cuadrantes. Hígado y bazo no palpables. Sin signos de irritación peritoneal.';
    osteoText = 'Extremidades simétricas y normoconfiguradas. Ejes óseos alineados, movilidad articular completa e indolora. Fuerza muscular 5/5 en los 4 miembros. Arcos plantares definidos, marcha normal.';
    neuroText = 'Consciente, alerta, colaborador, ubicado en tiempo, espacio y persona (3 esferas). Buen rendimiento en órdenes complejas y motricidad fina y gruesa. Reflejos osteotendinosos conservados. Sensibilidad, coordinación y pares craneales normales. Sin signos meníngeos.';
    sensorialText = 'Agudeza visual y auditiva normales bilateralmente. Campimetría por confrontación normal. Sensibilidad superficial y profunda simétrica y conservada.';
  } else {
    // Adolescente
    estadoGeneralText = 'Paciente adolescente en regulares condiciones generales, afebril, eupneico, normohidratado, colaborador y ubicado en tiempo, espacio y persona. Constitución biotipológica y desarrollo acordes a edad cronológica.';
    cabezaText = 'Normocéfala, simétrica, facies sin alteraciones. Fontanelas cerradas. Cuero cabelludo y cabello sanos.';
    bocaText = 'Aliento no fétido. Dentición permanente completa sin caries activas ni halitosis. Mucosa y encías normocoloreadas. Orofaringe sin alteraciones.';
    toraxText = 'Tórax simétrico, normoexpansible. Desarrollo muscular pectoral y torácico acorde a edad, sexo y estadio puberal. Murmullo vesicular universalmente conservado sin ruidos patológicos (FR 14-20 rpm).';
    cardiovascularText = 'Tórax precordial normodinámico, ápex no visible, palpable en 5to espacio intercostal izquierdo con línea medioclavicular (5to EII LMC). Ruidos cardíacos rítmicos, regulares y normofonéticos en los 4 focos de auscultación, sin soplos ni ruidos sobreagregados. Pulsos periféricos simétricos y sincrónicos. Llenado capilar menor a 2 segundos. Frecuencia cardíaca acorde a adolescente (60-95 lpm).';
    abdomenText = 'Plano, muscular, blando, depresible y sin dolor a la palpación. Ruidos hidroaéreos conservados. Sin organomegalias ni puntos dolorosos.';
    osteoText = 'Extremidades simétricas, desarrollo muscular y óseo adecuado para edad y sexo. Columna vertebral alineada sin cifoescoliosis, sin dolor a la palpación de apófisis espinosas. Articulaciones sin inflamación ni derrame, movilidad y fuerza 5/5 en todos los grupos musculares.';
    neuroText = 'Lúcido, orientado en las 3 esferas, pensamiento lógico formal abstracto. Marcha, equilibrio (Romberg negativo), taxia y praxia normales. Fuerza muscular (5/5) y reflejos simétricos. Sin signos de focalidad motora, sensitiva ni meníngea.';
    sensorialText = 'Agudeza visual y auditiva óptimas bilateralmente. Sensibilidad táctil, térmica y dolorosa plenamente conservadas en todos los dermatomas.';
  }

  if (isMale) {
    if (group === 'lactante') {
      genitalesText = 'Genitales masculinos acordes a lactante. Escroto normoconfigurado, ambos testículos descendidos en bolsas escrotales de tamaño y consistencia conservados. Fimosis fisiológica común a la edad, sin balanitis. Meato uretral centrado sin hipospadias. Ausencia de hidrocele o hernias inguinales.';
    } else if (group === 'preescolar' || group === 'escolar') {
      genitalesText = 'Genitales masculinos acordes a edad cronológica. Estadio Tanner G1P1 (prepuberal). Testículos en bolsas escrotales, de consistencia normal y sin dolor. Meato uretral tópico centrado. Prepucio normoconfigurado sin inflamación.';
    } else {
      genitalesText = 'Genitales masculinos en desarrollo puberal acorde a escala de Tanner (G2-G5 / P2-P5 acorde a edad cronológica). Testículos descendidos, volumen testicular acorde a estadio. Meato uretral normal sin secreciones patológicas ni adenomegalias inguinales.';
    }
  } else {
    if (group === 'lactante') {
      genitalesText = 'Genitales femeninos acordes a lactante. Labios mayores cubriendo parcialmente labios menores. Clítoris de aspecto y tamaño normal. Introito vaginal y meato permeables, sin sinequia de labios menores. Ausencia de flujo vaginal patológico ni eritema.';
    } else if (group === 'preescolar' || group === 'escolar') {
      genitalesText = 'Genitales femeninos prepuberales acordes a edad cronológica. Estadio Tanner S1P1. Labios mayores y menores simétricos sin secreciones ni lesiones vulvares. Meato urinario e introito normales.';
    } else {
      genitalesText = 'Genitales femeninos en desarrollo puberal acorde a escala de Tanner (M2-M5 / P2-P5 acorde a edad cronológica). Labios mayores y menores bien diferenciados. Sin leucorrea patológica, lesiones ni dolor.';
    }
  }

  return {
    estadoGeneralFisico: estadoGeneralText,
    pielPaniculoFanerasFisico: 'Piel: Normocoloreada, rosada, normotérmica al tacto, hidratada y suave. Turgor y elasticidad conservados, con llenado capilar menor a 2 segundos. Ausencia de palidez cutáneo-mucosa, cianosis, ictericia, petequias, equimosis ni erupciones. Panículo adiposo: Conservado y distribuido simétricamente acorde a la edad y sexo. Faneras: Uñas rosadas, lechos ungueales normoperfundidos. Cabello de buena implantación y brillo.',
    cabezaFisico: cabezaText,
    ojosFisico: 'Conjuntivas normocoloreadas, escleras anictéricas, córneas transparentes. Pupilas isocóricas y normorreactivas a la luz. Movimientos oculares conservados en todos los ejes, sin desviaciones, nistagmo, ptosis ni exoftalmos.',
    oidosFisico: 'Pabellones auriculares simétricos, de implantación normal. Conductos auditivos externos permeables, sin secreciones ni otorragia. Membranas timpánicas íntegras, nacaradas con cono luminoso presente. Regiones mastoideas sin dolor a la palpación.',
    rinofaringeFisico: 'Fosas nasales permeables, mucosas húmedas y normocoloreadas, sin secreción patológica. Tabique nasal centrado. Faringe y amígdalas sin hiperemia ni exudados.',
    bocaFisico: bocaText,
    cuelloFisico: 'Cilíndrico, simétrico y móvil, sin dolor a los movimientos. No se palpan masas ni adenopatías. Glándula tiroides no visible ni palpable. Tráquea centrada y desplazable.',
    gangliosLinfaticosFisico: 'No se palpan adenomegalias patológicas en cadenas cervicales, axilares, epitrocleares ni inguinales.',
    toraxPulmonesFisico: toraxText,
    cardiovascularFisico: cardiovascularText,
    abdomenFisico: abdomenText,
    urinarioFisico: 'Riñones no palpables. Puntos ureterales superiores y medios indoloros a la palpación. Micción espontánea presente, clara y sin signos de dolor o molestia.',
    genitalesFisico: genitalesText,
    anoRectoFisico: 'Inspección perianal sin fisuras, fístulas, prolapso, eritema perianal ni hemorroides. Esfínter anal con tono conservado.',
    huesosArticulacionesMuslosFisico: osteoText,
    neurologicoPsiquicoFisico: neuroText,
    sensorialesFisico: sensorialText
  };
}

// Official Normal Functional Examination texts (Default)
export const EXAMEN_FUNCIONAL_NORMAL: Record<string, string> = getPediatricNormalFunctionalExam('', 'niño');

// Official Normal Physical Examination texts (Default)
export const EXAMEN_FISICO_NORMAL: Record<string, string> = getPediatricNormalPhysicalExam('', 'niño');

export const INITIAL_BEDS: Bed[] = [
  // Traumashock
  { id: 'ts-1', bedNumber: 'Cama 01', area: 'Traumashock', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'ts-2', bedNumber: 'Cama 02', area: 'Traumashock', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'ts-3', bedNumber: 'Cama 03', area: 'Traumashock', status: 'free', updatedAt: new Date().toISOString() },
  
  // ÁREA DE OBSERVACIÓN
  { id: 'obs-1', bedNumber: 'Cama 01', area: 'ÁREA DE OBSERVACIÓN', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'obs-2', bedNumber: 'Cama 02', area: 'ÁREA DE OBSERVACIÓN', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'obs-3', bedNumber: 'Cama 03', area: 'ÁREA DE OBSERVACIÓN', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'obs-4', bedNumber: 'Cama 04', area: 'ÁREA DE OBSERVACIÓN', status: 'free', updatedAt: new Date().toISOString() },

  // Respiratorio
  { id: 'resp-1', bedNumber: 'Cama 01', area: 'Respiratorio', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'resp-2', bedNumber: 'Cama 02', area: 'Respiratorio', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'resp-3', bedNumber: 'Cama 03', area: 'Respiratorio', status: 'free', updatedAt: new Date().toISOString() },

  // Aisle (Aislamiento)
  { id: 'ais-1', bedNumber: 'Cama 01', area: 'Aislamiento', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'ais-2', bedNumber: 'Cama 02', area: 'Aislamiento', status: 'free', updatedAt: new Date().toISOString() },

  // Hospitalización
  { id: 'hosp-1', bedNumber: 'Cama 01', area: 'Hospitalización', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'hosp-2', bedNumber: 'Cama 02', area: 'Hospitalización', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'hosp-3', bedNumber: 'Cama 03', area: 'Hospitalización', status: 'free', updatedAt: new Date().toISOString() },
  { id: 'hosp-4', bedNumber: 'Cama 04', area: 'Hospitalización', status: 'free', updatedAt: new Date().toISOString() },
];

export const INITIAL_PATIENTS: Patient[] = [];

export const INITIAL_TASKS: PersonalTask[] = [];



export const DEFAULT_HISTORIA_CLINICA: HistoriaClinicaPediatrica = {
  id: 'hc-default-1',
  generoPatient: 'niño',
  apellidos: '',
  nombres: '',
  numHistoria: '',
  edad: '',
  fechaNacimiento: '',
  lugarNacimiento: '',
  lugarFechaNacimiento: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  procedenciaEstado: '',
  nacionalidad: '',
  ci: '',
  horaIngreso: '',
  direccionCompleta: '',
  telefono: '',
  enCasoEmergenciaVisarA: '',
  parentescoEmergencia: '',
  direccionTelefonoEmergencia: '',
  motivosAdmision: '',
  enfermedadActual: '',
  diagnosticoAdmision: '',
  medicoAdmisionFirma: '',
  medicoServicioFirma: 'Jospeth Perez',
  salidaCuracion: false,
  salidaMejoria: false,
  salidaMuerte: false,
  salidaOtrasCausas: '',
  diagnosticoClinicoFinal: '',
  intervencionTratamiento: '',
  fechaSalida: '',
  horaSalida: '',
  jefeServicioFirma: '',
  diagnosticoAnatomoPatologico: '',
  biopsia: '',
  autopsia: '',
  patientId: '',
  bedNumber: '',
  
  reglamentoFecha: '',
  reglamentoFirma1: '',
  reglamentoCI1: '',
  reglamentoParentesco1: '',
  reglamentoTestigo: '',
  reglamentoCITestigo: '',
  
  exencionFecha: '',
  exencionFirma: '',
  exencionCI: '',
  exencionParentesco: '',
  exencionTestigo: '',
  exencionCITestigo: '',
  
  // Page 3 Interrogatorio Desglosado
  antecedentesPrenatales: '',
  prenatalEdadMadre: '',
  prenatalHO_G: '0',
  prenatalHO_P: '0',
  prenatalHO_C: '0',
  prenatalHO_A: '0',
  prenatalControles: '',
  prenatalComplicaciones: '',
  prenatalSemanas: '',
  prenatalTipoParto: '',
  prenatalInstrumental: '',
  prenatalInfecciones: '',
  prenatalControlTipo: 'bien',

  periodoNeonatal: '',
  neonatalRespEspontanea: '',
  neonatalAsistenciaResp: '',
  neonatalCianosis: '',
  neonatalFiebre: '',
  neonatalVomitos: '',
  neonatalIctericia: '',
  neonatalHemorragia: '',
  neonatalConvulsiones: '',
  neonatalMalformaciones: '',
  neonatalOftalmia: '',
  neonatalCoriza: '',
  neonatalOtros: '',
  neonatalCordonDias: '',
  neonatalPesoNacer: '',
  neonatalTallaNacer: '',

  alimentacion: '',
  alimLmeMeses: '',
  alimArtificialMeses: '',
  alimMixtaMeses: '',
  alimDesteteMeses: '',
  alimCerealesMeses: '',
  alimSopasMeses: '',
  alimVegetalesMeses: '',
  alimHuevosMeses: '',
  alimCarnesMeses: '',
  alimVitaminas: '',
  alimProteinasSemana: '',
  alimVegetalesSemana: '',
  alimCarbohidratosSemana: '',
  alimDulcesSemana: '',

  desarrolloTabulador: '',
  desarrolloCabezaMeses: '',
  desarrolloSentoMeses: '',
  desarrolloParoMeses: '',
  desarrolloCaminoMeses: '',
  desarrolloEsfinterMeses: '',
  desarrolloDienteMeses: '',
  desarrolloPalabrasMeses: '',
  desarrolloGradoEscuela: '',
  desarrolloProgresoEscuela: '',
  desarrolloProgresoPeso: '',

  habitosPsicologicos: '',
  habitosSuenoNocturno: '',
  habitosSiestas: '',
  habitosJuegos: '',
  habitosSexuales: '',
  habitosDigitosuccion: '',
  habitosOnicofagia: '',
  habitosRasgosPersonales: '',
  habitosRecreacion: '',
  habitosOcupacion: '',

  inmunizacionesPruebas: '',
  vacunaViruela: '',
  vacunaTosFerina: '',
  vacunaDifteria: '',
  vacunaTetanos: '',
  vacunaTificas: '',
  vacunaBcg: '',
  vacunaPoliomielitis: '',
  vacunasOtras: '',
  pruebaTuberculina: '',
  tarjetaInn: '',

  antecedentesPersonales: '',
  apCronicas: '',
  apInfecciosas: '',
  apHospitalizaciones: '',
  apTransfusiones: '',
  apQuirurgicos: '',
  apTraumatismos: '',

  historiaFamiliar: '',
  hfMadre: '',
  hfPadre: '',
  hfHermanos: '',
  hfAbueloPaterno: '',
  hfAbuelaPaterna: '',
  hfAbueloMaterno: '',
  hfAbuelaMaterna: '',
  hfLinajeMaterno: '',
  hfLinajePaterno: '',
  
  // Page 4 Examen Funcional
  ...(EXAMEN_FUNCIONAL_NORMAL as any),
  
  // Page 5 Examen Físico Parte III Completo (Items 1 al 17) - Conforme a formato oficial
  temp: '',
  fr: '',
  fc: '',
  ta: '',
  so2: '',
  so2ConO2: '',
  peso: '',
  talla: '',
  cc: '',
  ca: '',
  ct: '',
  percentil: '',
  pesoEdad: '',
  tallaEdad: '',
  pesoTalla: '',
  
  ...(EXAMEN_FISICO_NORMAL as any),
  fechaHoraExamenFisico: `${new Date().toISOString().split('T')[0]} 08:30`,
  examenPracticadoPor: 'Dr. Brayan',
  
  // Page 6 Evaluación Socioeconómica GRAFFAR (Méndez Castellano)
  graffarProfesionJefe: '',
  graffarInstruccionMadre: '',
  graffarFuenteIngreso: '',
  graffarAlojamiento: '',
  graffarScoreA: 0,
  graffarScoreB: 0,
  graffarScoreC: 0,
  graffarScoreD: 0,
  graffarPuntajeTotal: 0,
  graffarEstrato: '',
  graffarResultado: '',
  
  laboratoriosColumnas: [],
  laboratoriosOtros: '',

  // Page 8: Resumen de Ingreso
  resumenMotivoConsulta: '',
  resumenHistoriaEnfermedad: '',
  resumenAntecedentesObstetricos: '',
  resumenInmunizaciones: '',
  resumenPatologicosPersonales: '',
  resumenMadre: '',
  resumenAbuelaMaterna: '',
  resumenAbueloMaterno: '',
  resumenPadre: '',
  resumenAbuelaPaterna: '',
  resumenAbueloPaterno: '',
  resumenHermanos: '',
  resumenExamenPeso: '',
  resumenExamenTalla: '',
  resumenExamenFr: '',
  resumenExamenFc: '',
  resumenExamenTemp: '',
  resumenExamenSo2: '',
  resumenExamenTa: '',
  resumenExamenTe: '',
  resumenExamenPt: '',
  resumenPercentilPe: '',
  resumenPercentilPt: '',
  resumenLabLeu: '',
  resumenLabSeg: '',
  resumenLabLin: '',
  resumenLabMon: '',
  resumenLabHb: '',
  resumenLabHto: '',
  resumenLabVcm: '',
  resumenLabHcm: '',
  resumenLabPlt: '',
  resumenLabVsg: '',
  resumenLabPcr: '',
  resumenRxTorax: '',
  resumenDiagnosticosIngreso: '',
  resumenComentario: '',
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
