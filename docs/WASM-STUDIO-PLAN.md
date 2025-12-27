# vAIst WASM Studio Implementation Plan

> **Generated:** December 2025
> **Status:** Ready for Implementation
> **Architecture:** Edge-Native, Local-First, WAM 2.0 Compliant

---

## Executive Summary

Build a professional-grade, browser-based DAW (WASM Studio) that allows users to:
- Load and chain their AI-generated WASM plugins
- Mix multi-track audio with unlimited tracks
- Collaborate in real-time (Figma-style)
- Share plugins and presets with the community
- Export stems and project files

---

## 1. Architecture Overview

### 1.1 The Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI LAYER (Next.js 16.1)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Mixer     │  │  Timeline   │  │  Plugin     │              │
│  │   Strip     │  │  + Markers  │  │  Windows    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                   AUDIO ENGINE (AudioWorklet)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   WAM       │  │  Transport  │  │  MIDI       │              │
│  │   Host      │  │  Manager    │  │  Router     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                   DATA LAYER (Hybrid Storage)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ IndexedDB   │  │ Cloudflare  │  │ Cloudflare  │              │
│  │ (Local)     │  │ D1 (Meta)   │  │ R2 (Assets) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | Next.js 16.1 + Turbopack | Fast HMR, edge rendering |
| State Management | Zustand + Dexie.js | Local-first reactive state |
| Audio Engine | WAM SDK 2.0 | Plugin hosting standard |
| Real-time | Cloudflare Durable Objects | Multiplayer collaboration |
| Animations | Framer Motion | Floating windows, transitions |
| Components | shadcn/ui + Radix UI | Accessible, customizable |
| Database | Prisma + D1 | Session/preset metadata |
| Storage | R2 + IndexedDB | Audio files, WASM binaries |

---

## 2. Feature Specification

### 2.1 Navigation & Entry Points

| Route | Description | Priority |
|-------|-------------|----------|
| `/forge` | Plugin creation + quick preview panel | Phase 1 |
| `/studio` | Full-screen DAW experience | Phase 2 |
| `/gallery` | Community plugin browser | Phase 3 |
| `/studio/:sessionId` | Shared collaborative session | Phase 4 |

### 2.2 Core Features (MVP)

#### Phase 1: The Forge Enhancement (Week 1-2) ✅ COMPLETE
- [x] Text-to-Plugin generation (existing)
- [x] Single-track WASM preview (existing)
- [x] Floating plugin window with drag/resize
- [x] Sidebar control strip for quick adjustments
- [x] Basic preset save/load

#### Phase 2: The Studio Core (Week 3-4)
- [ ] Multi-track mixer (unlimited tracks)
- [ ] Plugin chaining (insert slots per track)
- [ ] Timeline with waveform visualization
- [ ] Loop regions and markers
- [ ] Master bus with plugin inserts
- [ ] File upload (WAV/MP3/FLAC)
- [ ] Microphone recording

#### Phase 3: The Social Layer (Month 2)
- [ ] Community plugin gallery
- [ ] Public/private sharing toggle
- [ ] Plugin forking (clone and modify)
- [ ] Preset sharing marketplace
- [ ] User profiles with plugin portfolio

#### Phase 4: The Jam (Month 3)
- [ ] Real-time multiplayer (Durable Objects)
- [ ] Shared AI refinement chat
- [ ] Cursor presence (ghost knobs)
- [ ] Session roles (Owner/Editor/Viewer)
- [ ] MIDI controller mapping

---

## 3. Technical Implementation

### 3.1 Directory Structure

```
apps/web/src/
├── app/
│   ├── forge/             # Existing forge page
│   ├── studio/            # New studio route
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── [sessionId]/   # Collaborative sessions
│   └── gallery/           # Community plugins
├── components/
│   ├── studio/
│   │   ├── Mixer.tsx
│   │   ├── Track.tsx
│   │   ├── Timeline.tsx
│   │   ├── Transport.tsx
│   │   ├── PluginWindow.tsx
│   │   ├── PluginSidebar.tsx
│   │   ├── MasterBus.tsx
│   │   └── WaveformDisplay.tsx
│   ├── gallery/
│   │   ├── PluginCard.tsx
│   │   ├── PluginGrid.tsx
│   │   └── FilterBar.tsx
│   └── shared/
│       ├── Knob.tsx
│       ├── Slider.tsx
│       ├── VUMeter.tsx
│       └── MidiLearn.tsx
├── lib/
│   ├── audio/
│   │   ├── wam-host.ts       # WAM 2.0 host implementation
│   │   ├── transport.ts      # Play/stop/loop/BPM
│   │   ├── midi-manager.ts   # Web MIDI API integration
│   │   └── audio-graph.ts    # Track routing
│   ├── storage/
│   │   ├── session-store.ts  # Zustand + Dexie
│   │   ├── sync-engine.ts    # D1/R2 cloud sync
│   │   └── cache-manager.ts  # WASM/audio caching
│   └── collaboration/
│       ├── presence.ts       # User cursors
│       └── sync-client.ts    # Durable Object WebSocket
└── stores/
    ├── studio-store.ts       # Tracks, plugins, transport
    ├── mixer-store.ts        # Volume, pan, mute, solo
    └── collab-store.ts       # Multiplayer state
```

