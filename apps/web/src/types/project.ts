export type PluginType =
  | "GAIN"
  | "WAVESHAPER"
  | "DISTORTION"
  | "COMPRESSOR"
  | "DELAY"
  | "REVERB"
  | "FILTER"
  | "TREMOLO"
  | "CHORUS"
  | "CUSTOM";

export interface PluginControl {
  id: string;
  name: string;
  value: number;       // 0-1 normalized
  min?: number;
  max?: number;
  unit?: string;       // "dB", "%", "ms", etc.
}

export interface ProjectManifest {
  controls: PluginControl[];
  complexity: number;  // DSP logic lines generated
  dspType?: string;    // "cubic-softclip", "waveshaper", etc.
}

export interface DownloadUrls {
  windows?: string;
  macos?: string;
}

export interface ProjectCapsule {
  id: string;          // The VAI1, VAI2 unique ID
  taskId: string;      // Backend task ID
  prompt: string;      // The original user intent
  type: PluginType;    // GAIN, WAVESHAPER, etc.
  timestamp: Date;     // Build date
  status: "SUCCESS" | "FAILED" | "BUILDING";
  manifest: ProjectManifest;
  downloadUrls?: DownloadUrls; // Platform-specific download links
  workflowUrl?: string;        // GitHub Actions workflow URL
  version: number;     // v1, v2, v3 for refinements
}

// Parse plugin type from prompt
export function inferPluginType(prompt: string): PluginType {
  const lower = prompt.toLowerCase();

  if (lower.includes("gain") || lower.includes("volume")) return "GAIN";
  if (lower.includes("waveshap")) return "WAVESHAPER";
  if (lower.includes("distort") || lower.includes("overdrive") || lower.includes("saturat")) return "DISTORTION";
  if (lower.includes("compress") || lower.includes("sustain") || lower.includes("limiter")) return "COMPRESSOR";
  if (lower.includes("delay") || lower.includes("echo")) return "DELAY";
  if (lower.includes("reverb") || lower.includes("room") || lower.includes("hall")) return "REVERB";
  if (lower.includes("filter") || lower.includes("eq") || lower.includes("lowpass") || lower.includes("highpass")) return "FILTER";
  if (lower.includes("tremolo") || lower.includes("vibrato")) return "TREMOLO";
  if (lower.includes("chorus") || lower.includes("flanger") || lower.includes("phaser")) return "CHORUS";

  return "CUSTOM";
}

// Extract controls from prompt
export function inferControlsFromPrompt(prompt: string): PluginControl[] {
  const controls: PluginControl[] = [];
  const lower = prompt.toLowerCase();

  // Common control patterns
  const patterns = [
    { match: /drive|gain|amount|intensity/, name: "Drive", id: "drive" },
    { match: /mix|wet|dry|blend/, name: "Mix", id: "mix" },
    { match: /volume|output|level/, name: "Output", id: "output" },
    { match: /rate|speed|freq/, name: "Rate", id: "rate" },
    { match: /depth|width|amount/, name: "Depth", id: "depth" },
    { match: /attack/, name: "Attack", id: "attack" },
    { match: /release/, name: "Release", id: "release" },
    { match: /threshold/, name: "Threshold", id: "threshold" },
    { match: /ratio/, name: "Ratio", id: "ratio" },
    { match: /time|delay/, name: "Time", id: "time" },
    { match: /feedback/, name: "Feedback", id: "feedback" },
    { match: /tone|color|character/, name: "Tone", id: "tone" },
  ];

  for (const pattern of patterns) {
    if (pattern.match.test(lower)) {
      controls.push({
        id: pattern.id,
        name: pattern.name,
        value: 0.5,
      });
    }
  }

  // Always add at least a main control and output
  if (controls.length === 0) {
    controls.push(
      { id: "amount", name: "Amount", value: 0.5 },
      { id: "mix", name: "Mix", value: 0.75 },
    );
  }

  return controls;
}
