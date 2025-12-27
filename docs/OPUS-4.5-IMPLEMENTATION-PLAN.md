# vAIst "Opus 4.5" Implementation Plan

> **Status**: PLANNING PHASE
> **Last Updated**: 2025-12-27
> **Reference Project**: `/Users/motty/code/bachata-nation-next`

---

## Executive Summary

Transform vAIst from a backend-driven, ephemeral generation system into a **user-controlled, project-based, fully transparent** platform using Cloudflare's edge infrastructure (D1, R2, KV, Durable Objects).

### Key Upgrades

| Current State | Opus 4.5 Target |
|---------------|-----------------|
| No auth | Google OAuth 2.0 required |
| Gemini 2.0 Flash hardcoded | User-selectable AI model + API key injection |
| Deterministic generation only | Interactive "Plan" negotiation loop |
| Ephemeral tasks (deleted after build) | Persistent projects linked to user |
| Polling-only status | Real-time WebSocket log streaming |
| GitHub releases artifacts | R2 storage with signed download URLs |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 15)                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Google Auth │  │ Model Picker │  │ Plan Chat   │  │ Terminal Logs     │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE WORKERS BACKEND                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Auth Routes │  │ Generation   │  │ Projects    │  │ Build Status DO    │ │
│  │ (BetterAuth)│  │ API          │  │ API         │  │ (Durable Object)   │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                │              │              │              │
                ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐
│   D1     │  │   KV     │  │   R2     │  │ AI Gate  │  │  GitHub Actions  │
│ Projects │  │ Sessions │  │ Plugins  │  │ Gemini/  │  │  Matrix Builder  │
│ Users    │  │ Rate Lim │  │ Logs     │  │ Claude   │  │  Win + macOS     │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘
```

---

## Phase 1: Infrastructure Setup

### 1.1 Project Structure

```
apps/
├── web/                          # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/                  # App Router
│   │   │   ├── (auth)/           # Auth pages (login, callback)
│   │   │   ├── (dashboard)/      # Protected routes
│   │   │   │   ├── generate/     # Plugin generation wizard
│   │   │   │   ├── projects/     # My Projects list
│   │   │   │   └── settings/     # API keys, model preferences
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ai-chat/          # Plan negotiation UI
│   │   │   ├── terminal/         # xterm.js build logs
│   │   │   └── plugin-card/      # Project display cards
│   │   └── lib/
│   │       ├── auth.ts           # Auth client
│   │       └── api.ts            # API client with WebSocket
│   └── package.json
│
├── backend/                      # Cloudflare Workers Backend
│   ├── src/
│   │   ├── server.ts             # Hono app entry
│   │   ├── routes/
│   │   │   ├── auth.ts           # BetterAuth handler
│   │   │   ├── generations.ts    # Plugin generation API
│   │   │   ├── projects.ts       # Project CRUD
│   │   │   └── settings.ts       # User preferences
│   │   ├── durable-objects/
│   │   │   └── BuildStatus.ts    # Real-time build streaming
│   │   ├── lib/
│   │   │   ├── ai-planner.ts     # Gemini/Claude integration
│   │   │   ├── cpp-generator.ts  # Deterministic C++ gen (ported)
│   │   │   ├── github-manager.ts # GitHub API client
│   │   │   └── kv-storage.ts     # Rate limiting, sessions
│   │   └── generated/prisma/     # Prisma D1 client
│   ├── prisma/
│   │   ├── schema.prisma         # D1 database schema
│   │   └── migrations/           # Migration files
│   └── wrangler.toml             # Cloudflare config
│
└── packages/
    └── shared/                   # Shared types
        ├── src/
        │   ├── types.ts          # API types
        │   └── schemas.ts        # Zod schemas
        └── package.json
```

### 1.2 Cloudflare Resources

**wrangler.toml**:
```toml
name = "vaist-backend"
main = "src/server.ts"
compatibility_date = "2024-12-01"

[triggers]
crons = ["0 4 * * *"]  # Daily cleanup of old builds

[durable_objects]
bindings = [
  { name = "BUILD_STATUS", class_name = "BuildStatus" }
]

