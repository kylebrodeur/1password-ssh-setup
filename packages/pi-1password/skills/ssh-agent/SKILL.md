---
name: ssh-agent
description: "SSH agent management with 1Password for passphrase handling and keychain integration. Use when working with SSH keys on Linux/WSL/Windows. Features keychain-based key persistence and 1Password-stored passphrases for secure, passwordless SSH operations."
---

# SSH Agent Skill

## Setup

### Prerequisites

1. **1Password CLI** (`op`)
   ```bash
   # macOS
   brew install 1password-cli
   
   # Linux/WSL
   # Download from: https://1password.com/downloads/command-line/
   ```

2. **Keychain** for SSH agent management
   ```bash
   # macOS
   brew install keychain
   
   # Linux (usually pre-installed)
   sudo apt-get install keychain
   ```

3. **1Password Service Account** (required)
   - Create at [https://op.serviceaccounts.1password.com](https://op.serviceaccounts.1password.com)
   - Add to `~/.zshrc`: `export OP_SERVICE_ACCOUNT_TOKEN="your-token"`

### SSH Key Setup

1. Ensure you have an SSH key:
   ```bash
   # Generate if needed
   ssh-keygen -t ed25519 -C "your@email.com"
   ```

2. Store the key's passphrase in 1Password:
   - Create a new item (e.g., "my-ssh-key")
   - Add the passphrase to the **Password** field
   - Save as a **Password** field type

3. Update `~/.ssh/askpass-1password.sh`:
   ```bash
   SSH_KEY_REFERENCE="op://Private/my-ssh-key/password"
   ```

## Features

### Automatic SSH Agent Setup

The setup script (`~/.ssh/setup_ssh_agent.sh`) automatically:
1. Starts keychain SSH agent
2. Loads your SSH key with 1Password passphrase
3. Sets environment variables for the session

### SSH_ASKPASS Integration

When configured, SSH prompts for passphrases are handled by:
1. The 1Password helper script reads from 1Password
2. The passphrase is never stored in plaintext
3. Keychain caches the unlocked key for the session

### Keychain Integration

- Keys are unlocked once per session
- Keychain persists the unlocked state
- No password prompts for subsequent SSH operations

## Usage

### Manual Setup

If not using the automated installer, add to your shell config:

```bash
# 1Password CLI (Required first)
export PATH="$HOME/.local/bin:$PATH"

# 1Password Session Manager (Required before SSH)
if [[ -f "$HOME/.config/op-ssh/op-session-manager.sh" ]]; then
  source "$HOME/.config/op-ssh/op-session-manager.sh"
fi

# SSH Keychain with 1Password
_ssh_setup_script="${HOME}/.ssh/setup_ssh_agent.sh"
if [[ -f "$_ssh_setup_script" ]]; then
  source "$_ssh_setup_script"
fi
```

### Check SSH Agent Status

```bash
# List loaded keys
ssh-add -l

# Test SSH connection
ssh -T git@github.com
```

### Manually Unlock a Key

```bash
# Force unlock with 1Password
export SSH_ASKPASS_REQUIRE="prefer"
export SSH_ASKPASS="${HOME}/.ssh/askpass-1password.sh"
ssh-add ~/.ssh/id_ed25519
```

## Files and Directories

```
~/.ssh/
├── askpass-1password.sh    # SSH_ASKPASS helper script
├── setup_ssh_agent.sh      # Keychain initialization script
└── id_ed25519*            # Your SSH key(s)

~/.config/op-ssh/
├── .env.1pass              # User-level environment
└── op-ai-helper.sh         # Helper functions

/opt/local/bin/              # Or ~/.local/bin/
└── op-reference            # 1Password CLI wrapper
```

## Platform-Specific Notes

### WSL (Windows Subsystem for Linux)

- 1Password desktop app on Windows handles authentication
- SSH Agent enabled in 1Password desktop Settings > Developer
- Socket at: `/mnt/c/Users/kyleb/AppData/Local/1Password/sockets/`

### Native Windows

- Windows OpenSSH agent uses 1Password SSH Agent
- Ensure Windows SSH Agent service is disabled
- 1Password takes over the SSH agent pipe

### macOS

- Keychain is pre-installed
- SSH_ASKPASS uses macOS native helpers when available

## Troubleshooting

### SSH keeps asking for passphrase
```
Solution: Check SSH_ASKPASS is set correctly:
  echo $SSH_ASKPASS
  echo $SSH_ASKPASS_REQUIRE
```

### "Keychain has no keys in memory"
```
Solution: Restart keychain:
  keychain --clear
  # Then start a new shell or run:
  source ~/.ssh/setup_ssh_agent.sh
```

### "No reference provided"
```
Solution: Update ~/.ssh/askpass-1password.sh
  with a valid 1Password secret reference
```

### "Not signed in to 1Password"
```
Solution: Set OP_SERVICE_ACCOUNT_TOKEN in ~/.zshrc
```

## Keychain Commands

```bash
# List active keys
keychain --list

# Clear all keys
keychain --clear

# Show keychain status
keychain --status

# Add specific key
keychain --add ~/.ssh/id_ed25519

# Check key loaded
ssh-add -l
```

## Original Article

Based on: ["Combining Keychain and 1Password CLI for ssh-agent management"](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/) by Bas Nijholt.
