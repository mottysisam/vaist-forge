#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
    addParameter(driveAmountParam = new juce::AudioParameterFloat(
        "driveAmount",
        "Drive",
        0.0f,
        1.0f,
        0.5f
    ));
    addParameter(outputLevelParam = new juce::AudioParameterFloat(
        "outputLevel",
        "Output",
        0.0f,
        1.0f,
        0.5f
    ));
    addParameter(mixParam = new juce::AudioParameterFloat(
        "mix",
        "Mix",
        0.0f,
        1.0f,
        1.0f
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

    // Read parameter values with defensive clamping
        const float driveAmount = driveAmountParam->get();
        const float outputLevel = outputLevelParam->get();
        const float mix = mixParam->get();

    // DSP Processing
        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float dry = channelData[sample];

                // Apply pre-gain based on drive
                const float preGain = 1.0f + driveAmount * 5.0f;
                const float driven = dry * preGain;

                // Apply waveshaping function
                // Soft clip (cubic)
                float shaped;
                if (driven > 1.0f)
                    shaped = 0.666667f;
                else if (driven < -1.0f)
                    shaped = -0.666667f;
                else
                    shaped = driven - (driven * driven * driven) / 3.0f;

                // Output compensation
                const float compensated = shaped * 0.7f;

                // Mix dry/wet
                channelData[sample] = dry * (1.0f - mix) + compensated * mix;
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
