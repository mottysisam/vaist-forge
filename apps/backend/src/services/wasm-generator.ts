/**
 * vAIst WASM Code Generator
 *
 * Generates vanilla C++ code (no JUCE dependencies) for Emscripten compilation.
 * This enables browser-based plugin preview using Web Audio Modules (WAM).
 *
 * Key differences from cpp-generator.ts:
 * - No JUCE types - uses standard C++ types
 * - Simple float* buffers instead of juce::AudioBuffer
 * - Exports C functions for WASM/JavaScript interop
 * - AudioWorklet-compatible interface
 *
 * The generated code can be compiled with:
 *   emcc processor.cpp -o processor.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1
 */

import type { PluginPlan, PluginParameter, DspBlock } from '@vaist/shared';
import {
  generateWaveshaperDspCore,
  generateGainDspCore,
  generateFilterCoefficients,
  generateFilterSampleProcessing,
  generateCompressorCore,
  generateCompressorSampleProcessing,
  generateDelayCore,
  generateDelaySampleProcessing,
  generateOutputSanitization,
  findParamId,
} from './dsp-templates';

// ============================================================================
// Types for WASM Generation
// ============================================================================

export interface WasmGeneratedFiles {
  processorCpp: string;
  processorH: string;
  wasmBindings: string;
  wasmDescriptor: string;
}

// ============================================================================
// WASM Code Generator
// ============================================================================

export class WasmGenerator {
  /**
   * Format a number as a valid C++ float literal
   */
  static formatFloat(value: number): string {
    const str = value.toString();
    if (str.includes('.') || str.includes('e') || str.includes('E')) {
      return str + 'f';
    }
    return str + '.0f';
  }

  // ==========================================================================
  // Parameter Code Generation
  // ==========================================================================

  /**
   * Generate parameter struct members
   */
  static generateParameterMembers(params: PluginParameter[]): string {
    return params
      .map((p) => {
        const min = typeof p.min === 'number' ? p.min : 0;
        const max = typeof p.max === 'number' ? p.max : 1;
        const defaultVal = typeof p.default === 'number' ? p.default : 0.5;
        return `    float ${p.id} = ${this.formatFloat(defaultVal)}; // Range: ${min} - ${max}`;
      })
      .join('\n');
  }

  /**
   * Generate parameter setter functions
   */
  static generateParameterSetters(params: PluginParameter[]): string {
    return params
      .map((p) => {
        const min = typeof p.min === 'number' ? p.min : 0;
        const max = typeof p.max === 'number' ? p.max : 1;
        return `    void set_${p.id}(float value) {
        ${p.id} = std::clamp(value, ${this.formatFloat(min)}, ${this.formatFloat(max)});
    }`;
      })
      .join('\n\n');
  }

  /**
   * Generate parameter getter functions
   */
  static generateParameterGetters(params: PluginParameter[]): string {
    return params.map((p) => `    float get_${p.id}() const { return ${p.id}; }`).join('\n');
  }

  // ==========================================================================
  // DSP Code Generation (Vanilla C++)
  // ==========================================================================

