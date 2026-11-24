/**
 * Offline 64-bit Float64Array Studio Audio Renderer
 * Synthesizes all 51 unique copyright-free tracks across the 17 SeasonalStyles
 * and encodes each as a seamless, lush stereo MP3 in /public/audio/<style>/<id>.mp3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { STYLE_SOUND_CATALOG, type AmbientTrack } from '../src/utils/ambientSoundCatalog.ts';
import {
  synthesize64BitInstrumentSamples,
  type StudioInstrument,
  type StudioTextureType,
  type StudioNatureAccent,
} from '../src/utils/studioAudioSynthesis.ts';

const SAMPLE_RATE = 44100;
const OUT_DIR = path.resolve(process.cwd(), 'public', 'audio');

function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Adds a mono 64-bit Float64Array note into stereo left/right Float64Array buses
 * with constant-power stereo panning and circular seamless loop wrap-around.
 */
function addStereoCircular(
  left: Float64Array,
  right: Float64Array,
  mono: Float64Array,
  startSample: number,
  gain: number,
  pan: number,
  loopSamples: number
) {
  const clampedPan = Math.max(-0.9, Math.min(0.9, pan));
  const angle = ((clampedPan + 1) * 0.5) * (Math.PI * 0.5);
  const gL = Math.cos(angle) * gain;
  const gR = Math.sin(angle) * gain;

  for (let i = 0; i < mono.length; i++) {
    const idx = (startSample + i) % loopSamples;
    const s = mono[i];
    left[idx] += s * gL;
    right[idx] += s * gR;
  }
}

/**
 * Synthesizes soft organic 64-bit percussion hits directly into stereo loop buffers.
 */
function addSoftPercussionCircular(
  left: Float64Array,
  right: Float64Array,
  startSample: number,
  kind: 'kick' | 'brush' | 'rim' | 'shaker',
  rng: () => number,
  loopSamples: number
) {
  if (kind === 'kick') {
    const len = Math.floor(SAMPLE_RATE * 0.22);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const freq = 42 + 52 * Math.exp(-t * 28);
      phase += (Math.PI * 2 * freq) / SAMPLE_RATE;
      const env = Math.min(1, i / 120) * Math.exp(-t * 17);
      const s = Math.sin(phase) * env * 0.11;
      const idx = (startSample + i) % loopSamples;
      left[idx] += s;
      right[idx] += s;
    }
    return;
  }

  const dur = kind === 'brush' ? 0.095 : kind === 'rim' ? 0.055 : 0.06;
  const len = Math.floor(SAMPLE_RATE * dur);
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const w = rng() * 2 - 1;
    const env = Math.min(1, i / 90) * Math.exp(-t * (kind === 'brush' ? 32 : 54));
    if (kind === 'rim') {
      const click = (Math.sin(Math.PI * 2 * 1350 * t) * 0.45 + Math.sin(Math.PI * 2 * 2120 * t) * 0.22) * env;
      const s = (click + w * 0.05 * env) * 0.06;
      const idx = (startSample + i) % loopSamples;
      left[idx] += s * 0.78;
      right[idx] += s * 0.62;
    } else {
      hp = 0.86 * (hp + w - prev);
      prev = w;
      const amp = kind === 'brush' ? 0.032 : 0.022;
      const s = hp * env * amp;
      const idx = (startSample + i) % loopSamples;
      left[idx] += s * (kind === 'shaker' ? 0.62 : 0.72);
      right[idx] += s * (kind === 'shaker' ? 0.82 : 0.68);
    }
  }
}

/**
 * Generates seamless loopable 64-bit nature/atmosphere bed over exact loopSamples.
 */
