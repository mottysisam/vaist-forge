"use client";

/**
 * Preset Manager Component
 *
 * Dropdown UI for managing plugin presets:
 * - Save current settings as new preset
 * - Load presets to restore parameters
 * - Favorite/unfavorite presets
 * - Delete user presets
 * - Export/import presets as JSON
 */

import { useState, useCallback, useEffect } from "react";
import {
  Save,
  ChevronDown,
  Star,
  Trash2,
  Download,
  Upload,
  MoreHorizontal,
  Check,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePresetStore, type PluginPreset } from "@/stores/preset-store";

interface PresetManagerProps {
  pluginId: string;
  versionId: string;
  currentParameters: Record<string, number>;
  onLoadPreset: (parameters: Record<string, number>) => void;
  compact?: boolean;
}

export function PresetManager({
  pluginId,
  versionId,
  currentParameters,
  onLoadPreset,
  compact = false,
}: PresetManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  // Preset store
  const {
    presets,
    currentPresetId,
    isLoading,
    error,
    setActivePlugin,
    savePreset,
    loadPreset,
    deletePreset,
    toggleFavorite,
    exportPreset,
    importPreset,
    clearError,
  } = usePresetStore();

  // Set active plugin on mount
  useEffect(() => {
    setActivePlugin(pluginId, versionId);
  }, [pluginId, versionId, setActivePlugin]);

  // Handle save preset
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    const preset = await savePreset(presetName.trim(), currentParameters, presetDescription.trim());
    if (preset) {
      setSaveDialogOpen(false);
      setPresetName("");
      setPresetDescription("");
    }
  }, [presetName, presetDescription, currentParameters, savePreset]);

  // Handle load preset
  const handleLoadPreset = useCallback(
    async (presetId: string) => {
      const preset = await loadPreset(presetId);
      if (preset) {
        onLoadPreset(preset.parameters);
      }
    },
    [loadPreset, onLoadPreset]
  );

  // Handle export preset
  const handleExportPreset = useCallback(
    (presetId: string) => {
      const json = exportPreset(presetId);
      if (json) {
        // Create download link
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const preset = presets.find((p) => p.id === presetId);
        a.href = url;
        a.download = `${preset?.name || "preset"}.vaist-preset.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [exportPreset, presets]
  );

  // Handle import preset
  const handleImportPreset = useCallback(async () => {
    if (!importJson.trim()) return;

    const preset = await importPreset(importJson.trim());
    if (preset) {
      setImportDialogOpen(false);
      setImportJson("");
      // Optionally load the imported preset
      onLoadPreset(preset.parameters);
    }
  }, [importJson, importPreset, onLoadPreset]);

  // Handle file import
  const handleFileImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.vaist-preset.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const preset = await importPreset(text);
        if (preset) {
          onLoadPreset(preset.parameters);
        }
      }
    };
    input.click();
  }, [importPreset, onLoadPreset]);

  // Get current preset name for display
  const currentPreset = presets.find((p) => p.id === currentPresetId);
  const displayName = currentPreset?.name || "No Preset";

  // Split presets into favorites and others
  const favoritePresets = presets.filter((p) => p.isFavorite);
  const otherPresets = presets.filter((p) => !p.isFavorite);

  if (compact) {
    // Compact mode: just a dropdown button
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <FolderOpen className="w-3 h-3" />
              <span className="max-w-[80px] truncate">{displayName}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4 mr-2" />
              Save Preset
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {favoritePresets.length > 0 && (
              <>
                {favoritePresets.map((preset) => (
                  <PresetMenuItem
                    key={preset.id}
                    preset={preset}
                    isActive={preset.id === currentPresetId}
                    onLoad={() => handleLoadPreset(preset.id)}
                    onToggleFavorite={() => toggleFavorite(preset.id)}
                    onExport={() => handleExportPreset(preset.id)}
                    onDelete={() => deletePreset(preset.id)}
                  />
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            {otherPresets.map((preset) => (
              <PresetMenuItem
                key={preset.id}
                preset={preset}
                isActive={preset.id === currentPresetId}
                onLoad={() => handleLoadPreset(preset.id)}
                onToggleFavorite={() => toggleFavorite(preset.id)}
                onExport={() => handleExportPreset(preset.id)}
                onDelete={() => deletePreset(preset.id)}
              />
            ))}
            {presets.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-zinc-500">
                No presets saved yet
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleFileImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import from File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save Preset Dialog */}
        <SavePresetDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          presetName={presetName}
          setPresetName={setPresetName}
          presetDescription={presetDescription}
          setPresetDescription={setPresetDescription}
          onSave={handleSavePreset}
          isLoading={isLoading}
        />
      </>
    );
  }

  // Full mode: button group
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Preset Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 min-w-[140px] justify-between bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
            >
              <span className="truncate max-w-[100px]">{displayName}</span>
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {/* Favorites Section */}
            {favoritePresets.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500">
                  Favorites
                </div>
                {favoritePresets.map((preset) => (
                  <PresetMenuItem
                    key={preset.id}
                    preset={preset}
                    isActive={preset.id === currentPresetId}
                    onLoad={() => handleLoadPreset(preset.id)}
                    onToggleFavorite={() => toggleFavorite(preset.id)}
                    onExport={() => handleExportPreset(preset.id)}
                    onDelete={() => deletePreset(preset.id)}
                  />
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* All Presets Section */}
            {otherPresets.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500">
                  All Presets
                </div>
                {otherPresets.map((preset) => (
                  <PresetMenuItem
                    key={preset.id}
                    preset={preset}
                    isActive={preset.id === currentPresetId}
                    onLoad={() => handleLoadPreset(preset.id)}
                    onToggleFavorite={() => toggleFavorite(preset.id)}
                    onExport={() => handleExportPreset(preset.id)}
                    onDelete={() => deletePreset(preset.id)}
                  />
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Empty State */}
            {presets.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-zinc-500">
                No presets saved yet.
                <br />
                <span className="text-xs">Click "Save" to create your first preset.</span>
              </div>
            )}

            {/* Import Option */}
            <DropdownMenuItem onClick={handleFileImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import from File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save Button */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => setSaveDialogOpen(true)}
          title="Save as new preset"
        >
          <Save className="w-4 h-4" />
        </Button>
      </div>

      {/* Save Preset Dialog */}
      <SavePresetDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        presetName={presetName}
        setPresetName={setPresetName}
        presetDescription={presetDescription}
        setPresetDescription={setPresetDescription}
        onSave={handleSavePreset}
        isLoading={isLoading}
      />

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 text-red-100 px-4 py-2 rounded-lg text-sm shadow-lg">
          {error}
          <button onClick={clearError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

// Preset menu item with actions
interface PresetMenuItemProps {
  preset: PluginPreset;
  isActive: boolean;
  onLoad: () => void;
  onToggleFavorite: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function PresetMenuItem({
  preset,
  isActive,
  onLoad,
  onToggleFavorite,
  onExport,
  onDelete,
}: PresetMenuItemProps) {
  return (
    <div className="group relative">
      <DropdownMenuItem
        onClick={onLoad}
        className={cn("pr-12", isActive && "bg-forge-primary/20")}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isActive && <Check className="w-4 h-4 text-forge-primary flex-shrink-0" />}
          <Star
            className={cn(
              "w-3 h-3 flex-shrink-0",
              preset.isFavorite ? "text-yellow-500 fill-yellow-500" : "text-zinc-600"
            )}
          />
          <span className="truncate">{preset.name}</span>
        </div>
      </DropdownMenuItem>

      {/* Actions dropdown on hover */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-6 w-6 p-0 flex items-center justify-center">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onToggleFavorite}>
              <Star className={cn("w-4 h-4 mr-2", preset.isFavorite && "fill-current")} />
              {preset.isFavorite ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:text-red-300">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </div>
    </div>
  );
}

// Save preset dialog
interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetName: string;
  setPresetName: (name: string) => void;
  presetDescription: string;
  setPresetDescription: (desc: string) => void;
  onSave: () => void;
  isLoading: boolean;
}

function SavePresetDialog({
  open,
  onOpenChange,
  presetName,
  setPresetName,
  presetDescription,
  setPresetDescription,
  onSave,
  isLoading,
}: SavePresetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Preset</DialogTitle>
          <DialogDescription>
            Save your current plugin settings as a preset for quick recall.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder="My Awesome Sound"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preset-desc">Description (optional)</Label>
            <Textarea
              id="preset-desc"
              placeholder="Describe what makes this preset special..."
              value={presetDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPresetDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!presetName.trim() || isLoading}
            className="bg-forge-primary hover:bg-forge-glow"
          >
            {isLoading ? "Saving..." : "Save Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export type for convenience
export type { PluginPreset } from "@/lib/storage/studio-db";
