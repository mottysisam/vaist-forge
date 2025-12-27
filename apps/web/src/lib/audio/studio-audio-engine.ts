/**
 * Studio Audio Engine
 *
 * Multi-track audio playback engine for the WASM Studio DAW.
 * Orchestrates track nodes, master bus, and transport synchronization.
 *
 * Architecture:
 * Track 1: [Clips] → [Inserts] → [Gain+Pan] ──┐
 * Track 2: [Clips] → [Inserts] → [Gain+Pan] ──┼──→ [Master Bus] → 🔊
 * Track N: [Clips] → [Inserts] → [Gain+Pan] ──┘
 *                                                   ↓
 *                                    [Master Inserts] → [Master Gain]
 */

import type { Track, AudioClip, StudioSession } from "@/types/studio";
import {
  createTrackNode,
  updateTrackNode,
  scheduleClip,
  stopAllClips,
  getActiveClipsAtPosition,
  type TrackNode,
} from "./track-node";
import { useTransportStore } from "@/stores/transport-store";
import { useMixerStore } from "@/stores/mixer-store";
import { useStudioStore } from "@/stores/studio-store";

/**
 * Audio buffer cache (keyed by audioBlobId)
 */
export interface AudioBufferCache {
  get: (audioBlobId: string) => AudioBuffer | undefined;
  set: (audioBlobId: string, buffer: AudioBuffer) => void;
  has: (audioBlobId: string) => boolean;
  delete: (audioBlobId: string) => void;
  clear: () => void;
}

/**
 * Create a simple audio buffer cache
 */
export function createAudioBufferCache(): AudioBufferCache {
  const cache = new Map<string, AudioBuffer>();

  return {
    get: (id) => cache.get(id),
    set: (id, buffer) => cache.set(id, buffer),
    has: (id) => cache.has(id),
    delete: (id) => cache.delete(id),
    clear: () => cache.clear(),
  };
}

/**
 * Studio Audio Engine
 */
