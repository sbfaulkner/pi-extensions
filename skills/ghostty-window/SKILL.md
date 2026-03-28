---
name: ghostty-window
description: |
  When the user asks to open a window or terminal (e.g., \"open a new window\", \"open terminal\"),
  you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty."

  You may specify a shell command to run in the new pane using a surface configuration.
---
# Open a New Ghostty Window

When the user asks to open a window or terminal, run the following AppleScript using `osascript`. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

## With a command
```applescript
tell application "Ghostty"
    set cfg to new surface configuration
    set command of cfg to "COMMAND_HERE"
    new window with configuration cfg
end tell
```

## Without a command (default shell):
```applescript
tell application "Ghostty"
    new window
end tell
```

Replace `COMMAND_HERE` with the user-specified command, if provided.

### Example usage:
- "Open a new window and run `top`"
- "New window and run `htop`"
- "Run `sudo vi /etc/hosts` in a new window"
