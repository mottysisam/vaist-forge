"""
vAIst Backend - FastAPI Application
AI-powered VST3 plugin generator API.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.models import (
    GenerateRequest,
    GenerateResponse,
    StatusResponse,
    TaskStatus,
    DownloadUrls,
)
from backend.task_manager import task_manager
from backend.ai_synthesizer import AISynthesizer
from backend.github_manager import GitHubManager
from backend.bmad_orchestrator import BMADOrchestrator, BMADArtifacts
from backend.code_verifier import validate_header_consistency

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load settings
settings = get_settings()

# Initialize components (lazy - will be created on first request)
_ai_synthesizer: AISynthesizer | None = None
_github_manager: GitHubManager | None = None
_bmad_orchestrator: BMADOrchestrator | None = None

# Use BMAD v6 pipeline by default (set to False to use legacy single-agent)
# TEMPORARILY DISABLED: BMAD doesn't generate header files, causing build failures
# Schema-based mode (legacy pipeline) generates all 4 files correctly
USE_BMAD_PIPELINE = False


def get_ai_synthesizer() -> AISynthesizer:
    """Get or create AI synthesizer instance."""
    global _ai_synthesizer
    if _ai_synthesizer is None:
        _ai_synthesizer = AISynthesizer(settings)
    return _ai_synthesizer


def get_github_manager() -> GitHubManager:
    """Get or create GitHub manager instance."""
    global _github_manager
    if _github_manager is None:
        _github_manager = GitHubManager(settings)
    return _github_manager


def get_bmad_orchestrator() -> BMADOrchestrator:
    """Get or create BMAD orchestrator instance."""
    global _bmad_orchestrator
    if _bmad_orchestrator is None:
        _bmad_orchestrator = BMADOrchestrator()
    return _bmad_orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("=" * 60)
    logger.info("vAIst Backend starting...")
    logger.info(f"  Pipeline Mode: {'BMAD v6 (4-Phase)' if USE_BMAD_PIPELINE else 'Legacy (Single-Agent)'}")
    logger.info(f"  GitHub Repo: {settings.GITHUB_REPO}")
    logger.info(f"  Gemini Model: {settings.GEMINI_MODEL}")
    logger.info(f"  Claude Fallback: {'Enabled' if settings.ANTHROPIC_API_KEY else 'Disabled'}")
    logger.info("=" * 60)
    yield
    logger.info("vAIst Backend shutting down...")


app = FastAPI(
    title="vAIst API",
    description="AI-powered VST3 plugin generator. Describe your plugin in natural language and receive compiled binaries.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Background Task: Plugin Generation Pipeline
# =============================================================================


async def generate_plugin_task(task_id: str, prompt: str):
    """
    Background task for the complete plugin generation pipeline.

    Flow (BMAD v6): Analyst -> PM -> Architect -> Developer -> Push -> Build -> Monitor
    Flow (Legacy):  Synthesize -> Push -> Build -> Monitor
    """
    github_manager = get_github_manager()

    # Store BMAD artifacts for potential repair
    bmad_artifacts: BMADArtifacts | None = None

    try:
        # Step 1: Synthesize code with AI (BMAD or legacy)
        logger.info(f"[{task_id}] Starting code synthesis...")
        task_manager.update_task(task_id, status=TaskStatus.SYNTHESIZING)

        # Variables to hold header files (only populated by schema-based mode)
        processor_h = None
        editor_h = None

        if USE_BMAD_PIPELINE:
            # BMAD v6 Pipeline: 4-Phase Gated Pipeline
            logger.info(f"[{task_id}] Using BMAD v6 pipeline")
            bmad = get_bmad_orchestrator()
            processor_code, editor_code, error, bmad_artifacts = await bmad.run_pipeline(prompt)
        else:
            # Legacy single-agent approach (now with schema-based mode)
            logger.info(f"[{task_id}] Using legacy single-agent pipeline")
            ai_synthesizer = get_ai_synthesizer()
            processor_code, editor_code, processor_h, editor_h, error = await ai_synthesizer.generate_code(prompt)

        if error or not processor_code or not editor_code:
            logger.error(f"[{task_id}] Code synthesis failed: {error}")
            task_manager.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error_message=error or "Code generation failed",
            )
            return

        # Store generated code for potential repair
        generated_code = {"processor": processor_code, "editor": editor_code}
        if processor_h:
            generated_code["processor_h"] = processor_h
        if editor_h:
            generated_code["editor_h"] = editor_h

        task_manager.update_task(
            task_id,
            generated_code=generated_code,
        )
        logger.info(f"[{task_id}] Code synthesis complete (files: {list(generated_code.keys())})")

        # Step 1b: Validate header consistency BEFORE pushing
        # This catches undeclared identifier errors locally instead of wasting CI time
        is_consistent, consistency_errors = validate_header_consistency(
            processor_h, processor_code, editor_h, editor_code
        )

        if not is_consistent:
            # Header validation is ADVISORY only - log warnings but don't block
            # The JUCE_TYPES allowlist can't cover all inherited methods, so we
            # let CI be the final arbiter of correctness
            logger.warning(f"[{task_id}] Header consistency advisory: {len(consistency_errors)} potential issues")
            for err in consistency_errors[:5]:
                logger.warning(f"[{task_id}]   - {err}")
        else:
            logger.info(f"[{task_id}] Header consistency check PASSED")

        # Step 2: Push to GitHub
        logger.info(f"[{task_id}] Pushing to GitHub...")
        task_manager.update_task(task_id, status=TaskStatus.PUSHING)

        # Truncate prompt for commit message
        short_prompt = prompt[:50] + "..." if len(prompt) > 50 else prompt
        commit_sha, push_error = github_manager.push_code(
            processor_code,
            editor_code,
            commit_message=f"vAIst: {short_prompt}",
            processor_h=processor_h,  # Schema-based mode generates headers
            editor_h=editor_h,        # Schema-based mode generates headers
        )

        if push_error:
            logger.error(f"[{task_id}] GitHub push failed: {push_error}")
            task_manager.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error_message=push_error,
            )
            return

        logger.info(f"[{task_id}] Pushed to GitHub: {commit_sha}")

        # Step 3: Monitor build
        task_manager.update_task(
            task_id,
            status=TaskStatus.BUILDING,
            commit_sha=commit_sha,
        )

        # Poll for build completion
        poll_interval = settings.BUILD_POLL_INTERVAL_SECONDS
        timeout = settings.BUILD_TIMEOUT_SECONDS
        max_polls = timeout // poll_interval

        logger.info(f"[{task_id}] Monitoring build (timeout: {timeout}s)...")

        for poll in range(max_polls):
            await asyncio.sleep(poll_interval)

            status, run_id, url = github_manager.get_workflow_status(commit_sha)

            if run_id:
                task_manager.update_task(task_id, workflow_run_id=run_id)

            if status == "success":
                logger.info(f"[{task_id}] Build successful!")
                # Fetch artifact download URLs
                artifact_urls = github_manager.get_artifact_urls(run_id)
                task_manager.update_task(
                    task_id,
                    status=TaskStatus.SUCCESS,
                    workflow_run_id=run_id,
                    download_urls=artifact_urls if artifact_urls else None,
                )
                return

            elif status in ("failure", "cancelled"):
                task = task_manager.get_task(task_id)

                # Attempt self-repair if retries available
                if task and task.retry_count < settings.MAX_RETRY_ATTEMPTS:
                    logger.warning(
                        f"[{task_id}] Build failed, attempting repair "
                        f"({task.retry_count + 1}/{settings.MAX_RETRY_ATTEMPTS})"
                    )
                    await attempt_repair(task_id, github_manager, bmad_artifacts)
                    return
                else:
                    logger.error(f"[{task_id}] Build failed after max retries")
                    task_manager.update_task(
                        task_id,
                        status=TaskStatus.FAILED,
                        workflow_run_id=run_id,
                        error_message=f"Build failed after {settings.MAX_RETRY_ATTEMPTS} attempts",
                    )
                    return

            elif status == "not_found" and poll < 6:
                # Give GitHub Actions a few seconds to start
                logger.debug(f"[{task_id}] Waiting for workflow to start...")
                continue

            else:
                logger.debug(f"[{task_id}] Build status: {status}")

        # Timeout
        logger.error(f"[{task_id}] Build timed out after {timeout}s")
        task_manager.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error_message=f"Build timed out after {timeout} seconds",
        )

    except Exception as e:
        logger.exception(f"[{task_id}] Unexpected error in generation pipeline")
        task_manager.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error_message=f"Internal error: {str(e)}",
        )


async def attempt_repair(
    task_id: str,
    github_manager: GitHubManager,
    bmad_artifacts: BMADArtifacts | None = None,
):
    """
    Attempt to repair failed code and retry build.

    BMAD v6: Uses SM Agent to analyze error, Architect to fix tech spec, then Developer to re-execute.
    Legacy: Uses Claude for direct code repair.
    """
    task = task_manager.get_task(task_id)
    if not task or not task.generated_code:
        return

    # Increment retry count
    task_manager.update_task(
        task_id,
        retry_count=task.retry_count + 1,
        status=TaskStatus.SYNTHESIZING,
    )

    # Get error info (simplified - in production, parse workflow logs)
    error_msg = "Compilation error - please check GitHub Actions logs for details"

    if task.workflow_run_id:
        logs = github_manager.get_workflow_logs(task.workflow_run_id)
        if logs:
            error_msg = logs

    logger.info(f"[{task_id}] Attempting repair with error: {error_msg[:100]}...")

    if USE_BMAD_PIPELINE and bmad_artifacts:
        # BMAD v6 Repair: SM analyzes -> Architect fixes tech spec -> Developer re-executes
        logger.info(f"[{task_id}] Using BMAD v6 repair pipeline")
        bmad = get_bmad_orchestrator()
        processor_code, editor_code, repair_error, bmad_artifacts = await bmad.repair_with_bmad(
            error_msg,
            bmad_artifacts,
            task.retry_count
        )

        if repair_error:
            logger.error(f"[{task_id}] BMAD repair failed: {repair_error}")
            task_manager.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error_message=f"BMAD repair failed: {repair_error}",
            )
            return
    else:
        # Legacy repair with Claude
        logger.info(f"[{task_id}] Using legacy repair pipeline")
        ai_synthesizer = get_ai_synthesizer()
        fixed_processor, repair_error = await ai_synthesizer.repair_code(
            task.generated_code["processor"],
            error_msg,
            "Source/PluginProcessor.cpp",
        )

        if repair_error:
            logger.error(f"[{task_id}] Repair failed: {repair_error}")
            task_manager.update_task(
                task_id,
                status=TaskStatus.FAILED,
                error_message=f"Repair failed: {repair_error}",
            )
            return

        # Use repaired processor with original editor
        processor_code = fixed_processor or task.generated_code["processor"]
        editor_code = task.generated_code["editor"]

    # Get header files if they were originally generated (schema mode)
    processor_h = task.generated_code.get("processor_h")
    editor_h = task.generated_code.get("editor_h")

    # Validate header consistency before pushing repair
    is_consistent, consistency_errors = validate_header_consistency(
        processor_h, processor_code, editor_h, editor_code
    )

    if not is_consistent:
        if processor_h and editor_h:
            # We have headers but still have errors after repair
            logger.warning(f"[{task_id}] Repair still has undeclared identifiers: {consistency_errors}")
            # Don't fail immediately on repair - let CI try (repair might have fixed it differently)
        else:
            logger.warning(f"[{task_id}] No headers for repair validation")
    else:
        logger.info(f"[{task_id}] Repair passed header consistency check")

    # Push repaired code
    task_manager.update_task(task_id, status=TaskStatus.PUSHING)

    commit_sha, push_error = github_manager.push_code(
        processor_code,
        editor_code,
        commit_message=f"vAIst: Repair attempt {task.retry_count + 1}",
        processor_h=processor_h,
        editor_h=editor_h,
    )

    if push_error:
        task_manager.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error_message=push_error,
        )
        return

    # Update and continue monitoring
    generated_code = {"processor": processor_code, "editor": editor_code}
    if processor_h:
        generated_code["processor_h"] = processor_h
    if editor_h:
        generated_code["editor_h"] = editor_h

    task_manager.update_task(
        task_id,
        status=TaskStatus.BUILDING,
        commit_sha=commit_sha,
        generated_code=generated_code,
    )

    logger.info(f"[{task_id}] Repair pushed, monitoring new build...")

    # Monitor the new build with the new commit SHA
    poll_interval = settings.BUILD_POLL_INTERVAL_SECONDS
    timeout = settings.BUILD_TIMEOUT_SECONDS
    max_polls = timeout // poll_interval

    for poll in range(max_polls):
        await asyncio.sleep(poll_interval)

        status, run_id, url = github_manager.get_workflow_status(commit_sha)

        if run_id:
            task_manager.update_task(task_id, workflow_run_id=run_id)

        if status == "success":
            logger.info(f"[{task_id}] Repair build successful!")
            # Fetch artifact download URLs
            artifact_urls = github_manager.get_artifact_urls(run_id)
            task_manager.update_task(
                task_id,
                status=TaskStatus.SUCCESS,
                workflow_run_id=run_id,
                download_urls=artifact_urls if artifact_urls else None,
            )
            return

        elif status in ("failure", "cancelled"):
            task = task_manager.get_task(task_id)

            # Attempt another repair if retries available
            if task and task.retry_count < settings.MAX_RETRY_ATTEMPTS:
                logger.warning(
                    f"[{task_id}] Repair build failed, attempting another repair "
                    f"({task.retry_count + 1}/{settings.MAX_RETRY_ATTEMPTS})"
                )
                await attempt_repair(task_id, github_manager, bmad_artifacts)
                return
            else:
                logger.error(f"[{task_id}] Build failed after max retries")
                task_manager.update_task(
                    task_id,
                    status=TaskStatus.FAILED,
                    workflow_run_id=run_id,
                    error_message=f"Build failed after {settings.MAX_RETRY_ATTEMPTS} attempts",
                )
                return

        elif status == "not_found" and poll < 6:
            # Give GitHub Actions a few seconds to start
            logger.debug(f"[{task_id}] Waiting for repair workflow to start...")
            continue

    # Timeout
    logger.error(f"[{task_id}] Repair build timed out after {timeout}s")
    task_manager.update_task(
        task_id,
        status=TaskStatus.FAILED,
        error_message=f"Repair build timed out after {timeout} seconds",
    )


# =============================================================================
# API Endpoints
# =============================================================================


@app.post("/v1/plugin/generate", response_model=GenerateResponse)
async def generate_plugin(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start plugin generation from a natural language prompt.

    Returns a task_id that can be used to poll for status.
    """
    # Create task
    task = task_manager.create_task(prompt=request.prompt)
    logger.info(f"Created task {task.task_id} for prompt: {request.prompt[:50]}...")

    # Start background generation
    background_tasks.add_task(generate_plugin_task, task.task_id, request.prompt)

    return GenerateResponse(
        task_id=task.task_id,
        status=task.status,
        message="Plugin generation started. Poll /v1/plugin/status/{task_id} for updates.",
    )


