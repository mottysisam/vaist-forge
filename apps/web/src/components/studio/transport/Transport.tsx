/**
 * Transport Component
 *
 * Main transport bar with playback controls.
 * Features:
 * - Play/Pause/Stop/Record buttons
 * - Time display (bars/time toggle)
 * - Tempo control (BPM + time signature)
 * - Loop toggle
 * - Metronome toggle
 * - Jump to start/end buttons
 */

"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTransportStore, useTransportState, useTransportLoop } from "@/stores/transport-store";
import { TimeDisplay, TimeDisplaySecondary } from "./TimeDisplay";
import { TempoControl } from "./TempoControl";
import {
  Play,
  Pause,
  Square,
  Circle,
  Repeat,
  SkipBack,
  SkipForward,
  Music2,
} from "lucide-react";

interface TransportProps {
  className?: string;
  compact?: boolean;
}

export function Transport({ className, compact = false }: TransportProps) {
  const state = useTransportState();
  const loop = useTransportLoop();

  const play = useTransportStore((s) => s.play);
  const pause = useTransportStore((s) => s.pause);
  const stop = useTransportStore((s) => s.stop);
  const record = useTransportStore((s) => s.record);
  const toggleLoop = useTransportStore((s) => s.toggleLoop);
  const toggleMetronome = useTransportStore((s) => s.toggleMetronome);
  const metronomeEnabled = useTransportStore((s) => s.metronomeEnabled);
  const jumpToStart = useTransportStore((s) => s.jumpToStart);

  const isPlaying = state === "playing";
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const isStopped = state === "stopped";

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Handle stop (also jumps to start if already stopped)
  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  // Handle record toggle
  const handleRecord = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      record();
    }
  }, [isRecording, record, stop]);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5",
          className
        )}
      >
        {/* Compact: Just basic controls */}
        <button
          className={cn(
            "p-1.5 rounded transition-colors",
            isPlaying
              ? "bg-green-500/20 text-green-500"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
          )}
          onClick={handlePlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          className={cn(
            "p-1.5 rounded transition-colors",
            "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
            isStopped && "text-zinc-600"
          )}
          onClick={handleStop}
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>

        <TimeDisplay size="sm" className="flex-1" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 bg-zinc-900 border-b border-zinc-800 px-4 py-2",
        className
      )}
    >
      {/* Left Section: Navigation */}
      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          onClick={jumpToStart}
          title="Jump to Start"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          onClick={() => {}} // Would jump to end of session
          title="Jump to End"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Center Section: Main Transport Controls */}
      <div className="flex items-center gap-2">
        {/* Stop */}
        <button
          className={cn(
            "p-2.5 rounded-lg transition-colors",
            isStopped
              ? "bg-zinc-700 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
          )}
          onClick={handleStop}
          title="Stop"
        >
          <Square className="w-5 h-5" />
        </button>

        {/* Play/Pause */}
        <button
          className={cn(
            "p-3 rounded-lg transition-colors",
            isPlaying
              ? "bg-green-500/20 text-green-500 border border-green-500/50"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-transparent"
          )}
          onClick={handlePlayPause}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>

        {/* Record */}
        <button
          className={cn(
            "p-2.5 rounded-lg transition-colors",
            isRecording
              ? "bg-red-500 text-white animate-pulse"
              : "bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-500"
          )}
          onClick={handleRecord}
          title={isRecording ? "Stop Recording" : "Record"}
        >
          <Circle className={cn("w-5 h-5", isRecording && "fill-current")} />
        </button>
      </div>

      {/* Time Display */}
      <div className="flex flex-col items-center">
        <TimeDisplay size="md" />
        <TimeDisplaySecondary size="sm" className="mt-0.5" />
      </div>

      {/* Tempo Section */}
      <div className="border-l border-zinc-700 pl-4">
        <TempoControl size="sm" />
      </div>

      {/* Right Section: Options */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Loop Toggle */}
        <button
          className={cn(
            "p-2 rounded transition-colors",
            loop.enabled
              ? "bg-orange-500/20 text-orange-500"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
          onClick={toggleLoop}
          title={loop.enabled ? "Disable Loop" : "Enable Loop"}
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Metronome Toggle */}
        <button
          className={cn(
            "p-2 rounded transition-colors",
            metronomeEnabled
              ? "bg-blue-500/20 text-blue-500"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
          onClick={toggleMetronome}
          title={metronomeEnabled ? "Disable Metronome" : "Enable Metronome"}
        >
          <Music2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Transport Controls Only (for embedding in other components)
 */
export function TransportControls({ className }: { className?: string }) {
  const state = useTransportState();
  const play = useTransportStore((s) => s.play);
  const pause = useTransportStore((s) => s.pause);
  const stop = useTransportStore((s) => s.stop);

  const isPlaying = state === "playing";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        className={cn(
          "p-1.5 rounded transition-colors",
          "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        )}
        onClick={stop}
        title="Stop"
      >
        <Square className="w-3.5 h-3.5" />
      </button>

      <button
        className={cn(
          "p-1.5 rounded transition-colors",
          isPlaying
            ? "bg-green-500/20 text-green-500"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        )}
        onClick={isPlaying ? pause : play}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
