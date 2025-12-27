/**
 * Forge Page (Server Component)
 *
 * The main plugin generation interface where users:
 * - Describe their desired audio effect
 * - Review the AI-generated plan
 * - Monitor build progress
 * - Download their VST3 plugin
 *
 * SSR Features:
 * - Accepts ?projectId= query param for project rehydration
 * - Fetches project data server-side (no "pop-in" effect)
 * - Passes hydrated state to ForgePanel client component
 */

import { ForgePanel, type InitialProjectData } from '@/components/forge';
import { getProjectById } from '@/lib/server-api';
import { ForgeClientWrapper } from './client-wrapper';

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function ForgePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId;

  // Fetch project data server-side if projectId is provided
  let initialProject: InitialProjectData | null = null;

  if (projectId) {
    const project = await getProjectById(projectId);

    if (project) {
      // Parse the plan JSON if exists
      let parsedPlan = null;
      if (project.approvedPlan) {
        try {
          parsedPlan = JSON.parse(project.approvedPlan);
        } catch {
          console.error('Failed to parse approved plan');
        }
      } else if (project.currentPlan) {
        try {
          parsedPlan = JSON.parse(project.currentPlan);
        } catch {
          console.error('Failed to parse current plan');
        }
      }

      initialProject = {
        id: project.id,
        prompt: project.prompt,
        status: project.status,
        plan: parsedPlan,
        errorMessage: project.errorMessage,
      };
    }
  }

  return <ForgeClientWrapper initialProject={initialProject} />;
}
