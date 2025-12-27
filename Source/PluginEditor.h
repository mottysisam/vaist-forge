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
    juce::Slider rateSlider;
    juce::Label rateLabel;
    std::unique_ptr<juce::SliderParameterAttachment> rateAttachment;

    juce::Slider depthSlider;
    juce::Label depthLabel;
    std::unique_ptr<juce::SliderParameterAttachment> depthAttachment;

    juce::Slider manualSlider;
    juce::Label manualLabel;
    std::unique_ptr<juce::SliderParameterAttachment> manualAttachment;

    juce::Slider feedbackSlider;
    juce::Label feedbackLabel;
    std::unique_ptr<juce::SliderParameterAttachment> feedbackAttachment;

    juce::Slider waveformSlider;
    juce::Label waveformLabel;
    std::unique_ptr<juce::SliderParameterAttachment> waveformAttachment;

    juce::Slider offsetSlider;
    juce::Label offsetLabel;
    std::unique_ptr<juce::SliderParameterAttachment> offsetAttachment;

    juce::Slider mixSlider;
    juce::Label mixLabel;
    std::unique_ptr<juce::SliderParameterAttachment> mixAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
