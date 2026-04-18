---
name: 1password-cli
description: "1Password CLI integration for managing secrets, API keys, and authentication. Use when working with 1Password in Linux/WSL/Windows environments. Supports Service Account authentication, Desktop App integration, and Session Token Caching."
---

# 1Password CLI Skill

## Setup

Choose one of the following authentication methods:

### Option A: Desktop App Integration (Recommended for Local)
If you have a 1Password Desktop app installed:
1. Open **Settings $\rightarrow$ Developer $\rightarrow$ Integrate with 1Password CLI**.
2. No shell config required.

### Option B: Session Token Caching (Best for WSL/Linux)
If the Desktop bridge doesn't work, use the session manager to avoid repeated password prompts:
1. Run the interactive setup wizard `npx 1password-cli-setup` and enable "Session Token Caching".
2. Or manually add to shell config:
   ```bash
   source ~/.config/op-ssh/op-session-manager.sh
   ```

### Option C: Service Account (Best for CI/CD and Headless)
1. Go to [https://op.serviceaccounts.1password.com](https://op.serviceaccounts.1password.com)
2. Create a Service Account and copy the token.
3. Add to your shell config (`~/.zshrc` or `~/.bashrc`):
   ```bash
   export OP_SERVICE_ACCOUNT_TOKEN="your-service-account-token-here"
   ```

Reload your shell and verify setup:
```bash
source ~/.zshrc
op account list
```

## Features

### CLI Tool: `op-reference`

Manage 1Password secret references:
```bash
op-reference check           # Verify 1Password CLI authentication
op-reference list            # List available vaults and items
op-reference get "op://..."  # Get secret value by reference
op-reference copy "op://..." # Copy reference to clipboard
op-reference add NAME REF   # Save named reference
op-reference env FILE       # Load .env.1pass with references resolved
```

### Environment Files

Use `.env.1pass` files with secret references:
```bash
# User-level: ~/.config/op-ssh/.env.1pass
# Project-level: ./.env.1pass (in project root)

# Format:
export OPENAI_API_KEY="op://Private/API-Keys/openai"
export DATABASE_URL="op://Work/Database/prod"
```

### Secret Reference Syntax

Format: `op://vault/item/field`
- `op://Private/API-Keys/openai`
- `op://Work/Database/production`

## Usage with AI Agents

### Automatic Loading

The Pi extension automatically loads:
1. User-level: `~/.config/op-ssh/.env.1pass`
2. Project-level: `./.env.1pass` (overrides user)

### Pi Commands

- `/op-status` - Check authentication and loaded variables
- `/op-env` - Load project environment
- `/op-env-user` - Load user environment
- `/op-get op://...` - Get a specific secret
- `/op-list` - Show loaded variables

### Custom Tool: `op_get_secret`

Retrieve secrets by reference without exposing them in context:
```json
{
  "reference": "op://Private/API-Keys/openai"
}
```

## Environment Levels

Configuration follows cascading precedence:
1. **User Level** (`~/.config/op-ssh/.env.1pass`) - Global secrets
2. **Project Level** (`./.env.1pass`) - Project-specific, overrides user

## LLM Context and Best Practices

When building AI tools or interacting with LLMs regarding 1Password, always refer to the official LLM-optimized documentation:
- **Full Index**: `https://developer.1password.com/llms.txt`
- **CLI Docs**: `https://developer.1password.com/llms-cli.txt`
- **SDK Docs**: `https://developer.1password.com/llms-sdks.txt`
- **Secrets Automation**: `https://developer.1password.com/llms-secrets-automation.txt`

To fetch specific pages as Markdown for retrieval-augmented generation (RAG), append `.md` to any documentation URL (e.g., `https://developer.1password.com/docs/cli/get-started.md`).

## Agent Hooks

1Password provides agent hooks that run inside supported IDEs and AI agents (Cursor, Claude Code, GitHub Copilot, Windsurf) to validate and verify 1Password setup before shell execution or tool use.

The available hook is `1password-validate-mounted-env-files` which validates mounted `.env` files from 1Password Environments.

### Installing Hooks

You can install the agent hooks from the [1Password/agent-hooks](https://github.com/1Password/agent-hooks) repository:

```bash
git clone https://github.com/1Password/agent-hooks
cd agent-hooks

# Install for Cursor
./install.sh --agent cursor --target-dir /path/to/your/project

# Install for Windsurf
./install.sh --agent windsurf --target-dir /path/to/your/project

# Install for Claude Code
./install.sh --agent claude-code --target-dir /path/to/your/project
```

The script will bundle the hooks and optionally create the required config file (e.g. `.cursor/hooks.json` or `.windsurf/hooks.json`).

## Files and Directories

```
~/.config/op-ssh/
├── .env.1pass           # User-level environment
├── references.conf      # Named references
└── op-ai-helper.sh      # Helper functions

~/projects/project/
└── .env.1pass           # Project-level environment (overrides user)
```

## Troubleshooting

### Service Account Required
```
Error: Not signed in to 1Password
Solution: Set OP_SERVICE_ACCOUNT_TOKEN in ~/.zshrc
```

### Secret Not Found
```
Error: Secret not found: op://...
Solution: Verify the reference in 1Password: op://vault/item/field
```

### 1Password CLI Not Found
```
Error: 1Password CLI (op) not found
Solution: Install from https://1password.com/downloads/command-line/
```

## Advanced: op run for Secret Injection

For applications, use `op run` to inject secrets:
```bash
# With environment file
op run --env-file app.env -- node app.js

# With command-line arguments
export OPENAI_API_KEY="op://Private/API-Keys/openai"
op run -- node app.js
```

## Original Article

Based on: ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.
