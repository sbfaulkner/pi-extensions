---
name: ghostty-tab
description: |
  When the user asks to open a tab (e.g., \"open a new tab\", \"new tab\"), you MUST read and follow this skill.
  Uses Ghostty AppleScript.

  You may specify a shell command to run in the new pane using a surface configuration.
---
# Open a New Ghostty Tab

When the user asks to open a tab, you MUST run the following AppleScript using `osascript`. If the user requests a command (e.g. "open a new tab and run top"), you MUST launch the tab with a surface configuration specifying that command. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

## With a command
```applescript
tell application "Ghostty"
    set frontWin to front window
    set cfg to new surface configuration
    set command of cfg to "COMMAND_HERE"
    new tab in frontWin with configuration cfg
end tell
```

## Without a command (default shell):
```applescript
tell application "Ghostty"
    set frontWin to front window
    new tab in frontWin
end tell
```

Replace `COMMAND_HERE` with the user-specified command, if provided.

### Example usage:
- "Open a new tab and run `vim main.py`"
- "New tab and run `top`"
- "Open a new tab and run `htop`"
- "Run `ping google.com` in a new tab"
