#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(cutoffFrequency = new juce::AudioParameterFloat(
        "cutoff", "Cutoff Frequency",
        20.0f, 20000.0f, 2000.0f));

    addParameter(resonance = new juce::AudioParameterFloat(
        "resonance", "Resonance",
        0.1f, 10.0f, 1.0f));
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
    stream.writeFloat(*cutoffFrequency);
    stream.writeFloat(*resonance);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    juce::MemoryInputStream stream(data, sizeInBytes, false);
    *cutoffFrequency = stream.readFloat();
    *resonance = stream.readFloat();
}

void VAIstAudioProcessor::updateFilter()
{
    float cutoff = *cutoffFrequency;
    float res = *resonance;

    filter.state = juce::dsp::IIR::Coefficients<float>::makeLowPass(
        getSampleRate(), cutoff, res);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}

#include "PluginEditor.h"
#include "PluginProcessor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    juce::ignoreUnused(processorRef);

    cutoffSlider.setSliderStyle(juce::Slider::SliderStyle::RotaryVerticalDrag);
    cutoffSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 75, 20);
    cutoffSlider.setRange(20.0, 20000.0, 0.1);
    cutoffSlider.setValue(2000.0);
    cutoffSlider.setTextValueSuffix(" Hz");
    addAndMakeVisible(cutoffSlider);
    cutoffAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.cutoffFrequency, cutoffSlider, nullptr);

    resonanceSlider.setSliderStyle(juce::Slider::SliderStyle::RotaryVerticalDrag);
    resonanceSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 75, 20);
    resonanceSlider.setRange(0.1, 10.0, 0.01);
    resonanceSlider.setValue(1.0);
    addAndMakeVisible(resonanceSlider);
    resonanceAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.resonance, resonanceSlider, nullptr);

    setSize(400, 300);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));

    g.setColour(juce::Colours::white);
    g.setFont(15.0f);
    g.drawFittedText("Cutoff", cutoffSlider.getX(), cutoffSlider.getY() - 20, cutoffSlider.getWidth(), 20, juce::Justification::centred, 1);
    g.drawFittedText("Resonance", resonanceSlider.getX(), resonanceSlider.getY() - 20, resonanceSlider.getWidth(), 20, juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    cutoffSlider.setBounds(100, 100, 100, 100);
    resonanceSlider.setBounds(250, 100, 100, 100);
}