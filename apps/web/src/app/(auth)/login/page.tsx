/**
 * Login Page - "Liquid Bento" Design
 *
 * Features:
 * - Glassmorphism center card
 * - Bento grid with value propositions
 * - Blurred workspace preview background
 * - Google OAuth
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { GoogleLoginButton } from '@/components/auth/google-login-button';
import { ValuePropCard } from '@/components/auth/value-prop-card';
import { BuildStatusBadge } from '@/components/auth/build-status-badge';

export default function LoginPage() {
  const router = useRouter();
  const {
    loginWithGoogle,
    isLoading,
    isAuthenticated,
    error,
    clearError,
  } = useAuthStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Clear error on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  return (
    <div className="min-h-screen bg-forge-bg relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-radial from-orange-950/30 via-transparent to-transparent" />
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-600/10 rounded-full blur-[80px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,92,0,0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,92,0,0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Blurred workspace preview (ghost cards) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 blur-sm pointer-events-none">
        <div className="grid grid-cols-3 gap-4 max-w-4xl w-full p-8">
          <div className="col-span-2 h-64 bg-zinc-800 rounded-2xl" />
          <div className="h-64 bg-zinc-800 rounded-2xl" />
          <div className="h-32 bg-zinc-800 rounded-2xl" />
          <div className="col-span-2 h-32 bg-zinc-800 rounded-2xl" />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 md:p-8">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
          {/* Left Column - Value Props */}
          <div className="hidden md:flex flex-col gap-4">
            <ValuePropCard
              icon="cpu"
              title="JUCE 8 POWERED"
              description="GPU-accelerated rendering with Direct2D & Metal for professional performance"
              delay={0.1}
            />
            <ValuePropCard
              icon="package"
              title="UNIVERSAL BINARIES"
              description="Mac + Windows, ARM64 + x86_64. Build once, run everywhere"
              delay={0.2}
            />
          </div>

          {/* Center - Main Login Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="md:row-span-2"
          >
            <div className="forge-glass rounded-3xl p-8 h-full flex flex-col items-center justify-center border border-orange-900/30">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8 text-center"
              >
                {/* Forge Icon */}
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 mb-4">
                  <svg
                    className="w-10 h-10 text-orange-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>

                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                  vAIst
                </h1>
                <p className="text-orange-400/60 text-sm mt-1 font-mono tracking-widest">
                  FORGE
                </p>
              </motion.div>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-zinc-400 text-center mb-8 max-w-xs leading-relaxed"
              >
                AI-powered VST3 plugin generator.
                <br />
                <span className="text-zinc-500">
                  Describe your sound, we build the plugin.
                </span>
              </motion.p>

              {/* Google Login Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <GoogleLoginButton
                  onClick={loginWithGoogle}
                  isLoading={isLoading}
                />
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-red-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* Terms */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 text-[10px] text-zinc-600 text-center max-w-xs"
              >
                By continuing, you agree to our Terms of Service and Privacy Policy
              </motion.p>
            </div>
          </motion.div>

          {/* Right Column - Value Props */}
          <div className="hidden md:flex flex-col gap-4">
            <ValuePropCard
              icon="zap"
              title="CLOUDFLARE FAST"
              description="Global edge network delivers sub-100ms latency worldwide"
              delay={0.15}
            />
            <ValuePropCard
              icon="sparkles"
              title="AI-FIRST DESIGN"
              description="Gemini 3 Flash primary, Claude Opus 4.5 fallback for reliability"
              delay={0.25}
            />
          </div>

          {/* Mobile Value Props (shown below login on mobile) */}
          <div className="md:hidden col-span-1 grid grid-cols-2 gap-3 mt-4">
            <ValuePropCard
              icon="cpu"
              title="JUCE 8"
              description="GPU-accelerated"
              delay={0.3}
            />
            <ValuePropCard
              icon="zap"
              title="FAST"
              description="Edge-powered"
              delay={0.35}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <div className="text-zinc-600 text-xs space-x-4 font-mono">
          <a
            href="/privacy"
            className="hover:text-zinc-400 transition"
          >
            Privacy
          </a>
          <span className="text-zinc-700">•</span>
          <a
            href="/docs"
            className="hover:text-zinc-400 transition"
          >
            Docs
          </a>
          <span className="text-zinc-700">•</span>
          <a
            href="https://github.com/mottysisam/vaist-forge"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* Build Status Badge - shows if user has active builds */}
      <BuildStatusBadge />
    </div>
  );
}
