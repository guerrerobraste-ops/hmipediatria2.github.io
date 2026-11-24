import React, { useEffect, useState, useMemo } from 'react';
import { generateSeasonalRainParticles } from '../utils/seasonalRain';
import { isMobileViewportWidth } from '../utils/mobileActivityGuard';

export type SeasonalStyle =
  | 'normal'
  | 'navidad'
  | 'halloween'
  | 'dia_del_nino'
  | 'dia_del_medico'
  | 'carnaval'
  | 'ano_nuevo'
  | 'guardia_nocturna'
  | 'primavera'
  | 'espacio'
  | 'fondo_marino'
  | 'pequenos_heroes'
  | 'amor_amistad'
  | 'otono'
  | 'lluvia_relajante'
  | 'fiestas_patrias'
  | 'equipo_salud';

export const ALL_SEASONAL_STYLES: SeasonalStyle[] = [
  'normal',
  'navidad',
  'halloween',
  'dia_del_nino',
  'dia_del_medico',
  'carnaval',
  'ano_nuevo',
  'guardia_nocturna',
  'primavera',
  'espacio',
  'fondo_marino',
  'pequenos_heroes',
  'amor_amistad',
  'otono',
  'lluvia_relajante',
  'fiestas_patrias',
  'equipo_salud',
];

export function isValidSeasonalStyle(val: unknown): val is SeasonalStyle {
  return typeof val === 'string' && ALL_SEASONAL_STYLES.includes(val as SeasonalStyle);
}

export interface SeasonalOverlayConfig {
  /** 0 = sin transparencia (100% opaco), 90 = muy transparente (10% opaco) */
  transparency: number;
  /** Cantidad total de iconos cayendo simultáneamente */
  count: number;
  /** Multiplicador de velocidad de caída (0.4 = muy lento, 1 = normal, 2.5 = muy rápido) */
  speedMultiplier: number;
  /** Iconos activos por cada estilo */
  navidadIcons: string[];
  halloweenIcons: string[];
  normalIcons: string[];
  diaDelNinoIcons: string[];
  diaDelMedicoIcons: string[];
  carnavalIcons: string[];
  anoNuevoIcons: string[];
  guardiaNocturnaIcons: string[];
  primaveraIcons: string[];
  espacioIcons: string[];
  fondoMarinoIcons: string[];
  pequenosHeroesIcons: string[];
  amorAmistadIcons: string[];
  otonoIcons: string[];
  lluviaRelajanteIcons: string[];
  fiestasPatriasIcons: string[];
  equipoSaludIcons: string[];
}

export const NAVIDAD_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🎁', label: 'Regalo' },
  { emoji: '🎅', label: 'Santa Claus' },
  { emoji: '❄️', label: 'Copo de Nieve' },
  { emoji: '☃️', label: 'Muñeco Nevado' },
  { emoji: '⛄', label: 'Muñeco de Nieve' },
  { emoji: '🔔', label: 'Campana' },
  { emoji: '🦌', label: 'Reno' },
  { emoji: '✨', label: 'Destellos' },
  { emoji: '🎄', label: 'Árbol Navideño' },
  { emoji: '⭐', label: 'Estrella' },
  { emoji: '🤶', label: 'Mamá Noel' },
  { emoji: '🍪', label: 'Galleta' },
];

export const HALLOWEEN_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🎃', label: 'Calabaza' },
  { emoji: '🦇', label: 'Murciélago' },
  { emoji: '👻', label: 'Fantasma' },
  { emoji: '🕸️', label: 'Telaraña' },
  { emoji: '🕷️', label: 'Araña' },
  { emoji: '💀', label: 'Calavera' },
  { emoji: '🍬', label: 'Dulce' },
  { emoji: '🧙‍♀️', label: 'Bruja' },
  { emoji: '🌙', label: 'Luna' },
  { emoji: '🔮', label: 'Esfera Mágica' },
];

export const NORMAL_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🩺', label: 'Estetoscopio' },
  { emoji: '💊', label: 'Cápsula' },
  { emoji: '🌡️', label: 'Termómetro' },
  { emoji: '💉', label: 'Vacuna' },
  { emoji: '🧪', label: 'Laboratorio' },
  { emoji: '👶', label: 'Pediatría' },
  { emoji: '❤️', label: 'Corazón' },
  { emoji: '✨', label: 'Brillo' },
];

export const DIA_DEL_NINO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🧸', label: 'Osito' },
  { emoji: '🎈', label: 'Globo' },
  { emoji: '🎠', label: 'Carrusel' },
  { emoji: '🍭', label: 'Chupeta' },
  { emoji: '🎨', label: 'Arte' },
  { emoji: '🍼', label: 'Tetero' },
  { emoji: '👶', label: 'Bebé' },
  { emoji: '🌈', label: 'Arcoíris' },
  { emoji: '⭐', label: 'Estrella' },
  { emoji: '🪁', label: 'Papagayo' },
  { emoji: '🪀', label: 'Yo-yo' },
  { emoji: '🧩', label: 'Rompecabezas' },
];

export const DIA_DEL_MEDICO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🩺', label: 'Estetoscopio' },
  { emoji: '👨‍⚕️', label: 'Médico' },
  { emoji: '👩‍⚕️', label: 'Médica' },
  { emoji: '🏥', label: 'Hospital' },
  { emoji: '💊', label: 'Medicamento' },
  { emoji: '💉', label: 'Vacuna' },
  { emoji: '🧬', label: 'Genética' },
  { emoji: '❤️‍🩹', label: 'Salud' },
  { emoji: '🔬', label: 'Microscopio' },
  { emoji: '📋', label: 'Historia Clínica' },
  { emoji: '🌡️', label: 'Termómetro' },
  { emoji: '🚑', label: 'Ambulancia' },
];

