# nodoz

Keep your Mac awake while Pi is actively working.

`nodoz` is a focused lifecycle-driven extension: it starts a scoped macOS
`caffeinate` process when an agent turn starts and stops it when all active turns
finish.

## Behavior

- Runs only in interactive TTY sessions (`process.stdout.isTTY === true`).
  Non-interactive sessions and subagents do not register handlers or spawn
  anything, so they do not pile up duplicate sleep inhibitors.
- Starts on `agent_start`.
- Uses an active-turn refcount so nested or overlapping starts keep one shared
  inhibitor alive.
- Releases on the final `agent_end`.
- Releases immediately on `session_shutdown`.
- Shows a dim `👀 nodoz` footer status while the inhibitor is active.
- Registers a synchronous `process.on("exit")` cleanup safety net.
- Kills only the `caffeinate` child process that this extension spawned. It does
  not use `pkill` or touch other `caffeinate` processes.

## macOS semantics

On macOS, `nodoz` runs:

```bash
caffeinate -d -i -s
```

Those flags mean:

- `-d` — prevent display sleep.
- `-i` — prevent idle system sleep.
- `-s` — prevent system sleep; on macOS this applies only while on AC power.

This is best-effort for keeping an active workstation awake while Pi is working.
`caffeinate` does not directly override all screen saver, lock screen, MDM, or
security policies. `nodoz` intentionally does **not** pass `-u`, so it will not
repeatedly declare user activity or aggressively wake displays on each turn.

## Unsupported platforms

Version 1 is macOS-focused. On unsupported platforms the lifecycle handlers are
registered in interactive sessions, but no inhibitor command is spawned.

Future Linux support can fit into the existing command-selection helper, likely
using:

```bash
systemd-inhibit --what=idle:sleep --mode=block sleep infinity
```
