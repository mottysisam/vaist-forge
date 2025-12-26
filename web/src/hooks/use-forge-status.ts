"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getForgeStatus, type ForgeStatus } from "@/app/actions/forge";

interface UseForgeStatusOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number;
  /** Callback when build succeeds */
  onSuccess?: (downloadUrl?: string) => void;
  /** Callback when build fails */
  onError?: (error: string) => void;
}

interface UseForgeStatusReturn {
  status: ForgeStatus | null;
  isPolling: boolean;
  startPolling: (taskId: string) => void;
  stopPolling: () => void;
  reset: () => void;
}

/**
 * Hook for polling the Forge build status.
 * Automatically stops polling when status is SUCCESS or FAILED.
 */
export function useForgeStatus(options: UseForgeStatusOptions = {}): UseForgeStatusReturn {
  const { interval = 2000, onSuccess, onError } = options;

  const [status, setStatus] = useState<ForgeStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep callback refs up to date
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const result = await getForgeStatus(id);
      setStatus(result);

      // Check for terminal states
      if (result.status === "SUCCESS") {
        stopPolling();
        onSuccessRef.current?.(result.downloadUrl);
      } else if (result.status === "FAILED") {
        stopPolling();
        onErrorRef.current?.(result.error || "Build failed");
      }
    } catch (error) {
      console.error("Polling error:", error);
      stopPolling();
      onErrorRef.current?.("Polling failed");
    }
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    // Clear any existing polling
    stopPolling();

    setTaskId(id);
    setIsPolling(true);
    setStatus({
      status: "PENDING",
      progress: 0,
      message: "Initializing the Forge...",
    });

    // Initial poll
    poll(id);

    // Start interval polling
    intervalRef.current = setInterval(() => {
      poll(id);
    }, interval);
  }, [interval, poll, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus(null);
    setTaskId(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status,
    isPolling,
    startPolling,
    stopPolling,
    reset,
  };
}
