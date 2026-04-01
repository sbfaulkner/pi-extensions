# vendor-docs: Local Vendor Documentation Search

## Architecture

Two components:

1. **Skill (SKILL.md)** — instructions and conventions for all operations (clone, fetch, search, list, remove). Every operation uses tools the agent already has: `bash`, `read`, `write`, and `web_fetch`. No custom tools needed — this avoids inflating the system prompt context on every request.

2. **Extension (TypeScript)** — a lightweight extension that *only* provides a status bar item showing cache size and source count. No custom tools registered. Uses `ctx.ui.setStatus()` to display in pi's footer alongside other extension statuses (all extension statuses share a single left-aligned line, sorted alphabetically by key).

This hybrid approach gives passive cache visibility without the context cost of registered tools.

### Status Bar

The extension polls `du -sm` on the sources directory and displays something like:

```
📚 3 sources · 30/500MB 6%
```

Updates every 60 seconds and on session start. Hidden when no sources are configured.

### Dependencies

**Skill:**
- `bash` (built-in): git clone, ripgrep search, file management
- `read`/`write` (built-in): config and state file management  
- `web_fetch` (web-search extension): sitemap and documentation page fetching
- `rg` (ripgrep): must be available on PATH (standard in most dev environments)

**Extension:**
- `@mariozechner/pi-coding-agent` (ExtensionAPI): extension registration, `ctx.ui.setStatus()`
- `child_process` (Node built-in): `du -sm` for cache size polling

## Why This Exists

When researching how to implement something on a vendor platform (Alibaba Cloud, Cloudflare, GCP, AWS, etc.), we hit a productivity wall:

- **Web search summaries are lossy.** They decide what's important, not you. Fine for "what is X?" but poor for "does X support configuration Y?"
- **Context is ephemeral.** Every session starts from zero. The same 15 searches get repeated.
- **Cross-referencing is impossible.** "Which Terraform resources map to which product features?" requires holding two document sets in your head simultaneously — web search can't do this.
- **Broad questions are expensive.** Mapping out all the resources needed for a prototype, then checking Terraform coverage, can consume 10-20 search round-trips and 30KB+ of context on summaries alone.

The gap between "web search summaries" and "I have the actual docs locally and can search them" is enormous for architectural and implementation questions. This skill fills that gap.

## Operations

| Operation | How | Tools used |
|---|---|---|
| **add (git)** | `git clone --depth 1 --filter=blob:none`, scoped to configured paths | `bash` |
| **add (sitemap)** | Fetch sitemap XML, filter URLs by prefix, fetch each page, save as text | `web_fetch`, `bash`, `write` |
| **search** | `rg <query> <source-path>` with sensible defaults | `bash` |
| **list** | Read config + `du -sh` each source, show budget usage | `bash`, `read` |
| **refresh** | `git pull` or re-fetch sitemap pages | `bash`, `web_fetch` |
| **remove** | `rm -rf` source directory, update config | `bash`, `read`, `write` |

### Source Types

Documentation lives in different places depending on the vendor. The skill uses the best approach for each:

#### 1. Git Repository (preferred)

Many documentation sets are already in Git repos:

- Terraform providers (`github.com/aliyun/terraform-provider-alicloud` → `website/docs/`)
- Open-source project docs (often in a `docs/` directory)
- Some vendor docs (Cloudflare publishes their docs on GitHub)

**Why preferred:** Structured, versioned, fast to clone (shallow + sparse checkout), easy to refresh (`git pull`), already in markdown/text format. Searching with `rg` is trivial and fast.

**Config example:**
```yaml
name: terraform-alicloud
type: git
repo: https://github.com/aliyun/terraform-provider-alicloud
paths:
  - website/docs/r/    # resource docs
  - website/docs/d/    # data source docs
```

#### 2. Sitemap Fetch

When docs aren't in a repo but the site publishes a sitemap (most do), fetch pages listed in the sitemap:

- Filter by URL prefix to scope to relevant sections
- Fetch each page via `web_fetch` and extract readable text
- Store as local text/markdown files

**Why this over crawling:** Sitemaps give you the complete, authoritative page list. No risk of missing pages or crawling into irrelevant sections. Scoping by URL prefix keeps it focused.

**Config example:**
```yaml
name: alibaba-esa
type: sitemap
sitemap: https://www.alibabacloud.com/help/sitemap.xml
include:
  - /help/en/edge-security-acceleration/
```

#### 3. Index Page Crawl (future)

For documentation without a repo or usable sitemap — start from an index/landing page and follow links within a defined boundary. Not yet implemented because the first two approaches cover the vast majority of well-maintained vendor docs, and crawling is harder to scope correctly.

## How Search Works

No vector database. No embeddings. Just **`rg` (ripgrep) over local text files**.

