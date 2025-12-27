/**
 * Plan Negotiation Routes
 * AI-powered plugin plan generation and refinement
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AuthenticatedContext } from '../lib/middleware';
import { createAIService, type ChatMessage } from '../services/ai';

// Request validation
const generatePlanSchema = z.object({
  projectId: z.string().uuid(),
});

const refinePlanSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

const improvePlanSchema = z.object({
  projectId: z.string().uuid(),
});

const approvePlanSchema = z.object({
  projectId: z.string().uuid(),
});

export const planRoutes = new Hono<AuthenticatedContext>();

// All plan routes require authentication
planRoutes.use('*', requireAuth);

// Generate initial plan from project prompt
planRoutes.post('/generate', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = generatePlanSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project and verify ownership
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check if project is in valid state
  if (!['DRAFT', 'FAILED'].includes(project.status)) {
    return c.json({ error: 'Project is not in a valid state for plan generation' }, 400);
  }

  // Update project status to PLANNING
  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'PLANNING' },
  });

  try {
    // Create AI service (Gemini 3.0 Flash with Structured Output)
    const ai = createAIService({
      GOOGLE_API_KEY: env.GOOGLE_API_KEY,
      DEFAULT_AI_MODEL: env.DEFAULT_AI_MODEL,
    });

    // Generate plan
    const generationResult = await ai.generatePlan(project.prompt);

    // Store user message
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'USER',
        content: project.prompt,
      },
    });

    // Store assistant response with plan
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'ASSISTANT',
        content: generationResult.rawResponse,
        planJson: JSON.stringify(generationResult.plan),
      },
    });

    // Update project status
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'PLAN_PROPOSED' },
    });

    return c.json({
      projectId: project.id,
      plan: generationResult.plan,
      model: generationResult.model,
      message: 'Plan generated successfully. Review and approve, or provide feedback to refine.',
    });
  } catch (error) {
    console.error('Plan generation failed:', error);

    // Revert status on failure
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'DRAFT' },
    });

    return c.json(
      {
        error: 'Plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Refine plan based on user feedback
planRoutes.post('/refine', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = refinePlanSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project with chat history
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
    include: {
      chatMessages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.status !== 'PLAN_PROPOSED') {
    return c.json({ error: 'Project is not in a state that allows refinement' }, 400);
  }

  // Get current plan from last assistant message
  const lastAssistantMessage = project.chatMessages
    .filter((m) => m.role === 'ASSISTANT' && m.planJson)
    .pop();

  if (!lastAssistantMessage?.planJson) {
    return c.json({ error: 'No existing plan found' }, 400);
  }

  const currentPlan = JSON.parse(lastAssistantMessage.planJson);

  // Build chat history for context
  const chatHistory: ChatMessage[] = project.chatMessages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    // Create AI service (Gemini 3.0 Flash with Structured Output)
    const ai = createAIService({
      GOOGLE_API_KEY: env.GOOGLE_API_KEY,
      DEFAULT_AI_MODEL: env.DEFAULT_AI_MODEL,
    });

    // Refine plan
    const generationResult = await ai.refinePlan(
      currentPlan,
      result.data.message,
      chatHistory
    );

    // Store user message
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'USER',
        content: result.data.message,
      },
    });

    // Store assistant response
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'ASSISTANT',
        content: generationResult.rawResponse,
        planJson: JSON.stringify(generationResult.plan),
      },
    });

    return c.json({
      projectId: project.id,
      plan: generationResult.plan,
      model: generationResult.model,
      message: 'Plan refined. Review the changes and approve, or continue refining.',
    });
  } catch (error) {
    console.error('Plan refinement failed:', error);

    return c.json(
      {
        error: 'Plan refinement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// AI auto-improve plan (automated refinement without user input)
planRoutes.post('/improve', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const env = c.env;

  // Validate request
  const body = await c.req.json();
  const result = improvePlanSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project with chat history
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
    include: {
      chatMessages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.status !== 'PLAN_PROPOSED') {
    return c.json({ error: 'Project is not in a state that allows improvement' }, 400);
  }

  // Get current plan from last assistant message
  const lastAssistantMessage = project.chatMessages
    .filter((m) => m.role === 'ASSISTANT' && m.planJson)
    .pop();

  if (!lastAssistantMessage?.planJson) {
    return c.json({ error: 'No existing plan found' }, 400);
  }

  const currentPlan = JSON.parse(lastAssistantMessage.planJson);

  // Build chat history for context
  const chatHistory: ChatMessage[] = project.chatMessages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }));

  // Pre-defined improvement prompt
  const improvementPrompt = `Please review and improve this audio plugin plan. Focus on:
1. Parameter optimization - ensure good defaults, sensible min/max ranges
2. DSP algorithm accuracy - verify the processing chain is technically correct
3. User experience - ensure the parameters are intuitive and well-named
4. JUCE 8 compatibility - ensure all features are compatible with the target framework
5. Audio quality - ensure proper sample rate handling and anti-aliasing where needed

Make the plan more professional and production-ready while keeping the core concept.`;

  try {
    // Create AI service
    const ai = createAIService({
      GOOGLE_API_KEY: env.GOOGLE_API_KEY,
      DEFAULT_AI_MODEL: env.DEFAULT_AI_MODEL,
    });

    // Refine plan with improvement prompt
    const generationResult = await ai.refinePlan(
      currentPlan,
      improvementPrompt,
      chatHistory
    );

    // Store system message indicating auto-improvement
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'SYSTEM',
        content: 'AI auto-improvement requested',
      },
    });

    // Store assistant response
    await prisma.chatMessage.create({
      data: {
        projectId: project.id,
        role: 'ASSISTANT',
        content: generationResult.rawResponse,
        planJson: JSON.stringify(generationResult.plan),
      },
    });

    return c.json({
      projectId: project.id,
      plan: generationResult.plan,
      model: generationResult.model,
      message: 'Plan improved by AI. Review the changes and approve, or continue improving.',
    });
  } catch (error) {
    console.error('Plan improvement failed:', error);

    return c.json(
      {
        error: 'Plan improvement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Approve plan and prepare for build
planRoutes.post('/approve', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');

  // Validate request
  const body = await c.req.json();
  const result = approvePlanSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  // Get project with latest plan
  const project = await prisma.project.findFirst({
    where: { id: result.data.projectId, userId: user.id },
    include: {
      chatMessages: {
        where: { planJson: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.status !== 'PLAN_PROPOSED') {
    return c.json({
      error: 'Project is not in a state that allows approval',
      currentStatus: project.status,
      expectedStatus: 'PLAN_PROPOSED',
    }, 400);
  }

  const latestPlan = project.chatMessages[0]?.planJson;
  if (!latestPlan) {
    return c.json({ error: 'No plan found to approve' }, 400);
  }

  // Store approved plan and update status
  await prisma.project.update({
    where: { id: project.id },
    data: {
      approvedPlan: latestPlan,
      status: 'APPROVED',
    },
  });

  // Store system message about approval
  await prisma.chatMessage.create({
    data: {
      projectId: project.id,
      role: 'SYSTEM',
      content: 'Plan approved. Ready to generate code and build.',
    },
  });

  return c.json({
    projectId: project.id,
    status: 'APPROVED',
    plan: JSON.parse(latestPlan),
    message: 'Plan approved! The build process will start shortly.',
  });
});

// Get chat history for a project
planRoutes.get('/chat/:projectId', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const projectId = c.req.param('projectId');

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      chatMessages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          planJson: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Parse plan JSON in messages
  const messages = project.chatMessages.map((m) => ({
    ...m,
    plan: m.planJson ? JSON.parse(m.planJson) : null,
  }));

  return c.json({
    projectId,
    status: project.status,
    messages,
  });
});

// Get current plan for a project
planRoutes.get('/:projectId', async (c) => {
  const user = c.get('user');
  const prisma = c.get('prisma');
  const projectId = c.req.param('projectId');

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      chatMessages: {
        where: { planJson: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const currentPlan = project.chatMessages[0]?.planJson;

  return c.json({
    projectId,
    status: project.status,
    plan: currentPlan ? JSON.parse(currentPlan) : null,
    approvedPlan: project.approvedPlan ? JSON.parse(project.approvedPlan) : null,
  });
});
