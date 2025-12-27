"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  MessageSquare,
  Loader2,
  Sparkles,
  Sliders,
  Layers,
  Cpu,
  Send,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PluginPlan, PluginParameter, DspBlock } from "@/lib/api-client";

interface PlanCardProps {
  plan: PluginPlan;
  projectId: string;
  isLoading?: boolean;
  onApprove: () => void;
  onRefine: (message: string) => void;
  onImprove?: () => void;
  model?: string;
}

const architectureLabels: Record<string, string> = {
  mono: "Mono",
  stereo: "Stereo",
  stereo_linked: "Stereo (Linked)",
  mid_side: "Mid/Side",
};

const paramTypeColors: Record<string, string> = {
  float: "text-blue-400",
  int: "text-green-400",
  bool: "text-purple-400",
  choice: "text-yellow-400",
};

function ParameterChip({ param }: { param: PluginParameter }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <Sliders className="w-4 h-4 text-forge-primary" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{param.name}</div>
        <div className="text-xs text-muted-foreground flex gap-2">
          <span className={paramTypeColors[param.type]}>{param.type}</span>
          {param.min !== undefined && param.max !== undefined && (
            <span>
              {param.min} - {param.max}
              {param.unit && ` ${param.unit}`}
            </span>
          )}
          <span className="text-zinc-500">default: {String(param.default)}</span>
        </div>
      </div>
    </div>
  );
}

function DspBlockChip({ block }: { block: DspBlock }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <Cpu className="w-4 h-4 text-forge-glow mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{block.type}</div>
        <div className="text-xs text-muted-foreground">{block.description}</div>
      </div>
    </div>
  );
}

export function PlanCard({
  plan,
  projectId,
  isLoading,
  onApprove,
  onRefine,
  onImprove,
  model,
}: PlanCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [refinementMessage, setRefinementMessage] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  const handleRefine = async () => {
    if (!refinementMessage.trim() || isRefining) return;
    setIsRefining(true);
    await onRefine(refinementMessage.trim());
    setRefinementMessage("");
    setIsRefining(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  const handleImprove = async () => {
    if (!onImprove || isImproving) return;
    setIsImproving(true);
    await onImprove();
    setIsImproving(false);
  };

  return (
    <Card className="forge-glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-forge-primary" />
              AI Plan Proposal
            </CardTitle>
            <CardDescription>
              Review the generated plan before building
            </CardDescription>
          </div>
          {model && (
            <div className="text-xs text-muted-foreground bg-zinc-800/50 px-2 py-1 rounded">
              {model}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Explanation */}
        <motion.div
          className="p-4 rounded-xl bg-gradient-to-br from-forge-900/50 to-zinc-900/50 border border-forge-700/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm leading-relaxed">{plan.explanation}</p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <div className="text-2xl font-bold text-forge-primary">
              {plan.parameters.length}
            </div>
            <div className="text-xs text-muted-foreground">Parameters</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <div className="text-2xl font-bold text-forge-glow">
              {plan.dspBlocks.length}
            </div>
            <div className="text-xs text-muted-foreground">DSP Blocks</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <div className="text-lg font-bold text-zinc-300">
              {architectureLabels[plan.architecture]}
            </div>
            <div className="text-xs text-muted-foreground">Architecture</div>
          </div>
        </div>

        {/* Expandable Details */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Details
              </>
            )}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-4">
                  {/* Parameters */}
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Sliders className="w-4 h-4 text-forge-primary" />
                      Parameters
                    </h4>
                    <div className="grid gap-2">
                      {plan.parameters.map((param) => (
                        <ParameterChip key={param.id} param={param} />
                      ))}
                    </div>
                  </div>

                  {/* DSP Chain */}
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Layers className="w-4 h-4 text-forge-glow" />
                      DSP Chain
                    </h4>
                    <div className="grid gap-2">
                      {plan.dspBlocks.map((block, index) => (
                        <DspBlockChip key={`${block.type}-${index}`} block={block} />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Refinement Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={refinementMessage}
              onChange={(e) => setRefinementMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Request changes... (e.g., 'Add a high-pass filter')"
              disabled={isLoading || isRefining}
              className="h-10 pr-10 bg-zinc-900/50 border-zinc-700 focus:border-forge-primary"
            />
            <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
          </div>
          <Button
            onClick={handleRefine}
            disabled={!refinementMessage.trim() || isLoading || isRefining}
            variant="outline"
            size="icon"
            className="h-10 w-10 border-zinc-700 hover:border-forge-primary"
          >
            {isRefining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {onImprove && (
            <Button
              onClick={handleImprove}
              disabled={isLoading || isImproving || isRefining}
              variant="outline"
              className="h-11 px-4 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/50"
            >
              {isImproving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Improving...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  AI Improve
                </>
              )}
            </Button>
          )}
          <Button
            onClick={onApprove}
            disabled={isLoading || isImproving || isRefining}
            className={cn(
              "flex-1 h-11 font-semibold transition-all",
              isLoading
                ? "bg-zinc-700"
                : "bg-forge-primary hover:bg-forge-glow animate-molten-pulse"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve Plan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
