/**
 * 64-bit IEEE-754 Double-Precision (Float64Array) Studio Audio DSP Synthesizer
 * Produces organic acoustic instruments, stereo hall reverb impulses, and
 * natural ambient soundscapes without 8-bit raw oscillator artifacts.
 */

export type StudioInstrument =
  | 'felt_piano'
  | 'concert_piano'
  | 'rhodes'
  | 'acoustic_guitar'
  | 'ukulele'
  | 'harp'
  | 'cuatro'
  | 'cello_strings'
  | 'warm_pad'
  | 'steel_drum'
  | 'marimba'
  | 'celesta'
  | 'brass_warm';

export type StudioTextureType =
  | 'clean'
  | 'rain_soft'
  | 'thunderstorm'
  | 'ocean_waves'
  | 'fireplace'
  | 'forest_breeze'
  | 'vinyl_lofi'
  | 'cosmic_shimmer';

export type StudioNatureAccent =
  | 'none'
  | 'birds'
  | 'owls_wind'
  | 'thunder_roll'
  | 'sleigh_bells'
  | 'maracas';

/**
 * Deterministic pseudo-random generator for reproducible 64-bit textures.
 */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Synthesizes a 64-bit Float64Array mono waveform for a given acoustic/studio
 * instrument at the requested pitch and duration.
 */
