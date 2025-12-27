/**
 * Playhead Cursor Component
 *
 * Vertical line indicating current playback position.
 * Features:
 * - Bright orange color for visibility
 * - Triangle handle at top
 * - Full height line through timeline
 * - Smooth animation during playback
 */

"use client";

import { cn } from "@/lib/utils";

interface PlayheadCursorProps {
  /** Horizontal position in pixels */
  positionX: number;
  /** Height of the timeline content area */
  height: number;
  /** Optional className */
  className?: string;
}

export function PlayheadCursor({ positionX, height, className }: PlayheadCursorProps) {
  // Don't render if position is negative
  if (positionX < 0) return null;

  return (
    <div
      className={cn(
        "absolute top-0 pointer-events-none z-20",
        className
      )}
      style={{
        left: positionX,
        height,
        transform: "translateX(-50%)",
      }}
    >
      {/* Triangle handle at top */}
      <div
        className="absolute -top-0 left-1/2 -translate-x-1/2 pointer-events-auto cursor-ew-resize"
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid #f97316", // orange-500
        }}
      />

      {/* Vertical line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px bg-orange-500"
        style={{ height: "100%" }}
      />

      {/* Glow effect for visibility */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px bg-orange-500 blur-sm opacity-50"
        style={{ height: "100%" }}
      />
    </div>
  );
}
