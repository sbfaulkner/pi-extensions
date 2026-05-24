Agency extension — TODO

Short-term (docs/cleanup)

- Remove any remaining user-facing mention of the removed mock-member.js (README updated; verify other docs).
- Remove /agency logs command from code and tests (command still exists in index.ts; delete handler and any references to 'agency-log' persisted entries).
- Clean up roles.json by removing explicit null values for provider/modelId where fallback to session is intended (cosmetic).
- Remove any mention of /agency stop in built-in help text (index.ts) if present; the README documents the lack of a stop command.

Medium-term (UX & safety)

- Consider an interactive overlay or richer widget that can show live "working..." messages or allow quick inspection of a member's current task and recent messages.
- Add a simple in-widget debug view or an output panel integration to surface recent raw events when the /agency log toggle is enabled.
- Add optional limits: enforce maximum member count per role (already implicitly limited by number of available names) and document behavior when limits reached.

Long-term / out of scope for this change

- Add a repo-wide test harness strategy for extensions that need RPC-style mocks; coordinate across extensions before adding a shared dev/mock harness.
- Support remote RPC endpoints or an enrollment-based multi-session cooperative model (consider as a separate extension).

Notes

- Changes that touch the runtime child-process spawning behavior should include security considerations and possibly a confirmation/whitelist for non-default cmd/args.
- Any code changes should target the feat/agency-extension branch.
