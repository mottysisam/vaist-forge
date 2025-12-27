"use client";

/**
 * Plugin Window Component
 *
 * A draggable, resizable floating window for hosting plugin instances.
 * Features:
 * - Framer Motion drag-and-drop with bounds
 * - Resize handles (corner and edge)
 * - Title bar with window controls (minimize, dock, close)
 * - Z-index stacking on focus
 * - Integration with WindowManager Zustand store
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import {
  X,
  Minus,
  PanelLeftClose,
  Play,
  Square,
  Volume2,
  GripVertical,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotaryKnob } from "./rotary-knob";
import { PresetManager } from "./preset-manager";
import { cn } from "@/lib/utils";
import { useWindowManager, type PluginWindow as PluginWindowState } from "@/stores/window-manager";
import { useWamHost, usePluginInstance } from "@/lib/audio/wam-host-provider";

interface PluginWindowProps {
  window: PluginWindowState;
  onPlay?: () => void;
  onStop?: () => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;

export function PluginWindow({ window: win, onPlay, onStop }: PluginWindowProps) {
  const dragControls = useDragControls();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});

  // Window manager actions
  const {
    focusWindow,
    closeWindow,
    moveWindow,
    resizeWindow,
    minimizeWindow,
    dockWindow,
    setWindowPlaying,
  } = useWindowManager();

  // WAM host for audio
  const { connectToDestination, disconnectFromDestination } = useWamHost();
  const { instance, updateParameter } = usePluginInstance(win.instanceId);

  // Initialize parameter values from descriptor
  useEffect(() => {
    if (win.descriptor?.parameters) {
      const initialValues: Record<string, number> = {};
      for (const param of win.descriptor.parameters) {
        initialValues[param.id] = typeof param.default === "number" ? param.default : 0.5;
      }
      setParameterValues(initialValues);
    }
  }, [win.descriptor?.parameters]);

  // Handle window focus on click
  const handleWindowClick = useCallback(() => {
    focusWindow(win.id);
  }, [focusWindow, win.id]);

  // Handle drag end to update position
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const newX = win.position.x + info.offset.x;
      const newY = win.position.y + info.offset.y;
      moveWindow(win.id, { x: Math.max(0, newX), y: Math.max(0, newY) });
    },
    [moveWindow, win.id, win.position.x, win.position.y]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: win.size.width,
        height: win.size.height,
      });
    },
    [win.size.width, win.size.height]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.width + deltaX));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.height + deltaY));
      resizeWindow(win.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStart, win.id, resizeWindow]);

  // Handle play/stop toggle
  const handleTogglePlay = useCallback(() => {
    if (win.isPlaying) {
      disconnectFromDestination(win.instanceId);
      setWindowPlaying(win.id, false);
      onStop?.();
    } else {
      connectToDestination(win.instanceId);
      setWindowPlaying(win.id, true);
      onPlay?.();
    }
  }, [win.isPlaying, win.instanceId, win.id, connectToDestination, disconnectFromDestination, setWindowPlaying, onPlay, onStop]);

  // Handle parameter change
  const handleParameterChange = useCallback(
    (paramId: string, value: number) => {
      setParameterValues((prev) => ({ ...prev, [paramId]: value }));
      updateParameter(paramId, value);
    },
    [updateParameter]
  );

  // Handle loading preset (updates all parameters at once)
  const handleLoadPreset = useCallback(
    (presetParameters: Record<string, number>) => {
      // Update local state
      setParameterValues((prev) => ({ ...prev, ...presetParameters }));
      // Update all parameters in the plugin
      for (const [paramId, value] of Object.entries(presetParameters)) {
        updateParameter(paramId, value);
      }
    },
    [updateParameter]
  );

  // Don't render if minimized
  if (win.isMinimized) return null;

  return (
    <motion.div
      ref={windowRef}
      className={cn(
        "fixed forge-glass rounded-xl overflow-hidden",
        "border border-orange-900/40 shadow-2xl",
        "backdrop-blur-xl",
        "flex flex-col",
        "pointer-events-auto"
      )}
      style={{
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
        x: win.position.x,
        y: win.position.y,
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      onMouseDown={handleWindowClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Title Bar - Drag Handle */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          "bg-gradient-to-r from-zinc-900 to-zinc-800",
          "border-b border-orange-900/30",
          "cursor-grab active:cursor-grabbing select-none"
        )}
        onPointerDown={(e) => {
          focusWindow(win.id);
          dragControls.start(e);
        }}
      >
        {/* Left: Drag indicator + Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {win.title}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono truncate">
              {win.instanceId.slice(0, 30)}...
            </span>
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Play/Stop Status */}
          <div
            className={cn(
              "w-2 h-2 rounded-full mr-2 transition-colors",
              win.isPlaying ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            )}
          />

          {/* Minimize Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(win.id);
            }}
          >
            <Minus className="w-3 h-3 text-zinc-400" />
          </Button>

          {/* Dock to Sidebar Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation();
              dockWindow(win.id);
            }}
            title="Dock to sidebar"
          >
            <PanelLeftClose className="w-3 h-3 text-zinc-400" />
          </Button>

          {/* Close Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-red-900/50"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
          >
            <X className="w-3 h-3 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* Preset Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
        <PresetManager
          pluginId={win.projectId}
          versionId={win.versionId}
          currentParameters={parameterValues}
          onLoadPreset={handleLoadPreset}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Plugin Controls Grid */}
        {win.descriptor?.parameters && win.descriptor.parameters.length > 0 ? (
          <div className="space-y-4">
            {/* Parameter Knobs */}
            <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-xl border-t-4 border-forge-primary p-4 shadow-inner">
              <div className="grid grid-cols-3 gap-4">
                {win.descriptor.parameters.slice(0, 9).map((param) => (
                  <RotaryKnob
                    key={param.id}
                    value={parameterValues[param.id] ?? (typeof param.default === "number" ? param.default : 0.5)}
                    onChange={(v) => handleParameterChange(param.id, v)}
                    label={param.name}
                    size="sm"
                  />
                ))}
              </div>
            </div>

            {/* Additional Parameters (if more than 9) */}
            {win.descriptor.parameters.length > 9 && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="grid grid-cols-4 gap-3">
                  {win.descriptor.parameters.slice(9).map((param) => (
                    <RotaryKnob
                      key={param.id}
                      value={parameterValues[param.id] ?? (typeof param.default === "number" ? param.default : 0.5)}
                      onChange={(v) => handleParameterChange(param.id, v)}
                      label={param.name}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            No parameters available
          </div>
        )}
      </div>

      {/* Footer: Transport Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-t border-zinc-800">
        {/* Play/Stop Button */}
        <Button
          size="sm"
          variant={win.isPlaying ? "destructive" : "default"}
          className={cn(
            "gap-2 transition-all",
            win.isPlaying
              ? "bg-red-600 hover:bg-red-500"
              : "bg-forge-primary hover:bg-forge-glow"
          )}
          onClick={handleTogglePlay}
        >
          {win.isPlaying ? (
            <>
              <Square className="w-4 h-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Play
            </>
          )}
        </Button>

        {/* Volume Indicator */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-zinc-500" />
          <div className="w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-forge-primary"
              initial={{ width: "70%" }}
              animate={{ width: win.isPlaying ? "85%" : "70%" }}
            />
          </div>
        </div>

        {/* Instance ID */}
        <span className="text-[9px] text-zinc-600 font-mono">
          v{win.versionId.slice(0, 8)}
        </span>
      </div>

      {/* Resize Handle - Bottom Right Corner */}
      <div
        className={cn(
          "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
          "flex items-center justify-center",
          "hover:bg-forge-primary/20 rounded-tl",
          isResizing && "bg-forge-primary/30"
        )}
        onMouseDown={handleResizeStart}
      >
        <Maximize2 className="w-3 h-3 text-zinc-500 rotate-90" />
      </div>
    </motion.div>
  );
}

/**
 * Plugin Window Container
 *
 * Renders all visible plugin windows from the WindowManager store.
 * Should be placed in a portal root for proper z-index stacking.
 */
export function PluginWindowContainer() {
  const windows = useWindowManager((state) => state.windows);
  const visibleWindows = windows.filter((w) => !w.isMinimized);

  // Don't render anything if no visible windows
  if (visibleWindows.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleWindows.map((win) => (
        <PluginWindow key={win.id} window={win} />
      ))}
    </div>
  );
}
