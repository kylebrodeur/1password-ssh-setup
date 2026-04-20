import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { HOME_DIR } from '../constants.js';

export const npmProvider = {
  id: 'NODE_AUTH_TOKEN',
  label: 'NPM Automation Token',
  placeholder: 'op://Private/NPM/credential',
  onSetup: async () => {
    const npmrcLine = '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}';
    const npmrcPath = path.join(HOME_DIR, '.npmrc');
    
    let writeNpmrc = true;
    if (fs.existsSync(npmrcPath)) {
      const currentNpmrc = fs.readFileSync(npmrcPath, 'utf8');
      if (currentNpmrc.includes('//registry.npmjs.org/:_authToken=')) {
        if (!currentNpmrc.includes(npmrcLine)) {
          const overwrite = await p.confirm({
            message: 'Your ~/.npmrc already has a hardcoded _authToken. Overwrite it to use ${NODE_AUTH_TOKEN} from 1Password?',
            initialValue: true,
          });
          if (!p.isCancel(overwrite) && overwrite) {
            const updatedNpmrc = currentNpmrc.replace(/\/\/registry\.npmjs\.org\/:_authToken=.*/g, npmrcLine);
            fs.writeFileSync(npmrcPath, updatedNpmrc);
            p.log.success('Updated ~/.npmrc to use 1Password token');
          }
        }
        writeNpmrc = false; // We either replaced it or user declined
      }
    }
    
    if (writeNpmrc) {
      fs.appendFileSync(npmrcPath, `\n${npmrcLine}\n`);
      p.log.success('Configured ~/.npmrc to use 1Password token');
    }
  }
};
