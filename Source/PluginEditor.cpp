#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
    masterGainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    masterGainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(masterGainSlider);
    masterGainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMasterGainParam(), masterGainSlider, nullptr);
    masterGainLabel.setText("Master Gain", juce::dontSendNotification);
    masterGainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(masterGainLabel);

    masterWetSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    masterWetSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(masterWetSlider);
    masterWetAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getMasterWetParam(), masterWetSlider, nullptr);
    masterWetLabel.setText("Mix", juce::dontSendNotification);
    masterWetLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(masterWetLabel);

    processingModeSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    processingModeSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(processingModeSlider);
    processingModeAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getProcessingModeParam(), processingModeSlider, nullptr);
    processingModeLabel.setText("Processing Mode", juce::dontSendNotification);
    processingModeLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(processingModeLabel);

    b1FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b1FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b1FreqSlider);
    b1FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB1FreqParam(), b1FreqSlider, nullptr);
    b1FreqLabel.setText("Band 1 Freq", juce::dontSendNotification);
    b1FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b1FreqLabel);

    b1GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b1GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b1GainSlider);
    b1GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB1GainParam(), b1GainSlider, nullptr);
    b1GainLabel.setText("Band 1 Gain", juce::dontSendNotification);
    b1GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b1GainLabel);

    b1QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b1QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b1QSlider);
    b1QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB1QParam(), b1QSlider, nullptr);
    b1QLabel.setText("Band 1 Q", juce::dontSendNotification);
    b1QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b1QLabel);

    b1DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b1DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b1DynSlider);
    b1DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB1DynParam(), b1DynSlider, nullptr);
    b1DynLabel.setText("Band 1 Dynamics", juce::dontSendNotification);
    b1DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b1DynLabel);

    b1TypeSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b1TypeSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b1TypeSlider);
    b1TypeAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB1TypeParam(), b1TypeSlider, nullptr);
    b1TypeLabel.setText("Band 1 Type", juce::dontSendNotification);
    b1TypeLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b1TypeLabel);

    b2FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b2FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b2FreqSlider);
    b2FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB2FreqParam(), b2FreqSlider, nullptr);
    b2FreqLabel.setText("Band 2 Freq", juce::dontSendNotification);
    b2FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b2FreqLabel);

    b2GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b2GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b2GainSlider);
    b2GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB2GainParam(), b2GainSlider, nullptr);
    b2GainLabel.setText("Band 2 Gain", juce::dontSendNotification);
    b2GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b2GainLabel);

    b2QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b2QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b2QSlider);
    b2QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB2QParam(), b2QSlider, nullptr);
    b2QLabel.setText("Band 2 Q", juce::dontSendNotification);
    b2QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b2QLabel);

    b2DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b2DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b2DynSlider);
    b2DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB2DynParam(), b2DynSlider, nullptr);
    b2DynLabel.setText("Band 2 Dynamics", juce::dontSendNotification);
    b2DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b2DynLabel);

    b3FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b3FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b3FreqSlider);
    b3FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB3FreqParam(), b3FreqSlider, nullptr);
    b3FreqLabel.setText("Band 3 Freq", juce::dontSendNotification);
    b3FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b3FreqLabel);

    b3GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b3GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b3GainSlider);
    b3GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB3GainParam(), b3GainSlider, nullptr);
    b3GainLabel.setText("Band 3 Gain", juce::dontSendNotification);
    b3GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b3GainLabel);

    b3QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b3QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b3QSlider);
    b3QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB3QParam(), b3QSlider, nullptr);
    b3QLabel.setText("Band 3 Q", juce::dontSendNotification);
    b3QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b3QLabel);

    b3DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b3DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b3DynSlider);
    b3DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB3DynParam(), b3DynSlider, nullptr);
    b3DynLabel.setText("Band 3 Dynamics", juce::dontSendNotification);
    b3DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b3DynLabel);

    b4FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b4FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b4FreqSlider);
    b4FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB4FreqParam(), b4FreqSlider, nullptr);
    b4FreqLabel.setText("Band 4 Freq", juce::dontSendNotification);
    b4FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b4FreqLabel);

    b4GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b4GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b4GainSlider);
    b4GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB4GainParam(), b4GainSlider, nullptr);
    b4GainLabel.setText("Band 4 Gain", juce::dontSendNotification);
    b4GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b4GainLabel);

    b4QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b4QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b4QSlider);
    b4QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB4QParam(), b4QSlider, nullptr);
    b4QLabel.setText("Band 4 Q", juce::dontSendNotification);
    b4QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b4QLabel);

    b4DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b4DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b4DynSlider);
    b4DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB4DynParam(), b4DynSlider, nullptr);
    b4DynLabel.setText("Band 4 Dynamics", juce::dontSendNotification);
    b4DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b4DynLabel);

    b5FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b5FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b5FreqSlider);
    b5FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB5FreqParam(), b5FreqSlider, nullptr);
    b5FreqLabel.setText("Band 5 Freq", juce::dontSendNotification);
    b5FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b5FreqLabel);

    b5GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b5GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b5GainSlider);
    b5GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB5GainParam(), b5GainSlider, nullptr);
    b5GainLabel.setText("Band 5 Gain", juce::dontSendNotification);
    b5GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b5GainLabel);

    b5QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b5QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b5QSlider);
    b5QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB5QParam(), b5QSlider, nullptr);
    b5QLabel.setText("Band 5 Q", juce::dontSendNotification);
    b5QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b5QLabel);

    b5DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b5DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b5DynSlider);
    b5DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB5DynParam(), b5DynSlider, nullptr);
    b5DynLabel.setText("Band 5 Dynamics", juce::dontSendNotification);
    b5DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b5DynLabel);

    b6FreqSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b6FreqSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b6FreqSlider);
    b6FreqAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB6FreqParam(), b6FreqSlider, nullptr);
    b6FreqLabel.setText("Band 6 Freq", juce::dontSendNotification);
    b6FreqLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b6FreqLabel);

    b6GainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b6GainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b6GainSlider);
    b6GainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB6GainParam(), b6GainSlider, nullptr);
    b6GainLabel.setText("Band 6 Gain", juce::dontSendNotification);
    b6GainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b6GainLabel);

    b6QSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b6QSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b6QSlider);
    b6QAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB6QParam(), b6QSlider, nullptr);
    b6QLabel.setText("Band 6 Q", juce::dontSendNotification);
    b6QLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b6QLabel);

    b6DynSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    b6DynSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(b6DynSlider);
    b6DynAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getB6DynParam(), b6DynSlider, nullptr);
    b6DynLabel.setText("Band 6 Dynamics", juce::dontSendNotification);
    b6DynLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(b6DynLabel);


    setSize(400, 1780);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("PleaseCreateFabfilter", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

    auto masterGainArea = area.removeFromTop(60);
    masterGainLabel.setBounds(masterGainArea.removeFromTop(20));
    masterGainSlider.setBounds(masterGainArea);

    auto masterWetArea = area.removeFromTop(60);
    masterWetLabel.setBounds(masterWetArea.removeFromTop(20));
    masterWetSlider.setBounds(masterWetArea);

    auto processingModeArea = area.removeFromTop(60);
    processingModeLabel.setBounds(processingModeArea.removeFromTop(20));
    processingModeSlider.setBounds(processingModeArea);

    auto b1FreqArea = area.removeFromTop(60);
    b1FreqLabel.setBounds(b1FreqArea.removeFromTop(20));
    b1FreqSlider.setBounds(b1FreqArea);

    auto b1GainArea = area.removeFromTop(60);
    b1GainLabel.setBounds(b1GainArea.removeFromTop(20));
    b1GainSlider.setBounds(b1GainArea);

    auto b1QArea = area.removeFromTop(60);
    b1QLabel.setBounds(b1QArea.removeFromTop(20));
    b1QSlider.setBounds(b1QArea);

    auto b1DynArea = area.removeFromTop(60);
    b1DynLabel.setBounds(b1DynArea.removeFromTop(20));
    b1DynSlider.setBounds(b1DynArea);

    auto b1TypeArea = area.removeFromTop(60);
    b1TypeLabel.setBounds(b1TypeArea.removeFromTop(20));
    b1TypeSlider.setBounds(b1TypeArea);

    auto b2FreqArea = area.removeFromTop(60);
    b2FreqLabel.setBounds(b2FreqArea.removeFromTop(20));
    b2FreqSlider.setBounds(b2FreqArea);

    auto b2GainArea = area.removeFromTop(60);
    b2GainLabel.setBounds(b2GainArea.removeFromTop(20));
    b2GainSlider.setBounds(b2GainArea);

    auto b2QArea = area.removeFromTop(60);
    b2QLabel.setBounds(b2QArea.removeFromTop(20));
    b2QSlider.setBounds(b2QArea);

    auto b2DynArea = area.removeFromTop(60);
    b2DynLabel.setBounds(b2DynArea.removeFromTop(20));
    b2DynSlider.setBounds(b2DynArea);

    auto b3FreqArea = area.removeFromTop(60);
    b3FreqLabel.setBounds(b3FreqArea.removeFromTop(20));
    b3FreqSlider.setBounds(b3FreqArea);

    auto b3GainArea = area.removeFromTop(60);
    b3GainLabel.setBounds(b3GainArea.removeFromTop(20));
    b3GainSlider.setBounds(b3GainArea);

    auto b3QArea = area.removeFromTop(60);
    b3QLabel.setBounds(b3QArea.removeFromTop(20));
    b3QSlider.setBounds(b3QArea);

    auto b3DynArea = area.removeFromTop(60);
    b3DynLabel.setBounds(b3DynArea.removeFromTop(20));
    b3DynSlider.setBounds(b3DynArea);

    auto b4FreqArea = area.removeFromTop(60);
    b4FreqLabel.setBounds(b4FreqArea.removeFromTop(20));
    b4FreqSlider.setBounds(b4FreqArea);

    auto b4GainArea = area.removeFromTop(60);
    b4GainLabel.setBounds(b4GainArea.removeFromTop(20));
    b4GainSlider.setBounds(b4GainArea);

    auto b4QArea = area.removeFromTop(60);
    b4QLabel.setBounds(b4QArea.removeFromTop(20));
    b4QSlider.setBounds(b4QArea);

    auto b4DynArea = area.removeFromTop(60);
    b4DynLabel.setBounds(b4DynArea.removeFromTop(20));
    b4DynSlider.setBounds(b4DynArea);

    auto b5FreqArea = area.removeFromTop(60);
    b5FreqLabel.setBounds(b5FreqArea.removeFromTop(20));
    b5FreqSlider.setBounds(b5FreqArea);

    auto b5GainArea = area.removeFromTop(60);
    b5GainLabel.setBounds(b5GainArea.removeFromTop(20));
    b5GainSlider.setBounds(b5GainArea);

    auto b5QArea = area.removeFromTop(60);
    b5QLabel.setBounds(b5QArea.removeFromTop(20));
    b5QSlider.setBounds(b5QArea);

    auto b5DynArea = area.removeFromTop(60);
    b5DynLabel.setBounds(b5DynArea.removeFromTop(20));
    b5DynSlider.setBounds(b5DynArea);

    auto b6FreqArea = area.removeFromTop(60);
    b6FreqLabel.setBounds(b6FreqArea.removeFromTop(20));
    b6FreqSlider.setBounds(b6FreqArea);

    auto b6GainArea = area.removeFromTop(60);
    b6GainLabel.setBounds(b6GainArea.removeFromTop(20));
    b6GainSlider.setBounds(b6GainArea);

    auto b6QArea = area.removeFromTop(60);
    b6QLabel.setBounds(b6QArea.removeFromTop(20));
    b6QSlider.setBounds(b6QArea);

    auto b6DynArea = area.removeFromTop(60);
    b6DynLabel.setBounds(b6DynArea.removeFromTop(20));
    b6DynSlider.setBounds(b6DynArea);

}
