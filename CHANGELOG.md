# Changelog

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
