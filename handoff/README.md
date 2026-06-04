# handoff

Transfer the useful context from the current conversation into a new focused Pi session — either replacing the current session in-place, or spawning a new Ghostty pane/tab/window (optionally in a different repo).

This is adapted from Pi's official [`handoff.ts` example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts). It uses the current model to extract intent (where the new session should run) and synthesize a self-contained prompt from the current session branch, then confirms the spawn target (when delegating), opens the prompt in an editor for review, and either creates a new in-process session or spawns a Ghostty pane/tab/window with `pi` pre-loaded with the prompt.

## Usage

```text
/handoff <free-text instruction>
```

The instruction is natural language — no flags. Examples:

```text
# Replace the current session (default).
/handoff implement phase two of the plan

# Split a Ghostty pane to the right and continue there.
/handoff in a new pane, finish the migration

# New tab in another repo (resolved via ~/src/github.com/<org>/<repo>).
/handoff in the edgey repo, add an alibaba_origin block type

# New window for a clean slate.
/handoff in a new window, audit the dependency surface
```

## Session lifecycle

The two old commands (`handoff` and `delegate`) had different effects on the current session. The unified `/handoff` preserves both behaviors — which one you get is inferred from the mode the model picks:

| Mode | Current session | New session | Use it for |
|---|---|---|---|
| `in-process` (default) | **Replaced.** Recorded as `parentSession` of the new session. The conversation here ends. | Starts in the current pi instance, in the current cwd, with the staged prompt. | "Continue this work in a fresh thread" — same as the old `/handoff`. |
| `pane` / `tab` / `window` | **Preserved.** No `newSession` call. You can keep working here. | Runs **asynchronously** in a new Ghostty surface as a separate `pi` process. | Forking work to run in parallel, including in another repo — same as the old `delegate` skill. |

So:

- `/handoff continue the refactor` → in-process → current session ends.
- `/handoff in a new pane, continue the refactor` → spawn pane in current cwd → current session continues, fork runs in parallel. (This is a new capability — neither old command did this directly.)
- `/handoff in edgey, port the same fix` → spawn pane in another repo → current session continues, work happens elsewhere.

## What it does

1. **Capture the current Ghostty window id** synchronously at command entry — so if you Cmd-Tab around or switch Ghostty windows while the LLM is thinking, a delegated pane/tab still lands in the window you invoked from. (Race fix vs. the old `delegate` skill.)
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

The previous `delegate` skill had three weaknesses that this extension fixes:

1. **Manual prompt authoring.** The skill asked the model to dump context into a markdown file from memory only ("do not research"). Handoff already had proper context synthesis from the session branch — same machinery now produces delegation prompts.
2. **Same code path.** Delegation and handoff differed only in *where* the new session runs. One extension, one prompt-synthesis step, one editor review.
3. **Race condition.** The old AppleScript captured `front window` at *execution time*, so switching Ghostty windows between invocation and execution dropped the new pane in the wrong place. The extension now captures the window id synchronously at command entry and passes `--window-id` to the AppleScript, with a `new window` fallback if the captured window is gone by spawn time.
