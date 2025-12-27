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
        juce::NormalisableRange<float>(0.01f, 10.0f),
        0.5f
    ));
    addParameter(depthParam = new juce::AudioParameterFloat(
        juce::ParameterID("depth", 1),
        "Depth",
        juce::NormalisableRange<float>(0.0f, 100.0f),
        50.0f
    ));
    addParameter(manualDelayParam = new juce::AudioParameterFloat(
        juce::ParameterID("manualDelay", 1),
        "Manual",
        juce::NormalisableRange<float>(0.1f, 10.0f),
        2.0f
    ));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        juce::ParameterID("feedback", 1),
        "Feedback",
        juce::NormalisableRange<float>(-99.0f, 99.0f),
        40.0f
    ));
    addParameter(lfoWaveformParam = new juce::AudioParameterFloat(
        juce::ParameterID("lfoWaveform", 1),
        "LFO Shape",
        juce::NormalisableRange<float>(0.0f, 4.0f),
        0.0f
    ));
    addParameter(stereoPhaseParam = new juce::AudioParameterFloat(
        juce::ParameterID("stereoPhase", 1),
        "Stereo Phase",
        juce::NormalisableRange<float>(0.0f, 180.0f),
        90.0f
    ));
    addParameter(stereoWidthParam = new juce::AudioParameterFloat(
        juce::ParameterID("stereoWidth", 1),
        "Stereo Width",
        juce::NormalisableRange<float>(0.0f, 200.0f),
        100.0f
    ));
    addParameter(highpassFreqParam = new juce::AudioParameterFloat(
        juce::ParameterID("highpassFreq", 1),
        "HP Filter",
        juce::NormalisableRange<float>(20.0f, 2000.0f),
        20.0f
    ));
    addParameter(lowpassFreqParam = new juce::AudioParameterFloat(
        juce::ParameterID("lowpassFreq", 1),
        "LP Filter",
        juce::NormalisableRange<float>(1000.0f, 20000.0f),
        20000.0f
    ));
    addParameter(mixParam = new juce::AudioParameterFloat(
        juce::ParameterID("mix", 1),
        "Dry/Wet",
        juce::NormalisableRange<float>(0.0f, 100.0f),
        50.0f
    ));
    addParameter(outputGainParam = new juce::AudioParameterFloat(
        juce::ParameterID("outputGain", 1),
        "Output",
        juce::NormalisableRange<float>(-24.0f, 12.0f),
        0.0f
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
    // Initialize default state
    gainSmoothed = 1.0f;
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
        const float manualDelay = manualDelayParam->get();
        const float feedback = feedbackParam->get();
        const float lfoWaveform = lfoWaveformParam->get();
        const float stereoPhase = stereoPhaseParam->get();
        const float stereoWidth = stereoWidthParam->get();
        const float highpassFreq = highpassFreqParam->get();
        const float lowpassFreq = lowpassFreqParam->get();
        const float mix = mixParam->get();
        const float outputGain = outputGainParam->get();

    // DSP Processing
        // Passthrough for: modulation

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