export const CARNAVAL_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🎭', label: 'Máscaras' },
  { emoji: '🎊', label: 'Confeti' },
  { emoji: '🎉', label: 'Serpentina' },
  { emoji: '🪇', label: 'Maracas' },
  { emoji: '👑', label: 'Corona' },
  { emoji: '💃', label: 'Comparsa' },
  { emoji: '🎶', label: 'Música' },
  { emoji: '🎈', label: 'Globo' },
  { emoji: '🌴', label: 'Tropical' },
  { emoji: '✨', label: 'Brillo' },
  { emoji: '🥁', label: 'Tambor' },
  { emoji: '🎪', label: 'Fantasía' },
];

export const ANO_NUEVO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🎆', label: 'Fuegos Artificiales' },
  { emoji: '🎇', label: 'Bengala' },
  { emoji: '🥂', label: 'Brindis' },
  { emoji: '🍾', label: 'Champaña' },
  { emoji: '🍇', label: '12 Uvas' },
  { emoji: '✨', label: 'Destellos' },
  { emoji: '🎉', label: 'Celebración' },
  { emoji: '🌟', label: 'Estrella' },
  { emoji: '🎊', label: 'Confeti' },
  { emoji: '🕛', label: 'Medianoche' },
  { emoji: '👑', label: 'Corona' },
  { emoji: '🧳', label: 'Maleta de Viaje' },
];

export const GUARDIA_NOCTURNA_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🌙', label: 'Luna' },
  { emoji: '⭐', label: 'Estrella' },
  { emoji: '🌟', label: 'Lucero' },
  { emoji: '🩺', label: 'Guardia Médica' },
  { emoji: '☕', label: 'Café de Guardia' },
  { emoji: '🦉', label: 'Búho Nocturno' },
  { emoji: '💤', label: 'Descanso' },
  { emoji: '✨', label: 'Brillo Nocturno' },
  { emoji: '🏥', label: 'Hospital' },
  { emoji: '🌌', label: 'Cielo Nocturno' },
  { emoji: '🔦', label: 'Linterna' },
  { emoji: '⌚', label: 'Turno' },
];

export const PRIMAVERA_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🌸', label: 'Flor de Cerezo' },
  { emoji: '🌺', label: 'Cayena' },
  { emoji: '🦋', label: 'Mariposa' },
  { emoji: '🌼', label: 'Araguaney' },
  { emoji: '🌷', label: 'Tulipán' },
  { emoji: '🍃', label: 'Hojas Suaves' },
  { emoji: '🌿', label: 'Rama Verde' },
  { emoji: '🕊️', label: 'Paz y Calma' },
  { emoji: '✨', label: 'Rocío' },
  { emoji: '💐', label: 'Flores' },
  { emoji: '🪷', label: 'Flor de Loto' },
  { emoji: '🌻', label: 'Girasol' },
];

export const ESPACIO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🚀', label: 'Cohete' },
  { emoji: '🪐', label: 'Saturno' },
  { emoji: '🌟', label: 'Estrella' },
  { emoji: '🛸', label: 'Nave Espacial' },
  { emoji: '👨‍🚀', label: 'Astronauta' },
  { emoji: '🌌', label: 'Galaxia' },
  { emoji: '☄️', label: 'Cometa' },
  { emoji: '🌙', label: 'Luna' },
  { emoji: '🛰️', label: 'Satélite' },
  { emoji: '🔭', label: 'Telescopio' },
  { emoji: '🌍', label: 'Planeta Tierra' },
  { emoji: '✨', label: 'Polvo Estelar' },
];

export const FONDO_MARINO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🐠', label: 'Pez Tropical' },
  { emoji: '🐬', label: 'Delfín' },
  { emoji: '🐳', label: 'Ballena' },
  { emoji: '🐙', label: 'Pulpo' },
  { emoji: '🐢', label: 'Tortuga Marina' },
  { emoji: '🦀', label: 'Cangrejo' },
  { emoji: '🐚', label: 'Caracola' },
  { emoji: '🪸', label: 'Coral' },
  { emoji: '🫧', label: 'Burbujas' },
  { emoji: '🌊', label: 'Ola del Mar' },
  { emoji: '🐡', label: 'Pez Globo' },
  { emoji: '🦑', label: 'Calamar' },
];

export const PEQUENOS_HEROES_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🦸', label: 'Superhéroe' },
  { emoji: '🦸‍♀️', label: 'Superheroína' },
  { emoji: '⚡', label: 'Superpoder' },
  { emoji: '🛡️', label: 'Escudo' },
  { emoji: '🏆', label: 'Campeón' },
  { emoji: '🥇', label: 'Medalla de Oro' },
  { emoji: '🌟', label: 'Estrella' },
  { emoji: '💪', label: 'Valentía' },
  { emoji: '👑', label: 'Corona' },
  { emoji: '🎗️', label: 'Lazo Dorado' },
  { emoji: '🚀', label: 'Vuelo Heroico' },
  { emoji: '❤️', label: 'Corazón Valiente' },
];

export const AMOR_AMISTAD_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '💖', label: 'Corazón Brillante' },
  { emoji: '💝', label: 'Corazón con Lazo' },
  { emoji: '💌', label: 'Carta de Cariño' },
  { emoji: '🌹', label: 'Rosa' },
  { emoji: '🍫', label: 'Chocolate' },
  { emoji: '🧸', label: 'Osito Tierno' },
  { emoji: '🤗', label: 'Abrazo' },
  { emoji: '💕', label: 'Dos Corazones' },
  { emoji: '🎈', label: 'Globo' },
  { emoji: '✨', label: 'Chispas' },
  { emoji: '🕊️', label: 'Paz' },
  { emoji: '💐', label: 'Ramo' },
];

export const OTONO_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🍂', label: 'Hoja de Otoño' },
  { emoji: '🍁', label: 'Hoja de Arce' },
  { emoji: '☕', label: 'Café Caliente' },
  { emoji: '🥐', label: 'Croissant' },
  { emoji: '🌰', label: 'Bellota' },
  { emoji: '🐿️', label: 'Ardilla' },
  { emoji: '🍄', label: 'Seta' },
  { emoji: '🧣', label: 'Bufanda' },
  { emoji: '🥧', label: 'Pastel' },
  { emoji: '🌾', label: 'Espiga' },
  { emoji: '🕯️', label: 'Vela Cálida' },
  { emoji: '✨', label: 'Destello Ámbar' },
];

