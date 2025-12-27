/**
 * Auth Provider - Initializes auth state on app mount
 */

'use client';

import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Loading screen shown during auth initialization
 */
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-forge-bg flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Animated Logo */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px rgba(255, 92, 0, 0.3)',
              '0 0 40px rgba(255, 92, 0, 0.5)',
              '0 0 20px rgba(255, 92, 0, 0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30"
        >
          <Zap className="w-8 h-8 text-orange-400" />
        </motion.div>

        {/* Loading Text */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
            vAIst Forge
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Initializing...</p>
        </div>

        {/* Loading Bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * AuthProvider wraps the app and handles auth initialization
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { initialize, isInitializing } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
