# handoff

Transfer the useful context from the current conversation into a new focused Pi session.

This is adapted from Pi's official [`handoff.ts` example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts). It uses the current model to generate a self-contained prompt from the current session branch, lets you edit that prompt, then creates a new session with the prompt staged in the editor.

## Usage

```text
/handoff <goal for the new session>
```

Examples:

```text
/handoff implement phase two of the plan
/handoff investigate the remaining failing tests
/handoff continue this refactor in a fresh thread
```

The command will:

1. Collect messages from the current branch.
2. Preserve the most recent compaction summary, branch summaries, and extension custom messages when present.
3. Ask the current model to generate a focused handoff prompt.
4. Open the prompt in an editor for review.
5. Create a new session with the edited prompt staged in the editor.

## Notes

- Requires interactive mode because it uses Pi's editor and loader UI.
- Requires a selected model with valid credentials.
- The new session records the current session as its parent when a session file is available.
