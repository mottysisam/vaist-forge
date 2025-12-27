/**
 * Zod Schemas for Runtime Validation
 */

import * as z from 'zod';

// ============================================
// Plugin Parameter Schemas
// ============================================

export const pluginParameterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['float', 'int', 'bool', 'choice']),
  min: z.number().optional(),
  max: z.number().optional(),
  default: z.union([z.number(), z.boolean(), z.string()]),
  unit: z.string().optional(),
  choices: z.array(z.string()).optional(),
});

export const dspBlockSchema = z.object({
  type: z.string().min(1),
  description: z.string(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
});

export const pluginPlanSchema = z.object({
  explanation: z.string().min(10),
  parameters: z.array(pluginParameterSchema).min(1).max(32),
  dspBlocks: z.array(dspBlockSchema).min(1),
  architecture: z.enum(['mono', 'stereo', 'stereo_linked', 'mid_side']),
});

// ============================================
// API Request Schemas
// ============================================

export const createProjectSchema = z.object({
  prompt: z.string().min(10).max(5000),
});

export const generatePlanSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(10).max(5000),
});

export const refinePlanSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const approvePlanSchema = z.object({
  projectId: z.string().uuid(),
});

// ============================================
// Type Inference
// ============================================

export type PluginParameter = z.infer<typeof pluginParameterSchema>;
export type DspBlock = z.infer<typeof dspBlockSchema>;
export type PluginPlan = z.infer<typeof pluginPlanSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type RefinePlanInput = z.infer<typeof refinePlanSchema>;
export type ApprovePlanInput = z.infer<typeof approvePlanSchema>;
