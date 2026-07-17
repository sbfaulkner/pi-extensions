---
name: github-workflow
description: Standard GitHub PR workflow reference. Use when a remote exists and the repo uses GitHub PRs for change collaboration.
---

# Standard GitHub PR Workflow

## Core Principles

- **Never commit directly to `main`** — always use feature branches and PRs
- **Small, focused PRs** — easier to review, faster to merge
- **Draft first** — create new PRs as drafts so early iterations do not request review
- **Explicit readiness** — do not mark a draft ready unless the user explicitly asks or repo docs require it
- **Clear commit messages** — describe what and why, not how

## Workflow

### Start a feature

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feature-name
```

### Commit changes

```bash
git add <files>           # stage specific files
git commit -m "feat: description of change"
```

### Push and create PR

Use the GitHub CLI safely (see the gh-cli skill). Examples:

```bash
git push -u origin feature-name
# Create a draft PR using the commits as the description
gh pr create --draft --fill --head feature-name --base main

# Or supply an explicit title/body file
body_file="$(mktemp)"
cat > "$body_file" <<'EOF'
Summary of changes...

More details.
EOF
gh pr create --draft --title "feat: ..." --body-file "$body_file" --head feature-name --base main
rm -f "$body_file"
```

Creating a PR as a draft does not prevent pushing follow-up commits. Keep it in draft while the implementation or PR
metadata is still being refined.

### Publish for review

Only when the user explicitly asks to publish, request review, or mark the PR ready (or repo docs require it), run:

```bash
gh pr ready <number>
```

Passing tests alone is not permission to mark a PR ready. Do not downgrade an existing ready PR to draft unless the user
asks.

### Update from main

```bash
git fetch origin
git rebase origin/main     # preferred over merge for clean history
```

### Address review feedback

```bash
# make changes...
git add <files>
git commit -m "fix: address review feedback"
git push
```

If the push is rejected because the branch was rebased, use an explicit lease:

```bash
git push --force-with-lease origin feature-name
```

## Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes nor adds
- `test:` — adding or updating tests
- `chore:` — maintenance tasks

## Useful `gh` Commands

| Command | Description |
|---------|-------------|
| `gh pr create --draft` | Create a draft pull request |
| `gh pr ready <number>` | Mark a draft ready when explicitly requested |
| `gh pr view` | View PR details |
| `gh pr checks` | Check CI status |
| `gh pr merge` | Merge a PR |
| `gh pr list` | List open PRs |
| `gh pr checkout <number>` | Check out a PR locally |


For non-trivial bodies or generated content, prefer `--body-file` or heredoc patterns as described in the gh-cli skill to avoid quoting issues.