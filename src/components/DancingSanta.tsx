import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Music,
  Sparkles,
  Bell,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Pin,
  PartyPopper,
  Snowflake,
  Heart,
  RotateCcw
} from 'lucide-react';

export type SantaDanceMove = 'meneo' | 'disco' | 'zapateo' | 'giro';

interface DancingSantaProps {
  initialMove?: SantaDanceMove;
  allowFloating?: boolean;
  className?: string;
}

const SANTA_SPEECHES = [
  '¡Ho, ho, ho! ¡Feliz Navidad a todo el Hospital Materno Infantil! 🎅🎄',
  '¡Bailando con alegría para los pequeños pacientes de Pediatría! 🎁👶',
  '¡Mucho ánimo y bendiciones a los médicos y enfermeras de guardia! 🩺⭐',
  '¡Paz, salud y pronta recuperación a todos los niños hospitalizados! ❤️✨',
  '¡Que no falte el ritmo y la magia navideña en nuestra sala! 🎶⛄',
  '¡Ho Ho Ho! ¿Viste mi estetoscopio dorado? ¡Soy el Dr. Santa Claus! 🩺🎅',
  '¡Un abrazo enorme a cada paciente y a sus familias en estas fiestas! 🌟🧸',
];

const DANCE_MOVE_LABELS: Record<SantaDanceMove, { label: string; icon: string; desc: string }> = {
  meneo: { label: 'Meneo', icon: '🎵', desc: 'Ritmo suave y cadencioso' },
  disco: { label: 'Disco', icon: '🕺', desc: 'Fiebre navideña de los 70' },
  zapateo: { label: 'Zapateo', icon: '⚡', desc: 'Paso rápido y pataditas' },
  giro: { label: 'Giro', icon: '🔄', desc: 'Vuelta y salto festivo' },
};

/**
 * Synthesizes a festive "Jingle Bells" chime using Web Audio API.
 * 100% self-contained, no external audio file downloads required.
 */
function playJingleBellsChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    // Melodic notes for "Jingle Bells, Jingle Bells, Jingle all the way"
    const notes: Array<{ freq: number; time: number; dur: number }> = [
      { freq: 659.25, time: 0.0, dur: 0.16 }, // E5
      { freq: 659.25, time: 0.2, dur: 0.16 }, // E5
      { freq: 659.25, time: 0.4, dur: 0.32 }, // E5
      { freq: 659.25, time: 0.8, dur: 0.16 }, // E5
      { freq: 659.25, time: 1.0, dur: 0.16 }, // E5
      { freq: 659.25, time: 1.2, dur: 0.32 }, // E5
      { freq: 659.25, time: 1.6, dur: 0.16 }, // E5
      { freq: 783.99, time: 1.8, dur: 0.16 }, // G5
      { freq: 523.25, time: 2.0, dur: 0.22 }, // C5
      { freq: 587.33, time: 2.25, dur: 0.18 }, // D5
      { freq: 659.25, time: 2.45, dur: 0.45 }, // E5
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sine wave with bell chime harmonics
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.05);
    });

    // Clean up audio context after playback finishes
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // Ignored
      }
    }, 3200);
  } catch {
    // Audio may be blocked by autoplay policies until user clicks
  }
}

