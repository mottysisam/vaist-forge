# vAIst Forge

> **The intelligent companion for infinite sound.** A one-click AI generator transforming natural language into hardware-accelerated VST3 plugins via JUCE 8.

[![Build Status](https://github.com/mottysisam/vaist-forge/actions/workflows/build.yml/badge.svg)](https://github.com/mottysisam/vaist-forge/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What is vAIst?

vAIst is a "vending machine" for audio tools. Describe your plugin in plain English, and receive a compiled, DAW-ready `.vst3` binary — no C++ knowledge required.

```
"A distortion plugin with a 'Heat' knob and a 500Hz high-pass filter"
                              ↓
                    [vAIst Cloud Forge]
                              ↓
                  MyDistortion.vst3 (Windows + macOS)
```

## How It Works

```mermaid
graph LR
    A[User Prompt] --> B[vAIst Portal]
    B --> C[AI Synthesis Engine]
    C --> D[JUCE 8 C++ Code]
    D --> E[GitHub Actions CI/CD]
    E --> F[Windows + macOS Builds]
    F --> G[VST3 Validator]
    G --> H[Download Link]
```

1. **Describe** your plugin in natural language
2. **AI generates** professional JUCE 8 C++ code
3. **Cloud Forge** compiles for Windows and macOS simultaneously
4. **Download** your DAW-ready VST3 plugin

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Plugin Framework | JUCE 8 (C++) |
| AI Coder | Gemini 3 Flash (1M context, 220+ tok/sec) |
| AI Architect | Claude Opus 4.5 (templates, debugging) |
| Build System | CMake 3.24+ with FetchContent |
| CI/CD | GitHub Actions (Windows + macOS matrix) |
| Backend | FastAPI (Python) |
| Frontend | Next.js on Vercel |
| Storage | AWS S3 |

## VST3 Plugin Specs

- **Plugin Code:** `VAI1`
- **Manufacturer Code:** `vAIs`
- **Format:** VST3
- **Platforms:** Windows (x64), macOS (Intel + Apple Silicon)
- **Hardware Acceleration:** Direct2D (Win), Metal (macOS)

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| Documentation | BRD, PRD, HLD, LLD, SRS | ✅ Complete |
| Phase 1 | Cloud Forge (GitHub Actions) | 🚧 In Progress |
| Phase 2 | AI Orchestration (Backend) | ⏳ Pending |
| Phase 3 | Frontend Portal | ⏳ Pending |
| Phase 4 | QA & Launch | ⏳ Pending |

## Quick Start (Phase 1)

```bash
# Clone the repository
git clone https://github.com/mottysisam/vaist-forge.git
cd vaist-forge

# Push to trigger GitHub Actions build
git push origin main
```

The Cloud Forge will automatically compile for Windows and macOS. Check the **Actions** tab for build status and download artifacts.

## Documentation

Comprehensive technical specifications are available in the `/docs` directory:

- `1_BRD.md` — Business Requirements
- `1_PRD.md` — Product Requirements
- `2_HLD.md` — High-Level Architecture
- `3_LLD.md` — Low-Level Design
- `3_MVB.md` — Minimum Viable Build Guide
- `DEVELOPMENT_CHECKLIST.md` — Implementation Roadmap

## Performance Targets

- **Build Success Rate:** 90%+
- **Compile Time:** <120 seconds
- **Binary Size:** <5MB per plugin
- **DAW Compatibility:** Ableton Live 12, FL Studio 2025, Logic Pro 11

## Contributing

vAIst is currently in active development. Contributions welcome after Phase 1 completion.

## License

MIT License — See [LICENSE](LICENSE) for details.

---

**vAIst** — *Forge your sound, powered by AI.*
