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
    juce::Slider driveAmountSlider;
    juce::Label driveAmountLabel;
    std::unique_ptr<juce::SliderParameterAttachment> driveAmountAttachment;

    juce::Slider mixAmountSlider;
    juce::Label mixAmountLabel;
    std::unique_ptr<juce::SliderParameterAttachment> mixAmountAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
