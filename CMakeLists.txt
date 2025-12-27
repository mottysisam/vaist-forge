cmake_minimum_required(VERSION 3.24)

# ============================================================================
# vAIst - AI-Powered VST3 Plugin Generator
# ============================================================================
project(vAIst VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# Fetch JUCE 8 (Zero Local Dependencies)
# ============================================================================
include(FetchContent)
FetchContent_Declare(
    juce
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG master
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(juce)

# ============================================================================
# Plugin Configuration
# ============================================================================
juce_add_plugin(vAIst
    COMPANY_NAME "vAIst"
    COMPANY_WEBSITE "https://github.com/mottysisam/vaist-forge"
    COMPANY_EMAIL "contact@vaist.ai"

    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE

    # Critical for Cloud Builds - do not copy locally
    COPY_PLUGIN_AFTER_BUILD FALSE

    # VST3 Identification (4-char codes)
    PLUGIN_MANUFACTURER_CODE vAIs
    PLUGIN_CODE VAI1

    # Build formats
    FORMATS VST3

    # Product naming
    PRODUCT_NAME "vAIst_Plugin"
)

# ============================================================================
# Source Files
# ============================================================================
target_sources(vAIst PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginProcessor.h
    Source/PluginEditor.cpp
    Source/PluginEditor.h
)

# ============================================================================
# JUCE Module Dependencies
# ============================================================================
target_link_libraries(vAIst
    PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_gui_basics
        juce::juce_graphics
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# ============================================================================
# Compile Definitions
# ============================================================================
target_compile_definitions(vAIst
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0

        # Hardware Acceleration (2025 Standards)
        JUCE_DIRECT2D=1    # Windows Direct2D rendering
        JUCE_METAL=1       # macOS Metal rendering
)

# ============================================================================
# Platform-Specific Optimization
# ============================================================================
if(MSVC)
    # Windows SIMD optimization
    target_compile_options(vAIst PRIVATE /arch:AVX2)
else()
    # macOS/Linux optimization
    target_compile_options(vAIst PRIVATE -O3)
endif()
