"""
vAIst AI Synthesizer
AI code generation with Gemini (primary) and Claude (fallback).

Supports three generation modes (in priority order):
1. Schema-based: AI outputs JSON → Python generates perfect C++ (ZERO typos)
2. Template-based: AI generates only DSP logic, injected into pre-built templates
3. Full generation: AI generates complete files (fallback for unsupported types)

The Schema-based mode eliminates 100% of AI typos in variable names and syntax
by having Python templates generate the C++ code deterministically.
"""

import json
import logging
from typing import Optional, Tuple, Dict

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
from backend.code_verifier import CodeVerifier, verify_before_commit
from backend.schemas import (
    PluginResponse,
    PluginCategory,
    get_gemini_schema,
    get_schema_prompt,
)
from backend.cpp_generator import generate_from_schema, CppGenerator

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
        self, user_prompt: str,
        use_schema_mode: bool = True
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Generate VST code from user prompt.

        Generation priority:
        1. Schema-based: AI outputs JSON → Python generates C++ (ZERO typos)
        2. Template-based: AI generates DSP logic → injected into templates
        3. Full generation: AI generates complete files (fallback)

        Args:
            user_prompt: User's plugin description
            use_schema_mode: Whether to try schema-based generation first

        Returns:
            Tuple of (processor_cpp, editor_cpp, processor_h, editor_h, error_message)
            On success: (code, code, header, header, None)
            On failure: (None, None, None, None, error_message)
        """
        # === MODE 1: Schema-Based Generation (ZERO TYPOS) ===
        if use_schema_mode:
            logger.info("Attempting schema-based generation (zero-typo mode)")
            files, error = await self._generate_with_schema(user_prompt)
            if files:
                return files['processor_cpp'], files['editor_cpp'], files['processor_h'], files['editor_h'], None
            logger.warning(f"Schema-based generation failed: {error}")
            # Fall through to template-based mode

        # Detect plugin type from prompt for template-based mode
        plugin_type = TemplateManager.detect_plugin_type(user_prompt)
        logger.info(f"Detected plugin type: {plugin_type.value}")

        # === MODE 2: Template-Based Generation ===
        if plugin_type != PluginType.GENERIC:
            processor, editor, error = await self._generate_with_template(
                user_prompt, plugin_type
            )
            if processor and editor:
                # Template mode: headers are already in repo, return None for them
                return processor, editor, None, None, None
            logger.warning(f"Template-based generation failed: {error}")
            # Don't fall through to full generation - template should work

        # === MODE 3: Full Generation (Fallback) ===
        logger.info("Using full code generation mode")

        # Try Gemini first (primary coder)
        processor, editor, error = await self._generate_with_gemini(user_prompt)
        if processor and editor:
            # Full generation: headers are part of full AI output (not yet supported)
            return processor, editor, None, None, None

        logger.warning(f"Gemini generation failed: {error}")

        # Fallback to Claude (architect)
        if self.claude_client:
            processor, editor, error = await self._generate_with_claude(user_prompt)
            if processor and editor:
                return processor, editor, None, None, None
            logger.warning(f"Claude generation failed: {error}")
            return None, None, None, None, f"All AI models failed. Last error: {error}"

        return None, None, None, None, f"Gemini failed: {error}. No Claude fallback available."

    async def _generate_with_schema(
        self, user_prompt: str
    ) -> Tuple[Optional[Dict[str, str]], Optional[str]]:
        """
        Generate code using schema-based structured output.

        This mode eliminates 100% of AI typos by:
        1. AI outputs structured JSON (parameters, DSP config)
        2. Python generates the exact C++ code from templates

        The AI NEVER writes C++ code directly. It only provides data.

        Args:
            user_prompt: User's plugin description

        Returns:
            Tuple of (files_dict, error_message)
            files_dict has keys: processor_h, processor_cpp, editor_h, editor_cpp
        """
        try:
            logger.info("Schema-based generation: AI will output JSON, Python writes C++")

            # Build the schema prompt
            schema_prompt = get_schema_prompt()
            full_prompt = f"""Based on the following plugin request, output a structured JSON response.

{schema_prompt}

USER REQUEST:
{user_prompt}