export const LLUVIA_RELAJANTE_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '🌧️', label: 'Nube con Lluvia' },
  { emoji: '💧', label: 'Gota de Agua' },
  { emoji: '☔', label: 'Paraguas' },
  { emoji: '🌈', label: 'Arcoíris' },
  { emoji: '☁️', label: 'Nube Suave' },
  { emoji: '🫧', label: 'Burbuja' },
  { emoji: '🍃', label: 'Hoja Fresca' },
  { emoji: '🐸', label: 'Ranita' },
  { emoji: '🍵', label: 'Té Caliente' },
  { emoji: '🌊', label: 'Brisa' },
  { emoji: '✨', label: 'Rocío' },
  { emoji: '🪷', label: 'Calma' },
];

export const FIESTAS_PATRIAS_ICON_CATALOG: Array<{
  emoji: string;
  label: string;
  flagColor?: 'amarillo' | 'azul' | 'rojo' | 'tricolor';
}> = [
  { emoji: '🇻🇪', label: 'Bandera de Venezuela', flagColor: 'tricolor' },
  { emoji: '💛', label: 'Corazón Amarillo', flagColor: 'amarillo' },
  { emoji: '💙', label: 'Corazón Azul', flagColor: 'azul' },
  { emoji: '❤️', label: 'Corazón Rojo', flagColor: 'rojo' },
  { emoji: '🟡', label: 'Círculo Amarillo', flagColor: 'amarillo' },
  { emoji: '🔵', label: 'Círculo Azul', flagColor: 'azul' },
  { emoji: '🔴', label: 'Círculo Rojo', flagColor: 'rojo' },
  { emoji: '🟨', label: 'Franja Amarilla', flagColor: 'amarillo' },
  { emoji: '🟦', label: 'Franja Azul', flagColor: 'azul' },
  { emoji: '🟥', label: 'Franja Roja', flagColor: 'rojo' },
  { emoji: '⭐', label: '8 Estrellas Patrias', flagColor: 'azul' },
  { emoji: '🌟', label: 'Lucero Tricolor', flagColor: 'amarillo' },
  { emoji: '🌼', label: 'Araguaney (Amarillo)', flagColor: 'amarillo' },
  { emoji: '🌺', label: 'Orquídea Nacional', flagColor: 'rojo' },
  { emoji: '🦜', label: 'Guacamaya Tricolor', flagColor: 'tricolor' },
  { emoji: '🪇', label: 'Maracas Venezolanas', flagColor: 'amarillo' },
  { emoji: '🫓', label: 'Arepa Venezolana', flagColor: 'amarillo' },
  { emoji: '🎖️', label: 'Escarapela Tricolor', flagColor: 'tricolor' },
];

export const EQUIPO_SALUD_ICON_CATALOG: Array<{ emoji: string; label: string }> = [
  { emoji: '💉', label: 'Vacuna / Inyección' },
  { emoji: '🩺', label: 'Estetoscopio' },
  { emoji: '💊', label: 'Tratamiento' },
  { emoji: '🩹', label: 'Curita' },
  { emoji: '🧪', label: 'Tubo de Ensayo' },
  { emoji: '🔬', label: 'Laboratorio' },
  { emoji: '🫀', label: 'Cardiología' },
  { emoji: '🫁', label: 'Neumonología' },
  { emoji: '🧬', label: 'Biología' },
  { emoji: '🚑', label: 'Emergencias' },
  { emoji: '🏥', label: 'Hospital' },
  { emoji: '❤️‍🩹', label: 'Cuidado Integral' },
];

export const DEFAULT_NAVIDAD_ICONS = ['🎁', '🎅', '❄️', '☃️', '🔔', '🦌', '⛄', '✨'];
export const DEFAULT_HALLOWEEN_ICONS = ['🎃', '🦇', '👻', '🕸️'];
export const DEFAULT_NORMAL_ICONS = ['🩺', '💊', '🌡️', '💉', '🧪', '👶', '❤️', '✨'];
export const DEFAULT_DIA_DEL_NINO_ICONS = ['🧸', '🎈', '🎠', '🍭', '🎨', '🍼', '👶', '🌈', '⭐', '🪁'];
export const DEFAULT_DIA_DEL_MEDICO_ICONS = ['🩺', '👨‍⚕️', '👩‍⚕️', '🏥', '💊', '💉', '🧬', '❤️‍🩹', '🔬', '📋'];
export const DEFAULT_CARNAVAL_ICONS = ['🎭', '🎊', '🎉', '🪇', '👑', '💃', '🎶', '🎈', '🌴', '✨'];
export const DEFAULT_ANO_NUEVO_ICONS = ['🎆', '🎇', '🥂', '🍾', '🍇', '✨', '🎉', '🌟', '🎊', '🕛'];
export const DEFAULT_GUARDIA_NOCTURNA_ICONS = ['🌙', '⭐', '🌟', '🩺', '☕', '🦉', '💤', '✨'];
export const DEFAULT_PRIMAVERA_ICONS = ['🌸', '🌺', '🦋', '🌼', '🌷', '🍃', '🌿', '🕊️', '✨'];
export const DEFAULT_ESPACIO_ICONS = ['🚀', '🪐', '🌟', '🛸', '👨‍🚀', '🌌', '☄️', '🌙', '🛰️', '✨'];
export const DEFAULT_FONDO_MARINO_ICONS = ['🐠', '🐬', '🐳', '🐙', '🐢', '🦀', '🐚', '🪸', '🫧', '🌊'];
export const DEFAULT_PEQUENOS_HEROES_ICONS = ['🦸', '🦸‍♀️', '⚡', '🛡️', '🏆', '🥇', '🌟', '💪', '👑', '🎗️'];
export const DEFAULT_AMOR_AMISTAD_ICONS = ['💖', '💝', '💌', '🌹', '🍫', '🧸', '🤗', '💕', '🎈', '✨'];
export const DEFAULT_OTONO_ICONS = ['🍂', '🍁', '☕', '🥐', '🌰', '🐿️', '🍄', '🧣', '🌾', '✨'];
export const DEFAULT_LLUVIA_RELAJANTE_ICONS = ['🌧️', '💧', '☔', '🌈', '☁️', '🫧', '🍃', '🐸', '🍵', '✨'];
export const DEFAULT_FIESTAS_PATRIAS_ICONS = [
  '🇻🇪',
  '💛',
  '💙',
  '❤️',
  '🟡',
  '🔵',
  '🔴',
  '⭐',
  '🌼',
  '🦜',
  '🌺',
  '🪇',
];
export const DEFAULT_EQUIPO_SALUD_ICONS = ['💉', '🩺', '💊', '🩹', '🧪', '🔬', '🫀', '🫁', '🚑', '❤️‍🩹'];

