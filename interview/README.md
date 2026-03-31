# interview

Batch multiple questions into a single interactive form, reducing conversation round-trips from ~2N to 2.

## Why

Each back-and-forth turn re-sends the full conversation as input. A 14-point review at ~100k context costs ~5-10× more than asking everything at once. This tool gives the model a way to batch questions and collect all answers in one shot.

## Usage

The model calls the `interview` tool automatically when it has multiple questions. You can also nudge it:

> review my planning doc and ask me about any gaps

The tool shows one question at a time with a progress indicator:

```
──────────────────────────────────────
 Planning Review
 14 questions about your architecture

 ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○

 2/14: What's the CDN cache invalidation strategy?
   We currently use 60s TTL globally

  ┌──────────────────────────────┐
  │                              │
  └──────────────────────────────┘

 Enter next • Shift+Enter newline • Tab/Shift+Tab navigate • Esc cancel
──────────────────────────────────────
```

## Keybindings

| Key | Action |
|-----|--------|
| Enter | Next question (submit on last) |
| Shift+Enter | Newline in answer |
| Tab / Shift+Tab | Jump between questions |
| Esc | Cancel |
