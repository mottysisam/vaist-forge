#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
    addParameter(rateParam = new juce::AudioParameterFloat(
        juce::ParameterID("rate", 1),
        "Rate",
        juce::NormalisableRange<float>(0.1f, 10.0f),
        1.0f
    ));
    addParameter(depthParam = new juce::AudioParameterFloat(
        juce::ParameterID("depth", 1),
        "Depth",
        juce::NormalisableRange<float>(0.0f, 100.0f),
        60.0f
    ));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        juce::ParameterID("feedback", 1),
        "Feedback",
        juce::NormalisableRange<float>(0.0f, 95.0f),
        40.0f
    ));
    addParameter(mixParam = new juce::AudioParameterFloat(
        juce::ParameterID("mix", 1),
        "Mix",
        juce::NormalisableRange<float>(0.0f, 100.0f),
        50.0f
    ));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int index) { juce::ignoreUnused(index); }
const juce::String VAIstAudioProcessor::getProgramName(int index) { juce::ignoreUnused(index); return {}; }
void VAIstAudioProcessor::changeProgramName(int index, const juce::String& newName) { juce::ignoreUnused(index, newName); }

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
    // Initialize flanger delay buffer (max 50ms for flanger)
    bufferSize = static_cast<int>(sampleRate * 0.05 + 1);
    delayBuffer.setSize(2, bufferSize);
    delayBuffer.clear();
    writePosition[0] = 0;
    writePosition[1] = 0;
    lfoPhase[0] = 0.0f;
    lfoPhase[1] = 0.25f;  // Stereo offset for wider sound
}

void VAIstAudioProcessor::releaseResources() {}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();

    // Read parameter values
        const float rate = rateParam->get();
        const float depth = depthParam->get();
        const float feedback = feedbackParam->get();
        const float mix = mixParam->get();

    // DSP Processing
        // Flanger processing (modulated delay with LFO)
        const float sampleRateFloat = static_cast<float>(getSampleRate());

        // Calculate LFO parameters
        const float lfoFreq = rate;  // LFO rate in Hz
        const float lfoPhaseInc = lfoFreq / sampleRateFloat;

        // Flanger delay range: 1-10ms modulated by LFO
        const float minDelay = 0.001f * sampleRateFloat;  // 1ms in samples
        const float maxDelay = 0.010f * sampleRateFloat;  // 10ms in samples
        const float delayRange = (maxDelay - minDelay) * depth;

        for (int channel = 0; channel < juce::jmin(buffer.getNumChannels(), 2); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);
            auto* delayData = delayBuffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float dry = channelData[sample];

                // Calculate modulated delay time using LFO
                const float lfoValue = 0.5f * (1.0f + std::sin(2.0f * juce::MathConstants<float>::pi * lfoPhase[channel]));
                const float delaySamples = minDelay + lfoValue * delayRange;
                const int delayInt = juce::jlimit(1, bufferSize - 2, static_cast<int>(delaySamples));
                const float delayFrac = delaySamples - static_cast<float>(delayInt);

                // Read from delay buffer with linear interpolation
                int readPos = writePosition[channel] - delayInt;
                if (readPos < 0) readPos += bufferSize;
                int readPos2 = readPos - 1;
                if (readPos2 < 0) readPos2 += bufferSize;

                const float delayed = delayData[readPos] * (1.0f - delayFrac) + delayData[readPos2] * delayFrac;

                // Write to delay buffer with feedback
                delayData[writePosition[channel]] = dry + delayed * feedback * 0.9f;

                // Increment write position
                writePosition[channel]++;
                if (writePosition[channel] >= bufferSize)
                    writePosition[channel] = 0;

                // Increment LFO phase
                lfoPhase[channel] += lfoPhaseInc;
                if (lfoPhase[channel] >= 1.0f)
                    lfoPhase[channel] -= 1.0f;

                // Mix dry/wet
                channelData[sample] = dry * (1.0f - mix) + delayed * mix;
            }
        }

    // Output sanitization: prevent NaN/Inf from reaching the host
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        for (int sample = 0; sample < numSamples; ++sample)
        {
            if (!std::isfinite(channelData[sample]))
                channelData[sample] = 0.0f;
            else
                channelData[sample] = juce::jlimit(-1.0f, 1.0f, channelData[sample]);
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }

juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor()
{
    return new VAIstAudioProcessorEditor(*this);
}

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::ignoreUnused(destData);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::ignoreUnused(data, sizeInBytes);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
