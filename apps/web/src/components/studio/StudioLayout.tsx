/**
 * Studio Layout
 *
 * Main shell for the WASM Studio DAW with 3-panel layout:
 * - Top: Transport bar (play/stop/record, time display, tempo)
 * - Center: Timeline with tracks
 * - Bottom: Mixer panel (channel strips, master)
 *
 * Layout is resizable between timeline and mixer.
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSession, useStudioStore } from "@/stores/studio-store";
import { useTransportStore } from "@/stores/transport-store";
import { useMixerStore } from "@/stores/mixer-store";
import {
  Play,
  Pause,
  Square,
  Circle,
  SkipBack,
  Repeat,
  Plus,
  Settings,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timeline } from "./timeline";
import { InsertRack, PluginBrowser } from "./mixer";
import { useWamHost } from "@/lib/audio/wam-host-provider";
import type { InsertSlot as InsertSlotType } from "@/types/studio";
import type { PluginPlan } from "@/lib/api-client";

/**
 * Transport Bar Component
 */
function TransportBar() {
  const {
    state,
    positionSamples,
    sampleRate,
    bpm,
    timeSignature,
    loop,
    metronomeEnabled,
    play,
    pause,
    stop,
    record,
    toggleLoop,
    toggleMetronome,
    jumpToStart,
    setBpm,
  } = useTransportStore();

  const isPlaying = state === "playing";
  const isRecording = state === "recording";

  // Format time display
  const formatTime = (samples: number) => {
    const seconds = samples / sampleRate;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  // Format bars:beats
  const formatBars = (samples: number) => {
    const beatsPerBar = timeSignature.numerator;
    const samplesPerBeat = (sampleRate * 60) / bpm;
    const samplesPerBar = samplesPerBeat * beatsPerBar;

    const bar = Math.floor(samples / samplesPerBar) + 1;
    const beat = Math.floor((samples % samplesPerBar) / samplesPerBeat) + 1;

    return `${bar}:${beat}`;
  };

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4">
      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={jumpToStart}
          title="Jump to Start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={stop}
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-10 w-10",
            isPlaying && "bg-green-500/20 text-green-500"
          )}
          onClick={isPlaying ? pause : play}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            isRecording && "bg-red-500/20 text-red-500 animate-pulse"
          )}
          onClick={record}
          title="Record"
        >
          <Circle className="h-4 w-4" fill={isRecording ? "currentColor" : "none"} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", loop.enabled && "text-orange-500")}
          onClick={toggleLoop}
          title="Loop"
        >
          <Repeat className="h-4 w-4" />
        </Button>
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-950 rounded-lg font-mono">
        <div className="text-xl text-white tabular-nums">
          {formatBars(positionSamples)}
        </div>
        <div className="text-sm text-zinc-500 tabular-nums">
          {formatTime(positionSamples)}
        </div>
      </div>

      {/* Tempo */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(parseFloat(e.target.value) || 120)}
          className="w-16 h-8 px-2 bg-zinc-800 border border-zinc-700 rounded text-center text-sm text-white"
          min={20}
          max={999}
        />
        <span className="text-xs text-zinc-500">BPM</span>
      </div>

      {/* Time Signature */}
      <div className="text-sm text-zinc-400">
        {timeSignature.numerator}/{timeSignature.denominator}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Metronome */}
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", metronomeEnabled && "text-orange-500")}
        onClick={toggleMetronome}
        title="Metronome"
      >
        <Volume2 className="h-4 w-4" />
      </Button>

      {/* Settings */}
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Settings">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Toolbar Component (between transport and timeline)
 */
