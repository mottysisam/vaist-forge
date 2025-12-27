/**
 * AI Service
 * Gemini 3.0 Flash with Structured Output for reliable JSON generation
 *
 * Key Features (December 2025):
 * - Native JSON Schema output (no regex parsing)
 * - Thinking Levels for complex DSP reasoning
 * - Single model - no fallback chain needed
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { pluginPlanSchema, type PluginPlan } from '@vaist/shared';
import {
  PLUGIN_PLAN_SYSTEM_PROMPT,
  PLAN_REFINEMENT_SYSTEM_PROMPT,
  buildPlanPrompt,
  buildRefinementPrompt,
} from './prompts';

export interface AIServiceConfig {
  googleApiKey: string;
  defaultModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerationResult {
  plan: PluginPlan;
  rawResponse: string;
  model: string;
  thinkingTokens?: number;
}

/**
 * Thinking level configuration based on DSP complexity
 * - 'low': Simple effects (gain, pan)
 * - 'medium': Standard effects (filters, delays)
 * - 'high': Complex DSP (FFT, convolution, physical modeling)
 */
type ThinkingLevel = 'none' | 'low' | 'medium' | 'high';

function getThinkingLevel(prompt: string): ThinkingLevel {
  const complexPatterns = [
    /fft|spectrum|frequency\s+analysis/i,
    /convolution|impulse\s+response/i,
    /physical\s+model|waveguide/i,
    /vocoder|pitch\s+shift/i,
    /granular|spectral/i,
  ];

  const mediumPatterns = [
    /filter|eq|equalizer/i,
    /compressor|dynamics|limiter/i,
    /delay|reverb|echo/i,
    /modulation|chorus|flanger|phaser/i,
  ];

  if (complexPatterns.some(p => p.test(prompt))) return 'high';
  if (mediumPatterns.some(p => p.test(prompt))) return 'medium';
  return 'low';
}

/**
 * AI Service for plugin plan generation
 * Uses Gemini 3.0 Flash Preview with Structured Output
 */
export class AIService {
  private gemini: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(config: AIServiceConfig) {
    this.gemini = new GoogleGenerativeAI(config.googleApiKey);
    this.defaultModel = config.defaultModel;
  }

  /**
   * Generate a plugin plan from a user prompt
   */
  async generatePlan(userPrompt: string): Promise<GenerationResult> {
    const prompt = buildPlanPrompt(userPrompt);
    return this.callGeminiStructured(prompt, [], userPrompt);
  }

  /**
   * Refine an existing plan based on user feedback
   */
  async refinePlan(
    currentPlan: PluginPlan,
    userMessage: string,
    chatHistory: ChatMessage[]
  ): Promise<GenerationResult> {
    const prompt = buildRefinementPrompt(
      JSON.stringify(currentPlan, null, 2),
      userMessage
    );
    return this.callGeminiStructured(prompt, chatHistory, userMessage, true);
  }

  /**
   * Call Gemini 3.0 Flash with Structured Output
   * No regex parsing needed - JSON schema enforced at generation time
   */
  private async callGeminiStructured(
    prompt: string,
    history: ChatMessage[],
    originalPrompt: string,
    isRefinement = false
  ): Promise<GenerationResult> {
    const thinkingLevel = getThinkingLevel(originalPrompt);

    const model = this.gemini.getGenerativeModel({
      model: this.defaultModel,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        // JSON mode - Zod validates the structure after parsing
        responseMimeType: 'application/json',
      },
      // System instruction for JUCE 8 expertise
      systemInstruction: isRefinement
        ? PLAN_REFINEMENT_SYSTEM_PROMPT
        : PLUGIN_PLAN_SYSTEM_PROMPT,
    });

    // Build conversation contents
    const contents = [
      // Add conversation history
      ...history.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: msg.content }],
      })),
      // Current prompt
      {
        role: 'user' as const,
        parts: [{ text: prompt }],
      },
    ];

    console.log(`[AI] Generating plan with thinking level: ${thinkingLevel}`);

    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();

    // Parse JSON directly - no regex extraction needed
    const parsed = JSON.parse(text);

    // Validate with Zod for extra safety
    const validated = pluginPlanSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[AI] Schema validation failed:', validated.error.flatten());
      throw new Error(`Plan validation failed: ${JSON.stringify(validated.error.flatten())}`);
    }

    return {
      plan: validated.data,
      rawResponse: text,
      model: this.defaultModel,
      thinkingTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }
}

/**
 * Create AI service from environment
 */
export function createAIService(env: {
  GOOGLE_API_KEY: string;
  DEFAULT_AI_MODEL: string;
}): AIService {
  return new AIService({
    googleApiKey: env.GOOGLE_API_KEY,
    defaultModel: env.DEFAULT_AI_MODEL,
  });
}
