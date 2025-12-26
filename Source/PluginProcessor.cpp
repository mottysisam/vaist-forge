#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
    addParameter(rateHzParam = new juce::AudioParameterFloat(
        "rateHz",
        "Rate",
        0.1f,
        10.0f,
        1.0f
    ));
    addParameter(depthParam = new juce::AudioParameterFloat(
        "depth",
        "Depth",
        0.0f,
        1.0f,
        0.7f
    ));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        "feedback",
        "Feedback",
        -0.95f,
        0.95f,
        0.4f
    ));
    addParameter(mixParam = new juce::AudioParameterFloat(
        "mix",
        "Mix",
        0.0f,
        1.0f,
        0.5f
    ));
    addParameter(gainParam = new juce::AudioParameterFloat(
        "gain",
        "Gain",
        0.0f,
        1.0f,
        0.5f
    ));

    gainSmoothed = 0.0f;
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
    // No special initialization needed
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
    const float rateHz = rateHzParam->get();
    const float depth = depthParam->get();
    const float feedback = feedbackParam->get();
    const float mix = mixParam->get();
    const float gain = gainParam->get();

    // DSP Processing
    // Convert dB to linear
    const float gainDb = gain * 48.0f - 24.0f;  // Range: -24.0 to +24.0 dB
    const float gainLinear = std::pow(10.0f, gainDb / 20.0f);

    // Smooth gain changes
    const float targetGain = gainLinear;
    gainSmoothed = gainSmoothed + (20.0f * 0.001f * static_cast<float>(getSampleRate())) * (targetGain - gainSmoothed);
    const float smoothGain = gainSmoothed;

    // Apply gain to all channels
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);

        for (int sample = 0; sample < numSamples; ++sample)
        {
            channelData[sample] *= smoothGain;
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