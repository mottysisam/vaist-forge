#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(gainParameter = new juce::AudioParameterFloat(
        juce::ParameterID{"gain", 1}, "Gain", 0.0f, 2.0f, 1.0f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
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

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter value
    float gain = gainParameter->get();

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            // === AI_LOGIC_START ===
        
    float gain = gainParameter->get();

    for (int channel = 0; channel < channelData.getNumChannels(); ++channel)
    {
        auto* channelSamples = channelData.getWritePointer(channel);
        
        for (int sample = 0; sample < numSamples; ++sample)
        {
            channelSamples[sample] *= gain;
        }
    }

        // === AI_LOGIC_END ===
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(gainParameter->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *gainParameter = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