export type StyleIconConfigKey =
  | 'normalIcons'
  | 'navidadIcons'
  | 'halloweenIcons'
  | 'diaDelNinoIcons'
  | 'diaDelMedicoIcons'
  | 'carnavalIcons'
  | 'anoNuevoIcons'
  | 'guardiaNocturnaIcons'
  | 'primaveraIcons'
  | 'espacioIcons'
  | 'fondoMarinoIcons'
  | 'pequenosHeroesIcons'
  | 'amorAmistadIcons'
  | 'otonoIcons'
  | 'lluviaRelajanteIcons'
  | 'fiestasPatriasIcons'
  | 'equipoSaludIcons';

export function getStyleIconMeta(style: SeasonalStyle): {
  key: StyleIconConfigKey;
  catalog: Array<{ emoji: string; label: string }>;
  defaults: string[];
} {
  switch (style) {
    case 'navidad':
      return { key: 'navidadIcons', catalog: NAVIDAD_ICON_CATALOG, defaults: DEFAULT_NAVIDAD_ICONS };
    case 'halloween':
      return { key: 'halloweenIcons', catalog: HALLOWEEN_ICON_CATALOG, defaults: DEFAULT_HALLOWEEN_ICONS };
    case 'dia_del_nino':
      return { key: 'diaDelNinoIcons', catalog: DIA_DEL_NINO_ICON_CATALOG, defaults: DEFAULT_DIA_DEL_NINO_ICONS };
    case 'dia_del_medico':
      return { key: 'diaDelMedicoIcons', catalog: DIA_DEL_MEDICO_ICON_CATALOG, defaults: DEFAULT_DIA_DEL_MEDICO_ICONS };
    case 'carnaval':
      return { key: 'carnavalIcons', catalog: CARNAVAL_ICON_CATALOG, defaults: DEFAULT_CARNAVAL_ICONS };
    case 'ano_nuevo':
      return { key: 'anoNuevoIcons', catalog: ANO_NUEVO_ICON_CATALOG, defaults: DEFAULT_ANO_NUEVO_ICONS };
    case 'guardia_nocturna':
      return { key: 'guardiaNocturnaIcons', catalog: GUARDIA_NOCTURNA_ICON_CATALOG, defaults: DEFAULT_GUARDIA_NOCTURNA_ICONS };
    case 'primavera':
      return { key: 'primaveraIcons', catalog: PRIMAVERA_ICON_CATALOG, defaults: DEFAULT_PRIMAVERA_ICONS };
    case 'espacio':
      return { key: 'espacioIcons', catalog: ESPACIO_ICON_CATALOG, defaults: DEFAULT_ESPACIO_ICONS };
    case 'fondo_marino':
      return { key: 'fondoMarinoIcons', catalog: FONDO_MARINO_ICON_CATALOG, defaults: DEFAULT_FONDO_MARINO_ICONS };
    case 'pequenos_heroes':
      return { key: 'pequenosHeroesIcons', catalog: PEQUENOS_HEROES_ICON_CATALOG, defaults: DEFAULT_PEQUENOS_HEROES_ICONS };
    case 'amor_amistad':
      return { key: 'amorAmistadIcons', catalog: AMOR_AMISTAD_ICON_CATALOG, defaults: DEFAULT_AMOR_AMISTAD_ICONS };
    case 'otono':
      return { key: 'otonoIcons', catalog: OTONO_ICON_CATALOG, defaults: DEFAULT_OTONO_ICONS };
    case 'lluvia_relajante':
      return { key: 'lluviaRelajanteIcons', catalog: LLUVIA_RELAJANTE_ICON_CATALOG, defaults: DEFAULT_LLUVIA_RELAJANTE_ICONS };
    case 'fiestas_patrias':
      return { key: 'fiestasPatriasIcons', catalog: FIESTAS_PATRIAS_ICON_CATALOG, defaults: DEFAULT_FIESTAS_PATRIAS_ICONS };
    case 'equipo_salud':
      return { key: 'equipoSaludIcons', catalog: EQUIPO_SALUD_ICON_CATALOG, defaults: DEFAULT_EQUIPO_SALUD_ICONS };
    case 'normal':
    default:
      return { key: 'normalIcons', catalog: NORMAL_ICON_CATALOG, defaults: DEFAULT_NORMAL_ICONS };
  }
}

export const DEFAULT_SEASONAL_OVERLAY_CONFIG: SeasonalOverlayConfig = {
  transparency: 0,
  count: 36,
  speedMultiplier: 1,
  navidadIcons: DEFAULT_NAVIDAD_ICONS,
  halloweenIcons: DEFAULT_HALLOWEEN_ICONS,
  normalIcons: DEFAULT_NORMAL_ICONS,
  diaDelNinoIcons: DEFAULT_DIA_DEL_NINO_ICONS,
  diaDelMedicoIcons: DEFAULT_DIA_DEL_MEDICO_ICONS,
  carnavalIcons: DEFAULT_CARNAVAL_ICONS,
  anoNuevoIcons: DEFAULT_ANO_NUEVO_ICONS,
  guardiaNocturnaIcons: DEFAULT_GUARDIA_NOCTURNA_ICONS,
  primaveraIcons: DEFAULT_PRIMAVERA_ICONS,
  espacioIcons: DEFAULT_ESPACIO_ICONS,
  fondoMarinoIcons: DEFAULT_FONDO_MARINO_ICONS,
  pequenosHeroesIcons: DEFAULT_PEQUENOS_HEROES_ICONS,
  amorAmistadIcons: DEFAULT_AMOR_AMISTAD_ICONS,
  otonoIcons: DEFAULT_OTONO_ICONS,
  lluviaRelajanteIcons: DEFAULT_LLUVIA_RELAJANTE_ICONS,
  fiestasPatriasIcons: DEFAULT_FIESTAS_PATRIAS_ICONS,
  equipoSaludIcons: DEFAULT_EQUIPO_SALUD_ICONS,
};

