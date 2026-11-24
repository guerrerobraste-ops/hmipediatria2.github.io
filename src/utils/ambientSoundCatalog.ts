import type { SeasonalStyle } from '../components/SeasonalOverlay';
import type {
  StudioInstrument,
  StudioTextureType,
  StudioNatureAccent,
} from './studioAudioSynthesis';

export type StudioGroove =
  | 'ambient_free'
  | 'lofi_chill'
  | 'bossa_samba'
  | 'joropo_waltz'
  | 'merengue_suave'
  | 'gentle_pulse'
  | 'ballad_waltz';

export interface AmbientTrack {
  id: string;
  title: string;
  style: SeasonalStyle;
  audioFile: string;
  bpm: number;
  chords: number[][];
  melodyScale: number[];
  /** 16-step Section A melody indices into melodyScale (null = expressive breath rest) */
  phraseA: Array<number | null>;
  /** 16-step Section B melody indices into melodyScale (null = expressive breath rest) */
  phraseB: Array<number | null>;
  padInstrument: StudioInstrument;
  leadInstrument: StudioInstrument;
  accentInstrument?: StudioInstrument;
  groove: StudioGroove;
  textureType: StudioTextureType;
  textureLevel: number;
  natureAccent: StudioNatureAccent;
  reverbWet: number; // 0.30..0.80
  humanizeMs: number;
  durationSec: number;
}

type RawAmbientTrack = Omit<AmbientTrack, 'audioFile'>;

export interface StyleSoundCatalogEntry {
  style: SeasonalStyle;
  label: string;
  description: string;
  tracks: AmbientTrack[];
}

interface RawStyleSoundCatalogEntry {
  style: SeasonalStyle;
  label: string;
  description: string;
  tracks: RawAmbientTrack[];
}

export interface StyleSoundMeta {
  name: string;
  description: string;
  tracks: string[];
}

export function buildAudioFilePath(style: SeasonalStyle, trackId: string): string {
  return `/audio/${style}/${trackId}.mp3`;
}

// Concert-pitch frequency map (Hz, A4 = 440Hz)
const N = {
  G2: 98.0, Ab2: 103.83, A2: 110.0, Bb2: 116.54, B2: 123.47,
  C3: 130.81, Cs3: 138.59, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, Cs6: 1108.73, D6: 1174.66, E6: 1318.51,
};

