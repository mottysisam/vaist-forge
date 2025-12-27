/**
 * Volume Slider Component
 *
 * Vertical fader for volume control in mixer channel strips.
 * Features:
 * - Drag-based control (vertical movement)
 * - Visual track with gradient
 * - Thumb/handle indicator
 * - dB scale markings
 * - Double-click to reset to unity (0dB)
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface VolumeSliderProps {
  value: number; // 0-1 normalized (0.8 = 0dB unity)
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  showScale?: boolean;
  disabled?: boolean;
  className?: string;
}

// dB scale markings
const DB_MARKS = [
  { value: 1.0, label: "+12" },
  { value: 0.9, label: "+6" },
  { value: 0.8, label: "0" }, // Unity gain
  { value: 0.6, label: "-6" },
  { value: 0.4, label: "-12" },
  { value: 0.2, label: "-24" },
  { value: 0.0, label: "-∞" },
];

const SIZE_STYLES = {
  sm: {
    container: "w-6 h-24",
    track: "w-2",
    thumb: "w-5 h-3",
    label: "text-[8px]",
  },
  md: {
    container: "w-8 h-32",
    track: "w-3",
    thumb: "w-7 h-4",
    label: "text-[9px]",
  },
  lg: {
    container: "w-10 h-48",
    track: "w-4",
    thumb: "w-9 h-5",
    label: "text-[10px]",
  },
};

export function VolumeSlider({
  value,
  onChange,
  size = "md",
  showScale = true,
  disabled = false,
  className,
}: VolumeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const trackRef = useRef<HTMLDivElement>(null);

  const styles = SIZE_STYLES[size];

  // Sync with external value
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  // Calculate thumb position (inverted: 0 at bottom, 1 at top)
  const thumbPosition = (1 - localValue) * 100;

  // Convert value to dB for display
  const getDbDisplay = (val: number): string => {
    if (val === 0) return "-∞";
    // Simple logarithmic scale: 0.8 = 0dB (unity)
    const db = 20 * Math.log10(val / 0.8);
    if (db > 0) return `+${db.toFixed(1)}`;
    return db.toFixed(1);
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);

      // Calculate value from click position
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const newValue = Math.max(0, Math.min(1, 1 - y / rect.height));
        setLocalValue(newValue);
        onChange?.(newValue);
      }
    },
    [disabled, onChange]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const newValue = Math.max(0, Math.min(1, 1 - y / rect.height));

      setLocalValue(newValue);
      onChange?.(newValue);
    },
    [isDragging, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double-click to reset to unity (0.8 = 0dB)
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    const unityValue = 0.8;
    setLocalValue(unityValue);
    onChange?.(unityValue);
  }, [disabled, onChange]);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        disabled && "opacity-50",
        className
      )}
    >
      {/* dB Scale (left side) */}
      {showScale && (
        <div className="relative h-full flex flex-col justify-between py-1">
          {DB_MARKS.map((mark) => (
            <div
              key={mark.label}
              className={cn(
                "absolute right-0 transform -translate-y-1/2",
                styles.label,
                "text-zinc-600 font-mono tabular-nums"
              )}
              style={{ top: `${(1 - mark.value) * 100}%` }}
            >
              {mark.label}
            </div>
          ))}
        </div>
      )}

      {/* Slider Container */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          styles.container
        )}
      >
        {/* Track Background */}
        <div
          ref={trackRef}
          className={cn(
            "relative h-full rounded-full cursor-pointer",
            styles.track,
            "bg-zinc-800 border border-zinc-700",
            isDragging && "border-orange-500/50"
          )}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Unity marker (0dB at 80%) */}
          <div
            className="absolute left-0 right-0 h-px bg-orange-500/50"
            style={{ top: "20%" }} // 1 - 0.8 = 0.2 = 20%
          />

          {/* Fill (from bottom to thumb) */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-full transition-all"
            style={{
              height: `${localValue * 100}%`,
              background:
                localValue > 0.8
                  ? "linear-gradient(to top, #22c55e, #eab308, #ef4444)"
                  : "linear-gradient(to top, #22c55e 0%, #22c55e 100%)",
            }}
          />

          {/* Thumb/Handle */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 -translate-y-1/2",
              styles.thumb,
              "bg-gradient-to-b from-zinc-300 to-zinc-500",
              "border border-zinc-400 rounded-sm",
              "shadow-lg",
              isDragging && "from-orange-300 to-orange-500 border-orange-400"
            )}
            style={{ top: `${thumbPosition}%` }}
          >
            {/* Grip lines */}
            <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex flex-col gap-px">
              <div className="h-px bg-zinc-600/50" />
              <div className="h-px bg-zinc-600/50" />
            </div>
          </div>
        </div>

        {/* Value display below */}
        <div className={cn("mt-1 font-mono tabular-nums", styles.label, "text-zinc-400")}>
          {getDbDisplay(localValue)}
        </div>
      </div>
    </div>
  );
}
