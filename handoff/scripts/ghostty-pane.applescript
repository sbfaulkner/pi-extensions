-- ghostty-pane.applescript: Open a new Ghostty pane (split terminal).
-- Usage: osascript ghostty-pane.applescript [--direction DIR] [--cmd CMD] [--dir PATH]
--                                            [--terminal-id ID] [--window-id ID]
-- Options:
--   --direction DIR    Split direction: right (default), left, up, down
--   --cmd CMD          Shell command to run in the new pane
--   --dir PATH         Initial working directory
--   --terminal-id ID   Anchor the split to a specific terminal surface, by stable id.
--                      (Strict race fix: captured at command entry, so the new pane lands
--                      on this exact surface regardless of where focus is now.)
--   --window-id ID     Fallback anchor: a specific window's selected-tab focused terminal.
--                      Used when the captured terminal is gone but the window still exists.
--
-- Resolution order:
--   1. terminal id (strict)
--   2. window id (its current selected tab's focused terminal)
--   3. front window (best-effort)
--   4. new window (last resort)

on run argv
    set cmd to ""
    set wd to ""
    set dirStr to "right"
    set termIdStr to ""
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
        else if a is "--terminal-id" and i + 1 ≤ n then
            set termIdStr to item (i + 1) of argv
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

        -- Build the surface configuration once if needed.
        set hasCfg to (cmd is not equal to "" or wd is not equal to "")
        if hasCfg then
            set cfg to new surface configuration
            if cmd is not equal to "" then set command of cfg to cmd
            if wd is not equal to "" then set initial working directory of cfg to wd
        end if

        -- 1. Strict anchor: split the exact terminal we captured at command entry.
        set targetTerm to missing value
        if termIdStr is not equal to "" then
            try
                set targetTerm to terminal id termIdStr
            on error
                set targetTerm to missing value
            end try
        end if

        if targetTerm is not missing value then
            if hasCfg then
                split targetTerm direction dirConst with configuration cfg
            else
                split targetTerm direction dirConst
            end if
            return
        end if

        -- 2. Window-anchored fallback: use the captured window's currently-selected tab.
        set targetWin to missing value
        if winIdStr is not equal to "" then
            try
                set targetWin to window id winIdStr
            on error
                set targetWin to missing value
            end try
        end if

        -- 3. Best-effort: the current front window.
        if targetWin is missing value then
            try
                set targetWin to front window
            on error
                set targetWin to missing value
            end try
        end if

        if targetWin is missing value then
            -- 4. Last resort: open a new window with the configuration.
            if hasCfg then
                new window with configuration cfg
            else
                new window
            end if
        else
            set focusedTerm to focused terminal of selected tab of targetWin
            if hasCfg then
                split focusedTerm direction dirConst with configuration cfg
            else
                split focusedTerm direction dirConst
            end if
        end if
    end tell
end run
