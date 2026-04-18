#!/bin/bash
# 1Password SSH Setup Installer
# Installs SSH scripts, CLI tools, and Pi extension

set -e

echo "==================================="
echo "1Password SSH Setup Installer"
echo "==================================="
echo ""

# Colors (no emojis, professional output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SSH_DIR="${HOME}/.ssh"
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.config/op-ssh"
PI_EXT_DIR="${HOME}/.pi/agent/extensions"

# Source directory (where this script is)
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check prerequisites
check_prereqs() {
    echo "Checking prerequisites..."
    
    local missing=()
    
    if ! command -v op &> /dev/null; then
        missing+=("1Password CLI (op)")
    fi
    
    if ! command -v keychain &> /dev/null; then
        missing+=("keychain")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing prerequisites:${NC}"
        for item in "${missing[@]}"; do
            echo "  - $item"
        done
        echo ""
        echo "Install instructions:"
        echo "  1Password CLI: https://1password.com/downloads/command-line/"
        echo "  keychain: sudo apt-get install keychain  (Linux)"
        echo "            brew install keychain          (macOS)"
        exit 1
    fi
    
    echo -e "${GREEN}All prerequisites found.${NC}"
    echo ""
}

# Create directories
setup_dirs() {
    echo "Creating directories..."
    
    mkdir -p "$SSH_DIR"
    mkdir -p "$BIN_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$PI_EXT_DIR"
    
    # Secure the config directory
    chmod 700 "$CONFIG_DIR"
    
    echo -e "${GREEN}Directories created.${NC}"
    echo ""
}

# Install SSH scripts
install_ssh_scripts() {
    echo "Installing SSH scripts..."
    
    # askpass-1password.sh
    if [ -f "$SRC_DIR/src/askpass-1password.sh" ]; then
        cp "$SRC_DIR/src/askpass-1password.sh" "$SSH_DIR/"
        chmod u+x "$SSH_DIR/askpass-1password.sh"
        echo "  Installed: askpass-1password.sh"
    fi
    
    # setup_ssh_agent.sh
    if [ -f "$SRC_DIR/src/setup_ssh_agent.sh" ]; then
        cp "$SRC_DIR/src/setup_ssh_agent.sh" "$SSH_DIR/"
        chmod u+x "$SSH_DIR/setup_ssh_agent.sh"
        echo "  Installed: setup_ssh_agent.sh"
    fi
    
    echo -e "${GREEN}SSH scripts installed.${NC}"
    echo ""
}

# Install CLI tool
install_cli_tool() {
    echo "Installing CLI tool..."
    
    if [ -f "$SRC_DIR/src/op-reference" ]; then
        cp "$SRC_DIR/src/op-reference" "$BIN_DIR/"
        chmod +x "$BIN_DIR/op-reference"
        echo "  Installed: op-reference"
        echo ""
        echo -e "${YELLOW}Note: Ensure $BIN_DIR is in your PATH${NC}"
        echo "  Current PATH check:"
        if [[ ":$PATH:" == *":$BIN_DIR:"* ]]; then
            echo -e "  ${GREEN}$BIN_DIR is in PATH${NC}"
        else
            echo -e "  ${RED}$BIN_DIR is NOT in PATH${NC}"
            echo "  Add to ~/.zshrc or ~/.bashrc:"
            echo "    export PATH=\"$BIN_DIR:\$PATH\""
        fi
    fi
    
    echo ""
}

# Install session manager
install_session_manager() {
    echo "Installing session manager..."
    
    if [ -f "$SRC_DIR/src/op-session-manager.sh" ]; then
        cp "$SRC_DIR/src/op-session-manager.sh" "$CONFIG_DIR/"
        chmod +x "$CONFIG_DIR/op-session-manager.sh"
        echo "  Installed: op-session-manager.sh"
    fi
    
    echo ""
}

# Install helper files
install_helpers() {
    echo "Installing helper files..."
    
    if [ -f "$SRC_DIR/src/op-ai-helper.sh" ]; then
        cp "$SRC_DIR/src/op-ai-helper.sh" "$CONFIG_DIR/"
        chmod +x "$CONFIG_DIR/op-ai-helper.sh"
        echo "  Installed: op-ai-helper.sh"
    fi
    
    # Create user env file if it doesn't exist
    if [ ! -f "$CONFIG_DIR/.env.1pass" ]; then
        cat > "$CONFIG_DIR/.env.1pass" << 'EOF'
# User-level 1Password Environment Variables
# Located at: ~/.config/op-ssh/.env.1pass
#
# These are loaded automatically on Pi session start BEFORE project-level .env.1pass files.
# Project-level values will OVERRIDE these if the same variable is defined.
#
# Format:
#   VAR_NAME="op://vault/item/field"
#   VAR_NAME="plain value"
#
# The 1Password CLI (op) must be authenticated for op:// references to resolve.
# Ensure OP_SERVICE_ACCOUNT_TOKEN is set in your shell config for authentication.

# ===================================================================
# SSH Keys (used by askpass script)
# ===================================================================
# Configure this with your actual 1Password reference
SSH_KEY_PASSPHRASE="op://Private/my-ssh-key/password"

# ===================================================================
# Global / Personal API Keys
# Uncomment and update when you have these in 1Password
# ===================================================================
# OPENAI_API_KEY="op://Private/API-Keys/openai"
# ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"
# GITHUB_TOKEN="op://Personal/GitHub/token"
EOF
        chmod 600 "$CONFIG_DIR/.env.1pass"
        echo "  Created: .env.1pass (template)"
    else
        echo "  Skipped: .env.1pass (already exists)"
    fi
    
    echo -e "${GREEN}Helper files installed.${NC}"
    echo ""
}

