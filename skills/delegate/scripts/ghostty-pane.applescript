-- ghostty-pane.applescript: Open a new Ghostty pane (split terminal).
-- Usage: osascript ghostty-pane.applescript [--direction DIR] [--cmd CMD] [--dir PATH]
-- Options:
--   --direction DIR  Split direction: right (default), left, up, down
--   --cmd CMD        Shell command to run in the new pane
--   --dir PATH       Initial working directory

on run argv
    set cmd to ""
    set wd to ""
    set dirStr to "right"
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
        set frontWin to front window
        set selectedTab to selected tab of frontWin
        set focusedTerm to focused terminal of selectedTab
        if cmd is not equal to "" or wd is not equal to "" then
            set cfg to new surface configuration
            if cmd is not equal to "" then set command of cfg to cmd
            if wd is not equal to "" then set initial working directory of cfg to wd
            split focusedTerm direction dirConst with configuration cfg
        else
            split focusedTerm direction dirConst
        end if
    end tell
end run
