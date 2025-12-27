/**
 * Protected Layout
 *
 * Wraps all authenticated routes with:
 * - Navbar for navigation
 * - API Key Modal (shows on first login if no key configured)
 * - Auth state validation
 * - WamHostProvider for audio engine (WASM Studio)
 * - Floating plugin windows portal
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Navbar } from '@/components/nav/navbar';
import { ApiKeyModal } from '@/components/settings/api-key-modal';
import { Loader2 } from 'lucide-react';
import { WamHostProvider } from '@/lib/audio/wam-host-provider';
import { PluginWindowContainer } from '@/components/forge/plugin-window';
import { PluginSidebar, MinimizedBentoStrip } from '@/components/forge/plugin-sidebar';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isInitializing, hasApiKey } = useAuthStore();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isInitializing, isAuthenticated, router]);

  // Show API key modal on first visit if no key configured
  useEffect(() => {
    if (!isInitializing && isAuthenticated && !hasApiKey && !hasShownModal) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowApiKeyModal(true);
        setHasShownModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, isAuthenticated, hasApiKey, hasShownModal]);

  // Show loading while checking auth
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <WamHostProvider>
      <div className="min-h-screen bg-zinc-950">
        <Navbar />

        {/* Main content with top padding for fixed navbar */}
        <main className="pt-16">
          {children}
        </main>

        {/* API Key Setup Modal */}
        <ApiKeyModal
          isOpen={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
          required={false}
        />

        {/* WASM Studio: Floating Plugin Windows */}
        <PluginWindowContainer />

        {/* WASM Studio: Plugin Sidebar (docked plugins) */}
        <PluginSidebar />

        {/* WASM Studio: Minimized Window Bento Strip */}
        <MinimizedBentoStrip />
      </div>
    </WamHostProvider>
  );
}
