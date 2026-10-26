#!/bin/sh
# Puts back what apply.sh changed on webOS 26 to run the screensaver as com.webos.app.videoads:
# the lgchannels setting isVideoScreenSaverEnabled, and the block on videoads if a debloat tool
# had blocked it. Their earlier values are in /var/lib/webosbrew/aerial-videoads/state.
#
# apply.sh installs a copy of this file as /var/lib/webosbrew/init.d/49-aerial-videoads-restore,
# so it also runs after Aerial is uninstalled. At boot it does nothing while Aerial's autostart
# hook is there (that one applies again, after this). Otherwise, or when run as
#   sh /var/lib/webosbrew/init.d/49-aerial-videoads-restore now
# it puts both back, unmounts the screensaver copy if mounted, and removes itself. If something
# can't be put back, it keeps itself and the saved state and tries again at the next boot.

VA_ID="com.webos.app.videoads"
VA_DIR="/usr/palm/applications/$VA_ID"
STATE_DIR="/var/lib/webosbrew/aerial-videoads"
HOOK="/var/lib/webosbrew/init.d/49-aerial-videoads-restore"
AUTOSTART="/var/lib/webosbrew/init.d/50-custom-screensaver-aerial"
SAM="luna://com.webos.applicationManager"
SETTINGS="luna://com.webos.settingsservice"
BLOCK_SCHEMA="/etc/palm/schemas/sam/applicationManager.blockSystemApp.schema"

LOCK=/tmp/aerial-apply.lock
LOCK_WAIT=30  # seconds to wait for a running apply at boot
TRIES=3
if [ "$1" != now ]; then
    # -e follows the autostart symlink, so an uninstalled Aerial doesn't count
    [ -e "$AUTOSTART" ] && exit 0
    # Boot: the services may still be starting. Take apply.sh's lock so an Apply from the app
    # can't run at the same time ("now" comes from apply.sh, which holds it already).
    TRIES=20
    for i in $(seq 1 $LOCK_WAIT); do
        mkdir "$LOCK" 2>/dev/null && break
        [ $i -eq $LOCK_WAIT ] && { echo "videoads-restore: Aerial is applying, leaving it for the next boot" >&2; exit 0; }
        sleep 1
    done
    trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
fi
if [ ! -f "$STATE_DIR/state" ]; then
    rm -f "$HOOK"
    exit 0
fi

FLAG=false
BLOCKED=0
case "$(sed -n 's/^FLAG=//p' "$STATE_DIR/state")" in true) FLAG=true ;; esac
case "$(sed -n 's/^BLOCKED=//p' "$STATE_DIR/state")" in 1) BLOCKED=1 ;; esac

if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi
# Calls a luna method until its reply matches, for up to $TRIES tries
retry_call() {  # uri payload pattern
    for i in $(seq 1 $TRIES); do
        reply="$($TIMEOUT luna-send -n 1 "$1" "$2" </dev/null 2>/dev/null || true)"
        echo "$reply" | grep -qiE "$3" && return 0
        [ $i -lt $TRIES ] && sleep 1
    done
    echo "videoads-restore: $1 failed: $reply" >&2
    return 1
}

ok=1
unmounted=0
# The settings.json bind mount first, then the screensaver copy
for m in "$VA_DIR/settings.json" "$VA_DIR"; do
    if grep -qs " $m " /proc/mounts; then
        if umount "$m"; then unmounted=1; else ok=0; fi
    fi
done
retry_call "$SETTINGS/setSystemSettings" \
    "{\"category\":\"lgchannels\",\"settings\":{\"isVideoScreenSaverEnabled\":$FLAG}}" '"returnValue": *true' || ok=0
force=
grep -q '"forceBlockSystemApp"' "$BLOCK_SCHEMA" 2>/dev/null && force=',"forceBlockSystemApp":false'
if [ "$BLOCKED" = 1 ]; then
    # Blocked again: SAM drops videoads, and rereads LG's manifest whenever it's released
    retry_call "$SAM/blockSystemApp" "{\"id\":\"$VA_ID\"$force}" \
        '"returnValue": *true|"errorText": *"[^"]*already +blocked' || ok=0
elif [ $unmounted = 1 ]; then
    # Not blocked originally: SAM would keep serving the unmounted copy's manifest
    # (web-screensaver.html) until a reboot, so block + release to make it reread LG's own
    if retry_call "$SAM/blockSystemApp" "{\"id\":\"$VA_ID\"$force}" \
           '"returnValue": *true|"errorText": *"[^"]*already +blocked' &&
       retry_call "$SAM/releaseBlockSystemApp" "{\"id\":\"$VA_ID\"}" \
           '"returnValue": *true|"errorText": *"[^"]*not +blocked'; then
        reread=0
        for i in $(seq 1 10); do
            reply="$($TIMEOUT luna-send -n 1 "$SAM/getAppInfo" "{\"id\":\"$VA_ID\"}" </dev/null 2>/dev/null || true)"
            if echo "$reply" | grep -q '"main"' && ! echo "$reply" | grep -q 'web-screensaver\.html'; then
                reread=1; break
            fi
            sleep 1
        done
        [ $reread = 1 ] || { echo "videoads-restore: SAM still reports the screensaver copy for $VA_ID" >&2; ok=0; }
    else
        ok=0
    fi
fi

if [ $ok = 1 ]; then
    rm -f "$STATE_DIR/state"
    rmdir "$STATE_DIR" 2>/dev/null
    rm -f "$HOOK"
    echo "videoads-restore: put back isVideoScreenSaverEnabled=$FLAG$([ "$BLOCKED" = 1 ] && echo " and the block on $VA_ID")" >&2
    exit 0
fi
# Kept for the next boot
echo "videoads-restore: not everything could be put back; trying again at next boot" >&2
exit 1
