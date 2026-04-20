import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { SSH_DIR, BIN_DIR, CONFIG_DIR, SRC_DIR } from './constants.js';

export function checkPrereqs() {
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
    p.log.message('Linux: sudo apt-get install keychain\\nmacOS: brew install keychain');
  }
}

export function setupDirs() {
  const dirs = [SSH_DIR, BIN_DIR, CONFIG_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  fs.chmodSync(CONFIG_DIR, 0o700);
}

export function installFiles() {
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
