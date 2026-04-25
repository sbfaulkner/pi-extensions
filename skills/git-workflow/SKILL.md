---
name: git-workflow
description: Standard PR-based git workflow reference. Use when working in a non-Graphite repo and needing guidance on branching, commits, PRs, and best practices.
---

# Standard Git PR Workflow

## Core Principles

- **Never commit directly to main** — always use feature branches
- **Small, focused PRs** — easier to review, faster to merge
- **Clear commit messages** — describe what and why, not how

## Workflow

### Start a feature

```bash
git checkout main
git pull origin main
git checkout -b feature-name
```

### Commit changes

```bash
git add <files>           # stage specific files
git commit -m "feat: description of change"
```

### Push and create PR

```bash
git push -u origin feature-name
gh pr create --fill        # or gh pr create --title "..." --body "..."
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
