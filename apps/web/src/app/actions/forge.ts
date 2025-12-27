"use server";

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4203";

export interface ForgeResult {
  taskId?: string;
  success: boolean;
  error?: string;
}

export interface DownloadUrls {
  windows?: string;
  macos?: string;
}

export interface ForgeStatus {
  status: "PENDING" | "DRAFT" | "PLANNING" | "PLAN_PROPOSED" | "APPROVED" | "GENERATING" | "PUSHING" | "BUILDING" | "SUCCESS" | "FAILED";
  progress: number;
  message?: string;
  downloadUrls?: DownloadUrls;
  pluginId?: string;
  workflowUrl?: string;
  error?: string;
  wasmReady?: boolean;  // WASM available for browser preview (independent of VST3)
  wasmUrl?: string | null;  // URL to download WASM module
  logs?: Array<{
    timestamp: string;
    level: string;
    message: string;
    step?: string;
  }>;
}

/**
 * Server-side authenticated fetch helper
 */
async function serverFetch(path: string): Promise<Response> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    cache: "no-store",
  });
}

/**
 * Polls the build status for a given project.
 * Returns current status, progress percentage, and logs.
 */
export async function getForgeStatus(projectId: string): Promise<ForgeStatus> {
  try {
    const response = await serverFetch(`/api/v1/build/status/${projectId}`);

    if (!response.ok) {
      throw new Error("Failed to fetch status");
    }

    const data = await response.json();

    // Status is already uppercase from Hono backend
    const status = data.status as ForgeStatus["status"];

    // Build status message based on current phase
    const messageMap: Record<string, string> = {
      DRAFT: "Draft saved",
      PLANNING: "AI is designing your plugin...",
      PLAN_PROPOSED: "Plan ready for review",
      APPROVED: "Plan approved, ready to build",
      GENERATING: "Generating C++ code...",
      PUSHING: "Pushing to GitHub...",
      BUILDING: "Compiling for Windows & macOS...",
      SUCCESS: "Your plugin is ready!",
      FAILED: "Build failed",
    };

    // Get the latest log message for more detail
    const latestLog = data.logs?.[0];
    const message = latestLog?.message || messageMap[status] || "Processing...";

    return {
      status,
      progress: data.progress || 0,
      message,
      pluginId: data.projectId,
      workflowUrl: data.githubRunId
        ? `https://github.com/mottysisam/vaist-forge/actions/runs/${data.githubRunId}`
        : undefined,
      error: status === "FAILED" ? latestLog?.message : undefined,
      wasmReady: data.wasmReady || false,
      wasmUrl: data.wasmUrl || null,
      logs: data.logs,
    };
  } catch (error) {
    console.error("Status Error:", error);
    return {
      status: "FAILED",
      progress: 0,
      error: error instanceof Error ? error.message : "Failed to fetch status",
    };
  }
}
