# vendor-docs: Future Ideas

## Alternative source types for large vendor doc sets

Git repos work great. Sitemaps don't scale for major cloud vendors (Google,
Cloudflare, Alibaba Cloud, AWS) — their doc sets are enormous (500k+ pages)
and fetching individual pages via web_fetch is too slow.

Possible approaches:
- **Direct HTTP API calls** to vendor doc search endpoints (e.g. Google's
  Developer Knowledge API at `developerknowledge.googleapis.com`) — the search
  happens server-side, no local cache needed
- **Vendor-published doc archives** if they exist (tarballs, zip downloads)
- **Scoped sitemap fetching** — only fetch a narrow section (e.g. just
  `/load-balancing/docs/`) rather than the whole site, if the sitemap structure
  allows it

The config could support a new source type (e.g. `type: api`) where search
delegates to a remote endpoint instead of local rg. Pi doesn't support MCP
natively, but the underlying APIs are just HTTP and could be called via curl
or web_fetch from skill instructions.
