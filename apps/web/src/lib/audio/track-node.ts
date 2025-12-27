/**
 * Track Node
 *
 * Manages the audio graph for a single track:
 * [Clips] → [Insert Chain] → [Gain] → [Pan] → [Output]
 *
 * Also provides peak metering from an AnalyserNode.
 */

import type { Track, AudioClip, InsertSlot } from "@/types/studio";

/**
 * Track node interface
 */
export interface TrackNode {
  trackId: string;

  // Audio nodes
  inputNode: GainNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  analyserNode: AnalyserNode;
  outputNode: GainNode;

  // Insert chain
  insertNodes: (AudioNode | null)[];

  // Clip playback
  activeClipSources: Map<string, AudioBufferSourceNode>;

  // Methods
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;
  setMute: (mute: boolean) => void;
  getPeakLevels: () => [number, number];
  connect: (destination: AudioNode) => void;
  disconnect: () => void;
  dispose: () => void;
}

/**
 * Create a track audio node
 */
export function createTrackNode(
  audioContext: AudioContext,
  track: Track
): TrackNode {
  // Create audio nodes
  const inputNode = audioContext.createGain();
  const gainNode = audioContext.createGain();
  const pannerNode = audioContext.createStereoPanner();
  const analyserNode = audioContext.createAnalyser();
  const outputNode = audioContext.createGain();

  // Configure analyser for peak metering
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.3;

  // Initialize with track values
  gainNode.gain.value = track.volume;
  pannerNode.pan.value = track.pan;
  outputNode.gain.value = track.mute ? 0 : 1;

  // Create insert slots (null = bypass/empty)
  const insertNodes: (AudioNode | null)[] = new Array(8).fill(null);

  // Active clip sources for cleanup
  const activeClipSources = new Map<string, AudioBufferSourceNode>();

  // Connect the basic chain (no inserts initially)
  // input → gain → panner → analyser → output
  inputNode.connect(gainNode);
  gainNode.connect(pannerNode);
  pannerNode.connect(analyserNode);
  analyserNode.connect(outputNode);

  // Data array for peak metering
  const dataArray = new Float32Array(analyserNode.frequencyBinCount);

  /**
   * Get peak levels for left and right channels
   * Returns values in 0-1 range
   */
  function getPeakLevels(): [number, number] {
    analyserNode.getFloatTimeDomainData(dataArray);

    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const abs = Math.abs(dataArray[i]);
      if (abs > peak) peak = abs;
    }

    // Simple mono-to-stereo simulation for now
    // TODO: Use ChannelSplitter for true stereo metering
    return [peak, peak];
  }

  /**
   * Set volume (0-1)
   */
  function setVolume(volume: number) {
    gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
  }

  /**
   * Set pan (-1 to +1)
   */
  function setPan(pan: number) {
    pannerNode.pan.setTargetAtTime(pan, audioContext.currentTime, 0.01);
  }

  /**
   * Set mute state
   */
  function setMute(mute: boolean) {
    outputNode.gain.setTargetAtTime(mute ? 0 : 1, audioContext.currentTime, 0.01);
  }

  /**
   * Connect to destination (usually master bus)
   */
  function connect(destination: AudioNode) {
    outputNode.connect(destination);
  }

  /**
   * Disconnect from all outputs
   */
  function disconnect() {
    outputNode.disconnect();
  }

  /**
   * Dispose all resources
   */
  function dispose() {
    // Stop and disconnect all active clip sources
    for (const source of activeClipSources.values()) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    activeClipSources.clear();

    // Disconnect all nodes
    try {
      inputNode.disconnect();
      gainNode.disconnect();
      pannerNode.disconnect();
      analyserNode.disconnect();
      outputNode.disconnect();
    } catch {
      // Already disconnected
    }
  }

  return {
    trackId: track.id,
    inputNode,
    gainNode,
    pannerNode,
    analyserNode,
    outputNode,
    insertNodes,
    activeClipSources,
    setVolume,
    setPan,
    setMute,
    getPeakLevels,
    connect,
    disconnect,
    dispose,
  };
}

