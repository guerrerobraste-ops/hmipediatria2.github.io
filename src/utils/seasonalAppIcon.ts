import type { SeasonalStyle } from '../components/SeasonalOverlay';

export interface SeasonalAppIconMeta {
  style: SeasonalStyle;
  label: string;
  themeColor: string;
  backgroundColor: string;
  gradientStart: string;
  gradientEnd: string;
  ringColor: string;
  primaryEmoji: string;
  badgeEmoji: string;
}

export const ALL_SEASONAL_APP_STYLES: SeasonalStyle[] = [
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

export const SEASONAL_APP_ICON_META: Record<SeasonalStyle, SeasonalAppIconMeta> = {
  normal: {
    style: 'normal',
    label: 'Clínico Estándar',
    themeColor: '#0d9488',
    backgroundColor: '#042f2e',
    gradientStart: '#0f766e',
    gradientEnd: '#042f2e',
    ringColor: '#2dd4bf',
    primaryEmoji: '🩺',
    badgeEmoji: '🏥',
  },
  navidad: {
    style: 'navidad',
    label: 'Navidad HMI',
    themeColor: '#15803d',
    backgroundColor: '#052e16',
    gradientStart: '#dc2626',
    gradientEnd: '#14532d',
    ringColor: '#4ade80',
    primaryEmoji: '🎄',
    badgeEmoji: '🎅',
  },
  halloween: {
    style: 'halloween',
    label: 'Halloween',
    themeColor: '#ea580c',
    backgroundColor: '#1e1b4b',
    gradientStart: '#c2410c',
    gradientEnd: '#3b0764',
    ringColor: '#fb923c',
    primaryEmoji: '🎃',
    badgeEmoji: '👻',
  },
  dia_del_nino: {
    style: 'dia_del_nino',
    label: 'Día del Niño',
    themeColor: '#0284c7',
    backgroundColor: '#0c4a6e',
    gradientStart: '#0ea5e9',
    gradientEnd: '#db2777',
    ringColor: '#38bdf8',
    primaryEmoji: '🧸',
    badgeEmoji: '🎈',
  },
  dia_del_medico: {
    style: 'dia_del_medico',
    label: 'Día del Médico',
    themeColor: '#1d4ed8',
    backgroundColor: '#172554',
    gradientStart: '#2563eb',
    gradientEnd: '#0f172a',
    ringColor: '#60a5fa',
    primaryEmoji: '🩺',
    badgeEmoji: '⚕️',
  },
  carnaval: {
    style: 'carnaval',
    label: 'Carnaval',
    themeColor: '#a21caf',
    backgroundColor: '#4a044e',
    gradientStart: '#d946ef',
    gradientEnd: '#06b6d4',
    ringColor: '#f0abfc',
    primaryEmoji: '🎭',
    badgeEmoji: '🎊',
  },
  ano_nuevo: {
    style: 'ano_nuevo',
    label: 'Año Nuevo',
    themeColor: '#b45309',
    backgroundColor: '#1c1917',
    gradientStart: '#eab308',
    gradientEnd: '#312e81',
    ringColor: '#fde047',
    primaryEmoji: '🎆',
    badgeEmoji: '🥂',
  },
  guardia_nocturna: {
    style: 'guardia_nocturna',
    label: 'Guardia Nocturna',
    themeColor: '#4338ca',
    backgroundColor: '#0f172a',
    gradientStart: '#312e81',
    gradientEnd: '#020617',
    ringColor: '#818cf8',
    primaryEmoji: '🌙',
    badgeEmoji: '☕',
  },
  primavera: {
    style: 'primavera',
    label: 'Primavera',
    themeColor: '#db2777',
    backgroundColor: '#500724',
    gradientStart: '#f472b6',
    gradientEnd: '#059669',
    ringColor: '#f9a8d4',
    primaryEmoji: '🌸',
    badgeEmoji: '🦋',
  },
  espacio: {
    style: 'espacio',
    label: 'Espacio / Galaxia',
    themeColor: '#6d28d9',
    backgroundColor: '#090d1f',
    gradientStart: '#7c3aed',
    gradientEnd: '#0f172a',
    ringColor: '#a78bfa',
    primaryEmoji: '🚀',
    badgeEmoji: '🪐',
  },
  fondo_marino: {
    style: 'fondo_marino',
    label: 'Fondo Marino',
    themeColor: '#0891b2',
    backgroundColor: '#083344',
    gradientStart: '#06b6d4',
    gradientEnd: '#0f172a',
    ringColor: '#22d3ee',
    primaryEmoji: '🐠',
    badgeEmoji: '🐬',
  },
  pequenos_heroes: {
    style: 'pequenos_heroes',
    label: 'Pequeños Héroes',
    themeColor: '#dc2626',
    backgroundColor: '#450a0a',
    gradientStart: '#ef4444',
    gradientEnd: '#1d4ed8',
    ringColor: '#facc15',
    primaryEmoji: '🦸',
    badgeEmoji: '⚡',
  },
  amor_amistad: {
    style: 'amor_amistad',
    label: 'Amor y Amistad',
    themeColor: '#e11d48',
    backgroundColor: '#4c0519',
    gradientStart: '#f43f5e',
    gradientEnd: '#881337',
    ringColor: '#fda4af',
    primaryEmoji: '💖',
    badgeEmoji: '🌹',
  },
  otono: {
    style: 'otono',
    label: 'Otoño / Café',
    themeColor: '#b45309',
    backgroundColor: '#451a03',
    gradientStart: '#d97706',
    gradientEnd: '#431407',
    ringColor: '#fbbf24',
    primaryEmoji: '🍂',
    badgeEmoji: '☕',
  },
  lluvia_relajante: {
    style: 'lluvia_relajante',
    label: 'Lluvia Relajante',
    themeColor: '#0284c7',
    backgroundColor: '#082f49',
    gradientStart: '#0ea5e9',
    gradientEnd: '#1e293b',
    ringColor: '#7dd3fc',
    primaryEmoji: '🌧️',
    badgeEmoji: '☔',
  },
  fiestas_patrias: {
    style: 'fiestas_patrias',
    label: 'Fiestas Patrias',
    themeColor: '#1d4ed8',
    backgroundColor: '#0f172a',
    gradientStart: '#eab308',
    gradientEnd: '#dc2626',
    ringColor: '#facc15',
    primaryEmoji: '🇻🇪',
    badgeEmoji: '⭐',
  },
  equipo_salud: {
    style: 'equipo_salud',
    label: 'Equipo de Salud',
    themeColor: '#047857',
    backgroundColor: '#022c22',
    gradientStart: '#10b981',
    gradientEnd: '#0f766e',
    ringColor: '#34d399',
    primaryEmoji: '💉',
    badgeEmoji: '❤️‍🩹',
  },
};

export function normalizeSeasonalAppStyle(style?: string | null): SeasonalStyle {
  if (style && style in SEASONAL_APP_ICON_META) {
    return style as SeasonalStyle;
  }
  return 'normal';
}

export function getSeasonalAppIconMeta(style?: string | null): SeasonalAppIconMeta {
  return SEASONAL_APP_ICON_META[normalizeSeasonalAppStyle(style)];
}

export const OFFICIAL_APP_ICON_URL = '/assets/aistudio/Icono_86bb4792.png';

export function getSeasonalIconPaths(_style?: string | null) {
  return {
    icon180: '/apple-touch-icon.png',
    icon192: '/pwa-192x192.png',
    icon512: '/pwa-512x512.png',
    iconMaskable512: '/pwa-maskable-512x512.png',
  };
}

export function buildSeasonalWebManifest(style?: string | null) {
  const safeStyle = normalizeSeasonalAppStyle(style);
  const meta = getSeasonalAppIconMeta(safeStyle);
  const paths = getSeasonalIconPaths(safeStyle);

  return {
    id: '/',
    name: 'HMI Pediatría · Hospital Materno Infantil',
    short_name: 'HMI Pediat.',
    description:
      'Sistema Clínico de Hospitalización Pediátrica con gestión de camas, historias médicas, órdenes e indicaciones con funcionamiento 100% offline.',
    theme_color: meta.themeColor,
    background_color: '#064e3b',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: paths.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: paths.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: paths.iconMaskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
