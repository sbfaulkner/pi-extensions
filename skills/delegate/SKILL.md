---
name: delegate
description: |
  Delegate a task to a new pi session in a different repo/pane/tab/window. Use when the
  user says "delegate this to X", "run this in the edgey repo", "send this task to ...",
  or any other phrasing that means "spin up a new pi session somewhere else." The actual
  mechanism is the `/handoff` extension command — this skill exists to tell you to use it.
---

# Delegate to a New Pi Session

**Use the `/handoff` command.** It supersedes the old standalone delegate skill.

## What to do

When the user asks you to delegate a task, **construct and show them the exact `/handoff`
invocation to run.** You cannot invoke the slash command for them — the user must type it.
Do NOT write a temp file or call `osascript` yourself.

Template:

```text
/handoff <where>, <what>
```

Where `<where>` is one of:

- `in a new pane` / `in a new pane below` / `in a new pane on the left` (etc.)
- `in a new tab`
- `in a new window`
- `in <repo nickname>` (e.g. `in edgey`, `in the shopify-cli repo`) — spawns a pane
  in that repo by default.
- `in <repo nickname> in a new tab` / `in <path> in a new window` (combine where needed).
- (omit entirely for in-process, which **replaces** the current session.)

And `<what>` is a one-sentence description of the task. The extension will synthesize
the full self-contained context prompt from the current conversation, so don't write a
long task description — a sentence is enough.

### Pick the right mode

- Delegating to **another repo** → the user wants their current work to continue.
  Default to pane (`/handoff in edgey, …`) so the current session stays intact and the
  delegated task runs in parallel.
- Delegating in the **same repo** but the user wants the current session preserved →
  add an explicit `in a new pane` / `tab` / `window`.
- Continuing the same conversation **in a fresh thread, same place** (i.e. compaction
  substitute) → plain `/handoff <task>`. This replaces the current session.

The `/handoff` extension will:

1. Synthesize a self-contained prompt from the current conversation (no manual context-dumping).
2. Capture the current Ghostty window synchronously, so a delegated pane/tab still lands in
   the right window even if focus moves while the model is thinking.
3. Detect the mode and target directory from the natural-language instruction
   (`in-process` / `pane` / `tab` / `window`, and an optional repo/path).
4. Confirm the resolved directory before spawning, so wrong repo nickname guesses can be
   corrected.
5. Open the prompt in an editor for review/editing.
6. Either replace the current session in-place or spawn a Ghostty pane/tab/window running
   `pi` with the prompt pre-loaded.

## Example phrasings handled by /handoff

```text
/handoff in the edgey repo, add an alibaba_origin block type
/handoff in a new tab in shopify-cli, port the same fix
/handoff in a new pane, finish phase two of the migration
/handoff in a new window, audit the dependency surface
/handoff continue the refactor in a fresh thread        # in-process (default)
```

## Conventions

- Repo nicknames resolve to `~/src/github.com/<org>/<repo>` (defaults org to `Shopify` when
  not specified). The confirmation step lets you fix wrong guesses before spawning.
- Ghostty delegation is macOS-only (AppleScript). On other platforms, only the default
  in-process mode is useful.

## See also

- [handoff extension](../../handoff/README.md) — implementation, scripts, and full UX
  details.