Why:
- Vendor doc searches are almost always **keyword/exact match** — you're looking for "HTTP/3", "alicloud_esa_site", "`compression_rules`", not fuzzy semantic similarity
- `rg` is fast enough to search thousands of markdown files in milliseconds
- Zero infrastructure, zero dependencies, zero maintenance
- Results include file paths and line numbers — the agent can then `read` the specific file for full context

For cases where keyword search isn't enough, the agent can always fall back to reading the most relevant files identified by `rg` and reasoning over them. The skill provides the corpus; the agent provides the intelligence.

### Search Output

Returns results grouped by source, with file path, matching lines, and surrounding context. Limited to a reasonable number of results (e.g., top 20 matches) to avoid flooding the context window.

## Storage Layout

```
~/.pi/vendor-docs/
├── config.yaml                    # registered sources
├── sources/
│   ├── terraform-alicloud/        # git clone (shallow)
│   │   └── website/docs/...
│   ├── alibaba-esa/               # fetched pages
│   │   ├── what-is-esa.md
│   │   ├── ipv6-access.md
│   │   ├── brotli-compression.md
│   │   └── ...
│   └── cloudflare-workers/
│       └── ...
└── state.yaml                     # last refresh times, fetch stats
```

## Cache Budget

Local doc caches could grow unbounded — a single Terraform provider repo's docs might be 20MB, a full vendor doc section via sitemap could be 50-100MB, and it adds up across vendors.

### Limits

- **Per-source soft limit: 100MB.** Warn during fetch if a source exceeds this. The user can override, but it forces a conscious decision.
- **Total cache budget: 500MB default.** Configurable in `config.yaml`. The `list` command shows current usage vs budget.
- **Individual file limit: 500KB.** Skip files larger than this during fetch — they're almost certainly not documentation (binary assets, generated API specs, etc.).

### Monitoring

The `list` command always shows:
```
Source                    Type      Size     Age        Pages
terraform-alicloud        git       18MB     3 days     1,247
alibaba-esa               sitemap   12MB     1 week       203
──────────────────────────────────────────────────────────
Total                               30MB / 500MB budget (6%)
```

### Staleness & Cleanup

- **`state.yaml` tracks last fetch and last search per source.** This lets us identify sources that were fetched but never searched (misconfigured?) or haven't been searched in months (no longer relevant?).
- **Stale source detection** surfaces sources not searched in 30+ days.
- **No automatic purging.** Deletion is explicit via remove. Automatic TTL/eviction can come later if needed — the monitoring ensures we'll see it coming.

The budget exists to make cache growth **visible**, not to enforce hard limits. If you're actively using 400MB of vendor docs, that's fine. If you fetched something 6 months ago and forgot about it, `--stale` will surface it.

### Future: Compression

If cache size becomes a problem, individual cached files could be gzipped. Ripgrep supports searching compressed files via `--search-zip` (`-z`), so the search workflow wouldn't change.

## What This Doesn't Do

- **Not a replacement for web search.** This is for known documentation sets you'll reference repeatedly, not ad-hoc questions.
- **Not real-time.** Docs are cached locally. They could be stale. The `refresh` command exists for this, and `state.yaml` tracks freshness.
- **Not a knowledge base.** No summarisation, no embeddings, no RAG. It's a local mirror with good search. The agent's reasoning is the "intelligence" layer.
- **Not a crawler.** Currently supports git repos and sitemap-based fetching only.

## Why This Approach

The temptation is to build a full RAG pipeline: crawl → chunk → embed → vector store → semantic search. But for this use case:

1. **Keyword search is better than semantic search for technical docs.** You're looking for `alicloud_esa_rate_plan` or `QUIC protocol`, not "something about fast internet." Exact match wins.
2. **The agent is the reasoning layer.** Once it can `read` the right file, it can synthesise, compare, and cross-reference. We just need to get it to the right file.
3. **Maintenance cost matters.** A git clone + `rg` setup has effectively zero maintenance. A vector DB needs re-indexing, embedding model updates, and debugging when retrieval quality drifts.
4. **Incremental value is high.** Even just cloning the Terraform provider repo and grepping it is a massive improvement over web searching for resource coverage questions. We don't need a sophisticated system to capture most of the value.

## Example Usage

```
# Add a Terraform provider's docs (git)
vendor-docs add terraform-alicloud git https://github.com/aliyun/terraform-provider-alicloud website/docs/r/ website/docs/d/

# Add vendor docs via sitemap
vendor-docs add alibaba-esa sitemap https://www.alibabacloud.com/help/sitemap.xml /help/en/edge-security-acceleration/

# Search across all sources
vendor-docs search "HTTP/3"
vendor-docs search "alicloud_esa"
```
