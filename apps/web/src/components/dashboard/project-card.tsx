/**
 * ProjectCard Component
 *
 * Displays a project in the dashboard with:
 * - Status badge with appropriate colors
 * - Truncated prompt/description
 * - Quick actions (continue, download, delete)
 * - Relative timestamp
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  FileEdit,
  Download,
  Clock,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { deleteProject } from '@/lib/api-client';
import type { ProjectWithMeta } from '@/lib/server-api';

interface ProjectCardProps {
  project: ProjectWithMeta;
  index?: number;
  onDelete?: (projectId: string) => void;
}

// Status configuration
const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-800/50',
    icon: <FileEdit className="w-3 h-3" />,
  },
  PLANNING: {
    label: 'Planning',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  PLAN_PROPOSED: {
    label: 'Awaiting Approval',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    icon: <Clock className="w-3 h-3" />,
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: <Check className="w-3 h-3" />,
  },
  GENERATING: {
    label: 'Generating',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  PUSHING: {
    label: 'Pushing',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  BUILDING: {
    label: 'Building',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  SUCCESS: {
    label: 'Ready',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: <Check className="w-3 h-3" />,
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export function ProjectCard({ project, index = 0, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const config = statusConfig[project.status] || statusConfig.DRAFT;
  const isInProgress = ['PLANNING', 'GENERATING', 'PUSHING', 'BUILDING'].includes(
    project.status
  );
  const canDownload = project.status === 'SUCCESS' && project.hasArtifact;

  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // All cards link to forge with projectId for state rehydration
  const projectLink = `/forge?projectId=${project.id}`;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);

    try {
      await deleteProject(project.id);
      onDelete?.(project.id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete project:', error);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={projectLink} className="block">
        <div
          className={cn(
            'group forge-glass rounded-xl p-5 border transition-all cursor-pointer relative',
            project.status === 'SUCCESS'
              ? 'border-green-500/30 hover:border-green-500/50'
              : project.status === 'FAILED'
              ? 'border-red-500/30 hover:border-red-500/50'
              : isInProgress
              ? 'border-orange-500/30 hover:border-orange-500/50'
              : 'border-zinc-800 hover:border-zinc-700'
          )}
        >
          {/* Delete confirmation overlay */}
          {showConfirm && (
            <div
              className="absolute inset-0 bg-zinc-900/95 rounded-xl flex flex-col items-center justify-center z-10 p-4"
              onClick={(e) => e.preventDefault()}
            >
              <p className="text-sm text-zinc-300 mb-4 text-center">
                Delete this project?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="text-xs bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3 mr-1" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Header: Status + Time + Delete */}
          <div className="flex items-center justify-between mb-3">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                config.bgColor,
                config.color
              )}
            >
              {config.icon}
              {config.label}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">
                {getRelativeTime(project.updatedAt)}
              </span>
              {/* Delete button - only show when not in progress */}
              {!isInProgress && (
                <button
                  onClick={handleDeleteClick}
                  className="p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Body: Name/Prompt */}
          <h3 className="text-sm font-medium text-zinc-200 mb-2 line-clamp-2 group-hover:text-orange-300 transition-colors">
            {project.name}
          </h3>

          {/* Meta info */}
          {project.plan && (
            <div className="flex gap-3 text-xs text-zinc-500 mb-4">
              <span>{project.plan.parameters.length} params</span>
              <span>{project.plan.dspBlocks.length} DSP blocks</span>
            </div>
          )}

          {/* Status indicator footer */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
            {isInProgress && (
              <div className="flex items-center gap-2 text-xs text-orange-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Building...</span>
              </div>
            )}

            {canDownload && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <Download className="w-3 h-3" />
                <span>Ready to download</span>
              </div>
            )}

            {!isInProgress && !canDownload && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 group-hover:text-orange-400 transition-colors">
                <span>Open</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
