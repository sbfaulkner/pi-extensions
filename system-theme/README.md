# system-theme

Syncs pi's theme with your system appearance (dark/light mode).

## Behavior

- Dark system appearance → configured `darkTheme` (default: `dark`)
- Light system appearance → configured `lightTheme` (default: `light`)
- Polls every 2 seconds (configurable)

## Detection

| Platform | Method |
|----------|--------|
| macOS | `/usr/bin/defaults read -g AppleInterfaceStyle` |
| Linux | `gsettings get org.gnome.desktop.interface color-scheme` (fallback: `gtk-theme`) |

If detection fails, the current theme is left unchanged.

## Configuration

Use `/system-theme` to interactively configure:

1. Dark theme name
2. Light theme name
3. Poll interval (ms)

Overrides are persisted to `~/.pi/agent/system-theme.json`:

```json
{
    "darkTheme": "rose-pine",
    "lightTheme": "rose-pine-dawn"
}
```

## Notes

- If your current theme is custom and neither `darkTheme` nor `lightTheme` have been configured, the extension does nothing (won't override your custom theme).
- If a configured theme name doesn't exist in pi, it logs a warning and keeps the current theme.
- Inactive in headless/print mode.
