#!/bin/sh
# Panel protection: the screen brightness (picture "backlight") that the screensaver lowers and the
# state that makes sure it is put back. Sourced by videoads-flag.sh (the watcher) and by
# backlight-restore.sh, not run by itself.
#
# The watcher owns the user's brightness, not the screensaver: it keeps the last stable value in
# $orig (with the picture mode it belongs to in $orig_mode), and when a screensaver starts it writes
# both into $STATE_FILE (frozen). The file stays until the brightness is back, so it also survives
# a reboot or a screensaver that was killed. The file lives outside of the app directory, in flash:
# it is written twice per screensaver, never while idle.
#
# Variables used by the functions: orig, orig_mode (set by load_state or by the watcher),
# cur_bl, cur_mode (set by read_picture).

SETTINGS_LUNA="luna://com.webos.settingsservice"
STATE_DIR="/var/lib/webosbrew/custom-screensaver-aerial"
STATE_FILE="$STATE_DIR/backlight.state"    # one line: <backlight>|<picture mode>

# BusyBox before 1.30 only takes "timeout -t SECS" (same as apply.sh)
if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi

# Reads the current backlight and picture mode into cur_bl / cur_mode. Fails if the settings
# service doesn't answer with a backlight (at boot it may not be up yet).
read_picture() {
    reply="$($TIMEOUT luna-send -n 1 "$SETTINGS_LUNA/getSystemSettings" \
        '{"category":"picture","keys":["backlight","pictureMode"]}' </dev/null 2>/dev/null || true)"
    cur_bl="$(echo "$reply" | sed -n 's/.*"backlight" *: *"\{0,1\}\([0-9]\{1,\}\).*/\1/p' | head -n 1)"
    cur_mode="$(echo "$reply" | sed -n 's/.*"pictureMode" *: *"\([^"]*\)".*/\1/p' | head -n 1)"
    [ -n "$cur_bl" ]
}

set_backlight() {  # value (0-100)
    case "$1" in ''|*[!0-9]*) return 1 ;; esac
    reply="$($TIMEOUT luna-send -n 1 "$SETTINGS_LUNA/setSystemSettings" \
        "{\"category\":\"picture\",\"settings\":{\"backlight\":$1},\"notifySelf\":false}" </dev/null 2>/dev/null || true)"
    echo "$reply" | grep -q '"returnValue" *: *true'
}

# Reads $STATE_FILE into orig / orig_mode and sets frozen=1. Returns 1 if there is none.
load_state() {
    [ -s "$STATE_FILE" ] || return 1
    line="$(head -n 1 "$STATE_FILE")"
    case "$line" in *"|"*) ;; *) return 1 ;; esac
    o="${line%%|*}"
    case "$o" in ''|*[!0-9]*) return 1 ;; esac
    orig="$o"
    orig_mode="${line#*|}"
    frozen=1
}
save_state() {
    mkdir -p "$STATE_DIR" 2>/dev/null
    echo "$orig|$orig_mode" > "$STATE_FILE" 2>/dev/null
}
clear_state() {
    rm -f "$STATE_FILE" 2>/dev/null
}

# Puts $orig back and removes the state. Returns 1 (state kept, try again later) if the settings
# service doesn't answer, the value doesn't take, or another picture mode is active: the value
# would be written into that mode's backlight. The mode comes back by itself once the video app
# that switched it is gone.
restore_backlight() {
    [ -n "$orig" ] || { clear_state; return 0; }
    read_picture || return 1
    [ "$cur_mode" = "$orig_mode" ] || return 1
    if [ "$cur_bl" != "$orig" ]; then
        set_backlight "$orig" || return 1
        read_picture && [ "$cur_bl" = "$orig" ] || return 1
        echo "aerial-notify: backlight put back to $orig"
    fi
    clear_state
}
