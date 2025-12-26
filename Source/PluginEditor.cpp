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
    driveAmountLabel.setText("Drive Amount", juce::dontSendNotification);
    driveAmountLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(driveAmountLabel);

    mixSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(mixSlider);
    mixAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMixParam(), mixSlider, nullptr);
    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);


    setSize(400, 220);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("SoftDistortion", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto driveAmountArea = area.removeFromTop(60);
    driveAmountLabel.setBounds(driveAmountArea.removeFromTop(20));
    driveAmountSlider.setBounds(driveAmountArea);

    auto mixArea = area.removeFromTop(60);
    mixLabel.setBounds(mixArea.removeFromTop(20));
    mixSlider.setBounds(mixArea);

}
