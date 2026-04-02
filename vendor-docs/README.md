# vendor-docs: Local Vendor Documentation Search

## Why This Exists

When researching vendor platforms (Alibaba Cloud, Cloudflare, AWS, etc.), web
search summaries are lossy and ephemeral. The same searches get repeated every
session, cross-referencing across doc sets is impossible, and broad architectural
questions consume dozens of round-trips.

This skill fills the gap: fetch vendor docs once into a local cache, then search
them with ripgrep. The agent provides the reasoning; the cache provides the corpus.

## Architecture

Two components:

1. **Skill (SKILL.md)** — instructions for all operations (add, search, list,
   refresh, remove). Uses only built-in tools (`bash`, `read`, `write`,
   `web_fetch`). No custom tools — avoids inflating the system prompt.

2. **Extension (index.ts)** — status bar showing cache size and source count.
   Polls every 60 seconds. Shows "📚 No sources cached" when empty so the
   feature remains discoverable.

## Source Types

- **Git repos** (preferred) — shallow clone with sparse checkout, scoped to doc
  paths. Refresh with `git pull`.
- **Sitemaps** — fetch pages listed in a sitemap XML, filtered by URL prefix.
  Refresh by re-fetching.

## Storage

```
~/.pi/vendor-docs/
├── config.yaml          # registered sources (name, type, description, paths)
├── state.yaml           # last refresh times
└── sources/
    └── <name>/          # one directory per source
```

## Limits

| Limit | Value |
|-------|-------|
| Per-source soft limit | 100MB |
| Total cache budget | 500MB (configurable in config.yaml) |
| Individual file limit | 500KB |

## Example Usage

Natural language requests to the agent:

```
"Add the Terraform Alicloud provider to vendor docs"
"Search vendor docs for HTTP/3"
"List my vendor doc sources"
"Refresh the Terraform Alicloud docs"
"Remove the Cloudflare Workers docs from vendor docs"
```
