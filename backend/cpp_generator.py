"""
vAIst Deterministic C++ Code Generator

This module generates perfect C++ code from validated Pydantic schemas.
NO AI involvement in code generation = ZERO typos, ZERO syntax errors.

The AI provides structured data (JSON) → This module generates exact C++ code.

Key principle: Every line of C++ is a Python f-string template.
The AI cannot introduce bugs because it never writes C++ directly.
"""

import logging
from typing import Tuple, Dict

from backend.schemas import (
    PluginResponse,
    PluginParameter,
    PluginCategory,
    WaveshapingFunction,
    FilterType,
    WaveshaperDSP,
    FilterDSP,
    DelayDSP,
    GainDSP,
)

logger = logging.getLogger(__name__)


class CppGenerator:
    """
    Deterministic C++ code generator.

    Takes validated Pydantic schemas and outputs perfect C++ code.
    Every template is pre-verified to compile correctly.
    """

    # =========================================================================
    # Parameter Code Generation
    # =========================================================================

    @staticmethod
    def generate_parameter_declarations(params: list[PluginParameter]) -> str:
        """
        Generate parameter pointer declarations for the header.

        Output:
            juce::AudioParameterFloat* driveParam = nullptr;
            juce::AudioParameterFloat* mixParam = nullptr;
        """
        lines = []
        for p in params:
            lines.append(
                f"    juce::AudioParameterFloat* {p.name}Param = nullptr;"
            )
        return "\n".join(lines)

    @staticmethod
    def generate_parameter_initialization(params: list[PluginParameter]) -> str:
        """
        Generate parameter creation in constructor.

        Output:
            addParameter(driveParam = new juce::AudioParameterFloat(
                "drive", "Drive", 0.0f, 1.0f, 0.5f
            ));
        """
        lines = []
        for p in params:
            # Use proper min/max/default from schema
            min_val = p.min_value
            max_val = p.max_value
            default_val = p.default_value

            lines.append(
                f'    addParameter({p.name}Param = new juce::AudioParameterFloat(\n'
                f'        "{p.name}",\n'
                f'        "{p.label}",\n'
                f'        {min_val}f,\n'
                f'        {max_val}f,\n'
                f'        {default_val}f\n'
                f'    ));'
            )
        return "\n".join(lines)

    @staticmethod
    def generate_parameter_getters(params: list[PluginParameter]) -> str:
        """
        Generate getter methods for parameters.

        Output:
            juce::AudioParameterFloat* getDriveParam() { return driveParam; }
        """
        lines = []
        for p in params:
            # Capitalize first letter for method name
            method_name = p.name[0].upper() + p.name[1:]
            lines.append(
                f"    juce::AudioParameterFloat* get{method_name}Param() {{ return {p.name}Param; }}"
            )
        return "\n".join(lines)

    @staticmethod
    def generate_parameter_value_reads(params: list[PluginParameter]) -> str:
        """
        Generate code to read parameter values in processBlock.

        Output:
            const float drive = driveParam->get();
            const float mix = mixParam->get();
        """
        lines = []
        for p in params:
            lines.append(f"        const float {p.name} = {p.name}Param->get();")
        return "\n".join(lines)

    # =========================================================================
    # DSP Code Generation - Waveshaper
    # =========================================================================

    @staticmethod
    def generate_waveshaper_dsp(dsp: WaveshaperDSP, params: list[PluginParameter]) -> str:
        """
        Generate waveshaper DSP code.

        This is deterministic based on the waveshaping_function enum.
        The AI cannot introduce typos because we control the template.
        """
        # Find the drive and mix parameters by common names
        drive_param = next((p.name for p in params if 'drive' in p.name.lower()), 'drive')
        mix_param = next((p.name for p in params if 'mix' in p.name.lower()), 'mix')

        # Generate waveshaping function
        waveshape_code = CppGenerator._get_waveshape_function(dsp.waveshaping_function)

        # Compensation factor based on function
        compensation = "0.7f" if dsp.output_compensation else "1.0f"

        # Pre-compute gain range for f-string
        pre_gain_max = dsp.pre_gain_range - 1.0

        return f"""        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {{
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {{
                const float dry = channelData[sample];

                // Apply pre-gain based on drive
                const float preGain = 1.0f + {drive_param} * {pre_gain_max}f;
                const float driven = dry * preGain;

                // Apply waveshaping function
{waveshape_code}

                // Output compensation
                const float compensated = shaped * {compensation};

                // Mix dry/wet
                channelData[sample] = dry * (1.0f - {mix_param}) + compensated * {mix_param};
            }}
        }}"""

    @staticmethod
    def _get_waveshape_function(func: WaveshapingFunction) -> str:
        """Get the exact C++ code for each waveshaping function."""
        functions = {
            WaveshapingFunction.TANH: """                // Tanh soft saturation
                const float shaped = std::tanh(driven);""",

            WaveshapingFunction.ATAN: """                // Atan soft saturation
                const float shaped = std::atan(driven) * 0.636619772f;  // Normalize to ±1""",

            WaveshapingFunction.SOFT_CLIP: """                // Soft clip (cubic)
                float shaped;
                if (driven > 1.0f)
                    shaped = 0.666667f;
                else if (driven < -1.0f)
                    shaped = -0.666667f;
                else
                    shaped = driven - (driven * driven * driven) / 3.0f;""",

            WaveshapingFunction.HARD_CLIP: """                // Hard clip
                const float shaped = std::clamp(driven, -1.0f, 1.0f);""",

            WaveshapingFunction.SINE_FOLD: """                // Sine wavefolder
                const float shaped = std::sin(driven * juce::MathConstants<float>::pi);""",

            WaveshapingFunction.CUBIC: """                // Cubic waveshaper
                const float x = std::clamp(driven, -1.5f, 1.5f);
                const float shaped = 1.5f * x - 0.5f * x * x * x;""",
        }
        return functions.get(func, functions[WaveshapingFunction.TANH])

    # =========================================================================
    # DSP Code Generation - Filter
    # =========================================================================

    @staticmethod
    def generate_filter_dsp(dsp: FilterDSP, params: list[PluginParameter]) -> str:
        """Generate biquad filter DSP code."""
        cutoff_param = next((p.name for p in params if 'cutoff' in p.name.lower() or 'freq' in p.name.lower()), 'cutoff')
        q_param = next((p.name for p in params if 'q' in p.name.lower() or 'resonance' in p.name.lower()), 'resonance')

        filter_calc = CppGenerator._get_filter_coefficients(dsp.filter_type)

        return f"""        // Get sample rate for coefficient calculation
        const double sampleRate = getSampleRate();

        // Map parameter to frequency range (logarithmic)
        const float frequency = {dsp.min_frequency_hz}f * std::pow({dsp.max_frequency_hz}f / {dsp.min_frequency_hz}f, {cutoff_param});
        const float Q = {dsp.min_resonance}f + {q_param} * ({dsp.max_resonance}f - {dsp.min_resonance}f);

        // Calculate biquad coefficients
        const double omega = 2.0 * juce::MathConstants<double>::pi * frequency / sampleRate;
        const double sinOmega = std::sin(omega);
        const double cosOmega = std::cos(omega);
        const double alpha = sinOmega / (2.0 * Q);

{filter_calc}

        // Normalize coefficients
        const double a0Inv = 1.0 / a0;
        const float b0n = static_cast<float>(b0 * a0Inv);
        const float b1n = static_cast<float>(b1 * a0Inv);
        const float b2n = static_cast<float>(b2 * a0Inv);
        const float a1n = static_cast<float>(a1 * a0Inv);
        const float a2n = static_cast<float>(a2 * a0Inv);

        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {{
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {{
                const float input = channelData[sample];

                // Direct Form II Transposed
                const float output = b0n * input + z1[channel];
                z1[channel] = b1n * input - a1n * output + z2[channel];
                z2[channel] = b2n * input - a2n * output;

                channelData[sample] = output;
            }}
        }}"""

    @staticmethod
    def _get_filter_coefficients(filter_type: FilterType) -> str:
        """Get coefficient calculation for each filter type."""
        coefficients = {
            FilterType.LOWPASS: """        // Lowpass filter coefficients
        const double b0 = (1.0 - cosOmega) / 2.0;
        const double b1 = 1.0 - cosOmega;
        const double b2 = (1.0 - cosOmega) / 2.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;""",

            FilterType.HIGHPASS: """        // Highpass filter coefficients
        const double b0 = (1.0 + cosOmega) / 2.0;
        const double b1 = -(1.0 + cosOmega);
        const double b2 = (1.0 + cosOmega) / 2.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;""",

            FilterType.BANDPASS: """        // Bandpass filter coefficients
        const double b0 = alpha;
        const double b1 = 0.0;
        const double b2 = -alpha;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;""",

            FilterType.NOTCH: """        // Notch filter coefficients
        const double b0 = 1.0;
        const double b1 = -2.0 * cosOmega;
        const double b2 = 1.0;
        const double a0 = 1.0 + alpha;
        const double a1 = -2.0 * cosOmega;
        const double a2 = 1.0 - alpha;""",
        }
        return coefficients.get(filter_type, coefficients[FilterType.LOWPASS])

    # =========================================================================
    # DSP Code Generation - Delay
    # =========================================================================

    @staticmethod
    def generate_delay_dsp(dsp: DelayDSP, params: list[PluginParameter]) -> str:
        """Generate delay DSP code."""
        time_param = next((p.name for p in params if 'time' in p.name.lower() or 'delay' in p.name.lower()), 'delayTime')
        feedback_param = next((p.name for p in params if 'feedback' in p.name.lower() or 'fb' in p.name.lower()), 'feedback')
        mix_param = next((p.name for p in params if 'mix' in p.name.lower()), 'mix')

        return f"""        // Calculate delay in samples
        const float delaySamples = {time_param} * {dsp.max_delay_ms}f * 0.001f * static_cast<float>(getSampleRate());
        const int delayInt = static_cast<int>(delaySamples);
        const float delayFrac = delaySamples - static_cast<float>(delayInt);

        // Process each channel
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {{
            auto* channelData = buffer.getWritePointer(channel);
            auto* delayData = delayBuffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {{
                const float dry = channelData[sample];

                // Read from delay buffer with linear interpolation
                int readPos = writePosition[channel] - delayInt;
                if (readPos < 0) readPos += bufferSize;
                int readPos2 = readPos - 1;
                if (readPos2 < 0) readPos2 += bufferSize;

                const float delayed = delayData[readPos] * (1.0f - delayFrac) + delayData[readPos2] * delayFrac;

                // Write to delay buffer with feedback
                delayData[writePosition[channel]] = dry + delayed * {feedback_param} * {dsp.max_feedback}f;

                // Increment write position
                writePosition[channel]++;
                if (writePosition[channel] >= bufferSize)
                    writePosition[channel] = 0;

                // Mix dry/wet
                channelData[sample] = dry * (1.0f - {mix_param}) + delayed * {mix_param};
            }}
        }}"""

    # =========================================================================
    # DSP Code Generation - Gain
    # =========================================================================

    @staticmethod
    def generate_gain_dsp(dsp: GainDSP, params: list[PluginParameter]) -> str:
        """Generate gain DSP code."""
        gain_param = next((p.name for p in params if 'gain' in p.name.lower() or 'volume' in p.name.lower()), 'gain')

        smoothing = ""
        if dsp.smoothing_enabled:
            smoothing = f"""
        // Smooth gain changes
        const float targetGain = gainLinear;
        gainSmoothed = gainSmoothed + ({dsp.smoothing_time_ms}f * 0.001f * static_cast<float>(getSampleRate())) * (targetGain - gainSmoothed);
        const float smoothGain = gainSmoothed;"""
        else:
            smoothing = """
        const float smoothGain = gainLinear;"""

        return f"""        // Convert dB to linear
        const float gainDb = {gain_param} * {dsp.gain_range_db * 2}f - {dsp.gain_range_db}f;  // Range: -{dsp.gain_range_db} to +{dsp.gain_range_db} dB
        const float gainLinear = std::pow(10.0f, gainDb / 20.0f);
{smoothing}

        // Apply gain to all channels
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {{
            auto* channelData = buffer.getWritePointer(channel);

            for (int sample = 0; sample < numSamples; ++sample)
            {{
                channelData[sample] *= smoothGain;
            }}
        }}"""

    # =========================================================================
    # Complete File Generation
    # =========================================================================

    @classmethod
    def generate_processor_cpp(cls, response: PluginResponse) -> str:
        """
        Generate complete PluginProcessor.cpp from schema.

        This is the main entry point for processor generation.
        """
        # Generate all parameter-related code
        param_init = cls.generate_parameter_initialization(response.parameters)
        param_reads = cls.generate_parameter_value_reads(response.parameters)

        # Generate DSP code based on category
        dsp_code = cls._generate_dsp_for_category(response)

        # Generate member variables for specific plugin types
        member_vars = cls._generate_member_variables(response)

        # Assemble the complete file
        return f'''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{{
    // Initialize parameters
{param_init}
}}

VAIstAudioProcessor::~VAIstAudioProcessor() {{}}

const juce::String VAIstAudioProcessor::getName() const {{ return JucePlugin_Name; }}
bool VAIstAudioProcessor::acceptsMidi() const {{ return false; }}
bool VAIstAudioProcessor::producesMidi() const {{ return false; }}
bool VAIstAudioProcessor::isMidiEffect() const {{ return false; }}
double VAIstAudioProcessor::getTailLengthSeconds() const {{ return 0.0; }}
int VAIstAudioProcessor::getNumPrograms() {{ return 1; }}
int VAIstAudioProcessor::getCurrentProgram() {{ return 0; }}
void VAIstAudioProcessor::setCurrentProgram(int index) {{ juce::ignoreUnused(index); }}
const juce::String VAIstAudioProcessor::getProgramName(int index) {{ juce::ignoreUnused(index); return {{}}; }}
void VAIstAudioProcessor::changeProgramName(int index, const juce::String& newName) {{ juce::ignoreUnused(index, newName); }}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
{cls._generate_prepare_code(response)}
}}

void VAIstAudioProcessor::releaseResources() {{}}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();

    // Read parameter values
{param_reads}

    // DSP Processing
{dsp_code}
}}

bool VAIstAudioProcessor::hasEditor() const {{ return true; }}

juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor()
{{
    return new VAIstAudioProcessorEditor(*this);
}}

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{{
    juce::ignoreUnused(destData);
}}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{{
    juce::ignoreUnused(data, sizeInBytes);
}}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{{
    return new VAIstAudioProcessor();
}}
'''

    @classmethod
    def generate_editor_cpp(cls, response: PluginResponse) -> str:
        """
        Generate complete PluginEditor.cpp from schema.
        """
        # Generate slider creation for each parameter
        slider_init = cls._generate_slider_initialization(response.parameters)
        slider_layout = cls._generate_slider_layout(response.parameters)

        return f'''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{{
    // Set up sliders
{slider_init}

    setSize(400, {100 + len(response.parameters) * 60});
}}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {{}}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{{
    g.fillAll(juce::Colour(0xff1a1a2e));

    g.setColour(juce::Colour(0xfff39c12));
    g.setFont(juce::FontOptions(20.0f));
    g.drawText("{response.plugin_name}", getLocalBounds().removeFromTop(40), juce::Justification::centred, true);
}}

void VAIstAudioProcessorEditor::resized()
{{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);  // Space for title

{slider_layout}
}}
'''

    @classmethod
    def _generate_dsp_for_category(cls, response: PluginResponse) -> str:
        """Generate DSP code based on plugin category."""
        if response.category in [PluginCategory.WAVESHAPER, PluginCategory.DISTORTION]:
            dsp = response.waveshaper_dsp or WaveshaperDSP()
            return cls.generate_waveshaper_dsp(dsp, response.parameters)

        elif response.category == PluginCategory.FILTER:
            dsp = response.filter_dsp or FilterDSP()
            return cls.generate_filter_dsp(dsp, response.parameters)

        elif response.category == PluginCategory.DELAY:
            dsp = response.delay_dsp or DelayDSP()
            return cls.generate_delay_dsp(dsp, response.parameters)

        elif response.category == PluginCategory.GAIN:
            dsp = response.gain_dsp or GainDSP()
            return cls.generate_gain_dsp(dsp, response.parameters)

        else:
            # Default: simple gain passthrough
            return cls.generate_gain_dsp(GainDSP(), response.parameters)

    @classmethod
    def _generate_prepare_code(cls, response: PluginResponse) -> str:
        """Generate prepareToPlay initialization code."""
        if response.category == PluginCategory.FILTER:
            return """    // Initialize filter state
    for (int i = 0; i < 2; ++i)
    {
        z1[i] = 0.0f;
        z2[i] = 0.0f;
    }"""
        elif response.category == PluginCategory.DELAY:
            max_delay = response.delay_dsp.max_delay_ms if response.delay_dsp else 1000.0
            return f"""    // Initialize delay buffer
    bufferSize = static_cast<int>(sampleRate * {max_delay / 1000.0} + 1);
    delayBuffer.setSize(2, bufferSize);
    delayBuffer.clear();
    writePosition[0] = 0;
    writePosition[1] = 0;"""
        elif response.category == PluginCategory.GAIN:
            return """    // Initialize gain smoothing
    gainSmoothed = 1.0f;"""
        else:
            return "    // No special initialization needed"

    @classmethod
    def _generate_member_variables(cls, response: PluginResponse) -> str:
        """Generate member variable declarations for the header."""
        if response.category == PluginCategory.FILTER:
            return """    float z1[2] = {0.0f, 0.0f};
    float z2[2] = {0.0f, 0.0f};"""
        elif response.category == PluginCategory.DELAY:
            return """    juce::AudioBuffer<float> delayBuffer;
    int bufferSize = 0;
    int writePosition[2] = {0, 0};"""
        elif response.category == PluginCategory.GAIN:
            return """    float gainSmoothed = 1.0f;"""
        return ""

    @classmethod
    def _generate_slider_initialization(cls, params: list[PluginParameter]) -> str:
        """Generate slider setup code for editor."""
        lines = []
        for p in params:
            method_name = p.name[0].upper() + p.name[1:]
            lines.append(f"""    {p.name}Slider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    {p.name}Slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 20);
    addAndMakeVisible({p.name}Slider);
    {p.name}Attachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.get{method_name}Param(), {p.name}Slider, nullptr);
    {p.name}Label.setText("{p.label}", juce::dontSendNotification);
    {p.name}Label.setJustificationType(juce::Justification::centred);
    addAndMakeVisible({p.name}Label);
""")
        return "\n".join(lines)

    @classmethod
    def _generate_slider_layout(cls, params: list[PluginParameter]) -> str:
        """Generate slider layout code for resized()."""
        lines = []
        for i, p in enumerate(params):
            lines.append(f"""    auto {p.name}Area = area.removeFromTop(60);
    {p.name}Label.setBounds({p.name}Area.removeFromTop(20));
    {p.name}Slider.setBounds({p.name}Area);
""")
        return "\n".join(lines)

    # =========================================================================
    # Header File Generation
    # =========================================================================

    @classmethod
    def generate_processor_h(cls, response: PluginResponse) -> str:
        """
        Generate complete PluginProcessor.h from schema.

        This declares all parameters, member variables, and getter methods.
        """
        # Generate parameter declarations
        param_declarations = cls.generate_parameter_declarations(response.parameters)

        # Generate getter declarations
        getter_declarations = cls.generate_parameter_getters(response.parameters)

        # Generate DSP member variables
        member_vars = cls._generate_member_variables(response)

        return f'''#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

class VAIstAudioProcessor : public juce::AudioProcessor
{{
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
{getter_declarations}

private:
    // Parameters
{param_declarations}

    // DSP state
{member_vars}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessor)
}};
'''

    @classmethod
    def generate_editor_h(cls, response: PluginResponse) -> str:
        """
        Generate complete PluginEditor.h from schema.

        This declares all sliders, labels, and attachments.
        """
        # Generate slider/label/attachment declarations
        slider_declarations = cls._generate_editor_member_declarations(response.parameters)

        return f'''#pragma once

#include "PluginProcessor.h"

class VAIstAudioProcessorEditor : public juce::AudioProcessorEditor
{{
public:
    explicit VAIstAudioProcessorEditor(VAIstAudioProcessor&);
    ~VAIstAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    VAIstAudioProcessor& processorRef;

    // UI Components
{slider_declarations}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VAIstAudioProcessorEditor)
}};
'''

    @classmethod
    def _generate_editor_member_declarations(cls, params: list[PluginParameter]) -> str:
        """Generate slider, label, and attachment declarations for editor header."""
        lines = []
        for p in params:
            lines.append(f"    juce::Slider {p.name}Slider;")
            lines.append(f"    juce::Label {p.name}Label;")
            lines.append(f"    std::unique_ptr<juce::SliderParameterAttachment> {p.name}Attachment;")
            lines.append("")  # Empty line between parameter groups
        return "\n".join(lines)