export function synthesize64BitInstrumentSamples(
  instrument: StudioInstrument,
  freq: number,
  durationSec: number,
  sampleRate: number = 44100
): Float64Array {
  const safeFreq = Math.max(45, Math.min(3520, freq));
  const totalSamples = Math.max(256, Math.floor(sampleRate * durationSec));
  const out = new Float64Array(totalSamples);
  const twoPi = Math.PI * 2;

  if (
    instrument === 'acoustic_guitar' ||
    instrument === 'ukulele' ||
    instrument === 'harp' ||
    instrument === 'cuatro'
  ) {
    // 64-bit Karplus-Strong physical plucked string modeling + warm body resonance
    const periodFloat = sampleRate / safeFreq;
    const delayLen = Math.max(2, Math.floor(periodFloat));
    const delayLine = new Float64Array(delayLen);
    const rng = createSeededRng(Math.round(safeFreq * 100) + instrument.length * 7919);

    // Warm shaped excitation burst (soft finger/nylon pluck rather than harsh white noise)
    let smoothExc = 0;
    const excLP = instrument === 'harp' ? 0.55 : instrument === 'ukulele' ? 0.48 : instrument === 'cuatro' ? 0.52 : 0.36;
    for (let i = 0; i < delayLen; i++) {
      const white = rng() * 2 - 1;
      smoothExc = smoothExc + excLP * (white - smoothExc);
      const pluckShape = Math.sin((Math.PI * i) / delayLen);
      delayLine[i] = smoothExc * pluckShape;
    }

    const damping =
      instrument === 'harp'
        ? 0.9972
        : instrument === 'acoustic_guitar'
        ? 0.9958
        : instrument === 'ukulele'
        ? 0.9942
        : 0.9915; // cuatro crisp decay
    const brightness =
      instrument === 'harp'
        ? 0.42
        : instrument === 'cuatro'
        ? 0.46
        : instrument === 'ukulele'
        ? 0.4
        : 0.32;

    let ptr = 0;
    let prev = delayLine[delayLen - 1];
    let bodyLP = 0;
    const fadeTailStart = Math.floor(totalSamples * 0.82);

    for (let i = 0; i < totalSamples; i++) {
      const cur = delayLine[ptr];
      const avg = prev * (1 - brightness) + cur * brightness;
      const nextSample = avg * damping;
      delayLine[ptr] = nextSample;
      prev = cur;

      // Subtle wooden body resonance filter
      bodyLP = bodyLP + 0.18 * (nextSample - bodyLP);
      let mixed = nextSample * 0.72 + bodyLP * 0.38;

      if (i > fadeTailStart) {
        const tailEnv = 1 - (i - fadeTailStart) / Math.max(1, totalSamples - fadeTailStart);
        mixed *= Math.max(0, tailEnv);
      }

      out[i] = Math.tanh(mixed * 1.15);
      ptr = (ptr + 1) % delayLen;
    }
    return out;
  }

  if (instrument === 'felt_piano' || instrument === 'concert_piano') {
    const isFelt = instrument === 'felt_piano';
    const harmonics = isFelt
      ? [
          { ratio: 1.0, amp: 1.0, decay: 1.15 },
          { ratio: 2.0004, amp: 0.34, decay: 1.8 },
          { ratio: 3.0012, amp: 0.14, decay: 2.7 },
          { ratio: 4.0028, amp: 0.05, decay: 3.8 },
          { ratio: 5.005, amp: 0.02, decay: 5.2 },
        ]
      : [
          { ratio: 1.0, amp: 1.0, decay: 1.0 },
          { ratio: 2.0005, amp: 0.48, decay: 1.55 },
          { ratio: 3.0015, amp: 0.24, decay: 2.3 },
          { ratio: 4.0032, amp: 0.12, decay: 3.2 },
          { ratio: 5.006, amp: 0.055, decay: 4.3 },
          { ratio: 6.01, amp: 0.025, decay: 5.5 },
        ];

    const rng = createSeededRng(Math.round(safeFreq * 37));
    const attackSec = isFelt ? 0.018 : 0.008;
    const attackSamples = Math.max(1, Math.floor(sampleRate * attackSec));
    const fadeTailStart = Math.floor(totalSamples * 0.85);
    let feltNoise = 0;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const attackEnv = i < attackSamples ? i / attackSamples : 1;

      let sum = 0;
      for (let h = 0; h < harmonics.length; h++) {
        const part = harmonics[h];
        const env = Math.exp(-t * part.decay);
        sum += Math.sin(twoPi * safeFreq * part.ratio * t) * part.amp * env;
      }

      // Soft felt hammer thud in first 25ms
      if (t < 0.03) {
        const white = rng() * 2 - 1;
        feltNoise = feltNoise + 0.12 * (white - feltNoise);
        sum += feltNoise * Math.exp(-t * 140) * (isFelt ? 0.25 : 0.15);
      }

      let sample = sum * 0.52 * attackEnv;
      if (i > fadeTailStart) {
        sample *= Math.max(0, 1 - (i - fadeTailStart) / Math.max(1, totalSamples - fadeTailStart));
      }
      out[i] = Math.tanh(sample);
    }
    return out;
  }

  if (instrument === 'rhodes') {
    const attackSamples = Math.max(1, Math.floor(sampleRate * 0.01));
    const fadeTailStart = Math.floor(totalSamples * 0.84);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const attackEnv = i < attackSamples ? i / attackSamples : 1;
      // Warm tine body + soft bell transient
      const body = Math.sin(twoPi * safeFreq * t) * Math.exp(-t * 1.15);
      const tineMod = Math.sin(twoPi * safeFreq * 7.0 * t) * Math.exp(-t * 14.0) * 0.22;
      const harmonic2 = Math.sin(twoPi * safeFreq * 2.0 * t + tineMod) * 0.22 * Math.exp(-t * 2.2);
      const bell = Math.sin(twoPi * safeFreq * 4.0 * t) * 0.08 * Math.exp(-t * 9.5);
      const tremolo = 0.92 + 0.08 * Math.sin(twoPi * 3.4 * t);

      let sample = (body + harmonic2 + bell) * 0.56 * attackEnv * tremolo;
      if (i > fadeTailStart) {
        sample *= Math.max(0, 1 - (i - fadeTailStart) / Math.max(1, totalSamples - fadeTailStart));
      }
      out[i] = Math.tanh(sample * 1.1);
    }
    return out;
  }

  if (instrument === 'steel_drum' || instrument === 'marimba' || instrument === 'celesta') {
    const partials =
      instrument === 'steel_drum'
        ? [
            { r: 1.0, a: 1.0, d: 3.1 },
            { r: 2.0, a: 0.45, d: 4.5 },
            { r: 2.99, a: 0.2, d: 6.2 },
          ]
        : instrument === 'marimba'
        ? [
            { r: 1.0, a: 1.0, d: 3.8 },
            { r: 3.98, a: 0.24, d: 11.0 },
          ]
        : [
            { r: 1.0, a: 1.0, d: 2.0 },
            { r: 2.0, a: 0.28, d: 3.2 },
            { r: 3.01, a: 0.1, d: 4.8 },
          ];

    const attackSamples = Math.max(1, Math.floor(sampleRate * 0.008));
    const fadeTailStart = Math.floor(totalSamples * 0.85);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const attackEnv = i < attackSamples ? i / attackSamples : 1;
      let sum = 0;
      for (let p = 0; p < partials.length; p++) {
        sum += Math.sin(twoPi * safeFreq * partials[p].r * t) * partials[p].a * Math.exp(-t * partials[p].d);
      }
      let sample = sum * 0.55 * attackEnv;
      if (i > fadeTailStart) {
        sample *= Math.max(0, 1 - (i - fadeTailStart) / Math.max(1, totalSamples - fadeTailStart));
      }
      out[i] = Math.tanh(sample);
    }
    return out;
  }

  // Lush ensemble pads: 'cello_strings' | 'warm_pad' | 'brass_warm'
  const isCello = instrument === 'cello_strings';
  const isBrass = instrument === 'brass_warm';
  const detunes = isCello ? [-0.006, -0.0025, 0, 0.0028, 0.0065] : [-0.0045, 0, 0.0045];
  const attackTime = isCello ? Math.min(0.45, durationSec * 0.3) : isBrass ? Math.min(0.32, durationSec * 0.24) : Math.min(0.55, durationSec * 0.35);
  const releaseTime = Math.min(0.65, durationSec * 0.35);
  const attackSamples = Math.max(1, Math.floor(sampleRate * attackTime));
  const releaseStart = Math.max(attackSamples, totalSamples - Math.floor(sampleRate * releaseTime));

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attackSamples) {
      env = Math.sin((i / attackSamples) * (Math.PI / 2)); // smooth S-curve bow entry
    } else if (i > releaseStart) {
      const r = (i - releaseStart) / Math.max(1, totalSamples - releaseStart);
      env = Math.cos(r * (Math.PI / 2));
    }

    const vibrato = isCello ? 1 + 0.0025 * Math.sin(twoPi * 4.8 * t) * Math.min(1, t * 1.4) : 1;
    let sum = 0;
    for (let d = 0; d < detunes.length; d++) {
      const f = safeFreq * (1 + detunes[d]) * vibrato;
      const phase = twoPi * f * t + d * 0.7;
      if (isCello) {
        sum +=
          Math.sin(phase) * 0.65 +
          Math.sin(phase * 2) * 0.26 +
          Math.sin(phase * 3) * 0.11 +
          Math.sin(phase * 4) * 0.04;
      } else if (isBrass) {
        sum +=
          Math.sin(phase) * 0.6 +
          Math.sin(phase * 2) * 0.28 +
          Math.sin(phase * 3) * 0.14 * Math.min(1, t * 2.2);
      } else {
        // Ultra silky warm pad
        sum += Math.sin(phase) * 0.78 + Math.sin(phase * 2) * 0.18 + Math.sin(phase * 3) * 0.04;
      }
    }
    out[i] = Math.tanh((sum / detunes.length) * 0.72 * env);
  }
  return out;
}

