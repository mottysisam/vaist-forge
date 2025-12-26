"""
vAIst Schema-Based Generation

Strict Pydantic models that enforce exact coding standards.
The AI outputs structured JSON → Python generates perfect C++ code.

This eliminates 100% of AI typos in variable names, syntax, and coding conventions.

Philosophy:
- AI CANNOT write C++ code directly
- AI ONLY provides structured data (JSON)
- Python templates generate deterministic, error-free C++ code
"""

from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# Enums: Constrain AI to ONLY valid choices
# =============================================================================

class WaveshapingFunction(str, Enum):
    """Valid waveshaping functions - AI must choose from this list."""
    TANH = "tanh"
    ATAN = "atan"
    SOFT_CLIP = "soft_clip"
    HARD_CLIP = "hard_clip"
    SINE_FOLD = "sine_fold"
    CUBIC = "cubic"


class FilterType(str, Enum):
    """Valid filter types - AI must choose from this list."""
    LOWPASS = "lowpass"
    HIGHPASS = "highpass"
    BANDPASS = "bandpass"
    NOTCH = "notch"
    PEAK = "peak"
    LOWSHELF = "lowshelf"
    HIGHSHELF = "highshelf"


class PluginCategory(str, Enum):
    """Plugin categories - determines which template and DSP structure to use."""
    GAIN = "gain"
    WAVESHAPER = "waveshaper"
    DISTORTION = "distortion"
    FILTER = "filter"
    DELAY = "delay"
    COMPRESSOR = "compressor"
    REVERB = "reverb"
    TREMOLO = "tremolo"
    CHORUS = "chorus"


class ParameterUnit(str, Enum):
    """Valid parameter units for display."""
    PERCENT = "%"
    DB = "dB"
    MS = "ms"
    HZ = "Hz"
    RATIO = ":1"
    NONE = ""


# =============================================================================
# Parameter Schema: Exact structure for plugin parameters
# =============================================================================

class PluginParameter(BaseModel):
    """
    Strict schema for a single plugin parameter.

    The AI provides this data, Python generates the exact C++ code:
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        "param_id", "Param Label", min, max, default
    ));
    """

    # Internal C++ variable name - MUST be camelCase, no spaces
    name: str = Field(
        ...,
        min_length=2,
        max_length=32,
        pattern=r'^[a-z][a-zA-Z0-9]*$',
        description="Internal C++ variable name (camelCase, e.g., 'driveAmount')"
    )

    # Display label for UI
    label: str = Field(
        ...,
        min_length=1,
        max_length=24,
        description="Display name for the UI knob (e.g., 'Drive')"
    )

    # Value range
    min_value: float = Field(
        ...,
        ge=-100.0,
        le=100.0,
        alias="min",
        description="Minimum parameter value"
    )

    max_value: float = Field(
        ...,
        ge=-100.0,
        le=100.0,
        alias="max",
        description="Maximum parameter value"
    )

    default_value: float = Field(
        ...,
        alias="default",
        description="Default parameter value (must be between min and max)"
    )

    # Optional unit for display
    unit: ParameterUnit = Field(
        default=ParameterUnit.NONE,
        description="Unit suffix for display (%, dB, ms, Hz)"
    )

    # Skew factor for non-linear response (1.0 = linear)
    skew: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Skew factor for knob response (1.0 = linear)"
    )

    @field_validator('default_value')
    @classmethod
    def default_in_range(cls, v, info):
        """Ensure default is within min/max range."""
        min_val = info.data.get('min_value', 0.0)
        max_val = info.data.get('max_value', 1.0)
        if v < min_val or v > max_val:
            raise ValueError(f'default ({v}) must be between min ({min_val}) and max ({max_val})')
        return v

    class Config:
        populate_by_name = True


# =============================================================================
# DSP Logic Schemas: Structured DSP algorithm definitions
# =============================================================================

class GainDSP(BaseModel):
    """DSP configuration for gain plugins."""

    # Gain range in dB
    gain_range_db: float = Field(
        default=24.0,
        ge=6.0,
        le=60.0,
        description="Maximum gain range in dB"
    )

    # Whether to apply smoothing
    smoothing_enabled: bool = Field(
        default=True,
        description="Apply parameter smoothing to avoid clicks"
    )

    smoothing_time_ms: float = Field(
        default=20.0,
        ge=1.0,
        le=100.0,
        description="Smoothing time in milliseconds"
    )