const RAW_STYLE_SOUND_CATALOG: Record<SeasonalStyle, RawStyleSoundCatalogEntry> = {
  normal: {
    style: 'normal',
    label: 'Estilo Normal',
    description: 'Piano de fieltro íntimo, ambiente clínico sereno y guitarra acústica matinal',
    tracks: [
      {
        id: 'normal_gentle_ambient_piano',
        title: 'Gentle Ambient Piano',
        style: 'normal',
        bpm: 58,
        chords: [
          [N.C3, N.G3, N.D4, N.E4], // Cmaj9
          [N.A2, N.E3, N.B3, N.C4], // Am9
          [N.F3, N.C4, N.G4, N.A4], // Fmaj9
          [N.G3, N.D4, N.A4, N.B4], // G6/9
        ],
        melodyScale: [N.C4, N.D4, N.E4, N.G4, N.A4, N.B4, N.D5, N.E5],
        phraseA: [2, null, 3, null, 4, null, 3, null, 6, null, 4, null, 2, null, null, null],
        phraseB: [7, null, 6, null, 4, null, 5, null, 3, null, 2, null, 1, null, 0, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'felt_piano',
        accentInstrument: 'cello_strings',
        groove: 'ambient_free',
        textureType: 'clean',
        textureLevel: 0.018,
        natureAccent: 'none',
        reverbWet: 0.62,
        humanizeMs: 28,
        durationSec: 54,
      },
      {
        id: 'normal_soft_medical_technology_loop',
        title: 'Soft Medical Technology Loop',
        style: 'normal',
        bpm: 74,
        chords: [
          [N.D3, N.A3, N.E4, N.F4], // Dm9
          [N.Bb2, N.F3, N.C4, N.D4], // Bbmaj9
          [N.C3, N.G3, N.D4, N.E4], // C9sus4
          [N.A2, N.E3, N.B3, N.C4], // Am9
        ],
        melodyScale: [N.D4, N.F4, N.A4, N.C5, N.D5, N.E5, N.A5],
        phraseA: [0, null, 2, 3, null, 4, null, 2, 5, null, 4, null, 3, null, 2, null],
        phraseB: [4, 5, null, 6, null, 4, 3, null, 2, null, 3, 4, null, 1, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'marimba',
        groove: 'gentle_pulse',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.02,
        natureAccent: 'none',
        reverbWet: 0.54,
        humanizeMs: 14,
        durationSec: 50,
      },
      {
        id: 'normal_calm_acoustic_morning',
        title: 'Calm Acoustic Morning',
        style: 'normal',
        bpm: 68,
        chords: [
          [N.G3, N.D4, N.A4, N.B4], // Gmaj9
          [N.E3, N.B3, N.Fs4, N.G4], // Em9
          [N.C3, N.G3, N.D4, N.E4], // Cmaj9
          [N.D3, N.A3, N.E4, N.Fs4], // D9
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.Fs5, N.G5],
        phraseA: [0, 2, 3, null, 4, 3, 2, null, 1, 2, 3, null, 5, 4, 3, null],
        phraseB: [6, null, 5, 4, 3, null, 2, 3, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'harp',
        groove: 'ambient_free',
        textureType: 'forest_breeze',
        textureLevel: 0.028,
        natureAccent: 'birds',
        reverbWet: 0.56,
        humanizeMs: 22,
        durationSec: 52,
      },
    ],
  },

  dia_del_nino: {
    style: 'dia_del_nino',
    label: 'Día del Niño / Pediatría',
    description: 'Ukulele cálido orgánico, marimba de madera y celesta dulce de caja musical',
    tracks: [
      {
        id: 'nino_happy_ukulele_and_whistle',
        title: 'Happy Ukulele and Whistle',
        style: 'dia_del_nino',
        bpm: 94,
        chords: [
          [N.C4, N.E4, N.G4, N.A4],
          [N.G3, N.B3, N.D4, N.E4],
          [N.A3, N.C4, N.E4, N.G4],
          [N.F3, N.A3, N.C4, N.E4],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6],
        phraseA: [0, 2, 3, null, 4, 3, 2, null, 1, 2, 3, 4, null, 2, 0, null],
        phraseB: [5, null, 4, 3, 2, null, 3, 4, 3, 2, 1, null, 2, 0, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'ukulele',
        accentInstrument: 'celesta',
        groove: 'lofi_chill',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.45,
        humanizeMs: 16,
        durationSec: 46,
      },
      {
        id: 'nino_playground_fun',
        title: 'Playground Fun',
        style: 'dia_del_nino',
        bpm: 98,
        chords: [
          [N.G3, N.B3, N.D4, N.Fs4],
          [N.C4, N.E4, N.G4, N.B4],
          [N.E3, N.G3, N.B3, N.D4],
          [N.D4, N.Fs4, N.A4, N.C5],
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5],
        phraseA: [0, null, 2, 3, 4, null, 3, 2, 1, 2, null, 3, 5, null, 4, null],
        phraseB: [3, 4, 5, null, 4, 3, 2, null, 1, 3, 2, null, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'marimba',
        accentInstrument: 'ukulele',
        groove: 'gentle_pulse',
        textureType: 'forest_breeze',
        textureLevel: 0.02,
        natureAccent: 'birds',
        reverbWet: 0.44,
        humanizeMs: 15,
        durationSec: 46,
      },
      {
        id: 'nino_cheerful_kids_animation_loop',
        title: 'Cheerful Kids Animation Loop',
        style: 'dia_del_nino',
        bpm: 88,
        chords: [
          [N.F3, N.A3, N.C4, N.E4],
          [N.C4, N.E4, N.G4, N.B4],
          [N.D3, N.A3, N.C4, N.F4],
          [N.Bb3, N.D4, N.F4, N.A4],
        ],
        melodyScale: [N.F4, N.G4, N.A4, N.C5, N.D5, N.F5],
        phraseA: [0, 1, 2, null, 3, null, 4, 3, 2, 1, 2, null, 3, null, 5, null],
        phraseB: [4, 3, 2, null, 1, 2, 3, null, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'celesta',
        accentInstrument: 'felt_piano',
        groove: 'ballad_waltz',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.52,
        humanizeMs: 18,
        durationSec: 48,
      },
    ],
  },

  dia_del_medico: {
    style: 'dia_del_medico',
    label: 'Día del Médico / Clínico',
    description: 'Piano de concierto, cuerdas orquestales elegantes y ambiente científico sereno',
    tracks: [
      {
        id: 'medico_inspirational_corporate_piano_strings',
        title: 'Inspirational Corporate Piano & Strings',
        style: 'dia_del_medico',
        bpm: 72,
        chords: [
          [N.F3, N.C4, N.G4, N.A4], // Fmaj9
          [N.C3, N.G3, N.D4, N.E4], // Cmaj9
          [N.D3, N.A3, N.E4, N.F4], // Dm9
          [N.Bb2, N.F3, N.C4, N.D4], // Bbmaj9
        ],
        melodyScale: [N.F4, N.G4, N.A4, N.C5, N.D5, N.E5, N.F5],
        phraseA: [0, null, 2, 3, null, 4, 3, null, 2, null, 3, 5, null, 4, 3, null],
        phraseB: [6, null, 5, 4, null, 3, 2, null, 1, 2, 3, null, 4, null, 2, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'concert_piano',
        accentInstrument: 'harp',
        groove: 'gentle_pulse',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.6,
        humanizeMs: 20,
        durationSec: 54,
      },
      {
        id: 'medico_scientific_discovery_ambient',
        title: 'Scientific Discovery Ambient',
        style: 'dia_del_medico',
        bpm: 76,
        chords: [
          [N.A2, N.E3, N.B3, N.C4], // Am9
          [N.F3, N.C4, N.G4, N.A4], // Fmaj9
          [N.C3, N.G3, N.D4, N.E4], // Cmaj9
          [N.E3, N.B3, N.Fs4, N.G4], // Em9
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.E5, N.G5, N.A5],
        phraseA: [0, null, 2, null, 3, 4, null, 3, 2, null, 1, 2, null, 3, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 4, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'marimba',
        groove: 'ambient_free',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.022,
        natureAccent: 'none',
        reverbWet: 0.64,
        humanizeMs: 18,
        durationSec: 52,
      },
      {
        id: 'medico_the_doctors_theme',
        title: 'The Doctor’s Theme',
        style: 'dia_del_medico',
        bpm: 66,
        chords: [
          [N.D3, N.A3, N.E4, N.Fs4], // Dmaj9
          [N.B2, N.Fs3, N.Cs4, N.D4], // Bm9
          [N.G3, N.D4, N.A4, N.B4], // Gmaj9
          [N.A2, N.E3, N.B3, N.Cs4], // A9
        ],
        melodyScale: [N.D4, N.E4, N.Fs4, N.A4, N.B4, N.Cs5, N.D5],
        phraseA: [0, null, 2, null, 3, null, 4, 3, 2, null, 1, null, 2, 3, null, null],
        phraseB: [6, null, 5, null, 4, 3, null, 2, 3, null, 4, null, 2, 1, 0, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'felt_piano',
        accentInstrument: 'brass_warm',
        groove: 'ballad_waltz',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.65,
        humanizeMs: 26,
        durationSec: 56,
      },
    ],
  },

  carnaval: {
    style: 'carnaval',
    label: 'Carnaval',
    description: 'Bossa-samba relajante acústica, steel drums caribeños y guitarra brasileña',
    tracks: [
      {
        id: 'carnaval_tropical_samba_beat',
        title: 'Tropical Samba Beat',
        style: 'carnaval',
        bpm: 96,
        chords: [
          [N.A3, N.Cs4, N.E4, N.Ab4], // Amaj7
          [N.D3, N.Fs3, N.A3, N.Cs4], // Dmaj7
          [N.B2, N.Fs3, N.A3, N.D4], // Bm7
          [N.E3, N.Ab3, N.B3, N.D4], // E7
        ],
        melodyScale: [N.A4, N.B4, N.Cs5, N.E5, N.Fs5, N.A5],
        phraseA: [0, 2, null, 3, 4, null, 3, 2, 1, null, 2, 3, null, 4, 2, null],
        phraseB: [5, null, 4, 3, null, 2, 3, 4, 2, null, 1, 2, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'marimba',
        groove: 'bossa_samba',
        textureType: 'ocean_waves',
        textureLevel: 0.025,
        natureAccent: 'maracas',
        reverbWet: 0.46,
        humanizeMs: 14,
        durationSec: 48,
      },
      {
        id: 'carnaval_celebration_steel_drums',
        title: 'Carnival Celebration Steel Drums',
        style: 'carnaval',
        bpm: 94,
        chords: [
          [N.C4, N.E4, N.G4, N.B4],
          [N.F3, N.A3, N.C4, N.E4],
          [N.G3, N.B3, N.D4, N.F4],
          [N.C4, N.E4, N.G4, N.A4],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6],
        phraseA: [0, null, 2, 3, null, 4, 3, 2, 1, 2, null, 3, 4, null, 2, null],
        phraseB: [5, 4, null, 3, 2, null, 4, 3, 2, 1, null, 2, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'steel_drum',
        accentInstrument: 'ukulele',
        groove: 'bossa_samba',
        textureType: 'ocean_waves',
        textureLevel: 0.025,
        natureAccent: 'maracas',
        reverbWet: 0.48,
        humanizeMs: 12,
        durationSec: 48,
      },
      {
        id: 'carnaval_fiesta_brasileira_instrumental',
        title: 'Fiesta Brasileira Instrumental',
        style: 'carnaval',
        bpm: 90,
        chords: [
          [N.G3, N.B3, N.D4, N.Fs4], // Gmaj7
          [N.E3, N.G3, N.B3, N.D4], // Em7
          [N.A3, N.C4, N.E4, N.G4], // Am7
          [N.D3, N.A3, N.C4, N.Fs4], // D9
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5],
        phraseA: [2, 3, null, 4, 3, 2, null, 1, 0, null, 2, 3, 4, null, 3, null],
        phraseB: [5, null, 4, 2, 3, null, 1, 2, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'rhodes',
        accentInstrument: 'acoustic_guitar',
        groove: 'bossa_samba',
        textureType: 'clean',
        textureLevel: 0.018,
        natureAccent: 'maracas',
        reverbWet: 0.5,
        humanizeMs: 16,
        durationSec: 50,
      },
    ],
  },

  ano_nuevo: {
    style: 'ano_nuevo',
    label: 'Año Nuevo',
    description: 'Orquesta brillante de gala, lounge cálido de medianoche y sintetizador dorado',
    tracks: [
      {
        id: 'ano_nuevo_sparkle_orchestral',
        title: 'New Year Sparkle Orchestral',
        style: 'ano_nuevo',
        bpm: 78,
        chords: [
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.B2, N.Fs3, N.Cs4, N.D4],
          [N.A2, N.E3, N.B3, N.Cs4],
        ],
        melodyScale: [N.D5, N.E5, N.Fs5, N.A5, N.B5, N.D6],
        phraseA: [0, null, 2, 3, null, 4, 5, null, 4, 3, null, 2, 1, null, 3, null],
        phraseB: [5, null, 4, null, 3, 2, null, 4, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'concert_piano',
        accentInstrument: 'celesta',
        groove: 'ballad_waltz',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.022,
        natureAccent: 'none',
        reverbWet: 0.64,
        humanizeMs: 20,
        durationSec: 52,
      },
      {
        id: 'ano_nuevo_midnight_celebration_electronic_lounge',
        title: 'Midnight Celebration Electronic Lounge',
        style: 'ano_nuevo',
        bpm: 84,
        chords: [
          [N.E3, N.B3, N.Fs4, N.G4], // Em9
          [N.C3, N.G3, N.D4, N.E4], // Cmaj9
          [N.A2, N.E3, N.B3, N.C4], // Am9
          [N.B2, N.Fs3, N.A3, N.D4], // Bm7
        ],
        melodyScale: [N.E4, N.Fs4, N.G4, N.B4, N.D5, N.E5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 3, 4, 5, null, 3, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'harp',
        groove: 'lofi_chill',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.024,
        natureAccent: 'none',
        reverbWet: 0.58,
        humanizeMs: 15,
        durationSec: 50,
      },
      {
        id: 'ano_nuevo_golden_hour_ambient_synth',
        title: 'Golden Hour Ambient Synth',
        style: 'ano_nuevo',
        bpm: 64,
        chords: [
          [N.F3, N.C4, N.G4, N.A4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.A2, N.E3, N.B3, N.C4],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5, N.B5],
        phraseA: [0, null, null, 2, null, 3, null, 4, null, 3, null, 2, null, 1, null, null],
        phraseB: [5, null, 4, null, 3, null, 2, null, 4, null, 3, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'brass_warm',
        accentInstrument: 'felt_piano',
        groove: 'ambient_free',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.025,
        natureAccent: 'none',
        reverbWet: 0.7,
        humanizeMs: 28,
        durationSec: 54,
      },
    ],
  },

  guardia_nocturna: {
    style: 'guardia_nocturna',
    label: 'Guardia Nocturna',
    description: 'Lo-Fi nocturno aterciopelado, espacio profundo silencioso y jazz de madrugada',
    tracks: [
      {
        id: 'guardia_midnight_lofi_chill_beats',
        title: 'Midnight Lo-Fi Chill Beats',
        style: 'guardia_nocturna',
        bpm: 64,
        chords: [
          [N.D3, N.A3, N.C4, N.F4], // Dm7
          [N.G2, N.D3, N.F3, N.Bb3], // Gm7
          [N.C3, N.G3, N.B3, N.E4], // Cmaj7
          [N.A2, N.E3, N.G3, N.C4], // Am7
        ],
        melodyScale: [N.D4, N.F4, N.G4, N.A4, N.C5, N.D5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, null, 0, null, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 1, null, 0, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'felt_piano',
        groove: 'lofi_chill',
        textureType: 'vinyl_lofi',
        textureLevel: 0.032,
        natureAccent: 'none',
        reverbWet: 0.58,
        humanizeMs: 22,
        durationSec: 56,
      },
      {
        id: 'guardia_deep_space_night_ambiance',
        title: 'Deep Space Night Ambiance',
        style: 'guardia_nocturna',
        bpm: 52,
        chords: [
          [N.A2, N.E3, N.B3, N.C4],
          [N.F3, N.C4, N.G4, N.A4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.E3, N.B3, N.Fs4, N.G4],
        ],
        melodyScale: [N.A4, N.C5, N.D5, N.E5, N.G5],
        phraseA: [0, null, null, null, 2, null, null, 3, null, null, 4, null, 3, null, null, null],
        phraseB: [4, null, null, 2, null, null, 1, null, null, 2, null, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'felt_piano',
        accentInstrument: 'cello_strings',
        groove: 'ambient_free',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.035,
        natureAccent: 'none',
        reverbWet: 0.76,
        humanizeMs: 34,
        durationSec: 60,
      },
      {
        id: 'guardia_night_shift_coffee_shop_jazz',
        title: 'Night Shift Coffee Shop Jazz',
        style: 'guardia_nocturna',
        bpm: 68,
        chords: [
          [N.C3, N.G3, N.B3, N.E4], // Cmaj7
          [N.A2, N.E3, N.G3, N.C4], // Am7
          [N.D3, N.A3, N.C4, N.F4], // Dm7
          [N.G2, N.D3, N.F3, N.B3], // G9
        ],
        melodyScale: [N.E4, N.G4, N.A4, N.B4, N.D5, N.E5],
        phraseA: [0, 1, null, 2, 3, null, 4, 3, 2, null, 1, 2, null, 0, null, null],
        phraseB: [5, null, 4, 3, null, 2, 1, null, 2, 3, null, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'rhodes',
        accentInstrument: 'acoustic_guitar',
        groove: 'lofi_chill',
        textureType: 'vinyl_lofi',
        textureLevel: 0.03,
        natureAccent: 'none',
        reverbWet: 0.55,
        humanizeMs: 24,
        durationSec: 54,
      },
    ],
  },

  primavera: {
    style: 'primavera',
    label: 'Primavera / Calma',
    description: 'Guitarra acústica entre aves del bosque, arpa de pradera y lo-fi natural',
    tracks: [
      {
        id: 'primavera_spring_forest_birds_acoustic_guitar',
        title: 'Spring Forest Birds & Acoustic Guitar',
        style: 'primavera',
        bpm: 74,
        chords: [
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.B2, N.Fs3, N.D4, N.E4],
          [N.A2, N.E3, N.Cs4, N.E4],
        ],
        melodyScale: [N.D4, N.E4, N.Fs4, N.A4, N.B4, N.D5, N.Fs5],
        phraseA: [0, 2, 3, null, 4, 3, 2, null, 1, 2, 3, null, 5, 4, 3, null],
        phraseB: [6, null, 5, 4, 3, null, 2, 3, 4, null, 3, 2, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'harp',
        groove: 'ambient_free',
        textureType: 'forest_breeze',
        textureLevel: 0.036,
        natureAccent: 'birds',
        reverbWet: 0.58,
        humanizeMs: 22,
        durationSec: 52,
      },
      {
        id: 'primavera_peaceful_meadow_ambient',
        title: 'Peaceful Meadow Ambient',
        style: 'primavera',
        bpm: 60,
        chords: [
          [N.G3, N.D4, N.A4, N.B4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.D3, N.A3, N.E4, N.Fs4],
        ],
        melodyScale: [N.G4, N.B4, N.D5, N.E5, N.Fs5, N.G5],
        phraseA: [0, null, 1, null, 2, null, 3, null, 4, null, 3, null, 2, null, null, null],
        phraseB: [5, null, 4, null, 3, null, 2, null, 1, null, 2, null, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'harp',
        accentInstrument: 'felt_piano',
        groove: 'ambient_free',
        textureType: 'forest_breeze',
        textureLevel: 0.04,
        natureAccent: 'birds',
        reverbWet: 0.66,
        humanizeMs: 30,
        durationSec: 56,
      },
      {
        id: 'primavera_menta_y_flores_lofi_nature',
        title: 'Menta y Flores (Lo-Fi Nature)',
        style: 'primavera',
        bpm: 72,
        chords: [
          [N.C3, N.G3, N.B3, N.E4],
          [N.F3, N.C4, N.E4, N.A4],
          [N.D3, N.A3, N.C4, N.F4],
          [N.G2, N.D3, N.F3, N.B3],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5],
        phraseA: [0, null, 2, 3, null, 4, 3, null, 2, 1, null, 2, 3, null, 1, null],
        phraseB: [4, null, 3, 2, null, 1, 2, null, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'ukulele',
        groove: 'lofi_chill',
        textureType: 'forest_breeze',
        textureLevel: 0.032,
        natureAccent: 'birds',
        reverbWet: 0.54,
        humanizeMs: 18,
        durationSec: 50,
      },
    ],
  },

  espacio: {
    style: 'espacio',
    label: 'Espacio / Galaxia',
    description: 'Drones cósmicos envolventes, piano interestelar en reverberación infinita y viaje espacial',
    tracks: [
      {
        id: 'espacio_deep_space_ambient_drone',
        title: 'Deep Space Ambient Drone',
        style: 'espacio',
        bpm: 48,
        chords: [
          [N.A2, N.E3, N.A3, N.E4],
          [N.D3, N.A3, N.E4, N.F4],
          [N.E3, N.B3, N.E4, N.B4],
          [N.C3, N.G3, N.D4, N.E4],
        ],
        melodyScale: [N.E4, N.A4, N.B4, N.C5, N.E5, N.A5],
        phraseA: [0, null, null, null, 2, null, null, null, 4, null, null, 3, null, null, null, null],
        phraseB: [5, null, null, null, 4, null, null, null, 2, null, null, 1, null, null, 0, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'cello_strings',
        accentInstrument: 'celesta',
        groove: 'ambient_free',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.045,
        natureAccent: 'none',
        reverbWet: 0.8,
        humanizeMs: 38,
        durationSec: 60,
      },
      {
        id: 'espacio_interstellar_piano_space_echo',
        title: 'Interstellar Piano & Space Echo',
        style: 'espacio',
        bpm: 62,
        chords: [
          [N.A2, N.E3, N.C4, N.E4],
          [N.F3, N.C4, N.A4, N.C5],
          [N.G3, N.D4, N.B4, N.D5],
          [N.E3, N.B3, N.G4, N.B4],
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.E5, N.G5, N.A5],
        phraseA: [0, null, 3, null, 2, null, 3, null, 1, null, 3, null, 5, null, 3, null],
        phraseB: [4, null, 3, null, 2, null, 3, null, 0, null, 2, null, 4, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'concert_piano',
        accentInstrument: 'harp',
        groove: 'ambient_free',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.036,
        natureAccent: 'none',
        reverbWet: 0.78,
        humanizeMs: 26,
        durationSec: 56,
      },
      {
        id: 'espacio_cosmic_voyage_electronic',
        title: 'Cosmic Voyage Electronic',
        style: 'espacio',
        bpm: 78,
        chords: [
          [N.C3, N.G3, N.D4, N.Eb4], // Cm9
          [N.Ab2, N.Eb3, N.Bb3, N.C4], // Abmaj9
          [N.F3, N.C4, N.G4, N.Ab4], // Fm9
          [N.G3, N.D4, N.G4, N.Bb4], // Gm7
        ],
        melodyScale: [N.C5, N.D5, N.Eb5, N.G5, N.Bb5, N.C6],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, 3, null, 4, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 4, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'celesta',
        groove: 'gentle_pulse',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.038,
        natureAccent: 'none',
        reverbWet: 0.72,
        humanizeMs: 16,
        durationSec: 52,
      },
    ],
  },

  fondo_marino: {
    style: 'fondo_marino',
    label: 'Fondo Marino',
    description: 'Olas oceánicas reales en estéreo, arrecife con arpa y calma submarina',
    tracks: [
      {
        id: 'marino_deep_blue_ocean_underwater_ambiance',
        title: 'Deep Blue Ocean Underwater Ambiance',
        style: 'fondo_marino',
        bpm: 54,
        chords: [
          [N.D3, N.A3, N.E4, N.F4],
          [N.Bb2, N.F3, N.C4, N.D4],
          [N.G3, N.D4, N.A4, N.Bb4],
          [N.A2, N.E3, N.C4, N.E4],
        ],
        melodyScale: [N.D4, N.F4, N.A4, N.C5, N.D5, N.F5],
        phraseA: [0, null, null, 2, null, 3, null, null, 4, null, 3, null, 2, null, null, null],
        phraseB: [5, null, null, 4, null, 2, null, null, 3, null, 1, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'marimba',
        accentInstrument: 'cello_strings',
        groove: 'ambient_free',
        textureType: 'ocean_waves',
        textureLevel: 0.14,
        natureAccent: 'none',
        reverbWet: 0.72,
        humanizeMs: 32,
        durationSec: 58,
      },
      {
        id: 'marino_coral_reef_relaxing_waves',
        title: 'Coral Reef Relaxing Waves',
        style: 'fondo_marino',
        bpm: 66,
        chords: [
          [N.F3, N.C4, N.G4, N.A4],
          [N.D3, N.A3, N.E4, N.F4],
          [N.Bb2, N.F3, N.C4, N.D4],
          [N.C3, N.G3, N.D4, N.E4],
        ],
        melodyScale: [N.F4, N.G4, N.A4, N.C5, N.D5, N.F5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, 2, null, 3, null, null],
        phraseB: [5, null, 4, 3, null, 2, 3, null, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'harp',
        accentInstrument: 'celesta',
        groove: 'ambient_free',
        textureType: 'ocean_waves',
        textureLevel: 0.12,
        natureAccent: 'none',
        reverbWet: 0.66,
        humanizeMs: 24,
        durationSec: 54,
      },
      {
        id: 'marino_submarine_ambient_chill',
        title: 'Submarine Ambient Chill',
        style: 'fondo_marino',
        bpm: 70,
        chords: [
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.A2, N.E3, N.B3, N.C4],
          [N.B2, N.Fs3, N.A3, N.D4],
        ],
        melodyScale: [N.E4, N.Fs4, N.G4, N.B4, N.D5, N.E5],
        phraseA: [0, null, 1, 2, null, 3, null, 4, 3, null, 2, 1, null, 0, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 1, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'rhodes',
        accentInstrument: 'felt_piano',
        groove: 'lofi_chill',
        textureType: 'ocean_waves',
        textureLevel: 0.11,
        natureAccent: 'none',
        reverbWet: 0.64,
        humanizeMs: 20,
        durationSec: 54,
      },
    ],
  },

  pequenos_heroes: {
    style: 'pequenos_heroes',
    label: 'Pequeños Héroes',
    description: 'Cuerdas cinematográficas cálidas, marimba aventurera y metales suaves sin 8-bits',
    tracks: [
      {
        id: 'heroes_epic_cinematic_mini_hero_theme',
        title: 'Epic Cinematic Mini-Hero Theme',
        style: 'pequenos_heroes',
        bpm: 84,
        chords: [
          [N.C3, N.G3, N.D4, N.E4],
          [N.G2, N.D3, N.A3, N.B3],
          [N.F3, N.C4, N.G4, N.A4],
          [N.G3, N.D4, N.A4, N.B4],
        ],
        melodyScale: [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5],
        phraseA: [0, null, 2, 3, null, 5, null, 4, 3, null, 2, 1, 2, null, 3, null],
        phraseB: [5, null, 4, 3, 2, null, 3, 4, 5, null, 3, 2, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'brass_warm',
        accentInstrument: 'concert_piano',
        groove: 'gentle_pulse',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.58,
        humanizeMs: 18,
        durationSec: 50,
      },
      {
        id: 'heroes_courageous_chiptune_adventure',
        title: 'Courageous Chiptune Adventure',
        style: 'pequenos_heroes',
        bpm: 92,
        chords: [
          [N.A2, N.E3, N.B3, N.C4],
          [N.F3, N.C4, N.G4, N.A4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.G2, N.D3, N.A3, N.B3],
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.D5, N.E5, N.G5, N.A5],
        phraseA: [0, 2, null, 4, 5, null, 4, 2, 3, 4, null, 5, 6, null, 4, null],
        phraseB: [6, null, 5, 4, 3, null, 2, 3, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'marimba',
        accentInstrument: 'celesta',
        groove: 'lofi_chill',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.48,
        humanizeMs: 14,
        durationSec: 48,
      },
      {
        id: 'heroes_triumphant_brass_strings_for_kids',
        title: 'Triumphant Brass & Strings for Kids',
        style: 'pequenos_heroes',
        bpm: 80,
        chords: [
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.A2, N.E3, N.B3, N.Cs4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.A2, N.E3, N.Cs4, N.E4],
        ],
        melodyScale: [N.D4, N.E4, N.Fs4, N.A4, N.B4, N.D5],
        phraseA: [0, null, 1, 2, 3, null, 4, 3, 2, null, 3, 4, 5, null, 3, null],
        phraseB: [5, null, 4, 3, null, 2, 1, 2, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'concert_piano',
        accentInstrument: 'brass_warm',
        groove: 'ballad_waltz',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.6,
        humanizeMs: 20,
        durationSec: 50,
      },
    ],
  },

  amor_amistad: {
    style: 'amor_amistad',
    label: 'Amor y Amistad',
    description: 'Dúo de guitarra acústica y chelo, lo-fi dulce y balada cálida de piano',
    tracks: [
      {
        id: 'amor_romantic_acoustic_guitar_cello',
        title: 'Romantic Acoustic Guitar & Cello',
        style: 'amor_amistad',
        bpm: 64,
        chords: [
          [N.C3, N.G3, N.B3, N.E4],
          [N.G2, N.D3, N.A3, N.B3],
          [N.A2, N.E3, N.B3, N.C4],
          [N.F3, N.C4, N.G4, N.A4],
        ],
        melodyScale: [N.E4, N.G4, N.A4, N.B4, N.C5, N.E5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, null, 0, null, null, null],
        phraseB: [5, null, 4, 3, null, 2, 1, null, 2, 3, null, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'harp',
        groove: 'ambient_free',
        textureType: 'clean',
        textureLevel: 0.016,
        natureAccent: 'none',
        reverbWet: 0.62,
        humanizeMs: 26,
        durationSec: 54,
      },
      {
        id: 'amor_sweet_valentine_lofi',
        title: 'Sweet Valentine Lo-Fi',
        style: 'amor_amistad',
        bpm: 70,
        chords: [
          [N.F3, N.C4, N.E4, N.A4],
          [N.G3, N.D4, N.F4, N.B4],
          [N.E3, N.B3, N.D4, N.G4],
          [N.A2, N.E3, N.G3, N.C4],
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.E5, N.G5],
        phraseA: [0, null, 2, 3, null, 4, 3, null, 2, null, 1, 2, null, 0, null, null],
        phraseB: [4, null, 3, 2, null, 3, 1, null, 2, null, 1, 0, null, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'felt_piano',
        groove: 'lofi_chill',
        textureType: 'vinyl_lofi',
        textureLevel: 0.028,
        natureAccent: 'none',
        reverbWet: 0.56,
        humanizeMs: 20,
        durationSec: 52,
      },
      {
        id: 'amor_heartfelt_piano_ballad',
        title: 'Heartfelt Piano Ballad',
        style: 'amor_amistad',
        bpm: 62,
        chords: [
          [N.G3, N.D4, N.A4, N.B4],
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.D3, N.A3, N.E4, N.Fs4],
        ],
        melodyScale: [N.B4, N.D5, N.E5, N.Fs5, N.G5, N.A5],
        phraseA: [0, null, 1, null, 2, 3, null, 2, 1, null, 0, null, 1, 2, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 1, null, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'concert_piano',
        accentInstrument: 'felt_piano',
        groove: 'ballad_waltz',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.65,
        humanizeMs: 28,
        durationSec: 54,
      },
    ],
  },

  otono: {
    style: 'otono',
    label: 'Otoño / Café',
    description: 'Jazz cálido de cafetería bajo la lluvia, guitarra otoñal y lo-fi moka junto al fuego',
    tracks: [
      {
        id: 'otono_warm_coffee_shop_jazz_rain',
        title: 'Warm Coffee Shop Jazz & Rain',
        style: 'otono',
        bpm: 68,
        chords: [
          [N.G3, N.D4, N.Fs4, N.B4],
          [N.E3, N.B3, N.D4, N.G4],
          [N.A2, N.E3, N.G3, N.C4],
          [N.D3, N.A3, N.C4, N.Fs4],
        ],
        melodyScale: [N.B4, N.D5, N.E5, N.Fs5, N.A5],
        phraseA: [0, 1, null, 2, 3, null, 4, 3, 2, null, 1, 2, null, 0, null, null],
        phraseB: [4, null, 3, 2, null, 1, 0, null, 1, 2, null, 3, 1, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'rhodes',
        accentInstrument: 'acoustic_guitar',
        groove: 'lofi_chill',
        textureType: 'rain_soft',
        textureLevel: 0.085,
        natureAccent: 'none',
        reverbWet: 0.54,
        humanizeMs: 24,
        durationSec: 56,
      },
      {
        id: 'otono_autumn_acoustic_fingerstyle',
        title: 'Autumn Acoustic Fingerstyle',
        style: 'otono',
        bpm: 72,
        chords: [
          [N.A2, N.E3, N.B3, N.C4],
          [N.G2, N.D3, N.A3, N.B3],
          [N.F3, N.C4, N.G4, N.A4],
          [N.E3, N.B3, N.Fs4, N.G4],
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.E5, N.G5],
        phraseA: [0, 2, 3, null, 4, 3, 2, null, 1, 2, 3, null, 2, 1, 0, null],
        phraseB: [4, null, 3, 2, 1, null, 2, 3, 2, null, 1, 0, null, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'felt_piano',
        groove: 'ambient_free',
        textureType: 'fireplace',
        textureLevel: 0.065,
        natureAccent: 'none',
        reverbWet: 0.56,
        humanizeMs: 22,
        durationSec: 52,
      },
      {
        id: 'otono_cinnamon_moka_lofi_beats',
        title: 'Cinnamon & Moka Lo-Fi Beats',
        style: 'otono',
        bpm: 66,
        chords: [
          [N.D3, N.A3, N.C4, N.F4],
          [N.G2, N.D3, N.F3, N.Bb3],
          [N.C3, N.G3, N.B3, N.E4],
          [N.A2, N.E3, N.G3, N.C4],
        ],
        melodyScale: [N.D4, N.F4, N.G4, N.A4, N.C5, N.D5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, null, 2, 0, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'marimba',
        groove: 'lofi_chill',
        textureType: 'vinyl_lofi',
        textureLevel: 0.04,
        natureAccent: 'none',
        reverbWet: 0.55,
        humanizeMs: 20,
        durationSec: 54,
      },
    ],
  },

  lluvia_relajante: {
    style: 'lluvia_relajante',
    label: 'Lluvia Relajante',
    description: 'Lluvia suave estéreo con piano íntimo, tormenta lejana para descanso y gotas lo-fi',
    tracks: [
      {
        id: 'lluvia_gentle_rain_soft_piano',
        title: 'Gentle Rain & Soft Piano',
        style: 'lluvia_relajante',
        bpm: 56,
        chords: [
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.A2, N.E3, N.B3, N.C4],
          [N.B2, N.Fs3, N.A3, N.D4],
        ],
        melodyScale: [N.E4, N.Fs4, N.G4, N.B4, N.D5, N.E5],
        phraseA: [0, null, 2, null, 3, null, 4, null, 3, null, 2, null, 1, null, null, null],
        phraseB: [5, null, 4, null, 3, null, 2, null, 1, null, 2, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'felt_piano',
        accentInstrument: 'cello_strings',
        groove: 'ambient_free',
        textureType: 'rain_soft',
        textureLevel: 0.14,
        natureAccent: 'none',
        reverbWet: 0.68,
        humanizeMs: 32,
        durationSec: 58,
      },
      {
        id: 'lluvia_thunderstorm_ambient_sleep_sound',
        title: 'Thunderstorm Ambient Sleep Sound',
        style: 'lluvia_relajante',
        bpm: 48,
        chords: [
          [N.A2, N.E3, N.B3, N.C4],
          [N.F3, N.C4, N.G4, N.A4],
          [N.D3, N.A3, N.E4, N.F4],
          [N.E3, N.B3, N.E4, N.G4],
        ],
        melodyScale: [N.A4, N.C5, N.D5, N.E5, N.G5],
        phraseA: [0, null, null, null, 2, null, null, null, 3, null, null, 2, null, null, null, null],
        phraseB: [4, null, null, null, 3, null, null, 1, null, null, 2, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'cello_strings',
        accentInstrument: 'felt_piano',
        groove: 'ambient_free',
        textureType: 'thunderstorm',
        textureLevel: 0.17,
        natureAccent: 'thunder_roll',
        reverbWet: 0.74,
        humanizeMs: 36,
        durationSec: 60,
      },
      {
        id: 'lluvia_raindrops_on_window_lofi',
        title: 'Raindrops on Window Lo-Fi',
        style: 'lluvia_relajante',
        bpm: 64,
        chords: [
          [N.C3, N.G3, N.B3, N.E4],
          [N.A2, N.E3, N.G3, N.C4],
          [N.F3, N.C4, N.E4, N.A4],
          [N.G2, N.D3, N.F3, N.B3],
        ],
        melodyScale: [N.G4, N.A4, N.C5, N.D5, N.E5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, null, 0, null, null, null],
        phraseB: [4, null, 3, null, 2, 1, null, 2, 3, null, 1, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'celesta',
        groove: 'lofi_chill',
        textureType: 'rain_soft',
        textureLevel: 0.13,
        natureAccent: 'none',
        reverbWet: 0.6,
        humanizeMs: 22,
        durationSec: 56,
      },
    ],
  },

  fiestas_patrias: {
    style: 'fiestas_patrias',
    label: 'Fiestas Patrias (Venezuela)',
    description: 'Arpa llanera, cuatro venezolano y maracas elegantes, Ávila acústico y merengue suave',
    tracks: [
      {
        id: 'patrias_arpa_cuatro_maracas_instrumental',
        title: 'Arpa, Cuatro y Maracas (Instrumental Elegante)',
        style: 'fiestas_patrias',
        bpm: 94,
        chords: [
          [N.A3, N.Cs4, N.E4, N.A4],
          [N.D3, N.Fs3, N.A3, N.D4],
          [N.E3, N.Ab3, N.B3, N.E4],
          [N.A3, N.Cs4, N.E4, N.Fs4],
        ],
        melodyScale: [N.A4, N.B4, N.Cs5, N.E5, N.Fs5, N.A5, N.Cs6],
        phraseA: [0, 2, 3, 4, 5, null, 4, 3, 2, 3, 4, null, 3, 2, 1, null],
        phraseB: [6, null, 5, 4, 3, null, 4, 5, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cuatro',
        leadInstrument: 'harp',
        accentInstrument: 'acoustic_guitar',
        groove: 'joropo_waltz',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'maracas',
        reverbWet: 0.52,
        humanizeMs: 14,
        durationSec: 50,
      },
      {
        id: 'patrias_el_avila_en_acustico',
        title: 'El Ávila en Acústico',
        style: 'fiestas_patrias',
        bpm: 76,
        chords: [
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.B2, N.Fs3, N.Cs4, N.D4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.A2, N.E3, N.B3, N.Cs4],
        ],
        melodyScale: [N.D4, N.E4, N.Fs4, N.A4, N.B4, N.D5],
        phraseA: [0, null, 2, 3, null, 4, 3, null, 2, 1, null, 2, 3, null, 2, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'harp',
        groove: 'ballad_waltz',
        textureType: 'forest_breeze',
        textureLevel: 0.028,
        natureAccent: 'birds',
        reverbWet: 0.6,
        humanizeMs: 24,
        durationSec: 54,
      },
      {
        id: 'patrias_merengue_venezolano_instrumental_suave',
        title: 'Merengue Venezolano Instrumental (Suave)',
        style: 'fiestas_patrias',
        bpm: 90,
        chords: [
          [N.G3, N.B3, N.D4, N.Fs4],
          [N.C3, N.G3, N.B3, N.E4],
          [N.A2, N.E3, N.G3, N.C4],
          [N.D3, N.A3, N.C4, N.Fs4],
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5],
        phraseA: [0, 2, null, 3, 4, null, 3, 2, 1, null, 2, 3, 4, null, 2, null],
        phraseB: [5, null, 4, 3, null, 2, 1, 2, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cuatro',
        leadInstrument: 'acoustic_guitar',
        accentInstrument: 'marimba',
        groove: 'merengue_suave',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'maracas',
        reverbWet: 0.5,
        humanizeMs: 16,
        durationSec: 48,
      },
    ],
  },

  equipo_salud: {
    style: 'equipo_salud',
    label: 'Equipo de Salud',
    description: 'Ambiente hospitalario inspirador, piano y cuerdas de confianza clínica',
    tracks: [
      {
        id: 'salud_hospital_health_corporate_ambient',
        title: 'Hospital & Health Corporate Ambient',
        style: 'equipo_salud',
        bpm: 76,
        chords: [
          [N.G3, N.D4, N.A4, N.B4],
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.C3, N.G3, N.D4, N.E4],
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, 2, null, 3, null, null],
        phraseB: [5, null, 4, null, 3, 2, null, 4, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'concert_piano',
        accentInstrument: 'marimba',
        groove: 'gentle_pulse',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.58,
        humanizeMs: 18,
        durationSec: 52,
      },
      {
        id: 'salud_clinical_trust_and_care',
        title: 'Clinical Trust & Care',
        style: 'equipo_salud',
        bpm: 66,
        chords: [
          [N.C3, N.G3, N.D4, N.E4],
          [N.F3, N.C4, N.G4, N.A4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.A2, N.E3, N.B3, N.C4],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5],
        phraseA: [0, null, 2, null, 3, 4, null, 3, 2, null, 1, null, 2, 0, null, null],
        phraseB: [4, null, 3, null, 2, 1, null, 2, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'felt_piano',
        accentInstrument: 'harp',
        groove: 'ambient_free',
        textureType: 'clean',
        textureLevel: 0.015,
        natureAccent: 'none',
        reverbWet: 0.64,
        humanizeMs: 26,
        durationSec: 54,
      },
      {
        id: 'salud_calm_science_medical_beat',
        title: 'Calm Science & Medical Beat',
        style: 'equipo_salud',
        bpm: 80,
        chords: [
          [N.E3, N.B3, N.Fs4, N.G4],
          [N.A2, N.E3, N.B3, N.C4],
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.G3, N.D4, N.A4, N.B4],
        ],
        melodyScale: [N.E4, N.Fs4, N.G4, N.B4, N.D5, N.E5],
        phraseA: [0, null, 1, 2, null, 3, 4, null, 3, 2, null, 1, 2, null, 0, null],
        phraseB: [5, null, 4, null, 3, 2, null, 1, 2, null, 3, null, 1, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'celesta',
        groove: 'gentle_pulse',
        textureType: 'cosmic_shimmer',
        textureLevel: 0.02,
        natureAccent: 'none',
        reverbWet: 0.56,
        humanizeMs: 15,
        durationSec: 50,
      },
    ],
  },

  navidad: {
    style: 'navidad',
    label: 'Estilo Navidad',
    description: 'Chimenea navideña con celesta, Jingle Bells Lo-Fi acogedor y piano clásico con cascabeles',
    tracks: [
      {
        id: 'navidad_cozy_christmas_fireplace_chimes',
        title: 'Cozy Christmas Fireplace & Chimes',
        style: 'navidad',
        bpm: 66,
        chords: [
          [N.C3, N.G3, N.D4, N.E4],
          [N.F3, N.C4, N.G4, N.A4],
          [N.G3, N.D4, N.A4, N.B4],
          [N.C3, N.G3, N.B3, N.E4],
        ],
        melodyScale: [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6],
        phraseA: [0, null, 2, 3, null, 5, null, 4, 3, null, 2, null, 1, 2, 0, null],
        phraseB: [5, null, 4, null, 3, 2, null, 3, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'felt_piano',
        accentInstrument: 'celesta',
        groove: 'ambient_free',
        textureType: 'fireplace',
        textureLevel: 0.075,
        natureAccent: 'sleigh_bells',
        reverbWet: 0.64,
        humanizeMs: 24,
        durationSec: 54,
      },
      {
        id: 'navidad_jingle_bells_lofi_instrumental',
        title: 'Jingle Bells Lo-Fi Instrumental',
        style: 'navidad',
        bpm: 76,
        chords: [
          [N.C3, N.G3, N.B3, N.E4],
          [N.F3, N.C4, N.E4, N.A4],
          [N.D3, N.A3, N.C4, N.F4],
          [N.G2, N.D3, N.F3, N.B3],
        ],
        // Gentle soothing Jingle Bells lo-fi motif in Rhodes
        melodyScale: [N.C5, N.D5, N.E5, N.F5, N.G5, N.A5],
        phraseA: [2, null, 2, null, 2, null, null, 2, 4, 0, 1, null, 2, null, null, null],
        phraseB: [3, null, 3, 3, 3, 2, 2, null, 2, 1, 1, 2, 1, null, 4, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'rhodes',
        accentInstrument: 'celesta',
        groove: 'lofi_chill',
        textureType: 'vinyl_lofi',
        textureLevel: 0.032,
        natureAccent: 'sleigh_bells',
        reverbWet: 0.56,
        humanizeMs: 18,
        durationSec: 50,
      },
      {
        id: 'navidad_classic_holiday_piano_sleigh_bells',
        title: 'Classic Holiday Piano & Sleigh Bells',
        style: 'navidad',
        bpm: 72,
        chords: [
          [N.G3, N.D4, N.A4, N.B4],
          [N.C3, N.G3, N.D4, N.E4],
          [N.D3, N.A3, N.E4, N.Fs4],
          [N.G3, N.D4, N.G4, N.B4],
        ],
        melodyScale: [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5],
        phraseA: [0, null, 2, 3, null, 4, null, 3, 2, null, 1, 2, null, 0, null, null],
        phraseB: [5, null, 4, 3, null, 2, 1, 2, 3, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'concert_piano',
        accentInstrument: 'harp',
        groove: 'ballad_waltz',
        textureType: 'clean',
        textureLevel: 0.018,
        natureAccent: 'sleigh_bells',
        reverbWet: 0.62,
        humanizeMs: 22,
        durationSec: 52,
      },
    ],
  },

  halloween: {
    style: 'halloween',
    label: 'Estilo Halloween',
    description: 'Sintetizador misterioso cinematográfico, vals de piano encantado y viento nocturno',
    tracks: [
      {
        id: 'halloween_spooky_mystery_ambient_synth',
        title: 'Spooky Mystery Ambient Synth',
        style: 'halloween',
        bpm: 58,
        chords: [
          [N.A2, N.E3, N.B3, N.C4],
          [N.F3, N.C4, N.Ab4, N.C5],
          [N.D3, N.A3, N.E4, N.F4],
          [N.E3, N.B3, N.Ab4, N.B4],
        ],
        melodyScale: [N.A4, N.B4, N.C5, N.E5, N.F5, N.Ab5],
        phraseA: [0, null, 2, null, 4, null, 3, null, 5, null, 3, null, 2, null, null, null],
        phraseB: [4, null, 3, null, 2, null, 1, null, 3, null, 2, null, 0, null, null, null],
        padInstrument: 'warm_pad',
        leadInstrument: 'celesta',
        accentInstrument: 'cello_strings',
        groove: 'ambient_free',
        textureType: 'forest_breeze',
        textureLevel: 0.07,
        natureAccent: 'owls_wind',
        reverbWet: 0.74,
        humanizeMs: 30,
        durationSec: 54,
      },
      {
        id: 'halloween_haunted_house_piano_waltz',
        title: 'Haunted House Piano Waltz',
        style: 'halloween',
        bpm: 78,
        chords: [
          [N.D3, N.A3, N.F4],
          [N.Bb2, N.F3, N.D4],
          [N.G2, N.D3, N.Bb3],
          [N.A2, N.E3, N.Cs4],
        ],
        melodyScale: [N.D4, N.E4, N.F4, N.A4, N.Bb4, N.Cs5, N.D5],
        phraseA: [0, null, 2, 3, null, 4, 3, null, 2, 1, null, 2, 5, null, 3, null],
        phraseB: [6, null, 5, 4, 3, null, 2, 3, 4, null, 2, 1, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'felt_piano',
        accentInstrument: 'harp',
        groove: 'ballad_waltz',
        textureType: 'vinyl_lofi',
        textureLevel: 0.04,
        natureAccent: 'none',
        reverbWet: 0.66,
        humanizeMs: 22,
        durationSec: 50,
      },
      {
        id: 'halloween_night_forest_creepy_wind_owls',
        title: 'Night Forest Creepy Wind & Owls',
        style: 'halloween',
        bpm: 52,
        chords: [
          [N.E3, N.B3, N.G4],
          [N.C3, N.G3, N.Eb4],
          [N.A2, N.E3, N.C4],
          [N.B2, N.Fs3, N.D4],
        ],
        melodyScale: [N.E4, N.G4, N.B4, N.C5, N.Eb5],
        phraseA: [0, null, null, 1, null, 2, null, null, 3, null, 2, null, 1, null, null, null],
        phraseB: [4, null, null, 3, null, 2, null, null, 1, null, 2, null, 0, null, null, null],
        padInstrument: 'cello_strings',
        leadInstrument: 'harp',
        accentInstrument: 'warm_pad',
        groove: 'ambient_free',
        textureType: 'forest_breeze',
        textureLevel: 0.09,
        natureAccent: 'owls_wind',
        reverbWet: 0.76,
        humanizeMs: 34,
        durationSec: 56,
      },
    ],
  },
};

export const ALL_17_AMBIENT_STYLES: SeasonalStyle[] = [
  'normal',
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
  'navidad',
  'halloween',
];

export const STYLE_SOUND_CATALOG: Record<SeasonalStyle, StyleSoundCatalogEntry> = (
  Object.keys(RAW_STYLE_SOUND_CATALOG) as SeasonalStyle[]
).reduce((acc, style) => {
  const entry = RAW_STYLE_SOUND_CATALOG[style];
  acc[style] = {
    ...entry,
    tracks: entry.tracks.map(track => ({
      ...track,
      audioFile: buildAudioFilePath(style, track.id),
    })),
  };
  return acc;
}, {} as Record<SeasonalStyle, StyleSoundCatalogEntry>);

export const STYLE_SOUND_META: Record<SeasonalStyle, StyleSoundMeta> = Object.keys(
  STYLE_SOUND_CATALOG
).reduce((acc, key) => {
  const style = key as SeasonalStyle;
  const entry = STYLE_SOUND_CATALOG[style];
  acc[style] = {
    name: entry.label,
    description: entry.description,
    tracks: entry.tracks.map(t => t.title),
  };
  return acc;
}, {} as Record<SeasonalStyle, StyleSoundMeta>);

export function getTracksForStyle(style: SeasonalStyle): AmbientTrack[] {
  const entry = STYLE_SOUND_CATALOG[style] || STYLE_SOUND_CATALOG.normal;
  return entry.tracks;
}

/**
 * Selects a random track (using Math.random()) from the 3 available tracks
 * for the given style, avoiding repeating `previousTrackId` when possible.
 */
export function pickRandomTrackForStyle(
  style: SeasonalStyle,
  previousTrackId?: string | null,
  rng: () => number = Math.random
): AmbientTrack {
  const tracks = getTracksForStyle(style);
  if (tracks.length <= 1) return tracks[0];

  const candidates = previousTrackId
    ? tracks.filter(t => t.id !== previousTrackId)
    : tracks;
  const pool = candidates.length > 0 ? candidates : tracks;
  const raw = rng();
  const safeRng = Number.isFinite(raw) ? Math.min(0.9999999, Math.max(0, raw)) : Math.random();
  const randomIndex = Math.floor(safeRng * pool.length);
  return pool[randomIndex];
}

/**
 * Selects the next track randomly using Math.random() with a non-repeating shuffle
 * history so all 3 tracks for a style rotate with auditory variety.
 */
export function pickNextQueueTrackForStyle(
  style: SeasonalStyle,
  recentHistory: string[] = [],
  rng: () => number = Math.random
): { track: AmbientTrack; nextHistory: string[] } {
  const tracks = getTracksForStyle(style);
  if (tracks.length <= 1) {
    return { track: tracks[0], nextHistory: tracks[0] ? [tracks[0].id] : [] };
  }

  const lastPlayedId = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;
  const playedSet = new Set(recentHistory);
  let unplayed = tracks.filter(t => !playedSet.has(t.id));

  let resetHistory = false;
  if (unplayed.length === 0) {
    resetHistory = true;
    unplayed = tracks.filter(t => t.id !== lastPlayedId);
    if (unplayed.length === 0) unplayed = tracks;
  }

  const raw = rng();
  const safeRng = Number.isFinite(raw) ? Math.min(0.9999999, Math.max(0, raw)) : Math.random();
  const chosen = unplayed[Math.floor(safeRng * unplayed.length)];
  const nextHistory = resetHistory ? [chosen.id] : [...recentHistory, chosen.id];
  return { track: chosen, nextHistory };
}

