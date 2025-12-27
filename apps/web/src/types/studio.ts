/**
 * Studio Types
 *
 * Core type definitions for the WASM Studio multi-track DAW.
 * Covers tracks, clips, mixer, transport, and session management.
 */

// =============================================================================
// Track Types
// =============================================================================

/**
 * Insert slot for plugin effects chain
 */
export interface InsertSlot {
  id: string;
  /** Position in the chain (0-7) */
  position: number;
  /** Plugin instance ID (null if empty) */
  instanceId: string | null;
  /** Plugin URI for loading */
  pluginUri: string | null;
  /** Bypass this insert */
  bypass: boolean;
}

/**
 * Audio clip on the timeline
 */
export interface AudioClip {
  id: string;
  trackId: string;
  /** Display name */
  name: string;
  /** Reference to audio blob in IndexedDB */
  audioBlobId: string;
  /** Start position in samples */
  startSamples: number;
  /** End position in samples (exclusive) */
  endSamples: number;
  /** Trim offset from source start in samples */
  offsetSamples: number;
  /** Clip color (CSS color string) */
  color?: string;
  /** Gain adjustment for this clip (0-2, 1 = unity) */
  gain: number;
  /** Mute this clip */
  muted: boolean;
  /** Fade in duration in samples */
  fadeInSamples: number;
  /** Fade out duration in samples */
  fadeOutSamples: number;
}

/**
 * Track in the session
 */
export interface Track {
  id: string;
  /** Display name */
  name: string;
  /** Track type */
  type: "audio" | "bus";
  /** Track color (CSS color string) */
  color: string;
  /** Volume level (0-1) */
  volume: number;
  /** Pan position (-1 to +1) */
  pan: number;
  /** Mute state */
  mute: boolean;
  /** Solo state */
  solo: boolean;
  /** Armed for recording */
  armed: boolean;
  /** Insert effects chain (up to 8 slots) */
  inserts: InsertSlot[];
  /** Audio clips on this track */
  clips: AudioClip[];
  /** Output routing target */
  outputTarget: "master" | string;
  /** Track height in pixels (for timeline display) */
  height: number;
  /** Track order index */
  order: number;
}

/**
 * Create a new empty track
 */
export function createTrack(
  id: string,
  name: string,
  type: "audio" | "bus" = "audio",
  order: number = 0
): Track {
  return {
    id,
    name,
    type,
    color: getRandomTrackColor(),
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    inserts: Array.from({ length: 8 }, (_, i) => ({
      id: `${id}-insert-${i}`,
      position: i,
      instanceId: null,
      pluginUri: null,
      bypass: false,
    })),
    clips: [],
    outputTarget: "master",
    height: 80,
    order,
  };
}

/**
 * Create a new audio clip
 */
export function createAudioClip(
  id: string,
  trackId: string,
  name: string,
  audioBlobId: string,
  startSamples: number,
  durationSamples: number
): AudioClip {
  return {
    id,
    trackId,
    name,
    audioBlobId,
    startSamples,
    endSamples: startSamples + durationSamples,
    offsetSamples: 0,
    gain: 1,
    muted: false,
    fadeInSamples: 0,
    fadeOutSamples: 0,
  };
}

// Track color palette
const TRACK_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

function getRandomTrackColor(): string {
  return TRACK_COLORS[Math.floor(Math.random() * TRACK_COLORS.length)];
}

// =============================================================================
// Transport Types
// =============================================================================

/**
 * Transport playback state
 */
export type TransportState = "stopped" | "playing" | "recording" | "paused";

/**
 * Time signature
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Loop region definition
 */
export interface LoopRegion {
  enabled: boolean;
  startSamples: number;
  endSamples: number;
}

/**
 * Named marker on timeline
 */
export interface Marker {
  id: string;
  name: string;
  positionSamples: number;
  color: string;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** Tempo in BPM */
  bpm: number;
  /** Time signature */
  timeSignature: TimeSignature;
  /** Sample rate (usually 44100 or 48000) */
  sampleRate: number;
  /** Current playhead position in samples */
  positionSamples: number;
  /** Transport state */
  state: TransportState;
  /** Loop region */
  loop: LoopRegion;
  /** Click/metronome enabled */
  metronomeEnabled: boolean;
  /** Pre-roll bars before recording */
  preRollBars: number;
}

/**
 * Create default transport config
 */
export function createDefaultTransport(sampleRate: number = 48000): TransportConfig {
  return {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    sampleRate,
    positionSamples: 0,
    state: "stopped",
    loop: {
      enabled: false,
      startSamples: 0,
      endSamples: sampleRate * 4, // 4 seconds default
    },
    metronomeEnabled: false,
    preRollBars: 1,
  };
}

// =============================================================================
// Time Format Types
// =============================================================================

