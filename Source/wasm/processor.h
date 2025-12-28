#ifndef VAIST_WASM_PROCESSOR_H
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
    void set_rate(float value) {
        rate = std::clamp(value, 0.01f, 10.0f);
    }

    void set_depth(float value) {
        depth = std::clamp(value, 0.0f, 100.0f);
    }

    void set_manual(float value) {
        manual = std::clamp(value, 0.1f, 15.0f);
    }

    void set_feedback(float value) {
        feedback = std::clamp(value, -95.0f, 95.0f);
    }

    void set_waveform(float value) {
        waveform = std::clamp(value, 0.0f, 3.0f);
    }

    void set_spread(float value) {
        spread = std::clamp(value, 0.0f, 180.0f);
    }

    void set_mix(float value) {
        mix = std::clamp(value, 0.0f, 100.0f);
    }

    // Parameter getters
    float get_rate() const { return rate; }
    float get_depth() const { return depth; }
    float get_manual() const { return manual; }
    float get_feedback() const { return feedback; }
    float get_waveform() const { return waveform; }
    float get_spread() const { return spread; }
    float get_mix() const { return mix; }

    float getSampleRate() const { return sampleRate; }

private:
    float sampleRate = 44100.0f;

    // Parameters
    float rate = 0.5f; // Range: 0.01 - 10
    float depth = 60.0f; // Range: 0 - 100
    float manual = 2.0f; // Range: 0.1 - 15
    float feedback = 40.0f; // Range: -95 - 95
    float waveform = 0.0f; // Range: 0 - 3
    float spread = 0.0f; // Range: 0 - 180
    float mix = 50.0f; // Range: 0 - 100

    // DSP State

};

#endif // VAIST_WASM_PROCESSOR_H
