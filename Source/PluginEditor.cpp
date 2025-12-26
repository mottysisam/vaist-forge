#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    panAmountSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    panAmountSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(panAmountSlider);
    panAmountAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getPanAmountParam(), panAmountSlider, nullptr);
    panAmountLabel.setText("Pan", juce::dontSendNotification);
    panAmountLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(panAmountLabel);


    setSize(400, 160);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("StereoPanner", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto panAmountArea = area.removeFromTop(60);
    panAmountLabel.setBounds(panAmountArea.removeFromTop(20));
    panAmountSlider.setBounds(panAmountArea);

}
