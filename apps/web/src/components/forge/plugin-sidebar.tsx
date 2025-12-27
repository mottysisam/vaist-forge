"use client";

/**
 * Plugin Sidebar Component
 *
 * A collapsible sidebar for managing docked plugins and minimized windows.
 * Features:
 * - Docked plugin quick controls
 * - Minimized window restoration
 * - Sidebar collapse/expand toggle
 * - Quick access to plugin parameters
 */

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  Maximize2,
  X,
  Play,
  Square,
  Zap,
  Music,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWindowManager,
  useMinimizedWindows,
  useDockedPlugins,
  useSelectedDocked,
} from "@/stores/window-manager";
import { RotaryKnob } from "./rotary-knob";

interface PluginSidebarProps {
  className?: string;
}

export function PluginSidebar({ className }: PluginSidebarProps) {
  const {
    sidebarExpanded,
    toggleSidebar,
    undockPlugin,
    selectDockedPlugin,
    selectedDockedId,
    restoreWindow,
    closeWindow,
  } = useWindowManager();

  const minimizedWindows = useMinimizedWindows();
  const dockedPlugins = useDockedPlugins();
  const selectedDocked = useSelectedDocked();

  // Local state for parameter values in docked view
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>({});

  const handleParamChange = useCallback(
    (dockedId: string, paramId: string, value: number) => {
      setParamValues((prev) => ({
        ...prev,
        [dockedId]: { ...prev[dockedId], [paramId]: value },
      }));
    },
    []
  );

  // Calculate total items
  const totalItems = minimizedWindows.length + dockedPlugins.length;

  return (
    <motion.div
      className={cn(
        "fixed right-0 top-16 bottom-0",
        "flex flex-col",
        "bg-zinc-950/95 backdrop-blur-xl",
        "border-l border-orange-900/30",
        "shadow-2xl z-40",
        className
      )}
      animate={{ width: sidebarExpanded ? 280 : 48 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        {sidebarExpanded && (
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Layers className="w-4 h-4 text-forge-primary" />
            <span className="text-sm font-medium text-zinc-300">
              Plugin Rack
            </span>
            {totalItems > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-forge-primary/20 text-forge-primary rounded-full">
                {totalItems}
              </span>
            )}
          </motion.div>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 hover:bg-zinc-800"
          onClick={toggleSidebar}
        >
          {sidebarExpanded ? (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Minimized Windows Section */}
        {minimizedWindows.length > 0 && (
          <div className="border-b border-zinc-800">
            {sidebarExpanded && (
              <div className="px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Minimized
              </div>
            )}
            <div className="p-2 space-y-1">
              {minimizedWindows.map((win) => (
                <motion.div
                  key={win.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer",
                    "bg-zinc-800/50 hover:bg-zinc-800 transition-colors",
                    "border border-zinc-700/50"
                  )}
                  onClick={() => restoreWindow(win.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-md bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Music className="w-4 h-4 text-forge-primary" />
                  </div>

                  {sidebarExpanded && (
                    <>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-300 truncate">
                          {win.title}
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              win.isPlaying ? "bg-green-500" : "bg-zinc-600"
                            )}
                          />
                          <span className="text-[9px] text-zinc-500">
                            {win.isPlaying ? "Playing" : "Paused"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6 hover:bg-zinc-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreWindow(win.id);
                          }}
                          title="Restore window"
                        >
                          <Maximize2 className="w-3 h-3 text-zinc-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6 hover:bg-red-900/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeWindow(win.id);
                          }}
                          title="Close"
                        >
                          <X className="w-3 h-3 text-zinc-400" />
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Docked Plugins Section */}
        {dockedPlugins.length > 0 && (
          <div>
            {sidebarExpanded && (
              <div className="px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Docked Plugins
              </div>
            )}
            <div className="p-2 space-y-1">
              {dockedPlugins.map((docked) => (
                <motion.div
                  key={docked.id}
                  className={cn(
                    "rounded-lg cursor-pointer overflow-hidden",
                    "bg-zinc-800/50 hover:bg-zinc-800/80 transition-colors",
                    "border border-zinc-700/50",
                    selectedDockedId === docked.id && "border-forge-primary/50"
                  )}
                  onClick={() => selectDockedPlugin(docked.id)}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 p-2">
                    <div className="w-8 h-8 rounded-md bg-gradient-to-br from-forge-primary/30 to-forge-glow/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-forge-primary" />
                    </div>

                    {sidebarExpanded && (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-300 truncate">
                            {docked.title}
                          </div>
                          <span className="text-[9px] text-zinc-500">
                            {docked.descriptor?.parameters?.length || 0} params
                          </span>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6 hover:bg-zinc-700 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            undockPlugin(docked.id);
                          }}
                          title="Undock to window"
                        >
                          <PanelRightOpen className="w-3 h-3 text-zinc-400" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Expanded Controls (when selected) */}
                  <AnimatePresence>
                    {sidebarExpanded && selectedDockedId === docked.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-zinc-700/50 overflow-hidden"
                      >
                        <div className="p-3 space-y-3">
                          {/* Quick Controls - First 4 params */}
                          {docked.descriptor?.parameters && docked.descriptor.parameters.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                              {docked.descriptor.parameters.slice(0, 4).map((param) => (
                                <RotaryKnob
                                  key={param.id}
                                  value={
                                    paramValues[docked.id]?.[param.id] ??
                                    (typeof param.default === "number" ? param.default : 0.5)
                                  }
                                  onChange={(v) =>
                                    handleParamChange(docked.id, param.id, v)
                                  }
                                  label={param.name}
                                  size="sm"
                                />
                              ))}
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-700/30">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-zinc-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                undockPlugin(docked.id);
                              }}
                            >
                              <PanelRightOpen className="w-3 h-3 mr-1" />
                              Undock
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalItems === 0 && sidebarExpanded && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <Layers className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No plugins loaded</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Open a plugin preview to get started
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {sidebarExpanded && totalItems > 0 && (
        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>
              {minimizedWindows.length} minimized, {dockedPlugins.length} docked
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Minimized Window Bento Strip
 *
 * A horizontal strip at the bottom of the screen showing minimized windows.
 * Alternative to the sidebar for quick access.
 */
export function MinimizedBentoStrip() {
  const minimizedWindows = useMinimizedWindows();
  const { restoreWindow, closeWindow } = useWindowManager();

  if (minimizedWindows.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 shadow-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        {minimizedWindows.map((win) => (
          <motion.div
            key={win.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer",
              "bg-zinc-800 hover:bg-zinc-700 transition-colors",
              "border border-zinc-700"
            )}
            onClick={() => restoreWindow(win.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                win.isPlaying ? "bg-green-500 animate-pulse" : "bg-zinc-600"
              )}
            />
            <span className="text-xs text-zinc-300 max-w-24 truncate">
              {win.title}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="w-5 h-5 hover:bg-zinc-600 -mr-1"
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(win.id);
              }}
            >
              <X className="w-3 h-3 text-zinc-500" />
            </Button>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
