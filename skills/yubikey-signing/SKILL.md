---
name: yubikey-signing
description: What to do when git or gpg cannot sign because the YubiKey, or another OpenPGP smart card, holding the signing key is not there. Errors include "gpg failed to sign the data", "No yubikey detected", "Card not present", "No such device", "Card error", and a commit, rebase, cherry-pick, merge or signed tag that hangs or times out at signing. Usually the problem is brief, because the machine was going to sleep or had just woken and the OS had taken the card away for a moment. Check the card, retry once, then ask the user. Never turn signing off on your own.
---

# Signing with a YubiKey when the card is not there

Git signs through gpg, and gpg asks the card. When the card is missing, the signing step fails or waits. Usually it is not really missing: the OS takes a smart card away as the machine starts to sleep and gives it back a second or two after it wakes. A command that ran in that moment fails, and the same command a minute later works.

## When a signing step fails

1. **Check the card yourself** before you tell the user anything. This command only reads:
   ```bash
   gpg --card-status
   ```
   The card is there when the output has a `Reader` line and an `Application ID` line.
2. **The card is there:** run the failed step once more. A failed `git commit` wrote no commit, and the staged changes are still staged. A rebase or cherry-pick stops at that commit; continue it with `git rebase --continue` or `git cherry-pick --continue`. A merge stays open; finish it with `git commit`.
3. **No card:** wait about 10 seconds (the machine may still be waking), check again, and retry if it is back.
4. **Still no card:** stop. Tell the user which step failed and that `gpg --card-status` shows no card, and ask them to check the key. When they answer, or when you come back to the task later, check the card again before you retry or ask again: it may have come back by itself.
5. **The card is there and signing still fails, `gpg --card-status` hangs, or it lists a different card than the one with the signing key:** do not retry in a loop. Tell the user what you saw. Restarting gpg's agent (`gpgconf --kill all`) is their call.

If a signing step hangs, or your tool call times out at one, gpg may be waiting for a touch (the key blinks) or for its PIN. Tell the user; do not kill and restart it repeatedly.

## Never, unless the user asks

- Turn signing off: `--no-gpg-sign`, `-c commit.gpgsign=false`, changing `commit.gpgsign`, or setting a signing wrapper's variable that skips its card check.
- Sign with another key or identity.
- Kill or restart gpg-agent or scdaemon. It drops a cached PIN and can break a signing step running elsewhere.
- Change the card's PIN or settings (`gpg --card-edit`).

A commit that has to be signed, and cannot be, is the user's to unblock. Say so and stop.
