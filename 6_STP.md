This Software Test Plan (STP) defines the validation protocols for the AI-generated VST3 plugins as of late 2025. The plan focuses on ensuring that every AI-synthesized binary is technically compliant, audio-safe, and ready for use in professional DAWs.
1. Testing Objectives
Technical Compliance: Ensure 100% adherence to the Steinberg VST3 standard.
Stability: Verify that plugins load and unload in host applications without memory leaks or crashes.
Audio Integrity: Guarantee that AI-generated DSP math does not produce illegal digital values (NaN/Infinity) or excessive clipping. 
2. Automated Testing Pipeline (The CI/CD Suite)
Every build triggered by the Forge must pass three levels of automated testing before the user receives a download link.
Level 1: The Steinberg VST3 Validator
The industry-standard command-line tool is run immediately after compilation. 
Test Case 1.1: Parameter Initialization. Checks if the AI-generated parameters (knobs/sliders) are correctly exposed to the host.
Test Case 1.2: Scan & Instantiate. Verifies the host can find the plugin and create an instance in memory.
Test Case 1.3: Component Separation. Validates that the UI (Editor) and Processing (Processor) are properly separated as per the VST3 spec. 
Level 2: Pluginval (Cross-Platform Stress Test)
A secondary, more rigorous validation tool from Tracktion that tests "edge cases". 
Test Case 2.1: Buffer Size Agnosticism. Tests the plugin with varying buffer sizes (from 32 to 2048 samples) to ensure the AI's math is sample-accurate.
Test Case 2.2: Thread Safety. Checks for race conditions when parameters are modulated rapidly by the DAW. 
Level 3: Audio Safety Guard
A custom Python script analyzes the plugin's behavior in a headless host.
Test Case 3.1: Silence Test. Ensures the plugin does not produce noise when no audio is present.
Test Case 3.2: Clipping Check. Verifies the AI has implemented a 0dB "ceiling" to protect user ears and speakers.
3. Manual Regression Testing (The Studio Suite)
Performed weekly by the QA team on a "Master Build" of the templates to ensure 2025 DAW compatibility. 
Platform 	Host Environment (2025 Versions)	Primary Focus
Windows 11	Ableton Live 12, FL Studio 2025	Parameter automation and UI scaling.
macOS 15	Logic Pro 11 (via AU), Bitwig Studio 5	Apple Silicon (M3/M4) performance and Metal rendering.
Cross-Platform	Reaper 7	Scripted stress testing of multiple plugin instances.
4. Test Environment Requirements
Hardware: GitHub Actions Runners (Windows 2025, macOS 15).
Software: Steinberg VST3 SDK 3.7.12+ and CMake 3.31+.
Artifact Retention: Test logs are kept for 7 days for AI "self-correction" analysis in case of failures. 
5. Pass/Fail Criteria
Critical: Failure to pass the vst3validator results in an immediate build rejection and a trigger for the AI's "Self-Repair Loop."
Warning: Minor UI glitches (e.g., misaligned text) are logged but do not block the build, instead flagged for the next "AI Refinement" pass.
