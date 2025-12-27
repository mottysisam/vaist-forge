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
    juce::AudioParameterFloat* getMasterGainParam() { return masterGainParam; }
    juce::AudioParameterFloat* getMasterWetParam() { return masterWetParam; }
    juce::AudioParameterFloat* getProcessingModeParam() { return processingModeParam; }
    juce::AudioParameterFloat* getB1FreqParam() { return b1FreqParam; }
    juce::AudioParameterFloat* getB1GainParam() { return b1GainParam; }
    juce::AudioParameterFloat* getB1QParam() { return b1QParam; }
    juce::AudioParameterFloat* getB1DynParam() { return b1DynParam; }
    juce::AudioParameterFloat* getB1TypeParam() { return b1TypeParam; }
    juce::AudioParameterFloat* getB2FreqParam() { return b2FreqParam; }
    juce::AudioParameterFloat* getB2GainParam() { return b2GainParam; }
    juce::AudioParameterFloat* getB2QParam() { return b2QParam; }
    juce::AudioParameterFloat* getB2DynParam() { return b2DynParam; }
    juce::AudioParameterFloat* getB3FreqParam() { return b3FreqParam; }
    juce::AudioParameterFloat* getB3GainParam() { return b3GainParam; }
    juce::AudioParameterFloat* getB3QParam() { return b3QParam; }
    juce::AudioParameterFloat* getB3DynParam() { return b3DynParam; }
    juce::AudioParameterFloat* getB4FreqParam() { return b4FreqParam; }
    juce::AudioParameterFloat* getB4GainParam() { return b4GainParam; }
    juce::AudioParameterFloat* getB4QParam() { return b4QParam; }
    juce::AudioParameterFloat* getB4DynParam() { return b4DynParam; }
    juce::AudioParameterFloat* getB5FreqParam() { return b5FreqParam; }
    juce::AudioParameterFloat* getB5GainParam() { return b5GainParam; }
    juce::AudioParameterFloat* getB5QParam() { return b5QParam; }
    juce::AudioParameterFloat* getB5DynParam() { return b5DynParam; }
    juce::AudioParameterFloat* getB6FreqParam() { return b6FreqParam; }
    juce::AudioParameterFloat* getB6GainParam() { return b6GainParam; }
    juce::AudioParameterFloat* getB6QParam() { return b6QParam; }
    juce::AudioParameterFloat* getB6DynParam() { return b6DynParam; }

private:
    // Parameters
    juce::AudioParameterFloat* masterGainParam = nullptr;
    juce::AudioParameterFloat* masterWetParam = nullptr;
    juce::AudioParameterFloat* processingModeParam = nullptr;
    juce::AudioParameterFloat* b1FreqParam = nullptr;
    juce::AudioParameterFloat* b1GainParam = nullptr;
    juce::AudioParameterFloat* b1QParam = nullptr;
    juce::AudioParameterFloat* b1DynParam = nullptr;
    juce::AudioParameterFloat* b1TypeParam = nullptr;
    juce::AudioParameterFloat* b2FreqParam = nullptr;
    juce::AudioParameterFloat* b2GainParam = nullptr;
    juce::AudioParameterFloat* b2QParam = nullptr;
    juce::AudioParameterFloat* b2DynParam = nullptr;
    juce::AudioParameterFloat* b3FreqParam = nullptr;
    juce::AudioParameterFloat* b3GainParam = nullptr;
    juce::AudioParameterFloat* b3QParam = nullptr;
    juce::AudioParameterFloat* b3DynParam = nullptr;
    juce::AudioParameterFloat* b4FreqParam = nullptr;
    juce::AudioParameterFloat* b4GainParam = nullptr;
    juce::AudioParameterFloat* b4QParam = nullptr;
    juce::AudioParameterFloat* b4DynParam = nullptr;
    juce::AudioParameterFloat* b5FreqParam = nullptr;
    juce::AudioParameterFloat* b5GainParam = nullptr;
    juce::AudioParameterFloat* b5QParam = nullptr;
    juce::AudioParameterFloat* b5DynParam = nullptr;
    juce::AudioParameterFloat* b6FreqParam = nullptr;
    juce::AudioParameterFloat* b6GainParam = nullptr;
    juce::AudioParameterFloat* b6QParam = nullptr;
    juce::AudioParameterFloat* b6DynParam = nullptr;

    // DSP state
    float gainSmoothed = 1.0f;
    float z1[2] = {0.0f, 0.0f};
    float z2[2] = {0.0f, 0.0f};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
};