# Install Pi extension
install_pi_extension() {
    echo "Installing Pi extension..."
    
    if [ -f "$SRC_DIR/extensions/1password.ts" ]; then
        cp "$SRC_DIR/extensions/1password.ts" "$PI_EXT_DIR/"
        echo "  Installed: 1password.ts"
        echo ""
        echo -e "${YELLOW}Note: Run /reload in Pi to load the extension${NC}"
    else
        echo -e "${YELLOW}Pi extension not found in source directory${NC}"
    fi
    
    echo ""
}

# Main
main() {
    local auto_yes=false
    if [[ "$1" == "-y" ]]; then
        auto_yes=true
        shift
    fi

    check_prereqs
    setup_dirs
    install_ssh_scripts
    install_cli_tool
    install_session_manager
    install_helpers
    install_pi_extension
    
    # Pass auto_yes to update_shell_config
    update_shell_config "$auto_yes"
    
    print_summary
}

update_shell_config() {
    local auto_yes=$1
    echo "Checking shell configuration..."
    
    local shell_rc=""
    if [ -f "$HOME/.zshrc" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        shell_rc="$HOME/.bashrc"
    fi
    
    if [ -z "$shell_rc" ]; then
        echo -e "${YELLOW}Could not find .zshrc or .bashrc${NC}"
        echo "Please manually add the following to your shell config:"
        echo ""
        echo "# --- 1Password Service Account ---"
        echo "export OP_SERVICE_ACCOUNT_TOKEN=\"your-service-account-token-here\""
        echo "# ---------------------------------"
        echo ""
        echo "# --- 1Password SSH Setup ---"
        echo "export PATH=\"$BIN_DIR:\$PATH\""
        echo "_ssh_setup_script=\"${HOME}/.ssh/setup_ssh_agent.sh\""
        echo 'if [[ -f "$_ssh_setup_script" ]]; then'
        echo '  source "$_ssh_setup_script"'
        echo "fi"
        echo "# ---------------------------"
        return
    fi
    
    # Check if already configured
    if grep -q "setup_ssh_agent.sh" "$shell_rc"; then
        echo -e "${GREEN}Shell config already contains SSH setup${NC}"
        echo ""
        return
    fi
    
    echo ""
    if [ "$auto_yes" = true ]; then
        echo "Auto-confirming shell configuration update..."
        REPLY="Y"
    else
        read -p "Add SSH setup to $shell_rc? [Y/n] " -n 1 -r
        echo ""
    fi
    
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cat << EOF >> "$shell_rc"

# --- 1Password Service Account ---
export OP_SERVICE_ACCOUNT_TOKEN="your-service-account-token-here"
# ---------------------------------
EOF
        echo -e "${GREEN}Added to $shell_rc${NC}"
    else
        echo -e "${YELLOW}Skipped shell config update${NC}"
    fi
    
    echo ""

    # Session Manager Config
    if [ "$auto_yes" = true ]; then
        REPLY="Y"
    else
        echo ""
        read -p "Enable 1Password session token caching in $shell_rc? (Recommended for WSL/Linux) [Y/n] " -n 1 -r
        echo ""
    fi

    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cat << EOF >> "$shell_rc"

# --- 1Password Session Manager ---
# Must be loaded BEFORE SSH setup so askpass helper is authenticated
if [[ -f "$CONFIG_DIR/op-session-manager.sh" ]]; then
  source "$CONFIG_DIR/op-session-manager.sh"
fi
# ---------------------------------
EOF
        echo -e "${GREEN}Added session manager to $shell_rc${NC}"
    else
        echo -e "${YELLOW}Skipped session manager configuration${NC}"
    fi

    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cat << EOF >> "$shell_rc"

# --- 1PASSWORD CLI HELPERS ---
opon() {
  if ! op vault list >/dev/null 2>&1; then
    if [[ -f ~/.config/op-ssh/op-session-manager.sh ]]; then
      source ~/.config/op-ssh/op-session-manager.sh
    else
      eval "\$(op signin)"
    fi
  fi
}

opoff() {
  op signout
  rm -f ~/.config/op-ssh/.op_session_token
}

getpwd() {
  opon
  op item get "\$1" --fields label=password
}

getmfa() {
  opon
  op item get "\$1" --otp
}
# -----------------------------
EOF
        echo -e "${GREEN}Added CLI helpers to $shell_rc${NC}"
    fi

    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        cat << EOF >> "$shell_rc"

# --- 1Password SSH Setup ---
export PATH="$BIN_DIR:\$PATH"
_ssh_setup_script="${HOME}/.ssh/setup_ssh_agent.sh"
if [[ -f "\$_ssh_setup_script" ]]; then
  source "\$_ssh_setup_script"
fi
# ---------------------------
EOF
        echo -e "${GREEN}Added SSH setup to $shell_rc${NC}"
    fi
}


