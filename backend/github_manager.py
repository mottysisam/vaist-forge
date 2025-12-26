"""
vAIst GitHub Manager
PyGithub automation for pushing code and monitoring builds.
"""

import logging
from typing import Optional, Tuple

from github import Github, GithubException

from backend.config import Settings

logger = logging.getLogger(__name__)


class GitHubManager:
    """GitHub repository management and build triggering."""

    def __init__(self, settings: Settings):
        """
        Initialize GitHub client.

        Args:
            settings: Application settings with GitHub token
        """
        self.settings = settings
        self.github = Github(settings.GITHUB_TOKEN)
        self.repo = self.github.get_repo(settings.GITHUB_REPO)
        logger.info(f"GitHub manager initialized for {settings.GITHUB_REPO}")

    def push_code(
        self,
        processor_code: str,
        editor_code: str,
        commit_message: str = "vAIst: AI-generated plugin update",
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Push generated code to GitHub repository.

        This will trigger the GitHub Actions workflow automatically.

        Args:
            processor_code: PluginProcessor.cpp content
            editor_code: PluginEditor.cpp content
            commit_message: Git commit message

        Returns:
            Tuple of (commit_sha, error_message)
            On success: (sha, None)
            On failure: (None, error_message)
        """
        try:
            branch = self.settings.GITHUB_BRANCH

            # Get current file contents (need SHA for update)
            processor_file = self.repo.get_contents(
                "Source/PluginProcessor.cpp",
                ref=branch,
            )
            editor_file = self.repo.get_contents(
                "Source/PluginEditor.cpp",
                ref=branch,
            )

            logger.info(f"Updating files on branch: {branch}")

            # Update PluginProcessor.cpp
            self.repo.update_file(
                path="Source/PluginProcessor.cpp",
                message=f"{commit_message} - Processor",
                content=processor_code,
                sha=processor_file.sha,
                branch=branch,
            )

            # Update PluginEditor.cpp
            result = self.repo.update_file(
                path="Source/PluginEditor.cpp",
                message=f"{commit_message} - Editor",
                content=editor_code,
                sha=editor_file.sha,
                branch=branch,
            )

            commit_sha = result["commit"].sha
            logger.info(f"Successfully pushed code: {commit_sha}")
            return commit_sha, None

        except GithubException as e:
            error_msg = f"GitHub push failed: {e.data.get('message', str(e))}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error during push: {str(e)}"
            logger.exception(error_msg)
            return None, error_msg

    def get_workflow_status(
        self, commit_sha: str
    ) -> Tuple[str, Optional[int], Optional[str]]:
        """
        Get the status of GitHub Actions workflow for a commit.

        Args:
            commit_sha: Git commit SHA

        Returns:
            Tuple of (status, run_id, workflow_url)
            Status values: "queued", "in_progress", "success", "failure", "not_found", "error"
        """
        try:
            # Find workflow runs for this commit
            workflows = self.repo.get_workflow_runs(
                branch=self.settings.GITHUB_BRANCH,
            )

            for run in workflows:
                if run.head_sha == commit_sha:
                    status = run.status  # queued, in_progress, completed
                    conclusion = run.conclusion  # success, failure, cancelled, etc.

                    logger.debug(
                        f"Workflow {run.id}: status={status}, conclusion={conclusion}"
                    )

                    if status == "completed":
                        # Return the conclusion as status
                        return conclusion or "unknown", run.id, run.html_url
                    else:
                        # Still running
                        return status, run.id, run.html_url

            logger.debug(f"No workflow found for commit {commit_sha}")
            return "not_found", None, None

        except GithubException as e:
            logger.error(f"Failed to get workflow status: {e}")
            return "error", None, None
        except Exception as e:
            logger.exception("Unexpected error getting workflow status")
            return "error", None, None

    def get_workflow_logs(self, run_id: int) -> Optional[str]:
        """
        Get summary of a workflow run.

        Note: Full log download requires additional API calls.
        For MVP, we just return basic info.

        Args:
            run_id: GitHub Actions workflow run ID

        Returns:
            Summary string or None if unavailable
        """
        try:
            run = self.repo.get_workflow_run(run_id)

            # Get job summaries
            jobs = run.jobs()
            job_summaries = []

            for job in jobs:
                status = job.conclusion or job.status
                job_summaries.append(f"{job.name}: {status}")

            summary = f"Workflow {run_id} ({run.conclusion})\n"
            summary += "\n".join(job_summaries)

            return summary

        except GithubException as e:
            logger.error(f"Failed to get workflow logs: {e}")
            return None
        except Exception as e:
            logger.exception("Unexpected error getting workflow logs")
            return None

    def get_workflow_url(self, run_id: int) -> str:
        """
        Get the URL for a workflow run.

        Args:
            run_id: GitHub Actions workflow run ID

        Returns:
            URL string
        """
        return f"https://github.com/{self.settings.GITHUB_REPO}/actions/runs/{run_id}"
