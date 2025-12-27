#!/usr/bin/env python3
"""
Cloudflare Infrastructure Manager
=================================
A robust, opinionated tool for managing Cloudflare Pages, DNS, and Workers infrastructure.

Features:
- Parses wrangler.toml to derive configuration
- Creates Pages projects with custom domains
- Manages DNS CNAME records
- Supports multiple environments (dev, production)
- Idempotent operations (safe to run multiple times)

Usage:
    # Using config file
    python cf_infra.py setup --config cloudflare-config.yaml

    # Auto-discover from wrangler.toml
    python cf_infra.py setup --wrangler ./apps/backend/wrangler.toml --domain bodywave.org

    # Dry run
    python cf_infra.py setup --config cloudflare-config.yaml --dry-run

Requirements:
    pip install cloudflare pyyaml toml typer rich

Author: Bodywave Engineering
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import toml
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

try:
    import typer
    from cloudflare import Cloudflare
    import cloudflare as cf_errors
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install cloudflare pyyaml toml typer rich")
    sys.exit(1)


# =============================================================================
# Configuration Models
# =============================================================================


class NamingConvention(str, Enum):
    """Naming convention patterns for Cloudflare resources."""

    BODYWAVE = "bodywave"  # {resource}-{env}-{project}-apps-bodywave-org
    SIMPLE = "simple"  # {env}-{project}-{resource}


@dataclass
class KVNamespaceConfig:
    """Configuration for a KV namespace."""

    name: str  # KV namespace title
    namespace_id: Optional[str] = None  # Existing namespace ID (if known)


@dataclass
class R2BucketConfig:
    """Configuration for an R2 bucket."""

    name: str  # R2 bucket name
    bucket_id: Optional[str] = None  # Existing bucket location (if known)
    public_access: bool = False  # Whether bucket allows public read access


@dataclass
class FirewallRuleConfig:
    """Configuration for a WAF/Firewall rule."""

    name: str  # Rule name (e.g., "bypass-health-endpoint")
    description: str  # Human-readable description
    expression: str  # Firewall expression (e.g., "(http.request.uri.path eq \"/health\")")
    action: str = "skip"  # Action: skip, block, challenge, js_challenge, managed_challenge
    # Products to skip when action is "skip" (bot protection, waf, etc.)
    skip_products: list[str] = field(default_factory=lambda: ["bic", "hot", "rateLimit", "securityLevel", "uaBlock", "waf", "zoneLockdown"])
    priority: int = 1  # Lower = higher priority
    enabled: bool = True


@dataclass
class EnvironmentConfig:
    """Configuration for a single environment (dev, production, etc.)."""

    name: str  # Environment name (dev, production)
    worker_name: Optional[str] = None
    worker_custom_domain: Optional[str] = None
    pages_project_name: Optional[str] = None
    pages_custom_domains: list[str] = field(default_factory=list)  # Multiple custom domains supported
    pages_production_branch: str = "main"
    # Admin Pages (separate from frontend)
    admin_project_name: Optional[str] = None
    admin_custom_domains: list[str] = field(default_factory=list)  # Multiple custom domains supported
    admin_production_branch: str = "main"
    d1_database_name: Optional[str] = None
    d1_database_id: Optional[str] = None
    # KV Namespaces (Sprint 8)
    kv_namespaces: list[KVNamespaceConfig] = field(default_factory=list)
    # R2 Buckets (Sprint I1 - Media Storage)
    r2_buckets: list[R2BucketConfig] = field(default_factory=list)


@dataclass
class ProjectConfig:
    """Complete project configuration."""

    # Core identifiers
    project_name: str
    account_id: str
    api_token: str

    # Domain settings
    root_domain: str
    zone_id: Optional[str] = None

    # Environments
    environments: dict[str, EnvironmentConfig] = field(default_factory=dict)

    # Zone-level firewall rules (e.g., bypass bot protection for health endpoints)
    firewall_rules: list[FirewallRuleConfig] = field(default_factory=list)

    # Options
    naming_convention: NamingConvention = NamingConvention.BODYWAVE
    dry_run: bool = False
    create_pages: bool = True
    add_custom_domains: bool = True
    create_dns_records: bool = True
    create_firewall_rules: bool = True
    create_r2_buckets: bool = True
    dns_proxied: bool = True
    dns_ttl: int = 1


# =============================================================================
# Console Output Helpers
# =============================================================================

console = Console()


def log_info(message: str) -> None:
    """Log an info message."""
    console.print(f"[blue][INFO][/blue] {message}")


def log_success(message: str) -> None:
    """Log a success message."""
    console.print(f"[green][SUCCESS][/green] {message}")


def log_warning(message: str) -> None:
    """Log a warning message."""
    console.print(f"[yellow][WARNING][/yellow] {message}")


def log_error(message: str) -> None:
    """Log an error message."""
    console.print(f"[red][ERROR][/red] {message}")


def log_dry_run(message: str) -> None:
    """Log a dry-run action."""
    console.print(f"[magenta][DRY-RUN][/magenta] Would: {message}")


# =============================================================================
# Wrangler.toml Parser
# =============================================================================


class WranglerParser:
    """Parses wrangler.toml to extract project configuration."""

    def __init__(self, wrangler_path: Path):
        self.path = wrangler_path
        self.data: dict[str, Any] = {}

    def parse(self) -> dict[str, Any]:
        """Parse the wrangler.toml file."""
        if not self.path.exists():
            raise FileNotFoundError(f"wrangler.toml not found: {self.path}")

        with open(self.path) as f:
            self.data = toml.load(f)

        return self.data

    def get_project_name(self) -> Optional[str]:
        """Extract project name from wrangler.toml name field."""
        name = self.data.get("name", "")

        # Try to extract project name from naming patterns
        # Pattern: backend-{env}-{project}-apps-bodywave-org
        match = re.search(r"backend-\w+-(.+?)-apps-bodywave-org", name)
        if match:
            return match.group(1)

        # Pattern: {project}-booking-api-{env}
        match = re.search(r"(.+?)-booking-api-\w+", name)
        if match:
            return match.group(1)

        # Fallback: use the name as-is
        return name if name else None

    def get_environments(self) -> dict[str, dict[str, Any]]:
        """Extract environment configurations."""
        envs = {}

        for key, value in self.data.items():
            if key.startswith("env.") or (key == "env" and isinstance(value, dict)):
                if key == "env":
                    # Handle [env] with nested keys
                    for env_name, env_config in value.items():
                        envs[env_name] = env_config
                else:
                    # Handle [env.dev] style
                    env_name = key.replace("env.", "")
                    envs[env_name] = value

        return envs

    def get_d1_config(self, env_name: Optional[str] = None) -> Optional[dict[str, str]]:
        """Get D1 database configuration for an environment."""
        if env_name:
            env_data = self.data.get("env", {}).get(env_name, {})
            d1_list = env_data.get("d1_databases", [])
        else:
            d1_list = self.data.get("d1_databases", [])

        if d1_list and len(d1_list) > 0:
            return {
                "database_name": d1_list[0].get("database_name"),
                "database_id": d1_list[0].get("database_id"),
            }
        return None

    def detect_naming_convention(self) -> NamingConvention:
        """Detect the naming convention used in wrangler.toml."""
        name = self.data.get("name", "")

        if "-apps-bodywave-org" in name:
            return NamingConvention.BODYWAVE
        return NamingConvention.SIMPLE


# =============================================================================
# Configuration Loader
# =============================================================================


def load_config_from_yaml(config_path: Path) -> ProjectConfig:
    """Load configuration from YAML file."""
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path) as f:
        data = yaml.safe_load(f)

    # Resolve environment variables in values
    def resolve_env_vars(value: Any) -> Any:
        if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
            env_var = value[2:-1]
            return os.environ.get(env_var, "")
        return value

    # Get credentials
    creds = data.get("credentials", {})
    api_token = resolve_env_vars(creds.get("api_token", "")) or os.environ.get(
        "CLOUDFLARE_API_TOKEN", ""
    )
    account_id = resolve_env_vars(creds.get("account_id", "")) or os.environ.get(
        "CLOUDFLARE_ACCOUNT_ID", ""
    )

    if not api_token:
        raise ValueError("API token not provided. Set CLOUDFLARE_API_TOKEN or credentials.api_token")
    if not account_id:
        raise ValueError("Account ID not provided. Set CLOUDFLARE_ACCOUNT_ID or credentials.account_id")

    # Get domain config
    domain_config = data.get("domain", {})
    root_domain = domain_config.get("root", "")
    zone_id = domain_config.get("zone_id")

    if not root_domain:
        raise ValueError("Root domain not provided in config")

    # Get project config
    project_data = data.get("project", {})
    project_name = project_data.get("name", "")
    naming_convention = NamingConvention(project_data.get("naming_convention", "bodywave"))

    # Parse wrangler.toml if specified
    wrangler_path = project_data.get("wrangler_path")
    if wrangler_path:
        wrangler_parser = WranglerParser(Path(wrangler_path))
        wrangler_parser.parse()

        if not project_name:
            project_name = wrangler_parser.get_project_name()

        naming_convention = wrangler_parser.detect_naming_convention()

    if not project_name:
        raise ValueError("Project name not provided and could not be derived from wrangler.toml")

    # Get feature flags
    features = data.get("features", {})
    dns_config = data.get("dns", {})

    # Build environment configs
    environments: dict[str, EnvironmentConfig] = {}
    for env_name, env_data in data.get("environments", {}).items():
        worker_data = env_data.get("worker", {})
        pages_data = env_data.get("pages", {})
        admin_data = env_data.get("admin", {})
        d1_data = env_data.get("d1", {})
        kv_data = env_data.get("kv", [])
        r2_data = env_data.get("r2", [])

        # Parse KV namespace configs
        kv_namespaces = [
            KVNamespaceConfig(
                name=kv.get("name"),
                namespace_id=kv.get("namespace_id"),
            )
            for kv in kv_data
        ]

        # Parse R2 bucket configs
        r2_buckets = [
            R2BucketConfig(
                name=r2.get("name"),
                bucket_id=r2.get("bucket_id"),
                public_access=r2.get("public_access", False),
            )
            for r2 in r2_data
        ]

        # Parse custom domains - support both single 'custom_domain' and list 'custom_domains'
        pages_domains = pages_data.get("custom_domains", [])
        if not pages_domains and pages_data.get("custom_domain"):
            pages_domains = [pages_data.get("custom_domain")]

        admin_domains = admin_data.get("custom_domains", [])
        if not admin_domains and admin_data.get("custom_domain"):
            admin_domains = [admin_data.get("custom_domain")]

        environments[env_name] = EnvironmentConfig(
            name=env_name,
            worker_name=worker_data.get("name"),
            worker_custom_domain=worker_data.get("custom_domain"),
            pages_project_name=pages_data.get("project_name"),
            pages_custom_domains=pages_domains,
            pages_production_branch=pages_data.get("production_branch", "main"),
            admin_project_name=admin_data.get("project_name"),
            admin_custom_domains=admin_domains,
            admin_production_branch=admin_data.get("production_branch", "main"),
            d1_database_name=d1_data.get("database_name"),
            d1_database_id=d1_data.get("database_id"),
            kv_namespaces=kv_namespaces,
            r2_buckets=r2_buckets,
        )

    # Parse zone-level firewall rules
    firewall_rules: list[FirewallRuleConfig] = []
    for rule_data in data.get("firewall_rules", []):
        firewall_rules.append(
            FirewallRuleConfig(
                name=rule_data.get("name"),
                description=rule_data.get("description"),
                expression=rule_data.get("expression"),
                action=rule_data.get("action", "skip"),
                skip_products=rule_data.get("skip_products", ["bic", "hot", "rateLimit", "securityLevel", "uaBlock", "waf", "zoneLockdown"]),
                priority=rule_data.get("priority", 1),
                enabled=rule_data.get("enabled", True),
            )
        )

    return ProjectConfig(
        project_name=project_name,
        account_id=account_id,
        api_token=api_token,
        root_domain=root_domain,
        zone_id=zone_id,
        environments=environments,
        firewall_rules=firewall_rules,
        naming_convention=naming_convention,
        dry_run=features.get("dry_run", False),
        create_pages=features.get("create_pages", True),
        add_custom_domains=features.get("add_custom_domains", True),
        create_dns_records=features.get("create_dns_records", True),
        create_firewall_rules=features.get("create_firewall_rules", True),
        create_r2_buckets=features.get("create_r2_buckets", True),
        dns_proxied=dns_config.get("proxied", True),
        dns_ttl=dns_config.get("ttl", 1),
    )


def load_config_from_wrangler(
    wrangler_path: Path,
    root_domain: str,
    api_token: Optional[str] = None,
    account_id: Optional[str] = None,
) -> ProjectConfig:
    """Load configuration primarily from wrangler.toml."""
    parser = WranglerParser(wrangler_path)
    parser.parse()

    # Get credentials from env if not provided
    api_token = api_token or os.environ.get("CLOUDFLARE_API_TOKEN", "")
    account_id = account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

    if not api_token:
        raise ValueError("API token not provided. Set CLOUDFLARE_API_TOKEN")
    if not account_id:
        raise ValueError("Account ID not provided. Set CLOUDFLARE_ACCOUNT_ID")

    project_name = parser.get_project_name()
    if not project_name:
        raise ValueError("Could not extract project name from wrangler.toml")

    naming_convention = parser.detect_naming_convention()

    # Build environments from wrangler.toml
    environments: dict[str, EnvironmentConfig] = {}
    wrangler_envs = parser.get_environments()

    for env_name in ["dev", "production"]:
        env_data = wrangler_envs.get(env_name, {})
        worker_name = env_data.get("name")

        # Derive Pages project name and custom domains from naming convention
        if naming_convention == NamingConvention.BODYWAVE:
            pages_project_name = f"frontend-{env_name}-{project_name}-apps-bodywave-org"
            if env_name == "production":
                pages_custom_domain = f"{project_name}.{root_domain}"
                worker_custom_domain = f"api.{project_name}.{root_domain}"
            else:
                pages_custom_domain = f"{env_name}.{project_name}.{root_domain}"
                worker_custom_domain = f"api-{env_name}.{project_name}.{root_domain}"
        else:
            pages_project_name = f"{env_name}-{project_name}-frontend"
            if env_name == "production":
                pages_custom_domain = f"{project_name}.{root_domain}"
                worker_custom_domain = f"api.{project_name}.{root_domain}"
            else:
                pages_custom_domain = f"{project_name}-{env_name}.{root_domain}"
                worker_custom_domain = f"api-{env_name}.{project_name}.{root_domain}"

        # Get D1 config
        d1_config = parser.get_d1_config(env_name)

        environments[env_name] = EnvironmentConfig(
            name=env_name,
            worker_name=worker_name,
            worker_custom_domain=worker_custom_domain,
            pages_project_name=pages_project_name,
            pages_custom_domains=[pages_custom_domain] if pages_custom_domain else [],
            pages_production_branch=env_name if env_name != "production" else "prod",
            d1_database_name=d1_config.get("database_name") if d1_config else None,
            d1_database_id=d1_config.get("database_id") if d1_config else None,
        )

    return ProjectConfig(
        project_name=project_name,
        account_id=account_id,
        api_token=api_token,
        root_domain=root_domain,
        environments=environments,
        naming_convention=naming_convention,
    )


# =============================================================================
# Cloudflare Infrastructure Manager
# =============================================================================


class CloudflareInfraManager:
    """Manages Cloudflare infrastructure (Pages, DNS, Workers)."""

    def __init__(self, config: ProjectConfig):
        self.config = config
        self.client = Cloudflare(api_token=config.api_token)
        self._zone_id: Optional[str] = config.zone_id

    @property
    def zone_id(self) -> str:
        """Get or discover the zone ID for the root domain."""
        if not self._zone_id:
            self._zone_id = self._discover_zone_id()
        return self._zone_id

    def _discover_zone_id(self) -> str:
        """Discover zone ID from root domain."""
        log_info(f"Discovering zone ID for {self.config.root_domain}...")

        try:
            zones = list(self.client.zones.list(name=self.config.root_domain))
            if not zones:
                raise ValueError(f"Zone not found for domain: {self.config.root_domain}")

            zone_id = zones[0].id
            log_success(f"Found zone ID: {zone_id}")
            return zone_id
        except Exception as e:
            log_error(f"Failed to discover zone ID: {e}")
            raise

    def verify_token(self) -> bool:
        """Verify the API token is valid."""
        log_info("Verifying API token...")

        try:
            # Try to list zones as a simple verification
            list(self.client.zones.list(per_page=1))
            log_success("API token is valid")
            return True
        except cf_errors.AuthenticationError:
            log_error("API token is invalid or expired")
            return False
        except Exception as e:
            log_error(f"Token verification failed: {e}")
            return False

    # -------------------------------------------------------------------------
    # Pages Management
    # -------------------------------------------------------------------------

    def create_pages_project(self, project_name: str, production_branch: str = "main") -> bool:
        """Create a Cloudflare Pages project."""
        log_info(f"Creating Pages project: {project_name}...")

        if self.config.dry_run:
            log_dry_run(f"Create Pages project '{project_name}' with branch '{production_branch}'")
            return True

        try:
            # Check if project already exists
            try:
                existing = self.client.pages.projects.get(
                    project_name=project_name,
                    account_id=self.config.account_id,
                )
                if existing:
                    log_warning(f"Pages project '{project_name}' already exists, skipping creation")
                    return True
            except cf_errors.NotFoundError:
                pass  # Project doesn't exist, create it

            # Create the project
            self.client.pages.projects.create(
                account_id=self.config.account_id,
                name=project_name,
                production_branch=production_branch,
            )
            log_success(f"Created Pages project: {project_name}")
            return True

        except cf_errors.APIError as e:
            # Handle "already exists" error gracefully
            if "already exists" in str(e).lower():
                log_warning(f"Pages project '{project_name}' already exists")
                return True
            log_error(f"Failed to create Pages project: {e}")
            return False
        except Exception as e:
            log_error(f"Failed to create Pages project: {e}")
            return False

    def add_custom_domain_to_pages(self, project_name: str, domain_name: str) -> bool:
        """Add a custom domain to a Pages project."""
        log_info(f"Adding custom domain '{domain_name}' to Pages project '{project_name}'...")

        if self.config.dry_run:
            log_dry_run(f"Add custom domain '{domain_name}' to Pages project '{project_name}'")
            return True

        try:
            # Check if domain already exists
            try:
                domains = list(
                    self.client.pages.projects.domains.list(
                        project_name=project_name,
                        account_id=self.config.account_id,
                    )
                )
                for domain in domains:
                    if domain.name == domain_name:
                        log_warning(f"Custom domain '{domain_name}' already exists on project")
                        return True
            except Exception:
                pass  # Continue to add

            # Add the domain
            self.client.pages.projects.domains.create(
                project_name=project_name,
                account_id=self.config.account_id,
                name=domain_name,
            )
            log_success(f"Added custom domain: {domain_name}")
            return True

        except cf_errors.APIError as e:
            if "already exists" in str(e).lower() or "already being used" in str(e).lower():
                log_warning(f"Custom domain '{domain_name}' already exists")
                return True
            log_error(f"Failed to add custom domain: {e}")
            return False
        except Exception as e:
            log_error(f"Failed to add custom domain: {e}")
            return False

    # -------------------------------------------------------------------------
    # KV Namespace Management (Sprint 8)
    # -------------------------------------------------------------------------

    def create_kv_namespace(self, namespace_name: str) -> Optional[str]:
        """Create a Cloudflare KV namespace and return its ID."""
        log_info(f"Creating KV namespace: {namespace_name}...")

        if self.config.dry_run:
            log_dry_run(f"Create KV namespace '{namespace_name}'")
            return "dry-run-kv-id"

        try:
            # Check if namespace already exists
            try:
                namespaces = list(
                    self.client.kv.namespaces.list(account_id=self.config.account_id)
                )
                for ns in namespaces:
                    if ns.title == namespace_name:
                        log_warning(f"KV namespace '{namespace_name}' already exists with ID: {ns.id}")
                        return ns.id
            except Exception:
                pass  # Continue to create

            # Create the namespace
            result = self.client.kv.namespaces.create(
                account_id=self.config.account_id,
                title=namespace_name,
            )
            namespace_id = result.id
            log_success(f"Created KV namespace: {namespace_name} (ID: {namespace_id})")
            return namespace_id

        except cf_errors.APIError as e:
            if "already exists" in str(e).lower():
                log_warning(f"KV namespace '{namespace_name}' already exists")
                # Try to get the ID
                try:
                    namespaces = list(
                        self.client.kv.namespaces.list(account_id=self.config.account_id)
                    )
                    for ns in namespaces:
                        if ns.title == namespace_name:
                            return ns.id
                except Exception:
                    pass
                return None
            log_error(f"Failed to create KV namespace: {e}")
            return None
        except Exception as e:
            log_error(f"Failed to create KV namespace: {e}")
            return None

    def list_kv_namespaces(self) -> list[dict[str, str]]:
        """List all KV namespaces in the account."""
        log_info("Listing KV namespaces...")

        try:
            namespaces = list(
                self.client.kv.namespaces.list(account_id=self.config.account_id)
            )
            result = []
            for ns in namespaces:
                result.append({"id": ns.id, "title": ns.title})
                log_info(f"  - {ns.title}: {ns.id}")
            return result
        except Exception as e:
            log_error(f"Failed to list KV namespaces: {e}")
            return []

    # -------------------------------------------------------------------------
    # R2 Bucket Management (Sprint I1 - Media Storage)
    # -------------------------------------------------------------------------

    def create_r2_bucket(self, bucket_name: str, public_access: bool = False) -> Optional[str]:
        """Create a Cloudflare R2 bucket and return its name."""
        log_info(f"Creating R2 bucket: {bucket_name}...")

        if self.config.dry_run:
            log_dry_run(f"Create R2 bucket '{bucket_name}' (public_access={public_access})")
            return bucket_name

        try:
            # Check if bucket already exists
            try:
                buckets = list(
                    self.client.r2.buckets.list(account_id=self.config.account_id)
                )
                for bucket in buckets:
                    if bucket.name == bucket_name:
                        log_warning(f"R2 bucket '{bucket_name}' already exists")
                        return bucket_name
            except Exception:
                pass  # Continue to create

            # Create the bucket
            self.client.r2.buckets.create(
                account_id=self.config.account_id,
                name=bucket_name,
            )
            log_success(f"Created R2 bucket: {bucket_name}")

            # Note: Public access for R2 requires additional configuration via
            # custom domain or Cloudflare Access. The bucket itself is always
            # private, but you can expose it through Workers or custom domains.
            if public_access:
                log_info(f"Note: R2 bucket '{bucket_name}' created. Configure public access via Workers or custom domain.")

            return bucket_name

        except cf_errors.APIError as e:
            if "already exists" in str(e).lower() or "10004" in str(e):
                log_warning(f"R2 bucket '{bucket_name}' already exists")
                return bucket_name
            log_error(f"Failed to create R2 bucket: {e}")
            return None
        except Exception as e:
            log_error(f"Failed to create R2 bucket: {e}")
            return None

    def list_r2_buckets(self) -> list[dict[str, str]]:
        """List all R2 buckets in the account."""
        log_info("Listing R2 buckets...")

        try:
            buckets = list(
                self.client.r2.buckets.list(account_id=self.config.account_id)
            )
            result = []
            for bucket in buckets:
                result.append({"name": bucket.name, "creation_date": str(bucket.creation_date) if hasattr(bucket, 'creation_date') else "N/A"})
                log_info(f"  - {bucket.name}")
            return result
        except Exception as e:
            log_error(f"Failed to list R2 buckets: {e}")
            return []

    # -------------------------------------------------------------------------
    # Firewall Rules Management (WAF Bypass for CI/CD Health Checks)
    # -------------------------------------------------------------------------

    def create_firewall_rule(self, rule_config: FirewallRuleConfig) -> bool:
        """Create or update a zone-level firewall rule.

        This uses Cloudflare's Rulesets API (the modern replacement for the legacy
        firewall rules API). Creates a skip rule to bypass bot protection for
        specific paths like /health endpoints.
        """
        log_info(f"Creating firewall rule: {rule_config.name}...")

        if self.config.dry_run:
            log_dry_run(
                f"Create firewall rule '{rule_config.name}' with expression: {rule_config.expression}"
            )
            return True

        try:
            # Check if rule already exists by listing custom rules
            existing_rule_id = None
            try:
                # Get the zone's custom firewall ruleset
                rulesets = list(
                    self.client.rulesets.list(zone_id=self.zone_id)
                )
                custom_ruleset = None
                for rs in rulesets:
                    if rs.kind == "zone" and rs.phase == "http_request_firewall_custom":
                        custom_ruleset = rs
                        break

                if custom_ruleset:
                    # Get the ruleset details to find existing rule
                    ruleset_details = self.client.rulesets.get(
                        ruleset_id=custom_ruleset.id,
                        zone_id=self.zone_id,
                    )
                    if ruleset_details.rules:
                        for rule in ruleset_details.rules:
                            if rule.description == rule_config.description:
                                existing_rule_id = rule.id
                                log_warning(
                                    f"Firewall rule '{rule_config.name}' already exists (ID: {existing_rule_id})"
                                )
                                return True
            except Exception as e:
                log_info(f"No existing custom ruleset found, will create new: {e}")

            # Create the firewall rule using the Rulesets API
            # Phase: http_request_firewall_custom for zone-level custom rules
            rule_data = {
                "action": rule_config.action,
                "expression": rule_config.expression,
                "description": rule_config.description,
                "enabled": rule_config.enabled,
            }

            # Add action_parameters for skip action
            if rule_config.action == "skip":
                rule_data["action_parameters"] = {
                    "products": rule_config.skip_products,
                }

            # Create or update the ruleset
            try:
                # Try to get existing custom ruleset
                rulesets = list(self.client.rulesets.list(zone_id=self.zone_id))
                custom_ruleset = None
                for rs in rulesets:
                    if rs.kind == "zone" and rs.phase == "http_request_firewall_custom":
                        custom_ruleset = rs
                        break

                if custom_ruleset:
                    # Update existing ruleset with new rule
                    existing_rules = []
                    ruleset_details = self.client.rulesets.get(
                        ruleset_id=custom_ruleset.id,
                        zone_id=self.zone_id,
                    )
                    if ruleset_details.rules:
                        existing_rules = [
                            {
                                "action": r.action,
                                "expression": r.expression,
                                "description": r.description,
                                "enabled": r.enabled,
                                "action_parameters": r.action_parameters if hasattr(r, 'action_parameters') else None,
                            }
                            for r in ruleset_details.rules
                            if r.description != rule_config.description  # Skip if updating same rule
                        ]
                        # Filter out None action_parameters
                        existing_rules = [
                            {k: v for k, v in r.items() if v is not None}
                            for r in existing_rules
                        ]

                    # Add our new rule
                    all_rules = existing_rules + [rule_data]

                    self.client.rulesets.update(
                        ruleset_id=custom_ruleset.id,
                        zone_id=self.zone_id,
                        rules=all_rules,
                    )
                    log_success(f"Updated firewall ruleset with rule: {rule_config.name}")
                else:
                    # Create new ruleset with the rule
                    self.client.rulesets.create(
                        zone_id=self.zone_id,
                        kind="zone",
                        name="Custom Firewall Rules",
                        phase="http_request_firewall_custom",
                        rules=[rule_data],
                    )
                    log_success(f"Created firewall ruleset with rule: {rule_config.name}")

                return True

            except cf_errors.APIError as e:
                # Handle specific API errors
                if "already exists" in str(e).lower():
                    log_warning(f"Firewall rule '{rule_config.name}' already exists")
                    return True
                raise

        except cf_errors.APIError as e:
            log_error(f"Failed to create firewall rule: {e}")
            return False
        except Exception as e:
            log_error(f"Failed to create firewall rule: {e}")
            return False

    def list_firewall_rules(self) -> list[dict[str, Any]]:
        """List all custom firewall rules in the zone."""
        log_info("Listing firewall rules...")

        try:
            rulesets = list(self.client.rulesets.list(zone_id=self.zone_id))
            result = []

            for rs in rulesets:
                if rs.kind == "zone" and rs.phase == "http_request_firewall_custom":
                    ruleset_details = self.client.rulesets.get(
                        ruleset_id=rs.id,
                        zone_id=self.zone_id,
                    )
                    if ruleset_details.rules:
                        for rule in ruleset_details.rules:
                            result.append({
                                "id": rule.id,
                                "description": rule.description,
                                "expression": rule.expression,
                                "action": rule.action,
                                "enabled": rule.enabled,
                            })
                            log_info(f"  - {rule.description}: {rule.expression}")

            return result
        except Exception as e:
            log_error(f"Failed to list firewall rules: {e}")
            return []

    def setup_health_endpoint_bypass(self) -> bool:
        """Create a firewall rule to bypass bot protection for /health endpoints.

        This is specifically designed to allow CI/CD health checks from GitHub Actions
        to pass through Cloudflare's Bot Fight Mode, which blocks datacenter IPs.
        """
        health_bypass_rule = FirewallRuleConfig(
            name="ci-health-check-bypass",
            description="Bypass bot protection for CI/CD health checks",
            expression='(http.request.uri.path eq "/health")',
            action="skip",
            skip_products=["bic", "hot", "rateLimit", "securityLevel", "uaBlock", "waf", "zoneLockdown"],
            priority=1,
            enabled=True,
        )
        return self.create_firewall_rule(health_bypass_rule)

    # -------------------------------------------------------------------------
    # DNS Management
    # -------------------------------------------------------------------------

    def create_dns_record(
        self,
        name: str,
        target: str,
        record_type: str = "CNAME",
        proxied: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> bool:
        """Create or update a DNS record."""
        proxied = proxied if proxied is not None else self.config.dns_proxied
        ttl = ttl if ttl is not None else self.config.dns_ttl

        log_info(f"Creating {record_type} record: {name} -> {target}...")

        if self.config.dry_run:
            log_dry_run(f"Create {record_type} record: {name} -> {target} (proxied={proxied})")
            return True

        try:
            # Check if record already exists
            existing_id = None
            try:
                records = list(
                    self.client.dns.records.list(
                        zone_id=self.zone_id,
                        type=record_type,
                        name=name,
                    )
                )
                if records:
                    existing_id = records[0].id
            except Exception:
                pass

            if existing_id:
                # Update existing record
                log_warning(f"DNS record '{name}' already exists, updating...")
                self.client.dns.records.update(
                    dns_record_id=existing_id,
                    zone_id=self.zone_id,
                    type=record_type,
                    name=name,
                    content=target,
                    proxied=proxied,
                    ttl=ttl,
                )
                log_success(f"Updated {record_type} record: {name}")
            else:
                # Create new record
                self.client.dns.records.create(
                    zone_id=self.zone_id,
                    type=record_type,
                    name=name,
                    content=target,
                    proxied=proxied,
                    ttl=ttl,
                )
                log_success(f"Created {record_type} record: {name} -> {target}")

            return True

        except cf_errors.APIError as e:
            log_error(f"Failed to create/update DNS record: {e}")
            return False
        except Exception as e:
            log_error(f"Failed to create/update DNS record: {e}")
            return False

    # -------------------------------------------------------------------------
    # High-Level Operations
    # -------------------------------------------------------------------------

    def setup_environment(self, env_config: EnvironmentConfig) -> bool:
        """Set up all infrastructure for an environment."""
        log_info(f"\n{'='*50}")
        log_info(f"Setting up environment: {env_config.name}")
        log_info(f"{'='*50}\n")

        success = True

        # Create Pages project (frontend)
        if self.config.create_pages and env_config.pages_project_name:
            if not self.create_pages_project(
                env_config.pages_project_name,
                env_config.pages_production_branch,
            ):
                success = False

        # Add custom domains to Pages (frontend) - supports multiple domains
        if self.config.add_custom_domains and env_config.pages_project_name:
            for custom_domain in env_config.pages_custom_domains:
                if not self.add_custom_domain_to_pages(
                    env_config.pages_project_name,
                    custom_domain,
                ):
                    success = False

        # Create DNS records for Pages (frontend) - supports multiple domains
        if self.config.create_dns_records and env_config.pages_custom_domains:
            pages_target = f"{env_config.pages_project_name}.pages.dev"
            for custom_domain in env_config.pages_custom_domains:
                if not self.create_dns_record(
                    custom_domain,
                    pages_target,
                ):
                    success = False

        # Create Admin Pages project
        if self.config.create_pages and env_config.admin_project_name:
            if not self.create_pages_project(
                env_config.admin_project_name,
                env_config.admin_production_branch,
            ):
                success = False

        # Add custom domains to Admin Pages - supports multiple domains
        if self.config.add_custom_domains and env_config.admin_project_name:
            for custom_domain in env_config.admin_custom_domains:
                if not self.add_custom_domain_to_pages(
                    env_config.admin_project_name,
                    custom_domain,
                ):
                    success = False

        # Create DNS records for Admin Pages - supports multiple domains
        if self.config.create_dns_records and env_config.admin_custom_domains:
            admin_target = f"{env_config.admin_project_name}.pages.dev"
            for custom_domain in env_config.admin_custom_domains:
                if not self.create_dns_record(
                    custom_domain,
                    admin_target,
                ):
                    success = False

        # Create DNS records for Workers (if custom domain specified)
        if self.config.create_dns_records and env_config.worker_custom_domain:
            worker_target = f"{env_config.worker_name}.workers.dev" if env_config.worker_name else None
            if worker_target:
                if not self.create_dns_record(
                    env_config.worker_custom_domain,
                    worker_target,
                ):
                    success = False

        # Create KV Namespaces (Sprint 8)
        for kv_config in env_config.kv_namespaces:
            namespace_id = self.create_kv_namespace(kv_config.name)
            if not namespace_id:
                success = False
            else:
                kv_config.namespace_id = namespace_id

        # Create R2 Buckets (Sprint I1 - Media Storage)
        if self.config.create_r2_buckets:
            for r2_config in env_config.r2_buckets:
                bucket_name = self.create_r2_bucket(r2_config.name, r2_config.public_access)
                if not bucket_name:
                    success = False
                else:
                    r2_config.bucket_id = bucket_name

        return success

    def setup_all(self) -> bool:
        """Set up infrastructure for all environments."""
        # Verify token first
        if not self.verify_token():
            return False

        # Display configuration summary
        self._display_config_summary()

        success = True

        # Set up zone-level firewall rules first (e.g., health endpoint bypass)
        if self.config.create_firewall_rules:
            log_info("\n" + "=" * 50)
            log_info("Setting up zone-level firewall rules")
            log_info("=" * 50 + "\n")

            for rule_config in self.config.firewall_rules:
                if not self.create_firewall_rule(rule_config):
                    success = False

        # Set up each environment
        for env_name, env_config in self.config.environments.items():
            if not self.setup_environment(env_config):
                success = False

        # Display final summary
        self._display_final_summary(success)

        return success

    def _display_config_summary(self) -> None:
        """Display configuration summary."""
        table = Table(title="Configuration Summary")
        table.add_column("Setting", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Project Name", self.config.project_name)
        table.add_row("Root Domain", self.config.root_domain)
        table.add_row("Account ID", f"{self.config.account_id[:8]}...")
        table.add_row("Naming Convention", self.config.naming_convention.value)
        table.add_row("Dry Run", str(self.config.dry_run))
        table.add_row("Environments", ", ".join(self.config.environments.keys()))

        console.print(table)
        console.print()

    def _display_final_summary(self, success: bool) -> None:
        """Display final setup summary."""
        console.print()
        console.print("=" * 60)

        if success:
            resources = []
            for env in self.config.environments.values():
                for domain in env.pages_custom_domains:
                    resources.append(f"  - {domain} -> {env.pages_project_name}.pages.dev")
                for domain in env.admin_custom_domains:
                    resources.append(f"  - {domain} -> {env.admin_project_name}.pages.dev")
            console.print(Panel.fit(
                "[green]Setup Complete![/green]\n\n"
                "Resources created/updated:\n"
                + "\n".join(resources),
                title="Summary",
            ))
        else:
            console.print(Panel.fit(
                "[red]Setup completed with errors[/red]\n"
                "Check the logs above for details.",
                title="Summary",
            ))

        console.print()
        log_info("SSL certificates may take a few minutes to activate.")
        log_info("Check status in Cloudflare Dashboard -> Pages -> Custom Domains")


# =============================================================================
# CLI Interface
# =============================================================================

app = typer.Typer(
    name="cf-infra",
    help="Cloudflare Infrastructure Manager - Manage Pages, DNS, and Workers",
    add_completion=False,
)


@app.command()
def setup(
    config: Optional[Path] = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to cloudflare-config.yaml",
    ),
    wrangler: Optional[Path] = typer.Option(
        None,
        "--wrangler",
        "-w",
        help="Path to wrangler.toml (alternative to config file)",
    ),
    domain: Optional[str] = typer.Option(
        None,
        "--domain",
        "-d",
        help="Root domain (required with --wrangler)",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would happen without making changes",
    ),
    env: Optional[str] = typer.Option(
        None,
        "--env",
        "-e",
        help="Only set up a specific environment (dev, production)",
    ),
) -> None:
    """
    Set up Cloudflare infrastructure (Pages, DNS records, custom domains).

    Examples:
        # Using config file
        python cf_infra.py setup --config cloudflare-config.yaml

        # Auto-discover from wrangler.toml
        python cf_infra.py setup --wrangler ./apps/backend/wrangler.toml --domain bodywave.org

        # Dry run
        python cf_infra.py setup --config cloudflare-config.yaml --dry-run

        # Single environment
        python cf_infra.py setup --config cloudflare-config.yaml --env dev
    """
    try:
        # Load configuration
        if config:
            project_config = load_config_from_yaml(config)
        elif wrangler:
            if not domain:
                log_error("--domain is required when using --wrangler")
                raise typer.Exit(1)
            project_config = load_config_from_wrangler(wrangler, domain)
        else:
            # Try to find config file in current directory
            default_config = Path("cloudflare-config.yaml")
            if default_config.exists():
                project_config = load_config_from_yaml(default_config)
            else:
                log_error("No configuration provided. Use --config or --wrangler")
                raise typer.Exit(1)

        # Apply CLI overrides
        if dry_run:
            project_config.dry_run = True

        # Filter environments if specified
        if env:
            if env not in project_config.environments:
                log_error(f"Environment '{env}' not found. Available: {list(project_config.environments.keys())}")
                raise typer.Exit(1)
            project_config.environments = {env: project_config.environments[env]}

        # Run setup
        manager = CloudflareInfraManager(project_config)
        success = manager.setup_all()

        if not success:
            raise typer.Exit(1)

    except FileNotFoundError as e:
        log_error(str(e))
        raise typer.Exit(1)
    except ValueError as e:
        log_error(str(e))
        raise typer.Exit(1)
    except Exception as e:
        log_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@app.command()
def validate(
    config: Optional[Path] = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to cloudflare-config.yaml",
    ),
    wrangler: Optional[Path] = typer.Option(
        None,
        "--wrangler",
        "-w",
        help="Path to wrangler.toml",
    ),
    domain: Optional[str] = typer.Option(
        None,
        "--domain",
        "-d",
        help="Root domain (required with --wrangler)",
    ),
) -> None:
    """
    Validate configuration without making any changes.

    Examples:
        python cf_infra.py validate --config cloudflare-config.yaml
        python cf_infra.py validate --wrangler ./apps/backend/wrangler.toml --domain bodywave.org
    """
    try:
        if config:
            project_config = load_config_from_yaml(config)
        elif wrangler:
            if not domain:
                log_error("--domain is required when using --wrangler")
                raise typer.Exit(1)
            project_config = load_config_from_wrangler(wrangler, domain)
        else:
            log_error("No configuration provided. Use --config or --wrangler")
            raise typer.Exit(1)

        # Display configuration
        console.print(Panel.fit(
            f"[green]Configuration is valid![/green]\n\n"
            f"Project: {project_config.project_name}\n"
            f"Domain: {project_config.root_domain}\n"
            f"Environments: {', '.join(project_config.environments.keys())}",
            title="Validation Result",
        ))

        # Show environment details
        for env_name, env_config in project_config.environments.items():
            table = Table(title=f"Environment: {env_name}")
            table.add_column("Resource", style="cyan")
            table.add_column("Value", style="green")

            if env_config.pages_project_name:
                table.add_row("Pages Project", env_config.pages_project_name)
            if env_config.pages_custom_domains:
                for i, domain in enumerate(env_config.pages_custom_domains):
                    label = "Pages Domain" if i == 0 else "  (alias)"
                    table.add_row(label, domain)
            if env_config.admin_project_name:
                table.add_row("Admin Project", env_config.admin_project_name)
            if env_config.admin_custom_domains:
                for i, domain in enumerate(env_config.admin_custom_domains):
                    label = "Admin Domain" if i == 0 else "  (alias)"
                    table.add_row(label, domain)
            if env_config.worker_name:
                table.add_row("Worker Name", env_config.worker_name)
            if env_config.worker_custom_domain:
                table.add_row("Worker Domain", env_config.worker_custom_domain)
            if env_config.d1_database_name:
                table.add_row("D1 Database", env_config.d1_database_name)

            console.print(table)
            console.print()

    except FileNotFoundError as e:
        log_error(str(e))
        raise typer.Exit(1)
    except ValueError as e:
        log_error(str(e))
        raise typer.Exit(1)


@app.command()
def init(
    output: Path = typer.Option(
        Path("cloudflare-config.yaml"),
        "--output",
        "-o",
        help="Output path for config file",
    ),
    wrangler: Optional[Path] = typer.Option(
        None,
        "--wrangler",
        "-w",
        help="Path to wrangler.toml to derive configuration from",
    ),
    domain: Optional[str] = typer.Option(
        None,
        "--domain",
        "-d",
        help="Root domain",
    ),
    project_name: Optional[str] = typer.Option(
        None,
        "--project",
        "-p",
        help="Project name",
    ),
) -> None:
    """
    Generate a cloudflare-config.yaml template.

    Examples:
        # Generate basic template
        python cf_infra.py init

        # Generate from wrangler.toml
        python cf_infra.py init --wrangler ./apps/backend/wrangler.toml --domain bodywave.org

        # Generate with specific project name
        python cf_infra.py init --project my-app --domain example.com
    """
    try:
        # If wrangler.toml provided, parse it for defaults
        naming_convention = "bodywave"
        detected_project_name = project_name or "my-project"

        if wrangler and wrangler.exists():
            parser = WranglerParser(wrangler)
            parser.parse()
            detected_project_name = parser.get_project_name() or detected_project_name
            naming_convention = parser.detect_naming_convention().value

        root_domain = domain or "example.com"

        # Generate config template
        config_template = f"""# Cloudflare Infrastructure Configuration
