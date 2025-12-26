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
    juce::AudioParameterFloat* getDelayTimeParam() { return delayTimeParam; }
    juce::AudioParameterFloat* getFeedbackParam() { return feedbackParam; }
    juce::AudioParameterFloat* getMixParam() { return mixParam; }
    juce::AudioParameterFloat* getSaturationParam() { return saturationParam; }

private:
    // Parameters
    juce::AudioParameterFloat* delayTimeParam = nullptr;
    juce::AudioParameterFloat* feedbackParam = nullptr;
    juce::AudioParameterFloat* mixParam = nullptr;
    juce::AudioParameterFloat* saturationParam = nullptr;

    // DSP state
    juce::AudioBuffer<float> delayBuffer;
    int bufferSize = 0;
    int writePosition[2] = {0, 0};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
};