class WaveshaperDSP(BaseModel):
    """DSP configuration for waveshaper/distortion plugins."""

    # Waveshaping function - AI MUST choose from enum
    waveshaping_function: WaveshapingFunction = Field(
        default=WaveshapingFunction.TANH,
        description="The waveshaping transfer function to use"
    )

    # Pre-gain multiplier range
    pre_gain_range: float = Field(
        default=10.0,
        ge=1.0,
        le=100.0,
        description="Maximum pre-gain multiplier before waveshaping"
    )

    # Post-gain compensation
    output_compensation: bool = Field(
        default=True,
        description="Automatically compensate output level"
    )

    # Dry/wet mix
    mix_enabled: bool = Field(
        default=True,
        description="Enable dry/wet mix control"
    )

    # Asymmetry for tube-like distortion
    asymmetry: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Asymmetric clipping (-1 to 1, 0 = symmetric)"
    )


class FilterDSP(BaseModel):
    """DSP configuration for filter plugins."""

    # Filter type - AI MUST choose from enum
    filter_type: FilterType = Field(
        default=FilterType.LOWPASS,
        description="The filter type to implement"
    )

    # Frequency range
    min_frequency_hz: float = Field(
        default=20.0,
        ge=10.0,
        le=100.0,
        description="Minimum cutoff frequency in Hz"
    )

    max_frequency_hz: float = Field(
        default=20000.0,
        ge=1000.0,
        le=22000.0,
        description="Maximum cutoff frequency in Hz"
    )

    # Resonance/Q range
    min_resonance: float = Field(
        default=0.5,
        ge=0.1,
        le=1.0,
        description="Minimum Q/resonance value"
    )

    max_resonance: float = Field(
        default=10.0,
        ge=1.0,
        le=30.0,
        description="Maximum Q/resonance value"
    )

    # Filter implementation
    use_biquad: bool = Field(
        default=True,
        description="Use biquad filter implementation"
    )


class DelayDSP(BaseModel):
    """DSP configuration for delay plugins."""

    # Maximum delay time
    max_delay_ms: float = Field(
        default=1000.0,
        ge=100.0,
        le=5000.0,
        description="Maximum delay time in milliseconds"
    )

    # Feedback range
    max_feedback: float = Field(
        default=0.9,
        ge=0.0,
        le=0.99,
        description="Maximum feedback amount (0-0.99)"
    )

    # Interpolation for smooth time changes
    interpolation_enabled: bool = Field(
        default=True,
        description="Enable interpolation for smooth delay time changes"
    )

    # Dry/wet mix
    mix_enabled: bool = Field(
        default=True,
        description="Enable dry/wet mix control"
    )

    # Stereo ping-pong
    ping_pong: bool = Field(
        default=False,
        description="Enable ping-pong stereo delay"
    )


# =============================================================================
# Complete Plugin Response Schema
# =============================================================================

class PluginResponse(BaseModel):
    """
    Complete structured response from AI.

    This is the ONLY format the AI can output.
    Python reads this and generates perfect C++ code.
    """

    # Plugin metadata
    plugin_name: str = Field(
        ...,
        min_length=3,
        max_length=32,
        description="Plugin display name (e.g., 'Warm Saturation')"
    )

    # Category determines which DSP template to use
    category: PluginCategory = Field(
        ...,
        description="Plugin category - determines DSP structure"
    )

    # User-facing description
    description: str = Field(
        default="",
        max_length=256,
        description="Brief plugin description"
    )

    # Parameters - the AI defines WHAT controls exist
    parameters: List[PluginParameter] = Field(
        ...,
        min_length=1,
        max_length=8,
        description="List of plugin parameters (1-8)"
    )

    # DSP configuration - category-specific, optional
    # Only one of these should be populated based on category
    gain_dsp: Optional[GainDSP] = Field(
        default=None,
        description="DSP config for gain plugins"
    )

    waveshaper_dsp: Optional[WaveshaperDSP] = Field(
        default=None,
        description="DSP config for waveshaper/distortion plugins"
    )

    filter_dsp: Optional[FilterDSP] = Field(
        default=None,
        description="DSP config for filter plugins"
    )

    delay_dsp: Optional[DelayDSP] = Field(
        default=None,
        description="DSP config for delay plugins"
    )

    @field_validator('parameters')
    @classmethod
    def unique_param_names(cls, v):
        """Ensure all parameter names are unique."""
        names = [p.name for p in v]
        if len(names) != len(set(names)):
            raise ValueError('All parameter names must be unique')
        return v


# =============================================================================
# Gemini Schema Export (for structured output)
# =============================================================================

