/**
 * Studio Store (Zustand)
 *
 * Main state store for the WASM Studio DAW.
 * Manages tracks, clips, sessions, markers, and coordinates with mixer/transport.
 */

import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import type {
  Track,
  AudioClip,
  StudioSession,
  Marker,
  InsertSlot,
  TimelineViewState,
  SelectionState,
} from "@/types/studio";
import {
  createTrack,
  createAudioClip,
  createSession,
  createDefaultTimelineView,
  createEmptySelection,
} from "@/types/studio";
import { useMixerStore } from "./mixer-store";

// =============================================================================
// Helper: Generate unique IDs
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// Store State Interface
// =============================================================================

interface StudioStoreState {
  // Session
  session: StudioSession | null;
  isLoading: boolean;
  isDirty: boolean;
  error: string | null;

  // Timeline view state
  timelineView: TimelineViewState;

  // Selection state
  selection: SelectionState;

  // Session Actions
  createNewSession: (name: string, sampleRate?: number) => void;
  loadSession: (session: StudioSession) => void;
  saveSession: () => StudioSession | null;
  renameSession: (name: string) => void;
  closeSession: () => void;

  // Track Actions
  addTrack: (name?: string, type?: "audio" | "bus") => Track | null;
  removeTrack: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  setTrackColor: (trackId: string, color: string) => void;
  reorderTrack: (trackId: string, newOrder: number) => void;
  duplicateTrack: (trackId: string) => Track | null;
  setTrackHeight: (trackId: string, height: number) => void;

  // Track Insert Actions
  setTrackInsert: (
    trackId: string,
    slotIndex: number,
    instanceId: string | null,
    pluginUri: string | null
  ) => void;
  toggleTrackInsertBypass: (trackId: string, slotIndex: number) => void;
  clearTrackInsert: (trackId: string, slotIndex: number) => void;

