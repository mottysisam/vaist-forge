"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Square,
  Volume2,
  Zap,
  Waves,
  Activity,
  Upload,
  Music,
  FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotaryKnob } from "./rotary-knob";
import { cn } from "@/lib/utils";
import type { PluginControl } from "@/types/project";

// Import Tone.js types
import * as Tone from "tone";

interface MiniStudioProps {
  pluginName: string;
  pluginId: string;
  controls: PluginControl[];
  onControlChange?: (controlId: string, value: number) => void;
  className?: string;
}

// Helper to find control value by name pattern
function findControlValue(
  controls: PluginControl[],
  controlValues: Record<string, number>,
  patterns: string[]
): number {
  for (const pattern of patterns) {
    const control = controls.find((c) =>
      c.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (control) {
      return controlValues[control.id] ?? control.value;
    }
  }
  return 0.5; // default
}

export function MiniStudio({
  pluginName,
  pluginId,
  controls,
  onControlChange,
  className,
}: MiniStudioProps) {
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Visualization state
  const [audioData, setAudioData] = useState<number[]>(new Array(64).fill(0));
  const [controlValues, setControlValues] = useState<Record<string, number>>(
    Object.fromEntries(controls.map((c) => [c.id, c.value]))
  );

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Tone.js refs
  const playerRef = useRef<Tone.Player | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  const distortionRef = useRef<Tone.Distortion | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);

  // Initialize Tone.js on first user interaction
  const initializeAudio = useCallback(async () => {
    if (isAudioReady) return;

    try {
      await Tone.start();
      console.log("Audio context started");

      // Create effects chain
      analyzerRef.current = new Tone.Analyser("waveform", 64);
      distortionRef.current = new Tone.Distortion(0.4);
      filterRef.current = new Tone.Filter(2000, "lowpass");
      gainRef.current = new Tone.Gain(0.7);

      // Connect effects chain: source -> distortion -> filter -> gain -> analyzer -> output
      distortionRef.current.connect(filterRef.current);
      filterRef.current.connect(gainRef.current);
      gainRef.current.connect(analyzerRef.current);
      analyzerRef.current.toDestination();

      // Create fallback synth
      synthRef.current = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
      }).connect(distortionRef.current);

      setIsAudioReady(true);
      setAudioError(null);
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      setAudioError("Failed to initialize audio engine");
    }
  }, [isAudioReady]);

  // Stop playback - defined before handleFileUpload which uses it
  const stopPlayback = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    if (sequenceRef.current) {
      sequenceRef.current.stop();
      sequenceRef.current.dispose();
      sequenceRef.current = null;
    }
    Tone.getTransport().stop();
    setIsPlaying(false);
    // Reset visualization when stopping
    setAudioData(new Array(64).fill(0));
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ["audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg)$/i)) {
        setAudioError("Please upload a WAV, MP3, or OGG file");
        return;
      }

      try {
        // Initialize audio if not already done
        await initializeAudio();

        // Stop any current playback
        if (isPlaying) {
          stopPlayback();
        }

        // Dispose of old player
        if (playerRef.current) {
          playerRef.current.dispose();
          playerRef.current = null;
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Create new player with the audio buffer
        const audioUrl = URL.createObjectURL(file);
        playerRef.current = new Tone.Player({
          url: audioUrl,
          loop: true,
          onload: () => {
            console.log(`Loaded audio file: ${file.name}`);
            setAudioFileName(file.name);
            setAudioError(null);

            // Connect to effects chain
            if (distortionRef.current) {
              playerRef.current?.connect(distortionRef.current);
            }
          },
          onerror: (error) => {
            console.error("Error loading audio:", error);
            setAudioError("Failed to decode audio file");
          },
        });

        // Decode for duration info
        const audioContext = Tone.getContext().rawContext;
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        setAudioBuffer(decodedBuffer);
      } catch (error) {
        console.error("Error loading audio file:", error);
        setAudioError("Failed to load audio file");
      }
    },
    [initializeAudio, isPlaying, stopPlayback]
  );

  // Start playback
  const startPlayback = useCallback(async () => {
    await initializeAudio();

    if (audioBuffer && playerRef.current) {
      // Play loaded sample
      playerRef.current.start();
    } else if (synthRef.current) {
      // Play fallback synth sequence
      const notes = ["C3", "E3", "G3", "B3", "C4", "B3", "G3", "E3"];
      sequenceRef.current = new Tone.Sequence(
        (time, note) => {
          synthRef.current?.triggerAttackRelease(note, "8n", time);
        },
        notes,
        "4n"
      ).start(0);
      Tone.getTransport().start();
    }

    setIsPlaying(true);
  }, [audioBuffer, initializeAudio]);

  // Toggle playback
  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      await startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  // Update effects based on control values
  useEffect(() => {
    if (!isAudioReady) return;

    // Map common control names to effect parameters
    const driveValue = findControlValue(controls, controlValues, [
      "drive",
      "gain",
      "amount",
      "intensity",
      "saturation",
    ]);
    const toneValue = findControlValue(controls, controlValues, [
      "tone",
      "color",
      "filter",
      "cutoff",
      "brightness",
    ]);
    const mixValue = findControlValue(controls, controlValues, [
      "mix",
      "wet",
      "blend",
      "dry/wet",
    ]);
    const outputValue = findControlValue(controls, controlValues, [
      "output",
      "volume",
      "level",
      "master",
    ]);

    // Update distortion
    if (distortionRef.current) {
      distortionRef.current.distortion = driveValue;
      distortionRef.current.wet.value = mixValue;
    }

    // Update filter (map 0-1 to 200Hz-8000Hz)
    if (filterRef.current) {
      const frequency = 200 + toneValue * 7800;
      filterRef.current.frequency.value = frequency;
    }

    // Update output gain
    if (gainRef.current) {
      gainRef.current.gain.value = outputValue * 0.8;
    }
  }, [controlValues, controls, isAudioReady]);

  // Real-time waveform visualization
  useEffect(() => {
    if (!isPlaying || !analyzerRef.current) {
      return;
    }

    const animate = () => {
      if (analyzerRef.current) {
        const waveform = analyzerRef.current.getValue() as Float32Array;
        // Normalize and convert to positive values for visualization
        const normalizedData = Array.from(waveform).map((v) =>
          Math.abs(v as number)
        );
        setAudioData(normalizedData);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Draw bars
    const barWidth = width / audioData.length;
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "#ff3d00");
    gradient.addColorStop(0.5, "#ff5c00");
    gradient.addColorStop(1, "#ff8a00");

    ctx.fillStyle = gradient;

    audioData.forEach((value, i) => {
      const barHeight = Math.min(value * height * 2, height * 0.9);
      const x = i * barWidth;
      const y = height - barHeight;

      ctx.beginPath();
      ctx.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
      ctx.fill();
    });

    // Add glow effect when playing
    if (isPlaying) {
      ctx.shadowColor = "#ff5c00";
      ctx.shadowBlur = 15;
    }
  }, [audioData, isPlaying]);

  // Handle control changes
  const handleControlChange = useCallback(
    (controlId: string, value: number) => {
      setControlValues((prev) => ({ ...prev, [controlId]: value }));
      onControlChange?.(controlId, value);
    },
    [onControlChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      synthRef.current?.dispose();
      distortionRef.current?.dispose();
      filterRef.current?.dispose();
      gainRef.current?.dispose();
      analyzerRef.current?.dispose();
      sequenceRef.current?.dispose();
    };
  }, []);

  return (
    <motion.div
      className={cn(
        "forge-glass rounded-2xl overflow-hidden",
        "border border-orange-900/30",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-900/20 bg-black/30">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-forge-primary" />
          <div>
            <h3 className="text-orange-400 font-mono text-xs uppercase tracking-wider">
              Virtual Rack v1.0
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">{pluginId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              isPlaying ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-mono uppercase",
              isPlaying ? "text-green-500" : "text-zinc-600"
            )}
          >
            {isPlaying ? "ENGINE ONLINE" : "STANDBY"}
          </span>
        </div>
      </div>

      {/* Audio Source Controls */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-zinc-800">
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,.wav,.mp3,.ogg"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <Upload className="w-4 h-4 mr-2" />
            Load Sample
          </Button>
          <div className="flex-1 flex items-center gap-2 text-xs text-zinc-500 truncate">
            {audioFileName ? (
              <>
                <FileAudio className="w-4 h-4 text-forge-primary flex-shrink-0" />
                <span className="truncate">{audioFileName}</span>
                {audioBuffer && (
                  <span className="text-zinc-600">
                    ({audioBuffer.duration.toFixed(1)}s)
                  </span>
                )}
              </>
            ) : (
              <>
                <Music className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                <span>No sample loaded (using synth)</span>
              </>
            )}
          </div>
        </div>
        {audioError && (
          <p className="mt-2 text-xs text-red-500 text-center">{audioError}</p>
        )}
      </div>

      {/* Visualizer */}
      <div className="p-4">
        <div className="relative bg-black/50 rounded-lg border border-zinc-800 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
          {/* Screen Bezel Effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 to-transparent h-1/3" />

          <canvas
            ref={canvasRef}
            width={500}
            height={100}
            className="w-full h-24"
          />

          {/* Overlay Labels */}
          <div className="absolute top-2 left-3 flex items-center gap-2">
            <Waves className="w-3 h-3 text-forge-primary/50" />
            <span className="text-[9px] text-zinc-600 font-mono">
              {isPlaying ? "LIVE WAVEFORM" : "SPECTRUM"}
            </span>
          </div>
          <div className="absolute top-2 right-3">
            <span className="text-[9px] text-zinc-600 font-mono">
              {audioBuffer ? `${audioBuffer.sampleRate}Hz` : "48kHz"} / 24bit
            </span>
          </div>

          {/* Grid Lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-px bg-zinc-800/50 absolute top-1/4" />
            <div className="w-full h-px bg-zinc-800/50 absolute top-1/2" />
            <div className="w-full h-px bg-zinc-800/50 absolute top-3/4" />
          </div>
        </div>
      </div>

      {/* Plugin Module */}
      <div className="px-4 pb-4">
        <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-xl border-t-4 border-forge-primary p-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          {/* Module Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-forge-glow" />
              <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
                {pluginName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-forge-primary" />
              <div className="w-2 h-2 rounded-full bg-forge-glow/50" />
            </div>
          </div>

          {/* Knobs Grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-6 mb-6">
            {controls.map((control) => (
              <RotaryKnob
                key={control.id}
                value={controlValues[control.id] ?? control.value}
                onChange={(v) => handleControlChange(control.id, v)}
                label={control.name}
                size="md"
              />
            ))}
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-zinc-700">
            <Button
              size="icon"
              variant={isPlaying ? "destructive" : "default"}
              className={cn(
                "w-12 h-12 rounded-full transition-all",
                isPlaying
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-forge-primary hover:bg-forge-glow forge-glow"
              )}
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <Square className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-lg">
              <Volume2 className="w-4 h-4 text-zinc-500" />
              <div className="w-20 h-1 bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-forge-primary"
                  initial={{ width: "70%" }}
                  animate={{ width: isPlaying ? "85%" : "70%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-zinc-800/50 bg-black/20">
        <p className="text-[9px] text-zinc-600 text-center font-mono">
          vAIst Forge Engine // {audioFileName ? "Sample Playback" : "Synth Demo"} Mode
        </p>
      </div>
    </motion.div>
  );
}
