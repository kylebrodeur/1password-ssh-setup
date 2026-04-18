# Agent Skills

This directory contains [Agent Skills](https://agentskills.io/) for 1Password and SSH integration.

## Skills Available

### 1. 1Password CLI (`skills/1password-cli`)

General 1Password CLI integration for:
- Managing secret references
- Loading `.env` and `.env.1pass` files
- API key and token management
- Service Account authentication

Use when: You need to work with 1Password secrets, API keys, or general secret management.

### 2. SSH Agent (`skills/ssh-agent`)

SSH agent management with:
- Keychain integration
- 1Password passphrase handling
- SSH_ASKPASS configuration
- Cross-platform (Linux/WSL/Windows/macOS)

Use when: You need SSH key management with secure passphrases from 1Password.

### 3. 1Password Environment (`skills/1password-env`)

Pi coding agent extension with:
- Automatic loading from `~/.pi/.env` (supports both plain and 1Password references)
- `/op-status`, `/op-env`, `/op-env-user`, `/op-get`, `/op-list`, `/op-config` commands
- `op_get_secret` custom tool
- Cascade loading: Pi `.env` → User config → Project config

Use when: You're using Pi coding agent and need 1Password integration with automatic environment loading.

## Installation

### Automatic (via pi)

```bash
# In Pi, run:
/skill:1password-cli    # General 1Password CLI
/skill:ssh-agent        # SSH key management  
/skill:1password-env    # Pi extension with auto-env loading
```

### Manual (via npm)

```bash
# Install as a skill package
npm install pi-1password

# Skills are in node_modules/pi-1password/skills/
```

### Manual (via copy)

```bash
# Copy to Pi skills directory
mkdir -p ~/.pi/agent/skills
cp -r skills/* ~/.pi/agent/skills/

# Or for global skills
mkdir -p ~/.agents/skills
cp -r skills/* ~/.agents/skills/
```

## Environment Files

### `~/.pi/.env` (Pi-specific, loaded automatically)

```
# Standard format
KEY=value

# Or with 1Password references
GOOGLE_GENERATIVE_AI_API_KEY=op://Private/API-Keys/google-ai
ANTHROPIC_API_KEY=op://Private/API-Keys/anthropic
```

### `~/.config/op-ssh/.env.1pass` (User-level)

```
export OPENAI_API_KEY="op://Private/API-Keys/openai"
export ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"
```

### `./.env.1pass` (Project-level, overrides user)

```
export PROJECT_API_KEY="op://Work/ProjectX/token"
```

## Original Article

All skills based on: ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.
