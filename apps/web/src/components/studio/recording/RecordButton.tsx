/**
 * Record Button Component
 *
 * Button to start/stop recording on armed tracks.
 * Features:
 * - Visual recording indicator (pulsing red)
 * - Recording time display
 * - Pre-roll countdown option
 * - Click-to-arm / click-to-record flow
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTransportStore, useTransportState, useIsRecording } from "@/stores/transport-store";
import { useMixerStore } from "@/stores/mixer-store";
import { Circle, Square, Loader2 } from "lucide-react";

interface RecordButtonProps {
  size?: "sm" | "md" | "lg";
  showTimer?: boolean;
  showLabel?: boolean;
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    button: "p-1.5",
    icon: "w-3.5 h-3.5",
    label: "text-[10px]",
    timer: "text-[9px]",
  },
  md: {
    button: "p-2",
    icon: "w-5 h-5",
    label: "text-xs",
    timer: "text-[10px]",
  },
  lg: {
    button: "p-3",
    icon: "w-6 h-6",
    label: "text-sm",
    timer: "text-xs",
  },
};

export function RecordButton({
  size = "md",
  showTimer = true,
  showLabel = false,
  className,
}: RecordButtonProps) {
  const transportState = useTransportState();
  const isRecording = useIsRecording();
  const record = useTransportStore((s) => s.record);
  const stop = useTransportStore((s) => s.stop);
  const countInEnabled = useTransportStore((s) => s.countInEnabled);

  const mixerStore = useMixerStore();
  const tracks = mixerStore.tracks;

  // Check if any track is armed for recording
  const hasArmedTracks = Object.values(tracks).some((t) => t.armed);

  // Recording timer state
  const [recordingTime, setRecordingTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Count-in state
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInValue, setCountInValue] = useState(0);

  const styles = SIZE_STYLES[size];

  // Start/update recording timer
  useEffect(() => {
    if (isRecording) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          setRecordingTime((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else {
      // Reset timer when not recording
      startTimeRef.current = null;
      setRecordingTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Handle record button click
  const handleClick = useCallback(() => {
    if (isRecording) {
      // Stop recording
      stop();
    } else if (isCountingIn) {
      // Cancel count-in
      setIsCountingIn(false);
      setCountInValue(0);
    } else {
      // Start recording (with optional count-in)
      if (countInEnabled && hasArmedTracks) {
        // Count-in sequence
        setIsCountingIn(true);
        setCountInValue(4);

        const countDown = () => {
          setCountInValue((prev) => {
            if (prev <= 1) {
              setIsCountingIn(false);
              record();
              return 0;
            }
            setTimeout(countDown, 500); // Half second per count
            return prev - 1;
          });
        };

        setTimeout(countDown, 500);
      } else {
        record();
      }
    }
  }, [isRecording, isCountingIn, countInEnabled, hasArmedTracks, record, stop]);

  // Determine button state and style
  const getButtonStyle = () => {
    if (isCountingIn) {
      return "bg-yellow-500 text-white";
    }
    if (isRecording) {
      return "bg-red-500 text-white animate-pulse";
    }
    if (!hasArmedTracks) {
      return "bg-zinc-800 text-zinc-500 cursor-not-allowed";
    }
    return "bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-500";
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <button
        className={cn(
          "rounded-lg transition-colors flex items-center justify-center",
          styles.button,
          getButtonStyle()
        )}
        onClick={handleClick}
        disabled={!hasArmedTracks && !isRecording}
        title={
          isRecording
            ? "Stop Recording"
            : isCountingIn
            ? "Cancel Count-in"
            : hasArmedTracks
            ? "Start Recording"
            : "Arm a track to record"
        }
      >
        {isCountingIn ? (
          <span className={cn("font-bold", styles.icon.replace("w-", "text-").replace("h-", ""))}>
            {countInValue}
          </span>
        ) : isRecording ? (
          <Square className={cn(styles.icon, "fill-current")} />
        ) : (
          <Circle className={cn(styles.icon, hasArmedTracks && "fill-current")} />
        )}
      </button>

      {/* Label */}
      {showLabel && (
        <span className={cn("text-zinc-500", styles.label)}>
          {isRecording ? "STOP" : isCountingIn ? "COUNT" : "REC"}
        </span>
      )}

      {/* Recording timer */}
      {showTimer && isRecording && (
        <span className={cn("font-mono text-red-500 tabular-nums", styles.timer)}>
          {formatTime(recordingTime)}
        </span>
      )}

      {/* Count-in display */}
      {showTimer && isCountingIn && (
        <span className={cn("font-mono text-yellow-500 tabular-nums", styles.timer)}>
          Count: {countInValue}
        </span>
      )}
    </div>
  );
}

/**
 * Record Arm Button for individual tracks
 */
interface RecordArmButtonProps {
  trackId: string;
  size?: "sm" | "md";
  className?: string;
}

export function RecordArmButton({
  trackId,
  size = "sm",
  className,
}: RecordArmButtonProps) {
  const mixerStore = useMixerStore();
  const isArmed = mixerStore.tracks[trackId]?.armed ?? false;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      mixerStore.toggleTrackArmed(trackId);
    },
    [trackId, mixerStore]
  );

  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const buttonSize = size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs";

  return (
    <button
      className={cn(
        "font-bold rounded flex items-center justify-center transition-colors",
        buttonSize,
        isArmed
          ? "bg-red-500 text-white"
          : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700",
        className
      )}
      onClick={handleClick}
      title={isArmed ? "Disarm recording" : "Arm for recording"}
    >
      R
    </button>
  );
}
