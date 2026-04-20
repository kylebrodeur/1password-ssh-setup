#!/bin/zsh
# ~/.ssh/setup_ssh_agent.sh - Sets up ssh-agent via keychain.
# If 'op' CLI and the askpass helper script are available, uses 1Password for passphrase.
# Intended to be sourced by .zshrc or similar.

_askpass_helper="$HOME/.ssh/askpass-1password.sh"
_askpass_vars_set=false

# Check if 'op' CLI is installed and the helper script is usable (and contains a real reference)
if command -v op >/dev/null 2>&1 && [[ -f "$_askpass_helper" ]] && [[ -x "$_askpass_helper" ]]; then
  # Verify the reference has been updated from the placeholder
  if ! grep -q "REPLACE/WITH/YOUR" "$_askpass_helper" 2>/dev/null; then
    if [[ -n "$OP_DEBUG" ]]; then echo "[DEBUG] Configuring SSH_ASKPASS for 1Password." >&2; fi
    # Configure environment for 1Password helper script
    export SSH_ASKPASS="$_askpass_helper"
    export SSH_ASKPASS_REQUIRE="prefer" # Use ASKPASS even in terminals
    _askpass_vars_set=true
  else
    if [[ -n "$OP_DEBUG" ]]; then echo "[DEBUG] askpass helper still contains placeholder. Skipping 1Password ASKPASS config." >&2; fi
  fi
else
  if [[ -n "$OP_DEBUG" ]]; then echo "[DEBUG] 'op' not found or askpass helper missing/not executable. Skipping 1Password ASKPASS config." >&2; fi
fi

if [[ -n "$OP_DEBUG" ]]; then echo "[DEBUG] Executing keychain to start ssh-agent and load id_ed25519." >&2; fi
# Execute keychain to start/find agent, load key, and set env vars
# (Adjust key name 'id_ed25519' as needed)
eval $(keychain --eval --quiet --agents ssh --inherit any-once id_ed25519)

# Clean up ASKPASS variables if they were set
if $_askpass_vars_set; then
  unset SSH_ASKPASS
  unset SSH_ASKPASS_REQUIRE
fi