function Toolbar() {
  const addTrack = useStudioStore((s) => s.addTrack);
  const { zoomIn, zoomOut, toggleSnap, timelineView } = useStudioStore();
  const { toggleTimeDisplayFormat, timeDisplayFormat } = useTransportStore();

  return (
    <div className="h-8 bg-zinc-900/50 border-b border-zinc-800 flex items-center px-3 gap-2">
      {/* Add Track */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => addTrack()}
        title="Add Track"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-zinc-700" />

      {/* Zoom Controls */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={zoomOut}
        title="Zoom Out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={zoomIn}
        title="Zoom In"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-zinc-700" />

      {/* Snap Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 px-2 text-[10px]",
          timelineView.snapEnabled && "bg-orange-500/20 text-orange-500"
        )}
        onClick={toggleSnap}
        title="Toggle Snap"
      >
        SNAP
      </Button>

      {/* Time Format Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px]"
        onClick={toggleTimeDisplayFormat}
        title="Toggle Time Format"
      >
        {timeDisplayFormat === "bars" ? "BARS" : "TIME"}
      </Button>

      <div className="flex-1" />

      {/* Zoom Level Display */}
      <span className="text-[10px] text-zinc-500">
        {Math.round(timelineView.pixelsPerSecond)}px/s
      </span>
    </div>
  );
}

// Plugin project type for browser
interface PluginProject {
  id: string;
  name: string;
  prompt: string;
  status: string;
  plan: PluginPlan | null;
  hasArtifact: boolean;
  wasmArtifactKey?: string;
  createdAt: string;
}

/**
 * Mixer Panel
 */
function MixerPanel() {
  const session = useSession();
  const tracks = session?.tracks ?? [];
  const { masterBus } = useMixerStore();
  const setTrackInsert = useStudioStore((s) => s.setTrackInsert);
  const { initialize: initWamHost, loadPlugin, state: wamState } = useWamHost();

  // Plugin browser dialog state
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [selectedSlotPosition, setSelectedSlotPosition] = useState<number>(0);
  const [loadingPlugin, setLoadingPlugin] = useState(false);

  // Handle opening plugin browser for a slot
  const handleLoadPlugin = useCallback((trackId: string, position: number) => {
    setSelectedTrackId(trackId);
    setSelectedSlotPosition(position);
    setBrowserOpen(true);
  }, []);

  // Handle plugin selection from browser
  const handleSelectPlugin = useCallback(
    async (project: PluginProject) => {
      if (!project.plan || !selectedTrackId) return;

      setLoadingPlugin(true);

      try {
        // Initialize WAM host if needed
        if (!wamState.isInitialized) {
          await initWamHost();
        }

        // Construct WASM URL
        const wasmUrl = `/api/projects/${project.id}/wasm`;

        // Load plugin via WamHost
        const instance = await loadPlugin(
          project.id,
          "latest",
          wasmUrl,
          project.plan
        );

        if (instance) {
          // Update the insert slot with plugin info
          setTrackInsert(
            selectedTrackId,
            selectedSlotPosition,
            instance.id,
            `vaist://${project.id}`
          );

          console.log("[MixerPanel] Plugin loaded:", instance.id);
        }
      } catch (error) {
        console.error("[MixerPanel] Failed to load plugin:", error);
      } finally {
        setLoadingPlugin(false);
        setBrowserOpen(false);
      }
    },
    [selectedTrackId, selectedSlotPosition, wamState.isInitialized, initWamHost, loadPlugin, setTrackInsert]
  );

  return (
    <>
      <div className="h-full bg-zinc-900 border-t border-zinc-800 flex overflow-x-auto">
        {/* Channel Strips */}
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            trackId={track.id}
            name={track.name}
            color={track.color}
            inserts={track.inserts || []}
            onLoadPlugin={handleLoadPlugin}
          />
        ))}

        {/* Master Strip */}
        <div className="w-20 shrink-0 border-l-2 border-orange-500/50 bg-zinc-900/80 p-2 flex flex-col items-center">
          <div className="text-[10px] font-medium text-orange-500 mb-2">MASTER</div>

          {/* Volume Fader Placeholder */}
          <div className="flex-1 w-3 bg-zinc-800 rounded-full relative">
            <div
              className="absolute bottom-0 left-0 right-0 bg-orange-500 rounded-full transition-all"
              style={{ height: `${masterBus.volume * 100}%` }}
            />
          </div>

          {/* dB Display */}
          <div className="text-[10px] text-zinc-500 mt-1 tabular-nums">
            {(20 * Math.log10(masterBus.volume)).toFixed(1)} dB
          </div>
        </div>
      </div>

      {/* Plugin Browser Dialog */}
      <PluginBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelectPlugin={handleSelectPlugin}
        trackId={selectedTrackId}
        slotPosition={selectedSlotPosition}
      />
    </>
  );
}

/**
 * Channel Strip Component
 */
function ChannelStrip({
  trackId,
  name,
  color,
  inserts,
  onLoadPlugin,
}: {
  trackId: string;
  name: string;
  color: string;
  inserts: InsertSlotType[];
  onLoadPlugin: (trackId: string, position: number) => void;
}) {
  const mixerStore = useMixerStore();
  const trackMixer = mixerStore.tracks[trackId];

  const volume = trackMixer?.volume ?? 0.8;
  const isMuted = trackMixer?.mute ?? false;
  const isSoloed = trackMixer?.solo ?? false;

  return (
    <div
      className="w-20 shrink-0 border-r border-zinc-800 p-2 flex flex-col"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Track Name */}
      <div className="text-[10px] font-medium text-zinc-400 truncate w-full text-center mb-1">
        {name}
      </div>

      {/* M/S Buttons */}
      <div className="flex justify-center gap-0.5 mb-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-4 w-4 text-[8px] font-bold p-0",
            isMuted && "bg-red-500/20 text-red-500"
          )}
          onClick={() => mixerStore.toggleTrackMute(trackId)}
        >
          M
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-4 w-4 text-[8px] font-bold p-0",
            isSoloed && "bg-yellow-500/20 text-yellow-500"
          )}
          onClick={() => mixerStore.toggleTrackSolo(trackId)}
        >
          S
        </Button>
      </div>

      {/* Insert Rack (4 slots for compact view) */}
      <InsertRack
        slots={inserts}
        trackId={trackId}
        maxSlots={4}
        compact
        onLoadPlugin={(position) => onLoadPlugin(trackId, position)}
        className="mb-1"
      />

      {/* Volume Fader */}
      <div className="flex-1 flex justify-center">
        <div className="w-2 bg-zinc-800 rounded-full relative">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
            style={{
              height: `${volume * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      {/* dB Display */}
      <div className="text-[9px] text-zinc-600 mt-1 tabular-nums text-center">
        {volume > 0 ? (20 * Math.log10(volume)).toFixed(0) : "-∞"}
      </div>
    </div>
  );
}

/**
 * Main Studio Layout Component
 */
export function StudioLayout() {
  const session = useSession();
  const [mixerHeight, setMixerHeight] = useState(192);
  const [isDragging, setIsDragging] = useState(false);

  // Handle mixer resize
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;

      setMixerHeight(Math.max(100, Math.min(400, newHeight)));
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className="h-screen flex flex-col bg-zinc-950 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Transport Bar */}
      <TransportBar />

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Timeline */}
        <Timeline className="flex-1" />

        {/* Resize Handle */}
        <div
          className="h-1 bg-zinc-800 hover:bg-orange-500/50 cursor-row-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Mixer */}
        <div style={{ height: mixerHeight }}>
          <MixerPanel />
        </div>
      </div>

      {/* Session Name */}
      <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center">
        <span className="text-[10px] text-zinc-600">
          {session?.name ?? "No Session"} • WASM Studio
        </span>
      </div>
    </div>
  );
}
