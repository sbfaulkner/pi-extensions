# Changelog

## 1.2.2

- Fix `delegate` skill: avoid double slash in temp file paths
  - `$TMPDIR` may or may not include a trailing slash depending on platform
  - Use `${tmpdir%/}` to strip any trailing slash before appending `/pi-delegate-XXXXXX`

## 1.2.1

- Fix `delegate` skill: portable `mktemp` template
  - Remove `.md` suffix — macOS (BSD) `mktemp` requires templates to end with `X` characters
  - Use `${TMPDIR:-/tmp}` instead of hard-coded `/tmp` to respect the system temp directory

## 1.2.0

- Add `delegate` skill — delegate tasks to new pi sessions in other repos via Ghostty panes/tabs
  - Writes self-contained task files and opens pi in the target directory
  - Supports both split panes (default) and tabs
  - Enables multi-repo workflows by spinning up parallel pi sessions

## 1.1.3

- Add confirmation prompt when pressing Escape in interview with non-empty answers
  - Prevents accidental discard of in-progress answers
  - Shows "Discard all answers? (y/n)" prompt; press n or Escape to resume editing

## 1.1.2

- Add shared drive guidance to `gws-docs-markdown` skill
  - Documents `supportsAllDrives` param required for shared/team drive files

## 1.1.1

- Fix `/answer` extraction: use current model instead of unavailable cheap models
  - Removes fragile cheap model selection (Codex mini/Haiku auth failures)
  - Surfaces extraction errors instead of silent "Cancelled"

## 1.1.0

- Rework `interview` extension from tool-based to command-based (`/answer`)
  - Removes tool schema overhead from system prompt (was taxing every turn)
  - Extracts questions via cheap isolated LLM call (Codex mini or Haiku) — no context pollution
  - Sends answers as a clean message instead of a tool result
  - Same TUI form UX (progress dots, per-question editors, wrapping)

## 1.0.0

- Add `gws-docs-markdown` skill — create and update Google Docs from markdown
  - Create docs via `drive files create --upload content.md` with Google Docs mimeType
  - Update docs via `drive files update --upload content.md` (full content replace)
  - Documents `--upload-content-type` flag for non-`.md` files
  - Covers conversion quality, workflow patterns, and limitations
- Release 1.0.0 — the package is in active use

## 0.7.1

- Fix interview extension truncating long question and context text with "..."
  - Now wraps text across multiple lines using `wrapTextWithAnsi`

## 0.7.0

- Add `interview` extension — batch multiple questions into one interactive form
  - `interview` tool callable by the model to collect answers in one shot
  - One question at a time with progress dots and per-question editors
  - Enter to advance, Shift+Enter for newlines, Tab/Shift+Tab to navigate, Esc to cancel
  - Reduces conversation round-trips from ~2N to 2

## 0.6.2

- Extract Ghostty AppleScript logic to standalone .applescript files
- Use --flag style options (--cmd, --dir, --direction) instead of positional arguments
- Each script only accepts flags relevant to its action (e.g. --direction is pane-only)
- Remove inline AppleScript from SKILL.md files; skills now invoke .applescript files via osascript

## 0.6.1

- Support running arbitrary command in a new window/tab/pane
- Support providing initial working direction for new window/tab/pane

## 0.6.0

- Add skills to automate ghostty (e.g. open window, new tab, split pane)

## 0.5.0

- Add `usage` extension to add provider usage information to the status bar (initially only github-copilot pro supported)

## 0.4.0

- Add `vim` extension — vi/readline-style modal editing for pi's input editor
  - INSERT and NORMAL modes with mode indicator in editor border
  - Navigation: `hjkl`, `0/$`, `^`, word motions (`w/W/b/B/e/E`), char find (`f/F/t/T`, `;/,`)
  - Operators: `d{motion}`, `c{motion}`, `y{motion}`, `dd`, `cc`, `yy`
  - Editing: `x`, `X`, `r{c}`, `s`, `S`, `D`, `C`, `p`, `P`
  - Undo/redo: `u`, `Ctrl+R`
  - Count prefixes for most commands
  - Input history navigation: `j`/`k` at buffer boundaries scroll through history, `G` jumps to current input

## 0.3.0

- Add `system-theme` extension — syncs pi theme with macOS/Linux dark/light mode
- Replaces external `npm:pi-system-theme` dependency with a self-contained implementation

## 0.2.0

- Switch from `ejson2env` to `ejson decrypt` for clean JSON output
- Replace regex parsing of shell export lines with `JSON.parse()`
- Use `execFileSync` instead of `execSync` to avoid shell injection

## 0.1.0

- Initial release: secrets extension with `load_secrets` tool, `/secrets` command, and automatic env injection via bash spawnHook
