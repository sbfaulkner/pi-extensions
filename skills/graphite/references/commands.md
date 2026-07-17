# Graphite Command Reference

Concise `gt` command reference for agents. Use explicit, non-interactive forms unless the user asks for an interactive flow.

## Agent-safe defaults

```bash
gt log short
gt checkout <branch>
gt create --all --message "feat: describe change" --no-interactive
gt modify --all --no-interactive
gt modify --commit --all --message "fix: describe follow-up" --no-interactive
gt submit --stack --draft --no-edit --no-interactive
gt submit --update-only --no-edit --no-interactive
gt sync --no-interactive
gt restack --no-interactive
```

Treat bare `gt checkout`, `gt split`, `gt reorder`, bare `gt move`, `gt config`, `--patch`, `--edit`, `--web`, `--confirm`, and `--interactive` as human-interactive.

## Global flags

| Flag | Use |
|---|---|
| `--cwd <path>` | Run from a specific directory. |
| `--no-interactive` | Disable prompts/editors; use by default for agent-run commands. |
| `--no-verify` | Skip git hooks only when the user asks or hooks are known irrelevant. |
| `--quiet` | Reduce output; implies non-interactive in recent `gt` versions. |

## Inspecting state

```bash
git status --short
gt log short
gt log
gt info
gt info --json
```

## Navigation

```bash
gt checkout <branch>
gt up
gt down
gt top
gt bottom
```

Avoid bare `gt checkout`; it opens a picker.

## Creating branches

```bash
# Create a stacked branch from current branch, staging all changes
gt create --all --message "feat: describe change" --no-interactive

# Create a named branch
gt create <branch-name> --all --message "feat: describe change" --no-interactive

# Insert between current branch and child when unambiguous
gt create --insert --all --message "feat: inserted change" --no-interactive
```

Notes:

- Use `git add <files>` first and omit `--all` if only specific files/hunks should be included.
- Avoid `--patch` unless the user is driving the hunk choices interactively.

## Modifying branches

```bash
# Amend current branch with staged changes
gt modify --no-interactive

# Stage all and amend current branch
gt modify --all --no-interactive

# Create a new commit on current branch
gt modify --commit --all --message "fix: describe follow-up" --no-interactive
```

Notes:

- `gt modify` restacks descendants automatically.
- Use `git add <files>` first and omit `--all` for targeted amendments.

## Submitting PRs

```bash
# Submit current branch and ancestors; create any new PRs as drafts
gt submit --draft --no-edit --no-interactive

# Submit current branch, ancestors, and descendants; create any new PRs as drafts
gt submit --stack --draft --no-edit --no-interactive

# Update existing PRs only
gt submit --update-only --no-edit --no-interactive
```

Notes:

- `--no-edit` avoids PR title/body prompts.
- Use `--draft` whenever a submit may create PRs. It affects new PRs without downgrading existing ready PRs.
- Use `--publish` only when the user explicitly asks to publish/request review or repo docs require it. Passing checks alone is not permission to publish.
- Avoid `--web`, `--edit`, and `--confirm` unless the user wants an interactive flow.

## Syncing and restacking

```bash
# Fetch trunk, restack, and clean up according to config/flags
gt sync --no-interactive

# Restack without fetching trunk
gt restack --no-interactive

# Restack all tracked branches
gt restack --all --no-interactive
```

## Moving / reorganizing

```bash
# Move current branch to an explicit parent
gt move --onto <parent-branch> --no-interactive

# Fold current branch into parent
gt fold --no-interactive

# Squash current branch commits
gt squash --message "feat: combined change" --no-interactive
```

Interactive only unless the user asks:

```bash
gt split
gt reorder
gt move
```

## Absorb staged changes

```bash
git add <files>
gt absorb --no-interactive
```

Graphite distributes staged changes to the stack commits that originally touched those lines.

## Collaboration / tracking

```bash
# Fetch another user's stack
gt get <user>/<branch>

# Start managing an existing branch
gt track --parent <parent-branch>

# Stop managing current branch
gt untrack

# Prevent accidental modifications
gt freeze
gt unfreeze
```

## Conflict resolution

```bash
# after a conflict during sync/restack/modify
# edit files...
git add <resolved-files>
gt continue
```

If the resolution is wrong:

```bash
gt abort
```

## Authentication / configuration

```bash
gt auth --token <github-token>
```

`gt auth` without `--token` and `gt config` are interactive. Ask before running them.
