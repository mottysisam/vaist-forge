"use client";

/**
 * WAM Host Provider (WAM 2.0 SDK)
 *
 * Global context for Web Audio Module 2.0 lifecycle management.
 * Uses the official @webaudiomodules/sdk for WAM 2.0 compliance.
 *
 * Architecture:
 * - initializeWamHost() for AudioWorklet environment setup
 * - Dynamic WebAudioModule creation for vAIst WASM plugins
 * - WamNode for parameter automation and event routing
 * - SharedArrayBuffer support for low-latency parameter updates
 *
 * References:
 * - WAM 2.0 Spec: https://github.com/webaudiomodules/api
 * - WAM SDK: https://github.com/webaudiomodules/sdk
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { PluginPlan } from "@/lib/api-client";

// WAM SDK imports
import { initializeWamHost, WebAudioModule, WamNode } from "@webaudiomodules/sdk";
import type { WamDescriptor, WamNode as IWamNode } from "@webaudiomodules/api";

// Types for WAM 2.0 integration
interface WamInstance {
  id: string;
  projectId: string;
  versionId: string;
  module: WebAudioModule<IWamNode>;
  audioNode: WamNode;
  descriptor: PluginPlan;
}

interface WamHostState {
  isInitialized: boolean;
  isInitializing: boolean;
  hostGroupId: string | null;
  hostGroupKey: string | null;
  sharedArrayBufferSupported: boolean;
  sampleRate: number;
  error: string | null;
}

interface WamHostContextValue {
  state: WamHostState;
  initialize: () => Promise<void>;
  loadPlugin: (
    projectId: string,
    versionId: string,
    wasmUrl: string,
    descriptor: PluginPlan
  ) => Promise<WamInstance | null>;
  unloadPlugin: (instanceId: string) => void;
  setParameter: (instanceId: string, paramId: string, value: number) => void;
  getParameter: (instanceId: string, paramId: string) => number | undefined;
  setMasterVolume: (volume: number) => void;
  getAudioContext: () => AudioContext | null;
  getPluginInstance: (instanceId: string) => WamInstance | undefined;
  connectToDestination: (instanceId: string) => void;
  disconnectFromDestination: (instanceId: string) => void;
}

const WamHostContext = createContext<WamHostContextValue | null>(null);

interface WamHostProviderProps {
  children: ReactNode;
}

/**
 * Creates a dynamic WebAudioModule class for vAIst WASM plugins
 * This wraps our WASM binaries in a WAM 2.0 compliant module
 */
