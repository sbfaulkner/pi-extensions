# Secrets

Loads environment variables from encrypted ejson files (`${XDG_CONFIG_HOME:-$HOME/.config}/secrets`) and makes them available to all bash commands via the process environment.

## Features

- **Immediate status updates** — status bar shows 🔑 with loaded secret names instantly when secrets are loaded or cleared (no need to wait for the next user turn)
- **`load_secrets` tool** — LLM can load secrets by name when a command needs API tokens
- **`/secrets` command** — manually load, list, or clear secrets
- **Session restore** — secrets are automatically reloaded when resuming a session; unavailable files are skipped silently
- **Robust process environment injection** — secrets are written to `process.env`, which pi's bash tool snapshots at spawn time, so they're available in agent bash, user bash (`!` / `!!`), and Node.js; cleared with `/secrets clear`
- **Composes with other extensions** — does not override the `bash` tool, so extensions that do (e.g. `spawnHook`-based PATH injection) still see loaded secrets
- **Explicit load errors** — decrypt failures, malformed decrypted JSON, and missing decrypted `environment` objects are reported without marking secrets as loaded

## Usage

### Interactive

```
/secrets proxy          # Load proxy secrets
/secrets staging        # Load staging secrets
/secrets list           # Show available and loaded
/secrets clear          # Unload all secrets
```

### Via LLM

The `load_secrets` tool is available for the LLM to call when a command needs API tokens or secrets. Missing files report the available ejson names so the caller can choose a valid secret set. Decrypt, JSON parse, and missing-`environment` failures are surfaced as tool errors without exposing loaded secret values.

## Requirements

- `ejson` CLI installed and available on `PATH`
- Encrypted ejson files in `${XDG_CONFIG_HOME:-$HOME/.config}/secrets`
- Decrypted ejson content must be valid JSON with an `environment` object; only string values in that object are loaded, and `_public_key` is ignored
- Corresponding private keys in `/opt/ejson/keys/`
