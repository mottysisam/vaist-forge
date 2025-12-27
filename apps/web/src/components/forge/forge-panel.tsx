"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hammer, AudioLines, Loader2, Flame, Sparkles, Archive, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuildProgress } from "./build-progress";
import { MiniStudio } from "./mini-studio";
import { ProjectCapsule } from "./project-capsule";
import { PlanCard } from "./plan-card";
import { BrowserPreview } from "./browser-preview";
import { useForgeStatus } from "@/hooks/use-forge-status";
import { cn } from "@/lib/utils";
import {
  type ProjectCapsule as ProjectCapsuleType,
  inferPluginType,
  inferControlsFromPrompt,
} from "@/types/project";
import {
  createProject,
  generatePlan,
  refinePlan,
  approvePlan,
  triggerBuild,
  stopBuild,
  restartBuild,
  improvePlan,
  type PluginPlan,
} from "@/lib/api-client";

// Props for SSR rehydration
export interface InitialProjectData {
  id: string;
  prompt: string;
  status: string;
  plan: PluginPlan | null;
  errorMessage?: string | null;
}

// Generate unique plugin ID (VAI + 3 chars)
function generatePluginId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 3 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
  return `VAI${suffix}`;
}

// Forge flow phases
type ForgePhase = "idle" | "planning" | "plan_proposed" | "approved" | "building";

interface ForgePanelProps {
  initialProject?: InitialProjectData | null;
}

