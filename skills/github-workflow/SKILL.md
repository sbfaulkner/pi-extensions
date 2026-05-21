---
name: github-workflow
description: Standard GitHub PR workflow reference. Use when a remote exists and the repo uses GitHub PRs for change collaboration.
---

# Standard GitHub PR Workflow

## Core Principles

- **Never commit directly to `main`** — always use feature branches and PRs
- **Small, focused PRs** — easier to review, faster to merge
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
# Create a PR using the commits as the description
gh pr create --fill --head feature-name --base main

# Or supply an explicit title/body file
body_file="$(mktemp)"
cat > "$body_file" <<'EOF'
Summary of changes...

More details.
EOF
gh pr create --title "feat: ..." --body-file "$body_file" --head feature-name --base main
rm -f "$body_file"
```

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
| `gh pr create` | Create a pull request |
| `gh pr view` | View PR details |
| `gh pr checks` | Check CI status |
| `gh pr merge` | Merge a PR |
| `gh pr list` | List open PRs |
| `gh pr checkout <number>` | Check out a PR locally |


For non-trivial bodies or generated content, prefer `--body-file` or heredoc patterns as described in the gh-cli skill to avoid quoting issues.