[[migrations]]
tag = "v1"
new_classes = ["BuildStatus"]

[[d1_databases]]
binding = "DB"
database_name = "d1-vaist"
migrations_dir = "prisma/migrations"

[[kv_namespaces]]
binding = "AUTH_KV"
id = "xxx"  # Session storage, rate limiting

[[kv_namespaces]]
binding = "BUILD_KV"
id = "xxx"  # Build status cache

[[r2_buckets]]
binding = "PLUGINS_BUCKET"
bucket_name = "r2-vaist-plugins"

[[r2_buckets]]
binding = "LOGS_BUCKET"
bucket_name = "r2-vaist-logs"

[vars]
NODE_ENV = "development"
CORS_ORIGIN = "http://localhost:3000"
BETTER_AUTH_URL = "http://localhost:4201"
GITHUB_REPO = "mottysisam/vaist-forge"

# Secrets (set via: wrangler secret put SECRET_NAME):
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# BETTER_AUTH_SECRET, JWT_SECRET
# GITHUB_TOKEN
# GEMINI_API_KEY (fallback if user doesn't provide)
# ANTHROPIC_API_KEY (fallback if user doesn't provide)
# UPLOAD_TOKEN_SECRET

[env.dev]
name = "vaist-backend-dev"
vars = { NODE_ENV = "development" }

[env.production]
name = "vaist-backend"
vars = { NODE_ENV = "production" }
routes = [{ pattern = "api.vaist.ai/*", zone_name = "vaist.ai" }]
```

### 1.3 D1 Database Schema

**prisma/schema.prisma**:
```prisma
generator client {
  provider = "prisma-client"
  runtime  = "cloudflare"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ============================================================================
// USER & AUTH
// ============================================================================

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  image         String?

  // AI Preferences
  preferredModel    String    @default("gemini-2.5-flash")
  encryptedApiKey   String?   // AES-256 encrypted user's API key
  apiKeyProvider    String?   // "gemini" | "anthropic" | "openai"

  // Usage tracking
  generationsCount  Int       @default(0)
  lastGenerationAt  DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  projects      Project[]
  sessions      Session[]
  accounts      Account[]

  @@index([email])
}

model Session {
  id            String    @id @default(uuid())
  userId        String
  token         String    @unique
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model Account {
  id                String    @id @default(uuid())
  userId            String
  accountId         String
  providerId        String    // "google"
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, accountId])
  @@index([userId])
}

// ============================================================================
// PROJECTS & GENERATIONS
// ============================================================================

model Project {
  id            String    @id @default(uuid())
  userId        String

  // Project metadata
  name          String    // User-facing name (e.g., "My Warm Delay")
  description   String?   // User description
  prompt        String    // Original user prompt

  // AI Plan (approved JSON)
  approvedPlan  String?   // JSON: { explanation, parameters, dsp_blocks }
  planHistory   String?   // JSON array of plan iterations

  // Generated code info
  category      String?   // DELAY, GAIN, FILTER, etc.
  gitBranch     String?   // Unique branch name for this project
  commitSha     String?   // Latest commit SHA

  // Build status
  status        String    @default("DRAFT")  // DRAFT, PLANNING, APPROVED, BUILDING, SUCCESS, FAILED
  buildAttempts Int       @default(0)
  lastError     String?

  // Artifacts
  artifactKey   String?   // R2 key for .vst3 file
  artifactUrl   String?   // Signed download URL (regenerated on access)
  artifactSize  Int?      // File size in bytes

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  buildStartedAt DateTime?
  buildCompletedAt DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatMessages  ChatMessage[]
  buildLogs     BuildLog[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model ChatMessage {
  id            String    @id @default(uuid())
  projectId     String

  role          String    // "user" | "assistant" | "system"
  content       String    // Message content
  planSnapshot  String?   // JSON snapshot of plan after this message

  createdAt     DateTime  @default(now())

  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}

model BuildLog {
  id            String    @id @default(uuid())
  projectId     String

  level         String    // "info" | "warning" | "error"
  source        String    // "github" | "cmake" | "compiler" | "linker"
  message       String
  timestamp     DateTime  @default(now())

  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, timestamp])
}

