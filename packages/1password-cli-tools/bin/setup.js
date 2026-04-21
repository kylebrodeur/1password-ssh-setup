#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SSH_DIR, ENV_FILE } from '../lib/constants.js';
import { checkPrereqs, setupDirs, installFiles } from '../lib/system.js';
import { updateShellRc, checkSshAgentPlugin } from '../lib/config.js';
import { KNOWN_PROVIDERS } from '../lib/providers/index.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const program = new Command();
program
  .name('1password-cli-setup')
  .description('Interactive setup for 1Password CLI Tools and SSH Agent Integration')
  .version(pkg.version)
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

  await checkSshAgentPlugin();

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
      options: KNOWN_PROVIDERS.map(prov => ({ value: prov.id, label: prov.label })),
      required: false,
    });

    if (p.isCancel(keys)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    for (const key of keys) {
      if (key === 'CUSTOM') {
        let addingCustom = true;
        while (addingCustom) {
          const customKey = await p.text({
            message: 'Enter Custom Variable Name (e.g., MY_API_KEY) or leave blank to finish:',
            placeholder: '',
          });
          if (p.isCancel(customKey) || !customKey?.trim()) {
            addingCustom = false;
            break;
          }
          const customRef = await p.text({
            message: `Paste the secret reference for ${customKey?.trim() || ''}:`,
            placeholder: `op://Private/Custom/credential`,
          });
          if (p.isCancel(customRef)) {
            p.cancel('Operation cancelled.');
            process.exit(0);
          }
          const cleanRef = customRef?.trim().replace(/^["']|["']$/g, '') || '';
          envContent += `${customKey?.trim() || ''}="${cleanRef}"\n`;
        }
        continue;
      }

      const provider = KNOWN_PROVIDERS.find(prov => prov.id === key);
      const ref = await p.text({
        message: `Paste the secret reference for ${provider.label}:`,
        placeholder: provider.placeholder,
      });

      if (p.isCancel(ref)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
      
      // Strip quotes
      const cleanRef = ref?.trim().replace(/^["']|["']$/g, '') || '';

      envContent += `${key}="${cleanRef}"\n`;

      if (provider.onSetup) {
        await provider.onSetup();
      }
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
