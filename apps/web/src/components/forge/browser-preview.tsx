"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Loader2,
  AlertCircle,
  Globe,
  Cpu,
  PanelRightOpen,
} from "lucide-react";
import { WaveformDisplay, useAudioBuffer } from "./waveform-display";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PluginPlan, PluginParameter } from "@/lib/api-client";
import { useWindowManager } from "@/stores/window-manager";
import { useWamHost } from "@/lib/audio/wam-host-provider";

interface BrowserPreviewProps {
  plan: PluginPlan;
  projectId?: string;
  versionId?: string;
  wasmUrl?: string | null;
  wasmReady?: boolean;  // WASM is ready for preview (may be true while VST3 still building)
  buildStatus?: 'BUILDING' | 'SUCCESS' | 'FAILED' | null;  // Overall build status
  className?: string;
}

type PreviewState = "idle" | "loading" | "ready" | "playing" | "error";

/**
 * Browser Preview Component
 *
 * Loads a WASM-compiled audio plugin and runs it in the browser using
 * Web Audio API + AudioWorklet. This enables real-time preview of
 * AI-generated plugins without native compilation.
 *
 * Requirements:
 * - SharedArrayBuffer support (COOP/COEP headers required)
 * - Modern browser with AudioWorklet support
 * - WASM module compiled with Emscripten
 */