// ============================================================================
// TEMPLATES (Pre-built starting points)
// ============================================================================

model Template {
  id            String    @id @default(uuid())

  name          String
  description   String
  category      String    // DELAY, GAIN, FILTER, etc.

  defaultPlan   String    // JSON default plan
  previewImage  String?   // R2 key for preview image

  isPublic      Boolean   @default(true)
  usageCount    Int       @default(0)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([category])
  @@index([isPublic])
}
```

---

## Phase 2: Authentication & User Management

### 2.1 Google OAuth with BetterAuth

**Reference**: `/Users/motty/code/bachata-nation-next/apps/backend/src/lib/auth.ts`

```typescript
// backend/src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export function createAuth(prisma: PrismaClient, env: Bindings) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'sqlite' }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    trustedOrigins: [
      env.CORS_ORIGIN,
      'https://vaist.ai',
      'https://app.vaist.ai',
    ],

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ['email', 'profile'],
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,     // 1 day
    },
  });
}
```

### 2.2 API Key Encryption

```typescript
// backend/src/lib/encryption.ts
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export async function encryptApiKey(
  plaintext: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret).slice(0, 32),
    { name: ALGORITHM },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    keyMaterial,
    encoder.encode(plaintext)
  );

  // Format: base64(iv):base64(ciphertext)
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${ctB64}`;
}

export async function decryptApiKey(
  encrypted: string,
  secret: string
): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(':');
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret).slice(0, 32),
    { name: ALGORITHM },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    keyMaterial,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
```

---

## Phase 3: AI Plan Negotiation

### 3.1 Plan Schema

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const ParameterSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  displayName: z.string(),
  min: z.number(),
  max: z.number(),
  default: z.number(),
  unit: z.string().optional(), // "Hz", "ms", "%", "dB"
});

export const PlanSchema = z.object({
  explanation: z.string().min(50).max(500),
  pluginName: z.string().regex(/^[A-Z][a-zA-Z0-9]+$/),
  category: z.enum([
    'GAIN', 'DELAY', 'FILTER', 'DISTORTION',
    'TREMOLO', 'CHORUS', 'REVERB', 'COMPRESSOR'
  ]),
  parameters: z.array(ParameterSchema).min(1).max(8),
  dspBlocks: z.array(z.string()).min(1).max(5),
  uiLayout: z.enum(['horizontal', 'vertical', 'grid']).default('horizontal'),
});

export type PluginPlan = z.infer<typeof PlanSchema>;
```

### 3.2 AI Planner Service

```typescript
// backend/src/lib/ai-planner.ts
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

const PLANNER_SYSTEM_PROMPT = `You are an expert VST3 audio plugin designer. When given a user's plugin idea, you must:

1. Analyze their requirements
2. Design a plugin architecture
3. Output a structured JSON plan

CRITICAL RULES:
- Plugin names must be PascalCase (e.g., "WarmDelay", "VintageFilter")
- Parameter names must be camelCase (e.g., "delayTime", "feedbackAmount")
- Maximum 8 parameters per plugin
- Each parameter needs: name, displayName, min, max, default, unit
- Choose appropriate DSP blocks for the category

DSP BLOCKS BY CATEGORY:
- DELAY: DelayLine, FeedbackLoop, Interpolation
- FILTER: Biquad, OnePole, StateVariable
- DISTORTION: Waveshaper, TanhSaturation, SoftClip
- TREMOLO: LFO, Modulator, SmoothGain
- GAIN: LinearGain, DecibelGain, SmoothRamp
- REVERB: AllPass, Comb, Diffuser
- COMPRESSOR: Envelope, GainReduction, MakeupGain

OUTPUT FORMAT (JSON only):
{
  "explanation": "Brief description of the DSP approach...",
  "pluginName": "PluginName",
  "category": "CATEGORY",
  "parameters": [...],
  "dspBlocks": [...],
  "uiLayout": "horizontal"
}`;

export class AIPlannerService {
  private geminiClient?: GoogleGenAI;
  private anthropicClient?: Anthropic;

