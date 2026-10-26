#!/bin/sh

set -e -o pipefail

APP_ID="com.webos.app.screensaver"
APP_DIR="/usr/palm/applications/$APP_ID"
MOUNT_TARGET="$APP_DIR/qml/main.qml"
ASSETS_DIR="$(dirname "$(realpath "$0")")"
QML_PATH="$ASSETS_DIR/screensaver-main.qml"
SAM="luna://com.webos.applicationManager"
SETTINGS="luna://com.webos.settingsservice"
BLOCK_SCHEMA="/etc/palm/schemas/sam/applicationManager.blockSystemApp.schema"

# webOS 26 (11.x): see apply_videoads
VA_ID="com.webos.app.videoads"
VA_DIR="/usr/palm/applications/$VA_ID"
VA_STAGE="/tmp/aerial-videoads"
VA_STATE_DIR="/var/lib/webosbrew/aerial-videoads"
VA_RESTORE_HOOK="/var/lib/webosbrew/init.d/49-aerial-videoads-restore"
BLOCKED_LIST_DIR="/var/preferences/com.webos.applicationManager/blockedSystemAppList"
VA_FLAG_UNIT="aerial-videoads-flag"
VA_FLAG_PIDFILE="$VA_STATE_DIR/flag.pid"
SAM_WAIT=60   # seconds to wait for SAM at boot

if [[ -f "$MOUNT_TARGET" ]]; then
    if ! findmnt "$MOUNT_TARGET"; then
        mount --bind "$QML_PATH" "$MOUNT_TARGET"
        echo "[+] Enabled succesfully" >&2
    else
        echo "[~] Enabled already" >&2
    fi
    exit 0
fi

# Calls a luna method and checks its reply against an extended regex (case-insensitive). The
# reply is captured first so luna-send's own exit status doesn't matter under pipefail, and the
# call gives up after 8 s so a busy service can't hang the app or the boot hooks. luna-send gets
# /dev/null as stdin: run from a script it was reported to return nothing otherwise (#55).
# BusyBox before 1.30 only takes "timeout -t SECS"
if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi
luna_call() {  # uri payload pattern
    reply="$($TIMEOUT luna-send -n 1 "$1" "$2" </dev/null 2>/dev/null || true)"
    echo "$reply" | grep -qiE "$3"
}
sam_call() {  # method payload pattern
    luna_call "$SAM/$1" "$2" "$3"
}

# Whether SAM's getAppInfo for app $1 matches $2, polling for up to 20 s: at boot SAM can still
# be on its own first scan and takes the reread after it
sam_reports() {  # app pattern
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
        if sam_call getAppInfo "{\"id\":\"$1\"}" "$2"; then
            return 0
        fi
        [[ $i -lt 20 ]] && sleep 1
    done
    return 1
}

# Takes app $1 out of LG's blocked system app list (kept across reboots in
# /var/preferences/com.webos.applicationManager/blockedSystemAppList). SAM refuses the release
# when nothing is blocked on some TVs, which counts as released. Tries $2 times (default 3).
release_block() {  # app [tries]
    tries=${2:-3}
    i=1
    while :; do
        if sam_call releaseBlockSystemApp "{\"id\":\"$1\"}" '"returnValue": *true|"errorText": *"[^"]*not +blocked'; then
            return 0
        fi
        [[ $i -ge $tries ]] && return 1
        i=$((i + 1))
        sleep 1
    done
}

# SAM caches appinfo.json. Blocking an app and releasing it at once makes SAM reread its
# manifest (and so see a mounted replacement) without restarting SAM, which closes every
# running app and on webOS 26 was reported to leave SAM's app registration broken (#50). Same
# approach as Glasshouse (rorygallagher2024/glasshouse, server/lib/samrescan.js) and Luma
# (ecklf/lg-luma, tv/home.cjs). webOS 26 (11.x) refuses the block unless it has
# forceBlockSystemApp, which its schema requires; older firmware gets it only where the schema
# names it. A block left by an interrupted run (or by debloat tools) answers "already blocked"
# and is released here, so the app also ends up unblocked.
# Returns 0 once getAppInfo for $1 matches $2, 2 if the block took but couldn't be released,
# and 1 otherwise (no block/release, or SAM didn't reread in time).
sam_reread() {  # app pattern
    force=
    if grep -q '"forceBlockSystemApp"' "$BLOCK_SCHEMA" 2>/dev/null; then
        force=',"forceBlockSystemApp":false'
    fi
    if ! sam_call blockSystemApp "{\"id\":\"$1\"$force}" '"returnValue": *true|"errorText": *"[^"]*already +blocked'; then
        # A block that timed out may still have taken effect, so release once, quietly
        release_block "$1" 1 || true
        return 1
    fi
    if ! release_block "$1" 3; then
        return 2
    fi
    sam_reports "$1" "$2"
}

