import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STYLE_SOUND_CATALOG,
  STYLE_SOUND_META,
  getTracksForStyle,
  pickRandomTrackForStyle,
  pickNextQueueTrackForStyle,
} from './ambientSoundCatalog';
import {
  STYLE_AUDIO_FILES,
  STYLE_AUDIO_FILE_MAP,
  getAudioFilesForStyle,
  resolveAudioFileForStyle,
  getPrefetchCandidatesForStyle,
  getAdjacentStylesForPrefetch,
} from './ambientSoundEngine';
import {
  synthesize64BitInstrumentSamples,
  type StudioInstrument,
} from './studioAudioSynthesis';
import {
  ALL_SEASONAL_STYLES,
  getIconNeonGlowClasses,
  getStyleIconMeta,
} from '../components/SeasonalOverlay';

const ALL_INSTRUMENTS: StudioInstrument[] = [
  'felt_piano',
  'concert_piano',
  'rhodes',
  'acoustic_guitar',
  'ukulele',
  'harp',
  'cuatro',
  'cello_strings',
  'warm_pad',
  'steel_drum',
  'marimba',
  'celesta',
  'brass_warm',
];

test('all 17 seasonal styles exist in STYLE_SOUND_CATALOG with 3 unique tracks each', () => {
  assert.equal(ALL_SEASONAL_STYLES.length, 17);

  for (const style of ALL_SEASONAL_STYLES) {
    const entry = STYLE_SOUND_CATALOG[style];
    assert.ok(entry, `Missing catalog entry for style: ${style}`);
    assert.equal(entry.tracks.length, 3, `Expected 3 tracks for style: ${style}`);

    const ids = new Set(entry.tracks.map(t => t.id));
    assert.equal(ids.size, 3, `Duplicate track IDs in style: ${style}`);

    const titles = new Set(entry.tracks.map(t => t.title));
    assert.equal(titles.size, 3, `Duplicate track titles in style: ${style}`);

    assert.equal(STYLE_SOUND_META[style].tracks.length, 3);
  }
});

test('ambientSoundEngine dynamically assigns unique MP3 audio files per SeasonalStyle and all 51 MP3 files exist on disk', () => {
  const primaryFiles = new Set<string>();
  const allFiles = new Set<string>();
  const publicDir = path.resolve(process.cwd(), 'public');

  for (const style of ALL_SEASONAL_STYLES) {
    const primary = STYLE_AUDIO_FILE_MAP[style];
    assert.ok(primary && primary.startsWith(`/audio/${style}/`) && primary.endsWith('.mp3'), `Invalid primary file for ${style}: ${primary}`);
    assert.ok(!primaryFiles.has(primary), `Duplicate primary audio file across styles: ${primary}`);
    primaryFiles.add(primary);

    const styleFiles = getAudioFilesForStyle(style);
    assert.equal(styleFiles.length, 3, `Expected 3 audio files for style ${style}`);
    assert.deepEqual(styleFiles, STYLE_AUDIO_FILES[style]);

    const tracks = getTracksForStyle(style);
    for (const track of tracks) {
      const resolved = resolveAudioFileForStyle(style, track);
      assert.equal(resolved, track.audioFile);
      assert.ok(resolved.startsWith(`/audio/${style}/`) && resolved.endsWith('.mp3'));
      assert.ok(!allFiles.has(resolved), `Duplicate MP3 path across tracks: ${resolved}`);
      allFiles.add(resolved);

      const diskPath = path.join(publicDir, resolved.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), `Missing MP3 file on disk: ${diskPath}`);
      const stat = fs.statSync(diskPath);
      assert.ok(stat.size > 50_000, `MP3 file unexpectedly small (${stat.size} bytes): ${diskPath}`);
    }
  }

  assert.equal(primaryFiles.size, 17);
  assert.equal(allFiles.size, 51);

  // Cross-style safety: requesting resolution for style 'espacio' with a 'navidad' track must never leak 'navidad' audio
  const navidadTrack = getTracksForStyle('navidad')[0];
  const resolvedForEspacio = resolveAudioFileForStyle('espacio', navidadTrack);
  assert.ok(resolvedForEspacio.startsWith('/audio/espacio/'));
});

