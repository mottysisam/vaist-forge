#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    amountSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    amountSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(amountSlider);
    amountAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getAmountParam(), amountSlider, nullptr);
    amountLabel.setText("Amount", juce::dontSendNotification);
    amountLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(amountLabel);

    warmthSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    warmthSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(warmthSlider);
    warmthAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getWarmthParam(), warmthSlider, nullptr);
    warmthLabel.setText("Warmth", juce::dontSendNotification);
    warmthLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(warmthLabel);

    mixSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(mixSlider);
    mixAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMixParam(), mixSlider, nullptr);
    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);


    setSize(400, 280);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("WarmSaturator", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto amountArea = area.removeFromTop(60);
    amountLabel.setBounds(amountArea.removeFromTop(20));
    amountSlider.setBounds(amountArea);

    auto warmthArea = area.removeFromTop(60);
    warmthLabel.setBounds(warmthArea.removeFromTop(20));
    warmthSlider.setBounds(warmthArea);

    auto mixArea = area.removeFromTop(60);
    mixLabel.setBounds(mixArea.removeFromTop(20));
    mixSlider.setBounds(mixArea);

}
