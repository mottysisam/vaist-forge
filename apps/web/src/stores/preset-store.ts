/**
 * Preset Store (Zustand)
 *
 * Manages plugin presets with IndexedDB persistence via Dexie.
 * Provides reactive state for preset UI components.
 *
 * Features:
 * - Save current plugin state as preset
 * - Load preset to restore parameters
 * - Favorite presets for quick access
 * - Import/export presets as JSON
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type PluginPreset,
  createPreset,
  getPresetsForPlugin,
  getPreset,
  updatePreset,
  deletePreset,
  togglePresetFavorite,
  exportPresetToJson,
  importPresetFromJson,
} from "@/lib/storage/studio-db";

// Re-export for convenience
export type { PluginPreset } from "@/lib/storage/studio-db";

interface PresetStoreState {
  // Current state
  presets: PluginPreset[];
  currentPresetId: string | null;
  isLoading: boolean;
  error: string | null;

  // Active plugin context
  activePluginId: string | null;
  activeVersionId: string | null;

  // Actions
  setActivePlugin: (pluginId: string, versionId: string) => void;
  loadPresets: (pluginId: string, versionId?: string) => Promise<void>;
  savePreset: (
    name: string,
    parameters: Record<string, number>,
    description?: string
  ) => Promise<PluginPreset | null>;
  loadPreset: (presetId: string) => Promise<PluginPreset | null>;
  updatePresetName: (presetId: string, name: string) => Promise<void>;
  updatePresetDescription: (presetId: string, description: string) => Promise<void>;
  overwritePreset: (presetId: string, parameters: Record<string, number>) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  toggleFavorite: (presetId: string) => Promise<void>;
  exportPreset: (presetId: string) => string | null;
  importPreset: (json: string) => Promise<PluginPreset | null>;
  clearError: () => void;
}

export const usePresetStore = create<PresetStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    presets: [],
    currentPresetId: null,
    isLoading: false,
    error: null,
    activePluginId: null,
    activeVersionId: null,

    /**
     * Set the active plugin context
     */
    setActivePlugin: (pluginId: string, versionId: string) => {
      set({ activePluginId: pluginId, activeVersionId: versionId });
      // Auto-load presets for this plugin
      get().loadPresets(pluginId, versionId);
    },

    /**
     * Load all presets for a plugin from IndexedDB
     */
    loadPresets: async (pluginId: string, versionId?: string) => {
      set({ isLoading: true, error: null });
      try {
        const presets = await getPresetsForPlugin(pluginId, versionId);
        set({ presets, isLoading: false });
      } catch (err) {
        console.error("[PresetStore] Failed to load presets:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to load presets",
          isLoading: false,
        });
      }
    },

    /**
     * Save current plugin state as a new preset
     */
    savePreset: async (
      name: string,
      parameters: Record<string, number>,
      description?: string
    ) => {
      const { activePluginId, activeVersionId } = get();
      if (!activePluginId || !activeVersionId) {
        set({ error: "No active plugin selected" });
        return null;
      }

      set({ isLoading: true, error: null });
      try {
        const preset = await createPreset(
          activePluginId,
          activeVersionId,
          name,
          parameters,
          { description }
        );

        // Add to local state
        set((state) => ({
          presets: [...state.presets, preset],
          currentPresetId: preset.id,
          isLoading: false,
        }));

        console.log("[PresetStore] Saved preset:", preset.name);
        return preset;
      } catch (err) {
        console.error("[PresetStore] Failed to save preset:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to save preset",
          isLoading: false,
        });
        return null;
      }
    },

    /**
     * Load a preset (returns preset data for applying to plugin)
     */
    loadPreset: async (presetId: string) => {
      set({ isLoading: true, error: null });
      try {
        const preset = await getPreset(presetId);
        if (!preset) {
          set({ error: "Preset not found", isLoading: false });
          return null;
        }

        set({ currentPresetId: presetId, isLoading: false });
        console.log("[PresetStore] Loaded preset:", preset.name);
        return preset;
      } catch (err) {
        console.error("[PresetStore] Failed to load preset:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to load preset",
          isLoading: false,
        });
        return null;
      }
    },

    /**
     * Update preset name
     */
    updatePresetName: async (presetId: string, name: string) => {
      try {
        await updatePreset(presetId, { name });
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }));
      } catch (err) {
        console.error("[PresetStore] Failed to update preset name:", err);
        set({ error: "Failed to update preset" });
      }
    },

    /**
     * Update preset description
     */
    updatePresetDescription: async (presetId: string, description: string) => {
      try {
        await updatePreset(presetId, { description });
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId ? { ...p, description, updatedAt: Date.now() } : p
          ),
        }));
      } catch (err) {
        console.error("[PresetStore] Failed to update preset description:", err);
        set({ error: "Failed to update preset" });
      }
    },

    /**
     * Overwrite preset with new parameters
     */
    overwritePreset: async (presetId: string, parameters: Record<string, number>) => {
      try {
        await updatePreset(presetId, { parameters });
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId ? { ...p, parameters, updatedAt: Date.now() } : p
          ),
        }));
        console.log("[PresetStore] Overwritten preset:", presetId);
      } catch (err) {
        console.error("[PresetStore] Failed to overwrite preset:", err);
        set({ error: "Failed to overwrite preset" });
      }
    },

    /**
     * Delete a preset
     */
    deletePreset: async (presetId: string) => {
      try {
        await deletePreset(presetId);
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
          currentPresetId:
            state.currentPresetId === presetId ? null : state.currentPresetId,
        }));
        console.log("[PresetStore] Deleted preset:", presetId);
      } catch (err) {
        console.error("[PresetStore] Failed to delete preset:", err);
        set({ error: "Failed to delete preset" });
      }
    },

    /**
     * Toggle favorite status
     */
    toggleFavorite: async (presetId: string) => {
      try {
        const newFavorite = await togglePresetFavorite(presetId);
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId
              ? { ...p, isFavorite: newFavorite, updatedAt: Date.now() }
              : p
          ),
        }));
      } catch (err) {
        console.error("[PresetStore] Failed to toggle favorite:", err);
        set({ error: "Failed to toggle favorite" });
      }
    },

    /**
     * Export preset as JSON string
     */
    exportPreset: (presetId: string) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return null;
      return exportPresetToJson(preset);
    },

    /**
     * Import preset from JSON string
     */
    importPreset: async (json: string) => {
      const { activePluginId, activeVersionId } = get();
      try {
        const preset = await importPresetFromJson(
          json,
          activePluginId ?? undefined,
          activeVersionId ?? undefined
        );
        set((state) => ({
          presets: [...state.presets, preset],
        }));
        console.log("[PresetStore] Imported preset:", preset.name);
        return preset;
      } catch (err) {
        console.error("[PresetStore] Failed to import preset:", err);
        set({ error: "Failed to import preset - invalid format" });
        return null;
      }
    },

    /**
     * Clear error state
     */
    clearError: () => set({ error: null }),
  }))
);

/**
 * Hook to get presets for a specific plugin
 */
export function usePluginPresets(pluginId: string | null, versionId: string | null) {
  const presets = usePresetStore((state) => state.presets);
  const loadPresets = usePresetStore((state) => state.loadPresets);
  const setActivePlugin = usePresetStore((state) => state.setActivePlugin);

  // Load presets when plugin changes
  if (pluginId && versionId) {
    const activePluginId = usePresetStore.getState().activePluginId;
    const activeVersionId = usePresetStore.getState().activeVersionId;

    if (activePluginId !== pluginId || activeVersionId !== versionId) {
      setActivePlugin(pluginId, versionId);
    }
  }

  return presets;
}
