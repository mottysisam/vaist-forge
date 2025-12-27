/**
 * Build Status Badge
 *
 * Shows active/recent build status on the login page
 * Nudges users to log back in if they have builds running
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Hammer } from 'lucide-react';

interface BuildInfo {
  projectId: string;
  status: 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED';
  progress: number;
  projectName?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4203';

export function BuildStatusBadge() {
  const [builds, setBuilds] = useState<BuildInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkBuilds() {
      try {
        // Check for active builds using session cookie
        const res = await fetch(`${API_URL}/api/v1/build/active`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setBuilds(data.builds || []);
        }
      } catch {
        // Silent fail - user may not have any builds
      } finally {
        setIsLoading(false);
      }
    }

    checkBuilds();

    // Poll every 10 seconds for updates
    const interval = setInterval(checkBuilds, 10000);
    return () => clearInterval(interval);
  }, []);

  // Don't show anything if no builds or still loading
  if (isLoading || builds.length === 0) {
    return null;
  }

  const activeBuild = builds.find(
    (b) => b.status === 'BUILDING' || b.status === 'PENDING'
  );
  const recentBuild = builds[0];
  const displayBuild = activeBuild || recentBuild;

  if (!displayBuild) return null;

  const statusConfig = {
    PENDING: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
      label: 'Queued',
      animate: true,
    },
    BUILDING: {
      icon: Hammer,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/30',
      label: 'Building',
      animate: true,
    },
    SUCCESS: {
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/30',
      label: 'Complete',
      animate: false,
    },
    FAILED: {
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/30',
      label: 'Failed',
      animate: false,
    },
  };

  const config = statusConfig[displayBuild.status];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`
          fixed bottom-6 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-3 px-4 py-3 rounded-xl
          border backdrop-blur-xl shadow-2xl
          ${config.bg}
        `}
      >
        <Icon
          className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
        />

        <div className="flex flex-col">
          <span className="text-sm font-medium text-zinc-200">
            {displayBuild.projectName || `Build #${displayBuild.projectId.slice(0, 8)}`}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${config.color}`}>{config.label}</span>
            {displayBuild.status === 'BUILDING' && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-xs text-zinc-400">
                  {displayBuild.progress}%
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar for active builds */}
        {(displayBuild.status === 'BUILDING' || displayBuild.status === 'PENDING') && (
          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-orange-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${displayBuild.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        <span className="text-xs text-zinc-500 ml-2">
          Log in to view details
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
