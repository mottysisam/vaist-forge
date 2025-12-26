#pragma once

#include "PluginProcessor.h"

//==============================================================================
// vAIst Plugin Editor
// This is the "face" of the plugin - the UI that users interact with
//==============================================================================
class VAIstAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit VAIstAudioProcessorEditor(VAIstAudioProcessor&);
    ~VAIstAudioProcessorEditor() override;

    //==============================================================================
    void paint(juce::Graphics&) override;
    void resized() override;

private:
    VAIstAudioProcessor& processorRef;

    // UI Components
    juce::Slider gainSlider;
    juce::Label gainLabel;

    // Parameter attachment for thread-safe automation
    std::unique_ptr<juce::SliderParameterAttachment> gainAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
