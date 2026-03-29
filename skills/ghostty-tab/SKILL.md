---
name: ghostty-tab
description: |
  When the user asks to open a tab (e.g., \"open a new tab\", \"new tab\"), you MUST read and follow this skill.
  Uses Ghostty AppleScript.

  You may specify a shell command to run in the new tab using a surface configuration. You may also specify a working directory
  for the new tab.
---
# Open a New Ghostty Tab

When the user asks to open a tab, run the provided AppleScript file via `osascript`.
Do NOT use `open -a Ghostty` or `open -na Ghostty`.

    osascript scripts/ghostty-tab.applescript [--cmd CMD] [--dir PATH]

### Options
- `--cmd CMD` — Shell command to run in the new tab
- `--dir PATH` — Initial working directory

Omit any options that are not needed.

### Examples
- `osascript scripts/ghostty-tab.applescript`
- `osascript scripts/ghostty-tab.applescript --cmd "top"`
- `osascript scripts/ghostty-tab.applescript --dir "~/src"`
- `osascript scripts/ghostty-tab.applescript --cmd "vim main.py" --dir "~/src"`
