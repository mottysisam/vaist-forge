/**
 * Server-Side API Client
 *
 * Authenticated fetch for Server Components and Server Actions.
 * Forwards cookies from the request to the backend for session auth.
 */

import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';

// Re-export types from api-client for convenience
export type {
  ProjectStatus,
  PluginParameter,
  DspBlock,
  PluginPlan,
  Project,
  BuildStatus,
} from './api-client';

export interface ProjectWithMeta {
  id: string;
  prompt: string;
  status: string;
  retryCount: number;
  artifactKey: string | null;
  githubRunId: number | null;
  approvedPlan: string | null;
  createdAt: string;
  updatedAt: string;
  name: string;
  plan: {
    explanation: string;
    parameters: Array<{
      id: string;
      name: string;
      type: string;
      min?: number;
      max?: number;
      default: number | boolean | string;
      unit?: string;
    }>;
    dspBlocks: Array<{
      type: string;
      description: string;
    }>;
    architecture: string;
  } | null;
  hasArtifact: boolean;
}

export interface ProjectStats {
  total: number;
  success: number;
  failed: number;
  building: number;
  draft: number;
}

export interface ProjectListResponse {
  projects: ProjectWithMeta[];
  stats: ProjectStats;
}

export interface ProjectDetailResponse {
  id: string;
  userId: string;
  prompt: string;
  status: string;
  retryCount: number;
  artifactKey: string | null;
  githubRunId: number | null;
  currentPlan: string | null;
  approvedPlan: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chatMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

/**
 * Server-side authenticated fetch
 * Forwards session cookies to the backend API
 */
async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();

    // Properly serialize cookies for the header
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    if (!cookieHeader) {
      console.warn(`No cookies available for server fetch: ${path}`);
      return null;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      // No cache for user-specific data
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Server fetch failed: ${response.status} ${path}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`Server fetch error: ${path}`, error);
    return null;
  }
}

/**
 * Fetch all user projects with stats
 * Used by dashboard for project list
 */
export async function getProjects(): Promise<ProjectListResponse | null> {
  return serverFetch<ProjectListResponse>('/api/v1/projects');
}

/**
 * Fetch a single project with full details
 * Used by forge page for rehydration
 */
export async function getProjectById(projectId: string): Promise<ProjectDetailResponse | null> {
  return serverFetch<ProjectDetailResponse>(`/api/v1/projects/${projectId}`);
}

/**
 * Check if user is authenticated (server-side)
 * Returns user data or null
 */
export async function getServerSession(): Promise<{ user: { id: string; email: string; name: string | null } } | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.user ? data : null;
  } catch {
    return null;
  }
}
