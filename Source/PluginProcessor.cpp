#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
    addParameter(delayTimeParam = new juce::AudioParameterFloat(
        "delayTime",
        "Delay Time",
        0.01f,
        1.0f,
        0.3f
    ));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        "feedback",
        "Feedback",
        0.0f,
        0.95f,
        0.5f
    ));
    addParameter(mixParam = new juce::AudioParameterFloat(
        "mix",
        "Mix",
        0.0f,
        1.0f,
        0.5f
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
    // Initialize delay buffer
    bufferSize = static_cast<int>(sampleRate * 1.0 + 1);
    delayBuffer.setSize(2, bufferSize);
    delayBuffer.clear();
    writePosition[0] = 0;
    writePosition[1] = 0;
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

    // Read parameter values with defensive clamping
        const float delayTime = delayTimeParam->get();
        const float feedback = feedbackParam->get();
        const float mix = mixParam->get();

    // DSP Processing
        // Calculate delay in samples
        const float delaySamples = delayTime * 1000.0f * 0.001f * static_cast<float>(getSampleRate());
        const int delayInt = static_cast<int>(delaySamples);
        const float delayFrac = delaySamples - static_cast<float>(delayInt);

        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);
            auto* delayData = delayBuffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float dry = channelData[sample];

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
