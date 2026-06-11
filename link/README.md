# link

Create Slack-pastable GitHub PR link lines and copy them to the clipboard with both rich HTML and plain-text representations.

## Command

```text
/link [PR number/URL/branch ...]
```

- With no arguments, `/link` uses the current branch's PR.
- With arguments, each ref is resolved in order with `gh pr view`; refs can be PR numbers, PR URLs, or branch names accepted by GitHub CLI.
- The transcript output is exactly one markdown line per PR:

```text
👀 [#<number> <title>](<url>) `+<additions>/-<deletions>`
```

The command also copies:

- plain text: the same markdown line(s), joined with newlines
- rich HTML: clickable anchor(s), joined with `<br>`

## Requirements

- `gh` must be installed and authenticated for the target repository.
- Rich clipboard copy uses macOS `osascript`. On other platforms, the command still emits the link line in the transcript but reports clipboard failure.

## Test mode

Set `LINK_SKIP_CLIPBOARD=1` to emit the link line without touching the system clipboard.

```bash
LINK_SKIP_CLIPBOARD=1 pi
```