/**
 * Rebuild the insert chain for a track node
 * Called when inserts change
 */
export function rebuildInsertChain(
  trackNode: TrackNode,
  audioContext: AudioContext,
  insertNodes: (AudioNode | null)[]
): void {
  // Disconnect existing chain
  trackNode.inputNode.disconnect();

  // Update insert nodes reference
  trackNode.insertNodes = insertNodes;

  // Build the chain: input → [inserts] → gain → panner → analyser → output
  let previousNode: AudioNode = trackNode.inputNode;

  for (const insertNode of insertNodes) {
    if (insertNode) {
      previousNode.connect(insertNode);
      previousNode = insertNode;
    }
  }

  // Connect to gain stage
  previousNode.connect(trackNode.gainNode);
}

/**
 * Schedule a clip for playback
 */
export function scheduleClip(
  trackNode: TrackNode,
  audioContext: AudioContext,
  clip: AudioClip,
  audioBuffer: AudioBuffer,
  startTime: number,
  startOffset: number = 0
): AudioBufferSourceNode {
  // Stop existing source for this clip if any
  const existing = trackNode.activeClipSources.get(clip.id);
  if (existing) {
    try {
      existing.stop();
      existing.disconnect();
    } catch {
      // Already stopped
    }
  }

  // Create new source
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  // Apply clip gain
  const clipGain = audioContext.createGain();
  clipGain.gain.value = clip.gain;

  // Connect: source → clipGain → trackInput
  source.connect(clipGain);
  clipGain.connect(trackNode.inputNode);

  // Calculate playback parameters
  const clipDurationSamples = clip.endSamples - clip.startSamples;
  const clipDurationSeconds = clipDurationSamples / audioContext.sampleRate;

  // Offset within the audio file
  const bufferOffset = (clip.offsetSamples + startOffset) / audioContext.sampleRate;

  // Duration to play
  const playDuration = clipDurationSeconds - (startOffset / audioContext.sampleRate);

  // Start playback
  source.start(startTime, bufferOffset, playDuration);

  // Track for cleanup
  trackNode.activeClipSources.set(clip.id, source);

  // Remove from tracking when finished
  source.onended = () => {
    trackNode.activeClipSources.delete(clip.id);
    source.disconnect();
    clipGain.disconnect();
  };

  return source;
}

/**
 * Stop a specific clip
 */
export function stopClip(trackNode: TrackNode, clipId: string): void {
  const source = trackNode.activeClipSources.get(clipId);
  if (source) {
    try {
      source.stop();
    } catch {
      // Already stopped
    }
    trackNode.activeClipSources.delete(clipId);
  }
}

/**
 * Stop all clips on a track
 */
export function stopAllClips(trackNode: TrackNode): void {
  for (const [clipId, source] of trackNode.activeClipSources) {
    try {
      source.stop();
    } catch {
      // Already stopped
    }
  }
  trackNode.activeClipSources.clear();
}

/**
 * Update track parameters (volume, pan, mute)
 * Called when mixer state changes
 */
export function updateTrackNode(
  trackNode: TrackNode,
  volume: number,
  pan: number,
  mute: boolean,
  solo: boolean,
  hasSoloedTracks: boolean
): void {
  trackNode.setVolume(volume);
  trackNode.setPan(pan);

  // Mute if: explicitly muted, OR other tracks are soloed and this isn't
  const shouldMute = mute || (hasSoloedTracks && !solo);
  trackNode.setMute(shouldMute);
}

/**
 * Get clips that should be playing at a given position
 */
export function getActiveClipsAtPosition(
  clips: AudioClip[],
  positionSamples: number
): AudioClip[] {
  return clips.filter(
    (clip) =>
      !clip.muted &&
      positionSamples >= clip.startSamples &&
      positionSamples < clip.endSamples
  );
}
