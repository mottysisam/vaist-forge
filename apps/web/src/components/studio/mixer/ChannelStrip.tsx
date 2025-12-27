/**
 * Channel Strip Component
 *
 * Full mixer channel strip for a single track.
 * Combines:
 * - Track name/color
 * - Input selector (for recording)
 * - Insert slots (up to 8 plugin slots)
 * - Pan knob
 * - Mute/Solo/Arm buttons
 * - Volume fader
 * - Level meter
 * - Output routing
 */

"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/studio";
import { useMixerStore } from "@/stores/mixer-store";
import { VolumeSlider } from "./VolumeSlider";
import { MeterDisplay, useSimulatedMeterLevels } from "./MeterDisplay";
import { RotaryKnob } from "@/components/forge/rotary-knob";

interface ChannelStripProps {
  track: Track;
  isSelected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  className?: string;
}

// Insert slot component (simplified - full version in Week 4)
function InsertSlot({
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
      title={instanceId ? `Slot ${position + 1}: ${instanceId}` : `Insert ${position + 1} (empty)`}
    >
      {instanceId || `+${position + 1}`}
    </button>
  );
}

export function ChannelStrip({
  track,
  isSelected = false,
  compact = false,
  onSelect,
  className,
}: ChannelStripProps) {
  const mixerStore = useMixerStore();
  const trackMixer = mixerStore.tracks[track.id] || {
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
  };

  // Simulated levels for now (would come from audio engine in production)
  const levels = useSimulatedMeterLevels(!trackMixer.mute);

  const handleVolumeChange = useCallback(
    (value: number) => {
      mixerStore.setTrackVolume(track.id, value);
    },
    [mixerStore, track.id]
  );

  const handlePanChange = useCallback(
    (value: number) => {
      // Convert 0-1 to -1 to +1
      const pan = value * 2 - 1;
      mixerStore.setTrackPan(track.id, pan);
    },
    [mixerStore, track.id]
  );

  // Convert pan from -1..+1 to 0..1 for knob
  const panKnobValue = (trackMixer.pan + 1) / 2;

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden transition-colors",
        isSelected && "border-orange-500/50 bg-zinc-900/80",
        compact ? "w-16 p-1.5 gap-1" : "w-24 p-2 gap-2",
        className
      )}
      onClick={onSelect}
    >
      {/* Track Name Header */}
      <div
        className="text-center truncate font-medium"
        style={{ borderTop: `2px solid ${track.color}` }}
      >
        <span className={cn("text-white", compact ? "text-[9px]" : "text-xs")}>
          {track.name}
        </span>
      </div>

      {/* Insert Slots (show 4 in compact, 8 in full) */}
      {!compact && (
        <div className="flex flex-col gap-0.5">
          {track.inserts.slice(0, 4).map((insert, i) => (
            <InsertSlot
              key={insert.id}
              position={i}
              instanceId={insert.instanceId}
              bypass={insert.bypass}
            />
          ))}
        </div>
      )}

      {/* Pan Knob */}
      <div className="flex justify-center">
        <RotaryKnob
          value={panKnobValue}
          onChange={handlePanChange}
          label="Pan"
          size="sm"
        />
      </div>

      {/* Mute/Solo/Arm Buttons */}
      <div className="flex justify-center gap-1">
        <button
          className={cn(
            "font-bold rounded flex items-center justify-center transition-colors",
            compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[10px]",
            trackMixer.mute
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

        <button
          className={cn(
            "font-bold rounded flex items-center justify-center transition-colors",
            compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[10px]",
            trackMixer.solo
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

        <button
          className={cn(
            "font-bold rounded flex items-center justify-center transition-colors",
            compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[10px]",
            trackMixer.armed
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

      {/* Fader + Meter Section */}
      <div className="flex-1 flex justify-center items-end gap-1">
        {/* Volume Fader */}
        <VolumeSlider
          value={trackMixer.volume}
          onChange={handleVolumeChange}
          size={compact ? "sm" : "md"}
          showScale={!compact}
        />

        {/* Level Meter */}
        <MeterDisplay
          leftLevel={levels.left * trackMixer.volume}
          rightLevel={levels.right * trackMixer.volume}
          stereo={!compact}
          size={compact ? "sm" : "md"}
          showPeak={true}
          showClip={true}
        />
      </div>

      {/* Output Routing (non-compact only) */}
      {!compact && (
        <div className="pt-1 border-t border-zinc-800">
          <select
            className="w-full h-5 text-[9px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 px-1"
            value={track.outputTarget}
            onChange={(e) => {
              // Would call store action to change output
            }}
          >
            <option value="master">Master</option>
            {/* Bus tracks would be listed here */}
          </select>
        </div>
      )}
    </div>
  );
}
