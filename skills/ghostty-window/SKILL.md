---
name: ghostty-window
description: |
  When the user asks to open a window or terminal (e.g., \"open a new window\", \"open terminal\"),
  you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty."

  You may specify a shell command to run in the new window using a surface configuration. You may also specify a working directory
  for the new window.
---
# Open a New Ghostty Window

When the user asks to open a window or terminal, run the provided AppleScript file via `osascript`.
Do NOT use `open -a Ghostty` or `open -na Ghostty`.

    osascript scripts/ghostty-window.applescript [--cmd CMD] [--dir PATH]

### Options
- `--cmd CMD` — Shell command to run in the new window
- `--dir PATH` — Initial working directory

Omit any options that are not needed.

### Examples
- `osascript scripts/ghostty-window.applescript`
- `osascript scripts/ghostty-window.applescript --cmd "top"`
- `osascript scripts/ghostty-window.applescript --dir "/tmp"`
- `osascript scripts/ghostty-window.applescript --cmd "du -k | sort -n" --dir "/opt"`
