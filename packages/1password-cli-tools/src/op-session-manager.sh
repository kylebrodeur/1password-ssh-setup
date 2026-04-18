#!/bin/bash
# op-session-manager.sh - Manages 1Password session tokens for WSL
# Stores the session token to avoid repeated password prompts.

TOKEN_FILE="${HOME}/.config/op-ssh/.op_session_token"

# Function to verify if the current session is valid
is_session_valid() {
    if [[ -f "$TOKEN_FILE" ]]; then
        # Load the cached token
        source "$TOKEN_FILE"
        # Try to list vaults; if it fails, session is invalid
        if op vault list &>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to keep the 1Password session alive by polling it every 25 minutes
keep_session_alive() {
    while true; do
        sleep 1500 # 25 minutes
        if [[ -f "$TOKEN_FILE" ]]; then
            source "$TOKEN_FILE"
            op vault list >/dev/null 2>&1 || break
        else
            break
        fi
    done
}

# Main logic
if is_session_valid; then
    # Session is valid, just load it into the current shell
    source "$TOKEN_FILE"
    # Start keep-alive in the background if not already running
    if ! pgrep -f "sleep 1500" >/dev/null; then
        keep_session_alive &
        disown
    fi
else
    # Session is invalid or missing; perform signin
    # we use a temporary file to capture the output of op signin
    # op signin generates the 'export OP_SESSION_...' lines
    
    # Ensure config dir exists
    mkdir -p "$(dirname "$TOKEN_FILE")"

    # We must prompt the user visibly!
    echo "1Password session expired or invalid. Please sign in:" >&2
    
    # Run op signin, capturing output to the token file while keeping stdin/stderr connected
    # so the user can interactively type their master password
    if op signin > "$TOKEN_FILE"; then
        chmod 600 "$TOKEN_FILE"
        source "$TOKEN_FILE"
        # Start keep-alive in the background
        if ! pgrep -f "sleep 1500" >/dev/null; then
            keep_session_alive &
            disown
        fi
    else
        echo "Failed to sign in to 1Password." >&2
        rm -f "$TOKEN_FILE"
    fi
fi
