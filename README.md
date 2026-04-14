# 1Password SSH & Secret Management System

Complete system for managing SSH keys and secrets using 1Password CLI with Pi integration.

Based on ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.

## Service Account Required

This setup **requires** a 1Password Service Account. Service Accounts provide:
- Non-interactive authentication (no password prompts)
- Persistent sessions (no expiry issues)
- Reliable automation support (AI agents, CI/CD)
- Vault-specific access control

## Features
- SSH Agent Integration - Keychain + 1Password for passphrase management
- Pi Extension - Native 1Password tools and commands in Pi
- Cascading Environment - User-level and project-level `.env.1pass` files
- CLI Tools - `op-reference` for shell scripts and automation
- Platform Support - Works on WSL and native Windows
- Service Account Authentication - Required for all operations

## Platform-Specific Setup

This setup supports two platforms:

### WSL (Windows Subsystem for Linux)
- 1Password CLI uses Service Account for authentication
- No desktop app required for CLI operations
- Desktop app still needed for ssh-agent socket (if using SSH key management)

### Native Windows
- 1Password CLI uses Service Account for authentication
- Windows native SSH client can use 1Password agent socket
- Desktop app required for ssh-agent socket functionality

Both platforms support the same secret references from 1Password vaults via Service Account authentication.

### Service Account Authentication

To use `op` CLI commands with a Service Account:

```bash
echo "export OP_SERVICE_ACCOUNT_TOKEN=your-service-account-token" >> ~/.zshrc
source ~/.zshrc

# Verify setup
op account list
```

See [docs/SETUP.md](docs/SETUP.md) for detailed Service Account setup instructions.

## Project Structure

```
1password-ssh-setup/
├── src/                    # Core scripts
│   ├── askpass-1password.sh     # SSH_ASKPASS script
│   ├── setup_ssh_agent.sh       # Keychain initialization
│   ├── op-reference             # CLI tool
│   └── op-ai-helper.sh          # Shell helper functions
├── pi-extension/           # Pi extension
│   └── 1password.ts             # Pi extension source
├── examples/               # Example configs
│   └── env.1pass.template       # Environment template
├── docs/                   # Documentation
│   └── SETUP.md                 # Detailed setup guide
├── install.sh              # Installation script
└── README.md              # This file
```

## Components

### 1. SSH Agent (Keychain + 1Password)

Manages SSH keys with 1Password-stored passphrases:
- Unlocks once per session via 1Password
- Keychain persists the unlocked key
- No password prompts for subsequent SSH operations

Original concept from Bas Nijholt's article on combining Keychain and 1Password CLI.

### 2. Pi Extension

Native 1Password integration for Pi:

**Commands:**
- `/op-status` - Check auth and loaded environments
- `/op-get op://...` - Get a specific secret
- `/op-env [file]` - Load project environment
- `/op-env-user` - Load user environment
- `/op-list` - Show loaded variables
- `/op-config` - Show config directory

**Tools:**
- `op_get_secret` - Retrieve secrets by reference
- `op_load_env` - Load `.env.1pass` files

### 3. CLI Tool (op-reference)

Command-line tool for scripts:

```bash
op-reference check                    # Check auth status
op-reference get "op://..."          # Get secret value
op-reference add NAME "op://..."     # Save named reference
op-reference resolve NAME            # Get named reference
op-reference env .env.1pass          # Load environment
op-reference template                # Create template
```

## Environment Levels

Supports cascading configuration:

1. **User Level** (`~/.config/op-ssh/.env.1pass`)
   - Global secrets for all projects
   - Loaded first

2. **Project Level** (`./.env.1pass`)
   - Project-specific secrets
   - Loaded second, overrides user values

Example:
```bash
# User config has:
export OPENAI_API_KEY="op://Personal/API-Keys/openai"

# Project config overrides with:
export OPENAI_API_KEY="op://Work/OpenAI/prod-key"

# Result: Project value is used
```

## Installation

See [docs/SETUP.md](docs/SETUP.md) for detailed installation instructions including Service Account setup.

## Configuration

### SSH Passphrase Reference

Edit `~/.ssh/askpass-1password.sh`:
```bash
OP_SECRET_REFERENCE="op://Employee/pegasus-ssh/password"
```

### Adding API Keys

Add to `~/.config/op-ssh/.env.1pass`:
```bash
export OPENAI_API_KEY="op://Private/API-Keys/openai"
export GITHUB_TOKEN="op://Personal/GitHub/token"
```

## Requirements

- 1Password CLI (`op`) installed
- 1Password Service Account (REQUIRED - see [docs/SETUP.md](docs/SETUP.md) for setup)
- `keychain` for SSH agent management (Linux/WSL)
- Pi (for extension)

## Secret Gist

This project is backed up at:
https://gist.github.com/kylebrodeur/d28d6b39387b00de180aedcda90a089b

## License

MIT - Use at your own risk. Review all scripts before execution.

---

## Acknowledgments

This project is based on the approach described in:
["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/)
by Bas Nijholt.

Additional references:
- [1Password SSH Documentation](https://developer.1password.com/docs/ssh/)
- [Funtoo Keychain](https://www.funtoo.org/Keychain)
