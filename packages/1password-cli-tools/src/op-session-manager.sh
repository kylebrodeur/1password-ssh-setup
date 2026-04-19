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
    echo -e "\n\033[1;34m╭───────────────────────────────────────────╮\033[0m" >&2
    echo -e "\033[1;34m│\033[0m   \033[1;33m1Password Session Expired\033[0m               \033[1;34m│\033[0m" >&2
    echo -e "\033[1;34m╰───────────────────────────────────────────╯\033[0m" >&2
    echo -e "Please enter your master password to authenticate." >&2
    echo -e "\033[2m(Or press Ctrl+C to skip. You can sign in later by running 'opon')\033[0m\n" >&2
    
    # Run op signin, capturing output to the token file while keeping stdin/stderr connected
    # so the user can interactively type their master password
    if op signin > "$TOKEN_FILE" 2>/dev/tty; then
        echo -e "\033[1;32m✓ Successfully signed in to 1Password.\033[0m" >&2
        chmod 600 "$TOKEN_FILE"
        source "$TOKEN_FILE"
        # Start keep-alive in the background
        if ! pgrep -f "sleep 1500" >/dev/null; then
            keep_session_alive &
            disown
        fi
    else
        echo -e "\n\033[1;31m✗ Failed to sign in or skipped.\033[0m" >&2
        echo -e "You can sign in manually later by running: \033[1;36mopon\033[0m\n" >&2
        rm -f "$TOKEN_FILE"
    fi
fi
