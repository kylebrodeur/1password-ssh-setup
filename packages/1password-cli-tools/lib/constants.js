import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SRC_DIR = path.resolve(__dirname, '../../src');
export const HOME_DIR = os.homedir();
export const SSH_DIR = path.join(HOME_DIR, '.ssh');
export const BIN_DIR = path.join(HOME_DIR, '.local', 'bin');
export const CONFIG_DIR = path.join(HOME_DIR, '.config', 'op-ssh');
export const ENV_FILE = path.join(CONFIG_DIR, '.env.1pass');
