/**
 * BuildStatus Durable Object
 * Real-time WebSocket streaming of build logs
 *
 * Uses Cloudflare's WebSocket Hibernation API for memory efficiency
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../server';

interface BuildState {
  projectId: string;
  userId: string;
  status: 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  logs: LogEntry[];
}

/**
 * Session-Only API Key Storage
 * Keys stored here are NEVER persisted to D1/storage
 * They exist only in DO memory for the duration of the build
 * This is the "zero-trust" option for security-conscious users
 */
interface SessionKey {
  apiKey: string;
  provider: 'google' | 'anthropic';
  expiresAt: number; // Unix timestamp
}

interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  step?: string;
}

interface WebSocketMessage {
  type: 'log' | 'status' | 'progress' | 'complete' | 'error';
  data: unknown;
}

export class BuildStatus extends DurableObject<Env> {
  private state: BuildState = {
    projectId: '',
    userId: '',
    status: 'PENDING',
    progress: 0,
    logs: [],
  };

  // Session-only key: IN-MEMORY ONLY, never persisted
  // Automatically cleared on build complete or expiration
  private sessionKey: SessionKey | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      // Restore state from storage (but NOT sessionKey - that's memory-only)
      const stored = await this.ctx.storage.get<BuildState>('state');
      if (stored) {
        this.state = stored;
      }
    });
  }

  /**
   * Store a session-only API key (memory-only, never persisted)
   * Key will be automatically wiped after TTL or build completion
   */
  setSessionKey(apiKey: string, provider: 'google' | 'anthropic', ttlSeconds = 3600): void {
    this.sessionKey = {
      apiKey,
      provider,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
  }

  /**
   * Get the session API key if valid and not expired
   */
  getSessionKey(): SessionKey | null {
    if (!this.sessionKey) return null;
    if (Date.now() > this.sessionKey.expiresAt) {
      this.sessionKey = null; // Expired, wipe it
      return null;
    }
    return this.sessionKey;
  }

  /**
   * Clear the session key (called on build complete or explicit logout)
   */
  clearSessionKey(): void {
    this.sessionKey = null;
  }

  async fetch(request: Request): Promise<Response> {
    // URL parsed but not currently used for routing
    const _url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // HTTP API for internal updates
    if (request.method === 'POST') {
      const body = await request.json<{
        action: 'log' | 'status' | 'complete' | 'set-session-key' | 'clear-session-key';
        data: unknown;
      }>();

      switch (body.action) {
        case 'log':
          return this.addLog(body.data as LogEntry);
        case 'status':
          return this.updateStatus(
            body.data as { status: BuildState['status']; progress?: number }
          );
        case 'complete':
          return this.completeBuild(
            body.data as { success: boolean; artifactKey?: string }
          );
        case 'set-session-key':
          // Store API key in memory only (never persisted)
          const keyData = body.data as { apiKey: string; provider: 'google' | 'anthropic'; ttl?: number };
          this.setSessionKey(keyData.apiKey, keyData.provider, keyData.ttl || 3600);
          return new Response(JSON.stringify({ success: true, expiresIn: keyData.ttl || 3600 }), {
            headers: { 'Content-Type': 'application/json' },
          });
        case 'clear-session-key':
          this.clearSessionKey();
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        default:
          return new Response('Unknown action', { status: 400 });
      }
    }

    // GET current state
    return new Response(JSON.stringify(this.state), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleWebSocket(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket with hibernation
    this.ctx.acceptWebSocket(server);

    // Send current state to new client
    const initialState: WebSocketMessage = {
      type: 'status',
      data: {
        status: this.state.status,
        progress: this.state.progress,
        logs: this.state.logs.slice(-50), // Last 50 logs
      },
    };
    server.send(JSON.stringify(initialState));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // WebSocket event handlers (hibernation API)
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // Handle ping/pong for connection keep-alive
    if (message === 'ping') {
      ws.send('pong');
      return;
    }

    // Could handle client commands here if needed
    console.log('WebSocket message:', message);
  }

  async webSocketClose(
    _ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean
  ): Promise<void> {
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  // Internal methods
  private async addLog(entry: LogEntry): Promise<Response> {
    const logEntry: LogEntry = {
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level || 'INFO',
      message: entry.message,
      step: entry.step,
    };

    this.state.logs.push(logEntry);

    // Keep only last 1000 logs in memory
    if (this.state.logs.length > 1000) {
      this.state.logs = this.state.logs.slice(-1000);
    }

    await this.persist();
    await this.broadcast({ type: 'log', data: logEntry });

    return new Response('OK');
  }

  private async updateStatus(update: {
    status: BuildState['status'];
    progress?: number;
  }): Promise<Response> {
    this.state.status = update.status;
    if (update.progress !== undefined) {
      this.state.progress = update.progress;
    }

    if (update.status === 'BUILDING' && !this.state.startedAt) {
      this.state.startedAt = new Date().toISOString();
    }

    await this.persist();
    await this.broadcast({
      type: 'status',
      data: { status: this.state.status, progress: this.state.progress },
    });

    return new Response('OK');
  }

  private async completeBuild(result: {
    success: boolean;
    artifactKey?: string;
  }): Promise<Response> {
    this.state.status = result.success ? 'SUCCESS' : 'FAILED';
    this.state.progress = 100;
    this.state.completedAt = new Date().toISOString();

    // SECURITY: Clear session-only API key on build completion
    // This ensures keys never linger in memory after use
    this.clearSessionKey();

    await this.persist();
    await this.broadcast({
      type: 'complete',
      data: {
        success: result.success,
        artifactKey: result.artifactKey,
        completedAt: this.state.completedAt,
      },
    });

    return new Response('OK');
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put('state', this.state);
  }

  private async broadcast(message: WebSocketMessage): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    const payload = JSON.stringify(message);

    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {
        // Socket might be closed, ignore
      }
    }
  }
}
