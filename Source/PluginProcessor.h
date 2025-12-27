#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

class VAIstAudioProcessor : public juce::AudioProcessor
{
public:
    VAIstAudioProcessor();
    ~VAIstAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    // Parameter getters
    juce::AudioParameterFloat* getRateParam() { return rateParam; }
    juce::AudioParameterFloat* getDepthParam() { return depthParam; }
    juce::AudioParameterFloat* getManualDelayParam() { return manualDelayParam; }
    juce::AudioParameterFloat* getFeedbackParam() { return feedbackParam; }
    juce::AudioParameterFloat* getLfoWaveformParam() { return lfoWaveformParam; }
    juce::AudioParameterFloat* getStereoPhaseParam() { return stereoPhaseParam; }
    juce::AudioParameterFloat* getStereoWidthParam() { return stereoWidthParam; }
    juce::AudioParameterFloat* getHighpassFreqParam() { return highpassFreqParam; }
    juce::AudioParameterFloat* getLowpassFreqParam() { return lowpassFreqParam; }
    juce::AudioParameterFloat* getMixParam() { return mixParam; }
    juce::AudioParameterFloat* getOutputGainParam() { return outputGainParam; }

private:
    // Parameters
    juce::AudioParameterFloat* rateParam = nullptr;
    juce::AudioParameterFloat* depthParam = nullptr;
    juce::AudioParameterFloat* manualDelayParam = nullptr;
    juce::AudioParameterFloat* feedbackParam = nullptr;
    juce::AudioParameterFloat* lfoWaveformParam = nullptr;
    juce::AudioParameterFloat* stereoPhaseParam = nullptr;
    juce::AudioParameterFloat* stereoWidthParam = nullptr;
    juce::AudioParameterFloat* highpassFreqParam = nullptr;
    juce::AudioParameterFloat* lowpassFreqParam = nullptr;
    juce::AudioParameterFloat* mixParam = nullptr;
    juce::AudioParameterFloat* outputGainParam = nullptr;

    // DSP state
    float gainSmoothed = 1.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
};
