/**
 * Track Lane Component
 *
 * Represents a single track row in the timeline:
 * - Left side: Track header with name, M/S/R buttons
 * - Right side: Clip area where audio clips are displayed
 *
 * Supports:
 * - Drag and drop for audio files
 * - Clip selection and manipulation
 * - Track selection
 */

"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/studio";
import { useStudioStore, useSelection, useSession } from "@/stores/studio-store";
import { useMixerStore } from "@/stores/mixer-store";
import { AudioClip } from "./AudioClip";
import { samplesToPixels, pixelsToSamples } from "@/lib/utils/time-utils";
import { storeAudioBlob } from "@/lib/storage/studio-db";
import { getStudioAudioEngine } from "@/lib/audio/studio-audio-engine";

interface TrackLaneProps {
  track: Track;
  yOffset: number;
  headerWidth: number;
  timelineWidth: number;
  pixelsPerSecond: number;
  sampleRate: number;
}

export function TrackLane({
  track,
  yOffset,
  headerWidth,
  timelineWidth,
  pixelsPerSecond,
  sampleRate,
}: TrackLaneProps) {
  const selection = useSelection();
  const session = useSession();
  const { selectTrack, addClip } = useStudioStore();
  const mixerStore = useMixerStore();
  const trackMixer = mixerStore.tracks[track.id];

  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSelected = selection.tracks.includes(track.id);
  const isMuted = trackMixer?.mute ?? track.mute;
  const isSoloed = trackMixer?.solo ?? track.solo;
  const isArmed = trackMixer?.armed ?? track.armed;

  // Handle track header click
  const handleHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectTrack(track.id, e.shiftKey || e.metaKey);
    },
    [track.id, selectTrack]
  );

  // Handle drag over for file drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("audio/")
      );

      if (files.length === 0 || !session) return;

      // Calculate drop position
      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const startSamples = Math.max(0, pixelsToSamples(dropX, pixelsPerSecond, sampleRate));

      setIsLoading(true);

      try {
        const engine = getStudioAudioEngine();

        // Process each audio file
        for (const file of files) {
          // Read file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // Store the original file blob in IndexedDB first
          // (We'll get the duration after decoding)
          const tempBlob = await storeAudioBlob(
            session.id,
            track.id,
            file.name,
            file,
            0, // Temporary duration
            sampleRate
          );

          // Load the audio buffer into the engine's cache
          const audioBuffer = await engine.loadAudioBuffer(tempBlob.id, arrayBuffer);
          if (!audioBuffer) {
            console.error("[TrackLane] Failed to decode audio file:", file.name);
            continue;
          }

          // Calculate duration in samples
          const durationSamples = audioBuffer.length;

          // Create clip in the store
          const clipName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
          addClip(track.id, clipName, tempBlob.id, startSamples, durationSamples);

          // Sync engine with updated session
          engine.syncWithSession();

          console.log(`[TrackLane] Loaded "${file.name}" (${audioBuffer.duration.toFixed(2)}s) at position ${startSamples}`);
        }
      } catch (error) {
        console.error("[TrackLane] Error loading audio file:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [session, track.id, pixelsPerSecond, sampleRate, addClip]
  );

  return (
    <div
      className="absolute left-0 right-0 flex"
      style={{
        top: yOffset,
        height: track.height,
      }}
    >
      {/* Track Header */}
      <div
        className={cn(
          "shrink-0 bg-zinc-900/80 border-b border-r border-zinc-800 p-2 flex flex-col gap-1 cursor-pointer transition-colors",
          isSelected && "bg-zinc-800/80"
        )}
        style={{
          width: headerWidth,
          borderLeft: `3px solid ${track.color}`,
        }}
        onClick={handleHeaderClick}
      >
        {/* Track Name */}
        <div className="text-sm font-medium text-white truncate">{track.name}</div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Mute */}
          <button
            className={cn(
              "h-5 w-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors",
              isMuted
                ? "bg-red-500/20 text-red-500"
                : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
            )}
            onClick={(e) => {
              e.stopPropagation();
              mixerStore.toggleTrackMute(track.id);
            }}
            title="Mute"
          >
            M
          </button>

          {/* Solo */}
          <button
            className={cn(
              "h-5 w-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors",
              isSoloed
                ? "bg-yellow-500/20 text-yellow-500"
                : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
            )}
            onClick={(e) => {
              e.stopPropagation();
              mixerStore.toggleTrackSolo(track.id);
            }}
            title="Solo"
          >
            S
          </button>

          {/* Record Arm */}
          <button
            className={cn(
              "h-5 w-5 text-[10px] font-bold rounded flex items-center justify-center transition-colors",
              isArmed
                ? "bg-red-500 text-white"
                : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
            )}
            onClick={(e) => {
              e.stopPropagation();
              mixerStore.toggleTrackArmed(track.id);
            }}
            title="Record Arm"
          >
            R
          </button>
        </div>

        {/* Optional: Volume/Pan mini display */}
        <div className="text-[9px] text-zinc-500 mt-auto">
          {trackMixer ? `${Math.round(trackMixer.volume * 100)}%` : "80%"}
        </div>
      </div>

      {/* Clip Area */}
      <div
        className={cn(
          "flex-1 relative bg-zinc-950/50 border-b border-zinc-800 transition-colors",
          isDragOver && "bg-orange-500/10"
        )}
        style={{ width: timelineWidth }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Grid lines (subtle) */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          {/* Vertical grid lines would go here based on zoom */}
        </div>

        {/* Audio Clips */}
        {track.clips.map((clip) => (
          <AudioClip
            key={clip.id}
            clip={clip}
            trackHeight={track.height}
            trackColor={track.color}
            pixelsPerSecond={pixelsPerSecond}
            sampleRate={sampleRate}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-zinc-900/50">
            <div className="text-orange-500 text-sm font-medium bg-zinc-900/90 px-3 py-1 rounded flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Loading audio...
            </div>
          </div>
        )}

        {/* Drop zone indicator */}
        {isDragOver && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-orange-500 text-sm font-medium bg-zinc-900/80 px-3 py-1 rounded">
              Drop audio file here
            </div>
          </div>
        )}

        {/* Empty state (when no clips) */}
        {track.clips.length === 0 && !isDragOver && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-zinc-700 text-xs">Drag audio files here</span>
          </div>
        )}
      </div>
    </div>
  );
}
