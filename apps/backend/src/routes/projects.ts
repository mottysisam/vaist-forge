/**
 * Project Routes
 * CRUD operations for plugin projects
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AuthenticatedContext } from '../lib/middleware';

// Request validation schemas
const createProjectSchema = z.object({
  prompt: z.string().min(10).max(5000),
});

const updateProjectSchema = z.object({
  prompt: z.string().min(10).max(5000).optional(),
});

export const projectRoutes = new Hono<AuthenticatedContext>();

// All project routes require authentication
projectRoutes.use('*', requireAuth);

// List user's projects with stats
projectRoutes.get('/', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      prompt: true,
      status: true,
      retryCount: true,
      artifactKey: true,
      githubRunId: true,
      approvedPlan: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Calculate stats
  const stats = {
    total: projects.length,
    success: projects.filter(p => p.status === 'SUCCESS').length,
    failed: projects.filter(p => p.status === 'FAILED').length,
    building: projects.filter(p => ['GENERATING', 'PUSHING', 'BUILDING'].includes(p.status)).length,
    draft: projects.filter(p => ['DRAFT', 'PLANNING', 'PLAN_PROPOSED', 'APPROVED'].includes(p.status)).length,
  };

  return c.json({
    projects: projects.map(p => ({
      ...p,
      // Include truncated prompt as name
      name: p.prompt.slice(0, 50) + (p.prompt.length > 50 ? '...' : ''),
      // Parse plan if exists
      plan: p.approvedPlan ? JSON.parse(p.approvedPlan) : null,
      hasArtifact: !!p.artifactKey,
    })),
    stats,
  });
});

// Get single project with details
projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const prisma = c.get('prisma');

  const project = await prisma.project.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      chatMessages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json(project);
});

// Create new project
projectRoutes.post('/', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');

  // Validate request body
  const body = await c.req.json();
  const result = createProjectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: result.error.flatten(),
      },
      400
    );
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      prompt: result.data.prompt,
      status: 'DRAFT',
    },
  });

  return c.json(project, 201);
});

// Update project (only allowed in DRAFT or PLAN_PROPOSED states)
projectRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const prisma = c.get('prisma');

  // Validate request body
  const body = await c.req.json();
  const result = updateProjectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: result.error.flatten(),
      },
      400
    );
  }

  // Find and verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Only allow updates in editable states
  const editableStates = ['DRAFT', 'PLAN_PROPOSED', 'FAILED'];
  if (!editableStates.includes(existing.status)) {
    return c.json(
      {
        error: 'Cannot update project in current state',
        status: existing.status,
      },
      400
    );
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      prompt: result.data.prompt ?? existing.prompt,
      status: 'DRAFT', // Reset to draft when prompt changes
    },
  });

  return c.json(project);
});

// Delete project
projectRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Find and verify ownership
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Delete artifact from R2 if exists
  if (project.artifactKey && env.PLUGINS_BUCKET) {
    try {
      await env.PLUGINS_BUCKET.delete(project.artifactKey);
    } catch (e) {
      console.error('Failed to delete artifact:', e);
    }
  }

  // Delete WASM artifact from R2 if exists
  if (project.wasmArtifactKey && env.PLUGINS_BUCKET) {
    try {
      await env.PLUGINS_BUCKET.delete(project.wasmArtifactKey);
    } catch (e) {
      console.error('Failed to delete WASM artifact:', e);
    }
  }

  // Delete project (cascades to chat messages and build logs)
  await prisma.project.delete({
    where: { id },
  });

  return c.json({ deleted: true, id });
});
