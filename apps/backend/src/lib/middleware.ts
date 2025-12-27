/**
 * Middleware utilities for vAIst API
 */

import { createMiddleware } from 'hono/factory';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { Env } from '../server';
import { createAuth, type Auth } from './auth';

// Type for authenticated context
export type AuthenticatedContext = {
  Bindings: Env;
  Variables: {
    auth: Auth;
    prisma: PrismaClient;
    user: any;
    session: any;
  };
};

/**
 * Middleware that initializes Prisma and Auth
 * Use on routes that need database access
 */
export const withPrisma = createMiddleware<{
  Bindings: Env;
  Variables: { prisma: PrismaClient };
}>(async (c, next) => {
  const adapter = new PrismaD1(c.env.DB);
  const prisma = new PrismaClient({ adapter });
  c.set('prisma', prisma);
  await next();
});

/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated
 */
export const requireAuth = createMiddleware<AuthenticatedContext>(
  async (c, next) => {
    // Initialize Prisma
    const adapter = new PrismaD1(c.env.DB);
    const prisma = new PrismaClient({ adapter });
    c.set('prisma', prisma);

    // Initialize Auth
    const auth = createAuth(c.env, prisma);
    c.set('auth', auth);

    // Get session
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
        },
        401
      );
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  }
);

/**
 * Optional auth middleware
 * Sets user/session if authenticated, but doesn't block unauthenticated requests
 */
export const optionalAuth = createMiddleware<{
  Bindings: Env;
  Variables: {
    auth: Auth;
    prisma: PrismaClient;
    user: any | null;
    session: any | null;
  };
}>(async (c, next) => {
  // Initialize Prisma
  const adapter = new PrismaD1(c.env.DB);
  const prisma = new PrismaClient({ adapter });
  c.set('prisma', prisma);

  // Initialize Auth
  const auth = createAuth(c.env, prisma);
  c.set('auth', auth);

  // Try to get session
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('user', session?.user ?? null);
    c.set('session', session?.session ?? null);
  } catch {
    c.set('user', null);
    c.set('session', null);
  }

  await next();
});