/**
 * Converts a 64-bit Float64Array into a Web Audio API AudioBuffer.
 */
export function float64ToAudioBuffer(
  ctx: BaseAudioContext,
  samples: Float64Array,
  sampleRate?: number
): AudioBuffer {
  const sr = sampleRate || ctx.sampleRate;
  const buf = ctx.createBuffer(1, samples.length, sr);
  const channel = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    channel[i] = samples[i];
  }
  return buf;
}

/**
 * Generates a stereo studio hall impulse response computed in 64-bit Float64Array
 * so ConvolverNode gives every instrument lush YouTube-ambient spatial warmth.
 */
export function create64BitStereoReverbImpulse(
  ctx: BaseAudioContext,
  durationSec: number = 2.6,
  decay: number = 2.4
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1024, Math.floor(sr * durationSec));
  const left64 = new Float64Array(length);
  const right64 = new Float64Array(length);
  const rngL = createSeededRng(424242);
  const rngR = createSeededRng(989898);

  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    const env = Math.pow(1 - progress, decay);
    const whiteL = (rngL() * 2 - 1) * env;
    const whiteR = (rngR() * 2 - 1) * env;

    // Gentle high-frequency damping so reverb tail stays velvety warm
    lpL = lpL + 0.28 * (whiteL - lpL);
    lpR = lpR + 0.28 * (whiteR - lpR);
    left64[i] = lpL * 0.65;
    right64[i] = lpR * 0.65;
  }

  const impulse = ctx.createBuffer(2, length, sr);
  const chL = impulse.getChannelData(0);
  const chR = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    chL[i] = left64[i];
    chR[i] = right64[i];
  }
  return impulse;
}

/**
 * Synthesizes an 8-second loopable stereo organic nature/ambient texture buffer
 * in 64-bit Float64Array (rain, ocean waves, fireplace crackle, breeze, vinyl, cosmic).
 */
