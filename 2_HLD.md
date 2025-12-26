
This High-Level Design (HLD) provides a bird's-eye view of the system's structural components and how data flows from a user's thought to a downloadable binary. 
1. System Overview
The architecture is a Distributed Event-Driven Pipeline. It decouples the "creative synthesis" (AI) from the "mechanical assembly" (Compilation). 
2. Main Modules
A. The Portal (Web Frontend)
Role: User interface for prompt submission and progress monitoring.
Tech: Next.js (2025) with Vercel for high-availability hosting.
Responsibilities: Capturing user intent, display of build status via WebSockets, and providing the final S3 download link. 
B. The Orchestrator (Backend API)
Role: The system’s "Traffic Controller."
Tech: FastAPI (Python) for asynchronous task handling.
Responsibilities:
Authenticating users.
Interfacing with the AI Logic Generator (OpenAI/Anthropic).
Managing the GitHub repository via PyGithub. 
C. The Synthesis Engine (LLM Layer)
Role: Translating natural language to C++.
Tech: GPT-4o or Claude 3.5 Sonnet.
Responsibilities: Generating specific code blocks for the processBlock (audio math) and resized() (UI layout) functions based on the JUCE 8 framework. 
D. The Forge (Cloud Compilation Cluster)
Role: Converting code into machine-readable binaries.
Tech: GitHub Actions with parallel Runners (Windows-latest and MacOS-latest).
Responsibilities: Running the JUCE 8 CMake build process and executing the Steinberg VST3 Validator for quality assurance. 
3. Architecture Diagram (Conceptual Flow)
mermaid
graph LR
    User((User)) -->|Prompt| Portal[Web Portal]
    Portal -->|POST| API[Orchestrator API]
    API -->|Prompt + Template| LLM[AI Synthesis Engine]
    LLM -->|C++ Code| API
    API -->|Git Push| Repo[GitHub Source Repo]
    Repo -->|Trigger| Forge[Cloud Forge - CI/CD]
    Forge -->|Build Windows/Mac| S3[Storage Bucket]
    S3 -->|Signed URL| Portal
    Portal -->|Download| User
Use code with caution.

4. Key Component Interactions
State Management: The Orchestrator writes the current state (e.g., QUEUED, BUILDING) to a database (Supabase or PostgreSQL) so the user can see real-time updates.
Safety Interlocks: The Forge includes a "Pre-Compile Hook" that checks the code for malicious patterns (e.g., attempts to access the file system) before starting the compiler.
Hardware Acceleration: To ensure 2025 performance standards, the HLD mandates that the Forge must use the JUCE_DIRECT2D and JUCE_METAL flags during compilation. 
5. Technology Summary
Language: C++ (JUCE 8) for the plugin; Python for the backend.
Infrastructure: GitHub (Automation), AWS (Storage), Vercel (Hosting).
Build Tools: CMake 3.24+, MSVC 2022 (Win), Xcode 15+ (Mac). 
Next Step: With the HLD finalized, you are ready to begin the LLD (Low-Level Design), which defines the specific functions, variables, and internal logic for the Python Orchestrator and the C++ JUCE 8 Template. 
