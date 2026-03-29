---
name: ghostty-pane
description: |
  When the user asks to open a pane or split a window (e.g., "split the window", "new pane", "split right", "split horizontal"),
  you MUST read and follow this skill. Uses Ghostty AppleScript.

  You may specify a shell command to run in the new pane using a surface configuration. You may also specify a working directory
  for the new pane.
---

# Open a New Ghostty Pane (Split Terminal)

When the user asks to open a pane or split a window in Ghostty, you MUST:

1. Determine the direction:
   - Supported: `right`, `left`, `up`, `down`
   - If the user says `horizontal`, use `right`; if `vertical`, use `down`.
   - Default: `right` if direction is not specified

2. Run the provided AppleScript file via `osascript`:

        osascript scripts/ghostty-pane.applescript [--direction DIR] [--cmd CMD] [--dir PATH]

### Options
- `--direction DIR` — Split direction: `right` (default), `left`, `up`, `down`
- `--cmd CMD` — Shell command to run in the new pane
- `--dir PATH` — Initial working directory

Omit any options that are not needed.

### Examples
- `osascript scripts/ghostty-pane.applescript`
- `osascript scripts/ghostty-pane.applescript --direction right --cmd "top"`
- `osascript scripts/ghostty-pane.applescript --direction down --dir "/var/log"`
- `osascript scripts/ghostty-pane.applescript --cmd "htop"`
- `osascript scripts/ghostty-pane.applescript --direction left --cmd "vi myfile.txt" --dir "~/projects"`
