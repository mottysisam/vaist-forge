/**
 * Meter Display Component
 *
 * VU/Peak meter for visualizing audio levels.
 * Features:
 * - Stereo or mono display
 * - Green/yellow/red color zones
 * - Peak hold indicator
 * - Clip indicator
 * - Smooth animation with requestAnimationFrame
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface MeterDisplayProps {
  // Current level values (0-1 normalized, where 1 = 0dBFS)
  leftLevel?: number;
  rightLevel?: number;
  // For mono meters, use this
  level?: number;
  // Display options
  stereo?: boolean;
  showPeak?: boolean;
  showClip?: boolean;
  orientation?: "vertical" | "horizontal";
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Number of LED segments
const SEGMENT_COUNT = 24;

// Thresholds for color zones (in normalized 0-1)
const YELLOW_THRESHOLD = 0.7; // -3dB
const RED_THRESHOLD = 0.89; // -1dB
const CLIP_THRESHOLD = 0.99; // ~0dBFS

// Peak hold time in ms
const PEAK_HOLD_TIME = 1500;
const PEAK_DECAY_RATE = 0.02;

const SIZE_STYLES = {
  sm: {
    container: "gap-0.5",
    bar: "w-2",
    barHeight: "h-20",
    barWidth: "w-16",
    segment: "h-[3px]",
    segmentWidth: "w-[3px]",
    clip: "w-2 h-2",
  },
  md: {
    container: "gap-1",
    bar: "w-3",
    barHeight: "h-28",
    barWidth: "w-24",
    segment: "h-1",
    segmentWidth: "w-1",
    clip: "w-3 h-3",
  },
  lg: {
    container: "gap-1.5",
    bar: "w-4",
    barHeight: "h-40",
    barWidth: "w-32",
    segment: "h-1.5",
    segmentWidth: "w-1.5",
    clip: "w-4 h-4",
  },
};

interface MeterBarProps {
  level: number;
  peakLevel: number;
  isClipping: boolean;
  showPeak: boolean;
  showClip: boolean;
  orientation: "vertical" | "horizontal";
  styles: typeof SIZE_STYLES.md;
}

function MeterBar({
  level,
  peakLevel,
  isClipping,
  showPeak,
  showClip,
  orientation,
  styles,
}: MeterBarProps) {
  const isVertical = orientation === "vertical";
  const activeSegments = Math.floor(level * SEGMENT_COUNT);
  const peakSegment = Math.floor(peakLevel * SEGMENT_COUNT);

  return (
    <div
      className={cn(
        "flex bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800",
        isVertical ? "flex-col-reverse" : "flex-row",
        isVertical ? styles.bar : styles.barWidth,
        isVertical ? styles.barHeight : styles.bar
      )}
    >
      {/* Segments */}
      {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
        const segmentValue = i / SEGMENT_COUNT;
        const isActive = i < activeSegments;
        const isPeak = showPeak && i === peakSegment && peakLevel > 0;

        // Determine color based on position
        let color = "bg-green-500";
        if (segmentValue >= RED_THRESHOLD) {
          color = "bg-red-500";
        } else if (segmentValue >= YELLOW_THRESHOLD) {
          color = "bg-yellow-500";
        }

        // Inactive state
        let inactiveColor = "bg-green-900/30";
        if (segmentValue >= RED_THRESHOLD) {
          inactiveColor = "bg-red-900/30";
        } else if (segmentValue >= YELLOW_THRESHOLD) {
          inactiveColor = "bg-yellow-900/30";
        }

        return (
          <div
            key={i}
            className={cn(
              "transition-colors duration-75",
              isVertical ? styles.segment : styles.segmentWidth,
              isVertical ? "w-full" : "h-full",
              isActive ? color : inactiveColor,
              isPeak && !isActive && "opacity-80",
              isPeak && color
            )}
          />
        );
      })}

      {/* Clip indicator overlay */}
      {showClip && isClipping && (
        <div
          className={cn(
            "absolute rounded-full bg-red-500 animate-pulse",
            isVertical ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" : "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
            styles.clip
          )}
        />
      )}
    </div>
  );
}

