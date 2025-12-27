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

    toneControlSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    toneControlSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(toneControlSlider);
    toneControlAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getToneControlParam(), toneControlSlider, nullptr);
    toneControlLabel.setText("Tone", juce::dontSendNotification);
    toneControlLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(toneControlLabel);

    volumeSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    volumeSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(volumeSlider);
    volumeAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getVolumeParam(), volumeSlider, nullptr);
    volumeLabel.setText("Volume", juce::dontSendNotification);
    volumeLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(volumeLabel);


    setSize(400, 280);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("RustyFuzz", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto driveAmountArea = area.removeFromTop(60);
    driveAmountLabel.setBounds(driveAmountArea.removeFromTop(20));
    driveAmountSlider.setBounds(driveAmountArea);

    auto toneControlArea = area.removeFromTop(60);
    toneControlLabel.setBounds(toneControlArea.removeFromTop(20));
    toneControlSlider.setBounds(toneControlArea);

    auto volumeArea = area.removeFromTop(60);
    volumeLabel.setBounds(volumeArea.removeFromTop(20));
    volumeSlider.setBounds(volumeArea);

}
