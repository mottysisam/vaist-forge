"""
vAIst Configuration
Centralized configuration management with environment variable validation.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # AI Configuration
    GOOGLE_API_KEY: str  # Gemini 3 Flash (primary coder)
    ANTHROPIC_API_KEY: Optional[str] = None  # Claude Opus 4.5 (fallback)

    # GitHub Configuration
    GITHUB_TOKEN: str
    GITHUB_REPO: str = "mottysisam/vaist-forge"
    GITHUB_BRANCH: str = "main"

    # AI Model IDs
    GEMINI_MODEL: str = "gemini-2.0-flash"  # Use stable model for now
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Retry Configuration
    MAX_RETRY_ATTEMPTS: int = 3

    # Build Monitoring
    BUILD_POLL_INTERVAL_SECONDS: int = 5
    BUILD_TIMEOUT_SECONDS: int = 300  # 5 minutes

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance (lazy loaded)
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get or create settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
