---
name: ghostty-pane
description: |
  When the user asks to open a pane or split a window (e.g., "split the window", "new pane", "split right", "split horizontal"), you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty.
---

# Open a New Ghostty Pane (Split Terminal)

When the user asks to open a pane or split a window in Ghostty, you MUST:

1. Determine the direction:
   - Supported: `right`, `left`, `up`, `down`
   - If the user says `horizontal`, use `right`; if `vertical`, use `down`.
   - Default: `right` if direction is not specified

2. Run the following AppleScript (via `osascript`):

```applescript
tell application "Ghostty"
    set frontWin to front window
    set selectedTab to selected tab of frontWin
    set focusedTerm to focused terminal of selectedTab
    split focusedTerm direction DIRECTION
end tell
```

Replace `DIRECTION` with the chosen direction.
