---
name: ghostty-tab
description: "When the user asks to open a tab (e.g., \"open a new tab\", \"new tab\"), you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty."
---
# Open a New Ghostty Tab

When the user asks to open a tab, run the following AppleScript using `osascript`. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

```bash
osascript -e 'tell application "Ghostty"
    set frontWin to front window
    new tab in frontWin
end tell'
```
