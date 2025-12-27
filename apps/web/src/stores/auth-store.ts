/**
 * Auth Store - Zustand state management for authentication
 * Handles user session, API key status, and auth actions
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authClient, signInWithGoogle as googleSignIn } from '@/lib/auth-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';

// User type from BetterAuth
interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;

  // API Key state
  hasApiKey: boolean;
  apiKeyProvider: 'google' | 'anthropic' | null;

  // Actions
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  checkApiKeyStatus: () => Promise<void>;
  setApiKey: (apiKey: string, provider: 'google' | 'anthropic') => Promise<boolean>;
  setSessionKey: (apiKey: string, provider: 'google' | 'anthropic', projectId: string) => Promise<boolean>;
  removeApiKey: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isInitializing: true,
      isLoading: false,
      error: null,
      hasApiKey: false,
      apiKeyProvider: null,

      /**
       * Initialize auth state from session
       * Called on app mount
       */
      initialize: async () => {
        try {
          const response = await authClient.getSession();

          // BetterAuth returns { data: { user, session } | null, error: ... }
          const sessionData = 'data' in response ? response.data : response;

          if (sessionData?.user) {
            set({
              user: sessionData.user as User,
              isAuthenticated: true,
              isInitializing: false,
            });

            // Check API key status after confirming auth
            await get().checkApiKeyStatus();
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isInitializing: false,
            });
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          set({
            user: null,
            isAuthenticated: false,
            isInitializing: false,
            error: 'Failed to initialize session',
          });
        }
      },

      /**
       * Initiate Google OAuth login
       */
      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          await googleSignIn('/dashboard');
          // Redirect happens automatically
        } catch (error) {
          console.error('Google login failed:', error);
          set({
            error: 'Failed to login with Google',
            isLoading: false,
          });
        }
      },

      /**
       * Logout and clear session
       */
      logout: async () => {
        set({ isLoading: true });
        try {
          await authClient.signOut();
          set({
            user: null,
            isAuthenticated: false,
            hasApiKey: false,
            apiKeyProvider: null,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Logout failed:', error);
          set({ isLoading: false });
        }
      },

      /**
       * Check if user has configured an API key
       */
      checkApiKeyStatus: async () => {
        try {
          const res = await fetch(`${API_URL}/api/user/api-key/status`, {
            credentials: 'include',
          });

          if (res.ok) {
            const data = await res.json();
            set({
              hasApiKey: data.hasKey,
              apiKeyProvider: data.provider || null,
            });
          }
        } catch (error) {
          console.error('Failed to check API key status:', error);
          // Silent fail - user may not have key yet
        }
      },

      /**
       * Set/update user's API key
       * Returns true on success, false on validation failure
       */
      setApiKey: async (apiKey: string, provider: 'google' | 'anthropic') => {
        set({ isLoading: true, error: null });

        try {
          const res = await fetch(`${API_URL}/api/user/api-key`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, provider }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to save API key');
          }

          set({
            hasApiKey: true,
            apiKeyProvider: provider,
            isLoading: false,
          });

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to save key';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      /**
       * Set a session-only API key (stored in Durable Object memory only)
       * This key is never persisted to D1 and is wiped after build completion
       */
      setSessionKey: async (apiKey: string, provider: 'google' | 'anthropic', projectId: string) => {
        set({ isLoading: true, error: null });

        try {
          // First validate the key with the backend
          const validateRes = await fetch(`${API_URL}/api/user/api-key/validate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, provider }),
          });

          if (!validateRes.ok) {
            throw new Error('Invalid API key');
          }

          // Store in Durable Object via WebSocket endpoint
          const wsUrl = `${API_URL.replace('http', 'ws')}/api/v1/build/${projectId}/ws`;
          const res = await fetch(`${API_URL}/api/v1/build/${projectId}/session-key`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, provider, ttl: 3600 }), // 1 hour TTL
          });

          if (!res.ok) {
            throw new Error('Failed to store session key');
          }

          // Mark as having a key (but it's session-only)
          set({
            hasApiKey: true,
            apiKeyProvider: provider,
            isLoading: false,
          });

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to save key';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      /**
       * Remove user's API key
       */
      removeApiKey: async () => {
        set({ isLoading: true });

        try {
          await fetch(`${API_URL}/api/user/api-key`, {
            method: 'DELETE',
            credentials: 'include',
          });

          set({
            hasApiKey: false,
            apiKeyProvider: null,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to remove API key:', error);
          set({ isLoading: false });
        }
      },

      /**
       * Clear error state
       */
      clearError: () => set({ error: null }),
    }),
    {
      name: 'vaist-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        hasApiKey: state.hasApiKey,
        apiKeyProvider: state.apiKeyProvider,
      }),
    }
  )
);
