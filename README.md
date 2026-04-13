# pi-extensions

Personal extensions for the [Pi coding agent](https://buildwithpi.com).

## Extensions

| Extension | Description |
|-----------|-------------|
| [interview](./interview/) | Answer assistant questions in batch via `/answer` command. Extracts questions cheaply, presents a form, sends all answers at once. |
| [secrets](./secrets/) | Load environment variables from ejson secret files into all bash commands. `/secrets` command + `load_secrets` tool. |
| [system-theme](./system-theme/) | Sync pi's theme with macOS/Linux system appearance (dark/light mode). `/system-theme` command to configure. |
| [usage](./usage/) | Display provider usage information (e.g., GitHub Copilot usage/limits) in the status bar. Requires `gh` CLI for GitHub Copilot. |
| [vim](./vim/) | Vi/readline-style modal editing for pi's input editor. Escape for normal mode, `hjkl` navigation, `d/c/y` operators, counts, and more. |
| [web-search](./web-search/) | Web search and page fetching via Gemini API with Google Search grounding. Provides `web_search`, `web_search_summary`, and `web_fetch` tools. Requires `GEMINI_API_KEY`. |

## Skills

| Skill | Description |
|-------|-------------|
| [codeowners](./skills/codeowners/) | Identify code owners for a given file path by locating and evaluating the repository's CODEOWNERS file. |
| [delegate](./skills/delegate/) | Delegate tasks to new pi sessions in other repos via Ghostty panes/tabs. |
| [ghostty](./skills/ghostty/) | Open, split, or manage terminal windows, panes, and tabs using Ghostty via AppleScript on macOS. |
| [gws-docs-markdown](./skills/gws-docs-markdown/) | Create and update Google Docs from markdown content. |

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
