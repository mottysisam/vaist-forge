#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(cutoff = new juce::AudioParameterFloat(
        "cutoff",       // Parameter ID
        "Cutoff",      // Display name
        20.0f,          // Minimum frequency
        20000.0f,       // Maximum frequency
        2000.0f         // Default frequency
    ));

    addParameter(resonance = new juce::AudioParameterFloat(
        "resonance",    // Parameter ID
        "Resonance",   // Display name
        0.1f,           // Minimum Q
        10.0f,          // Maximum Q
        1.0f            // Default Q
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

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    // Initialize DSP here
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = getTotalNumOutputChannels();

    leftFilter.prepare(spec);
    rightFilter.prepare(spec);

    updateFilter();
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

    updateFilter();

    juce::dsp::AudioBlock<float> block(buffer);
    leftFilter.process(juce::dsp::ProcessContextReplacing<float>(block.getSingleChannelBlock(0)));
    rightFilter.process(juce::dsp::ProcessContextReplacing<float>(block.getSingleChannelBlock(buffer.getNumChannels() > 1 ? 1 : 0)));
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    // Save state
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(*cutoff);
    stream.writeFloat(*resonance);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    // Load state
    juce::MemoryInputStream stream(data, sizeInBytes, false);
    *cutoff = stream.readFloat();
    *resonance = stream.readFloat();
}

void VAIstAudioProcessor::updateFilter() {
    float currentCutoff = *cutoff;
    float currentResonance = *resonance;

    *leftFilter.state = *juce::dsp::IIR::Coefficients<float>::makeLowPass(getSampleRate(), currentCutoff, currentResonance);
    *rightFilter.state = *juce::dsp::IIR::Coefficients<float>::makeLowPass(getSampleRate(), currentCutoff, currentResonance);
}


juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}