export function MeterDisplay({
  leftLevel = 0,
  rightLevel = 0,
  level,
  stereo = true,
  showPeak = true,
  showClip = true,
  orientation = "vertical",
  size = "md",
  className,
}: MeterDisplayProps) {
  // If mono level provided, use it for both channels
  const left = level !== undefined ? level : leftLevel;
  const right = level !== undefined ? level : rightLevel;

  // Peak hold state
  const [leftPeak, setLeftPeak] = useState(0);
  const [rightPeak, setRightPeak] = useState(0);
  const [leftClip, setLeftClip] = useState(false);
  const [rightClip, setRightClip] = useState(false);

  const leftPeakTimeRef = useRef(0);
  const rightPeakTimeRef = useRef(0);

  const styles = SIZE_STYLES[size];

  // Update peak levels
  useEffect(() => {
    const now = Date.now();

    // Left channel peak
    if (left > leftPeak) {
      setLeftPeak(left);
      leftPeakTimeRef.current = now;
      if (left >= CLIP_THRESHOLD) {
        setLeftClip(true);
      }
    } else if (now - leftPeakTimeRef.current > PEAK_HOLD_TIME) {
      setLeftPeak((prev) => Math.max(0, prev - PEAK_DECAY_RATE));
    }

    // Right channel peak
    if (right > rightPeak) {
      setRightPeak(right);
      rightPeakTimeRef.current = now;
      if (right >= CLIP_THRESHOLD) {
        setRightClip(true);
      }
    } else if (now - rightPeakTimeRef.current > PEAK_HOLD_TIME) {
      setRightPeak((prev) => Math.max(0, prev - PEAK_DECAY_RATE));
    }
  }, [left, right, leftPeak, rightPeak]);

  // Clear clip indicators after a delay
  useEffect(() => {
    if (leftClip) {
      const timer = setTimeout(() => setLeftClip(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [leftClip]);

  useEffect(() => {
    if (rightClip) {
      const timer = setTimeout(() => setRightClip(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [rightClip]);

  // Reset clip on click
  const handleClick = useCallback(() => {
    setLeftClip(false);
    setRightClip(false);
    setLeftPeak(0);
    setRightPeak(0);
  }, []);

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "relative flex",
        isVertical ? "flex-row" : "flex-col",
        styles.container,
        className
      )}
      onClick={handleClick}
      title="Click to reset peak/clip indicators"
    >
      {/* Left/Mono meter */}
      <MeterBar
        level={left}
        peakLevel={leftPeak}
        isClipping={leftClip}
        showPeak={showPeak}
        showClip={showClip}
        orientation={orientation}
        styles={styles}
      />

      {/* Right meter (stereo only) */}
      {stereo && (
        <MeterBar
          level={right}
          peakLevel={rightPeak}
          isClipping={rightClip}
          showPeak={showPeak}
          showClip={showClip}
          orientation={orientation}
          styles={styles}
        />
      )}
    </div>
  );
}

/**
 * Hook to simulate meter levels for testing
 * In production, these would come from Web Audio API analyzers
 */
export function useSimulatedMeterLevels(active: boolean = true) {
  const [levels, setLevels] = useState({ left: 0, right: 0 });
  const frameRef = useRef<number | undefined>(undefined);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setLevels({ left: 0, right: 0 });
      return;
    }

    const animate = () => {
      phaseRef.current += 0.05;

      // Simulate varying audio levels with some randomness
      const baseLevel = 0.4 + Math.sin(phaseRef.current) * 0.2;
      const noise = Math.random() * 0.15;

      setLevels({
        left: Math.min(1, baseLevel + noise + Math.sin(phaseRef.current * 1.3) * 0.1),
        right: Math.min(1, baseLevel + noise + Math.cos(phaseRef.current * 1.1) * 0.1),
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active]);

  return levels;
}