function addNatureBed64(
  left: Float64Array,
  right: Float64Array,
  textureType: StudioTextureType,
  level: number,
  seed: number
) {
  if (level <= 0) return;
  const loopSamples = left.length;
  const rngL = createRng(seed * 97 + 13);
  const rngR = createRng(seed * 131 + 29);

  let b0L = 0, b1L = 0, b2L = 0, b3L = 0, lpL = 0;
  let b0R = 0, b1R = 0, b2R = 0, b3R = 0, lpR = 0;

  const tempL = new Float64Array(loopSamples);
  const tempR = new Float64Array(loopSamples);

  for (let i = 0; i < loopSamples; i++) {
    const progress = i / loopSamples;
    const wL = rngL() * 2 - 1;
    const wR = rngR() * 2 - 1;

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
      const dropL = rngL() > 0.9988 ? (rngL() * 2 - 1) * 0.14 : 0;
      const dropR = rngR() > 0.9988 ? (rngR() * 2 - 1) * 0.14 : 0;
      const swell = 0.88 + 0.12 * Math.sin(Math.PI * 2 * progress * 2);
      tempL[i] = (lpL * 0.85 + dropL) * swell;
      tempR[i] = (lpR * 0.85 + dropR) * swell;
    } else if (textureType === 'ocean_waves') {
      lpL = lpL + 0.075 * (pinkL - lpL);
      lpR = lpR + 0.075 * (pinkR - lpR);
      const waveEnv = 0.25 + 0.75 * Math.pow(0.5 - 0.5 * Math.cos(Math.PI * 2 * progress * 2), 1.35);
      tempL[i] = lpL * waveEnv * 1.15;
      tempR[i] = lpR * waveEnv * 1.15;
    } else if (textureType === 'fireplace') {
      lpL = lpL + 0.09 * (pinkL - lpL);
      lpR = lpR + 0.09 * (pinkR - lpR);
      const crackleL = rngL() > 0.99935 ? (rngL() * 2 - 1) * 0.28 : 0;
      const crackleR = rngR() > 0.99935 ? (rngR() * 2 - 1) * 0.28 : 0;
      tempL[i] = lpL * 0.82 + crackleL;
      tempR[i] = lpR * 0.82 + crackleR;
    } else if (textureType === 'forest_breeze') {
      lpL = lpL + 0.11 * (pinkL - lpL);
      lpR = lpR + 0.11 * (pinkR - lpR);
      const breeze = 0.45 + 0.55 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * progress * 2));
      tempL[i] = lpL * breeze * 0.75;
      tempR[i] = lpR * breeze * 0.75;
    } else if (textureType === 'vinyl_lofi') {
      lpL = lpL + 0.08 * (pinkL - lpL);
      lpR = lpR + 0.08 * (pinkR - lpR);
      const dustL = rngL() > 0.9996 ? (rngL() * 2 - 1) * 0.05 : 0;
      const dustR = rngR() > 0.9996 ? (rngR() * 2 - 1) * 0.05 : 0;
      tempL[i] = lpL * 0.36 + dustL;
      tempR[i] = lpR * 0.36 + dustR;
    } else {
      lpL = lpL + 0.05 * (pinkL - lpL);
      lpR = lpR + 0.05 * (pinkR - lpR);
      const drift = 0.7 + 0.3 * Math.sin(Math.PI * 2 * progress * 2);
      tempL[i] = lpL * drift * 0.55;
      tempR[i] = lpR * drift * 0.55;
    }
  }

  // Seamless crossfade at loop seam
  const fade = Math.min(Math.floor(SAMPLE_RATE * 0.25), Math.floor(loopSamples * 0.08));
  for (let i = 0; i < fade; i++) {
    const a = i / fade;
    const eIdx = loopSamples - fade + i;
    const mixL = tempL[i] * a + tempL[eIdx] * (1 - a);
    const mixR = tempR[i] * a + tempR[eIdx] * (1 - a);
    tempL[i] = mixL;
    tempR[i] = mixR;
  }

  for (let i = 0; i < loopSamples; i++) {
    left[i] += tempL[i] * level;
    right[i] += tempR[i] * level;
  }
}

