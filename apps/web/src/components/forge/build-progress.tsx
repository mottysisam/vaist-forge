"use client";

import { motion } from "framer-motion";
import { Sparkles, Code2, GitBranch, Hammer, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeStatus } from "@/app/actions/forge";

interface BuildProgressProps {
  status: ForgeStatus | null;
  className?: string;
}

const stages = [
  { key: "PENDING", label: "Igniting", icon: Sparkles },
  { key: "SYNTHESIZING", label: "Synthesizing", icon: Code2 },
  { key: "PUSHING", label: "Forging", icon: GitBranch },
  { key: "BUILDING", label: "Tempering", icon: Hammer },
  { key: "SUCCESS", label: "Complete", icon: CheckCircle2 },
] as const;

const stageOrder = ["PENDING", "SYNTHESIZING", "PUSHING", "BUILDING", "SUCCESS"] as const;

export function BuildProgress({ status, className }: BuildProgressProps) {
  if (!status) return null;

  const currentIndex = stageOrder.indexOf(status.status as typeof stageOrder[number]);
  const isFailed = status.status === "FAILED";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress Bar */}
      <div className="relative h-2 bg-forge-800 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full",
            isFailed ? "bg-destructive" : "bg-gradient-to-r from-forge-ember via-forge-primary to-forge-glow"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${status.progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {!isFailed && status.progress < 100 && (
          <motion.div
            className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ left: ["-20%", "120%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Stage Indicators */}
      <div className="flex justify-between">
        {stages.map((stage, index) => {
          const isActive = currentIndex === index && !isFailed;
          const isComplete = currentIndex > index;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex flex-col items-center gap-2">
              <motion.div
                className={cn(
                  "relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  isComplete && "bg-forge-primary/20 border-forge-primary text-forge-primary",
                  isActive && "border-forge-glow text-forge-glow",
                  !isActive && !isComplete && "border-forge-700 text-forge-700"
                )}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
              >
                <Icon className="w-5 h-5" />
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-forge-glow"
                    animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive && "text-forge-glow",
                  isComplete && "text-forge-primary",
                  !isActive && !isComplete && "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      {status.message && (
        <motion.div
          className={cn(
            "text-center text-sm",
            isFailed ? "text-destructive" : "text-muted-foreground"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={status.message}
        >
          {isFailed && <XCircle className="inline-block w-4 h-4 mr-2" />}
          {status.message}
        </motion.div>
      )}

      {/* Error Display */}
      {isFailed && status.error && (
        <motion.div
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          {status.error}
        </motion.div>
      )}
    </div>
  );
}