# Makes SAM pick up the mounted web app; on failure, says why and exits.
apply_web() {
    if ! systemctl is-active -q sam.service; then
        # SAM isn't up yet: it reads the mounted manifest on its first scan
        echo "[+] Enabled succesfully (web screensaver)" >&2
        exit 0
    fi
    rc=0
    sam_reread "$APP_ID" '"type": *"web"' || rc=$?
    if [[ $rc -eq 0 ]]; then
        echo "[+] Enabled succesfully (web screensaver)" >&2
    elif [[ $rc -eq 2 ]]; then
        # Put the stock screensaver back so the next apply starts over
        umount "$APP_DIR" || true
        echo "[-] Could not release $APP_ID from LG's blocked system app list, so no screensaver can launch." >&2
        echo "    Apply again, or run: luna-send -n 1 $SAM/releaseBlockSystemApp '{\"id\":\"$APP_ID\"}'" >&2
        exit 1
    else
        # SAM has no block/release or didn't take it: fall back to restarting it in the
        # background so this script can return before SAM closes the running apps
        (sleep 2; systemctl restart sam.service) >/dev/null 2>&1 &
        echo "[+] Enabled succesfully (web screensaver, restarting SAM)" >&2
    fi
    exit 0
}

# webOS major version, as Glasshouse reads it: /etc/issue, else /etc/starfish-release
webos_major() {
    v=$(sed -n 's/.*webOS[^0-9]*\([0-9][0-9]*\)\..*/\1/p' /etc/issue 2>/dev/null | head -n 1)
    [[ -n "$v" ]] || v=$(sed -n 's/.*release[^0-9]*\([0-9][0-9]*\)\..*/\1/p' /etc/starfish-release 2>/dev/null | head -n 1)
    echo "$v"
}

# Reads lgchannels/isVideoScreenSaverEnabled and prints true or false, retrying for up to $1
# seconds (the settings service may still be starting at boot). A reply without the key counts as
# false, and "true"/"false" strings are accepted. Fails if the service never gives a valid reply.
read_video_flag() {  # seconds
    for i in $(seq 1 $1); do
        reply="$($TIMEOUT luna-send -n 1 "$SETTINGS/getSystemSettings" '{"category":"lgchannels","keys":["isVideoScreenSaverEnabled"]}' </dev/null 2>/dev/null || true)"
        if echo "$reply" | grep -qE '"isVideoScreenSaverEnabled": *"?true"?'; then
            echo true; return 0
        elif echo "$reply" | grep -qE '"isVideoScreenSaverEnabled": *"?false"?'; then
            echo false; return 0
        elif echo "$reply" | grep -qE '"returnValue": *true'; then
            echo false; return 0
        fi
        [[ $i -lt $1 ]] && sleep 1
    done
    echo "$reply" >&2
    return 1
}

video_flag() {  # true|false
    for i in 1 2 3; do
        if luna_call "$SETTINGS/setSystemSettings" \
            "{\"category\":\"lgchannels\",\"settings\":{\"isVideoScreenSaverEnabled\":$1}}" '"returnValue": *true' &&
           [[ "$(read_video_flag 1 2>/dev/null)" = "$1" ]]; then
            return 0
        fi
        [[ $i -lt 3 ]] && sleep 1
    done
    return 1
}

