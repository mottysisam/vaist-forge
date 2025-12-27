/**
 * @vaist/shared
 * Shared types and utilities for vAIst platform
 */

// Export types (excluding ones defined in schemas)
export {
  type ProjectStatus,
  type Project,
  type MessageRole,
  type ChatMessage,
  type LogLevel,
  type BuildLog,
  type BuildStatus,
  type User,
  AI_MODELS,
  type AIModelId,
  type ApiResponse,
  type PaginatedResponse,
} from './types';

// Export schemas and their inferred types
export * from './schemas';
