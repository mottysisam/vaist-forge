/**
 * Authentication Routes
 * Google OAuth via BetterAuth
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { Env } from '../server';
import { createAuth, type Auth } from '../lib/auth';

// Extended context with auth instance and session
type AuthContext = {
  Bindings: Env;
  Variables: {
    auth: Auth;
    user: any | null;
    session: any | null;
  };
};

export const authRoutes = new Hono<AuthContext>();

// Middleware to create auth instance with Prisma
authRoutes.use('*', async (c, next) => {
  // Create Prisma client with D1 adapter
  const adapter = new PrismaD1(c.env.DB);
  const prisma = new PrismaClient({ adapter });

  // Create auth instance
  const auth = createAuth(c.env, prisma);
  c.set('auth', auth);

  await next();
});

// BetterAuth handler - handles all OAuth flows
// POST /auth/sign-in/social - Initiate OAuth
// GET /auth/callback/google - OAuth callback
// POST /auth/sign-out - Sign out
// GET /auth/session - Get current session
authRoutes.on(['POST', 'GET'], '/*', async (c) => {
  const auth = c.get('auth');
  return auth.handler(c.req.raw);
});

// Custom session endpoint with user details
authRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ user: null, session: null }, 401);
  }

  return c.json({
    user: session.user,
    session: session.session,
  });
});
