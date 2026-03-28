---
name: ghostty-tab
description: |
  When the user asks to open a tab (e.g., \"open a new tab\", \"new tab\"), you MUST read and follow this skill.
  Uses Ghostty AppleScript.

  You may specify a shell command to run in the new tab using a surface configuration. You may also specify a working directory
  for the new tab.
---
# Open a New Ghostty Tab

When the user asks to open a tab, you MUST run the following AppleScript using `osascript`. If the user requests a command (e.g. "open a new tab and run top"), you MUST launch the tab with a surface configuration specifying that command. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

## With a command and/or working directory
```applescript
tell application "Ghostty"
    set frontWin to front window
    set cfg to new surface configuration
    set command of cfg to "COMMAND_HERE" -- optional
    set initial working directory of cfg to "/desired/path" -- optional
    new tab in frontWin with configuration cfg
end tell
```

Omit the relevant line(s) if not provided by the user.

## Without a command or working directory (default shell, default directory):
```applescript
tell application "Ghostty"
    set frontWin to front window
    new tab in frontWin
end tell
```

Replace `COMMAND_HERE` with the user-specified command, if provided.
Replace `/desired/path` with the user-specified working directory, if provided.

### Example usage:
- "Open a new tab and run `vim main.py` in ~/src"
- "New tab and run `top` in /tmp"
- "Open a new tab in ~/myproject"
- "Run `du -sh .` in a new tab, working directory is /var/log"
