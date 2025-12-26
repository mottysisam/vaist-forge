This Functional Requirements Document (FRD) translates the "One-Click" vision into specific technical requirements. It defines how the system will actually work, from the user's text prompt to the delivery of the compiled VST3 binary.
1. System Architecture Overview
The system will operate as a Cloud-Based Compiler Pipeline. It consists of three primary modules:
Frontend (UI/UX): Web-based portal for prompt input and download.
Logic Engine (AI LLM): Generates C++/JUCE code based on the prompt.
The Forge (Cloud Build Server): Compiles the code into a binary using headless build tools.
2. Functional Requirements
FR-1: Natural Language Processing (The Input)
Prompt Parsing: The system must interpret audio-specific terminology (e.g., "cutoff," "saturation," "wet/dry," "shimmer").
Requirement Translation: The LLM must map user intent to a specific JUCE Template (e.g., Gain, Filter, or Delay).
Error Handling: If a prompt is ambiguous (e.g., "make it sound blue"), the system must prompt the user for clarification before starting the build.
FR-2: Automated Code Generation (The Brain)
JUCE Boilerplate Injection: The AI will not write the entire project; it will inject code into a pre-vetted, stable JUCE Framework template.
Parameter Mapping: The system must automatically generate the AudioProcessorValueTreeState (APVTS) to link the UI knobs to the internal DSP logic.
DSP Logic Generation: The AI must generate the specific math inside the processBlock function.
Constraint: The code must be restricted to standard C++ libraries and JUCE modules to ensure compilation success.
FR-3: Dynamic UI Generation (The Face)
Layout Engine: The system must automatically place sliders and buttons on the plugin window based on the number of parameters the AI generated.
Visual Styling: In Phase 1, use a "Generic Modern" skin. Future iterations will allow prompt-based styling (e.g., "make it look like 70s hardware").
FR-4: Cloud Compilation Pipeline (The Forge)
Platform Support: The backend must trigger two parallel build jobs:
Windows Build: Using MSVC (Microsoft Visual C++) via GitHub Actions or a Docker container.
macOS Build: Using Clang/Xcode tools (required for Intel and Apple Silicon compatibility).
Headless Build Process: Use CMake to manage the project configuration and build commands without a GUI.
Verification: The system must run the VST3 SDK Validator on the output file before presenting the download link.
FR-5: Delivery & Storage
Binary Delivery: The final .vst3 file must be zipped and provided via a unique, time-limited URL.
Cloud Storage: Generated source code and binaries should be stored for 24 hours to allow for re-downloads or minor adjustments.
3. Technical Constraints & Performance
Compile Time: Total time from "Submit" to "Download" should not exceed 120 seconds.
Output Size: The generated VST3 should be optimized for size (typically under 10MB for simple effects).
DAW Compatibility: Must be compatible with VST3-capable hosts (Ableton Live 11+, FL Studio 21+, Logic Pro via AU wrapper, etc.).
4. User Workflow (The "One-Click" Path)
User Input: "Create a tube-style distortion with a high-pass filter."
AI Analysis: System identifies "Distortion" and "High-Pass Filter" modules.
Code Synthesis: AI writes the specific C++ code for those two modules and defines three sliders (Drive, Tone, Cutoff).
The Build: The server compiles the code for the requested operating system.
Delivery: A "Download Your Plugin" button appears.
5. Preliminary Tech Stack (Recommendation)
AI Model: GPT-4o or Claude 3.5 Sonnet (via API).
Development Framework: JUCE 8 (latest 2025 version).
Automation: GitHub Actions for Runners or AWS EC2 Mac/Windows instances.
Frontend: React or Next.js for the web interface.

