---
name: gh-cli
description: Safe patterns for using the GitHub CLI (gh) with PR/issue bodies, comments, and other multi-line or dynamic content. Use when any gh command involves --body, --body-file, comments, or descriptions — especially with interpolated or generated content.
---

# GitHub CLI (`gh`) Safe Content Patterns

## The Problem

Using `--body "..."` with interpolated or multi-line content is fragile and dangerous:

```bash
# ❌ BAD — breaks on quotes, backticks, $variables, newlines
gh pr create --title "feat: thing" --body "$(generate_description)"
gh pr edit 123 --body "## Summary\nThis uses $PATH and `code`"
gh pr comment 123 --body "The user said \"hello\" and $vars expand"
```

These fail silently or produce mangled output when content contains shell metacharacters.

## The Rule

**Always use `--body-file` for any non-trivial body content.**

This applies to all `gh` subcommands that accept body text:
- `gh pr create`
- `gh pr edit`
- `gh pr comment`
- `gh issue create`
- `gh issue edit`
- `gh issue comment`
- `gh pr review`

## Safe Patterns

### Heredoc to temp file (preferred for generated content)

```bash
cat <<'EOF' > /tmp/pr-body.md
## Summary

Content with $variables, `backticks`, and "quotes" that won't break.

- Bullet points work fine
- So does ```code fencing```
EOF

gh pr create --title "feat: add widget" --body-file /tmp/pr-body.md
```

### Pipe via stdin

```bash
gh pr comment 123 --body-file - <<'EOF'
This is a comment with `code`, $dollars, and "quotes".
All safe because heredoc quoting prevents expansion.
EOF
```

### Write from a variable (when content is already in a shell variable)

```bash
printf '%s' "$body_content" > /tmp/pr-body.md
gh pr edit 123 --body-file /tmp/pr-body.md
```

### Simple static strings (the only safe inline case)

```bash
# ✅ OK — short, static, no special characters
gh pr comment 123 --body "LGTM, merging."
```

## Key Details

- **Quote the heredoc delimiter** (`<<'EOF'`) to prevent shell expansion inside the body
- **Use `printf '%s'`** not `echo` when writing variables (avoids backslash interpretation)
- **Clean up temp files** if creating them in shared locations
- For `gh pr create`, prefer `--fill` when the commit messages already describe the change well

## Quick Reference

| Instead of | Use |
|---|---|
| `--body "$variable"` | `printf '%s' "$variable" > /tmp/body.md && --body-file /tmp/body.md` |
| `--body "$(command)"` | `command > /tmp/body.md && --body-file /tmp/body.md` |
| `--body "multi\nline"` | `--body-file - <<'EOF' ... EOF` |
| `--body "has 'quotes'"` | `--body-file - <<'EOF' ... EOF` |
