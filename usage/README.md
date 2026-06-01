# Usage Extension

This extension displays provider usage information in the pi status bar.

## Features

- Shows GitHub Copilot AI credit usage for the current UTC month.
- Shows gross AI credit value and additional billed amount when GitHub returns those fields.
- Falls back to legacy Copilot premium request usage for annual Pro/Pro+ plans that still use request-based billing.
- Refreshes automatically when sessions start and after agent turns complete.

## Requirements

GitHub Copilot usage is fetched through the GitHub CLI (`gh`). User-level billing endpoints only include Copilot usage billed directly to your personal account. If your Copilot seat is managed and billed by an organization or enterprise, personal-account usage endpoints may be empty or unavailable.

Authenticate `gh` with access to user billing information:

```sh
gh auth refresh -h github.com -s user
```

If the API cannot be reached or the token lacks the required scope, the status bar shows `usage unavailable` instead of a misleading zero.