export const SEASONAL_OVERLAY_STORAGE_KEY = 'hmi_seasonal_overlay_config';

function parseStringArrayOrFallback(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.filter((x): x is string => typeof x === 'string');
}

export function readSeasonalOverlayConfig(): SeasonalOverlayConfig {
  if (typeof window === 'undefined') return DEFAULT_SEASONAL_OVERLAY_CONFIG;
  try {
    const raw = localStorage.getItem(SEASONAL_OVERLAY_STORAGE_KEY);
    if (!raw) return DEFAULT_SEASONAL_OVERLAY_CONFIG;
    const parsed = JSON.parse(raw);
    const parsedNormal = parseStringArrayOrFallback(parsed.normalIcons, DEFAULT_NORMAL_ICONS);
    return {
      transparency:
        typeof parsed.transparency === 'number'
          ? Math.min(95, Math.max(0, parsed.transparency))
          : DEFAULT_SEASONAL_OVERLAY_CONFIG.transparency,
      count:
        typeof parsed.count === 'number'
          ? Math.min(80, Math.max(0, Math.round(parsed.count)))
          : DEFAULT_SEASONAL_OVERLAY_CONFIG.count,
      speedMultiplier:
        typeof parsed.speedMultiplier === 'number'
          ? Math.min(3, Math.max(0.25, Number(parsed.speedMultiplier)))
          : DEFAULT_SEASONAL_OVERLAY_CONFIG.speedMultiplier,
      navidadIcons: parseStringArrayOrFallback(parsed.navidadIcons, DEFAULT_NAVIDAD_ICONS),
      halloweenIcons: parseStringArrayOrFallback(parsed.halloweenIcons, DEFAULT_HALLOWEEN_ICONS),
      normalIcons: parsedNormal.length > 0 ? parsedNormal : DEFAULT_NORMAL_ICONS,
      diaDelNinoIcons: parseStringArrayOrFallback(parsed.diaDelNinoIcons, DEFAULT_DIA_DEL_NINO_ICONS),
      diaDelMedicoIcons: parseStringArrayOrFallback(parsed.diaDelMedicoIcons, DEFAULT_DIA_DEL_MEDICO_ICONS),
      carnavalIcons: parseStringArrayOrFallback(parsed.carnavalIcons, DEFAULT_CARNAVAL_ICONS),
      anoNuevoIcons: parseStringArrayOrFallback(parsed.anoNuevoIcons, DEFAULT_ANO_NUEVO_ICONS),
      guardiaNocturnaIcons: parseStringArrayOrFallback(parsed.guardiaNocturnaIcons, DEFAULT_GUARDIA_NOCTURNA_ICONS),
      primaveraIcons: parseStringArrayOrFallback(parsed.primaveraIcons, DEFAULT_PRIMAVERA_ICONS),
      espacioIcons: parseStringArrayOrFallback(parsed.espacioIcons, DEFAULT_ESPACIO_ICONS),
      fondoMarinoIcons: parseStringArrayOrFallback(parsed.fondoMarinoIcons, DEFAULT_FONDO_MARINO_ICONS),
      pequenosHeroesIcons: parseStringArrayOrFallback(parsed.pequenosHeroesIcons, DEFAULT_PEQUENOS_HEROES_ICONS),
      amorAmistadIcons: parseStringArrayOrFallback(parsed.amorAmistadIcons, DEFAULT_AMOR_AMISTAD_ICONS),
      otonoIcons: parseStringArrayOrFallback(parsed.otonoIcons, DEFAULT_OTONO_ICONS),
      lluviaRelajanteIcons: parseStringArrayOrFallback(parsed.lluviaRelajanteIcons, DEFAULT_LLUVIA_RELAJANTE_ICONS),
      fiestasPatriasIcons: parseStringArrayOrFallback(parsed.fiestasPatriasIcons, DEFAULT_FIESTAS_PATRIAS_ICONS),
      equipoSaludIcons: parseStringArrayOrFallback(parsed.equipoSaludIcons, DEFAULT_EQUIPO_SALUD_ICONS),
    };
  } catch {
    return DEFAULT_SEASONAL_OVERLAY_CONFIG;
  }
}