  constructor(
    geminiKey?: string,
    anthropicKey?: string
  ) {
    if (geminiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    }
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
    }
  }

  async generatePlan(
    prompt: string,
    model: string = 'gemini-2.5-flash',
    previousPlan?: PluginPlan,
    feedback?: string
  ): Promise<{ plan: PluginPlan; rawResponse: string }> {
    const userMessage = previousPlan
      ? `Previous plan:\n${JSON.stringify(previousPlan, null, 2)}\n\nUser feedback: ${feedback}\n\nPlease revise the plan.`
      : `Create a VST3 plugin plan for: ${prompt}`;

    let rawResponse: string;

    if (model.startsWith('gemini') && this.geminiClient) {
      rawResponse = await this.callGemini(userMessage, model);
    } else if (model.startsWith('claude') && this.anthropicClient) {
      rawResponse = await this.callClaude(userMessage, model);
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }

    // Extract JSON from response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const plan = PlanSchema.parse(parsed);

    return { plan, rawResponse };
  }

  private async callGemini(prompt: string, model: string): Promise<string> {
    const response = await this.geminiClient!.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: PLANNER_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    return response.text || '';
  }

  private async callClaude(prompt: string, model: string): Promise<string> {
    const response = await this.anthropicClient!.messages.create({
      model,
      max_tokens: 2048,
      system: PLANNER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }
}
```

### 3.3 Plan Negotiation API Routes

```typescript
// backend/src/routes/generations.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../lib/auth-helper';
import { AIPlannerService } from '../lib/ai-planner';
import { decryptApiKey } from '../lib/encryption';

export const generationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// POST /api/generations - Start new generation
generationsRoutes.post('/', async (c) => {
  const user = await requireAuthenticatedUser(c);
  const prisma = c.get('prisma');

  const { prompt, name } = await c.req.json();

  // Create project in DRAFT state
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: name || 'Untitled Plugin',
      prompt,
      status: 'DRAFT',
    },
  });

  return c.json({ projectId: project.id });
});

// POST /api/generations/:id/plan - Generate or revise plan
generationsRoutes.post('/:id/plan', async (c) => {
  const user = await requireAuthenticatedUser(c);
  const prisma = c.get('prisma');
  const { id } = c.req.param();

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { chatMessages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const { feedback } = await c.req.json();

  // Get user's API key or use fallback
  let apiKey: string;
  if (user.encryptedApiKey && user.apiKeyProvider === 'gemini') {
    apiKey = await decryptApiKey(user.encryptedApiKey, c.env.ENCRYPTION_SECRET);
  } else {
    apiKey = c.env.GEMINI_API_KEY;
  }

  const planner = new AIPlannerService(apiKey);

  // Parse previous plan if exists
  const previousPlan = project.approvedPlan
    ? JSON.parse(project.approvedPlan)
    : undefined;

  // Generate new plan
  const { plan, rawResponse } = await planner.generatePlan(
    project.prompt,
    user.preferredModel,
    previousPlan,
    feedback
  );

  // Save chat message
  await prisma.chatMessage.create({
    data: {
      projectId: id,
      role: feedback ? 'user' : 'system',
      content: feedback || 'Initial plan request',
    },
  });

  await prisma.chatMessage.create({
    data: {
      projectId: id,
      role: 'assistant',
      content: rawResponse,
      planSnapshot: JSON.stringify(plan),
    },
  });

  // Update project with latest plan
  await prisma.project.update({
    where: { id },
    data: {
      approvedPlan: JSON.stringify(plan),
      status: 'PLANNING',
      category: plan.category,
    },
  });

  return c.json({ plan, rawResponse });
});

// POST /api/generations/:id/approve - Approve plan and start build
generationsRoutes.post('/:id/approve', async (c) => {
  const user = await requireAuthenticatedUser(c);
  const prisma = c.get('prisma');
  const { id } = c.req.param();

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id, status: 'PLANNING' },
  });

  if (!project || !project.approvedPlan) {
    return c.json({ error: 'No plan to approve' }, 400);
  }

  // Update status
  await prisma.project.update({
    where: { id },
    data: { status: 'APPROVED' },
  });

  // Trigger build in background
  c.executionCtx.waitUntil(triggerBuild(project, c.env, prisma));

  return c.json({ success: true, message: 'Build started' });
});
```

---

## Phase 4: Real-Time Build Status

### 4.1 BuildStatus Durable Object

**Reference**: `/Users/motty/code/bachata-nation-next/apps/backend/src/durable-objects/ChatRoom.ts`

```typescript
// backend/src/durable-objects/BuildStatus.ts
interface BuildSession {
  userId: string;
  projectId: string;
  joinedAt: number;
}

