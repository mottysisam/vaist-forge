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
    rateLabel.setText("LFO Rate", juce::dontSendNotification);
    rateLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(rateLabel);

    depthSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    depthSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(depthSlider);
    depthAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getDepthParam(), depthSlider, nullptr);
    depthLabel.setText("Mod Depth", juce::dontSendNotification);
    depthLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(depthLabel);

    manualSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    manualSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(manualSlider);
    manualAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getManualParam(), manualSlider, nullptr);
    manualLabel.setText("Center Delay", juce::dontSendNotification);
    manualLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(manualLabel);

    feedbackSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    feedbackSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(feedbackSlider);
    feedbackAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getFeedbackParam(), feedbackSlider, nullptr);
    feedbackLabel.setText("Feedback", juce::dontSendNotification);
    feedbackLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(feedbackLabel);

    waveformSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    waveformSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(waveformSlider);
    waveformAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getWaveformParam(), waveformSlider, nullptr);
    waveformLabel.setText("Waveform", juce::dontSendNotification);
    waveformLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(waveformLabel);

    offsetSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    offsetSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(offsetSlider);
    offsetAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getOffsetParam(), offsetSlider, nullptr);
    offsetLabel.setText("Stereo Offset", juce::dontSendNotification);
    offsetLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(offsetLabel);

    mixSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(mixSlider);
    mixAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMixParam(), mixSlider, nullptr);
    mixLabel.setText("Dry/Wet", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);


    setSize(400, 520);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("AdvancedFlangerGemini", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
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

    auto manualArea = area.removeFromTop(60);
    manualLabel.setBounds(manualArea.removeFromTop(20));
    manualSlider.setBounds(manualArea);

    auto feedbackArea = area.removeFromTop(60);
    feedbackLabel.setBounds(feedbackArea.removeFromTop(20));
    feedbackSlider.setBounds(feedbackArea);

    auto waveformArea = area.removeFromTop(60);
    waveformLabel.setBounds(waveformArea.removeFromTop(20));
    waveformSlider.setBounds(waveformArea);

    auto offsetArea = area.removeFromTop(60);
    offsetLabel.setBounds(offsetArea.removeFromTop(20));
    offsetSlider.setBounds(offsetArea);

    auto mixArea = area.removeFromTop(60);
    mixLabel.setBounds(mixArea.removeFromTop(20));
    mixSlider.setBounds(mixArea);

}
