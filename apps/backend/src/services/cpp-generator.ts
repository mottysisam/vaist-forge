/**
 * vAIst Deterministic C++ Code Generator
 *
 * This module generates C++ code from validated PluginPlan schemas.
 * NO AI involvement in code generation = ZERO typos, ZERO syntax errors.
 *
 * The AI provides structured data (JSON) → This module generates exact C++ code.
 *
 * Key principle: Every line of C++ is a TypeScript template literal.
 * The AI cannot introduce bugs because it never writes C++ directly.
 *
 * CRITICAL: Uses shared DSP templates from dsp-templates.ts to ensure
 * mathematical parity with WASM browser preview.
 */

import type { PluginPlan, PluginParameter, DspBlock } from '@vaist/shared';
import {
  generateGainDspCore,
  generateWaveshaperDspCore,
  generateOutputSanitization,
  findParamId,
} from './dsp-templates';

// ============================================================================
// Types for C++ Generation
// ============================================================================

export type WaveshapingFunction =
  | 'tanh'
  | 'atan'
  | 'soft_clip'
  | 'hard_clip'
  | 'sine_fold'
  | 'cubic';

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface GeneratedFiles {
  processorH: string;
  processorCpp: string;
  editorH: string;
  editorCpp: string;
}

// ============================================================================
// C++ Code Generator
// ============================================================================

export class CppGenerator {
  // ==========================================================================
  // Parameter Code Generation
  // ==========================================================================

  /**
   * Generate parameter pointer declarations for the header.
   */
  static generateParameterDeclarations(params: PluginParameter[]): string {
    return params
      .map((p) => `    juce::AudioParameterFloat* ${p.id}Param = nullptr;`)
      .join('\n');
  }

  /**
   * Format a number as a valid C++ float literal (always includes decimal point)
   */
  static formatFloat(value: number): string {
    // Ensure we always have a decimal point for valid C++ float literals
    const str = value.toString();
    if (str.includes('.') || str.includes('e') || str.includes('E')) {
      return str + 'f';
    }
    return str + '.0f';
  }

  /**
   * Generate parameter creation in constructor.
   * Uses JUCE 8 API with ParameterID and NormalisableRange.
   */
  static generateParameterInitialization(params: PluginParameter[]): string {
    return params
      .map((p) => {
        const min = typeof p.min === 'number' ? p.min : 0;
        const max = typeof p.max === 'number' ? p.max : 1;
        const defaultVal = typeof p.default === 'number' ? p.default : 0.5;

        return `    addParameter(${p.id}Param = new juce::AudioParameterFloat(
        juce::ParameterID("${p.id}", 1),
        "${p.name}",
        juce::NormalisableRange<float>(${CppGenerator.formatFloat(min)}, ${CppGenerator.formatFloat(max)}),
        ${CppGenerator.formatFloat(defaultVal)}
    ));`;
      })
      .join('\n');
  }

  /**
   * Generate getter methods for parameters.
   */
  static generateParameterGetters(params: PluginParameter[]): string {
    return params
      .map((p) => {
        const methodName = p.id.charAt(0).toUpperCase() + p.id.slice(1);
        return `    juce::AudioParameterFloat* get${methodName}Param() { return ${p.id}Param; }`;
      })
      .join('\n');
  }

  /**
   * Generate code to read parameter values in processBlock.
   */
  static generateParameterValueReads(params: PluginParameter[]): string {
    return params
      .map((p) => `        const float ${p.id} = ${p.id}Param->get();`)
      .join('\n');
  }

  // ==========================================================================
  // DSP Code Generation
  // ==========================================================================

