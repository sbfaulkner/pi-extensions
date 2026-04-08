# Web Search

Web search and page fetching via Google's Gemini API with Google Search grounding.

## Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search the web — returns links + short snippets |
| `web_search_summary` | Search the web — returns detailed summaries per result |
| `web_fetch` | Fetch a URL and extract readable text content |

## How it works

### Search tools

`web_search` and `web_search_summary` use Gemini's Google Search grounding — a single API call where the model searches Google internally and synthesizes an answer with source URLs. The two tools differ only in the prompt (concise vs detailed).

Redirect URLs from Google's grounding metadata are resolved in parallel to their final destinations.

### Fetch tool

`web_fetch` fetches a URL directly, strips HTML to plain text (removing scripts, styles, nav, etc.), and returns up to 20,000 characters. Binary content types (images, audio, video, PDF, etc.) are rejected.

## Setup

### Getting a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with a Google account
3. Click "Get API Key" → "Create API key"
4. Copy the key

Keys are also visible at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Configuring the extension

Set the `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY="your-key-here"
```

### Free tier quotas

| Model Family | Free Grounding Quota | Overage Price |
|-------------|---------------------|---------------|
| Gemini 3 models | 5,000 prompts/month | $14 / 1,000 queries |
| Gemini 2.5 models | 1,500 requests/day | $35 / 1,000 queries |

### Network allowlist

If pi uses a sandbox with domain restrictions, allow these domains:

- `generativelanguage.googleapis.com` — Gemini API
- `vertexaisearch.cloud.google.com` — redirect resolution for grounding source URLs
- Any domains users want to `web_fetch`
