"""
vAIst Task Manager
Thread-safe in-memory task tracking with TTL expiration.
"""

from typing import Dict, Optional, Any
from threading import Lock
from datetime import datetime, timedelta
import logging

from backend.models import TaskState, TaskStatus

logger = logging.getLogger(__name__)


class TaskManager:
    """
    In-memory task storage with thread-safe operations.

    Note: All state is lost on server restart. Acceptable for MVP,
    but should be replaced with persistent storage for production.
    """

    def __init__(self, task_ttl_hours: int = 24):
        """
        Initialize task manager.

        Args:
            task_ttl_hours: Hours before tasks are automatically cleaned up
        """
        self._tasks: Dict[str, TaskState] = {}
        self._lock = Lock()
        self._ttl = timedelta(hours=task_ttl_hours)

    def create_task(self, prompt: str) -> TaskState:
        """
        Create a new task and return its state.

        Args:
            prompt: User's plugin description

        Returns:
            New TaskState with generated UUID
        """
        task = TaskState(prompt=prompt)
        with self._lock:
            self._tasks[task.task_id] = task
            logger.info(f"Created task {task.task_id}")
        return task

    def get_task(self, task_id: str) -> Optional[TaskState]:
        """
        Retrieve a task by ID.

        Args:
            task_id: UUID of the task

        Returns:
            TaskState if found, None otherwise
        """
        with self._lock:
            return self._tasks.get(task_id)

    def update_task(self, task_id: str, **kwargs: Any) -> Optional[TaskState]:
        """
        Update task fields.

        Args:
            task_id: UUID of the task
            **kwargs: Fields to update (status, commit_sha, error_message, etc.)

        Returns:
            Updated TaskState if found, None otherwise
        """
        with self._lock:
            if task_id not in self._tasks:
                logger.warning(f"Task {task_id} not found for update")
                return None

            task = self._tasks[task_id]
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)
                else:
                    logger.warning(f"Unknown task field: {key}")

            task.updated_at = datetime.utcnow()

            # Log status transitions
            if "status" in kwargs:
                logger.info(f"Task {task_id} status: {kwargs['status']}")

            return task

    def list_tasks(self, limit: int = 100) -> list[TaskState]:
        """
        List recent tasks.

        Args:
            limit: Maximum number of tasks to return

        Returns:
            List of TaskState objects, most recent first
        """
        with self._lock:
            tasks = sorted(
                self._tasks.values(),
                key=lambda t: t.created_at,
                reverse=True
            )
            return tasks[:limit]

    def cleanup_expired(self) -> int:
        """
        Remove tasks older than TTL.

        Returns:
            Number of tasks removed
        """
        cutoff = datetime.utcnow() - self._ttl
        with self._lock:
            expired = [
                tid for tid, task in self._tasks.items()
                if task.created_at < cutoff
            ]
            for tid in expired:
                del self._tasks[tid]

            if expired:
                logger.info(f"Cleaned up {len(expired)} expired tasks")

            return len(expired)

    def get_stats(self) -> Dict[str, int]:
        """
        Get task statistics.

        Returns:
            Dict with counts by status
        """
        with self._lock:
            stats: Dict[str, int] = {}
            for task in self._tasks.values():
                status = task.status.value
                stats[status] = stats.get(status, 0) + 1
            stats["total"] = len(self._tasks)
            return stats


# Global singleton instance
task_manager = TaskManager()