Remember: Output ONLY valid JSON matching the schema above. No markdown, no explanation."""

            # Call Gemini with JSON response mode
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    max_output_tokens=2048,
                ),
            )

            if not response.text:
                return None, "Gemini returned empty response for schema mode"

            # Parse JSON response
            try:
                json_response = json.loads(response.text)
                logger.info(f"Schema response: {json.dumps(json_response, indent=2)[:500]}...")
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON: {response.text[:500]}")
                return None, f"AI returned invalid JSON: {str(e)}"

            # Validate against Pydantic schema
            try:
                plugin_response = PluginResponse(**json_response)
                logger.info(f"Validated schema: {plugin_response.plugin_name} ({plugin_response.category.value})")
                logger.info(f"Parameters: {[p.name for p in plugin_response.parameters]}")
            except Exception as e:
                logger.warning(f"Schema validation failed: {str(e)}")
                return None, f"Schema validation failed: {str(e)}"

            # Generate all 4 C++ files from validated schema
            files = generate_from_schema(plugin_response)

            # Validate the generated .cpp files
            is_valid, validation_error = CodeParser.validate_code(
                files['processor_cpp'], files['editor_cpp']
            )
            if not is_valid:
                # This should never happen since we control the templates
                logger.error(f"Template validation failed (unexpected): {validation_error}")
                return None, f"Template code validation failed: {validation_error}"

            logger.info(f"Schema-based generation successful: {plugin_response.plugin_name}")
            logger.info(f"  Generated files: {list(files.keys())}")
            return files, None

        except Exception as e:
            logger.exception("Schema-based generation error")
            return None, f"Schema generation error: {str(e)}"

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
            # Include plugin_type for CodeVerifier exact identifier context
            prompt = get_template_prompt(template, user_prompt, plugin_type.value)

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

            # === ARCHITECT VERIFICATION GATE ===
            # Verify identifiers against template context before injection
            logger.info("Running Architect Verification Gate...")
            is_verified, verified_logic, verification_errors = verify_before_commit(
                logic, plugin_type.value
            )

            if not is_verified:
                logger.warning(f"Verification found issues: {verification_errors}")
                # Attempt AI-assisted repair
                repaired_logic = await self._repair_logic_with_ai(
                    logic, verification_errors, plugin_type
                )
                if repaired_logic:
                    logic = repaired_logic
                    logger.info("AI-assisted repair successful")
                else:
                    # Use auto-corrected version if available
                    if verified_logic and verified_logic != logic:
                        logic = verified_logic
                        logger.info("Using auto-corrected logic")
                    else:
                        return None, None, f"Verification failed: {', '.join(verification_errors)}"
            else:
                # Use verified (possibly auto-corrected) logic
                logic = verified_logic or logic
                logger.info("Architect Verification Gate: PASSED")

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

    async def _repair_logic_with_ai(
        self,
        logic_code: str,
        errors: list,
        plugin_type: PluginType,
    ) -> Optional[str]:
        """
        Use AI to fix undeclared identifier errors in logic.

        This is the Architect agent's repair capability.

        Args:
            logic_code: The problematic logic code
            errors: List of error messages (undeclared identifiers)
            plugin_type: Plugin template type

        Returns:
            Repaired logic code or None if repair fails
        """
        # Get the valid identifiers context
        context = CodeVerifier.get_context_prompt(plugin_type.value)

        repair_prompt = f"""Fix the following C++ DSP logic code. It has undeclared identifier errors.

ERRORS:
{chr(10).join(f'- {e}' for e in errors)}

{context}

ORIGINAL CODE:
```cpp
{logic_code}
```

TASK: Rewrite the code using ONLY the identifiers listed above.
Replace any unknown variables with the correct ones from the list.
Return ONLY the corrected code between ``` markers, no explanations."""

        # Try Claude first (better at precise fixes)
        if self.claude_client:
            try:
                logger.info("Attempting AI logic repair with Claude")
                message = self.claude_client.messages.create(
                    model=self.settings.CLAUDE_MODEL,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": repair_prompt}],
                )

                response_text = message.content[0].text
                repaired = CodeParser.extract_logic_block(response_text)

                if repaired:
                    # Verify the repair
                    is_valid, _, remaining_errors = verify_before_commit(
                        repaired, plugin_type.value
                    )
                    if is_valid:
                        logger.info("Claude repair successful and verified")
                        return repaired
                    else:
                        logger.warning(f"Claude repair still has errors: {remaining_errors}")

            except Exception as e:
                logger.warning(f"Claude repair failed: {e}")

        # Fallback to Gemini
        try:
            logger.info("Attempting AI logic repair with Gemini")
            response = self.gemini_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=repair_prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=1024,
                ),
            )

            if response.text:
                repaired = CodeParser.extract_logic_block(response.text)

                if repaired:
                    # Verify the repair
                    is_valid, _, remaining_errors = verify_before_commit(
                        repaired, plugin_type.value
                    )
                    if is_valid:
                        logger.info("Gemini repair successful and verified")
                        return repaired
                    else:
                        logger.warning(f"Gemini repair still has errors: {remaining_errors}")

        except Exception as e:
            logger.warning(f"Gemini repair failed: {e}")

        return None
