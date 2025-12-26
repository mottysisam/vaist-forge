"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Activity,
  Code2,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectCapsule as ProjectCapsuleType } from "@/types/project";

interface ProjectCapsuleProps {
  project: ProjectCapsuleType;
  onPlay?: (project: ProjectCapsuleType) => void;
  onViewLogic?: (project: ProjectCapsuleType) => void;
  className?: string;
}

export function ProjectCapsule({
  project,
  onPlay,
  onViewLogic,
  className,
}: ProjectCapsuleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    SUCCESS: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      label: "Verified",
    },
    FAILED: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "Failed",
    },
    BUILDING: {
      icon: Loader2,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      label: "Building",
    },
  };

  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn(
        "relative group w-full",
        "bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden",
        "hover:border-orange-500/50 transition-all duration-300",
        className
      )}
    >
      {/* Molten ID Badge */}
      <div className="absolute top-0 right-0 p-2 bg-orange-600/10 border-l border-b border-orange-600/30 rounded-bl-lg z-10">
        <span className="text-[10px] font-mono text-orange-400 font-bold tracking-tighter">
          {project.id}
        </span>
      </div>

      {/* Version Badge */}
      {project.version > 1 && (
        <div className="absolute top-0 left-0 p-2">
          <span className="text-[9px] font-mono text-forge-glow bg-forge-glow/10 px-1.5 py-0.5 rounded">
            v{project.version}
          </span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Header: Intent */}
        <div className="space-y-1 pr-16">
          <h3 className="text-sm font-medium text-zinc-200 line-clamp-2">
            {project.prompt}
          </h3>
          <div className="flex gap-2 items-center text-[10px] text-zinc-500 uppercase tracking-widest">
            <Activity className="w-3 h-3 text-orange-500" />
            {project.type} ENGINE
          </div>
        </div>

        {/* Technical Stats "Manifest" */}
        <div className="flex gap-4 py-3 border-y border-zinc-800/50">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-600 uppercase">Controls</span>
            <span className="text-xs text-zinc-400">
              {project.manifest.controls.length} knobs
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-600 uppercase">Complexity</span>
            <span className="text-xs text-zinc-400">
              {project.manifest.complexity} lines
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-600 uppercase">Status</span>
            <div className="flex items-center gap-1">
              <StatusIcon
                className={cn(
                  "w-3 h-3",
                  status.color,
                  project.status === "BUILDING" && "animate-spin"
                )}
              />
              <span className={cn("text-xs", status.color)}>{status.label}</span>
            </div>
          </div>
        </div>

        {/* Expandable Controls Preview */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="py-3 space-y-3">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase">
                  <Sparkles className="w-3 h-3" />
                  Control Parameters
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.manifest.controls.map((control) => (
                    <div
                      key={control.id}
                      className="px-2 py-1 bg-zinc-800/50 rounded text-[10px] text-zinc-400 font-mono"
                    >
                      {control.name}: {Math.round(control.value * 100)}%
                    </div>
                  ))}
                </div>
                {project.manifest.dspType && (
                  <div className="text-[10px] text-zinc-600">
                    DSP: <span className="text-forge-primary">{project.manifest.dspType}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <span>{isExpanded ? "Hide" : "Show"} Details</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </button>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {project.status === "SUCCESS" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
                onClick={() => onViewLogic?.(project)}
              >
                <Code2 className="w-3 h-3 mr-2" /> View Logic
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
                onClick={() => onPlay?.(project)}
              >
                <Play className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-xs"
                asChild
              >
                <a
                  href={project.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-3 h-3 mr-2" /> VST3
                </a>
              </Button>
            </>
          )}

          {project.status === "BUILDING" && (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-xs text-yellow-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Building...
            </div>
          )}

          {project.status === "FAILED" && (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-xs text-red-500">
              <XCircle className="w-4 h-4" />
              Build Failed
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[9px] text-zinc-600 text-center">
          {project.timestamp.toLocaleString()}
        </div>
      </div>

      {/* Decorative Forge Glow */}
      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-orange-600/10 blur-3xl group-hover:bg-orange-600/20 transition-all pointer-events-none" />
    </motion.div>
  );
}
