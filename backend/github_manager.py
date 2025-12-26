"""
vAIst GitHub Manager
PyGithub automation for pushing code and monitoring builds.
"""

import logging
import random
import re
import string
from typing import Optional, Tuple

from github import Github, GithubException, InputGitTreeElement

from backend.config import Settings

logger = logging.getLogger(__name__)


def generate_unique_id() -> str:
    """
    Generate a unique 4-character plugin ID for VST3 metadata.

    This prevents DAW scanning conflicts where a new plugin would
    overwrite an old one because they share the same PLUGIN_CODE.

    Returns:
        4-character alphanumeric string (e.g., "X7K2", "A3B9")
    """
    # Mix of uppercase and digits for uniqueness
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))


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
        Push generated code to GitHub repository in a SINGLE commit.

        This will trigger the GitHub Actions workflow automatically.
        Also updates CMakeLists.txt with a unique PLUGIN_CODE to prevent
        DAW scanning conflicts.

        Uses Git Data API to push all files atomically in one commit,
        preventing race conditions where partial updates cause build failures.

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

            # Generate unique plugin ID
            unique_id = generate_unique_id()
            logger.info(f"Generated unique plugin ID: {unique_id}")

            # Get current branch reference
            ref = self.repo.get_git_ref(f"heads/{branch}")
            base_sha = ref.object.sha
            base_commit = self.repo.get_git_commit(base_sha)
            base_tree = base_commit.tree

            logger.info(f"Creating atomic commit on branch: {branch}")

            # Get current CMakeLists.txt and update PLUGIN_CODE
            cmake_file = self.repo.get_contents("CMakeLists.txt", ref=branch)
            cmake_content = cmake_file.decoded_content.decode('utf-8')
            updated_cmake = self._update_plugin_code(cmake_content, unique_id)

            # Create blobs for all files
            tree_elements = []

            # CMakeLists.txt (if changed)
            if updated_cmake != cmake_content:
                cmake_blob = self.repo.create_git_blob(updated_cmake, "utf-8")
                tree_elements.append(InputGitTreeElement(
                    path="CMakeLists.txt",
                    mode="100644",
                    type="blob",
                    sha=cmake_blob.sha,
                ))
                logger.info(f"Updated CMakeLists.txt with PLUGIN_CODE: {unique_id}")

            # PluginProcessor.cpp
            processor_blob = self.repo.create_git_blob(processor_code, "utf-8")
            tree_elements.append(InputGitTreeElement(
                path="Source/PluginProcessor.cpp",
                mode="100644",
                type="blob",
                sha=processor_blob.sha,
            ))

            # PluginEditor.cpp
            editor_blob = self.repo.create_git_blob(editor_code, "utf-8")
            tree_elements.append(InputGitTreeElement(
                path="Source/PluginEditor.cpp",
                mode="100644",
                type="blob",
                sha=editor_blob.sha,
            ))

            # Create new tree with all changes
            new_tree = self.repo.create_git_tree(tree_elements, base_tree)

            # Create single commit with all changes
            new_commit = self.repo.create_git_commit(
                message=commit_message,
                tree=new_tree,
                parents=[base_commit],
            )

            # Update branch reference
            ref.edit(new_commit.sha)

            logger.info(f"Successfully pushed code (atomic): {new_commit.sha}")
            return new_commit.sha, None

        except GithubException as e:
            error_msg = f"GitHub push failed: {e.data.get('message', str(e))}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error during push: {str(e)}"
            logger.exception(error_msg)
            return None, error_msg

    def _update_plugin_code(self, cmake_content: str, unique_id: str) -> str:
        """
        Update PLUGIN_CODE in CMakeLists.txt with unique ID.

        Args:
            cmake_content: Current CMakeLists.txt content
            unique_id: 4-character unique plugin ID

        Returns:
            Updated CMakeLists.txt content
        """
        # Match PLUGIN_CODE "XXXX" pattern (4 alphanumeric chars)
        pattern = r'(PLUGIN_CODE\s+")[A-Z0-9]{4}(")'
        replacement = rf'\g<1>{unique_id}\g<2>'

        updated = re.sub(pattern, replacement, cmake_content)

        if updated == cmake_content:
            # Pattern not found - try alternate format
            pattern2 = r"(PLUGIN_CODE\s+')[A-Z0-9]{4}(')"
            updated = re.sub(pattern2, rf"\g<1>{unique_id}\g<2>", cmake_content)

        return updated

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
