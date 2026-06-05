-- ghostty-current-anchor.applescript: Print stable ids of Ghostty's currently-focused context.
-- Used by the handoff extension to capture spawn anchors synchronously at command entry,
-- before any awaitable work, so a later spawn-into-pane/tab can land in the exact place
-- the user invoked the command from even if focus moves in the meantime.
--
-- Output is two lines on stdout:
--   <window-id>
--   <terminal-id>
-- Either line may be empty if that anchor is unavailable. Empty output overall means
-- Ghostty isn't running or has no windows; the caller will fall back appropriately.

on run
    try
        tell application "Ghostty"
            if (count of windows) is 0 then return ""
            set winId to id of front window
            set termId to ""
            try
                set termId to id of focused terminal of selected tab of front window
            on error
                set termId to ""
            end try
            return (winId as text) & linefeed & (termId as text)
        end tell
    on error
        return ""
    end try
end run