test('smart prefetch predictors avoid repeating the latest track and exclude active style from neighbor list', () => {
  const navidadTracks = getTracksForStyle('navidad');
  const candidates = getPrefetchCandidatesForStyle('navidad', [navidadTracks[0].id], 2);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every(c => c.id !== navidadTracks[0].id), 'Must prioritize unplayed tracks for prefetch');

  for (const style of ALL_SEASONAL_STYLES) {
    const neighbors = getAdjacentStylesForPrefetch(style);
    assert.ok(neighbors.length >= 2 && neighbors.length <= 3);
    assert.ok(!neighbors.includes(style), `Neighbor prefetch list must not include active style ${style}`);
  }
});

test('all 51 tracks have completely distinct musical arrangements and valid 64-bit studio parameters', () => {
  const globalIds = new Set<string>();
  const globalFingerprints = new Set<string>();

  for (const style of ALL_SEASONAL_STYLES) {
    const tracks = getTracksForStyle(style);
    const localLeadsOrGrooves = new Set<string>();

    for (const track of tracks) {
      assert.ok(!globalIds.has(track.id), `Duplicate global track id: ${track.id}`);
      globalIds.add(track.id);

      assert.ok(track.chords.length >= 4, `Expected >= 4 chords for ${track.id}`);
      assert.equal(track.phraseA.length, 16, `Expected 16-step phraseA for ${track.id}`);
      assert.equal(track.phraseB.length, 16, `Expected 16-step phraseB for ${track.id}`);

      for (const step of [...track.phraseA, ...track.phraseB]) {
        if (step !== null) {
          assert.ok(
            step >= 0 && step < track.melodyScale.length,
            `Out-of-bounds melody index ${step} in ${track.id}`
          );
        }
      }

      assert.ok(ALL_INSTRUMENTS.includes(track.padInstrument), `Invalid padInstrument in ${track.id}`);
      assert.ok(ALL_INSTRUMENTS.includes(track.leadInstrument), `Invalid leadInstrument in ${track.id}`);
      if (track.accentInstrument) {
        assert.ok(ALL_INSTRUMENTS.includes(track.accentInstrument), `Invalid accentInstrument in ${track.id}`);
      }
      assert.ok(track.reverbWet >= 0.3 && track.reverbWet <= 0.85, `Invalid reverbWet in ${track.id}`);

      localLeadsOrGrooves.add(`${track.leadInstrument}|${track.padInstrument}|${track.groove}`);

      const fingerprint = JSON.stringify({
        bpm: track.bpm,
        chords: track.chords,
        phraseA: track.phraseA,
        phraseB: track.phraseB,
        leadInstrument: track.leadInstrument,
        padInstrument: track.padInstrument,
        groove: track.groove,
      });
      assert.ok(
        !globalFingerprints.has(fingerprint),
        `Track ${track.id} shares an identical arrangement with another track`
      );
      globalFingerprints.add(fingerprint);
    }

    assert.ok(
      localLeadsOrGrooves.size >= 2,
      `Style ${style} tracks should vary instruments or grooves across its 3 tracks`
    );
  }

  assert.equal(globalIds.size, 51);
  assert.equal(globalFingerprints.size, 51);
});

test('64-bit Float64Array studio DSP synthesizer produces clean finite waveforms for all 13 instruments', () => {
  for (const instrument of ALL_INSTRUMENTS) {
    const samples = synthesize64BitInstrumentSamples(instrument, 329.63, 1.2, 44100);
    assert.ok(samples instanceof Float64Array, `${instrument} must return Float64Array`);
    assert.ok(samples.length > 44100, `${instrument} must synthesize requested sample count`);

    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      assert.ok(Number.isFinite(s), `${instrument} produced non-finite sample at ${i}`);
      assert.ok(s >= -1.0 && s <= 1.0, `${instrument} sample clipped out of [-1, 1] at ${i}: ${s}`);
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
      sumSq += s * s;
    }

    const rms = Math.sqrt(sumSq / samples.length);
    assert.ok(rms > 0.005, `${instrument} RMS too quiet (${rms})`);
    assert.ok(peak > 0.05, `${instrument} peak too quiet (${peak})`);
  }
});