export function create64BitNatureTextureBuffer(
  ctx: BaseAudioContext,
  textureType: StudioTextureType
): AudioBuffer {
  const sr = ctx.sampleRate;
  const durationSec = 8;
  const length = sr * durationSec;
  const left64 = new Float64Array(length);
  const right64 = new Float64Array(length);
  const rngL = createSeededRng(13579 + textureType.length * 97);
  const rngR = createSeededRng(24680 + textureType.length * 131);

  let b0L = 0, b1L = 0, b2L = 0, b3L = 0, lpL = 0;
  let b0R = 0, b1R = 0, b2R = 0, b3R = 0, lpR = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const wL = rngL() * 2 - 1;
    const wR = rngR() * 2 - 1;

    // Pink-ish 64-bit noise base
    b0L = 0.997 * b0L + wL * 0.029;
    b1L = 0.985 * b1L + wL * 0.032;
    b2L = 0.95 * b2L + wL * 0.048;
    b3L = 0.85 * b3L + wL * 0.09;
    const pinkL = b0L + b1L + b2L + b3L;

    b0R = 0.997 * b0R + wR * 0.029;
    b1R = 0.985 * b1R + wR * 0.032;
    b2R = 0.95 * b2R + wR * 0.048;
    b3R = 0.85 * b3R + wR * 0.09;
    const pinkR = b0R + b1R + b2R + b3R;

    if (textureType === 'rain_soft' || textureType === 'thunderstorm') {
      lpL = lpL + 0.16 * (pinkL - lpL);
      lpR = lpR + 0.16 * (pinkR - lpR);
      const dropL = rngL() > 0.9987 ? (rngL() * 2 - 1) * 0.14 : 0;
      const dropR = rngR() > 0.9987 ? (rngR() * 2 - 1) * 0.14 : 0;
      const swell = 0.88 + 0.12 * Math.sin((Math.PI * 2 * t) / durationSec);
      left64[i] = (lpL * 0.85 + dropL) * swell;
      right64[i] = (lpR * 0.85 + dropR) * swell;
    } else if (textureType === 'ocean_waves') {
      lpL = lpL + 0.075 * (pinkL - lpL);
      lpR = lpR + 0.075 * (pinkR - lpR);
      // Seamless 8-second wave surf swell
      const waveEnv = 0.28 + 0.72 * Math.pow(0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / durationSec), 1.35);
      left64[i] = lpL * waveEnv * 1.15;
      right64[i] = lpR * waveEnv * 1.15;
    } else if (textureType === 'fireplace') {
      lpL = lpL + 0.09 * (pinkL - lpL);
      lpR = lpR + 0.09 * (pinkR - lpR);
      // Warm gentle crackles
      const crackleL = rngL() > 0.99935 ? (rngL() * 2 - 1) * 0.28 : 0;
      const crackleR = rngR() > 0.99935 ? (rngR() * 2 - 1) * 0.28 : 0;
      left64[i] = lpL * 0.8 + crackleL;
      right64[i] = lpR * 0.8 + crackleR;
    } else if (textureType === 'forest_breeze') {
      lpL = lpL + 0.11 * (pinkL - lpL);
      lpR = lpR + 0.11 * (pinkR - lpR);
      const breeze = 0.45 + 0.55 * (0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / durationSec));
      left64[i] = lpL * breeze * 0.72;
      right64[i] = lpR * breeze * 0.72;
    } else if (textureType === 'vinyl_lofi') {
      lpL = lpL + 0.08 * (pinkL - lpL);
      lpR = lpR + 0.08 * (pinkR - lpR);
      const dustL = rngL() > 0.9996 ? (rngL() * 2 - 1) * 0.05 : 0;
      const dustR = rngR() > 0.9996 ? (rngR() * 2 - 1) * 0.05 : 0;
      left64[i] = lpL * 0.35 + dustL;
      right64[i] = lpR * 0.35 + dustR;
    } else {
      // cosmic_shimmer / clean
      lpL = lpL + 0.05 * (pinkL - lpL);
      lpR = lpR + 0.05 * (pinkR - lpR);
      const drift = 0.7 + 0.3 * Math.sin((Math.PI * 2 * t) / durationSec);
      left64[i] = lpL * drift * 0.55;
      right64[i] = lpR * drift * 0.55;
    }
  }

  // Crossfade loop seam (first/last 0.1s) so 8-second loop is 100% click-free
  const fadeSamples = Math.floor(sr * 0.1);
  for (let i = 0; i < fadeSamples; i++) {
    const a = i / fadeSamples;
    const endIdx = length - fadeSamples + i;
    left64[i] = left64[i] * a + left64[endIdx] * (1 - a);
    right64[i] = right64[i] * a + right64[endIdx] * (1 - a);
  }

  const buffer = ctx.createBuffer(2, length, sr);
  const chL = buffer.getChannelData(0);
  const chR = buffer.getChannelData(1);
  for (let i = 0; i < length; i++) {
    chL[i] = Math.max(-0.98, Math.min(0.98, left64[i]));
    chR[i] = Math.max(-0.98, Math.min(0.98, right64[i]));
  }
  return buffer;
}
