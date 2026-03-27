---
name: ghostty-window
description: "When the user asks to open a window or terminal (e.g., \"open a new window\", \"open terminal\"), you MUST read and follow this skill. Uses Ghostty AppleScript. Never use `open -a` or `open -na` for Ghostty."
---
# Open a New Ghostty Window

When the user asks to open a window or terminal, run the following AppleScript using `osascript`. Do NOT use `open -a Ghostty` or `open -na Ghostty`.

```bash
osascript -e 'tell application "Ghostty" to new window'
```
