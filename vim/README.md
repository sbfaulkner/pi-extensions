# vim — Vi Input Mode for pi

A vi/readline-style modal editing extension for pi's TUI editor, inspired by bash's `set -o vi` and shell vi-mode.

## Features

- **INSERT mode** (default) — all input passed through to the editor
- **NORMAL mode** — navigation and editing via single-key commands

### Movement
| Key | Action |
|-----|--------|
| `h` / `l` | Left / right |
| `j` / `k` | Down / up (navigates input history at buffer boundaries) |
| `0` / `$` | Line start / end |
| `^` | First non-whitespace |
| `w` / `W` | Forward word / WORD |
| `b` / `B` | Backward word / WORD |
| `e` / `E` | End of word / WORD |
| `f{c}` / `F{c}` | Find char forward / backward |
| `t{c}` / `T{c}` | Till char forward / backward |
| `;` / `,` | Repeat / reverse last find |
| `G` | Jump to end of input history (current input), or last line of buffer |

### Editing
| Key | Action |
|-----|--------|
| `i` / `a` | Insert before / after cursor |
| `I` / `A` | Insert at line start / end |
| `o` / `O` | Open line below / above |
| `x` / `X` | Delete char / backspace |
| `r{c}` | Replace char under cursor |
| `s` | Substitute char (delete + insert) |
| `S` / `cc` | Substitute line |
| `D` | Delete to end of line |
| `C` | Change to end of line |
| `d{motion}` | Delete with motion |
| `c{motion}` | Change with motion |
| `y{motion}` | Yank with motion |
| `dd` / `yy` | Delete / yank entire line |
| `p` / `P` | Paste after / before cursor |
| `u` | Undo |
| `Ctrl+R` | Redo |

### Input history

In normal mode, `j` and `k` navigate between lines within a multi-line input. When attempting to move past the first or last line, they scroll through the input history instead:

- **`k` on first line** — previous history entry (cursor starts at bottom)
- **`j` on last line** — next history entry (cursor starts at top)
- **`G`** — jump to end of history (current input)

### Count prefix

Most commands accept a `{count}` prefix, e.g. `3w` moves forward 3 words, `2dd` deletes 2 lines.

## Setup

Add `"./vim/index.ts"` to the `pi.extensions` array in your `package.json`:

```json
{
  "pi": {
    "extensions": [
      "./vim/index.ts"
    ]
  }
}
```

Or test directly:

```bash
pi -e ./vim/index.ts
```


