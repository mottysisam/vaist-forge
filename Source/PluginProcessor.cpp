#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Create the gain parameter (0.0 to 1.0, default 0.5)
    addParameter(gainParameter = new juce::AudioParameterFloat(
        "gain",           // Parameter ID
        "Gain",           // Parameter name
        0.0f,             // Minimum value
        1.0f,             // Maximum value
        0.5f              // Default value
    ));
}

VAIstAudioProcessor::~VAIstAudioProcessor()
{
}

//==============================================================================
const juce::String VAIstAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool VAIstAudioProcessor::acceptsMidi() const
{
    return false;
}

bool VAIstAudioProcessor::producesMidi() const
{
    return false;
}

bool VAIstAudioProcessor::isMidiEffect() const
{
    return false;
}

double VAIstAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int VAIstAudioProcessor::getNumPrograms()
{
    return 1;
}

int VAIstAudioProcessor::getCurrentProgram()
{
    return 0;
}

void VAIstAudioProcessor::setCurrentProgram(int index)
{
    juce::ignoreUnused(index);
}

const juce::String VAIstAudioProcessor::getProgramName(int index)
{
    juce::ignoreUnused(index);
    return {};
}

void VAIstAudioProcessor::changeProgramName(int index, const juce::String& newName)
{
    juce::ignoreUnused(index, newName);
}

//==============================================================================
void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
}

void VAIstAudioProcessor::releaseResources()
{
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

//==============================================================================
// THE CORE AUDIO PROCESSING - This is what the AI will generate
//==============================================================================
void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                        juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);

    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    // Clear any unused output channels
    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get the current gain value from the parameter
    const float gain = gainParameter->get();

    // ========================================================================
    // AI_DSP_LOGIC_START - Simple Gain Control
    // This is the "Hello World" of audio plugins
    // ========================================================================
    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);

        for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
        {
            channelData[sample] *= gain;
        }
    }
    // AI_DSP_LOGIC_END
    // ========================================================================
}

//==============================================================================
bool VAIstAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor()
{
    return new VAIstAudioProcessorEditor(*this);
}

//==============================================================================
void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    // Store parameter state
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(gainParameter->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    // Restore parameter state
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    gainParameter->setValueNotifyingHost(stream.readFloat());
}

//==============================================================================
// This creates new instances of the plugin
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
