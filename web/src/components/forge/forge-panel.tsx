"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hammer, AudioLines, Loader2, Flame, Sparkles, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuildProgress } from "./build-progress";
import { MiniStudio } from "./mini-studio";
import { ProjectCapsule } from "./project-capsule";
import { useForgeStatus } from "@/hooks/use-forge-status";
import { startForgeAction } from "@/app/actions/forge";
import { cn } from "@/lib/utils";
import {
  type ProjectCapsule as ProjectCapsuleType,
  inferPluginType,
  inferControlsFromPrompt,
} from "@/types/project";

// Generate unique plugin ID (VAI + 3 chars)
function generatePluginId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 3 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
  return `VAI${suffix}`;
}

export function ForgePanel() {
  const [prompt, setPrompt] = useState("");
  const [isForging, setIsForging] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [projects, setProjects] = useState<ProjectCapsuleType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectCapsuleType | null>(null);

  const { status, startPolling, reset } = useForgeStatus({
    onSuccess: (downloadUrl) => {
      if (currentTaskId) {
        const controls = inferControlsFromPrompt(currentPrompt);
        const newProject: ProjectCapsuleType = {
          id: generatePluginId(),
          taskId: currentTaskId,
          prompt: currentPrompt,
          type: inferPluginType(currentPrompt),
          timestamp: new Date(),
          status: "SUCCESS",
          manifest: {
            controls,
            complexity: Math.floor(Math.random() * 200) + 100, // Simulated
            dspType: inferPluginType(currentPrompt).toLowerCase(),
          },
          downloadUrl,
          version: 1,
        };
        setProjects((prev) => [newProject, ...prev]);
        setActiveProject(newProject);
      }
      setIsForging(false);
    },
    onError: (err) => {
      if (currentTaskId) {
        const controls = inferControlsFromPrompt(currentPrompt);
        const failedProject: ProjectCapsuleType = {
          id: generatePluginId(),
          taskId: currentTaskId,
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
      setIsForging(false);
    },
  });

  const handleForge = useCallback(async () => {
    if (!prompt.trim() || isForging) return;

    setError(null);
    setIsForging(true);
    setActiveProject(null);
    reset();

    const trimmedPrompt = prompt.trim();
    setCurrentPrompt(trimmedPrompt);

    const result = await startForgeAction(trimmedPrompt);

    if (result.success && result.taskId) {
      setCurrentTaskId(result.taskId);
      startPolling(result.taskId);
    } else {
      setError(result.error || "Failed to start forge");
      setIsForging(false);
    }
  }, [prompt, isForging, reset, startPolling]);

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

            {/* Live Forge (Progress) */}
            <AnimatePresence>
              {(isForging || status) && (
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
                        Live Forge
                      </CardTitle>
                      <CardDescription>
                        Watching the creation process
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BuildProgress status={status} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Mini Studio */}
          <div>
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
