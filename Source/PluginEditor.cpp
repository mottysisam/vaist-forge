#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(350, 250);

    // Drive knob
    driveSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    driveSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    driveSlider.setRange(1.0, 20.0, 0.1);
    driveSlider.setValue(p.driveParam->get());
    driveSlider.onValueChange = [this] {
        processorRef.driveParam->setValueNotifyingHost(
            processorRef.driveParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(driveSlider.getValue())));
    };
    addAndMakeVisible(driveSlider);

    driveLabel.setText("Drive", juce::dontSendNotification);
    driveLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(driveLabel);

    // Mix knob
    mixSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    mixSlider.setRange(0.0, 1.0, 0.01);
    mixSlider.setValue(p.mixParam->get());
    mixSlider.onValueChange = [this] {
        processorRef.mixParam->setValueNotifyingHost(
            static_cast<float>(mixSlider.getValue()));
    };
    addAndMakeVisible(mixSlider);

    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Distortion", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);

    auto knobArea = area;
    auto leftArea = knobArea.removeFromLeft(knobArea.getWidth() / 2);
    auto rightArea = knobArea;

    driveLabel.setBounds(leftArea.removeFromTop(20));
    driveSlider.setBounds(leftArea.reduced(10));

    mixLabel.setBounds(rightArea.removeFromTop(20));
    mixSlider.setBounds(rightArea.reduced(10));
}
