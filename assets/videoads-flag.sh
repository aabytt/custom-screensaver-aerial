#!/bin/sh
# Runs while Aerial's web screensaver is mounted, and ends by itself once it no longer is.
# Usage: videoads-flag.sh             webOS 26, mounted over com.webos.app.videoads
#        videoads-flag.sh screensaver webOS 25, mounted over com.webos.app.screensaver
#
# webOS 26 only: keeps the lgchannels setting isVideoScreenSaverEnabled on. LG's dmost service
# recalculates that setting whenever the foreground app changes, and turns it off unless LG's
# server allows its video screensaver, LG Channels (Channel Plus) is enabled, the TV is online, the
# foreground app is a Home screen, screenSaverAd is on and Art and Kids modes are off. On most TVs
# that is never all true, so without this the screensaver goes back to LG's own after the first
# app switch. This checks the setting every few seconds and switches it back on.
#
# Both: the safety net for notifications (#46). Any system toast (such as the TV's "Dolby Vision"
# one) ends the screensaver, so web-screensaver.html switches notifications off while a video
# starts. A disable outlives the page and survives a Quick Start power-off, so if the page is
# closed before it switches them back on, they would stay off. So at every check where tvpowerd
# isn't in (or entering) the Screen Saver state, this switches them on. Every check rather than
# on a change: a screensaver shorter than the poll interval would otherwise go unseen, and on
# webOS 25 an enable was reported not to take while the screensaver ran. If tvpowerd doesn't
# answer for a while, notifications are switched on anyway: a toast ending the screensaver is
# better than no notifications. This also lifts a block some other app set; none is known to.
# While the screensaver starts, tvpowerd can still report another state after the page has
# switched notifications off, so no enable while the app manager lists the screensaver app as
# running, unless that goes on for STUCK checks (an entry left behind must not block it for good).
# At every check it also writes the time into watcher.json in the mounted app directory: the page
# only switches notifications off while that is recent, so without this watcher (e.g. Aerial
# updated on webOS 25 without pressing Apply) it leaves them alone.
#
# Polling rather than subscriptions: nothing to go stale if a service restarts, and no long-lived
# child process. The screensaver only starts after minutes without input, and an app switch is
# input, so a few seconds is plenty.
#
# apply.sh starts it (as the systemd unit aerial-videoads-flag or, on webOS 25, aerial-notify where
# systemd-run exists). On webOS 26 the restore hook stops it.

if [ "$1" = screensaver ]; then
    APP_ID="com.webos.app.screensaver"
    FLAG=0
else
    APP_ID="com.webos.app.videoads"
    FLAG=1
fi
APP_DIR="/usr/palm/applications/$APP_ID"
SETTINGS="luna://com.webos.settingsservice"
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
    echo "$reply" | grep -q '"returnValue": *true' || return 1
    # Said once per change, not at every check
    [ "$quiet" = 1 ] || echo "aerial-videoads-flag: switched notifications on ($1)"
    quiet=1
}

# Switches notifications on unless the screensaver app is running (it may be starting), for up to
# $STUCK checks in a row. If the app manager doesn't answer, switches them on.
maybe_on() {  # reason
    reply="$($TIMEOUT luna-send -n 1 "$SAM/running" '{}' </dev/null 2>/dev/null || true)"
    if echo "$reply" | grep -q "\"id\": *\"$APP_ID\""; then
        listed=$((listed + 1))
        [ $listed -lt $STUCK ] && return 0
        set -- "$1, $APP_ID still listed as running"
    else
        listed=0
    fi
    notify_on "$1"
}

heartbeat() {
    echo "{\"time\":$(date +%s)}" > "$APP_DIR/watcher.json.tmp" 2>/dev/null &&
        mv "$APP_DIR/watcher.json.tmp" "$APP_DIR/watcher.json" 2>/dev/null
}

quiet=0     # 1 once notifications were switched on and the screensaver hasn't run since
no_answer=0
listed=0
ran=0
while mounted; do
    ran=1
    heartbeat
    if [ $FLAG = 1 ]; then
        reply="$($TIMEOUT luna-send -n 1 "$SETTINGS/getSystemSettings" \
            '{"category":"lgchannels","keys":["isVideoScreenSaverEnabled"]}' </dev/null 2>/dev/null || true)"
        case "$reply" in
            *'"isVideoScreenSaverEnabled":false'*|*'"isVideoScreenSaverEnabled": false'*)
                if mounted; then
                    $TIMEOUT luna-send -n 1 "$SETTINGS/setSystemSettings" \
                        '{"category":"lgchannels","settings":{"isVideoScreenSaverEnabled":true}}' </dev/null >/dev/null 2>&1
                    echo "aerial-videoads-flag: switched isVideoScreenSaverEnabled back on"
                fi ;;
        esac
    fi
    reply="$($TIMEOUT luna-send -n 1 "$POWER" '{}' </dev/null 2>/dev/null || true)"
    case "$reply" in
        # Also "processing": "Request Screen Saver", while it starts
        *'Screen Saver'*)
            no_answer=0; quiet=0; listed=0 ;;
        *'"state"'*)
            no_answer=0
            mounted && maybe_on "$(echo "$reply" | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p')" ;;
        *)
            no_answer=$((no_answer + 1))
            [ $no_answer -ge $NO_ANSWER ] && mounted && maybe_on "tvpowerd not answering" ;;
    esac
    sleep $POLL
done
# Unmounted (Aerial undone, or replaced): nothing else will switch them on
[ $ran = 1 ] && quiet=0 && notify_on "screensaver unmounted"
exit 0
