-- ghostty-current-window-id.applescript: Print the id of Ghostty's front window.
-- Used by the handoff extension to capture the target window synchronously at
-- command entry, before any awaitable work, so a later spawn-into-pane/tab can
-- anchor to that specific window even if the user switches focus in the meantime.
--
-- Prints just the integer id (or an empty string if no window is available)
-- on stdout.

on run
    try
        tell application "Ghostty"
            if (count of windows) is 0 then return ""
            return id of front window as string
        end tell
    on error
        return ""
    end try
end run
