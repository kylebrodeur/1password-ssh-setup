# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2025-04-25

### Fixed
- **SSH bootstrap deadlock** (`setup_ssh_agent.sh`): On a fresh restart, if 1Password was locked, `SSH_ASKPASS` was configured unconditionally. `keychain` would invoke the 1Password askpass helper, `op read` would fail (because 1Password was locked), and the user ended up at a manual SSH passphrase prompt. Now `setup_ssh_agent.sh` detects the locked state, prompts for `op signin` **before** `keychain` runs, and only configures `SSH_ASKPASS` once 1Password is authenticated.
- **`askpass-1password.sh` silent failure**: The script previously had no `set -e` and piped output without propagating errors, causing `ssh-add` to hang or silently fail. Now uses `set -euo pipefail`, explicit error codes, and a `_ensure_op_authenticated` self-healing routine that detects lock state, tries cached tokens, and prompts via `/dev/tty` if needed.
- **`SSH_ASKPASS` vars unset after keychain**: Variables were removed after `keychain` completed, breaking manual `ssh-add` or any subsequent key-loading in the same session. They are no longer unset — they persist in the shell so `ssh-add` works later without reconfiguration.
- **`op signin` TTY/pipe swallow**: `op signin > "$TOKEN_FILE"` could swallow interactive prompts when the script was sourced from a non-TTY context (tmux detach/reattach, VS Code terminal, `exec < /dev/null`, etc.). Now the script detects `[[ ! -t 0 ]] && [[ ! -r /dev/tty ]]` and redirects `op signin` from `/dev/tty` (`</dev/tty`) to guarantee the password prompt reaches the user.
- **Dependency version mismatch**: `pi-1password` declared a dependency on `1password-cli-tools` `0.3.3` but the current published version was `0.3.4`. Updated to `0.3.4`.

### Changed
- **`SSH_ASKPASS_REQUIRE`**: Changed from `"prefer"` to `"force"` when 1Password is authenticated. This prevents `ssh-add` from falling back to a TTY passphrase prompt; instead, the self-healing `askpass-1password.sh` handles any lock state internally.

### Documentation
- Updated `docs/SETUP.md` to describe the new "1Password master password first" flow on restart.
- Updated `docs/SETUP.md` troubleshooting with VS Code / tmux TTY note.
- Updated `README.md` to describe the self-healing SSH agent behavior.

## [0.3.4] - Previous

- Added Pi extension support and agent skills.
