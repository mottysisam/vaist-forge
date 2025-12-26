#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(cutoff = new juce::AudioParameterFloat(
        "cutoff",
        "Cutoff",
        20.0f,
        20000.0f,
        1000.0f
    ));

    addParameter(resonance = new juce::AudioParameterFloat(
        "resonance",
        "Resonance",
        0.0f,
        1.0f,
        0.707f
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
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = getTotalNumOutputChannels();

    filter.prepare(spec);
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
    filter.process(juce::dsp::ProcessContextReplacing<float>(block));
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(*cutoff);
    stream.writeFloat(*resonance);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    juce::MemoryInputStream stream(data, sizeInBytes, false);
    cutoff->setValueNotifyingHost(stream.readFloat());
    resonance->setValueNotifyingHost(stream.readFloat());
    updateFilter();
}

void VAIstAudioProcessor::updateFilter() {
    filter. coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass(
        getSampleRate(),
        *cutoff,
        *resonance
    );
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}

#include "PluginEditor.h"
#include "PluginProcessor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    juce::LookAndFeel::setDefaultLookAndFeel(&lookAndFeel);

    cutoffSlider.setSliderStyle(juce::Slider::SliderStyle::RotaryVerticalDrag);
    cutoffSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 100, 20);
    cutoffSlider.setRange(20.0, 20000.0, 0.1);
    cutoffSlider.setValue(processorRef.getCutoffParameter()->get());
    cutoffSlider.setSkewFactorFromMidPoint(1000.0);
    addAndMakeVisible(cutoffSlider);
    cutoffAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getCutoffParameter(),
        cutoffSlider,
        nullptr
    );

    resonanceSlider.setSliderStyle(juce::Slider::SliderStyle::RotaryVerticalDrag);
    resonanceSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 100, 20);
    resonanceSlider.setRange(0.0, 1.0, 0.01);
    resonanceSlider.setValue(processorRef.getResonanceParameter()->get());
    addAndMakeVisible(resonanceSlider);
    resonanceAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getResonanceParameter(),
        resonanceSlider,
        nullptr
    );

    cutoffLabel.setText("Cutoff", juce::dontSendNotification);
    cutoffLabel.attachToComponent(&cutoffSlider, false);
    cutoffLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(cutoffLabel);

    resonanceLabel.setText("Resonance", juce::dontSendNotification);
    resonanceLabel.attachToComponent(&resonanceSlider, false);
    resonanceLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(resonanceLabel);

    setSize(400, 300);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {
    juce::LookAndFeel::setDefaultLookAndFeel(nullptr);
}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(15.0f);
}

void VAIstAudioProcessorEditor::resized()
{
    cutoffSlider.setBounds(50, 50, 150, 150);
    resonanceSlider.setBounds(200, 50, 150, 150);
}