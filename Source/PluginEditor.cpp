#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      cutoff(20.0f),
      sampleRate(44100.0)
{
    addParameter(cutoff = new juce::AudioParameterFloat(
        "cutoff",    // Parameter ID (lowercase, no spaces)
        "Cutoff",  // Display name
        20.0f,          // Minimum
        20000.0f,          // Maximum
        1000.0f           // Default
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
    this->sampleRate = sampleRate;
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = getTotalNumOutputChannels();

    highPassFilter.reset();
    highPassFilter.prepare(spec);
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
    highPassFilter.process(juce::dsp::ProcessContextReplacing<float>(block));
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(*cutoff);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    cutoff->setValueNotifyingHost(stream.readFloat());
}

void VAIstAudioProcessor::updateFilter()
{
    highPassFilter.state = *juce::dsp::IIR::Coefficients<float>::makeHighPass(sampleRate, *cutoff);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}

#include "PluginEditor.h"
#include "PluginProcessor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    juce::LookAndFeel::setDefaultLookAndFeel (&lookAndFeel);

    cutoffSlider.setSliderStyle(juce::Slider::SliderStyle::RotaryVerticalDrag);
    cutoffSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 100, 20);
    cutoffSlider.setRange(20.0, 20000.0, 1.0);
    cutoffSlider.setValue(processorRef.getCutoffValue());
    cutoffSlider.setSkewFactorFromMidPoint(1000.0);
    addAndMakeVisible(cutoffSlider);

    cutoffLabel.setText("Cutoff", juce::dontSendNotification);
    cutoffLabel.attachToComponent(&cutoffSlider, true);
    cutoffLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(cutoffLabel);

    cutoffAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getCutoffParameter(),
        cutoffSlider,
        nullptr
    );

    setSize(400, 300);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {
    juce::LookAndFeel::setDefaultLookAndFeel (nullptr);
}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colours::darkgrey);
    g.setColour(juce::Colours::white);
    g.setFont(15.0f);
}

void VAIstAudioProcessorEditor::resized()
{
    cutoffSlider.setBounds(getWidth() / 2 - 75, getHeight() / 2 - 75, 150, 150);
}