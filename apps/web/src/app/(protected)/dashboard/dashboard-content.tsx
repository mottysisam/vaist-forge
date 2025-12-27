/**
 * Dashboard Content (Client Component)
 *
 * Handles client-side rendering with:
 * - Framer Motion animations
 * - Interactive project cards
 * - Auth store for user info
 */

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Hammer,
  FolderOpen,
  Clock,
  Zap,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { ProjectCard } from '@/components/dashboard';
import type { ProjectWithMeta, ProjectStats } from '@/lib/server-api';

interface DashboardContentProps {
  projects: ProjectWithMeta[];
  stats: ProjectStats;
}

export function DashboardContent({ projects, stats }: DashboardContentProps) {
  const { user, hasApiKey } = useAuthStore();

  // Recent projects (last 6)
  const recentProjects = projects.slice(0, 6);
  const hasProjects = projects.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-zinc-100">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-zinc-500 mt-1">
          {hasProjects
            ? `You have ${stats.building} plugin${stats.building !== 1 ? 's' : ''} building`
            : 'What will you forge today?'}
        </p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* New Plugin Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/forge">
            <div className="group forge-glass rounded-xl p-6 border border-zinc-800 hover:border-orange-500/50 transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500/20 transition">
                  <Plus className="w-6 h-6 text-orange-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-1">
                New Plugin
              </h3>
              <p className="text-sm text-zinc-500">
                Describe your effect and forge a VST3
              </p>
            </div>
          </Link>
        </motion.div>

        {/* My Projects Card - Links to projects section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <a href="#recent-projects" className="block">
            <div className="group forge-glass rounded-xl p-6 border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 group-hover:bg-zinc-700/50 transition">
                  <FolderOpen className="w-6 h-6 text-zinc-400" />
                </div>
                <span className="text-xs text-zinc-300 bg-zinc-800/50 px-2 py-1 rounded font-medium">
                  {stats.total} total
                </span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-1 group-hover:text-orange-300 transition-colors">
                My Projects
              </h3>
              <p className="text-sm text-zinc-500">
                {stats.success > 0
                  ? `${stats.success} ready to download`
                  : stats.total > 0
                  ? 'View and manage your plugins'
                  : 'No projects yet - start forging!'}
              </p>
              {stats.total > 0 && (
                <div className="flex items-center gap-1 mt-3 text-xs text-zinc-500 group-hover:text-orange-400 transition-colors">
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </div>
          </a>
        </motion.div>

        {/* Status Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="forge-glass rounded-xl p-6 border border-zinc-800 h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                <Clock className="w-6 h-6 text-zinc-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">
              Build Status
            </h3>
            <div className="space-y-2">
              {stats.building > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                  <span className="text-zinc-400">{stats.building} building</span>
                </div>
              )}
              {stats.draft > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400">{stats.draft} in draft</span>
                </div>
              )}
              {stats.success > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-zinc-400">{stats.success} completed</span>
                </div>
              )}
              {stats.failed > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-zinc-400">{stats.failed} failed</span>
                </div>
              )}
              {stats.total === 0 && (
                <p className="text-sm text-zinc-600">No projects yet</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* API Key Warning */}
      {!hasApiKey && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="forge-glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-zinc-200">
                  API Key Required
                </h4>
                <p className="text-xs text-zinc-500">
                  Configure your AI provider key to start generating plugins
                </p>
              </div>
              <Link href="/settings">
                <Button size="sm" variant="outline">
                  Configure
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Projects Grid */}
      {hasProjects && (
        <motion.div
          id="recent-projects"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8 scroll-mt-20"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-300">
              Recent Projects
            </h2>
            {projects.length > 6 && (
              <Link
                href="/projects"
                className="text-sm text-zinc-500 hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-lg font-semibold text-zinc-300 mb-4">Your Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="forge-glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Hammer className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Plugins Created</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">{stats.total}</p>
          </div>

          <div className="forge-glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-zinc-500">Successful Builds</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">{stats.success}</p>
          </div>

          <div className="forge-glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-zinc-500">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">{stats.building}</p>
          </div>

          <div className="forge-glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-zinc-500">Failed</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">{stats.failed}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
