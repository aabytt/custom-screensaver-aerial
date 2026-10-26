#!/bin/sh

set -e -o pipefail

APP_ID="com.webos.app.screensaver"
APP_DIR="/usr/palm/applications/$APP_ID"
MOUNT_TARGET="$APP_DIR/qml/main.qml"
ASSETS_DIR="$(dirname "$(realpath "$0")")"
QML_PATH="$ASSETS_DIR/screensaver-main.qml"
SAM="luna://com.webos.applicationManager"
BLOCK_SCHEMA="/etc/palm/schemas/sam/applicationManager.blockSystemApp.schema"

if [[ -f "$MOUNT_TARGET" ]]; then
    if ! findmnt "$MOUNT_TARGET"; then
        mount --bind "$QML_PATH" "$MOUNT_TARGET"
        echo "[+] Enabled succesfully" >&2
    else
        echo "[~] Enabled already" >&2
    fi
    exit 0
fi

# Calls a SAM method and checks its reply against an extended regex (case-insensitive). The
# reply is captured first so luna-send's own exit status doesn't matter under pipefail, and the
# call gives up after 8 s so a busy SAM can't hang the app or the boot hooks. luna-send gets
# /dev/null as stdin: run from a script it was reported to return nothing otherwise (#55).
# BusyBox before 1.30 only takes "timeout -t SECS"
if timeout 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout 8"
elif timeout -t 1 true >/dev/null 2>&1; then
    TIMEOUT="timeout -t 8"
else
    TIMEOUT=
fi
sam_call() {  # method payload pattern
    reply="$($TIMEOUT luna-send -n 1 "$SAM/$1" "$2" </dev/null 2>/dev/null || true)"
    echo "$reply" | grep -qiE "$3"
}

# Whether SAM reports the screensaver as the web app, polling for up to 20 s: at boot SAM can
# still be on its own first scan and takes the reread after it
sam_reports_web() {
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
        if sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"type": *"web"'; then
            return 0
        fi
        [[ $i -lt 20 ]] && sleep 1
    done
    return 1
}

# Takes the screensaver out of LG's blocked system app list (kept across reboots in
# /var/preferences/com.webos.applicationManager/blockedSystemAppList). SAM refuses the release
# when nothing is blocked, which counts as released. Tries $1 times (default 3).
release_block() {
    tries=${1:-3}
    i=1
    while :; do
        if sam_call releaseBlockSystemApp "{\"id\":\"$APP_ID\"}" '"returnValue": *true|"errorText": *"[^"]*not +blocked'; then
            return 0
        fi
        [[ $i -ge $tries ]] && return 1
        i=$((i + 1))
        sleep 1
    done
}

# SAM caches appinfo.json. Blocking the screensaver and releasing it at once makes SAM reread
# its manifest (and so see the mounted web app) without restarting SAM, which closes every
# running app and on webOS 26 was reported to leave SAM's app registration broken (#50). Same
# approach as Glasshouse (rorygallagher2024/glasshouse, server/lib/samrescan.js) and Luma
# (ecklf/lg-luma, tv/home.cjs). webOS 26 (11.x) refuses the block unless it has
# forceBlockSystemApp, which its schema requires; older firmware gets it only where the schema
# names it. A block left by an interrupted run answers "already blocked" and is released here.
# Returns 0 once SAM reports the web app, 2 if the block took but couldn't be released, and 1
# otherwise (no block/release, or SAM didn't reread in time).
sam_reread() {
    force=
    if grep -q '"forceBlockSystemApp"' "$BLOCK_SCHEMA" 2>/dev/null; then
        force=',"forceBlockSystemApp":false'
    fi
    if ! sam_call blockSystemApp "{\"id\":\"$APP_ID\"$force}" '"returnValue": *true|"errorText": *"[^"]*already +blocked'; then
        # A block that timed out may still have taken effect, so release once, quietly
        release_block 1 || true
        return 1
    fi
    if ! release_block 3; then
        return 2
    fi
    sam_reports_web
}

# Makes SAM pick up the mounted web app; on failure, says why and exits.
apply_web() {
    if ! systemctl is-active -q sam.service; then
        # SAM isn't up yet: it reads the mounted manifest on its first scan
        echo "[+] Enabled succesfully (web screensaver)" >&2
        exit 0
    fi
    rc=0
    sam_reread || rc=$?
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

# webOS 25 (10.x) and 26 (11.x): the stock screensaver is a Flutter app and QML apps can't be
# launched, so replace the whole app directory with assets/, which holds a web app (appinfo.json +
# web-screensaver.html) next to the settings, videos and locales it reads
if grep -q '"type" *: *"flutter"' "$APP_DIR/appinfo.json" 2>/dev/null || findmnt "$APP_DIR" >/dev/null; then
    # One apply at a time (a double press, or Apply during the boot hook), so mounts don't stack
    LOCK=/tmp/aerial-apply.lock
    if ! mkdir "$LOCK" 2>/dev/null; then
        echo "[-] Already applying, try again in a moment" >&2
        exit 1
    fi
    trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
    if ! findmnt "$APP_DIR" >/dev/null; then
        mount --bind "$ASSETS_DIR" "$APP_DIR"
        apply_web
    fi
    # Mounted already. Clear a block an earlier run may have left (SAM can report the web app
    # while it's blocked), then make SAM reread if it still has the Flutter manifest
    if systemctl is-active -q sam.service; then
        release_block 1 || true
        if ! sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"type": *"web"'; then
            apply_web
        fi
    fi
    echo "[~] Enabled already (web screensaver)" >&2
    exit 0
fi

echo "[-] Unsupported screensaver: neither $MOUNT_TARGET nor a Flutter app found" >&2
exit 1
