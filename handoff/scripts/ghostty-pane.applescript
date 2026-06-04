-- ghostty-pane.applescript: Open a new Ghostty pane (split terminal).
-- Usage: osascript ghostty-pane.applescript [--direction DIR] [--cmd CMD] [--dir PATH] [--window-id ID]
-- Options:
--   --direction DIR  Split direction: right (default), left, up, down
--   --cmd CMD        Shell command to run in the new pane
--   --dir PATH       Initial working directory
--   --window-id ID   Target a specific Ghostty window by id (captured at command entry to avoid
--                    a race with the user switching focus). Falls back to a new window if the
--                    captured window is no longer present.

on run argv
    set cmd to ""
    set wd to ""
    set dirStr to "right"
    set winIdStr to ""
    set n to count of argv
    set i to 1
    repeat while i ≤ n
        set a to item i of argv
        if a is "--direction" and i + 1 ≤ n then
            set dirStr to item (i + 1) of argv
            set i to i + 2
        else if a is "--cmd" and i + 1 ≤ n then
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
        set dirConst to right
        if dirStr is equal to "right" then
            set dirConst to right
        else if dirStr is equal to "left" then
            set dirConst to left
        else if dirStr is equal to "up" then
            set dirConst to up
        else if dirStr is equal to "down" then
            set dirConst to down
        end if

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
            -- No usable window; fall back to opening a new window.
            if cmd is not equal to "" or wd is not equal to "" then
                set cfg to new surface configuration
                if cmd is not equal to "" then set command of cfg to cmd
                if wd is not equal to "" then set initial working directory of cfg to wd
                new window with configuration cfg
            else
                new window
            end if
        else
            set selectedTab to selected tab of targetWin
            set focusedTerm to focused terminal of selectedTab
            if cmd is not equal to "" or wd is not equal to "" then
                set cfg to new surface configuration
                if cmd is not equal to "" then set command of cfg to cmd
                if wd is not equal to "" then set initial working directory of cfg to wd
                split focusedTerm direction dirConst with configuration cfg
            else
                split focusedTerm direction dirConst
            end if
        end if
    end tell
end run
