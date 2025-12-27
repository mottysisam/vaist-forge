#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "Parameters", createParameterLayout())
{
    // Initialize parameters
    rateParam = apvts.getRawParameterValue("rate");
    depthParam = apvts.getRawParameterValue("depth");
    feedbackParam = apvts.getRawParameterValue("feedback");
    mixParam = apvts.getRawParameterValue("mix");
    gainParam = apvts.getRawParameterValue("gain");
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

juce::AudioProcessorValueTreeState::ParameterLayout VAIstAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    layout.add(std::make_unique<juce::AudioParameterFloat>(
        "rate",
        "Rate",
        juce::NormalisableRange<float>(0.1f, 10.0f, 0.1f),
        1.0f
    ));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        "depth",
        "Depth",
        juce::NormalisableRange<float>(0.0f, 1.0f, 0.01f),
        0.5f
    ));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        "feedback",
        "Feedback",
        juce::NormalisableRange<float>(-0.95f, 0.95f, 0.01f),
        0.0f
    ));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        "mix",
        "Mix",
        juce::NormalisableRange<float>(0.0f, 1.0f, 0.01f),
        0.5f
    ));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        "gain",
        "Gain",
        juce::NormalisableRange<float>(0.0f, 1.0f, 0.01f),
        0.5f
    ));

    return layout;
}

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
    juce::ignoreUnused(samplesPerBlock);
    // Initialize default state
    gainSmoothed = 1.0f;
    this->sampleRate = sampleRate;
}

void VAIstAudioProcessor::releaseResources() {}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
   #if JucePlugin_IsMidiEffect
    juce::ignoreUnused (layouts);
    return true;
   #else
    // This is the place where you check if the layout is supported.
    // In this template code we only support mono or stereo.
    // Some more sophisticated code could be added here.
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    // This checks if the input layout matches the output layout
   #if ! JucePlugin_IsSynth
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
   #endif

    return true;
   #endif
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();

    // Read parameter values with defensive clamping
    const float rate = rateParam->load();
    const float depth = depthParam->load();
    const float feedback = feedbackParam->load();
    const float mix = mixParam->load();
    const float gain = gainParam->load();

    // DSP Processing
    // Convert dB to linear
    const float gainDb = gain * 48.0f - 24.0f;  // Range: -24.0 to +24.0 dB
    const float gainLinear = std::pow(10.0f, gainDb / 20.0f);

    // Smooth gain changes
    const float targetGain = gainLinear;
    gainSmoothed = gainSmoothed + (20.0f * 0.001f * static_cast<float>(sampleRate)) * (targetGain - gainSmoothed);
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
    return new VAIstAudioProcessorEditor(*this, apvts);
}

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));

    if (xmlState.get() != nullptr)
    {
        if (xmlState->hasTagName(apvts.state.getType()))
        {
            apvts.replaceState(juce::ValueTree::fromXml(*xmlState));
        }
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}