interface BuildLogEntry {
  level: 'info' | 'warning' | 'error';
  source: 'github' | 'cmake' | 'compiler' | 'linker' | 'system';
  message: string;
  timestamp: number;
}

export class BuildStatus implements DurableObject {
  private sessions: Map<WebSocket, BuildSession> = new Map();
  private projectId: string = '';
  private logs: BuildLogEntry[] = [];
  private status: string = 'PENDING';

  constructor(
    private state: DurableObjectState,
    private env: Bindings
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      return this.handleInit(request);
    }

    if (url.pathname === '/log') {
      return this.handleLog(request);
    }

    if (url.pathname === '/status') {
      return this.handleStatusUpdate(request);
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, url);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleInit(request: Request): Promise<Response> {
    const { projectId } = await request.json() as { projectId: string };
    this.projectId = projectId;
    this.logs = [];
    this.status = 'PENDING';
    return new Response('OK');
  }

  private async handleLog(request: Request): Promise<Response> {
    const entry = await request.json() as BuildLogEntry;
    entry.timestamp = Date.now();
    this.logs.push(entry);

    // Broadcast to all connected clients
    this.broadcast({
      type: 'log',
      ...entry,
    });

    // Persist to D1 for history
    await this.env.DB.prepare(`
      INSERT INTO build_logs (id, project_id, level, source, message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      this.projectId,
      entry.level,
      entry.source,
      entry.message,
      new Date(entry.timestamp).toISOString()
    ).run();

    return new Response('OK');
  }

  private async handleStatusUpdate(request: Request): Promise<Response> {
    const { status, artifactKey, error } = await request.json() as {
      status: string;
      artifactKey?: string;
      error?: string;
    };

    this.status = status;

    // Broadcast status change
    this.broadcast({
      type: 'status',
      status,
      artifactKey,
      error,
    });

    // Update project in D1
    await this.env.DB.prepare(`
      UPDATE projects
      SET status = ?, artifact_key = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      status,
      artifactKey || null,
      error || null,
      new Date().toISOString(),
      this.projectId
    ).run();

    return new Response('OK');
  }

