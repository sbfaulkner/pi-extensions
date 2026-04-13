---
name: codeowners
description: Identify code owners for a given file path in the repository. Use when asked "who owns this file?", "who is the code owner of X?", "CODEOWNERS for this path", or any question about file ownership in the repo.
---

# CODEOWNERS Lookup

This skill finds code owners for a given file path by locating and evaluating the repository's CODEOWNERS file.

## Step 1: Locate the CODEOWNERS File

GitHub searches these locations **in order** and uses the **first one found**:

1. `.github/CODEOWNERS`
2. `CODEOWNERS` (repo root)
3. `docs/CODEOWNERS`

Check all three with `read` or `bash` and use the first that exists. If none exist, the repo has no CODEOWNERS configuration.

## Step 2: Parse the File

Process each line:

- **Skip** blank lines and lines starting with `#` (comments).
- **Strip inline comments**: anything after ` #` (space then `#`) at the end of a line is a comment — remove it before parsing.
- Each remaining line has the format: `<pattern> <owner1> [owner2] [owner3] ...`
- A line with a pattern but **no owners** means "explicitly no code owner" (overrides earlier matches).

## Step 3: Normalize the Input Path

- Strip any leading `/` from the file path.
- Ensure the path is relative to the repo root.

## Step 4: Match — Last Match Wins

Walk all parsed lines **top to bottom**. Test every pattern against the input path. **Do not stop at the first match** — track every match and take the **last matching line**.

After scanning all lines:

| Last match has… | Result |
|-----------------|--------|
| One or more owners | Those are the code owners. A review from **any one** of them satisfies the requirement. |
| No owners (pattern only) | The file explicitly has **no code owner**. |
| No line matched at all | The file has **no code owner**. |

## Pattern Syntax Reference

### Wildcards and Separators

| Token | Meaning |
|-------|---------|
| `*` | Matches anything **except** `/` (a single path segment) |
| `**` | Matches zero or more directories (crosses `/` boundaries) |

### Pattern Anchoring

| Pattern | Meaning |
|---------|---------|
| `*` | Matches every file in the repo (global/default owner) |
| `*.js` | Matches any `.js` file **anywhere** in the repo |
| `/docs/` | Matches the `docs/` directory **at the repo root** and everything inside (recursive) |
| `docs/*` | Matches files directly inside any `docs/` dir, but **not** nested subdirs |
| `apps/` | Matches any `apps/` directory **anywhere** and everything inside (recursive) |
| `**/logs` | Matches a `logs` directory or file **anywhere** in the tree |
| `/build/logs/` | Matches `build/logs/` at root and everything inside (recursive) |

### Key Rules

- **Trailing `/`** = directory match; implicitly includes everything recursively inside it.
- **Leading `/`** = anchored to the repo root.
- **No leading `/`** = matches anywhere in the path (gitignore-like behavior).
- **No leading `/` but contains `/`** (e.g. `docs/getting-started.md`) = treated as **anchored to the repo root** (equivalent to `/docs/getting-started.md`).
- Patterns are **case-sensitive**.

## Gitignore Features That Do NOT Work in CODEOWNERS

These gitignore features are **not supported** in CODEOWNERS files:

- `\` escaping (e.g. `\#` to match a literal `#`)
- `!` negation patterns
- `[ ]` character ranges (e.g. `[a-z]`)

Do not use or interpret these when evaluating CODEOWNERS patterns.

## Example Evaluation

Given this CODEOWNERS file:

```
# Default owners
*                   @global-team

# Frontend
*.js                @frontend-team
/docs/              @docs-team

# Override: no owner for generated files
/build/
```

For the path `docs/guide.md`:
1. `*` → matches → `@global-team`
2. `*.js` → no match
3. `/docs/` → matches → `@docs-team`
4. `/build/` → no match
5. **Last match**: `/docs/` → **Owner: `@docs-team`**

For the path `build/output.js`:
1. `*` → matches → `@global-team`
2. `*.js` → matches → `@frontend-team`
3. `/docs/` → no match
4. `/build/` → matches → (no owners)
5. **Last match**: `/build/` → **No code owner** (explicitly unowned)
