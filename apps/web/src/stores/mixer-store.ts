/**
 * Mixer Store (Zustand)
 *
 * Manages mixer state: volume, pan, mute, solo, and metering.
 * Provides reactive state for mixer UI components.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MasterBus, InsertSlot } from "@/types/studio";
import { createDefaultMasterBus } from "@/types/studio";

/**
 * Track mixer state (subset of full track for mixer operations)
 */
interface TrackMixerState {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  /** Peak levels for metering [left, right] */
  peakLevels: [number, number];
}

interface MixerStoreState {
  // Track mixer states (keyed by track ID)
  tracks: Record<string, TrackMixerState>;

  // Master bus
  masterBus: MasterBus;

  // Solo mode tracking
  hasSoloedTracks: boolean;

  // Actions - Track controls
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackArmed: (trackId: string) => void;
  setTrackMute: (trackId: string, mute: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;
  setTrackArmed: (trackId: string, armed: boolean) => void;

  // Actions - Master bus
  setMasterVolume: (volume: number) => void;
  setMasterPan: (pan: number) => void;
  toggleMasterMute: () => void;

  // Actions - Track management
  registerTrack: (trackId: string, name: string, color: string) => void;
  unregisterTrack: (trackId: string) => void;
  updateTrackInfo: (trackId: string, name: string, color: string) => void;

  // Actions - Inserts
  setTrackInsert: (
    trackId: string,
    slotIndex: number,
    instanceId: string | null,
    pluginUri: string | null
  ) => void;
  toggleTrackInsertBypass: (trackId: string, slotIndex: number) => void;
  setMasterInsert: (
    slotIndex: number,
    instanceId: string | null,
    pluginUri: string | null
  ) => void;
  toggleMasterInsertBypass: (slotIndex: number) => void;

  // Internal updates (called from audio engine for metering)
  _updateTrackPeaks: (trackId: string, left: number, right: number) => void;
  _updateMasterPeaks: (left: number, right: number) => void;

  // Bulk operations
  muteAllTracks: () => void;
  unmuteAllTracks: () => void;
  clearAllSolos: () => void;
  resetMixer: () => void;
}

export const useMixerStore = create<MixerStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    tracks: {},
    masterBus: createDefaultMasterBus(),
    hasSoloedTracks: false,

    // ==========================================================================
    // Track Volume/Pan/Mute/Solo Actions
    // ==========================================================================

