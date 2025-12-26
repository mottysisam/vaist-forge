"""
vAIst AI Prompts
System prompts and templates for JUCE 8 code generation.

Supports two modes:
1. Template-based: AI only generates DSP logic to inject into pre-built templates
2. Full generation: AI generates complete files (fallback for unsupported types)

Includes Architect Verification Gate integration to prevent AI hallucinations
by providing exact variable names that are available in each template.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.template_manager import PluginTemplate

# Import CodeVerifier for exact identifier lists
from backend.code_verifier import CodeVerifier


# =============================================================================
# Template-Based System Prompt (Logic Injection Mode)
# =============================================================================

TEMPLATE_SYSTEM_PROMPT = """You are the vAIst DSP Coder, an expert in audio DSP algorithms.

TASK: Generate ONLY the DSP logic code for the marked section of a VST plugin.
The plugin template and boilerplate are already provided - you just fill in the math.

CRITICAL: Output ONLY the inner-loop DSP code. No includes, no class definitions, no function signatures.

=== EXACT IDENTIFIERS YOU MUST USE ===
{exact_identifiers}

=== TEMPLATE CONTEXT ===
{available_params}

=== CONSTRAINTS ===
{constraints}

=== CRITICAL: IDENTIFIER RULES ===
1. Use ONLY the exact variable names listed above
2. DO NOT invent new variable names or use variations like:
   - "mixParameter" (WRONG) → use "mixParam" (CORRECT)
   - "driveValue" (WRONG) → use "drive" (CORRECT)
   - "gainAmount" (WRONG) → use "gain" (CORRECT)
   - "samples" (WRONG) → use "numSamples" (CORRECT)
3. Parameters use ->get() to read values: driveParam->get()
4. Variables are already declared, use them directly: channelData[sample]

=== OUTPUT FORMAT ===
Output ONLY the C++ code that goes between the markers. Example:

```cpp
// Your DSP logic here
channelData[sample] = processedValue;
```

DO NOT include:
- #include statements
- Class definitions
- Function signatures
- The marker comments themselves

Just the raw DSP math that processes audio samples.
"""


# =============================================================================
# Full Generation System Prompt (Fallback Mode)
# =============================================================================

SYSTEM_PROMPT = """You are the vAIst DSP Coder, an expert C++ Audio Developer specializing in the JUCE 8 framework.

TASK: Generate complete replacement code for PluginProcessor.cpp and PluginEditor.cpp based on the user's plugin description.

TECHNICAL CONSTRAINTS:
- Framework: JUCE 8 with C++17
- Parameters: Use AudioParameterFloat/Int/Choice with direct pointer assignment
- DSP: Optimize for efficiency, use juce::dsp module when possible (filters, gain, etc.)
- Memory: Use std::unique_ptr, NEVER use raw new/delete
- Thread Safety: NEVER access UI components from processBlock

REQUIRED CLASS NAMES (DO NOT CHANGE):
- Processor class: VAIstAudioProcessor
- Editor class: VAIstAudioProcessorEditor

REQUIRED INCLUDES:
- PluginProcessor.cpp must include: "PluginProcessor.h" and "PluginEditor.h"
- PluginEditor.cpp must include: "PluginProcessor.h" and "PluginEditor.h"

OUTPUT FORMAT:
You MUST output exactly two complete code blocks with these EXACT labels:
```cpp Source/PluginProcessor.cpp
[Complete file content - ALL code including includes, constructor, processBlock, etc.]
```

```cpp Source/PluginEditor.cpp
[Complete file content - ALL code including includes, constructor, paint, resized, etc.]
```

CRITICAL REQUIREMENTS:
1. Output COMPLETE file contents (not snippets or partial code)
2. Include ALL necessary functions (constructor, destructor, processBlock, paint, resized, etc.)
3. The code MUST compile without modification
4. Use the EXACT class names: VAIstAudioProcessor, VAIstAudioProcessorEditor
5. Include JucePlugin_Name macro reference in getName()
6. Include createPluginFilter() function at the end of PluginProcessor.cpp

PARAMETER PATTERN:
```cpp
// In constructor
addParameter(myParameter = new juce::AudioParameterFloat(
    "param_id",    // Parameter ID (lowercase, no spaces)
    "Param Name",  // Display name
    0.0f,          // Minimum
    1.0f,          // Maximum
    0.5f           // Default
));
```

