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
    juce::Slider amountSlider;
    juce::Label amountLabel;
    std::unique_ptr<juce::SliderParameterAttachment> amountAttachment;

    juce::Slider warmthSlider;
    juce::Label warmthLabel;
    std::unique_ptr<juce::SliderParameterAttachment> warmthAttachment;

    juce::Slider mixSlider;
    juce::Label mixLabel;
    std::unique_ptr<juce::SliderParameterAttachment> mixAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