export function saveSeasonalOverlayConfig(next: SeasonalOverlayConfig): SeasonalOverlayConfig {
  const normalized: SeasonalOverlayConfig = {
    transparency: Math.min(95, Math.max(0, Number(next.transparency) || 0)),
    count: Math.min(80, Math.max(0, Math.round(Number(next.count) ?? 24))),
    speedMultiplier: Math.min(3, Math.max(0.25, Number(next.speedMultiplier) || 1)),
    navidadIcons: Array.isArray(next.navidadIcons) ? next.navidadIcons : DEFAULT_NAVIDAD_ICONS,
    halloweenIcons: Array.isArray(next.halloweenIcons) ? next.halloweenIcons : DEFAULT_HALLOWEEN_ICONS,
    normalIcons: Array.isArray(next.normalIcons) ? next.normalIcons : DEFAULT_NORMAL_ICONS,
    diaDelNinoIcons: Array.isArray(next.diaDelNinoIcons) ? next.diaDelNinoIcons : DEFAULT_DIA_DEL_NINO_ICONS,
    diaDelMedicoIcons: Array.isArray(next.diaDelMedicoIcons) ? next.diaDelMedicoIcons : DEFAULT_DIA_DEL_MEDICO_ICONS,
    carnavalIcons: Array.isArray(next.carnavalIcons) ? next.carnavalIcons : DEFAULT_CARNAVAL_ICONS,
    anoNuevoIcons: Array.isArray(next.anoNuevoIcons) ? next.anoNuevoIcons : DEFAULT_ANO_NUEVO_ICONS,
    guardiaNocturnaIcons: Array.isArray(next.guardiaNocturnaIcons) ? next.guardiaNocturnaIcons : DEFAULT_GUARDIA_NOCTURNA_ICONS,
    primaveraIcons: Array.isArray(next.primaveraIcons) ? next.primaveraIcons : DEFAULT_PRIMAVERA_ICONS,
    espacioIcons: Array.isArray(next.espacioIcons) ? next.espacioIcons : DEFAULT_ESPACIO_ICONS,
    fondoMarinoIcons: Array.isArray(next.fondoMarinoIcons) ? next.fondoMarinoIcons : DEFAULT_FONDO_MARINO_ICONS,
    pequenosHeroesIcons: Array.isArray(next.pequenosHeroesIcons) ? next.pequenosHeroesIcons : DEFAULT_PEQUENOS_HEROES_ICONS,
    amorAmistadIcons: Array.isArray(next.amorAmistadIcons) ? next.amorAmistadIcons : DEFAULT_AMOR_AMISTAD_ICONS,
    otonoIcons: Array.isArray(next.otonoIcons) ? next.otonoIcons : DEFAULT_OTONO_ICONS,
    lluviaRelajanteIcons: Array.isArray(next.lluviaRelajanteIcons) ? next.lluviaRelajanteIcons : DEFAULT_LLUVIA_RELAJANTE_ICONS,
    fiestasPatriasIcons: Array.isArray(next.fiestasPatriasIcons) ? next.fiestasPatriasIcons : DEFAULT_FIESTAS_PATRIAS_ICONS,
    equipoSaludIcons: Array.isArray(next.equipoSaludIcons) ? next.equipoSaludIcons : DEFAULT_EQUIPO_SALUD_ICONS,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEASONAL_OVERLAY_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event('hmi_seasonal_overlay_config_changed'));
    } catch {}
  }
  return normalized;
}

interface Props {
  style: SeasonalStyle;
  showCornerBadges?: boolean;
}

export function getIconNeonGlowClasses(
  emoji: string,
  style: SeasonalStyle,
  index: number = 0
): { outerGlow: string; innerGlow: string } {
  if (style === 'fiestas_patrias') {
    if (emoji === '💛' || emoji === '🟡' || emoji === '🟨' || emoji === '🌼' || emoji === '🌟' || emoji === '🪇' || emoji === '🫓') {
      return {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      };
    }
    if (emoji === '💙' || emoji === '🔵' || emoji === '🟦' || emoji === '⭐') {
      return {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(59,130,246,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(147,197,253,0.98)]',
      };
    }
    if (emoji === '❤️' || emoji === '🔴' || emoji === '🟥' || emoji === '🌺') {
      return {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(244,63,94,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,164,175,0.98)]',
      };
    }
    const tricolorCycle = [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(59,130,246,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(147,197,253,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(244,63,94,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,164,175,0.98)]',
      },
    ];
    return tricolorCycle[index % tricolorCycle.length];
  }

  if (emoji === '❄️' || emoji === '☃️' || emoji === '⛄' || emoji === '💧' || emoji === '🫧') {
    return {
      outerGlow: 'text-sky-600 dark:text-sky-200 drop-shadow-[0_0_13px_rgba(56,189,248,0.95)]',
      innerGlow: 'drop-shadow-[0_0_5px_rgba(186,230,253,0.98)]',
    };
  }

  if (style === 'navidad') {
    const navidadCycle = [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(16,185,129,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(110,231,183,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(244,63,94,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,164,175,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(250,204,21,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      },
    ];
    return navidadCycle[index % navidadCycle.length];
  }

  if (style === 'halloween') {
    if (emoji === '🎃' || emoji === '🍬' || emoji === '🕸️') {
      return {
        outerGlow: 'text-orange-500 dark:text-orange-400 drop-shadow-[0_0_14px_rgba(249,115,22,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,186,116,0.98)]',
      };
    }
    return {
      outerGlow: 'text-purple-700 dark:text-purple-300 drop-shadow-[0_0_14px_rgba(192,38,211,0.95)]',
      innerGlow: 'drop-shadow-[0_0_5px_rgba(240,171,252,0.98)]',
    };
  }

  const styleNeons: Record<SeasonalStyle, Array<{ outerGlow: string; innerGlow: string }>> = {
    normal: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(20,184,166,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(94,234,212,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(6,182,212,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(103,232,249,0.98)]',
      },
    ],
    equipo_salud: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(16,185,129,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(110,231,183,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(20,184,166,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(94,234,212,0.98)]',
      },
    ],
    dia_del_nino: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(236,72,153,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(249,168,212,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(34,211,238,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(165,243,252,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      },
    ],
    dia_del_medico: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(59,130,246,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(147,197,253,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(34,211,238,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(165,243,252,0.98)]',
      },
    ],
    carnaval: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(217,70,239,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(245,208,254,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(34,211,238,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(165,243,252,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      },
    ],
    ano_nuevo: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,249,195,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(168,85,247,0.92)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(216,180,254,0.98)]',
      },
    ],
    guardia_nocturna: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(129,140,248,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(199,210,254,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(56,189,248,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(186,230,253,0.98)]',
      },
    ],
    primavera: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(244,114,182,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(251,207,232,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(52,211,153,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(167,243,208,0.98)]',
      },
    ],
    espacio: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(168,85,247,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(233,213,255,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(34,211,238,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(165,243,252,0.98)]',
      },
    ],
    fondo_marino: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(6,182,212,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(165,243,252,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(45,212,191,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(153,246,228,0.98)]',
      },
    ],
    pequenos_heroes: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(250,204,21,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(254,240,138,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(239,68,68,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(252,165,165,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(59,130,246,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(147,197,253,0.98)]',
      },
    ],
    amor_amistad: [
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(244,63,94,0.98)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,164,175,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_14px_rgba(236,72,153,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(249,168,212,0.98)]',
      },
    ],
    otono: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(245,158,11,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,230,138,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(234,88,12,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(253,186,116,0.98)]',
      },
    ],
    lluvia_relajante: [
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(56,189,248,0.96)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(186,230,253,0.98)]',
      },
      {
        outerGlow: 'drop-shadow-[0_0_13px_rgba(20,184,166,0.95)]',
        innerGlow: 'drop-shadow-[0_0_5px_rgba(94,234,212,0.98)]',
      },
    ],
    navidad: [],
    halloween: [],
    fiestas_patrias: [],
  };

  const palette = styleNeons[style] || styleNeons.normal;
  return palette[index % palette.length];
}

export function extractNeonTextShadow(outerGlow: string, innerGlow: string): string {
  const shadows: string[] = [];
  const regex = /drop-shadow-\[([^\]]+)\]/g;
  for (const cls of [outerGlow, innerGlow]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cls)) !== null) {
      shadows.push(match[1].replace(/_/g, ' '));
    }
  }
  return shadows.length > 0
    ? shadows.join(', ')
    : '0 0 10px rgba(45, 212, 191, 0.85), 0 0 4px rgba(153, 246, 228, 0.9)';
}

