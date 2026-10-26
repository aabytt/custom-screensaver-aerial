#!/bin/sh
# webOS 26: keeps the lgchannels setting isVideoScreenSaverEnabled on while Aerial's screensaver
# is mounted over com.webos.app.videoads.
#
# LG's dmost service recalculates that setting whenever the foreground app changes, and turns it
# off unless LG's server allows its video screensaver, LG Channels (Channel Plus) is enabled, the
# TV is online, the foreground app is a Home screen, screenSaverAd is on and Art and Kids modes are
# off. On most TVs that is never all true, so without this the screensaver goes back to LG's own
# after the first app switch. This checks the setting every few seconds and switches it back on.
# Polling rather than a subscription: nothing to go stale if the settings service restarts, and
# no long-lived child process. The screensaver only starts after minutes without input, and an
# app switch is input, so a few seconds is plenty.
#
# apply.sh starts it (as the systemd unit aerial-videoads-flag where systemd-run exists) and the
# restore hook stops it. It also ends by itself once the screensaver copy is no longer mounted.

VA_DIR="/usr/palm/applications/com.webos.app.videoads"
SETTINGS="luna://com.webos.settingsservice"
POLL=5  # seconds between checks

if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi

mounted() {
    grep -qs " $VA_DIR " /proc/mounts
}

while mounted; do
    # luna-send gets /dev/null as stdin: run from a script it was reported to return nothing
    # otherwise (#55)
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
    sleep $POLL
done
exit 0
