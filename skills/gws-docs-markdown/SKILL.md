---
name: gws-docs-markdown
description: |
  Create or update Google Docs from markdown content. Use when asked to
  "create a Google Doc from markdown", "write markdown to a Google Doc",
  "update a doc with markdown", or any task combining markdown and Google Docs.
---

# Google Docs from Markdown

Google Drive's import conversion automatically converts markdown to rich Google Docs
formatting (headings, bold, italic, lists, tables, code blocks, links) when you
upload a `.md` file with the target mimeType set to `application/vnd.google-apps.document`.

> **Prerequisites:** `gws` must be on `$PATH` and authenticated (`gws auth login`).
> See the [gws-shared](../gws-shared/SKILL.md) skill for auth and global flags.

## Create a new Google Doc from markdown

1. Write the markdown content to a temporary `.md` file.
2. Upload it via the Drive API with the Google Docs mimeType:

```bash
gws drive files create \
  --json '{"name": "My Document", "mimeType": "application/vnd.google-apps.document"}' \
  --upload content.md
```

The response includes the new document `id`. The doc URL is:
`https://docs.google.com/document/d/<ID>/edit`

### Placing in a specific folder

Add `parents` to the JSON body:

```bash
gws drive files create \
  --json '{"name": "My Document", "mimeType": "application/vnd.google-apps.document", "parents": ["FOLDER_ID"]}' \
  --upload content.md
```

## Update an existing Google Doc from markdown

Upload new markdown content to **replace** the entire document body:

```bash
gws drive files update \
  --params '{"fileId": "DOCUMENT_ID"}' \
  --upload content.md
```

> [!CAUTION]
> This **replaces all content** in the document. There is no append mode via this method.
> To append text (plain text only), use `gws docs +write --document DOC_ID --text '...'`.

## Explicit content-type override

The `gws` CLI infers `text/markdown` from the `.md` extension automatically (v0.22.3+).
If your file has a different extension (e.g. `.txt`) or you're working with a non-standard
filename, set the content type explicitly:

```bash
gws drive files create \
  --json '{"name": "My Document", "mimeType": "application/vnd.google-apps.document"}' \
  --upload notes.txt \
  --upload-content-type text/markdown
```

## What converts well

| Markdown feature | Google Docs result |
|------------------|--------------------|
| `# Heading` | H1–H6 heading styles |
| `**bold**` | Bold text |
| `*italic*` | Italic text |
| `` `code` `` | Monospace inline |
| `- item` / `1. item` | Bullet / numbered lists |
| `[text](url)` | Clickable hyperlink |
| Code blocks (```) | Monospace formatted block |
| Tables | Formatted tables |

## Workflow pattern

For agent workflows that generate docs from markdown:

```bash
# 1. Write markdown to a temp file
cat > /tmp/doc.md << 'EOF'
# My Document
Content goes here with **formatting**.
EOF

# 2. Create the Google Doc
RESULT=$(gws drive files create \
  --json '{"name": "My Document", "mimeType": "application/vnd.google-apps.document"}' \
  --upload /tmp/doc.md)

# 3. Extract the document ID
DOC_ID=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

# 4. Document URL
echo "https://docs.google.com/document/d/${DOC_ID}/edit"

# 5. Clean up
rm /tmp/doc.md
```

## Shared Drives

Files on shared (team) drives require `supportsAllDrives: true` in the params,
otherwise the API returns a 404 even if the authenticated user has access.

```bash
# Update a doc on a shared drive
gws drive files update \
  --params '{"fileId": "DOCUMENT_ID", "supportsAllDrives": true}' \
  --upload content.md
```

This also applies to `files get`, `files create` (with `parents` on a shared drive), etc.

## Limitations

- **Update replaces entirely** — there's no way to update a section; the whole doc body is replaced.
- **`+write` is plain text only** — the `gws docs +write` helper does not support markdown formatting ([#380](https://github.com/googleworkspace/cli/issues/380)).
- **Images are not converted** — markdown image syntax is not imported; use `insertInlineImage` via `batchUpdate` instead.
- **Complex nested lists** may not convert perfectly.

## See Also

- [gws-drive](../gws-drive/SKILL.md) — Drive file operations
- [gws-drive-upload](../gws-drive-upload/SKILL.md) — Upload helper
- [gws-docs](../gws-docs/SKILL.md) — Docs API operations
- [gws-docs-write](../gws-docs-write/SKILL.md) — Append plain text to a doc
