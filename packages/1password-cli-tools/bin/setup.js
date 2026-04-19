#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SSH_DIR, ENV_FILE } from '../lib/constants.js';
import { checkPrereqs, setupDirs, installFiles } from '../lib/system.js';
import { updateNpmrc, updateShellRc } from '../lib/config.js';

const program = new Command();
program
  .name('1password-cli-setup')
  .description('Interactive setup for 1Password CLI Tools and SSH Agent Integration')
  .version('0.3.0')
  .parse(process.argv);

async function main() {
  p.intro(pc.bgBlue(pc.white(' 1Password CLI & SSH Setup Wizard ')));
  
  if (os.platform() === 'win32') {
    p.log.warn(pc.yellow('Warning: Native Windows is not officially supported.'));
    p.log.message('This setup is designed for Linux, macOS, and WSL2 environments.');
    
    const proceed = await p.confirm({
      message: 'Do you want to proceed anyway?',
      initialValue: false,
    });
    
    if (!proceed || p.isCancel(proceed)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

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
    
    // Strip quotes added by 1Password Desktop copy
    sshRef = sshRef.trim().replace(/^["']|["']$/g, '');

    const askpassPath = path.join(SSH_DIR, 'askpass-1password.sh');
    if (fs.existsSync(askpassPath)) {
      let content = fs.readFileSync(askpassPath, 'utf8');
      content = content.replace(/OP_SECRET_REFERENCE=".*"/, `OP_SECRET_REFERENCE="${sshRef}"`);
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

  let envContent = `# User-level 1Password Environment Variables
# Located at: ~/.config/op-ssh/.env.1pass

# SSH Keys
SSH_KEY_PASSPHRASE="${sshRef}"

`;

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
        message: `Paste the secret reference for ${key}:`,
        placeholder: `op://Private/API-Keys/${key.toLowerCase().replace('_api_key', '')}`,
      });

      if (p.isCancel(ref)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
      
      // Strip quotes
      const cleanRef = ref.trim().replace(/^["']|["']$/g, '');

      envContent += `${key}="${cleanRef}"\n`;
    }

    if (keys.includes('NODE_AUTH_TOKEN')) {
      const npmrcLine = '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}';
      await updateNpmrc(npmrcLine);
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
    updateShellRc(enableSSH);
  }

  p.outro(pc.bgGreen(pc.white(' Setup Complete! Please reload your terminal or run: source ~/.zshrc ')));
}

main().catch(console.error);
