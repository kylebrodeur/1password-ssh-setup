#!/bin/sh
# ~/.ssh/askpass-1password.sh
# Provides the SSH key passphrase from 1Password CLI via SSH_ASKPASS
# 
# SETUP REQUIRED:
# 1. Add your SSH key passphrase to 1Password
# 2. Copy the Secret Reference (Format: op://<vault>/<item>/<field>)
# 3. Paste it below, replacing the placeholder

# Configuration - UPDATE THIS LINE with your actual reference
OP_SECRET_REFERENCE="op://Employee/pegasus-ssh/password"

# Alternative: Load from helper functions (if available)
if [ -f "$HOME/.config/op-ssh/op-ai-helper.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.config/op-ssh/op-ai-helper.sh" 2>/dev/null
    # Try to get passphrase by name first, fall back to direct reference
    op_get_by_name "SSH_KEY_PASSPHRASE" 2>/dev/null || op read "$OP_SECRET_REFERENCE"
else
    # Direct fallback
    op read "$OP_SECRET_REFERENCE"
fi