/**
 * Adds organic nature accents (birds, nocturnal owls, soft thunder roll, sleigh bells)
 */
function addNatureAccents64(
  left: Float64Array,
  right: Float64Array,
  accent: StudioNatureAccent,
  seed: number
) {
  if (accent === 'none' || accent === 'maracas') return;
  const loopSamples = left.length;
  const rng = createRng(seed * 733 + 17);

  if (accent === 'birds') {
    const triggers = [Math.floor(loopSamples * 0.22), Math.floor(loopSamples * 0.72)];
    for (const start of triggers) {
      const baseF = 1650 + rng() * 520;
      const pan = (rng() - 0.5) * 0.9;
      for (let c = 0; c < 3; c++) {
        const len = Math.floor(SAMPLE_RATE * 0.12);
        const mono = new Float64Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / SAMPLE_RATE;
          const f = baseF * (1 + 0.18 * Math.sin((Math.PI * t) / 0.12));
          phase += (Math.PI * 2 * f) / SAMPLE_RATE;
          const env = Math.sin((Math.PI * i) / len);
          mono[i] = Math.sin(phase) * env * 0.025;
        }
        addStereoCircular(left, right, mono, start + Math.floor(c * SAMPLE_RATE * 0.15), 1, pan, loopSamples);
      }
    }
  } else if (accent === 'owls_wind') {
    const start = Math.floor(loopSamples * 0.45);
    const baseF = 345 + rng() * 35;
    [0, 0.34, 0.72].forEach((offset, idx) => {
      const dur = idx === 2 ? 0.55 : 0.22;
      const len = Math.floor(SAMPLE_RATE * dur);
      const mono = new Float64Array(len);
      let phase = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SAMPLE_RATE;
        const f = baseF * (1 - 0.07 * (t / dur));
        phase += (Math.PI * 2 * f) / SAMPLE_RATE;
        const env = Math.sin((Math.PI * i) / len);
        mono[i] = Math.sin(phase) * env * 0.032;
      }
      addStereoCircular(left, right, mono, start + Math.floor(offset * SAMPLE_RATE), 1, -0.35, loopSamples);
    });
  } else if (accent === 'thunder_roll') {
    const start = Math.floor(loopSamples * 0.35);
    const len = Math.floor(SAMPLE_RATE * 3.8);
    const mono = new Float64Array(len);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      const w = rng() * 2 - 1;
      lp = lp + 0.008 * (w - lp);
      const env = t < 0.7 ? t / 0.7 : Math.exp(-(t - 0.7) * 1.15);
      mono[i] = lp * env * 1.3;
    }
    addStereoCircular(left, right, mono, start, 0.26, 0.15, loopSamples);
  } else if (accent === 'sleigh_bells') {
    const triggers = [Math.floor(loopSamples * 0.18), Math.floor(loopSamples * 0.68)];
    for (const start of triggers) {
      [2637, 3136, 3520].forEach((freq, idx) => {
        const note = synthesize64BitInstrumentSamples('celesta', freq, 0.65, SAMPLE_RATE);
        addStereoCircular(
          left,
          right,
          note,
          start + Math.floor(idx * 0.028 * SAMPLE_RATE),
          0.022,
          idx % 2 === 0 ? 0.38 : -0.32,
          loopSamples
        );
      });
    }
  }
}

/**
 * 64-bit Stereo Schroeder/Moorer Concert Hall Reverb wrapped seamlessly over loopSamples.
 * Pre-warms for 1 pass so reverb tail from the end of the loop spills naturally into sample 0!
 */
