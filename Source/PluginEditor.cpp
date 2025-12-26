#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
VAIstAudioProcessorEditor::VAIstAudioProcessorEditor(VAIstAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // ========================================================================
    // AI_UI_LAYOUT_START - Gain Slider Setup
    // ========================================================================

    // Configure the gain slider
    gainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    gainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
    gainSlider.setRange(0.0, 1.0, 0.01);
    addAndMakeVisible(gainSlider);

    // Attach slider to parameter (thread-safe)
    gainAttachment = std::make_unique<juce::SliderParameterAttachment>(
        *processorRef.getGainParameter(),
        gainSlider,
        nullptr
    );

    // Configure the label
    gainLabel.setText("Gain", juce::dontSendNotification);
    gainLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(gainLabel);

    // AI_UI_LAYOUT_END
    // ========================================================================

    // Set the plugin window size
    setSize(300, 200);
}

VAIstAudioProcessorEditor::~VAIstAudioProcessorEditor()
{
}

//==============================================================================
void VAIstAudioProcessorEditor::paint(juce::Graphics& g)
{
    // Fill background with a gradient
    g.fillAll(juce::Colour(0xff1a1a2e));

    // Draw title
    g.setColour(juce::Colours::white);
    g.setFont(juce::FontOptions(20.0f));
    g.drawFittedText("vAIst", getLocalBounds().removeFromTop(30),
                     juce::Justification::centred, 1);
}

void VAIstAudioProcessorEditor::resized()
{
    // ========================================================================
    // AI_UI_LAYOUT_START - Component Positioning
    // ========================================================================
    auto bounds = getLocalBounds();

    // Leave space for the title
    bounds.removeFromTop(30);

    // Center the gain control
    auto sliderArea = bounds.reduced(40);

    // Label at the top of the slider area
    gainLabel.setBounds(sliderArea.removeFromTop(20));

    // Slider takes the rest
    gainSlider.setBounds(sliderArea);

    // AI_UI_LAYOUT_END
    // ========================================================================
}
