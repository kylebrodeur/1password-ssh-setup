#!/bin/bash
# ~/.ssh/askpass-1password.sh
# Provides the SSH key passphrase from 1Password CLI via SSH_ASKPASS.
#
# SELF-HEALING: If 1Password is not authenticated, this script will attempt
# to unlock it interactively (via /dev/tty) so that on a fresh restart the
# user is prompted for their 1Password master password INSTEAD of a raw SSH
# passphrase prompt. This is a safety net for manual ssh-add calls or edge
# cases where the shell-level signin in setup_ssh_agent.sh didn't run first.
#
# SETUP REQUIRED:
# 1. Add your SSH key passphrase to 1Password
# 2. Copy the Secret Reference (Format: op://<vault>/<item>/<field>)
# 3. Paste it below, replacing the placeholder

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration - UPDATE THIS LINE with your actual reference
# ---------------------------------------------------------------------------
OP_SECRET_REFERENCE="op://Private/my-ssh-key/password"

# Cached session token file (shared with op-session-manager.sh)
TOKEN_FILE="${HOME}/.config/op-ssh/.op_session_token"

# ---------------------------------------------------------------------------
# Ensure 1Password CLI is authenticated.
#
# Tries in order:
#   1. Native authentication (1Password app, biometric, service account)
#   2. Cached session token file
#   3. Interactive signin via /dev/tty
# ---------------------------------------------------------------------------
_ensure_op_authenticated() {
    if [[ -n "${OP_DEBUG:-}" ]]; then
        echo "[DEBUG] askpass: checking 1Password authentication..." >&2
    fi

    # 1. Already authenticated?
    if op vault list >/dev/null 2>&1; then
        if [[ -n "${OP_DEBUG:-}" ]]; then
            echo "[DEBUG] askpass: 1Password already authenticated." >&2
        fi
        return 0
    fi

    # 2. Try cached session token
    if [[ -f "$TOKEN_FILE" ]]; then
        if [[ -n "${OP_DEBUG:-}" ]]; then
            echo "[DEBUG] askpass: trying cached token file..." >&2
        fi
        # shellcheck source=/dev/null
        source "$TOKEN_FILE" >/dev/null 2>&1 || true
        if op vault list >/dev/null 2>&1; then
            if [[ -n "${OP_DEBUG:-}" ]]; then
                echo "[DEBUG] askpass: authenticated via cached token." >&2
            fi
            return 0
        fi
    fi

    # 3. Last resort: interactive signin from /dev/tty.
    # This works even when invoked as an SSH_ASKPASS helper (non-TTY subprocess)
    # because /dev/tty is the controlling terminal if one exists.
    if [[ -r /dev/tty ]]; then
        if [[ -n "${OP_DEBUG:-}" ]]; then
            echo "[DEBUG] askpass: prompting for interactive op signin..." >&2
        fi

        mkdir -p "$(dirname "$TOKEN_FILE")"
        local _tmp_token
        _tmp_token=$(mktemp)
        op signin < /dev/tty > "$_tmp_token" 2> /dev/tty
        local _signin_exit=$?

        if [[ $_signin_exit -eq 0 ]]; then
            local _token_output
            _token_output=$(cat "$_tmp_token")
            rm -f "$_tmp_token"
            eval "$_token_output"
            echo "$_token_output" > "$TOKEN_FILE"
            chmod 600 "$TOKEN_FILE"

            if op vault list >/dev/null 2>&1; then
                if [[ -n "${OP_DEBUG:-}" ]]; then
                    echo "[DEBUG] askpass: authenticated via interactive signin." >&2
                fi
                return 0
            fi
        else
            rm -f "$_tmp_token"
        fi
    fi

    return 1
}

# ---------------------------------------------------------------------------
# Load helper functions if available
# ---------------------------------------------------------------------------
helper_loaded=false
if [[ -f "$HOME/.config/op-ssh/op-ai-helper.sh" ]]; then
    if [[ -n "${OP_DEBUG:-}" ]]; then
        echo "[DEBUG] askpass loading op-ai-helper.sh" >&2
    fi
    # shellcheck source=/dev/null
    source "$HOME/.config/op-ssh/op-ai-helper.sh" 2>/dev/null
    helper_loaded=true
fi

# ---------------------------------------------------------------------------
# Step 1: guarantee 1Password is authenticated
# ---------------------------------------------------------------------------
if ! _ensure_op_authenticated; then
    echo "1Password is locked and could not be unlocked interactively" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: retrieve the passphrase
# ---------------------------------------------------------------------------
passphrase=""

if $helper_loaded; then
    if passphrase=$(op_get_by_name "SSH_KEY_PASSPHRASE" 2>/dev/null); then
        printf '%s\n' "$passphrase"
        exit 0
    fi
fi

# Direct fallback — must succeed or the script exits non-zero so that
# ssh-add / keychain reports the failure per SSH_ASKPASS_REQUIRE=force.
op read "$OP_SECRET_REFERENCE"
