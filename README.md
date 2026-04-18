# 1Password SSH & Secret Management System

Complete system for managing SSH keys and secrets using 1Password CLI with Pi integration.

Based on ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.

## Authentication Options

This setup supports three authentication methods with 1Password CLI:

1. **User Account (Interactive/App)** - Recommended for personal machines
   - Use 1Password Desktop App integration for a passwordless experience.
   - For WSL/Linux without a working bridge, use the built-in **Session Token Caching**.

2. **Service Account (Automated)** - Recommended for CI/CD and isolated agents
   - Non-interactive authentication (no password prompts)
   - Persistent sessions (no expiry issues)
   - Vault-specific access control

3. **Session Token Caching (WSL/Headless)** - Best for personal use on WSL/Linux
   - Store session tokens locally to avoid repeated password prompts.
   - Authenticate once; remain signed in until the session expires.

## Features
- **24-Hour Persistent Sessions** - Enter your master password once a day (background session keep-alive)
- **CLI Helper Functions** - `opon`, `opoff`, `getpwd`, and `getmfa` automatically added to your shell
- **SSH Agent Integration** - Keychain + 1Password for passphrase management
- **Pi Extension** - Native 1Password tools and commands in Pi
- **Cascading Environment** - User-level and project-level `.env.1pass` files
- **CLI Tools** - `op-reference` for shell scripts and automation
- **Platform Support** - Works on WSL and native Windows
- **Flexible Auth** - Supports both Service Accounts and standard `op signin`

## Platform-Specific Setup

This setup supports two platforms:

### WSL (Windows Subsystem for Linux)
- 1Password CLI handles authentication (Service Account or `op signin`)
- Desktop app still needed for ssh-agent socket (if using SSH key management)

### Native Windows
- 1Password CLI handles authentication
- Windows native SSH client can use 1Password agent socket
- Desktop app required for ssh-agent socket functionality

Both platforms support the same secret references from 1Password vaults.

### Authentication Setup

**Option A: User Account (Interactive)**
To authenticate interactively with your personal account:
```bash
eval $(op signin) -f
# Verify setup
op account list
```

**Option B: Service Account (Automated)**
To use `op` CLI commands with a Service Account:
```bash
echo "export OP_SERVICE_ACCOUNT_TOKEN=your-service-account-token" >> ~/.zshrc
source ~/.zshrc

# Verify setup
op account list
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

## Project Structure

```
1password-ssh-setup/
├── skills/                 # Agent Skills (distribution)
│   ├── 1password-cli/      # 1Password CLI skill
│   ├── ssh-agent/          # SSH agent management skill
│   └── 1password-env/      # Pi environment skill
├── src/                    # Core scripts
│   ├── askpass-1password.sh     # SSH_ASKPASS script
│   ├── setup_ssh_agent.sh       # Keychain initialization
│   ├── op-reference             # CLI tool
│   └── platform-check.sh        # OS detection
├── extensions/             # Pi extension source
│   └── 1password.ts             # Pi extension code
├── examples/               # Example configs
│   └── env.1pass.template       # Environment template
├── docs/                   # Documentation
│   └── SETUP.md                 # Detailed setup guide
├── install.sh              # Installation script for system setup
├── package.json            # npm package & skills config
└── README.md               # This file
```

## Installation

This project is divided into two independent parts:

### Part 1: Pi Agent Package (Recommended)

If you just want the Pi extension and skills to manage secrets in your AI coding agent, install the npm package:

```bash
# Install as a Pi package
pi install npm:pi-1password

# Or install manually via npm:
npm install -g pi-1password
```

This gives you access to the following skills and extensions in Pi:
1. **`1password-cli`**: General 1Password CLI integration and secret management.
2. **`ssh-agent`**: SSH key management with keychain and 1Password passphrases.
3. **`1password-env`**: Advanced environment management extension for the Pi coding agent.

### Part 2: System Setup (SSH & CLI Tools)

If you want to set up SSH Agent integration and CLI tools on your machine, clone this repository and run the install script:

```bash
git clone https://github.com/kylebrodeur/1password-ssh-setup.git
cd 1password-ssh-setup
./install.sh
```

See [docs/SETUP.md](docs/SETUP.md) for detailed installation instructions.

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

### 3. CLI Tool (op-reference) & Shell Helpers

**Shell Helpers (Added to `~/.zshrc` / `~/.bashrc`):**
```bash
opon                  # Quickly sign in and load session token
opoff                 # Sign out and remove session token
getpwd "Item Name"    # Get a password directly to stdout
getmfa "Item Name"    # Get current TOTP token to stdout
```

**Command-line tool for scripts (`op-reference`):**

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
OP_SECRET_REFERENCE="op://Private/my-ssh-key/password"
```

### Adding API Keys

Add to `~/.config/op-ssh/.env.1pass`:
```bash
OPENAI_API_KEY="op://Private/API-Keys/openai"
GITHUB_TOKEN="op://Personal/GitHub/token"
```

## Requirements

- 1Password CLI (`op`) installed
- 1Password User Account (`eval $(op signin) -f`) OR Service Account
- `keychain` for SSH agent management (Linux/WSL)
- Pi (for extension)

## License

MIT - Use at your own risk. Review all scripts before execution.

---

## Acknowledgments

This project is based on the approach described in:
["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/)
by Bas Nijholt.

Additional references:
- [1Password SSH Documentation](https://developer.1password.com/docs/ssh/)
- [1Password CLI Reference](https://developer.1password.com/docs/cli/reference/)
- [1Password Agent Hooks](https://github.com/1Password/agent-hooks/)
- [Building on 1Password with LLMs](https://developer.1password.com/docs/building-with-llms/)
- [Funtoo Keychain](https://www.funtoo.org/Keychain)
