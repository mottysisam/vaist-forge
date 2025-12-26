"""
vAIst AI Synthesizer
AI code generation with Gemini 3 Flash (primary) and Claude Opus 4.5 (fallback).
"""

import logging
from typing import Optional, Tuple

import google.generativeai as genai

from backend.config import Settings
from backend.prompts.system_prompts import SYSTEM_PROMPT, get_repair_prompt
from backend.code_parser import CodeParser

logger = logging.getLogger(__name__)


class AISynthesizer:
    """
    AI code generation with fallback support.

    Primary: Gemini 3 Flash (fast, cheap, 1M context)
    Fallback: Claude Opus 4.5 (better at complex debugging)
    """

    def __init__(self, settings: Settings):
        """
        Initialize AI clients.

        Args:
            settings: Application settings with API keys
        """
        self.settings = settings

        # Initialize Gemini (primary)
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        self.gemini_model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
        )
        logger.info(f"Gemini initialized: {settings.GEMINI_MODEL}")

        # Initialize Claude (fallback)
        self.claude_client = None
        if settings.ANTHROPIC_API_KEY:
            try:
                import anthropic
                self.claude_client = anthropic.Anthropic(
                    api_key=settings.ANTHROPIC_API_KEY
                )
                logger.info(f"Claude initialized: {settings.CLAUDE_MODEL}")
            except ImportError:
                logger.warning("anthropic package not installed - Claude fallback disabled")
        else:
            logger.warning("No Anthropic API key - Claude fallback disabled")

    async def generate_code(
        self, user_prompt: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Generate VST code from user prompt.

        Args:
            user_prompt: User's plugin description

        Returns:
            Tuple of (processor_code, editor_code, error_message)
            On success: (code, code, None)
            On failure: (None, None, error_message)
        """
        # Try Gemini first (primary coder)
        processor, editor, error = await self._generate_with_gemini(user_prompt)
        if processor and editor:
            return processor, editor, None

        logger.warning(f"Gemini generation failed: {error}")

        # Fallback to Claude (architect)
        if self.claude_client:
            processor, editor, error = await self._generate_with_claude(user_prompt)
            if processor and editor:
                return processor, editor, None
            logger.warning(f"Claude generation failed: {error}")
            return None, None, f"All AI models failed. Last error: {error}"

        return None, None, f"Gemini failed: {error}. No Claude fallback available."

    async def _generate_with_gemini(
        self, user_prompt: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Generate code using Gemini."""
        try:
            logger.info("Generating code with Gemini")
            response = self.gemini_model.generate_content(user_prompt)

            if not response.text:
                return None, None, "Gemini returned empty response"

            processor, editor = CodeParser.extract_code(response.text)

            if not processor or not editor:
                return None, None, "Failed to extract code blocks from Gemini response"

            is_valid, validation_error = CodeParser.validate_code(processor, editor)
            if not is_valid:
                return None, None, f"Gemini code validation failed: {validation_error}"

            logger.info("Gemini generation successful")
            return processor, editor, None

        except Exception as e:
            logger.exception("Gemini generation error")
            return None, None, f"Gemini error: {str(e)}"

    async def _generate_with_claude(
        self, user_prompt: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Generate code using Claude."""
        if not self.claude_client:
            return None, None, "Claude client not initialized"

        try:
            logger.info("Generating code with Claude")
            message = self.claude_client.messages.create(
                model=self.settings.CLAUDE_MODEL,
                max_tokens=8192,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = message.content[0].text
            if not response_text:
                return None, None, "Claude returned empty response"

            processor, editor = CodeParser.extract_code(response_text)

            if not processor or not editor:
                return None, None, "Failed to extract code blocks from Claude response"

            is_valid, validation_error = CodeParser.validate_code(processor, editor)
            if not is_valid:
                return None, None, f"Claude code validation failed: {validation_error}"

            logger.info("Claude generation successful")
            return processor, editor, None

        except Exception as e:
            logger.exception("Claude generation error")
            return None, None, f"Claude error: {str(e)}"

    async def repair_code(
        self,
        original_code: str,
        error_message: str,
        filename: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Attempt to fix code using compiler error feedback.

        Uses Claude for repair as it's better at debugging.

        Args:
            original_code: The code that failed to compile
            error_message: Compiler error output
            filename: Source file name

        Returns:
            Tuple of (fixed_code, error_message)
            On success: (fixed_code, None)
            On failure: (None, error_message)
        """
        repair_prompt = get_repair_prompt(error_message, original_code, filename)

        # Prefer Claude for repairs (better at debugging)
        if self.claude_client:
            try:
                logger.info(f"Attempting code repair with Claude for {filename}")
                message = self.claude_client.messages.create(
                    model=self.settings.CLAUDE_MODEL,
                    max_tokens=8192,
                    messages=[{"role": "user", "content": repair_prompt}],
                )

                response_text = message.content[0].text
                fixed_code = CodeParser.extract_single_file(response_text, filename)

                if fixed_code:
                    logger.info(f"Claude repair successful for {filename}")
                    return fixed_code, None
                else:
                    return None, "Failed to extract fixed code from Claude response"

            except Exception as e:
                logger.exception("Claude repair error")
                # Fall through to Gemini

        # Fallback to Gemini for repair
        try:
            logger.info(f"Attempting code repair with Gemini for {filename}")
            response = self.gemini_model.generate_content(repair_prompt)

            if response.text:
                fixed_code = CodeParser.extract_single_file(response.text, filename)
                if fixed_code:
                    logger.info(f"Gemini repair successful for {filename}")
                    return fixed_code, None

            return None, "Failed to extract fixed code from Gemini response"

        except Exception as e:
            logger.exception("Gemini repair error")
            return None, f"Code repair failed: {str(e)}"
