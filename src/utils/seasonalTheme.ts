import { useEffect, useState } from 'react';
import { SeasonalStyle, isValidSeasonalStyle } from '../components/SeasonalOverlay';

export interface SeasonalThemeTokens {
  style: SeasonalStyle;
  label: string;
  // App Shell & Navigation
  rootCanvas: string;
  headerSurface: string;
  mobileNavSurface: string;
  brandSubtitle: string;
  navActive: string;
  navHover: string;
  navIcon: string;
  mobileNavActive: string;
  // Hero Card (Inicio)
  heroCard: string;
  heroBadge: string;
  heroTitleAccent: string;
  heroGreetingM: string;
  heroGreetingF: string;
  heroBodyText: string;
  heroPrimaryBtn: string;
  heroSecondaryBtn: string;
  // Shared Card & Section Surfaces
  cardSurface: string;
  cardInnerSurface: string;
  sectionDivider: string;
  // Primary Interactive Accents
  accentText: string;
  accentIcon: string;
  accentBadge: string;
  primaryButton: string;
  activePill: string;
}

export interface SeasonalStyleCardMeta {
  style: SeasonalStyle;
  emoji: string;
  title: string;
  description: string;
  veCalendarDateLabel: string;
  activeCardClasses: string;
  inactiveCardClasses: string;
  activeBadgeClasses: string;
}

export const SEASONAL_STYLE_CARDS: SeasonalStyleCardMeta[] = [
  {
    style: 'normal',
    emoji: '✨',
    title: 'Estilo Normal',
    description: 'Tonos clínicos suaves azul-salvia. Vista médica estándar descansada.',
    veCalendarDateLabel: 'Días clínicos ordinarios (diurno)',
    activeCardClasses: 'bg-teal-100/80 dark:bg-teal-500/20 border-teal-600 dark:border-teal-500 ring-4 ring-teal-500/10',
    inactiveCardClasses: 'bg-[#eef4f5] dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 hover:border-teal-500/50',
    activeBadgeClasses: 'bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950',
  },
  {
    style: 'dia_del_nino',
    emoji: '🧸 🎈',
    title: 'Día del Niño / Pediatría',
    description: 'Azul cielo pediátrico, sol cálido y coral alegre. Ositos 🧸, globos 🎈 y carrusel 🎠.',
    veCalendarDateLabel: '3er Domingo de Julio (Semana del Niño VE) y 20 Nov',
    activeCardClasses: 'bg-sky-100/85 dark:bg-sky-500/20 border-sky-600 dark:border-sky-400 ring-4 ring-sky-500/10',
    inactiveCardClasses: 'bg-[#eef7fc] dark:bg-slate-950/60 border-sky-200 dark:border-slate-800 hover:border-sky-500/50',
    activeBadgeClasses: 'bg-sky-600 dark:bg-sky-400 text-white dark:text-slate-950',
  },
  {
    style: 'dia_del_medico',
    emoji: '🩺 👨‍⚕️',
    title: 'Día del Médico / Clínico',
    description: 'Azul zafiro médico y dorado académico (Dr. José María Vargas). Estetoscopios 🩺 y ciencia 🔬.',
    veCalendarDateLabel: '10 de Marzo (Día del Médico en Venezuela) y 3 Dic',
    activeCardClasses: 'bg-blue-100/85 dark:bg-blue-500/20 border-blue-600 dark:border-blue-400 ring-4 ring-blue-500/10',
    inactiveCardClasses: 'bg-[#edf4fc] dark:bg-slate-950/60 border-blue-200 dark:border-slate-800 hover:border-blue-500/50',
    activeBadgeClasses: 'bg-blue-700 dark:bg-blue-500 text-white',
  },
  {
    style: 'carnaval',
    emoji: '🎭 🎊',
    title: 'Carnaval',
    description: 'Magenta tropical, turquesa caribeño y oro festivo. Máscaras 🎭, maracas 🪇 y confeti 🎊.',
    veCalendarDateLabel: 'Lunes y Martes de Carnaval (Calendario móvil VE)',
    activeCardClasses: 'bg-fuchsia-100/85 dark:bg-fuchsia-500/20 border-fuchsia-600 dark:border-fuchsia-400 ring-4 ring-fuchsia-500/10',
    inactiveCardClasses: 'bg-[#fbf0f8] dark:bg-slate-950/60 border-fuchsia-200 dark:border-slate-800 hover:border-fuchsia-500/50',
    activeBadgeClasses: 'bg-fuchsia-700 dark:bg-fuchsia-500 text-white',
  },
  {
    style: 'ano_nuevo',
    emoji: '🎆 🥂',
    title: 'Año Nuevo',
    description: 'Gala dorada, champaña e índigo estelar. Fuegos artificiales 🎆, brindis 🥂 y 12 uvas 🍇.',
    veCalendarDateLabel: '31 de Diciembre al 6 de Enero (Año Nuevo y Reyes)',
    activeCardClasses: 'bg-amber-100/85 dark:bg-amber-500/20 border-amber-600 dark:border-amber-400 ring-4 ring-amber-500/10',
    inactiveCardClasses: 'bg-[#fbf7ec] dark:bg-slate-950/60 border-amber-200 dark:border-slate-800 hover:border-amber-500/50',
    activeBadgeClasses: 'bg-amber-600 dark:bg-amber-400 text-white dark:text-slate-950',
  },
  {
    style: 'guardia_nocturna',
    emoji: '🌙 ☕',
    title: 'Guardia Nocturna',
    description: 'Índigo nocturno de baja fatiga visual y cian suave. Luna 🌙, café de guardia ☕ y estrellas ⭐.',
    veCalendarDateLabel: 'Horario de Guardia (7:00 PM a 6:00 AM hora VE)',
    activeCardClasses: 'bg-indigo-100/85 dark:bg-indigo-500/20 border-indigo-600 dark:border-indigo-400 ring-4 ring-indigo-500/10',
    inactiveCardClasses: 'bg-[#eceff8] dark:bg-slate-950/60 border-indigo-200 dark:border-slate-800 hover:border-indigo-500/50',
    activeBadgeClasses: 'bg-indigo-700 dark:bg-indigo-500 text-white',
  },
  {
    style: 'primavera',
    emoji: '🌸 🦋',
    title: 'Primavera / Calma',
    description: 'Rosa cerezo, flor de Araguaney y verde menta sereno. Flores 🌸, mariposas 🦋 y paz 🕊️.',
    veCalendarDateLabel: 'Mes de Mayo (Floración del Araguaney / Mes de las Flores)',
    activeCardClasses: 'bg-pink-100/85 dark:bg-pink-500/20 border-pink-600 dark:border-pink-400 ring-4 ring-pink-500/10',
    inactiveCardClasses: 'bg-[#fcf1f5] dark:bg-slate-950/60 border-pink-200 dark:border-slate-800 hover:border-pink-500/50',
    activeBadgeClasses: 'bg-pink-600 dark:bg-pink-400 text-white dark:text-slate-950',
  },
  {
    style: 'espacio',
    emoji: '🚀 🪐',
    title: 'Espacio / Galaxia',
    description: 'Nebulosa violeta, azul cósmico y polvo estelar. Cohetes 🚀, Saturno 🪐 y astronautas 👨‍🚀.',
    veCalendarDateLabel: '4 al 10 de Octubre (Semana Mundial del Espacio)',
    activeCardClasses: 'bg-violet-100/85 dark:bg-violet-500/20 border-violet-600 dark:border-violet-400 ring-4 ring-violet-500/10',
    inactiveCardClasses: 'bg-[#f1effa] dark:bg-slate-950/60 border-violet-200 dark:border-slate-800 hover:border-violet-500/50',
    activeBadgeClasses: 'bg-violet-700 dark:bg-violet-500 text-white',
  },
  {
    style: 'fondo_marino',
    emoji: '🐠 🐬',
    title: 'Fondo Marino',
    description: 'Aguamarina arrecife, azul océano y coral caribeño. Peces 🐠, delfines 🐬, tortugas 🐢 y burbujas 🫧.',
    veCalendarDateLabel: '5 al 10 de Junio (Semana de los Océanos y Mar Caribe)',
    activeCardClasses: 'bg-cyan-100/85 dark:bg-cyan-500/20 border-cyan-600 dark:border-cyan-400 ring-4 ring-cyan-500/10',
    inactiveCardClasses: 'bg-[#eaf8fa] dark:bg-slate-950/60 border-cyan-200 dark:border-slate-800 hover:border-cyan-500/50',
    activeBadgeClasses: 'bg-cyan-700 dark:bg-cyan-500 text-white dark:text-slate-950',
  },
  {
    style: 'pequenos_heroes',
    emoji: '🦸 ⚡',
    title: 'Pequeños Héroes',
    description: 'Rojo valiente, azul real y dorado campeón en honor a los niños guerreros. Superhéroes 🦸 y trofeos 🏆.',
    veCalendarDateLabel: '15 Feb y 26–30 Abril (Día de los Superhéroes Pediátricos)',
    activeCardClasses: 'bg-red-100/85 dark:bg-red-500/20 border-red-600 dark:border-red-400 ring-4 ring-red-500/10',
    inactiveCardClasses: 'bg-[#fdf1f1] dark:bg-slate-950/60 border-red-200 dark:border-slate-800 hover:border-red-500/50',
    activeBadgeClasses: 'bg-red-600 dark:bg-red-500 text-white',
  },
  {
    style: 'amor_amistad',
    emoji: '💖 🌹',
    title: 'Amor y Amistad',
    description: 'Rosa cálido, rubí suave y crema. Corazones 💖, rosas 🌹, chocolates 🍫 y abrazos 🤗.',
    veCalendarDateLabel: '12 al 16 de Febrero (14 Feb: Día del Amor y la Amistad)',
    activeCardClasses: 'bg-rose-100/85 dark:bg-rose-500/20 border-rose-600 dark:border-rose-400 ring-4 ring-rose-500/10',
    inactiveCardClasses: 'bg-[#fdf0f3] dark:bg-slate-950/60 border-rose-200 dark:border-slate-800 hover:border-rose-500/50',
    activeBadgeClasses: 'bg-rose-600 dark:bg-rose-500 text-white',
  },
  {
    style: 'otono',
    emoji: '🍂 ☕',
    title: 'Otoño / Café',
    description: 'Terracota suave, ámbar canela y café expreso. Hojas de otoño 🍂, arce 🍁 y café caliente ☕.',
    veCalendarDateLabel: '28 Sep al 3 Oct (1 Oct: Día Internacional del Café)',
    activeCardClasses: 'bg-amber-100/85 dark:bg-amber-600/20 border-amber-700 dark:border-amber-500 ring-4 ring-amber-600/10',
    inactiveCardClasses: 'bg-[#f8f1e7] dark:bg-slate-950/60 border-amber-300 dark:border-slate-800 hover:border-amber-600/50',
    activeBadgeClasses: 'bg-amber-800 dark:bg-amber-500 text-white dark:text-slate-950',
  },
  {
    style: 'lluvia_relajante',
    emoji: '🌧️ ☔',
    title: 'Lluvia Relajante',
    description: 'Gris nube sereno, azul lluvia fresca y verde hoja húmeda. Gotas 💧, paraguas ☔ y arcoíris 🌈.',
    veCalendarDateLabel: '18 al 22 de Junio (Temporada de Lluvias VE)',
    activeCardClasses: 'bg-sky-100/85 dark:bg-sky-600/20 border-sky-700 dark:border-sky-400 ring-4 ring-sky-600/10',
    inactiveCardClasses: 'bg-[#edf2f7] dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 hover:border-sky-500/50',
    activeBadgeClasses: 'bg-sky-700 dark:bg-sky-500 text-white',
  },
  {
    style: 'fiestas_patrias',
    emoji: '🇻🇪 💛💙❤️',
    title: 'Fiestas Patrias (Venezuela)',
    description:
      'Degradados Tricolor de la Bandera de Venezuela (Amarillo, Azul y Rojo) con las 8 Estrellas ⭐, Araguaney 🌼 y Guacamaya 🦜.',
    veCalendarDateLabel: '19 Abr, 24 Jun, 5 Jul, 24 Jul y 12 Oct (Días Patrios VE)',
    activeCardClasses:
      'bg-gradient-to-br from-yellow-200/95 via-blue-200/90 to-red-200/95 dark:from-yellow-500/30 dark:via-blue-600/35 dark:to-red-600/35 border-yellow-500 dark:border-yellow-400 ring-4 ring-blue-500/20',
    inactiveCardClasses:
      'bg-gradient-to-br from-yellow-50/90 via-blue-50/85 to-red-50/90 dark:from-yellow-950/25 dark:via-blue-950/30 dark:to-red-950/25 border-yellow-300/80 dark:border-blue-800/70 hover:border-yellow-500',
    activeBadgeClasses:
      'bg-gradient-to-r from-[#FFCC00] via-[#00247D] to-[#CF142B] text-white shadow-xs',
  },
  {
    style: 'equipo_salud',
    emoji: '💉 🩺',
    title: 'Equipo de Salud',
    description: 'Verde quirúrgico esmeralda y turquesa asistencial. Vacunas 💉, estetoscopios 🩺, laboratorio 🧪 y cuidado ❤️‍🩹.',
    veCalendarDateLabel: '6 Mayo (Bioanalista) y 12 Mayo (Enfermería / Equipo de Salud)',
    activeCardClasses: 'bg-emerald-100/85 dark:bg-emerald-500/20 border-emerald-600 dark:border-emerald-400 ring-4 ring-emerald-500/10',
    inactiveCardClasses: 'bg-[#ecf7f3] dark:bg-slate-950/60 border-emerald-200 dark:border-slate-800 hover:border-emerald-500/50',
    activeBadgeClasses: 'bg-emerald-700 dark:bg-emerald-500 text-white',
  },
  {
    style: 'navidad',
    emoji: '🎅 🎁',
    title: 'Estilo Navidad',
    description: 'Pergamino cálido, verde pino y rojo navideño. Regalos 🎁, Santa 🎅 y nieve ❄️.',
    veCalendarDateLabel: '15 de Noviembre al 30 de Diciembre (Navidad en Venezuela)',
    activeCardClasses: 'bg-emerald-100/80 dark:bg-red-500/20 border-red-600 dark:border-red-500 ring-4 ring-red-500/10',
    inactiveCardClasses: 'bg-[#f5f1e9] dark:bg-slate-950/60 border-[#dfd6c5] dark:border-slate-800 hover:border-red-500/50',
    activeBadgeClasses: 'bg-red-700 dark:bg-red-500 text-white',
  },
  {
    style: 'halloween',
    emoji: '🎃 🦇',
    title: 'Estilo Halloween',
    description: 'Lavanda crepuscular y naranja calabaza. Calabazas 🎃, Murciélagos 🦇 y Fantasmas 👻.',
    veCalendarDateLabel: '25 de Octubre al 2 de Noviembre',
    activeCardClasses: 'bg-purple-100/80 dark:bg-amber-500/20 border-orange-600 dark:border-amber-500 ring-4 ring-orange-500/10',
    inactiveCardClasses: 'bg-[#f2edf6] dark:bg-slate-950/60 border-[#dcd3ea] dark:border-slate-800 hover:border-orange-500/50',
    activeBadgeClasses: 'bg-orange-700 dark:bg-amber-500 text-white dark:text-slate-950',
  },
];

