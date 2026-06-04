-- ghostty-tab.applescript: Open a new Ghostty tab.
-- Usage: osascript ghostty-tab.applescript [--cmd CMD] [--dir PATH] [--window-id ID]
-- Options:
--   --cmd CMD        Shell command to run in the new tab
--   --dir PATH       Initial working directory
--   --window-id ID   Target a specific Ghostty window by id (captured at command entry to avoid
--                    a race with the user switching focus). Falls back to a new window if the
--                    captured window is no longer present.

on run argv
    set cmd to ""
    set wd to ""
    set winIdStr to ""
    set n to count of argv
    set i to 1
    repeat while i ≤ n
        set a to item i of argv
        if a is "--cmd" and i + 1 ≤ n then
            set cmd to item (i + 1) of argv
            set i to i + 2
        else if a is "--dir" and i + 1 ≤ n then
            set wd to item (i + 1) of argv
            set i to i + 2
        else if a is "--window-id" and i + 1 ≤ n then
            set winIdStr to item (i + 1) of argv
            set i to i + 2
        else
            set i to i + 1
        end if
    end repeat
    tell application "Ghostty"
        set targetWin to missing value
        if winIdStr is not equal to "" then
            try
                set targetWin to window id (winIdStr as integer)
            on error
                set targetWin to missing value
            end try
        end if
        if targetWin is missing value then
            try
                set targetWin to front window
            on error
                set targetWin to missing value
            end try
        end if

        if targetWin is missing value then
            if cmd is not equal to "" or wd is not equal to "" then
                set cfg to new surface configuration
                if cmd is not equal to "" then set command of cfg to cmd
                if wd is not equal to "" then set initial working directory of cfg to wd
                new window with configuration cfg
            else
                new window
            end if
        else
            if cmd is not equal to "" or wd is not equal to "" then
                set cfg to new surface configuration
                if cmd is not equal to "" then set command of cfg to cmd
                if wd is not equal to "" then set initial working directory of cfg to wd
                new tab in targetWin with configuration cfg
            else
                new tab in targetWin
            end if
        end if
    end tell
end run
