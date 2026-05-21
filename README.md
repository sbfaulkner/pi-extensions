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
| [git-workflow](./git-workflow/) | Auto-detect git workflow (local git, non-GitHub remotes, standard GitHub PRs, or Graphite) and inject context hints. `/workflow` command to manage configured Graphite orgs. |

## Skills

| Skill | Description |
|-------|-------------|
| [codeowners](./skills/codeowners/) | Identify code owners for a given file path by locating and evaluating the repository's CODEOWNERS file. |
| [delegate](./skills/delegate/) | Delegate tasks to new pi sessions in other repos via Ghostty panes/tabs. Includes AppleScript for pane, tab, and window management. |
| [gh-cli](./skills/gh-cli/) | Safe GitHub CLI patterns for PR/issue bodies, comments, and generated multi-line content. |
| [git-workflow](./skills/git-workflow/) | Local git workflow guidance for repositories with no remote configured (no `gh`/PR commands). |
| [github-workflow](./skills/github-workflow/) | GitHub PR workflow guidance (branching, commits, `gh` CLI, PR creation). |
| [gws-docs-markdown](./skills/gws-docs-markdown/) | Create and update Google Docs from markdown content. |

## Git workflow configuration

Use `/workflow` to manage which GitHub orgs should use Graphite guidance. It supports both interactive use and explicit non-interactive commands:

```text
/workflow list
/workflow add Shopify
/workflow remove Shopify
/workflow detect
```

The extension stores config in `~/.config/pi/git-workflow.json` and shows the detected workflow in the status bar.

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
