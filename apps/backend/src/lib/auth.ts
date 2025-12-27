/**
 * BetterAuth Configuration for vAIst
 * Google OAuth with Cloudflare D1/KV integration
 */

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { KVNamespace } from '@cloudflare/workers-types';
import type { Env } from '../server';

// Type for the auth instance
export type Auth = ReturnType<typeof createAuth>;

/**
 * Creates a BetterAuth instance configured for Cloudflare Workers
 * Must be called with env bindings at runtime
 */
export function createAuth(env: Env, prisma: any) {
  return betterAuth({
    // Base URL for OAuth callbacks
    baseURL: env.BETTER_AUTH_URL,

    // Base path for auth routes (default is /api/auth)
    basePath: '/api/auth',

    // Database adapter - Prisma with D1
    database: prismaAdapter(prisma, {
      provider: 'sqlite', // D1 is SQLite-based
    }),

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes cache
      },
    },

    // Social providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // User configuration
    user: {
      additionalFields: {
        preferredModel: {
          type: 'string',
          required: false,
          defaultValue: 'gemini-3-flash-preview',
        },
      },
    },

    // Rate limiting via KV (if available)
    rateLimit: env.RATE_LIMIT_KV
      ? {
          enabled: true,
          window: 60, // 60 seconds window
          max: 100, // Max 100 requests per window
          storage: 'secondary-storage',
          customRules: {
            '/sign-in/social': {
              window: 60,
              max: 10, // Limit OAuth attempts
            },
          },
        }
      : { enabled: false },

    // Secondary storage for rate limiting (KV)
    secondaryStorage: env.RATE_LIMIT_KV
      ? {
          get: async (key: string) => {
            const value = await (env.RATE_LIMIT_KV as KVNamespace).get(key);
            return value ? JSON.parse(value) : null;
          },
          set: async (key: string, value: any, ttl?: number) => {
            await (env.RATE_LIMIT_KV as KVNamespace).put(
              key,
              JSON.stringify(value),
              ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined // KV min TTL is 60s
            );
          },
          delete: async (key: string) => {
            await (env.RATE_LIMIT_KV as KVNamespace).delete(key);
          },
        }
      : undefined,

    // Account configuration
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    // Advanced options
    advanced: {
      // For cross-subdomain support (app.vaist.net -> api.vaist.net)
      // Only enable in production - breaks localhost OAuth flow
      crossSubDomainCookies:
        env.NODE_ENV === 'production'
          ? {
              enabled: true,
              domain: '.vaist.net',
            }
          : {
              enabled: false,
            },
      // Use secure cookies in production
      useSecureCookies: env.NODE_ENV === 'production',
    },

    // Trust the proxy headers from Cloudflare
    // Include both the CORS origin (frontend) for OAuth callbacks
    trustedOrigins: [env.CORS_ORIGIN],
  });
}

/**
 * Get session from request headers
 */
export async function getSession(auth: Auth, headers: Headers) {
  return auth.api.getSession({ headers });
}
