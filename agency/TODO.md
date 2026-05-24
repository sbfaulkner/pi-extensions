Agency extension — TODO

Short-term (docs/cleanup) — completed

- Removed user-facing mention of the removed mock-member.js from the README (README updated).
- Removed the /agency logs command from the code and cleaned references to persisted 'agency-log' entries.
- Cleaned up roles.json by removing explicit null values for provider/modelId where fallback to session is intended.
- Removed mentions of /agency stop from the built-in help text.

(These changes are committed to feat/agency-extension.)

Medium-term (UX & safety)

- Consider an interactive overlay or richer widget that can show live "working..." messages or allow quick inspection of a member's current task and recent messages.
- Add a simple in-widget debug view or an output panel integration to surface recent raw events when the /agency log toggle is enabled.
- Add optional limits: enforce maximum member count per role (already implicitly limited by number of available names) and document behavior when limits reached.

Long-term / out of scope for this change

- Add a repo-wide test harness strategy for extensions that need RPC-style mocks; coordinate across extensions before adding a shared dev/mock harness.
- Support remote RPC endpoints or an enrollment-based multi-session cooperative model (consider as a separate extension).

Notes

- Persisted member configs may include cmd/args; the current plan is to treat member sessions similarly to the main session (no whitelist/confirmation gating). Any deviation from this should be a deliberate follow-up change.
- Any code changes should target the feat/agency-extension branch.
