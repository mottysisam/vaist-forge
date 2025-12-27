/**
 * Time Display Component
 *
 * Displays current position in either:
 * - Bars:Beats:Ticks format (musical time)
 * - Minutes:Seconds:Milliseconds format (real time)
 *
 * Click to toggle between formats.
 */

"use client";

import { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTransportStore, useTimeDisplayFormat } from "@/stores/transport-store";
import { samplesToBarsBeatsTicks, samplesToTimePosition } from "@/lib/utils/time-utils";

interface TimeDisplayProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: {
    container: "px-2 py-1",
    label: "text-[8px]",
    time: "text-sm",
  },
  md: {
    container: "px-3 py-1.5",
    label: "text-[9px]",
    time: "text-lg",
  },
  lg: {
    container: "px-4 py-2",
    label: "text-xs",
    time: "text-2xl",
  },
};

export function TimeDisplay({ className, size = "md" }: TimeDisplayProps) {
  const positionSamples = useTransportStore((s) => s.positionSamples);
  const sampleRate = useTransportStore((s) => s.sampleRate);
  const bpm = useTransportStore((s) => s.bpm);
  const timeSignature = useTransportStore((s) => s.timeSignature);
  const format = useTimeDisplayFormat();
  const toggleFormat = useTransportStore((s) => s.toggleTimeDisplayFormat);

  const styles = SIZE_STYLES[size];

  // Format position based on current display mode
  const displayValue = useMemo(() => {
    if (format === "bars") {
      const bbt = samplesToBarsBeatsTicks(
        positionSamples,
        bpm,
        timeSignature,
        sampleRate
      );
      // Format as BAR.BEAT.TICK (e.g., 001.02.000)
      return `${String(bbt.bars).padStart(3, "0")}.${String(bbt.beats).padStart(2, "0")}.${String(bbt.ticks).padStart(3, "0")}`;
    } else {
      const time = samplesToTimePosition(positionSamples, sampleRate);
      // Format as MM:SS.mmm (e.g., 00:12.345)
      return `${String(time.minutes).padStart(2, "0")}:${String(time.seconds).padStart(2, "0")}.${String(time.milliseconds).padStart(3, "0")}`;
    }
  }, [positionSamples, sampleRate, bpm, timeSignature, format]);

  const handleClick = useCallback(() => {
    toggleFormat();
  }, [toggleFormat]);

  return (
    <button
      className={cn(
        "flex flex-col items-center bg-zinc-900 border border-zinc-700 rounded-lg",
        "hover:border-zinc-600 transition-colors cursor-pointer",
        styles.container,
        className
      )}
      onClick={handleClick}
      title={`Click to toggle between ${format === "bars" ? "time" : "bars:beats"} format`}
    >
      {/* Format label */}
      <span className={cn("text-zinc-500 uppercase tracking-wider", styles.label)}>
        {format === "bars" ? "BAR.BEAT.TICK" : "MIN:SEC.MS"}
      </span>

      {/* Time value */}
      <span className={cn("font-mono font-medium text-white tabular-nums", styles.time)}>
        {displayValue}
      </span>
    </button>
  );
}

/**
 * Secondary display showing the alternate format
 */
export function TimeDisplaySecondary({
  className,
  size = "sm",
}: TimeDisplayProps) {
  const positionSamples = useTransportStore((s) => s.positionSamples);
  const sampleRate = useTransportStore((s) => s.sampleRate);
  const bpm = useTransportStore((s) => s.bpm);
  const timeSignature = useTransportStore((s) => s.timeSignature);
  const format = useTimeDisplayFormat();

  const styles = SIZE_STYLES[size];

  // Show opposite format
  const displayValue = useMemo(() => {
    if (format === "time") {
      // Primary is time, secondary is bars
      const bbt = samplesToBarsBeatsTicks(
        positionSamples,
        bpm,
        timeSignature,
        sampleRate
      );
      return `${bbt.bars}.${bbt.beats}.${bbt.ticks}`;
    } else {
      // Primary is bars, secondary is time
      const time = samplesToTimePosition(positionSamples, sampleRate);
      return `${time.minutes}:${String(time.seconds).padStart(2, "0")}`;
    }
  }, [positionSamples, sampleRate, bpm, timeSignature, format]);

  return (
    <div className={cn("text-zinc-500 font-mono tabular-nums", styles.label, className)}>
      {displayValue}
    </div>
  );
}
