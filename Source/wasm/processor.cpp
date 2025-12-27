#include "processor.h"

void VAIstProcessor::reset() {
        for (int ch = 0; ch < 2; ++ch) {
            std::fill(std::begin(delayBuffer[ch]), std::end(delayBuffer[ch]), 0.0f);
            delayWritePos[ch] = 0;
        }
}

void VAIstProcessor::process(float** buffers, int numChannels, int numSamples) {
    if (numChannels <= 0 || numSamples <= 0 || buffers == nullptr) return;

    // Limit channels to stereo
    numChannels = std::min(numChannels, 2);

    // DSP Processing
        // Passthrough for: Oscillator

        // Delay processing (shared DSP template)

        // Delay time calculation (EXACT SAME)
        const float delaySamples = time * 1000.0f * 0.001f * sampleRate;
        const int delayInt = static_cast<int>(delaySamples);
        const float delayFrac = delaySamples - static_cast<float>(delayInt);

        for (int ch = 0; ch < numChannels; ++ch) {
            float* channelData = buffers[ch];
            float* delayBuf = delayBuffer[ch];
            int& writePos = delayWritePos[ch];
            const int bufSize = delayBufferSize;

            for (int i = 0; i < numSamples; ++i) {
                const float inputSample = channelData[i];
                float outputSample;

                const float dry = inputSample;

                // Read from delay buffer with linear interpolation
                int readPos = writePos - delayInt;
                if (readPos < 0) readPos += bufSize;
                int readPos2 = readPos - 1;
                if (readPos2 < 0) readPos2 += bufSize;

                const float delayed = delayBuf[readPos] * (1.0f - delayFrac)
                                     + delayBuf[readPos2] * delayFrac;

                // Write to delay buffer with feedback (0.9 limiter to prevent runaway)
                delayBuf[writePos] = dry + delayed * feedback * 0.9f;

                // Increment write position
                writePos = (writePos + 1) % bufSize;

                // Mix dry/wet
                outputSample = dry * (1.0f - mix) + delayed * mix;

            if (!std::isfinite(outputSample)) {
                outputSample = 0.0f;
            } else {
                outputSample = std::clamp(outputSample, -1.0f, 1.0f);
            }
                channelData[i] = outputSample;
            }
        }

        // Passthrough for: Mixer

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