test('exact track titles match specification for key styles', () => {
  assert.deepEqual(
    getTracksForStyle('normal').map(t => t.title),
    ['Gentle Ambient Piano', 'Soft Medical Technology Loop', 'Calm Acoustic Morning']
  );
  assert.deepEqual(
    getTracksForStyle('fiestas_patrias').map(t => t.title),
    [
      'Arpa, Cuatro y Maracas (Instrumental Elegante)',
      'El Ávila en Acústico',
      'Merengue Venezolano Instrumental (Suave)',
    ]
  );
  assert.deepEqual(
    getTracksForStyle('navidad').map(t => t.title),
    [
      'Cozy Christmas Fireplace & Chimes',
      'Jingle Bells Lo-Fi Instrumental',
      'Classic Holiday Piano & Sleigh Bells',
    ]
  );
  assert.deepEqual(
    getTracksForStyle('halloween').map(t => t.title),
    [
      'Spooky Mystery Ambient Synth',
      'Haunted House Piano Waltz',
      'Night Forest Creepy Wind & Owls',
    ]
  );
});

test('pickRandomTrackForStyle never repeats previousTrackId', () => {
  for (const style of ALL_SEASONAL_STYLES) {
    const tracks = getTracksForStyle(style);
    for (const prev of tracks) {
      for (const rngVal of [0, 0.25, 0.5, 0.75, 0.99999]) {
        const picked = pickRandomTrackForStyle(style, prev.id, () => rngVal);
        assert.notEqual(
          picked.id,
          prev.id,
          `Repeated track ${prev.id} for style ${style} at rng=${rngVal}`
        );
      }
    }
  }
});

test('pickNextQueueTrackForStyle rotates through all 3 tracks before repeating and avoids back-to-back repeat on cycle reset', () => {
  let history: string[] = [];
  const firstCycleIds = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const res = pickNextQueueTrackForStyle('navidad', history, () => (i * 0.31) % 1);
    firstCycleIds.add(res.track.id);
    history = res.nextHistory;
  }

  assert.equal(firstCycleIds.size, 3, 'First 3 picks must cover all 3 distinct tracks');

  const lastOfFirstCycle = history[history.length - 1];
  for (const rngVal of [0, 0.49, 0.99]) {
    const nextCycle = pickNextQueueTrackForStyle('navidad', history, () => rngVal);
    assert.notEqual(
      nextCycle.track.id,
      lastOfFirstCycle,
      'Must not repeat the last track immediately upon starting next cycle'
    );
    assert.equal(nextCycle.nextHistory.length, 1);
  }
});

test('every falling icon across all 17 seasonal styles receives outer and inner neon drop-shadow glow', () => {
  for (const style of ALL_SEASONAL_STYLES) {
    const meta = getStyleIconMeta(style);
    meta.catalog.forEach((item, idx) => {
      const glow = getIconNeonGlowClasses(item.emoji, style, idx);
      assert.ok(
        glow.outerGlow.includes('drop-shadow-[0_0_'),
        `Missing outer neon glow for ${style} ${item.emoji}: ${glow.outerGlow}`
      );
      assert.ok(
        glow.innerGlow.includes('drop-shadow-[0_0_'),
        `Missing inner neon glow for ${style} ${item.emoji}: ${glow.innerGlow}`
      );
      assert.ok(
        !glow.outerGlow.includes('drop-shadow-none') && !glow.innerGlow.includes('drop-shadow-none'),
        `Neon glow must remain active in dark mode for ${style} ${item.emoji}`
      );
    });
  }
});
