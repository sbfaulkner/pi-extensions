# pi-extensions

Personal extensions for the [Pi coding agent](https://buildwithpi.com).

## Extensions

| Extension | Description |
|-----------|-------------|
| [interview](./interview/) | Answer assistant questions in batch via `/answer` command. Extracts questions cheaply, presents a form, sends all answers at once. |
| [secrets](./secrets/) | Load environment variables from ejson secret files into all bash commands. `/secrets` command + `load_secrets` tool. |
| [system-theme](./system-theme/) | Sync pi's theme with macOS/Linux system appearance (dark/light mode). `/system-theme` command to configure. |
| [usage](./usage/) | Display provider usage information (e.g., GitHub Copilot usage/limits) in the status bar. Requires `gh` CLI for GitHub Copilot. |
| [vendor-docs](./vendor-docs/) | Status bar showing vendor documentation cache size and budget usage. Companion to the vendor-docs skill. |
| [vim](./vim/) | Vi/readline-style modal editing for pi's input editor. Escape for normal mode, `hjkl` navigation, `d/c/y` operators, counts, and more. |

## Skills

| Skill | Description |
|-------|-------------|
| [ghostty](./skills/ghostty) | Open, split, or manage terminal windows, panes, and tabs and interact with them using Ghostty via AppleScript on macOS. |
| [vendor-docs](./skills/vendor-docs) | Fetch vendor documentation into a local searchable cache and search it with ripgrep. Fetch once, search many times, refresh when needed. |

## Install

Add to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "git:github.com/sbfaulkner/pi-extensions"
  ]
}
```

To enable only a subset:

```json
{
  "packages": [
    {
      "source": "git:github.com/sbfaulkner/pi-extensions",
      "extensions": ["secrets/index.ts", "system-theme/index.ts"]
    }
  ]
}
```

## Local Development

If you keep a local clone, add to settings:

```json
{
  "packages": [
    "~/src/github.com/sbfaulkner/pi-extensions",
  ]
}
```
