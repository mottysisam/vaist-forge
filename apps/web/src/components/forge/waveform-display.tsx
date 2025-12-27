"use client";

/**
 * Waveform Display Component
 *
 * Canvas-based audio waveform visualization with:
 * - Real-time waveform rendering from audio buffer
 * - Playback position indicator
 * - Click-to-seek functionality
 * - Responsive scaling
 * - GPU-accelerated Canvas 2D rendering
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface WaveformDisplayProps {
  /** Audio buffer to visualize (decoded audio data) */
  audioBuffer: AudioBuffer | null;
  /** Current playback position in seconds */
  currentTime?: number;
  /** Total duration in seconds */
  duration?: number;
  /** Whether audio is currently playing */
  isPlaying?: boolean;
  /** Callback when user clicks to seek */
  onSeek?: (time: number) => void;
  /** Height of the waveform display */
  height?: number;
  /** Primary waveform color */
  waveColor?: string;
  /** Played portion color */
  progressColor?: string;
  /** Playhead color */
  playheadColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Additional CSS classes */
  className?: string;
}

export function WaveformDisplay({
  audioBuffer,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
  height = 80,
  waveColor = "rgba(59, 130, 246, 0.6)", // blue-500/60
  progressColor = "rgba(249, 115, 22, 0.8)", // orange-500/80
  playheadColor = "#f97316", // orange-500
  backgroundColor = "rgba(24, 24, 27, 0.8)", // zinc-900/80
  className,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(400);

  /**
   * Extract waveform data from audio buffer
   * Downsamples to canvas width for efficient rendering
   */
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData(null);
      return;
    }

    // Use first channel (mono or left)
    const channelData = audioBuffer.getChannelData(0);
    const samples = channelData.length;

    // Downsample to reasonable resolution (1 sample per pixel max)
    const samplesPerPixel = Math.max(1, Math.floor(samples / canvasWidth));
    const numBars = Math.ceil(samples / samplesPerPixel);
    const peaks = new Float32Array(numBars);

    // Calculate peak values for each bar
    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, samples);
      let max = 0;

      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }

      peaks[i] = max;
    }

    setWaveformData(peaks);
  }, [audioBuffer, canvasWidth]);

  /**
   * Handle container resize
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setCanvasWidth(Math.floor(width * window.devicePixelRatio));
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  /**
   * Render waveform to canvas
   */
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Set canvas resolution for sharp rendering
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear with background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    if (!waveformData || waveformData.length === 0) {
      // Draw placeholder when no audio
      ctx.fillStyle = "rgba(113, 113, 122, 0.3)"; // zinc-500/30
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("No audio loaded", displayWidth / 2, displayHeight / 2);
      return;
    }

    const barWidth = displayWidth / waveformData.length;
    const centerY = displayHeight / 2;
    const maxBarHeight = displayHeight * 0.9;

    // Calculate playhead position
    const progress = duration > 0 ? currentTime / duration : 0;
    const playheadX = progress * displayWidth;

    // Draw waveform bars
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * barWidth;
      const barHeight = waveformData[i] * maxBarHeight;

      // Determine color based on playhead position
      const isPlayed = x < playheadX;
      ctx.fillStyle = isPlayed ? progressColor : waveColor;

      // Draw symmetric bar (top + bottom)
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(1, barWidth - 1),
        barHeight
      );
    }

    // Draw playhead line
    if (duration > 0) {
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, displayHeight);
      ctx.stroke();

      // Playhead circle
      ctx.fillStyle = playheadColor;
      ctx.beginPath();
      ctx.arc(playheadX, 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, waveColor, progressColor, playheadColor, backgroundColor]);

  /**
   * Animation loop for smooth playhead movement
   */
  useEffect(() => {
    const animate = () => {
      drawWaveform();
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animate();
    } else {
      drawWaveform();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawWaveform, isPlaying]);

  /**
   * Initial draw and re-draw on data change
   */
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  /**
   * Handle click to seek
   */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSeek || !duration) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = x / rect.width;
      const seekTime = progress * duration;

      onSeek(Math.max(0, Math.min(seekTime, duration)));
    },
    [onSeek, duration]
  );

  /**
   * Handle mouse hover for seek preview
   */
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!duration) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverPosition(x);
    },
    [duration]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg",
        "border border-zinc-700/50",
        onSeek && "cursor-pointer",
        className
      )}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full"
        style={{ display: "block" }}
      />

      {/* Hover indicator */}
      {hoverPosition !== null && onSeek && duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
          style={{ left: hoverPosition }}
        />
      )}

      {/* Time display */}
      {duration > 0 && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-mono text-zinc-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
    </div>
  );
}

/**
 * Format time in mm:ss format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Mini Waveform Component
 *
 * Compact version for use in sidebars and cards
 */
export function MiniWaveform({
  audioBuffer,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  className,
}: Pick<WaveformDisplayProps, "audioBuffer" | "currentTime" | "duration" | "isPlaying" | "className">) {
  return (
    <WaveformDisplay
      audioBuffer={audioBuffer}
      currentTime={currentTime}
      duration={duration}
      isPlaying={isPlaying}
      height={40}
      waveColor="rgba(113, 113, 122, 0.5)"
      progressColor="rgba(249, 115, 22, 0.7)"
      backgroundColor="transparent"
      className={className}
    />
  );
}

/**
 * Hook to decode audio file into AudioBuffer
 */
export function useAudioBuffer(audioContext: AudioContext | null, file: File | null) {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioContext || !file) {
      setAudioBuffer(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);

        if (!cancelled) {
          setAudioBuffer(decoded);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to decode audio");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioContext, file]);

  return { audioBuffer, isLoading, error };
}
