/**
 * 1Password Extension for Pi
 *
 * Integrates 1Password CLI (op) with Pi for secure secret management.
 *
 * Features:
 * - Custom tool `op_get_secret` to retrieve secrets from 1Password
 * - Command `/op-status` - Check 1Password authentication
 * - Command `/op-env` - Load environment from .env.1pass file (project or user level)
 * - Command `/op-env-user` - Load user-level ~/.env.1pass
 * - Command `/op-config` - Open user config directory
 * - Command `/op-get` - Get a secret by reference
 * - Auto-load .env.1pass files: user level first, then project level (cascading)
 * - Status bar indicator for 1Password connection
 *
 * Environment Loading Order (cascading, later overrides earlier):
 *   1. User level: ~/.config/op-ssh/.env.1pass or ~/.pi/.env
 *   2. Project level: ./.env.1pass (or specified via --op-env)
 *   3. Supports both .env and .env.1pass formats
 *
 * Configuration:
 *   - Pi extension loads from ~/.pi/.env if it contains 1Password references
 *   - Set Pi setting `op.envFile` to specify custom env file
 *   - Set Pi setting `op.noUserEnv` to disable user-level loading
 *   - Set Pi setting `op.quiet` to hide status notifications
 *
 * Requires: 1Password CLI (op) to be installed and authenticated
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext, Theme, AutocompleteItem } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const execAsync = promisify(exec);

// Configuration paths
const HOME_DIR = homedir();
const USER_CONFIG_DIR = resolve(HOME_DIR, ".config/op-ssh");
const USER_ENV_FILE = resolve(USER_CONFIG_DIR, ".env.1pass");
const PROJECT_ENV_FILE = ".env.1pass";
const PI_ENV_FILE = resolve(HOME_DIR, ".pi/.env");

// Type definitions for tool results
interface OpSecretDetails {
  reference: string;
  found: boolean;
  error?: string;
}

interface OpEnvDetails {
  file: string;
  loaded: number;
  errors: number;
  skipped: number;
  source: "user" | "project" | "unknown";
}

// Track loaded env vars for cascading
interface EnvState {
  userLoaded: boolean;
  projectLoaded: boolean;
  vars: Record<string, { value: string; source: "user" | "project" }>;
}

// Helper to execute op commands
async function opExec(args: string): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execAsync(`op ${args}`);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// Check if op CLI is available and authenticated
async function checkOpAuth(): Promise<{ ok: boolean; account?: string; error?: string }> {
  try {
    const { stdout } = await opExec("account list --format json");
    const accounts = JSON.parse(stdout);
    if (accounts.length > 0) {
      return { ok: true, account: accounts[0].email };
    }
    return { ok: false, error: "No accounts found" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (error.includes("not currently signed in")) {
      return { ok: false, error: "Service Account required. Run: export OP_SERVICE_ACCOUNT_TOKEN=your-token && source ~/.zshrc" };
    }
    return { ok: false, error: error };
  }
}

// Get a secret by reference
async function getSecret(reference: string): Promise<{ value: string | null; error?: string }> {
  try {
    // Validate reference format
    const match = reference.match(/^op:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (!match) {
      return { value: null, error: "Invalid reference format. Expected: op://vault/item/field" };
    }
    
    const { stdout } = await opExec(`read ${JSON.stringify(reference)}`);
    return { value: stdout };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (error.includes("not found")) {
      return { value: null, error: `Secret not found: ${reference}` };
    }
    if (error.includes("not currently signed in")) {
      return { value: null, error: "Service Account required. Run: export OP_SERVICE_ACCOUNT_TOKEN=your-token && source ~/.zshrc" };
    }
    return { value: null, error: error };
  }
}

// Load environment from .env.1pass file
async function loadEnvFile(filePath: string, source: "user" | "project"): Promise<{
  env: Record<string, string>;
  loaded: number;
  errors: number;
  skipped: number;
}> {
  const result: Record<string, string> = {};
  let loaded = 0;
  let errors = 0;
  let skipped = 0;
  
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Parse export VAR="value" or VAR="value"
    const match = trimmed.match(/^export\s+(\w+)=["']?(.+?)["']?$/);
    if (!match) {
      // Try VAR=value format without export
      const simpleMatch = trimmed.match(/^(\w+)=["']?(.+?)["']?$/);
      if (!simpleMatch) {
        skipped++;
        continue;
      }
      const [, varName, value] = simpleMatch;
      
      // Check if it's a 1Password reference
      if (value.startsWith("op://")) {
        const secret = await getSecret(value);
        if (secret.value !== null) {
          result[varName] = secret.value;
          loaded++;
        } else {
          errors++;
        }
      } else {
        // Regular value, not a reference
        result[varName] = value;
        skipped++;
      }
      continue;
    }
    
    const [, varName, value] = match;
    
    // Check if it's a 1Password reference
    if (value.startsWith("op://")) {
      const secret = await getSecret(value);
      if (secret.value !== null) {
        result[varName] = secret.value;
        loaded++;
      } else {
        errors++;
      }
    } else {
      // Regular value, not a reference
      result[varName] = value;
      skipped++;
    }
  }
  
  return { env: result, loaded, errors, skipped };
}

// Ensure user config directory exists
function ensureUserConfig(): void {
  if (!existsSync(USER_CONFIG_DIR)) {
    mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }
}

// Create template user env file if it doesn't exist
function createUserTemplate(): void {
  ensureUserConfig();
  if (!existsSync(USER_ENV_FILE)) {
    const template = `# User-level 1Password environment file
# Loaded automatically on session start (before project .env.1pass)
# Place global secrets here that apply to all projects

# Example: Global API keys that don't change per project
# OPENAI_API_KEY="op://Private/API-Keys/openai"
# ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"

# Example: Personal GitHub token
# GITHUB_TOKEN="op://Personal/GitHub/token"

# SSH Key (used by askpass script)
SSH_KEY_PASSPHRASE="op://Employee/pegasus-ssh/password"
`;
    writeFileSync(USER_ENV_FILE, template, { mode: 0o600 });
  }
}

export default function (pi: ExtensionAPI) {
  // Track 1Password status for UI
  let opStatus: { ok: boolean; account?: string; error?: string } | null = null;
  
  // Track loaded environment state
  const envState: EnvState = {
    userLoaded: false,
    projectLoaded: false,
    vars: {},
  };

  // Register flag for auto-loading .env.1pass files
  pi.registerFlag("op-env", {
    description: "Auto-load specific .env.1pass file on startup",
    type: "string",
  });

  // Register flag to disable 1Password UI elements
  pi.registerFlag("op-quiet", {
    description: "Disable 1Password status bar indicator",
    type: "boolean",
    default: false,
  });

  // Register flag to skip user-level config
  pi.registerFlag("op-no-user", {
    description: "Skip loading user-level ~/.env.1pass",
    type: "boolean",
    default: false,
  });

  // ============================================================
  // Custom Tool: op_get_secret
  // ============================================================
  pi.registerTool({
    name: "op_get_secret",
    label: "1Password Get Secret",
    description: "Retrieve a secret value from 1Password using a secret reference (op://vault/item/field). Use this when you need API keys, tokens, or other sensitive values stored in 1Password.",
    parameters: Type.Object({
      reference: Type.String({
        description: "1Password secret reference in format: op://vault/item/field",
        examples: ["op://Private/API-Keys/openai", "op://Work/GitHub/token"],
      }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { value, error } = await getSecret(params.reference);
      
      if (value === null) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          details: { reference: params.reference, found: false, error } as OpSecretDetails,
          isError: true,
        };
      }
      
      // Return with masked value in content, full value only in details (not sent to LLM context unless needed)
      const masked = value.length > 8 
        ? `${value.slice(0, 4)}...${value.slice(-4)}`
        : "***";
      
      return {
        content: [{ type: "text", text: `Retrieved secret: ${masked} (${value.length} chars)` }],
        details: { reference: params.reference, found: true, _value: value } as OpSecretDetails & { _value: string },
      };
    },

    renderCall(args, theme, _context) {
      const ref = args.reference;
      // Extract just the item name from reference for display
      const parts = ref.match(/^op:\/\/[^\/]+\/([^\/]+)/);
      const display = parts ? parts[1] : ref;
      return new Text(
        theme.fg("toolTitle", theme.bold("1Password ")) +
        theme.fg("accent", "get ") +
        theme.fg("muted", display),
        0,
        0
      );
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as (OpSecretDetails & { _value?: string }) | undefined;
      
      if (!details) {
        return new Text(theme.fg("error", "Error: No result details"), 0, 0);
      }
      
      if (details.error) {
        return new Text(theme.fg("error", `1Password Error: ${details.error}`), 0, 0);
      }
      
      if (!details.found) {
        return new Text(theme.fg("dim", "Not found"), 0, 0);
      }
      
      const ref = details.reference;
      const parts = ref.match(/^op:\/\/([^\/]+)\/([^\/]+)/);
      const vault = parts ? parts[1] : "?";
      const item = parts ? parts[2] : ref;
      
      if (expanded && details._value) {
        return new Text(
          theme.fg("success", "✓ ") +
          theme.fg("muted", `Retrieved from ${vault}/${item}: `) +
          theme.fg("dim", `${details._value.slice(0, 20)}...`),
          0,
          0
        );
      }
      
      return new Text(
        theme.fg("success", "✓ ") +
        theme.fg("muted", `Retrieved from ${vault}/${item}`),
        0,
        0
      );
    },
  });

  // ============================================================
  // Custom Tool: op_load_env
  // ============================================================
  pi.registerTool({
    name: "op_load_env",
    label: "1Password Load Environment",
    description: "Load environment variables from a .env.1pass file. References (op://...) are resolved from 1Password. By default loads project-level file, use level='user' for user-level config.",
    parameters: Type.Object({
      file: Type.Optional(Type.String({
        description: "Path to .env.1pass file (optional, defaults to .env.1pass)",
        default: ".env.1pass",
      })),
      level: Type.Optional(Type.String({
        description: "Which level to load: 'user' for ~/.config/op-ssh/.env.1pass or 'project' for ./.env.1pass",
        enum: ["user", "project"],
        default: "project",
      })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const level = params.level || "project";
      let filePath: string;
      
      if (params.file) {
        filePath = resolve(ctx.cwd, params.file);
      } else {
        filePath = level === "user" ? USER_ENV_FILE : resolve(ctx.cwd, PROJECT_ENV_FILE);
      }
      
      if (!existsSync(filePath)) {
        return {
          content: [{ type: "text", text: `File not found: ${filePath}` }],
          details: { file: filePath, loaded: 0, errors: 1, skipped: 0, source: level } as OpEnvDetails,
          isError: true,
        };
      }
      
      try {
        const { env, loaded, errors, skipped } = await loadEnvFile(filePath, level);
        
        // Export to environment (project overrides user)
        for (const [key, value] of Object.entries(env)) {
          process.env[key] = value;
          envState.vars[key] = { value, source: level };
        }
        
        if (level === "user") {
          envState.userLoaded = true;
        } else {
          envState.projectLoaded = true;
        }
        
        const total = loaded + errors + skipped;
        const msg = `Loaded ${loaded}/${total} secrets from ${level} level` + 
                    (errors > 0 ? `, ${errors} errors` : "") +
                    (skipped > 0 ? ` (${skipped} regular vars)` : "");
        
        return {
          content: [{ type: "text", text: msg }],
          details: { file: filePath, loaded, errors, skipped, source: level } as OpEnvDetails,
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error loading env: ${error}` }],
          details: { file: filePath, loaded: 0, errors: 1, skipped: 0, source: level, error } as OpEnvDetails,
          isError: true,
        };
      }
    },

    renderCall(args, theme, _context) {
      const level = args.level || "project";
      const icon = level === "user" ? "~" : ".";
      return new Text(
        theme.fg("toolTitle", theme.bold("1Password ")) +
        theme.fg("accent", "load-env ") +
        theme.fg("dim", `${icon}/.env.1pass`),
        0,
        0
      );
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as OpEnvDetails | undefined;
      if (!details) {
        return new Text(theme.fg("error", "No result"), 0, 0);
      }
      
      const levelIcon = details.source === "user" ? "~" : ".";
      
      if (details.errors > 0) {
        return new Text(
          theme.fg("warning", "⚠ ") +
          theme.fg("muted", `Loaded ${details.loaded}, ${details.errors} errors [${levelIcon}]`),
          0,
          0
        );
      }
      
      return new Text(
        theme.fg("success", "✓ ") +
        theme.fg("muted", `Loaded ${details.loaded} secrets [${levelIcon}]`),
        0,
        0
      );
    },
  });

  // ============================================================
  // Command: /op-status - Check 1Password status
  // ============================================================
  pi.registerCommand("op-status", {
    description: "Check 1Password CLI authentication status",
    handler: async (_args, ctx) => {
      const status = await checkOpAuth();
      
      // Show file status
      const hasUserEnv = existsSync(USER_ENV_FILE);
      const hasProjectEnv = existsSync(resolve(ctx.cwd, PROJECT_ENV_FILE));
      
      let msg = status.ok 
        ? `1Password: Connected (${status.account})`
        : `1Password: ${status.error}`;
      
      msg += `\nUser config: ${hasUserEnv ? USER_ENV_FILE : "not found"}`;
      msg += `\nProject config: ${hasProjectEnv ? PROJECT_ENV_FILE : "not found"}`;
      msg += `\nLoaded: ${Object.keys(envState.vars).length} vars`;
      
      // Show which vars came from where
      const userVars = Object.entries(envState.vars).filter(([, v]) => v.source === "user").map(([k]) => k);
      const projectVars = Object.entries(envState.vars).filter(([, v]) => v.source === "project").map(([k]) => k);
      if (userVars.length) msg += `\n  From user: ${userVars.join(", ")}`;
      if (projectVars.length) msg += `\n  From project: ${projectVars.join(", ")}`;
      
      ctx.ui.notify(msg, status.ok ? "success" : "error");
      
      // Update cached status
      opStatus = status;
      updateStatusBar(ctx);
    },
  });

  // ============================================================
  // Command: /op-get - Get a secret by reference
  // ============================================================
  pi.registerCommand("op-get", {
    description: "Get a secret from 1Password by reference (op://vault/item/field)",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /op-get op://vault/item/field", "error");
        return;
      }
      
      const { value, error } = await getSecret(args);
      
      if (value === null) {
        ctx.ui.notify(`Error: ${error}`, "error");
      } else {
        const masked = value.length > 8 
          ? `${value.slice(0, 4)}...${value.slice(-4)}`
          : "***";
        ctx.ui.notify(`Secret: ${masked} (${value.length} chars) - copied to env 'OP_LAST_SECRET'`, "success");
        // Store in env for scripts
        process.env.OP_LAST_SECRET = value;
      }
    },
  });

  // ============================================================
  // Command: /op-env - Load environment (project level by default)
  // ============================================================
  pi.registerCommand("op-env", {
    description: "Load project environment from .env.1pass file",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const files = [".env.1pass", ".env.local.1pass", ".env.production.1pass"]
        .filter(f => f.startsWith(prefix))
        .map(f => ({ value: f, label: f }));
      return files.length > 0 ? files : null;
    },
    handler: async (args, ctx) => {
      const file = args || PROJECT_ENV_FILE;
      const filePath = resolve(ctx.cwd, file);
      
      if (!existsSync(filePath)) {
        ctx.ui.notify(`Project file not found: ${file}`, "error");
        return;
      }
      
      try {
        const { env, loaded, errors, skipped } = await loadEnvFile(filePath, "project");
        
        // Export to environment
        for (const [key, value] of Object.entries(env)) {
          process.env[key] = value;
          envState.vars[key] = { value, source: "project" };
        }
        envState.projectLoaded = true;
        
        const msg = `Project: Loaded ${loaded} secrets` + 
                    (errors > 0 ? `, ${errors} errors` : "") +
                    (skipped > 0 ? ` (${skipped} regular)` : "") +
                    ` from ${file}`;
        
        if (errors > 0) {
          ctx.ui.notify(msg, "warning");
        } else {
          ctx.ui.notify(msg, "success");
        }
      } catch (e) {
        ctx.ui.notify(`Error: ${e}`, "error");
      }
    },
  });

  // ============================================================
  // Command: /op-env-user - Load user-level environment
  // ============================================================
  pi.registerCommand("op-env-user", {
    description: "Load user environment from ~/.config/op-ssh/.env.1pass",
    handler: async (_args, ctx) => {
      ensureUserConfig();
      
      if (!existsSync(USER_ENV_FILE)) {
        createUserTemplate();
        ctx.ui.notify(`Created user template: ${USER_ENV_FILE}\nEdit it and run /op-env-user again`, "info");
        return;
      }
      
      try {
        const { env, loaded, errors, skipped } = await loadEnvFile(USER_ENV_FILE, "user");
        
        // Export to environment
        for (const [key, value] of Object.entries(env)) {
          // Don't override if already set by project (project wins)
          if (!envState.vars[key] || envState.vars[key].source === "user") {
            process.env[key] = value;
            envState.vars[key] = { value, source: "user" };
          }
        }
        envState.userLoaded = true;
        
        const msg = `User: Loaded ${loaded} secrets` + 
                    (errors > 0 ? `, ${errors} errors` : "") +
                    (skipped > 0 ? ` (${skipped} regular)` : "") +
                    ` from ~/.config/op-ssh/.env.1pass`;
        
        if (errors > 0) {
          ctx.ui.notify(msg, "warning");
        } else {
          ctx.ui.notify(msg, "success");
        }
      } catch (e) {
        ctx.ui.notify(`Error: ${e}`, "error");
      }
    },
  });

  // ============================================================
  // Command: /op-config - Open config directory
  // ============================================================
  pi.registerCommand("op-config", {
    description: "Open the 1Password config directory",
    handler: async (_args, ctx) => {
      ensureUserConfig();
      createUserTemplate();
      ctx.ui.notify(`Config directory: ${USER_CONFIG_DIR}`, "info");
      
      // Show file contents if exists
      if (existsSync(USER_ENV_FILE)) {
        const content = readFileSync(USER_ENV_FILE, "utf8");
        const lines = content.split("\n").slice(0, 10);
        ctx.ui.notify(`User env file (first 10 lines):\n${lines.join("\n")}`, "info");
      }
    },
  });

  // ============================================================
  // Command: /op-list - List configured references
  // ============================================================
  pi.registerCommand("op-list", {
    description: "List current environment variables loaded from 1Password",
    handler: async (_args, ctx) => {
      const vars = Object.entries(envState.vars);
      if (vars.length === 0) {
        ctx.ui.notify("No environment variables loaded from 1Password yet.\nUse /op-env or /op-env-user", "info");
        return;
      }
      
      let msg = `Loaded ${vars.length} variables:\n`;
      for (const [name, { source }] of vars) {
        const masked = process.env[name] 
          ? `${process.env[name]!.slice(0, 4)}...${process.env[name]!.slice(-4)}`
          : "???";
        const icon = source === "user" ? "~" : ".";
        msg += `  [${icon}] ${name}=${masked}\n`;
      }
      ctx.ui.notify(msg.trim(), "info");
    },
  });

  // ============================================================
  // Command: /op-create-env - Create project-level .env file
  // ============================================================
  pi.registerCommand("op-create-env", {
    description: "Create a project-level .env.1pass file with template",
    handler: async (args, ctx) => {
      const fileName = args || ".env.1pass";
      const filePath = resolve(ctx.cwd, fileName);
      
      if (existsSync(filePath)) {
        ctx.ui.notify(`File already exists: ${filePath}`, "warning");
        ctx.ui.notify("Edit manually or use /op-add-item to add secrets", "info");
        return;
      }
      
      const template = `# Project-level 1Password Environment
# Name: ${fileName}
# Location: ${filePath}
#
# These variables override user-level environment from ~/.config/op-ssh/.env.1pass
# Format: KEY=op://vault/item/field  OR  KEY=plain-value

# 1Password Secret References (op:// vault/item/field)
GITHUB_TOKEN="op://Personal/GitHub/token"
OPENAI_API_KEY="op://Private/API-Keys/openai"
ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"

# Database connections
# DATABASE_URL="op://Work/Database/prod"

# Cloud providers
# AWS_ACCESS_KEY_ID="op://Private/AWS/access-key-id"
# AWS_SECRET_ACCESS_KEY="op://Private/AWS/secret-access-key"

# Custom project secrets
# PROJECT_API_KEY="op://Work/ProjectX/api-key"
`;
      
      writeFileSync(filePath, template, { mode: 0o600 });
      ctx.ui.notify(`Created project environment: ${filePath}`, "success");
      ctx.ui.notify("Edit the file and add your 1Password secret references", "info");
    },
  });

  // ============================================================
  // Command: /op-add-item - Add a 1Password item reference
  // ============================================================
  pi.registerCommand("op-add-item", {
    description: "Add a 1Password secret reference to project or global env",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      // Get items from 1Password instead of hardcoded list
      try {
        const { stdout } = execSync("op item list --format json", { encoding: "utf8", maxBuffer: 1024 * 1024 });
        const items = JSON.parse(stdout);
        
        return items.filter((item: any) => {
          const name = (item.name || "").toLowerCase();
          const vault = (item.vault || "").toLowerCase();
          return name.includes(prefix.toLowerCase()) || vault.includes(prefix.toLowerCase());
        }).slice(0, 20).map((item: any) => ({
          value: item.name,
          label: `${item.name} (${item.vault})`
        }));
      } catch {
        // Fallback to common items if op item list fails
        const commonItems = [
          "GITHUB_TOKEN",
          "OPENAI_API_KEY",
          "ANTHROPIC_API_KEY",
          "GOOGLE_GENERATIVE_AI_API_KEY",
          "HUGGINGFACE_API_TOKEN"
        ];
        return commonItems.filter(item => item.toLowerCase().includes(prefix.toLowerCase()))
          .map(item => ({ value: item, label: item }));
      }
    },
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /op-add-item VAR_NAME op://vault/item/field [--global]", "error");
        ctx.ui.notify("Example: /op-add-item OPENAI_API_KEY op://Private/API-Keys/openai --global", "info");
        return;
      }
      
      // Parse arguments and flags
      const parts = args.trim().split(/\s+/);
      let flat = parts.filter(p => !p.startsWith("--"));
      let flags = parts.filter(p => p.startsWith("--"));
      
      let varName = flat[0].toUpperCase();
      
      while (varName.length > 0 && /[^A-Z0-9_]/.test(varName[varName.length - 1])) {
        varName = varName.slice(0, -1);
      }
      
      let reference = flat.slice(1).join(" ").replace(/["']/g, "");
      
      if (!reference) {
        ctx.ui.notify(`No reference provided for ${varName}`, "warning");
        ctx.ui.notify("Format: op://vault/item/field", "info");
        ctx.ui.notify("Examples:", "info");
        ctx.ui.notify("  op://Private/API-Keys/openai", "info");
        ctx.ui.notify("  op://Personal/GitHub/token", "info");
        ctx.ui.notify("  op://Work/Database/prod", "info");
        return;
      }
      
      if (!reference.startsWith("op://")) {
        ctx.ui.notify(`Invalid reference format: ${reference}. Must start with 'op://'`, "error");
        return;
      }
      
      // Determine target file based on --global flag
      const isGlobal = flags.includes("--global");
      let filePath: string;
      let envType: string;
      
      if (isGlobal) {
        filePath = USER_ENV_FILE;
        envType = "global";
      } else {
        filePath = resolve(ctx.cwd, ".env.1pass");
        envType = "project";
      }
      
      // Ensure file exists
      if (!existsSync(filePath)) {
        if (envType === "project") {
          ctx.ui.notify(`Project env file not found: ${filePath}`, "warning");
          ctx.ui.notify("Create it with: /op-create-env .env.1pass", "info");
          return;
        }
        // Create global env file if it doesn't exist
        const template = `# Global 1Password Environment
# Located at: ${filePath}
# These variables are loaded automatically on Pi session start
# Format: VAR="op://vault/item/field"

# API Keys
# OPENAI_API_KEY="op://Private/API-Keys/openai"
# ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"
# GOOGLE_GENERATIVE_AI_API_KEY="op://Private/API-Keys/google-ai"
`;
        writeFileSync(USER_CONFIG_DIR, { mode: 0o600 });
      }
      
      // Read existing lines
      let envLines = existsSync(filePath) 
        ? readFileSync(filePath, "utf8").split("\n") 
        : [];
      
      // Remove existing entry if present (smart update)
      const oldLine = envLines.find(line => {
        const match = line.match(/^(?:export\s+)?\w+/);
        if (match) {
          const key = match[0].replace(/^(?:export\s+)?/, "");
          return key === varName;
        }
        return false;
      });
      
      envLines = envLines.filter(line => {
        const match = line.match(/^(?:export\s+)?\w+/);
        if (match) {
          const key = match[0].replace(/^(?:export\s+)?/, "");
          return key !== varName;
        }
        return true;
      });
      
      // Add new line
      envLines.push(`${varName}="${reference}"`);
      writeFileSync(filePath, envLines.join("\n") + "\n", { mode: 0o600 });
      
      if (oldLine) {
        ctx.ui.notify(`Updated ${varName} in ${envType} env`, "success");
      } else {
        ctx.ui.notify(`Added ${varName} to ${envType} env`, "success");
      }
      ctx.ui.notify(`Reference: ${reference}`, "info");
      
      if (isGlobal) {
        ctx.ui.notify("Run /op-env-user to reload", "info");
      } else {
        ctx.ui.notify("Run /op-env to reload", "info");
      }
    },
  });

  // ============================================================
  // Command: /op-add-global-item - Add a 1Password item to global env
  // ============================================================
  pi.registerCommand("op-add-global-item", {
    description: "Add a 1Password secret reference to the global user env",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      // Get items from 1Password instead of hardcoded list
      try {
        const { stdout } = execSync("op item list --format json", { encoding: "utf8", maxBuffer: 1024 * 1024 });
        const items = JSON.parse(stdout);
        
        return items.filter((item: any) => {
          const name = (item.name || "").toLowerCase();
          const vault = (item.vault || "").toLowerCase();
          return name.includes(prefix.toLowerCase()) || vault.includes(prefix.toLowerCase());
        }).slice(0, 20).map((item: any) => ({
          value: item.name,
          label: `${item.name} (${item.vault})`
        }));
      } catch {
        // Fallback to common items if op item list fails
        const commonItems = [
          "GITHUB_TOKEN",
          "OPENAI_API_KEY",
          "ANTHROPIC_API_KEY",
          "GOOGLE_GENERATIVE_AI_API_KEY",
          "HUGGINGFACE_API_TOKEN"
        ];
        return commonItems.filter(item => item.toLowerCase().includes(prefix.toLowerCase()))
          .map(item => ({ value: item, label: item }));
      }
    },
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /op-add-global-item VAR_NAME op://vault/item/field", "error");
        ctx.ui.notify("Example: /op-add-global-item OPENAI_API_KEY op://Private/API-Keys/openai", "info");
        return;
      }
      
      const parts = args.trim().split(/\s+/);
      let varName = parts[0].toUpperCase();
      
      while (varName.length > 0 && /[^A-Z0-9_]/.test(varName[varName.length - 1])) {
        varName = varName.slice(0, -1);
      }
      
      let reference = parts.slice(1).join(" ").replace(/["']/g, "");
      
      if (!reference) {
        ctx.ui.notify(`No reference provided for ${varName}`, "warning");
        ctx.ui.notify("Format: op://vault/item/field", "info");
        ctx.ui.notify("Examples:", "info");
        ctx.ui.notify("  op://Private/API-Keys/openai", "info");
        ctx.ui.notify("  op://Personal/GitHub/token", "info");
        ctx.ui.notify("  op://Work/Database/prod", "info");
        return;
      }
      
      if (!reference.startsWith("op://")) {
        ctx.ui.notify(`Invalid reference format: ${reference}. Must start with 'op://'`, "error");
        return;
      }
      
      // Ensure global env file exists
      if (!existsSync(USER_ENV_FILE)) {
        const template = `# Global 1Password Environment
# Located at: ${USER_ENV_FILE}
# These variables are loaded automatically on Pi session start
# Format: VAR="op://vault/item/field"

# API Keys
# OPENAI_API_KEY="op://Private/API-Keys/openai"
# ANTHROPIC_API_KEY="op://Private/API-Keys/anthropic"
# GOOGLE_GENERATIVE_AI_API_KEY="op://Private/API-Keys/google-ai"
`;
        writeFileSync(USER_ENV_FILE, template, { mode: 0o600 });
        ctx.ui.notify(`Created global env file: ${USER_ENV_FILE}`, "info");
      }
      
      // Read existing lines
      let envLines = readFileSync(USER_ENV_FILE, "utf8").split("\n");
      
      // Remove existing entry if present (smart update)
      const oldLine = envLines.find(line => {
        const match = line.match(/^(?:export\s+)?\w+/);
        if (match) {
          const key = match[0].replace(/^(?:export\s+)?/, "");
          return key === varName;
        }
        return false;
      });
      
      envLines = envLines.filter(line => {
        const match = line.match(/^(?:export\s+)?\w+/);
        if (match) {
          const key = match[0].replace(/^(?:export\s+)?/, "");
          return key !== varName;
        }
        return true;
      });
      
      // Add new line
      envLines.push(`${varName}="${reference}"`);
      writeFileSync(USER_ENV_FILE, envLines.join("\n") + "\n", { mode: 0o600 });
      
      if (oldLine) {
        ctx.ui.notify(`Updated ${varName} in global env`, "success");
      } else {
        ctx.ui.notify(`Added ${varName} to global env`, "success");
      }
      ctx.ui.notify(`Reference: ${reference}`, "info");
      ctx.ui.notify("Run /op-env-user to reload", "info");
    },
  });

  // ============================================================
  // Event Handlers
  // ============================================================

  // Update status bar helper
  const updateStatusBar = (ctx: ExtensionContext) => {
    if (pi.getFlag("op-quiet") || !ctx.hasUI) return;
    
    if (opStatus?.ok) {
      const loadedCount = Object.keys(envState.vars).length;
      const status = loadedCount > 0 ? `1P:${loadedCount}` : "1P";
      ctx.ui.setStatus("1password", ctx.ui.theme.fg("accent", status));
    } else {
      ctx.ui.setStatus("1password", ctx.ui.theme.fg("dim", "1P ✗"));
    }
  };

  // On session start - check auth and load env files (user first, then project)
  pi.on("session_start", async (_event, ctx) => {
    // Check 1Password status
    opStatus = await checkOpAuth();
    
    // Ensure config exists
    ensureUserConfig();
    createUserTemplate();
    
    const skipUser = pi.getFlag("op-no-user") as boolean;
    const explicitEnvFile = pi.getFlag("op-env") as string | undefined;
    
    // Step 0: Try to load from Pi .env if it exists (can be 1Password refs or plain)
    if (existsSync(PI_ENV_FILE)) {
      try {
        const { env: piEnv, loaded: piLoaded } = await loadEnvFile(PI_ENV_FILE, "user");
        if (piLoaded > 0) {
          for (const [key, value] of Object.entries(piEnv)) {
            process.env[key] = value;
            envState.vars[key] = { value, source: "user" };
          }
        }
      } catch {
        // Silent fail for Pi .env
      }
    }
    
    // Step 1: Load user-level env (unless --op-no-user)
    if (!skipUser && existsSync(USER_ENV_FILE)) {
      try {
        const { env, loaded, errors } = await loadEnvFile(USER_ENV_FILE, "user");
        for (const [key, value] of Object.entries(env)) {
          process.env[key] = value;
          envState.vars[key] = { value, source: "user" };
        }
        envState.userLoaded = true;
        if (loaded > 0 && !pi.getFlag("op-quiet")) {
          ctx.ui.notify(`User secrets: ${loaded} loaded`, "info");
        }
      } catch {
        // Ignore errors on auto-load
      }
    }
    
    // Step 2: Load project-level env (from --op-env or default .env.1pass)
    const projectEnvPath = explicitEnvFile 
      ? resolve(ctx.cwd, explicitEnvFile)
      : resolve(ctx.cwd, PROJECT_ENV_FILE);
      
    if (existsSync(projectEnvPath)) {
      try {
        const { env, loaded, errors } = await loadEnvFile(projectEnvPath, "project");
        // Project vars override user vars
        for (const [key, value] of Object.entries(env)) {
          process.env[key] = value;
          envState.vars[key] = { value, source: "project" };
        }
        envState.projectLoaded = true;
        if (loaded > 0 && !pi.getFlag("op-quiet")) {
          const source = explicitEnvFile || ".env.1pass";
          ctx.ui.notify(`Project secrets: ${loaded} loaded (${source})`, "info");
        }
      } catch {
        // Ignore errors on auto-load
      }
    }
    
    updateStatusBar(ctx);
  });

  // Clear status on shutdown
  pi.on("session_shutdown", async (_event) => {
    opStatus = null;
    envState.vars = {};
    envState.userLoaded = false;
    envState.projectLoaded = false;
  });
}