export const SEASONAL_THEME_MAP: Record<SeasonalStyle, SeasonalThemeTokens> = {
  normal: {
    style: 'normal',
    label: 'Estilo Normal',
    rootCanvas: 'bg-[#eef4f5] dark:bg-[#020617] text-slate-800 dark:text-slate-100',
    headerSurface: 'bg-[#f7fbfb]/95 dark:bg-slate-900/95 border-[#cfe0e2] dark:border-slate-800',
    mobileNavSurface: 'bg-[#f7fbfb]/95 dark:bg-slate-900/95 border-[#cfe0e2] dark:border-slate-800',
    brandSubtitle: 'text-teal-700 dark:text-teal-400',
    navActive: 'text-teal-700 dark:text-teal-400 font-bold border-b-2 border-teal-600 dark:border-teal-400 pb-1',
    navHover: 'hover:text-teal-700 dark:hover:text-teal-400',
    navIcon: 'text-teal-600 dark:text-teal-400',
    mobileNavActive: 'text-teal-700 dark:text-teal-400 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#e2f0f0] via-[#edf6f6] to-[#e1ecf2] dark:from-slate-900 dark:via-teal-950 dark:to-slate-900 text-slate-900 dark:text-white border-[#bfd8da] dark:border-slate-800 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-teal-600/12 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-600/25 dark:border-teal-500/30',
    heroTitleAccent: 'text-teal-700 dark:text-teal-400',
    heroGreetingM: 'text-sky-800 dark:text-sky-300',
    heroGreetingF: 'text-pink-700 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-teal-700 hover:bg-teal-600 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/85 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-[#bfd8da] dark:border-teal-500/30 hover:border-teal-600/50 dark:hover:border-amber-500/50',
    cardSurface: 'bg-[#f9fcfc] dark:bg-slate-900 border-[#d4e2e4] dark:border-slate-800',
    cardInnerSurface: 'bg-[#eef4f5] dark:bg-slate-800/60 border-[#d4e2e4] dark:border-slate-700/80',
    sectionDivider: 'border-[#d4e2e4] dark:border-slate-800',
    accentText: 'text-teal-700 dark:text-teal-400',
    accentIcon: 'text-teal-600 dark:text-teal-400',
    accentBadge: 'bg-teal-600/12 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-600/25 dark:border-teal-500/30',
    primaryButton: 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white',
    activePill: 'bg-teal-700 dark:bg-teal-600 text-white shadow-xs',
  },

  navidad: {
    style: 'navidad',
    label: 'Estilo Navidad',
    rootCanvas: 'bg-[#f5f1e9] dark:bg-[#05120c] text-[#1f241f] dark:text-stone-100',
    headerSurface: 'bg-[#fbf8f1]/95 dark:bg-[#0a1e15]/95 border-[#dfd5c3] dark:border-emerald-900/60',
    mobileNavSurface: 'bg-[#fbf8f1]/95 dark:bg-[#0a1e15]/95 border-[#dfd5c3] dark:border-emerald-900/60',
    brandSubtitle: 'text-emerald-800 dark:text-emerald-400',
    navActive: 'text-emerald-800 dark:text-emerald-300 font-bold border-b-2 border-red-700 dark:border-red-400 pb-1',
    navHover: 'hover:text-red-700 dark:hover:text-emerald-300',
    navIcon: 'text-red-700 dark:text-red-400',
    mobileNavActive: 'text-red-700 dark:text-emerald-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#e9f2ea] via-[#faf4e8] to-[#f7e9e9] dark:from-[#0a2318] dark:via-[#142a1e] dark:to-[#2b0f14] text-stone-900 dark:text-white border-[#cfdfc9] dark:border-emerald-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-red-700/12 dark:bg-red-500/20 text-red-800 dark:text-red-200 border-red-700/25 dark:border-red-400/35',
    heroTitleAccent: 'text-emerald-800 dark:text-emerald-300',
    heroGreetingM: 'text-emerald-900 dark:text-amber-300',
    heroGreetingF: 'text-rose-800 dark:text-rose-300',
    heroBodyText: 'text-stone-600 dark:text-stone-300',
    heroPrimaryBtn:
      'bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/85 hover:bg-white dark:bg-[#10291e]/90 dark:hover:bg-[#163829] text-stone-800 dark:text-stone-100 border border-[#d6ccb8] dark:border-amber-500/40 hover:border-red-600/50 dark:hover:border-amber-400/60',
    cardSurface: 'bg-[#fcfaf5] dark:bg-[#0b1f16] border-[#dfd6c5] dark:border-emerald-900/60',
    cardInnerSurface: 'bg-[#f2ece0] dark:bg-[#10291e]/80 border-[#dfd6c5] dark:border-emerald-800/60',
    sectionDivider: 'border-[#dfd6c5] dark:border-emerald-900/60',
    accentText: 'text-emerald-800 dark:text-emerald-300',
    accentIcon: 'text-red-700 dark:text-red-400',
    accentBadge: 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-700/25 dark:border-emerald-500/30',
    primaryButton: 'bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
    activePill: 'bg-red-700 dark:bg-red-600 text-white shadow-xs',
  },

  halloween: {
    style: 'halloween',
    label: 'Estilo Halloween',
    rootCanvas: 'bg-[#f2edf6] dark:bg-[#0c0714] text-[#22182c] dark:text-slate-100',
    headerSurface: 'bg-[#f9f6fc]/95 dark:bg-[#160e24]/95 border-[#dad0e8] dark:border-purple-900/60',
    mobileNavSurface: 'bg-[#f9f6fc]/95 dark:bg-[#160e24]/95 border-[#dad0e8] dark:border-purple-900/60',
    brandSubtitle: 'text-purple-800 dark:text-orange-400',
    navActive: 'text-orange-700 dark:text-orange-400 font-bold border-b-2 border-orange-600 dark:border-orange-400 pb-1',
    navHover: 'hover:text-orange-700 dark:hover:text-orange-300',
    navIcon: 'text-orange-600 dark:text-orange-400',
    mobileNavActive: 'text-orange-700 dark:text-orange-400 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#efe7f7] via-[#f8f1ee] to-[#f8ece2] dark:from-[#170e26] dark:via-[#241336] dark:to-[#2c150c] text-slate-900 dark:text-white border-[#d6c8e8] dark:border-purple-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-orange-600/12 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-600/25 dark:border-orange-400/35',
    heroTitleAccent: 'text-purple-800 dark:text-orange-400',
    heroGreetingM: 'text-purple-800 dark:text-purple-300',
    heroGreetingF: 'text-orange-800 dark:text-amber-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-orange-700 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/85 hover:bg-white dark:bg-[#211535]/90 dark:hover:bg-[#2c1d45] text-slate-800 dark:text-slate-100 border border-[#d6c8e8] dark:border-orange-500/40 hover:border-purple-600/50 dark:hover:border-orange-400/60',
    cardSurface: 'bg-[#fbf9fd] dark:bg-[#140d21] border-[#dcd3ea] dark:border-purple-900/60',
    cardInnerSurface: 'bg-[#efe9f6] dark:bg-[#1d1330]/80 border-[#dcd3ea] dark:border-purple-800/60',
    sectionDivider: 'border-[#dcd3ea] dark:border-purple-900/60',
    accentText: 'text-purple-800 dark:text-purple-300',
    accentIcon: 'text-orange-600 dark:text-orange-400',
    accentBadge: 'bg-purple-600/12 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-600/25 dark:border-purple-500/35',
    primaryButton: 'bg-purple-700 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-500 text-white',
    activePill: 'bg-orange-700 dark:bg-orange-600 text-white shadow-xs',
  },

  dia_del_nino: {
    style: 'dia_del_nino',
    label: '🧸 Día del Niño / Pediatría',
    rootCanvas: 'bg-[#edf7fe] dark:bg-[#061527] text-slate-800 dark:text-sky-50',
    headerSurface: 'bg-[#f6fbff]/95 dark:bg-[#0b213b]/95 border-[#c5e2f6] dark:border-sky-800/60',
    mobileNavSurface: 'bg-[#f6fbff]/95 dark:bg-[#0b213b]/95 border-[#c5e2f6] dark:border-sky-800/60',
    brandSubtitle: 'text-sky-700 dark:text-sky-300',
    navActive: 'text-sky-700 dark:text-amber-300 font-bold border-b-2 border-sky-600 dark:border-amber-400 pb-1',
    navHover: 'hover:text-sky-700 dark:hover:text-amber-300',
    navIcon: 'text-sky-600 dark:text-amber-400',
    mobileNavActive: 'text-sky-700 dark:text-amber-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#dff1ff] via-[#fff7e6] to-[#ffeaf2] dark:from-[#0c2542] dark:via-[#122b4a] dark:to-[#2b1632] text-slate-900 dark:text-white border-[#b7dcf7] dark:border-sky-700/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-sky-600/15 dark:bg-sky-400/20 text-sky-900 dark:text-sky-200 border-sky-500/30 dark:border-sky-400/40',
    heroTitleAccent: 'text-sky-700 dark:text-amber-300',
    heroGreetingM: 'text-sky-800 dark:text-sky-300',
    heroGreetingF: 'text-rose-700 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-sky-600 hover:bg-sky-500 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#102a49]/90 dark:hover:bg-[#17375e] text-slate-800 dark:text-slate-100 border border-[#b7dcf7] dark:border-sky-500/40',
    cardSurface: 'bg-[#f8fcff] dark:bg-[#091c32] border-[#cbe4f8] dark:border-sky-900/60',
    cardInnerSurface: 'bg-[#e6f3fc] dark:bg-[#102946]/80 border-[#cbe4f8] dark:border-sky-800/60',
    sectionDivider: 'border-[#cbe4f8] dark:border-sky-900/60',
    accentText: 'text-sky-700 dark:text-sky-300',
    accentIcon: 'text-amber-600 dark:text-amber-400',
    accentBadge: 'bg-sky-600/12 dark:bg-sky-500/20 text-sky-800 dark:text-sky-200 border-sky-600/25 dark:border-sky-400/35',
    primaryButton: 'bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 text-white',
    activePill: 'bg-sky-600 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs',
  },

  dia_del_medico: {
    style: 'dia_del_medico',
    label: '🩺 Día del Médico / Clínico',
    rootCanvas: 'bg-[#ebf2fa] dark:bg-[#040f21] text-slate-800 dark:text-blue-50',
    headerSurface: 'bg-[#f5f9fe]/95 dark:bg-[#081a36]/95 border-[#c4d8ef] dark:border-blue-900/70',
    mobileNavSurface: 'bg-[#f5f9fe]/95 dark:bg-[#081a36]/95 border-[#c4d8ef] dark:border-blue-900/70',
    brandSubtitle: 'text-blue-800 dark:text-blue-300',
    navActive: 'text-blue-800 dark:text-blue-300 font-bold border-b-2 border-blue-700 dark:border-amber-400 pb-1',
    navHover: 'hover:text-blue-700 dark:hover:text-blue-300',
    navIcon: 'text-blue-700 dark:text-blue-400',
    mobileNavActive: 'text-blue-800 dark:text-blue-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#dceafa] via-[#eef5fc] to-[#e4f2f2] dark:from-[#091d3c] dark:via-[#0d274c] dark:to-[#092b34] text-slate-900 dark:text-white border-[#b8d1ec] dark:border-blue-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-blue-700/12 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 border-blue-700/25 dark:border-blue-400/35',
    heroTitleAccent: 'text-blue-800 dark:text-amber-300',
    heroGreetingM: 'text-blue-900 dark:text-blue-300',
    heroGreetingF: 'text-indigo-800 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-blue-700 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#0f2647]/90 dark:hover:bg-[#16345e] text-slate-800 dark:text-slate-100 border border-[#b8d1ec] dark:border-blue-500/40',
    cardSurface: 'bg-[#f8fbff] dark:bg-[#07162c] border-[#ccdef2] dark:border-blue-900/60',
    cardInnerSurface: 'bg-[#e6f0fa] dark:bg-[#0e2240]/80 border-[#ccdef2] dark:border-blue-800/60',
    sectionDivider: 'border-[#ccdef2] dark:border-blue-900/60',
    accentText: 'text-blue-800 dark:text-blue-300',
    accentIcon: 'text-blue-700 dark:text-amber-400',
    accentBadge: 'bg-blue-700/12 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 border-blue-700/25 dark:border-blue-400/35',
    primaryButton: 'bg-blue-700 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white',
    activePill: 'bg-blue-700 dark:bg-blue-600 text-white shadow-xs',
  },

  carnaval: {
    style: 'carnaval',
    label: '🎭 Carnaval',
    rootCanvas: 'bg-[#faf0f7] dark:bg-[#15071e] text-slate-900 dark:text-fuchsia-50',
    headerSurface: 'bg-[#fef7fc]/95 dark:bg-[#220c30]/95 border-[#ebcde4] dark:border-fuchsia-900/60',
    mobileNavSurface: 'bg-[#fef7fc]/95 dark:bg-[#220c30]/95 border-[#ebcde4] dark:border-fuchsia-900/60',
    brandSubtitle: 'text-fuchsia-800 dark:text-fuchsia-300',
    navActive: 'text-fuchsia-700 dark:text-amber-300 font-bold border-b-2 border-fuchsia-600 dark:border-amber-400 pb-1',
    navHover: 'hover:text-fuchsia-700 dark:hover:text-amber-300',
    navIcon: 'text-fuchsia-600 dark:text-amber-400',
    mobileNavActive: 'text-fuchsia-700 dark:text-amber-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#fae3f3] via-[#fef5e4] to-[#e2f7f5] dark:from-[#2c0e3d] dark:via-[#23123b] dark:to-[#0b2e36] text-slate-900 dark:text-white border-[#e8bfe0] dark:border-fuchsia-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-fuchsia-600/15 dark:bg-fuchsia-500/20 text-fuchsia-900 dark:text-fuchsia-200 border-fuchsia-600/30 dark:border-fuchsia-400/40',
    heroTitleAccent: 'text-fuchsia-700 dark:text-amber-300',
    heroGreetingM: 'text-teal-800 dark:text-cyan-300',
    heroGreetingF: 'text-fuchsia-800 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-fuchsia-700 hover:bg-fuchsia-600 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#2a113b]/90 dark:hover:bg-[#38174f] text-slate-800 dark:text-slate-100 border border-[#e8bfe0] dark:border-fuchsia-500/40',
    cardSurface: 'bg-[#fff9fd] dark:bg-[#1c0a29] border-[#ead1e4] dark:border-fuchsia-900/60',
    cardInnerSurface: 'bg-[#f6e8f2] dark:bg-[#28103a]/80 border-[#ead1e4] dark:border-fuchsia-800/60',
    sectionDivider: 'border-[#ead1e4] dark:border-fuchsia-900/60',
    accentText: 'text-fuchsia-800 dark:text-fuchsia-300',
    accentIcon: 'text-fuchsia-600 dark:text-amber-400',
    accentBadge: 'bg-fuchsia-600/12 dark:bg-fuchsia-500/20 text-fuchsia-900 dark:text-fuchsia-200 border-fuchsia-600/25 dark:border-fuchsia-400/35',
    primaryButton: 'bg-fuchsia-700 hover:bg-fuchsia-600 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-500 text-white',
    activePill: 'bg-fuchsia-700 dark:bg-fuchsia-600 text-white shadow-xs',
  },

  ano_nuevo: {
    style: 'ano_nuevo',
    label: '🎆 Año Nuevo',
    rootCanvas: 'bg-[#f8f4e8] dark:bg-[#080c1c] text-stone-900 dark:text-amber-50',
    headerSurface: 'bg-[#fdfbf4]/95 dark:bg-[#0f162e]/95 border-[#e5d9b8] dark:border-amber-800/60',
    mobileNavSurface: 'bg-[#fdfbf4]/95 dark:bg-[#0f162e]/95 border-[#e5d9b8] dark:border-amber-800/60',
    brandSubtitle: 'text-amber-800 dark:text-amber-300',
    navActive: 'text-amber-800 dark:text-amber-300 font-bold border-b-2 border-amber-600 dark:border-amber-400 pb-1',
    navHover: 'hover:text-amber-700 dark:hover:text-amber-300',
    navIcon: 'text-amber-600 dark:text-amber-400',
    mobileNavActive: 'text-amber-800 dark:text-amber-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#f9efd2] via-[#fdf9ee] to-[#eaeefa] dark:from-[#161c38] dark:via-[#1f1a2e] dark:to-[#291f0c] text-stone-900 dark:text-white border-[#e2cf9f] dark:border-amber-600/50 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-amber-600/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-600/30 dark:border-amber-400/40',
    heroTitleAccent: 'text-amber-800 dark:text-amber-300',
    heroGreetingM: 'text-indigo-900 dark:text-amber-300',
    heroGreetingF: 'text-rose-800 dark:text-amber-200',
    heroBodyText: 'text-stone-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-amber-600 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#171f3c]/90 dark:hover:bg-[#222d54] text-stone-800 dark:text-amber-100 border border-[#e2cf9f] dark:border-amber-500/40',
    cardSurface: 'bg-[#fefcf6] dark:bg-[#0d1326] border-[#e6dab8] dark:border-amber-900/50',
    cardInnerSurface: 'bg-[#f4eddc] dark:bg-[#151e38]/80 border-[#e6dab8] dark:border-amber-800/50',
    sectionDivider: 'border-[#e6dab8] dark:border-amber-900/50',
    accentText: 'text-amber-800 dark:text-amber-300',
    accentIcon: 'text-amber-600 dark:text-amber-400',
    accentBadge: 'bg-amber-600/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-600/30 dark:border-amber-400/40',
    primaryButton: 'bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950',
    activePill: 'bg-amber-600 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs',
  },

  guardia_nocturna: {
    style: 'guardia_nocturna',
    label: '🌙 Guardia Nocturna',
    rootCanvas: 'bg-[#e6ebf5] dark:bg-[#030712] text-slate-900 dark:text-indigo-50',
    headerSurface: 'bg-[#f0f4fa]/95 dark:bg-[#090f24]/95 border-[#c5d1e8] dark:border-indigo-900/70',
    mobileNavSurface: 'bg-[#f0f4fa]/95 dark:bg-[#090f24]/95 border-[#c5d1e8] dark:border-indigo-900/70',
    brandSubtitle: 'text-indigo-800 dark:text-indigo-300',
    navActive: 'text-indigo-800 dark:text-cyan-300 font-bold border-b-2 border-indigo-600 dark:border-cyan-400 pb-1',
    navHover: 'hover:text-indigo-700 dark:hover:text-cyan-300',
    navIcon: 'text-indigo-600 dark:text-cyan-400',
    mobileNavActive: 'text-indigo-800 dark:text-cyan-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#dce4f5] via-[#e8eef8] to-[#ddeef2] dark:from-[#091026] dark:via-[#111836] dark:to-[#071f2e] text-slate-900 dark:text-white border-[#b9c8e6] dark:border-indigo-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-indigo-600/15 dark:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 border-indigo-600/30 dark:border-indigo-400/40',
    heroTitleAccent: 'text-indigo-800 dark:text-cyan-300',
    heroGreetingM: 'text-indigo-900 dark:text-cyan-300',
    heroGreetingF: 'text-purple-800 dark:text-violet-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-indigo-700 hover:bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#111a36]/90 dark:hover:bg-[#19254a] text-slate-800 dark:text-slate-100 border border-[#b9c8e6] dark:border-indigo-500/40',
    cardSurface: 'bg-[#f4f7fc] dark:bg-[#080d1f] border-[#ccd6eb] dark:border-indigo-900/60',
    cardInnerSurface: 'bg-[#e3eaf5] dark:bg-[#101833]/80 border-[#ccd6eb] dark:border-indigo-800/60',
    sectionDivider: 'border-[#ccd6eb] dark:border-indigo-900/60',
    accentText: 'text-indigo-800 dark:text-indigo-300',
    accentIcon: 'text-indigo-600 dark:text-cyan-400',
    accentBadge: 'bg-indigo-600/12 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border-indigo-600/25 dark:border-indigo-400/35',
    primaryButton: 'bg-indigo-700 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white',
    activePill: 'bg-indigo-700 dark:bg-indigo-600 text-white shadow-xs',
  },

  primavera: {
    style: 'primavera',
    label: '🌸 Primavera / Calma',
    rootCanvas: 'bg-[#fbf2f5] dark:bg-[#140a14] text-slate-800 dark:text-pink-50',
    headerSurface: 'bg-[#fef8fa]/95 dark:bg-[#211021]/95 border-[#edd2dc] dark:border-pink-900/60',
    mobileNavSurface: 'bg-[#fef8fa]/95 dark:bg-[#211021]/95 border-[#edd2dc] dark:border-pink-900/60',
    brandSubtitle: 'text-pink-700 dark:text-pink-300',
    navActive: 'text-pink-700 dark:text-pink-300 font-bold border-b-2 border-pink-600 dark:border-pink-400 pb-1',
    navHover: 'hover:text-pink-700 dark:hover:text-pink-300',
    navIcon: 'text-pink-600 dark:text-pink-400',
    mobileNavActive: 'text-pink-700 dark:text-pink-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#fae5ed] via-[#fdf6f0] to-[#e6f5ec] dark:from-[#261124] dark:via-[#1f1629] dark:to-[#0d261e] text-slate-900 dark:text-white border-[#ebc4d4] dark:border-pink-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-pink-600/12 dark:bg-pink-500/20 text-pink-800 dark:text-pink-200 border-pink-600/25 dark:border-pink-400/35',
    heroTitleAccent: 'text-pink-700 dark:text-pink-300',
    heroGreetingM: 'text-emerald-800 dark:text-emerald-300',
    heroGreetingF: 'text-pink-800 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-pink-600 hover:bg-pink-500 dark:bg-pink-500 dark:hover:bg-pink-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#291429]/90 dark:hover:bg-[#381b38] text-slate-800 dark:text-slate-100 border border-[#ebc4d4] dark:border-pink-500/40',
    cardSurface: 'bg-[#fffafb] dark:bg-[#1a0d1a] border-[#eed6df] dark:border-pink-900/60',
    cardInnerSurface: 'bg-[#f7eaf0] dark:bg-[#261326]/80 border-[#eed6df] dark:border-pink-800/60',
    sectionDivider: 'border-[#eed6df] dark:border-pink-900/60',
    accentText: 'text-pink-700 dark:text-pink-300',
    accentIcon: 'text-pink-600 dark:text-pink-400',
    accentBadge: 'bg-pink-600/12 dark:bg-pink-500/20 text-pink-800 dark:text-pink-200 border-pink-600/25 dark:border-pink-400/35',
    primaryButton: 'bg-pink-600 hover:bg-pink-500 dark:bg-pink-600 dark:hover:bg-pink-500 text-white',
    activePill: 'bg-pink-600 dark:bg-pink-500 text-white shadow-xs',
  },

  espacio: {
    style: 'espacio',
    label: '🚀 Espacio / Galaxia',
    rootCanvas: 'bg-[#eeeaf7] dark:bg-[#070514] text-slate-900 dark:text-violet-50',
    headerSurface: 'bg-[#f7f5fc]/95 dark:bg-[#110c29]/95 border-[#d5ccec] dark:border-violet-900/70',
    mobileNavSurface: 'bg-[#f7f5fc]/95 dark:bg-[#110c29]/95 border-[#d5ccec] dark:border-violet-900/70',
    brandSubtitle: 'text-violet-800 dark:text-violet-300',
    navActive: 'text-violet-700 dark:text-violet-300 font-bold border-b-2 border-violet-600 dark:border-violet-400 pb-1',
    navHover: 'hover:text-violet-700 dark:hover:text-violet-300',
    navIcon: 'text-violet-600 dark:text-violet-400',
    mobileNavActive: 'text-violet-700 dark:text-violet-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#e6dff7] via-[#edf0fb] to-[#dff0f7] dark:from-[#140d30] dark:via-[#1c113d] dark:to-[#092038] text-slate-900 dark:text-white border-[#cbbef0] dark:border-violet-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-violet-600/15 dark:bg-violet-500/20 text-violet-900 dark:text-violet-200 border-violet-600/30 dark:border-violet-400/40',
    heroTitleAccent: 'text-violet-800 dark:text-violet-300',
    heroGreetingM: 'text-indigo-800 dark:text-cyan-300',
    heroGreetingF: 'text-purple-800 dark:text-fuchsia-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-violet-700 hover:bg-violet-600 dark:bg-violet-500 dark:hover:bg-violet-400 text-white shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#1a1238]/90 dark:hover:bg-[#24194d] text-slate-800 dark:text-slate-100 border border-[#cbbef0] dark:border-violet-500/40',
    cardSurface: 'bg-[#faf8fe] dark:bg-[#0d0921] border-[#dad2f0] dark:border-violet-900/60',
    cardInnerSurface: 'bg-[#ede8f8] dark:bg-[#171036]/80 border-[#dad2f0] dark:border-violet-800/60',
    sectionDivider: 'border-[#dad2f0] dark:border-violet-900/60',
    accentText: 'text-violet-800 dark:text-violet-300',
    accentIcon: 'text-violet-600 dark:text-violet-400',
    accentBadge: 'bg-violet-600/12 dark:bg-violet-500/20 text-violet-900 dark:text-violet-200 border-violet-600/25 dark:border-violet-400/35',
    primaryButton: 'bg-violet-700 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white',
    activePill: 'bg-violet-700 dark:bg-violet-600 text-white shadow-xs',
  },

  fondo_marino: {
    style: 'fondo_marino',
    label: '🐠 Fondo Marino',
    rootCanvas: 'bg-[#e6f6f8] dark:bg-[#03161c] text-slate-800 dark:text-cyan-50',
    headerSurface: 'bg-[#f2fbfc]/95 dark:bg-[#06242e]/95 border-[#bce3ea] dark:border-cyan-900/70',
    mobileNavSurface: 'bg-[#f2fbfc]/95 dark:bg-[#06242e]/95 border-[#bce3ea] dark:border-cyan-900/70',
    brandSubtitle: 'text-cyan-800 dark:text-cyan-300',
    navActive: 'text-cyan-800 dark:text-cyan-300 font-bold border-b-2 border-cyan-600 dark:border-cyan-400 pb-1',
    navHover: 'hover:text-cyan-700 dark:hover:text-cyan-300',
    navIcon: 'text-cyan-600 dark:text-cyan-400',
    mobileNavActive: 'text-cyan-800 dark:text-cyan-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#d7f2f6] via-[#eaf9fb] to-[#e0f2fe] dark:from-[#062a36] dark:via-[#083344] dark:to-[#0c2540] text-slate-900 dark:text-white border-[#a8dce6] dark:border-cyan-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-cyan-600/15 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border-cyan-600/30 dark:border-cyan-400/40',
    heroTitleAccent: 'text-cyan-800 dark:text-cyan-300',
    heroGreetingM: 'text-sky-900 dark:text-cyan-300',
    heroGreetingF: 'text-teal-800 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-cyan-700 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#09303d]/90 dark:hover:bg-[#0d3f50] text-slate-800 dark:text-slate-100 border border-[#a8dce6] dark:border-cyan-500/40',
    cardSurface: 'bg-[#f6fcfd] dark:bg-[#051d26] border-[#c4e6ec] dark:border-cyan-900/60',
    cardInnerSurface: 'bg-[#e1f3f6] dark:bg-[#092b38]/80 border-[#c4e6ec] dark:border-cyan-800/60',
    sectionDivider: 'border-[#c4e6ec] dark:border-cyan-900/60',
    accentText: 'text-cyan-800 dark:text-cyan-300',
    accentIcon: 'text-cyan-600 dark:text-cyan-400',
    accentBadge: 'bg-cyan-600/12 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border-cyan-600/25 dark:border-cyan-400/35',
    primaryButton: 'bg-cyan-700 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white',
    activePill: 'bg-cyan-700 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs',
  },

  pequenos_heroes: {
    style: 'pequenos_heroes',
    label: '🦸 Pequeños Héroes',
    rootCanvas: 'bg-[#f9eef0] dark:bg-[#17090f] text-slate-900 dark:text-rose-50',
    headerSurface: 'bg-[#fef7f8]/95 dark:bg-[#260e18]/95 border-[#ebccd2] dark:border-red-900/60',
    mobileNavSurface: 'bg-[#fef7f8]/95 dark:bg-[#260e18]/95 border-[#ebccd2] dark:border-red-900/60',
    brandSubtitle: 'text-red-700 dark:text-amber-300',
    navActive: 'text-red-700 dark:text-amber-300 font-bold border-b-2 border-red-600 dark:border-amber-400 pb-1',
    navHover: 'hover:text-red-700 dark:hover:text-amber-300',
    navIcon: 'text-red-600 dark:text-amber-400',
    mobileNavActive: 'text-red-700 dark:text-amber-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#fde4e8] via-[#fff5e4] to-[#e4eefc] dark:from-[#2e101c] dark:via-[#24162c] dark:to-[#0f223d] text-slate-900 dark:text-white border-[#e8bfc8] dark:border-red-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-red-600/15 dark:bg-red-500/20 text-red-900 dark:text-amber-200 border-red-600/30 dark:border-amber-400/40',
    heroTitleAccent: 'text-red-700 dark:text-amber-300',
    heroGreetingM: 'text-blue-800 dark:text-sky-300',
    heroGreetingF: 'text-red-800 dark:text-rose-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-red-600 hover:bg-red-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#2b121e]/90 dark:hover:bg-[#3b1929] text-slate-800 dark:text-slate-100 border border-[#e8bfc8] dark:border-red-500/40',
    cardSurface: 'bg-[#fff9fa] dark:bg-[#1f0c14] border-[#ecd1d6] dark:border-red-900/60',
    cardInnerSurface: 'bg-[#f6e8eb] dark:bg-[#2c121d]/80 border-[#ecd1d6] dark:border-red-800/60',
    sectionDivider: 'border-[#ecd1d6] dark:border-red-900/60',
    accentText: 'text-red-700 dark:text-amber-300',
    accentIcon: 'text-red-600 dark:text-amber-400',
    accentBadge: 'bg-red-600/12 dark:bg-red-500/20 text-red-900 dark:text-amber-200 border-red-600/25 dark:border-red-400/35',
    primaryButton: 'bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500 text-white',
    activePill: 'bg-red-600 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs',
  },

  amor_amistad: {
    style: 'amor_amistad',
    label: '💖 Amor y Amistad',
    rootCanvas: 'bg-[#fcefef] dark:bg-[#190810] text-slate-800 dark:text-rose-50',
    headerSurface: 'bg-[#fff7f8]/95 dark:bg-[#260d19]/95 border-[#f0cdd6] dark:border-rose-900/60',
    mobileNavSurface: 'bg-[#fff7f8]/95 dark:bg-[#260d19]/95 border-[#f0cdd6] dark:border-rose-900/60',
    brandSubtitle: 'text-rose-700 dark:text-rose-300',
    navActive: 'text-rose-700 dark:text-rose-300 font-bold border-b-2 border-rose-600 dark:border-rose-400 pb-1',
    navHover: 'hover:text-rose-700 dark:hover:text-rose-300',
    navIcon: 'text-rose-600 dark:text-rose-400',
    mobileNavActive: 'text-rose-700 dark:text-rose-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#fce2e8] via-[#fff2f5] to-[#f9e8f7] dark:from-[#2e0f1e] dark:via-[#261124] dark:to-[#1f0d29] text-slate-900 dark:text-white border-[#edbecb] dark:border-rose-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-rose-600/15 dark:bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-600/30 dark:border-rose-400/40',
    heroTitleAccent: 'text-rose-700 dark:text-rose-300',
    heroGreetingM: 'text-rose-900 dark:text-amber-300',
    heroGreetingF: 'text-rose-700 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-rose-600 hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400 text-white shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#2d1220]/90 dark:hover:bg-[#3d182b] text-slate-800 dark:text-slate-100 border border-[#f0cdd6] dark:border-rose-500/40',
    cardSurface: 'bg-[#fff9fa] dark:bg-[#1e0a14] border-[#f0d2da] dark:border-rose-900/60',
    cardInnerSurface: 'bg-[#f8e8ec] dark:bg-[#2b101d]/80 border-[#f0d2da] dark:border-rose-800/60',
    sectionDivider: 'border-[#f0d2da] dark:border-rose-900/60',
    accentText: 'text-rose-700 dark:text-rose-300',
    accentIcon: 'text-rose-600 dark:text-rose-400',
    accentBadge: 'bg-rose-600/12 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-600/25 dark:border-rose-400/35',
    primaryButton: 'bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 text-white',
    activePill: 'bg-rose-600 dark:bg-rose-500 text-white shadow-xs',
  },

  otono: {
    style: 'otono',
    label: '🍂 Otoño / Café',
    rootCanvas: 'bg-[#f6efe6] dark:bg-[#140e09] text-stone-900 dark:text-amber-50',
    headerSurface: 'bg-[#fbf7f1]/95 dark:bg-[#21170f]/95 border-[#e2d2be] dark:border-amber-900/60',
    mobileNavSurface: 'bg-[#fbf7f1]/95 dark:bg-[#21170f]/95 border-[#e2d2be] dark:border-amber-900/60',
    brandSubtitle: 'text-amber-900 dark:text-amber-400',
    navActive: 'text-amber-900 dark:text-amber-300 font-bold border-b-2 border-amber-700 dark:border-amber-400 pb-1',
    navHover: 'hover:text-amber-800 dark:hover:text-amber-300',
    navIcon: 'text-amber-700 dark:text-amber-400',
    mobileNavActive: 'text-amber-900 dark:text-amber-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#f3e4d0] via-[#faf2e6] to-[#f2dfd7] dark:from-[#291b10] dark:via-[#211610] dark:to-[#2b140e] text-stone-900 dark:text-white border-[#dec7ab] dark:border-amber-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-amber-800/15 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-700/30 dark:border-amber-400/40',
    heroTitleAccent: 'text-amber-900 dark:text-amber-300',
    heroGreetingM: 'text-amber-950 dark:text-amber-300',
    heroGreetingF: 'text-orange-900 dark:text-orange-300',
    heroBodyText: 'text-stone-600 dark:text-stone-300',
    heroPrimaryBtn:
      'bg-amber-800 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#281b12]/90 dark:hover:bg-[#362418] text-stone-800 dark:text-stone-100 border border-[#dec7ab] dark:border-amber-600/40',
    cardSurface: 'bg-[#fcf9f4] dark:bg-[#1a120b] border-[#e3d4c2] dark:border-amber-900/60',
    cardInnerSurface: 'bg-[#f1e7d8] dark:bg-[#261a11]/80 border-[#e3d4c2] dark:border-amber-800/60',
    sectionDivider: 'border-[#e3d4c2] dark:border-amber-900/60',
    accentText: 'text-amber-900 dark:text-amber-300',
    accentIcon: 'text-amber-700 dark:text-amber-400',
    accentBadge: 'bg-amber-800/12 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-700/25 dark:border-amber-400/35',
    primaryButton: 'bg-amber-800 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white',
    activePill: 'bg-amber-800 dark:bg-amber-600 text-white shadow-xs',
  },

  lluvia_relajante: {
    style: 'lluvia_relajante',
    label: '🌧️ Lluvia Relajante',
    rootCanvas: 'bg-[#eaeff5] dark:bg-[#071018] text-slate-800 dark:text-slate-100',
    headerSurface: 'bg-[#f4f7fb]/95 dark:bg-[#0c1a26]/95 border-[#c8d6e5] dark:border-sky-900/60',
    mobileNavSurface: 'bg-[#f4f7fb]/95 dark:bg-[#0c1a26]/95 border-[#c8d6e5] dark:border-sky-900/60',
    brandSubtitle: 'text-sky-800 dark:text-sky-300',
    navActive: 'text-sky-800 dark:text-sky-300 font-bold border-b-2 border-sky-600 dark:border-sky-400 pb-1',
    navHover: 'hover:text-sky-700 dark:hover:text-sky-300',
    navIcon: 'text-sky-600 dark:text-sky-400',
    mobileNavActive: 'text-sky-800 dark:text-sky-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#dde7f2] via-[#eaf1f8] to-[#dfecea] dark:from-[#0c1e2e] dark:via-[#102436] dark:to-[#0c2626] text-slate-900 dark:text-white border-[#bdcfe2] dark:border-sky-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-sky-700/12 dark:bg-sky-500/20 text-sky-900 dark:text-sky-200 border-sky-600/25 dark:border-sky-400/35',
    heroTitleAccent: 'text-sky-800 dark:text-sky-300',
    heroGreetingM: 'text-sky-900 dark:text-sky-300',
    heroGreetingF: 'text-teal-800 dark:text-teal-300',
    heroBodyText: 'text-slate-600 dark:text-slate-300',
    heroPrimaryBtn:
      'bg-sky-700 hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#112433]/90 dark:hover:bg-[#173145] text-slate-800 dark:text-slate-100 border border-[#bdcfe2] dark:border-sky-500/40',
    cardSurface: 'bg-[#f7f9fc] dark:bg-[#0a1620] border-[#cfdbe8] dark:border-sky-900/60',
    cardInnerSurface: 'bg-[#e5ecf4] dark:bg-[#102230]/80 border-[#cfdbe8] dark:border-sky-800/60',
    sectionDivider: 'border-[#cfdbe8] dark:border-sky-900/60',
    accentText: 'text-sky-800 dark:text-sky-300',
    accentIcon: 'text-sky-600 dark:text-sky-400',
    accentBadge: 'bg-sky-700/12 dark:bg-sky-500/20 text-sky-900 dark:text-sky-200 border-sky-600/25 dark:border-sky-400/35',
    primaryButton: 'bg-sky-700 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 text-white',
    activePill: 'bg-sky-700 dark:bg-sky-600 text-white shadow-xs',
  },

  fiestas_patrias: {
    style: 'fiestas_patrias',
    label: '🇻🇪 Fiestas Patrias (Venezuela)',
    rootCanvas:
      'bg-gradient-to-br from-[#fff8db] via-[#e8f0fe] to-[#fde8e8] dark:from-[#1f1703] dark:via-[#071530] dark:to-[#24080e] text-slate-900 dark:text-amber-50',
    headerSurface:
      'bg-gradient-to-r from-[#fff3b8]/95 via-[#e0ebff]/95 to-[#ffd9d9]/95 dark:from-[#2b2005]/95 dark:via-[#0a1d42]/95 dark:to-[#330a12]/95 border-[#eab308]/50 dark:border-yellow-500/50',
    mobileNavSurface:
      'bg-gradient-to-r from-[#fff3b8]/95 via-[#e0ebff]/95 to-[#ffd9d9]/95 dark:from-[#2b2005]/95 dark:via-[#0a1d42]/95 dark:to-[#330a12]/95 border-[#eab308]/50 dark:border-yellow-500/50',
    brandSubtitle: 'text-blue-800 dark:text-yellow-300',
    navActive: 'text-blue-900 dark:text-yellow-300 font-black border-b-2 border-red-600 dark:border-yellow-400 pb-1',
    navHover: 'hover:text-red-700 dark:hover:text-yellow-300',
    navIcon: 'text-red-600 dark:text-yellow-400',
    mobileNavActive: 'text-blue-900 dark:text-yellow-300 font-black',
    heroCard:
      'bg-gradient-to-r from-[#fde047]/45 via-[#bfdbfe]/65 to-[#fca5a5]/50 dark:from-[#423006] dark:via-[#0c2454] dark:to-[#450c17] text-slate-900 dark:text-white border-yellow-500/60 dark:border-yellow-400/50 shadow-md dark:shadow-xl',
    heroBadge:
      'bg-gradient-to-r from-yellow-400/30 via-blue-500/25 to-red-500/30 text-blue-950 dark:text-yellow-200 border-yellow-500/50 dark:border-yellow-400/50',
    heroTitleAccent: 'text-blue-800 dark:text-yellow-300',
    heroGreetingM: 'text-blue-900 dark:text-yellow-300',
    heroGreetingF: 'text-red-800 dark:text-rose-300',
    heroBodyText: 'text-slate-800 dark:text-slate-100',
    heroPrimaryBtn:
      'bg-gradient-to-r from-yellow-500 via-blue-700 to-red-600 hover:from-yellow-400 hover:via-blue-600 hover:to-red-500 text-white shadow-md',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#132342]/90 dark:hover:bg-[#1b315c] text-slate-900 dark:text-slate-100 border border-yellow-500/50 dark:border-yellow-400/50',
    cardSurface:
      'bg-gradient-to-br from-[#fffdf2] via-[#f5f8ff] to-[#fff5f5] dark:from-[#1b1506] dark:via-[#0b1833] dark:to-[#210910] border-yellow-400/60 dark:border-blue-800/70',
    cardInnerSurface:
      'bg-gradient-to-r from-yellow-100/70 via-blue-100/65 to-red-100/70 dark:from-yellow-950/35 dark:via-blue-950/45 dark:to-red-950/35 border-yellow-400/50 dark:border-blue-700/60',
    sectionDivider: 'border-yellow-400/50 dark:border-blue-800/60',
    accentText: 'text-blue-800 dark:text-yellow-300',
    accentIcon: 'text-red-600 dark:text-yellow-400',
    accentBadge:
      'bg-gradient-to-r from-yellow-400/25 via-blue-500/20 to-red-500/25 text-blue-950 dark:text-yellow-200 border-yellow-500/45 dark:border-yellow-400/45',
    primaryButton:
      'bg-gradient-to-r from-yellow-500 via-blue-700 to-red-600 hover:from-yellow-400 hover:via-blue-600 hover:to-red-500 text-white shadow-xs',
    activePill:
      'bg-gradient-to-r from-[#eab308] via-[#1d4ed8] to-[#dc2626] text-white shadow-sm',
  },

  equipo_salud: {
    style: 'equipo_salud',
    label: '💉 Equipo de Salud',
    rootCanvas: 'bg-[#eaf6f2] dark:bg-[#031712] text-slate-800 dark:text-emerald-50',
    headerSurface: 'bg-[#f4fbf9]/95 dark:bg-[#07261e]/95 border-[#bfe2d7] dark:border-emerald-900/70',
    mobileNavSurface: 'bg-[#f4fbf9]/95 dark:bg-[#07261e]/95 border-[#bfe2d7] dark:border-emerald-900/70',
    brandSubtitle: 'text-emerald-800 dark:text-emerald-300',
    navActive: 'text-emerald-800 dark:text-emerald-300 font-bold border-b-2 border-emerald-600 dark:border-emerald-400 pb-1',
    navHover: 'hover:text-emerald-700 dark:hover:text-emerald-300',
    navIcon: 'text-emerald-600 dark:text-emerald-400',
    mobileNavActive: 'text-emerald-800 dark:text-emerald-300 font-bold',
    heroCard:
      'bg-gradient-to-br from-[#dbf2ea] via-[#ebf8f4] to-[#dff0f5] dark:from-[#062b21] dark:via-[#093328] dark:to-[#082733] text-slate-900 dark:text-white border-[#b0decb] dark:border-emerald-800/70 shadow-sm dark:shadow-xl',
    heroBadge:
      'bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-600/30 dark:border-emerald-400/40',
    heroTitleAccent: 'text-emerald-800 dark:text-emerald-300',
    heroGreetingM: 'text-teal-900 dark:text-emerald-300',
    heroGreetingF: 'text-rose-800 dark:text-pink-300',
    heroBodyText: 'text-slate-600 dark:text-slate-200',
    heroPrimaryBtn:
      'bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 shadow-sm',
    heroSecondaryBtn:
      'bg-white/90 hover:bg-white dark:bg-[#0a3026]/90 dark:hover:bg-[#0f4033] text-slate-800 dark:text-slate-100 border border-[#b0decb] dark:border-emerald-500/40',
    cardSurface: 'bg-[#f7fcfa] dark:bg-[#061f18] border-[#c8e6dc] dark:border-emerald-900/60',
    cardInnerSurface: 'bg-[#e3f3ed] dark:bg-[#0b2e24]/80 border-[#c8e6dc] dark:border-emerald-800/60',
    sectionDivider: 'border-[#c8e6dc] dark:border-emerald-900/60',
    accentText: 'text-emerald-800 dark:text-emerald-300',
    accentIcon: 'text-emerald-600 dark:text-emerald-400',
    accentBadge: 'bg-emerald-600/12 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-600/25 dark:border-emerald-400/35',
    primaryButton: 'bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
    activePill: 'bg-emerald-700 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs',
  },
};

