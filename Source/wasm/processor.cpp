#include "processor.h"

void VAIstProcessor::reset() {
        // No state to reset
}

void VAIstProcessor::process(float** buffers, int numChannels, int numSamples) {
    if (numChannels <= 0 || numSamples <= 0 || buffers == nullptr) return;

    // Limit channels to stereo
    numChannels = std::min(numChannels, 2);

    // DSP Processing
        // Passthrough for: flanger

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
