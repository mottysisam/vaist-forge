# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vAIst** - An AI-powered one-click VST3 plugin generator that transforms natural language prompts into compiled, DAW-ready audio plugins. Users describe a plugin in plain English and receive a compiled .vst3 binary within 60-120 seconds.

- **Repository:** https://github.com/mottysisam/vaist-forge.git
- **Plugin Code:** `VAI1` (4-char VST ID for DAW registration)
- **Current State:** Documentation complete, ready for Phase 1 implementation (Cloud Forge)

## Architecture

The system is a **Distributed Event-Driven Pipeline** with four main components:

```
User Prompt → Portal (Next.js) → Orchestrator (FastAPI) → LLM (GPT-4o/Claude) →
Generated C++ → GitHub Push → GitHub Actions CI/CD → Windows/Mac Builds →
VST3 Validator → S3 Storage → Download URL → User
```

### Components

1. **The Portal** - Next.js frontend on Vercel for prompt submission and real-time build status
2. **The Orchestrator** - FastAPI Python backend for authentication, LLM integration, and GitHub automation via PyGithub
3. **The Synthesis Engine** - GPT-4o or Claude 3.5 Sonnet translates natural language to JUCE 8 C++
4. **The Forge** - GitHub Actions with parallel Windows/macOS runners for compilation

### Code Generation Strategy

AI generates code for specific "hot zones" in a static JUCE 8 template:
- `PluginProcessor.cpp` - Audio processing logic (`processBlock`)
- `PluginEditor.cpp` - UI layout (`resized()`)

Template uses placeholder markers: `/* AI_PARAMETER_START */`, `/* AI_DSP_LOGIC_START */`, `/* AI_UI_LAYOUT_START */`

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, React, Vercel |
| Backend API | FastAPI (Python) |
| AI Model | GPT-4o or Claude 3.5 Sonnet |
| Plugin Framework | JUCE 8 (C++) |
| Build System | CMake 3.24+ with FetchContent |
| CI/CD | GitHub Actions (Windows + macOS matrix) |
| Compilers | MSVC 2022 (Windows), Xcode 15+ (macOS) |
| Storage | AWS S3 |
| Database | PostgreSQL (Supabase) |

## Development Phases

### Phase 1: Infrastructure & Cloud Forge (START HERE)
The first technical action should be setting up the GitHub Actions Matrix. Once you have a green "Success" checkmark on a manual Windows/Mac build, you have proven the most difficult 50% of the project.

1. Create GitHub repo with JUCE 8 structure (`/Source`, `/Resources`)
2. Configure CMake with FetchContent (auto-downloads JUCE)
3. Enable GPU rendering: `JUCE_DIRECT2D=1` (Win), `JUCE_METAL=1` (Mac)
4. Setup `.github/workflows/build.yml` for parallel builds
5. Verify artifact upload works

### Phase 2: AI Orchestration
- FastAPI backend with OpenAI/Anthropic integration
- System prompt engineering for JUCE-compliant C++ output
- Regex parsing to extract code from markdown responses
- PyGithub automation for branching/committing/pushing
- Self-repair loop: feed compiler errors back to AI (max 3 retries)

### Phase 3: Frontend & Delivery
- Next.js portal with text-entry and progress status bar
- WebSocket/polling for real-time build logs
- S3 integration with 24-hour signed URLs

### Phase 4: QA & Launch
- Steinberg VST3 Validator testing (10+ plugin types)
- DAW compatibility: Ableton Live 12, FL Studio 2025, Logic Pro 11
- Security audit (no network access during AI-code compilation)

## Project Structure

```
vaist-forge/
├── CMakeLists.txt                  # JUCE 8 + performance flags
├── Source/
│   ├── PluginProcessor.cpp/h       # AI-generated DSP
│   └── PluginEditor.cpp/h          # AI-generated UI
├── .github/workflows/
│   └── build.yml                   # Matrix build (Win + Mac)
├── backend/
│   ├── orchestrator.py             # FastAPI app
│   ├── ai_synthesizer.py           # LLM prompt engineering
│   ├── github_manager.py           # PyGithub automation
│   └── requirements.txt
├── frontend/
│   ├── app/                        # Next.js app directory
│   └── package.json
└── docs/                           # Architecture docs
```

## Key CMake Configuration

The CMake template must be "relocation-proof" - uses FetchContent to download JUCE automatically:

```cmake
include(FetchContent)
FetchContent_Declare(juce GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG origin/master)
FetchContent_MakeAvailable(juce)
```

Critical flags:
- `JUCE_DIRECT2D=1` - Windows hardware acceleration
- `JUCE_METAL=1` - macOS hardware acceleration
- `/arch:AVX2` (MSVC) / `-march=native` (Unix) - SIMD optimization
- `COPY_PLUGIN_AFTER_BUILD=FALSE` - Required for cloud builds

## Python Backend Dependencies

```bash
pip install openai PyGithub fastapi python-dotenv
```

Required environment variables:
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`
- `DATABASE_URL` (Supabase PostgreSQL)
- `AWS_S3_BUCKET`, `AWS_CREDENTIALS`

## Build State Machine

```
PENDING → SYNTHESIZING → BUILDING → VALIDATING → SUCCESS/FAILED
```

Self-repair on failure:
1. Extract compiler error message
2. Re-prompt LLM: "Fix this C++ error: [error details]"
3. Retry build (max 3 retries)
4. Return success or final error log

## Documentation Reference

| File | Purpose |
|------|---------|
| `1_BRD.md` | Business requirements & scope |
| `1_PRD.md` | Product features & user stories |
| `2_HLD.md` | High-level system architecture |
| `3_LLD.md` | Low-level technical specs |
| `3_MVB.md` | Minimum viable build guide |
| `4_CMAKE_CONF.md` | CMake template with JUCE 8 |
| `4_CROSS_PLATFORM_EXAMPLE.md` | GitHub Actions matrix build |
| `5_AI_EXAMPLE.md` | AI prompt engineering examples |
| `6_BACKEND_Example.md` | Python orchestrator example |
| `DEVELOPMENT_CHECKLIST.md` | Implementation roadmap |

## Performance Targets

- Build success rate: 90%+
- Compile time: <120 seconds (target <100s)
- Binary size: <5MB per plugin
- Concurrent build limit: 10/user/hour
