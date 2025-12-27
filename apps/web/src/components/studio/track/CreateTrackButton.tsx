/**
 * Create Track Button Component
 *
 * Button to add new tracks to the session.
 * Supports different track types (audio, bus).
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/stores/studio-store";
import { Plus, Music, GitBranch, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateTrackButtonProps {
  variant?: "icon" | "full" | "compact";
  className?: string;
}

// Track type options
const trackTypes = [
  {
    type: "audio" as const,
    label: "Audio Track",
    description: "Record or import audio",
    icon: Music,
  },
  {
    type: "bus" as const,
    label: "Bus Track",
    description: "Group and route tracks",
    icon: GitBranch,
  },
];

export function CreateTrackButton({
  variant = "icon",
  className,
}: CreateTrackButtonProps) {
  const { addTrack } = useStudioStore();
  const [showMenu, setShowMenu] = useState(false);

  // Quick add (audio track)
  const handleQuickAdd = useCallback(() => {
    addTrack("audio");
  }, [addTrack]);

  // Add specific type
  const handleAddType = useCallback(
    (type: "audio" | "bus") => {
      addTrack(type);
      setShowMenu(false);
    },
    [addTrack]
  );

  // Icon variant - just a + button
  if (variant === "icon") {
    return (
      <div className={cn("relative", className)}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleQuickAdd}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowMenu(true);
          }}
          title="Add Track (right-click for options)"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {/* Context menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]">
              {trackTypes.map((trackType) => {
                const Icon = trackType.icon;
                return (
                  <button
                    key={trackType.type}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700"
                    onClick={() => handleAddType(trackType.type)}
                  >
                    <Icon className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-xs text-zinc-200">{trackType.label}</div>
                      <div className="text-[10px] text-zinc-500">{trackType.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Compact variant - button with dropdown
  if (variant === "compact") {
    return (
      <div className={cn("relative", className)}>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 border-zinc-700"
          onClick={() => setShowMenu(!showMenu)}
        >
          <Plus className="h-3 w-3" />
          <span className="text-xs">Add</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]">
              {trackTypes.map((trackType) => {
                const Icon = trackType.icon;
                return (
                  <button
                    key={trackType.type}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700"
                    onClick={() => handleAddType(trackType.type)}
                  >
                    <Icon className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-xs text-zinc-200">{trackType.label}</div>
                      <div className="text-[10px] text-zinc-500">{trackType.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Full variant - prominent button with options
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="outline"
        className="w-full justify-start gap-2 border-dashed border-zinc-700 hover:border-orange-500/50 hover:bg-orange-500/5"
        onClick={handleQuickAdd}
      >
        <Plus className="h-4 w-4 text-orange-500" />
        <span>Add Audio Track</span>
      </Button>

      <div className="flex gap-2">
        {trackTypes.map((trackType) => {
          const Icon = trackType.icon;
          return (
            <button
              key={trackType.type}
              className="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border border-zinc-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors"
              onClick={() => handleAddType(trackType.type)}
            >
              <Icon className="w-5 h-5 text-orange-500" />
              <span className="text-xs text-zinc-400">{trackType.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
