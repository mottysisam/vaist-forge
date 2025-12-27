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

    void set_manualDelay(float value) {
        manualDelay = std::clamp(value, 0.1f, 10.0f);
    }

    void set_feedback(float value) {
        feedback = std::clamp(value, -99.0f, 99.0f);
    }

    void set_lfoWaveform(float value) {
        lfoWaveform = std::clamp(value, 0.0f, 4.0f);
    }

    void set_stereoPhase(float value) {
        stereoPhase = std::clamp(value, 0.0f, 180.0f);
    }

    void set_stereoWidth(float value) {
        stereoWidth = std::clamp(value, 0.0f, 200.0f);
    }

    void set_highpassFreq(float value) {
        highpassFreq = std::clamp(value, 20.0f, 2000.0f);
    }

    void set_lowpassFreq(float value) {
        lowpassFreq = std::clamp(value, 1000.0f, 20000.0f);
    }

    void set_mix(float value) {
        mix = std::clamp(value, 0.0f, 100.0f);
    }

    void set_outputGain(float value) {
        outputGain = std::clamp(value, -24.0f, 12.0f);
    }

    // Parameter getters
    float get_rate() const { return rate; }
    float get_depth() const { return depth; }
    float get_manualDelay() const { return manualDelay; }
    float get_feedback() const { return feedback; }
    float get_lfoWaveform() const { return lfoWaveform; }
    float get_stereoPhase() const { return stereoPhase; }
    float get_stereoWidth() const { return stereoWidth; }
    float get_highpassFreq() const { return highpassFreq; }
    float get_lowpassFreq() const { return lowpassFreq; }
    float get_mix() const { return mix; }
    float get_outputGain() const { return outputGain; }

    float getSampleRate() const { return sampleRate; }

private:
    float sampleRate = 44100.0f;

    // Parameters
    float rate = 0.5f; // Range: 0.01 - 10
    float depth = 50.0f; // Range: 0 - 100
    float manualDelay = 2.0f; // Range: 0.1 - 10
    float feedback = 40.0f; // Range: -99 - 99
    float lfoWaveform = 0.0f; // Range: 0 - 4
    float stereoPhase = 90.0f; // Range: 0 - 180
    float stereoWidth = 100.0f; // Range: 0 - 200
    float highpassFreq = 20.0f; // Range: 20 - 2000
    float lowpassFreq = 20000.0f; // Range: 1000 - 20000
    float mix = 50.0f; // Range: 0 - 100
    float outputGain = 0.0f; // Range: -24 - 12

    // DSP State

};

#endif // VAIST_WASM_PROCESSOR_H
