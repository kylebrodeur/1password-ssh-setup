#!/bin/bash
# platform-check.sh - Detect 1Password configuration for dual-platform support
# Handles both WSL and native Windows/WSL scenarios

set -e

# Detect platform
detect_platform() {
    if grep -q "Microsoft" /proc/version 2>/dev/null; then
        echo "wsl"
    elif [ -n "$OS" ] && [[ "$OS" == *Windows* ]]; then
        echo "windows"
    else
        echo "linux"
    fi
}

# Detect 1Password socket availability
check_socket() {
    local platform="$1"
    
    case "$platform" in
        wsl)
            # Check Windows-side 1Password sockets
            local win_user="kyleb"
            local socket_path="/mnt/c/Users/$win_user/AppData/Local/1Password/sockets/"
            
            if [ -d "$socket_path" ]; then
                echo "1Password socket found: $socket_path"
                echo "Available sockets:"
                ls -la "$socket_path" 2>/dev/null | grep -v "^d" || echo "No sockets found"
            else
                echo "1Password socket directory not found"
                echo "Make sure 1Password desktop app is running on Windows"
            fi
            ;;
        windows)
            # Windows native
            echo "Running on Windows natively"
            echo "Check: C:\\Users\\$win_user\\AppData\\Local\\1Password\\sockets\\"
            ;;
        linux)
            echo "Running on Linux"
            ;;
    esac
}

# Check if 1Password CLI is authenticated
check_op_auth() {
    if op account list &> /dev/null; then
        echo "1Password CLI: AUTHENTICATED"
        op account list --format=json 2>/dev/null | jq -r '.[].email' 2>/dev/null || op account list
    else
        echo "1Password CLI: NOT AUTHENTICATED"
        echo ""
        echo "Options:"
        echo "  1. Service Account: export OP_SERVICE_ACCOUNT_TOKEN=\"...\""
        echo "  2. Desktop App: Ensure 1Password desktop is running"
        echo "  3. Manual: op signin"
    fi
}

# Main
main() {
    local platform=$(detect_platform)
    
    echo "=== 1Password Environment Check ==="
    echo "Platform: $platform"
    echo ""
    
    check_socket "$platform"
    echo ""
    check_op_auth
    echo ""
    
    # Recommend configuration
    echo "=== Recommended Configuration ==="
    case "$platform" in
        wsl)
            echo ""
            echo "For WSL: Enable 1Password Desktop SSH Agent"
            echo "1. Open 1Password desktop app"
            echo "2. Go to Settings > Developer"
            echo "3. Enable 'SSH Agent'"
            echo "4. Restart 1Password desktop app"
            echo ""
            echo "Then in WSL, the socket should appear at:"
            echo "/mnt/c/Users/kyleb/AppData/Local/1Password/sockets/"
            ;;
        *)
            echo "No platform-specific configuration needed"
            ;;
    esac
}

main "$@"