function apply64BitStereoReverbLoop(
  dryL: Float64Array,
  dryR: Float64Array,
  reverbWet: number
): { outL: Float64Array; outR: Float64Array } {
  const n = dryL.length;
  const combDelaysL = [1557, 1617, 1491, 1422, 1277, 1356];
  const combDelaysR = [1557 + 23, 1617 + 29, 1491 + 19, 1422 + 31, 1277 + 17, 1356 + 27];
  const combFeedback = 0.84;
  const damp = 0.34;

  const apDelaysL = [225, 556, 441];
  const apDelaysR = [225 + 13, 556 + 17, 441 + 11];

  const combsL = combDelaysL.map(d => ({ buf: new Float64Array(d), idx: 0, store: 0 }));
  const combsR = combDelaysR.map(d => ({ buf: new Float64Array(d), idx: 0, store: 0 }));
  const apsL = apDelaysL.map(d => ({ buf: new Float64Array(d), idx: 0 }));
  const apsR = apDelaysR.map(d => ({ buf: new Float64Array(d), idx: 0 }));

  const wetL = new Float64Array(n);
  const wetR = new Float64Array(n);

  // Run 2 passes: pass 0 warms the reverb tanks so pass 1 captures the exact circular tail!
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const inL = dryL[i] * 0.72 + dryR[i] * 0.28;
      const inR = dryR[i] * 0.72 + dryL[i] * 0.28;

      let sumL = 0;
      for (let c = 0; c < combsL.length; c++) {
        const comb = combsL[c];
        const out = comb.buf[comb.idx];
        comb.store = out * (1 - damp) + comb.store * damp;
        comb.buf[comb.idx] = inL + comb.store * combFeedback;
        comb.idx = (comb.idx + 1) % comb.buf.length;
        sumL += out;
      }

      let sumR = 0;
      for (let c = 0; c < combsR.length; c++) {
        const comb = combsR[c];
        const out = comb.buf[comb.idx];
        comb.store = out * (1 - damp) + comb.store * damp;
        comb.buf[comb.idx] = inR + comb.store * combFeedback;
        comb.idx = (comb.idx + 1) % comb.buf.length;
        sumR += out;
      }

      let yL = sumL / combsL.length;
      for (let a = 0; a < apsL.length; a++) {
        const ap = apsL[a];
        const bufOut = ap.buf[ap.idx];
        const next = -yL + bufOut;
        ap.buf[ap.idx] = yL + bufOut * 0.5;
        ap.idx = (ap.idx + 1) % ap.buf.length;
        yL = next;
      }

      let yR = sumR / combsR.length;
      for (let a = 0; a < apsR.length; a++) {
        const ap = apsR[a];
        const bufOut = ap.buf[ap.idx];
        const next = -yR + bufOut;
        ap.buf[ap.idx] = yR + bufOut * 0.5;
        ap.idx = (ap.idx + 1) % ap.buf.length;
        yR = next;
      }

      if (pass === 1) {
        wetL[i] = yL;
        wetR[i] = yR;
      }
    }
  }

  const outL = new Float64Array(n);
  const outR = new Float64Array(n);
  const dryGain = 1 - Math.min(0.45, reverbWet * 0.45);
  const wetGain = reverbWet * 0.88;

  for (let i = 0; i < n; i++) {
    outL[i] = dryL[i] * dryGain + wetL[i] * wetGain;
    outR[i] = dryR[i] * dryGain + wetR[i] * wetGain;
  }
  return { outL, outR };
}

