import type { SeasonalStyle } from '../components/SeasonalOverlay';

export type RainSpeedTier = 'fast' | 'medium' | 'gentle';

export interface RainParticle {
  id: string;
  emoji: string;
  leftPct: number;
  durationSec: number;
  delaySec: number;
  sizeCls: string;
  swayPx: number;
  driftPx: number;
  rotMidDeg: number;
  rotEndDeg: number;
  speedTier: RainSpeedTier;
  initialProgress: number;
}

const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicUnit(seed: number, idx: number, salt: number): number {
  let x = (seed ^ Math.imul(idx + 1, 374761393) ^ Math.imul(salt + 1, 668265263)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

export function generateSeasonalRainParticles(params: {
  icons: string[];
  count: number;
  speedMultiplier: number;
  style: SeasonalStyle | string;
}): RainParticle[] {
  const { icons, count, speedMultiplier, style } = params;
  if (!Array.isArray(icons) || icons.length === 0 || count <= 0) {
    return [];
  }

  const total = Math.min(80, Math.max(0, Math.round(count)));
  if (total === 0) return [];

  const safeSpeed = Math.min(3, Math.max(0.25, Number(speedMultiplier) || 1));
  const styleSeed = hashString(String(style || 'normal'));
  const seedFracX = (styleSeed % 1000) / 1000;

  return Array.from({ length: total }, (_, idx) => {
    const emoji = icons[idx % icons.length];

    const uSpeed = deterministicUnit(styleSeed, idx, 1);
    const uSize = deterministicUnit(styleSeed, idx, 2);
    const uSway = deterministicUnit(styleSeed, idx, 3);
    const uDrift = deterministicUnit(styleSeed, idx, 4);
    const uRot = deterministicUnit(styleSeed, idx, 5);
    const uJitterX = deterministicUnit(styleSeed, idx, 6);
    const uJitterY = deterministicUnit(styleSeed, idx, 7);

    // 3 distinct speed layers so icons visibly fall at different velocities like natural rain
    const tierBucket = (idx * 7 + (styleSeed % 10)) % 10;
    let speedTier: RainSpeedTier;
    let baseDuration: number;
    let sizeCls: string;

    if (tierBucket <= 2) {
      speedTier = 'fast';
      baseDuration = 3.9 + uSpeed * 2.2; // 3.9s .. 6.1s
      sizeCls = uSize >= 0.45 ? 'text-lg' : 'text-base';
    } else if (tierBucket <= 6) {
      speedTier = 'medium';
      baseDuration = 6.2 + uSpeed * 3.1; // 6.2s .. 9.3s
      sizeCls = uSize >= 0.5 ? 'text-base' : 'text-sm';
    } else {
      speedTier = 'gentle';
      baseDuration = 9.4 + uSpeed * 3.8; // 9.4s .. 13.2s
      sizeCls = uSize >= 0.55 ? 'text-sm' : 'text-xs';
    }

    const durationSec = Number(Math.max(1.3, baseDuration / safeSpeed).toFixed(2));

    // 2D Fibonacci lattice: Golden-Ratio X + stratified vertical Y phase eliminates blank bands & vertical stripes
    const fibX = (seedFracX + idx * GOLDEN_RATIO_CONJUGATE + (uJitterX - 0.5) * 0.025 + 1) % 1;
    const leftPct = Number((1.5 + fibX * 96).toFixed(1));

    const stratifiedY = (idx + 0.15 + uJitterY * 0.7) / total;
    const initialProgress = Number(Math.min(0.99, Math.max(0.01, stratifiedY)).toFixed(4));

    // Negative animation-delay starts every particle already mid-fall across the full viewport height (0..100vh)
    const rawDelay = -Number((durationSec * initialProgress).toFixed(2));
    const delaySec = rawDelay === 0 ? 0 : rawDelay;

    const swayDir = uSway >= 0.5 ? 1 : -1;
    const swayPx = Math.round(swayDir * (10 + uDrift * 18));
    const driftPx = Math.round((uDrift - 0.38) * 48);

    const rotDir = idx % 2 === 0 ? 1 : -1;
    const rotEndDeg = Math.round(rotDir * (190 + uRot * 210));
    const rotMidDeg = Math.round(rotEndDeg * 0.48);

    return {
      id: `${style}-${idx}-${emoji}`,
      emoji,
      leftPct,
      durationSec,
      delaySec,
      sizeCls,
      swayPx,
      driftPx,
      rotMidDeg,
      rotEndDeg,
      speedTier,
      initialProgress,
    };
  });
}
