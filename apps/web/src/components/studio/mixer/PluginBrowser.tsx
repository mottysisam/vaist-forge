/**
 * Plugin Browser Dialog
 *
 * Shows a list of user's completed plugins (with WASM) for loading into insert slots.
 * Features:
 * - Fetches user's projects from API
 * - Filters for SUCCESS status (WASM available)
 * - Shows plugin name, description, parameter count
 * - Click to load into selected insert slot
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plug, Sliders, AlertCircle, RefreshCw } from "lucide-react";
import type { PluginPlan } from "@/lib/api-client";

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

interface PluginBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlugin: (project: PluginProject) => void;
  trackId: string;
  slotPosition: number;
}

export function PluginBrowser({
  open,
  onOpenChange,
  onSelectPlugin,
  trackId,
  slotPosition,
}: PluginBrowserProps) {
  const [plugins, setPlugins] = useState<PluginProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's plugins
  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch plugins");
      }

      const data = await response.json();

      // Filter for SUCCESS status only (has WASM available)
      const availablePlugins = (data.projects || []).filter(
        (p: PluginProject) => p.status === "SUCCESS" && p.plan
      );

      setPlugins(availablePlugins);
    } catch (err) {
      console.error("[PluginBrowser] Failed to fetch plugins:", err);
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchPlugins();
    }
  }, [open, fetchPlugins]);

  const handleSelect = useCallback(
    (plugin: PluginProject) => {
      onSelectPlugin(plugin);
      onOpenChange(false);
    },
    [onSelectPlugin, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-orange-500" />
            Load Plugin
          </DialogTitle>
          <DialogDescription>
            Select a plugin to load into slot {slotPosition + 1}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              <span className="ml-2 text-sm text-zinc-400">Loading plugins...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlugins}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && plugins.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Plug className="w-8 h-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No plugins available</p>
              <p className="text-xs text-zinc-500">
                Create a plugin in the Forge to use it here
              </p>
            </div>
          )}

          {/* Plugin List */}
          {!loading &&
            !error &&
            plugins.map((plugin) => (
              <button
                key={plugin.id}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left",
                  "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-orange-500/50"
                )}
                onClick={() => handleSelect(plugin)}
              >
                {/* Plugin Icon */}
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-orange-500" />
                </div>

                {/* Plugin Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-200 truncate">
                    {plugin.plan?.explanation?.slice(0, 40) || plugin.name}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">
                    {plugin.prompt.slice(0, 60)}...
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Sliders className="w-3 h-3" />
                      {plugin.plan?.parameters?.length || 0} params
                    </span>
                  </div>
                </div>
              </button>
            ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
