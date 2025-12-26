"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Volume2, Zap, Waves, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotaryKnob } from "./rotary-knob";
import { cn } from "@/lib/utils";
import type { PluginControl } from "@/types/project";

interface MiniStudioProps {
  pluginName: string;
  pluginId: string;
  controls: PluginControl[];
  onControlChange?: (controlId: string, value: number) => void;
  className?: string;
}

export function MiniStudio({
  pluginName,
  pluginId,
  controls,
  onControlChange,
  className,
}: MiniStudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(64).fill(0));
  const [controlValues, setControlValues] = useState<Record<string, number>>(
    Object.fromEntries(controls.map((c) => [c.id, c.value]))
  );
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulate audio visualization
  useEffect(() => {
    if (!isPlaying) {
      setAudioData(new Array(64).fill(0));
      return;
    }

    const animate = () => {
      setAudioData((prev) =>
        prev.map((_, i) => {
          // Create a more musical-looking waveform
          const baseFreq = Math.sin(Date.now() * 0.002 + i * 0.3) * 0.3;
          const harmonic = Math.sin(Date.now() * 0.005 + i * 0.5) * 0.2;
          const noise = Math.random() * 0.1;
          const envelope = Math.sin(i / 64 * Math.PI) * 0.8;
          return Math.abs((baseFreq + harmonic + noise) * envelope);
        })
      );
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
      const barHeight = value * height * 0.9;
      const x = i * barWidth;
      const y = height - barHeight;

      // Bar with rounded top
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

  const handleControlChange = useCallback(
    (controlId: string, value: number) => {
      setControlValues((prev) => ({ ...prev, [controlId]: value }));
      onControlChange?.(controlId, value);
    },
    [onControlChange]
  );

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
            <span className="text-[9px] text-zinc-600 font-mono">SPECTRUM</span>
          </div>
          <div className="absolute top-2 right-3">
            <span className="text-[9px] text-zinc-600 font-mono">48kHz / 24bit</span>
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
              onClick={() => setIsPlaying(!isPlaying)}
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
          vAIst Forge Engine // Simulated Audio Preview
        </p>
      </div>
    </motion.div>
  );
}
