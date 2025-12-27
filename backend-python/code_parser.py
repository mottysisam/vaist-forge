"""
vAIst Code Parser
Extract and validate C++ code blocks from AI responses.

Supports two modes:
1. Full extraction: Extract complete PluginProcessor.cpp and PluginEditor.cpp files
2. Logic extraction: Extract just DSP logic for template injection
"""

import re
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Logic injection markers (must match template_manager.py)
LOGIC_START = "// === AI_LOGIC_START ==="
LOGIC_END = "// === AI_LOGIC_END ==="


class CodeParser:
    """Extract C++ code blocks from AI markdown responses."""

    # Regex patterns for code extraction (flexible to handle various AI output formats)
    # Supports: ```cpp, ```c++, ```C++, ```CPP, or plain ``` code blocks
    # Matches variations like:
    # ```cpp Source/PluginProcessor.cpp
    # ```cpp PluginProcessor.cpp
    # **FILE: Source/PluginProcessor.cpp**\n```cpp
    # ### PluginProcessor.cpp\n```cpp

    # Language tag pattern: cpp, c++, CPP, C++ (case insensitive)
    _LANG = r"(?:cpp|c\+\+)"

    PROCESSOR_PATTERNS = [
        rf"```{_LANG}\s*Source/PluginProcessor\.cpp\s*\n(.*?)```",
        rf"```{_LANG}\s*PluginProcessor\.cpp\s*\n(.*?)```",
        rf"(?:FILE:|Source/|###?\s*)?\s*PluginProcessor\.cpp[^\n]*\n```{_LANG}?\s*\n(.*?)```",
        rf"```{_LANG}\s*\n(#include\s*[\"<].*PluginProcessor\.h[\">].*?createPluginFilter.*?)```",
    ]
    EDITOR_PATTERNS = [
        rf"```{_LANG}\s*Source/PluginEditor\.cpp\s*\n(.*?)```",
        rf"```{_LANG}\s*PluginEditor\.cpp\s*\n(.*?)```",
        rf"(?:FILE:|Source/|###?\s*)?\s*PluginEditor\.cpp[^\n]*\n```{_LANG}?\s*\n(.*?)```",
        rf"```{_LANG}\s*\n(#include\s*[\"<].*PluginProcessor\.h[\">].*?VAIstAudioProcessorEditor.*?resized\s*\(\).*?)```",
    ]

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
    def _clean_code(cls, code: str) -> str:
        """
        Remove any lingering markdown artifacts from extracted code.

        Gemini sometimes outputs both files in a merged response with fences between them.
        This cleans up:
        - Code fence markers (```)
        - Language tags that got mixed in (cpp, c++)
        - Extra headers/footers
        """
        if not code:
            return code

        lines = code.split('\n')
        cleaned_lines = []
        skip_next_fence_content = False

        for line in lines:
            stripped = line.strip()
            # Skip markdown code fence lines
            if stripped.startswith('```'):
                # If this is an opening fence with a new file, we're in trouble
                # Skip it and any following cpp/c++ language tag
                skip_next_fence_content = True
                continue
            # Skip standalone cpp/c++ language markers (artifact from fences)
            if stripped.lower() in ('cpp', 'c++') and skip_next_fence_content:
                skip_next_fence_content = False
                continue
            skip_next_fence_content = False
            cleaned_lines.append(line)

        # Join and strip leading/trailing whitespace
        result = '\n'.join(cleaned_lines).strip()

        # If the code got too short after cleaning, something went wrong
        if len(result) < 100:
            logger.warning(f"Code became very short after cleaning: {len(result)} chars")
            # Return original in this case
            return code.strip()

        return result

    @classmethod
    def _split_merged_files(cls, code: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Split merged file content that contains both processor and editor.

        Gemini sometimes outputs:
        ```cpp PluginProcessor.cpp
        ...processor code...
        ```
        ```cpp PluginEditor.cpp
        ...editor code...
        ```

        As a single block. This splits them properly.
        """
        # Look for the pattern where one file ends and another begins
        split_patterns = [
            r"(.*?)\n```\s*\n*```(?:cpp|c\+\+)?\s*(?:Source/)?PluginEditor\.cpp[^\n]*\n(.*)",
            r"(.*?createPluginFilter\s*\(\s*\)\s*\{[^}]*\})\s*\n*```\s*\n*```(?:cpp|c\+\+)?[^\n]*\n(.*)",
        ]

        for pattern in split_patterns:
            match = re.search(pattern, code, re.DOTALL | re.IGNORECASE)
            if match:
                processor = match.group(1).strip()
                editor = match.group(2).strip()
                if processor and editor:
                    logger.info("Successfully split merged processor/editor content")
                    return processor, editor

        return None, None

    @classmethod
    def extract_code(cls, ai_response: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract PluginProcessor.cpp and PluginEditor.cpp from AI response.

        Args:
            ai_response: Raw AI response text (markdown)

        Returns:
            Tuple of (processor_code, editor_code) or (None, None) if extraction fails
        """
        # Try all processor patterns (case-insensitive for language tags)
        processor_code = None
        for pattern in cls.PROCESSOR_PATTERNS:
            match = re.search(pattern, ai_response, re.DOTALL | re.IGNORECASE)
            if match:
                processor_code = match.group(1).strip()
                logger.debug(f"Matched processor with pattern: {pattern[:50]}...")
                break

        # Try all editor patterns (case-insensitive for language tags)
        editor_code = None
        for pattern in cls.EDITOR_PATTERNS:
            match = re.search(pattern, ai_response, re.DOTALL | re.IGNORECASE)
            if match:
                editor_code = match.group(1).strip()
                logger.debug(f"Matched editor with pattern: {pattern[:50]}...")
                break

        # Fallback: If specific patterns failed, try to extract any code blocks
        # and identify them by content (supports cpp, c++, or no language tag)
        if not processor_code or not editor_code:
            # Try multiple code block patterns
            all_blocks = []
            for block_pattern in [
                r"```(?:cpp|c\+\+)\s*\n?(.*?)```",  # cpp or c++ tagged
                r"```\s*\n(.*?)```",  # No language tag
            ]:
                all_blocks.extend(re.findall(block_pattern, ai_response, re.DOTALL | re.IGNORECASE))

            logger.debug(f"Found {len(all_blocks)} code blocks in response for content-based extraction")

            for block in all_blocks:
                block = block.strip()
                # Processor detection: must have processBlock AND createPluginFilter
                if not processor_code and "processBlock" in block and "createPluginFilter" in block:
                    processor_code = block
                    logger.info("Extracted processor via content-based fallback")
                # Editor detection: must have resized AND paint (Editor class methods)
                elif not editor_code and "resized" in block and "paint" in block and "AudioProcessorEditor" in block:
                    editor_code = block
                    logger.info("Extracted editor via content-based fallback")

        # Check if we have merged content (both files in one block)
        # This happens when Gemini outputs both files in a single response
        if processor_code and not editor_code:
            # Check if processor_code actually contains editor code too
            if "resized" in processor_code and "paint" in processor_code and "AudioProcessorEditor" in processor_code:
                split_proc, split_edit = cls._split_merged_files(processor_code)
                if split_proc and split_edit:
                    processor_code = split_proc
                    editor_code = split_edit
                    logger.info("Split merged processor/editor from single block")

        # Clean any remaining markdown artifacts from extracted code
        if processor_code:
            processor_code = cls._clean_code(processor_code)
            logger.info(f"Extracted processor code: {len(processor_code)} chars")
        else:
            logger.warning("Failed to extract processor code from AI response")
            # Log response preview for debugging
            logger.warning(f"AI response preview (first 1000 chars): {ai_response[:1000]}")

        if editor_code:
            editor_code = cls._clean_code(editor_code)
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
        simple_filename = filename.split("/")[-1]
        escaped_simple = re.escape(simple_filename)

        # Try multiple patterns (cpp, c++, case-insensitive)
        patterns = [
            rf"```(?:cpp|c\+\+)\s*{escaped_filename}\s*\n(.*?)```",
            rf"```(?:cpp|c\+\+)\s*{escaped_simple}\s*\n(.*?)```",
            rf"(?:FILE:|###?\s*)?\s*{escaped_simple}[^\n]*\n```(?:cpp|c\+\+)?\s*\n(.*?)```",
        ]

        for pattern in patterns:
            match = re.search(pattern, ai_response, re.DOTALL | re.IGNORECASE)
            if match:
                code = match.group(1).strip()
                # Clean any markdown artifacts
                return cls._clean_code(code)

        # Fallback: try to find ANY code block and check if it looks like the right file
        all_blocks = re.findall(r"```(?:cpp|c\+\+)?\s*\n?(.*?)```", ai_response, re.DOTALL | re.IGNORECASE)
        for block in all_blocks:
            block = block.strip()
            # Check if this block contains characteristic content for the requested file
            if "PluginProcessor" in filename and "processBlock" in block:
                return cls._clean_code(block)
            elif "PluginEditor" in filename and "resized" in block and "paint" in block:
                return cls._clean_code(block)

        return None

    # =========================================================================
    # Template Logic Extraction Methods
    # =========================================================================

    @classmethod
    def extract_logic_block(cls, ai_response: str) -> Optional[str]:
        """
        Extract DSP logic from AI response for template injection.

        The AI should return only inner-loop code. This method handles:
        1. Code between AI_LOGIC markers
        2. Code in cpp/c++ code blocks
        3. Raw code without markers

        Args:
            ai_response: AI response text

        Returns:
            Extracted DSP logic code or None
        """
        # Try to find code between markers
        pattern = rf"{re.escape(LOGIC_START)}\s*(.*?)\s*{re.escape(LOGIC_END)}"
        match = re.search(pattern, ai_response, re.DOTALL)
        if match:
            logic = match.group(1).strip()
            logger.info(f"Extracted logic between markers: {len(logic)} chars")
            return logic

        # Try to find code in cpp/c++ block
        block_patterns = [
            r"```(?:cpp|c\+\+)\s*\n?(.*?)```",
            r"```\s*\n?(.*?)```",
        ]

        for pattern in block_patterns:
            match = re.search(pattern, ai_response, re.DOTALL | re.IGNORECASE)
            if match:
                code = match.group(1).strip()
                # Clean up any boilerplate the AI might have accidentally included
                cleaned = cls._clean_logic_code(code)
                if cleaned:
                    logger.info(f"Extracted logic from code block: {len(cleaned)} chars")
                    return cleaned

        # Last resort: treat the whole response as code if it looks like C++
        if cls._looks_like_cpp_logic(ai_response):
            cleaned = cls._clean_logic_code(ai_response)
            if cleaned:
                logger.info(f"Extracted logic from raw response: {len(cleaned)} chars")
                return cleaned

        logger.warning("Failed to extract logic from AI response")
        logger.warning(f"Response preview: {ai_response[:500]}")
        return None

    @classmethod
    def _clean_logic_code(cls, code: str) -> Optional[str]:
        """
        Clean up DSP logic code by removing any accidentally included boilerplate.

        Args:
            code: Raw code from AI

        Returns:
            Cleaned logic code
        """
        if not code:
            return None

        lines = code.split('\n')
        cleaned_lines = []
        skip_until_brace = False

        for line in lines:
            stripped = line.strip()

            # Skip include statements
            if stripped.startswith('#include'):
                continue

            # Skip class/struct definitions
            if stripped.startswith('class ') or stripped.startswith('struct '):
                skip_until_brace = True
                continue

            # Skip function signatures (but keep the body)
            if re.match(r'^(void|float|int|double|bool)\s+\w+\s*\([^)]*\)\s*\{?\s*$', stripped):
                if '{' in stripped:
                    skip_until_brace = False  # Body starts on same line
                else:
                    skip_until_brace = True
                continue

            # Skip opening brace after function signature
            if skip_until_brace and stripped == '{':
                skip_until_brace = False
                continue

            # Skip lone closing braces (likely end of function)
            if stripped == '}' and not cleaned_lines:
                continue

            # Skip empty lines at start
            if not stripped and not cleaned_lines:
                continue

            cleaned_lines.append(line)

        # Remove trailing empty lines and lone braces
        while cleaned_lines and cleaned_lines[-1].strip() in ('', '}'):
            cleaned_lines.pop()

        result = '\n'.join(cleaned_lines).strip()

        # If result is too short, it's probably not valid
        if len(result) < 10:
            return None

        return result

    @classmethod
    def _looks_like_cpp_logic(cls, text: str) -> bool:
        """
        Check if text looks like C++ DSP logic code.

        Args:
            text: Text to check

        Returns:
            True if it looks like C++ code
        """
        cpp_indicators = [
            '=',           # Assignment
            ';',           # Statement terminator
            'sample',      # Common in DSP
            'channelData', # JUCE buffer access
            'float',       # Type
            '*',           # Multiply or pointer
            '+',           # Add
        ]

        # Must have at least 3 indicators
        count = sum(1 for ind in cpp_indicators if ind in text)
        return count >= 3

    @classmethod
    def validate_logic(cls, logic_code: str) -> Tuple[bool, str]:
        """
        Validate DSP logic code for safety.

        Args:
            logic_code: The DSP logic to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, logic_code, re.IGNORECASE):
                error = f"Security violation in logic: found dangerous pattern '{pattern}'"
                logger.error(error)
                return False, error

        # Logic should be relatively short (inner-loop code)
        if len(logic_code) > 2000:
            logger.warning(f"Logic code is unusually long: {len(logic_code)} chars")
            # Not a hard error, just a warning

        logger.info("Logic validation passed")
        return True, ""