export const DancingSanta: React.FC<DancingSantaProps> = ({
  initialMove = 'meneo',
  allowFloating = true,
  className = '',
}) => {
  const [danceMove, setDanceMove] = useState<SantaDanceMove>(initialMove);
  const [speechIndex, setSpeechIndex] = useState<number>(0);
  const [isFloating, setIsFloating] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [showHeartBurst, setShowHeartBurst] = useState<boolean>(false);
  const soundTimeoutRef = useRef<number | null>(null);

  // Auto cycle speech bubble every 9 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSpeechIndex(prev => (prev + 1) % SANTA_SPEECHES.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const handleNextSpeech = useCallback(() => {
    setSpeechIndex(prev => (prev + 1) % SANTA_SPEECHES.length);
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 1200);
  }, []);

  const handlePlaySound = useCallback(() => {
    setIsPlayingMusic(true);
    playJingleBellsChime();

    if (soundTimeoutRef.current) {
      window.clearTimeout(soundTimeoutRef.current);
    }
    soundTimeoutRef.current = window.setTimeout(() => {
      setIsPlayingMusic(false);
    }, 3000);
  }, []);

  const handleSantaClick = useCallback(() => {
    // Cycle dance move on Santa click and advance message
    const moves: SantaDanceMove[] = ['meneo', 'disco', 'zapateo', 'giro'];
    const nextMove = moves[(moves.indexOf(danceMove) + 1) % moves.length];
    setDanceMove(nextMove);
    handleNextSpeech();
  }, [danceMove, handleNextSpeech]);

  // CSS classes mapped to current dance move
  const bodyAnimClass = {
    meneo: 'animate-santa-meneo-body',
    disco: 'animate-santa-disco-body',
    zapateo: 'animate-santa-zapateo-body',
    giro: 'animate-santa-giro-body',
  }[danceMove];

  const armLeftAnimClass = {
    meneo: 'animate-santa-meneo-arm-l',
    disco: 'animate-santa-disco-arm-l',
    zapateo: 'animate-santa-meneo-arm-l',
    giro: 'animate-santa-disco-arm-l',
  }[danceMove];

  const armRightAnimClass = {
    meneo: 'animate-santa-meneo-arm-r',
    disco: 'animate-santa-disco-arm-r',
    zapateo: 'animate-santa-meneo-arm-r',
    giro: 'animate-santa-disco-arm-r',
  }[danceMove];

  const footLeftAnimClass = {
    meneo: 'animate-santa-foot-l',
    disco: 'animate-santa-foot-l',
    zapateo: 'animate-santa-zapateo-foot-l',
    giro: 'animate-santa-foot-l',
  }[danceMove];

  const footRightAnimClass = {
    meneo: 'animate-santa-foot-r',
    disco: 'animate-santa-foot-r',
    zapateo: 'animate-santa-zapateo-foot-r',
    giro: 'animate-santa-foot-r',
  }[danceMove];

  // Minimized floating badge
  if (isMinimized) {
    return (
      <div
        className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 animate-in fade-in zoom-in-90 duration-300 ${className}`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-linear-to-r from-red-600 via-rose-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-xs shadow-xl border-2 border-white/60 dark:border-amber-400/60 cursor-pointer active:scale-95 transition-all group"
          title="Abrir Santa Claus Bailarín"
        >
          <span className="text-base group-hover:scale-125 transition-transform">🎅</span>
          <span>Santa Bailarín</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-200"></span>
          </span>
        </button>
      </div>
    );
  }

  const containerClasses = isFloating
    ? 'fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-40 max-w-[320px] w-full shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-300'
    : `relative w-full max-w-[340px] sm:max-w-[360px] ${className}`;

  return (
    <div className={containerClasses}>
      {/* Festive Card Container */}
      <div className="relative rounded-3xl p-4 sm:p-5 bg-linear-to-b from-red-500/10 via-emerald-500/10 to-amber-500/10 dark:from-red-950/40 dark:via-emerald-950/35 dark:to-amber-950/30 backdrop-blur-md border border-red-300/40 dark:border-red-500/30 shadow-lg text-slate-800 dark:text-slate-100 flex flex-col items-center select-none overflow-hidden transition-all duration-300">
        {/* Subtle festive background glow & snowflakes */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-400/20 dark:bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-emerald-400/20 dark:bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Card Header with Status & Action Buttons */}
        <div className="w-full flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 dark:bg-red-500/25 border border-red-500/30 text-red-700 dark:text-red-300 text-[11px] font-black uppercase tracking-wider">
            <span className="animate-pulse">🎅</span>
            <span>Santa Bailarín</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Play Sound Button */}
            <button
              type="button"
              onClick={handlePlaySound}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                isPlayingMusic
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse'
                  : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400'
              }`}
              title="Tocar campanitas de Navidad (Jingle Bells)"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Floating Mode */}
            {allowFloating && (
              <button
                type="button"
                onClick={() => setIsFloating(prev => !prev)}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  isFloating
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs'
                    : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title={isFloating ? 'Volver al banner de inicio' : 'Dejar a Santa flotando al navegar'}
              >
                <Pin className={`w-3.5 h-3.5 ${isFloating ? 'rotate-45' : ''}`} />
              </button>
            )}

            {/* Minimize Button */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs transition-all cursor-pointer"
              title="Minimizar Santa Claus"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Speech Bubble */}
        <div
          onClick={handleNextSpeech}
          className="relative w-full mb-2 px-3 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-red-200 dark:border-red-500/40 shadow-sm cursor-pointer hover:border-amber-400 dark:hover:border-amber-400 transition-all group z-10"
          title="Clic para cambiar mensaje"
        >
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">💬</span>
            <p className="text-[11px] sm:text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 flex-1">
              {SANTA_SPEECHES[speechIndex]}
            </p>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-500 transition-colors shrink-0">
              👉
            </span>
          </div>

          {/* Speech bubble pointer downwards */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 dark:bg-slate-900/95 border-r border-b border-red-200 dark:border-red-500/40 rotate-45 pointer-events-none" />

          {/* Floating heart on message click */}
          {showHeartBurst && (
            <div className="absolute -top-3 right-4 text-rose-500 text-lg animate-ping pointer-events-none">
              ❤️
            </div>
          )}
        </div>

        {/* Dancing Santa Interactive Stage */}
        <div
          onClick={handleSantaClick}
          className="relative w-52 h-56 sm:w-56 sm:h-60 flex items-center justify-center cursor-pointer select-none group my-1"
          title="¡Haz clic en Santa para cambiar su paso de baile!"
        >
          {/* Floating Musical Notes & Festive Sparkles */}
          <div className="absolute top-4 left-3 text-amber-400 animate-santa-note-1 pointer-events-none text-xl font-bold">
            ♪
          </div>
          <div className="absolute top-2 right-4 text-emerald-400 animate-santa-note-2 pointer-events-none text-2xl font-bold">
            ♫
          </div>
          <div className="absolute top-12 left-1 text-rose-400 animate-santa-note-3 pointer-events-none text-base font-bold">
            ✨
          </div>
          <div className="absolute top-8 right-2 text-cyan-400 animate-santa-note-4 pointer-events-none text-lg font-bold">
            ❄️
          </div>
          <div className="absolute bottom-10 left-5 text-yellow-300 animate-santa-note-2 pointer-events-none text-sm font-bold">
            ⭐
          </div>

          {/* SVG Canvas with Rigged Santa Elements */}
          <svg
            viewBox="0 0 240 270"
            className="w-full h-full drop-shadow-xl overflow-visible transition-transform duration-300 group-hover:scale-105"
          >
            <defs>
              {/* Santa Suit Gradient */}
              <linearGradient id="santaSuitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="60%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>

              {/* Skin Tone Gradient */}
              <radialGradient id="santaSkinGrad" cx="40%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fff1f2" />
                <stop offset="65%" stopColor="#fecdd3" />
                <stop offset="100%" stopColor="#fda4af" />
              </radialGradient>

              {/* Beard White Cloud Gradient */}
              <linearGradient id="santaBeardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>

              {/* Golden Buckle Gradient */}
              <linearGradient id="santaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>

              {/* Black Boots Gradient */}
              <linearGradient id="santaBootGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="60%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Pediatric Stethoscope Gradient (Teal HMI) */}
              <linearGradient id="santaStethoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="50%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#115e59" />
              </linearGradient>
            </defs>

            {/* Base Snowy Podium / Soft Shadow */}
            <g className="animate-santa-shadow">
              <ellipse cx="120" cy="252" rx="68" ry="12" fill="rgba(226, 232, 240, 0.65)" />
              <ellipse cx="120" cy="252" rx="46" ry="8" fill="rgba(148, 163, 184, 0.45)" />
              {/* Little snow mounds */}
              <circle cx="62" cy="250" r="5" fill="#ffffff" />
              <circle cx="178" cy="250" r="4.5" fill="#ffffff" />
              <circle cx="120" cy="254" r="3.5" fill="#ffffff" opacity="0.8" />
            </g>

            {/* Main Body Container that Bounces / Grooves */}
            <g className={bodyAnimClass}>
              {/* Left Leg and Boot (Tapping) */}
              <g className={footLeftAnimClass}>
                {/* Red Trousers */}
                <rect x="78" y="196" width="26" height="34" rx="7" fill="url(#santaSuitGrad)" />
                {/* Fluffy Boot Cuff */}
                <rect
                  x="72"
                  y="224"
                  width="38"
                  height="12"
                  rx="6"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                {/* Black Boot */}
                <path
                  d="M 74 234 L 108 234 L 110 252 L 66 252 Q 66 244 74 234 Z"
                  fill="url(#santaBootGrad)"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                {/* Golden Buckle */}
                <rect
                  x="80"
                  y="238"
                  width="11"
                  height="9"
                  rx="2.5"
                  fill="url(#santaGoldGrad)"
                  stroke="#a16207"
                  strokeWidth="1"
                />
              </g>

              {/* Right Leg and Boot (Tapping Counter-Rhythm) */}
              <g className={footRightAnimClass}>
                {/* Red Trousers */}
                <rect x="136" y="196" width="26" height="34" rx="7" fill="url(#santaSuitGrad)" />
                {/* Fluffy Boot Cuff */}
                <rect
                  x="130"
                  y="224"
                  width="38"
                  height="12"
                  rx="6"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                {/* Black Boot */}
                <path
                  d="M 132 234 L 166 234 L 174 246 Q 176 252 166 252 L 130 252 Z"
                  fill="url(#santaBootGrad)"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                {/* Golden Buckle */}
                <rect
                  x="148"
                  y="238"
                  width="11"
                  height="9"
                  rx="2.5"
                  fill="url(#santaGoldGrad)"
                  stroke="#a16207"
                  strokeWidth="1"
                />
              </g>

              {/* Jolly Round Belly & Coat */}
              <g>
                {/* Red Coat Body */}
                <path
                  d="M 68 135 C 54 170 64 212 120 212 C 176 212 186 170 172 135 Z"
                  fill="url(#santaSuitGrad)"
                  stroke="#b91c1c"
                  strokeWidth="1.5"
                />

                {/* White Fur Hem Trim at Bottom */}
                <path
                  d="M 62 205 Q 120 220 178 205 Q 176 217 120 219 Q 64 217 62 205 Z"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* White Fur Down Center */}
                <rect x="113" y="136" width="14" height="74" rx="4" fill="#ffffff" />

                {/* Black Leather Belt */}
                <path
                  d="M 62 173 Q 120 184 178 173 L 178 190 Q 120 201 62 190 Z"
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="1"
                />

                {/* Big Golden Buckle in Center */}
                <rect
                  x="104"
                  y="172"
                  width="32"
                  height="24"
                  rx="5"
                  fill="url(#santaGoldGrad)"
                  stroke="#a16207"
                  strokeWidth="1.8"
                />
                <rect x="112" y="177" width="16" height="14" rx="2.5" fill="#1e293b" />
                {/* Buckle Prong */}
                <rect x="117" y="182" width="10" height="4" rx="1" fill="url(#santaGoldGrad)" />

                {/* Pediatric Stethoscope around neck (Special HMI Pediatría detail) */}
                <path
                  d="M 94 138 C 94 166 146 166 146 138"
                  fill="none"
                  stroke="url(#santaStethoGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="120" cy="164" r="5" fill="#facc15" stroke="#0d9488" strokeWidth="1.5" />
              </g>

              {/* Left Arm and Mitten (Dancing) */}
              <g className={armLeftAnimClass}>
                {/* Red Sleeve */}
                <path
                  d="M 72 142 C 45 130 35 155 38 180"
                  stroke="url(#santaSuitGrad)"
                  strokeWidth="18"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* White Fur Cuff */}
                <ellipse
                  cx="38"
                  cy="182"
                  rx="12"
                  ry="7"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                {/* Green Mitten */}
                <circle
                  cx="36"
                  cy="192"
                  r="10"
                  fill="#10b981"
                  stroke="#047857"
                  strokeWidth="1.5"
                />
                <ellipse cx="43" cy="188" rx="4" ry="3" fill="#10b981" />
              </g>

              {/* Right Arm and Mitten with Jingle Bell (Dancing) */}
              <g className={armRightAnimClass}>
                {/* Red Sleeve */}
                <path
                  d="M 168 142 C 195 130 205 155 202 180"
                  stroke="url(#santaSuitGrad)"
                  strokeWidth="18"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* White Fur Cuff */}
                <ellipse
                  cx="202"
                  cy="182"
                  rx="12"
                  ry="7"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                {/* Green Mitten */}
                <circle
                  cx="204"
                  cy="192"
                  r="10"
                  fill="#10b981"
                  stroke="#047857"
                  strokeWidth="1.5"
                />
                <ellipse cx="197" cy="188" rx="4" ry="3" fill="#10b981" />
                {/* Golden Bell in Hand */}
                <path
                  d="M 200 202 L 208 202 L 212 216 L 196 216 Z"
                  fill="url(#santaGoldGrad)"
                  stroke="#b45309"
                  strokeWidth="1"
                />
                <circle cx="204" cy="217" r="2.5" fill="#78350f" />
              </g>

              {/* Head, Face, Beard and Hat */}
              <g className="animate-santa-head-bob">
                {/* Round Cheerful Face */}
                <circle cx="120" cy="112" r="26" fill="url(#santaSkinGrad)" />

                {/* Rosy Cheeks */}
                <circle cx="102" cy="115" r="6.5" fill="#f87171" opacity="0.65" />
                <circle cx="138" cy="115" r="6.5" fill="#f87171" opacity="0.65" />

                {/* Big Fluffy White Beard */}
                <path
                  d="M 94 116 C 78 132 80 172 120 180 C 160 172 162 132 146 116 C 142 124 135 128 120 128 C 105 128 98 124 94 116 Z"
                  fill="url(#santaBeardGrad)"
                  stroke="#e2e8f0"
                  strokeWidth="1.2"
                />

                {/* Smiling Mouth behind mustache */}
                <path
                  d="M 112 124 Q 120 134 128 124"
                  fill="#b91c1c"
                  stroke="#991b1b"
                  strokeWidth="1"
                />

                {/* Merry Smiling Eyes (Curved Arcs) */}
                <path
                  d="M 103 105 Q 108 99 113 105"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 127 105 Q 132 99 137 105"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />

                {/* Bushy White Eyebrows */}
                <path
                  d="M 101 97 Q 108 93 115 98"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 125 98 Q 132 93 139 97"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Cute Button Nose with Highlight */}
                <ellipse
                  cx="120"
                  cy="111"
                  rx="7.5"
                  ry="6"
                  fill="#fb7185"
                  stroke="#f43f5e"
                  strokeWidth="1"
                />
                <circle cx="118" cy="109" r="1.5" fill="#ffffff" />

                {/* Big Curled Mustache */}
                <path
                  d="M 120 115 C 110 113 95 117 91 125 C 101 127 113 123 120 119 C 127 123 139 127 149 125 C 145 117 130 113 120 115 Z"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* Santa Hat: Fluffy White Brim */}
                <rect
                  x="86"
                  y="85"
                  width="68"
                  height="16"
                  rx="8"
                  fill="#ffffff"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />

                {/* Santa Hat: Red Conical Cap curved to right */}
                <path
                  d="M 92 87 C 96 46 146 40 178 72 C 188 80 198 94 195 106 L 180 106 C 182 96 172 84 162 76 C 138 56 108 65 98 87 Z"
                  fill="url(#santaSuitGrad)"
                  stroke="#b91c1c"
                  strokeWidth="1"
                />

                {/* Hat Pom-pom (Swinging cheerfully with physics) */}
                <g className="animate-santa-pompom">
                  <circle
                    cx="195"
                    cy="110"
                    r="14"
                    fill="#ffffff"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <circle cx="193" cy="108" r="3" fill="#f8fafc" />
                  <circle cx="198" cy="112" r="2.5" fill="#f8fafc" />
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* Dance Move Selector Pills */}
        <div className="w-full mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-2 relative z-10">
          <div className="flex items-center justify-between text-[10px] font-black text-slate-500 dark:text-slate-400">
            <span>PASO DE BAILE:</span>
            <span className="text-amber-600 dark:text-amber-400 font-extrabold uppercase">
              {DANCE_MOVE_LABELS[danceMove].desc}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 w-full">
            {(Object.keys(DANCE_MOVE_LABELS) as SantaDanceMove[]).map(move => {
              const active = danceMove === move;
              return (
                <button
                  key={move}
                  type="button"
                  onClick={() => setDanceMove(move)}
                  className={`py-1 px-1.5 rounded-xl text-center text-[11px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-linear-to-r from-red-600 to-rose-600 text-white shadow-sm ring-2 ring-red-400/50'
                      : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80'
                  }`}
                  title={DANCE_MOVE_LABELS[move].desc}
                >
                  <span>{DANCE_MOVE_LABELS[move].icon}</span>
                  <span className="hidden sm:inline">{DANCE_MOVE_LABELS[move].label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 font-medium">
            💡 <span className="font-bold">Tip:</span> Haz clic en Santa para cambiar su baile y escuchar sus mensajes
          </p>
        </div>
      </div>
    </div>
  );
};
export default DancingSanta;
