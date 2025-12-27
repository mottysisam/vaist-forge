/**
 * Forge Client Wrapper
 *
 * Handles client-side concerns:
 * - API key modal prompt
 * - Client-side state that can't be in Server Component
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ForgePanel, type InitialProjectData } from '@/components/forge';
import { useAuthStore } from '@/stores/auth-store';
import { ApiKeyModal } from '@/components/settings/api-key-modal';

interface ForgeClientWrapperProps {
  initialProject: InitialProjectData | null;
}

export function ForgeClientWrapper({ initialProject }: ForgeClientWrapperProps) {
  const router = useRouter();
  const { hasApiKey } = useAuthStore();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // If user tries to access forge without API key, prompt them
  useEffect(() => {
    if (!hasApiKey) {
      setShowApiKeyModal(true);
    }
  }, [hasApiKey]);

  return (
    <>
      <ForgePanel initialProject={initialProject} />

      {/* API Key Modal - required to use forge */}
      <ApiKeyModal
        isOpen={showApiKeyModal && !hasApiKey}
        onClose={() => {
          setShowApiKeyModal(false);
          // If they still don't have a key after closing, go to dashboard
          if (!hasApiKey) {
            router.push('/dashboard');
          }
        }}
        required={false}
      />
    </>
  );
}
