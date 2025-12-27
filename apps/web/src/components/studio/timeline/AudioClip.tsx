/**
 * Audio Clip Component
 *
 * Displays a single audio clip on the timeline:
 * - Colored background based on track color
 * - Clip name label
 * - Waveform visualization (when available)
 * - Selection highlight
 * - Fade in/out handles (visual only for now)
 *
 * Supports:
 * - Click to select
 * - Drag to move (future)
 * - Edge drag to resize (future)
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { AudioClip as AudioClipType } from "@/types/studio";
import { useStudioStore, useSelection } from "@/stores/studio-store";
import { samplesToPixels } from "@/lib/utils/time-utils";

interface AudioClipProps {
  clip: AudioClipType;
  trackHeight: number;
  trackColor: string;
  pixelsPerSecond: number;
  sampleRate: number;
}

/**
 * Clip vertical padding
 */
const CLIP_PADDING = 4;

export function AudioClip({
  clip,
  trackHeight,
  trackColor,
  pixelsPerSecond,
  sampleRate,
}: AudioClipProps) {
  const selection = useSelection();
  const { selectClip } = useStudioStore();

  const [isHovered, setIsHovered] = useState(false);

  const isSelected = selection.clips.includes(clip.id);
  const isMuted = clip.muted;

  // Calculate clip position and dimensions
  const clipStyle = useMemo(() => {
    const left = samplesToPixels(clip.startSamples, pixelsPerSecond, sampleRate);
    const width = samplesToPixels(
      clip.endSamples - clip.startSamples,
      pixelsPerSecond,
      sampleRate
    );

    return {
      left,
      width: Math.max(width, 10), // Minimum 10px width
      top: CLIP_PADDING,
      height: trackHeight - CLIP_PADDING * 2,
    };
  }, [clip.startSamples, clip.endSamples, pixelsPerSecond, sampleRate, trackHeight]);

  // Clip color (use clip.color if set, otherwise derive from track color)
  const backgroundColor = useMemo(() => {
    const color = clip.color || trackColor;
    // Make slightly transparent
    return color + (isMuted ? "40" : "80"); // 25% or 50% opacity
  }, [clip.color, trackColor, isMuted]);

  const borderColor = useMemo(() => {
    const color = clip.color || trackColor;
    return isSelected ? "#fff" : color;
  }, [clip.color, trackColor, isSelected]);

  // Handle click to select
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectClip(clip.id, e.shiftKey || e.metaKey);
    },
    [clip.id, selectClip]
  );

  // Handle double-click (future: open clip editor)
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      console.log("[AudioClip] Double-click, would open editor for:", clip.id);
    },
    [clip.id]
  );

  return (
    <div
      className={cn(
        "absolute rounded-sm overflow-hidden cursor-pointer transition-shadow",
        isSelected && "ring-2 ring-white ring-opacity-80",
        isHovered && !isSelected && "ring-1 ring-white ring-opacity-40",
        isMuted && "opacity-50"
      )}
      style={{
        ...clipStyle,
        backgroundColor,
        borderLeft: `2px solid ${borderColor}`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Clip Header */}
      <div
        className="px-1.5 py-0.5 text-[10px] font-medium text-white truncate"
        style={{
          backgroundColor: (clip.color || trackColor) + "CC", // 80% opacity header
        }}
      >
        {clip.name}
        {isMuted && <span className="ml-1 opacity-60">(muted)</span>}
      </div>

      {/* Waveform Area */}
      <div className="flex-1 relative">
        {/* Placeholder waveform visualization */}
        <WaveformPlaceholder
          width={clipStyle.width - 2}
          height={clipStyle.height - 20}
          color={clip.color || trackColor}
        />

        {/* Fade In Indicator */}
        {clip.fadeInSamples > 0 && (
          <div
            className="absolute top-0 left-0 bottom-0 pointer-events-none"
            style={{
              width: samplesToPixels(clip.fadeInSamples, pixelsPerSecond, sampleRate),
              background: "linear-gradient(to right, rgba(0,0,0,0.5), transparent)",
            }}
          />
        )}

        {/* Fade Out Indicator */}
        {clip.fadeOutSamples > 0 && (
          <div
            className="absolute top-0 right-0 bottom-0 pointer-events-none"
            style={{
              width: samplesToPixels(clip.fadeOutSamples, pixelsPerSecond, sampleRate),
              background: "linear-gradient(to left, rgba(0,0,0,0.5), transparent)",
            }}
          />
        )}
      </div>

      {/* Resize Handles (visual only) */}
      {isSelected && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-white/30 hover:bg-white/60"
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize bg-white/30 hover:bg-white/60"
          />
        </>
      )}

      {/* Gain indicator (if not unity) */}
      {clip.gain !== 1 && (
        <div className="absolute bottom-1 right-1 text-[8px] text-white/70 bg-black/30 px-1 rounded">
          {clip.gain > 1 ? "+" : ""}
          {((clip.gain - 1) * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder waveform visualization
 * In full implementation, this would render actual waveform peaks
 */
function WaveformPlaceholder({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  // Generate some fake waveform bars
  const bars = useMemo(() => {
    const numBars = Math.max(1, Math.floor(width / 3));
    return Array.from({ length: numBars }, () => Math.random() * 0.6 + 0.2);
  }, [width]);

  return (
    <div
      className="flex items-center justify-center gap-px overflow-hidden"
      style={{ height, padding: "0 2px" }}
    >
      {bars.map((amplitude, i) => (
        <div
          key={i}
          className="flex-shrink-0"
          style={{
            width: 2,
            height: `${amplitude * 100}%`,
            backgroundColor: color,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
