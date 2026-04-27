---
name: delegate
description: |
  Delegate a task to a new pi session in a different directory/repo. **Do not explore or
  research the target repo first — read this skill immediately and write the task file using
  only context already in the conversation.** The receiving session handles all research.
  Use when the user says "delegate this to X", "run this in the edgey repo", "send this task
  to ...", or when you identify work that should be done in another repo as part of a
  multi-repo workflow. Opens a new Ghostty pane (default) or tab with pi running in the
  target directory, pre-loaded with the task.
---

# Delegate a Task to a New Pi Session

Use this skill to spin up a new pi session in a separate Ghostty pane (default) or tab,
targeting a specific directory, with a task prompt pre-loaded.

## Steps

1. **Create the task file**: Use `mktemp` to create a temporary markdown file, then write the
   task description, context, and acceptance criteria into it. The file should be self-contained —
   the receiving pi session won't have your current conversation context.

   ```bash
   tmpdir="${TMPDIR:-/tmp}"
   mktemp "${tmpdir%/}/pi-delegate-XXXXXX"
   ```

   The first line of the task file must instruct the receiving session to clean up:

   > **Before starting, delete this task file:** `rm <taskfile>`

   Good task files include:
   - **Cleanup instruction** (first line, as above)
   - **What** to do (clear, specific)
   - **Why** (enough context to make good decisions)
   - **Acceptance criteria** (how to know it's done)
   - **References** to specific files/patterns if relevant

2. **Open a Ghostty pane** (default) or tab with pi running in the target directory, passing the task file.
   Wrap the command in `$SHELL -lic "..."` so the new surface gets the user's full interactive
   login shell environment (PATH, environment variables, Nix, etc.) — the same as a normal terminal.
   Use the `pi-with-env` wrapper instead of calling `pi` directly — it activates per-directory
   environment managers (e.g. shadowenv) that otherwise won't fire without a prompt.

   **Default — split pane (right):**

       osascript scripts/ghostty-pane.applescript --direction right --cmd "$SHELL -lic 'scripts/pi-with-env @<taskfile>'" --dir "<target_directory>"

   **If the user asks for a tab instead:**

       osascript scripts/ghostty-tab.applescript --cmd "$SHELL -lic 'scripts/pi-with-env @<taskfile>'" --dir "<target_directory>"

3. **Inform the user** which pane/tab was opened and what task was delegated.

## Example

User says: "Delegate to edgey: add a new `alibaba_origin` block type that supports region and bucket fields"

1. Create the task file and write it:
   ```bash
   tmpdir="${TMPDIR:-/tmp}"
   mktemp "${tmpdir%/}/pi-delegate-XXXXXX"
   # e.g. returns /tmp/pi-delegate-a1b2c3
   ```
   ```markdown
   **Before starting, delete this task file:** `rm /tmp/pi-delegate-a1b2c3`

   # Task: Add `alibaba_origin` block type

   ## Context
   We're adding Alibaba Cloud CDN support. This requires a new origin block type in edgey.

   ## What to do
   - Add a new `alibaba_origin` block type to the edgey DSL
   - It should support `region` and `bucket` fields
   - Follow the same pattern as existing origin block types (see `aws_origin` for reference)

   ## Acceptance criteria
   - [ ] New block type parses correctly
   - [ ] Tests pass
   - [ ] Generated terraform output is valid
   ```

2. Run:
   ```
   osascript scripts/ghostty-pane.applescript \
     --direction right \
     --cmd "$SHELL -lic 'scripts/pi-with-env @/tmp/pi-delegate-a1b2c3'" \
     --dir ~/src/github.com/Shopify/edgey
   ```

## Tips

- Make task files **self-contained**. The new session has no memory of this conversation.
- Include file paths and pattern references so the new session can orient quickly.
- For tasks with dependencies (do X before Y), delegate them one at a time.
- You can delegate multiple independent tasks in parallel (one tab each).
- The user can check on delegated sessions by switching Ghostty tabs.
