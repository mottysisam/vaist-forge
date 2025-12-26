This Product Requirements Document (PRD) serves as the "source of truth" for the development team in late 2025. It bridges the high-level business goals (BRD) and the technical specs (FRS) into a set of actionable product features and user stories.
1. Product Vision
InstantVST is a generative AI platform that empowers creators to "talk their plugins into existence." It eliminates the technical overhead of C++ development, providing a "one-click" bridge from creative idea to a professional VST3/AU binary.
2. User Personas
"The Tinkerer" (Primary): A bedroom producer who wants a specific sound (e.g., "a lo-fi filter that crackles like vinyl") but lacks the coding skills to build it.
"The Content Creator": A streamer needing a custom branded audio utility for their microphone chain.
"The Pro Dev": An audio engineer using the tool to rapidly prototype DSP algorithms before manual optimization.
3. Core Product Features (The Roadmap)
Phase 1: The "One-Click" Core (MVP)
Natural Language Workspace: A clean, distraction-free chat interface where users describe their plugin.
The "Forge" Compilation Pipeline: Automated Windows (x64) and macOS (Universal) build system using GitHub Actions and JUCE 8.
Universal VST3 Delivery: Delivery of a validated, DAW-ready .vst3 file.
Smart Parameter Mapping: AI automatically maps controls (knobs/sliders) to the UI based on the logic it writes.
Phase 2: Visual & UX Enhancements
Live UI Preview: A non-functional, web-based visual mockup of what the plugin's interface will look like before the user hits "Compile."
Custom Skinning: Ability to prompt for aesthetic changes (e.g., "Make the UI look like a rusty 1980s guitar pedal").
Preset Management: Ability for the AI to generate 5-10 default presets for the plugin.
Phase 3: Community & Advanced Logic
Plugin Gallery: A public feed where users can share their AI prompts and the resulting plugins.
Iterative Refinement: A "Chat-to-Modify" feature where users can say, "Now add a bypass switch," to an existing build.
4. User Stories
ID	User Role	Requirement	Goal/Value
US.1	Producer	I want to describe a "shimmering reverb" in plain English.	So I don't have to learn C++ to get a unique sound.
US.2	Producer	I want a plugin that works on my Mac M3 and my Windows PC.	So I can use my tools across all my studio machines.
US.3	Creator	I want the compilation process to take less than 2 minutes.	So I don't lose my creative flow while waiting for software.
US.4	Pro Dev	I want to see the error log if a build fails.	So I can adjust my prompt to fix specific DSP issues.
5. Non-Functional Requirements (Performance & Safety)
Stability (The "Crash-Free" Guarantee): Every plugin must pass the Steinberg VST3 Validator before it is offered for download.
Latency: The plugin's internal audio latency must be reported correctly to the DAW (automatic PDC).
Security: The backend must sanitize all AI-generated code to prevent "Shell Injection" or malicious file system access during the compilation phase.
6. Success Metrics (KPIs)
Build Success Rate: >90% of user prompts result in a successful, validated binary.
Time-to-Binary: Average time from "Generate" to "Download" should be <100 seconds.
Retention: % of users who generate a second plugin within 7 days.
7. Risks & Mitigations
Risk: The AI generates code that is syntactically correct but sounds "broken" (e.g., loud digital noise).
Mitigation: Implement a "Safety Limiter" module in the JUCE template that prevents audio levels from exceeding 0dB.
Risk: High cost of macOS runners in the cloud.
Mitigation: Implement a "Credit" or "Subscription" system to cover the higher cost of Mac hardware-based compilation.
Next Steps for the Team
Backend: Finalize the Python "Orchestrator" script to handle the OpenAI → GitHub bridge.
DevOps: Finalize the "High-Performance" JUCE 8 CMake template.
Frontend: Build the "Build Progress" dashboard in Next.js.