### 3.2 WAM Host Implementation

```typescript
// lib/audio/wam-host.ts
import { WamHost, WamGroup } from '@webaudiomodules/sdk';

export class VAIstWamHost {
  private audioContext: AudioContext;
  private hostGroup: WamGroup;
  private plugins: Map<string, WamNode> = new Map();

  async initialize() {
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.hostGroup = await WamHost.create(this.audioContext);
  }

  async loadPlugin(projectId: string, versionId: string): Promise<WamNode> {
    const pluginUrl = `${R2_BASE_URL}/plugins/${projectId}/${versionId}/`;
    const { default: WAM } = await import(`${pluginUrl}vaist_plugin.js`);
    const instance = await WAM.createInstance(this.hostGroup);
    this.plugins.set(`${projectId}:${versionId}`, instance);
    return instance;
  }

  async connectPluginChain(trackId: string, pluginIds: string[]) {
    // Connect plugins in series: source -> plugin1 -> plugin2 -> track output
  }
}
```

### 3.3 Floating Window System

```typescript
// components/studio/PluginWindow.tsx
import { motion, useDragControls } from 'framer-motion';
import { createPortal } from 'react-dom';

interface PluginWindowProps {
  plugin: WamNode;
  position: { x: number; y: number };
  onClose: () => void;
}

export function PluginWindow({ plugin, position, onClose }: PluginWindowProps) {
  const controls = useDragControls();

  return createPortal(
    <motion.div
      drag
      dragControls={controls}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed forge-glass rounded-xl shadow-2xl"
      style={{ left: position.x, top: position.y, width: 400 }}
    >
      <div className="p-4 cursor-move" onPointerDown={(e) => controls.start(e)}>
        <PluginHeader plugin={plugin} onClose={onClose} />
      </div>
      <div className="p-4">
        <PluginControls plugin={plugin} />
      </div>
    </motion.div>,
    document.getElementById('portal-root')!
  );
}
```

### 3.4 Local-First Storage

```typescript
// lib/storage/session-store.ts
import Dexie from 'dexie';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// IndexedDB schema
class StudioDatabase extends Dexie {
  sessions!: Table<StudioSession>;
  audioBlobs!: Table<AudioBlob>;
  presets!: Table<PluginPreset>;

  constructor() {
    super('vaist-studio');
    this.version(1).stores({
      sessions: 'id, userId, updatedAt',
      audioBlobs: 'id, sessionId, trackId',
      presets: 'id, pluginId, userId',
    });
  }
}

// Zustand store with auto-persist
export const useStudioStore = create(
  subscribeWithSelector<StudioState>((set, get) => ({
    tracks: [],
    addTrack: () => {
      const newTrack = createEmptyTrack();
      set((state) => ({ tracks: [...state.tracks, newTrack] }));
      // Auto-save to IndexedDB
      db.sessions.put({ ...get(), updatedAt: Date.now() });
    },
    // ... other actions
  }))
);
```

### 3.5 Real-Time Collaboration (Durable Object)

```typescript
// workers/studio-session.ts (Durable Object)
export class StudioSessionDO implements DurableObject {
  private sessions: Map<WebSocket, UserPresence> = new Map();
  private state: DurableObjectState;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === '/broadcast') {
      const message = await request.json();
      this.broadcast(message);
      return new Response('OK');
    }
  }

  private broadcast(message: any) {
    for (const [ws, user] of this.sessions) {
      ws.send(JSON.stringify({ ...message, from: user.id }));
    }
  }
}
```

### 3.6 MIDI Mapping System

```typescript
// lib/audio/midi-manager.ts
export class MidiManager {
  private mappings: Map<number, ParameterBinding> = new Map();
  private learnMode: boolean = false;
  private learnTarget: ParameterBinding | null = null;

  async initialize() {
    const access = await navigator.requestMIDIAccess();
    for (const input of access.inputs.values()) {
      input.onmidimessage = this.handleMidiMessage.bind(this);
    }
  }

  startLearn(pluginId: string, paramId: string) {
    this.learnMode = true;
    this.learnTarget = { pluginId, paramId };
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const [status, cc, value] = event.data;
    if (status !== 176) return; // Only handle CC messages

    if (this.learnMode && this.learnTarget) {
      this.mappings.set(cc, this.learnTarget);
      this.learnMode = false;
      this.learnTarget = null;
    }

    const binding = this.mappings.get(cc);
    if (binding) {
      const normalized = value / 127;
      studioStore.setPluginParameter(binding.pluginId, binding.paramId, normalized);
    }
  }
}
```