function renderTrack64BitStereo(track: AmbientTrack, trackSeed: number): { left: Float64Array; right: Float64Array } {
  const stepSec = Math.max(0.2, ((60 / Math.max(44, track.bpm)) * 0.5));
  const stepSamples = Math.round(stepSec * SAMPLE_RATE);
  // 8 bars = 64 eighth-note steps (~18-28s depending on BPM), 4 bars for very slow tempos (<=60 BPM)
  const bars = track.bpm <= 60 ? 4 : 8;
  const totalSteps = bars * 8;
  const loopSamples = totalSteps * stepSamples;

  const dryL = new Float64Array(loopSamples);
  const dryR = new Float64Array(loopSamples);
  const noteCache = new Map<string, Float64Array>();
  const rng = createRng(trackSeed);

  const getNote = (inst: StudioInstrument, freq: number, durSec: number): Float64Array => {
    const rFreq = Math.round(freq * 10);
    const rDur = Math.max(0.5, Math.round(durSec * 2) / 2);
    const k = `${inst}:${rFreq}:${rDur}`;
    let cached = noteCache.get(k);
    if (!cached) {
      cached = synthesize64BitInstrumentSamples(inst, freq, rDur, SAMPLE_RATE);
      noteCache.set(k, cached);
    }
    return cached;
  };

  for (let step = 0; step < totalSteps; step++) {
    const barIndex = Math.floor(step / 8);
    const stepInBar = step % 8;
    const stepSample = step * stepSamples;
    const chord = track.chords[barIndex % track.chords.length];
    const phrase = barIndex % 4 < 2 ? track.phraseA : track.phraseB;
    const phraseStep = step % phrase.length;

    // 1. Sub/Bass warm root foundation on beat 1
    if (stepInBar === 0 && Array.isArray(chord) && chord[0]) {
      const bassFreq = chord[0] > 110 ? chord[0] * 0.5 : chord[0];
      const barDur = stepSec * 8 * 1.05;
      const bassMono = getNote('warm_pad', bassFreq, barDur);
      addStereoCircular(dryL, dryR, bassMono, stepSample, 0.14, 0, loopSamples);
    }

    // 2. Full harmonic pad / strum on downbeat
    if (stepInBar === 0 && Array.isArray(chord)) {
      const chordDur = Math.max(2.0, stepSec * 8 * 1.08);
      const perVoice = track.padInstrument === 'cuatro' ? 0.11 : track.padInstrument === 'cello_strings' ? 0.095 : 0.105;
      chord.forEach((freq, idx) => {
        const strumSec = track.padInstrument === 'cuatro' ? idx * 0.022 : idx * 0.012;
        const pan = (idx - (chord.length - 1) / 2) * 0.28;
        const padMono = getNote(track.padInstrument, freq, chordDur);
        addStereoCircular(
          dryL,
          dryR,
          padMono,
          stepSample + Math.round(strumSec * SAMPLE_RATE),
          perVoice,
          pan,
          loopSamples
        );
      });
    }

    // 3. Rhythmic chord pulse / Venezuelan cuatro / bossa syncopation
    if (
      (track.groove === 'joropo_waltz' || track.groove === 'merengue_suave' || track.groove === 'bossa_samba') &&
      (stepInBar === 3 || stepInBar === 6) &&
      Array.isArray(chord)
    ) {
      chord.slice(1, 4).forEach((freq, idx) => {
        const hitMono = getNote(track.padInstrument, freq, 0.55);
        addStereoCircular(
          dryL,
          dryR,
          hitMono,
          stepSample + Math.round(idx * 0.014 * SAMPLE_RATE),
          0.055,
          0.26,
          loopSamples
        );
      });
    }

    // 4. Gentle arpeggio shimmer from accentInstrument on off-beats when available
    if (track.accentInstrument && (stepInBar === 2 || stepInBar === 6) && Array.isArray(chord) && chord.length >= 3) {
      const arpFreq = chord[(stepInBar === 2 ? 1 : 2) % chord.length] * 2;
      const arpMono = getNote(track.accentInstrument, arpFreq > 1200 ? arpFreq * 0.5 : arpFreq, 1.3);
      addStereoCircular(dryL, dryR, arpMono, stepSample, 0.052, stepInBar === 2 ? -0.32 : 0.34, loopSamples);
    }

    // 5. Section A / B lead melody with expressive humanization
    const noteIdx = phrase[phraseStep];
    if (noteIdx !== null && noteIdx !== undefined && track.melodyScale.length > 0) {
      const safeIdx = ((noteIdx % track.melodyScale.length) + track.melodyScale.length) % track.melodyScale.length;
      const noteFreq = track.melodyScale[safeIdx];
      const humanDelaySec = Math.max(0, ((rng() - 0.5) * track.humanizeMs) / 1000);
      const vel = 0.88 + rng() * 0.22;
      const noteDur = track.groove === 'ambient_free' || track.groove === 'ballad_waltz' ? 2.6 : 1.6;
      const leadMono = getNote(track.leadInstrument, noteFreq, noteDur);

      addStereoCircular(
        dryL,
        dryR,
        leadMono,
        stepSample + Math.round(humanDelaySec * SAMPLE_RATE),
        0.18 * vel,
        -0.08,
        loopSamples
      );

      if (track.accentInstrument && (phraseStep === 0 || phraseStep === 8)) {
        const harmFreq = noteFreq > 520 ? noteFreq * 0.5 : noteFreq;
        const harmMono = getNote(track.accentInstrument, harmFreq, 2.0);
        addStereoCircular(
          dryL,
          dryR,
          harmMono,
          stepSample + Math.round(0.03 * SAMPLE_RATE),
          0.09,
          0.3,
          loopSamples
        );
      }
    }

    // 6. Soft organic groove percussion
    if (track.groove === 'lofi_chill') {
      if (stepInBar === 0 || stepInBar === 5) addSoftPercussionCircular(dryL, dryR, stepSample, 'kick', rng, loopSamples);
      if (stepInBar === 4) addSoftPercussionCircular(dryL, dryR, stepSample, 'rim', rng, loopSamples);
      if (stepInBar % 2 === 1) addSoftPercussionCircular(dryL, dryR, stepSample, 'brush', rng, loopSamples);
    } else if (track.groove === 'bossa_samba') {
      if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6) addSoftPercussionCircular(dryL, dryR, stepSample, 'kick', rng, loopSamples);
      if (stepInBar === 1 || stepInBar === 4 || stepInBar === 7) addSoftPercussionCircular(dryL, dryR, stepSample, 'rim', rng, loopSamples);
      addSoftPercussionCircular(dryL, dryR, stepSample, 'shaker', rng, loopSamples);
    } else if (track.groove === 'joropo_waltz') {
      if (stepInBar === 0) addSoftPercussionCircular(dryL, dryR, stepSample, 'kick', rng, loopSamples);
      if (stepInBar === 2 || stepInBar === 4 || stepInBar === 6) addSoftPercussionCircular(dryL, dryR, stepSample, 'shaker', rng, loopSamples);
    } else if (track.groove === 'merengue_suave') {
      if (stepInBar === 0 || stepInBar === 4) addSoftPercussionCircular(dryL, dryR, stepSample, 'kick', rng, loopSamples);
      if (stepInBar === 2 || stepInBar === 5 || stepInBar === 7) addSoftPercussionCircular(dryL, dryR, stepSample, 'shaker', rng, loopSamples);
    } else if (track.groove === 'gentle_pulse' || track.groove === 'ballad_waltz') {
      if (stepInBar === 0) addSoftPercussionCircular(dryL, dryR, stepSample, 'kick', rng, loopSamples);
      if (stepInBar === 4) addSoftPercussionCircular(dryL, dryR, stepSample, 'brush', rng, loopSamples);
    }
  }

  // 7. 64-bit Stereo Hall Reverb wrapped circularly
  const { outL, outR } = apply64BitStereoReverbLoop(dryL, dryR, track.reverbWet);

  // 8. Mix 64-bit nature atmosphere bed & organic nature accents
  addNatureBed64(outL, outR, track.textureType, track.textureLevel * 1.65, trackSeed);
  addNatureAccents64(outL, outR, track.natureAccent, trackSeed);

  // 9. Warm analog 5.2 kHz roll-off + DC-free gentle RMS mastering + soft limiting
  let lpL = 0;
  let lpR = 0;
  const rcAlpha = 0.54; // ~5.2 kHz at 44.1kHz
  let sumSq = 0;
  for (let i = 0; i < loopSamples; i++) {
    lpL = lpL + rcAlpha * (outL[i] - lpL);
    lpR = lpR + rcAlpha * (outR[i] - lpR);
    outL[i] = lpL;
    outR[i] = lpR;
    sumSq += lpL * lpL + lpR * lpR;
  }

  const rms = Math.sqrt(sumSq / (loopSamples * 2)) || 0.001;
  const targetRms = 0.14; // Comfortable, rich ambient master level (~-17 dBFS RMS)
  const normGain = Math.min(4.2, Math.max(0.4, targetRms / rms));

  for (let i = 0; i < loopSamples; i++) {
    outL[i] = Math.tanh(outL[i] * normGain) * 0.92;
    outR[i] = Math.tanh(outR[i] * normGain) * 0.92;
  }

  return { left: outL, right: outR };
}

