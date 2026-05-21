---
name: graphite
description: Use when working in a Graphite-managed repository, using `gt` commands, creating or updating stacked PRs, syncing/restacking stacks, or when the user mentions Graphite, stacked PRs, `gt create`, `gt modify`, `gt submit`, `gt sync`, or merge queues.
---

# Graphite

Graphite manages stacked GitHub PRs with the `gt` CLI. This skill is intentionally operational: it tells agents which commands to run safely, not the product philosophy.

Repo docs and user instructions always win. If `AGENTS.md` or project docs say not to use Graphite, follow those instructions instead.

## Agent-safe command rules

Prefer explicit, non-interactive commands. Avoid commands that open pickers, prompts, editors, pagers, or browser windows unless the user explicitly asks for an interactive flow.

Safe defaults:

```bash
# Inspect before changing anything
gt log short
git status --short

# Navigation: always name the branch instead of opening the picker
gt checkout <branch>

# Create/modify branches with explicit staging and message choices
gt create --all --message "feat: describe change" --no-interactive
gt modify --all --no-interactive
gt modify --commit --all --message "fix: describe follow-up" --no-interactive

# Submit without opening PR metadata editors
gt submit --stack --no-edit --no-interactive
gt submit --update-only --no-edit --no-interactive

# Sync/restack without prompting
gt sync --no-interactive
gt restack --no-interactive
```

Avoid or ask before running:

- Bare `gt checkout` — opens a branch picker. Use `gt checkout <branch>`.
- Bare `gt submit` / `gt submit --stack` — may open PR metadata prompts. Add `--no-edit --no-interactive`.
- `gt split`, `gt reorder`, bare `gt move`, `gt config`, `gt create --patch`, `gt modify --patch` — require human choices.
- Any command with `--web`, `--edit`, `--confirm`, or `--interactive`.

Plain `git` is still appropriate for status, diffs, staging specific files, and conflict resolution. Use `gt` for Graphite-aware branch creation, modify/amend, stack navigation, restacking/syncing, and PR submission.

## Common commands

| Goal | Command |
|---|---|
| View stack | `gt log short` |
| Switch branch | `gt checkout <branch>` |
| Create stacked branch from current branch | `gt create --all --message "msg" --no-interactive` |
| Amend current branch with all changes | `gt modify --all --no-interactive` |
| Add a new commit on current branch | `gt modify --commit --all --message "msg" --no-interactive` |
| Submit current branch + ancestors | `gt submit --no-edit --no-interactive` |
| Submit whole stack | `gt submit --stack --no-edit --no-interactive` |
| Update only existing PRs | `gt submit --update-only --no-edit --no-interactive` |
| Sync with trunk and cleanup | `gt sync --no-interactive` |
| Restack without fetching trunk | `gt restack --no-interactive` |
| Move branch to explicit parent | `gt move --onto <parent-branch> --no-interactive` |
| Fold branch into parent | `gt fold --no-interactive` |
| Apply staged changes to owning commits | `gt absorb --no-interactive` |

## Workflows

### Start a new stack

```bash
gt checkout main
# make changes...
gt create --all --message "feat: first focused change" --no-interactive

# make dependent changes...
gt create --all --message "feat: dependent focused change" --no-interactive

gt submit --stack --no-edit --no-interactive
```

### Address review feedback

```bash
gt checkout <branch-needing-changes>
# edit files...
gt modify --all --no-interactive
gt submit --stack --no-edit --no-interactive
```

If you only want to update PRs that already exist:

```bash
gt submit --update-only --no-edit --no-interactive
```

### Add a new branch in the middle of a stack

If there is a single obvious child, `--insert` can be used non-interactively. If multiple children exist, Graphite may need a human choice.

```bash
gt checkout <parent-branch>
# make changes...
gt create --insert --all --message "feat: inserted change" --no-interactive
```

If Graphite prompts because there are multiple children, stop and ask the user which child should move onto the new branch.

### Sync / restack

Use `gt sync` when you need latest trunk from remote:

```bash
gt sync --no-interactive
```

Use `gt restack` when local parent relationships changed but you do not need to fetch trunk:

```bash
gt restack --no-interactive
```

### Resolve conflicts

```bash
# after gt sync/restack reports conflicts
# edit conflicted files...
git add <resolved-files>
gt continue
```

If conflicts cascade up the stack, resolve each branch in order as Graphite asks.

### Split or reorder a stack

`gt split` and `gt reorder` are interactive. Do not run them unattended. Ask the user first, or perform an explicit manual split with `gt create`, `git add <files>`, and `gt modify` if the desired branch boundaries are already clear.

## References

- `references/commands.md` — concise command reference with safe defaults.
- `references/stacking-workflows.md` — workflow recipes for common stack operations.