def get_gemini_schema():
    """
    Generate the schema dict for Gemini's response_schema parameter.

    This tells Gemini exactly what JSON structure to output.
    """
    return {
        "type": "object",
        "properties": {
            "plugin_name": {
                "type": "string",
                "description": "Plugin display name"
            },
            "category": {
                "type": "string",
                "enum": [c.value for c in PluginCategory],
                "description": "Plugin category"
            },
            "description": {
                "type": "string",
                "description": "Brief plugin description"
            },
            "parameters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Internal C++ variable name (camelCase)"
                        },
                        "label": {
                            "type": "string",
                            "description": "Display name for UI"
                        },
                        "min": {
                            "type": "number",
                            "description": "Minimum value"
                        },
                        "max": {
                            "type": "number",
                            "description": "Maximum value"
                        },
                        "default": {
                            "type": "number",
                            "description": "Default value"
                        },
                        "unit": {
                            "type": "string",
                            "enum": [u.value for u in ParameterUnit],
                            "description": "Unit for display"
                        }
                    },
                    "required": ["name", "label", "min", "max", "default"]
                },
                "minItems": 1,
                "maxItems": 8
            },
            "waveshaper_dsp": {
                "type": "object",
                "properties": {
                    "waveshaping_function": {
                        "type": "string",
                        "enum": [f.value for f in WaveshapingFunction],
                        "description": "Waveshaping transfer function"
                    },
                    "pre_gain_range": {
                        "type": "number",
                        "description": "Maximum pre-gain multiplier"
                    },
                    "output_compensation": {
                        "type": "boolean",
                        "description": "Auto-compensate output level"
                    },
                    "mix_enabled": {
                        "type": "boolean",
                        "description": "Enable dry/wet mix"
                    },
                    "asymmetry": {
                        "type": "number",
                        "description": "Asymmetric clipping amount"
                    }
                }
            },
            "filter_dsp": {
                "type": "object",
                "properties": {
                    "filter_type": {
                        "type": "string",
                        "enum": [f.value for f in FilterType],
                        "description": "Filter type"
                    },
                    "min_frequency_hz": {
                        "type": "number",
                        "description": "Min cutoff frequency"
                    },
                    "max_frequency_hz": {
                        "type": "number",
                        "description": "Max cutoff frequency"
                    },
                    "min_resonance": {
                        "type": "number",
                        "description": "Min Q/resonance"
                    },
                    "max_resonance": {
                        "type": "number",
                        "description": "Max Q/resonance"
                    }
                }
            },
            "delay_dsp": {
                "type": "object",
                "properties": {
                    "max_delay_ms": {
                        "type": "number",
                        "description": "Max delay time in ms"
                    },
                    "max_feedback": {
                        "type": "number",
                        "description": "Max feedback (0-0.99)"
                    },
                    "ping_pong": {
                        "type": "boolean",
                        "description": "Enable ping-pong"
                    }
                }
            },
            "gain_dsp": {
                "type": "object",
                "properties": {
                    "gain_range_db": {
                        "type": "number",
                        "description": "Max gain range in dB"
                    },
                    "smoothing_enabled": {
                        "type": "boolean",
                        "description": "Apply parameter smoothing"
                    }
                }
            }
        },
        "required": ["plugin_name", "category", "parameters"]
    }


# =============================================================================
# Schema Prompt Generator
# =============================================================================

def get_schema_prompt() -> str:
    """
    Generate the prompt that tells the AI exactly what JSON to output.

    This is included in every generation request.
    """
    return """You MUST respond with a valid JSON object matching this EXACT structure:

{
  "plugin_name": "string (3-32 chars)",
  "category": "gain" | "waveshaper" | "distortion" | "filter" | "delay" | "compressor" | "reverb" | "tremolo" | "chorus",
  "description": "string (optional, max 256 chars)",
  "parameters": [
    {
      "name": "camelCaseVariableName",
      "label": "Display Label",
      "min": 0.0,
      "max": 1.0,
      "default": 0.5,
      "unit": "" | "%" | "dB" | "ms" | "Hz" | ":1"
    }
  ],
  "waveshaper_dsp": {  // Include if category is waveshaper/distortion
    "waveshaping_function": "tanh" | "atan" | "soft_clip" | "hard_clip" | "sine_fold" | "cubic",
    "pre_gain_range": 10.0,
    "output_compensation": true,
    "mix_enabled": true,
    "asymmetry": 0.0
  },
  "filter_dsp": {  // Include if category is filter
    "filter_type": "lowpass" | "highpass" | "bandpass" | "notch" | "peak" | "lowshelf" | "highshelf",
    "min_frequency_hz": 20.0,
    "max_frequency_hz": 20000.0,
    "min_resonance": 0.5,
    "max_resonance": 10.0
  },
  "delay_dsp": {  // Include if category is delay
    "max_delay_ms": 1000.0,
    "max_feedback": 0.9,
    "ping_pong": false
  },
  "gain_dsp": {  // Include if category is gain
    "gain_range_db": 24.0,
    "smoothing_enabled": true
  }
}

CRITICAL RULES:
1. Output ONLY valid JSON - no markdown, no explanation
2. Parameter "name" MUST be camelCase (e.g., "driveAmount", not "drive_amount")
3. Parameter "label" is the UI display name (e.g., "Drive Amount")
4. Include the appropriate *_dsp object based on the category
5. All number values must be valid floats
6. 1-8 parameters per plugin
"""
