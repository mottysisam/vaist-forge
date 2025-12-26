#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(300, 200);

    gainSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    gainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    gainSlider.setRange(0.0, 2.0, 0.01);
    gainSlider.setValue(p.getGainParameter()->get());
    gainSlider.onValueChange = [this] {
        processorRef.getGainParameter()->setValueNotifyingHost(
            processorRef.getGainParameter()->getNormalisableRange().convertTo0to1(
                static_cast<float>(gainSlider.getValue())));
    };
    addAndMakeVisible(gainSlider);

    gainLabel.setText("Gain", juce::dontSendNotification);
    gainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(gainLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Gain", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);
    gainLabel.setBounds(area.removeFromTop(20));
    gainSlider.setBounds(area.reduced(20));
}