const CORNER_BADGE_MAP: Partial<
  Record<
    SeasonalStyle,
    { emoji: string; text: string; classes: string }
  >
> = {
  halloween: {
    emoji: '🎃',
    text: '¡Noche de Brujas! 👻',
    classes: 'bg-orange-50 dark:bg-amber-950/75 border-orange-200 dark:border-amber-500/35 text-orange-800 dark:text-amber-300',
  },
  dia_del_nino: {
    emoji: '🧸',
    text: '¡Feliz Día del Niño! 🎈 Pediatría HMI',
    classes: 'bg-sky-50/95 dark:bg-sky-950/75 border-sky-200 dark:border-sky-500/40 text-sky-800 dark:text-sky-300',
  },
  dia_del_medico: {
    emoji: '🩺',
    text: 'Día del Médico Venezolano 🇻🇪 👨‍⚕️👩‍⚕️',
    classes: 'bg-blue-50/95 dark:bg-blue-950/75 border-blue-200 dark:border-blue-500/40 text-blue-800 dark:text-blue-300',
  },
  carnaval: {
    emoji: '🎭',
    text: '¡Carnavales de Venezuela! 🎊 🪇',
    classes: 'bg-fuchsia-50/95 dark:bg-fuchsia-950/75 border-fuchsia-200 dark:border-fuchsia-500/40 text-fuchsia-800 dark:text-fuchsia-300',
  },
  ano_nuevo: {
    emoji: '🎆',
    text: '¡Feliz Año Nuevo! 🥂 🍇',
    classes: 'bg-amber-50/95 dark:bg-amber-950/75 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300',
  },
  guardia_nocturna: {
    emoji: '🌙',
    text: 'Guardia Nocturna Activa ☕ 🩺',
    classes: 'bg-indigo-50/95 dark:bg-indigo-950/75 border-indigo-200 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-300',
  },
  primavera: {
    emoji: '🌸',
    text: 'Primavera & Calma 🦋 🌼',
    classes: 'bg-pink-50/95 dark:bg-pink-950/75 border-pink-200 dark:border-pink-500/40 text-pink-800 dark:text-pink-300',
  },
  espacio: {
    emoji: '🚀',
    text: 'Misión Galaxia Pediátrica 🪐 👨‍🚀',
    classes: 'bg-violet-50/95 dark:bg-violet-950/75 border-violet-200 dark:border-violet-500/40 text-violet-900 dark:text-violet-300',
  },
  fondo_marino: {
    emoji: '🐠',
    text: 'Aventura en el Fondo Marino 🐬 🐚',
    classes: 'bg-cyan-50/95 dark:bg-cyan-950/75 border-cyan-200 dark:border-cyan-500/40 text-cyan-900 dark:text-cyan-300',
  },
  pequenos_heroes: {
    emoji: '🦸',
    text: '¡Nuestros Pequeños Héroes! ⚡ 🛡️',
    classes: 'bg-red-50/95 dark:bg-red-950/75 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-300',
  },
  amor_amistad: {
    emoji: '💖',
    text: '¡Feliz Día del Amor y la Amistad! 💝 🌹',
    classes: 'bg-rose-50/95 dark:bg-rose-950/75 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300',
  },
  otono: {
    emoji: '🍂',
    text: 'Otoño & Café de Guardia ☕ 🍁',
    classes: 'bg-amber-50/95 dark:bg-stone-900/80 border-amber-200 dark:border-amber-600/40 text-amber-900 dark:text-amber-300',
  },
  lluvia_relajante: {
    emoji: '🌧️',
    text: 'Lluvia Relajante & Calma ☔ 🌈',
    classes: 'bg-slate-100/95 dark:bg-slate-900/80 border-sky-200 dark:border-sky-500/40 text-sky-900 dark:text-sky-300',
  },
  fiestas_patrias: {
    emoji: '🇻🇪',
    text: '¡Fiestas Patrias de Venezuela! 💛 💙 ❤️ ★ ★ ★ ★ ★ ★ ★ ★',
    classes:
      'bg-gradient-to-r from-[#FFCC00] via-[#00247D] to-[#CF142B] border-yellow-300 text-white shadow-md',
  },
  equipo_salud: {
    emoji: '💉',
    text: 'Equipo de Salud HMI 🩺 ❤️‍🩹',
    classes: 'bg-teal-50/95 dark:bg-teal-950/75 border-teal-200 dark:border-teal-500/40 text-teal-900 dark:text-teal-300',
  },
};