# webOS 26 (11.x): tvpowerd ends com.webos.app.screensaver as soon as it starts a video, but it
# lets com.webos.app.videoads, LG's own video screensaver, play video. tvpowerd launches that one
# instead when the lgchannels setting isVideoScreenSaverEnabled is on. So on webOS 26 the web
# screensaver goes over videoads (a copy of assets/ in /tmp with that app id, as videoads is a web
# app with the screenSaver window type too), videoads is unblocked if a debloat tool blocked it,
# and the setting is switched on.
#
# The mount and the copy go away on reboot, but the setting and the block list don't, so tvpowerd
# would then launch LG's own videoads. Before changing anything, the setting and whether videoads
# was blocked are saved to $VA_STATE_DIR, and videoads-restore.sh is installed as a boot hook
# (a copy, so it also runs after Aerial is uninstalled). At boot, unless Aerial's autostart hook
# is there to apply again, it puts both back and removes itself. And any run of this script that
# ends without a working videoads screensaver while that state exists puts them back too
# (va_restore_unless_kept, from the EXIT trap): a failed apply, an apply at boot before SAM is up,
# or a TV that is no longer on webOS 26.
VA_KEEP=0
va_restore_unless_kept() {
    if [[ $VA_KEEP -eq 1 || ! -f "$VA_STATE_DIR/state" || ! -f "$VA_RESTORE_HOOK" ]]; then
        return 0
    fi
    if sh "$VA_RESTORE_HOOK" now >&2; then
        echo "[~] LG's video screensaver setting and the $VA_ID block were put back" >&2
    else
        echo "[-] Not all of LG's settings could be put back; $VA_RESTORE_HOOK tries again at every boot" >&2
    fi
}

# LG's dmost service switches isVideoScreenSaverEnabled off again at every foreground app change
# unless its own conditions hold (see videoads-flag.sh), so a watcher switches it back on while
# the screensaver is applied. Run as a transient systemd unit where systemd-run exists, so the
# restore hook can stop it with everything it started; otherwise in the background with a pidfile.
# The fallback runs it in its own process group (setsid), so stopping it also stops a check or
# sleep it's in the middle of.
stop_flag_watcher() {
    systemctl stop "$VA_FLAG_UNIT" >/dev/null 2>&1 || true
    systemctl reset-failed "$VA_FLAG_UNIT" >/dev/null 2>&1 || true
    if [[ -f "$VA_FLAG_PIDFILE" ]]; then
        pid="$(cat "$VA_FLAG_PIDFILE")"
        kill -s TERM "-$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
        rm -f "$VA_FLAG_PIDFILE"
    fi
}
start_flag_watcher() {
    stop_flag_watcher
    if command -v systemd-run >/dev/null 2>&1 &&
       systemd-run --no-block --unit="$VA_FLAG_UNIT" /bin/sh "$ASSETS_DIR/videoads-flag.sh" >/dev/null 2>&1; then
        return 0
    fi
    if command -v setsid >/dev/null 2>&1; then
        setsid /bin/sh "$ASSETS_DIR/videoads-flag.sh" </dev/null >/dev/null 2>&1 &
    else
        nohup /bin/sh "$ASSETS_DIR/videoads-flag.sh" </dev/null >/dev/null 2>&1 &
    fi
    echo $! > "$VA_FLAG_PIDFILE"
}