  // Clip Actions
  addClip: (
    trackId: string,
    name: string,
    audioBlobId: string,
    startSamples: number,
    durationSamples: number
  ) => AudioClip | null;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartSamples: number) => void;
  resizeClipStart: (clipId: string, newStartSamples: number) => void;
  resizeClipEnd: (clipId: string, newEndSamples: number) => void;
  setClipOffset: (clipId: string, offsetSamples: number) => void;
  setClipGain: (clipId: string, gain: number) => void;
  toggleClipMute: (clipId: string) => void;
  renameClip: (clipId: string, name: string) => void;
  duplicateClip: (clipId: string, newStartSamples?: number) => AudioClip | null;
  splitClip: (clipId: string, splitPositionSamples: number) => [AudioClip, AudioClip] | null;

  // Marker Actions
  addMarker: (name: string, positionSamples: number, color?: string) => Marker;
  removeMarker: (markerId: string) => void;
  moveMarker: (markerId: string, positionSamples: number) => void;
  renameMarker: (markerId: string, name: string) => void;

  // Selection Actions
  selectTrack: (trackId: string, additive?: boolean) => void;
  selectClip: (clipId: string, additive?: boolean) => void;
  selectTimeRange: (startSamples: number, endSamples: number) => void;
  clearSelection: () => void;
  selectAllClipsOnTrack: (trackId: string) => void;
  deleteSelected: () => void;

  // Timeline View Actions
  setZoom: (pixelsPerSecond: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setScrollPosition: (x: number, y: number) => void;
  toggleSnap: () => void;
  setSnapGrid: (beats: number) => void;
  toggleWaveforms: () => void;

  // Utility
  getTrack: (trackId: string) => Track | undefined;
  getClip: (clipId: string) => AudioClip | undefined;
  getClipsAtPosition: (samples: number) => AudioClip[];
  getSessionEndSamples: () => number;
  setError: (error: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
}

// =============================================================================
// Create Store
// =============================================================================

export const useStudioStore = create<StudioStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        session: null,
        isLoading: false,
        isDirty: false,
        error: null,
        timelineView: createDefaultTimelineView(),
        selection: createEmptySelection(),

        // ======================================================================
        // Session Actions
        // ======================================================================

        createNewSession: (name: string, sampleRate: number = 48000) => {
          const session = createSession(generateId(), name, sampleRate);
          set({ session, isDirty: false, error: null });

          // Reset mixer
          useMixerStore.getState().resetMixer();

          console.log("[Studio] Created new session:", name);
        },

        loadSession: (session: StudioSession) => {
          set({ session, isDirty: false, error: null, isLoading: false });

          // Register tracks with mixer
          const mixerStore = useMixerStore.getState();
          mixerStore.resetMixer();
          for (const track of session.tracks) {
            mixerStore.registerTrack(track.id, track.name, track.color);
          }

          console.log("[Studio] Loaded session:", session.name);
        },

        saveSession: () => {
          const { session } = get();
          if (!session) return null;

          const updatedSession = {
            ...session,
            updatedAt: Date.now(),
          };
          set({ session: updatedSession, isDirty: false });

          console.log("[Studio] Saved session:", session.name);
          return updatedSession;
        },

        renameSession: (name: string) => {
          set((state) => ({
            session: state.session
              ? { ...state.session, name, updatedAt: Date.now() }
              : null,
            isDirty: true,
          }));
        },

        closeSession: () => {
          set({
            session: null,
            isDirty: false,
            error: null,
            selection: createEmptySelection(),
          });
          useMixerStore.getState().resetMixer();
          console.log("[Studio] Closed session");
        },

        // ======================================================================
        // Track Actions
        // ======================================================================

        addTrack: (name?: string, type: "audio" | "bus" = "audio") => {
          const { session } = get();
          if (!session) return null;

          const trackCount = session.tracks.length;
          const trackName = name || `Track ${trackCount + 1}`;
          const track = createTrack(generateId(), trackName, type, trackCount);

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: [...state.session.tracks, track],
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          // Register with mixer
          useMixerStore.getState().registerTrack(track.id, track.name, track.color);

          console.log("[Studio] Added track:", track.name);
          return track;
        },

        removeTrack: (trackId: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.filter((t) => t.id !== trackId),
                  updatedAt: Date.now(),
                }
              : null,
            selection: {
              ...state.selection,
              tracks: state.selection.tracks.filter((id) => id !== trackId),
              clips: state.selection.clips.filter((id) => {
                const clip = state.session?.tracks
                  .flatMap((t) => t.clips)
                  .find((c) => c.id === id);
                return clip?.trackId !== trackId;
              }),
            },
            isDirty: true,
          }));

          // Unregister from mixer
          useMixerStore.getState().unregisterTrack(trackId);

          console.log("[Studio] Removed track:", trackId);
        },

        renameTrack: (trackId: string, name: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId ? { ...t, name } : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          // Update mixer
          const track = get().session?.tracks.find((t) => t.id === trackId);
          if (track) {
            useMixerStore.getState().updateTrackInfo(trackId, name, track.color);
          }
        },

        setTrackColor: (trackId: string, color: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId ? { ...t, color } : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          // Update mixer
          const track = get().session?.tracks.find((t) => t.id === trackId);
          if (track) {
            useMixerStore.getState().updateTrackInfo(trackId, track.name, color);
          }
        },

        reorderTrack: (trackId: string, newOrder: number) => {
          set((state) => {
            if (!state.session) return state;

            const tracks = [...state.session.tracks];
            const trackIndex = tracks.findIndex((t) => t.id === trackId);
            if (trackIndex === -1) return state;

            const [track] = tracks.splice(trackIndex, 1);
            tracks.splice(newOrder, 0, track);

            // Update order indices
            const reorderedTracks = tracks.map((t, i) => ({ ...t, order: i }));

            return {
              session: {
                ...state.session,
                tracks: reorderedTracks,
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        duplicateTrack: (trackId: string) => {
          const { session } = get();
          if (!session) return null;

          const sourceTrack = session.tracks.find((t) => t.id === trackId);
          if (!sourceTrack) return null;

          const newTrack: Track = {
            ...sourceTrack,
            id: generateId(),
            name: `${sourceTrack.name} (Copy)`,
            order: session.tracks.length,
            clips: sourceTrack.clips.map((clip) => ({
              ...clip,
              id: generateId(),
            })),
            inserts: sourceTrack.inserts.map((insert) => ({
              ...insert,
              id: generateId(),
              instanceId: null, // Don't copy plugin instances
            })),
          };

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: [...state.session.tracks, newTrack],
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          useMixerStore.getState().registerTrack(newTrack.id, newTrack.name, newTrack.color);

          console.log("[Studio] Duplicated track:", sourceTrack.name);
          return newTrack;
        },

        setTrackHeight: (trackId: string, height: number) => {
          const clampedHeight = Math.max(40, Math.min(200, height));
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId ? { ...t, height: clampedHeight } : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        // ======================================================================
        // Track Insert Actions
        // ======================================================================

        setTrackInsert: (
          trackId: string,
          slotIndex: number,
          instanceId: string | null,
          pluginUri: string | null
        ) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId
                      ? {
                          ...t,
                          inserts: t.inserts.map((ins, i) =>
                            i === slotIndex ? { ...ins, instanceId, pluginUri } : ins
                          ),
                        }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        toggleTrackInsertBypass: (trackId: string, slotIndex: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId
                      ? {
                          ...t,
                          inserts: t.inserts.map((ins, i) =>
                            i === slotIndex ? { ...ins, bypass: !ins.bypass } : ins
                          ),
                        }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        clearTrackInsert: (trackId: string, slotIndex: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId
                      ? {
                          ...t,
                          inserts: t.inserts.map((ins, i) =>
                            i === slotIndex
                              ? { ...ins, instanceId: null, pluginUri: null, bypass: false }
                              : ins
                          ),
                        }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        // ======================================================================
        // Clip Actions
        // ======================================================================

        addClip: (
          trackId: string,
          name: string,
          audioBlobId: string,
          startSamples: number,
          durationSamples: number
        ) => {
          const { session } = get();
          if (!session) return null;

          const clip = createAudioClip(
            generateId(),
            trackId,
            name,
            audioBlobId,
            startSamples,
            durationSamples
          );

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          console.log("[Studio] Added clip:", name, "to track:", trackId);
          return clip;
        },

        removeClip: (clipId: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.filter((c) => c.id !== clipId),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            selection: {
              ...state.selection,
              clips: state.selection.clips.filter((id) => id !== clipId),
            },
            isDirty: true,
          }));
        },

        moveClip: (clipId: string, newTrackId: string, newStartSamples: number) => {
          set((state) => {
            if (!state.session) return state;

            // Find the clip
            let clip: AudioClip | undefined;
            for (const track of state.session.tracks) {
              clip = track.clips.find((c) => c.id === clipId);
              if (clip) break;
            }
            if (!clip) return state;

            // Calculate duration
            const duration = clip.endSamples - clip.startSamples;

            // Remove from old track, add to new
            const updatedTracks = state.session.tracks.map((t) => {
              const filteredClips = t.clips.filter((c) => c.id !== clipId);
              if (t.id === newTrackId) {
                const movedClip: AudioClip = {
                  ...clip!,
                  trackId: newTrackId,
                  startSamples: newStartSamples,
                  endSamples: newStartSamples + duration,
                };
                return { ...t, clips: [...filteredClips, movedClip] };
              }
              return { ...t, clips: filteredClips };
            });

            return {
              session: {
                ...state.session,
                tracks: updatedTracks,
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        resizeClipStart: (clipId: string, newStartSamples: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === clipId
                        ? {
                            ...c,
                            startSamples: Math.min(newStartSamples, c.endSamples - 1),
                            offsetSamples: c.offsetSamples + (newStartSamples - c.startSamples),
                          }
                        : c
                    ),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        resizeClipEnd: (clipId: string, newEndSamples: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === clipId
                        ? { ...c, endSamples: Math.max(newEndSamples, c.startSamples + 1) }
                        : c
                    ),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        setClipOffset: (clipId: string, offsetSamples: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === clipId ? { ...c, offsetSamples: Math.max(0, offsetSamples) } : c
                    ),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        setClipGain: (clipId: string, gain: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === clipId ? { ...c, gain: Math.max(0, Math.min(2, gain)) } : c
                    ),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        toggleClipMute: (clipId: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) =>
                      c.id === clipId ? { ...c, muted: !c.muted } : c
                    ),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        renameClip: (clipId: string, name: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) => ({
                    ...t,
                    clips: t.clips.map((c) => (c.id === clipId ? { ...c, name } : c)),
                  })),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        duplicateClip: (clipId: string, newStartSamples?: number) => {
          const { session } = get();
          if (!session) return null;

          let sourceClip: AudioClip | undefined;
          for (const track of session.tracks) {
            sourceClip = track.clips.find((c) => c.id === clipId);
            if (sourceClip) break;
          }
          if (!sourceClip) return null;

          const duration = sourceClip.endSamples - sourceClip.startSamples;
          const start = newStartSamples ?? sourceClip.endSamples;

          const newClip: AudioClip = {
            ...sourceClip,
            id: generateId(),
            startSamples: start,
            endSamples: start + duration,
          };

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === sourceClip!.trackId
                      ? { ...t, clips: [...t.clips, newClip] }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          return newClip;
        },

        splitClip: (clipId: string, splitPositionSamples: number) => {
          const { session } = get();
          if (!session) return null;

          let sourceClip: AudioClip | undefined;
          let trackId: string | undefined;
          for (const track of session.tracks) {
            sourceClip = track.clips.find((c) => c.id === clipId);
            if (sourceClip) {
              trackId = track.id;
              break;
            }
          }
          if (!sourceClip || !trackId) return null;

          // Validate split position
          if (
            splitPositionSamples <= sourceClip.startSamples ||
            splitPositionSamples >= sourceClip.endSamples
          ) {
            return null;
          }

          // Create two clips from the original
          const leftClip: AudioClip = {
            ...sourceClip,
            endSamples: splitPositionSamples,
          };

          const rightClip: AudioClip = {
            ...sourceClip,
            id: generateId(),
            startSamples: splitPositionSamples,
            offsetSamples:
              sourceClip.offsetSamples + (splitPositionSamples - sourceClip.startSamples),
          };

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  tracks: state.session.tracks.map((t) =>
                    t.id === trackId
                      ? {
                          ...t,
                          clips: [...t.clips.filter((c) => c.id !== clipId), leftClip, rightClip],
                        }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          return [leftClip, rightClip] as [AudioClip, AudioClip];
        },

        // ======================================================================
        // Marker Actions
        // ======================================================================

        addMarker: (name: string, positionSamples: number, color?: string) => {
          const marker: Marker = {
            id: generateId(),
            name,
            positionSamples,
            color: color || "#f97316", // orange
          };

          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  markers: [...state.session.markers, marker],
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));

          return marker;
        },

        removeMarker: (markerId: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  markers: state.session.markers.filter((m) => m.id !== markerId),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        moveMarker: (markerId: string, positionSamples: number) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  markers: state.session.markers.map((m) =>
                    m.id === markerId ? { ...m, positionSamples } : m
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        renameMarker: (markerId: string, name: string) => {
          set((state) => ({
            session: state.session
              ? {
                  ...state.session,
                  markers: state.session.markers.map((m) =>
                    m.id === markerId ? { ...m, name } : m
                  ),
                  updatedAt: Date.now(),
                }
              : null,
            isDirty: true,
          }));
        },

        // ======================================================================
        // Selection Actions
        // ======================================================================

        selectTrack: (trackId: string, additive: boolean = false) => {
          set((state) => ({
            selection: {
              ...state.selection,
              tracks: additive
                ? state.selection.tracks.includes(trackId)
                  ? state.selection.tracks.filter((id) => id !== trackId)
                  : [...state.selection.tracks, trackId]
                : [trackId],
            },
          }));
        },

        selectClip: (clipId: string, additive: boolean = false) => {
          set((state) => ({
            selection: {
              ...state.selection,
              clips: additive
                ? state.selection.clips.includes(clipId)
                  ? state.selection.clips.filter((id) => id !== clipId)
                  : [...state.selection.clips, clipId]
                : [clipId],
            },
          }));
        },

        selectTimeRange: (startSamples: number, endSamples: number) => {
          set((state) => ({
            selection: {
              ...state.selection,
              timeRange: { start: startSamples, end: endSamples },
            },
          }));
        },

        clearSelection: () => {
          set({ selection: createEmptySelection() });
        },

        selectAllClipsOnTrack: (trackId: string) => {
          const { session } = get();
          if (!session) return;

          const track = session.tracks.find((t) => t.id === trackId);
          if (!track) return;

          set((state) => ({
            selection: {
              ...state.selection,
              clips: track.clips.map((c) => c.id),
            },
          }));
        },

        deleteSelected: () => {
          const { selection, session } = get();
          if (!session) return;

          // Delete selected clips
          if (selection.clips.length > 0) {
            set((state) => ({
              session: state.session
                ? {
                    ...state.session,
                    tracks: state.session.tracks.map((t) => ({
                      ...t,
                      clips: t.clips.filter((c) => !selection.clips.includes(c.id)),
                    })),
                    updatedAt: Date.now(),
                  }
                : null,
              selection: { ...state.selection, clips: [] },
              isDirty: true,
            }));
          }

          // Delete selected tracks (if no clips selected)
          else if (selection.tracks.length > 0) {
            for (const trackId of selection.tracks) {
              get().removeTrack(trackId);
            }
            set((state) => ({
              selection: { ...state.selection, tracks: [] },
            }));
          }
        },

        // ======================================================================
        // Timeline View Actions
        // ======================================================================

        setZoom: (pixelsPerSecond: number) => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              pixelsPerSecond: Math.max(10, Math.min(1000, pixelsPerSecond)),
            },
          }));
        },

        zoomIn: () => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              pixelsPerSecond: Math.min(1000, state.timelineView.pixelsPerSecond * 1.5),
            },
          }));
        },

        zoomOut: () => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              pixelsPerSecond: Math.max(10, state.timelineView.pixelsPerSecond / 1.5),
            },
          }));
        },

        zoomToFit: () => {
          // TODO: Calculate based on session length and viewport width
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              pixelsPerSecond: 100,
              scrollX: 0,
            },
          }));
        },

        setScrollPosition: (x: number, y: number) => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              scrollX: Math.max(0, x),
              scrollY: Math.max(0, y),
            },
          }));
        },

        toggleSnap: () => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              snapEnabled: !state.timelineView.snapEnabled,
            },
          }));
        },

        setSnapGrid: (beats: number) => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              snapGridBeats: beats,
            },
          }));
        },

        toggleWaveforms: () => {
          set((state) => ({
            timelineView: {
              ...state.timelineView,
              showWaveforms: !state.timelineView.showWaveforms,
            },
          }));
        },

        // ======================================================================
        // Utility Functions
        // ======================================================================

        getTrack: (trackId: string) => {
          return get().session?.tracks.find((t) => t.id === trackId);
        },

        getClip: (clipId: string) => {
          const { session } = get();
          if (!session) return undefined;

          for (const track of session.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) return clip;
          }
          return undefined;
        },

        getClipsAtPosition: (samples: number) => {
          const { session } = get();
          if (!session) return [];

          const clips: AudioClip[] = [];
          for (const track of session.tracks) {
            for (const clip of track.clips) {
              if (samples >= clip.startSamples && samples < clip.endSamples) {
                clips.push(clip);
              }
            }
          }
          return clips;
        },

        getSessionEndSamples: () => {
          const { session } = get();
          if (!session) return 0;

          let maxEnd = 0;
          for (const track of session.tracks) {
            for (const clip of track.clips) {
              if (clip.endSamples > maxEnd) {
                maxEnd = clip.endSamples;
              }
            }
          }
          return maxEnd;
        },

        setError: (error: string | null) => {
          set({ error });
        },

        markDirty: () => {
          set({ isDirty: true });
        },

        markClean: () => {
          set({ isDirty: false });
        },
      }),
      {
        name: "vaist-studio",
        // Only persist view preferences, not session data (that goes to IndexedDB)
        partialize: (state) => ({
          timelineView: state.timelineView,
        }),
      }
    )
  )
);

// =============================================================================
// Selector Hooks for Efficient Re-renders
// =============================================================================

/**
 * Get the current session
 */
export function useSession() {
  return useStudioStore((s) => s.session);
}

/**
 * Get all tracks
 */
export function useTracks() {
  return useStudioStore((s) => s.session?.tracks ?? []);
}

/**
 * Get a single track
 */
export function useTrack(trackId: string) {
  return useStudioStore((s) => s.session?.tracks.find((t) => t.id === trackId));
}

/**
 * Get all clips for a track
 */
export function useTrackClips(trackId: string) {
  return useStudioStore((s) => s.session?.tracks.find((t) => t.id === trackId)?.clips ?? []);
}

/**
 * Get timeline view state
 */
export function useTimelineView() {
  return useStudioStore((s) => s.timelineView);
}

/**
 * Get selection state
 */
export function useSelection() {
  return useStudioStore((s) => s.selection);
}

/**
 * Check if dirty (unsaved changes)
 */
export function useIsDirty() {
  return useStudioStore((s) => s.isDirty);
}

/**
 * Get all markers
 */
export function useMarkers() {
  return useStudioStore((s) => s.session?.markers ?? []);
}
