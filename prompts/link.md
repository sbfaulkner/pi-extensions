---
description: Create Slack-pastable links; currently supports GitHub PRs
argument-hint: "[PR number/URL/branch ...]"
---
Create Slack-pastable link line(s). Currently, this template supports GitHub PRs and formats them with a Graphite review URL.

Arguments provided to this template: $ARGUMENTS

Use the current branch's PR when no argument is provided. When one or more PR refs are provided, process them in order; each ref may be a PR number, PR URL, or branch name accepted by `gh pr view`.

For each PR:

1. Fetch metadata non-interactively with `gh pr view` and explicit JSON fields: `number,title,url,additions,deletions`.
2. Convert GitHub PR URLs of the form `https://github.com/<owner>/<repo>/pull/<number>` into the Graphite URL:
   `https://app.graphite.com/github/pr/<owner>/<repo>/<number>`
3. Output exactly this format, with no code fence or surrounding commentary in your final answer:

   ```text
   👀 [#<number> <title>](<graphite-url>) `+<additions>/-<deletions>`
   ```

If multiple PRs were requested, output one line per PR. If a PR cannot be resolved, briefly say that `/link` currently supports GitHub PRs only.

4. After producing the formatted line(s), copy them to the system clipboard with **both rich (HTML) and plain-text formats** so that pasting into Slack or Google Docs produces clickable links. Do this silently — do not mention the clipboard step in your answer, just confirm the link is copied.

   For each PR, build two representations:

   - **Plain text** (same format as step 3):
     ```
     👀 [#<number> <title>](<graphite-url>) `+<additions>/-<deletions>`
     ```
   - **HTML**:
     ```html
     <meta charset="utf-8">👀 <a href="<graphite-url>">#<number> <title></a> <code>+<additions>/-<deletions></code>
     ```

   For multiple PRs, join with newlines in plain text and `<br>` in HTML.

   Then set the clipboard using `osascript`:

   ```bash
   hex=$(printf '%s' "$html" | xxd -p | tr -d '\n')
   osascript -e "set the clipboard to {string:\"${plain}\", «class HTML»:«data HTML${hex}»}"
   ```

   Be careful to escape any double quotes inside `$plain` (replace `"` with `\"`) before interpolating into the `osascript` command.
