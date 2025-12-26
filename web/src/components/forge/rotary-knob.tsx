"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RotaryKnobProps {
  value: number;           // 0-1 normalized
  onChange?: (value: number) => void;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: { knob: "w-10 h-10", indicator: "h-3", label: "text-[9px]" },
  md: { knob: "w-14 h-14", indicator: "h-4", label: "text-[10px]" },
  lg: { knob: "w-20 h-20", indicator: "h-5", label: "text-xs" },
};

export function RotaryKnob({
  value,
  onChange,
  label,
  size = "md",
  className,
  disabled = false,
}: RotaryKnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startValue = useRef(0);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Convert value (0-1) to rotation degrees (-135 to 135)
  const rotation = localValue * 270 - 135;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = localValue;
  }, [disabled, localValue]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startY.current - e.clientY;
    const sensitivity = 0.005;
    const newValue = Math.max(0, Math.min(1, startValue.current + deltaY * sensitivity));

    setLocalValue(newValue);
    onChange?.(newValue);
  }, [isDragging, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const sizes = sizeClasses[size];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Knob Container */}
      <motion.div
        ref={knobRef}
        className={cn(
          sizes.knob,
          "relative rounded-full cursor-pointer select-none",
          "bg-gradient-to-b from-zinc-700 to-zinc-900",
          "border-2 border-zinc-600",
          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)]",
          isDragging && "border-forge-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onMouseDown={handleMouseDown}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
      >
        {/* Outer Ring Glow */}
        {isDragging && (
          <motion.div
            className="absolute -inset-1 rounded-full border border-forge-primary/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}

        {/* Knob Face */}
        <div
          className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-800 flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Indicator Line */}
          <div
            className={cn(
              sizes.indicator,
              "w-1 bg-forge-primary rounded-full absolute top-2",
              "shadow-[0_0_8px_rgba(255,92,0,0.6)]"
            )}
          />
        </div>

        {/* Center Dot */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-zinc-950 border border-zinc-700" />
        </div>
      </motion.div>

      {/* Label */}
      <span className={cn(sizes.label, "text-zinc-500 uppercase tracking-wider font-medium")}>
        {label}
      </span>

      {/* Value Display */}
      <span className="text-[9px] text-forge-primary font-mono">
        {Math.round(localValue * 100)}%
      </span>
    </div>
  );
}
