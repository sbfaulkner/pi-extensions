# Graphite Stacking Workflows

Workflow recipes for Graphite-managed stacked PRs. Use explicit non-interactive command forms unless the user asks for an interactive picker/editor.

## Before changing anything

```bash
git status --short
gt log short
```

Confirm the current branch and stack shape before creating, modifying, moving, or submitting branches.

## Start a new stack

```bash
gt checkout main

# First focused change
# edit files...
gt create --all --message "feat: first focused change" --no-interactive

# Dependent change on top
# edit files...
gt create --all --message "feat: dependent focused change" --no-interactive

# Open/update PRs for the whole stack; create any new PRs as drafts
gt submit --stack --draft --no-edit --no-interactive
```

`--draft` affects newly created PRs without downgrading existing ready PRs. Keep new PRs in draft until the user explicitly
asks to publish/request review or repo docs require it. Passing checks alone is not permission to publish. When explicitly
requested, publish the intended submitted PRs with `gt submit --publish --no-edit --no-interactive` (add `--stack` only
when the whole stack should be published).

## Add another PR on top of the current stack

```bash
# Ensure you are at the intended parent/top branch
gt log short
gt checkout <top-branch>

# edit files...
gt create --all --message "feat: next focused change" --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

## Address review feedback on one branch

```bash
gt checkout <branch-needing-feedback>
# edit files...
gt modify --all --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

Graphite automatically restacks descendants after `gt modify`.

If only existing PRs should be updated:

```bash
gt submit --update-only --no-edit --no-interactive
```

## Add a branch in the middle of a stack

If there is a single obvious child:

```bash
gt checkout <parent-branch>
# edit files...
gt create --insert --all --message "feat: inserted change" --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

If Graphite prompts because multiple children exist, stop and ask which child should move onto the new branch.

Alternative explicit flow:

```bash
gt checkout <parent-branch>
# edit files...
gt create --all --message "feat: inserted change" --no-interactive
gt checkout <child-branch>
gt move --onto <new-branch> --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

## Sync with trunk

```bash
gt sync --no-interactive
```

Use this when you need latest trunk from remote. It fetches trunk, restacks branches, and cleans up according to Graphite config/flags.

If you only need to reapply stack relationships locally:

```bash
gt restack --no-interactive
```

## Resolve conflicts

When `gt sync`, `gt restack`, or `gt modify` reports conflicts:

```bash
# inspect and edit conflicted files
git status --short
# edit files...
git add <resolved-files>
gt continue
```

Conflicts may cascade up the stack. Resolve each branch in the order Graphite requests.

## Absorb drive-by fixes into the right branches

```bash
# Stage only changes that should be absorbed
git add <files>
gt absorb --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

Use this when fixes belong to existing commits/branches in the stack rather than a new branch.

## Move a branch to another parent

```bash
gt checkout <branch-to-move>
gt move --onto <new-parent-branch> --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

Avoid bare `gt move`; it asks for interactive parent selection.

## Fold a branch into its parent

```bash
gt checkout <branch-to-fold>
gt fold --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

This removes the folded branch and puts its changes into the parent.

## Split or reorder a stack

These are interactive operations:

```bash
gt split
gt reorder
```

Do not run them unattended. Ask the user first, or manually perform the requested split with explicit `gt create`, `git add <files>`, and `gt modify` commands if the branch boundaries are already clear.

## Work on someone else's stack

```bash
gt get <user>/<branch>
gt log short
gt checkout <branch-to-edit>
# edit files...
gt modify --all --no-interactive
gt submit --stack --draft --no-edit --no-interactive
```

Coordinate before changing shared branches.

