#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    rateSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    rateSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(rateSlider);
    rateAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getRateParam(), rateSlider, nullptr);
    rateLabel.setText("Rate", juce::dontSendNotification);
    rateLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(rateLabel);

    depthSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    depthSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(depthSlider);
    depthAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getDepthParam(), depthSlider, nullptr);
    depthLabel.setText("Depth", juce::dontSendNotification);
    depthLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(depthLabel);

    feedbackSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    feedbackSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(feedbackSlider);
    feedbackAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getFeedbackParam(), feedbackSlider, nullptr);
    feedbackLabel.setText("Feedback", juce::dontSendNotification);
    feedbackLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(feedbackLabel);

    manualDelaySlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    manualDelaySlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(manualDelaySlider);
    manualDelayAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getManualDelayParam(), manualDelaySlider, nullptr);
    manualDelayLabel.setText("Manual", juce::dontSendNotification);
    manualDelayLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(manualDelayLabel);

    lfoWaveformSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    lfoWaveformSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(lfoWaveformSlider);
    lfoWaveformAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getLfoWaveformParam(), lfoWaveformSlider, nullptr);
    lfoWaveformLabel.setText("LFO Shape", juce::dontSendNotification);
    lfoWaveformLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(lfoWaveformLabel);

    stereoPhaseSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    stereoPhaseSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(stereoPhaseSlider);
    stereoPhaseAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getStereoPhaseParam(), stereoPhaseSlider, nullptr);
    stereoPhaseLabel.setText("Stereo Phase", juce::dontSendNotification);
    stereoPhaseLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(stereoPhaseLabel);

    mixSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(mixSlider);
    mixAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMixParam(), mixSlider, nullptr);
    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);

    outputGainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    outputGainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(outputGainSlider);
    outputGainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getOutputGainParam(), outputGainSlider, nullptr);
    outputGainLabel.setText("Output", juce::dontSendNotification);
    outputGainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(outputGainLabel);


    setSize(400, 580);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("AdvancedFlangerOpus", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto rateArea = area.removeFromTop(60);
    rateLabel.setBounds(rateArea.removeFromTop(20));
    rateSlider.setBounds(rateArea);

    auto depthArea = area.removeFromTop(60);
    depthLabel.setBounds(depthArea.removeFromTop(20));
    depthSlider.setBounds(depthArea);

    auto feedbackArea = area.removeFromTop(60);
    feedbackLabel.setBounds(feedbackArea.removeFromTop(20));
    feedbackSlider.setBounds(feedbackArea);

    auto manualDelayArea = area.removeFromTop(60);
    manualDelayLabel.setBounds(manualDelayArea.removeFromTop(20));
    manualDelaySlider.setBounds(manualDelayArea);

    auto lfoWaveformArea = area.removeFromTop(60);
    lfoWaveformLabel.setBounds(lfoWaveformArea.removeFromTop(20));
    lfoWaveformSlider.setBounds(lfoWaveformArea);

    auto stereoPhaseArea = area.removeFromTop(60);
    stereoPhaseLabel.setBounds(stereoPhaseArea.removeFromTop(20));
    stereoPhaseSlider.setBounds(stereoPhaseArea);

    auto mixArea = area.removeFromTop(60);
    mixLabel.setBounds(mixArea.removeFromTop(20));
    mixSlider.setBounds(mixArea);

    auto outputGainArea = area.removeFromTop(60);
    outputGainLabel.setBounds(outputGainArea.removeFromTop(20));
    outputGainSlider.setBounds(outputGainArea);

}