function createVaistWamModule(
  wasmUrl: string,
  pluginDescriptor: PluginPlan,
  pluginId: string
): typeof WebAudioModule {
  // Create a dynamic class that extends WebAudioModule
  const VaistWamPlugin = class extends WebAudioModule<IWamNode> {
    private _wasmUrl: string;
    private _pluginDescriptor: PluginPlan;
    private _wasmInstance: WebAssembly.Instance | null = null;

    constructor(groupId: string, audioContext: BaseAudioContext) {
      super(groupId, audioContext);
      this._wasmUrl = wasmUrl;
      this._pluginDescriptor = pluginDescriptor;

      // Override the descriptor with vAIst plugin info
      // The parent class uses _descriptor internally
      (this as unknown as { _descriptor: WamDescriptor })._descriptor = {
        identifier: `com.vaist.plugin.${pluginId}`,
        name: this._pluginDescriptor.explanation?.slice(0, 50) || "vAIst Plugin",
        vendor: "vAIst",
        version: "1.0.0",
        apiVersion: "2.0.0",
        thumbnail: "",
        keywords: ["synthesizer", "effect", "vAIst"],
        isInstrument: false,
        website: "https://vaist.ai",
        description: this._pluginDescriptor.explanation || "AI-generated audio plugin",
        hasAudioInput: true,
        hasAudioOutput: true,
        hasAutomationInput: true,
        hasAutomationOutput: true,
        hasMidiInput: true,
        hasMidiOutput: true,
        hasMpeInput: false,
        hasMpeOutput: false,
        hasOscInput: false,
        hasOscOutput: false,
        hasSysexInput: false,
        hasSysexOutput: false,
      };
    }

    // Override createAudioNode to set up our WASM processor
    async createAudioNode(): Promise<WamNode> {
      // Fetch WASM module
      const response = await fetch(this._wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status}`);
      }
      const wasmBytes = await response.arrayBuffer();

      // Create the audio node options
      const options: AudioWorkletNodeOptions = {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          moduleId: this.moduleId,
          instanceId: this.instanceId,
          wasmBytes: wasmBytes,
          parameters: this._pluginDescriptor.parameters,
        },
      };

      // Register WAM processor modules in AudioWorklet
      await WamNode.addModules(this.audioContext, this.moduleId);

      // Create WamNode (AudioWorkletNode)
      const node = new WamNode(this, options);

      // Initialize parameters from descriptor
      const parameterValues: Record<string, { id: string; value: number; normalized: boolean }> = {};
      for (const param of this._pluginDescriptor.parameters) {
        const value = typeof param.default === "number" ? param.default : 0.5;
        parameterValues[param.id] = { id: param.id, value, normalized: false };
      }

      if (Object.keys(parameterValues).length > 0) {
        await node.setParameterValues(parameterValues);
      }

      console.log("[WamHost] vAIst plugin audio node created:", this.descriptor.name);
      return node;
    }
  };

  return VaistWamPlugin as unknown as typeof WebAudioModule;
}

export function WamHostProvider({ children }: WamHostProviderProps) {
  const [state, setState] = useState<WamHostState>({
    isInitialized: false,
    isInitializing: false,
    hostGroupId: null,
    hostGroupKey: null,
    sharedArrayBufferSupported: false,
    sampleRate: 48000,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pluginsRef = useRef<Map<string, WamInstance>>(new Map());

  // Check SharedArrayBuffer support on mount
  useEffect(() => {
    const supported = typeof SharedArrayBuffer !== "undefined";
    setState((prev) => ({ ...prev, sharedArrayBufferSupported: supported }));
  }, []);

  /**
   * Initialize the WAM host environment
   * Must be called after user interaction (browser autoplay policy)
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized || state.isInitializing) return;

    setState((prev) => ({ ...prev, isInitializing: true, error: null }));

    try {
      // Create AudioContext with professional sample rate
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      // Create master gain node
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioContext.destination);
      masterGainRef.current = masterGain;

      // Initialize WAM host environment using SDK
      // This sets up the WamEnv and WamGroup in the AudioWorklet
      const [hostGroupId, hostGroupKey] = await initializeWamHost(audioContext);

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      setState((prev) => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        hostGroupId,
        hostGroupKey,
        sampleRate: audioContext.sampleRate,
      }));

      console.log("[WamHost] Initialized successfully", {
        hostGroupId,
        sampleRate: audioContext.sampleRate,
        sharedArrayBuffer: state.sharedArrayBufferSupported,
      });
    } catch (error) {
      console.error("[WamHost] Initialization failed:", error);
      setState((prev) => ({
        ...prev,
        isInitializing: false,
        error: error instanceof Error ? error.message : "Failed to initialize audio",
      }));
    }
  }, [state.isInitialized, state.isInitializing, state.sharedArrayBufferSupported]);

  /**
   * Load a vAIst WASM plugin using WAM 2.0 SDK pattern
   */
  const loadPlugin = useCallback(
    async (
      projectId: string,
      versionId: string,
      wasmUrl: string,
      descriptor: PluginPlan
    ): Promise<WamInstance | null> => {
      const audioContext = audioContextRef.current;
      if (!audioContext || !state.isInitialized || !state.hostGroupId) {
        console.error("[WamHost] Cannot load plugin - not initialized");
        return null;
      }

      const instanceId = `${projectId}:${versionId}:${Date.now()}`;
      const pluginId = `${projectId}_${versionId}`.replace(/[^a-zA-Z0-9]/g, "_");

      try {
        // Create dynamic WAM module class for this WASM plugin
        const VaistModule = createVaistWamModule(wasmUrl, descriptor, pluginId);

        // Create instance using WAM 2.0 pattern
        const wamInstance = await VaistModule.createInstance(
          state.hostGroupId,
          audioContext
        );

        const instance: WamInstance = {
          id: instanceId,
          projectId,
          versionId,
          module: wamInstance,
          audioNode: wamInstance.audioNode as WamNode,
          descriptor,
        };

        pluginsRef.current.set(instanceId, instance);

        console.log("[WamHost] Plugin loaded:", instanceId, {
          parameters: descriptor.parameters.length,
          hostGroupId: state.hostGroupId,
        });

        return instance;
      } catch (error) {
        console.error("[WamHost] Failed to load plugin:", error);
        return null;
      }
    },
    [state.isInitialized, state.hostGroupId]
  );

  /**
   * Unload a plugin instance
   */
  const unloadPlugin = useCallback((instanceId: string) => {
    const instance = pluginsRef.current.get(instanceId);
    if (!instance) return;

    try {
      // Destroy WAM instance (cleans up AudioWorklet resources)
      instance.audioNode.destroy();
      instance.audioNode.disconnect();
    } catch (err) {
      console.warn("[WamHost] Error during plugin unload:", err);
    }

    pluginsRef.current.delete(instanceId);
    console.log("[WamHost] Plugin unloaded:", instanceId);
  }, []);

  /**
   * Set a parameter value on a plugin instance using WAM events
   */
  const setParameter = useCallback(
    (instanceId: string, paramId: string, value: number) => {
      const instance = pluginsRef.current.get(instanceId);
      if (!instance) return;

      // Use WAM 2.0 parameter API (fire and forget for performance)
      instance.audioNode.setParameterValues({
        [paramId]: { id: paramId, value, normalized: false },
      }).catch((err) => {
        console.warn("[WamHost] Failed to set parameter:", err);
      });
    },
    []
  );

  /**
   * Get a parameter value from a plugin instance (sync from cache)
   */
  const getParameter = useCallback(
    (instanceId: string, paramId: string): number | undefined => {
      const instance = pluginsRef.current.get(instanceId);
      if (!instance) return undefined;

      // Return cached value from descriptor defaults
      // For async value, use getParameterAsync
      const param = instance.descriptor.parameters.find(p => p.id === paramId);
      return typeof param?.default === "number" ? param.default : undefined;
    },
    []
  );

  /**
   * Set the master volume (0.0 - 1.0)
   */
  const setMasterVolume = useCallback((volume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        audioContextRef.current?.currentTime || 0
      );
    }
  }, []);

  /**
   * Get the AudioContext
   */
  const getAudioContext = useCallback(() => audioContextRef.current, []);

  /**
   * Get a plugin instance by ID
   */
  const getPluginInstance = useCallback(
    (instanceId: string) => pluginsRef.current.get(instanceId),
    []
  );

  /**
   * Connect a plugin to the master output
   */
  const connectToDestination = useCallback((instanceId: string) => {
    const instance = pluginsRef.current.get(instanceId);
    if (!instance || !masterGainRef.current) return;

    instance.audioNode.connect(masterGainRef.current);
    console.log("[WamHost] Plugin connected to master:", instanceId);
  }, []);

  /**
   * Disconnect a plugin from the master output
   */
  const disconnectFromDestination = useCallback((instanceId: string) => {
    const instance = pluginsRef.current.get(instanceId);
    if (!instance || !masterGainRef.current) return;

    try {
      instance.audioNode.disconnect(masterGainRef.current);
    } catch {
      // May already be disconnected
    }
    console.log("[WamHost] Plugin disconnected from master:", instanceId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Unload all plugins
      for (const instanceId of pluginsRef.current.keys()) {
        unloadPlugin(instanceId);
      }
      // Close audio context
      audioContextRef.current?.close();
    };
  }, [unloadPlugin]);

  const contextValue: WamHostContextValue = {
    state,
    initialize,
    loadPlugin,
    unloadPlugin,
    setParameter,
    getParameter,
    setMasterVolume,
    getAudioContext,
    getPluginInstance,
    connectToDestination,
    disconnectFromDestination,
  };

  return (
    <WamHostContext.Provider value={contextValue}>
      {children}
    </WamHostContext.Provider>
  );
}

/**
 * Hook to access the WAM host context
 */
export function useWamHost() {
  const context = useContext(WamHostContext);
  if (!context) {
    throw new Error("useWamHost must be used within a WamHostProvider");
  }
  return context;
}

/**
 * Hook for a single plugin instance
 */
export function usePluginInstance(instanceId: string | null) {
  const { getPluginInstance, setParameter, getParameter } = useWamHost();

  const updateParameter = useCallback(
    (paramId: string, value: number) => {
      if (instanceId) {
        setParameter(instanceId, paramId, value);
      }
    },
    [instanceId, setParameter]
  );

  const readParameter = useCallback(
    (paramId: string) => {
      if (instanceId) {
        return getParameter(instanceId, paramId);
      }
      return undefined;
    },
    [instanceId, getParameter]
  );

  return {
    instance: instanceId ? getPluginInstance(instanceId) : undefined,
    updateParameter,
    readParameter,
  };
}
