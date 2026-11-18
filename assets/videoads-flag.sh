#!/bin/sh
# Runs while Aerial's web screensaver is mounted, and ends by itself once it no longer is. The
# name is from when it also kept LG's isVideoScreenSaverEnabled setting on for webOS 26.
#
# The safety net for notifications (#46). Any system toast (such as the TV's "Dolby Vision" one)
# ends the screensaver, so web-screensaver.html switches notifications off while a video starts.
# A disable outlives the page and survives a Quick Start power-off, so if the page is closed
# before it switches them back on, they would stay off. So at every check where tvpowerd isn't in
# (or entering) the Screen Saver state, this switches them on. Every check rather than on a
# change: a screensaver shorter than the poll interval would otherwise go unseen, and on webOS 25
# an enable was reported not to take while the screensaver ran. If tvpowerd doesn't answer for a
# while, notifications are switched on anyway: a toast ending the screensaver is better than no
# notifications. This also lifts a block some other app set; none is known to.
# While the screensaver starts, tvpowerd can still report another state after the page has
# switched notifications off, so no enable while the app manager lists the screensaver as running
# (as com.webos.app.screensaver or, where apply.sh mounted it there too, com.webos.app.videoads),
# unless that goes on for STUCK checks (an entry left behind must not block it for good).
# At every check it also writes the time into /tmp/aerial-watcher.json, which apply.sh
# bind-mounts over watcher.json in the screensaver's app directories: the page only switches
# notifications off while that is recent, so without this watcher (e.g. Aerial updated without
# pressing Apply) it leaves them alone. The file is written in place, as a bind mount would keep
# pointing at a replaced file.
#
# Panel protection (brightness, see backlight-lib.sh). The screensaver lowers the screen
# brightness (picture "backlight") and puts it back itself, but it can be cut off or the TV can
# reboot first. So this watcher keeps the user's brightness (a value that stayed the same for
# STABLE checks while no screensaver ran), publishes it as "orig" in the heartbeat file (the
# screensaver changes the brightness only with it, i.e. only while this watcher runs), saves it
# to a file when either tvpowerd or the app manager reports the screensaver running, and puts it
# back only after both report it stopped: also after a reboot (the file is read at start). Without
# a watcher the brightness is not touched.
# The same watcher also serves the QML screensaver (older webOS): then it is its qml/main.qml that
# is mounted instead of the app directory.
#
# Panel-off and standby timers are owned here too. This process outlives either screensaver page;
# a confirmed app-manager stop clears both pending actions, while panel-off leaves standby armed.
#
# Solar mode (sunrise / sunset). The same watcher keeps solar.json up to date: at its start (so
# after every boot, as apply.sh starts it) and then every SOLAR_EVERY checks it runs
# solar-update.sh, which fetches new times about once a day and does nothing in between (see there).
# This is what makes it work without anyone opening the app.
#
# Polling rather than subscriptions: nothing to go stale if a service restarts, and no long-lived
# child process. The screensaver only starts after minutes without input, and an app switch is
# input, so a few seconds is plenty.
#
# apply.sh starts it, as the systemd unit aerial-notify where systemd-run exists.

APP_DIR="/usr/palm/applications/com.webos.app.screensaver"
APP_IDS="com\.webos\.app\.(screensaver|videoads)"
HEARTBEAT="/tmp/aerial-watcher.json"
POWER="luna://com.webos.service.tvpower/power/getPowerState"
TVPOWER="luna://com.webos.service.tvpower/power"
NOTIFY="luna://com.webos.notification"
SAM="luna://com.webos.applicationManager"
POLL=5         # seconds between checks
NO_ANSWER=6    # checks without an answer from tvpowerd before switching notifications on anyway
STUCK=3        # checks with the screensaver app listed, outside Screen Saver, before enabling anyway

if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi

mounted() {
    grep -qs " $APP_DIR " /proc/mounts || grep -qs " $APP_DIR/qml/main.qml " /proc/mounts
}

ASSETS_DIR="$(dirname "$(realpath "$0")")"
SETTINGS="$ASSETS_DIR/settings.json"
SOLAR_EVERY=60 # checks (5 min) between runs of solar-update.sh, which fetches only when due
STABLE=6       # checks (POLL seconds each) the brightness must stay the same to count as the user's

