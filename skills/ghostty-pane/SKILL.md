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

2. Run the following AppleScript (via `osascript`). If the user requests a command to run in the new pane (e.g. "split right and run `vi myfile.txt`"), you MUST launch the pane with a surface configuration specifying that command.

## With a command and/or working directory
```applescript
tell application "Ghostty"
    set frontWin to front window
    set selectedTab to selected tab of frontWin
    set focusedTerm to focused terminal of selectedTab
    set cfg to new surface configuration
    set command of cfg to "COMMAND_HERE" -- optional
    set initial working directory of cfg to "/desired/path" -- optional
    split focusedTerm direction DIRECTION with configuration cfg
end tell
```

Omit the relevant line(s) if not provided by the user.

## Without a command or working directory (default shell, default directory):
```applescript
tell application "Ghostty"
    set frontWin to front window
    set selectedTab to selected tab of frontWin
    set focusedTerm to focused terminal of selectedTab
    split focusedTerm direction DIRECTION
end tell
```

Replace `DIRECTION` with the chosen direction and `COMMAND_HERE` with the user-specified command, if provided.

### Example usage:
- "Split right and run `vi myfile.txt` in ~/projects"
- "Split down and run `npm run dev` in /tmp"
- "Split left in ~/myfolder"
- "Split up and run `htop`"
- "Run `find . -name .git -prune -o -type f -print` in a new pane split vertically, working directory is /var/log"
