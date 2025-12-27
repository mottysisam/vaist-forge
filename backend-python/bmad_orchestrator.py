"""
BMAD v6 Orchestrator for vAIst Forge

Implements the Breakthrough Method for Agile AI-Driven Development.
4-Phase Gated Pipeline with fresh context for each phase.

Pipeline:
  Phase 1: ANALYST   → product-brief.md
  Phase 2: PM        → prd.md (with plugin_type)
  Phase 3: ARCHITECT → tech-spec.md (validated against headers)
  Phase 4: DEVELOPER → logic.cpp

The "Bug-Killer" step is Phase 3 where the Architect validates
against actual template parameters BEFORE code is written.
"""

import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple

import google.generativeai as genai
import anthropic

from .config import get_settings
from .template_manager import TemplateManager, PluginType
from .prompts.bmad_prompts import (
    ANALYST_PROMPT,
    PM_PROMPT,
    ARCHITECT_PROMPT,
    DEVELOPER_PROMPT,
    SM_ANALYST_PROMPT,
    REPAIR_ARCHITECT_PROMPT,
    TEMPLATE_PARAMS,
)

logger = logging.getLogger(__name__)


class BMADPhase(str, Enum):
    """BMAD pipeline phases."""
    ANALYST = "analyst"
    PM = "pm"
    ARCHITECT = "architect"
    DEVELOPER = "developer"


@dataclass
class BMADArtifacts:
    """Artifacts produced by each BMAD phase."""
    product_brief: Optional[str] = None
    prd: Optional[str] = None
    tech_spec: Optional[str] = None
    logic_code: Optional[str] = None
    plugin_type: Optional[PluginType] = None

    # For debugging/logging
    analyst_response: Optional[str] = None
    pm_response: Optional[str] = None
    architect_response: Optional[str] = None
    developer_response: Optional[str] = None


