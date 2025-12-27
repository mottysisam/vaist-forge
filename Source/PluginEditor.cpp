#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    gainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    gainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(gainSlider);
    gainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getGainParam(), gainSlider, nullptr);
    gainLabel.setText("Gain", juce::dontSendNotification);
    gainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(gainLabel);

    inputLevelSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    inputLevelSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(inputLevelSlider);
    inputLevelAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getInputLevelParam(), inputLevelSlider, nullptr);
    inputLevelLabel.setText("Input Level", juce::dontSendNotification);
    inputLevelLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(inputLevelLabel);

    outputLevelSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    outputLevelSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(outputLevelSlider);
    outputLevelAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getOutputLevelParam(), outputLevelSlider, nullptr);
    outputLevelLabel.setText("Output Level", juce::dontSendNotification);
    outputLevelLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(outputLevelLabel);


    setSize(400, 280);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("GainMaster", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto gainArea = area.removeFromTop(60);
    gainLabel.setBounds(gainArea.removeFromTop(20));
    gainSlider.setBounds(gainArea);

    auto inputLevelArea = area.removeFromTop(60);
    inputLevelLabel.setBounds(inputLevelArea.removeFromTop(20));
    inputLevelSlider.setBounds(inputLevelArea);

    auto outputLevelArea = area.removeFromTop(60);
    outputLevelLabel.setBounds(outputLevelArea.removeFromTop(20));
    outputLevelSlider.setBounds(outputLevelArea);

}
