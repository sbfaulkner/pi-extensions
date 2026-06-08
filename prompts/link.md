---
description: Create Slack-pastable links; currently supports GitHub PRs
argument-hint: "[PR number/URL/branch ...]"
---
Create Slack-pastable link line(s). Currently, this template supports GitHub PRs and formats them in Graphite's pasteable-stack style.

Arguments provided to this template: $ARGUMENTS

Use the current branch's PR when no argument is provided. When one or more PR refs are provided, process them in order; each ref may be a PR number, PR URL, or branch name accepted by `gh pr view`.

For each PR:

1. Fetch metadata non-interactively with `gh pr view` and explicit JSON fields: `number,title,url,additions,deletions`.
2. Convert GitHub PR URLs of the form `https://github.com/<owner>/<repo>/pull/<number>` into the Graphite pasteable-stack URL:
   `https://app.graphite.com/github/pr/<owner>/<repo>/<number>?ref=gt-pasteable-stack`
3. Output exactly this format, with no code fence or surrounding commentary in your final answer:

   ```text
   👀 [#<number> <title>](<graphite-url>) `+<additions>/-<deletions>`
   ```

If multiple PRs were requested, output one line per PR. If a PR URL cannot be converted to a Graphite URL, use the original PR URL in the same format. If a provided ref cannot be resolved as a PR, briefly say that `/link` currently supports GitHub PRs only.
