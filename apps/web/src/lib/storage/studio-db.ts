/**
 * Studio Database (Dexie.js + IndexedDB)
 *
 * Local-first storage for:
 * - Plugin presets (parameter snapshots)
 * - Studio sessions (future: multi-track projects)
 * - Audio blobs (future: recorded/uploaded audio)
 *
 * This enables offline functionality and fast access
 * without requiring server round-trips.
 */

import Dexie, { type Table } from "dexie";

// Preset schema - stores plugin parameter snapshots
export interface PluginPreset {
  id: string;
  pluginId: string; // Project ID from backend
  versionId: string; // Version ID from backend
  userId?: string; // Optional: for syncing to cloud later
  name: string;
  description?: string;
  parameters: Record<string, number>; // { paramId: value }
  isFactory: boolean; // Factory presets vs user presets
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

// Studio session schema (future: multi-track projects)
export interface StudioSession {
  id: string;
  userId?: string;
  name: string;
  projectJson: string; // Full session state (tracks, plugins, routing)
  assetsMap?: string; // Map of local IDs to R2 URLs
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

// Audio blob schema (future: recorded/uploaded audio)
export interface AudioBlob {
  id: string;
  sessionId: string;
  trackId: string;
  name: string;
  mimeType: string;
  data: Blob;
  duration: number; // seconds
  sampleRate: number;
  createdAt: number;
}

/**
 * vAIst Studio Database
 *
 * Uses Dexie.js for IndexedDB with nice async/await API.
 * Schema versioning allows future migrations without data loss.
 */
class StudioDatabase extends Dexie {
  presets!: Table<PluginPreset>;
  sessions!: Table<StudioSession>;
  audioBlobs!: Table<AudioBlob>;

  constructor() {
    super("vaist-studio");

    // Version 1: Initial schema
    this.version(1).stores({
      // Presets indexed by id, with compound index for plugin lookup
      presets: "id, pluginId, [pluginId+versionId], userId, createdAt, isFavorite",
      // Sessions indexed by id and userId for listing
      sessions: "id, userId, updatedAt",
      // Audio blobs indexed by id and sessionId for lookup
      audioBlobs: "id, sessionId, [sessionId+trackId]",
    });
  }
}

// Singleton database instance
export const db = new StudioDatabase();

/**
 * Preset Helper Functions
 */

// Generate unique preset ID
export function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Create a new preset
export async function createPreset(
  pluginId: string,
  versionId: string,
  name: string,
  parameters: Record<string, number>,
  options?: {
    description?: string;
    isFactory?: boolean;
    userId?: string;
  }
): Promise<PluginPreset> {
  const now = Date.now();
  const preset: PluginPreset = {
    id: generatePresetId(),
    pluginId,
    versionId,
    userId: options?.userId,
    name,
    description: options?.description,
    parameters,
    isFactory: options?.isFactory ?? false,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.presets.add(preset);
  return preset;
}

// Get all presets for a plugin
export async function getPresetsForPlugin(
  pluginId: string,
  versionId?: string
): Promise<PluginPreset[]> {
  if (versionId) {
    return db.presets
      .where("[pluginId+versionId]")
      .equals([pluginId, versionId])
      .sortBy("createdAt");
  }
  return db.presets.where("pluginId").equals(pluginId).sortBy("createdAt");
}

// Get a single preset by ID
export async function getPreset(presetId: string): Promise<PluginPreset | undefined> {
  return db.presets.get(presetId);
}

// Update a preset
export async function updatePreset(
  presetId: string,
  updates: Partial<Pick<PluginPreset, "name" | "description" | "parameters" | "isFavorite">>
): Promise<void> {
  await db.presets.update(presetId, {
    ...updates,
    updatedAt: Date.now(),
  });
}

// Delete a preset
export async function deletePreset(presetId: string): Promise<void> {
  await db.presets.delete(presetId);
}

// Toggle favorite status
export async function togglePresetFavorite(presetId: string): Promise<boolean> {
  const preset = await db.presets.get(presetId);
  if (!preset) return false;

  const newFavorite = !preset.isFavorite;
  await db.presets.update(presetId, {
    isFavorite: newFavorite,
    updatedAt: Date.now(),
  });
  return newFavorite;
}

// Get favorite presets
export async function getFavoritePresets(pluginId?: string): Promise<PluginPreset[]> {
  if (pluginId) {
    return db.presets
      .where("pluginId")
      .equals(pluginId)
      .and((p) => p.isFavorite)
      .sortBy("updatedAt");
  }
  return db.presets.where("isFavorite").equals(1).sortBy("updatedAt");
}

// Export preset as JSON (for sharing)
export function exportPresetToJson(preset: PluginPreset): string {
  return JSON.stringify({
    name: preset.name,
    description: preset.description,
    parameters: preset.parameters,
    pluginId: preset.pluginId,
    versionId: preset.versionId,
    exportedAt: new Date().toISOString(),
  });
}

// Import preset from JSON
export async function importPresetFromJson(
  json: string,
  overridePluginId?: string,
  overrideVersionId?: string
): Promise<PluginPreset> {
  const data = JSON.parse(json);
  return createPreset(
    overridePluginId ?? data.pluginId,
    overrideVersionId ?? data.versionId,
    data.name,
    data.parameters,
    { description: data.description }
  );
}

/**
 * Session Helper Functions (Future: Phase 2)
 */

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Audio Blob Helper Functions
 */

export function generateAudioBlobId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Store an audio blob
export async function storeAudioBlob(
  sessionId: string,
  trackId: string,
  name: string,
  data: Blob,
  duration: number,
  sampleRate: number
): Promise<AudioBlob> {
  const audioBlob: AudioBlob = {
    id: generateAudioBlobId(),
    sessionId,
    trackId,
    name,
    mimeType: data.type,
    data,
    duration,
    sampleRate,
    createdAt: Date.now(),
  };

  await db.audioBlobs.add(audioBlob);
  return audioBlob;
}

// Get an audio blob by ID
export async function getAudioBlob(id: string): Promise<AudioBlob | undefined> {
  return db.audioBlobs.get(id);
}

// Get all audio blobs for a session
export async function getAudioBlobsForSession(sessionId: string): Promise<AudioBlob[]> {
  return db.audioBlobs.where("sessionId").equals(sessionId).toArray();
}

// Get audio blobs for a specific track
export async function getAudioBlobsForTrack(
  sessionId: string,
  trackId: string
): Promise<AudioBlob[]> {
  return db.audioBlobs
    .where("[sessionId+trackId]")
    .equals([sessionId, trackId])
    .toArray();
}

// Delete an audio blob
export async function deleteAudioBlob(id: string): Promise<void> {
  await db.audioBlobs.delete(id);
}

// Delete all audio blobs for a session
export async function deleteAudioBlobsForSession(sessionId: string): Promise<void> {
  await db.audioBlobs.where("sessionId").equals(sessionId).delete();
}
