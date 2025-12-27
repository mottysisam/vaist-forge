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
    juce::AudioParameterFloat* getVolumeParam() { return volumeParam; }
    juce::AudioParameterFloat* getGainParam() { return gainParam; }

private:
    // Parameters
    juce::AudioParameterFloat* volumeParam = nullptr;
    juce::AudioParameterFloat* gainParam = nullptr;

    // DSP state
    float gainSmoothed = 1.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
};
