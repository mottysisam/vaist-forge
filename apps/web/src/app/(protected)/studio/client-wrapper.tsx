/**
 * Studio Client Wrapper
 *
 * Handles client-side concerns:
 * - Audio engine initialization
 * - Session loading from IndexedDB
 * - API key validation
 * - AudioContext resume on user interaction
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useStudioStore } from "@/stores/studio-store";
import { ApiKeyModal } from "@/components/settings/api-key-modal";
import { StudioLayout } from "@/components/studio/StudioLayout";
import {
  getStudioAudioEngine,
  disposeStudioAudioEngine,
} from "@/lib/audio/studio-audio-engine";

interface StudioClientWrapperProps {
  initialSessionId: string | null;
}

export function StudioClientWrapper({
  initialSessionId,
}: StudioClientWrapperProps) {
  const router = useRouter();
  const { hasApiKey } = useAuthStore();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session, createNewSession, loadSession } = useStudioStore();

  // Initialize audio engine
  const initializeEngine = useCallback(async () => {
    try {
      const engine = getStudioAudioEngine();
      await engine.initialize();
      setIsEngineReady(true);
      console.log("[StudioWrapper] Audio engine initialized");
    } catch (err) {
      console.error("[StudioWrapper] Failed to initialize audio engine:", err);
      setError("Failed to initialize audio engine");
    }
  }, []);

  // Load session on mount
  useEffect(() => {
    const loadInitialSession = async () => {
      setIsLoading(true);

      try {
        // Initialize engine first
        await initializeEngine();

        if (initialSessionId) {
          // TODO: Load session from IndexedDB by ID
          // For now, just create a new session if ID provided but not found
          console.log("[StudioWrapper] Loading session:", initialSessionId);
          // const storedSession = await getSessionFromDB(initialSessionId);
          // if (storedSession) {
          //   loadSession(storedSession);
          // }
        }

        // If no session loaded, check if there's one in store
        if (!session) {
          // Create default session
          createNewSession("Untitled Session");
        }
      } catch (err) {
        console.error("[StudioWrapper] Error loading session:", err);
        setError("Failed to load session");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSession();

    // Cleanup on unmount
    return () => {
      disposeStudioAudioEngine();
    };
  }, [initialSessionId, initializeEngine, session, createNewSession, loadSession]);

  // Handle AudioContext resume on user interaction
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (isEngineReady) {
        const engine = getStudioAudioEngine();
        await engine.resume();
      }
    };

    // Resume on first click/keypress
    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };
  }, [isEngineReady]);

  // If user tries to access studio without API key, prompt them
  useEffect(() => {
    if (!hasApiKey) {
      setShowApiKeyModal(true);
    }
  }, [hasApiKey]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading Studio...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white">Error</h2>
          <p className="text-zinc-400 text-sm max-w-md">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StudioLayout />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal && !hasApiKey}
        onClose={() => {
          setShowApiKeyModal(false);
          if (!hasApiKey) {
            router.push("/dashboard");
          }
        }}
        required={false}
      />
    </>
  );
}
