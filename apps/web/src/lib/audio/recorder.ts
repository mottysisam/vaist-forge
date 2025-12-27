/**
 * Audio Recorder
 *
 * Handles microphone input and recording using MediaRecorder API.
 * Records to WAV format for editing compatibility.
 */

import type { RecordingInput } from "@/types/studio";

/**
 * Recording result
 */
export interface RecordingResult {
  /** Raw audio data */
  data: ArrayBuffer;
  /** Duration in seconds */
  duration: number;
  /** Sample rate */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Recorder state
 */
export type RecorderState = "inactive" | "recording" | "paused";

/**
 * Audio Recorder class
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private state: RecorderState = "inactive";

  private onDataCallback: ((level: number) => void) | null = null;
  private animationFrameId: number | null = null;

  /**
   * Get available audio input devices
   */
  async getInputDevices(): Promise<RecordingInput[]> {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: "audioinput" as const,
        }));
    } catch (error) {
      console.error("[Recorder] Failed to enumerate devices:", error);
      return [];
    }
  }

  /**
   * Get current recorder state
   */
  getState(): RecorderState {
    return this.state;
  }

  /**
   * Start recording from specified input device
   */
  async start(deviceId?: string, sampleRate: number = 48000): Promise<boolean> {
    if (this.state === "recording") {
      console.warn("[Recorder] Already recording");
      return false;
    }

    try {
      // Get media stream
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio context for monitoring
      this.audioContext = new AudioContext({ sampleRate });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;

      this.sourceNode.connect(this.analyserNode);
      // Don't connect to destination to avoid feedback

      // Determine best supported MIME type
      const mimeType = this.getBestMimeType();

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 256000,
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.state = "recording";
        this.startTime = Date.now();
        this.startLevelMonitoring();
        console.log("[Recorder] Recording started");
      };

      this.mediaRecorder.onstop = () => {
        this.state = "inactive";
        this.stopLevelMonitoring();
        console.log("[Recorder] Recording stopped");
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("[Recorder] Error:", event);
        this.state = "inactive";
        this.stopLevelMonitoring();
      };

      // Start recording with 100ms timeslice
      this.mediaRecorder.start(100);

      return true;
    } catch (error) {
      console.error("[Recorder] Failed to start recording:", error);
      this.cleanup();
      return false;
    }
  }

  /**
   * Stop recording and return result
   */
  async stop(): Promise<RecordingResult | null> {
    if (!this.mediaRecorder || this.state === "inactive") {
      console.warn("[Recorder] Not recording");
      return null;
    }

    const mediaRecorder = this.mediaRecorder;

    return new Promise((resolve) => {
      const onStop = async () => {
        mediaRecorder.removeEventListener("stop", onStop);

        const duration = (Date.now() - this.startTime) / 1000;
        const mimeType = mediaRecorder.mimeType || "audio/webm";

        // Create blob from chunks
        const blob = new Blob(this.chunks, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();

        // Get sample rate from audio context
        const sampleRate = this.audioContext?.sampleRate || 48000;

        this.cleanup();

        resolve({
          data: arrayBuffer,
          duration,
          sampleRate,
          channels: 2,
          mimeType,
        });
      };

      mediaRecorder.addEventListener("stop", onStop);
      mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder && this.state === "recording") {
      this.mediaRecorder.pause();
      this.state = "paused";
      this.stopLevelMonitoring();
      console.log("[Recorder] Recording paused");
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder && this.state === "paused") {
      this.mediaRecorder.resume();
      this.state = "recording";
      this.startLevelMonitoring();
      console.log("[Recorder] Recording resumed");
    }
  }

  /**
   * Cancel recording without saving
   */
  cancel(): void {
    if (this.mediaRecorder && this.state !== "inactive") {
      this.mediaRecorder.stop();
      this.cleanup();
      console.log("[Recorder] Recording cancelled");
    }
  }

  /**
   * Set callback for input level monitoring
   */
  onLevel(callback: (level: number) => void): void {
    this.onDataCallback = callback;
  }

  /**
   * Get current input level (0-1)
   */
  getInputLevel(): number {
    if (!this.analyserNode) return 0;

    const dataArray = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatTimeDomainData(dataArray);

    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const abs = Math.abs(dataArray[i]);
      if (abs > peak) peak = abs;
    }

    return peak;
  }

  /**
   * Get recording duration so far (seconds)
   */
  getDuration(): number {
    if (this.state === "inactive") return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Get best supported MIME type
   */
  private getBestMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "audio/webm"; // Fallback
  }

  /**
   * Start level monitoring loop
   */
  private startLevelMonitoring(): void {
    const monitor = () => {
      if (this.state !== "recording") return;

      const level = this.getInputLevel();
      this.onDataCallback?.(level);

      this.animationFrameId = requestAnimationFrame(monitor);
    };

    monitor();
  }

  /**
   * Stop level monitoring loop
   */
  private stopLevelMonitoring(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopLevelMonitoring();

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Disconnect audio nodes
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.analyserNode?.disconnect();
    this.analyserNode = null;

    // Close audio context
    this.audioContext?.close();
    this.audioContext = null;

    this.mediaRecorder = null;
    this.chunks = [];
    this.state = "inactive";
  }

  /**
   * Dispose recorder
   */
  dispose(): void {
    this.cancel();
    this.cleanup();
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert audio blob to WAV format
 * (for better editing compatibility)
 */
export async function convertToWav(
  audioContext: AudioContext,
  data: ArrayBuffer,
  targetSampleRate: number = 48000
): Promise<ArrayBuffer> {
  try {
    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(data.slice(0));

    // Create offline context for conversion
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.duration * targetSampleRate,
      targetSampleRate
    );

    // Create source and connect
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    // Render
    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV
    return audioBufferToWav(renderedBuffer);
  } catch (error) {
    console.error("[Recorder] Failed to convert to WAV:", error);
    throw error;
  }
}

/**
 * Convert AudioBuffer to WAV ArrayBuffer
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  // Interleave channels
  const length = buffer.length * numChannels;
  const interleaved = new Float32Array(length);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      interleaved[i * numChannels + channel] = channelData[i];
    }
  }

  // Create WAV buffer
  const dataSize = length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return wavBuffer;
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Check if MediaRecorder is supported
 */
export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices !== "undefined";
}

// =============================================================================
// Singleton Instance
// =============================================================================

let recorderInstance: AudioRecorder | null = null;

/**
 * Get or create the audio recorder instance
 */
export function getAudioRecorder(): AudioRecorder {
  if (!recorderInstance) {
    recorderInstance = new AudioRecorder();
  }
  return recorderInstance;
}

/**
 * Dispose the recorder instance
 */
export function disposeAudioRecorder(): void {
  if (recorderInstance) {
    recorderInstance.dispose();
    recorderInstance = null;
  }
}
