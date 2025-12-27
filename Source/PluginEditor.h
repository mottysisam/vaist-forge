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
    juce::Slider gainAmountSlider;
    juce::Label gainAmountLabel;
    std::unique_ptr<juce::SliderParameterAttachment> gainAmountAttachment;

    juce::Slider outputLevelSlider;
    juce::Label outputLevelLabel;
    std::unique_ptr<juce::SliderParameterAttachment> outputLevelAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
