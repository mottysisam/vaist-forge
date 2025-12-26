"""
vAIst Code Parser
Extract and validate C++ code blocks from AI responses.
"""

import re
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class CodeParser:
    """Extract C++ code blocks from AI markdown responses."""

    # Regex patterns for code extraction
    # Matches: ```cpp Source/PluginProcessor.cpp\n...\n```
    PROCESSOR_PATTERN = r"```cpp\s*Source/PluginProcessor\.cpp\s*\n(.*?)```"
    EDITOR_PATTERN = r"```cpp\s*Source/PluginEditor\.cpp\s*\n(.*?)```"

    # Security patterns - code containing these will be rejected
    DANGEROUS_PATTERNS = [
        r"std::system\s*\(",
        r"#include\s*<filesystem>",
        r"fopen\s*\(",
        r"fwrite\s*\(",
        r"fread\s*\(",
        r"socket\s*\(",
        r"connect\s*\(",
        r"exec[lv]?[pe]?\s*\(",
        r"popen\s*\(",
        r"ShellExecute",
        r"CreateProcess",
        r"WinExec",
    ]

    # Required patterns - code must contain these
    REQUIRED_PROCESSOR_PATTERNS = [
        r"class\s+VAIstAudioProcessor|VAIstAudioProcessor::",
        r"processBlock",
        r"createPluginFilter",
    ]

    REQUIRED_EDITOR_PATTERNS = [
        r"class\s+VAIstAudioProcessorEditor|VAIstAudioProcessorEditor::",
        r"resized\s*\(",
        r"paint\s*\(",
    ]

    @classmethod
    def extract_code(cls, ai_response: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract PluginProcessor.cpp and PluginEditor.cpp from AI response.

        Args:
            ai_response: Raw AI response text (markdown)

        Returns:
            Tuple of (processor_code, editor_code) or (None, None) if extraction fails
        """
        processor_match = re.search(cls.PROCESSOR_PATTERN, ai_response, re.DOTALL)
        editor_match = re.search(cls.EDITOR_PATTERN, ai_response, re.DOTALL)

        processor_code = processor_match.group(1).strip() if processor_match else None
        editor_code = editor_match.group(1).strip() if editor_match else None

        if processor_code:
            logger.info(f"Extracted processor code: {len(processor_code)} chars")
        else:
            logger.warning("Failed to extract processor code from AI response")

        if editor_code:
            logger.info(f"Extracted editor code: {len(editor_code)} chars")
        else:
            logger.warning("Failed to extract editor code from AI response")

        return processor_code, editor_code

    @classmethod
    def validate_code(
        cls, processor_code: str, editor_code: str
    ) -> Tuple[bool, str]:
        """
        Validate generated code for security and completeness.

        Args:
            processor_code: Generated PluginProcessor.cpp content
            editor_code: Generated PluginEditor.cpp content

        Returns:
            Tuple of (is_valid, error_message)
        """
        combined_code = processor_code + editor_code

        # Security check: dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, combined_code, re.IGNORECASE):
                error = f"Security violation: found dangerous pattern '{pattern}'"
                logger.error(error)
                return False, error

        # Completeness check: processor required patterns
        for pattern in cls.REQUIRED_PROCESSOR_PATTERNS:
            if not re.search(pattern, processor_code):
                error = f"Missing required pattern in processor: '{pattern}'"
                logger.error(error)
                return False, error

        # Completeness check: editor required patterns
        for pattern in cls.REQUIRED_EDITOR_PATTERNS:
            if not re.search(pattern, editor_code):
                error = f"Missing required pattern in editor: '{pattern}'"
                logger.error(error)
                return False, error

        # Check for proper includes
        if "#include" not in processor_code:
            return False, "Processor code missing #include statements"

        if "#include" not in editor_code:
            return False, "Editor code missing #include statements"

        logger.info("Code validation passed")
        return True, ""

    @classmethod
    def extract_single_file(cls, ai_response: str, filename: str) -> Optional[str]:
        """
        Extract a single file from AI response (used for repairs).

        Args:
            ai_response: AI response text
            filename: File to extract (e.g., "Source/PluginProcessor.cpp")

        Returns:
            Extracted code or None
        """
        # Escape the filename for regex
        escaped_filename = re.escape(filename)
        pattern = rf"```cpp\s*{escaped_filename}\s*\n(.*?)```"

        match = re.search(pattern, ai_response, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Try without the path prefix
        simple_filename = filename.split("/")[-1]
        escaped_simple = re.escape(simple_filename)
        pattern = rf"```cpp\s*{escaped_simple}\s*\n(.*?)```"

        match = re.search(pattern, ai_response, re.DOTALL)
        if match:
            return match.group(1).strip()

        return None
