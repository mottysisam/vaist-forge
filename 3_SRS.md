This Software Requirements Specification (SRS) serves as the definitive technical blueprint for your "One-Click AI VST3 Generator" as of late 2025. It integrates the JUCE 8 framework, AI code synthesis, and cloud compilation into a single product.
1. Introduction
Purpose: To define the full technical and operational requirements for a web-based platform that generates, compiles, and delivers VST3 audio plugins from natural language prompts.
Scope: The system includes a web frontend, an AI orchestration backend, and a cross-platform cloud compilation cluster.
2. Functional Requirements (FR)
FR-1: User Interface & Experience
1.1 Text-to-Plugin Input: The system must provide a natural language input field with a 500-character limit for plugin descriptions.
1.2 Real-time Status Tracker: The UI must display the current state of the build: Generating Code → Compiling (Windows/Mac) → Validating → Ready.
1.3 User Dashboard: Registered users must have a library to view and re-download their previously generated plugins.
FR-2: AI Orchestration Engine
2.1 Context Management: The system must inject the user’s prompt into a pre-defined "Senior Audio Developer" system prompt to ensure C++/JUCE 8 compatibility.
2.2 Code Validation: Before sending code to the compiler, the backend must run a basic syntax check (linter) to ensure the AI hasn't returned broken or malicious C++ code.
FR-3: Automated Compilation (The Forge)
3.1 Multi-Platform Support: The system must output a .vst3 for Windows (x64) and a universal binary for macOS (Intel/Apple Silicon).
3.2 Headless Build Execution: Builds must run using CMake in a headless environment (GitHub Actions or Docker).
3.3 Plugin Identity: Every plugin must be assigned a unique four-character manufacturer and plugin code to avoid ID conflicts in the user’s DAW.
3. Non-Functional Requirements (NFR)
NFR-1: Performance & Speed
1.1 Latency: The total time from "Submit" to "Download Available" must be under 120 seconds.
1.2 Concurrency: The backend must support at least 5 simultaneous compilation jobs using a queuing system (e.g., Redis or RabbitMQ).
NFR-2: Security
2.1 Code Sandboxing: AI-generated code must be compiled in an isolated container to prevent "code injection" attacks on the host server.
2.2 API Protection: All calls to the LLM (OpenAI/Anthropic) and GitHub must be authenticated via encrypted environment variables.
NFR-3: Quality & Compatibility
3.1 Stability: 100% of generated plugins must successfully pass the Steinberg VST3 Validator.
3.2 High-Performance Rendering: Every plugin must default to JUCE 8’s hardware-accelerated rendering (Direct2D for Windows, Metal for Mac) to ensure 0% GUI lag.
4. System Architecture (Technical Stack)
Frontend: Next.js hosted on Vercel.
Backend: Python/FastAPI or Node.js for orchestration.
AI Model: GPT-4o or Claude 3.5 Sonnet (API-driven).
Compilation: GitHub Actions Runners (for free macOS/Windows environments) or AWS EC2 for dedicated scaling.
Storage: AWS S3 for storing the final .zip files containing the plugins.
5. Database Schema (High-Level)
Entity	Fields
User	ID, Email, Password (Hashed), Subscription Status
Plugin	ID, UserID, Prompt, CodeSnippet, BinaryURL, BuildStatus
BuildLog	ID, PluginID, ErrorMessage, CompileTime
6. Acceptance Criteria
A user can type "Create a volume knob" and receive a working Windows .vst3 file within 2 minutes.
The generated plugin can be opened in Ableton Live 12 or FL Studio 2025 without crashing.
The plugin’s parameters are fully automatable within the DAW.
To support both Windows and macOS, you must use a Matrix Build strategy in your GitHub Actions workflow. This allows a single push to trigger parallel compilation jobs on both operating systems. 
1. Multi-Platform Build Configuration
As of 2025, the most efficient way to handle this is to update your .github/workflows/build.yml file to use the strategy: matrix feature. 
yaml
jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            artifact_name: MyPlugin-Windows
            extension: .vst3
          - os: macos-latest
            artifact_name: MyPlugin-MacOS
            extension: .vst3 # or .component for AU
    runs-on: ${{ matrix.os }}
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          submodules: true

      - name: Build Plugin
        run: |
          cmake -B build -G "${{ matrix.os == 'windows-latest' && 'Visual Studio 17 2022' || 'Xcode' }}"
          cmake --build build --config Release

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: build/**/${{ matrix.artifact_name }}${{ matrix.extension }}
Use code with caution.

2. Crucial macOS Requirements
Building for macOS in 2025 involves specific steps to ensure the plugin is actually usable on someone else's computer:
Universal Binaries: For modern compatibility, you should target both arm64 (Apple Silicon) and x86_64 (Intel). In JUCE 8, you can set this in your CMakeLists.txt using:
set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64").
Signing & Notarization: macOS requires plugins to be digitally signed by an Apple Developer account ($99/year). Without this, users will see a "damaged file" warning.
Runner Multipliers: Be aware that GitHub hosted macOS runners often consume minutes at a higher rate (e.g., 10x multiplier) compared to Linux. As of January 1, 2026, GitHub is updating these rates, but public repositories remain free. 
3. VST3 File Structure Differences
Windows: The output is typically a .vst3 bundle directory or a flat file located in C:\Program Files\Common Files\VST3.
macOS: The output is always a bundle (a folder appearing as a single file) located in /Library/Audio/Plug-Ins/VST3. 
4. Implementation Steps
Update the "Forge": Replace your single-OS build script with the matrix version above.
Verify CMake: Ensure your CMakeLists.txt uses generic paths that both Visual Studio (Windows) and Xcode (Mac) can understand.
Standalone Testing: Use a local Mac or a self-hosted runner to test the macOS build, as build issues on Mac can be harder to debug remotely. 
