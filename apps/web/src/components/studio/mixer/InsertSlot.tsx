/**
 * Insert Slot Component
 *
 * Plugin insert slot for mixer channels.
 * Features:
 * - Empty state with + button to add plugin
 * - Filled state showing plugin name
 * - Bypass toggle
 * - Click to open plugin window
 * - Right-click context menu (remove, bypass)
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { InsertSlot as InsertSlotType } from "@/types/studio";
import { Power, Plus, X, MoreVertical } from "lucide-react";

interface InsertSlotProps {
  slot: InsertSlotType;
  trackId: string;
  position: number;
  compact?: boolean;
  onLoadPlugin?: (position: number) => void;
  onOpenPlugin?: (position: number, instanceId: string) => void;
  onRemovePlugin?: (position: number) => void;
  onToggleBypass?: (position: number) => void;
  className?: string;
}

export function InsertSlot({
  slot,
  trackId,
  position,
  compact = false,
  onLoadPlugin,
  onOpenPlugin,
  onRemovePlugin,
  onToggleBypass,
  className,
}: InsertSlotProps) {
  const [showMenu, setShowMenu] = useState(false);

  const hasPlugin = slot.instanceId !== null;
  const pluginName = slot.pluginUri?.split("/").pop() || `Plugin ${position + 1}`;

  // Handle click to open plugin window
  const handleClick = useCallback(() => {
    if (!hasPlugin) {
      onLoadPlugin?.(position);
      return;
    }

    // Open plugin window via callback
    if (slot.instanceId) {
      onOpenPlugin?.(position, slot.instanceId);
    }
  }, [hasPlugin, slot.instanceId, position, onLoadPlugin, onOpenPlugin]);

  // Handle bypass toggle
  const handleBypassClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleBypass?.(position);
    },
    [position, onToggleBypass]
  );

  // Handle remove
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemovePlugin?.(position);
      setShowMenu(false);
    },
    [position, onRemovePlugin]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
  }, []);

  // Empty slot
  if (!hasPlugin) {
    return (
      <button
        className={cn(
          "w-full flex items-center justify-center gap-1 rounded border border-dashed transition-colors",
          "bg-zinc-800/50 border-zinc-700 text-zinc-600",
          "hover:border-orange-500/50 hover:text-zinc-400 hover:bg-zinc-800",
          compact ? "h-4 text-[8px]" : "h-5 text-[9px]",
          className
        )}
        onClick={handleClick}
        title={`Add plugin to slot ${position + 1}`}
      >
        <Plus className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        {!compact && <span>{position + 1}</span>}
      </button>
    );
  }

  // Filled slot
  return (
    <div className={cn("relative", className)}>
      <button
        className={cn(
          "w-full flex items-center gap-1 rounded border transition-colors",
          slot.bypass
            ? "bg-zinc-700 border-zinc-600 text-zinc-500"
            : "bg-zinc-700 border-orange-500/50 text-zinc-300",
          "hover:bg-zinc-600",
          compact ? "h-4 px-1 text-[8px]" : "h-5 px-1.5 text-[9px]"
        )}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={`${pluginName}${slot.bypass ? " (bypassed)" : ""}`}
      >
        {/* Bypass indicator */}
        <button
          className={cn(
            "shrink-0 rounded transition-colors",
            slot.bypass
              ? "text-zinc-500"
              : "text-orange-500"
          )}
          onClick={handleBypassClick}
          title={slot.bypass ? "Enable" : "Bypass"}
        >
          <Power className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </button>

        {/* Plugin name */}
        <span className="flex-1 truncate text-left">
          {pluginName}
        </span>

        {/* Menu button */}
        {!compact && (
          <button
            className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        )}
      </button>

      {/* Context menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[100px]">
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
              onClick={handleBypassClick}
            >
              <Power className="w-3 h-3" />
              {slot.bypass ? "Enable" : "Bypass"}
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
              onClick={handleRemove}
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Insert Rack Component
 *
 * A vertical stack of insert slots (typically 8 slots).
 */
interface InsertRackProps {
  slots: InsertSlotType[];
  trackId: string;
  maxSlots?: number;
  compact?: boolean;
  onLoadPlugin?: (position: number) => void;
  onOpenPlugin?: (position: number, instanceId: string) => void;
  onRemovePlugin?: (position: number) => void;
  onToggleBypass?: (position: number) => void;
  className?: string;
}

export function InsertRack({
  slots,
  trackId,
  maxSlots = 8,
  compact = false,
  onLoadPlugin,
  onOpenPlugin,
  onRemovePlugin,
  onToggleBypass,
  className,
}: InsertRackProps) {
  // Ensure we always show maxSlots slots
  const displaySlots = Array.from({ length: maxSlots }, (_, i) => {
    return slots[i] || {
      id: `empty-${trackId}-${i}`,
      position: i,
      instanceId: null,
      pluginUri: null,
      bypass: false,
    };
  });

  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1", className)}>
      {displaySlots.map((slot, i) => (
        <InsertSlot
          key={slot.id}
          slot={slot}
          trackId={trackId}
          position={i}
          compact={compact}
          onLoadPlugin={onLoadPlugin}
          onOpenPlugin={onOpenPlugin}
          onRemovePlugin={onRemovePlugin}
          onToggleBypass={onToggleBypass}
        />
      ))}
    </div>
  );
}
