/**
 * API Quota Indicator
 *
 * Shows API usage/quota status instead of a simple green/red dot
 * Helps users understand why generation might be slow
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface QuotaInfo {
  used: number;
  limit: number;
  resetAt?: string;
  provider: 'google' | 'anthropic';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';

export function ApiQuotaIndicator() {
  const { hasApiKey, apiKeyProvider } = useAuthStore();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!hasApiKey) return;

    async function fetchQuota() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/user/api-key/quota`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setQuota(data);
        }
      } catch {
        // Silent fail - quota endpoint may not exist yet
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuota();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuota, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hasApiKey]);

  // Not configured state
  if (!hasApiKey) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">Setup</span>
        </div>

        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-2 w-48 p-2 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl z-50"
          >
            <p className="text-xs text-zinc-300">
              Configure your API key to start generating plugins
            </p>
          </motion.div>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading && !quota) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/50">
        <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  // Quota data available
  if (quota) {
    const usagePercent = (quota.used / quota.limit) * 100;
    const isLow = usagePercent > 80;
    const isExhausted = usagePercent >= 100;

    return (
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`
            flex items-center gap-1.5 px-2 py-1 rounded-md border
            ${isExhausted
              ? 'bg-red-500/10 border-red-500/20'
              : isLow
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-green-500/10 border-green-500/20'
            }
          `}
        >
          <Zap
            className={`w-3.5 h-3.5 ${
              isExhausted
                ? 'text-red-400'
                : isLow
                  ? 'text-amber-400'
                  : 'text-green-400'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isExhausted
                ? 'text-red-400'
                : isLow
                  ? 'text-amber-400'
                  : 'text-green-400'
            }`}
          >
            {Math.round(100 - usagePercent)}%
          </span>
        </div>

        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-2 w-56 p-3 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl z-50"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">API Usage</span>
                <span className="text-zinc-300">
                  {quota.used.toLocaleString()} / {quota.limit.toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isExhausted
                      ? 'bg-red-500'
                      : isLow
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 capitalize">{quota.provider}</span>
                {quota.resetAt && (
                  <span className="text-zinc-500">
                    Resets {new Date(quota.resetAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {isExhausted && (
                <p className="text-xs text-red-400 mt-2">
                  Quota exhausted. Upgrade your plan or wait for reset.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Fallback: Just show configured status
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
        <Zap className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs text-green-400 font-medium">Ready</span>
      </div>

      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-full mt-2 w-48 p-2 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl z-50"
        >
          <p className="text-xs text-zinc-300 capitalize">
            {apiKeyProvider || 'API'} key configured and ready
          </p>
        </motion.div>
      )}
    </div>
  );
}
