---
name: git-workflow
description: Local git workflow guidance for repositories with no remote configured. Use when there is no origin remote and PRs are not possible.
---

# Local Git Workflow (no remote)

This skill documents safe, local git workflows for repositories that do not have a remote configured. It intentionally omits PR instructions to avoid accidental remote operations.

## Core Principles

- Work locally using branches and commits.
- Keep changes small and focused.
- Write clear commit messages describing what and why.

## Workflow

### Start a feature (local)

```bash
git checkout -b feature-name
```

### Commit changes

```bash
git add <files>           # stage specific files
git commit -m "feat: description of change"
```

### If you later add a remote

If you configure an origin remote later (e.g., `git remote add origin <url>`), follow the GitHub PR guidance in the `github-workflow` skill.

### Update from main (local)

When working locally, you can rebase or merge as appropriate for your workflow. If a remote is later added, prefer rebasing onto the remote `main` for a clean history:

```bash
# If a remote exists later:
git fetch origin
git rebase origin/main
```

### Address review feedback (local)

Collect feedback outside of GitHub (e.g., chat), then:

```bash
# make changes...
git add <files>
git commit -m "fix: address review feedback"
```

## Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes nor adds
- `test:` — adding or updating tests
- `chore:` — maintenance tasks


This skill intentionally avoids any `gh` or PR commands to prevent accidental pushes or PR creation.