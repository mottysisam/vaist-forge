/**
 * Core Types for vAIst
 */

import type { PluginPlan } from './schemas';

// ============================================
// Project Types
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

export interface Project {
  id: string;
  userId: string;
  prompt: string;
  approvedPlan: PluginPlan | null;
  status: ProjectStatus;
  githubRunId: string | null;
  retryCount: number;
  artifactKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// Note: PluginPlan, PluginParameter, and DspBlock are defined in schemas.ts
// and exported from there to avoid duplication

// ============================================
// Chat Types
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  planJson?: PluginPlan;
  createdAt: string;
}

// ============================================
// Build Types
// ============================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface BuildLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  step?: string;
}

export interface BuildStatus {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  logs: BuildLog[];
  startedAt?: string;
  completedAt?: string;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  preferredModel: string;
  createdAt: string;
}

// ============================================
// AI Model Types
// ============================================

export const AI_MODELS = {
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash',
    provider: 'google',
    description: 'Latest Gemini with deep reasoning (thinking_level: high)',
    default: true,
    thinkingLevel: 'high',
  },
  'gemini-2.5-pro-preview': {
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Advanced reasoning and code generation',
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Fast and capable reasoning',
  },
  'claude-opus-4-5-20251101': {
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    description: 'Most capable Claude model (fallback)',
    fallback: true,
  },
} as const;

export type AIModelId = keyof typeof AI_MODELS;

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