  /**
   * Generate DSP code based on plugin blocks.
   */
  static generateDspCode(
    blocks: DspBlock[],
    params: PluginParameter[]
  ): string {
    const dspBlocks: string[] = [];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'gain':
          dspBlocks.push(this.generateGainDsp(params));
          break;
        case 'saturator':
        case 'waveshaper':
          dspBlocks.push(this.generateWaveshaperDsp(params));
          break;
        case 'filter':
          dspBlocks.push(this.generateFilterDsp(params));
          break;
        case 'delay':
          dspBlocks.push(this.generateDelayDsp(params));
          break;
        case 'compressor':
          dspBlocks.push(this.generateCompressorDsp(params));
          break;
        case 'mixer':
          dspBlocks.push(this.generateMixerDsp(params));
          break;
        default:
          // Default: passthrough
          dspBlocks.push('        // Passthrough for: ' + block.type);
      }
    }

    return dspBlocks.join('\n\n');
  }

  /**
   * Generate gain DSP code.
   * Uses shared DSP template for mathematical parity with WASM browser preview.
   */
  static generateGainDsp(params: PluginParameter[]): string {
    const gainParam = findParamId(params, 'gain', 'output', 'volume');

    // Use shared DSP template for mathematical parity
    const dspCore = generateGainDspCore(gainParam);

    return `        // Gain stage (shared DSP template)
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);
            for (int sample = 0; sample < numSamples; ++sample)
            {
                float inputSample = channelData[sample];
                float outputSample;
${dspCore}
${generateOutputSanitization()}
                channelData[sample] = outputSample;
            }
        }`;
  }

  /**
   * Generate waveshaper/saturator DSP code.
   * Uses shared DSP template for mathematical parity with WASM browser preview.
   */
  static generateWaveshaperDsp(params: PluginParameter[]): string {
    const driveParam = findParamId(params, 'drive');
    const mixParam = findParamId(params, 'mix');

    // Use shared DSP template for mathematical parity
    const dspCore = generateWaveshaperDspCore(driveParam, mixParam);

    return `        // Waveshaper processing (shared DSP template)
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                float inputSample = channelData[sample];
                float outputSample;
${dspCore}
${generateOutputSanitization()}
                channelData[sample] = outputSample;
            }
        }`;
  }

  /**
   * Generate filter DSP code.
   * Uses double precision for coefficient calculation (critical for numerical accuracy).
   * Algorithm matches dsp-templates.ts for parity with WASM preview.
   */
  static generateFilterDsp(params: PluginParameter[]): string {
    const cutoffParam = findParamId(params, 'cutoff', 'freq', 'frequency');
    const qParam = findParamId(params, 'q', 'resonance', 'res');

    // NOTE: Filter coefficients use double precision (matching dsp-templates.ts)
    // The formula is identical to generateFilterCoefficients() but uses JUCE's pi constant
    return `        // Biquad filter processing (shared DSP algorithm - double precision coefficients)
        const double sampleRate = getSampleRate();

        // Map parameter to frequency range (20Hz - 20kHz, logarithmic)
        const float frequency = 20.0f * std::pow(1000.0f, ${cutoffParam});
        const float Q = 0.5f + ${qParam} * 9.5f;  // Range: 0.5 to 10

        // Calculate biquad coefficients (lowpass) - DOUBLE PRECISION for accuracy
        const double omega = 2.0 * juce::MathConstants<double>::pi * frequency / sampleRate;
        const double sinOmega = std::sin(omega);
        const double cosOmega = std::cos(omega);
        const double alpha = sinOmega / (2.0 * Q);

        // Lowpass filter coefficients (Cookbook formula - matches dsp-templates.ts)
        const double b0 = (1.0 - cosOmega) / 2.0;
        const double b1 = 1.0 - cosOmega;
        const double b2 = (1.0 - cosOmega) / 2.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;

        // Normalize coefficients
        const double a0Inv = 1.0 / a0;
        const float b0n = static_cast<float>(b0 * a0Inv);
        const float b1n = static_cast<float>(b1 * a0Inv);
        const float b2n = static_cast<float>(b2 * a0Inv);
        const float a1n = static_cast<float>(a1 * a0Inv);
        const float a2n = static_cast<float>(a2 * a0Inv);

        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float input = channelData[sample];

                // Direct Form II Transposed (matches dsp-templates.ts)
                const float output = b0n * input + z1[channel];
                z1[channel] = b1n * input - a1n * output + z2[channel];
                z2[channel] = b2n * input - a2n * output;

                channelData[sample] = output;
            }
        }`;
  }

  /**
   * Generate delay DSP code.
   * Algorithm matches dsp-templates.ts for parity with WASM preview.
   */
  static generateDelayDsp(params: PluginParameter[]): string {
    const timeParam = findParamId(params, 'time', 'delay', 'delayTime');
    const feedbackParam = findParamId(params, 'feedback', 'fb');
    const mixParam = findParamId(params, 'mix', 'wet');

    // Algorithm matches generateDelayCore() and generateDelaySampleProcessing()
    return `        // Delay processing (shared DSP algorithm)
        const float delaySamples = ${timeParam} * 1000.0f * 0.001f * static_cast<float>(getSampleRate());
        const int delayInt = static_cast<int>(delaySamples);
        const float delayFrac = delaySamples - static_cast<float>(delayInt);

        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);
            auto* delayData = delayBuffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float dry = channelData[sample];

                // Read from delay buffer with linear interpolation (matches dsp-templates.ts)
                int readPos = writePosition[channel] - delayInt;
                if (readPos < 0) readPos += bufferSize;
                int readPos2 = readPos - 1;
                if (readPos2 < 0) readPos2 += bufferSize;

                const float delayed = delayData[readPos] * (1.0f - delayFrac) + delayData[readPos2] * delayFrac;

                // Write to delay buffer with feedback (0.9 limiter - matches dsp-templates.ts)
                delayData[writePosition[channel]] = dry + delayed * ${feedbackParam} * 0.9f;

                // Increment write position
                writePosition[channel]++;
                if (writePosition[channel] >= bufferSize)
                    writePosition[channel] = 0;

                // Mix dry/wet
                channelData[sample] = dry * (1.0f - ${mixParam}) + delayed * ${mixParam};
            }
        }`;
  }

  /**
   * Generate compressor DSP code.
   * Algorithm matches dsp-templates.ts for parity with WASM preview.
   */
  static generateCompressorDsp(params: PluginParameter[]): string {
    const thresholdParam = findParamId(params, 'threshold', 'thresh');
    const ratioParam = findParamId(params, 'ratio');
    const attackParam = findParamId(params, 'attack', 'att');
    const releaseParam = findParamId(params, 'release', 'rel');

    // Algorithm matches generateCompressorCore() and generateCompressorSampleProcessing()
    return `        // Compressor processing (shared DSP algorithm)
        const float thresholdDb = ${thresholdParam};
        const float ratioVal = ${ratioParam};
        const float attackMs = ${attackParam};
        const float releaseMs = ${releaseParam};

        const float attackCoeff = std::exp(-1.0f / (attackMs * 0.001f * static_cast<float>(getSampleRate())));
        const float releaseCoeff = std::exp(-1.0f / (releaseMs * 0.001f * static_cast<float>(getSampleRate())));

        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {
                const float input = channelData[sample];
                const float inputAbs = std::abs(input);

                // Convert to dB (matches dsp-templates.ts)
                const float inputDb = 20.0f * std::log10(inputAbs + 1e-6f);

                // Calculate gain reduction
                float gainReductionDb = 0.0f;
                if (inputDb > thresholdDb)
                {
                    gainReductionDb = (inputDb - thresholdDb) * (1.0f - 1.0f / ratioVal);
                }

                // Apply envelope (identical smoothing - matches dsp-templates.ts)
                if (gainReductionDb > envelope[channel])
                    envelope[channel] = attackCoeff * envelope[channel] + (1.0f - attackCoeff) * gainReductionDb;
                else
                    envelope[channel] = releaseCoeff * envelope[channel] + (1.0f - releaseCoeff) * gainReductionDb;

                // Apply gain reduction
                const float gainLinear = std::pow(10.0f, -envelope[channel] / 20.0f);
                channelData[sample] = input * gainLinear;
            }
        }`;
  }

  /**
   * Generate mixer (wet/dry) DSP code.
   */
  static generateMixerDsp(params: PluginParameter[]): string {
    const mixParam =
      params.find((p) => p.id.toLowerCase().includes('mix'))?.id || 'mix';

    return `        // Wet/dry mixing is handled inline with effect processing
        // Mix parameter: ${mixParam}`;
  }

  // ==========================================================================
  // Member Variable Generation
  // ==========================================================================

  /**
   * Generate member variables based on DSP blocks.
   */
  static generateMemberVariables(blocks: DspBlock[]): string {
    const vars: string[] = ['    float gainSmoothed = 1.0f;'];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'filter':
          vars.push('    float z1[2] = {0.0f, 0.0f};');
          vars.push('    float z2[2] = {0.0f, 0.0f};');
          break;
        case 'delay':
          vars.push('    juce::AudioBuffer<float> delayBuffer;');
          vars.push('    int bufferSize = 0;');
          vars.push('    int writePosition[2] = {0, 0};');
          break;
        case 'compressor':
          vars.push('    float envelope[2] = {0.0f, 0.0f};');
          break;
      }
    }

    return vars.join('\n');
  }

  /**
   * Generate prepareToPlay initialization code.
   */
  static generatePrepareCode(blocks: DspBlock[]): string {
    const inits: string[] = [];

    for (const block of blocks) {
      switch (block.type.toLowerCase()) {
        case 'filter':
          inits.push(`    // Initialize filter state
    for (int i = 0; i < 2; ++i)
    {
        z1[i] = 0.0f;
        z2[i] = 0.0f;
    }`);
          break;
        case 'delay':
          inits.push(`    // Initialize delay buffer (max 1 second)
    bufferSize = static_cast<int>(sampleRate * 1.0 + 1);
    delayBuffer.setSize(2, bufferSize);
    delayBuffer.clear();
    writePosition[0] = 0;
    writePosition[1] = 0;`);
          break;
        case 'compressor':
          inits.push(`    // Initialize compressor envelope
    envelope[0] = 0.0f;
    envelope[1] = 0.0f;`);
          break;
      }
    }

    if (inits.length === 0) {
      inits.push('    // Initialize default state\n    gainSmoothed = 1.0f;');
    }

    return inits.join('\n');
  }

  // ==========================================================================
  // Editor Code Generation
  // ==========================================================================

  /**
   * Generate slider initialization code for editor.
   */
  static generateSliderInitialization(params: PluginParameter[]): string {
    return params
      .map((p) => {
        const methodName = p.id.charAt(0).toUpperCase() + p.id.slice(1);
        return `    ${p.id}Slider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    ${p.id}Slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible(${p.id}Slider);
    ${p.id}Attachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.get${methodName}Param(), ${p.id}Slider, nullptr);
    ${p.id}Label.setText("${p.name}", juce::dontSendNotification);
    ${p.id}Label.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(${p.id}Label);
`;
      })
      .join('\n');
  }

  /**
   * Generate slider layout code for resized().
   */
  static generateSliderLayout(params: PluginParameter[]): string {
    return params
      .map(
        (p) => `    auto ${p.id}Area = area.removeFromTop(60);
    ${p.id}Label.setBounds(${p.id}Area.removeFromTop(20));
    ${p.id}Slider.setBounds(${p.id}Area);
`
      )
      .join('\n');
  }

  /**
   * Generate editor member declarations.
   */
  static generateEditorMemberDeclarations(params: PluginParameter[]): string {
    return params
      .map(
        (p) => `    juce::Slider ${p.id}Slider;
    juce::Label ${p.id}Label;
    std::unique_ptr<juce::SliderParameterAttachment> ${p.id}Attachment;
`
      )
      .join('\n');
  }

  // ==========================================================================
  // Complete File Generation
  // ==========================================================================

  /**
   * Generate complete PluginProcessor.h
   */
  static generateProcessorH(plan: PluginPlan): string {
    const paramDeclarations = this.generateParameterDeclarations(
      plan.parameters
    );
    const getterDeclarations = this.generateParameterGetters(plan.parameters);
    const memberVars = this.generateMemberVariables(plan.dspBlocks);

    return `#pragma once

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
${getterDeclarations}

private:
    // Parameters
${paramDeclarations}

    // DSP state
${memberVars}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
};
`;
  }

  /**
   * Generate complete PluginProcessor.cpp
   */
  static generateProcessorCpp(plan: PluginPlan): string {
    const paramInit = this.generateParameterInitialization(plan.parameters);
    const paramReads = this.generateParameterValueReads(plan.parameters);
    const dspCode = this.generateDspCode(plan.dspBlocks, plan.parameters);
    const prepareCode = this.generatePrepareCode(plan.dspBlocks);

    return `#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Initialize parameters
${paramInit}
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int index) { juce::ignoreUnused(index); }
const juce::String VAIstAudioProcessor::getProgramName(int index) { juce::ignoreUnused(index); return {}; }
void VAIstAudioProcessor::changeProgramName(int index, const juce::String& newName) { juce::ignoreUnused(index, newName); }

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
${prepareCode}
}

void VAIstAudioProcessor::releaseResources() {}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();

    // Read parameter values
${paramReads}

    // DSP Processing
${dspCode}

    // Output sanitization: prevent NaN/Inf from reaching the host
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        for (int sample = 0; sample < numSamples; ++sample)
        {
            if (!std::isfinite(channelData[sample]))
                channelData[sample] = 0.0f;
            else
                channelData[sample] = juce::jlimit(-1.0f, 1.0f, channelData[sample]);
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }

juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor()
{
    return new VAIstAudioProcessorEditor(*this);
}

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::ignoreUnused(destData);
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::ignoreUnused(data, sizeInBytes);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
`;
  }

  /**
   * Generate complete PluginEditor.h
   */
  static generateEditorH(plan: PluginPlan): string {
    const sliderDeclarations = this.generateEditorMemberDeclarations(
      plan.parameters
    );

    return `#pragma once

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
${sliderDeclarations}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
};
`;
  }

  /**
   * Generate complete PluginEditor.cpp
   */
  static generateEditorCpp(plan: PluginPlan, pluginName: string): string {
    const sliderInit = this.generateSliderInitialization(plan.parameters);
    const sliderLayout = this.generateSliderLayout(plan.parameters);
    const height = 100 + plan.parameters.length * 60;

    return `#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Set up sliders
${sliderInit}

    setSize(400, ${height});
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("${pluginName}", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

${sliderLayout}
}
`;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate all 4 C++ files from a PluginPlan.
 */
export function generateFromPlan(
  plan: PluginPlan,
  pluginName?: string
): GeneratedFiles {
  const name = pluginName || 'vAIst Plugin';

  return {
    processorH: CppGenerator.generateProcessorH(plan),
    processorCpp: CppGenerator.generateProcessorCpp(plan),
    editorH: CppGenerator.generateEditorH(plan),
    editorCpp: CppGenerator.generateEditorCpp(plan, name),
  };
}
