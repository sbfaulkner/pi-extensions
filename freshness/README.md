# freshness

At pi startup, quietly check user-managed extension/skill repos for upstream
commits. If any are behind, insert a single block into the session transcript
listing them. Otherwise silent.

## What it checks

Scans the directories pi loads extensions and skills from
(`~/.pi/agent/extensions/*` and `~/.pi/agent/skills/*`) and considers only
entries whose `realpath` resolves **outside** `~/.pi/`. Those are the repos
*you* manage; anything pi cloned for itself is excluded so this extension
doesn't fight pi's own update story.

For each user-managed entry it walks up to the enclosing git root (skipping
non-git directories) and de-dups. Then for each unique repo:

- `git rev-parse HEAD` — local SHA
- `git rev-parse --abbrev-ref HEAD` — branch (detached HEAD skipped)
- `git config branch.<branch>.remote` — remote (no remote → skipped)
- `git ls-remote <remote> <branch>` — upstream SHA
- `git merge-base --is-ancestor <local> <upstream>` — only report
  fast-forward situations; diverged histories stay silent
- `git rev-list --count <local>..<upstream>` — how far behind

If `behindCount > 0`, the repo is included in the announcement.

## What it does *not* do

- No commands. No `/updates`, no `--refresh`, no `--snooze`.
- No cache, no notify-history, no TTL.
- No status-bar widget.
- No auto-pull.
- No periodic check. Only at `session_start` with `reason === "startup"`.

If you're behind and don't pull, you'll see the same block on the next
startup. That is the nudge.

## Surface

Uses `pi.sendMessage` with a custom message type `freshness/announcement`
and a registered renderer styled to match pi's own “Package Updates
Available” notification (bold warning heading, muted subline, repo list).
The structured `RepoStatus[]` is passed as `details.statuses` so the
renderer doesn’t string-parse `content`.

Network checks run fire-and-forget after the `session_start` handler
returns, with a 3-second per-`git`-call timeout, so they never delay
startup.

## Relationship to pi’s own update checks

Pi already runs two update checks at startup (in `interactive-mode.run()`):

1. `checkForNewPiVersion()` — pi itself.
2. `packageManager.checkForAvailableUpdates()` — entries in
   `settings.json.packages`, but **only** for git-URL and npm sources.
   Local-path sources are explicitly skipped (see
   `core/package-manager.js`: `if (parsed.type === "local" || parsed.pinned) return undefined;`).

Freshness fills exactly that gap: user-managed checkouts that pi does
not manage (local-path packages, and ad-hoc symlinks into pi’s skill /
extension load paths). The two systems are complementary by design —
the `realpath` filter on `~/.pi/` is the inverse of pi’s `local` skip.

Freshness also honors the same `PI_OFFLINE` env var pi uses to disable
its own update checks (`1`, `true`, `yes`, case-insensitive), so a
user-level offline mode silences both systems uniformly.

On any unexpected error (network, missing git, etc.) the extension is
silent.

## Layout

```
freshness/
  index.ts        — extension entry + factory
  index.test.ts   — DI tests (no real git, no filesystem)
  README.md
```

## Testing

`createFreshnessExtension(pi, deps)` is the test factory. Deps:

```ts
{
  homeDir?: () => string;
  listDir?: (dir: string) => Promise<string[]>;
  realpath?: (p: string) => Promise<string>;
  runGit?: (cwd, args, opts?) => Promise<{ stdout, code }>;
}
```

All four are stubbed in `index.test.ts`; tests perform no real I/O.