apply_videoads() {
    # At boot SAM may still be starting
    for i in $(seq 1 $SAM_WAIT); do
        systemctl is-active -q sam.service && break
        if [[ $i -eq $SAM_WAIT ]]; then
            echo "[-] The app manager isn't running; try again in a moment" >&2
            exit 1
        fi
        sleep 1
    done

    # Also waits for the settings service, which may start after SAM at boot
    if ! flag=$(read_video_flag $SAM_WAIT); then
        echo "[-] Could not read LG's video screensaver setting (isVideoScreenSaverEnabled), so nothing was changed" >&2
        exit 1
    fi

    mounted=0
    if findmnt "$VA_DIR" >/dev/null; then
        # Mounted already. Keep it if the copy matches this Aerial (an update without a reboot
        # leaves the old copy, and Quick Start+ keeps mounts across standby); otherwise stage again.
        current=1
        for f in appinfo.json web-screensaver.html videos.json settings.json; do
            if [[ $f = appinfo.json ]]; then
                grep -q "\"$VA_ID\"" "$VA_DIR/$f" 2>/dev/null || current=0
            else
                cmp -s "$ASSETS_DIR/$f" "$VA_DIR/$f" || current=0
            fi
        done
        findmnt "$VA_DIR/settings.json" >/dev/null || current=0
        if [[ $current -eq 1 ]]; then
            # A working setup is kept even if this re-apply fails
            VA_KEEP=1
            mounted=1
        else
            echo "[~] Replacing an outdated screensaver copy" >&2
            umount "$VA_DIR/settings.json" 2>/dev/null || true
            umount "$VA_DIR"
        fi
    fi

    if [[ ! -f "$VA_STATE_DIR/state" ]]; then
        blocked=0
        grep -q "\"$VA_ID\"" "$BLOCKED_LIST_DIR"/*.json 2>/dev/null && blocked=1
        mkdir -p "$VA_STATE_DIR"
        printf 'FLAG=%s\nBLOCKED=%s\n' "$flag" "$blocked" > "$VA_STATE_DIR/state.tmp"
        mv "$VA_STATE_DIR/state.tmp" "$VA_STATE_DIR/state"
    fi
    mkdir -p "$(dirname "$VA_RESTORE_HOOK")"
    cp "$ASSETS_DIR/videoads-restore.sh" "$VA_RESTORE_HOOK.tmp"
    chmod +x "$VA_RESTORE_HOOK.tmp"
    mv "$VA_RESTORE_HOOK.tmp" "$VA_RESTORE_HOOK"

    if [[ $mounted -eq 0 ]]; then
        rm -rf "$VA_STAGE"
        mkdir -p "$VA_STAGE"
        cp -a "$ASSETS_DIR"/. "$VA_STAGE"/
        sed -i "s/\"$APP_ID\"/\"$VA_ID\"/" "$VA_STAGE/appinfo.json"
        if ! grep -q "\"$VA_ID\"" "$VA_STAGE/appinfo.json"; then
            echo "[-] Could not give the screensaver copy the id $VA_ID" >&2
            exit 1
        fi
        mount --bind "$VA_STAGE" "$VA_DIR"
        # The app's own settings.json, so its settings reach the screensaver without applying
        # again. A bind mount rather than a symlink, since web apps can only read files inside
        # their own app directory.
        mount --bind "$ASSETS_DIR/settings.json" "$VA_DIR/settings.json"
    fi

    # Reread even when mounted already, which also unblocks videoads again if something blocked it
    rc=0
    sam_reread "$VA_ID" '"main": *"([^"]*/)?web-screensaver\.html"' || rc=$?
    if [[ $rc -ne 0 ]]; then
        # videoads left blocked (rc 2) with the flag on would leave no screensaver at all, so put
        # LG's settings back even over a setup that was working
        [[ $rc -eq 2 ]] && VA_KEEP=0
        echo "[-] Could not make the app manager use the screensaver as $VA_ID ($rc)" >&2
        exit 1
    fi
    if ! video_flag true; then
        echo "[-] Could not switch on LG's video screensaver setting (isVideoScreenSaverEnabled)" >&2
        exit 1
    fi
    VA_KEEP=1
    start_flag_watcher
    if [[ $mounted -eq 1 ]]; then
        echo "[~] Enabled already (web screensaver as $VA_ID)" >&2
    else
        echo "[+] Enabled succesfully (web screensaver as $VA_ID)" >&2
    fi
    exit 0
}

# One apply at a time (a double press, or Apply during the boot hooks), so mounts don't stack.
# The restore hook takes the same lock at boot.
LOCK=/tmp/aerial-apply.lock
if ! mkdir "$LOCK" 2>/dev/null; then
    echo "[-] Already applying, try again in a moment" >&2
    exit 1
fi
trap 'va_restore_unless_kept || true; rmdir "$LOCK" 2>/dev/null || true' EXIT

if [[ "$(webos_major)" = "11" ]] && grep -q '"type" *: *"web"' "$VA_DIR/appinfo.json" 2>/dev/null; then
    apply_videoads
fi

# webOS 25 (10.x): the stock screensaver is a Flutter app and QML apps can't be launched, so
# replace the whole app directory with assets/, which holds a web app (appinfo.json +
# web-screensaver.html) next to the settings, videos and locales it reads
if grep -q '"type" *: *"flutter"' "$APP_DIR/appinfo.json" 2>/dev/null || findmnt "$APP_DIR" >/dev/null; then
    if ! findmnt "$APP_DIR" >/dev/null; then
        mount --bind "$ASSETS_DIR" "$APP_DIR"
        apply_web
    fi
    # Mounted already. Clear a block an earlier run may have left (SAM can report the web app
    # while it's blocked), then make SAM reread if it still has the Flutter manifest
    if systemctl is-active -q sam.service; then
        release_block "$APP_ID" 1 || true
        if ! sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"type": *"web"'; then
            apply_web
        fi
    fi
    echo "[~] Enabled already (web screensaver)" >&2
    exit 0
fi

echo "[-] Unsupported screensaver: neither $MOUNT_TARGET nor a Flutter app found" >&2
exit 1