---

## 4. Database Schema

### 4.1 D1 Schema Extensions

```sql
-- Studio Sessions
CREATE TABLE studio_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT DEFAULT 'Untitled Session',
  project_json TEXT NOT NULL,      -- Full session state (tracks, plugins, routing)
  assets_map TEXT,                  -- Map of local IDs to R2 URLs
  is_public BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Plugin Presets
CREATE TABLE plugin_presets (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  is_factory BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  downloads INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plugin_id) REFERENCES project(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Community Gallery
CREATE TABLE plugin_shares (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,                        -- JSON array of tags
  likes INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plugin_id) REFERENCES project(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Plugin Versioning (Fork-on-Refine)
ALTER TABLE project ADD COLUMN root_id TEXT;
ALTER TABLE project ADD COLUMN version_name TEXT DEFAULT 'v1';
ALTER TABLE project ADD COLUMN parent_id TEXT;
```

---

## 5. API Endpoints

### 5.1 Studio Routes

```typescript
// apps/backend/src/routes/studio.ts
export const studioRoutes = new Hono<{ Bindings: Env }>();

// Session Management
studioRoutes.post('/sessions', requireAuth, createSession);
studioRoutes.get('/sessions', requireAuth, listSessions);
studioRoutes.get('/sessions/:id', requireAuth, getSession);
studioRoutes.put('/sessions/:id', requireAuth, updateSession);
studioRoutes.delete('/sessions/:id', requireAuth, deleteSession);

// Preset Management
studioRoutes.post('/presets', requireAuth, createPreset);
studioRoutes.get('/presets/:pluginId', getPresets);
studioRoutes.get('/presets/:pluginId/factory', getFactoryPresets);

// Gallery
studioRoutes.get('/gallery', getPublicPlugins);
studioRoutes.get('/gallery/featured', getFeaturedPlugins);
studioRoutes.get('/gallery/trending', getTrendingPlugins);
studioRoutes.post('/gallery/:pluginId/like', requireAuth, likePlugin);
studioRoutes.post('/gallery/:pluginId/fork', requireAuth, forkPlugin);

// Collaboration
studioRoutes.post('/sessions/:id/invite', requireAuth, inviteToSession);
studioRoutes.get('/sessions/:id/ws', upgradeToWebSocket);
```

---

## 6. Iterative Release Plan

### Week 1-2: Enhanced Forge Preview ✅ COMPLETE
- [x] Floating plugin window (Framer Motion)
- [x] Sidebar control strip
- [x] Basic preset save/load (IndexedDB)
- [x] Improved waveform visualization

### Week 3-4: Multi-Track Studio MVP
- [ ] `/studio` route with mixer UI
- [ ] Unlimited track creation
- [ ] Plugin chaining (up to 4 inserts per track)
- [ ] Timeline with markers
- [ ] File upload + basic transport

### Month 2: Social Features
- [ ] Community gallery (`/gallery`)
- [ ] Public/private sharing
- [ ] Preset marketplace
- [ ] Plugin forking (version lineage)
- [ ] User profiles

### Month 3: Collaboration & Pro
- [ ] Real-time multiplayer (Durable Objects)
- [ ] MIDI controller mapping
- [ ] Stems export
- [ ] Built-in sample library (~20 loops)
- [ ] Freemium monetization (Stripe)

---

## 7. Monetization Structure

| Tier | Price | Forge | Studio | Export |
|------|-------|-------|--------|--------|
| Free | $0 | 3 builds/month | 8 tracks, no collab | WAV only |
| Pro | $19/mo | 50 builds/month | Unlimited tracks, collab | WAV/MP3 + Stems |
| Enterprise | Custom | Unlimited | Team seats | Custom signing |

---

## 8. Accessibility Requirements (WCAG 2.2 AA)

- [ ] Full keyboard navigation for all controls
- [ ] ARIA labels on all interactive elements
- [ ] Screen reader announcements for parameter changes
- [ ] `prefers-reduced-motion` support
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus indicators on all interactive elements

---

## 9. Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Studio Load | < 2s | WASM cache, IndexedDB |
| Plugin Load | < 200ms | R2 edge caching |
| Audio Latency | < 10ms | SharedArrayBuffer, Atomics |
| Collab Sync | < 50ms | Durable Objects WebSocket |
| MIDI Latency | < 2ms | Direct AudioWorklet pipe |

---

## 10. Next Steps

1. **Create feature branch:** `feature/wasm-studio`
2. **Install dependencies:** `@webaudiomodules/sdk`, `dexie`, `framer-motion`
3. **Scaffold `/studio` route** with basic mixer layout
4. **Implement WAM host** for plugin loading
5. **Build floating window system** with Framer Motion
6. **Add IndexedDB persistence** via Dexie.js

---

*This plan is designed for iterative implementation. Ship Phase 1 immediately, then release Phase 2-4 as weekly updates to maintain product velocity.*
