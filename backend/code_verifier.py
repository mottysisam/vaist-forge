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


# ============================================================================
# HEADER CONSISTENCY VALIDATION
# Validates that all identifiers used in .cpp files are declared in .h files
# ============================================================================

class HeaderConsistencyValidator:
    """
    Validates header/source consistency before GitHub push.

    This prevents the #1 cause of build failures: using identifiers in .cpp
    that aren't declared in the corresponding .h file.
    """

    # Common JUCE types that are always available
    JUCE_TYPES = {
        'juce', 'AudioProcessor', 'AudioProcessorEditor', 'AudioBuffer',
        'MidiBuffer', 'AudioParameterFloat', 'AudioParameterInt',
        'AudioParameterBool', 'AudioParameterChoice',
        'Slider', 'Label', 'ComboBox', 'TextButton', 'ToggleButton',
        'Graphics', 'Colour', 'Rectangle', 'String', 'StringArray',
        'File', 'MemoryBlock', 'XmlElement', 'ValueTree',
        'Component', 'Timer', 'LookAndFeel', 'Font',
        'dsp', 'ProcessSpec', 'AudioBlock', 'ProcessContextReplacing',
        'IIR', 'Coefficients', 'Filter', 'Oscillator', 'Gain',
        'MathConstants', 'pi', 'twoPi',
        'ScopedPointer', 'OwnedArray', 'ReferenceCountedObjectPtr',
    }

    # C++ standard identifiers
    CPP_STANDARD = {
        'std', 'vector', 'array', 'string', 'unique_ptr', 'shared_ptr',
        'make_unique', 'make_shared', 'move', 'forward',
        'sin', 'cos', 'tan', 'tanh', 'atan', 'atan2', 'sqrt', 'pow',
        'abs', 'fabs', 'floor', 'ceil', 'round', 'log', 'log10', 'exp',
        'min', 'max', 'clamp', 'swap',
        'size_t', 'int32_t', 'int64_t', 'uint32_t', 'uint64_t',
        'nullptr', 'true', 'false', 'this',
    }

    # C++ keywords (not user identifiers)
    CPP_KEYWORDS = {
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
        'break', 'continue', 'return', 'goto',
        'void', 'int', 'float', 'double', 'bool', 'char', 'long', 'short',
        'signed', 'unsigned', 'auto', 'const', 'constexpr', 'static',
        'inline', 'virtual', 'override', 'final', 'explicit',
        'public', 'private', 'protected', 'class', 'struct', 'enum',
        'union', 'typedef', 'using', 'namespace', 'template', 'typename',
        'new', 'delete', 'sizeof', 'alignof', 'decltype',
        'try', 'catch', 'throw', 'noexcept',
        'volatile', 'mutable', 'register', 'extern', 'static_cast',
        'dynamic_cast', 'reinterpret_cast', 'const_cast',
    }

    @classmethod
    def extract_header_declarations(cls, header_code: str) -> Set[str]:
        """
        Extract all declared identifiers from a header file.

        Extracts:
        - Class member variables
        - Method names
        - Typedefs/using declarations
        - Parameter names from method signatures
        """
        declarations = set()

        if not header_code:
            return declarations

        # Remove comments
        code = re.sub(r'//.*$', '', header_code, flags=re.MULTILINE)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)

        # Remove string literals
        code = re.sub(r'"[^"]*"', '""', code)
        code = re.sub(r"'[^']*'", "''", code)

        # Extract member variable declarations
        # Pattern: type name; or type* name; or type& name;
        member_pattern = r'(?:juce::)?(?:\w+(?:<[^>]+>)?)\s*[*&]?\s+(\w+)\s*(?:=|;|\{)'
        declarations.update(re.findall(member_pattern, code))

        # Extract method declarations
        # Pattern: returnType methodName(
        method_pattern = r'\b(\w+)\s*\([^)]*\)\s*(?:const|override|final|noexcept|\{|;)'
        declarations.update(re.findall(method_pattern, code))

        # Extract using/typedef declarations
        using_pattern = r'using\s+(\w+)\s*='
        declarations.update(re.findall(using_pattern, code))

        # Extract enum values
        enum_pattern = r'enum\s+(?:class\s+)?(\w+)'
        declarations.update(re.findall(enum_pattern, code))

        # Remove keywords
        declarations -= cls.CPP_KEYWORDS

        logger.debug(f"Found {len(declarations)} declarations in header")
        return declarations

    @classmethod
    def extract_cpp_identifiers(cls, cpp_code: str) -> Set[str]:
        """
        Extract identifiers used in a .cpp file that need declaration.

        Focuses on member variable and method usage, not local variables.
        """
        if not cpp_code:
            return set()

        # Remove comments
        code = re.sub(r'//.*$', '', cpp_code, flags=re.MULTILINE)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)

        # Remove string literals
        code = re.sub(r'"[^"]*"', '""', code)
        code = re.sub(r"'[^']*'", "''", code)

        # Find all identifiers
        all_identifiers = set(re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', code))

        # Remove C++ keywords and standard library
        all_identifiers -= cls.CPP_KEYWORDS
        all_identifiers -= cls.CPP_STANDARD
        all_identifiers -= cls.JUCE_TYPES

        # Remove local variable declarations (type name = ...)
        # These are declared in the .cpp and don't need header declarations
        local_decl_pattern = r'(?:auto|float|int|double|bool|const\s+auto|const\s+float|const\s+int)\s+(\w+)\s*='
        local_vars = set(re.findall(local_decl_pattern, code))
        all_identifiers -= local_vars

        # Remove loop variables
        for_pattern = r'for\s*\([^;]*\s+(\w+)\s*='
        for_vars = set(re.findall(for_pattern, code))
        all_identifiers -= for_vars

        # Remove common local variable patterns
        common_locals = {
            'i', 'j', 'k', 'n', 'x', 'y', 'z',
            'sample', 'channel', 'numSamples', 'totalNumInputChannels',
            'totalNumOutputChannels', 'channelData', 'buffer',
            'spec', 'context', 'block', 'input', 'output',
            'dry', 'wet', 'width', 'height', 'bounds',
        }
        all_identifiers -= common_locals

        return all_identifiers

    @classmethod
    def validate_consistency(
        cls,
        processor_h: Optional[str],
        processor_cpp: str,
        editor_h: Optional[str],
        editor_cpp: str
    ) -> Tuple[bool, List[str]]:
        """
        Validate that .cpp files only use identifiers declared in .h files.

        Args:
            processor_h: PluginProcessor.h content (optional)
            processor_cpp: PluginProcessor.cpp content
            editor_h: PluginEditor.h content (optional)
            editor_cpp: PluginEditor.cpp content

        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []

        # If headers are missing, we can't validate (but that's a problem itself)
        if not processor_h:
            errors.append("Missing PluginProcessor.h - cannot validate header consistency")
            logger.warning("No processor header provided for consistency check")

        if not editor_h:
            errors.append("Missing PluginEditor.h - cannot validate header consistency")
            logger.warning("No editor header provided for consistency check")

        # If we have headers, validate them
        if processor_h and processor_cpp:
            proc_declarations = cls.extract_header_declarations(processor_h)
            proc_used = cls.extract_cpp_identifiers(processor_cpp)

            # Add declarations from editor header (for cross-references)
            if editor_h:
                proc_declarations.update(cls.extract_header_declarations(editor_h))

            # Find undeclared identifiers
            undeclared_proc = proc_used - proc_declarations

            # Filter out false positives (JUCE method calls, etc.)
            undeclared_proc = cls._filter_false_positives(undeclared_proc, processor_cpp)

            for ident in sorted(undeclared_proc):
                errors.append(f"PluginProcessor.cpp uses undeclared identifier: '{ident}'")
                logger.warning(f"Undeclared in processor: {ident}")

        if editor_h and editor_cpp:
            editor_declarations = cls.extract_header_declarations(editor_h)
            editor_used = cls.extract_cpp_identifiers(editor_cpp)

            # Add declarations from processor header (for audioProcessor reference)
            if processor_h:
                editor_declarations.update(cls.extract_header_declarations(processor_h))

            # Find undeclared identifiers
            undeclared_editor = editor_used - editor_declarations

            # Filter out false positives
            undeclared_editor = cls._filter_false_positives(undeclared_editor, editor_cpp)

            for ident in sorted(undeclared_editor):
                errors.append(f"PluginEditor.cpp uses undeclared identifier: '{ident}'")
                logger.warning(f"Undeclared in editor: {ident}")

        is_valid = len(errors) == 0

        if is_valid:
            logger.info("Header consistency validation PASSED")
        else:
            logger.error(f"Header consistency validation FAILED with {len(errors)} errors")

        return is_valid, errors

    @classmethod
    def _filter_false_positives(cls, identifiers: Set[str], code: str) -> Set[str]:
        """
        Filter out false positive undeclared identifiers.

        Some identifiers look undeclared but are actually:
        - Part of JUCE API calls
        - Namespace-qualified
        - Template parameters
        """
        filtered = set()

        for ident in identifiers:
            # Skip if it's used as juce::Something or std::Something
            if re.search(rf'(juce|std|dsp)::{ident}\b', code):
                continue

            # Skip if it's used as ->get() or .get() pattern
            if re.search(rf'{ident}\s*->\s*get\s*\(', code):
                continue
            if re.search(rf'{ident}\s*\.\s*get\s*\(', code):
                continue

            # Skip if it's a method call on this or audioProcessor
            if re.search(rf'(this|audioProcessor)\s*\.\s*{ident}\s*\(', code):
                continue
            if re.search(rf'(this|audioProcessor)\s*->\s*{ident}\s*\(', code):
                continue

            # Skip common JUCE patterns
            juce_patterns = [
                rf'get{ident}',  # getParameter, getWidth, etc.
                rf'set{ident}',  # setSize, setValue, etc.
                rf'{ident}Listener',
                rf'{ident}Attachment',
            ]
            skip = False
            for pattern in juce_patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    skip = True
                    break
            if skip:
                continue

            filtered.add(ident)

        return filtered


def validate_header_consistency(
    processor_h: Optional[str],
    processor_cpp: str,
    editor_h: Optional[str],
    editor_cpp: str
) -> Tuple[bool, List[str]]:
    """
    Convenience function for header consistency validation.

    Call this BEFORE pushing to GitHub to catch undeclared identifier errors.

    Args:
        processor_h: PluginProcessor.h content
        processor_cpp: PluginProcessor.cpp content
        editor_h: PluginEditor.h content
        editor_cpp: PluginEditor.cpp content

    Returns:
        Tuple of (is_valid, error_messages)
    """
    return HeaderConsistencyValidator.validate_consistency(
        processor_h, processor_cpp, editor_h, editor_cpp
    )
