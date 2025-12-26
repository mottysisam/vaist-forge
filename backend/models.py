"""
vAIst Data Models
Pydantic schemas for request/response validation and task state.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
from enum import Enum
import uuid


class TaskStatus(str, Enum):
    """Task lifecycle states."""
    PENDING = "pending"
    SYNTHESIZING = "synthesizing"  # AI generating code
    PUSHING = "pushing"  # Pushing to GitHub
    BUILDING = "building"  # GitHub Actions running
    VALIDATING = "validating"  # pluginval testing
    SUCCESS = "success"
    FAILED = "failed"


# =============================================================================
# Request/Response Models
# =============================================================================


class GenerateRequest(BaseModel):
    """Request body for plugin generation."""
    prompt: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Natural language description of the VST plugin",
        json_schema_extra={
            "examples": [
                "A distortion plugin with a 'Heat' knob and a 500Hz high-pass filter",
                "A simple delay effect with feedback and mix controls",
            ]
        },
    )


class GenerateResponse(BaseModel):
    """Response body for plugin generation."""
    task_id: str
    status: TaskStatus
    message: str


class DownloadUrls(BaseModel):
    """Download URLs for compiled artifacts."""
    windows: Optional[str] = None
    macos: Optional[str] = None


class StatusResponse(BaseModel):
    """Response body for status polling."""
    task_id: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    commit_sha: Optional[str] = None
    workflow_run_id: Optional[int] = None
    workflow_url: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    download_urls: Optional[DownloadUrls] = None
    plugin_id: Optional[str] = None  # Unique 4-char plugin ID (e.g., "X7K2")


# =============================================================================
# Internal Task State
# =============================================================================


class TaskState(BaseModel):
    """Internal task state for tracking generation progress."""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prompt: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # GitHub tracking
    commit_sha: Optional[str] = None
    workflow_run_id: Optional[int] = None

    # Error handling
    error_message: Optional[str] = None
    retry_count: int = 0

    # Generated code (for potential repair)
    generated_code: Optional[Dict[str, str]] = None  # {"processor": "...", "editor": "..."}

    # Artifact downloads (populated on SUCCESS)
    download_urls: Optional[Dict[str, str]] = None  # {"windows": "url", "macos": "url"}
    plugin_id: Optional[str] = None  # Unique 4-char plugin ID (e.g., "X7K2")

    class Config:
        # Allow mutation for updates
        frozen = False
