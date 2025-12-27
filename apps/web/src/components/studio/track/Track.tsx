/**
 * Track Component
 *
 * Dedicated track header/info component.
 * Displays track name, color, and quick controls (M/S/R).
 * Used in both timeline TrackLane and mixer ChannelStrip.
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Track as TrackType } from "@/types/studio";
import { useStudioStore } from "@/stores/studio-store";
import { useMixerStore } from "@/stores/mixer-store";
import { Pencil, Trash2, ChevronDown } from "lucide-react";

interface TrackProps {
  track: TrackType;
  isSelected?: boolean;
  showControls?: boolean;
  showMenu?: boolean;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  onSelect?: () => void;
  className?: string;
}

export function Track({
  track,
  isSelected = false,
  showControls = true,
  showMenu = false,
  orientation = "horizontal",
  size = "md",
  onSelect,
  className,
}: TrackProps) {
  const { renameTrack, removeTrack } = useStudioStore();
  const mixerStore = useMixerStore();
  const trackMixer = mixerStore.tracks[track.id];

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const [showDropdown, setShowDropdown] = useState(false);

  const isMuted = trackMixer?.mute ?? track.mute;
  const isSoloed = trackMixer?.solo ?? track.solo;
  const isArmed = trackMixer?.armed ?? track.armed;

  // Size-based styling
  const sizeStyles = {
    sm: {
      container: "p-1.5",
      name: "text-xs",
      button: "h-4 w-4 text-[8px]",
      volume: "text-[8px]",
    },
    md: {
      container: "p-2",
      name: "text-sm",
      button: "h-5 w-5 text-[10px]",
      volume: "text-[9px]",
    },
    lg: {
      container: "p-3",
      name: "text-base",
      button: "h-6 w-6 text-xs",
      volume: "text-xs",
    },
  };

  const styles = sizeStyles[size];

  // Handle name edit
  const handleNameSubmit = useCallback(() => {
    if (editName.trim() && editName !== track.name) {
      renameTrack(track.id, editName.trim());
    } else {
      setEditName(track.name);
    }
    setIsEditing(false);
  }, [editName, track.id, track.name, renameTrack]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleNameSubmit();
      } else if (e.key === "Escape") {
        setEditName(track.name);
        setIsEditing(false);
      }
    },
    [handleNameSubmit, track.name]
  );

  // Handle delete
  const handleDelete = useCallback(() => {
    if (confirm(`Delete track "${track.name}"?`)) {
      removeTrack(track.id);
    }
    setShowDropdown(false);
  }, [track.id, track.name, removeTrack]);

  return (
    <div
      className={cn(
        "flex gap-1 cursor-pointer transition-colors",
        orientation === "vertical" ? "flex-col items-center" : "flex-col",
        isSelected ? "bg-zinc-800/80" : "bg-zinc-900/80 hover:bg-zinc-800/50",
        styles.container,
        className
      )}
      style={{
        borderLeft: orientation === "horizontal" ? `3px solid ${track.color}` : undefined,
        borderTop: orientation === "vertical" ? `3px solid ${track.color}` : undefined,
      }}
      onClick={onSelect}
    >
      {/* Track Name */}
      <div className="flex items-center gap-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className={cn(
              "bg-zinc-800 border border-zinc-600 rounded px-1 text-white w-full",
              styles.name
            )}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn("font-medium text-white truncate flex-1", styles.name)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title={track.name}
          >
            {track.name}
          </span>
        )}

        {/* Menu dropdown */}
        {showMenu && (
          <div className="relative">
            <button
              className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                      setShowDropdown(false);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                    Rename
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      {showControls && (
        <div className={cn("flex items-center gap-1", orientation === "vertical" && "flex-col")}>
          {/* Mute */}
          <button
            className={cn(
              "font-bold rounded flex items-center justify-center transition-colors",
              styles.button,
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
              "font-bold rounded flex items-center justify-center transition-colors",
              styles.button,
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
              "font-bold rounded flex items-center justify-center transition-colors",
              styles.button,
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
      )}

      {/* Volume display */}
      {showControls && orientation === "horizontal" && (
        <div className={cn("text-zinc-500 mt-auto", styles.volume)}>
          {trackMixer ? `${Math.round(trackMixer.volume * 100)}%` : "80%"}
        </div>
      )}
    </div>
  );
}
