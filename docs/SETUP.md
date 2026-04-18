# 1Password SSH Setup - Multi-Auth Edition

> **Note:** This setup supports multiple authentication methods: Service Accounts, Desktop App integration, and Session Token Caching.

## Prerequisites

1. **1Password CLI** (`op`)
   ```bash
   # macOS
   brew install 1password-cli
   
   # Linux/WSL
   # Download from: https://1password.com/downloads/command-line/
   ```

2. **1Password Service Account**
   - Go to [https://op.serviceaccounts.1password.com](https://op.serviceaccounts.1password.com)
   - Sign in to your 1Password account
   - Click "Create Service Account"
   - Name it (e.g., "ssh-setup")
   - Copy the Service Account Token

3. **Keychain** for SSH agent management
   ```bash
   # macOS
   brew install keychain
   
   # Linux (usually pre-installed)
   sudo apt-get install keychain
   ```

4. **SSH Key** with passphrase
   ```bash
   # Generate if needed
   ssh-keygen -t ed25519 -C "your@email.com"
   ```

---

## Service Account Setup (Required)

Before using this setup, you must configure a Service Account:

### 1. Create Service Account

Go to [https://op.serviceaccounts.1password.com](https://op.serviceaccounts.1password.com) and:

1. Sign in to your 1Password account
2. Click **"Create Service Account"**
3. Give it a name (e.g., "ssh-setup")
4. Copy the Service Account Token (looks like `ey...`)

### 2. Add Token to Shell Config

Add to your `~/.zshrc` (or `~/.bashrc`):

```bash
# --- 1Password Service Account ---
export OP_SERVICE_ACCOUNT_TOKEN="your-service-account-token-here"
# ---------------------------------
```

### 3. Reload Shell Configuration

```bash
source ~/.zshrc
```

### 4. Verify Setup

```bash
op account list
# Should show your 1Password account without prompting for password
```

---

## Installation

### Step 1: Run the Interactive Setup Wizard

Install the CLI tools package globally and run the interactive setup wizard:

```bash
# Install the tools globally
npm install -g 1password-cli-tools

# Run the interactive setup wizard
op-setup
# or
1password-cli-setup
```

The wizard will interactively:
- Ask if you want to enable SSH Agent integration
- Prompt you for your SSH passphrase 1Password reference
- Help you configure your global API keys (OpenAI, Anthropic, GitHub, NPM)
- Copy SSH scripts to `~/.ssh/`
- Install CLI tools to `~/.local/bin/`
- Configure `~/.config/op-ssh/` directory
- Add the 24-hour background session caching to your shell config

### Step 2: Reload Shell Configuration

```bash
source ~/.zshrc
```

### Step 3: Verify SSH Agent Setup

If you enabled SSH Agent integration during the wizard, test it:

```bash
ssh -T git@github.com
```
You should be prompted for your 1Password master password (or use biometrics if configured). After unlocking, the SSH key is cached by `keychain` and you won't need to enter the password again until your session expires.

---

## Manual Secret Configuration (Optional)

If you skipped the wizard or want to manually edit your secrets later:

### 1. Configure SSH Passphrase Reference

1. Open 1Password app
2. Find or create your SSH key item (e.g., "my-ssh-key")
3. Add the passphrase to the **Password** field
4. Click the field → **"Copy Secret Reference"**
5. The reference should look like: `op://Private/my-ssh-key/password`

Edit `~/.ssh/askpass-1password.sh` and update the reference:
```bash
OP_SECRET_REFERENCE="op://Private/my-ssh-key/password"
```

6. Update `~/.ssh/askpass-1password.sh` with your reference:
   ```bash
   # Edit the file and replace the reference
   SSH_KEY_REFERENCE="op://Private/my-ssh-key/password"
   ```

### Step 3: Test

```bash
# Test SSH
ssh-add -l  # Should show your key

# Test in Pi
pi
/op-status
```

---

## Manual Installation

If you prefer manual setup:

### SSH Scripts

```bash
# Copy askpass script
cp src/askpass-1password.sh ~/.ssh/
chmod u+x ~/.ssh/askpass-1password.sh

# Copy setup script
cp src/setup_ssh_agent.sh ~/.ssh/
chmod u+x ~/.ssh/setup_ssh_agent.sh
```

### CLI Tool

```bash
cp src/op-reference ~/.local/bin/
chmod +x ~/.local/bin/op-reference
```

### Config Directory

```bash
mkdir -p ~/.config/op-ssh
cp src/op-ai-helper.sh ~/.config/op-ssh/
cp examples/env.1pass.template ~/.config/op-ssh/
```

### Update Shell Config

Add to `~/.zshrc` (or `~/.bashrc`). **Note: Order is important!** The session manager must be loaded before the SSH setup if you are using Session Token caching.

```bash
# --- 1Password Service Account ---
export OP_SERVICE_ACCOUNT_TOKEN="your-service-account-token-here"
# -------------------------------------

# --- 1Password Session Manager (Optional, see below) ---
# MUST be placed before SSH setup
if [[ -f "$HOME/.config/op-ssh/op-session-manager.sh" ]]; then
  source "$HOME/.config/op-ssh/op-session-manager.sh"
fi
# -------------------------------------------------------

# --- SSH KEYCHAIN WITH 1PASSWORD ---
_ssh_setup_script="${HOME}/.ssh/setup_ssh_agent.sh"
if [[ -f "$_ssh_setup_script" ]]; then
  source "$_ssh_setup_script"
fi
# -------------------------------------

# --- 1Password CLI ---
export PATH="$HOME/.local/bin:$PATH"
# ---------------------
```

### Pi Extension

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/1password.ts ~/.pi/agent/extensions/
```

---

## Configuration

### User-Level Environment

Edit `~/.config/op-ssh/.env.1pass`:

```bash
# SSH passphrase (required)
SSH_KEY_PASSPHRASE="op://Private/my-ssh-key/password"

# Personal API keys
OPENAI_API_KEY="op://Private/API-Keys/openai"
GITHUB_TOKEN="op://Personal/GitHub/token"
```

### Project-Level Environment

Create `./.env.1pass` in project root:

```bash
# Project-specific API keys
PROJECT_API_KEY="op://Work/ProjectX/token"

# Override user keys for this project
OPENAI_API_KEY="op://Work/OpenAI/prod-key"
```

---

## Three Methods to Work with Secrets

1. **Desktop App Integration (Recommended)**
   - On Windows/macOS, turn on "Integrate with 1Password CLI" in Settings $\rightarrow$ Developer.
   - The `op` CLI will use the app's biometric session. No password prompts in terminal.

2. **Session Token Caching (Best for WSL/Linux)**
   - If the Desktop App bridge is not working, use the `op-session-manager.sh` helper.
   - It caches your session token locally, so you only enter your password when the session expires.
   - To enable: add `source ~/.config/op-ssh/op-session-manager.sh` to your `.zshrc`.

3. **Service Accounts (Automated/CI)**
   - Use a dedicated token for non-interactive environments.
   - Add `export OP_SERVICE_ACCOUNT_TOKEN="your-token"` to your shell config.

### Recommended Workflow

For Linux/Windows development, use **`op run`** with environment files:

### Recommended Workflow

For Linux/Windows development, use **`op run`** with environment files:

1. Create `app.env` with secret references:
   ```bash
   export OPENAI_API_KEY="op://Private/API-Keys/openai"
   export DATABASE_URL="op://Work/Database/prod"
   ```

2. Run your app with secrets provisioned:
   ```bash
   op run --env-file app.env -- node app.js
   ```

3. Secrets are resolved at runtime and never appear in plaintext

## Troubleshooting

### "Not signed in to 1Password"

```bash
# Verify your token is set
echo $OP_SERVICE_ACCOUNT_TOKEN

# Test with op account list
op account list
```

### "Permission denied" on SSH

```bash
# Clear keychain and restart
keychain --clear
# Then start a new shell
```

### "No reference provided"

Check `~/.ssh/askpass-1password.sh` has the correct Secret Reference.

### Extension not loading in Pi

```bash
# In Pi, run:
/reload

# Or restart Pi
```

### Project values not overriding user values

Check `/op-list` in Pi - project vars show `[.]` not `[~]`.

## Security Notes

1. **Service Account Token** - Keep it secret! Never commit to git
2. **Never commit** `.env.1pass` files with actual references to git
3. **References are safe** - they don't contain actual secrets
4. **File permissions** - `~/.config/op-ssh/` files should be mode 600
5. **Service Account Scope** - Can restrict access to specific vaults

## Uninstallation

```bash
# Remove SSH scripts
rm ~/.ssh/askpass-1password.sh
rm ~/.ssh/setup_ssh_agent.sh

# Remove CLI tool
rm ~/.local/bin/op-reference

# Remove config
rm -rf ~/.config/op-ssh

# Remove Pi extension
rm ~/.pi/agent/extensions/1password.ts

# Edit ~/.zshrc to remove the keychain and 1password sections
```

---

## Original Article Attribution

Based on the excellent guide by Bas Nijholt:
[https://www.nijho.lt/post/ssh-1password-funtoo-keychain/](https://www.nijho.lt/post/ssh-1password-funtoo-keychain/)

##Pi Commands

The Pi extension provides the following commands:

### `/op-status`
Check 1Password authentication and loaded environment variables.

### `/op-env`
Load project environment from `.env.1pass`.
- Arguments: optional file name
- Autocomplete: `.env.1pass`, `.env.local.1pass`, etc.

### `/op-env-user`
Load user-level environment from `~/.config/op-ssh/.env.1pass`.

### `/op-get op://...`
Get a specific secret by reference.

### `/op-create-env [filename]`
Create a project-level environment file with template.
- Creates `.env.1pass` with common API key references
- Template includes: `GITHUB_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

### `/op-add-item VAR_NAME op://...`
Add a 1Password secret reference to project env.

Examples:
```bash
/op-add-item OPENAI_API_KEY op://Private/API-Keys/openai
/op-add-item DATABASE_URL op://Work/Database/prod
```

### `/op-list`
List all loaded environment variables with sources.

### `/op-config`
Open the config directory and show user env file.

## Environment Files

### Format

**Project-Level (`.env.1pass`)**
```
# Format: export VAR="op://vault/item/field"
export OPENAI_API_KEY="op://Private/API-Keys/openai"
export DATABASE_URL="op://Work/Database/prod"
```

**User-Level (same format)**
```
# ~/.config/op-ssh/.env.1pass
export OPENAI_API_KEY="op://Private/API-Keys/openai"
```

**Note:** Use `export` in `.env.1pass` files for consistency with `.env` parsing. The extension handles both formats.

### Cascade Order
1. `~/.pi/.env` (Pi-level, if present)
2. `~/.config/op-ssh/.env.1pass` (user-level)
3. `./.env.1pass` (project-level, overrides user)
