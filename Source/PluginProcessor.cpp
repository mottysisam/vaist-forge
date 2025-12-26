#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      sustainKnob(nullptr),
      sensitivityKnob(nullptr)
{
    addParameter(sustainKnob = new juce::AudioParameterFloat(
        "sustain",
        "Sustain",
        0.0f,
        1.0f,
        0.5f
    ));

    addParameter(sensitivityKnob = new juce::AudioParameterFloat(
        "sensitivity",
        "Sensitivity",
        0.0f,
        1.0f,
        0.5f
    ));

    compressor.setThreshold(-12.0f);
    compressor.setAttack(5.0f);
    compressor.setRelease(50.0f);

    gain.setGainDecibels(0.0f);
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

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    compressor.prepare({ sampleRate, static_cast<juce::uint32>(samplesPerBlock), (juce::uint32)getTotalNumOutputChannels() });
    gain.prepare({ sampleRate, static_cast<juce::uint32>(samplesPerBlock), (juce::uint32)getTotalNumOutputChannels() });

    lastSampleRate = sampleRate;
}

void VAIstAudioProcessor::releaseResources() {}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) {
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    float currentSustain = sustainKnob->get();
    float currentSensitivity = sensitivityKnob->get();

    compressor.setRatio(1.0f + (currentSustain * 9.0f)); // Ratio from 1:1 to 10:1
    gain.setGainDecibels(currentSustain * 24.0f); // Makeup gain up to 24dB

    // Convert sensitivity (0-1) to a time in milliseconds (e.g., 1ms to 100ms)
    float attackReleaseTimeMs = juce::jmap(currentSensitivity, 0.0f, 1.0f, 1.0f, 100.0f);
    compressor.setAttack(attackReleaseTimeMs); // Attack time
    compressor.setRelease(attackReleaseTimeMs * 2.0f); // Release time (twice the attack)


    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> context(block);

    compressor.process(context);
    gain.process(context);
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(sustainKnob->get());
    stream.writeFloat(sensitivityKnob->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    sustainKnob->setValueNotifyingHost(stream.readFloat());
    sensitivityKnob->setValueNotifyingHost(stream.readFloat());
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}