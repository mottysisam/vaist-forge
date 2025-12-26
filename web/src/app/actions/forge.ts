"use server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

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
  status: "PENDING" | "SYNTHESIZING" | "PUSHING" | "BUILDING" | "SUCCESS" | "FAILED";
  progress: number;
  message?: string;
  downloadUrls?: DownloadUrls;
  pluginId?: string;
  workflowUrl?: string;
  error?: string;
}

/**
 * Triggers the AI code generation pipeline.
 * Sends the user's prompt to the FastAPI backend.
 */
export async function startForgeAction(prompt: string): Promise<ForgeResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/plugin/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to trigger the Forge");
    }

    const data = await response.json();
    return { taskId: data.task_id, success: true };
  } catch (error) {
    console.error("Forge Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "The Forge is currently offline.",
    };
  }
}

/**
 * Polls the build status for a given task.
 * Returns current status, progress percentage, and download URLs when complete.
 */
export async function getForgeStatus(taskId: string): Promise<ForgeStatus> {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/plugin/status/${taskId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch status");
    }

    const data = await response.json();

    // Backend returns lowercase status, convert to uppercase for frontend
    const backendStatus = (data.status || "pending").toUpperCase();

    // Map backend status to progress percentage
    const progressMap: Record<string, number> = {
      PENDING: 5,
      SYNTHESIZING: 25,
      PUSHING: 50,
      BUILDING: 75,
      VALIDATING: 90,
      SUCCESS: 100,
      FAILED: 100,
    };

    // Build status message based on current phase
    const messageMap: Record<string, string> = {
      PENDING: "Initializing the Forge...",
      SYNTHESIZING: "AI is crafting your DSP code...",
      PUSHING: "Pushing to GitHub...",
      BUILDING: "Compiling for Windows & macOS...",
      VALIDATING: "Running plugin validation...",
      SUCCESS: "Your plugin is ready!",
      FAILED: data.error_message || "Build failed",
    };

    return {
      status: backendStatus as ForgeStatus["status"],
      progress: progressMap[backendStatus] || 0,
      message: messageMap[backendStatus],
      downloadUrls: data.download_urls,
      pluginId: data.plugin_id,
      workflowUrl: data.workflow_url,
      error: data.error_message,
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