  /**
   * Generate DSP processing code
   */
  static generateDspCode(blocks: DspBlock[], params: PluginParameter[]): string {
    const dspBlocks: string[] = [];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'gain':
          dspBlocks.push(this.generateGainDsp(params));
          break;
        case 'saturator':
        case 'waveshaper':
          dspBlocks.push(this.generateWaveshaperDsp(params));
          break;
        case 'filter':
          dspBlocks.push(this.generateFilterDsp(params));
          break;
        case 'delay':
          dspBlocks.push(this.generateDelayDsp(params));
          break;
        case 'compressor':
          dspBlocks.push(this.generateCompressorDsp(params));
          break;
        default:
          dspBlocks.push(`        // Passthrough for: ${block.type}`);
      }
    }

    return dspBlocks.join('\n\n');
  }

  static generateGainDsp(params: PluginParameter[]): string {
    const gainParam = findParamId(params, 'gain', 'output', 'volume');

    // Use shared DSP template for mathematical parity with JUCE version
    const dspCore = generateGainDspCore(gainParam);

    return `        // Gain stage (shared DSP template)
        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            for (int i = 0; i < numSamples; ++i) {
                float inputSample = channelData[i];
                float outputSample;
${dspCore}
${generateOutputSanitization()}
                channelData[i] = outputSample;
            }
        }`;
  }

  static generateWaveshaperDsp(params: PluginParameter[]): string {
    const driveParam = findParamId(params, 'drive');
    const mixParam = findParamId(params, 'mix');

    // Use shared DSP template for mathematical parity with JUCE version
    const dspCore = generateWaveshaperDspCore(driveParam, mixParam);

    return `        // Waveshaper processing (shared DSP template)
        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            for (int i = 0; i < numSamples; ++i) {
                float inputSample = channelData[i];
                float outputSample;
${dspCore}
${generateOutputSanitization()}
                channelData[i] = outputSample;
            }
        }`;
  }

  static generateFilterDsp(params: PluginParameter[]): string {
    const cutoffParam = findParamId(params, 'cutoff', 'freq', 'frequency');
    const qParam = findParamId(params, 'q', 'resonance', 'res');

    // Use shared DSP template with double precision coefficients
    const coefficients = generateFilterCoefficients(cutoffParam, qParam);

    return `        // Biquad lowpass filter (shared DSP template - double precision coefficients)
${coefficients}

        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            float* z1 = &filterZ1[ch];
            float* z2 = &filterZ2[ch];
            int channel = 0;  // For template compatibility

            for (int i = 0; i < numSamples; ++i) {
                const float input = channelData[i];
                float outputSample;
${generateFilterSampleProcessing()}
${generateOutputSanitization()}
                channelData[i] = outputSample;
            }
        }`;
  }

  static generateDelayDsp(params: PluginParameter[]): string {
    const timeParam = findParamId(params, 'time', 'delay', 'delayTime');
    const feedbackParam = findParamId(params, 'feedback', 'fb');
    const mixParam = findParamId(params, 'mix', 'wet');

    // Use shared DSP template for delay calculation
    const delayCore = generateDelayCore(timeParam, feedbackParam, mixParam);

    return `        // Delay processing (shared DSP template)
${delayCore}

        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            float* delayBuf = delayBuffer[ch];
            int& writePos = delayWritePos[ch];
            const int bufSize = delayBufferSize;

            for (int i = 0; i < numSamples; ++i) {
                const float inputSample = channelData[i];
                float outputSample;
${generateDelaySampleProcessing(feedbackParam, mixParam, 'delayBuf', 'writePos', 'bufSize')}
${generateOutputSanitization()}
                channelData[i] = outputSample;
            }
        }`;
  }

  static generateCompressorDsp(params: PluginParameter[]): string {
    const thresholdParam = findParamId(params, 'threshold', 'thresh');
    const ratioParam = findParamId(params, 'ratio');
    const attackParam = findParamId(params, 'attack', 'att');
    const releaseParam = findParamId(params, 'release', 'rel');

    // Use shared DSP template for compressor
    const compCore = generateCompressorCore(thresholdParam, ratioParam, attackParam, releaseParam);

    return `        // Compressor processing (shared DSP template)
${compCore}

        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            float& envelope = compEnvelope[ch];

            for (int i = 0; i < numSamples; ++i) {
                const float inputSample = channelData[i];
                float outputSample;
${generateCompressorSampleProcessing('envelope')}
${generateOutputSanitization()}
                channelData[i] = outputSample;
            }
        }`;
  }

  // ==========================================================================
  // Member Variable Generation
  // ==========================================================================

  static generateMemberVariables(blocks: DspBlock[]): string {
    const vars: string[] = [];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'filter':
          vars.push('    float filterZ1[2] = {0.0f, 0.0f};');
          vars.push('    float filterZ2[2] = {0.0f, 0.0f};');
          break;
        case 'delay':
          vars.push('    static constexpr int delayBufferSize = 48000; // 1 second at 48kHz');
          vars.push('    float delayBuffer[2][delayBufferSize] = {};');
          vars.push('    int delayWritePos[2] = {0, 0};');
          break;
        case 'compressor':
          vars.push('    float compEnvelope[2] = {0.0f, 0.0f};');
          break;
      }
    }

    return vars.join('\n');
  }

  static generateResetCode(blocks: DspBlock[]): string {
    const resets: string[] = [];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'filter':
          resets.push(`        for (int ch = 0; ch < 2; ++ch) {
            filterZ1[ch] = 0.0f;
            filterZ2[ch] = 0.0f;
        }`);
          break;
        case 'delay':
          resets.push(`        for (int ch = 0; ch < 2; ++ch) {
            std::fill(std::begin(delayBuffer[ch]), std::end(delayBuffer[ch]), 0.0f);
            delayWritePos[ch] = 0;
        }`);
          break;
        case 'compressor':
          resets.push(`        for (int ch = 0; ch < 2; ++ch) {
            compEnvelope[ch] = 0.0f;
        }`);
          break;
      }
    }

    return resets.length > 0 ? resets.join('\n') : '        // No state to reset';
  }

  // ==========================================================================
  // Complete File Generation
  // ==========================================================================

  /**
   * Generate processor.h header file
   */
  static generateProcessorH(plan: PluginPlan): string {
    const paramMembers = this.generateParameterMembers(plan.parameters);
    const memberVars = this.generateMemberVariables(plan.dspBlocks);
    const setters = this.generateParameterSetters(plan.parameters);
    const getters = this.generateParameterGetters(plan.parameters);

    return `#ifndef VAIST_WASM_PROCESSOR_H
#define VAIST_WASM_PROCESSOR_H

#include <cmath>
#include <algorithm>
#include <cstring>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/**
 * vAIst WASM Audio Processor
 *
 * This is a vanilla C++ audio processor designed for Emscripten/WASM compilation.
 * No external dependencies (JUCE-free).
 *
 * Usage:
 *   VAIstProcessor processor;
 *   processor.prepare(48000.0f);
 *   processor.set_paramName(0.5f);
 *   processor.process(buffers, 2, 128);
 */
class VAIstProcessor {
public:
    VAIstProcessor() = default;
    ~VAIstProcessor() = default;

    /**
     * Prepare the processor for a given sample rate
     */
    void prepare(float sr) {
        sampleRate = sr;
        reset();
    }

    /**
     * Reset all internal state (filters, delays, etc.)
     */
    void reset();

    /**
     * Process audio buffers in-place
     * @param buffers Array of channel pointers (interleaved not supported)
     * @param numChannels Number of channels (typically 2)
     * @param numSamples Number of samples per channel
     */
    void process(float** buffers, int numChannels, int numSamples);

    // Parameter setters
${setters}

    // Parameter getters
${getters}

    float getSampleRate() const { return sampleRate; }

private:
    float sampleRate = 44100.0f;

    // Parameters
${paramMembers}

    // DSP State
${memberVars}
};

#endif // VAIST_WASM_PROCESSOR_H
`;
  }

  /**
   * Generate processor.cpp implementation file
   */
  static generateProcessorCpp(plan: PluginPlan): string {
    const dspCode = this.generateDspCode(plan.dspBlocks, plan.parameters);
    const resetCode = this.generateResetCode(plan.dspBlocks);

    return `#include "processor.h"

void VAIstProcessor::reset() {
${resetCode}
}

void VAIstProcessor::process(float** buffers, int numChannels, int numSamples) {
    if (numChannels <= 0 || numSamples <= 0 || buffers == nullptr) return;

    // Limit channels to stereo
    numChannels = std::min(numChannels, 2);

    // DSP Processing
${dspCode}

    // Output sanitization: prevent NaN/Inf
    for (int ch = 0; ch < numChannels; ++ch) {
        float* channelData = buffers[ch];
        for (int i = 0; i < numSamples; ++i) {
            if (!std::isfinite(channelData[i])) {
                channelData[i] = 0.0f;
            } else {
                channelData[i] = std::clamp(channelData[i], -1.0f, 1.0f);
            }
        }
    }
}
`;
  }

  /**
   * Generate Emscripten bindings for JavaScript interop
   */
  static generateWasmBindings(plan: PluginPlan): string {
    const paramSetters = plan.parameters
      .map((p) => `        .function("set_${p.id}", &VAIstProcessor::set_${p.id})`)
      .join('\n');

    const paramGetters = plan.parameters
      .map((p) => `        .function("get_${p.id}", &VAIstProcessor::get_${p.id})`)
      .join('\n');

    // Generate C-style exports with EMSCRIPTEN_KEEPALIVE
    const cSetters = plan.parameters
      .map((p) => `
EMSCRIPTEN_KEEPALIVE
void set_${p.id}(float value) {
    g_processor.set_${p.id}(value);
}`)
      .join('\n');

    const cGetters = plan.parameters
      .map((p) => `
EMSCRIPTEN_KEEPALIVE
float get_${p.id}() {
    return g_processor.get_${p.id}();
}`)
      .join('\n');

    return `/**
 * Emscripten Bindings for VAIstProcessor
 *
 * Uses EMSCRIPTEN_KEEPALIVE for C-style exports (compatible with AudioWorklet).
 * No dynamic allocation in process() - uses fixed memory layout.
 *
 * IMPORTANT: Call destroy() before loading a new WASM module to prevent
 * memory leaks from accumulated filter/delay states across refine iterations.
 *
 * Compile with:
 *   emcc processor.cpp bindings.cpp -o vaist-processor.js \\
 *     -s WASM=1 \\
 *     -s EXPORTED_FUNCTIONS='["_prepare","_reset","_destroy","_process",${plan.parameters.map(p => `"_set_${p.id}","_get_${p.id}"`).join(',')}]' \\
 *     -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \\
 *     -s ALLOW_MEMORY_GROWTH=0 \\
 *     -s INITIAL_MEMORY=1048576 \\
 *     -O3
 */

#include "processor.h"
#include <emscripten.h>

// Global processor instance (no dynamic allocation)
static VAIstProcessor g_processor;

// Flag to track if processor is initialized
static bool g_initialized = false;

extern "C" {

/**
 * Initialize the processor with sample rate
 */
EMSCRIPTEN_KEEPALIVE
void prepare(float sampleRate) {
    g_processor.prepare(sampleRate);
    g_initialized = true;
}

/**
 * Reset processor state (keeps processor alive, just clears DSP state)
 */
EMSCRIPTEN_KEEPALIVE
void reset() {
    g_processor.reset();
}

/**
 * Destroy processor state completely.
 * MUST be called before loading a new WASM module to prevent memory leaks.
 * This resets all internal state and marks processor as uninitialized.
 */
EMSCRIPTEN_KEEPALIVE
void destroy() {
    g_processor.reset();
    g_initialized = false;
    // Note: Since g_processor is static, we can't actually delete it.
    // But we reset all state to prevent accumulation across refines.
}

/**
 * Process audio buffers (fixed memory locations)
 *
 * Memory layout expected by AudioWorklet:
 * - leftInPtr: byte offset to input left channel (128 floats)
 * - rightInPtr: byte offset to input right channel (128 floats)
 * - leftOutPtr: byte offset to output left channel (128 floats)
 * - rightOutPtr: byte offset to output right channel (128 floats)
 *
 * All offsets are in bytes (float = 4 bytes).
 * The worklet copies data to these locations before calling process().
 */
EMSCRIPTEN_KEEPALIVE
void process(int leftInPtr, int rightInPtr, int leftOutPtr, int rightOutPtr, int numSamples) {
    // Convert byte offsets to float pointers
    float* leftIn = reinterpret_cast<float*>(leftInPtr);
    float* rightIn = reinterpret_cast<float*>(rightInPtr);
    float* leftOut = reinterpret_cast<float*>(leftOutPtr);
    float* rightOut = reinterpret_cast<float*>(rightOutPtr);

    // Copy input to output (we process in-place on output buffers)
    for (int i = 0; i < numSamples; ++i) {
        leftOut[i] = leftIn[i];
        rightOut[i] = rightIn[i];
    }

    // Process the output buffers in-place
    float* buffers[2] = { leftOut, rightOut };
    g_processor.process(buffers, 2, numSamples);
}

// Parameter setters (C-style exports)
${cSetters}

// Parameter getters (C-style exports)
${cGetters}

} // extern "C"
`;
  }

  /**
   * Generate WAM descriptor JSON for the plugin
   */
  static generateWamDescriptor(plan: PluginPlan, pluginName: string): string {
    const parameters = plan.parameters.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type === 'choice' ? 'choice' : 'float',
      min: typeof p.min === 'number' ? p.min : 0,
      max: typeof p.max === 'number' ? p.max : 1,
      default: typeof p.default === 'number' ? p.default : 0.5,
      unit: p.unit || '',
      choices: p.choices || [],
    }));

    const descriptor = {
      name: pluginName,
      vendor: 'vAIst',
      version: '1.0.0',
      sdkVersion: '2.0.0',
      thumbnail: '',
      keywords: ['effect', 'audio', 'wasm'],
      isInstrument: false,
      description: plan.explanation,
      parameters,
    };

    return JSON.stringify(descriptor, null, 2);
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate all WASM files from a PluginPlan.
 */
export function generateWasmFromPlan(plan: PluginPlan, pluginName?: string): WasmGeneratedFiles {
  const name = pluginName || 'vAIst Plugin';

  return {
    processorH: WasmGenerator.generateProcessorH(plan),
    processorCpp: WasmGenerator.generateProcessorCpp(plan),
    wasmBindings: WasmGenerator.generateWasmBindings(plan),
    wasmDescriptor: WasmGenerator.generateWamDescriptor(plan, name),
  };
}
