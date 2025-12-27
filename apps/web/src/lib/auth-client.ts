/**
 * BetterAuth Client for vAIst
 * Connects to the Cloudflare Worker backend
 */

import { createAuthClient } from 'better-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5203';

export const authClient = createAuthClient({
  baseURL: API_URL,
});

// Convenience exports
export const {
  signIn,
  signOut,
  useSession,
  getSession,
} = authClient;

/**
 * Sign in with Google OAuth
 * Redirects to Google, then back to callbackURL on the frontend
 */
export async function signInWithGoogle(redirectPath = '/dashboard') {
  // Use absolute URL to ensure redirect goes to frontend, not backend
  const callbackURL = `${APP_URL}${redirectPath}`;
  return signIn.social({
    provider: 'google',
    callbackURL,
  });
}

/**
 * Get current session (for server components)
 */
export async function getServerSession() {
  try {
    return await getSession();
  } catch {
    return null;
  }
}
