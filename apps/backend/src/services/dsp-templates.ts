/**
 * Shared DSP Templates
 *
 * CRITICAL: This is the single source of truth for all DSP algorithms.
 * Both cpp-generator.ts (JUCE) and wasm-generator.ts (WASM) MUST use these templates.
 *
 * This ensures:
 * 1. Mathematical parity between native and browser preview
 * 2. Single point of maintenance for DSP algorithms
 * 3. No "Logic Drift" between platforms
 *
 * The templates are platform-agnostic C++ that works with both:
 * - JUCE's juce::AudioBuffer<float>
 * - Vanilla float* buffers for WASM
 */

import type { PluginParameter } from '@vaist/shared';

// ============================================================================
// DSP Algorithm Templates (Platform-Agnostic C++)
// ============================================================================

/**
 * Waveshaper DSP - Tanh soft saturation
 * Identical coefficients for both JUCE and WASM
 */
export function generateWaveshaperDspCore(driveParam: string, mixParam: string): string {
  return `
                const float dry = inputSample;

                // Apply pre-gain based on drive (1x to 10x)
                const float preGain = 1.0f + ${driveParam} * 9.0f;
                const float driven = dry * preGain;

                // Tanh soft saturation (identical algorithm)
                const float shaped = std::tanh(driven);

                // Output compensation (fixed coefficient: 0.7)
                const float compensated = shaped * 0.7f;

                // Mix dry/wet
                outputSample = dry * (1.0f - ${mixParam}) + compensated * ${mixParam};`;
}

/**
 * Gain DSP - dB to linear conversion
 */
export function generateGainDspCore(gainParam: string): string {
  return `
                // Convert normalized parameter to dB (-24 to +12), then to linear
                const float gainDb = ${gainParam} * 36.0f - 24.0f;
                const float gainLinear = std::pow(10.0f, gainDb / 20.0f);
                outputSample = inputSample * gainLinear;`;
}

/**
 * Biquad Filter DSP - Lowpass with exact coefficient calculation
 * This is the most critical for mathematical parity
 */
export function generateFilterCoefficients(cutoffParam: string, qParam: string): string {
  return `
        // Map parameter to frequency range (20Hz - 20kHz, logarithmic)
        const float frequency = 20.0f * std::pow(1000.0f, ${cutoffParam});
        const float Q = 0.5f + ${qParam} * 9.5f;  // Range: 0.5 to 10

        // Calculate biquad coefficients (lowpass) - EXACT SAME MATH
        const double omega = 2.0 * M_PI * frequency / sampleRate;
        const double sinOmega = std::sin(omega);
        const double cosOmega = std::cos(omega);
        const double alpha = sinOmega / (2.0 * Q);

        // Lowpass filter coefficients (Cookbook formula)
        const double b0 = (1.0 - cosOmega) / 2.0;
        const double b1 = 1.0 - cosOmega;
        const double b2 = (1.0 - cosOmega) / 2.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;

        // Normalize coefficients
        const double a0Inv = 1.0 / a0;
        const float b0n = static_cast<float>(b0 * a0Inv);
        const float b1n = static_cast<float>(b1 * a0Inv);
        const float b2n = static_cast<float>(b2 * a0Inv);
        const float a1n = static_cast<float>(a1 * a0Inv);
        const float a2n = static_cast<float>(a2 * a0Inv);`;
}

/**
 * Biquad Filter DSP - Per-sample processing
 */
export function generateFilterSampleProcessing(): string {
  return `
                // Direct Form II Transposed (identical for both platforms)
                const float output = b0n * input + z1[channel];
                z1[channel] = b1n * input - a1n * output + z2[channel];
                z2[channel] = b2n * input - a2n * output;
                outputSample = output;`;
}

/**
 * Compressor DSP - Envelope follower with exact attack/release
 */
