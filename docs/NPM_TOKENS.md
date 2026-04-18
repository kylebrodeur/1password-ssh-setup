# Setting Up NPM Automation Tokens & API Keys

This guide explains how to set up headless and frictionless authentication for common development tools (like NPM) using 1Password, entirely bypassing WebAuthn or passkey prompts in the terminal.

## NPM Automation Tokens

While you can secure your `npmjs.com` account with a passkey, the terminal `npm` CLI cannot natively pass a WebAuthn challenge. To securely publish packages from the CLI without disabling 2FA:

### 1. Generate an Automation Token
1. Log into [npmjs.com](https://www.npmjs.com/) in your browser.
2. Go to **Access Tokens** $\rightarrow$ **Generate New Token**.
3. Select **Granular Access Token** (Recommended) or **Automation Token**.
   *Note: Do not choose "Publish" or "Read-Only" tokens, as those will still prompt for 2FA/passkeys.*
4. Give it permissions to read and publish your specific packages.
5. Copy the generated token (it starts with `npm_...`).

### 2. Save it in 1Password
1. Open your 1Password app.
2. Create a new **API Credential** item (or edit your existing NPM login).
3. Name the item `NPM Automation Token`.
4. Paste the token into the credential field.
5. Right-click the field and select **Copy Secret Reference**. It should look like: `op://Private/NPM Automation Token/credential`.

### 3. Add it to your Global Environment
Use the interactive setup wizard to add it to your global environment:

```bash
npx 1password-cli-setup
```

When prompted, select `NPM Automation Token` and paste your secret reference. 
Alternatively, you can manually add it to `~/.config/op-ssh/.env.1pass`:

```bash
NODE_AUTH_TOKEN="op://Private/NPM Automation Token/credential"
```

Whenever you start your terminal or run `/op-env-user` inside Pi, your system will securely pull the token into memory. When you run `npm publish`, NPM will automatically use this token and publish your package without any prompts!

## Other Common API Keys

You can follow the exact same process for any other CLI tool or AI agent.

### OpenAI API
1. Generate key at [platform.openai.com](https://platform.openai.com/api-keys).
2. Save in 1Password as `OpenAI`.
3. Add to `.env.1pass`: `OPENAI_API_KEY="op://Private/OpenAI/credential"`

### Anthropic API
1. Generate key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Save in 1Password as `Anthropic`.
3. Add to `.env.1pass`: `ANTHROPIC_API_KEY="op://Private/Anthropic/credential"`

### GitHub CLI (gh)
Instead of using standard Personal Access Tokens, we recommend using the official [1Password Shell Plugin for GitHub](https://developer.1password.com/docs/cli/shell-plugins/github/).

```bash
op plugin init github
```

This will alias the `gh` command to authenticate seamlessly using your 1Password biometrics or session cache.