export class StudioAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterPanner: StereoPannerNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  private trackNodes: Map<string, TrackNode> = new Map();
  private audioBufferCache: AudioBufferCache = createAudioBufferCache();

  private isInitialized = false;
  private animationFrameId: number | null = null;
  private lastScheduledTime = 0;
  private scheduleAheadTime = 0.1; // Schedule 100ms ahead

  // Store subscriptions
  private unsubscribeTransport: (() => void) | null = null;
  private unsubscribeMixer: (() => void) | null = null;
  private unsubscribeStudio: (() => void) | null = null;

  /**
   * Initialize the audio engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create AudioContext
    this.audioContext = new AudioContext({
      sampleRate: 48000,
      latencyHint: "balanced",
    });

    // Update transport sample rate
    useTransportStore.getState().setSampleRate(this.audioContext.sampleRate);

    // Create master bus nodes
    this.masterGain = this.audioContext.createGain();
    this.masterPanner = this.audioContext.createStereoPanner();
    this.masterAnalyser = this.audioContext.createAnalyser();

    // Configure master analyser
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.3;

    // Connect master chain: panner → analyser → gain → destination
    this.masterPanner.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    // Apply initial master settings
    const { masterBus } = useMixerStore.getState();
    this.masterGain.gain.value = masterBus.volume;
    this.masterPanner.pan.value = masterBus.pan;

    // Subscribe to store changes
    this.setupStoreSubscriptions();

    this.isInitialized = true;
    console.log("[StudioEngine] Initialized", {
      sampleRate: this.audioContext.sampleRate,
    });
  }

  /**
   * Dispose the audio engine
   */
  dispose(): void {
    if (!this.isInitialized) return;

    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Unsubscribe from stores
    this.unsubscribeTransport?.();
    this.unsubscribeMixer?.();
    this.unsubscribeStudio?.();

    // Dispose all track nodes
    for (const trackNode of this.trackNodes.values()) {
      trackNode.dispose();
    }
    this.trackNodes.clear();

    // Clear buffer cache
    this.audioBufferCache.clear();

    // Close audio context
    this.audioContext?.close();
    this.audioContext = null;

    this.isInitialized = false;
    console.log("[StudioEngine] Disposed");
  }

  /**
   * Get the AudioContext
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    return this.audioContext?.sampleRate ?? 48000;
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
      console.log("[StudioEngine] AudioContext resumed");
    }
  }

  /**
   * Setup subscriptions to Zustand stores
   */
  private setupStoreSubscriptions(): void {
    // Subscribe to transport state changes
    this.unsubscribeTransport = useTransportStore.subscribe(
      (state) => state.state,
      (transportState) => {
        this.handleTransportStateChange(transportState);
      }
    );

    // Subscribe to mixer changes
    this.unsubscribeMixer = useMixerStore.subscribe(
      (state) => ({
        masterVolume: state.masterBus.volume,
        masterPan: state.masterBus.pan,
        masterMute: state.masterBus.mute,
        hasSoloedTracks: state.hasSoloedTracks,
        tracks: state.tracks,
      }),
      (mixer) => {
        this.handleMixerChange(mixer);
      }
    );

    // Subscribe to studio session changes (track additions/removals)
    this.unsubscribeStudio = useStudioStore.subscribe(
      (state) => state.session?.tracks.map((t) => t.id) ?? [],
      (trackIds, prevTrackIds) => {
        // Check if tracks changed
        if (trackIds.length !== prevTrackIds.length ||
            trackIds.some((id, i) => id !== prevTrackIds[i])) {
          this.syncWithSession();
        }
      }
    );
  }

  /**
   * Handle transport state changes
   */
  private handleTransportStateChange(state: string): void {
    switch (state) {
      case "playing":
      case "recording":
        this.startPlayback();
        break;
      case "paused":
        this.pausePlayback();
        break;
      case "stopped":
        this.stopPlayback();
        break;
    }
  }

  /**
   * Handle mixer changes
   */
  private handleMixerChange(mixer: {
    masterVolume: number;
    masterPan: number;
    masterMute: boolean;
    hasSoloedTracks: boolean;
    tracks: Record<string, { volume: number; pan: number; mute: boolean; solo: boolean }>;
  }): void {
    if (!this.audioContext) return;

    // Update master bus
    if (this.masterGain && this.masterPanner) {
      this.masterGain.gain.setTargetAtTime(
        mixer.masterMute ? 0 : mixer.masterVolume,
        this.audioContext.currentTime,
        0.01
      );
      this.masterPanner.pan.setTargetAtTime(
        mixer.masterPan,
        this.audioContext.currentTime,
        0.01
      );
    }

    // Update track nodes
    for (const [trackId, trackMixer] of Object.entries(mixer.tracks)) {
      const trackNode = this.trackNodes.get(trackId);
      if (trackNode) {
        updateTrackNode(
          trackNode,
          trackMixer.volume,
          trackMixer.pan,
          trackMixer.mute,
          trackMixer.solo,
          mixer.hasSoloedTracks
        );
      }
    }
  }

  /**
   * Create track node for a track
   */
  createTrack(track: Track): void {
    if (!this.audioContext || !this.masterPanner) return;

    // Don't recreate if already exists
    if (this.trackNodes.has(track.id)) return;

    const trackNode = createTrackNode(this.audioContext, track);
    trackNode.connect(this.masterPanner);

    this.trackNodes.set(track.id, trackNode);
    console.log("[StudioEngine] Created track node:", track.id);
  }

  /**
   * Remove track node
   */
  removeTrack(trackId: string): void {
    const trackNode = this.trackNodes.get(trackId);
    if (trackNode) {
      trackNode.dispose();
      this.trackNodes.delete(trackId);
      console.log("[StudioEngine] Removed track node:", trackId);
    }
  }

  /**
   * Load an audio file into the buffer cache
   */
  async loadAudioBuffer(audioBlobId: string, data: ArrayBuffer): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    // Check cache first
    if (this.audioBufferCache.has(audioBlobId)) {
      return this.audioBufferCache.get(audioBlobId) ?? null;
    }

    try {
      const buffer = await this.audioContext.decodeAudioData(data.slice(0));
      this.audioBufferCache.set(audioBlobId, buffer);
      console.log("[StudioEngine] Loaded audio buffer:", audioBlobId);
      return buffer;
    } catch (error) {
      console.error("[StudioEngine] Failed to decode audio:", error);
      return null;
    }
  }

  /**
   * Get audio buffer from cache
   */
  getAudioBuffer(audioBlobId: string): AudioBuffer | undefined {
    return this.audioBufferCache.get(audioBlobId);
  }

  /**
   * Start playback
   */
  private startPlayback(): void {
    if (!this.audioContext) return;

    // Resume context if needed
    this.resume();

    // Reset schedule time
    this.lastScheduledTime = this.audioContext.currentTime;

    // Start the scheduling loop
    this.scheduleLoop();

    console.log("[StudioEngine] Started playback");
  }

  /**
   * Pause playback
   */
  private pausePlayback(): void {
    // Cancel scheduling loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all active clips (they'll resume from current position)
    for (const trackNode of this.trackNodes.values()) {
      stopAllClips(trackNode);
    }

    console.log("[StudioEngine] Paused playback");
  }

  /**
   * Stop playback
   */
  private stopPlayback(): void {
    // Cancel scheduling loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all active clips
    for (const trackNode of this.trackNodes.values()) {
      stopAllClips(trackNode);
    }

    console.log("[StudioEngine] Stopped playback");
  }

  /**
   * Main scheduling loop
   */
  private scheduleLoop = (): void => {
    const transportStore = useTransportStore.getState();
    const { state, positionSamples, sampleRate, loop } = transportStore;

    if (state !== "playing" && state !== "recording") {
      this.animationFrameId = null;
      return;
    }

    if (!this.audioContext) {
      this.animationFrameId = null;
      return;
    }

    const currentTime = this.audioContext.currentTime;
    const session = useStudioStore.getState().session;

    if (session) {
      // Calculate what needs to be scheduled
      const elapsedTime = currentTime - this.lastScheduledTime;
      const elapsedSamples = elapsedTime * sampleRate;
      const newPositionSamples = positionSamples + elapsedSamples;

      // Handle looping
      let actualPosition = newPositionSamples;
      if (loop.enabled && actualPosition >= loop.endSamples) {
        actualPosition = loop.startSamples + ((actualPosition - loop.startSamples) % (loop.endSamples - loop.startSamples));
      }

      // Update transport position
      transportStore._updatePosition(actualPosition);

      // Schedule clips that should start playing
      for (const track of session.tracks) {
        const trackNode = this.trackNodes.get(track.id);
        if (!trackNode) continue;

        const activeClips = getActiveClipsAtPosition(track.clips, actualPosition);

        for (const clip of activeClips) {
          // Check if already playing
          if (trackNode.activeClipSources.has(clip.id)) continue;

          // Get audio buffer
          const buffer = this.audioBufferCache.get(clip.audioBlobId);
          if (!buffer) continue;

          // Calculate offset within clip
          const offsetSamples = actualPosition - clip.startSamples;

          // Schedule clip
          scheduleClip(
            trackNode,
            this.audioContext!,
            clip,
            buffer,
            currentTime,
            offsetSamples
          );
        }
      }
    }

    // Update metering
    this.updateMetering();

    // Update last scheduled time
    this.lastScheduledTime = currentTime;

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.scheduleLoop);
  };

  /**
   * Update peak meters for all tracks and master
   */
  private updateMetering(): void {
    const mixerStore = useMixerStore.getState();

    // Update track meters
    for (const [trackId, trackNode] of this.trackNodes) {
      const [left, right] = trackNode.getPeakLevels();
      mixerStore._updateTrackPeaks(trackId, left, right);
    }

    // Update master meter
    if (this.masterAnalyser) {
      const dataArray = new Float32Array(this.masterAnalyser.frequencyBinCount);
      this.masterAnalyser.getFloatTimeDomainData(dataArray);

      let peak = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const abs = Math.abs(dataArray[i]);
        if (abs > peak) peak = abs;
      }

      mixerStore._updateMasterPeaks(peak, peak);
    }
  }

  /**
   * Seek to a position
   */
  seek(positionSamples: number): void {
    // Stop all current playback
    for (const trackNode of this.trackNodes.values()) {
      stopAllClips(trackNode);
    }

    // Update position
    useTransportStore.getState().setPosition(positionSamples);

    // If playing, restart scheduling
    const state = useTransportStore.getState().state;
    if (state === "playing" || state === "recording") {
      if (this.audioContext) {
        this.lastScheduledTime = this.audioContext.currentTime;
      }
    }
  }

  /**
   * Load session into the engine
   */
  loadSession(session: StudioSession): void {
    // Clear existing tracks
    for (const trackNode of this.trackNodes.values()) {
      trackNode.dispose();
    }
    this.trackNodes.clear();

    // Create track nodes for all tracks
    for (const track of session.tracks) {
      this.createTrack(track);
    }

    console.log("[StudioEngine] Loaded session:", session.name);
  }

  /**
   * Sync engine with current session state
   */
  syncWithSession(): void {
    const session = useStudioStore.getState().session;
    if (!session) return;

    // Add missing track nodes
    for (const track of session.tracks) {
      if (!this.trackNodes.has(track.id)) {
        this.createTrack(track);
      }
    }

    // Remove orphaned track nodes
    for (const trackId of this.trackNodes.keys()) {
      if (!session.tracks.find((t) => t.id === trackId)) {
        this.removeTrack(trackId);
      }
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let engineInstance: StudioAudioEngine | null = null;

/**
 * Get or create the studio audio engine instance
 */
export function getStudioAudioEngine(): StudioAudioEngine {
  if (!engineInstance) {
    engineInstance = new StudioAudioEngine();
  }
  return engineInstance;
}

/**
 * Dispose the engine instance
 */
export function disposeStudioAudioEngine(): void {
  if (engineInstance) {
    engineInstance.dispose();
    engineInstance = null;
  }
}
