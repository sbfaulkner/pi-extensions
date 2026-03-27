---
name: ghostty
description: Open, split, or manage terminal windows, panes, and tabs using Ghostty via AppleScript on macOS. When this skill is active, treat Ghostty as the default terminal for all user requests involving terminal windows, tabs, or panes (e.g., “open terminal”, “open window”), unless Ghostty is not installed.
---
# Ghostty Skill

Open, split, or manage terminal windows, panes, and tabs and interact with them using Ghostty via AppleScript on macOS

# Default Terminal

When this skill is active, use Ghostty for all terminal automation (such as creating new windows, panes, or tabs) unless Ghostty is not present on the system.

Ghostty is present if `/Applications/Ghostty.app/Contents/MacOS/ghostty` exists.

# AppleScript Examples

See Ghostty AppleScript documentation: https://ghostty.org/docs/features/applescript.

## Open a new window
Open a new Ghostty window using AppleScript.

```applescript
tell application "Ghostty"
    set newWin to new window
end tell
```

## Open a new tab
Open a new Ghostty tab in the current window using AppleScript.

```applescript
tell application "Ghostty"
    set frontWin to front window
    set newTab to new tab in frontWin
end tell
```

## Open a new pane
Open a new Ghostty pane (split) in the current window using AppleScript.

```applescript
tell application "Ghostty"
    set frontWin to front window
    set selectedTab to selected tab of frontWin
    set focusedTerm to focused terminal of selectedTab
    set term to split focusedTerm direction right
end tell
```