@app.get("/v1/plugin/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    """
    Get the current status of a plugin generation task.
    """
    task = task_manager.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Build workflow URL if we have run_id
    workflow_url = None
    if task.workflow_run_id:
        workflow_url = (
            f"https://github.com/{settings.GITHUB_REPO}/actions/runs/{task.workflow_run_id}"
        )

    # Build download URLs if available
    download_urls = None
    if task.download_urls:
        download_urls = DownloadUrls(
            windows=task.download_urls.get("windows"),
            macos=task.download_urls.get("macos"),
        )

    return StatusResponse(
        task_id=task.task_id,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        commit_sha=task.commit_sha,
        workflow_run_id=task.workflow_run_id,
        workflow_url=workflow_url,
        error_message=task.error_message,
        retry_count=task.retry_count,
        download_urls=download_urls,
        plugin_id=task.plugin_id,
    )


@app.get("/v1/tasks", response_model=list[StatusResponse])
async def list_tasks(limit: int = 20):
    """
    List recent tasks.
    """
    tasks = task_manager.list_tasks(limit=limit)

    return [
        StatusResponse(
            task_id=task.task_id,
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            commit_sha=task.commit_sha,
            workflow_run_id=task.workflow_run_id,
            workflow_url=(
                f"https://github.com/{settings.GITHUB_REPO}/actions/runs/{task.workflow_run_id}"
                if task.workflow_run_id
                else None
            ),
            error_message=task.error_message,
            retry_count=task.retry_count,
        )
        for task in tasks
    ]


@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "service": "vAIst Backend",
    }


@app.get("/stats")
async def get_stats() -> Dict[str, int]:
    """Get task statistics."""
    return task_manager.get_stats()


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
