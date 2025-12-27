/**
 * Window Manager Store (Zustand)
 *
 * Manages the state of floating plugin windows in the WASM Studio.
 * Handles:
 * - Window positions and sizes
 * - Z-index stacking order
 * - Minimized/maximized states
 * - Dock-to-sidebar functionality
 * - Persistence to IndexedDB
 */

import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import { useMemo } from "react";
import type { PluginPlan } from "@/lib/api-client";

// Window state
export interface PluginWindow {
  id: string;
  instanceId: string;
  projectId: string;
  versionId: string;
  title: string;
  descriptor: PluginPlan;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  isDocked: boolean;
  isPlaying: boolean;
}

// Sidebar dock state
export interface DockedPlugin {
  id: string;
  instanceId: string;
  projectId: string;
  title: string;
  descriptor: PluginPlan;
}

interface WindowManagerState {
  // Windows
  windows: PluginWindow[];
  activeWindowId: string | null;
  nextZIndex: number;

  // Sidebar docked plugins
  dockedPlugins: DockedPlugin[];
  sidebarExpanded: boolean;
  selectedDockedId: string | null;

  // Actions - Window Management
  openWindow: (params: {
    instanceId: string;
    projectId: string;
    versionId: string;
    title: string;
    descriptor: PluginPlan;
  }) => string;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  moveWindow: (windowId: string, position: { x: number; y: number }) => void;
  resizeWindow: (windowId: string, size: { width: number; height: number }) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  setWindowPlaying: (windowId: string, isPlaying: boolean) => void;

  // Actions - Dock Management
  dockWindow: (windowId: string) => void;
  undockPlugin: (dockedId: string) => void;
  selectDockedPlugin: (dockedId: string | null) => void;
  toggleSidebar: () => void;

  // Actions - Cleanup
  closeAll: () => void;
  getWindowByInstanceId: (instanceId: string) => PluginWindow | undefined;
}

// Default window dimensions
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 500;
const WINDOW_OFFSET = 30;

// Calculate initial position (cascade effect)
function getInitialPosition(windowCount: number): { x: number; y: number } {
  const offset = (windowCount % 10) * WINDOW_OFFSET;
  return {
    x: 100 + offset,
    y: 100 + offset,
  };
}

