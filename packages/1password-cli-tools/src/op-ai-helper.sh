#!/bin/bash
# op-ai-helper.sh - Helper functions for AI agents to use 1Password
# Source this file in scripts or shell: source ~/.config/op-ssh/op-ai-helper.sh

# Reference: op://<vault>/<item>/<field>
# Example: op://Private/PEGASUS-SSH/password

# Configuration
OP_SSH_CONFIG_DIR="${HOME}/.config/op-ssh"
OP_REFERENCES_FILE="${OP_SSH_CONFIG_DIR}/references.conf"

# Ensure config directory exists
mkdir -p "$OP_SSH_CONFIG_DIR"

# Check if op CLI is available
_op_check() {
    if ! command -v op &> /dev/null; then
        echo "ERROR: 1Password CLI (op) not found" >&2
        return 1
    fi
    return 0
}

# Check if authenticated
_op_auth_check() {
    if ! op account list &> /dev/null; then
        echo "ERROR: Not authenticated to 1Password. Run 'op signin'" >&2
        return 1
    fi
    return 0
}

# Get a secret by reference
# Usage: op_get "op://Vault/Item/field"
op_get() {
    local reference="$1"
    if [[ -z "$reference" ]]; then
        echo "ERROR: No reference provided" >&2
        return 1
    fi
    
    _op_check || return 1
    _op_auth_check || return 1
    
    # Remove quotes if present
    reference="${reference//\"}"
    
    op read "$reference"
}

# Get a secret by name (from config)
# Usage: op_get_by_name "OPENAI_KEY"
op_get_by_name() {
    local name="$1"
    name="${name^^}"
    
    if [[ ! -f "$OP_REFERENCES_FILE" ]]; then
        echo "ERROR: No references configured. Add with: op-reference add <name> <ref>" >&2
        return 1
    fi
    
    local reference
    reference=$(grep "^${name}=" "$OP_REFERENCES_FILE" 2>/dev/null | cut -d'=' -f2-)
    
    if [[ -z "$reference" ]]; then
        echo "ERROR: Reference '$name' not found" >&2
        return 1
    fi
    
    op_get "$reference"
}

# Set environment variables from a file with 1Password references
# Usage: op_load_env .env.1pass
op_load_env() {
    local env_file="${1:-.env.1pass}"
    
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: Environment file not found: $env_file" >&2
        return 1
    fi
    
    while IFS= read -r line; do
        # Skip comments
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue
        
        # Check if it contains an op reference
        if [[ "$line" =~ op:// ]]; then
            local varname="${line%%=*}"
            varname="${varname#export }"
            local reference="${line#*=}"
            reference="${reference//\"}"
            
            local value
            if value=$(op read "$reference" 2>/dev/null); then
                export "$varname=$value"
            fi
        fi
    done < "$env_file"
}

# Run a command with environment from 1Password
# Usage: op_with_env .env.1pass -- your command
op_with_env() {
    local env_file="$1"
    shift 2 # Skip the '--'
    
    (
        op_load_env "$env_file"
        "$@"
    )
}

# Print available references
op_list_refs() {
    if [[ -f "$OP_REFERENCES_FILE" ]]; then
        echo "Configured references:"
        while IFS='=' read -r name ref; do
            [[ -n "$name" ]] && echo "  $name"
        done < "$OP_REFERENCES_FILE"
    else
        echo "No saved references. Use 'op-reference add <name> <ref>' to create."
    fi
}

# Helper for SSH passphrase (used by askpass)
op_get_ssh_passphrase() {
    op_get_by_name "SSH_KEY_PASSPHRASE"
}

# Quick status check
op_status() {
    if command -v op &> /dev/null && op account list &> /dev/null; then
        echo "1Password CLI: ✓ Authenticated"
    else
        echo "1Password CLI: ✗ Not authenticated (run: op signin)"
    fi
}

# Export functions for use in other scripts
export -f op_get
export -f op_get_by_name
export -f op_load_env
export -f op_with_env
export -f op_list_refs
export -f op_status
