# NPM Publishing Checklist

### Phase 1: Set Up Your NPM Automation Token in 1Password
- [ ] Open your browser and log into [npmjs.com](https://www.npmjs.com/).
- [ ] Go to **Access Tokens -> Generate New Token**.
- [ ] Select **Granular Access Token** (or Automation Token).
  - *Do not choose "Publish" or "Read-Only" as they still prompt for passkeys.*
- [ ] Give it permissions to read/write your packages and click Generate Token.
- [ ] Copy the token (starts with `npm_...`).
- [ ] Open your 1Password App, create a new item (or use an existing one), and paste the token into a new credential field.
- [ ] Right-click the field in 1Password and select "Copy Secret Reference" (it will look like `op://Private/NPM/credential`).

### Phase 2: Inject the Token via the New CLI Wizard
Run through the setup locally to ensure everything works and inject the NPM token you just saved.

- [ ] Run the setup script locally from the root of your project:
  ```bash
  node packages/1password-cli-tools/bin/setup.js
  ```
- [ ] SSH Integration: You can skip or re-enter your SSH reference.
- [ ] Global API Keys: Say **Yes** to configuring global keys.
- [ ] Select Keys: Select `NPM Automation Token` from the checklist using the Spacebar, then press Enter.
- [ ] Paste Reference: Paste the `op://...` reference you copied in Phase 1.
- [ ] Complete: Let the wizard finish setting up your `~/.config/op-ssh/.env.1pass` file.
- [ ] Reload your terminal so the new token is loaded into memory:
  ```bash
  source ~/.zshrc
  ```
- [ ] Verify the file was created correctly:
  ```bash
  cat ~/.config/op-ssh/.env.1pass
  # It should show NODE_AUTH_TOKEN="op://..."
  ```
- [ ] Verify the shell script loading order in your `.zshrc`/`.bashrc`. It should have the 1Password CLI `PATH` export first, then the `op-session-manager.sh` script, and finally the `setup_ssh_agent.sh` script.
- [ ] Open a completely new terminal window and verify that the 1Password Session Manager prompts you to authenticate (if expired) *before* keychain tries to unlock your SSH key.

### Phase 3: Test the Packages Locally
Before publishing, let's verify both packages build and install correctly on your machine.

- [ ] Test the CLI Tools Package:
  ```bash
  cd packages/1password-cli-tools
  npm pack
  npm uninstall -g 1password-cli-tools
  npm install -g "$PWD/1password-cli-tools-0.3.0.tgz"
  ```
- [ ] Test the global alias to make sure the wizard launches:
  ```bash
  op-setup
  ```
  *(You can Ctrl+C to cancel out of it once you confirm it launches).*

- [ ] Test the Pi Extension Package:
  ```bash
  # From the repo root:
  cd packages/pi-1password
  npm pack
  # Create a temporary test directory
  mkdir -p /tmp/pi-test
  # Extract the packed tarball (check version matches)
  tar -xzf pi-1password-*.tgz -C /tmp/pi-test
  # Install the extracted package into pi
  pi install /tmp/pi-test/package
  ```

### Phase 4: Publish to NPM!
Instead of polluting your global shell environment with a highly sensitive token, we will use 1Password's official `op run` command. This securely reads the `.env.1pass` file, resolves the `op://` reference, and injects the token *only* into the `npm publish` process!

- [ ] Publish the CLI Tools Package:
  ```bash
  cd ../1password-cli-tools
  oprun npm publish --access public
  ```

- [ ] Publish the Pi Extension Package:
  ```bash
  cd ../pi-1password
  oprun npm publish --access public
  ```
