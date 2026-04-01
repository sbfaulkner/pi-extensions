# interview

Answer assistant questions in a batch using an interactive form.

## Why

When the model asks multiple questions, answering them one at a time means N round-trips that each re-send the full growing context — expensive. This extension extracts questions from the last assistant message using a cheap isolated LLM call (Codex mini or Haiku), presents them in a form, and sends all answers back at once.

Unlike a tool-based approach, this adds zero schema overhead to the main model's system prompt and keeps the extraction out of the main conversation context entirely.

## Usage

When the assistant asks you several questions:

```
/answer
```

The extension will:
1. Extract questions from the last assistant message (using a cheap model)
2. Show them one at a time with a progress indicator
3. Send all your answers back in one shot

```
──────────────────────────────────────
 Answer Questions

 ● ● ○ ○ ○

 2/5: What's the CDN cache invalidation strategy?
   We currently use 60s TTL globally

  ┌──────────────────────────────────┐
  │                                  │
  └──────────────────────────────────┘

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
