# 1Password Pi Extension — Dev Learnings

> Documented during the v0.3.5 release cycle. Review this before the next update.

---

## 1. Pi Package Structure

Pi packages live under `packages/pi-1password/` and follow a specific contract with the Pi agent harness:

```
packages/pi-1password/
├── package.json          # Must declare pi.extensions and pi.skills
├── extensions/
│   └── 1password.ts      # Main extension entrypoint (package.json main)
└── skills/
    └── ssh-agent/
        └── SKILL.md      # Installable skill documentation
```

### package.json requirements
- `"pi.extensions": ["extensions"]` — array of directories scanned for `.ts` extensions
- `"pi.skills": ["skills"]` — array of directories scanned for `SKILL.md` files
- `"main": "extensions/1password.ts"` — Pi loads this as the extension entrypoint
- `"type": "module"` — for ESM support

### Skills are Markdown, not Code
Skills are **not** executable code. They are `SKILL.md` files that the Pi harness surfaces when a user asks "how do I do X?". The skill directory name becomes the skill name (e.g. `ssh-agent`). Keep instructions actionable and cross-reference related docs.

---

## 2. Monorepo Version & Dependency Sync

**Lesson learned the hard way:** `pi-1password` declared `"1password-cli-tools": "0.3.3"` while `1password-cli-tools` was already at `0.3.4`. Always bump ALL packages together.

### Pre-publish checklist
```bash
# Verify all versions are aligned
node -p "require('./packages/1password-cli-tools/package.json').version"
node -p "require('./packages/pi-1password/package.json').version"
node -p "require('./packages/pi-1password/package.json').dependencies['1password-cli-tools']"
```

Both packages and the root workspace should share the same version number. The `pi-1password` package depends on `1password-cli-tools` at the same version.

---

## 3. The `.pi/` Directory

Pi creates `.pi/tasks/*.json` during agent conversations to track task state. **Always `.gitignore` it.**

```gitignore
# pi task tracking
.pi/
```

These files are ephemeral and will cause merge conflicts / dirty working trees if committed. We added this to `.gitignore` during this release.

---

## 4. Extension ↔ Shell Script Co-Design

The Pi extension and the CLI tools share the same filesystem contract:

| CLI tool writes... | Pi extension reads... |
|---|---|
| `~/.config/op-ssh/.env.1pass` | `/op-env-user` loads it |
| `~/.config/op-ssh/references.conf` | `op_get_by_name()` resolves it |
| `~/.config/op-ssh/.op_session_token` | Session validity checks |
| `~/.ssh/askpass-1password.sh` | SSH agent integration |

**Implication:** A bug in a shell script (e.g., `setup_ssh_agent.sh` silently failing) manifests as broken behavior in Pi too — even though Pi's TypeScript extension has no direct bug.

---

## 5. Pi Commands & Command Patterns

The `extensions/1password.ts` defines Pi-native slash commands:

```typescript
// Pattern: /command-name [args]
/op-status          // Check auth
/op-env [file]      // Load project env from .env.1pass
/op-env-user        // Load user env
/op-get op://...    // Get secret by reference
/op-list            // Show loaded vars with source markers [~] vs [.]
/op-config          // Open config dir
/op-create-env      // Scaffold new .env.1pass
```

**Key design pattern:** Commands should be thin wrappers around shared `op-*` shell helpers so that behavior is consistent whether the user runs `/op-env` inside Pi or `oprun` in their terminal.

---

## 6. Environment Cascade

Pi supports a cascading environment system that 1Password integrates with:

1. `~/.config/op-ssh/.env.1pass` — user-level (loaded first)
2. `./.env.1pass` — project-level (overrides user)

In the extension, `/op-list` shows source markers:
- `[~]` = from user-level config
- `[.]` = from project-level config (override)

This is consistent with how `oprun` works in the shell (user env first, then project env overrides).

---

## 7. Publishing to Pi vs npm

Pi packages are published to **npm** like any other package, but consumed by Pi via `pi install npm:pi-1password`. The `files` array in `package.json` controls what gets published:

```json
"files": [
  "extensions/",
  "skills/",
  "package.json"
]
```

**Do not** include `node_modules/` or `.pi/` in published output. Use `.npmignore` or `files` to exclude noise.

---

## 8. TTY & Terminal Context Assumptions

A major lesson from Issue #3: Pi runs in many terminal contexts (VS Code terminal, tmux, detached sessions, `exec < /dev/null`). Shell scripts that assume a TTY will hang or swallow prompts.

**Pattern to use:**
```bash
if [[ ! -t 0 ]] && [[ ! -r /dev/tty ]]; then
  echo "No TTY available, skipping interactive prompt" >&2
  return 0
fi
op signin > "$TOKEN_FILE" </dev/tty
```

This matters because Pi may be configured to spawn terminals that don't allocate a PTY by default.

---

## 9. Setup Wizard Conventions

The `bin/setup.js` wizard uses `@clack/prompts` for interactive setup and `@clack/core` for state management. It:

1. Detects platform (WSL / Linux / macOS)
2. Copies scripts to `~/.ssh/` and `~/.config/op-ssh/`
3. Patches `~/.zshrc` with a guarded block (`# --- BEGIN 1PASSWORD SETUP ---`)
4. Configures `.npmrc` for auth token injection

**Key convention:** The `.zshrc` block uses `BEGIN`/`END` markers so it can be **idempotently updated** on re-runs. Never blindly append — always check for existing blocks.

---

## 10. SSH Agent `SSH_ASKPASS_REQUIRE` Behavior (Corrected)

**Primary mechanism:** `setup_ssh_agent.sh` detects when 1Password is locked, runs `op signin` **before** `keychain`, and only exports `SSH_ASKPASS` once authenticated. This eliminates the bootstrap deadlock — the user sees the 1Password master-password prompt first, and by the time `keychain` / `ssh-add` needs the passphrase, 1Password is already unlocked.

