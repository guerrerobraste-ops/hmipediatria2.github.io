import { ALL_SEASONAL_STYLES, type SeasonalStyle } from '../components/SeasonalOverlay';
import {
  STYLE_SOUND_CATALOG,
  STYLE_SOUND_META,
  AmbientTrack,
  StyleSoundMeta,
  getTracksForStyle,
  pickRandomTrackForStyle,
  pickNextQueueTrackForStyle,
} from './ambientSoundCatalog';
import {
  StudioInstrument,
  StudioNatureAccent,
  synthesize64BitInstrumentSamples,
  float64ToAudioBuffer,
  create64BitStereoReverbImpulse,
  create64BitNatureTextureBuffer,
} from './studioAudioSynthesis';

export {
  STYLE_SOUND_CATALOG,
  STYLE_SOUND_META,
  getTracksForStyle,
  pickRandomTrackForStyle,
  pickNextQueueTrackForStyle,
};
export type { AmbientTrack, StyleSoundMeta };

/**
 * Dynamic assignment of unique MP3 audio files per SeasonalStyle.
 * Each SeasonalStyle maps exclusively to its own distinct studio tracks under /audio/<style>/.
 */
export const STYLE_AUDIO_FILES: Record<SeasonalStyle, string[]> = (
  Object.keys(STYLE_SOUND_CATALOG) as SeasonalStyle[]
).reduce((acc, style) => {
  acc[style] = STYLE_SOUND_CATALOG[style].tracks.map(track => track.audioFile);
  return acc;
}, {} as Record<SeasonalStyle, string[]>);

/**
 * Dynamic assignment of a unique primary audio file path for every SeasonalStyle.
 */
export const STYLE_AUDIO_FILE_MAP: Record<SeasonalStyle, string> = (
  Object.keys(STYLE_SOUND_CATALOG) as SeasonalStyle[]
).reduce((acc, style) => {
  const files = STYLE_AUDIO_FILES[style] || [];
  acc[style] = files[0] || `/audio/${style}/${style}_default.mp3`;
  return acc;
}, {} as Record<SeasonalStyle, string>);

export function getAudioFilesForStyle(style: SeasonalStyle): string[] {
  return STYLE_AUDIO_FILES[style] || STYLE_AUDIO_FILES.normal;
}

export function resolveAudioFileForStyle(
  style: SeasonalStyle,
  track?: AmbientTrack | null
): string {
  const styleTracks = getTracksForStyle(style);
  if (track && track.style === style && track.audioFile) {
    return track.audioFile;
  }
  if (track) {
    const matched = styleTracks.find(t => t.id === track.id);
    if (matched?.audioFile) return matched.audioFile;
  }
  return STYLE_AUDIO_FILE_MAP[style] || STYLE_AUDIO_FILE_MAP.normal;
}

/**
 * Computes ordered prefetch candidates for a SeasonalStyle so upcoming tracks
 * are predicted without repeating the most recently played track.
 */
export function getPrefetchCandidatesForStyle(
  style: SeasonalStyle,
  recentHistory: string[] = [],
  limit: number = 2
): AmbientTrack[] {
  const tracks = getTracksForStyle(style);
  if (tracks.length === 0) return [];

  const lastPlayedId = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;
  const playedSet = new Set(recentHistory);

  const unplayed = tracks.filter(t => !playedSet.has(t.id));
  const nonRepeat = tracks.filter(t => t.id !== lastPlayedId && !unplayed.some(u => u.id === t.id));
  const fallback = lastPlayedId ? tracks.filter(t => t.id === lastPlayedId) : [];

  return [...unplayed, ...nonRepeat, ...fallback].slice(0, Math.max(1, limit));
}

/**
 * Returns neighboring styles to warm up during browser idle time when the active
 * SeasonalStyle changes.
 */
export function getAdjacentStylesForPrefetch(activeStyle: SeasonalStyle): SeasonalStyle[] {
  const idx = ALL_SEASONAL_STYLES.indexOf(activeStyle);
  if (idx < 0) return ['normal', 'navidad'];

  const len = ALL_SEASONAL_STYLES.length;
  const prev = ALL_SEASONAL_STYLES[(idx - 1 + len) % len];
  const next = ALL_SEASONAL_STYLES[(idx + 1) % len];
  const candidates: SeasonalStyle[] = [next, prev, 'normal', 'guardia_nocturna'];
  return Array.from(new Set(candidates)).filter(s => s !== activeStyle).slice(0, 3);
}