export const SEASONAL_AUTO_VE_STORAGE_KEY = 'hmi_seasonal_auto_ve';
export const SEASONAL_AUTO_NIGHT_STORAGE_KEY = 'hmi_seasonal_auto_night_ve';

/**
 * Computes Easter Sunday (month 1-12, day 1-31) for a given Gregorian year
 * using the anonymous Gregorian / Meeus-Jones-Butcher algorithm.
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Returns current date/time parts in Venezuela timezone (America/Caracas, UTC-4).
 */
export function getVenezuelaNowParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  formattedDate: string;
  formattedTime: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getNum = (type: string, fallback: number) => {
      const p = parts.find(x => x.type === type);
      return p ? parseInt(p.value, 10) : fallback;
    };
    const year = getNum('year', now.getFullYear());
    const month = getNum('month', now.getMonth() + 1);
    const day = getNum('day', now.getDate());
    const hourRaw = getNum('hour', now.getHours());
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = getNum('minute', now.getMinutes());

    const formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { year, month, day, hour, minute, formattedDate, formattedTime };
  } catch {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return {
      year,
      month,
      day,
      hour,
      minute,
      formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  }
}

/**
 * Determines the SeasonalStyle according to the Venezuelan Official & Medical Calendar
 * (America/Caracas timezone).
 */
