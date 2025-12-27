/**
 * Dashboard Page (Server Component)
 *
 * Main hub for authenticated users showing:
 * - Recent projects (fetched server-side)
 * - Quick actions
 * - Real usage stats
 */

import { getProjects } from '@/lib/server-api';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage() {
  // Fetch projects server-side
  const projectsData = await getProjects();

  return (
    <DashboardContent
      projects={projectsData?.projects || []}
      stats={projectsData?.stats || { total: 0, success: 0, failed: 0, building: 0, draft: 0 }}
    />
  );
}