export interface AmbientSoundConfig {
  enabled: boolean;
  intensity: number; // 0.05 to 1.0
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_AMBIENT_SOUND_CONFIG: AmbientSoundConfig = {
  enabled: false,
  intensity: 0.4,
  updatedAt: '',
};

const TRACK_HISTORY_STORAGE_KEY = 'hmi_ambient_track_history_v2';
const MAX_DECODED_BUFFER_CACHE = 14;
const MAX_PREFETCH_BYTES_CACHE = 20;
const MAX_CONCURRENT_IDLE_PREFETCH = 2;
const CROSSFADE_DURATION_SEC = 0.85;

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private noteBufferCache = new Map<string, AudioBuffer>();
  private prefetchedBytesCache = new Map<string, ArrayBuffer>();
  private decodedAudioCache = new Map<string, AudioBuffer>();
  private inFlightFetches = new Map<string, Promise<ArrayBuffer | null>>();
  private pendingPrefetchedTrackByStyle = new Map<
    SeasonalStyle,
    { track: AmbientTrack; nextHistory: string[] }
  >();
  private activeNodes: AudioNode[] = [];
  private activeTrackGain: GainNode | null = null;
  private activeTimers: number[] = [];
  private fadingCleanupTimers: number[] = [];
  private stepTimer: number | null = null;
  private trackEndTimer: number | null = null;
  private natureTimer: number | null = null;
  private idlePrefetchTimer: number | null = null;
  private activeFetchController: AbortController | null = null;
  private isLoadingTrack = false;
  private loadGeneration = 0;
  private currentStyle: SeasonalStyle | null = null;
  private currentTrack: AmbientTrack | null = null;
  private currentAudioFile: string | null = null;
  private styleHistoryMap: Partial<Record<SeasonalStyle, string[]>> = {};
  private listeners = new Set<(track: AmbientTrack | null) => void>();
  private isEnabled = false;
  private isMuted = false;
  private intensity = 0.4;
  private gestureHookAttached = false;

  constructor() {
    this.loadHistoryFromStorage();
  }