. "$ASSETS_DIR/backlight-lib.sh"

# luna-send gets /dev/null as stdin: run from a script it was reported to return nothing
# otherwise (#55)
notify_on() {  # reason
    reply="$($TIMEOUT luna-send -n 1 "$NOTIFY/enable" '{}' </dev/null 2>/dev/null || true)"
    echo "$reply" | grep -q '"returnValue" *: *true' || return 1
    # Said once per change, not at every check
    [ "$quiet" = 1 ] || echo "aerial-notify: switched notifications on ($1)"
    quiet=1
}

# Switches notifications on unless the screensaver app is running (it may be starting), for up to
# $STUCK checks in a row. If the app manager doesn't answer, switches them on.
maybe_on() {  # reason
    if [ "$ss_running" = 1 ]; then
        listed=$((listed + 1))
        [ $listed -lt $STUCK ] && return 0
        set -- "$1, the screensaver still listed as running"
    else
        listed=0
    fi
    notify_on "$1"
}

# In place (a bind mount would keep pointing at a replaced file); the page treats a half-written
# file as no watcher for that second. Errors are dropped: this runs every check.
heartbeat() {
    extra=
    [ "$frozen" = 1 ] && [ -n "$orig" ] && extra=",\"orig\":$orig"
    { echo "{\"time\":$(date +%s)$extra,\"protectionElapsed\":$protection_elapsed,\"panelOff\":$protection_panel_off,\"standbyDone\":$protection_standby_done,\"protectionWarning\":\"$protection_warning\",\"protectionWarningUntil\":$protection_warning_until}" > "$HEARTBEAT"; } 2>/dev/null
}

# ---- brightness ----
# Whether the app manager lists the screensaver app as running. Unknown is distinct from stopped:
# a failed query must not release brightness protection or make the watcher track a dimmed value.
ss_check() {
    reply="$($TIMEOUT luna-send -n 1 "$SAM/running" '{}' </dev/null 2>/dev/null || true)"
    if echo "$reply" | grep -qE "\"id\" *: *\"$APP_IDS\""; then
        ss_running=1
    elif echo "$reply" | grep -q '"returnValue" *: *true'; then
        ss_running=0
    else
        ss_running=-1
    fi
}