export const SeasonalOverlay: React.FC<Props> = React.memo(({ style, showCornerBadges = false }) => {
  const [config, setConfig] = useState<SeasonalOverlayConfig>(() => readSeasonalOverlayConfig());
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isMobileViewportWidth(window.innerWidth) : false
  );

  useEffect(() => {
    const sync = () => setConfig(readSeasonalOverlayConfig());
    window.addEventListener('hmi_seasonal_overlay_config_changed', sync);
    window.addEventListener('storage', sync);

    const mq = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 767px)')
      : null;

    const evaluateViewport = () => {
      const mobileNow = mq ? mq.matches : isMobileViewportWidth(window.innerWidth);
      setIsMobileViewport(mobileNow);
    };

    evaluateViewport();
    mq?.addEventListener?.('change', evaluateViewport);
    window.addEventListener('resize', evaluateViewport);

    return () => {
      window.removeEventListener('hmi_seasonal_overlay_config_changed', sync);
      window.removeEventListener('storage', sync);
      mq?.removeEventListener?.('change', evaluateViewport);
      window.removeEventListener('resize', evaluateViewport);
    };
  }, []);

  const activeIcons = useMemo(() => {
    const meta = getStyleIconMeta(style);
    return config[meta.key] || meta.defaults;
  }, [style, config]);

  const effectiveCount = isMobileViewport ? Math.min(config.count, 16) : config.count;

  const generatedParticles = useMemo(() => {
    const rawDrops = generateSeasonalRainParticles({
      icons: activeIcons,
      count: effectiveCount,
      speedMultiplier: config.speedMultiplier || 1,
      style,
    });
    return rawDrops.map((drop, idx) => {
      const { outerGlow, innerGlow } = getIconNeonGlowClasses(drop.emoji, style, idx);
      const colorClass = outerGlow
        .split(' ')
        .filter((token) => token.startsWith('text-') || token.startsWith('dark:text-'))
        .join(' ');
      return {
        ...drop,
        colorClass,
        textShadow: extractNeonTextShadow(outerGlow, innerGlow),
      };
    });
  }, [activeIcons, effectiveCount, config.speedMultiplier, style]);

  if (generatedParticles.length === 0) return null;

  const computedOpacity = Math.min(1, Math.max(0.05, (100 - config.transparency) / 100));
  const badgeInfo = CORNER_BADGE_MAP[style];

  return (
    <>
      {/* Discrete Corner Badges — rendered at z-[30] strictly BELOW header (z-40) and all clinical modals/viewers (z-50..z-260) */}
      {showCornerBadges && (
        <div
          className="hmi-seasonal-corner-badges fixed inset-0 pointer-events-none z-[30] overflow-hidden select-none no-print"
          aria-hidden="true"
        >
          {style === 'navidad' && (
            <>
              <div className="absolute top-16 sm:top-[72px] left-3 text-xs opacity-90 flex items-center gap-1.5 bg-red-50/95 dark:bg-red-950/65 border border-red-200 dark:border-red-500/40 px-2.5 py-1 rounded-full text-red-800 dark:text-red-200 shadow-xs dark:shadow-md">
                <span>🎄</span>
                <span className="text-[10px] font-extrabold text-red-800 dark:text-red-300">¡Feliz Navidad! 🎅 🎁</span>
              </div>

              <div className="absolute top-16 sm:top-[72px] right-4 hidden md:flex text-xs opacity-90 items-center gap-1.5 bg-emerald-50/95 dark:bg-emerald-950/65 border border-emerald-200 dark:border-emerald-500/40 px-2.5 py-1 rounded-full text-emerald-800 dark:text-emerald-200 shadow-xs dark:shadow-md">
                <span>🔔</span>
                <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">HMI Pediatría 🦌 ⛄</span>
              </div>
            </>
          )}

          {badgeInfo && (
            <div
              className={`absolute top-16 sm:top-[72px] left-3 text-xs opacity-95 flex items-center gap-1.5 border px-2.5 py-1 rounded-full shadow-xs ${badgeInfo.classes}`}
            >
              <span>{badgeInfo.emoji}</span>
              <span className="text-[10px] font-extrabold">{badgeInfo.text}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="fixed inset-0 pointer-events-none z-[9990] overflow-hidden select-none no-print"
        style={{ contain: 'strict' }}
        aria-hidden="true"
      >
        {/* Top Venezuelan Flag Tricolor Gradient Ribbon for Fiestas Patrias */}
        {style === 'fiestas_patrias' && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FFCC00] via-[#00247D] to-[#CF142B] shadow-sm flex items-center justify-center">
            <span className="text-[7px] text-white font-black tracking-[0.25em]">
              ★ ★ ★ ★ ★ ★ ★ ★
            </span>
          </div>
        )}

        {/* Dynamic Multi-Speed Falling Rain Icons with GPU Glyph-Cached Neon Glow */}
        <div
          key={`${style}-${effectiveCount}-${config.speedMultiplier}-${activeIcons.join('')}`}
          data-mobile-paused="false"
          style={{ opacity: computedOpacity, contain: 'layout style' }}
        >
        {generatedParticles.map((item) => (
          <div
            key={item.id}
            data-rain-particle="true"
            data-speed-tier={item.speedTier}
            className={`absolute top-[-40px] will-change-transform ${item.sizeCls} ${item.colorClass}`}
            style={
              {
                left: `${item.leftPct}%`,
                textShadow: item.textShadow,
                backfaceVisibility: 'hidden',
                contain: 'layout style',
                animationName: 'seasonalRainFall',
                animationDuration: `${item.durationSec}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationDelay: `${item.delaySec}s`,
                animationPlayState: 'running',
                '--rain-sway-x': `${item.swayPx}px`,
                '--rain-drift-x': `${item.driftPx}px`,
                '--rain-rot-mid': `${item.rotMidDeg}deg`,
                '--rain-rot-end': `${item.rotEndDeg}deg`,
              } as React.CSSProperties
            }
          >
            {item.emoji}
          </div>
        ))}
        </div>
      </div>
    </>
  );
});
SeasonalOverlay.displayName = 'SeasonalOverlay';