export function generateCompressorCore(
  thresholdParam: string,
  ratioParam: string,
  attackParam: string,
  releaseParam: string
): string {
  return `
        // Compressor coefficients (EXACT SAME calculation)
        const float thresholdDb = ${thresholdParam};
        const float ratioVal = ${ratioParam};
        const float attackMs = ${attackParam};
        const float releaseMs = ${releaseParam};

        const float attackCoeff = std::exp(-1.0f / (attackMs * 0.001f * sampleRate));
        const float releaseCoeff = std::exp(-1.0f / (releaseMs * 0.001f * sampleRate));`;
}

export function generateCompressorSampleProcessing(envelopeVar: string): string {
  return `
                const float inputAbs = std::abs(inputSample);

                // Convert to dB
                const float inputDb = 20.0f * std::log10(inputAbs + 1e-6f);

                // Calculate gain reduction
                float gainReductionDb = 0.0f;
                if (inputDb > thresholdDb) {
                    gainReductionDb = (inputDb - thresholdDb) * (1.0f - 1.0f / ratioVal);
                }

                // Apply envelope (identical smoothing)
                if (gainReductionDb > ${envelopeVar})
                    ${envelopeVar} = attackCoeff * ${envelopeVar} + (1.0f - attackCoeff) * gainReductionDb;
                else
                    ${envelopeVar} = releaseCoeff * ${envelopeVar} + (1.0f - releaseCoeff) * gainReductionDb;

                // Apply gain reduction
                const float gainLinear = std::pow(10.0f, -${envelopeVar} / 20.0f);
                outputSample = inputSample * gainLinear;`;
}

/**
 * Delay DSP - Linear interpolation with feedback
 */
export function generateDelayCore(
  timeParam: string,
  feedbackParam: string,
  mixParam: string
): string {
  return `
        // Delay time calculation (EXACT SAME)
        const float delaySamples = ${timeParam} * 1000.0f * 0.001f * sampleRate;
        const int delayInt = static_cast<int>(delaySamples);
        const float delayFrac = delaySamples - static_cast<float>(delayInt);`;
}

export function generateDelaySampleProcessing(
  feedbackParam: string,
  mixParam: string,
  delayBufferVar: string,
  writePositionVar: string,
  bufferSizeVar: string
): string {
  return `
                const float dry = inputSample;

                // Read from delay buffer with linear interpolation
                int readPos = ${writePositionVar} - delayInt;
                if (readPos < 0) readPos += ${bufferSizeVar};
                int readPos2 = readPos - 1;
                if (readPos2 < 0) readPos2 += ${bufferSizeVar};

                const float delayed = ${delayBufferVar}[readPos] * (1.0f - delayFrac)
                                     + ${delayBufferVar}[readPos2] * delayFrac;

                // Write to delay buffer with feedback (0.9 limiter to prevent runaway)
                ${delayBufferVar}[${writePositionVar}] = dry + delayed * ${feedbackParam} * 0.9f;

                // Increment write position
                ${writePositionVar} = (${writePositionVar} + 1) % ${bufferSizeVar};

                // Mix dry/wet
                outputSample = dry * (1.0f - ${mixParam}) + delayed * ${mixParam};`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find parameter by common names.
 * CRITICAL: Returns the first param's id as fallback to prevent undeclared identifier errors.
 */
export function findParamId(
  params: PluginParameter[],
  ...searchTerms: string[]
): string {
  for (const term of searchTerms) {
    const found = params.find((p) => p.id.toLowerCase().includes(term.toLowerCase()));
    if (found) return found.id;
  }
  // Fallback to first parameter if no match found (prevents undeclared identifier errors)
  if (params.length > 0) {
    console.warn(`[dsp-templates] No param found for [${searchTerms.join(', ')}], falling back to '${params[0].id}'`);
    return params[0].id;
  }
  // Last resort - should never happen if schema validation works
  throw new Error(`No parameters available and no match for [${searchTerms.join(', ')}]`);
}

/**
 * Output sanitization (prevents NaN/Inf) - IDENTICAL for both platforms
 */
export function generateOutputSanitization(): string {
  return `
            if (!std::isfinite(outputSample)) {
                outputSample = 0.0f;
            } else {
                outputSample = std::clamp(outputSample, -1.0f, 1.0f);
            }`;
}