export const useWindowManager = create<WindowManagerState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        windows: [],
        activeWindowId: null,
        nextZIndex: 100,
        dockedPlugins: [],
        sidebarExpanded: true,
        selectedDockedId: null,

        // Open a new plugin window
        openWindow: ({ instanceId, projectId, versionId, title, descriptor }) => {
          const state = get();

          // Check if window already exists for this instance
          const existing = state.windows.find((w) => w.instanceId === instanceId);
          if (existing) {
            // Focus existing window
            get().focusWindow(existing.id);
            return existing.id;
          }

          const windowId = `window-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const position = getInitialPosition(state.windows.length);

          const newWindow: PluginWindow = {
            id: windowId,
            instanceId,
            projectId,
            versionId,
            title,
            descriptor,
            position,
            size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
            zIndex: state.nextZIndex,
            isMinimized: false,
            isDocked: false,
            isPlaying: false,
          };

          set({
            windows: [...state.windows, newWindow],
            activeWindowId: windowId,
            nextZIndex: state.nextZIndex + 1,
          });

          return windowId;
        },

        // Close a window
        closeWindow: (windowId) => {
          set((state) => ({
            windows: state.windows.filter((w) => w.id !== windowId),
            activeWindowId:
              state.activeWindowId === windowId ? null : state.activeWindowId,
          }));
        },

        // Focus a window (bring to front)
        focusWindow: (windowId) => {
          const state = get();
          const window = state.windows.find((w) => w.id === windowId);
          if (!window) return;

          set({
            windows: state.windows.map((w) =>
              w.id === windowId
                ? { ...w, zIndex: state.nextZIndex, isMinimized: false }
                : w
            ),
            activeWindowId: windowId,
            nextZIndex: state.nextZIndex + 1,
          });
        },

        // Move a window
        moveWindow: (windowId, position) => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, position } : w
            ),
          }));
        },

        // Resize a window
        resizeWindow: (windowId, size) => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, size } : w
            ),
          }));
        },

        // Minimize a window
        minimizeWindow: (windowId) => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, isMinimized: true } : w
            ),
            activeWindowId:
              state.activeWindowId === windowId ? null : state.activeWindowId,
          }));
        },

        // Restore a minimized window
        restoreWindow: (windowId) => {
          const state = get();
          set({
            windows: state.windows.map((w) =>
              w.id === windowId
                ? { ...w, isMinimized: false, zIndex: state.nextZIndex }
                : w
            ),
            activeWindowId: windowId,
            nextZIndex: state.nextZIndex + 1,
          });
        },

        // Set window playing state
        setWindowPlaying: (windowId, isPlaying) => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, isPlaying } : w
            ),
          }));
        },

        // Dock a window to the sidebar
        dockWindow: (windowId) => {
          const state = get();
          const window = state.windows.find((w) => w.id === windowId);
          if (!window) return;

          const docked: DockedPlugin = {
            id: `docked-${window.instanceId}`,
            instanceId: window.instanceId,
            projectId: window.projectId,
            title: window.title,
            descriptor: window.descriptor,
          };

          set({
            windows: state.windows.filter((w) => w.id !== windowId),
            dockedPlugins: [...state.dockedPlugins, docked],
            selectedDockedId: docked.id,
            sidebarExpanded: true,
            activeWindowId:
              state.activeWindowId === windowId ? null : state.activeWindowId,
          });
        },

        // Undock a plugin from sidebar to window
        undockPlugin: (dockedId) => {
          const state = get();
          const docked = state.dockedPlugins.find((d) => d.id === dockedId);
          if (!docked) return;

          const windowId = `window-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const position = getInitialPosition(state.windows.length);

          const newWindow: PluginWindow = {
            id: windowId,
            instanceId: docked.instanceId,
            projectId: docked.projectId,
            versionId: "", // Will need to be looked up
            title: docked.title,
            descriptor: docked.descriptor,
            position,
            size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
            zIndex: state.nextZIndex,
            isMinimized: false,
            isDocked: false,
            isPlaying: false,
          };

          set({
            dockedPlugins: state.dockedPlugins.filter((d) => d.id !== dockedId),
            windows: [...state.windows, newWindow],
            activeWindowId: windowId,
            nextZIndex: state.nextZIndex + 1,
            selectedDockedId:
              state.selectedDockedId === dockedId ? null : state.selectedDockedId,
          });
        },

        // Select a docked plugin
        selectDockedPlugin: (dockedId) => {
          set({ selectedDockedId: dockedId });
        },

        // Toggle sidebar visibility
        toggleSidebar: () => {
          set((state) => ({ sidebarExpanded: !state.sidebarExpanded }));
        },

        // Close all windows
        closeAll: () => {
          set({
            windows: [],
            activeWindowId: null,
          });
        },

        // Get window by instance ID
        getWindowByInstanceId: (instanceId) => {
          return get().windows.find((w) => w.instanceId === instanceId);
        },
      }),
      {
        name: "vaist-window-manager",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist layout, not runtime state
          sidebarExpanded: state.sidebarExpanded,
        }),
      }
    )
  )
);

// Selector hooks for common patterns
// Use useMemo to prevent infinite loops from .filter()/.find() creating new references

export function useActiveWindow() {
  const windows = useWindowManager((state) => state.windows);
  const activeWindowId = useWindowManager((state) => state.activeWindowId);
  return useMemo(
    () => windows.find((w) => w.id === activeWindowId),
    [windows, activeWindowId]
  );
}

export function useVisibleWindows() {
  const windows = useWindowManager((state) => state.windows);
  return useMemo(() => windows.filter((w) => !w.isMinimized), [windows]);
}

export function useMinimizedWindows() {
  const windows = useWindowManager((state) => state.windows);
  return useMemo(() => windows.filter((w) => w.isMinimized), [windows]);
}

export function useDockedPlugins() {
  return useWindowManager((state) => state.dockedPlugins);
}

export function useSelectedDocked() {
  const dockedPlugins = useWindowManager((state) => state.dockedPlugins);
  const selectedDockedId = useWindowManager((state) => state.selectedDockedId);
  return useMemo(
    () => dockedPlugins.find((d) => d.id === selectedDockedId),
    [dockedPlugins, selectedDockedId]
  );
}
