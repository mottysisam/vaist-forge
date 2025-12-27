/**
 * Master Bus Component
 *
 * Master output channel with:
 * - Master inserts (up to 8 slots for mastering chain)
 * - Master volume fader
 * - Stereo meter
 * - Output level display
 */

"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useMixerStore } from "@/stores/mixer-store";
import { VolumeSlider } from "./VolumeSlider";
import { MeterDisplay, useSimulatedMeterLevels } from "./MeterDisplay";

interface MasterBusProps {
  compact?: boolean;
  className?: string;
}

// Insert slot for master bus
function MasterInsertSlot({
  position,
  instanceId,
  bypass,
  onOpen,
}: {
  position: number;
  instanceId: string | null;
  bypass: boolean;
  onOpen?: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full h-5 text-[9px] rounded border transition-colors truncate px-1",
        instanceId
          ? bypass
            ? "bg-zinc-700 border-zinc-600 text-zinc-500"
            : "bg-zinc-700 border-orange-500/50 text-zinc-300"
          : "bg-zinc-800 border-zinc-700 text-zinc-600 border-dashed"
      )}
      onClick={onOpen}
      title={instanceId ? `Master ${position + 1}: ${instanceId}` : `Master Insert ${position + 1} (empty)`}
    >
      {instanceId || `M${position + 1}`}
    </button>
  );
}

export function MasterBus({ compact = false, className }: MasterBusProps) {
  const mixerStore = useMixerStore();
  const masterState = mixerStore.masterBus;

  // Simulated master levels
  const levels = useSimulatedMeterLevels(true);

  const handleVolumeChange = useCallback(
    (value: number) => {
      mixerStore.setMasterVolume(value);
    },
    [mixerStore]
  );

  // Convert dB display
  const getDbDisplay = (val: number): string => {
    if (val === 0) return "-∞ dB";
    const db = 20 * Math.log10(val / 0.8);
    if (db > 0) return `+${db.toFixed(1)} dB`;
    return `${db.toFixed(1)} dB`;
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden",
        compact ? "w-20 p-1.5 gap-1" : "w-28 p-2 gap-2",
        className
      )}
    >
      {/* Master Label */}
      <div
        className="text-center font-bold border-t-2 border-orange-500"
      >
        <span className={cn("text-orange-500", compact ? "text-[10px]" : "text-xs")}>
          MASTER
        </span>
      </div>

      {/* Master Inserts */}
      {!compact && (
        <div className="flex flex-col gap-0.5">
          {(masterState.inserts || []).slice(0, 4).map((insert, i) => (
            <MasterInsertSlot
              key={insert?.id || i}
              position={i}
              instanceId={insert?.instanceId || null}
              bypass={insert?.bypass || false}
            />
          ))}
        </div>
      )}

      {/* Mute button (master doesn't have solo/arm) */}
      <div className="flex justify-center">
        <button
          className={cn(
            "font-bold rounded flex items-center justify-center transition-colors",
            compact ? "h-5 w-8 text-[9px]" : "h-6 w-12 text-xs",
            masterState.mute
              ? "bg-red-500/20 text-red-500"
              : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
          )}
          onClick={() => mixerStore.toggleMasterMute()}
          title="Mute Master"
        >
          MUTE
        </button>
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex justify-center items-end gap-1">
        {/* Volume Fader */}
        <VolumeSlider
          value={masterState.volume}
          onChange={handleVolumeChange}
          size={compact ? "sm" : "lg"}
          showScale={!compact}
        />

        {/* Stereo Level Meter */}
        <MeterDisplay
          leftLevel={levels.left * masterState.volume}
          rightLevel={levels.right * masterState.volume}
          stereo={true}
          size={compact ? "sm" : "lg"}
          showPeak={true}
          showClip={true}
        />
      </div>

      {/* Output Level Display */}
      {!compact && (
        <div className="text-center pt-1 border-t border-zinc-700">
          <span className="text-[10px] font-mono text-zinc-400">
            {getDbDisplay(masterState.volume)}
          </span>
        </div>
      )}
    </div>
  );
}
