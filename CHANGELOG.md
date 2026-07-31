# Changelog

## 2.20.0

- Stop overriding the `bash` tool in the `secrets` extension
  - Registering a `createBashTool` override conflicted with other extensions that also override `bash` (pi allows only one), e.g. `Tool "bash" conflicts with .../secrets/index.ts`
  - The override was redundant: loaded secrets are written to `process.env`, and pi's bash tool builds its child environment from `process.env` at spawn time (`getShellEnv`), so secrets already reach agent bash, user bash (`!` / `!!`), and any extension-provided bash tool whose `spawnHook` spreads the incoming env
  - No behavior change for secret loading, clearing, session restore, or status display

## 2.19.0

- Slim the `refactoring` skill's SKILL.md (~21.5KB → ~13KB) by replacing per-entry markdown links in the smell table and catalog with plain names plus a single stated convention: reference files live at `references/<kebab-case-name>.md`
  - Dialect-note links and reference-file cross-links are unchanged
  - Tests reworked from link-integrity to convention-enforcement (a stronger check): catalog names must resolve to files via the slug rule, smell-table recommendations must resolve to files, and every reference file's H1 must slugify back to its filename

## 2.18.0

- Add dialect notes to the `refactoring` skill under `references/dialects/`, with SKILL.md routing ("examples are Ruby; load the dialect note for your working context")
  - `ruby.md` — modern-Ruby baseline vs the books' vintage: `Data.define` (3.2+) as the value-object target, pattern matching (`case/in`), real keyword arguments, `&.` vs Introduce Special Case, immutability signals
  - `sorbet.md` — typed-Ruby overlay (loads on top of ruby.md): `srb tc` as the "find every caller" mechanic, the `sealed!` + `T.absurd` inversion of Replace Conditional with Polymorphism, `T::Struct` record targets, `abstract!`/`override`/`interface!` teeth for the inheritance chapter, `T.must`-noise as the Introduce Special Case signal; header states the placement rule (refactoring-specific notes stay inline, cross-cutting guidance lives here — the 19 existing inline **With Sorbet** notes are supplemented, not absorbed)
  - `rust.md` — cross-language remap: inheritance chapter → traits/enums table, Replace Error Code with Exception inverted to Replace Panic with Result, Option/Default as the built-in special case, iterator chains, Extract Function's variable analysis becoming borrow analysis (the two-`&mut self` extraction problem)
  - Each dialect file opens with an "Exceptions at a glance" table (N/A / inverted / superseded / remapped) instead of per-file language tags
  - Tests: `DIALECT_SLUGS` fixture (exact-match set + SKILL.md linkage); ruby example syntax checking extended to dialect files

## 2.17.0

- Complete the `refactoring` skill's coverage of refactoring.com/catalog/ with the 11 live guest-authored entries
  - 7 full reference files with author attribution: Replace Iteration with Recursion (Whipp) / Replace Recursion with Iteration (Mitrovic) as an inverse pair, Reverse Conditional (Murphy & Fowler), Remove Double Negative (Frieze & Fowler), Reduce Scope of Variable (Henricson), Replace Assignment with Initialization (Henricson), Replace Conditional with Visitor (Fowler — catalog page is a stub; mechanics and example authored here, with a Sorbet note preferring `sealed!` + exhaustive `case` over double dispatch)
  - 4 + 1 covered as see-also notes without files: Davison's Java-packaging set (Move Class, Extract Package → noted in Move Function; Convert Dynamic↔Static Construction → noted in Replace Constructor with Factory Function) and Vittek's Replace Static Variable with Parameter (→ noted in Replace Query with Parameter)
  - Smell table: Repeated Switches gains Replace Conditional with Visitor; Complex Conditional gains Reverse Conditional and Remove Double Negative
  - Coverage fixture extended: 66 catalog + 20 Ruby Edition + 11 first edition + 7 guest = 104 reference files, exact-match enforced

## 2.16.0

