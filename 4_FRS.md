This Functional Requirements Specification (FRS) provides the granular "logic-level" detail required for developers to build the system behaviors. It defines exactly what happens at every stage of the "One-Click" process.
1. Workflow Segment: User Input & Logic Parsing
Behavior ID: FRS-101 (The Semantic Interpreter)
Trigger: User clicks "Generate" on the frontend.
Logic:
The system must sanitize input to remove non-ASCII characters.
The backend must append a "Code Context Wrapper" (System Prompt) that defines the JUCE 8 API version and prohibited C++ libraries (to prevent build errors).
Operation: The script sends a POST request to the LLM (e.g., GPT-4o) and waits for a structured JSON response containing two strings: processor_cpp and editor_cpp.
2. Workflow Segment: Automated Repository Management
Behavior ID: FRS-201 (The GitHub Orchestrator)
Trigger: Successful receipt of code from the AI.
Logic:
Branch Isolation: The script must create a unique Git branch for every build (e.g., build/user-123-timestamp).
File Injection:
Overwrite Source/PluginProcessor.cpp with the AI's "Brain" code.
Overwrite Source/PluginEditor.cpp with the AI's "GUI" code.
Commit & Push: The script must perform an authenticated push. This action must trigger the GitHub Actions workflow via the on: push event.
3. Workflow Segment: The Cross-Platform Build (The Forge)
Behavior ID: FRS-301 (The Matrix Compiler)
Logic (Parallel Execution):
Windows Runner:
Initialize MSVC 2022.
Run cmake -B build -G "Visual Studio 17 2022" -A x64.
Compile to .vst3.
macOS Runner:
Initialize Xcode 15/16.
Run cmake -B build -G Xcode -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64".
Compile to .vst3 (Universal Binary).
Error Handling: If either compiler returns a non-zero exit code (failure), the system must scrape the error log (e.g., "Missing semicolon on line 42") and send it back to the AI for a "Self-Correction Pass."
4. Workflow Segment: Validation & Packaging
Behavior ID: FRS-401 (Quality Assurance)
Logic:
The system must run the Steinberg VST3 Validator command-line tool on the freshly built binaries.
Artifact Zipping: If validation passes, the Windows and Mac files must be zipped into a single archive: [PluginName]_v1.0.zip.
Cloud Handoff: The .zip is uploaded to an S3 bucket with a signed URL valid for 24 hours.
5. Workflow Segment: UI Feedback Loop
Behavior ID: FRS-501 (Status Polling)
Behavior: The Frontend must poll the Backend every 3 seconds to update the user on the current build step.
Status Definitions:
IDLE: Waiting for input.
SYNTHESIZING: AI is writing code.
COMPILING: GitHub Actions are running.
VALIDATING: Running Steinberg tests.
COMPLETED: Download link active.
FAILED: Error details displayed with a "Try Again" button.
Summary of System Behavior (2025 Standard)
Step	Component	Input	Action	Output
1	Web Frontend	Prompt String	POST to /generate	Task ID
2	Python Backend	Prompt String	Call LLM API	C++ Source Code
3	GitHub API	C++ Code	Push to Branch	Build Trigger
4	GitHub Runner	CMake Script	Compile x64 & ARM	.vst3 Files
5	S3 Storage	.zip File	Upload & URL Sign	Download Link
Next Steps: The Development Sprint
Backend Setup: Configure the Python script to handle the GitHub API authentication.
AI Fine-tuning: Run 10-20 "test prompts" (Gain, Pan, Distortion, Delay) to ensure the AI's C++ code matches the JUCE 8 template exactly.
Frontend Hookup: Connect the Next.js frontend to the Python backend.
