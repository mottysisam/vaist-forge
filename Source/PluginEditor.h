#pragma once

#include "PluginProcessor.h"

class VAIstAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit VAIstAudioProcessorEditor(VAIstAudioProcessor&);
    ~VAIstAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    VAIstAudioProcessor& processorRef;

    // UI Components
    juce::Slider masterGainSlider;
    juce::Label masterGainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> masterGainAttachment;

    juce::Slider masterWetSlider;
    juce::Label masterWetLabel;
    std::unique_ptr<juce::SliderParameterAttachment> masterWetAttachment;

    juce::Slider processingModeSlider;
    juce::Label processingModeLabel;
    std::unique_ptr<juce::SliderParameterAttachment> processingModeAttachment;

    juce::Slider b1FreqSlider;
    juce::Label b1FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b1FreqAttachment;

    juce::Slider b1GainSlider;
    juce::Label b1GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b1GainAttachment;

    juce::Slider b1QSlider;
    juce::Label b1QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b1QAttachment;

    juce::Slider b1DynSlider;
    juce::Label b1DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b1DynAttachment;

    juce::Slider b1TypeSlider;
    juce::Label b1TypeLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b1TypeAttachment;

    juce::Slider b2FreqSlider;
    juce::Label b2FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b2FreqAttachment;

    juce::Slider b2GainSlider;
    juce::Label b2GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b2GainAttachment;

    juce::Slider b2QSlider;
    juce::Label b2QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b2QAttachment;

    juce::Slider b2DynSlider;
    juce::Label b2DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b2DynAttachment;

    juce::Slider b3FreqSlider;
    juce::Label b3FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b3FreqAttachment;

    juce::Slider b3GainSlider;
    juce::Label b3GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b3GainAttachment;

    juce::Slider b3QSlider;
    juce::Label b3QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b3QAttachment;

    juce::Slider b3DynSlider;
    juce::Label b3DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b3DynAttachment;

    juce::Slider b4FreqSlider;
    juce::Label b4FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b4FreqAttachment;

    juce::Slider b4GainSlider;
    juce::Label b4GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b4GainAttachment;

    juce::Slider b4QSlider;
    juce::Label b4QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b4QAttachment;

    juce::Slider b4DynSlider;
    juce::Label b4DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b4DynAttachment;

    juce::Slider b5FreqSlider;
    juce::Label b5FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b5FreqAttachment;

    juce::Slider b5GainSlider;
    juce::Label b5GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b5GainAttachment;

    juce::Slider b5QSlider;
    juce::Label b5QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b5QAttachment;

    juce::Slider b5DynSlider;
    juce::Label b5DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b5DynAttachment;

    juce::Slider b6FreqSlider;
    juce::Label b6FreqLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b6FreqAttachment;

    juce::Slider b6GainSlider;
    juce::Label b6GainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b6GainAttachment;

    juce::Slider b6QSlider;
    juce::Label b6QLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b6QAttachment;

    juce::Slider b6DynSlider;
    juce::Label b6DynLabel;
    std::unique_ptr<juce::SliderParameterAttachment> b6DynAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
