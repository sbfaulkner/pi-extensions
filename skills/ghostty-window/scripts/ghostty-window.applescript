-- ghostty-window.applescript: Open a new Ghostty window.
-- Usage: osascript ghostty-window.applescript [--cmd CMD] [--dir PATH]
-- Options:
--   --cmd CMD   Shell command to run in the new window
--   --dir PATH  Initial working directory

on run argv
    set cmd to ""
    set wd to ""
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
        else
            set i to i + 1
        end if
    end repeat
    tell application "Ghostty"
        if cmd is not equal to "" or wd is not equal to "" then
            set cfg to new surface configuration
            if cmd is not equal to "" then set command of cfg to cmd
            if wd is not equal to "" then set initial working directory of cfg to wd
            new window with configuration cfg
        else
            new window
        end if
    end tell
end run
