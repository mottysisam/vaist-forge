/**
 * Marker Component
 *
 * Named position marker on the timeline.
 * Features:
 * - Colored flag at top
 * - Name label
 * - Vertical line
 * - Click to jump to position
 */

"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Marker as MarkerType } from "@/types/studio";
import { useTransportStore } from "@/stores/transport-store";
import { samplesToPixels } from "@/lib/utils/time-utils";

interface MarkerProps {
  marker: MarkerType;
  pixelsPerSecond: number;
  sampleRate: number;
  headerWidth: number;
  height: number;
  className?: string;
}

export function Marker({
  marker,
  pixelsPerSecond,
  sampleRate,
  headerWidth,
  height,
  className,
}: MarkerProps) {
  const { seekTo } = useTransportStore();
  const [isHovered, setIsHovered] = useState(false);

  // Calculate position
  const positionX =
    headerWidth + samplesToPixels(marker.positionSamples, pixelsPerSecond, sampleRate);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      seekTo(marker.positionSamples);
    },
    [marker.positionSamples, seekTo]
  );

  return (
    <div
      className={cn(
        "absolute top-0 z-15 cursor-pointer transition-opacity",
        isHovered ? "opacity-100" : "opacity-80",
        className
      )}
      style={{
        left: positionX,
        height,
        transform: "translateX(-50%)",
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Flag at top */}
      <div
        className="relative"
        style={{
          marginLeft: -1,
        }}
      >
        {/* Flag shape */}
        <div
          className="flex items-center pl-1 pr-2 h-4 text-[9px] font-medium text-white whitespace-nowrap"
          style={{
            backgroundColor: marker.color,
            clipPath: "polygon(0 0, 100% 0, calc(100% - 4px) 50%, 100% 100%, 0 100%)",
          }}
        >
          {marker.name}
        </div>
      </div>

      {/* Vertical line */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-px"
        style={{
          top: 16,
          height: height - 16,
          backgroundColor: marker.color,
          opacity: isHovered ? 0.8 : 0.4,
        }}
      />

      {/* Dashed line pattern */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-px pointer-events-none"
        style={{
          top: 16,
          height: height - 16,
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 4px,
            ${marker.color}40 4px,
            ${marker.color}40 8px
          )`,
        }}
      />
    </div>
  );
}
