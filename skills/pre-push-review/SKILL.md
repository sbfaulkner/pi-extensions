---
name: pre-push-review
description: A quick independent review of your change before you push it or mark a pull request ready, against a checklist of the bugs that keep turning up in review. Use when you are about to push anything non-trivial or open a PR, on any host.
---

# Review locally before you push

Before pushing anything non-trivial, or marking a PR ready, get one quick independent review of the change. Each round a remote reviewer (a person or a review bot) has to answer costs far more than catching the same problem locally.

1. **Commit first,** then review exactly what you will push: `git diff <base>...HEAD`.
2. **Use an independent reviewer:** a model from a different family than the one that wrote the change, if you can start one, at a moderate thinking level. Give it only the diff, what the change must do, and the checklist below, and ask for a short report: no wider exploration. If you can't start one, make a separate pass yourself, reading the diff once per checklist item.
3. **Fix what it finds, and sweep each fix for its class:** find every other place the same mistake can happen and fix those too. Fixing one instance at a time is what turns one finding into many review rounds.
4. **Review again** only if the fixes weren't trivial.
5. **Split a change much over about 1,000 lines** when it has a natural seam. Big diffs keep producing new findings.

## The checklist

The kinds of bug that keep turning up in review:

1. **One rule in two places:** a rule, key or lookup kept in two places, or new state honoured on one path and not another, and they disagree.
2. **A clock that doesn't version it:** freshness, age or ownership read from a timestamp or key that moves for other reasons, or not at all.
3. **Precedence that hides a signal:** an early return, a fallback or a winner picked before filtering hides another signal still in force.
4. **Derived state that feeds on itself or misses an input:** a cache, memo, watch or subscription whose own update changes what it is derived from, or that ignores an input such as time.
5. **Failure read as "nothing" or as fresh:** a failed or partial read becomes empty or null, deletes good state, or keeps old data without marking it stale.
6. **Bounds and pages:** a cap that doesn't hold, a window that drops items still promised, a first page read as all of it.
7. **Edge values the input accepts:** values that pass validation but break the logic, such as an end time of `24:00`.
8. **Tests:** each new branch, fallback and failure path has a test that fails without the change.
