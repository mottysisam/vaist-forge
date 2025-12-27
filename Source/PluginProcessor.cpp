#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
    addParameter(masterGainParam = new juce::AudioParameterFloat(
        "masterGain",
        "Master Gain",
        -24f,
        24f,
        0f
    ));
    addParameter(masterWetParam = new juce::AudioParameterFloat(
        "masterWet",
        "Mix",
        0f,
        100f,
        100f
    ));
    addParameter(processingModeParam = new juce::AudioParameterFloat(
        "processingMode",
        "Processing Mode",
        0f,
        1f,
        0f
    ));
    addParameter(b1FreqParam = new juce::AudioParameterFloat(
        "b1Freq",
        "Band 1 Freq",
        20f,
        20000f,
        100f
    ));
    addParameter(b1GainParam = new juce::AudioParameterFloat(
        "b1Gain",
        "Band 1 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b1QParam = new juce::AudioParameterFloat(
        "b1Q",
        "Band 1 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b1DynParam = new juce::AudioParameterFloat(
        "b1Dyn",
        "Band 1 Dynamics",
        -1f,
        1f,
        0f
    ));
    addParameter(b1TypeParam = new juce::AudioParameterFloat(
        "b1Type",
        "Band 1 Type",
        0f,
        3f,
        0f
    ));
    addParameter(b2FreqParam = new juce::AudioParameterFloat(
        "b2Freq",
        "Band 2 Freq",
        20f,
        20000f,
        440f
    ));
    addParameter(b2GainParam = new juce::AudioParameterFloat(
        "b2Gain",
        "Band 2 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b2QParam = new juce::AudioParameterFloat(
        "b2Q",
        "Band 2 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b2DynParam = new juce::AudioParameterFloat(
        "b2Dyn",
        "Band 2 Dynamics",
        -1f,
        1f,
        0f
    ));
    addParameter(b3FreqParam = new juce::AudioParameterFloat(
        "b3Freq",
        "Band 3 Freq",
        20f,
        20000f,
        1000f
    ));
    addParameter(b3GainParam = new juce::AudioParameterFloat(
        "b3Gain",
        "Band 3 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b3QParam = new juce::AudioParameterFloat(
        "b3Q",
        "Band 3 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b3DynParam = new juce::AudioParameterFloat(
        "b3Dyn",
        "Band 3 Dynamics",
        -1f,
        1f,
        0f
    ));
    addParameter(b4FreqParam = new juce::AudioParameterFloat(
        "b4Freq",
        "Band 4 Freq",
        20f,
        20000f,
        2500f
    ));
    addParameter(b4GainParam = new juce::AudioParameterFloat(
        "b4Gain",
        "Band 4 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b4QParam = new juce::AudioParameterFloat(
        "b4Q",
        "Band 4 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b4DynParam = new juce::AudioParameterFloat(
        "b4Dyn",
        "Band 4 Dynamics",
        -1f,
        1f,
        0f
    ));
    addParameter(b5FreqParam = new juce::AudioParameterFloat(
        "b5Freq",
        "Band 5 Freq",
        20f,
        20000f,
        5000f
    ));
    addParameter(b5GainParam = new juce::AudioParameterFloat(
        "b5Gain",
        "Band 5 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b5QParam = new juce::AudioParameterFloat(
        "b5Q",
        "Band 5 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b5DynParam = new juce::AudioParameterFloat(
        "b5Dyn",
        "Band 5 Dynamics",
        -1f,
        1f,
        0f
    ));
    addParameter(b6FreqParam = new juce::AudioParameterFloat(
        "b6Freq",
        "Band 6 Freq",
        20f,
        20000f,
        12000f
    ));
    addParameter(b6GainParam = new juce::AudioParameterFloat(
        "b6Gain",
        "Band 6 Gain",
        -18f,
        18f,
        0f
    ));
    addParameter(b6QParam = new juce::AudioParameterFloat(
        "b6Q",
        "Band 6 Q",
        0.1f,
        10f,
        0.7f
    ));
    addParameter(b6DynParam = new juce::AudioParameterFloat(
        "b6Dyn",
        "Band 6 Dynamics",
        -1f,
        1f,
        0f
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
    // Initialize filter state
    for (int i = 0; i < 2; ++i)
    {
        z1[i] = 0.0f;
        z2[i] = 0.0f;
    }
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
        const float masterGain = masterGainParam->get();
        const float masterWet = masterWetParam->get();
        const float processingMode = processingModeParam->get();
        const float b1Freq = b1FreqParam->get();
        const float b1Gain = b1GainParam->get();
        const float b1Q = b1QParam->get();
        const float b1Dyn = b1DynParam->get();
        const float b1Type = b1TypeParam->get();
        const float b2Freq = b2FreqParam->get();
        const float b2Gain = b2GainParam->get();
        const float b2Q = b2QParam->get();
        const float b2Dyn = b2DynParam->get();
        const float b3Freq = b3FreqParam->get();
        const float b3Gain = b3GainParam->get();
        const float b3Q = b3QParam->get();
        const float b3Dyn = b3DynParam->get();
        const float b4Freq = b4FreqParam->get();
        const float b4Gain = b4GainParam->get();
        const float b4Q = b4QParam->get();
        const float b4Dyn = b4DynParam->get();
        const float b5Freq = b5FreqParam->get();
        const float b5Gain = b5GainParam->get();
        const float b5Q = b5QParam->get();
        const float b5Dyn = b5DynParam->get();
        const float b6Freq = b6FreqParam->get();
        const float b6Gain = b6GainParam->get();
        const float b6Q = b6QParam->get();
        const float b6Dyn = b6DynParam->get();

    // DSP Processing
        // Passthrough for: Analyzer

        // Passthrough for: Envelope

        // Biquad filter processing
        const double sampleRate = getSampleRate();

        // Map parameter to frequency range (20Hz - 20kHz, logarithmic)
        const float frequency = 20.0f * std::pow(1000.0f, b1Freq);
        const float Q = 0.5f + b1Freq * 9.5f;  // Range: 0.5 to 10

        // Calculate biquad coefficients (lowpass)
        const double omega = 2.0 * juce::MathConstants<double>::pi * frequency / sampleRate;
        const double sinOmega = std::sin(omega);
        const double cosOmega = std::cos(omega);
        const double alpha = sinOmega / (2.0 * Q);

        // Lowpass filter coefficients
        const double b0 = (1.0 - cosOmega) / 2.0;
        const double b1 = 1.0 - cosOmega;
        const double b2 = (1.0 - cosOmega) / 2.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;

        // Normalize coefficients
        const double a0Inv = 1.0 / a0;
        const float b0n = static_cast<float>(b0 * a0Inv);
        const float b1n = static_cast<float>(b1 * a0Inv);
        const float b2n = static_cast<float>(b2 * a0Inv);
        const float a1n = static_cast<float>(a1 * a0Inv);
        const float a2n = static_cast<float>(a2 * a0Inv);

        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float input = channelData[sample];

                // Direct Form II Transposed
                const float output = b0n * input + z1[channel];
                z1[channel] = b1n * input - a1n * output + z2[channel];
                z2[channel] = b2n * input - a2n * output;

                channelData[sample] = output;
            }
        }

        // Gain stage
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);
            for (int sample = 0; sample < numSamples; ++sample)
            {
                // Convert dB to linear (assuming -24 to +12 dB range)
                const float gainDb = masterGain * 36.0f - 24.0f;
                const float gainLinear = std::pow(10.0f, gainDb / 20.0f);
                channelData[sample] *= gainLinear;
            }
        }

        // Wet/dry mixing is handled inline with effect processing
        // Mix parameter: mix

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
