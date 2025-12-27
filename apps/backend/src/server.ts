/**
 * vAIst Backend Server
 * AI-powered VST3 Plugin Generator API
 *
 * Built with:
 * - Hono (web framework)
 * - Prisma + D1 (database)
 * - BetterAuth (authentication)
 * - Durable Objects (real-time WebSocket)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { projectRoutes } from './routes/projects';
import { planRoutes } from './routes/plan';
import { buildRoutes } from './routes/build';
import { healthRoutes } from './routes/health';

// Re-export Durable Object classes for Wrangler
export { BuildStatus } from './durable-objects/BuildStatus';

// Cloudflare Worker bindings
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  AUTH_KV: KVNamespace;
  BUILD_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;

  // R2 Buckets
  PLUGINS_BUCKET: R2Bucket;
  LOGS_BUCKET: R2Bucket;

  // Durable Objects
  BUILD_STATUS: DurableObjectNamespace;

  // Environment variables
  NODE_ENV: string;
  CORS_ORIGIN: string;
  BETTER_AUTH_URL: string;
  DEFAULT_AI_MODEL: string;

  // Secrets (set via wrangler secret put)
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BACKEND_WEBHOOK_SECRET?: string;  // For WASM-ready webhook from GitHub Actions
  BETTER_AUTH_SECRET: string;
  DOWNLOAD_TOKEN_SECRET: string;
}

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.CORS_ORIGIN;
      // Allow configured origin and localhost for development
      if (
        origin === allowedOrigin ||
        origin?.startsWith('http://localhost:')
      ) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Mount routes
app.route('/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/v1/projects', projectRoutes);
app.route('/api/v1/plan', planRoutes);
app.route('/api/v1/build', buildRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'vAIst API',
    version: '1.0.0',
    description: 'AI-powered VST3 Plugin Generator',
    docs: '/api/v1',
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

export default app;