export function detectVenezuelaCalendarStyle(
  now: Date = new Date(),
  enableNightShiftAuto: boolean = true
): { style: SeasonalStyle; reason: string } {
  const { year, month, day, hour } = getVenezuelaNowParts(now);

  // 1. Año Nuevo & Día de Reyes en Venezuela (31 Dic – 6 Ene)
  if ((month === 12 && day === 31) || (month === 1 && day <= 6)) {
    return { style: 'ano_nuevo', reason: 'Año Nuevo y Reyes en Venezuela (31 Dic – 6 Ene)' };
  }

  // 2. Carnaval en Venezuela (Viernes antes de Carnaval hasta Domingo de Octavita: 51 a 42 días antes de Pascua)
  const easter = getEasterSunday(year);
  const easterUtc = Date.UTC(year, easter.month - 1, easter.day);
  const todayUtc = Date.UTC(year, month - 1, day);
  const diffDaysFromEaster = Math.round((easterUtc - todayUtc) / (1000 * 60 * 60 * 24));
  if (diffDaysFromEaster >= 43 && diffDaysFromEaster <= 51) {
    return { style: 'carnaval', reason: 'Carnavales de Venezuela (Calendario Oficial VE)' };
  }

  // 3. Día del Amor y la Amistad en Venezuela (12 al 14 de Febrero)
  if (month === 2 && day >= 12 && day <= 14) {
    return { style: 'amor_amistad', reason: 'Día del Amor y la Amistad en Venezuela (14 de Febrero)' };
  }

  // 4. Pequeños Héroes (15 de Febrero y 26 al 30 de Abril — Día de los Superhéroes Pediátricos)
  if ((month === 2 && day === 15) || (month === 4 && day >= 26 && day <= 30)) {
    return { style: 'pequenos_heroes', reason: 'Homenaje a Nuestros Pequeños Héroes Pediátricos' };
  }

  // 5. Día Nacional del Médico en Venezuela (8 al 12 de Marzo — 10 de Marzo Dr. José María Vargas, y 3 Dic)
  if ((month === 3 && day >= 8 && day <= 12) || (month === 12 && day === 3)) {
    return { style: 'dia_del_medico', reason: 'Día Nacional del Médico en Venezuela (10 de Marzo)' };
  }

  // 6. Fiestas Patrias de Venezuela (19 Abril, 24 Junio, 5 Julio, 24 Julio, 12 Octubre)
  if (
    (month === 4 && day >= 18 && day <= 20) ||
    (month === 6 && day >= 23 && day <= 25) ||
    (month === 7 && day >= 4 && day <= 6) ||
    (month === 7 && day >= 23 && day <= 25) ||
    (month === 10 && day >= 11 && day <= 13)
  ) {
    return { style: 'fiestas_patrias', reason: 'Fecha Patria Oficial de Venezuela 🇻🇪' };
  }

  // 7. Equipo de Salud en Venezuela (6 Mayo Día del Bioanalista / 11 al 15 Mayo Día de la Enfermería)
  if (month === 5 && ((day >= 5 && day <= 7) || (day >= 11 && day <= 15))) {
    return { style: 'equipo_salud', reason: 'Semana del Equipo de Salud y Enfermería en Venezuela' };
  }

  // 8. Primavera / Calma — Mes de las Flores y Floración del Araguaney en Venezuela (resto de Mayo)
  if (month === 5) {
    return { style: 'primavera', reason: 'Mayo: Mes de las Flores y Floración del Araguaney en Venezuela' };
  }

  // 9. Fondo Marino (5 al 10 de Junio — Semana de los Océanos y Costas Venezolanas)
  if (month === 6 && day >= 5 && day <= 10) {
    return { style: 'fondo_marino', reason: 'Semana de los Océanos y Mar Caribe Venezolano' };
  }

  // 10. Lluvia Relajante (18 al 22 de Junio)
  if (month === 6 && day >= 18 && day <= 22) {
    return { style: 'lluvia_relajante', reason: 'Temporada de Lluvias y Calma Tropical en Venezuela' };
  }

  // 11. Día del Niño en Venezuela (3er Domingo de Julio — toda la semana de Lunes a Domingo, más 20 Nov)
  if (month === 7) {
    // Find 1st of July day-of-week (0=Sun..6=Sat)
    const julyFirstDow = new Date(Date.UTC(year, 6, 1)).getUTCDay();
    const firstSunday = julyFirstDow === 0 ? 1 : 8 - julyFirstDow;
    const thirdSunday = firstSunday + 14;
    const weekStart = thirdSunday - 6;
    if (day >= weekStart && day <= thirdSunday) {
      return {
        style: 'dia_del_nino',
        reason: `Semana del Día del Niño en Venezuela (3er domingo: ${thirdSunday} de julio)`,
      };
    }
  }
  if (month === 11 && day === 20) {
    return { style: 'dia_del_nino', reason: 'Día Universal del Niño y Pediatría (20 de Noviembre)' };
  }

  // 12. Otoño / Café (28 Sep al 3 Oct — 1 de Octubre Día Internacional del Café)
  if ((month === 9 && day >= 28) || (month === 10 && day <= 3)) {
    return { style: 'otono', reason: 'Semana del Café Venezolano y Otoño (1 de Octubre)' };
  }

  // 13. Semana Mundial del Espacio (4 al 10 de Octubre)
  if (month === 10 && day >= 4 && day <= 10) {
    return { style: 'espacio', reason: 'Semana Mundial del Espacio (4 al 10 de Octubre)' };
  }

  // 14. Halloween (25 de Octubre al 2 de Noviembre)
  if ((month === 10 && day >= 25) || (month === 11 && day <= 2)) {
    return { style: 'halloween', reason: 'Temporada de Halloween (25 Oct – 2 Nov)' };
  }

  // 15. Temporada de Navidad en Venezuela (15 de Noviembre al 30 de Diciembre)
  if ((month === 11 && day >= 15) || (month === 12 && day <= 30)) {
    return { style: 'navidad', reason: 'Temporada Navideña de Venezuela (15 Nov – 30 Dic)' };
  }

  // 16. Guardia Nocturna automática (19:00 / 7:00 PM a 06:00 AM hora de Venezuela)
  if (enableNightShiftAuto && (hour >= 19 || hour < 6)) {
    return { style: 'guardia_nocturna', reason: 'Horario de Guardia Nocturna en Venezuela (7:00 PM – 6:00 AM)' };
  }

  return { style: 'normal', reason: 'Día clínico ordinario en el calendario de Venezuela' };
}

export function isSeasonalAutoVenezuelaEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SEASONAL_AUTO_VE_STORAGE_KEY) === 'true';
}

export function isSeasonalAutoNightEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SEASONAL_AUTO_NIGHT_STORAGE_KEY);
  return val === null ? true : val === 'true';
}

export function setSeasonalAutoVenezuelaMode(enabled: boolean, autoNightShift?: boolean): SeasonalStyle {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SEASONAL_AUTO_VE_STORAGE_KEY, enabled ? 'true' : 'false');
    if (typeof autoNightShift === 'boolean') {
      localStorage.setItem(SEASONAL_AUTO_NIGHT_STORAGE_KEY, autoNightShift ? 'true' : 'false');
    }
    if (enabled) {
      const detected = detectVenezuelaCalendarStyle(new Date(), isSeasonalAutoNightEnabled()).style;
      localStorage.setItem('hmi_seasonal_theme', detected);
      window.dispatchEvent(new Event('hmi_seasonal_theme_changed'));
      return detected;
    } else {
      window.dispatchEvent(new Event('hmi_seasonal_theme_changed'));
    }
  }
  return readStoredSeasonalStyle();
}

export function getSeasonalThemeTokens(style?: SeasonalStyle | null): SeasonalThemeTokens {
  if (style && SEASONAL_THEME_MAP[style]) {
    return SEASONAL_THEME_MAP[style];
  }
  return SEASONAL_THEME_MAP.normal;
}

export function readStoredSeasonalStyle(): SeasonalStyle {
  if (typeof window !== 'undefined') {
    if (isSeasonalAutoVenezuelaEnabled()) {
      return detectVenezuelaCalendarStyle(new Date(), isSeasonalAutoNightEnabled()).style;
    }
    const saved = localStorage.getItem('hmi_seasonal_theme');
    if (isValidSeasonalStyle(saved)) {
      return saved;
    }
    const attr = document.documentElement.getAttribute('data-seasonal');
    if (isValidSeasonalStyle(attr)) {
      return attr;
    }
    return 'navidad';
  }
  return 'navidad';
}

export function useSeasonalTheme(): { style: SeasonalStyle; tokens: SeasonalThemeTokens } {
  const [style, setStyle] = useState<SeasonalStyle>(() => readStoredSeasonalStyle());

  useEffect(() => {
    const sync = () => {
      setStyle(readStoredSeasonalStyle());
    };
    window.addEventListener('hmi_seasonal_theme_changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('hmi_seasonal_theme_changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { style, tokens: getSeasonalThemeTokens(style) };
}
