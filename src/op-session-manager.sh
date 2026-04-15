#!/bin/bash
# op-session-manager.sh - Manages 1Password session tokens for WSL
# Stores the session token to avoid repeated password prompts.

TOKEN_FILE="${HOME}/.config/op-ssh/.op_session_token"

# Function to verify if the current session is valid
is_session_valid() {
    if [[ -f "$TOKEN_FILE" ]]; then
        # Load the cached token
        source "$TOKEN_FILE"
        # Try to list accounts; if it fails, session is invalid
        if op account list &>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Main logic
if is_session_valid; then
    # Session is valid, just load it into the current shell
    source "$TOKEN_FILE"
else
    # Session is invalid or missing; perform signin
    # we use a temporary file to capture the output of op signin
    # op signin generates the 'export OP_SESSION_...' lines
    
    # Ensure config dir exists
    mkdir -p "$(dirname "$TOKEN_FILE")"

    # Run op signin and capture the output
    # We use eval to execute it immediately in the current shell, 
    # but we also need to save the output to our token file.
    
    # This captures the output of op signin into a variable
    # Note: op signin is interactive, so it will prompt the user here.
    SIGNIN_OUTPUT=$(op signin)
    
    # Filter for the export lines and save them to the token file
    echo "$SIGNIN_OUTPUT" | grep "export OP_SESSION" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    
    # Now load the freshly created token into the current shell
    source "$TOKEN_FILE"
fi
