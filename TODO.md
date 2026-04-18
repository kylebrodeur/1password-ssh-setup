# NPM Publishing Checklist

### Phase 1: Set Up Your NPM Automation Token in 1Password
- [ ] Open your browser and log into npmjs.com.
- [ ] Go to Access Tokens -> Generate New Token.
- [ ] Select Granular Access Token (or Automation Token).
  - *Do not choose "Publish" or "Read-Only" as they still prompt for passkeys.*
- [ ] Give it permissions to read/write your packages and click Generate Token.
- [ ] Copy the token (starts with `npm_...`).
- [ ] Open your 1Password App, create a new item (or use an existing one), and paste the token into a new credential field.
- [ ] Right-click the field in 1Password and select "Copy Secret Reference" (it will look like `op://Private/NPM/credential`).

### Phase 2: Inject the Token via the New CLI Wizard
- [ ] Run the setup script locally from the root of your project:
  ```bash
  node packages/1password-cli-tools/bin/setup.js
  ```
- [ ] SSH Integration: You can skip or re-enter your SSH reference.
- [ ] Global API Keys: Say Yes to configuring global keys.
- [ ] Select Keys: Select `NPM Automation Token` (and any others you want) from the checklist using the Spacebar, then press Enter.
- [ ] Paste Reference: Paste the `op://...` reference you copied in Phase 1.
- [ ] Complete: Let the wizard finish setting up your `~/.config/op-ssh/.env.1pass` file.
- [ ] Reload your terminal so the new token is loaded into memory:
  ```bash
  source ~/.zshrc
  ```

### Phase 3: Test the Packages Locally
Before publishing, verify the NPM package builds and installs correctly on your machine.

- [ ] Test the CLI Tools Package:
  ```bash
  cd packages/1password-cli-tools
  npm pack
  npm install -g ./1password-cli-tools-0.3.0.tgz
  ```
- [ ] Test the global alias to make sure it works:
  ```bash
  op-setup
  ```
  *(You can Ctrl+C to cancel out of it once you confirm it launches the wizard).*

- [ ] Test the Pi Extension Package:
  ```bash
  cd ../pi-1password
  npm pack
  pi install ./pi-1password-0.3.0.tgz
  ```

### Phase 4: Publish to NPM!
If everything launched and installed correctly, your token is loaded in your environment (`NODE_AUTH_TOKEN`), and you are ready to publish!

- [ ] Publish the CLI Tools Package:
  ```bash
  cd ../../packages/1password-cli-tools
  npm publish --access public
  ```

- [ ] Publish the Pi Extension Package:
  ```bash
  cd ../pi-1password
  npm publish --access public
  ```
