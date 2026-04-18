#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const program = new Command();
program
  .name('1password-cli-setup')
  .description('Interactive setup for 1Password CLI Tools and SSH Agent Integration')
  .version('0.3.0')
  .parse(process.argv);

const HOME_DIR = os.homedir();
const SSH_DIR = path.join(HOME_DIR, '.ssh');
const BIN_DIR = path.join(HOME_DIR, '.local', 'bin');
const CONFIG_DIR = path.join(HOME_DIR, '.config', 'op-ssh');
const ENV_FILE = path.join(CONFIG_DIR, '.env.1pass');

function checkPrereqs() {
  try {
    execSync('op --version', { stdio: 'ignore' });
  } catch (e) {
    p.log.warn(pc.yellow('1Password CLI (op) is not installed or not in PATH.'));
    p.log.message('Please install it from: https://1password.com/downloads/command-line/');
  }

  try {
    execSync('keychain --version', { stdio: 'ignore' });
  } catch (e) {
    p.log.warn(pc.yellow('keychain is not installed. SSH Agent integration may not work.'));
    p.log.message('Linux: sudo apt-get install keychain\nmacOS: brew install keychain');
  }
}

function setupDirs() {
  const dirs = [SSH_DIR, BIN_DIR, CONFIG_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  fs.chmodSync(CONFIG_DIR, 0o700);
}

function installFiles() {
  const files = [
    { src: 'askpass-1password.sh', dest: path.join(SSH_DIR, 'askpass-1password.sh'), mode: 0o755 },
    { src: 'setup_ssh_agent.sh', dest: path.join(SSH_DIR, 'setup_ssh_agent.sh'), mode: 0o755 },
    { src: 'op-reference', dest: path.join(BIN_DIR, 'op-reference'), mode: 0o755 },
    { src: 'op-session-manager.sh', dest: path.join(CONFIG_DIR, 'op-session-manager.sh'), mode: 0o755 },
    { src: 'op-ai-helper.sh', dest: path.join(CONFIG_DIR, 'op-ai-helper.sh'), mode: 0o755 },
  ];

  for (const file of files) {
    const srcPath = path.join(SRC_DIR, file.src);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, file.dest);
      fs.chmodSync(file.dest, file.mode);
    }
  }
}

async function main() {
  p.intro(pc.bgBlue(pc.white(' 1Password CLI & SSH Setup Wizard ')));

  checkPrereqs();
  setupDirs();
  installFiles();

  const enableSSH = await p.confirm({
    message: 'Do you want to enable 1Password SSH Agent integration?',
    initialValue: true,
  });

  if (p.isCancel(enableSSH)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  let sshRef = 'op://Private/my-ssh-key/password';
  if (enableSSH) {
    sshRef = await p.text({
      message: 'Paste the 1Password secret reference for your SSH key passphrase:',
      placeholder: 'op://Private/my-ssh-key/password',
      defaultValue: 'op://Private/my-ssh-key/password',
    });

    if (p.isCancel(sshRef)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const askpassPath = path.join(SSH_DIR, 'askpass-1password.sh');
    if (fs.existsSync(askpassPath)) {
      let content = fs.readFileSync(askpassPath, 'utf8');
      content = content.replace(/OP_SECRET_REFERENCE=".*"/, \`OP_SECRET_REFERENCE="\${sshRef}"\`);
      fs.writeFileSync(askpassPath, content);
    }
  }

  const configureEnv = await p.confirm({
    message: 'Do you want to configure global API keys (e.g., OpenAI, NPM) in ~/.config/op-ssh/.env.1pass?',
    initialValue: true,
  });

  if (p.isCancel(configureEnv)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  let envContent = \`# User-level 1Password Environment Variables
# Located at: ~/.config/op-ssh/.env.1pass

# SSH Keys
SSH_KEY_PASSPHRASE="\${sshRef}"

\`;

  if (configureEnv) {
    const keys = await p.multiselect({
      message: 'Which API keys do you want to configure?',
      options: [
        { value: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
        { value: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
        { value: 'GITHUB_TOKEN', label: 'GitHub Token' },
        { value: 'NODE_AUTH_TOKEN', label: 'NPM Automation Token' },
      ],
      required: false,
    });

    if (p.isCancel(keys)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    for (const key of keys) {
      const ref = await p.text({
        message: \`Paste the secret reference for \${key}:\`,
        placeholder: \`op://Private/API-Keys/\${key.toLowerCase().replace('_api_key', '')}\`,
      });

      if (p.isCancel(ref)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      envContent += \`\${key}="\${ref}"\\n\`;
    }
  }

  fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600 });
  p.log.success('Created ' + ENV_FILE);

  const enableHelpers = await p.confirm({
    message: 'Do you want to add 1Password CLI helpers (opon, opoff, etc.) and session caching to your shell config?',
    initialValue: true,
  });

  if (p.isCancel(enableHelpers)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  if (enableHelpers) {
    const shellRcPath = fs.existsSync(path.join(HOME_DIR, '.zshrc'))
      ? path.join(HOME_DIR, '.zshrc')
      : path.join(HOME_DIR, '.bashrc');

    let rcContent = \`\\n# --- 1Password Session Manager ---\\n\`;
    rcContent += \`if [[ -f "\${CONFIG_DIR}/op-session-manager.sh" ]]; then\\n\`;
    rcContent += \`  source "\${CONFIG_DIR}/op-session-manager.sh"\\n\`;
    rcContent += \`fi\\n\`;
    
    rcContent += \`\\n# --- 1PASSWORD CLI HELPERS ---\\n\`;
    rcContent += \`opon() {
  if ! op vault list >/dev/null 2>&1; then
    if [[ -f ~/.config/op-ssh/op-session-manager.sh ]]; then
      source ~/.config/op-ssh/op-session-manager.sh
    else
      eval "$(op signin)"
    fi
  fi
}

opoff() {
  op signout
  rm -f ~/.config/op-ssh/.op_session_token
}

getpwd() {
  opon
  op item get "$1" --fields label=password
}

getmfa() {
  opon
  op item get "$1" --otp
}\\n\`;

    if (enableSSH) {
      rcContent += \`\\n# --- 1Password SSH Setup ---\\n\`;
      rcContent += \`export PATH="\${BIN_DIR}:\\$PATH"\\n\`;
      rcContent += \`_ssh_setup_script="\${HOME}/.ssh/setup_ssh_agent.sh"\\n\`;
      rcContent += \`if [[ -f "\\$_ssh_setup_script" ]]; then\\n\`;
      rcContent += \`  source "\\$_ssh_setup_script"\\n\`;
      rcContent += \`fi\\n\`;
    }

    fs.appendFileSync(shellRcPath, rcContent);
    p.log.success(\`Added shell configuration to \${shellRcPath}\`);
  }

  p.outro(pc.bgGreen(pc.white(' Setup Complete! Please reload your terminal or run: source ~/.zshrc ')));
}

main().catch(console.error);