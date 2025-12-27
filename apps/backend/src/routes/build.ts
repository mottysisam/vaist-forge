/**
 * Build Routes
 * Plugin compilation and artifact management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { requireAuth, type AuthenticatedContext } from '../lib/middleware';
import { createGitHubService } from '../services/github';
import type { PluginPlan, ProjectStatus } from '@vaist/shared';
import type { Env } from '../server';
import * as jose from 'jose';

// Request validation
const triggerBuildSchema = z.object({
  projectId: z.string().uuid(),
});

const stopBuildSchema = z.object({
  projectId: z.string().uuid(),
});

const restartBuildSchema = z.object({
  projectId: z.string().uuid(),
});

const webhookPayloadSchema = z.object({
  action: z.string(),
  workflow_run: z.object({
    id: z.number(),
    status: z.enum(['queued', 'in_progress', 'completed']),
    conclusion: z.enum(['success', 'failure', 'cancelled', 'timed_out', 'skipped']).nullable(),
    head_branch: z.string(),
    html_url: z.string(),
  }).optional(),
});

export const buildRoutes = new Hono<{ Bindings: Env }>();

// Protected routes
const protectedRoutes = new Hono<AuthenticatedContext>();
protectedRoutes.use('*', requireAuth);

// Get build status
protectedRoutes.get('/status/:projectId', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const projectId = c.req.param('projectId');

  // Get project
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get latest build logs
  const buildLogs = await prisma.buildLog.findMany({
    where: { projectId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  // Calculate progress based on status
  const progressMap: Record<string, number> = {
    DRAFT: 0,
    PLANNING: 5,
    PLAN_PROPOSED: 10,
    APPROVED: 15,
    GENERATING: 30,
    PUSHING: 50,
    BUILDING: 70,
    SUCCESS: 100,
    FAILED: 100,
  };

  return c.json({
    projectId,
    status: project.status,
    progress: progressMap[project.status] || 0,
    githubRunId: project.githubRunId,
    retryCount: project.retryCount,
    wasmReady: !!project.wasmArtifactKey,  // WASM available for preview
    wasmUrl: project.wasmArtifactKey ? `/api/v1/build/wasm/${projectId}` : null,
    logs: buildLogs.map((log) => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      step: log.step,
    })),
  });
});

// Trigger build
protectedRoutes.post('/trigger', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = triggerBuildSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project with approved plan
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Allow building from APPROVED or FAILED (retry) states
  if (project.status !== 'APPROVED' && project.status !== 'FAILED') {
    return c.json({
      error: 'Project must be approved before building',
      currentStatus: project.status,
      expectedStatus: 'APPROVED',
    }, 400);
  }

  if (!project.approvedPlan) {
    return c.json({ error: 'No approved plan found' }, 400);
  }

  // Reset status to APPROVED before starting new build attempt
  if (project.status === 'FAILED') {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'APPROVED' as ProjectStatus },
    });
  }

  const plan: PluginPlan = JSON.parse(project.approvedPlan);

  // Update status to GENERATING
  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'GENERATING' as ProjectStatus },
  });

  // Add build log
  await prisma.buildLog.create({
    data: {
      projectId: project.id,
      level: 'INFO',
      message: 'Starting code generation...',
      step: 'GENERATING',
    },
  });

  // Broadcast status update via Durable Object
  await broadcastStatus(env, project.id, 'GENERATING', 30);

  try {
    console.log('[Build] Step 1: Creating GitHub service');
    // Create GitHub service
    const github = createGitHubService(env);

    console.log('[Build] Step 2: Generating plugin name');
    // Generate plugin name from project prompt
    const pluginName = generatePluginName(project.prompt);
    console.log('[Build] Plugin name:', pluginName);

    console.log('[Build] Step 3: Updating status to PUSHING');
    // Update status to PUSHING
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'PUSHING' as ProjectStatus },
    });

    await prisma.buildLog.create({
      data: {
        projectId: project.id,
        level: 'INFO',
        message: `Generated ${pluginName} code, pushing to GitHub...`,
        step: 'PUSHING',
      },
    });

    await broadcastStatus(env, project.id, 'PUSHING', 50);

    console.log('[Build] Step 4: Pushing generated code to GitHub');
    console.log('[Build] Plan:', JSON.stringify(plan, null, 2).slice(0, 500));
    // Push generated code to GitHub
    const { branch, commitSha } = await github.pushGeneratedCode(
      project.id,
      plan,
      pluginName
    );
    console.log('[Build] Step 4 complete: branch=', branch, 'sha=', commitSha);

    await prisma.buildLog.create({
      data: {
        projectId: project.id,
        level: 'INFO',
        message: `Pushed to branch ${branch} (${commitSha.slice(0, 7)})`,
        step: 'PUSHING',
      },
    });

    // Trigger build workflow
    const runId = await github.triggerBuildWorkflow(branch);

    // Update project with run ID
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'BUILDING' as ProjectStatus,
        githubRunId: runId.toString(),
      },
    });

    await prisma.buildLog.create({
      data: {
        projectId: project.id,
        level: 'INFO',
        message: `Build workflow started (Run #${runId})`,
        step: 'BUILDING',
      },
    });

    await broadcastStatus(env, project.id, 'BUILDING', 70);

    return c.json({
      projectId: project.id,
      status: 'BUILDING',
      githubRunId: runId,
      message: 'Build triggered successfully',
    });
  } catch (error) {
    console.error('[Build] FAILED with error:', error);
    console.error('[Build] Error stack:', error instanceof Error ? error.stack : 'no stack');

    // Revert to APPROVED status on failure
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'FAILED' as ProjectStatus,
        retryCount: project.retryCount + 1,
      },
    });

    await prisma.buildLog.create({
      data: {
        projectId: project.id,
        level: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        step: 'FAILED',
      },
    });

    await broadcastStatus(env, project.id, 'FAILED', 100);

    return c.json(
      {
        error: 'Build trigger failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Stop/cancel an in-progress build
protectedRoutes.post('/stop', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = stopBuildSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check if project is in a stoppable state
  const stoppableStates = ['GENERATING', 'PUSHING', 'BUILDING', 'PLANNING'];
  if (!stoppableStates.includes(project.status)) {
    return c.json({
      error: 'Project is not in a state that can be stopped',
      currentStatus: project.status,
      stoppableStates,
    }, 400);
  }

  // Determine the appropriate status to revert to
  // If we have an approved plan, go back to APPROVED
  // Otherwise, go back to PLAN_PROPOSED or DRAFT
  let newStatus: ProjectStatus;
  if (project.approvedPlan) {
    newStatus = 'APPROVED';
  } else if (project.status === 'PLANNING') {
    newStatus = 'DRAFT';
  } else {
    newStatus = 'PLAN_PROPOSED';
  }

  // Update project status
  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: newStatus,
      githubRunId: null, // Clear any pending run
    },
  });

  // Log the cancellation
  await prisma.buildLog.create({
    data: {
      projectId: project.id,
      level: 'WARN',
      message: `Build cancelled by user. Reverted to ${newStatus} status.`,
      step: 'CANCELLED',
    },
  });

  // Broadcast status update
  await broadcastStatus(env, project.id, newStatus,
    newStatus === 'APPROVED' ? 15 :
    newStatus === 'PLAN_PROPOSED' ? 10 : 0
  );

  return c.json({
    projectId: project.id,
    status: newStatus,
    message: 'Build cancelled successfully',
    previousStatus: project.status,
  });
});

// Restart build using existing approved plan (skip AI regeneration)
protectedRoutes.post('/restart', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = restartBuildSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check if project has an approved plan
  if (!project.approvedPlan) {
    return c.json({
      error: 'No approved plan found. Generate and approve a plan first.',
      currentStatus: project.status,
    }, 400);
  }

  // Allow restart from FAILED, APPROVED, or SUCCESS states
  const restartableStates = ['FAILED', 'APPROVED', 'SUCCESS'];
  if (!restartableStates.includes(project.status)) {
    return c.json({
      error: 'Project cannot be restarted from this state',
      currentStatus: project.status,
      restartableStates,
    }, 400);
  }

  // Reset status to APPROVED to allow trigger
  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: 'APPROVED' as ProjectStatus,
      // Don't reset retryCount - we want to track total attempts
    },
  });

  // Log the restart
  await prisma.buildLog.create({
    data: {
      projectId: project.id,
      level: 'INFO',
      message: 'Build restarted with existing plan',
      step: 'RESTART',
    },
  });

  // Broadcast status update
  await broadcastStatus(env, project.id, 'APPROVED', 15);

  return c.json({
    projectId: project.id,
    status: 'APPROVED',
    message: 'Build reset to APPROVED. Call /trigger to start the build.',
    previousStatus: project.status,
  });
});

// Get signed download URL for completed plugin
protectedRoutes.get('/download/:projectId', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;
  const projectId = c.req.param('projectId');

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.status !== 'SUCCESS' || !project.artifactKey) {
    return c.json({ error: 'Plugin not ready for download' }, 400);
  }

  // Generate signed URL for R2 object (valid for 1 hour)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Create a signed token using jose
  const secret = new TextEncoder().encode(env.DOWNLOAD_TOKEN_SECRET);
  const token = await new jose.SignJWT({
    projectId,
    artifactKey: project.artifactKey,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);

  return c.json({
    projectId,
    downloadUrl: `${env.BETTER_AUTH_URL}/api/v1/build/artifact/${token}`,
    expiresAt: expiresAt.toISOString(),
  });
});

// =============================================================================
// PUBLIC ROUTES (must be defined BEFORE mounting protected routes)
// =============================================================================

function getProgressForStatus(status: string): number {
  const map: Record<string, number> = {
    PENDING: 10,
    GENERATING: 30,
    PUSHING: 50,
    BUILDING: 70,
    SUCCESS: 100,
    FAILED: 100,
  };
  return map[status] || 0;
}

// Public endpoint for active builds (login page badge)
// Returns empty array if not authenticated
buildRoutes.get('/active', async (c) => {
  const env = c.env;

  try {
    // Try to get session - but don't require it
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });

    // Create auth instance to check session
    const { createAuth } = await import('../lib/auth');
    const auth = createAuth(env, prisma);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session?.user?.id) {
      // Not authenticated - return empty builds
      return c.json({ builds: [] });
    }

    // Get user's active builds
    const activeStatuses = ['GENERATING', 'PUSHING', 'BUILDING', 'PENDING'];
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
        status: { in: activeStatuses as any },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const builds = projects.map((p) => ({
      projectId: p.id,
      status: p.status,
      progress: getProgressForStatus(p.status),
      // Use truncated prompt as project name (no name field in schema)
      projectName: p.prompt.slice(0, 50) + (p.prompt.length > 50 ? '...' : ''),
    }));

    return c.json({ builds });
  } catch (error) {
    console.error('Error fetching active builds:', error);
    return c.json({ builds: [] });
  }
});

// WebSocket endpoint for real-time build logs
buildRoutes.get('/ws/:projectId', async (c) => {
  const projectId = c.req.param('projectId');

  // Get the Durable Object instance for this project
  const id = c.env.BUILD_STATUS.idFromName(projectId);
  const stub = c.env.BUILD_STATUS.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(c.req.raw);
});

// GitHub webhook for build status updates (no auth - uses signature verification)
buildRoutes.post('/webhook/github', async (c) => {
  const env = c.env;

  // Verify webhook signature (if configured)
  const signature = c.req.header('x-hub-signature-256');
  if (signature && env.GITHUB_WEBHOOK_SECRET) {
    const body = await c.req.text();
    const isValid = await verifyWebhookSignature(
      body,
      signature,
      env.GITHUB_WEBHOOK_SECRET
    );
    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  const body = await c.req.json();
  const parseResult = webhookPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    // Ignore events we don't care about
    return c.json({ received: true, ignored: true });
  }

  const payload = parseResult.data;

  // Only process workflow_run events
  if (!payload.workflow_run) {
    return c.json({ received: true, ignored: true });
  }

  const run = payload.workflow_run;

  // Extract project ID from branch name (build/{projectId})
  const branchMatch = run.head_branch.match(/^build\/([a-f0-9-]+)$/);
  if (!branchMatch) {
    return c.json({ received: true, ignored: true });
  }

  const projectId = branchMatch[1];

  // Create Prisma client
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });

  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Update status based on workflow run
    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        // Build succeeded - download artifact and upload to R2
        await handleBuildSuccess(env, prisma, project.id, run.id);
      } else {
        // Build failed
        await handleBuildFailure(env, prisma, project.id, run.conclusion || 'unknown');
      }
    } else {
      // Still in progress
      await prisma.buildLog.create({
        data: {
          projectId: project.id,
          level: 'INFO',
          message: `Workflow status: ${run.status}`,
          step: 'BUILDING',
        },
      });
    }

    return c.json({ received: true, processed: true });
  } finally {
    await prisma.$disconnect();
  }
});

// =============================================================================
// WASM Preview Endpoints
// These enable browser preview while VST3 is still building
// =============================================================================

// Webhook: WASM build completed (called by GitHub Actions)
buildRoutes.post('/webhook/wasm-ready', async (c) => {
  const env = c.env;

  // Verify HMAC signature (X-Hub-Signature-256 pattern)
  const signature = c.req.header('X-Hub-Signature-256');
  if (!signature || !env.BACKEND_WEBHOOK_SECRET) {
    return c.json({ error: 'Missing signature or secret' }, 401);
  }

  const rawBody = await c.req.text();
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    env.BACKEND_WEBHOOK_SECRET
  );

  if (!isValid) {
    return c.json({ error: 'Invalid HMAC signature' }, 401);
  }

  const body = JSON.parse(rawBody) as {
    projectId: string;
    wasmKey: string;
  };

  if (!body.projectId || !body.wasmKey) {
    return c.json({ error: 'Missing projectId or wasmKey' }, 400);
  }

  // Create Prisma client
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });

  try {
    // Update project with WASM artifact key
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
    });

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    await prisma.project.update({
      where: { id: body.projectId },
      data: { wasmArtifactKey: body.wasmKey },
    });

    await prisma.buildLog.create({
      data: {
        projectId: body.projectId,
        level: 'INFO',
        message: 'WASM build complete - browser preview available!',
        step: 'WASM_READY',
      },
    });

    // Broadcast WASM ready event via Durable Object
    try {
      const id = env.BUILD_STATUS.idFromName(body.projectId);
      const stub = env.BUILD_STATUS.get(id);
      await stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'wasm_ready',
            wasmUrl: `/api/v1/build/wasm/${body.projectId}`,
          }),
        })
      );
    } catch {
      // Ignore broadcast errors
    }

    return c.json({ success: true, wasmReady: true });
  } finally {
    await prisma.$disconnect();
  }
});

// Get WASM file for browser preview (public - uses R2 directly)
buildRoutes.get('/wasm/:projectId', async (c) => {
  const env = c.env;
  const projectId = c.req.param('projectId');

  // Create Prisma client to verify project exists
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || !project.wasmArtifactKey) {
      return c.json({ error: 'WASM not available' }, 404);
    }

    // Get WASM from R2
    const object = await env.PLUGINS_BUCKET.get(project.wasmArtifactKey);

    if (!object) {
      return c.json({ error: 'WASM file not found in storage' }, 404);
    }

    // Return WASM file with appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/wasm');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    object.writeHttpMetadata(headers);

    return new Response(object.body, { headers });
  } finally {
    await prisma.$disconnect();
  }
});

// Get WASM descriptor JSON (for parameter metadata)
buildRoutes.get('/wasm/:projectId/descriptor', async (c) => {
  const env = c.env;
  const projectId = c.req.param('projectId');

  // Get descriptor from R2
  const descriptorKey = `wasm/${projectId}/descriptor.json`;
  const object = await env.PLUGINS_BUCKET.get(descriptorKey);

  if (!object) {
    return c.json({ error: 'Descriptor not found' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(object.body, { headers });
});

// Artifact download endpoint (uses signed token)
buildRoutes.get('/artifact/:token', async (c) => {
  const env = c.env;
  const token = c.req.param('token');

  try {
    // Verify token
    const secret = new TextEncoder().encode(env.DOWNLOAD_TOKEN_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    const artifactKey = payload.artifactKey as string;

    // Get artifact from R2
    const object = await env.PLUGINS_BUCKET.get(artifactKey);

    if (!object) {
      return c.json({ error: 'Artifact not found' }, 404);
    }

    // Return the file
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${artifactKey.split('/').pop()}"`
    );
    object.writeHttpMetadata(headers);

    return new Response(object.body, { headers });
  } catch {
    return c.json({ error: 'Invalid or expired download link' }, 401);
  }
});

// =============================================================================
// PROTECTED ROUTES (mounted AFTER public routes)
// =============================================================================

// Mount protected routes - must be last so public routes are matched first
buildRoutes.route('/', protectedRoutes);

// Helper functions

async function broadcastStatus(
  env: Env,
  projectId: string,
  status: string,
  progress: number
): Promise<void> {
  try {
    const id = env.BUILD_STATUS.idFromName(projectId);
    const stub = env.BUILD_STATUS.get(id);

    await stub.fetch(
      new Request('http://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify({ status, progress }),
      })
    );
  } catch (error) {
    console.error('Failed to broadcast status:', error);
  }
}

async function handleBuildSuccess(
  env: Env,
  prisma: PrismaClient,
  projectId: string,
  runId: number
): Promise<void> {
  try {
    // Download artifact from GitHub
    const github = createGitHubService(env);
    const artifacts = await github.getArtifacts(runId);

    // Find the plugin artifact
    const pluginArtifact = artifacts.find(
      (a) => a.name.includes('plugin') || a.name.includes('vst')
    );

    if (!pluginArtifact) {
      throw new Error('Plugin artifact not found in build');
    }

    // Download artifact
    const artifactData = await github.downloadArtifact(pluginArtifact.id);

    // Upload to R2
    const artifactKey = `plugins/${projectId}/${pluginArtifact.name}.zip`;
    await env.PLUGINS_BUCKET.put(artifactKey, artifactData, {
      httpMetadata: {
        contentType: 'application/zip',
      },
    });

    // Update project
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'SUCCESS',
        artifactKey,
      },
    });

    await prisma.buildLog.create({
      data: {
        projectId,
        level: 'INFO',
        message: 'Build completed successfully! Plugin ready for download.',
        step: 'SUCCESS',
      },
    });

    await broadcastStatus(env, projectId, 'SUCCESS', 100);
  } catch (error) {
    console.error('Failed to handle build success:', error);

    // Still mark as success but log the error
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'SUCCESS' },
    });

    await prisma.buildLog.create({
      data: {
        projectId,
        level: 'WARN',
        message: `Build succeeded but artifact retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'SUCCESS',
      },
    });

    await broadcastStatus(env, projectId, 'SUCCESS', 100);
  }
}

async function handleBuildFailure(
  env: Env,
  prisma: PrismaClient,
  projectId: string,
  conclusion: string
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) return;

  // Check if we should retry
  const maxRetries = 3;
  if (project.retryCount < maxRetries && conclusion === 'failure') {
    // Mark as failed but allow retry
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'FAILED',
        retryCount: project.retryCount + 1,
      },
    });

    await prisma.buildLog.create({
      data: {
        projectId,
        level: 'ERROR',
        message: `Build failed (attempt ${project.retryCount + 1}/${maxRetries}). You can try rebuilding.`,
        step: 'FAILED',
      },
    });
  } else {
    // Max retries exceeded
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'FAILED',
        retryCount: project.retryCount + 1,
      },
    });

    await prisma.buildLog.create({
      data: {
        projectId,
        level: 'ERROR',
        message: `Build failed: ${conclusion}. Maximum retries exceeded.`,
        step: 'FAILED',
      },
    });
  }

  await broadcastStatus(env, projectId, 'FAILED', 100);
}

function generatePluginName(prompt: string): string {
  // Extract key words from the prompt to create a plugin name
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);

  if (words.length === 0) {
    return 'VaistPlugin';
  }

  // CamelCase the words
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const expectedSignature =
      'sha256=' +
      Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return signature === expectedSignature;
  } catch {
    return false;
  }
}