    setTrackVolume: (trackId: string, volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], volume: clampedVolume }
            : state.tracks[trackId],
        },
      }));
    },

    setTrackPan: (trackId: string, pan: number) => {
      const clampedPan = Math.max(-1, Math.min(1, pan));
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], pan: clampedPan }
            : state.tracks[trackId],
        },
      }));
    },

    toggleTrackMute: (trackId: string) => {
      set((state) => {
        const track = state.tracks[trackId];
        if (!track) return state;

        return {
          tracks: {
            ...state.tracks,
            [trackId]: { ...track, mute: !track.mute },
          },
        };
      });
    },

    toggleTrackSolo: (trackId: string) => {
      set((state) => {
        const track = state.tracks[trackId];
        if (!track) return state;

        const newSolo = !track.solo;
        const newTracks = {
          ...state.tracks,
          [trackId]: { ...track, solo: newSolo },
        };

        // Check if any track is now soloed
        const hasSoloedTracks = Object.values(newTracks).some((t) => t.solo);

        return {
          tracks: newTracks,
          hasSoloedTracks,
        };
      });
    },

    toggleTrackArmed: (trackId: string) => {
      set((state) => {
        const track = state.tracks[trackId];
        if (!track) return state;

        return {
          tracks: {
            ...state.tracks,
            [trackId]: { ...track, armed: !track.armed },
          },
        };
      });
    },

    setTrackMute: (trackId: string, mute: boolean) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], mute }
            : state.tracks[trackId],
        },
      }));
    },

    setTrackSolo: (trackId: string, solo: boolean) => {
      set((state) => {
        const track = state.tracks[trackId];
        if (!track) return state;

        const newTracks = {
          ...state.tracks,
          [trackId]: { ...track, solo },
        };

        const hasSoloedTracks = Object.values(newTracks).some((t) => t.solo);

        return {
          tracks: newTracks,
          hasSoloedTracks,
        };
      });
    },

    setTrackArmed: (trackId: string, armed: boolean) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], armed }
            : state.tracks[trackId],
        },
      }));
    },

    // ==========================================================================
    // Master Bus Actions
    // ==========================================================================

    setMasterVolume: (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      set((state) => ({
        masterBus: { ...state.masterBus, volume: clampedVolume },
      }));
    },

    setMasterPan: (pan: number) => {
      const clampedPan = Math.max(-1, Math.min(1, pan));
      set((state) => ({
        masterBus: { ...state.masterBus, pan: clampedPan },
      }));
    },

    toggleMasterMute: () => {
      set((state) => ({
        masterBus: { ...state.masterBus, mute: !state.masterBus.mute },
      }));
    },

    // ==========================================================================
    // Track Management Actions
    // ==========================================================================

    registerTrack: (trackId: string, name: string, color: string) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: {
            id: trackId,
            name,
            color,
            volume: 0.8,
            pan: 0,
            mute: false,
            solo: false,
            armed: false,
            peakLevels: [0, 0],
          },
        },
      }));
    },

    unregisterTrack: (trackId: string) => {
      set((state) => {
        const { [trackId]: removed, ...remaining } = state.tracks;
        const hasSoloedTracks = Object.values(remaining).some((t) => t.solo);
        return {
          tracks: remaining,
          hasSoloedTracks,
        };
      });
    },

    updateTrackInfo: (trackId: string, name: string, color: string) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], name, color }
            : state.tracks[trackId],
        },
      }));
    },

    // ==========================================================================
    // Insert Actions
    // ==========================================================================

    setTrackInsert: (
      trackId: string,
      slotIndex: number,
      instanceId: string | null,
      pluginUri: string | null
    ) => {
      // This is a placeholder - actual insert management happens in studio-store
      // But we can track for UI purposes
      console.log(
        `[Mixer] Set track ${trackId} insert ${slotIndex}:`,
        instanceId,
        pluginUri
      );
    },

    toggleTrackInsertBypass: (trackId: string, slotIndex: number) => {
      console.log(`[Mixer] Toggle track ${trackId} insert ${slotIndex} bypass`);
    },

    setMasterInsert: (
      slotIndex: number,
      instanceId: string | null,
      pluginUri: string | null
    ) => {
      set((state) => {
        const newInserts = [...state.masterBus.inserts];
        if (newInserts[slotIndex]) {
          newInserts[slotIndex] = {
            ...newInserts[slotIndex],
            instanceId,
            pluginUri,
          };
        }
        return {
          masterBus: { ...state.masterBus, inserts: newInserts },
        };
      });
    },

    toggleMasterInsertBypass: (slotIndex: number) => {
      set((state) => {
        const newInserts = [...state.masterBus.inserts];
        if (newInserts[slotIndex]) {
          newInserts[slotIndex] = {
            ...newInserts[slotIndex],
            bypass: !newInserts[slotIndex].bypass,
          };
        }
        return {
          masterBus: { ...state.masterBus, inserts: newInserts },
        };
      });
    },

    // ==========================================================================
    // Internal Updates (Metering)
    // ==========================================================================

    _updateTrackPeaks: (trackId: string, left: number, right: number) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          [trackId]: state.tracks[trackId]
            ? { ...state.tracks[trackId], peakLevels: [left, right] }
            : state.tracks[trackId],
        },
      }));
    },

    _updateMasterPeaks: (left: number, right: number) => {
      set((state) => ({
        masterBus: { ...state.masterBus, peakLevels: [left, right] },
      }));
    },

    // ==========================================================================
    // Bulk Operations
    // ==========================================================================

    muteAllTracks: () => {
      set((state) => {
        const newTracks: Record<string, TrackMixerState> = {};
        for (const [id, track] of Object.entries(state.tracks)) {
          newTracks[id] = { ...track, mute: true };
        }
        return { tracks: newTracks };
      });
    },

    unmuteAllTracks: () => {
      set((state) => {
        const newTracks: Record<string, TrackMixerState> = {};
        for (const [id, track] of Object.entries(state.tracks)) {
          newTracks[id] = { ...track, mute: false };
        }
        return { tracks: newTracks };
      });
    },

    clearAllSolos: () => {
      set((state) => {
        const newTracks: Record<string, TrackMixerState> = {};
        for (const [id, track] of Object.entries(state.tracks)) {
          newTracks[id] = { ...track, solo: false };
        }
        return { tracks: newTracks, hasSoloedTracks: false };
      });
    },

    resetMixer: () => {
      set({
        tracks: {},
        masterBus: createDefaultMasterBus(),
        hasSoloedTracks: false,
      });
    },
  }))
);

// =============================================================================
// Selector Hooks for Efficient Re-renders
// =============================================================================

/**
 * Get a single track's mixer state
 */
export function useTrackMixer(trackId: string) {
  return useMixerStore((s) => s.tracks[trackId]);
}

/**
 * Get all track mixer states
 */
export function useAllTrackMixers() {
  return useMixerStore((s) => s.tracks);
}

/**
 * Get master bus state
 */
export function useMasterBus() {
  return useMixerStore((s) => s.masterBus);
}

/**
 * Check if any track is soloed
 */
export function useHasSoloedTracks() {
  return useMixerStore((s) => s.hasSoloedTracks);
}

/**
 * Get track volume only
 */
export function useTrackVolume(trackId: string) {
  return useMixerStore((s) => s.tracks[trackId]?.volume ?? 0.8);
}

/**
 * Get track pan only
 */
export function useTrackPan(trackId: string) {
  return useMixerStore((s) => s.tracks[trackId]?.pan ?? 0);
}

/**
 * Get track peak levels for metering
 */
export function useTrackPeakLevels(trackId: string) {
  return useMixerStore((s) => s.tracks[trackId]?.peakLevels ?? [0, 0]);
}

/**
 * Get master peak levels for metering
 */
export function useMasterPeakLevels() {
  return useMixerStore((s) => s.masterBus.peakLevels);
}

/**
 * Check if a track should be audible (considering solo logic)
 */
export function useTrackAudible(trackId: string) {
  return useMixerStore((s) => {
    const track = s.tracks[trackId];
    if (!track) return false;
    if (track.mute) return false;
    if (s.hasSoloedTracks && !track.solo) return false;
    return true;
  });
}
