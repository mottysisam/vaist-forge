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

    juce::Slider toneControlSlider;
    juce::Label toneControlLabel;
    std::unique_ptr<juce::SliderParameterAttachment> toneControlAttachment;

    juce::Slider volumeSlider;
    juce::Label volumeLabel;
    std::unique_ptr<juce::SliderParameterAttachment> volumeAttachment;


    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
