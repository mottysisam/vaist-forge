#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    driveAmountSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    driveAmountSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(driveAmountSlider);
    driveAmountAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getDriveAmountParam(), driveAmountSlider, nullptr);
    driveAmountLabel.setText("Drive", juce::dontSendNotification);
    driveAmountLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(driveAmountLabel);

    outputLevelSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    outputLevelSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(outputLevelSlider);
    outputLevelAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getOutputLevelParam(), outputLevelSlider, nullptr);
    outputLevelLabel.setText("Output", juce::dontSendNotification);
    outputLevelLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(outputLevelLabel);


    setSize(400, 220);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("WaveShaper", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto driveAmountArea = area.removeFromTop(60);
    driveAmountLabel.setBounds(driveAmountArea.removeFromTop(20));
    driveAmountSlider.setBounds(driveAmountArea);

    auto outputLevelArea = area.removeFromTop(60);
    outputLevelLabel.setBounds(outputLevelArea.removeFromTop(20));
    outputLevelSlider.setBounds(outputLevelArea);

}
