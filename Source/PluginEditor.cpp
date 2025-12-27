#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    gainAmountSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    gainAmountSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(gainAmountSlider);
    gainAmountAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getGainAmountParam(), gainAmountSlider, nullptr);
    gainAmountLabel.setText("Gain", juce::dontSendNotification);
    gainAmountLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(gainAmountLabel);

    outputLevelSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    outputLevelSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(outputLevelSlider);
    outputLevelAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getOutputLevelParam(), outputLevelSlider, nullptr);
    outputLevelLabel.setText("Level", juce::dontSendNotification);
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
    g.drawText("CleanBoost", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto gainAmountArea = area.removeFromTop(60);
    gainAmountLabel.setBounds(gainAmountArea.removeFromTop(20));
    gainAmountSlider.setBounds(gainAmountArea);

    auto outputLevelArea = area.removeFromTop(60);
    outputLevelLabel.setBounds(outputLevelArea.removeFromTop(20));
    outputLevelSlider.setBounds(outputLevelArea);

}