  private loadHistoryFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(TRACK_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.styleHistoryMap = parsed;
        }
      }
    } catch {
      this.styleHistoryMap = {};
    }
  }

  private saveHistoryToStorage() {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(TRACK_HISTORY_STORAGE_KEY, JSON.stringify(this.styleHistoryMap));
    } catch {
      // Ignore storage quota issues
    }
  }

  private notifyTrackChanged() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentTrack);
      } catch {
        // Ignore subscriber error
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('hmi_ambient_track_changed', {
            detail: {
              track: this.currentTrack,
              style: this.currentStyle,
              audioFile: this.currentAudioFile,
            },
          })
        );
      } catch {
        // Ignore event error
      }
    }
  }

  public subscribeTrackChange(cb: (track: AmbientTrack | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getCurrentTrack(): AmbientTrack | null {
    return this.currentTrack;
  }

  public getCurrentAudioFile(): string | null {
    return this.currentAudioFile;
  }

  public isActivelyPlaying(): boolean {
    return this.isEnabled && !this.isMuted && Boolean(this.currentTrack);
  }

  public getActiveTrackForStyle(style: SeasonalStyle): AmbientTrack | null {
    if (this.currentStyle === style && this.currentTrack) {
      return this.currentTrack;
    }
    return null;
  }

  public getPrefetchStatus() {
    return {
      cachedBytesCount: this.prefetchedBytesCache.size,
      cachedDecodedCount: this.decodedAudioCache.size,
      prefetchedUrls: Array.from(
        new Set([...this.prefetchedBytesCache.keys(), ...this.decodedAudioCache.keys()])
      ),
      pendingStyles: Array.from(this.pendingPrefetchedTrackByStyle.keys()),
    };
  }

  private isSaveDataMode(): boolean {
    if (typeof navigator === 'undefined') return false;
    const conn = (navigator as any).connection;
    return Boolean(conn && conn.saveData);
  }

  private selectRandomTrackForStyle(style: SeasonalStyle): AmbientTrack {
    const prevHistory = Array.isArray(this.styleHistoryMap[style]) ? this.styleHistoryMap[style]! : [];
    const lastPlayedId =
      (this.currentStyle === style && this.currentTrack?.id) ||
      (prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null);

    // Clear any stale prefetched pointer so every style activation/change performs a fresh Math.random() draw
    this.pendingPrefetchedTrackByStyle.delete(style);

    const tracks = getTracksForStyle(style);
    if (tracks.length <= 1) {
      const fallback = tracks[0];
      this.styleHistoryMap[style] = fallback ? [fallback.id] : [];
      this.saveHistoryToStorage();
      return fallback;
    }

    // Use Math.random() across the 3 available tracks for this style (excluding the immediately previous track if any)
    const nonRepeatingPool = lastPlayedId ? tracks.filter(t => t.id !== lastPlayedId) : tracks;
    const pool = nonRepeatingPool.length > 0 ? nonRepeatingPool : tracks;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex] || pool[0];

    const updatedHistory = [...prevHistory.filter(id => id !== chosen.id), chosen.id].slice(-tracks.length);
    this.styleHistoryMap[style] = updatedHistory;
    this.saveHistoryToStorage();
    return chosen;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;

      // Studio mastering bus: soft compression to keep dynamics silky and comfortable
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 3;
      this.compressor.attack.value = 0.015;
      this.compressor.release.value = 0.25;

      // 64-bit stereo hall convolution reverb (used by synth fallback)
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = create64BitStereoReverbImpulse(this.ctx, 2.8, 2.5);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      this.attachGestureUnlock();
    }

    return this.ctx;
  }

  private attachGestureUnlock() {
    if (this.gestureHookAttached || typeof window === 'undefined') return;
    this.gestureHookAttached = true;

    const detach = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('click', unlock, true);
      this.gestureHookAttached = false;
    };

    const unlock = () => {
      const ctx = this.ctx || this.ensureContext();
      if (!ctx) return;

      const tryPlayIfReady = () => {
        if (this.isEnabled && !this.isMuted && this.currentStyle && this.currentTrack) {
          if (this.activeNodes.length === 0 && !this.isLoadingTrack) {
            void this.loadAndPlayTrack(this.currentStyle, this.currentTrack);
          }
          this.updateMasterGain();
        }
        if (ctx.state === 'running') {
          detach();
        }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(tryPlayIfReady).catch(() => {});
      } else {
        tryPlayIfReady();
      }
    };

    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    window.addEventListener('click', unlock, { capture: true, passive: true });
  }

  private cancelPendingActiveFetch() {
    if (this.activeFetchController) {
      try {
        this.activeFetchController.abort();
      } catch {
        // Ignore abort error
      }
      this.activeFetchController = null;
    }
  }

  private clearActiveTimersOnly() {
    if (this.stepTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.trackEndTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.trackEndTimer);
      this.trackEndTimer = null;
    }
    if (this.natureTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.natureTimer);
      this.natureTimer = null;
    }
    for (const id of this.activeTimers) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(id);
      }
    }
    this.activeTimers = [];
  }

  private clearActiveNodes(immediate: boolean = true) {
    this.clearActiveTimersOnly();

    if (immediate) {
      for (const tId of this.fadingCleanupTimers) {
        if (typeof window !== 'undefined') window.clearTimeout(tId);
      }
      this.fadingCleanupTimers = [];
    }

    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeNodes = [];
    this.activeTrackGain = null;
  }

  /**
   * Smoothly fades out the currently playing style/track over `fadeSec` seconds
   * while simultaneously allowing the incoming track to crossfade in with zero silence gap.
   */
  private crossfadeOutCurrentTrack(fadeSec: number = CROSSFADE_DURATION_SEC) {
    this.clearActiveTimersOnly();
    const oldNodes = [...this.activeNodes];
    const oldGain = this.activeTrackGain;
    this.activeNodes = [];
    this.activeTrackGain = null;

    if (oldNodes.length === 0) return;

    if (!this.ctx || !oldGain || typeof window === 'undefined') {
      for (const node of oldNodes) {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            (node as any).stop();
          }
          node.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      }
      return;
    }

    const now = this.ctx.currentTime;
    try {
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value || 1.0), now);
      oldGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    } catch {
      // Fallback immediate stop if AudioParam scheduling fails
    }

    const cleanupId = window.setTimeout(() => {
      for (const node of oldNodes) {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            (node as any).stop();
          }
          node.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      }
    }, Math.round((fadeSec + 0.08) * 1000));

    this.fadingCleanupTimers.push(cleanupId);
  }

  private cachePrefetchedBytes(url: string, bytes: ArrayBuffer) {
    if (this.prefetchedBytesCache.has(url)) {
      this.prefetchedBytesCache.delete(url);
    }
    if (this.prefetchedBytesCache.size >= MAX_PREFETCH_BYTES_CACHE) {
      const oldestKey = this.prefetchedBytesCache.keys().next().value;
      if (oldestKey) {
        this.prefetchedBytesCache.delete(oldestKey);
      }
    }
    this.prefetchedBytesCache.set(url, bytes);
  }

  private cacheDecodedBuffer(url: string, buffer: AudioBuffer) {
    if (this.decodedAudioCache.has(url)) {
      this.decodedAudioCache.delete(url);
    }
    if (this.decodedAudioCache.size >= MAX_DECODED_BUFFER_CACHE) {
      const oldestKey = this.decodedAudioCache.keys().next().value;
      if (oldestKey) {
        this.decodedAudioCache.delete(oldestKey);
      }
    }
    this.decodedAudioCache.set(url, buffer);
  }

  /**
   * Downloads and caches raw MP3 bytes (deduplicated) and optionally pre-decodes
   * into an AudioBuffer if an AudioContext is already initialized.
   */
  public async prefetchAudioUrl(
    audioUrl: string,
    priority: 'high' | 'idle' = 'idle'
  ): Promise<boolean> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
    if (priority === 'idle' && this.isSaveDataMode()) return false;

    if (this.decodedAudioCache.has(audioUrl)) return true;

    let bytes = this.prefetchedBytesCache.get(audioUrl);
    if (!bytes) {
      let pending = this.inFlightFetches.get(audioUrl);
      if (!pending) {
        pending = (async () => {
          try {
            const response = await fetch(audioUrl, { cache: 'force-cache' });
            if (!response.ok) return null;
            const buf = await response.arrayBuffer();
            this.cachePrefetchedBytes(audioUrl, buf);
            return buf;
          } catch {
            return null;
          } finally {
            this.inFlightFetches.delete(audioUrl);
          }
        })();
        this.inFlightFetches.set(audioUrl, pending);
      }
      const fetched = await pending;
      if (!fetched) return false;
      bytes = fetched;
    }

    // Pre-decode silently if AudioContext is already open so playback begins in 0ms
    if (this.ctx && !this.decodedAudioCache.has(audioUrl)) {
      try {
        const decoded = await this.ctx.decodeAudioData(bytes.slice(0));
        this.cacheDecodedBuffer(audioUrl, decoded);
      } catch {
        // Ignore decode failure during speculative prefetch
      }
    }

    return true;
  }

  /**
   * Smartly prefetches the next track for a target SeasonalStyle (e.g., on style hover/open/switch)
   * and remembers that warmed track so activating the style gives instant playback.
   */
  public async prefetchStyle(
    style: SeasonalStyle,
    priority: 'high' | 'idle' = 'high'
  ): Promise<string | null> {
    if (priority === 'idle' && this.isSaveDataMode()) return null;

    let entry = this.pendingPrefetchedTrackByStyle.get(style);
    if (!entry) {
      const prevHistory = Array.isArray(this.styleHistoryMap[style]) ? this.styleHistoryMap[style]! : [];
      entry = pickNextQueueTrackForStyle(style, prevHistory);
      this.pendingPrefetchedTrackByStyle.set(style, entry);
    }

    const audioUrl = resolveAudioFileForStyle(style, entry.track);
    const ok = await this.prefetchAudioUrl(audioUrl, priority);
    return ok ? audioUrl : null;
  }

  /**
   * Background idle prefetch for multiple candidate SeasonalStyles with bounded concurrency.
   */
  public prefetchStyles(styles: SeasonalStyle[]): void {
    if (typeof window === 'undefined' || this.isSaveDataMode()) return;

    const uniqueStyles = Array.from(new Set(styles));
    let cursor = 0;

    const runNext = async () => {
      while (cursor < uniqueStyles.length) {
        const nextStyle = uniqueStyles[cursor++];
        await this.prefetchStyle(nextStyle, 'idle');
      }
    };

    const workers = Math.min(MAX_CONCURRENT_IDLE_PREFETCH, uniqueStyles.length);
    for (let w = 0; w < workers; w++) {
      void runNext();
    }
  }

  private scheduleSmartLookaheadPrefetch(activeStyle: SeasonalStyle, activeTrackId: string) {
    if (typeof window === 'undefined') return;
    if (this.idlePrefetchTimer !== null) {
      window.clearTimeout(this.idlePrefetchTimer);
      this.idlePrefetchTimer = null;
    }

    const runPrefetch = () => {
      this.idlePrefetchTimer = null;
      // 1. Always pre-warm the next non-repeating song within the currently active style
      const historyWithCurrent = Array.from(
        new Set([...(this.styleHistoryMap[activeStyle] || []), activeTrackId])
      );
      const nextCandidates = getPrefetchCandidatesForStyle(activeStyle, historyWithCurrent, 2);
      for (const candidate of nextCandidates) {
        if (candidate.id !== activeTrackId) {
          void this.prefetchAudioUrl(candidate.audioFile, 'high');
          break;
        }
      }

      // 2. Warm adjacent styles during browser idle time unless Data Saver is on
      if (!this.isSaveDataMode()) {
        const neighbors = getAdjacentStylesForPrefetch(activeStyle);
        this.prefetchStyles(neighbors);
      }
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      const idleId = (window as any).requestIdleCallback(runPrefetch, { timeout: 1500 });
      this.idlePrefetchTimer = window.setTimeout(() => {
        if (typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleId);
        }
      }, 2000);
    } else {
      this.idlePrefetchTimer = window.setTimeout(runPrefetch, 450);
    }
  }

  private startAudioBufferPlayback(
    ctx: AudioContext,
    audioBuffer: AudioBuffer,
    track: AmbientTrack,
    useCrossfade: boolean
  ) {
    if (!this.masterGain) return;

    if (useCrossfade && this.activeNodes.length > 0) {
      this.crossfadeOutCurrentTrack(CROSSFADE_DURATION_SEC);
    } else {
      this.clearActiveNodes(false);
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;

    const trackGain = ctx.createGain();
    const now = ctx.currentTime;
    const fadeInDur = useCrossfade ? CROSSFADE_DURATION_SEC : 0.65;
    trackGain.gain.setValueAtTime(0.0001, now);
    trackGain.gain.linearRampToValueAtTime(1.0, now + fadeInDur);

    source.connect(trackGain);
    trackGain.connect(this.masterGain);
    source.start(now);

    this.activeNodes.push(source, trackGain);
    this.activeTrackGain = trackGain;

    if (typeof window !== 'undefined') {
      this.trackEndTimer = window.setTimeout(() => {
        if (this.isEnabled && !this.isMuted && this.currentStyle === track.style) {
          this.playNextRandomTrack(track.style);
        }
      }, track.durationSec * 1000);
    }

    this.scheduleSmartLookaheadPrefetch(track.style, track.id);
  }

  /**
   * Dynamically loads, decodes (from prefetch/LRU cache when available), and smoothly crossfades
   * into the unique audio file assigned to `style` and `track` without silence gaps.
   * Falls back seamlessly to 64-bit real-time studio synthesis if offline & uncached.
   */
  private async loadAndPlayTrack(style: SeasonalStyle, track: AmbientTrack) {
    const ctx = this.ensureContext();
    const audioUrl = resolveAudioFileForStyle(style, track);
    this.currentAudioFile = audioUrl;

    if (!ctx || !this.masterGain) return;

    const hadActiveAudio = this.activeNodes.length > 0;
    this.loadGeneration += 1;
    const myGen = this.loadGeneration;
    this.isLoadingTrack = true;
    this.cancelPendingActiveFetch();

    try {
      let decoded = this.decodedAudioCache.get(audioUrl);
      if (!decoded) {
        let rawBytes = this.prefetchedBytesCache.get(audioUrl);
        if (!rawBytes) {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          this.activeFetchController = controller;

          const response = await fetch(audioUrl, {
            signal: controller?.signal,
            cache: 'force-cache',
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} loading ${audioUrl}`);
          }
          rawBytes = await response.arrayBuffer();
          if (myGen !== this.loadGeneration) return;
          this.cachePrefetchedBytes(audioUrl, rawBytes);
        }

        decoded = await ctx.decodeAudioData(rawBytes.slice(0));
        if (myGen !== this.loadGeneration) return;

        this.cacheDecodedBuffer(audioUrl, decoded);
      }

      if (
        myGen !== this.loadGeneration ||
        !this.isEnabled ||
        this.isMuted ||
        this.currentStyle !== style
      ) {
        return;
      }

      this.startAudioBufferPlayback(ctx, decoded, track, hadActiveAudio);
      this.updateMasterGain();
    } catch (err: any) {
      if (err && err.name === 'AbortError') return;
      if (
        myGen !== this.loadGeneration ||
        !this.isEnabled ||
        this.isMuted ||
        this.currentStyle !== style
      ) {
        return;
      }
      // Graceful fallback to 64-bit Float64Array DSP synthesis if offline and file not yet cached
      this.build64BitSynthGraph(track);
      this.updateMasterGain();
    } finally {
      if (myGen === this.loadGeneration) {
        this.activeFetchController = null;
        this.isLoadingTrack = false;
      }
    }
  }

  private getOrCreateInstrumentBuffer(
    ctx: AudioContext,
    instrument: StudioInstrument,
    freq: number,
    durationSec: number
  ): AudioBuffer {
    const roundedFreq = Math.round(freq * 10);
    const roundedDur = Math.max(1, Math.round(durationSec * 2)) / 2;
    const key = `${instrument}:${roundedFreq}:${roundedDur}`;
    const existing = this.noteBufferCache.get(key);
    if (existing) return existing;

    if (this.noteBufferCache.size > 380) {
      const firstKey = this.noteBufferCache.keys().next().value;
      if (firstKey) this.noteBufferCache.delete(firstKey);
    }

    const samples64 = synthesize64BitInstrumentSamples(instrument, freq, roundedDur, ctx.sampleRate);
    const audioBuf = float64ToAudioBuffer(ctx, samples64, ctx.sampleRate);
    this.noteBufferCache.set(key, audioBuf);
    return audioBuf;
  }

  private play64BitNote(
    ctx: AudioContext,
    dryDest: AudioNode,
    wetDest: AudioNode,
    instrument: StudioInstrument,
    freq: number,
    durationSec: number,
    volume: number,
    pan: number = 0,
    delayOffsetSec: number = 0
  ) {
    const startAt = ctx.currentTime + Math.max(0, delayOffsetSec);
    const buffer = this.getOrCreateInstrumentBuffer(ctx, instrument, freq, durationSec);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startAt);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), startAt);
      src.connect(gain);
      gain.connect(panner);
      panner.connect(dryDest);
      panner.connect(wetDest);
    } else {
      src.connect(gain);
      gain.connect(dryDest);
      gain.connect(wetDest);
    }

    src.start(startAt);
  }

  private playSoftPercussion(
    ctx: AudioContext,
    dest: AudioNode,
    noiseBuf: AudioBuffer,
    kind: 'kick' | 'brush' | 'rim' | 'shaker'
  ) {
    const now = ctx.currentTime;
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      g.gain.setValueAtTime(0.065, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'rim' ? 'bandpass' : 'highpass';
    filter.frequency.value = kind === 'rim' ? 1400 : kind === 'shaker' ? 4200 : 2600;
    const g = ctx.createGain();
    const peak = kind === 'brush' ? 0.024 : kind === 'shaker' ? 0.018 : 0.028;
    const dur = kind === 'brush' ? 0.09 : 0.055;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(now, Math.random() * 2.5, dur + 0.02);
  }

  private triggerNatureAccent(
    ctx: AudioContext,
    wetDest: AudioNode,
    dryDest: AudioNode,
    noiseBuf: AudioBuffer,
    accent: StudioNatureAccent
  ) {
    if (accent === 'none' || !this.isEnabled || this.isMuted || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    if (accent === 'birds') {
      const baseF = 1650 + Math.random() * 550;
      const chirps = 2 + Math.floor(Math.random() * 2);
      const pan = (Math.random() - 0.5) * 1.1;
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = pan;
        panner.connect(wetDest);
      }
      const target = panner || wetDest;

      for (let c = 0; c < chirps; c++) {
        const t0 = now + c * 0.14;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseF, t0);
        osc.frequency.exponentialRampToValueAtTime(baseF * (1.16 + Math.random() * 0.12), t0 + 0.05);
        osc.frequency.exponentialRampToValueAtTime(baseF * 0.94, t0 + 0.1);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.014, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
        osc.connect(g);
        g.connect(target);
        osc.start(t0);
        osc.stop(t0 + 0.13);
      }
    } else if (accent === 'owls_wind') {
      const baseF = 340 + Math.random() * 40;
      [0, 0.34, 0.72].forEach((offset, i) => {
        const t0 = now + offset;
        const dur = i === 2 ? 0.58 : 0.22;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseF * (i === 1 ? 1.04 : 1.0), t0);
        osc.frequency.linearRampToValueAtTime(baseF * 0.92, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.024, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(wetDest);
        osc.start(t0);
        osc.stop(t0 + dur + 0.04);
      });
    } else if (accent === 'thunder_roll') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 95;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.16, now + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
      src.connect(lp);
      lp.connect(g);
      g.connect(dryDest);
      src.start(now, Math.random() * 2, 4.0);
    } else if (accent === 'sleigh_bells') {
      [2637, 3136, 3520].forEach((freq, idx) => {
        this.play64BitNote(ctx, dryDest, wetDest, 'celesta', freq, 0.65, 0.012, 0.35, idx * 0.025);
      });
    }
  }

  private build64BitSynthGraph(track: AmbientTrack) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.reverbNode) return;

    this.clearActiveNodes(false);

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 5200;
    warmthFilter.Q.value = 0.5;
    warmthFilter.connect(this.masterGain);

    const dryBus = ctx.createGain();
    dryBus.gain.value = 1 - Math.min(0.55, track.reverbWet * 0.5);
    dryBus.connect(warmthFilter);

    const wetSend = ctx.createGain();
    wetSend.gain.value = track.reverbWet;
    wetSend.connect(this.reverbNode);

    const wetReturn = ctx.createGain();
    wetReturn.gain.value = 0.72;
    this.reverbNode.connect(wetReturn);
    wetReturn.connect(warmthFilter);

    this.activeNodes.push(warmthFilter, dryBus, wetSend, wetReturn);

    const textureBuffer = create64BitNatureTextureBuffer(ctx, track.textureType);
    if (track.textureLevel > 0) {
      const textureSrc = ctx.createBufferSource();
      textureSrc.buffer = textureBuffer;
      textureSrc.loop = true;

      const textureGain = ctx.createGain();
      textureGain.gain.value = track.textureLevel;
      textureSrc.connect(textureGain);
      textureGain.connect(this.masterGain);
      textureSrc.start();
      this.activeNodes.push(textureSrc, textureGain);
    }

    const stepMs = Math.max(200, Math.round((60 / Math.max(44, track.bpm)) * 500));
    let step = 0;

    const triggerStep = () => {
      if (!this.ctx || !this.masterGain || !this.isEnabled || this.isMuted) return;
      if (this.ctx.state !== 'running') return;

      const barIndex = Math.floor(step / 8);
      const stepInBar = step % 8;
      const chord = track.chords[barIndex % track.chords.length];
      const phrase = barIndex % 4 < 2 ? track.phraseA : track.phraseB;
      const phraseStep = step % phrase.length;

      if (stepInBar === 0 && Array.isArray(chord)) {
        const chordDurSec = Math.max(2.0, (stepMs * 8) / 1000 * 1.05);
        const perNoteVol =
          track.padInstrument === 'cuatro'
            ? 0.085
            : track.padInstrument === 'cello_strings'
            ? 0.075
            : 0.08;

        chord.forEach((freq, idx) => {
          const strumOffset = track.padInstrument === 'cuatro' ? idx * 0.022 : idx * 0.012;
          const pan = idx % 2 === 0 ? -0.25 : 0.25;
          this.play64BitNote(
            this.ctx!,
            dryBus,
            wetSend,
            track.padInstrument,
            freq,
            chordDurSec,
            perNoteVol,
            pan,
            strumOffset
          );
        });
      }

      if (
        (track.groove === 'joropo_waltz' || track.groove === 'merengue_suave' || track.groove === 'bossa_samba') &&
        (stepInBar === 3 || stepInBar === 6) &&
        Array.isArray(chord)
      ) {
        chord.slice(1, 4).forEach((freq, idx) => {
          this.play64BitNote(
            this.ctx!,
            dryBus,
            wetSend,
            track.padInstrument,
            freq,
            0.5,
            0.045,
            0.22,
            idx * 0.014
          );
        });
      }

      const noteIndex = phrase[phraseStep];
      if (noteIndex !== null && noteIndex !== undefined && track.melodyScale.length > 0) {
        const safeIdx = ((noteIndex % track.melodyScale.length) + track.melodyScale.length) % track.melodyScale.length;
        const noteFreq = track.melodyScale[safeIdx];
        const humanOffsetSec = ((Math.random() - 0.5) * track.humanizeMs) / 1000;
        const velJitter = 0.86 + Math.random() * 0.24;
        const noteDurSec =
          track.groove === 'ambient_free' || track.groove === 'ballad_waltz' ? 2.5 : 1.5;

        this.play64BitNote(
          this.ctx,
          dryBus,
          wetSend,
          track.leadInstrument,
          noteFreq,
          noteDurSec,
          0.145 * velJitter,
          -0.06,
          Math.max(0, humanOffsetSec)
        );

        if (track.accentInstrument && (phraseStep === 0 || phraseStep === 8)) {
          this.play64BitNote(
            this.ctx,
            dryBus,
            wetSend,
            track.accentInstrument,
            noteFreq * (noteFreq > 520 ? 0.5 : 1.0),
            2.0,
            0.075,
            0.28,
            0.03
          );
        }
      }

      if (track.groove === 'lofi_chill') {
        if (stepInBar === 0 || stepInBar === 5) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'kick');
        if (stepInBar === 4) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'rim');
        if (stepInBar % 2 === 1) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'brush');
      } else if (track.groove === 'bossa_samba') {
        if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6) {
          this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'kick');
        }
        if (stepInBar === 1 || stepInBar === 4 || stepInBar === 7) {
          this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'rim');
        }
        this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'shaker');
      } else if (track.groove === 'joropo_waltz') {
        if (stepInBar === 0) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'kick');
        if (stepInBar === 2 || stepInBar === 4 || stepInBar === 6) {
          this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'shaker');
        }
      } else if (track.groove === 'merengue_suave') {
        if (stepInBar === 0 || stepInBar === 4) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'kick');
        if (stepInBar === 2 || stepInBar === 5 || stepInBar === 7) {
          this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'shaker');
        }
      } else if (track.groove === 'gentle_pulse' || track.groove === 'ballad_waltz') {
        if (stepInBar === 0) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'kick');
        if (stepInBar === 4) this.playSoftPercussion(this.ctx, dryBus, textureBuffer, 'brush');
      }

      step += 1;
    };

    if (typeof window !== 'undefined') {
      this.stepTimer = window.setInterval(triggerStep, stepMs);
      const tInit = window.setTimeout(triggerStep, 160);
      this.activeTimers.push(tInit);

      if (track.natureAccent !== 'none') {
        const accentIntervalMs =
          track.natureAccent === 'sleigh_bells'
            ? 5200
            : track.natureAccent === 'thunder_roll'
            ? 14500
            : 6800;

        this.natureTimer = window.setInterval(() => {
          if (this.ctx) {
            this.triggerNatureAccent(this.ctx, wetSend, dryBus, textureBuffer, track.natureAccent);
          }
        }, accentIntervalMs);

        const tNat = window.setTimeout(() => {
          if (this.ctx) {
            this.triggerNatureAccent(this.ctx, wetSend, dryBus, textureBuffer, track.natureAccent);
          }
        }, 2200);
        this.activeTimers.push(tNat);
      }

      this.trackEndTimer = window.setTimeout(() => {
        if (this.isEnabled && !this.isMuted && this.currentStyle === track.style) {
          this.playNextRandomTrack(track.style);
        }
      }, track.durationSec * 1000);
    }
  }

  private updateMasterGain() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const targetVolume =
      this.isEnabled && !this.isMuted ? Math.max(0.02, Math.min(1, this.intensity)) * 0.85 : 0;

    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(targetVolume, now, 0.3);
    } catch {
      this.masterGain.gain.value = targetVolume;
    }
  }

  public sync(style: SeasonalStyle, enabled: boolean, intensity: number, userMuted: boolean) {
    const styleChanged = this.currentStyle !== style;
    const wasAudible = this.isEnabled && !this.isMuted;
    const isNowAudible = enabled && !userMuted;
    const justActivated = !wasAudible && isNowAudible;

    this.isEnabled = enabled;
    this.intensity = intensity;
    this.isMuted = userMuted;

    if (!enabled || userMuted) {
      if (styleChanged) {
        this.loadGeneration += 1;
        this.isLoadingTrack = false;
        this.cancelPendingActiveFetch();
        this.clearActiveNodes();
        this.currentStyle = style;
        const nextTrack = this.selectRandomTrackForStyle(style);
        this.currentTrack = nextTrack;
        this.currentAudioFile = resolveAudioFileForStyle(style, nextTrack);
        this.notifyTrackChanged();
      }
      // Smart prefetch even while muted/inactive so activating sound starts immediately with 0ms gap
      if (this.currentAudioFile) {
        void this.prefetchAudioUrl(this.currentAudioFile, 'high');
      }
      if (!this.ctx || this.ctx.state === 'suspended') {
        this.attachGestureUnlock();
      }
      this.updateMasterGain();
      if (this.ctx && this.ctx.state === 'running' && !enabled) {
        void this.ctx.suspend().catch(() => {});
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (styleChanged || justActivated || !this.currentTrack || (this.activeNodes.length === 0 && !this.isLoadingTrack)) {
      this.currentStyle = style;
      const track = this.selectRandomTrackForStyle(style);
      this.currentTrack = track;
      this.currentAudioFile = resolveAudioFileForStyle(style, track);
      void this.loadAndPlayTrack(style, track);
      this.notifyTrackChanged();
    }

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (this.activeNodes.length === 0 && !this.isLoadingTrack && this.currentStyle && this.currentTrack) {
            void this.loadAndPlayTrack(this.currentStyle, this.currentTrack);
          }
          this.updateMasterGain();
        })
        .catch(() => {});
      this.attachGestureUnlock();
    } else {
      this.updateMasterGain();
    }
  }

  public playNextRandomTrack(style?: SeasonalStyle, intensity?: number): AmbientTrack | null {
    const targetStyle = style || this.currentStyle || 'normal';
    if (typeof intensity === 'number') {
      this.intensity = intensity;
    }
    this.isEnabled = true;
    this.isMuted = false;

    const track = this.selectRandomTrackForStyle(targetStyle);
    this.currentStyle = targetStyle;
    this.currentTrack = track;
    this.currentAudioFile = resolveAudioFileForStyle(targetStyle, track);

    const ctx = this.ensureContext();
    this.notifyTrackChanged();
    if (!ctx) {
      return track;
    }

    void this.loadAndPlayTrack(targetStyle, track);
    ctx
      .resume()
      .then(() => {
        this.updateMasterGain();
      })
      .catch(() => {});

    return track;
  }

  public triggerTestPreview(style: SeasonalStyle, intensity: number) {
    return this.playNextRandomTrack(style, intensity);
  }

  public unlockFromUserGesture(style: SeasonalStyle, intensity: number) {
    this.isEnabled = true;
    this.isMuted = false;
    this.intensity = intensity;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const ensurePlaying = () => {
      if (!this.isEnabled || this.isMuted) return;
      if (this.currentStyle !== style || !this.currentTrack) {
        this.currentStyle = style;
        const track = this.selectRandomTrackForStyle(style);
        this.currentTrack = track;
        this.currentAudioFile = resolveAudioFileForStyle(style, track);
        this.notifyTrackChanged();
      }
      if (this.activeNodes.length === 0 && !this.isLoadingTrack && this.currentTrack) {
        void this.loadAndPlayTrack(style, this.currentTrack);
      }
      this.updateMasterGain();
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(ensurePlaying).catch(() => {});
    } else {
      ensurePlaying();
    }
  }

  public stop() {
    this.isEnabled = false;
    this.loadGeneration += 1;
    this.isLoadingTrack = false;
    this.cancelPendingActiveFetch();
    this.updateMasterGain();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (!this.isEnabled) {
          this.clearActiveNodes();
          this.currentStyle = null;
          this.currentTrack = null;
          this.currentAudioFile = null;
          this.notifyTrackChanged();
        }
      }, 420);
    }
  }
}

export const ambientSoundEngine = new AmbientSoundEngine();
