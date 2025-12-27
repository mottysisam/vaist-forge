/**
 * User Routes
 * Profile and API key management
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { Env } from '../server';
import { createAuth, type Auth } from '../lib/auth';
import { encryptApiKey, decryptApiKey, validateApiKeyFormat } from '../lib/crypto';

// Extended context with auth instance and user
type UserContext = {
  Bindings: Env;
  Variables: {
    auth: Auth;
    prisma: PrismaClient;
    userId: string;
  };
};

export const userRoutes = new Hono<UserContext>();

// Middleware to create Prisma and auth instances, verify session
userRoutes.use('*', async (c, next) => {
  // Create Prisma client with D1 adapter
  const adapter = new PrismaD1(c.env.DB);
  const prisma = new PrismaClient({ adapter });
  c.set('prisma', prisma);

  // Create auth instance
  const auth = createAuth(c.env, prisma);
  c.set('auth', auth);

  // Verify session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', session.user.id);

  await next();
});

/**
 * POST /api/user/api-key/validate
 * Validate an API key without storing it
 * Used for session-only key validation
 */
userRoutes.post('/api-key/validate', async (c) => {
  const body = await c.req.json<{
    apiKey: string;
    provider: 'google' | 'anthropic';
  }>();

  const { apiKey, provider } = body;

  if (!apiKey || !provider) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (!['google', 'anthropic'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  // Validate format
  if (!validateApiKeyFormat(apiKey, provider)) {
    return c.json({ error: 'Invalid API key format', valid: false }, 400);
  }

  // Validate with live API call
  const isValid = await validateApiKey(apiKey, provider, c.env);

  if (!isValid) {
    return c.json({ error: 'API key validation failed', valid: false }, 400);
  }

  return c.json({ valid: true, provider });
});

/**
 * GET /api/user/api-key/status
 * Check if user has an API key configured
 */
userRoutes.get('/api-key/status', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.get('userId');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      encryptedApiKey: true,
      preferredModel: true,
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Determine provider from preferredModel
  let provider: 'google' | 'anthropic' | null = null;
  if (user.encryptedApiKey) {
    if (user.preferredModel?.includes('gemini')) {
      provider = 'google';
    } else if (user.preferredModel?.includes('claude')) {
      provider = 'anthropic';
    }
  }

  return c.json({
    hasKey: !!user.encryptedApiKey,
    provider,
    preferredModel: user.preferredModel,
  });
});

/**
 * POST /api/user/api-key
 * Set or update user's API key
 *
 * Body: { apiKey: string, provider: 'google' | 'anthropic' }
 */
userRoutes.post('/api-key', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.get('userId');

  const body = await c.req.json<{
    apiKey: string;
    provider: 'google' | 'anthropic';
  }>();

  const { apiKey, provider } = body;

  // Validate input
  if (!apiKey || !provider) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (!['google', 'anthropic'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  // Validate API key format
  if (!validateApiKeyFormat(apiKey, provider)) {
    return c.json({ error: 'Invalid API key format' }, 400);
  }

  // Validate the API key works by making a test call
  const isValid = await validateApiKey(apiKey, provider, c.env);

  if (!isValid) {
    return c.json({ error: 'API key validation failed' }, 400);
  }

  // Get encryption secret from environment
  const encryptionSecret = c.env.BETTER_AUTH_SECRET; // Reuse auth secret

  if (!encryptionSecret) {
    console.error('Missing encryption secret');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  // Encrypt the API key
  const encryptedKey = await encryptApiKey(apiKey, encryptionSecret, userId);

  // Determine preferred model based on provider
  const preferredModel =
    provider === 'google' ? 'gemini-3-flash-preview' : 'claude-opus-4-5';

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptedApiKey: encryptedKey,
      preferredModel,
    },
  });

  return c.json({
    success: true,
    provider,
    preferredModel,
  });
});

/**
 * DELETE /api/user/api-key
 * Remove user's API key
 */
userRoutes.delete('/api-key', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.get('userId');

  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptedApiKey: null,
      preferredModel: 'gemini-3-flash-preview', // Reset to default
    },
  });

  return c.json({ success: true });
});

/**
 * GET /api/user/api-key/quota
 * Get API usage/quota information
 * Note: This is a placeholder - actual quota depends on provider
 */
userRoutes.get('/api-key/quota', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.get('userId');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      encryptedApiKey: true,
      preferredModel: true,
    },
  });

  if (!user?.encryptedApiKey) {
    return c.json({ error: 'No API key configured' }, 404);
  }

  // Determine provider
  const provider = user.preferredModel?.includes('claude') ? 'anthropic' : 'google';

  // For now, return placeholder quota data
  // In production, this would query the actual provider's usage API
  return c.json({
    used: 0,
    limit: provider === 'google' ? 1500 : 1000, // Free tier limits
    resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    provider,
  });
});

/**
 * GET /api/user/profile
 * Get user profile details
 */
userRoutes.get('/profile', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.get('userId');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      preferredModel: true,
      createdAt: true,
      _count: {
        select: { projects: true },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    ...user,
    projectCount: user._count.projects,
    hasApiKey: false, // We already have /api-key/status for this
  });
});

/**
 * Validates an API key by making a test request
 */
async function validateApiKey(
  apiKey: string,
  provider: 'google' | 'anthropic',
  env: Env
): Promise<boolean> {
  try {
    if (provider === 'google') {
      // Test Google AI API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } else {
      // Test Anthropic API with a minimal request
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      // 200 = success, 400 = bad request (but key is valid), 401/403 = invalid key
      return response.status !== 401 && response.status !== 403;
    }
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
}

/**
 * Helper to get decrypted API key for a user
 * Used by other services (AI generation, etc.)
 */
export async function getUserApiKey(
  prisma: PrismaClient,
  userId: string,
  secret: string
): Promise<{ apiKey: string; provider: 'google' | 'anthropic' } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      encryptedApiKey: true,
      preferredModel: true,
    },
  });

  if (!user?.encryptedApiKey) {
    return null;
  }

  const apiKey = await decryptApiKey(user.encryptedApiKey, secret, userId);

  const provider = user.preferredModel?.includes('claude')
    ? 'anthropic'
    : 'google';

  return { apiKey, provider };
}