export function BrowserPreview({ plan, projectId, versionId, wasmUrl, wasmReady = false, buildStatus, className }: BrowserPreviewProps) {
  const [state, setState] = useState<PreviewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sharedArraySupported, setSharedArraySupported] = useState<boolean | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  // WASM Studio: Window manager for floating windows
  const { openWindow, getWindowByInstanceId } = useWindowManager();
  const { initialize: initializeWamHost, loadPlugin, state: wamHostState } = useWamHost();

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Low-latency parameter updates via SharedArrayBuffer + Atomics
  // Note: Atomics only works with integer typed arrays, so we use Int32Array
  // and convert float values to/from their bit representation
  const parameterBufferRef = useRef<Int32Array | null>(null);
  const parameterIdsRef = useRef<string[]>([]);

  // Decode audio buffer for waveform visualization
  const { audioBuffer } = useAudioBuffer(audioContextRef.current, audioFile);

  // Helper to convert float to int32 bits (for Atomics.store)
  const floatToInt32Bits = (value: number): number => {
    const buffer = new ArrayBuffer(4);
    new Float32Array(buffer)[0] = value;
    return new Int32Array(buffer)[0];
  };

  // Check for SharedArrayBuffer support on mount
  useEffect(() => {
    const checkSupport = () => {
      try {
        // SharedArrayBuffer requires COOP/COEP headers
        const supported = typeof SharedArrayBuffer !== "undefined";
        setSharedArraySupported(supported);
      } catch {
        setSharedArraySupported(false);
      }
    };
    checkSupport();
  }, []);

  // Track playback time for waveform display
  useEffect(() => {
    if (!isPlaying || !audioBuffer) return;

    const updateTime = () => {
      const elapsed = (performance.now() - playbackStartTimeRef.current) / 1000;
      const newTime = (playbackOffsetRef.current + elapsed) % audioBuffer.duration;
      setCurrentTime(newTime);
    };

    const intervalId = setInterval(updateTime, 50); // Update 20 times per second
    return () => clearInterval(intervalId);
  }, [isPlaying, audioBuffer]);

  // Initialize default parameter values from plan
  useEffect(() => {
    const defaults: Record<string, number> = {};
    for (const param of plan.parameters) {
      if (typeof param.default === "number") {
        defaults[param.id] = param.default;
      }
    }
    setParameters(defaults);
  }, [plan.parameters]);

  /**
   * Initialize the Web Audio context and load the WASM worklet
   */
  const initAudio = useCallback(async () => {
    if (state === "loading" || state === "ready") return;

    setState("loading");
    setError(null);

    try {
      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      // Create gain node for mute control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = isMuted ? 0 : 1;
      gainNode.connect(audioContext.destination);
      gainNodeRef.current = gainNode;

      // Load the AudioWorklet processor
      await audioContext.audioWorklet.addModule("/wam/vaist-worklet.js");

      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, "vaist-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      workletNode.port.onmessage = (event) => {
        const { type, message } = event.data;
        if (type === "error") {
          setError(message);
          setState("error");
        } else if (type === "initialized") {
          console.log("WASM processor initialized");
        }
      };

      workletNode.connect(gainNode);
      workletNodeRef.current = workletNode;

      // If WASM URL provided, load and init the module
      if (wasmUrl) {
        const response = await fetch(wasmUrl);
        const wasmBytes = await response.arrayBuffer();

        workletNode.port.postMessage({
          type: "init",
          data: {
            wasmBytes,
            descriptor: {
              parameters: plan.parameters,
              explanation: plan.explanation,
            },
          },
        });
      }

      // Setup SharedArrayBuffer for low-latency parameter updates (if supported)
      if (sharedArraySupported && plan.parameters.length > 0) {
        try {
          // Create SharedArrayBuffer for all parameters (4 bytes each)
          const buffer = new SharedArrayBuffer(plan.parameters.length * 4);
          // Use Int32Array for Atomics (required - Atomics doesn't support Float32Array)
          const int32View = new Int32Array(buffer);
          const paramIds = plan.parameters.map(p => p.id);

          // Initialize with default values (convert float to int32 bits)
          plan.parameters.forEach((p, i) => {
            const defaultVal = typeof p.default === "number" ? p.default : 0.5;
            Atomics.store(int32View, i, floatToInt32Bits(defaultVal));
          });

          // Store refs for use in updateParameter
          parameterBufferRef.current = int32View;
          parameterIdsRef.current = paramIds;

          // Send to worklet (worklet reads as Float32Array via reinterpret cast)
          workletNode.port.postMessage({
            type: "setParameterBuffer",
            data: { buffer, parameterIds: paramIds },
          });

          console.log("SharedArrayBuffer parameter updates enabled (low-latency mode)");
        } catch (err) {
          console.warn("SharedArrayBuffer setup failed, using MessagePort fallback:", err);
          parameterBufferRef.current = null;
        }
      }

      // Set initial parameter values (MessagePort fallback for non-SAB browsers)
      for (const [id, value] of Object.entries(parameters)) {
        workletNode.port.postMessage({
          type: "setParameter",
          data: { id, value },
        });
      }

      setState("ready");
    } catch (err) {
      console.error("Audio init failed:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize audio");
      setState("error");
    }
  }, [state, isMuted, wasmUrl, plan, parameters, sharedArraySupported]);

  /**
   * Handle audio file upload
   */
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioFile(file);

    // Initialize audio if not already done
    if (!audioContextRef.current) {
      await initAudio();
    }
  }, [initAudio]);

  /**
   * Play/pause the audio
   */
  const togglePlayback = useCallback(async () => {
    if (!audioContextRef.current || !audioFile) return;

    if (isPlaying) {
      // Store current position for resume
      const elapsed = (performance.now() - playbackStartTimeRef.current) / 1000;
      playbackOffsetRef.current = (playbackOffsetRef.current + elapsed) % (audioBuffer?.duration || 1);
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    try {
      const audioContext = audioContextRef.current;

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Load and decode audio file
      const arrayBuffer = await audioFile.arrayBuffer();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.loop = true;

      // Connect through worklet if available
      if (workletNodeRef.current) {
        source.connect(workletNodeRef.current);
      } else if (gainNodeRef.current) {
        source.connect(gainNodeRef.current);
      }

      // Start from current offset position
      source.start(0, playbackOffsetRef.current);
      sourceNodeRef.current = source;
      playbackStartTimeRef.current = performance.now();
      setIsPlaying(true);

      source.onended = () => {
        setIsPlaying(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }, [audioFile, isPlaying, audioBuffer]);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (gainNodeRef.current) {
      const newMuted = !isMuted;
      gainNodeRef.current.gain.value = newMuted ? 0 : 1;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  /**
   * Seek to a specific time in the audio
   */
  const handleSeek = useCallback(async (seekTime: number) => {
    if (!audioContextRef.current || !audioFile || !audioBuffer) return;

    // Update offset
    playbackOffsetRef.current = seekTime;
    setCurrentTime(seekTime);

    // If playing, restart from new position
    if (isPlaying) {
      sourceNodeRef.current?.stop();

      try {
        const audioContext = audioContextRef.current;
        const arrayBuffer = await audioFile.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = decodedBuffer;
        source.loop = true;

        if (workletNodeRef.current) {
          source.connect(workletNodeRef.current);
        } else if (gainNodeRef.current) {
          source.connect(gainNodeRef.current);
        }

        source.start(0, seekTime);
        sourceNodeRef.current = source;
        playbackStartTimeRef.current = performance.now();

        source.onended = () => {
          setIsPlaying(false);
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Seek failed");
      }
    }
  }, [audioFile, audioBuffer, isPlaying]);

  /**
   * Update a parameter value
   * Uses Atomics.store() for low-latency updates when SharedArrayBuffer is available,
   * otherwise falls back to MessagePort (higher latency, may cause zipper noise)
   */
  const updateParameter = useCallback((id: string, value: number) => {
    setParameters((prev) => ({ ...prev, [id]: value }));

    // Try Atomics first (low-latency, no zipper noise)
    if (parameterBufferRef.current && parameterIdsRef.current.length > 0) {
      const index = parameterIdsRef.current.indexOf(id);
      if (index !== -1) {
        // Convert float to int32 bits for atomic storage
        Atomics.store(parameterBufferRef.current, index, floatToInt32Bits(value));
        return; // Done - worklet reads via Float32Array reinterpret cast
      }
    }

    // Fallback to MessagePort (works everywhere but higher latency)
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({
        type: "setParameter",
        data: { id, value },
      });
    }
  }, [floatToInt32Bits]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      try {
        sourceNodeRef.current?.stop();
      } catch {
        // Ignore if already stopped
      }
      audioContextRef.current?.close();
    };
  }, []);

  /**
   * Open plugin in a floating WASM Studio window
   */
  const handleOpenInWindow = useCallback(async () => {
    if (!projectId || !versionId || !wasmUrl) return;

    try {
      // Initialize WAM host if needed
      if (!wamHostState.isInitialized) {
        await initializeWamHost();
      }

      // Load the plugin via WAM host
      const instance = await loadPlugin(projectId, versionId, wasmUrl, plan);
      if (!instance) {
        setError("Failed to load plugin instance");
        return;
      }

      // Open window for this plugin instance
      openWindow({
        instanceId: instance.id,
        projectId,
        versionId,
        title: plan.explanation.slice(0, 50) || "Plugin Preview",
        descriptor: plan,
      });

      console.log("[BrowserPreview] Opened plugin in floating window:", instance.id);
    } catch (err) {
      console.error("[BrowserPreview] Failed to open in window:", err);
      setError(err instanceof Error ? err.message : "Failed to open plugin window");
    }
  }, [projectId, versionId, wasmUrl, plan, wamHostState.isInitialized, initializeWamHost, loadPlugin, openWindow]);

  // Check if this plugin is already open in a window
  const existingWindowInstanceId = projectId && versionId
    ? `${projectId}:${versionId}:` // Prefix match for any timestamp
    : null;
  const hasOpenWindow = existingWindowInstanceId
    ? !!getWindowByInstanceId(existingWindowInstanceId.slice(0, -1))
    : false;

  // Don't render if no WASM URL and in production
  if (!wasmUrl && process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Card className={cn("forge-glass overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Browser Preview
            </CardTitle>
            <CardDescription>
              Test your plugin in the browser using WebAssembly
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Open in Floating Window Button */}
            {wasmReady && wasmUrl && projectId && versionId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenInWindow}
                className="gap-1.5 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500/50"
                title="Open in floating window"
              >
                <PanelRightOpen className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-orange-400">Open in Window</span>
              </Button>
            )}
            {/* WASM Status Badge */}
            <div
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                wasmReady || state === "ready" || state === "playing"
                  ? "bg-green-500/20 text-green-400"
                  : state === "loading"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : state === "error"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-zinc-500/20 text-zinc-400"
              )}
            >
              <Cpu className="w-3 h-3 inline mr-1" />
              {wasmReady || state === "ready" || state === "playing"
                ? "WASM Ready"
                : state === "loading"
                  ? "Loading..."
                  : state === "error"
                    ? "Error"
                    : "Waiting..."}
            </div>
            {/* VST3 Build Status (shown when WASM is ready but VST3 still building) */}
            {wasmReady && buildStatus === 'BUILDING' && (
              <div className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                VST3 Building...
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* SharedArrayBuffer Warning */}
        {sharedArraySupported === false && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
          >
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium">Limited Performance Mode</p>
              <p className="text-yellow-200/70 mt-1">
                SharedArrayBuffer is not available. Audio processing may have higher latency.
                For best performance, ensure COOP/COEP headers are configured.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-200">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Upload */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-12 border-dashed border-zinc-600 hover:border-blue-500/50 hover:bg-blue-500/5"
          >
            <Upload className="w-4 h-4 mr-2" />
            {audioFile ? audioFile.name : "Upload Audio File"}
          </Button>
        </div>

        {/* Waveform Display */}
        {audioFile && (
          <WaveformDisplay
            audioBuffer={audioBuffer}
            currentTime={currentTime}
            duration={audioBuffer?.duration || 0}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            height={80}
            className="mt-2"
          />
        )}

        {/* Playback Controls */}
        <div className="flex gap-3">
          <Button
            onClick={togglePlayback}
            disabled={!audioFile || state === "loading"}
            className={cn(
              "flex-1 h-11",
              isPlaying
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            )}
          >
            {state === "loading" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {state === "loading" ? "Loading..." : isPlaying ? "Stop" : "Play"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            className="h-11 w-11 border-zinc-600"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Parameter Controls */}
        {plan.parameters.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-medium text-muted-foreground">Parameters</h4>
            <div className="space-y-4">
              {plan.parameters.map((param) => (
                <ParameterSlider
                  key={param.id}
                  param={param}
                  value={parameters[param.id] ?? (typeof param.default === "number" ? param.default : 0.5)}
                  onChange={(value) => updateParameter(param.id, value)}
                  disabled={state === "loading"}
                />
              ))}
            </div>
          </div>
        )}

        {/* Status Notice */}
        {!wasmReady && !wasmUrl && (
          <div className="text-center text-sm text-muted-foreground py-2">
            {buildStatus === 'BUILDING'
              ? "WASM preview loading... (typically 2-3 minutes)"
              : "WASM preview will be available after the build starts"}
          </div>
        )}
        {wasmReady && buildStatus === 'BUILDING' && (
          <div className="text-center text-sm text-blue-400/80 py-2">
            Preview ready! VST3 native build continues in background (~10-15 min)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Parameter slider component
 */
function ParameterSlider({
  param,
  value,
  onChange,
  disabled,
}: {
  param: PluginParameter;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const min = typeof param.min === "number" ? param.min : 0;
  const max = typeof param.max === "number" ? param.max : 1;

  const displayValue = param.unit
    ? `${value.toFixed(2)}${param.unit}`
    : value.toFixed(2);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-300">{param.name}</span>
        <span className="text-zinc-500 font-mono">{displayValue}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={(max - min) / 100}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