# Panel-off and standby timers belong to this watcher rather than the screensaver page. The page
# can disappear before a timer fires; an explicit app-manager stop cancels both pending actions.
protection_value() {
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p" "$SETTINGS" | head -n 1
}
protection_enabled() {
    grep -qsE "\"$1\" *: *true" "$SETTINGS"
}
protection_action() {  # service, payload
    reply="$($TIMEOUT luna-send -n 1 "$1" "$2" </dev/null 2>/dev/null || true)"
    echo "$reply" | grep -q '"returnValue" *: *true'
}
protection_tick() {
    now="$(date +%s)"
    case "$now" in ''|*[!0-9]*) return 0 ;; esac
    if [ "$ss_running" = 1 ]; then
        if [ "$protection_active" = 0 ]; then
            protection_active=1
            protection_started=$now
            protection_elapsed=0
            protection_panel_off=0
            protection_standby_done=0
            protection_off_logged=0
        else
            protection_elapsed=$((now - protection_started))
            [ "$protection_elapsed" -ge 0 ] || protection_elapsed=0
        fi

        off_after="$(protection_value offAfter)"
        standby_after="$(protection_value standbyAfter)"
        if protection_enabled offOn && protection_enabled standbyOn &&
           [ -n "$off_after" ] && [ -n "$standby_after" ] &&
           [ "$standby_after" -lt "$off_after" ]; then
            standby_after="$off_after"
        fi

        next_warning=
        next_warning_until=0
        if protection_enabled standbyOn && [ -n "$standby_after" ] &&
           [ "$protection_elapsed" -ge $((standby_after * 60 - 30)) ] &&
           [ "$protection_elapsed" -lt $((standby_after * 60)) ]; then
            next_warning=standby
            next_warning_until=$((protection_started + standby_after * 60))
        elif protection_enabled offOn && [ -n "$off_after" ] &&
             [ "$protection_elapsed" -ge $((off_after * 60 - 30)) ] &&
             [ "$protection_elapsed" -lt $((off_after * 60)) ]; then
            next_warning=off
            next_warning_until=$((protection_started + off_after * 60))
        fi
        if [ "$next_warning" != "$protection_warning" ] ||
           [ "$next_warning_until" != "$protection_warning_until" ]; then
            protection_warning="$next_warning"
            protection_warning_until=$next_warning_until
        fi

        if [ "$protection_panel_off" = 0 ] && protection_enabled offOn &&
           [ -n "$off_after" ] && [ "$protection_elapsed" -ge $((off_after * 60)) ]; then
            protection_panel_off=1
            protection_warning=
            protection_warning_until=0
            if ! restore_backlight && [ "$protection_off_logged" = 0 ]; then
                echo "aerial-notify: could not restore backlight before panel turn-off"
                protection_off_logged=1
            fi
            if ! protection_action "$TVPOWER/turnOffScreen" '{}'; then
                echo "aerial-notify: panel turn-off timer service call failed"
                protection_off_logged=1
            fi
        fi

        if [ "$protection_standby_done" = 0 ] && protection_enabled standbyOn &&
           [ -n "$standby_after" ] && [ "$protection_elapsed" -ge $((standby_after * 60)) ]; then
            protection_standby_done=1
            protection_warning=
            protection_warning_until=0
            if ! protection_action "$TVPOWER/powerOff" '{"reason":"remoteKey"}'; then
                echo "aerial-notify: standby timer service call failed"
            fi
        fi
    elif [ "$ss_running" = 0 ] && [ "$protection_active" = 1 ]; then
        protection_active=0
        protection_started=0
        protection_elapsed=0
        protection_panel_off=0
        protection_standby_done=0
        protection_warning=
        protection_warning_until=0
    fi
}
protection_wait() {
    wait="$POLL"
    if [ "$protection_active" = 1 ]; then
        off_after="$(protection_value offAfter)"
        standby_after="$(protection_value standbyAfter)"
        if protection_enabled offOn && protection_enabled standbyOn &&
           [ -n "$off_after" ] && [ -n "$standby_after" ] &&
           [ "$standby_after" -lt "$off_after" ]; then
            standby_after="$off_after"
        fi
        if protection_enabled offOn && [ -n "$off_after" ]; then
            remaining=$((off_after * 60 - protection_elapsed))
            [ "$remaining" -gt 0 ] && [ "$remaining" -le $((30 + POLL)) ] && wait=1
        fi
        if protection_enabled standbyOn && [ -n "$standby_after" ]; then
            remaining=$((standby_after * 60 - protection_elapsed))
            [ "$remaining" -gt 0 ] && [ "$remaining" -le $((30 + POLL)) ] && wait=1
        fi
    fi
    sleep "$wait"
}

# The brightness is only followed while the protection uses it (brightness or dimming switched on)
prot_enabled() {
    grep -qsE '"(brightnessOn|dimOn)" *: *true' "$SETTINGS"
}

# Screensaver not running: follow the brightness, $orig is the value that stayed the same
prot_track() {
    if ! prot_enabled; then
        orig=; orig_mode=; cand=; cand_n=0
        return 0
    fi
    read_picture || return 0
    if [ "$cur_bl" = "$cand" ] && [ "$cur_mode" = "$cand_mode" ]; then
        [ $cand_n -lt $STABLE ] && cand_n=$((cand_n + 1))
    else
        cand="$cur_bl"; cand_mode="$cur_mode"; cand_n=1
    fi
    if [ $cand_n -ge $STABLE ]; then
        orig="$cand"; orig_mode="$cand_mode"
    fi
}

# Screensaver running: keep $orig from now on. Without a stable one (watcher just started) nothing
# is saved, and the screensaver, which gets no "orig", leaves the brightness alone.
prot_freeze() {
    [ $frozen = 1 ] && return 0
    [ -n "$orig" ] || return 0
    if save_state; then
        frozen=1
    fi
}

# Screensaver not running (and tvpowerd answered)
prot_idle() {
    if [ $frozen = 1 ]; then
        # A non-screensaver tvpower state alone can arrive while the page is still active.
        # Keep ownership until the app manager explicitly reports it stopped.
        [ "$ss_running" = 0 ] || return 0
        restore_backlight && frozen=0
        return 0
    fi
    [ "$ss_running" = -1 ] && return 0
    prot_track
}

