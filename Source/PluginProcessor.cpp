#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(delayTimeParam = new juce::AudioParameterFloat(
        juce::ParameterID{"delayTime", 1}, "Delay Time", 0.01f, 1.0f, 0.3f));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        juce::ParameterID{"feedback", 1}, "Feedback", 0.0f, 0.95f, 0.5f));
    addParameter(mixParam = new juce::AudioParameterFloat(
        juce::ParameterID{"mix", 1}, "Mix", 0.0f, 1.0f, 0.5f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 1.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;
    juce::ignoreUnused(samplesPerBlock);

    // Allocate delay buffer (max 2 seconds)
    int maxDelaySamples = static_cast<int>(sampleRate * 2.0);
    delayBuffer.setSize(2, maxDelaySamples);
    delayBuffer.clear();
    writePosition = 0;
}

void VAIstAudioProcessor::releaseResources()
{
    delayBuffer.setSize(0, 0);
}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter values
    float delayTime = delayTimeParam->get();
    float feedback = feedbackParam->get();
    float mix = mixParam->get();

    int delaySamples = static_cast<int>(delayTime * currentSampleRate);
    int bufferSize = delayBuffer.getNumSamples();

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        auto* delayData = delayBuffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            float dry = channelData[sample];
            float wet;

            // Calculate read position
            int readPos = writePosition - delaySamples;
            if (readPos < 0) readPos += bufferSize;

            // === AI_LOGIC_START ===
        float wetSample = delayData[readPos];
delayData[writePosition] = dry + (wetSample * feedback);
        // === AI_LOGIC_END ===

            // Mix dry/wet
            channelData[sample] = dry * (1.0f - mix) + wet * mix;

            // Advance write position
            writePosition = (writePosition + 1) % bufferSize;
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(delayTimeParam->get());
    stream.writeFloat(feedbackParam->get());
    stream.writeFloat(mixParam->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *delayTimeParam = stream.readFloat();
    *feedbackParam = stream.readFloat();
    *mixParam = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
