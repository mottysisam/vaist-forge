"""
vAIst Template Manager
Provides pre-built JUCE 8 templates for different plugin types.
AI only fills in the DSP logic, not the entire file.
"""

import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class PluginType(str, Enum):
    """Supported plugin template types."""
    GAIN = "gain"           # Simple volume/gain control
    WAVESHAPER = "waveshaper"  # Distortion/saturation
    FILTER = "filter"       # EQ/filter effects
    DELAY = "delay"         # Time-based effects
    GENERIC = "generic"     # Fallback for unknown types


@dataclass
class PluginTemplate:
    """A plugin template with placeholders for AI-generated logic."""
    plugin_type: PluginType
    processor_template: str
    editor_template: str
    # Parameters available to the AI
    available_params: list[str]
    # Constraints for the AI
    constraints: list[str]


# Logic injection markers
LOGIC_START = "// === AI_LOGIC_START ==="
LOGIC_END = "// === AI_LOGIC_END ==="


class TemplateManager:
    """Manages plugin templates and logic injection."""

    # Keywords to detect plugin type from user prompt
    TYPE_KEYWORDS = {
        PluginType.GAIN: ["gain", "volume", "level", "amplitude", "loudness"],
        PluginType.WAVESHAPER: ["distort", "overdrive", "saturation", "fuzz", "clip", "waveshap", "crunch", "drive"],
        PluginType.FILTER: ["filter", "eq", "equalizer", "lowpass", "highpass", "bandpass", "cutoff", "resonance"],
        PluginType.DELAY: ["delay", "echo", "reverb", "time", "feedback"],
    }

    @classmethod
    def detect_plugin_type(cls, prompt: str) -> PluginType:
        """
        Detect the best plugin type from user prompt.

        Args:
            prompt: User's plugin description

        Returns:
            Most appropriate PluginType
        """
        prompt_lower = prompt.lower()

        # Count keyword matches for each type
        scores = {}
        for plugin_type, keywords in cls.TYPE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in prompt_lower)
            if score > 0:
                scores[plugin_type] = score

        if scores:
            best_type = max(scores, key=scores.get)
            logger.info(f"Detected plugin type: {best_type.value} (score: {scores[best_type]})")
            return best_type

        logger.info("No specific type detected, using GENERIC template")
        return PluginType.GENERIC

    @classmethod
    def get_template(cls, plugin_type: PluginType) -> PluginTemplate:
        """
        Get the template for a specific plugin type.

        Args:
            plugin_type: Type of plugin to generate

        Returns:
            PluginTemplate with processor and editor code
        """
        templates = {
            PluginType.GAIN: cls._get_gain_template(),
            PluginType.WAVESHAPER: cls._get_waveshaper_template(),
            PluginType.FILTER: cls._get_filter_template(),
            PluginType.DELAY: cls._get_delay_template(),
            PluginType.GENERIC: cls._get_generic_template(),
        }
        return templates.get(plugin_type, cls._get_generic_template())

    @classmethod
    def inject_logic(
        cls,
        template: str,
        ai_logic: str
    ) -> str:
        """
        Inject AI-generated logic into template.

        Args:
            template: Template with AI_LOGIC markers
            ai_logic: AI-generated code to inject

        Returns:
            Complete code with logic injected
        """
        # Find the marker region
        pattern = rf"{re.escape(LOGIC_START)}.*?{re.escape(LOGIC_END)}"

        # Clean the AI logic (remove any markers if AI included them)
        clean_logic = ai_logic.strip()
        clean_logic = clean_logic.replace(LOGIC_START, "").replace(LOGIC_END, "")

        # Build replacement with proper indentation
        replacement = f"{LOGIC_START}\n        {clean_logic}\n        {LOGIC_END}"

        result = re.sub(pattern, replacement, template, flags=re.DOTALL)
        return result

    @classmethod
    def extract_logic_from_response(cls, ai_response: str) -> Optional[str]:
        """
        Extract just the logic block from AI response.

        The AI should return only the inner-loop code.
        """
        # Try to find code between markers
        pattern = rf"{re.escape(LOGIC_START)}\s*(.*?)\s*{re.escape(LOGIC_END)}"
        match = re.search(pattern, ai_response, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Try to find code in cpp block
        pattern = r"```(?:cpp|c\+\+)?\s*\n?(.*?)```"
        match = re.search(pattern, ai_response, re.DOTALL | re.IGNORECASE)
        if match:
            code = match.group(1).strip()
            # Remove any boilerplate the AI might have added
            # Just keep the actual DSP logic
            lines = code.split('\n')
            logic_lines = []
            for line in lines:
                # Skip includes, class definitions, function signatures
                stripped = line.strip()
                if stripped.startswith('#include') or stripped.startswith('class '):
                    continue
                if stripped.startswith('void ') or stripped.startswith('float '):
                    continue
                if stripped == '{' or stripped == '}':
                    continue
                logic_lines.append(line)
            return '\n'.join(logic_lines).strip()

        # Return the whole response if no markers found
        return ai_response.strip()

    # =========================================================================
    # Template Definitions
    # =========================================================================

    @classmethod
    def _get_gain_template(cls) -> PluginTemplate:
        """Simple gain/volume plugin template."""
        processor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(gainParameter = new juce::AudioParameterFloat(
        juce::ParameterID{"gain", 1}, "Gain", 0.0f, 2.0f, 1.0f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
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

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter value
    float gain = gainParameter->get();

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            ''' + LOGIC_START + '''
            // Apply gain to each sample
            channelData[sample] *= gain;
            ''' + LOGIC_END + '''
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(gainParameter->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *gainParameter = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
'''

        editor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(300, 200);

    gainSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    gainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    gainSlider.setRange(0.0, 2.0, 0.01);
    gainSlider.setValue(p.getGainParameter()->get());
    gainSlider.onValueChange = [this] {
        processorRef.getGainParameter()->setValueNotifyingHost(
            processorRef.getGainParameter()->getNormalisableRange().convertTo0to1(
                static_cast<float>(gainSlider.getValue())));
    };
    addAndMakeVisible(gainSlider);

    gainLabel.setText("Gain", juce::dontSendNotification);
    gainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(gainLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Gain", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);
    gainLabel.setBounds(area.removeFromTop(20));
    gainSlider.setBounds(area.reduced(20));
}
'''

        return PluginTemplate(
            plugin_type=PluginType.GAIN,
            processor_template=processor,
            editor_template=editor,
            available_params=["gain (0.0 to 2.0)", "channelData[sample]", "numSamples"],
            constraints=[
                "Only modify channelData[sample] inside the loop",
                "Do NOT declare new class members",
                "Use local variables only",
            ],
        )

    @classmethod
    def _get_waveshaper_template(cls) -> PluginTemplate:
        """Distortion/waveshaper plugin template."""
        processor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(driveParam = new juce::AudioParameterFloat(
        juce::ParameterID{"drive", 1}, "Drive", 1.0f, 20.0f, 1.0f));
    addParameter(mixParam = new juce::AudioParameterFloat(
        juce::ParameterID{"mix", 1}, "Mix", 0.0f, 1.0f, 1.0f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
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

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter values
    float drive = driveParam->get();
    float mix = mixParam->get();

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            float dry = channelData[sample];
            float wet = dry;

            ''' + LOGIC_START + '''
            // Apply waveshaping/distortion
            // wet = input after distortion processing
            wet = std::tanh(dry * drive) / std::tanh(drive);
            ''' + LOGIC_END + '''

            // Mix dry/wet
            channelData[sample] = dry * (1.0f - mix) + wet * mix;
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(driveParam->get());
    stream.writeFloat(mixParam->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *driveParam = stream.readFloat();
    *mixParam = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
'''

        editor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(350, 250);

    // Drive knob
    driveSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    driveSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    driveSlider.setRange(1.0, 20.0, 0.1);
    driveSlider.setValue(p.driveParam->get());
    driveSlider.onValueChange = [this] {
        processorRef.driveParam->setValueNotifyingHost(
            processorRef.driveParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(driveSlider.getValue())));
    };
    addAndMakeVisible(driveSlider);

    driveLabel.setText("Drive", juce::dontSendNotification);
    driveLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(driveLabel);

    // Mix knob
    mixSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    mixSlider.setRange(0.0, 1.0, 0.01);
    mixSlider.setValue(p.mixParam->get());
    mixSlider.onValueChange = [this] {
        processorRef.mixParam->setValueNotifyingHost(
            static_cast<float>(mixSlider.getValue()));
    };
    addAndMakeVisible(mixSlider);

    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Distortion", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);

    auto knobArea = area;
    auto leftArea = knobArea.removeFromLeft(knobArea.getWidth() / 2);
    auto rightArea = knobArea;

    driveLabel.setBounds(leftArea.removeFromTop(20));
    driveSlider.setBounds(leftArea.reduced(10));

    mixLabel.setBounds(rightArea.removeFromTop(20));
    mixSlider.setBounds(rightArea.reduced(10));
}
'''

        return PluginTemplate(
            plugin_type=PluginType.WAVESHAPER,
            processor_template=processor,
            editor_template=editor,
            available_params=[
                "drive (1.0 to 20.0) - distortion amount",
                "mix (0.0 to 1.0) - dry/wet mix",
                "dry - the original sample value",
                "wet - your processed output (modify this)",
            ],
            constraints=[
                "Only modify the 'wet' variable",
                "Use std::tanh, std::atan, std::sin for waveshaping",
                "Do NOT declare new class members",
                "The dry/wet mixing is handled outside your code",
            ],
        )

    @classmethod
    def _get_filter_template(cls) -> PluginTemplate:
        """Filter/EQ plugin template with biquad."""
        processor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(cutoffParam = new juce::AudioParameterFloat(
        juce::ParameterID{"cutoff", 1}, "Cutoff", 20.0f, 20000.0f, 1000.0f));
    addParameter(resonanceParam = new juce::AudioParameterFloat(
        juce::ParameterID{"resonance", 1}, "Resonance", 0.1f, 10.0f, 0.707f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 0.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;
    juce::ignoreUnused(samplesPerBlock);

    // Reset filter states
    for (int ch = 0; ch < 2; ++ch)
    {
        z1[ch] = 0.0f;
        z2[ch] = 0.0f;
    }
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

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter values
    float cutoff = cutoffParam->get();
    float Q = resonanceParam->get();
    float sampleRate = static_cast<float>(currentSampleRate);

    // Calculate biquad coefficients for lowpass filter
    float omega = 2.0f * juce::MathConstants<float>::pi * cutoff / sampleRate;
    float sinOmega = std::sin(omega);
    float cosOmega = std::cos(omega);
    float alpha = sinOmega / (2.0f * Q);

    float b0 = (1.0f - cosOmega) / 2.0f;
    float b1 = 1.0f - cosOmega;
    float b2 = (1.0f - cosOmega) / 2.0f;
    float a0 = 1.0f + alpha;
    float a1 = -2.0f * cosOmega;
    float a2 = 1.0f - alpha;

    // Normalize coefficients
    b0 /= a0; b1 /= a0; b2 /= a0;
    a1 /= a0; a2 /= a0;

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            float input = channelData[sample];
            float output;

            ''' + LOGIC_START + '''
            // Biquad filter processing (Direct Form II Transposed)
            output = b0 * input + z1[channel];
            z1[channel] = b1 * input - a1 * output + z2[channel];
            z2[channel] = b2 * input - a2 * output;
            ''' + LOGIC_END + '''

            channelData[sample] = output;
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(cutoffParam->get());
    stream.writeFloat(resonanceParam->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *cutoffParam = stream.readFloat();
    *resonanceParam = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
'''

        editor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(350, 250);

    // Cutoff knob
    cutoffSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    cutoffSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    cutoffSlider.setRange(20.0, 20000.0, 1.0);
    cutoffSlider.setSkewFactorFromMidPoint(1000.0);
    cutoffSlider.setValue(p.cutoffParam->get());
    cutoffSlider.onValueChange = [this] {
        processorRef.cutoffParam->setValueNotifyingHost(
            processorRef.cutoffParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(cutoffSlider.getValue())));
    };
    addAndMakeVisible(cutoffSlider);

    cutoffLabel.setText("Cutoff", juce::dontSendNotification);
    cutoffLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(cutoffLabel);

    // Resonance knob
    resonanceSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    resonanceSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    resonanceSlider.setRange(0.1, 10.0, 0.01);
    resonanceSlider.setValue(p.resonanceParam->get());
    resonanceSlider.onValueChange = [this] {
        processorRef.resonanceParam->setValueNotifyingHost(
            processorRef.resonanceParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(resonanceSlider.getValue())));
    };
    addAndMakeVisible(resonanceSlider);

    resonanceLabel.setText("Resonance", juce::dontSendNotification);
    resonanceLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(resonanceLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Filter", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);

    auto knobArea = area;
    auto leftArea = knobArea.removeFromLeft(knobArea.getWidth() / 2);
    auto rightArea = knobArea;

    cutoffLabel.setBounds(leftArea.removeFromTop(20));
    cutoffSlider.setBounds(leftArea.reduced(10));

    resonanceLabel.setBounds(rightArea.removeFromTop(20));
    resonanceSlider.setBounds(rightArea.reduced(10));
}
'''

        return PluginTemplate(
            plugin_type=PluginType.FILTER,
            processor_template=processor,
            editor_template=editor,
            available_params=[
                "input - current sample",
                "output - filtered result (set this)",
                "z1[channel], z2[channel] - filter state variables",
                "b0, b1, b2, a1, a2 - pre-calculated biquad coefficients",
            ],
            constraints=[
                "Coefficients are already calculated for lowpass",
                "Use Direct Form II Transposed for stability",
                "State variables z1, z2 are per-channel",
            ],
        )

    @classmethod
    def _get_delay_template(cls) -> PluginTemplate:
        """Delay/echo plugin template."""
        processor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter(delayTimeParam = new juce::AudioParameterFloat(
        juce::ParameterID{"delayTime", 1}, "Delay Time", 0.01f, 1.0f, 0.3f));
    addParameter(feedbackParam = new juce::AudioParameterFloat(
        juce::ParameterID{"feedback", 1}, "Feedback", 0.0f, 0.95f, 0.5f));
    addParameter(mixParam = new juce::AudioParameterFloat(
        juce::ParameterID{"mix", 1}, "Mix", 0.0f, 1.0f, 0.5f));
}

VAIstAudioProcessor::~VAIstAudioProcessor() {}

const juce::String VAIstAudioProcessor::getName() const { return JucePlugin_Name; }
bool VAIstAudioProcessor::acceptsMidi() const { return false; }
bool VAIstAudioProcessor::producesMidi() const { return false; }
bool VAIstAudioProcessor::isMidiEffect() const { return false; }
double VAIstAudioProcessor::getTailLengthSeconds() const { return 1.0; }
int VAIstAudioProcessor::getNumPrograms() { return 1; }
int VAIstAudioProcessor::getCurrentProgram() { return 0; }
void VAIstAudioProcessor::setCurrentProgram(int) {}
const juce::String VAIstAudioProcessor::getProgramName(int) { return {}; }
void VAIstAudioProcessor::changeProgramName(int, const juce::String&) {}

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;
    juce::ignoreUnused(samplesPerBlock);

    // Allocate delay buffer (max 2 seconds)
    int maxDelaySamples = static_cast<int>(sampleRate * 2.0);
    delayBuffer.setSize(2, maxDelaySamples);
    delayBuffer.clear();
    writePosition = 0;
}

void VAIstAudioProcessor::releaseResources()
{
    delayBuffer.setSize(0, 0);
}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter values
    float delayTime = delayTimeParam->get();
    float feedback = feedbackParam->get();
    float mix = mixParam->get();

    int delaySamples = static_cast<int>(delayTime * currentSampleRate);
    int bufferSize = delayBuffer.getNumSamples();

    for (int channel = 0; channel < totalNumInputChannels; ++channel)
    {
        auto* channelData = buffer.getWritePointer(channel);
        auto* delayData = delayBuffer.getWritePointer(channel);
        int numSamples = buffer.getNumSamples();

        for (int sample = 0; sample < numSamples; ++sample)
        {
            float dry = channelData[sample];
            float wet;

            // Calculate read position
            int readPos = writePosition - delaySamples;
            if (readPos < 0) readPos += bufferSize;

            ''' + LOGIC_START + '''
            // Read from delay buffer
            wet = delayData[readPos];

            // Write to delay buffer with feedback
            delayData[writePosition] = dry + wet * feedback;
            ''' + LOGIC_END + '''

            // Mix dry/wet
            channelData[sample] = dry * (1.0f - mix) + wet * mix;

            // Advance write position
            writePosition = (writePosition + 1) % bufferSize;
        }
    }
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::MemoryOutputStream stream(destData, true);
    stream.writeFloat(delayTimeParam->get());
    stream.writeFloat(feedbackParam->get());
    stream.writeFloat(mixParam->get());
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    *delayTimeParam = stream.readFloat();
    *feedbackParam = stream.readFloat();
    *mixParam = stream.readFloat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VAIstAudioProcessor();
}
'''

        editor = '''#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(400, 250);

    // Delay Time knob
    delaySlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    delaySlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    delaySlider.setRange(0.01, 1.0, 0.001);
    delaySlider.setValue(p.delayTimeParam->get());
    delaySlider.onValueChange = [this] {
        processorRef.delayTimeParam->setValueNotifyingHost(
            processorRef.delayTimeParam->getNormalisableRange().convertTo0to1(
                static_cast<float>(delaySlider.getValue())));
    };
    addAndMakeVisible(delaySlider);

    delayLabel.setText("Time", juce::dontSendNotification);
    delayLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(delayLabel);

    // Feedback knob
    feedbackSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    feedbackSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    feedbackSlider.setRange(0.0, 0.95, 0.01);
    feedbackSlider.setValue(p.feedbackParam->get());
    feedbackSlider.onValueChange = [this] {
        processorRef.feedbackParam->setValueNotifyingHost(
            static_cast<float>(feedbackSlider.getValue() / 0.95));
    };
    addAndMakeVisible(feedbackSlider);

    feedbackLabel.setText("Feedback", juce::dontSendNotification);
    feedbackLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(feedbackLabel);

    // Mix knob
    mixSlider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    mixSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    mixSlider.setRange(0.0, 1.0, 0.01);
    mixSlider.setValue(p.mixParam->get());
    mixSlider.onValueChange = [this] {
        processorRef.mixParam->setValueNotifyingHost(
            static_cast<float>(mixSlider.getValue()));
    };
    addAndMakeVisible(mixSlider);

    mixLabel.setText("Mix", juce::dontSendNotification);
    mixLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(mixLabel);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor() {}

void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(getLookAndFeel().findColour(juce::ResizableWindow::backgroundColourId));
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("vAIst Delay", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(40);

    int knobWidth = area.getWidth() / 3;

    auto timeArea = area.removeFromLeft(knobWidth);
    delayLabel.setBounds(timeArea.removeFromTop(20));
    delaySlider.setBounds(timeArea.reduced(5));

    auto fbArea = area.removeFromLeft(knobWidth);
    feedbackLabel.setBounds(fbArea.removeFromTop(20));
    feedbackSlider.setBounds(fbArea.reduced(5));

    mixLabel.setBounds(area.removeFromTop(20));
    mixSlider.setBounds(area.reduced(5));
}
'''

        return PluginTemplate(
            plugin_type=PluginType.DELAY,
            processor_template=processor,
            editor_template=editor,
            available_params=[
                "dry - original sample",
                "wet - delayed sample (read from buffer)",
                "delayData[readPos] - read from delay buffer",
                "delayData[writePosition] - write to delay buffer",
                "feedback - feedback amount (0 to 0.95)",
            ],
            constraints=[
                "Read position is already calculated",
                "Write position advances automatically after the loop",
                "Dry/wet mixing is handled outside your code",
            ],
        )

    @classmethod
    def _get_generic_template(cls) -> PluginTemplate:
        """Generic/fallback template - same as gain but with more flexibility."""
        return cls._get_gain_template()
