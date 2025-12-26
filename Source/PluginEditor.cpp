#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(400, 250);

    // Delay Time knob
    delaySlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    delaySlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    delaySlider.setRange(0.01, 1.0, 0.001);
    delaySlider.setValue(p.delayTimeParam->get());
    delaySlider.onValueChange = [this] {
        processorRef.delayTimeParam->setValueNotifyingHost(
            processorRef.delayTimeParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(delaySlider.getValue())));
    };
    addAndMakeVisible(delaySlider);

    delayLabel.setText("Time", juce::dontSendNotification);
    delayLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(delayLabel);

    // Feedback knob
    feedbackSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    feedbackSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    feedbackSlider.setRange(0.0, 0.95, 0.01);
    feedbackSlider.setValue(p.feedbackParam->get());
    feedbackSlider.onValueChange = [this] {
        processorRef.feedbackParam->setValueNotifyingHost(
            static_cast<float>(feedbackSlider.getValue() / 0.95));
    };
    addAndMakeVisible(feedbackSlider);

    feedbackLabel.setText("Feedback", juce::dontSendNotification);
    feedbackLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(feedbackLabel);

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
    g.drawFittedText("vAIst Delay", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);

    int knobWidth = area.getWidth() / 3;

    auto timeArea = area.removeFromLeft(knobWidth);
    delayLabel.setBounds(timeArea.removeFromTop(20));
    delaySlider.setBounds(timeArea.reduced(5));

    auto fbArea = area.removeFromLeft(knobWidth);
    feedbackLabel.setBounds(fbArea.removeFromTop(20));
    feedbackSlider.setBounds(fbArea.reduced(5));

    mixLabel.setBounds(area.removeFromTop(20));
    mixSlider.setBounds(area.reduced(5));
}