**Secondary / safety-net:** If a manual `ssh-add` is run later and 1Password has somehow locked again, the self-healing `askpass-1password.sh` detects the lock, prompts for `op signin` via `/dev/tty`, and then retrieves the passphrase. This only works **because** we use:

```bash
export SSH_ASKPASS_REQUIRE="force"
```

- `"prefer"` = if ASKPASS fails, fall back to a TTY passphrase prompt. This hides the underlying problem.
- `"force"` = **only** use the ASKPASS helper. Combined with self-healing, this guarantees the user always hits our code path where we can prompt for 1Password unlock.

**Why this matters for Pi:** Pi may run shell commands in subprocesses that aren't attached to a controlling TTY. `"prefer"` would silently bypass our helper and leave the user hanging. `"force"` ensures our TTY-detection code in the askpass script is the single point of control.

### What changed our thinking
Initially we believed the fix was to have `askpass-1password.sh` **exit non-zero** so `ssh-add` would "gracefully fall back" to a raw passphrase prompt. The user explicitly rejected this: they wanted to **never** type the raw SSH passphrase — they wanted the system to unlock 1Password first and then provide the passphrase automatically. This flipped our approach from "fail and let the system fall back" to "self-heal inside the helper (or pre-authenticate before keychain)."

---

## 11. Debug Mode

All shell scripts support `OP_DEBUG=1` for verbose logging. This is invaluable when a Pi user reports "SSH doesn't work" — ask them to enable it first.

```bash
export OP_DEBUG=1
# restart terminal or source .zshrc
```

The extension should probably expose a `/op-debug` command that toggles this env var in the session.

---

## 12. Service Account vs Interactive Auth

The setup supports three auth modes that Pi users should be aware of:

1. **Desktop App Integration** — biometrics, no password prompts (best UX)
2. **Session Token Caching** — `op signin` once, cached for ~24h (WSL fallback)
3. **Service Account** — `OP_SERVICE_ACCOUNT_TOKEN` env var (CI/automation)

Pi should document which mode is active. The extension's `/op-status` command shows this.

---

## 13. Obsolete / Wrong Lessons Learned (What NOT to Do)

These were identified as "bugs" during the review but turned out to be wrong diagnoses or wrong fixes. Documented here so future agents don't repeat them.

### ❌ Wrong: "Askpass should exit non-zero for graceful fallback"
**Why it was wrong:** The user explicitly said *"I never have to run opon. After I input my phrase it asks. I just want it the other way and not have to input the phrase at all."* They wanted **automatic** 1Password-driven passphrase retrieval — not a fallback to manual typing. Making the askpass exit non-zero would have left them at a raw SSH passphrase prompt, which is exactly the UX they hated.

**The right fix:** Self-healing (prompt for `op signin` inside the askpass script or, better, pre-authenticate in `setup_ssh_agent.sh` before `keychain` runs).

### ❌ Wrong: "The main bug is `SSH_ASKPASS_REQUIRE=prefer`"
**Why it was wrong:** `"prefer"` was a *symptom*, not the root cause. The root cause was the bootstrap order: `SSH_ASKPASS` was being configured unconditionally, before verifying that 1Password was authenticated. Whether `"prefer"` or `"force"`, the user would hit a bad prompt because the helper couldn't reach 1Password.

**The right fix:** Gate the export of `SSH_ASKPASS` on `op vault list` success; if 1Password is locked, prompt for `op signin` first; only then configure the helper.

### ❌ Wrong: "Unset `SSH_ASKPASS` after `keychain` to keep the environment clean"
**Why it was wrong:** This was in the ORIGINAL shell script, not our diagnosis. But it's worth noting that "cleanliness" is not the goal — "correctness" is. Unsetting the variables after `keychain` broke every subsequent manual `ssh-add` in the same shell session. The environment variable should persist so the helper is available for the entire session.

### ❌ Wrong: "Fix the TTY redirect in `.zshrc` by redirecting `op signin` stdout"
**Why it was wrong:** The real issue was that `op signin > "$TOKEN_FILE"` (with no stdin redirect) can swallow the password prompt when the shell or terminal doesn't allocate a proper TTY (VS Code, tmux detach/reattach, etc.). Redirecting stdout alone doesn't help.

**The right fix:** Also redirect stdin from `/dev/tty`: `op signin > "$TOKEN_FILE" </dev/tty`. And add a guard: if both `! -t 0` and `! -r /dev/tty`, skip the interactive prompt entirely rather than hanging.

---

## Quick Reference: File Changes in v0.3.5

| File | What changed |
|---|---|
| `setup_ssh_agent.sh` | Pre-authenticate 1Password **before** keychain; gate `SSH_ASKPASS` on `op vault list`; use `SSH_ASKPASS_REQUIRE=force`; never unset vars |
| `askpass-1password.sh` | `set -euo pipefail`; self-healing `_ensure_op_authenticated` (cached token → `/dev/tty` interactive signin) |
| `op-session-manager.sh` | TTY guard (`! -t 0 && ! -r /dev/tty`) + `</dev/tty` redirect to prevent prompt swallowing |
| `package.json` (both) | Version bumped `0.3.4 → 0.3.5`; fixed `pi-1password` dependency on `1password-cli-tools` |
| `docs/SETUP.md` | Documented "1Password master password first" flow on restart; added VS Code/tmux TTY troubleshooting |
| `README.md` | Updated SSH Agent feature description with self-healing behavior |
| `CHANGELOG.md` | Created with full release notes |
| `.gitignore` | Added `.pi/` + `*.tgz` exclusions |

---

*Last updated: 2025-04-25*