export function ForgePanel({ initialProject }: ForgePanelProps) {
  const [prompt, setPrompt] = useState(initialProject?.prompt || "");
  const [phase, setPhase] = useState<ForgePhase>(() => {
    // Determine initial phase from server data
    if (!initialProject) return "idle";
    switch (initialProject.status) {
      case "PLAN_PROPOSED":
        return "plan_proposed";
      case "APPROVED":
        return "approved";
      case "FAILED":
        // If failed but has an approved plan, allow retry from approved state
        return initialProject.plan ? "approved" : "idle";
      case "GENERATING":
      case "PUSHING":
      case "BUILDING":
        return "building";
      case "PLANNING":
        return "planning";
      default:
        return "idle";
    }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    initialProject?.id || null
  );
  const [currentPlan, setCurrentPlan] = useState<PluginPlan | null>(
    initialProject?.plan || null
  );
  const [planModel, setPlanModel] = useState<string | undefined>();
  const [currentPrompt, setCurrentPrompt] = useState(initialProject?.prompt || "");
  const [projects, setProjects] = useState<ProjectCapsuleType[]>([]);
  const [error, setError] = useState<string | null>(initialProject?.errorMessage || null);
  const [activeProject, setActiveProject] = useState<ProjectCapsuleType | null>(null);

  // Derived states
  const isForging = phase !== "idle" && phase !== "plan_proposed" && phase !== "approved";

  const { status, startPolling, reset } = useForgeStatus({
    onSuccess: () => {
      if (currentProjectId) {
        const controls = currentPlan?.parameters.map(p => ({
          id: p.id,
          label: p.name,
          type: p.type === 'float' ? 'knob' : p.type === 'bool' ? 'toggle' : 'knob',
          min: p.min ?? 0,
          max: p.max ?? 100,
          defaultValue: typeof p.default === 'number' ? p.default : 50,
        })) || inferControlsFromPrompt(currentPrompt);

        const newProject: ProjectCapsuleType = {
          id: generatePluginId(),
          taskId: currentProjectId,
          prompt: currentPrompt,
          type: inferPluginType(currentPrompt),
          timestamp: new Date(),
          status: "SUCCESS",
          manifest: {
            controls: controls as ProjectCapsuleType['manifest']['controls'],
            complexity: currentPlan?.dspBlocks.length ? currentPlan.dspBlocks.length * 50 : 100,
            dspType: inferPluginType(currentPrompt).toLowerCase(),
          },
          version: 1,
        };
        setProjects((prev) => [newProject, ...prev]);
        setActiveProject(newProject);
      }
      setPhase("idle");
      setCurrentPlan(null);
    },
    onError: (err) => {
      if (currentProjectId) {
        const controls = inferControlsFromPrompt(currentPrompt);
        const failedProject: ProjectCapsuleType = {
          id: generatePluginId(),
          taskId: currentProjectId,
          prompt: currentPrompt,
          type: inferPluginType(currentPrompt),
          timestamp: new Date(),
          status: "FAILED",
          manifest: {
            controls,
            complexity: 0,
          },
          version: 1,
        };
        setProjects((prev) => [failedProject, ...prev]);
      }
      setError(err);
      setPhase("idle");
      setCurrentPlan(null);
    },
  });

  // SSR Rehydration: Start polling if project is already building
  useEffect(() => {
    if (initialProject?.id && phase === "building") {
      startPolling(initialProject.id);
    }
  }, [initialProject?.id, phase, startPolling]);

  // Step 1: Create project and generate plan
  const handleForge = useCallback(async () => {
    if (!prompt.trim() || isForging) return;

    setError(null);
    setPhase("planning");
    setActiveProject(null);
    reset();

    const trimmedPrompt = prompt.trim();
    setCurrentPrompt(trimmedPrompt);

    try {
      // Create project first
      const { projectId } = await createProject(trimmedPrompt);
      setCurrentProjectId(projectId);

      // Generate AI plan
      const result = await generatePlan(projectId);
      setCurrentPlan(result.plan);
      setPlanModel(result.model);
      setPhase("plan_proposed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
      setPhase("idle");
    }
  }, [prompt, isForging, reset]);

  // Step 2: Refine the plan
  const handleRefinePlan = useCallback(async (message: string) => {
    if (!currentProjectId) return;

    try {
      const result = await refinePlan(currentProjectId, message);
      setCurrentPlan(result.plan);
      setPlanModel(result.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine plan");
    }
  }, [currentProjectId]);

  // Step 3: Approve plan (saves to APPROVED state)
  const handleApprovePlan = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      await approvePlan(currentProjectId);
      setPhase("approved");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve plan");
    }
  }, [currentProjectId]);

  // Step 4: Trigger build (separate from approval)
  const handleTriggerBuild = useCallback(async () => {
    if (!currentProjectId) return;

    setPhase("building");
    setError(null);

    try {
      await triggerBuild(currentProjectId);
      startPolling(currentProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start build");
      setPhase("approved"); // Stay in approved state on error
    }
  }, [currentProjectId, startPolling]);

  // Stop/Cancel an in-progress build
  const handleStopBuild = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const result = await stopBuild(currentProjectId);
      reset(); // Stop polling
      // Update phase based on the new status
      if (result.status === 'APPROVED') {
        setPhase("approved");
      } else if (result.status === 'PLAN_PROPOSED') {
        setPhase("plan_proposed");
      } else {
        setPhase("idle");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop build");
    }
  }, [currentProjectId, reset]);

  // Restart build with existing approved plan
  const handleRestartBuild = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      await restartBuild(currentProjectId);
      setPhase("approved");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart build");
    }
  }, [currentProjectId]);

  // AI improve plan
  const handleImprovePlan = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const result = await improvePlan(currentProjectId);
      setCurrentPlan(result.plan);
      setPlanModel(result.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to improve plan");
    }
  }, [currentProjectId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleForge();
    }
  };

  const handlePlayProject = (project: ProjectCapsuleType) => {
    setActiveProject(project);
  };

  const handleViewLogic = (project: ProjectCapsuleType) => {
    // TODO: Open modal with DSP code
    console.log("View logic for:", project.id);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3">
            <Flame className="w-10 h-10 text-forge-primary animate-ember" />
            <h1 className="text-4xl font-bold tracking-tight forge-glow-text">
              vAIst <span className="text-forge-primary">Forge</span>
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Describe your audio effect and watch the Forge craft a professional VST3 plugin.
          </p>
        </motion.div>

        {/* Main Grid: Command + Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Command Console + Progress */}
          <div className="space-y-6">
            {/* Command Console */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="forge-glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hammer className="w-5 h-5 text-forge-primary" />
                    Command Console
                  </CardTitle>
                  <CardDescription>
                    Describe the audio effect you want to create
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g., A warm tape saturation with drive and mix controls..."
                      disabled={isForging}
                      className="h-12 pr-12 bg-forge-900/50 border-forge-700 focus:border-forge-primary placeholder:text-muted-foreground/50"
                    />
                    <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
                  </div>
                  <Button
                    onClick={handleForge}
                    disabled={!prompt.trim() || isForging}
                    className={cn(
                      "w-full h-12 text-base font-semibold transition-all",
                      isForging
                        ? "bg-forge-700"
                        : "bg-forge-primary hover:bg-forge-glow animate-molten-pulse"
                    )}
                  >
                    {isForging ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Forging...
                      </>
                    ) : (
                      <>
                        <Hammer className="w-5 h-5 mr-2" />
                        Ignite the Forge
                      </>
                    )}
                  </Button>

                  {error && (
                    <motion.p
                      className="text-sm text-destructive text-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Plan Card (Interactive Handshake) */}
            <AnimatePresence>
              {phase === "plan_proposed" && currentPlan && currentProjectId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <PlanCard
                    plan={currentPlan}
                    projectId={currentProjectId}
                    model={planModel}
                    onApprove={handleApprovePlan}
                    onRefine={handleRefinePlan}
                    onImprove={handleImprovePlan}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Approved Plan - Ready to Build */}
            <AnimatePresence>
              {phase === "approved" && currentPlan && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="forge-glass border-green-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-400">
                        <Sparkles className="w-5 h-5" />
                        Plan Approved
                      </CardTitle>
                      <CardDescription>
                        Your plugin design is saved. Start the build when ready.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Quick summary */}
                      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                        <p className="text-sm text-zinc-300">{currentPlan.explanation}</p>
                        <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                          <span>{currentPlan.parameters.length} parameters</span>
                          <span>{currentPlan.dspBlocks.length} DSP blocks</span>
                          <span>{currentPlan.architecture}</span>
                        </div>
                      </div>

                      {/* Build and Restart buttons */}
                      <div className="flex gap-3">
                        <Button
                          onClick={handleTriggerBuild}
                          className="flex-1 h-12 text-base font-semibold bg-forge-primary hover:bg-forge-glow"
                        >
                          <Hammer className="w-5 h-5 mr-2" />
                          Start Build
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleRestartBuild}
                          className="h-12 px-4 border-zinc-600 hover:bg-zinc-800"
                          title="Reset to approved state (use after failed builds)"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </Button>
                      </div>

                      {error && (
                        <p className="text-sm text-destructive text-center">{error}</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Forge (Progress) - shown during planning and building */}
            <AnimatePresence>
              {(phase === "planning" || phase === "building" || status) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="forge-glass overflow-hidden">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AudioLines className="w-5 h-5 text-forge-glow" />
                        {phase === "planning" ? "Generating Plan" : "Live Forge"}
                      </CardTitle>
                      <CardDescription>
                        {phase === "planning"
                          ? "AI is designing your plugin..."
                          : "Watching the creation process"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {phase === "planning" ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-8 h-8 animate-spin text-forge-primary" />
                          <span className="ml-3 text-muted-foreground">
                            Gemini is analyzing your requirements...
                          </span>
                        </div>
                      ) : (
                        <BuildProgress status={status} />
                      )}

                      {/* Stop button during active forging */}
                      {(phase === "planning" || phase === "building") && (
                        <Button
                          variant="outline"
                          onClick={handleStopBuild}
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop Forging
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Mini Studio + Browser Preview */}
          <div className="space-y-6">
            {/* Browser Preview (WASM) - shown during/after build when plan exists */}
            <AnimatePresence>
              {(phase === "building" || status?.wasmReady) && currentPlan && currentProjectId && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <BrowserPreview
                    plan={currentPlan}
                    projectId={currentProjectId}
                    versionId={status?.pluginId || currentProjectId}
                    wasmUrl={status?.wasmUrl}
                    wasmReady={status?.wasmReady}
                    buildStatus={status?.status === "BUILDING" ? "BUILDING" : status?.status === "SUCCESS" ? "SUCCESS" : status?.status === "FAILED" ? "FAILED" : null}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mini Studio (Audio Preview) */}
            <AnimatePresence mode="wait">
              {activeProject ? (
                <motion.div
                  key={activeProject.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <MiniStudio
                    pluginName={activeProject.prompt}
                    pluginId={activeProject.id}
                    controls={activeProject.manifest.controls}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] flex items-center justify-center"
                >
                  <div className="text-center space-y-4 p-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                    <AudioLines className="w-12 h-12 text-zinc-700 mx-auto" />
                    <div>
                      <p className="text-zinc-500 font-medium">Mini Studio</p>
                      <p className="text-xs text-zinc-600">
                        Complete a forge to preview your plugin here
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Project Vault (Library) */}
        {projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="forge-glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-forge-primary" />
                  Project Vault
                </CardTitle>
                <CardDescription>
                  Your forged creations — {projects.length} plugin{projects.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <ProjectCapsule
                      key={project.taskId}
                      project={project}
                      onPlay={handlePlayProject}
                      onViewLogic={handleViewLogic}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