/**
 * Time display format
 */
export type TimeDisplayFormat = "bars" | "time";

/**
 * Bars:Beats:Ticks representation
 */
export interface BarsBeatsTicks {
  bars: number;
  beats: number;
  ticks: number; // 0-479 (assuming 480 PPQ)
}

/**
 * Minutes:Seconds:Milliseconds representation
 */
export interface TimePosition {
  minutes: number;
  seconds: number;
  milliseconds: number;
}

// =============================================================================
// Mixer Types
// =============================================================================

/**
 * Master bus configuration
 */
export interface MasterBus {
  volume: number;
  pan: number;
  mute: boolean;
  inserts: InsertSlot[];
  /** Peak levels for metering [left, right] */
  peakLevels: [number, number];
}

/**
 * Create default master bus
 */
export function createDefaultMasterBus(): MasterBus {
  return {
    volume: 0.8,
    pan: 0,
    mute: false,
    inserts: Array.from({ length: 8 }, (_, i) => ({
      id: `master-insert-${i}`,
      position: i,
      instanceId: null,
      pluginUri: null,
      bypass: false,
    })),
    peakLevels: [0, 0],
  };
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Studio session (project file)
 */
export interface StudioSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** All tracks in the session */
  tracks: Track[];
  /** Master bus config */
  masterBus: MasterBus;
  /** Transport config */
  transport: TransportConfig;
  /** Timeline markers */
  markers: Marker[];
  /** Session-level notes */
  notes: string;
}

/**
 * Create a new empty session
 */
export function createSession(
  id: string,
  name: string,
  sampleRate: number = 48000
): StudioSession {
  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tracks: [],
    masterBus: createDefaultMasterBus(),
    transport: createDefaultTransport(sampleRate),
    markers: [],
    notes: "",
  };
}

// =============================================================================
// Audio Engine Types
// =============================================================================

/**
 * Audio blob stored in IndexedDB
 */
export interface AudioBlobRecord {
  id: string;
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** Sample rate */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Duration in seconds */
  duration: number;
  /** Total samples */
  samples: number;
  /** Raw audio data as ArrayBuffer */
  data: ArrayBuffer;
  /** Waveform peaks for visualization (downsampled) */
  waveformPeaks?: Float32Array;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Track playback node info
 */
export interface TrackNodeInfo {
  trackId: string;
  /** Gain node for volume control */
  gainNode: GainNode;
  /** Stereo panner for pan control */
  pannerNode: StereoPannerNode;
  /** Analyser for metering */
  analyserNode: AnalyserNode;
  /** Insert effect nodes */
  insertNodes: AudioNode[];
}

/**
 * Engine state
 */
export interface EngineState {
  initialized: boolean;
  sampleRate: number;
  /** Current audio context state */
  contextState: AudioContextState;
}

// =============================================================================
// Recording Types
// =============================================================================

/**
 * Recording input source
 */
export interface RecordingInput {
  deviceId: string;
  label: string;
  kind: "audioinput";
}

/**
 * Active recording state
 */
export interface RecordingState {
  isRecording: boolean;
  /** Track being recorded to */
  targetTrackId: string | null;
  /** Recording start position in samples */
  startPositionSamples: number;
  /** Current recording duration in samples */
  durationSamples: number;
  /** Selected input device */
  inputDevice: RecordingInput | null;
  /** Input level for monitoring */
  inputLevel: number;
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Timeline view state
 */
export interface TimelineViewState {
  /** Horizontal zoom (pixels per second) */
  pixelsPerSecond: number;
  /** Horizontal scroll position in pixels */
  scrollX: number;
  /** Vertical scroll position in pixels */
  scrollY: number;
  /** Snap to grid enabled */
  snapEnabled: boolean;
  /** Grid size (in beats) */
  snapGridBeats: number;
  /** Time display format */
  timeFormat: TimeDisplayFormat;
  /** Show waveforms in clips */
  showWaveforms: boolean;
}

/**
 * Create default timeline view
 */
export function createDefaultTimelineView(): TimelineViewState {
  return {
    pixelsPerSecond: 100,
    scrollX: 0,
    scrollY: 0,
    snapEnabled: true,
    snapGridBeats: 0.25, // Sixteenth notes
    timeFormat: "bars",
    showWaveforms: true,
  };
}

/**
 * Selection state
 */
export interface SelectionState {
  /** Selected track IDs */
  tracks: string[];
  /** Selected clip IDs */
  clips: string[];
  /** Time range selection (in samples) */
  timeRange: {
    start: number;
    end: number;
  } | null;
}

/**
 * Create empty selection
 */
export function createEmptySelection(): SelectionState {
  return {
    tracks: [],
    clips: [],
    timeRange: null,
  };
}
