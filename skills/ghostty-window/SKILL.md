---
name: ghostty-window
description: |
  When the user asks to open a window or terminal (e.g., \"open a new window\", \"open terminal\"),
  you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty."

  You may specify a shell command to run in the new window using a surface configuration. You may also specify a working directory
  for the new window.
---
# Open a New Ghostty Window

When the user asks to open a window or terminal, run the following AppleScript using `osascript`. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

## With a command and/or working directory
```applescript
tell application "Ghostty"
    set cfg to new surface configuration
    set command of cfg to "COMMAND_HERE" -- optional
    set initial working directory of cfg to "/desired/path" -- optional
    new window with configuration cfg
end tell
```

Omit the relevant line(s) if not provided by the user.

## Without a command or working directory (default shell, default directory):
```applescript
tell application "Ghostty"
    new window
end tell
```

Replace `COMMAND_HERE` with the user-specified command, if provided.
Replace `/desired/path` with the user-specified working directory, if provided.

### Example usage:
- "Open a new window and run `top` in ~/"
- "New window in /usr/local"
- "Run `du -k | sort -n` in a new window, working directory is /opt"
