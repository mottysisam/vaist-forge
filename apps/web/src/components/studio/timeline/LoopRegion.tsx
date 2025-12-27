/**
 * Loop Region Component
 *
 * Visual overlay showing the loop region on the timeline.
 * Features:
 * - Semi-transparent colored overlay
 * - Start and end markers
 * - Draggable edges for resizing (future)
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { samplesToPixels } from "@/lib/utils/time-utils";

interface LoopRegionProps {
  /** Loop start position in samples */
  startSamples: number;
  /** Loop end position in samples */
  endSamples: number;
  /** Pixels per second (zoom level) */
  pixelsPerSecond: number;
  /** Sample rate */
  sampleRate: number;
  /** Track header width offset */
  headerWidth: number;
  /** Total height of the timeline */
  height: number;
  /** Optional className */
  className?: string;
}

export function LoopRegion({
  startSamples,
  endSamples,
  pixelsPerSecond,
  sampleRate,
  headerWidth,
  height,
  className,
}: LoopRegionProps) {
  // Calculate positions
  const style = useMemo(() => {
    const startX = samplesToPixels(startSamples, pixelsPerSecond, sampleRate);
    const endX = samplesToPixels(endSamples, pixelsPerSecond, sampleRate);
    const width = endX - startX;

    return {
      left: headerWidth + startX,
      width: Math.max(width, 4),
      height,
    };
  }, [startSamples, endSamples, pixelsPerSecond, sampleRate, headerWidth, height]);

  return (
    <div
      className={cn(
        "absolute top-0 pointer-events-none z-10",
        className
      )}
      style={style}
    >
      {/* Loop region fill */}
      <div className="absolute inset-0 bg-orange-500/10" />

      {/* Left edge marker */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500/60" />

      {/* Right edge marker */}
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-orange-500/60" />

      {/* Top bar with loop icon */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-orange-500/20 flex items-center justify-center">
        <span className="text-[9px] text-orange-500 font-medium">LOOP</span>
      </div>

      {/* Diagonal stripes pattern (subtle) */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(249, 115, 22, 0.3) 10px,
            rgba(249, 115, 22, 0.3) 11px
          )`,
        }}
      />
    </div>
  );
}
