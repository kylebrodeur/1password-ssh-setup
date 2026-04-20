import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { HOME_DIR, CONFIG_DIR, BIN_DIR } from './constants.js';

export function updateShellRc(enableSSH) {
  const shellRcPath = fs.existsSync(path.join(HOME_DIR, '.zshrc'))
    ? path.join(HOME_DIR, '.zshrc')
    : path.join(HOME_DIR, '.bashrc');

  let rcContent = `\n# --- BEGIN 1PASSWORD SETUP ---\n`;
  rcContent += `export PATH="${BIN_DIR}:$PATH"\n\n`;
  rcContent += `# --- 1Password Session Manager ---\n`;
  rcContent += `if [[ -f "${CONFIG_DIR}/op-session-manager.sh" ]]; then\n`;
  rcContent += `  source "${CONFIG_DIR}/op-session-manager.sh"\n`;
  rcContent += `fi\n`;
  
  rcContent += `\n# --- 1PASSWORD CLI HELPERS ---\n`;
  rcContent += `opon() {
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
}

oprun() {
  opon
  local op_args=("--env-file" ~/.config/op-ssh/.env.1pass)
  if [[ -f "./.env.1pass" ]]; then
    op_args+=("--env-file" "./.env.1pass")
  fi
  op run "\${op_args[@]}" -- "$@"
}\n`;

  if (enableSSH) {
    rcContent += `\n# --- 1Password SSH Setup ---\n`;
    rcContent += `_ssh_setup_script="${HOME_DIR}/.ssh/setup_ssh_agent.sh"\n`;
    rcContent += `if [[ -f "$_ssh_setup_script" ]]; then\n`;
    rcContent += `  source "$_ssh_setup_script"\n`;
    rcContent += `fi\n`;
  }
  
  rcContent += `# --- END 1PASSWORD SETUP ---\n`;

  let currentRc = fs.existsSync(shellRcPath) ? fs.readFileSync(shellRcPath, 'utf8') : '';
  
  const blockRegex = /\n?# --- BEGIN 1PASSWORD SETUP ---[\s\S]*?# --- END 1PASSWORD SETUP ---\n?/g;
  
  if (blockRegex.test(currentRc)) {
    currentRc = currentRc.replace(blockRegex, `\n${rcContent}`);
    fs.writeFileSync(shellRcPath, currentRc);
    p.log.success(`Updated existing 1Password shell configuration in ${shellRcPath}`);
  } else {
    fs.appendFileSync(shellRcPath, `\n${rcContent}`);
    p.log.success(`Added 1Password shell configuration to ${shellRcPath}`);
  }
}
