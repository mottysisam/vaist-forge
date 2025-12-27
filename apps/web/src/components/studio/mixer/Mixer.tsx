/**
 * Mixer Component
 *
 * Main mixer container that displays all channel strips.
 * Features:
 * - Horizontal scrolling for many tracks
 * - Track channel strips
 * - Master bus
 * - View options (compact/full)
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useStudioStore, useSession, useSelection } from "@/stores/studio-store";
import { ChannelStrip } from "./ChannelStrip";
import { MasterBus } from "./MasterBus";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";

interface MixerProps {
  className?: string;
  onCollapse?: () => void;
  collapsed?: boolean;
}

export function Mixer({ className, onCollapse, collapsed = false }: MixerProps) {
  const session = useSession();
  const selection = useSelection();
  const { selectTrack } = useStudioStore();
  const [compactView, setCompactView] = useState(false);

  const tracks = session?.tracks ?? [];

  const handleTrackSelect = useCallback(
    (trackId: string) => {
      selectTrack(trackId, false);
    },
    [selectTrack]
  );

  if (collapsed) {
    return (
      <div
        className={cn(
          "h-8 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-4 cursor-pointer hover:bg-zinc-800/50 transition-colors",
          className
        )}
        onClick={onCollapse}
      >
        <span className="text-xs text-zinc-400 font-medium">Mixer</span>
        <ChevronUp className="w-4 h-4 text-zinc-500" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-900 border-t border-zinc-800",
        className
      )}
    >
      {/* Mixer Header */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">Mixer</span>
          <span className="text-[10px] text-zinc-600">
            {tracks.length} tracks
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Compact toggle */}
          <button
            className={cn(
              "p-1 rounded hover:bg-zinc-800 transition-colors",
              compactView ? "text-orange-500" : "text-zinc-500"
            )}
            onClick={() => setCompactView(!compactView)}
            title={compactView ? "Full view" : "Compact view"}
          >
            {compactView ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Collapse */}
          {onCollapse && (
            <button
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              onClick={onCollapse}
              title="Collapse mixer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Channel Strips Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full p-2 gap-1">
          {/* Track Channels */}
          {tracks.map((track) => (
            <ChannelStrip
              key={track.id}
              track={track}
              isSelected={selection.tracks.includes(track.id)}
              compact={compactView}
              onSelect={() => handleTrackSelect(track.id)}
            />
          ))}

          {/* Empty state */}
          {tracks.length === 0 && (
            <div className="flex items-center justify-center w-full text-zinc-600 text-sm">
              No tracks yet. Add a track to get started.
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1 min-w-[20px]" />

          {/* Master Bus (always visible) */}
          <MasterBus compact={compactView} />
        </div>
      </div>
    </div>
  );
}
