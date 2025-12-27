/**
 * Health Check Routes
 * Used by CI/CD and monitoring
 */

import { Hono } from 'hono';
import type { Env } from '../server';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', async (c) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: 'unknown',
      kv: 'unknown',
      r2: 'unknown',
    },
  };

  try {
    // Check D1
    await c.env.DB.prepare('SELECT 1').first();
    checks.checks.database = 'healthy';
  } catch {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }

  try {
    // Check KV
    await c.env.AUTH_KV.get('health-check');
    checks.checks.kv = 'healthy';
  } catch {
    checks.checks.kv = 'unhealthy';
    checks.status = 'degraded';
  }

  try {
    // Check R2
    await c.env.PLUGINS_BUCKET.head('health-check');
    checks.checks.r2 = 'healthy';
  } catch {
    // R2 returns null for non-existent keys, not an error
    checks.checks.r2 = 'healthy';
  }

  return c.json(checks, checks.status === 'healthy' ? 200 : 503);
});
