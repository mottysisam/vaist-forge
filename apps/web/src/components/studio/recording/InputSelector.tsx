/**
 * Input Selector Component
 *
 * Dropdown for selecting audio input device (microphone).
 * Features:
 * - List available audio input devices
 * - Show current selection
 * - Request microphone permission if needed
 * - Monitor input level preview
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Mic, MicOff, ChevronDown, AlertCircle, Loader2 } from "lucide-react";

interface AudioInputDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

interface InputSelectorProps {
  selectedDeviceId?: string;
  onDeviceChange?: (deviceId: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function InputSelector({
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
  compact = false,
  className,
}: InputSelectorProps) {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Get the currently selected device
  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId) ||
    devices.find((d) => d.isDefault) ||
    devices[0];

  // Enumerate available input devices
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          isDefault: device.deviceId === "default",
        }));

      setDevices(audioInputs);

      // Check if we have permission (labels are available)
      if (audioInputs.length > 0 && audioInputs[0].label) {
        setHasPermission(true);
      }
    } catch (err) {
      console.error("[InputSelector] Failed to enumerate devices:", err);
      setError("Failed to list audio devices");
    }
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // Stop the stream immediately (we just needed permission)
      stream.getTracks().forEach((track) => track.stop());

      setHasPermission(true);

      // Re-enumerate to get proper labels
      await enumerateDevices();
    } catch (err) {
      console.error("[InputSelector] Permission denied:", err);
      setHasPermission(false);
      setError("Microphone access denied");
    } finally {
      setIsLoading(false);
    }
  }, [enumerateDevices]);

  // Initial device enumeration
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices]);

  // Handle device selection
  const handleSelectDevice = useCallback(
    (deviceId: string) => {
      onDeviceChange?.(deviceId);
      setShowDropdown(false);
    },
    [onDeviceChange]
  );

  // No permission yet
  if (hasPermission === false) {
    return (
      <button
        className={cn(
          "flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10",
          "text-red-400 hover:bg-red-500/20 transition-colors",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          className
        )}
        onClick={requestPermission}
        disabled={isLoading}
      >
        <MicOff className="w-4 h-4" />
        <span>{error || "Enable Microphone"}</span>
      </button>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800",
          "text-zinc-400",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          className
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Requesting access...</span>
      </div>
    );
  }

  // No devices available
  if (devices.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800",
          "text-zinc-500",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          className
        )}
      >
        <AlertCircle className="w-4 h-4" />
        <span>No input devices</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        className={cn(
          "flex items-center gap-2 rounded border transition-colors w-full",
          "bg-zinc-800 border-zinc-700 hover:border-zinc-600",
          disabled && "opacity-50 cursor-not-allowed",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        )}
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        disabled={disabled}
      >
        <Mic className="w-4 h-4 text-green-500" />
        <span className="flex-1 truncate text-left text-zinc-300">
          {selectedDevice?.label || "Select input"}
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto">
            {devices.map((device) => (
              <button
                key={device.deviceId}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-700",
                  device.deviceId === selectedDeviceId
                    ? "text-orange-500"
                    : "text-zinc-300"
                )}
                onClick={() => handleSelectDevice(device.deviceId)}
              >
                <Mic className="w-4 h-4" />
                <span className="truncate">{device.label}</span>
                {device.isDefault && (
                  <span className="text-[10px] text-zinc-500 ml-auto">Default</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook to get available audio input devices
 */
export function useAudioInputDevices() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const enumerate = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((device) => device.kind === "audioinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${index + 1}`,
            isDefault: device.deviceId === "default",
          }));

        setDevices(audioInputs);

        if (audioInputs.length > 0 && audioInputs[0].label) {
          setHasPermission(true);
        }
      } catch (err) {
        console.error("[useAudioInputDevices] Error:", err);
      }
    };

    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

      // Re-enumerate
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          isDefault: device.deviceId === "default",
        }));
      setDevices(audioInputs);

      return true;
    } catch {
      setHasPermission(false);
      return false;
    }
  }, []);

  return { devices, hasPermission, requestPermission };
}