- Extend the `refactoring` skill with the remaining Fowler-book entries hosted under refactoring.com/catalog/, enumerated definitively via the Wayback Machine CDX index (154 URLs ever captured: 28 alias redirects, 13 dead J2EE-era guest pages, and the live set below)
  - 11 first-edition-only entries: Form Template Method, Extract Interface, Replace Delegation with Inheritance (Ruby Edition variant “Replace Delegation with Hierarchy” noted), Introduce Foreign Method, Introduce Local Extension, Encapsulate Downcast (reframed for Sorbet's `T.cast`/`T.must` hygiene — meaningless in untyped Ruby, essential in typed codebases), Hide Method, Duplicate Observed Data (marked largely historical), Replace Array with Object, Change Unidirectional/Bidirectional Association pair
  - 2 Ruby Edition entries missed by 2.15.0: Recompose Conditional, Replace Type Code with Module Extension; Replace Type Code with Polymorphism recorded as a Ruby Edition alias of Replace Type Code with Subclasses
  - Smell table gains an Incomplete Library Class row; **With Sorbet** notes where the type system changes the guidance (`interface!` for Extract Interface, `abstract!` for Form Template Method, per-instance `extend` invisibility for Module Extension)
  - Coverage fixture extended: 66 catalog + 20 Ruby Edition + 11 first edition = 97 reference files, exact-match enforced
  - 11 live guest-authored entries (Davison, Henricson, Whipp, Mitrovic, Murphy, Frieze, Vittek) deliberately deferred to a future PR

## 2.15.0

- Extend the `refactoring` skill with the 18 *Refactoring: Ruby Edition* entries hosted on refactoring.com but not carded on the catalog index page (discovered by probing `/catalog/` URLs; the 1st-edition "Big Refactorings" have no pages and are excluded)
  - Composing methods: Extract Surrounding Method, Introduce Class Annotation, Dynamic Method Definition, Replace Dynamic Receptor with Dynamic Method Definition, Isolate Dynamic Receptor, Move Eval from Runtime to Parse Time, Replace Temp with Chain
  - APIs: Introduce Named Parameter (modernized to real keyword arguments), Remove Named Parameter, Remove Unused Default Parameter
  - Moving features: Introduce Gateway, Introduce Expression Builder
  - Inheritance: Replace Abstract Superclass with Module, Extract Module, Inline Module
  - Organizing data: Lazily/Eagerly Initialized Attribute, Replace Hash with Object
  - Replace Loop with Collection Closure Method is recorded as an alias of Replace Loop with Pipeline rather than duplicated
  - Entries carry a `Source: Refactoring: Ruby Edition` marker and *(Ruby Edition)* tags in the SKILL.md index; metaprogramming entries include short **With Sorbet** caveats (RBI/tapioca visibility, `method_missing` untypeability)
  - Smell table gains Opaque `method_missing` and Hash-Driven Data rows
- New coverage fixture test in `skills/skills.test.ts`: the reference directory must match the expected slug list (66 catalog + 18 Ruby Edition) exactly, so additions and removals are deliberate and the coverage claim is CI-enforced

## 2.14.0

- New `refactoring` skill: teaches the agent to safely apply refactorings from Martin Fowler's *Refactoring* catalog (2nd edition + Ruby Edition) in small, behavior-preserving steps
  - `SKILL.md` acts as a dispatcher: core small-steps principle (start green, smallest step, run tests between each, commit often, one hat at a time), a code-smell → refactoring lookup table, and a catalog index grouped by Fowler's tags (basic, encapsulation, moving-features, organizing-data, simplify-conditional-logic, refactoring-apis, dealing-with-inheritance)
  - 66 on-demand reference files under `references/`, one per refactoring, each with Motivation, safe numbered Mechanics, a Ruby example, and inverse/related cross-links
  - Auto-registers via the existing `pi.skills` entry; no wiring needed
- New `skills/skills.test.ts`: automated validation for all skills, run by `pnpm test`/CI
  - Generic: frontmatter validity per the Agent Skills spec (name rules, description presence and ≤1024 chars) and relative markdown link integrity across every skill file
  - Refactoring-specific: every reference file linked from SKILL.md, catalog lists each reference exactly once, per-file `**Tag:**` lines match their catalog section, required Motivation/Mechanics/Example/Related sections present, and every Ruby example block parses (`ruby -c`, skipped if ruby is unavailable)
  - Mutation-tested: injected broken links, tag mismatches, and Ruby syntax errors are all detected
- Fix broken cross-package links in `gws-docs-markdown` (found by the new link check): sibling `gws-*` skills live in a separate package, so relative `../gws-*/SKILL.md` paths could never resolve; reference them by skill name instead

## 2.13.0

- Replace the brittle `/link` prompt template with a first-class `link` extension command
  - Resolves GitHub PR metadata via `gh pr view --json number,title,url,additions,deletions`
  - Emits exact Slack-pastable markdown link line(s) in the transcript
  - Copies both plain text and rich HTML to the clipboard from TypeScript, with tested HTML escaping and AppleScript argument handling
  - Supports `LINK_SKIP_CLIPBOARD=1` for tests and dry runs

## 2.12.0

- Rename `interview` extension to `answer`, matching the existing `/answer` command and package path

## 2.11.0

- Add `/link` prompt template to create Slack-pastable links, starting with Graphite-style GitHub PR link line(s) from the current branch PR or provided PR number, URL, or branch

## 2.10.0

- New `freshness` extension: at pi startup, checks user-managed extension/skill repos for upstream commits and announces any that are behind
  - Scans `~/.pi/agent/extensions/*` and `~/.pi/agent/skills/*`, resolves each to its realpath, drops anything inside `~/.pi/` (pi-managed), walks to the enclosing git root, and de-dups
  - Per repo: `git rev-parse HEAD` + branch + remote + `git ls-remote`, then only reports strictly-behind (fast-forward) situations — detached HEAD, missing remote, diverged histories, and any failure stay silent
  - Announcement renders as one transcript block via `pi.sendMessage` with a registered renderer styled to match pi’s own “Package Updates Available” notification (bold warning heading, muted subline, repo list with branch and behind count)
  - Fire-and-forget after `session_start` returns; 3s per-`git`-call timeout; never blocks session start
  - Complements pi’s built-in `checkForAvailableUpdates`, which explicitly skips local-path packages — freshness covers exactly that gap (local-path packages, plus ad-hoc symlinks into pi’s skill/extension load paths)
  - Honors `PI_OFFLINE` (recognizing `1`/`true`/`yes`, case-insensitive) so the same env var that silences pi’s update checks silences freshness too
  - Only fires on `session_start` with `reason === "startup"`; other reasons (`reload`, `new`, `resume`, `fork`) are no-ops
  - No commands, no cache, no snooze, no nag-suppression — pulling clears the announcement, staying behind keeps it visible on next startup
- Sort extensions alphabetically in `package.json` and the top-level `README.md` extension table

## 2.9.0

- `handoff` extension subsumes the `delegate` skill; the `skills/delegate/` directory is removed
  - Registers a second slash command `/delegate <text>` that shares the handoff handler but defaults to spawning a parallel Ghostty pane in the current cwd (current session continues), while `/handoff` keeps its existing default of replacing the current session in-place
  - Either command accepts natural-language overrides (`/handoff in a new pane, ...`, `/delegate continue here in a fresh thread`), so the default only applies when the user is silent
  - The same LLM call that synthesizes the prompt now returns structured intent (`{ mode, direction, targetRepo, targetDir, prompt }`) as JSON; no flags
- Filesystem-driven repo resolution replaces LLM path-guessing
  - When the user names a repo (e.g. "in edgey"), the LLM passes through the bare nickname and the extension globs `~/src/github.com/*/<nickname>`: one match uses it silently, multiple matches prompt via `ctx.ui.select`, zero matches errors out
  - Explicit paths (`in ~/some/path, ...`) are used verbatim
  - The previous unconditional "Delegate to a new Ghostty session?" confirm dialog is gone; the editor that opens with the synthesized prompt remains a backout point
- Race-free Ghostty pane/tab anchoring on macOS
  - Captures stable ids for the front window *and* the focused terminal surface synchronously at command entry (per Ghostty's scripting dictionary)
  - `pane` spawns split the exact captured surface; `tab` spawns target the captured window. Resolution falls back through window-id → front window → new window if anchors are gone by spawn time
  - Fixes a focus-race in the old `delegate` skill where switching Ghostty windows while the model was thinking dropped the new pane in the wrong place
- Honest spawn-result reporting
  - The osascript spawn is now awaited (`promisify(execFile)`); failures show as `error` with the saved task-file path so the prompt can be recovered, stderr-with-success downgrades to `warning`, clean spawn shows `info`
  - 5s timeout on the osascript spawn

## 2.8.0

- Update `usage` for GitHub Copilot AI credit billing
  - Display current-month AI credit usage and gross value in the status bar
  - Fall back to legacy premium request usage for annual request-based Copilot plans
  - Show `usage unavailable` on API/auth failures instead of a misleading zero
  - Document required `gh` authentication scope and user-level billing limitations

## 2.7.1

- Fix `/handoff` surfacing provider errors as `Generated handoff prompt was empty`
  - Detect `stopReason: "error"` and display the provider error/diagnostics
  - Report diagnostic details when generation returns no text

## 2.7.0

- Add `handoff` extension adapted from Pi's official handoff example
  - Provides `/handoff <goal>` to generate a self-contained prompt for a new focused session
  - Lets the user edit the generated prompt before creating a parent-linked replacement session
  - Preserves recent compaction context, branch summaries, and custom messages when building the handoff conversation history

## 2.6.2

- Update `secrets` to look for ejson files in XDG config paths (`${XDG_CONFIG_HOME:-$HOME/.config}/secrets`)
- Update `git-workflow` config to use Pi's configured agent directory (`${PI_CODING_AGENT_DIR:-~/.pi/agent}/git-workflow.json`)
- Update `system-theme` config to use Pi's configured agent directory (`${PI_CODING_AGENT_DIR:-~/.pi/agent}/system-theme.json`)

## 2.6.1

- Fix `web-search` extension behavior when GEMINI_API_KEY is missing or invalid
  - Do not attempt Gemini calls without GEMINI_API_KEY; show a UI notification in interactive sessions and abort the current agent turn
  - On authentication failures (HTTP 401/403 or invalid/expired key), notify the user, call ctx.abort(), and surface an AbortError so the agent stops instead of attempting workarounds
  - Use the runner-provided ctx.signal for all in-flight fetches so ctx.abort() cancels network requests promptly (applies to web_search, web_search_summary, and web_fetch)
  - Replace top-level console.warn with a session-start UI notification

## 2.6.0

- Add `nodoz` extension to keep macOS awake while Pi is actively working
  - Uses lifecycle-scoped `caffeinate -d -i -s` in interactive TTY sessions only
  - Refcounts active agent turns and cleans up on `agent_end`, `session_shutdown`, and process exit
  - Shows a dim `👀 nodoz` footer status while active

## 2.5.0

- Add a vendored `graphite` skill to this package, based on the existing local Graphite skill
  - Includes a trimmed main Graphite skill plus concise command and stacking workflow references
  - Adds prominent agent/non-interactive command guidance
  - Updates common examples to avoid bare interactive `gt` commands by default
- Bump package version to `2.5.0`

## 2.4.1

- Improve `git-workflow` detection and status handling
  - Distinguish non-GitHub origin remotes from repositories with no origin remote
  - Refresh the status bar even when workflow detection uses a cached result
  - Clear cached `gt` availability when workflow configuration changes
- Add explicit `/workflow` command arguments for non-interactive use: `list`, `add <org>`, `remove <org>`, and `detect`
- Tighten GitHub workflow guidance with `git pull --ff-only`, explicit `gh pr create --head/--base`, and `mktemp`/`--body-file` examples
- Update `gh-cli` examples to use `mktemp` with cleanup and add the skill to the README
- Bump package version to `2.4.1`

## 2.4.0

- Split `git-workflow` skill into local (no-remote) guidance and a new `github-workflow` skill for GitHub PR-based guidance. The extension (`./git-workflow/index.ts`) now detects no-remote vs remote repos and injects the appropriate context message.
- Rename the TUI command from `/git-workflow` to `/workflow` while keeping the extension path `./git-workflow/index.ts` for backward compatibility.
- Bump package version to `2.4.0`.

## 2.3.0

- Add `gh-cli` skill for safe GitHub CLI body/comment handling
  - Teaches `--body-file` as the default over fragile `--body "..."` interpolation
  - Covers heredocs, temp files, stdin piping, and the one safe inline case
  - Standalone skill — applies regardless of whether `git-workflow` or `graphite` is active

## 2.2.0

- Fix delegated sessions missing per-directory environment (shadowenv)
  - Add `pi-delegate` wrapper script that execs into a login shell (for PATH, nix,
    etc.) then uses `shadowenv exec` to activate the directory's environment before
    launching pi
  - Delegated panes/tabs now get the same PATH, env vars, and tool versions as
    a normal terminal — LSP servers, language runtimes, etc. all resolve correctly
  - No-op passthrough when shadowenv is not installed
  - Simplifies SKILL.md command templates — `scripts/pi-delegate` replaces
    `$SHELL -lic 'pi ...'`

## 2.1.1

- Fix parse error from unescaped double quotes in `git-workflow` context messages

## 2.1.0

- Add non-interactive guidance to `git-workflow` context messages
  - Both Graphite and standard git contexts now advise the agent to provide explicit
    arguments and messages inline to avoid hanging on interactive prompts or opening
    an editor (e.g. `git commit -m "message"`, `gt create -am "message"`,
    `gh pr create --fill`, `gt submit --no-edit`)

## 2.0.0

- **BREAKING:** Remove standalone `ghostty-pane`, `ghostty-tab`, and `ghostty-window` skills
  - AppleScript files moved into `delegate/scripts/` — delegate is now fully self-contained
  - If you relied on these skills directly (e.g. "open a pane", "split the window"), those
    natural-language triggers no longer work; use `delegate` instead

## 1.5.1

- Add status bar indicator to `git-workflow` extension
  - Shows `⎇ git` or `⎇ gt` in the footer so you can see the active workflow at a glance
  - Status updates immediately when the workflow decision is made (session start, org add/remove, detect)
  - Clears on session shutdown

## 1.5.0

- Add `git-workflow` extension — auto-detect git workflow based on repo org
  - Detects Graphite vs standard PR workflow using `gt` availability + configured GitHub orgs
  - Injects one-line context hint so the agent defaults to the right tools (`gt` or `git`/`gh`)
  - `/git-workflow` TUI command to add/remove/list orgs and detect current repo
  - Config stored in `~/.config/pi/git-workflow.json`
  - Guidance only — does not block git commands
  - Respects repo-level overrides (AGENTS.md)
  - Defers to built-in `graphite` skill for detailed `gt` reference
- Add `git-workflow` skill — standard PR-based git workflow reference
  - Branching, commits, `gh` CLI usage, conventional commit format
  - Loaded on demand to avoid context bloat

## 1.4.0

- Add `codeowners` skill — identify code owners for any file path in a repository
  - Locates CODEOWNERS file (`.github/`, root, `docs/` — first found wins)
  - Last-match-wins evaluation with step-by-step procedure
  - Full pattern syntax reference including anchoring, wildcards, and directory matching
  - Documents gitignore features not supported in CODEOWNERS (`\`, `!`, `[ ]`)

## 1.3.2

- Fix `delegate` skill to use `$SHELL -lic` instead of `bash -lc` when opening new Ghostty surfaces
  - Uses the user's actual shell instead of hardcoding bash
  - Interactive flag (`-i`) ensures shell config (`.zshrc`, `.bashrc`, `config.fish`) is sourced
  - New surface gets the full interactive login environment (PATH, env vars, Nix, etc.) — same as a normal terminal
  - Works across bash, zsh, and fish

## 1.3.1

- Improve `web-search` error handling — catch errors in `execute()` and return structured results
  - `web_search`, `web_search_summary`, and `web_fetch` now return clean error messages instead of throwing
  - `renderResult` correctly shows ✗ on failure via `details.error`

## 1.3.0

- Add `web-search` extension — web search and page fetching via Gemini API with Google Search grounding
  - `web_search` tool — concise search results with source URLs
  - `web_search_summary` tool — detailed summaries per result
  - `web_fetch` tool — fetch a URL and extract readable text content (HTML-to-text)
  - Redirect URL resolution for grounding sources
  - Proper timeout handling with `AbortSignal.timeout()` + `AbortSignal.any()`
  - Binary content type rejection for images, audio, video, etc.
  - Sandbox allowlist detection with helpful error messages
  - Requires `GEMINI_API_KEY` environment variable (free tier from Google AI Studio)

## 1.2.6

- Update secrets: status bar now updates immediately after loading or clearing secrets
- Inject/remove secrets into both process.env and bash environments

## 1.2.5

- Update `delegate` skill: clarify not to research target repo before delegating
  - The delegating session should write the task file using only context already in the conversation
  - The receiving session handles all research into the target repo

## 1.2.4

- Update `delegate` skill description to mention passing context/research to the new session
- Remove overly restrictive "do NOT research before delegating" guardrail
  - The receiving session benefits from relevant context passed in the task file

## 1.2.3

- Add guardrail to `delegate` skill: don't research before delegating
  - Prevents over-preparation that delays delegation and blocks the original session
  - Task files should contain context already available and relevant references, not pre-digested analysis

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
