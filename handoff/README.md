# handoff

Transfer the useful context from the current conversation into a new focused Pi session — either replacing the current session in-place, or spawning a new Ghostty pane/tab/window (optionally in a different repo).

This is adapted from Pi's official [`handoff.ts` example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts). It uses the current model to extract intent (where the new session should run) and synthesize a self-contained prompt from the current session branch, then confirms the spawn target (when delegating), opens the prompt in an editor for review, and either creates a new in-process session or spawns a Ghostty pane/tab/window with `pi` pre-loaded with the prompt.

## Commands

The extension registers two commands that share one handler. They differ only in what mode they assume when you don't say:

| Command | Default mode | Use it for |
|---|---|---|
| `/handoff <text>` | `in-process` — **replaces** the current session | "Continue this work in a fresh thread, here." Compaction substitute. |
| `/delegate <text>` | `pane` (current cwd) — spawns a parallel Ghostty pane; **current session continues** | Forking work to run in parallel, in this repo or another. |

Either command can reach any mode via natural language — only the unspecified default differs. So `/handoff in a new pane, ...` works, and `/delegate continue here in a fresh thread` (i.e. `in-process`) works too.

## Usage

```text
/handoff <free-text instruction>
/delegate <free-text instruction>
```

The instruction is natural language — no flags. Examples:

```text
# Replace the current session (default for /handoff).
/handoff implement phase two of the plan

# Fork to a parallel pane in this repo (default for /delegate).
/delegate finish the migration

# Fork to a parallel pane in another repo (resolved via ~/src/github.com/<org>/<repo>).
/delegate in edgey, add an alibaba_origin block type

# New tab in another repo, current session continues.
/delegate in a new tab in shopify-cli, port the same fix

# New window for a clean slate.
/delegate in a new window, audit the dependency surface

# Use /handoff to fork without replacing (override its default):
/handoff in a new pane, keep working on this here
```

## Session lifecycle

The two old commands (`handoff` and the `delegate` skill) had different effects on the current session. Both behaviors are preserved — picking `/handoff` vs `/delegate` is just a shortcut for the default; the actual effect is determined by the resolved mode:

| Mode | Current session | New session | Use it for |
|---|---|---|---|
| `in-process` (default) | **Replaced.** Recorded as `parentSession` of the new session. The conversation here ends. | Starts in the current pi instance, in the current cwd, with the staged prompt. | "Continue this work in a fresh thread" — same as the old `/handoff`. |
| `pane` / `tab` / `window` | **Preserved.** No `newSession` call. You can keep working here. | Runs **asynchronously** in a new Ghostty surface as a separate `pi` process. | Forking work to run in parallel, including in another repo — same as the old `delegate` skill. |

So:

- `/handoff continue the refactor` → in-process → current session ends.
- `/delegate continue the refactor` → pane in current cwd → current session continues, fork runs in parallel. (This is a new capability — neither old command did this directly.)
- `/delegate in edgey, port the same fix` → pane in another repo → current session continues, work happens elsewhere.
- `/handoff in a new pane, continue the refactor` → same as the `/delegate` example above; the natural-language override beats the command default.

## What it does

1. **Capture Ghostty anchors synchronously at command entry** — the front window id *and* the focused terminal surface's stable id. A later pane spawn splits the **exact** surface you invoked from, regardless of where focus is when the spawn actually runs. Tab spawn targets the captured window. (Strict race fix vs. the old `delegate` skill, which captured nothing.)
2. **Collect messages from the current branch**, preserving the most recent compaction summary, branch summaries, and extension custom messages.
3. **Ask the current model to return a JSON intent** with `mode` (`in-process` / `pane` / `tab` / `window`), `direction` (for pane), `targetDir` (resolved repo nickname or path), and a self-contained `prompt`.
4. **Confirm** the resolved directory and spawn target when delegating, so you can catch a wrong nickname guess.
5. **Open the prompt in an editor** for review/editing.
6. **Either** replace the current session with the edited prompt staged, **or** write the prompt to a temp file and spawn a Ghostty pane/tab/window running `pi-delegate @<taskfile>` (which re-execs under a login shell so PATH/nix/shadowenv all work).

## Notes

- Requires interactive mode (uses Pi's editor, confirm, and loader UI).
- Requires a selected model with valid credentials.
- The in-process new session records the current session as its parent when a session file is available.
- Repo nickname resolution uses the convention `~/src/github.com/<org>/<repo>`. The LLM resolves nicknames; the confirmation step lets you correct mistakes before anything spawns.
- Ghostty delegation only works on macOS (uses AppleScript). On other platforms, only `in-process` mode is useful.

## Why this subsumes the old `delegate` skill

The `skills/delegate/` skill has been removed. Two reasons it's no longer needed:

1. `/delegate` is now a real slash command with its own description and autocomplete entry — you can discover it the same way as any other command.
2. The old skill existed mostly to tell the agent to recommend `/handoff` when you said "delegate this". Now "delegate" matches the literal command name, so the routing is implicit.

The previous `delegate` skill had three weaknesses that this extension fixes:

1. **Manual prompt authoring.** The skill asked the model to dump context into a markdown file from memory only ("do not research"). Handoff already had proper context synthesis from the session branch — same machinery now produces delegation prompts.
2. **Same code path.** Delegation and handoff differed only in *where* the new session runs. One extension, one prompt-synthesis step, one editor review.
3. **Race condition.** The old AppleScript captured `front window` at *execution time*, so switching Ghostty windows between invocation and execution dropped the new pane in the wrong place. The extension now captures **stable ids for the focused terminal surface and its window** synchronously at command entry (Ghostty exposes both per its scripting dictionary) and passes `--terminal-id` / `--window-id` to the AppleScript. Pane spawns split the exact captured surface; tab spawns target the captured window. The resolution chain falls back through window-id → front window → new window if anchors are gone by spawn time.