function encodeFloat64StereoToMp3(left: Float64Array, right: Float64Array, mp3Path: string) {
  const n = left.length;
  // Write 32-bit IEEE float stereo WAV buffer in memory (44-byte header + interleaved float32 samples)
  // so ffmpeg receives full-headroom studio audio without integer quantization noise!
  const headerSize = 44;
  const dataBytes = n * 2 * 4;
  const wavBuf = Buffer.allocUnsafe(headerSize + dataBytes);

  wavBuf.write('RIFF', 0);
  wavBuf.writeUInt32LE(36 + dataBytes, 4);
  wavBuf.write('WAVE', 8);
  wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16); // PCM/float chunk size
  wavBuf.writeUInt16LE(3, 20);  // format = 3 (IEEE float)
  wavBuf.writeUInt16LE(2, 22);  // stereo
  wavBuf.writeUInt32LE(SAMPLE_RATE, 24);
  wavBuf.writeUInt32LE(SAMPLE_RATE * 2 * 4, 28);
  wavBuf.writeUInt16LE(8, 32);  // block align
  wavBuf.writeUInt16LE(32, 34); // 32 bits per sample
  wavBuf.write('data', 36);
  wavBuf.writeUInt32LE(dataBytes, 40);

  let offset = headerSize;
  for (let i = 0; i < n; i++) {
    wavBuf.writeFloatLE(left[i], offset);
    wavBuf.writeFloatLE(right[i], offset + 4);
    offset += 8;
  }

  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'wav',
      '-i',
      'pipe:0',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '2',
      mp3Path,
    ],
    {
      input: wavBuf,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (res.status !== 0) {
    throw new Error(`ffmpeg failed for ${mp3Path}: ${res.stderr?.toString()}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let count = 0;
  let totalBytes = 0;
  const tStart = Date.now();

  for (const [styleKey, entry] of Object.entries(STYLE_SOUND_CATALOG)) {
    const styleDir = path.join(OUT_DIR, styleKey);
    fs.mkdirSync(styleDir, { recursive: true });

    for (const track of entry.tracks) {
      count += 1;
      const outFile = path.join(styleDir, `${track.id}.mp3`);
      const seed = count * 1009 + track.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
      const { left, right } = renderTrack64BitStereo(track, seed);
      encodeFloat64StereoToMp3(left, right, outFile);
      const size = fs.statSync(outFile).size;
      totalBytes += size;
      console.log(
        `[${String(count).padStart(2, '0')}/51] ${styleKey}/${track.id}.mp3 (${(size / 1024).toFixed(1)} KB, ${(left.length / SAMPLE_RATE).toFixed(1)}s)`
      );
    }
  }

  const elapsed = ((Date.now() - tStart) / 1000).toFixed(2);
  console.log(`\nGenerated ${count} unique 64-bit studio MP3 tracks (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total) in ${elapsed}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