# In the background, so a slow network never delays the checks; it does nothing when not due
solar_tick() {
    [ -f "$ASSETS_DIR/solar-update.sh" ] || return 0
    solar_n=$((solar_n + 1))
    [ $solar_n -ge $SOLAR_EVERY ] || return 0
    solar_n=0
    { sh "$ASSETS_DIR/solar-update.sh" </dev/null >/dev/null 2>&1 & } 2>/dev/null
}

# A restart always replays the cache; subsequent runs use the deadline returned
# by the hook. Network work stays in the child, not in the watcher loop.
update_dir="$(mktemp -d /tmp/aerial-update-watcher.XXXXXX 2>/dev/null)"
trap '[ -z "$update_dir" ] || rm -f "$update_dir/next"; [ -z "$update_dir" ] || rmdir "$update_dir"' 0
trap 'exit 0' HUP INT TERM
update_pid=
update_due=0
update_last=0
update_tick() {
    [ -n "$update_dir" ] && [ -f "$ASSETS_DIR/update-check.sh" ] || return 0
    if [ -n "$update_pid" ]; then
        kill -0 "$update_pid" 2>/dev/null && return 0
        wait "$update_pid" 2>/dev/null || true
        if read -r next < "$update_dir/next"; then
            case "$next" in ''|*[!0-9]*) ;; *) update_due="$next" ;; esac
        fi
        update_pid=
    fi
    update_now="$(date +%s)"
    [ "$update_now" -ge "$update_last" ] || update_due=0
    update_last="$update_now"
    [ "$update_now" -ge "$update_due" ] || return 0
    update_due=$((update_now + 30)) # busy lock, timeout or interrupted hook
    sh "$ASSETS_DIR/update-check.sh" </dev/null >"$update_dir/next" &
    update_pid=$!
}

orig=; orig_mode=; cand=; cand_mode=; cand_n=0; frozen=0; ss_running=-1
protection_active=0; protection_started=0; protection_elapsed=0
protection_panel_off=0; protection_standby_done=0
protection_warning=; protection_warning_until=0
protection_off_logged=0
solar_n=$SOLAR_EVERY   # due at the first check
load_state || true   # a screensaver that left the brightness lowered (killed, or the TV rebooted)
quiet=0     # 1 once notifications were switched on and the screensaver hasn't run since
no_answer=0
listed=0
ran=0
while mounted; do
    ran=1
    solar_tick
    update_tick
    reply="$($TIMEOUT luna-send -n 1 "$POWER" '{}' </dev/null 2>/dev/null || true)"
    state="$(echo "$reply" | sed -n 's/.*"state" *: *"\([^"]*\)".*/\1/p')"
    processing="$(echo "$reply" | sed -n 's/.*"processing" *: *"\([^"]*\)".*/\1/p')"
    ss_check
    # The exact values, not any "Screen Saver" in the reply: "processing": "Screen Saver Ready"
    # (webOS 25, while the screensaver starts) can stay for minutes after a screensaver closed
    # during its start. While it starts, the app manager check in maybe_on holds the enable back.
    if [ "$state" = "Screen Saver" ] || [ "$processing" = "Request Screen Saver" ]; then
        no_answer=0; quiet=0; listed=0
        prot_freeze
    elif [ -n "$state" ]; then
        no_answer=0
        mounted && maybe_on "$state${processing:+, $processing}"
        if [ "$ss_running" = 1 ]; then prot_freeze; else prot_idle; fi
    else
        no_answer=$((no_answer + 1))
        [ $no_answer -ge $NO_ANSWER ] && mounted && maybe_on "tvpowerd not answering"
        [ "$ss_running" = 1 ] && prot_freeze
    fi
    protection_tick "$state" "$processing"
    heartbeat
    protection_wait
done
# Unmounted (Aerial undone, or replaced): nothing else will switch them on, or put the brightness back
[ $ran = 1 ] && quiet=0 && notify_on "screensaver unmounted"
[ $frozen = 1 ] && { restore_backlight || true; }
exit 0