# Generated by cf-infra init
# ========================================

credentials:
  api_token: "${{CLOUDFLARE_API_TOKEN}}"
  account_id: "${{CLOUDFLARE_ACCOUNT_ID}}"

domain:
  root: "{root_domain}"

project:
  name: "{detected_project_name}"
  wrangler_path: "{wrangler or './apps/backend/wrangler.toml'}"
  naming_convention: "{naming_convention}"

environments:
  dev:
    worker:
      custom_domain: "api-dev.{detected_project_name}.{root_domain}"
    pages:
      project_name: "dev-{detected_project_name}-frontend"
      custom_domain: "dev.{detected_project_name}.{root_domain}"
      production_branch: "dev"

  production:
    worker:
      custom_domain: "api.{detected_project_name}.{root_domain}"
    pages:
      project_name: "prod-{detected_project_name}-frontend"
      custom_domain: "{detected_project_name}.{root_domain}"
      production_branch: "prod"

dns:
  auto_create: true
  proxied: true
  ttl: 1

features:
  create_pages: true
  add_custom_domains: true
  create_dns_records: true
  validate_ssl: true
  dry_run: false
"""

        output.write_text(config_template)
        log_success(f"Generated config file: {output}")
        log_info("Edit the file to customize your configuration")
        log_info("Then run: python cf_infra.py setup --config cloudflare-config.yaml")

    except Exception as e:
        log_error(f"Failed to generate config: {e}")
        raise typer.Exit(1)


@app.command("health-bypass")
def health_bypass(
    config: Optional[Path] = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to cloudflare-config.yaml",
    ),
    domain: Optional[str] = typer.Option(
        None,
        "--domain",
        "-d",
        help="Root domain (if not using config file)",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would happen without making changes",
    ),
) -> None:
    """
    Create a firewall rule to bypass bot protection for /health endpoints.

    This is specifically designed to allow CI/CD health checks from GitHub Actions
    to pass through Cloudflare's Bot Fight Mode, which blocks datacenter IPs.

    Examples:
        # Using config file
        python cf_infra.py health-bypass --config cloudflare-config.yaml

        # Using domain directly
        python cf_infra.py health-bypass --domain bodywave.org

        # Dry run
        python cf_infra.py health-bypass --config cloudflare-config.yaml --dry-run
    """
    try:
        # Load configuration
        if config:
            project_config = load_config_from_yaml(config)
        elif domain:
            # Create minimal config for just creating the firewall rule
            api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
            account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

            if not api_token:
                log_error("CLOUDFLARE_API_TOKEN environment variable not set")
                raise typer.Exit(1)
            if not account_id:
                log_error("CLOUDFLARE_ACCOUNT_ID environment variable not set")
                raise typer.Exit(1)

            project_config = ProjectConfig(
                project_name="health-bypass",
                account_id=account_id,
                api_token=api_token,
                root_domain=domain,
            )
        else:
            # Try to find config file in current directory
            default_config = Path("cloudflare-config.yaml")
            if default_config.exists():
                project_config = load_config_from_yaml(default_config)
            else:
                log_error("No configuration provided. Use --config or --domain")
                raise typer.Exit(1)

        # Apply CLI overrides
        if dry_run:
            project_config.dry_run = True

        # Create the manager and set up the health bypass
        manager = CloudflareInfraManager(project_config)

        if not manager.verify_token():
            raise typer.Exit(1)

        log_info(f"Setting up health endpoint bypass for zone: {project_config.root_domain}")

        success = manager.setup_health_endpoint_bypass()

        if success:
            console.print(Panel.fit(
                "[green]Health endpoint bypass rule created![/green]\n\n"
                "CI/CD health checks from GitHub Actions can now reach /health endpoints.\n\n"
                "Rule details:\n"
                "  - Expression: (http.request.uri.path eq \"/health\")\n"
                "  - Action: Skip bot protection\n"
                "  - Products bypassed: bic, hot, rateLimit, securityLevel, uaBlock, waf, zoneLockdown",
                title="Success",
            ))
        else:
            log_error("Failed to create health endpoint bypass rule")
            raise typer.Exit(1)

    except FileNotFoundError as e:
        log_error(str(e))
        raise typer.Exit(1)
    except ValueError as e:
        log_error(str(e))
        raise typer.Exit(1)
    except Exception as e:
        log_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@app.command("list-firewall-rules")
def list_firewall_rules_cmd(
    config: Optional[Path] = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to cloudflare-config.yaml",
    ),
    domain: Optional[str] = typer.Option(
        None,
        "--domain",
        "-d",
        help="Root domain (if not using config file)",
    ),
) -> None:
    """
    List all custom firewall rules for the zone.

    Examples:
        python cf_infra.py list-firewall-rules --config cloudflare-config.yaml
        python cf_infra.py list-firewall-rules --domain bodywave.org
    """
    try:
        if config:
            project_config = load_config_from_yaml(config)
        elif domain:
            api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
            account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

            if not api_token or not account_id:
                log_error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set")
                raise typer.Exit(1)

            project_config = ProjectConfig(
                project_name="list-rules",
                account_id=account_id,
                api_token=api_token,
                root_domain=domain,
            )
        else:
            default_config = Path("cloudflare-config.yaml")
            if default_config.exists():
                project_config = load_config_from_yaml(default_config)
            else:
                log_error("No configuration provided. Use --config or --domain")
                raise typer.Exit(1)

        manager = CloudflareInfraManager(project_config)

        if not manager.verify_token():
            raise typer.Exit(1)

        rules = manager.list_firewall_rules()

        if rules:
            table = Table(title="Custom Firewall Rules")
            table.add_column("Description", style="cyan")
            table.add_column("Expression", style="green")
            table.add_column("Action", style="yellow")
            table.add_column("Enabled", style="magenta")

            for rule in rules:
                table.add_row(
                    rule.get("description", "N/A"),
                    rule.get("expression", "N/A"),
                    rule.get("action", "N/A"),
                    str(rule.get("enabled", "N/A")),
                )

            console.print(table)
        else:
            log_info("No custom firewall rules found")

    except Exception as e:
        log_error(f"Failed to list firewall rules: {e}")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