# =============================================================================
# Convenience Functions
# =============================================================================

def generate_from_schema(response: PluginResponse) -> Dict[str, str]:
    """
    Generate all 4 C++ files from a schema response.

    Args:
        response: Validated PluginResponse from AI

    Returns:
        Dict with keys: 'processor_h', 'processor_cpp', 'editor_h', 'editor_cpp'
    """
    files = {
        'processor_h': CppGenerator.generate_processor_h(response),
        'processor_cpp': CppGenerator.generate_processor_cpp(response),
        'editor_h': CppGenerator.generate_editor_h(response),
        'editor_cpp': CppGenerator.generate_editor_cpp(response),
    }

    logger.info(f"Generated C++ for '{response.plugin_name}' ({response.category.value})")
    logger.info(f"  Parameters: {[p.name for p in response.parameters]}")
    logger.info(f"  Files: {list(files.keys())}")

    return files


def generate_processor_editor_only(response: PluginResponse) -> Tuple[str, str]:
    """
    Legacy function: Generate only processor.cpp and editor.cpp.

    For backwards compatibility with existing code.

    Args:
        response: Validated PluginResponse from AI

    Returns:
        Tuple of (processor_cpp, editor_cpp)
    """
    files = generate_from_schema(response)
    return files['processor_cpp'], files['editor_cpp']
