---
name: vendor-docs
description: |
  Search, add, refresh, list, and remove local vendor documentation caches.
  Use when asked to "search vendor docs", "add vendor docs", "vendor-docs search",
  "fetch docs for X", "cache documentation", or any task involving local vendor
  documentation search. Also use when the user asks broad architectural questions
  about vendor platforms that would benefit from local doc search rather than
  repeated web searches.
---

# vendor-docs: Local Vendor Documentation Search

Fetch vendor documentation into a local searchable cache (`~/.pi/vendor-docs/`),
then search it with ripgrep. Fetch once, search many times, refresh when needed.

> **All operations use built-in tools only:** `bash`, `read`, `write`, `web_fetch`.
> No custom tools are needed.

## Storage Layout

```
~/.pi/vendor-docs/
├── config.yaml       # registered sources
├── state.yaml        # last refresh/search times, fetch stats
└── sources/
    ├── <name>/       # one directory per source
    └── ...
```

## Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Per-source soft limit | 100MB | Warn if exceeded; user can override |
| Total cache budget | 500MB | Configurable in `config.yaml` as `budget_mb: 500` |
| Individual file limit | 500KB | Skip larger files during fetch (likely not docs) |

---

## Operations

### 1. Add a Git Source

Use for Terraform providers, open-source project docs, or any docs in a Git repo.

```bash
# Ensure directories exist
mkdir -p ~/.pi/vendor-docs/sources

# Shallow clone with path filtering
git clone --depth 1 --filter=blob:none --sparse \
  <REPO_URL> ~/.pi/vendor-docs/sources/<NAME>

# Scope to specific paths (if needed)
cd ~/.pi/vendor-docs/sources/<NAME>
git sparse-checkout set <PATH1> <PATH2> ...
```

Then update `~/.pi/vendor-docs/config.yaml` — read the existing file first, then
write back with the new source appended:

```yaml
budget_mb: 500
sources:
  - name: <NAME>
    type: git
    repo: <REPO_URL>
    paths:
      - <PATH1>
      - <PATH2>
```

And update `~/.pi/vendor-docs/state.yaml`:

```yaml
sources:
  <NAME>:
    last_fetched: "2025-01-15T10:30:00Z"
    last_searched: null
```

After cloning, check the size:

```bash
du -sh ~/.pi/vendor-docs/sources/<NAME>
```

Warn if over 100MB.

### 2. Add a Sitemap Source

Use when docs aren't in a repo but the site publishes a sitemap.

**Step 1:** Fetch and parse the sitemap to get URLs:

```bash
# Use web_fetch to get the sitemap XML
```

Use `web_fetch` on the sitemap URL. Parse the XML to extract `<loc>` URLs.
Filter URLs matching the configured `include` prefixes.

**Step 2:** For each matching URL, fetch the page:

```bash
mkdir -p ~/.pi/vendor-docs/sources/<NAME>
```

Use `web_fetch` on each URL. Save the extracted text to a file named after the
URL path (replace `/` with `-`, strip leading slash, add `.md` extension).

- Skip files larger than 500KB
- Track progress: report every 10 pages fetched
- If there are many pages (50+), ask the user before proceeding

**Step 3:** Update `config.yaml`:

```yaml
sources:
  - name: <NAME>
    type: sitemap
    sitemap: <SITEMAP_URL>
    include:
      - <URL_PREFIX_1>
```

**Step 4:** Update `state.yaml` with fetch timestamp and page count.

### 3. Search

Search across all sources (or a specific source) using ripgrep:

```bash
# Search all sources
rg --type-add 'docs:*.md' --type-add 'docs:*.txt' --type-add 'docs:*.html' \
   --type docs -l -i --max-count 5 '<QUERY>' ~/.pi/vendor-docs/sources/

# Search a specific source
rg --type-add 'docs:*.md' --type-add 'docs:*.txt' --type-add 'docs:*.html' \
   --type docs -i --max-count 5 -C 2 '<QUERY>' ~/.pi/vendor-docs/sources/<NAME>/
```

**Defaults:**
- Case-insensitive (`-i`)
- Max 5 matches per file (`--max-count 5`)
- 2 lines of context (`-C 2`)
- Only search doc file types (md, txt, html)
- Limit output: pipe through `head -100` to avoid flooding context

**After searching**, update `state.yaml` to record `last_searched` timestamp for
each source that had results.

If search returns too many results, suggest the user narrow the query or scope to
a specific source. If no results, suggest alternative terms or checking if the
source needs refreshing.

After finding relevant files, use `read` to load the full content of the most
relevant files for detailed analysis.

### 4. List Sources

Read `config.yaml` and get size info for each source:

```bash
# Get size of each source
for dir in ~/.pi/vendor-docs/sources/*/; do
  name=$(basename "$dir")
  size=$(du -sh "$dir" 2>/dev/null | cut -f1)
  count=$(find "$dir" -type f \( -name '*.md' -o -name '*.txt' -o -name '*.html' \) | wc -l)
  echo "$name  $size  $count files"
done

# Total size
du -sh ~/.pi/vendor-docs/sources/ 2>/dev/null
```

Present as a formatted table including:
- Source name, type, size, age (from `state.yaml` `last_fetched`), file count
- Total size vs budget
- Flag any sources not searched in 30+ days as stale

### 5. Refresh

**Git sources:**
```bash
cd ~/.pi/vendor-docs/sources/<NAME>
git pull
```

**Sitemap sources:** Re-run the sitemap fetch process (Step 1-2 from Add Sitemap).
This replaces all cached pages with fresh versions.

Update `last_fetched` in `state.yaml` after refreshing.

### 6. Remove

```bash
rm -rf ~/.pi/vendor-docs/sources/<NAME>
```

Then update `config.yaml` to remove the source entry, and `state.yaml` to remove
its tracking data.

---

## Conventions

- **Always read `config.yaml` before writing it** — never clobber other sources.
- **Use YAML format** for config and state files (simple, readable).
- **Source names must be lowercase alphanumeric with hyphens** (e.g., `terraform-alicloud`).
- **Report cache budget usage** whenever adding or listing sources.
- **Ask before large fetches** — if a sitemap has 50+ matching URLs, confirm with the user.
- **Prefer git sources over sitemap** when docs are available in a repo.
- **Initialize files if missing** — if `config.yaml` or `state.yaml` don't exist, create them with sensible defaults on first operation.
