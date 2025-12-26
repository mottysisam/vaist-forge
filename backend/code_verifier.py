"""
vAIst Code Verifier
Pre-commit validation to catch AI hallucinations before GitHub builds.

This module implements the "Architect Verification Gate" that:
1. Extracts all valid identifiers from template context
2. Detects undeclared identifiers in AI-generated logic
3. Auto-corrects common typos/variations
4. Uses AI to fix remaining issues
"""

import re
import logging
from typing import Optional, Tuple, Set, Dict, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class VerificationResult:
    """Result of code verification."""
    is_valid: bool
    corrected_code: Optional[str]
    errors: List[str]
    corrections_made: List[str]


# Mapping of template types to their available identifiers
# This is the source of truth for what variables the AI can use
TEMPLATE_IDENTIFIERS: Dict[str, Dict[str, Set[str]]] = {
    "gain": {
        "parameters": {"gainParameter", "gain"},
        "variables": {"channelData", "numSamples", "sample", "channel", "buffer"},
        "functions": {"get", "set"},
    },
    "waveshaper": {
        "parameters": {"driveParam", "mixParam", "drive", "mix"},
        "variables": {"channelData", "numSamples", "sample", "channel", "buffer", "dry", "wet"},
        "functions": {"get", "set", "tanh", "atan", "sin", "cos", "abs", "sqrt", "pow"},
    },
    "filter": {
        "parameters": {"cutoffParam", "resonanceParam", "cutoff", "Q"},
        "variables": {
            "channelData", "numSamples", "sample", "channel", "buffer",
            "input", "output", "z1", "z2", "sampleRate",
            "b0", "b1", "b2", "a0", "a1", "a2",
            "omega", "sinOmega", "cosOmega", "alpha"
        },
        "functions": {"get", "set", "sin", "cos"},
    },
    "delay": {
        "parameters": {"delayTimeParam", "feedbackParam", "mixParam", "delayTime", "feedback", "mix"},
        "variables": {
            "channelData", "numSamples", "sample", "channel", "buffer",
            "dry", "wet", "delayData", "readPos", "writePosition", "bufferSize", "delaySamples"
        },
        "functions": {"get", "set"},
    },
}

# Common AI typos/hallucinations mapped to correct identifiers
TYPO_CORRECTIONS: Dict[str, str] = {
    # Parameter variations
    "gainParam": "gainParameter",
    "gainValue": "gain",
    "gainAmount": "gain",
    "masterGain": "gain",
    "volumeParam": "gainParameter",
    "volume": "gain",

    "driveParameter": "driveParam",
    "driveValue": "drive",
    "driveAmount": "drive",
    "distortion": "drive",
    "distortionAmount": "drive",

    "mixParameter": "mixParam",
    "mixValue": "mix",
    "mixAmount": "mix",
    "wetDry": "mix",
    "dryWet": "mix",
    "wetMix": "mix",

    "cutoffParameter": "cutoffParam",
    "cutoffValue": "cutoff",
    "cutoffFreq": "cutoff",
    "filterCutoff": "cutoff",
    "frequency": "cutoff",
    "freq": "cutoff",

    "resonanceParameter": "resonanceParam",
    "resonanceValue": "Q",
    "res": "Q",
    "q": "Q",

    "delayTimeParameter": "delayTimeParam",
    "delayTimeValue": "delayTime",
    "time": "delayTime",
    "delay": "delayTime",

    "feedbackParameter": "feedbackParam",
    "feedbackValue": "feedback",
    "feedbackAmount": "feedback",
    "fb": "feedback",

    # Variable variations
    "samples": "numSamples",
    "numSample": "numSamples",
    "sampleCount": "numSamples",
    "bufferSize": "numSamples",

    "data": "channelData",
    "audioData": "channelData",
    "inputData": "channelData",
    "outputData": "channelData",

    "inputSample": "dry",
    "drySignal": "dry",
    "originalSample": "dry",

    "outputSample": "wet",
    "wetSignal": "wet",
    "processedSample": "wet",
}


