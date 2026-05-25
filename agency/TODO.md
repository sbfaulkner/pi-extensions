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

Top-priority: Systematically audit RPC events and decide handling

We must systematically review the Pi RPC event types (see https://pi.dev/docs/latest/rpc and https://pi.dev/docs/latest/extensions#events) and produce a definitive mapping of how the extension should handle each event. This is the highest-priority TODO and should be completed before larger UX changes.

Deliverables

1. Event matrix (document): For every documented RPC event type, list:
   - Event name (e.g., agent_start, message_update, agent_end, tool_execution_start, etc.)
   - Typical payload fields of interest
   - Our current behavior (what the extension does now)
   - Proposed handling (widget state changes, notifications, event buffering, ignored events)
   - Rationale & UX impact

2. Implementation plan: a small, prioritized set of code changes to align behavior with the matrix. For each change include exact file/line suggestions or a small patch when trivial.

3. Tests / verification: For each behavioral change add a minimal verification plan (manual steps or automated test) to confirm handling is correct.

Initial recommended mapping (apply and refine during audit)

- agent_start
  - Payload: { type: 'agent_start' }
  - Current: not explicitly handled
  - Proposed: mark session.status = 'busy' (or 'initializing' if startup), optionally expand/highlight widget. Buffer event.

- agent_end
  - Payload: { type: 'agent_end', messages: [...] }
  - Current: treated as message_end/done in stream handlers
  - Proposed: treat as final completion for current task: mark idle, clear currentTaskId, expand/highlight member briefly, emit a single notify (if task id present), buffer event.

- turn_start / turn_end
  - turn_start: mark 'busy'
  - turn_end: update with message + toolResults; may be useful for richer UI later

- message_start / message_update / message_end
  - message_start: mark 'busy' (streaming)
  - message_update: update recent events buffer; do not notify
  - message_end: mark 'idle' (if no tool calls pending), treat as potential completion and behave like agent_end for notifications if currentTaskId present

- tool_execution_start / tool_execution_update / tool_execution_end
  - Start/update: mark 'busy'
  - End: mark 'idle' and treat as completion of a part of the task; expand/highlight and maybe notify 'tool finished' if currentTaskId present

- queue_update
  - Update internal queue indicators (no UI notification by default), show pending count in widget summary if useful

- compaction_start / compaction_end
  - Ignore for user-facing activity; buffer event for diagnostics only

- auto_retry_start / auto_retry_end
  - Show brief status in widget (retrying...), buffer event; do not notify unless final failure

- extension_error
  - Notify the lead (error), highlight member in error color, keep session.status='error', do not auto-minimize until cleared

- extension_ui_request (various methods)
  - Most methods are UI-only (setStatus) and should be ignored for activity metrics; specific methods that indicate real work may be handled explicitly

- agent-specific custom events (if present)
  - Buffer and show in expanded view; follow event payload content

Implementation notes

- Prefer non-intrusive widget-first feedback (summary/minimized + expand/highlight) for most events; reserve ui.notify for final task completion and errors.
- Keep an in-memory per-member event buffer (already implemented) for inspection via /agency events and the widget preview; cap size.
- Avoid console logging by default; provide a targeted stream command for full raw logs if needed.

Long-term / follow-up

- Add automated tests or a local mock harness to simulate events and verify UI behavior.
- Consider exposing an internal mapping/config so a future extension or admin can change which events generate notifications.

Long-term / out of scope for this change

- Add a repo-wide test harness strategy for extensions that need RPC-style mocks; coordinate across extensions before adding a shared dev/mock harness.
- Support remote RPC endpoints or an enrollment-based multi-session cooperative model (consider as a separate extension).

Notes

- Members always spawn the local "pi" binary in RPC mode; custom command overrides are not supported.
- Any code changes should target the feat/agency-extension branch.
