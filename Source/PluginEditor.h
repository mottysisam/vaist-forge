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

    juce::Slider feedbackSlider;
    juce::Label feedbackLabel;
    std::unique_ptr<juce::SliderParameterAttachment> feedbackAttachment;

    juce::Slider manualDelaySlider;
    juce::Label manualDelayLabel;
    std::unique_ptr<juce::SliderParameterAttachment> manualDelayAttachment;

    juce::Slider lfoWaveformSlider;
    juce::Label lfoWaveformLabel;
    std::unique_ptr<juce::SliderParameterAttachment> lfoWaveformAttachment;

    juce::Slider stereoPhaseSlider;
    juce::Label stereoPhaseLabel;
    std::unique_ptr<juce::SliderParameterAttachment> stereoPhaseAttachment;

    juce::Slider mixSlider;
    juce::Label mixLabel;
    std::unique_ptr<juce::SliderParameterAttachment> mixAttachment;

    juce::Slider outputGainSlider;
    juce::Label outputGainLabel;
    std::unique_ptr<juce::SliderParameterAttachment> outputGainAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
