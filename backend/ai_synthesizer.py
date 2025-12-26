"""
vAIst AI Synthesizer
AI code generation with Gemini (primary) and Claude (fallback).

Supports two generation modes:
1. Template-based: AI generates only DSP logic, injected into pre-built templates
2. Full generation: AI generates complete files (fallback for unsupported types)
"""

import logging
from typing import Optional, Tuple

from google import genai
from google.genai import types

from backend.config import Settings
from backend.prompts.system_prompts import (
    SYSTEM_PROMPT,
    get_repair_prompt,
    get_template_prompt,
    get_template_repair_prompt,
)
from backend.code_parser import CodeParser
from backend.template_manager import TemplateManager, PluginType, PluginTemplate

logger = logging.getLogger(__name__)


class AISynthesizer:
    """
    AI code generation with fallback support.

    Primary: Gemini (fast, cheap, 1M context)
    Fallback: Claude (better at complex debugging)
    """

    def __init__(self, settings: Settings):
        """
        Initialize AI clients.

        Args:
            settings: Application settings with API keys
        """
        self.settings = settings

        # Initialize Gemini client (new google.genai API)
        self.gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
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

        Uses template-based generation for known plugin types (gain, waveshaper,
        filter, delay) and falls back to full generation for generic/unknown types.

        Args:
            user_prompt: User's plugin description

        Returns:
            Tuple of (processor_code, editor_code, error_message)
            On success: (code, code, None)
            On failure: (None, None, error_message)
        """
        # Detect plugin type from prompt
        plugin_type = TemplateManager.detect_plugin_type(user_prompt)
        logger.info(f"Detected plugin type: {plugin_type.value}")

        # Use template-based generation for known types
        if plugin_type != PluginType.GENERIC:
            processor, editor, error = await self._generate_with_template(
                user_prompt, plugin_type
            )
            if processor and editor:
                return processor, editor, None
            logger.warning(f"Template-based generation failed: {error}")
            # Don't fall through to full generation - template should work

        # Full generation for GENERIC type or as primary for unknown
        logger.info("Using full code generation mode")

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

    async def _generate_with_template(
        self, user_prompt: str, plugin_type: PluginType
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Generate code using template-based logic injection.

        The AI only generates the DSP logic, which is injected into
        pre-built, validated templates.

        Args:
            user_prompt: User's plugin description
            plugin_type: Detected plugin type

        Returns:
            Tuple of (processor_code, editor_code, error_message)
        """
        try:
            # Get the template for this plugin type
            template = TemplateManager.get_template(plugin_type)
            logger.info(f"Using {plugin_type.value} template")

            # Build prompt asking for just DSP logic
            prompt = get_template_prompt(template, user_prompt)

            # Generate DSP logic with Gemini
            logger.info("Generating DSP logic with Gemini (template mode)")
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=1024,  # Logic is short
                ),
            )

            if not response.text:
                return None, None, "Gemini returned empty response for logic"

            # Extract DSP logic from response
            logic = CodeParser.extract_logic_block(response.text)
            if not logic:
                logger.warning(f"Failed to extract logic. Response: {response.text[:500]}")
                return None, None, "Failed to extract DSP logic from AI response"

            # Validate logic for security
            is_valid, validation_error = CodeParser.validate_logic(logic)
            if not is_valid:
                return None, None, f"Logic validation failed: {validation_error}"

            # Inject logic into template
            processor_code = TemplateManager.inject_logic(
                template.processor_template, logic
            )
            editor_code = template.editor_template  # Editor doesn't need logic injection

            # Validate final code
            is_valid, validation_error = CodeParser.validate_code(
                processor_code, editor_code
            )
            if not is_valid:
                return None, None, f"Template code validation failed: {validation_error}"

            logger.info(f"Template-based generation successful ({plugin_type.value})")
            return processor_code, editor_code, None

        except Exception as e:
            logger.exception("Template-based generation error")
            return None, None, f"Template generation error: {str(e)}"

    async def _generate_with_gemini(
        self, user_prompt: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Generate code using Gemini."""
        try:
            logger.info("Generating code with Gemini")

            # Use the new google.genai API
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=8192,
                ),
            )

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
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=repair_prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=8192,
                ),
            )

            if response.text:
                fixed_code = CodeParser.extract_single_file(response.text, filename)
                if fixed_code:
                    logger.info(f"Gemini repair successful for {filename}")
                    return fixed_code, None

            return None, "Failed to extract fixed code from Gemini response"

        except Exception as e:
            logger.exception("Gemini repair error")
            return None, f"Code repair failed: {str(e)}"
