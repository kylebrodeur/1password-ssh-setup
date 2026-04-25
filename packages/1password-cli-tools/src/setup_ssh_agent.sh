#!/bin/zsh
# ~/.ssh/setup_ssh_agent.sh - Sets up ssh-agent via keychain.
# Auth-flow: on a fresh restart, if 1Password is locked, this script prompts
# for the 1Password master password FIRST (via op signin) so that by the
# time keychain runs, 1Password is already authenticated and the SSH passphrase
# flows automatically — no raw passphrase prompt.
#
# If 1Password unlock is cancelled or fails, SSH_ASKPASS is not configured and
# keychain falls back to a normal interactive passphrase prompt.
# Intended to be sourced by .zshrc or similar.

_askpass_helper="$HOME/.ssh/askpass-1password.sh"

# ---------------------------------------------------------------------------
# Check if 'op' CLI is installed and the helper script is usable
# ---------------------------------------------------------------------------
if command -v op >/dev/null 2>&1 && [[ -f "$_askpass_helper" ]] && [[ -x "$_askpass_helper" ]]; then
  # Verify the reference has been updated from the placeholder
  if ! grep -q "REPLACE/WITH/YOUR" "$_askpass_helper" 2>/dev/null; then

    # -----------------------------------------------------------------------
    # If 1Password is not authenticated yet, try to unlock it interactively
    # BEFORE keychain runs. This flips the prompt order so the user sees
    # a 1Password unlock prompt instead of a raw SSH passphrase prompt.
    # -----------------------------------------------------------------------
    if ! op vault list &>/dev/null; then
      if [[ -t 0 ]] || [[ -r /dev/tty ]]; then
        if [[ -n "$OP_DEBUG" ]]; then
          echo "[DEBUG] 1Password not authenticated. Prompting for op signin." >&2
        fi

        local _tmp_token
        _tmp_token=$(mktemp)
        op signin < /dev/tty > "$_tmp_token" 2> /dev/tty
        local _signin_exit=$?

        if [[ $_signin_exit -eq 0 ]]; then
          local _token_output
          _token_output=$(cat "$_tmp_token")
          rm -f "$_tmp_token"
          eval "$_token_output"
          # Cache token for future shells / askpass calls
          local _token_file="${HOME}/.config/op-ssh/.op_session_token"
          mkdir -p "$(dirname "$_token_file")"
          echo "$_token_output" > "$_token_file"
          chmod 600 "$_token_file"
        else
          rm -f "$_tmp_token"
          if [[ -n "$OP_DEBUG" ]]; then
            echo "[DEBUG] op signin failed (exit: $_signin_exit)." >&2
          fi
        fi
      fi
    fi

    # -----------------------------------------------------------------------
    # Only configure SSH_ASKPASS when 1Password is actually authenticated.
    # Use 'force' so that ssh-add exclusively uses our helper and never falls
    # back to a TTY passphrase prompt.
    # -----------------------------------------------------------------------
    if op vault list &>/dev/null; then
      if [[ -n "$OP_DEBUG" ]]; then
        echo "[DEBUG] Configuring SSH_ASKPASS for 1Password (force mode)." >&2
      fi
      export SSH_ASKPASS="$_askpass_helper"
      export SSH_ASKPASS_REQUIRE="force"
    else
      if [[ -n "$OP_DEBUG" ]]; then
        echo "[DEBUG] 1Password still not authenticated. Skipping ASKPASS; keychain will use TTY passphrase prompt." >&2
      fi
    fi

  else
    if [[ -n "$OP_DEBUG" ]]; then
      echo "[DEBUG] askpass helper still contains placeholder. Skipping 1Password ASKPASS config." >&2
    fi
  fi
else
  if [[ -n "$OP_DEBUG" ]]; then
    echo "[DEBUG] 'op' not found or askpass helper missing/not executable. Skipping 1Password ASKPASS config." >&2
  fi
fi

if [[ -n "$OP_DEBUG" ]]; then
  echo "[DEBUG] Executing keychain to start ssh-agent and load id_ed25519." >&2
fi

# Execute keychain to start/find agent, load key, and set env vars
# (Adjust key name 'id_ed25519' as needed)
eval $(keychain --eval --quiet --agents ssh --inherit any-once id_ed25519)

# Keep SSH_ASKPASS set in the environment so that manual ssh-add later
# (or other shells) can still use the 1Password helper. The helper itself
# will gracefully fall back if 1Password is locked.