SLIDER ATTACHMENT PATTERN:
```cpp
// In editor constructor
myAttachment = std::make_unique<juce::SliderParameterAttachment>(
    *processorRef.getMyParameter(),
    mySlider,
    nullptr
);
```

EXAMPLE STRUCTURE FOR PluginProcessor.cpp:
```cpp
#include "PluginProcessor.h"
#include "PluginEditor.h"

VAIstAudioProcessor::VAIstAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    // Add parameters here
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

void VAIstAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    // Initialize DSP here
}

void VAIstAudioProcessor::releaseResources() {}

bool VAIstAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
    return true;
}

void VAIstAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) {
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;
    // DSP processing here
}

bool VAIstAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* VAIstAudioProcessor::createEditor() { return new VAIstAudioProcessorEditor(*this); }

void VAIstAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    // Save state
}

void VAIstAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
    // Load state
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new VAIstAudioProcessor();
}
```

Now generate the code based on the user's plugin description.
"""


# =============================================================================
# Repair Prompt Template
# =============================================================================

REPAIR_PROMPT_TEMPLATE = """The following C++ code failed to compile.

COMPILER ERROR:
{error_message}

ORIGINAL CODE ({filename}):
```cpp
{original_code}
```

Fix the compilation error and output the corrected COMPLETE file.
Wrap your output in:
```cpp {filename}
[corrected complete code]
```

IMPORTANT:
- Output the COMPLETE file, not just the fixed section
- Maintain all existing functionality
- Use the exact class names: VAIstAudioProcessor, VAIstAudioProcessorEditor
"""


# =============================================================================
# Helper Functions
# =============================================================================

def get_generation_prompt(user_prompt: str) -> str:
    """
    Combine system prompt with user request.

    Args:
        user_prompt: User's plugin description

    Returns:
        Complete prompt for AI
    """
    return f"{SYSTEM_PROMPT}\n\nUSER REQUEST:\n{user_prompt}"


def get_repair_prompt(error_message: str, original_code: str, filename: str) -> str:
    """
    Create repair prompt from error and original code.

    Args:
        error_message: Compiler error output
        original_code: The code that failed to compile
        filename: Source file name

    Returns:
        Complete repair prompt
    """
    return REPAIR_PROMPT_TEMPLATE.format(
        error_message=error_message,
        original_code=original_code,
        filename=filename
    )


def get_template_prompt(
    template: "PluginTemplate",
    user_prompt: str,
    plugin_type: str = None
) -> str:
    """
    Generate a prompt for template-based logic injection.

    Includes exact identifier lists from CodeVerifier to prevent AI hallucinations.

    Args:
        template: The PluginTemplate with available params and constraints
        user_prompt: User's plugin description
        plugin_type: Optional plugin type for CodeVerifier context (e.g., "waveshaper")

    Returns:
        Complete prompt asking AI to generate only the DSP logic
    """
    # Format available params as bullet list
    params_str = "\n".join(f"- {p}" for p in template.available_params)

    # Format constraints as bullet list
    constraints_str = "\n".join(f"- {c}" for c in template.constraints)

    # Get exact identifiers from CodeVerifier (Architect Verification Gate)
    exact_ids_str = ""
    if plugin_type:
        exact_ids_str = CodeVerifier.get_context_prompt(plugin_type)
    else:
        # Fallback: use template's available_params
        exact_ids_str = "Use the variables listed in TEMPLATE CONTEXT below."

    # Build the system prompt
    system = TEMPLATE_SYSTEM_PROMPT.format(
        exact_identifiers=exact_ids_str,
        available_params=params_str,
        constraints=constraints_str,
    )

    return f"{system}\n\nUSER REQUEST:\n{user_prompt}"


def get_template_repair_prompt(
    error_message: str,
    original_logic: str,
    template: "PluginTemplate",
) -> str:
    """
    Create a repair prompt for template-based code.

    Args:
        error_message: Compiler error output
        original_logic: The DSP logic that was injected
        template: The template being used

    Returns:
        Prompt to fix the DSP logic
    """
    params_str = "\n".join(f"- {p}" for p in template.available_params)
    constraints_str = "\n".join(f"- {c}" for c in template.constraints)

    return f"""The DSP logic you provided caused a compilation error.

COMPILER ERROR:
{error_message}

ORIGINAL LOGIC:
```cpp
{original_logic}
```

AVAILABLE VARIABLES:
{params_str}

CONSTRAINTS:
{constraints_str}

Fix the error and output ONLY the corrected DSP logic code.
Output in a code block:
```cpp
// Fixed logic here
```
"""
