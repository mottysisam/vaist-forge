/**
 * API Key Vault Modal
 *
 * First-time setup modal for users to configure their AI API key.
 * Shows on first login when hasApiKey is false.
 *
 * Features:
 * - Provider selection (Google AI / Anthropic)
 * - Secure password input with show/hide toggle
 * - Key validation before saving
 * - Links to get API keys
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Check,
  Shield,
  AlertCircle,
  Lock,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If true, user cannot dismiss without setting a key */
  required?: boolean;
  /** Project ID for session-only key storage in Durable Object */
  projectId?: string;
}

type Provider = 'google' | 'anthropic';

interface ProviderInfo {
  name: string;
  model: string;
  placeholder: string;
  getKeyUrl: string;
}

const providers: Record<Provider, ProviderInfo> = {
  google: {
    name: 'Google AI',
    model: 'Gemini 3 Flash',
    placeholder: 'AIza...',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
  },
  anthropic: {
    name: 'Anthropic',
    model: 'Claude Opus 4.5',
    placeholder: 'sk-ant-...',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
};

export function ApiKeyModal({ isOpen, onClose, required = false, projectId }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<Provider>('google');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionOnly, setSessionOnly] = useState(false);

  const { setApiKey: saveApiKey, setSessionKey } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      let success: boolean;

      if (sessionOnly && projectId) {
        // Session-only: store in Durable Object memory only
        success = await setSessionKey(apiKey, provider, projectId);
      } else {
        // Persistent: encrypt and store in D1
        success = await saveApiKey(apiKey, provider);
      }

      if (success) {
        setApiKey('');
        onClose();
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch {
      setError('Failed to save API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    if (!required) {
      setApiKey('');
      setError(null);
      onClose();
    }
  };

  const providerInfo = providers[provider];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="forge-glass rounded-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <Key className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Configure AI Provider
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Your key is encrypted and stored securely
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Security Note */}
              <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <Shield className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-400">
                  Your API key is encrypted with AES-256 before storage and never
                  leaves your account. We use it only to generate plugins on your behalf.
                </p>
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  Select Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(providers) as Provider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setProvider(p);
                        setError(null);
                      }}
                      className={`
                        p-3 rounded-lg border text-left transition-all
                        ${provider === p
                          ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(255,92,0,0.1)]'
                          : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
                        }
                      `}
                    >
                      <span className="text-sm font-medium text-zinc-200 block">
                        {providers[p].name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {providers[p].model}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setError(null);
                    }}
                    placeholder={providerInfo.placeholder}
                    className="
                      w-full px-4 py-3 pr-12
                      bg-zinc-900 border border-zinc-700 rounded-lg
                      text-zinc-100 placeholder:text-zinc-600
                      focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50
                      font-mono text-sm
                    "
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 transition"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Get Key Link */}
              <a
                href={providerInfo.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition"
              >
                Get your {providerInfo.name} API key
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Session-Only Toggle (Zero-Trust Mode) */}
              {projectId && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSessionOnly(!sessionOnly)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                      ${sessionOnly
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
                      }
                    `}
                  >
                    <div className={`p-2 rounded-lg ${sessionOnly ? 'bg-green-500/20' : 'bg-zinc-800'}`}>
                      {sessionOnly ? (
                        <Lock className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${sessionOnly ? 'text-green-300' : 'text-zinc-300'}`}>
                        Session-Only Mode
                      </p>
                      <p className="text-xs text-zinc-500">
                        {sessionOnly
                          ? 'Key held in memory only, never stored'
                          : 'Enable for maximum security (this build only)'
                        }
                      </p>
                    </div>
                    <div className={`
                      w-10 h-6 rounded-full transition-colors relative
                      ${sessionOnly ? 'bg-green-500' : 'bg-zinc-700'}
                    `}>
                      <div className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white transition-all
                        ${sessionOnly ? 'left-5' : 'left-1'}
                      `} />
                    </div>
                  </button>
                  {sessionOnly && (
                    <p className="text-xs text-green-400/70 px-1">
                      Your key will be cleared immediately after the build completes.
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {!required && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                    disabled={isValidating}
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!apiKey.trim() || isValidating}
                  className={`${required ? 'w-full' : 'flex-1'}`}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save API Key
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
