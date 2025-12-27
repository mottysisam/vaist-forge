/**
 * Transport Store (Zustand)
 *
 * Manages transport/playback state for the studio.
 * Controls play, pause, stop, record, and position.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  TransportState,
  TimeSignature,
  LoopRegion,
  TimeDisplayFormat,
} from "@/types/studio";

interface TransportStoreState {
  // Playback state
  state: TransportState;
  positionSamples: number;
  sampleRate: number;

  // Tempo and time signature
  bpm: number;
  timeSignature: TimeSignature;

  // Loop
  loop: LoopRegion;

  // Metronome
  metronomeEnabled: boolean;
  metronomeVolume: number;

  // Recording
  preRollBars: number;
  countInEnabled: boolean;

  // UI preferences
  timeDisplayFormat: TimeDisplayFormat;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  record: () => void;
  togglePlayPause: () => void;

  setPosition: (samples: number) => void;
  seekTo: (samples: number) => void;
  jumpToBar: (bar: number) => void;
  jumpToStart: () => void;
  jumpToEnd: (sessionEndSamples: number) => void;

  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  setSampleRate: (rate: number) => void;

  setLoop: (loop: Partial<LoopRegion>) => void;
  toggleLoop: () => void;
  setLoopRegion: (startSamples: number, endSamples: number) => void;

  toggleMetronome: () => void;
  setMetronomeVolume: (volume: number) => void;

  setTimeDisplayFormat: (format: TimeDisplayFormat) => void;
  toggleTimeDisplayFormat: () => void;

  setPreRollBars: (bars: number) => void;
  toggleCountIn: () => void;

  // Internal update (called from audio engine)
  _updatePosition: (samples: number) => void;
  _setState: (state: TransportState) => void;
}

export const useTransportStore = create<TransportStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    state: "stopped",
    positionSamples: 0,
    sampleRate: 48000,

    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },

    loop: {
      enabled: false,
      startSamples: 0,
      endSamples: 48000 * 4, // 4 seconds default
    },

    metronomeEnabled: false,
    metronomeVolume: 0.5,

    preRollBars: 1,
    countInEnabled: false,

    timeDisplayFormat: "bars",

    // ==========================================================================
    // Playback Control Actions
    // ==========================================================================

    play: () => {
      const { state } = get();
      if (state === "playing" || state === "recording") return;

      set({ state: "playing" });
      console.log("[Transport] Play");
    },

    pause: () => {
      const { state } = get();
      if (state === "stopped") return;

      set({ state: "paused" });
      console.log("[Transport] Pause");
    },

    stop: () => {
      set({ state: "stopped", positionSamples: 0 });
      console.log("[Transport] Stop");
    },

    record: () => {
      const { state } = get();
      if (state === "recording") return;

      set({ state: "recording" });
      console.log("[Transport] Record");
    },

    togglePlayPause: () => {
      const { state, play, pause } = get();
      if (state === "playing") {
        pause();
      } else if (state === "paused" || state === "stopped") {
        play();
      }
    },

    // ==========================================================================
    // Position Actions
    // ==========================================================================

    setPosition: (samples: number) => {
      set({ positionSamples: Math.max(0, samples) });
    },

    seekTo: (samples: number) => {
      set({ positionSamples: Math.max(0, samples) });
      console.log("[Transport] Seek to:", samples);
    },

    jumpToBar: (bar: number) => {
      const { bpm, timeSignature, sampleRate } = get();
      // Calculate samples per bar
      const beatsPerBar = timeSignature.numerator;
      const beatDuration = 60 / bpm; // seconds per beat
      const barDuration = beatDuration * beatsPerBar;
      const samplesPerBar = barDuration * sampleRate;

      const targetSamples = Math.max(0, (bar - 1) * samplesPerBar);
      set({ positionSamples: targetSamples });
      console.log("[Transport] Jump to bar:", bar);
    },

    jumpToStart: () => {
      set({ positionSamples: 0 });
      console.log("[Transport] Jump to start");
    },

    jumpToEnd: (sessionEndSamples: number) => {
      set({ positionSamples: sessionEndSamples });
      console.log("[Transport] Jump to end");
    },

    // ==========================================================================
    // Tempo & Time Signature Actions
    // ==========================================================================

    setBpm: (bpm: number) => {
      const clampedBpm = Math.max(20, Math.min(999, bpm));
      set({ bpm: clampedBpm });
      console.log("[Transport] Set BPM:", clampedBpm);
    },

    setTimeSignature: (ts: TimeSignature) => {
      set({ timeSignature: ts });
      console.log("[Transport] Set time signature:", `${ts.numerator}/${ts.denominator}`);
    },

    setSampleRate: (rate: number) => {
      set({ sampleRate: rate });
      console.log("[Transport] Set sample rate:", rate);
    },

    // ==========================================================================
    // Loop Actions
    // ==========================================================================

    setLoop: (loopUpdate: Partial<LoopRegion>) => {
      set((state) => ({
        loop: { ...state.loop, ...loopUpdate },
      }));
    },

    toggleLoop: () => {
      set((state) => ({
        loop: { ...state.loop, enabled: !state.loop.enabled },
      }));
      console.log("[Transport] Toggle loop:", !get().loop.enabled);
    },

    setLoopRegion: (startSamples: number, endSamples: number) => {
      set((state) => ({
        loop: {
          ...state.loop,
          startSamples: Math.max(0, startSamples),
          endSamples: Math.max(startSamples + 1, endSamples),
        },
      }));
      console.log("[Transport] Set loop region:", startSamples, "-", endSamples);
    },

    // ==========================================================================
    // Metronome Actions
    // ==========================================================================

    toggleMetronome: () => {
      set((state) => ({ metronomeEnabled: !state.metronomeEnabled }));
      console.log("[Transport] Toggle metronome:", !get().metronomeEnabled);
    },

    setMetronomeVolume: (volume: number) => {
      set({ metronomeVolume: Math.max(0, Math.min(1, volume)) });
    },

    // ==========================================================================
    // UI Actions
    // ==========================================================================

    setTimeDisplayFormat: (format: TimeDisplayFormat) => {
      set({ timeDisplayFormat: format });
    },

    toggleTimeDisplayFormat: () => {
      set((state) => ({
        timeDisplayFormat: state.timeDisplayFormat === "bars" ? "time" : "bars",
      }));
    },

    // ==========================================================================
    // Recording Actions
    // ==========================================================================

    setPreRollBars: (bars: number) => {
      set({ preRollBars: Math.max(0, Math.min(8, bars)) });
    },

    toggleCountIn: () => {
      set((state) => ({ countInEnabled: !state.countInEnabled }));
    },

    // ==========================================================================
    // Internal Updates (called from audio engine)
    // ==========================================================================

    _updatePosition: (samples: number) => {
      set({ positionSamples: samples });
    },

    _setState: (state: TransportState) => {
      set({ state });
    },
  }))
);

// =============================================================================
// Selector Hooks for Efficient Re-renders
// =============================================================================

/**
 * Get playback state only
 */
export function useTransportState() {
  return useTransportStore((s) => s.state);
}

/**
 * Get position in samples
 */
export function useTransportPosition() {
  return useTransportStore((s) => s.positionSamples);
}

/**
 * Get tempo settings
 */
export function useTransportTempo() {
  return useTransportStore((s) => ({
    bpm: s.bpm,
    timeSignature: s.timeSignature,
    sampleRate: s.sampleRate,
  }));
}

/**
 * Get loop settings
 */
export function useTransportLoop() {
  return useTransportStore((s) => s.loop);
}

/**
 * Get time display format
 */
export function useTimeDisplayFormat() {
  return useTransportStore((s) => s.timeDisplayFormat);
}

/**
 * Check if currently playing
 */
export function useIsPlaying() {
  return useTransportStore((s) => s.state === "playing");
}

/**
 * Check if currently recording
 */
export function useIsRecording() {
  return useTransportStore((s) => s.state === "recording");
}
