/**
 * Settings Page
 *
 * User settings and API key management:
 * - View/update API key
 * - Select AI provider
 * - Account settings
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Key,
  Shield,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { ApiKeyModal } from '@/components/settings/api-key-modal';

export default function SettingsPage() {
  const { user, hasApiKey, apiKeyProvider, removeApiKey } = useAuthStore();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemoveKey = async () => {
    if (!confirm('Are you sure you want to remove your API key? You will need to add a new one to generate plugins.')) {
      return;
    }

    setIsRemoving(true);
    try {
      await removeApiKey();
    } finally {
      setIsRemoving(false);
    }
  };

  const providerNames: Record<string, string> = {
    google: 'Google AI (Gemini)',
    anthropic: 'Anthropic (Claude)',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 mt-1">
          Manage your account and API configuration
        </p>
      </motion.div>

      {/* Account Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h2 className="text-lg font-semibold text-zinc-300 mb-4">Account</h2>
        <div className="forge-glass rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-12 h-12 rounded-full border border-zinc-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <span className="text-lg text-zinc-500">
                  {user?.name?.[0] || user?.email?.[0] || '?'}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-zinc-200 font-medium">{user?.name || 'User'}</p>
              <p className="text-sm text-zinc-500">{user?.email}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* API Key Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          AI Provider API Key
        </h2>

        <div className="forge-glass rounded-xl border border-zinc-800 overflow-hidden">
          {hasApiKey ? (
            <>
              {/* Key Status - Configured */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">
                      API Key Configured
                    </p>
                    <p className="text-xs text-zinc-500">
                      Provider: {providerNames[apiKeyProvider || 'google'] || apiKeyProvider}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeyModal(true)}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update Key
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveKey}
                  disabled={isRemoving}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Key Status - Not Configured */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">
                      No API Key Configured
                    </p>
                    <p className="text-xs text-zinc-500">
                      You need an API key to generate plugins
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Key Button */}
              <div className="p-4">
                <Button
                  size="sm"
                  onClick={() => setShowApiKeyModal(true)}
                  className="flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Add API Key
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-4 flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <Shield className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-zinc-400">
            Your API key is encrypted with AES-256 before storage and never
            leaves your account. We use it only to generate plugins on your behalf.
          </p>
        </div>
      </motion.section>

      {/* Get API Keys Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-semibold text-zinc-300 mb-4">
          Get an API Key
        </h2>

        <div className="grid gap-3">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="forge-glass rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition flex items-center justify-between group"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200">Google AI Studio</p>
              <p className="text-xs text-zinc-500">Get a Gemini API key</p>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
          </a>

          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="forge-glass rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition flex items-center justify-between group"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200">Anthropic Console</p>
              <p className="text-xs text-zinc-500">Get a Claude API key</p>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
          </a>
        </div>
      </motion.section>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />
    </div>
  );
}
