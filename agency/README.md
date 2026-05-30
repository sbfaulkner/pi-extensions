Agency extension

Overview

The Agency extension provides an experimental "agency" of lightweight helper agents (members) you can spawn and assign short tasks. It demonstrates a persistent widget rendered below the editor that shows configured members and their runtime status, and a small set of interactive commands for creating, assigning, and managing these members.

This README documents the current implementation, command usage, configuration (roles), runtime behavior, known limitations, and the high-level goals for the feature.

Quick start

- Toggle the widget: /agency
- Add a member: /agency add <role> [name]
- See full help: /agency help

Commands (detailed)

All commands are exposed via the single interactive command "/agency". Examples assume you run the command from the Pi UI command prompt.

- /agency
  - Toggle the agency widget on/off. When shown the widget appears below the editor and lists members, their role, status (idle/pending/busy/starting/error/offline), and pid when a process is spawned.

- /agency help
  - Show the full built-in help and a list of role verb shorthands configured from roles.json.

- /agency add <role> [name]
  - Add a member for <role>. Optionally provide an explicit display name (Title Case). If no name is supplied the extension will choose a random unused name from the role's configured names.
  - Role names are case-insensitive and must exist in roles.json.
  - Each member gets a stable id (slugified name) to reference for assign/remove operations.
  - The extension will attempt to spawn a process for the new member when run inside an interactive UI session.

- /agency remove <id|displayName>
  - Remove a member by id or display name (case-insensitive). If the member process is running it will be killed.

- /agency list
  - Show a textual list of configured members and their statuses.

- /agency assign <id> <task text>
  - Assign a short text task to a member (by id). The extension ensures a spawned process exists, sends the prompt over the newline-delimited JSON RPC protocol, and waits briefly for confirmation. Behaviors:
    - If the member is not spawned the extension spawns it (pi --mode rpc by default).
    - The member process receives a JSON prompt of the form {id, type: 'prompt', message: text}.
    - The session is marked "pending" until an explicit response arrives or a timeout elapses; on success the session becomes "busy" and later transitions to "idle" when the member sends message_end/done events.

- /agency clear [confirm|--force]
  - Stop and remove members. If there are busy members the extension will attempt to use a UI confirmation; if no UI confirmation is available you must pass a force token (e.g. /agency clear confirm) to stop busy members. Without force the command removes only idle members and warns about busy ones.

- /agency events <id|all> [N]
  - Show recent in-memory member events for a single member (by id) or for all members. Default N=50.

- Role verb shorthands
  - roles.json can include a "verbs" array to provide shorthand commands of the form: /agency <verb> [task]
  - Example: if roles.json maps "analyze" to the analyst role then "/agency analyze Do X" will create/assign accordingly.

Roles and configuration

- roles.json defines role metadata. Each role can specify:
  - displayName: human label
  - provider, modelId, thinking: defaults used when spawning a member; null falls back to the current session model/provider
  - verbs: list of shorthand verbs mapped to the role
  - names: candidate display names that will be randomly chosen when adding a member without an explicit name

- Optional per-role SYSTEM prompt files (roles/<role>/SYSTEM.md) are used when spawning members: if present the extension passes the SYSTEM.md path to the child process via --system-prompt.

Runtime and implementation notes

- Members are represented as persisted configuration (saved into the current session via appendEntry("agency", ...)) and as in-memory objects at runtime.
- When a member is spawned the extension runs a child process. It always runs the local "pi --mode rpc" binary and passes provider/model/thinking via CLI args.
- Communication uses newline-delimited JSON over stdin/stdout. The extension parses JSON lines, updates session state from RPC events (message_start/message_update/message_end, tool_execution_*, etc.), and renders status in the widget.
- Assignment flow: assignTaskToMember marks the session pending, sends a prompt JSON, waits briefly for a response event matching the task id (6s timeout), and then marks the session busy (or idle on rejection).
- The extension intentionally scopes persistence to the current Pi session (no global file fallback).

Widget behavior

- The widget displays a compact list of members and their state below the editor (truncate-to-width aware). It subscribes to internal change events and requests rerenders when members or session statuses change.
- Minimized vs expanded:
  - When minimized the widget renders a single-line summary (e.g. "5 members — 1 active; 4 idle"). The widget is kept registered in the UI in this minimized form rather than being fully unregistered.
  - When expanded the widget shows the full per-member list with status and pid metadata.
- Auto behavior:
  - The widget auto-expands when a member is added, when a task is assigned (and accepted), or when a member finishes a task. On finish the member is briefly highlighted in the expanded view.
  - When all members are idle the widget auto-minimizes back to the one-line summary after a short delay (configurable in code, default 5s).
  - Manual toggles (/agency) now expand/minimize the widget rather than unregistering it.


Known limitations and notes

- The extension expects child processes that speak the newline-delimited JSON RPC protocol. The extension always spawns the local "pi" binary in RPC mode; you can run a separate local "pi --mode rpc" instance for development testing.
- Use /agency events to inspect recent member events; the extension no longer emits raw RPC events to the host console by default.
- Lead feedback on member completion is surfaced by temporarily expanding and highlighting the relevant member in the widget; a short notify is also emitted when a task with an id completes.
- Persistence is session-scoped — members persist only within the Pi session entries and will be re-spawned on an interactive session start if the session includes agency entries.



Goals / roadmap (what we're aiming for)

- Provide a simple, interactive way to manage a small team of helper agents locally (spawned processes or RPC-backed workers) to assist with tasks like analysis, investigation, planning, and review.
- Improve discoverability and in-UI help (document all commands in README and the built-in /agency help).
- Add tests and a small, supported mock/test harness for local development (the previous mock script was removed; consider adding a test-only package or a documented minimal script that implementers can run).
- Consider a configuration option to make member persistence global (across sessions) or per-workspace, and clear UX for process ownership and cleanup.

Contributing

- This repo uses a standard GitHub PR workflow. Please branch off main (or the active feature branch), make small focused changes, and open a PR. Commit messages should be clear and use conventional prefixes (feat:, fix:, docs:, chore:).

Decisions (current)

The following decisions reflect the intended behavior and have been applied to the README/docs:

- The extension spawns the "pi" binary in RPC mode by default and passes role-based provider/model/thinking values or falls back to the active session model when role settings are null.
- Persistence remains session-scoped (members persisted to the current Pi session only).
- Role presets may contain null provider/modelId/thinking values; the extension falls back to session defaults in those cases.
- The /agency logs and /agency log commands have been removed. Use the in-widget preview (highlight) or the /agency events command to inspect recent member events.
- UX: widget uses minimized (summary) and expanded views. Completion feedback is shown by expanding/highlighting the member in the widget; a short notify is also emitted when a task with an id completes.

If you'd like additional changes (e.g., add workspace persistence or a dev-mode test harness), I can prepare follow-up PRs with the necessary changes.