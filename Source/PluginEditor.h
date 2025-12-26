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
    juce::Slider delayTimeSlider;
    juce::Label delayTimeLabel;
    std::unique_ptr<juce::SliderParameterAttachment> delayTimeAttachment;

    juce::Slider feedbackSlider;
    juce::Label feedbackLabel;
    std::unique_ptr<juce::SliderParameterAttachment> feedbackAttachment;

    juce::Slider mixSlider;
    juce::Label mixLabel;
    std::unique_ptr<juce::SliderParameterAttachment> mixAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
