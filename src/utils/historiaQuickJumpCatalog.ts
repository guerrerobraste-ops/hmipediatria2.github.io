export interface HistoriaQuickJumpItem {
  id: string;
  label: string;
  page: number;
  /** DOM id (e.g. 'sec-fisico-toraxPulmonesFisico') or CSS selector (e.g. '[data-tutorial="p1-motivos"]') */
  target?: string;
  keywords?: string;
}

export interface HistoriaQuickJumpGroup {
  id: string;
  page: number;
  title: string;
  shortTitle: string;
  items: HistoriaQuickJumpItem[];
}

export const HISTORIA_QUICK_JUMP_GROUPS: HistoriaQuickJumpGroup[] = [
  {
    id: 'page-1',
    page: 1,
    title: 'Pág. 1 · Filiación y Admisión',
    shortTitle: 'Filiación y Admisión',
    items: [
      { id: 'p1-datos', label: 'Datos del Paciente (Sexo, Nombre, N° Historia)', page: 1, target: '[data-tutorial="p1-sexo"]', keywords: 'filiacion nombre apellido cedula sexo' },
      { id: 'p1-nacimiento', label: 'Nacimiento, Edad y Fecha de Ingreso', page: 1, target: '[data-tutorial="p1-nacimiento-edad"]', keywords: 'fecha nacimiento edad ingreso hora' },
      { id: 'p1-contacto', label: 'Dirección, Teléfono y Contacto de Emergencia', page: 1, target: '[data-tutorial="p1-direccion-telefono"]', keywords: 'direccion telefono emergencia representante' },
      { id: 'p1-motivos', label: 'Motivo(s) de Admisión', page: 1, target: '[data-tutorial="p1-motivos"]', keywords: 'motivo consulta ingreso sintomas' },
      { id: 'p1-enfermedad-actual', label: 'Enfermedad Actual', page: 1, target: '[data-tutorial="p1-enfermedad-actual"]', keywords: 'enfermedad actual relato historia' },
      { id: 'p1-diagnosticos', label: 'Diagnóstico de Admisión', page: 1, target: '[data-tutorial="p1-diagnosticos"]', keywords: 'diagnostico dx ingreso principal' },
      { id: 'p1-firmas', label: 'Firmas Médicas Oficiales', page: 1, target: '[data-tutorial="p1-firmas"]', keywords: 'firma medico admision servicio jospeth perez' },
    ],
  },
  {
    id: 'page-2',
    page: 2,
    title: 'Pág. 2 · Reglamento de Hospitalización',
    shortTitle: 'Reglamento',
    items: [
      { id: 'p2-reglamento', label: 'Aceptación del Reglamento y Exención (Responsable)', page: 2, target: '[data-tutorial="p2-reglamento-nombre"]', keywords: 'reglamento responsable cedula parentesco exencion' },
    ],
  },
  {
    id: 'page-3',
    page: 3,
    title: 'Pág. 3 · Interrogatorio Pediátrico (8 Acápites)',
    shortTitle: 'Interrogatorio',
    items: [
      { id: 'sec-interrogatorio-1-prenatal', label: '1. Antecedentes Prenatales y Obstétricos', page: 3, target: 'sec-interrogatorio-1-prenatal', keywords: 'embarazo gesta prenatal obstetrico control' },
      { id: 'sec-interrogatorio-2-neonatal', label: '2. Período Neonatal', page: 3, target: 'sec-interrogatorio-2-neonatal', keywords: 'parto cesarea peso talla apgar neonatal' },
      { id: 'sec-interrogatorio-3-alimentacion', label: '3. Alimentación', page: 3, target: 'sec-interrogatorio-3-alimentacion', keywords: 'lactancia materna formula ablactacion dieta' },
      { id: 'sec-interrogatorio-4-desarrollo', label: '4. Desarrollo Psicomotor', page: 3, target: 'sec-interrogatorio-4-desarrollo', keywords: 'sosten cefalico marcha lenguaje desarrollo' },
      { id: 'sec-interrogatorio-5-habitos', label: '5. Hábitos Psicobiológicos', page: 3, target: 'sec-interrogatorio-5-habitos', keywords: 'sueno evacuaciones micciones habitos' },
      { id: 'sec-interrogatorio-6-inmunizaciones', label: '6. Inmunizaciones y Pruebas', page: 3, target: 'sec-interrogatorio-6-inmunizaciones', keywords: 'vacunas esquema inmunizaciones bcg pentavalente' },
      { id: 'sec-interrogatorio-7-personales', label: '7. Ant. Patológicos Personales', page: 3, target: 'sec-interrogatorio-7-personales', keywords: 'alergias cirugias hospitalizaciones patologicos' },
      { id: 'sec-interrogatorio-8-familiares', label: '8. Historia Familiar', page: 3, target: 'sec-interrogatorio-8-familiares', keywords: 'madre padre hermanos abuelos familiar' },
    ],
  },
  {
    id: 'page-4',
    page: 4,
    title: 'Pág. 4 · Examen Funcional (14 Sistemas)',
    shortTitle: 'Examen Funcional',
    items: [
      { id: 'sec-funcional-examenFuncionalGeneral', label: '1. Examen Funcional General', page: 4, target: 'sec-funcional-examenFuncionalGeneral', keywords: 'fiebre apetito astenia general' },
      { id: 'sec-funcional-pielFuncional', label: '2. Piel', page: 4, target: 'sec-funcional-pielFuncional', keywords: 'rash eritema prurito piel' },
      { id: 'sec-funcional-cabezaFuncional', label: '3. Cabeza', page: 4, target: 'sec-funcional-cabezaFuncional', keywords: 'cefalea mareos cabeza' },
      { id: 'sec-funcional-ojosFuncional', label: '4. Ojos', page: 4, target: 'sec-funcional-ojosFuncional', keywords: 'secrecion lagrimeo ojos vision' },
      { id: 'sec-funcional-oidosFuncional', label: '5. Oídos', page: 4, target: 'sec-funcional-oidosFuncional', keywords: 'otalgia otorrea oidos' },
      { id: 'sec-funcional-narizFuncional', label: '6. Nariz', page: 4, target: 'sec-funcional-narizFuncional', keywords: 'rinorrea congestion epistaxis nariz' },
      { id: 'sec-funcional-bocaFuncional', label: '7. Boca', page: 4, target: 'sec-funcional-bocaFuncional', keywords: 'odinofagia disfagia boca garganta' },
      { id: 'sec-funcional-respiratorioFuncional', label: '8. Respiratorio', page: 4, target: 'sec-funcional-respiratorioFuncional', keywords: 'tos disnea sibilancias respiratorio' },
      { id: 'sec-funcional-osteomioarticularFuncional', label: '9. Osteomioarticular', page: 4, target: 'sec-funcional-osteomioarticularFuncional', keywords: 'artralgias mialgias huesos articulaciones' },
      { id: 'sec-funcional-cardiovascularFuncional', label: '10. Cardiovascular', page: 4, target: 'sec-funcional-cardiovascularFuncional', keywords: 'palpitaciones cianosis cardiovascular' },
      { id: 'sec-funcional-gastrointestinalFuncional', label: '11. Gastrointestinal', page: 4, target: 'sec-funcional-gastrointestinalFuncional', keywords: 'vomitos diarrea dolor abdominal gastrointestinal' },
      { id: 'sec-funcional-genitourinarioFuncional', label: '12. Genitourinario', page: 4, target: 'sec-funcional-genitourinarioFuncional', keywords: 'disuria oliguria orina genitourinario' },
      { id: 'sec-funcional-ginecologicosFuncional', label: '13. Ginecológicos', page: 4, target: 'sec-funcional-ginecologicosFuncional', keywords: 'menarquia flujo ginecologicos' },
      { id: 'sec-funcional-nerviosoCentralFuncional', label: '14. Nervioso Central', page: 4, target: 'sec-funcional-nerviosoCentralFuncional', keywords: 'convulsiones somnolencia irritabilidad neurologico' },
    ],
  },
  {
    id: 'page-5',
    page: 5,
    title: 'Pág. 5 · Examen Físico Completo (17 Ítems)',
    shortTitle: 'Examen Físico',
    items: [
      { id: 'p5-signos-vitales', label: 'Signos Vitales de Ingreso (T°, FR, FC, TA, SO₂)', page: 5, target: '[data-tutorial="p5-signos-vitales"]', keywords: 'signos vitales temperatura saturacion tension' },
      { id: 'p5-antropometria', label: 'Antropometría & Percentiles OMS (Peso, Talla, CC, CA, CT)', page: 5, target: '[data-tutorial="p5-antropometria-peso-talla"]', keywords: 'peso talla percentiles antropometria cefalico' },
      { id: 'sec-fisico-estadoGeneralFisico', label: '1. Estado General', page: 5, target: 'sec-fisico-estadoGeneralFisico', keywords: 'estado general hidratacion facies' },
      { id: 'sec-fisico-pielPaniculoFanerasFisico', label: '2. Piel, Panículo Adiposo y Faneras', page: 5, target: 'sec-fisico-pielPaniculoFanerasFisico', keywords: 'piel llenado capilar petequias ictericia' },
      { id: 'sec-fisico-cabezaFisico', label: '3. Cabeza', page: 5, target: 'sec-fisico-cabezaFisico', keywords: 'cabeza fontanela normocefalo' },
      { id: 'sec-fisico-ojosFisico', label: '4. Ojos', page: 5, target: 'sec-fisico-ojosFisico', keywords: 'ojos pupilas conjuntivas' },
      { id: 'sec-fisico-oidosFisico', label: '5. Oídos', page: 5, target: 'sec-fisico-oidosFisico', keywords: 'oidos otoscopia timpano' },
      { id: 'sec-fisico-rinofaringeFisico', label: '6. Rinofaringe', page: 5, target: 'sec-fisico-rinofaringeFisico', keywords: 'nariz fosas nasales rinofaringe' },
      { id: 'sec-fisico-bocaFisico', label: '7. Boca', page: 5, target: 'sec-fisico-bocaFisico', keywords: 'boca mucosa oral amigdalas faringe' },
      { id: 'sec-fisico-cuelloFisico', label: '8. Cuello', page: 5, target: 'sec-fisico-cuelloFisico', keywords: 'cuello rigidez nuca tiroides' },
      { id: 'sec-fisico-gangliosLinfaticosFisico', label: '9. Ganglios Linfáticos', page: 5, target: 'sec-fisico-gangliosLinfaticosFisico', keywords: 'ganglios adenopatias linfaticos' },
      { id: 'sec-fisico-toraxPulmonesFisico', label: '10. Tórax y Pulmones', page: 5, target: 'sec-fisico-toraxPulmonesFisico', keywords: 'torax pulmones tiraje murmullo vesicular estertores sibilantes crepitantes' },
      { id: 'sec-fisico-cardiovascularFisico', label: 'Cardiovascular (Corazón y Vasos)', page: 5, target: 'sec-fisico-cardiovascularFisico', keywords: 'corazon soplos ruidos cardiacos pulsos' },
      { id: 'sec-fisico-abdomenFisico', label: '11. Abdomen', page: 5, target: 'sec-fisico-abdomenFisico', keywords: 'abdomen ruidos hidroaereos hepatomegalia blumberg' },
      { id: 'sec-fisico-urinarioFisico', label: '12. Urinario', page: 5, target: 'sec-fisico-urinarioFisico', keywords: 'urinario punopercusion renal' },
      { id: 'sec-fisico-genitalesFisico', label: '13. Genitales', page: 5, target: 'sec-fisico-genitalesFisico', keywords: 'genitales testiculos labios' },
      { id: 'sec-fisico-anoRectoFisico', label: '14. Ano y Recto', page: 5, target: 'sec-fisico-anoRectoFisico', keywords: 'ano recto perianal' },
      { id: 'sec-fisico-huesosArticulacionesMuslosFisico', label: '15. Huesos, Articulaciones y Músculos', page: 5, target: 'sec-fisico-huesosArticulacionesMuslosFisico', keywords: 'extremidades edema tono fuerza huesos articulaciones' },
      { id: 'sec-fisico-neurologicoPsiquicoFisico', label: '16. Neurológico y Psíquico', page: 5, target: 'sec-fisico-neurologicoPsiquicoFisico', keywords: 'neurologico glasgow reflejos signos meningeos' },
      { id: 'sec-fisico-sensorialesFisico', label: '17. Sensoriales', page: 5, target: 'sec-fisico-sensorialesFisico', keywords: 'sensoriales audicion vision' },
    ],
  },
  {
    id: 'page-6',
    page: 6,
    title: 'Pág. 6 · Evaluación Socioeconómica GRAFFAR',
    shortTitle: 'GRAFFAR',
    items: [
      { id: 'p6-graffar-a', label: 'A) Profesión del Jefe de Familia', page: 6, target: '[data-tutorial="p6-graffar-a"]', keywords: 'graffar profesion jefe familia' },
      { id: 'p6-graffar-b', label: 'B) Nivel de Instrucción de la Madre', page: 6, target: '[data-tutorial="p6-graffar-b"]', keywords: 'graffar instruccion madre educacion' },
      { id: 'p6-graffar-c', label: 'C) Fuente de Ingreso', page: 6, target: '[data-tutorial="p6-graffar-c"]', keywords: 'graffar ingreso salario' },
      { id: 'p6-graffar-d', label: 'D) Condiciones de Alojamiento y Estrato', page: 6, target: '[data-tutorial="p6-graffar-d"]', keywords: 'graffar vivienda alojamiento estrato' },
    ],
  },
  {
    id: 'page-7',
    page: 7,
    title: 'Pág. 7 · Laboratorios y Paraclínicos',
    shortTitle: 'Laboratorios',
    items: [
      { id: 'p7-labs', label: 'Muestras y Hoja Oficial de Laboratorios (8 Columnas)', page: 7, target: '[data-tutorial="p7-labs-header"]', keywords: 'laboratorio hematologia quimica orina heces cultivos' },
    ],
  },
  {
    id: 'page-8',
    page: 8,
    title: 'Pág. 8 · Resumen de Ingreso',
    shortTitle: 'Resumen de Ingreso',
    items: [
      { id: 'p8-resumen', label: 'Resumen de Ingreso Automático (Fecha y Servicio)', page: 8, target: '[data-tutorial="p8-resumen-header"]', keywords: 'resumen ingreso fecha servicio' },
      { id: 'p8-comentario', label: 'Comentario Manual de Ingreso', page: 8, target: '[data-tutorial="p8-comentario"]', keywords: 'comentario observaciones resumen' },
    ],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getQuickJumpGroupsForScope(scopedPage?: number): HistoriaQuickJumpGroup[] {
  if (scopedPage === undefined) return HISTORIA_QUICK_JUMP_GROUPS;
  return HISTORIA_QUICK_JUMP_GROUPS.filter(group => group.page === scopedPage);
}

export function filterQuickJumpGroups(
  groups: HistoriaQuickJumpGroup[],
  query: string
): HistoriaQuickJumpGroup[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return groups;

  return groups
    .map(group => {
      const groupMatches =
        normalizeSearchText(group.title).includes(normalizedQuery) ||
        normalizeSearchText(group.shortTitle).includes(normalizedQuery);

      if (groupMatches) return group;

      const matchedItems = group.items.filter(item => {
        const haystack = normalizeSearchText(`${item.label} ${item.keywords || ''}`);
        return haystack.includes(normalizedQuery);
      });

      return matchedItems.length > 0 ? { ...group, items: matchedItems } : null;
    })
    .filter((g): g is HistoriaQuickJumpGroup => g !== null);
}
