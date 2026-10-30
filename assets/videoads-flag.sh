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
# Polling rather than subscriptions: nothing to go stale if a service restarts, and no long-lived
# child process. The screensaver only starts after minutes without input, and an app switch is
# input, so a few seconds is plenty.
#
# apply.sh starts it, as the systemd unit aerial-notify where systemd-run exists.

APP_DIR="/usr/palm/applications/com.webos.app.screensaver"
APP_IDS="com\.webos\.app\.(screensaver|videoads)"
HEARTBEAT="/tmp/aerial-watcher.json"
POWER="luna://com.webos.service.tvpower/power/getPowerState"
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
    grep -qs " $APP_DIR " /proc/mounts
}

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
    reply="$($TIMEOUT luna-send -n 1 "$SAM/running" '{}' </dev/null 2>/dev/null || true)"
    if echo "$reply" | grep -qE "\"id\" *: *\"$APP_IDS\""; then
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
    { echo "{\"time\":$(date +%s)}" > "$HEARTBEAT"; } 2>/dev/null
}

quiet=0     # 1 once notifications were switched on and the screensaver hasn't run since
no_answer=0
listed=0
ran=0
while mounted; do
    ran=1
    heartbeat
    reply="$($TIMEOUT luna-send -n 1 "$POWER" '{}' </dev/null 2>/dev/null || true)"
    state="$(echo "$reply" | sed -n 's/.*"state" *: *"\([^"]*\)".*/\1/p')"
    processing="$(echo "$reply" | sed -n 's/.*"processing" *: *"\([^"]*\)".*/\1/p')"
    # The exact values, not any "Screen Saver" in the reply: "processing": "Screen Saver Ready"
    # (webOS 25, while the screensaver starts) can stay for minutes after a screensaver closed
    # during its start. While it starts, the app manager check in maybe_on holds the enable back.
    if [ "$state" = "Screen Saver" ] || [ "$processing" = "Request Screen Saver" ]; then
        no_answer=0; quiet=0; listed=0
    elif [ -n "$state" ]; then
        no_answer=0
        mounted && maybe_on "$state${processing:+, $processing}"
    else
        no_answer=$((no_answer + 1))
        [ $no_answer -ge $NO_ANSWER ] && mounted && maybe_on "tvpowerd not answering"
    fi
    sleep $POLL
done
# Unmounted (Aerial undone, or replaced): nothing else will switch them on
[ $ran = 1 ] && quiet=0 && notify_on "screensaver unmounted"
exit 0
