/**
 * Time Utilities
 *
 * Conversion functions between different time representations:
 * - Samples (audio engine native)
 * - Bars:Beats:Ticks (musical notation)
 * - Minutes:Seconds:Milliseconds (clock time)
 *
 * Constants:
 * - PPQ (Pulses Per Quarter Note): 480 ticks per beat
 */

import type {
  BarsBeatsTicks,
  TimePosition,
  TimeSignature,
} from "@/types/studio";

/** Pulses (ticks) per quarter note - standard MIDI resolution */
export const PPQ = 480;

// =============================================================================
// Samples <-> Time Conversions
// =============================================================================

/**
 * Convert samples to seconds
 */
export function samplesToSeconds(samples: number, sampleRate: number): number {
  return samples / sampleRate;
}

/**
 * Convert seconds to samples
 */
export function secondsToSamples(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/**
 * Convert samples to milliseconds
 */
export function samplesToMs(samples: number, sampleRate: number): number {
  return (samples / sampleRate) * 1000;
}

/**
 * Convert milliseconds to samples
 */
export function msToSamples(ms: number, sampleRate: number): number {
  return Math.round((ms / 1000) * sampleRate);
}

// =============================================================================
// Time Position (MM:SS.mmm) Conversions
// =============================================================================

/**
 * Convert samples to TimePosition (MM:SS.mmm)
 */
export function samplesToTimePosition(
  samples: number,
  sampleRate: number
): TimePosition {
  const totalSeconds = samples / sampleRate;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return { minutes, seconds, milliseconds };
}

/**
 * Convert TimePosition to samples
 */
export function timePositionToSamples(
  position: TimePosition,
  sampleRate: number
): number {
  const totalSeconds =
    position.minutes * 60 + position.seconds + position.milliseconds / 1000;
  return Math.round(totalSeconds * sampleRate);
}

/**
 * Format TimePosition as string "MM:SS.mmm"
 */
export function formatTimePosition(position: TimePosition): string {
  const mins = position.minutes.toString().padStart(2, "0");
  const secs = position.seconds.toString().padStart(2, "0");
  const ms = position.milliseconds.toString().padStart(3, "0");
  return `${mins}:${secs}.${ms}`;
}

/**
 * Format samples as time string "MM:SS.mmm"
 */
export function formatSamplesAsTime(
  samples: number,
  sampleRate: number
): string {
  return formatTimePosition(samplesToTimePosition(samples, sampleRate));
}

/**
 * Format samples as short time string "MM:SS"
 */
export function formatSamplesAsShortTime(
  samples: number,
  sampleRate: number
): string {
  const position = samplesToTimePosition(samples, sampleRate);
  const mins = position.minutes.toString().padStart(2, "0");
  const secs = position.seconds.toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

// =============================================================================
// Bars:Beats:Ticks Conversions
// =============================================================================

/**
 * Get samples per beat at given tempo and sample rate
 */
export function getSamplesPerBeat(bpm: number, sampleRate: number): number {
  return (sampleRate * 60) / bpm;
}

/**
 * Get samples per bar at given tempo, time signature, and sample rate
 */
export function getSamplesPerBar(
  bpm: number,
  timeSignature: TimeSignature,
  sampleRate: number
): number {
  const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
  // For non-4 denominators, adjust beat duration
  const beatDurationMultiplier = 4 / timeSignature.denominator;
  return samplesPerBeat * timeSignature.numerator * beatDurationMultiplier;
}

/**
 * Get samples per tick
 */
export function getSamplesPerTick(bpm: number, sampleRate: number): number {
  return getSamplesPerBeat(bpm, sampleRate) / PPQ;
}

/**
 * Convert samples to BarsBeatsTicks
 */
export function samplesToBarsBeatsTicks(
  samples: number,
  bpm: number,
  timeSignature: TimeSignature,
  sampleRate: number
): BarsBeatsTicks {
  const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
  const beatDurationMultiplier = 4 / timeSignature.denominator;
  const adjustedSamplesPerBeat = samplesPerBeat * beatDurationMultiplier;
  const samplesPerBar = adjustedSamplesPerBeat * timeSignature.numerator;
  const samplesPerTick = adjustedSamplesPerBeat / PPQ;

  const bars = Math.floor(samples / samplesPerBar) + 1; // 1-indexed
  const remainingAfterBars = samples % samplesPerBar;

  const beats = Math.floor(remainingAfterBars / adjustedSamplesPerBeat) + 1; // 1-indexed
  const remainingAfterBeats = remainingAfterBars % adjustedSamplesPerBeat;

  const ticks = Math.floor(remainingAfterBeats / samplesPerTick);

  return { bars, beats, ticks };
}

/**
 * Convert BarsBeatsTicks to samples
 */
export function barsBeatsTicksToSamples(
  position: BarsBeatsTicks,
  bpm: number,
  timeSignature: TimeSignature,
  sampleRate: number
): number {
  const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
  const beatDurationMultiplier = 4 / timeSignature.denominator;
  const adjustedSamplesPerBeat = samplesPerBeat * beatDurationMultiplier;
  const samplesPerBar = adjustedSamplesPerBeat * timeSignature.numerator;
  const samplesPerTick = adjustedSamplesPerBeat / PPQ;

  // Convert from 1-indexed to 0-indexed
  const bars = position.bars - 1;
  const beats = position.beats - 1;

  return Math.round(
    bars * samplesPerBar + beats * adjustedSamplesPerBeat + position.ticks * samplesPerTick
  );
}

/**
 * Format BarsBeatsTicks as string "BB:B:TTT"
 */
export function formatBarsBeatsTicks(position: BarsBeatsTicks): string {
  const bars = position.bars.toString().padStart(3, " ");
  const beats = position.beats.toString();
  const ticks = position.ticks.toString().padStart(3, "0");
  return `${bars}:${beats}:${ticks}`;
}

/**
 * Format samples as bars:beats:ticks string
 */
export function formatSamplesAsBars(
  samples: number,
  bpm: number,
  timeSignature: TimeSignature,
  sampleRate: number
): string {
  return formatBarsBeatsTicks(
    samplesToBarsBeatsTicks(samples, bpm, timeSignature, sampleRate)
  );
}

/**
 * Format BarsBeatsTicks as short string "B:B" (bars:beats only)
 */
export function formatBarsBeatsShort(position: BarsBeatsTicks): string {
  return `${position.bars}:${position.beats}`;
}

// =============================================================================
// Snap/Quantize Functions
// =============================================================================

/**
 * Quantize position to nearest grid point (in beats)
 */
export function quantizeToGrid(
  samples: number,
  gridBeats: number,
  bpm: number,
  sampleRate: number
): number {
  const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
  const gridSamples = samplesPerBeat * gridBeats;

  return Math.round(samples / gridSamples) * gridSamples;
}

/**
 * Quantize to bar boundary
 */
export function quantizeToBar(
  samples: number,
  bpm: number,
  timeSignature: TimeSignature,
  sampleRate: number
): number {
  const samplesPerBar = getSamplesPerBar(bpm, timeSignature, sampleRate);
  return Math.round(samples / samplesPerBar) * samplesPerBar;
}

/**
 * Quantize to beat boundary
 */
export function quantizeToBeat(
  samples: number,
  bpm: number,
  sampleRate: number
): number {
  const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
  return Math.round(samples / samplesPerBeat) * samplesPerBeat;
}

// =============================================================================
// Duration Helpers
// =============================================================================

/**
 * Get bar duration in seconds
 */
export function getBarDurationSeconds(
  bpm: number,
  timeSignature: TimeSignature
): number {
  const beatDuration = 60 / bpm;
  const beatDurationMultiplier = 4 / timeSignature.denominator;
  return beatDuration * timeSignature.numerator * beatDurationMultiplier;
}

/**
 * Get beat duration in seconds
 */
export function getBeatDurationSeconds(bpm: number): number {
  return 60 / bpm;
}

/**
 * Convert beats to samples
 */
export function beatsToSamples(
  beats: number,
  bpm: number,
  sampleRate: number
): number {
  return Math.round(beats * getSamplesPerBeat(bpm, sampleRate));
}

/**
 * Convert samples to beats
 */
export function samplesToBeats(
  samples: number,
  bpm: number,
  sampleRate: number
): number {
  return samples / getSamplesPerBeat(bpm, sampleRate);
}

// =============================================================================
// Pixel/Sample Conversions (for timeline)
// =============================================================================

/**
 * Convert samples to pixels based on zoom level
 */
export function samplesToPixels(
  samples: number,
  pixelsPerSecond: number,
  sampleRate: number
): number {
  const seconds = samples / sampleRate;
  return seconds * pixelsPerSecond;
}

/**
 * Convert pixels to samples based on zoom level
 */
export function pixelsToSamples(
  pixels: number,
  pixelsPerSecond: number,
  sampleRate: number
): number {
  const seconds = pixels / pixelsPerSecond;
  return Math.round(seconds * sampleRate);
}

/**
 * Get pixels per bar at given zoom level
 */
export function getPixelsPerBar(
  pixelsPerSecond: number,
  bpm: number,
  timeSignature: TimeSignature
): number {
  const barDuration = getBarDurationSeconds(bpm, timeSignature);
  return barDuration * pixelsPerSecond;
}

/**
 * Get pixels per beat at given zoom level
 */
export function getPixelsPerBeat(
  pixelsPerSecond: number,
  bpm: number
): number {
  const beatDuration = getBeatDurationSeconds(bpm);
  return beatDuration * pixelsPerSecond;
}

// =============================================================================
// Utility Helpers
// =============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format duration in seconds as human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse time string "MM:SS" or "MM:SS.mmm" to seconds
 */
export function parseTimeString(timeStr: string): number | null {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;

  const minutes = parseInt(parts[0], 10);
  const secondsParts = parts[1].split(".");
  const seconds = parseInt(secondsParts[0], 10);
  const ms = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, "0"), 10) : 0;

  if (isNaN(minutes) || isNaN(seconds) || isNaN(ms)) return null;

  return minutes * 60 + seconds + ms / 1000;
}
