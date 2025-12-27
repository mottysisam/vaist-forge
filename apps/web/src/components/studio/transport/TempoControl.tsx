/**
 * Tempo Control Component
 *
 * Controls for BPM and time signature.
 * Features:
 * - Click and drag to change BPM
 * - Double-click to manually enter value
 * - Time signature selector
 * - Tap tempo button
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTransportStore } from "@/stores/transport-store";
import { ChevronDown, Activity } from "lucide-react";

interface TempoControlProps {
  className?: string;
  showTimeSig?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: {
    container: "gap-1",
    label: "text-[8px]",
    value: "text-sm",
    button: "h-5 px-1.5 text-[10px]",
  },
  md: {
    container: "gap-1.5",
    label: "text-[9px]",
    value: "text-base",
    button: "h-6 px-2 text-xs",
  },
  lg: {
    container: "gap-2",
    label: "text-xs",
    value: "text-lg",
    button: "h-7 px-3 text-sm",
  },
};

// Common time signatures
const TIME_SIGNATURES = [
  { numerator: 4, denominator: 4, label: "4/4" },
  { numerator: 3, denominator: 4, label: "3/4" },
  { numerator: 6, denominator: 8, label: "6/8" },
  { numerator: 2, denominator: 4, label: "2/4" },
  { numerator: 5, denominator: 4, label: "5/4" },
  { numerator: 7, denominator: 8, label: "7/8" },
  { numerator: 12, denominator: 8, label: "12/8" },
];

export function TempoControl({
  className,
  showTimeSig = true,
  size = "md",
}: TempoControlProps) {
  const bpm = useTransportStore((s) => s.bpm);
  const timeSignature = useTransportStore((s) => s.timeSignature);
  const setBpm = useTransportStore((s) => s.setBpm);
  const setTimeSignature = useTransportStore((s) => s.setTimeSignature);

  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editBpmValue, setEditBpmValue] = useState(String(bpm));
  const [showTimeSigMenu, setShowTimeSigMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const startY = useRef(0);
  const startBpm = useRef(0);

  const styles = SIZE_STYLES[size];

  // Handle BPM drag
  const handleBpmMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditingBpm) return;
      e.preventDefault();
      setIsDragging(true);
      startY.current = e.clientY;
      startBpm.current = bpm;
    },
    [bpm, isEditingBpm]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = startY.current - e.clientY;
      const sensitivity = 0.5;
      const newBpm = Math.max(20, Math.min(999, startBpm.current + deltaY * sensitivity));

      setBpm(Math.round(newBpm));
    },
    [isDragging, setBpm]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  // Handle BPM edit
  const handleBpmDoubleClick = useCallback(() => {
    setIsEditingBpm(true);
    setEditBpmValue(String(bpm));
  }, [bpm]);

  const handleBpmEditSubmit = useCallback(() => {
    const newBpm = parseInt(editBpmValue, 10);
    if (!isNaN(newBpm) && newBpm >= 20 && newBpm <= 999) {
      setBpm(newBpm);
    }
    setIsEditingBpm(false);
  }, [editBpmValue, setBpm]);

  const handleBpmEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleBpmEditSubmit();
      } else if (e.key === "Escape") {
        setIsEditingBpm(false);
      }
    },
    [handleBpmEditSubmit]
  );

  // Tap tempo
  const handleTapTempo = useCallback(() => {
    const now = Date.now();

    // Clear old taps after 2 seconds
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    const newTapTimes = [...tapTimes, now].slice(-8); // Keep last 8 taps
    setTapTimes(newTapTimes);

    if (newTapTimes.length >= 2) {
      // Calculate average interval
      let totalInterval = 0;
      for (let i = 1; i < newTapTimes.length; i++) {
        totalInterval += newTapTimes[i] - newTapTimes[i - 1];
      }
      const avgInterval = totalInterval / (newTapTimes.length - 1);
      const newBpm = Math.round(60000 / avgInterval);

      if (newBpm >= 20 && newBpm <= 999) {
        setBpm(newBpm);
      }
    }

    tapTimeoutRef.current = setTimeout(() => {
      setTapTimes([]);
    }, 2000);
  }, [tapTimes, setBpm]);

  // Handle time signature selection
  const handleTimeSigSelect = useCallback(
    (ts: { numerator: number; denominator: number }) => {
      setTimeSignature(ts);
      setShowTimeSigMenu(false);
    },
    [setTimeSignature]
  );

  const currentTimeSigLabel = `${timeSignature.numerator}/${timeSignature.denominator}`;

  return (
    <div className={cn("flex items-center", styles.container, className)}>
      {/* BPM Control */}
      <div className="flex flex-col items-center">
        <span className={cn("text-zinc-500 uppercase tracking-wider", styles.label)}>
          BPM
        </span>

        {isEditingBpm ? (
          <input
            type="number"
            value={editBpmValue}
            onChange={(e) => setEditBpmValue(e.target.value)}
            onBlur={handleBpmEditSubmit}
            onKeyDown={handleBpmEditKeyDown}
            className={cn(
              "w-16 bg-zinc-800 border border-orange-500 rounded text-center text-white font-mono",
              styles.value
            )}
            min={20}
            max={999}
            autoFocus
          />
        ) : (
          <button
            className={cn(
              "font-mono font-medium text-white tabular-nums cursor-ns-resize",
              "hover:text-orange-400 transition-colors",
              isDragging && "text-orange-500",
              styles.value
            )}
            onMouseDown={handleBpmMouseDown}
            onDoubleClick={handleBpmDoubleClick}
            title="Drag to change, double-click to edit"
          >
            {bpm}
          </button>
        )}
      </div>

      {/* Tap Tempo Button */}
      <button
        className={cn(
          "bg-zinc-800 border border-zinc-700 rounded flex items-center gap-1",
          "hover:border-zinc-600 hover:bg-zinc-700 active:bg-orange-500/20 active:border-orange-500",
          "transition-colors",
          styles.button
        )}
        onClick={handleTapTempo}
        title="Tap to set tempo"
      >
        <Activity className="w-3 h-3" />
        <span className="hidden sm:inline">TAP</span>
      </button>

      {/* Time Signature */}
      {showTimeSig && (
        <div className="relative">
          <button
            className={cn(
              "flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded",
              "hover:border-zinc-600 transition-colors",
              styles.button
            )}
            onClick={() => setShowTimeSigMenu(!showTimeSigMenu)}
          >
            <span className="font-mono">{currentTimeSigLabel}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Time signature dropdown */}
          {showTimeSigMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTimeSigMenu(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[60px]">
                {TIME_SIGNATURES.map((ts) => (
                  <button
                    key={ts.label}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-700 font-mono",
                      ts.numerator === timeSignature.numerator &&
                        ts.denominator === timeSignature.denominator
                        ? "text-orange-500"
                        : "text-zinc-300"
                    )}
                    onClick={() => handleTimeSigSelect(ts)}
                  >
                    {ts.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
