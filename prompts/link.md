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

4. After producing the formatted line(s), copy them as **rich text** to the system clipboard so links are clickable when pasted into Slack. Use this approach:

   ```bash
   tmpfile=$(mktemp /tmp/link.XXXXXX.html)
   cat > "$tmpfile" << 'HTML'
   <html><body>...one line per PR using <a href="graphite-url">#number title</a> and <code>+N/-M</code>...</body></html>
   HTML
   textutil -convert rtf "$tmpfile" -output /tmp/link.rtf
   osascript -e 'set the clipboard to (read POSIX file "/tmp/link.rtf" as «class RTF »)'
   rm -f "$tmpfile" /tmp/link.rtf
   ```

   Do this silently — do not mention the clipboard step in your answer, just confirm the link is copied.
