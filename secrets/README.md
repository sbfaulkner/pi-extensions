# Secrets

Loads environment variables from encrypted ejson files (`~/.secrets.d/`) and injects them into all bash tool invocations.

## Features

- **Immediate status updates** — status bar shows 🔑 with loaded secret names instantly when secrets are loaded or cleared (no need to wait for the next user turn)
- **`load_secrets` tool** — LLM can load secrets by name when a command needs API tokens
- **`/secrets` command** — manually load, list, or clear secrets
- **Session restore** — secrets are automatically reloaded when resuming a session
- **Robust process environment injection** — secrets are available in both bash commands and Node.js (process.env), cleared from both with `/secrets clear`

## Usage

### Interactive

```
/secrets proxy          # Load proxy secrets
/secrets staging        # Load staging secrets
/secrets list           # Show available and loaded
/secrets clear          # Unload all secrets
```

### Via LLM

The `load_secrets` tool is available for the LLM to call when a command needs API tokens or secrets.

## Requirements

- `ejson2env` installed (e.g. `brew install shopify/shopify/ejson2env`)
- Encrypted ejson files in `~/.secrets.d/`
- Corresponding private keys in `/opt/ejson/keys/`