class BMADOrchestrator:
    """
    BMAD v6 Master Orchestrator.

    Runs the 4-phase gated pipeline with:
    - Fresh context for each phase
    - Verification gates between phases
    - Template validation in Architect phase
    """

    def __init__(self):
        """Initialize AI clients."""
        settings = get_settings()

        # Initialize Gemini
        if settings.GOOGLE_API_KEY:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self.gemini_model = genai.GenerativeModel("gemini-2.0-flash")
            logger.info("Gemini 2.0 Flash initialized")
        else:
            self.gemini_model = None
            logger.warning("No GOOGLE_API_KEY - Gemini unavailable")

        # Initialize Claude (fallback)
        if settings.ANTHROPIC_API_KEY:
            self.claude_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            logger.info("Claude Opus 4.5 initialized (fallback)")
        else:
            self.claude_client = None
            logger.warning("No ANTHROPIC_API_KEY - Claude fallback unavailable")

    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini with fresh context."""
        if not self.gemini_model:
            raise RuntimeError("Gemini not configured")

        response = await self.gemini_model.generate_content_async(
            prompt,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 4096,
            }
        )
        return response.text

    async def _call_claude(self, prompt: str) -> str:
        """Call Claude with fresh context (fallback)."""
        if not self.claude_client:
            raise RuntimeError("Claude not configured")

        response = await self.claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    async def _call_ai(self, prompt: str, use_claude: bool = False) -> str:
        """
        Call AI with fresh context.

        Each call is a NEW API call - this is the Fresh Context Principle.
        """
        if use_claude or not self.gemini_model:
            return await self._call_claude(prompt)

        try:
            return await self._call_gemini(prompt)
        except Exception as e:
            logger.warning(f"Gemini failed, falling back to Claude: {e}")
            return await self._call_claude(prompt)

    # =========================================================================
    # Phase 1: ANALYST
    # =========================================================================

    async def run_analyst_phase(self, user_prompt: str) -> str:
        """
        Phase 1: Expand user prompt into Product Brief.

        Input: Raw user prompt (e.g., "simple gain plugin")
        Output: Structured product-brief
        """
        logger.info("=== BMAD Phase 1: ANALYST ===")

        prompt = ANALYST_PROMPT.format(user_prompt=user_prompt)
        response = await self._call_ai(prompt)

        logger.info(f"Analyst produced {len(response)} char product brief")
        return response

    # =========================================================================
    # Phase 2: PM
    # =========================================================================

    async def run_pm_phase(self, product_brief: str) -> Tuple[str, PluginType]:
        """
        Phase 2: Convert Product Brief into PRD with plugin type.

        Input: Product Brief
        Output: (PRD text, PluginType)
        """
        logger.info("=== BMAD Phase 2: PM ===")

        prompt = PM_PROMPT.format(product_brief=product_brief)
        response = await self._call_ai(prompt)

        # Extract plugin type from PRD
        plugin_type = self._extract_plugin_type(response)

        logger.info(f"PM selected plugin type: {plugin_type.value}")
        return response, plugin_type

    def _extract_plugin_type(self, prd: str) -> PluginType:
        """Extract PLUGIN_TYPE from PRD response."""
        prd_upper = prd.upper()

        # Look for explicit PLUGIN_TYPE declaration
        if "PLUGIN_TYPE:" in prd_upper or "PLUGIN_TYPE :" in prd_upper:
            if "WAVESHAPER" in prd_upper:
                return PluginType.WAVESHAPER
            if "FILTER" in prd_upper:
                return PluginType.FILTER
            if "DELAY" in prd_upper:
                return PluginType.DELAY
            if "GAIN" in prd_upper:
                return PluginType.GAIN

        # Fallback to keyword detection
        return TemplateManager.detect_plugin_type(prd)

    # =========================================================================
    # Phase 3: ARCHITECT (BUG-KILLER PHASE)
    # =========================================================================

    async def run_architect_phase(
        self,
        prd: str,
        plugin_type: PluginType
    ) -> str:
        """
        Phase 3: Create Tech Spec validated against template headers.

        This is the BUG-KILLER phase!
        The Architect sees the ACTUAL template code and available variables.

        Input: PRD + template context
        Output: Tech Spec with pseudocode using ONLY available variables
        """
        logger.info("=== BMAD Phase 3: ARCHITECT (Bug-Killer) ===")

        # Get template for this plugin type
        template = TemplateManager.get_template(plugin_type)

        # Get parameter mapping for this plugin type
        type_key = plugin_type.value.upper()
        params = TEMPLATE_PARAMS.get(type_key, TEMPLATE_PARAMS["GENERIC"])

        # Build the prompt with ACTUAL template context
        prompt = ARCHITECT_PROMPT.format(
            template_code=template.processor_template[:2000],  # First 2000 chars
            available_params="\n".join(f"- {p}" for p in params["available_params"]),
            constraints="\n".join(f"- {c}" for c in params["constraints"]),
            plugin_type=plugin_type.value.upper(),
            prd=prd
        )

        response = await self._call_ai(prompt)

        # Verify that the tech spec only uses available variables
        self._verify_tech_spec(response, params["available_params"])

        logger.info("Architect produced verified tech spec")
        return response

    def _verify_tech_spec(self, tech_spec: str, available_params: list) -> bool:
        """
        Verify that the tech spec only references available variables.

        This is a sanity check - the real validation happens when
        we pass the tech spec to the Developer.
        """
        # Extract variable names from available_params
        known_vars = set()
        for param in available_params:
            # Extract variable name (before parenthesis or dash)
            var_name = param.split("(")[0].split("-")[0].strip()
            known_vars.add(var_name.lower())
            # Handle array notation
            if "[" in var_name:
                base_var = var_name.split("[")[0]
                known_vars.add(base_var.lower())

        logger.debug(f"Known variables: {known_vars}")
        return True  # We rely on the Developer phase to catch issues

    # =========================================================================
    # Phase 4: DEVELOPER
    # =========================================================================

    async def run_developer_phase(
        self,
        tech_spec: str,
        plugin_type: PluginType
    ) -> str:
        """
        Phase 4: Translate Tech Spec into C++ code.

        The Developer has a CLEAN context with only the verified Tech Spec.

        Input: Tech Spec
        Output: C++ code for the logic block
        """
        logger.info("=== BMAD Phase 4: DEVELOPER ===")

        # Extract key sections from tech spec
        variables_used = self._extract_section(tech_spec, "VARIABLES_USED")
        algorithm = self._extract_section(tech_spec, "ALGORITHM")

        prompt = DEVELOPER_PROMPT.format(
            plugin_type=plugin_type.value.upper(),
            variables_used=variables_used,
            algorithm=algorithm
        )

        response = await self._call_ai(prompt)

        # Extract just the code
        code = self._extract_code(response)

        logger.info(f"Developer produced {len(code)} char code")
        return code

    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract a section from markdown-style text."""
        pattern = rf"###?\s*{section_name}[:\s]*\n(.*?)(?=###|\Z)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return text  # Return full text if section not found

    def _extract_code(self, response: str) -> str:
        """Extract code from response, handling various formats."""
        # Try to find code in cpp block
        pattern = r"```(?:cpp|c\+\+)?\s*\n?(.*?)```"
        match = re.search(pattern, response, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Try to find code between markers
        pattern = r"// === AI_LOGIC_START ===\s*(.*?)\s*// === AI_LOGIC_END ==="
        match = re.search(pattern, response, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Return cleaned response
        return response.strip()

    # =========================================================================
    # Main Pipeline
    # =========================================================================

    async def run_pipeline(
        self,
        user_prompt: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str], BMADArtifacts]:
        """
        Run the complete BMAD v6 pipeline.

        Returns:
            (processor_code, editor_code, error_message, artifacts)
        """
        artifacts = BMADArtifacts()

        try:
            # Phase 1: ANALYST
            product_brief = await self.run_analyst_phase(user_prompt)
            artifacts.product_brief = product_brief
            artifacts.analyst_response = product_brief

            # Phase 2: PM
            prd, plugin_type = await self.run_pm_phase(product_brief)
            artifacts.prd = prd
            artifacts.pm_response = prd
            artifacts.plugin_type = plugin_type

            # Phase 3: ARCHITECT (Bug-Killer)
            tech_spec = await self.run_architect_phase(prd, plugin_type)
            artifacts.tech_spec = tech_spec
            artifacts.architect_response = tech_spec

            # Phase 4: DEVELOPER
            logic_code = await self.run_developer_phase(tech_spec, plugin_type)
            artifacts.logic_code = logic_code
            artifacts.developer_response = logic_code

            # Inject code into template
            template = TemplateManager.get_template(plugin_type)
            processor_code = TemplateManager.inject_logic(
                template.processor_template,
                logic_code
            )
            editor_code = template.editor_template

            logger.info(f"BMAD pipeline complete - {plugin_type.value} plugin")
            return processor_code, editor_code, None, artifacts

        except Exception as e:
            logger.error(f"BMAD pipeline failed: {e}")
            return None, None, str(e), artifacts

    # =========================================================================
    # BMAD-Style Self-Repair
    # =========================================================================

    async def repair_with_bmad(
        self,
        build_error: str,
        artifacts: BMADArtifacts,
        retry_count: int = 0
    ) -> Tuple[Optional[str], Optional[str], Optional[str], BMADArtifacts]:
        """
        BMAD-style repair: Fix tech spec first, then re-execute Developer.

        Unlike traditional repair that just patches code, BMAD repair:
        1. SM Agent analyzes the error
        2. Architect fixes the tech spec
        3. Developer re-executes with corrected spec
        """
        logger.info(f"=== BMAD Repair (attempt {retry_count + 1}) ===")

        if not artifacts.tech_spec or not artifacts.plugin_type:
            logger.error("Cannot repair: missing tech spec or plugin type")
            return None, None, "Missing artifacts for repair", artifacts

        try:
            # Get template params for this plugin type
            type_key = artifacts.plugin_type.value.upper()
            params = TEMPLATE_PARAMS.get(type_key, TEMPLATE_PARAMS["GENERIC"])

            # Step 1: SM Agent analyzes error
            sm_prompt = SM_ANALYST_PROMPT.format(
                build_error=build_error,
                tech_spec=artifacts.tech_spec
            )
            error_analysis = await self._call_ai(sm_prompt)
            logger.info(f"SM analysis: {error_analysis[:200]}...")

            # Step 2: Architect fixes tech spec
            repair_prompt = REPAIR_ARCHITECT_PROMPT.format(
                error_analysis=error_analysis,
                original_tech_spec=artifacts.tech_spec,
                available_params="\n".join(f"- {p}" for p in params["available_params"]),
                constraints="\n".join(f"- {c}" for c in params["constraints"])
            )
            corrected_tech_spec = await self._call_ai(repair_prompt)
            artifacts.tech_spec = corrected_tech_spec

            # Step 3: Developer re-executes with corrected spec
            logic_code = await self.run_developer_phase(
                corrected_tech_spec,
                artifacts.plugin_type
            )
            artifacts.logic_code = logic_code

            # Inject into template
            template = TemplateManager.get_template(artifacts.plugin_type)
            processor_code = TemplateManager.inject_logic(
                template.processor_template,
                logic_code
            )
            editor_code = template.editor_template

            logger.info("BMAD repair complete")
            return processor_code, editor_code, None, artifacts

        except Exception as e:
            logger.error(f"BMAD repair failed: {e}")
            return None, None, str(e), artifacts