  private async handleWebSocket(
    request: Request,
    url: URL
  ): Promise<Response> {
    const userId = url.searchParams.get('userId');
    const projectId = url.searchParams.get('projectId');

    if (!userId || !projectId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const session: BuildSession = {
      userId,
      projectId,
      joinedAt: Date.now(),
    };

    this.state.acceptWebSocket(server, [`project:${projectId}`]);
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    // Send current state
    server.send(JSON.stringify({
      type: 'init',
      status: this.status,
      logs: this.logs,
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    const data = JSON.parse(message);

    if (data.type === 'heartbeat') {
      ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  private broadcast(message: object): void {
    const json = JSON.stringify(message);

    for (const ws of this.sessions.keys()) {
      try {
        ws.send(json);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
```

### 4.2 GitHub Actions Log Streaming

```typescript
// backend/src/lib/github-manager.ts
import { Octokit } from '@octokit/rest';

export class GitHubManager {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repoFullName: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repoFullName.split('/');
    this.owner = owner;
    this.repo = repo;
  }

  async streamWorkflowLogs(
    runId: number,
    onLog: (entry: BuildLogEntry) => Promise<void>
  ): Promise<void> {
    // Poll job status
    let completed = false;

    while (!completed) {
      const { data: run } = await this.octokit.actions.getWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      if (run.status === 'completed') {
        completed = true;

        // Fetch logs
        const { data: logs } = await this.octokit.actions.downloadWorkflowRunLogs({
          owner: this.owner,
          repo: this.repo,
          run_id: runId,
        });

        // Parse and stream logs
        await this.parseAndStreamLogs(logs, onLog);

        return;
      }

      // Get jobs for current progress
      const { data: jobs } = await this.octokit.actions.listJobsForWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      for (const job of jobs.jobs) {
        if (job.status === 'in_progress') {
          await onLog({
            level: 'info',
            source: 'github',
            message: `${job.name}: ${job.steps?.find(s => s.status === 'in_progress')?.name || 'Running...'}`,
            timestamp: Date.now(),
          });
        }
      }

      // Wait before next poll
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  private async parseAndStreamLogs(
    logsZip: ArrayBuffer,
    onLog: (entry: BuildLogEntry) => Promise<void>
  ): Promise<void> {
    // In production, unzip and parse the log files
    // For now, just mark as completed
    await onLog({
      level: 'info',
      source: 'system',
      message: 'Build completed successfully',
      timestamp: Date.now(),
    });
  }
}
```

---

## Phase 5: R2 Artifact Storage

### 5.1 Upload After Build Success

```typescript
// backend/src/lib/artifact-manager.ts
export class ArtifactManager {
  constructor(
    private bucket: R2Bucket,
    private env: Bindings
  ) {}

  async uploadArtifact(
    projectId: string,
    userId: string,
    artifactData: ArrayBuffer,
    platform: 'windows' | 'macos'
  ): Promise<string> {
    const key = `plugins/${userId}/${projectId}/${platform}/plugin.vst3`;

    await this.bucket.put(key, artifactData, {
      httpMetadata: {
        contentType: 'application/octet-stream',
        cacheControl: 'public, max-age=31536000', // 1 year
      },
      customMetadata: {
        projectId,
        userId,
        platform,
        uploadedAt: new Date().toISOString(),
      },
    });

    return key;
  }

  async generateSignedUrl(
    key: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    // R2 doesn't have native signed URLs, so we use a token-based approach
    const token = await this.generateDownloadToken(key, expiresInSeconds);
    return `${this.env.API_BASE_URL}/api/downloads/${token}`;
  }

  private async generateDownloadToken(
    key: string,
    expiresIn: number
  ): Promise<string> {
    const data = {
      key,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    const json = JSON.stringify(data);
    const b64 = btoa(json);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.env.UPLOAD_TOKEN_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      keyMaterial,
      encoder.encode(b64)
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return `${b64}.${sigB64}`;
  }
}
```

### 5.2 Download Endpoint

```typescript
// backend/src/routes/downloads.ts
downloadRoutes.get('/:token', async (c) => {
  const { token } = c.req.param();

  // Validate token
  const [dataB64, sigB64] = token.split('.');

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(c.env.UPLOAD_TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    'HMAC',
    keyMaterial,
    sigBytes,
    encoder.encode(dataB64)
  );

  if (!valid) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const data = JSON.parse(atob(dataB64));

  if (Date.now() > data.expiresAt) {
    return c.json({ error: 'Token expired' }, 401);
  }

  // Fetch from R2
  const object = await c.env.PLUGINS_BUCKET.get(data.key);

  if (!object) {
    return c.json({ error: 'File not found' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="plugin.vst3"`);
  headers.set('Content-Length', object.size.toString());

  return new Response(object.body, { headers });
});
```

---

## Phase 6: Frontend Implementation

### 6.1 Key Components

```
web/src/components/
├── auth/
│   ├── GoogleLoginButton.tsx    # OAuth trigger
│   └── AuthProvider.tsx         # Session context
├── generation/
│   ├── PromptInput.tsx          # Initial prompt entry
│   ├── PlanViewer.tsx           # Display AI plan with syntax highlighting
│   ├── PlanChat.tsx             # Chat interface for plan refinement
│   ├── ModelSelector.tsx        # AI model dropdown
│   └── ApiKeyInput.tsx          # Encrypted key input
├── build/
│   ├── BuildProgress.tsx        # Status indicator
│   ├── TerminalLogs.tsx         # xterm.js log viewer
│   └── DownloadButton.tsx       # Artifact download
└── projects/
    ├── ProjectCard.tsx          # Project summary card
    ├── ProjectList.tsx          # User's projects grid
    └── ProjectDetail.tsx        # Full project view
```

### 6.2 Terminal Component

```typescript
// web/src/components/build/TerminalLogs.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalLogsProps {
  projectId: string;
  onStatusChange?: (status: string) => void;
}

export function TerminalLogs({ projectId, onStatusChange }: TerminalLogsProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    terminal.current = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#f0f0f0',
        cursor: '#f39c12',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.current.loadAddon(fitAddon);
    terminal.current.open(terminalRef.current);
    fitAddon.fit();

    // Connect WebSocket
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/api/builds/ws/${projectId}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'init') {
        data.logs.forEach((log: any) => writeLine(log));
        onStatusChange?.(data.status);
      }

      if (data.type === 'log') {
        writeLine(data);
      }

      if (data.type === 'status') {
        onStatusChange?.(data.status);
        if (data.status === 'SUCCESS') {
          writeLine({ level: 'info', source: 'system', message: '✅ Build successful!' });
        } else if (data.status === 'FAILED') {
          writeLine({ level: 'error', source: 'system', message: `❌ Build failed: ${data.error}` });
        }
      }
    };

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      ws.current?.close();
      terminal.current?.dispose();
    };
  }, [projectId]);

  const writeLine = (log: { level: string; source: string; message: string }) => {
    const color = {
      info: '\x1b[37m',    // white
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
    }[log.level] || '\x1b[37m';

    const prefix = `\x1b[90m[${log.source}]\x1b[0m`;
    terminal.current?.writeln(`${prefix} ${color}${log.message}\x1b[0m`);
  };

  return (
    <div
      ref={terminalRef}
      className="w-full h-[400px] rounded-lg overflow-hidden border border-gray-700"
    />
  );
}
```

---

## Phase 7: Implementation Order

### Week 1: Infrastructure
- [ ] Create monorepo structure with turborepo
- [ ] Set up Cloudflare Workers backend with Hono
- [ ] Configure D1 database and run migrations
- [ ] Set up R2 buckets
- [ ] Configure KV namespaces

### Week 2: Authentication
- [ ] Implement BetterAuth with Google OAuth
- [ ] Build login/callback pages
- [ ] Implement API key encryption/storage
- [ ] Create settings page for model selection

### Week 3: Plan Negotiation
- [ ] Port AI Planner service
- [ ] Build PlanViewer component
- [ ] Implement chat interface
- [ ] Create plan approval flow

### Week 4: Code Generation
- [ ] Port cpp_generator.py to TypeScript
- [ ] Integrate with GitHub API
- [ ] Set up matrix build workflow
- [ ] Implement R2 artifact upload

### Week 5: Real-Time Status
- [ ] Build BuildStatus Durable Object
- [ ] Implement WebSocket connection
- [ ] Create Terminal component with xterm.js
- [ ] Stream GitHub Actions logs

### Week 6: Dashboard & Polish
- [ ] Build My Projects dashboard
- [ ] Implement download flow
- [ ] Add error handling and retry
- [ ] Performance optimization
- [ ] Deploy to production

---

## Environment Variables Checklist

```bash
# Cloudflare Workers (wrangler secret put)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
BETTER_AUTH_SECRET=xxx
JWT_SECRET=xxx
GITHUB_TOKEN=ghp_xxx
GEMINI_API_KEY=xxx         # Fallback
ANTHROPIC_API_KEY=xxx      # Fallback
ENCRYPTION_SECRET=xxx      # For API key encryption
UPLOAD_TOKEN_SECRET=xxx    # For download tokens

# Next.js Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://api.vaist.ai
NEXT_PUBLIC_WS_URL=wss://api.vaist.ai
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx
```

---

## Success Criteria

1. **Authentication**: Users can login with Google and their data persists
2. **Model Selection**: Users can choose Gemini 3.0 Flash or inject their own API key
3. **Plan Negotiation**: Users can iterate on plugin designs with AI feedback
4. **Real-Time Logs**: Build progress streams in real-time via WebSocket
5. **Artifact Delivery**: Successful builds produce downloadable .vst3 files
6. **Project Persistence**: All projects are saved and accessible in dashboard
7. **Zero Egress Costs**: R2 serves artifacts without bandwidth charges