class CodeVerifier:
    """
    Verifies AI-generated DSP logic against template context.

    This is the "Architect Verification Gate" that catches hallucinations
    before they reach the GitHub build.
    """

    @classmethod
    def get_valid_identifiers(cls, template_type: str) -> Set[str]:
        """
        Get all valid identifiers for a template type.

        Args:
            template_type: Type of plugin template (gain, waveshaper, etc.)

        Returns:
            Set of valid identifier names
        """
        template_ids = TEMPLATE_IDENTIFIERS.get(template_type.lower(), {})

        all_ids = set()
        for category in template_ids.values():
            all_ids.update(category)

        # Add C++ standard identifiers that are always valid
        all_ids.update({
            # Standard library
            "std", "tanh", "atan", "sin", "cos", "abs", "sqrt", "pow", "log", "exp",
            "min", "max", "clamp", "floor", "ceil", "round",
            # C++ keywords/types
            "float", "int", "double", "bool", "auto", "const", "static",
            "if", "else", "for", "while", "return", "true", "false",
            # JUCE types
            "juce", "MathConstants", "pi",
        })

        return all_ids

    @classmethod
    def extract_identifiers_from_code(cls, code: str) -> Set[str]:
        """
        Extract all identifiers used in code.

        Args:
            code: C++ code to analyze

        Returns:
            Set of identifier names found in the code
        """
        # Match C++ identifiers (word characters starting with letter or underscore)
        # Exclude numbers, keywords, and string literals

        # Remove string literals first
        code_no_strings = re.sub(r'"[^"]*"', '', code)
        code_no_strings = re.sub(r"'[^']*'", '', code_no_strings)

        # Remove comments
        code_no_comments = re.sub(r'//.*$', '', code_no_strings, flags=re.MULTILINE)
        code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)

        # Find all identifiers
        identifiers = set(re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', code_no_comments))

        # Remove C++ keywords (they're not "user" identifiers)
        cpp_keywords = {
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
            'break', 'continue', 'return', 'void', 'int', 'float', 'double',
            'bool', 'char', 'auto', 'const', 'static', 'true', 'false',
            'nullptr', 'new', 'delete', 'class', 'struct', 'public', 'private',
            'protected', 'virtual', 'override', 'template', 'typename',
            'sizeof', 'using', 'namespace', 'include',
        }

        return identifiers - cpp_keywords

    @classmethod
    def find_undeclared_identifiers(
        cls,
        code: str,
        template_type: str
    ) -> Tuple[Set[str], Dict[str, str]]:
        """
        Find identifiers in code that aren't declared in the template.

        Args:
            code: AI-generated DSP logic
            template_type: Type of plugin template

        Returns:
            Tuple of (undeclared_ids, suggested_corrections)
        """
        valid_ids = cls.get_valid_identifiers(template_type)
        used_ids = cls.extract_identifiers_from_code(code)

        undeclared = set()
        corrections = {}

        for identifier in used_ids:
            # Check if identifier is valid
            if identifier in valid_ids:
                continue

            # Check case-insensitive match
            lower_id = identifier.lower()
            for valid_id in valid_ids:
                if valid_id.lower() == lower_id:
                    corrections[identifier] = valid_id
                    break
            else:
                # Check typo corrections
                if identifier in TYPO_CORRECTIONS:
                    correction = TYPO_CORRECTIONS[identifier]
                    if correction in valid_ids:
                        corrections[identifier] = correction
                    else:
                        undeclared.add(identifier)
                else:
                    undeclared.add(identifier)

        return undeclared, corrections

    @classmethod
    def auto_correct_code(cls, code: str, corrections: Dict[str, str]) -> str:
        """
        Apply automatic corrections to code.

        Args:
            code: Original code
            corrections: Dict mapping wrong identifiers to correct ones

        Returns:
            Corrected code
        """
        corrected = code

        for wrong, right in corrections.items():
            # Use word boundary to avoid partial replacements
            pattern = rf'\b{re.escape(wrong)}\b'
            corrected = re.sub(pattern, right, corrected)

        return corrected

    @classmethod
    def verify_logic(
        cls,
        logic_code: str,
        template_type: str,
        auto_correct: bool = True
    ) -> VerificationResult:
        """
        Verify AI-generated DSP logic against template context.

        This is the main verification entry point.

        Args:
            logic_code: AI-generated DSP logic
            template_type: Type of plugin template
            auto_correct: Whether to attempt automatic corrections

        Returns:
            VerificationResult with validation status and corrections
        """
        errors = []
        corrections_made = []
        corrected_code = logic_code

        # Find issues
        undeclared, suggested_corrections = cls.find_undeclared_identifiers(
            logic_code, template_type
        )

        # Apply auto-corrections if enabled
        if auto_correct and suggested_corrections:
            corrected_code = cls.auto_correct_code(logic_code, suggested_corrections)
            for wrong, right in suggested_corrections.items():
                corrections_made.append(f"'{wrong}' → '{right}'")
                logger.info(f"Auto-corrected: {wrong} → {right}")

        # Re-check after corrections
        if corrected_code != logic_code:
            undeclared, remaining_corrections = cls.find_undeclared_identifiers(
                corrected_code, template_type
            )

        # Report any remaining undeclared identifiers
        for identifier in undeclared:
            errors.append(f"Undeclared identifier: '{identifier}'")
            logger.warning(f"Undeclared identifier in AI logic: {identifier}")

        is_valid = len(undeclared) == 0

        return VerificationResult(
            is_valid=is_valid,
            corrected_code=corrected_code if is_valid or corrections_made else None,
            errors=errors,
            corrections_made=corrections_made
        )

    @classmethod
    def get_context_prompt(cls, template_type: str) -> str:
        """
        Generate a context prompt that tells the AI exactly what identifiers are available.

        This should be included in the system prompt to prevent hallucinations.

        Args:
            template_type: Type of plugin template

        Returns:
            Context string for AI prompt
        """
        template_ids = TEMPLATE_IDENTIFIERS.get(template_type.lower(), {})

        lines = [
            f"AVAILABLE IDENTIFIERS FOR {template_type.upper()} TEMPLATE:",
            "",
            "Parameters (use ->get() to read):"
        ]

        if "parameters" in template_ids:
            for param in sorted(template_ids["parameters"]):
                lines.append(f"  - {param}")

        lines.append("")
        lines.append("Variables (already declared, use directly):")

        if "variables" in template_ids:
            for var in sorted(template_ids["variables"]):
                lines.append(f"  - {var}")

        lines.append("")
        lines.append("IMPORTANT: Only use the identifiers listed above.")
        lines.append("Do NOT invent new variable names or use variations like:")
        lines.append("  - mixParameter (use mixParam)")
        lines.append("  - driveValue (use drive)")
        lines.append("  - gainAmount (use gain)")

        return "\n".join(lines)


def verify_before_commit(
    logic_code: str,
    template_type: str
) -> Tuple[bool, str, List[str]]:
    """
    Convenience function for verification gate.

    Args:
        logic_code: AI-generated logic
        template_type: Template type

    Returns:
        Tuple of (is_valid, corrected_code, error_messages)
    """
    result = CodeVerifier.verify_logic(logic_code, template_type)

    if result.corrections_made:
        logger.info(f"Made {len(result.corrections_made)} automatic corrections")

    if not result.is_valid:
        logger.error(f"Verification failed: {result.errors}")

    return (
        result.is_valid,
        result.corrected_code or logic_code,
        result.errors
    )
