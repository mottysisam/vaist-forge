/**
 * API Client for vAIst Backend
 * Authenticated requests to the Hono backend via BetterAuth session
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';

/**
 * Authenticated fetch wrapper - includes cookies for session
 */
async function authFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    // Include additional debug info if available
    let errorMsg = error.error || error.message || `HTTP ${response.status}`;
    if (error.currentStatus) {
      errorMsg += ` (currentStatus: ${error.currentStatus}, expected: ${error.expectedStatus})`;
    }
    console.error('API Error:', { path, status: response.status, error });
    throw new Error(errorMsg);
  }

  return response.json();
}

// ============================================
// Project Types (from backend schema)
// ============================================

export type ProjectStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'PLAN_PROPOSED'
  | 'APPROVED'
  | 'GENERATING'
  | 'PUSHING'
  | 'BUILDING'
  | 'SUCCESS'
  | 'FAILED';

export interface PluginParameter {
  id: string;
  name: string;
  type: 'float' | 'int' | 'bool' | 'choice';
  min?: number;
  max?: number;
  default: number | boolean | string;
  unit?: string;
  choices?: string[];
}

export interface DspBlock {
  type: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
}

export interface PluginPlan {
  explanation: string;
  parameters: PluginParameter[];
  dspBlocks: DspBlock[];
  architecture: 'mono' | 'stereo' | 'stereo_linked' | 'mid_side';
}

export interface Project {
  id: string;
  prompt: string;
  status: ProjectStatus;
  approvedPlan?: PluginPlan;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Project API
// ============================================

export async function createProject(prompt: string): Promise<{ projectId: string; project: Project }> {
  const project = await authFetch('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }) as Project;
  return { projectId: project.id, project };
}

export async function getProject(projectId: string): Promise<Project> {
  return authFetch(`/api/v1/projects/${projectId}`);
}

export async function listProjects(): Promise<{ projects: Project[] }> {
  return authFetch('/api/v1/projects');
}

// ============================================
// Plan API
// ============================================

export interface GeneratePlanResult {
  projectId: string;
  plan: PluginPlan;
  model: string;
  message: string;
}

export interface RefinePlanResult {
  projectId: string;
  plan: PluginPlan;
  model: string;
  message: string;
}

export interface ApprovePlanResult {
  projectId: string;
  status: 'APPROVED';
  plan: PluginPlan;
  message: string;
}

export async function generatePlan(projectId: string): Promise<GeneratePlanResult> {
  return authFetch('/api/v1/plan/generate', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function refinePlan(projectId: string, message: string): Promise<RefinePlanResult> {
  return authFetch('/api/v1/plan/refine', {
    method: 'POST',
    body: JSON.stringify({ projectId, message }),
  });
}

export async function approvePlan(projectId: string): Promise<ApprovePlanResult> {
  return authFetch('/api/v1/plan/approve', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export interface ImprovePlanResult {
  projectId: string;
  plan: PluginPlan;
  model: string;
  message: string;
}

export async function improvePlan(projectId: string): Promise<ImprovePlanResult> {
  return authFetch('/api/v1/plan/improve', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function getCurrentPlan(projectId: string): Promise<{
  projectId: string;
  status: ProjectStatus;
  plan: PluginPlan | null;
  approvedPlan: PluginPlan | null;
}> {
  return authFetch(`/api/v1/plan/${projectId}`);
}

// ============================================
// Build API
// ============================================

export interface TriggerBuildResult {
  projectId: string;
  status: 'BUILDING';
  githubRunId: number;
  message: string;
}

export interface BuildStatus {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  githubRunId?: string;
  retryCount: number;
  wasmReady: boolean;   // WASM available for browser preview (independent of VST3)
  wasmUrl: string | null;  // URL to download WASM module
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    step?: string;
  }>;
}

export async function triggerBuild(projectId: string): Promise<TriggerBuildResult> {
  return authFetch('/api/v1/build/trigger', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export interface StopBuildResult {
  projectId: string;
  status: ProjectStatus;
  message: string;
  previousStatus: ProjectStatus;
}

export async function stopBuild(projectId: string): Promise<StopBuildResult> {
  return authFetch('/api/v1/build/stop', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export interface RestartBuildResult {
  projectId: string;
  status: 'APPROVED';
  message: string;
  previousStatus: ProjectStatus;
}

export async function restartBuild(projectId: string): Promise<RestartBuildResult> {
  return authFetch('/api/v1/build/restart', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function getBuildStatus(projectId: string): Promise<BuildStatus> {
  return authFetch(`/api/v1/build/status/${projectId}`);
}

export async function getDownloadUrl(projectId: string): Promise<{
  projectId: string;
  downloadUrl: string;
  expiresAt: string;
}> {
  return authFetch(`/api/v1/build/download/${projectId}`);
}

// ============================================
// Project Management API
// ============================================

export async function deleteProject(projectId: string): Promise<{ deleted: boolean; id: string }> {
  return authFetch(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
  });
}
