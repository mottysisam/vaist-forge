# Cloudflare Infrastructure Manager

A robust, idempotent tool for managing Cloudflare infrastructure for vAIst.

## Features

- **Pages Projects**: Create and manage Cloudflare Pages projects
- **Custom Domains**: Add custom domains with automatic DNS CNAME records
- **D1 Databases**: Reference D1 databases (create via `wrangler d1 create`)
- **KV Namespaces**: Create and manage Workers KV namespaces
- **R2 Buckets**: Create and manage R2 object storage buckets
- **Firewall Rules**: Create WAF bypass rules for health checks and webhooks
- **Idempotent**: Safe to run multiple times - skips existing resources

## Quick Start

```bash
# 1. Set up Python virtual environment
cd scripts/cloudflare-infra
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Set environment variables
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# 3. Validate configuration (dry run)
python cf_infra.py setup --config cloudflare-config.yaml --dry-run

# 4. Apply configuration
python cf_infra.py setup --config cloudflare-config.yaml
```

## Commands

### `setup` - Create/Update Infrastructure

```bash
# Full setup
python cf_infra.py setup --config cloudflare-config.yaml

# Single environment
python cf_infra.py setup --config cloudflare-config.yaml --env dev

# Dry run (preview changes)
python cf_infra.py setup --config cloudflare-config.yaml --dry-run
```

### `validate` - Check Configuration

```bash
python cf_infra.py validate --config cloudflare-config.yaml
```

### `init` - Generate Config Template

```bash
# Basic template
python cf_infra.py init --output cloudflare-config.yaml

# From wrangler.toml
python cf_infra.py init --wrangler ./apps/backend/wrangler.toml --domain vaist.ai
```

### `health-bypass` - Create Health Check Bypass Rule

```bash
# Create firewall rule to allow CI/CD health checks
python cf_infra.py health-bypass --config cloudflare-config.yaml
```

### `list-firewall-rules` - List Existing Rules

```bash
python cf_infra.py list-firewall-rules --config cloudflare-config.yaml
```

## API Token Permissions

Create an API token at https://dash.cloudflare.com/profile/api-tokens with:

| Permission | Access Level |
|------------|--------------|
| Zone - Zone | Read |
| Zone - DNS | Edit |
| Zone - Firewall Services | Edit |
| Account - Cloudflare Pages | Edit |
| Account - Workers KV Storage | Edit |
| Account - Workers R2 Storage | Edit |

## Configuration Reference

See `cloudflare-config.example.yaml` for full documentation.

### Key Sections

```yaml
# Credentials (use env vars in production)
credentials:
  api_token: "${CLOUDFLARE_API_TOKEN}"
  account_id: "${CLOUDFLARE_ACCOUNT_ID}"

# Domain
domain:
  root: "vaist.ai"

# Environments
environments:
  dev:
    worker:
      custom_domain: "api.dev.vaist.ai"
    pages:
      project_name: "vaist-web-dev"
      custom_domains:
        - "dev.vaist.ai"
    kv:
      - name: "kv-vaist-auth-dev"
    r2:
      - name: "r2-vaist-plugins-dev"
```

## Resources Created for vAIst

### Dev Environment
- **Worker**: `vaist-backend-dev` → `api.dev.vaist.ai`
- **Pages**: `vaist-web-dev` → `dev.vaist.ai`, `app.dev.vaist.ai`
- **D1**: `d1-vaist-dev`
- **KV**: `kv-vaist-auth-dev`, `kv-vaist-build-dev`, `kv-vaist-rate-limit-dev`
- **R2**: `r2-vaist-plugins-dev`, `r2-vaist-logs-dev`

### Production Environment
- **Worker**: `vaist-backend` → `api.vaist.ai`
- **Pages**: `vaist-web` → `vaist.ai`, `app.vaist.ai`, `www.vaist.ai`
- **D1**: `d1-vaist-prod`
- **KV**: `kv-vaist-auth-prod`, `kv-vaist-build-prod`, `kv-vaist-rate-limit-prod`
- **R2**: `r2-vaist-plugins-prod`, `r2-vaist-logs-prod`

## Troubleshooting

### "Zone not found"
Ensure the domain is added to your Cloudflare account and the API token has Zone:Read permission.

### "Already exists" warnings
This is expected behavior - the script is idempotent and skips existing resources.

### SSL Certificate pending
Custom domain SSL certificates take a few minutes to activate. Check status in Cloudflare Dashboard → Pages → Custom Domains.
