import { ALL_SEASONAL_STYLES, type SeasonalStyle } from '../components/SeasonalOverlay';

export interface AudioButtonNeonClasses {
  buttonClasses: string;
  iconClasses: string;
}

export interface HeaderNeonStyleMeta {
  style: SeasonalStyle;
  neonAccentName: string;
  lightPrimaryHex: string;
  darkPrimaryHex: string;
  navHoverGlowClass: string;
}

export const HEADER_NEON_STYLE_MAP: Record<SeasonalStyle, HeaderNeonStyleMeta> = {
  normal: {
    style: 'normal',
    neonAccentName: 'Teal Cyan Neon',
    lightPrimaryHex: '#0d9488',
    darkPrimaryHex: '#2dd4bf',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.75)]',
  },
  navidad: {
    style: 'navidad',
    neonAccentName: 'Emerald & Festive Gold Neon',
    lightPrimaryHex: '#15803d',
    darkPrimaryHex: '#34d399',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  halloween: {
    style: 'halloween',
    neonAccentName: 'Pumpkin Orange & Violet Neon',
    lightPrimaryHex: '#c2410c',
    darkPrimaryHex: '#fb923c',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(251,146,60,0.82)]',
  },
  dia_del_nino: {
    style: 'dia_del_nino',
    neonAccentName: 'Sky Blue & Sunshine Neon',
    lightPrimaryHex: '#0284c7',
    darkPrimaryHex: '#38bdf8',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]',
  },
  dia_del_medico: {
    style: 'dia_del_medico',
    neonAccentName: 'Sapphire & Clinical Gold Neon',
    lightPrimaryHex: '#1d4ed8',
    darkPrimaryHex: '#60a5fa',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]',
  },
  carnaval: {
    style: 'carnaval',
    neonAccentName: 'Tropical Fuchsia & Turquoise Neon',
    lightPrimaryHex: '#a21caf',
    darkPrimaryHex: '#e879f9',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(232,121,249,0.82)]',
  },
  ano_nuevo: {
    style: 'ano_nuevo',
    neonAccentName: 'Champagne Gold Neon',
    lightPrimaryHex: '#b45309',
    darkPrimaryHex: '#fbbf24',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.82)]',
  },
  guardia_nocturna: {
    style: 'guardia_nocturna',
    neonAccentName: 'Indigo Night Starlight Neon',
    lightPrimaryHex: '#4338ca',
    darkPrimaryHex: '#818cf8',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.82)]',
  },
  primavera: {
    style: 'primavera',
    neonAccentName: 'Sakura Rose & Mint Neon',
    lightPrimaryHex: '#be185d',
    darkPrimaryHex: '#f472b6',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]',
  },
  espacio: {
    style: 'espacio',
    neonAccentName: 'Cosmic Violet & Cyan Neon',
    lightPrimaryHex: '#6d28d9',
    darkPrimaryHex: '#a78bfa',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(167,139,250,0.84)]',
  },
  fondo_marino: {
    style: 'fondo_marino',
    neonAccentName: 'Bioluminescent Aqua Neon',
    lightPrimaryHex: '#0e7490',
    darkPrimaryHex: '#22d3ee',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.82)]',
  },
  pequenos_heroes: {
    style: 'pequenos_heroes',
    neonAccentName: 'Hero Crimson & Lightning Gold Neon',
    lightPrimaryHex: '#b91c1c',
    darkPrimaryHex: '#f87171',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]',
  },
  amor_amistad: {
    style: 'amor_amistad',
    neonAccentName: 'Warm Rose & Magenta Neon',
    lightPrimaryHex: '#be123c',
    darkPrimaryHex: '#fb7185',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]',
  },
  otono: {
    style: 'otono',
    neonAccentName: 'Warm Amber Copper Neon',
    lightPrimaryHex: '#b45309',
    darkPrimaryHex: '#f59e0b',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]',
  },
  lluvia_relajante: {
    style: 'lluvia_relajante',
    neonAccentName: 'Raindrop Sky & Teal Neon',
    lightPrimaryHex: '#0369a1',
    darkPrimaryHex: '#38bdf8',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]',
  },
  fiestas_patrias: {
    style: 'fiestas_patrias',
    neonAccentName: 'Tricolor Gold & Royal Blue Neon',
    lightPrimaryHex: '#1d4ed8',
    darkPrimaryHex: '#facc15',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.85)]',
  },
  equipo_salud: {
    style: 'equipo_salud',
    neonAccentName: 'Medical Emerald & Mint Neon',
    lightPrimaryHex: '#047857',
    darkPrimaryHex: '#34d399',
    navHoverGlowClass: 'md:hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
};

export function getHeaderNeonMeta(style: SeasonalStyle): HeaderNeonStyleMeta {
  return HEADER_NEON_STYLE_MAP[style] || HEADER_NEON_STYLE_MAP.normal;
}

export interface MobileNavItemNeonClasses {
  buttonClasses: string;
  iconClasses: string;
  labelClasses: string;
}

export function getHeaderSurfaceNeonClass(style: SeasonalStyle): string {
  const meta = getHeaderNeonMeta(style);
  return `hmi-header-neon header-neon-theme-${meta.style}`;
}

export function getMobileNavSurfaceNeonClass(style: SeasonalStyle): string {
  const meta = getHeaderNeonMeta(style);
  return `hmi-mobile-nav-neon header-neon-theme-${meta.style}`;
}

export function getMobileNavItemNeonClasses(
  isActive: boolean,
  isAdminButton: boolean = false
): MobileNavItemNeonClasses {
  const adminMod = isAdminButton ? 'hmi-mobile-nav-admin' : '';
  const activeMod = isActive ? 'hmi-mobile-nav-item-active' : '';
  return {
    buttonClasses: `hmi-mobile-nav-item ${adminMod} ${activeMod}`.trim(),
    iconClasses: `hmi-mobile-nav-icon ${isActive ? 'hmi-mobile-nav-icon-active' : ''}`.trim(),
    labelClasses: `hmi-mobile-nav-label ${isActive ? 'header-neon-text-strong' : 'header-neon-text'}`.trim(),
  };
}

export function getAudioButtonNeonClasses(
  isPlaying: boolean,
  _style?: SeasonalStyle
): AudioButtonNeonClasses {
  if (isPlaying) {
    return {
      buttonClasses:
        'audio-btn-neon audio-btn-neon-playing bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/70 dark:border-emerald-400/80 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30',
      iconClasses:
        'text-emerald-600 dark:text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.95)] dark:drop-shadow-[0_0_10px_rgba(52,211,153,0.98)]',
    };
  }

  return {
    buttonClasses:
      'audio-btn-neon audio-btn-neon-muted bg-rose-500/12 dark:bg-rose-950/55 text-rose-700 dark:text-rose-300 border-rose-400/75 dark:border-rose-500/75 hover:bg-rose-500/20 dark:hover:bg-rose-900/65',
    iconClasses:
      'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.92)] dark:drop-shadow-[0_0_10px_rgba(251,113,133,0.95)]',
  };
}

export function hasAllSeasonalHeaderNeonPalettes(): boolean {
  return ALL_SEASONAL_STYLES.every((s) => Boolean(HEADER_NEON_STYLE_MAP[s]));
}
