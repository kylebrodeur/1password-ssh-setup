---
name: 1password-env
description: "1Password environment management for AI agents and development. Load secrets as environment variables from 1Password, supporting .env and .env.1pass formats. Use when configuring API keys, tokens, or secrets for AI models, CI/CD, or local development."
---

# 1Password Environment Skill

## Setup

### Prerequisites

1. **1Password CLI** (`op`)
   ```bash
   # macOS
   brew install 1password-cli
   
   # Linux/WSL
   # Download from: https://1password.com/downloads/command-line/
   ```

2. **1Password Service Account** (required for non-interactive use)
   - Create at [https://op.serviceaccounts.1password.com](https://op.serviceaccounts.1password.com)
   - Add to `~/.zshrc`: `export OP_SERVICE_ACCOUNT_TOKEN="your-token"`

3. **Reload shell**
   ```bash
   source ~/.zshrc
   ```

4. **Verify authentication**
   ```bash
   op account list
   ```

### Install to Pi (if using Pi coding agent)

```bash
# Copy extension to Pi
mkdir -p ~/.pi/agent/extensions
cp extensions/1password.ts ~/.pi/agent/extensions/

# Reload Pi
reload
```

## Environment File Formats

### `.env` (Standard format)
```
# Non-sensitive variables
KEY=value
API_KEY=your-api-key

# Or with 1Password references
OPENAI_API_KEY=op://Private/API-Keys/openai
```

### `.env.1pass` (1Password references)
```
# Format: export VAR="op://vault/item/field"
export OPENAI_API_KEY="op://Private/API-Keys/openai"
export DATABASE_URL="op://Work/Database/prod"
```

### Supported Formats for AI Agents
```
# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=op://Private/API-Keys/google-ai

# Anthropic
ANTHROPIC_API_KEY=op://Private/API-Keys/anthropic

# OpenAI
OPENAI_API_KEY=op://Private/API-Keys/openai

# GitHub
GITHUB_TOKEN=op://Personal/GitHub/token
```

## Pi `.env` Support

### Supported Locations

1. **`~/.pi/.env`** - Pi-level config (loaded first)
2. **`~/.config/op-ssh/.env.1pass`** - User-level
3. **`./.env.1pass`** - Project-level (overrides user)

## Pi Commands

### `/op-status`
Check 1Password authentication and loaded environment variables.

### `/op-env`
Load project environment from `./.env.1pass`.
- Arguments: optional file name (default: `.env.1pass`)
- Autocomplete: `.env.1pass`, `.env.local.1pass`, etc.

### `/op-env-user`
Load user-level environment from `~/.config/op-ssh/.env.1pass`.

### `/op-get op://...`
Get a specific secret and copy to `OP_LAST_SECRET` env var.

### `/op-create-env [filename]`
Create a new project-level environment file with template.

**Default:** `.env.1pass` (if no filename provided)

Example:
```bash
/op-create-env              # Creates ./.env.1pass
/op-create-env .env.local   # Creates ./.env.local.1pass
/op-create-env .env.test    # Creates ./.env.test.1pass
```

Template includes common API keys:
- `GITHUB_TOKEN`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### `/op-add-item VAR_NAME op://... [--global]`
Add or update a 1Password secret reference in project or global env.

**Project (default):**
```bash
/op-add-item OPENAI_API_KEY op://Private/API-Keys/openai
/op-add-item DATABASE_URL op://Work/Database/prod
```

**Global:**
```bash
/op-add-item OPENAI_API_KEY op://Private/API-Keys/openai --global
```

**Features:**
- Auto-updates existing items automatically (no need to manually edit file first)
- Autocomplete shows vaults and items from `op item list`
- Smart matching by vault name or item name

### `/op-add-global-item VAR_NAME op://...`
Similar to `/op-add-item` but specifically for global user env.

Examples:
```bash
/op-add-global-item OPENAI_API_KEY op://Private/API-Keys/openai
/op-add-global-item ANTHROPIC_API_KEY op://Private/API-Keys/anthropic
```

### `/op-list`
List all loaded environment variables with their sources.

### `/op-config`
Open the config directory and show user env file.

## Setup Flow for New Project

```bash
# Step 1: Create project environment (defaults to .env.1pass)
/op-create-env

# Step 2: Add API keys easily (autocomplete helps find items)
/op-add-item OPENAI_API_KEY op://Private/API-Keys/openai
/op-add-item ANTHROPIC_API_KEY op://Private/API-Keys/anthropic

# Step 3: Load the environment
/op-env

# Step 4: Verify loaded variables
/op-status
/op-list
```

## Global vs Project Environment

| Location | Purpose | Command |
|----------|---------|---------|
| `~/.config/op-ssh/.env.1pass` | Global (all projects) | `/op-env-user`, `/op-add-global-item` |
| `./.env.1pass` | Project-specific | `/op-env`, `/op-add-item` |

**Cascade Order:**
1. `~/.pi/.env` (Pi-level)
2. `~/.config/op-ssh/.env.1pass` (global)
3. `./.env.1pass` (project, overrides global)

## Environment Format

**Both formats work in `.env.1pass` files:**
```
# With export
export OPENAI_API_KEY="op://Private/API-Keys/openai"

# Without export
OPENAI_API_KEY="op://Private/API-Keys/openai"
```

**Both formats work in project env files:**
```
# With export
export DATABASE_URL="op://Work/Database/prod"

# Without export
DATABASE_URL="op://Work/Database/prod"
```

## Troubleshooting

### "Not signed in to 1Password"
Set `OP_SERVICE_ACCOUNT_TOKEN` in `~/.zshrc` and reload.

### Secrets not resolving
Check reference format: `op://vault/item/field`

### Pi not loading extension
Restart Pi or run `/reload` in Pi command.

### Item already exists
The commands automatically update existing items - just run them again with the new reference.

### Autocomplete not showing items
Make sure `op item list` works and returns valid JSON. Run `op login` if needed.

## Original Article

Based on: ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.
