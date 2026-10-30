#!/bin/sh

set -e -o pipefail

APP_ID="com.webos.app.screensaver"
APP_DIR="/usr/palm/applications/$APP_ID"
MOUNT_TARGET="$APP_DIR/qml/main.qml"
ASSETS_DIR="$(dirname "$(realpath "$0")")"
QML_PATH="$ASSETS_DIR/screensaver-main.qml"

# Settings are also kept outside of the app directory (see SettingsStore.js in the app), so they
# survive a reinstall or an update. Restore them into assets/ first: everything below, and the
# screensaver itself, reads $ASSETS_DIR/settings.json. cp overwrites the file in place (same inode)
# on purpose: that file is bind-mounted into the videoads copy, and mv / cp --remove-destination
# would leave the mount pointing at the old file.
PERSIST_SETTINGS="/var/lib/webosbrew/custom-screensaver-aerial/settings.json"
if [ -s "$PERSIST_SETTINGS" ] && grep -q '^{' "$PERSIST_SETTINGS" &&
   ! cmp -s "$PERSIST_SETTINGS" "$ASSETS_DIR/settings.json"; then
    cp "$PERSIST_SETTINGS" "$ASSETS_DIR/settings.json" ||
        echo "[-] Could not restore settings from $PERSIST_SETTINGS" >&2
fi
SAM="luna://com.webos.applicationManager"
BLOCK_SCHEMA="/etc/palm/schemas/sam/applicationManager.blockSystemApp.schema"

# LG's video screensaver, see mirror_videoads
VA_ID="com.webos.app.videoads"
VA_DIR="/usr/palm/applications/$VA_ID"
VA_STAGE="/tmp/aerial-videoads"
VA_MAIN='"main": *"([^"]*/)?web-screensaver\.html"'
BLOCKED_LIST_DIR="/var/preferences/com.webos.applicationManager/blockedSystemAppList"
# Left by Aerial 3.0.2 on webOS 26, see undo_videoads_setup
VA_STATE_DIR="/var/lib/webosbrew/aerial-videoads"
VA_RESTORE_HOOK="/var/lib/webosbrew/init.d/49-aerial-videoads-restore"
# The notification watcher, see start_watcher
NOTIFY_UNIT="aerial-notify"
NOTIFY_PIDFILE="/tmp/aerial-notify.pid"
NOTIFY_HEARTBEAT="/tmp/aerial-watcher.json"
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
    for i in $(seq 1 20); do
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

# Asks SAM to reread app $1 another way, without a block: a dev install of a file that isn't an
# ipk fails ("IPK Extraction Failure"), and SAM then rereads that one app and publishes it as
# "updated". A block publishes it as "removed", which WAM takes as an uninstall, and leaves it
# blocked if the release fails.
request_reload() {  # app
    echo "not an ipk" > /tmp/aerial-reread.ipk
    luna_call "luna://com.webos.appInstallService/dev/install" \
        "{\"id\":\"$1\",\"ipkUrl\":\"/tmp/aerial-reread.ipk\",\"subscribe\":false}" . || true
}

# Returns 0 once getAppInfo for $1 matches $2, asking twice
sam_reload() {  # app pattern
    for try in 1 2; do
        request_reload "$1"
        sam_reports "$1" "$2" && return 0
    done
    return 1
}

# Makes SAM pick up the mounted web app; on failure, says why and exits. SAM is never restarted:
# that closes every running app, and on webOS 26 was reported to leave SAM's app registration
# broken (#50).
apply_web() {
    if ! systemctl is-active -q sam.service; then
        # SAM isn't up yet: it reads the mounted manifest on its first scan
        return 0
    fi
    rc=0
    sam_reread "$APP_ID" '"type": *"web"' || rc=$?
    if [[ $rc -eq 2 ]]; then
        # Put the stock screensaver back so the next apply starts over (-l also takes the
        # watcher.json mount inside it along)
        umount -l "$APP_DIR" || true
        echo "[-] Could not release $APP_ID from LG's blocked system app list, so no screensaver can launch." >&2
        echo "    Apply again, or run: luna-send -n 1 $SAM/releaseBlockSystemApp '{\"id\":\"$APP_ID\"}'" >&2
        exit 1
    fi
    if [[ $rc -ne 0 ]] && ! sam_reload "$APP_ID" '"type": *"web"'; then
        # Keep the stock screensaver, and have SAM reread it too in case it took the web app late
        umount -l "$APP_DIR" || true
        request_reload "$APP_ID"
        echo "[-] The app manager didn't pick up the web screensaver, so the stock one is kept. Apply again after a reboot." >&2
        exit 1
    fi
}

# Aerial 3.0.2 ran the screensaver on webOS 26 as videoads, with LG's isVideoScreenSaverEnabled
# setting switched on, a watcher (aerial-videoads-flag) keeping it on, and a boot hook to put it
# back. Manual screensaver mode (see web-screensaver.html) makes all of that unnecessary, so that
# hook is run now: it stops the watcher, puts the setting and the videoads block back, switches
# notifications on, and removes itself. If it can't, it stays, and the next apply tries again.
undo_videoads_setup() {
    [[ -f "$VA_RESTORE_HOOK" ]] || return 0
    # At boot SAM and the settings service may still be starting
    for i in $(seq 1 $SAM_WAIT); do
        systemctl is-active -q sam.service && break
        sleep 1
    done
    # The hook unmounts a videoads copy itself, but fails on one with mounts inside it (this
    # version's watcher.json), so unmount it first; mirror_videoads mounts it again
    if findmnt "$VA_DIR" >/dev/null; then
        umount -l "$VA_DIR" || true
    fi
    if sh "$VA_RESTORE_HOOK" now >&2; then
        echo "[~] Put back the LG settings that Aerial 3.0.2 changed on webOS 26" >&2
    else
        echo "[-] Could not put back all of the LG settings that Aerial 3.0.2 changed; applying again retries" >&2
    fi
}

# videoads-flag.sh runs while the web screensaver is applied and switches notifications back on
# once the screensaver isn't running (#46). Run as a transient systemd unit where systemd-run
# exists, restarted if it fails; otherwise in the background with a pidfile. The fallback runs it
# in its own process group (setsid), so stopping it also stops a check or sleep it's in the middle
# of.
stop_watcher() {
    systemctl stop "$NOTIFY_UNIT" >/dev/null 2>&1 || true
    systemctl reset-failed "$NOTIFY_UNIT" >/dev/null 2>&1 || true
    if [[ -f "$NOTIFY_PIDFILE" ]]; then
        pid="$(cat "$NOTIFY_PIDFILE")"
        kill -s TERM "-$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
        rm -f "$NOTIFY_PIDFILE"
    fi
}
start_watcher() {
    stop_watcher
    if command -v systemd-run >/dev/null 2>&1 &&
       systemd-run --no-block --unit="$NOTIFY_UNIT" -p Restart=on-failure /bin/sh "$ASSETS_DIR/videoads-flag.sh" >/dev/null 2>&1; then
        return 0
    fi
    if command -v setsid >/dev/null 2>&1; then
        setsid /bin/sh "$ASSETS_DIR/videoads-flag.sh" </dev/null >/dev/null 2>&1 &
    else
        nohup /bin/sh "$ASSETS_DIR/videoads-flag.sh" </dev/null >/dev/null 2>&1 &
    fi
    echo $! > "$NOTIFY_PIDFILE"
}

# The watcher writes the time into watcher.json for the page at every check. The page reads it from
# its own app directory, assets/ on flash or the videoads copy, so the file it reads is a RAM file
# in /tmp bind-mounted over the watcher.json placeholder there. If that fails the page sees the
# placeholder's old time and leaves notifications alone.
mount_heartbeat() {  # app directory
    [[ -f "$NOTIFY_HEARTBEAT" ]] || echo '{"time":0}' > "$NOTIFY_HEARTBEAT" || true
    if [[ -f "$1/watcher.json" ]] && ! findmnt "$1/watcher.json" >/dev/null; then
        mount --bind "$NOTIFY_HEARTBEAT" "$1/watcher.json" || true
    fi
}

# This Aerial's appinfo.json with the id $VA_ID
va_appinfo() {
    sed "s/\"$APP_ID\"/\"$VA_ID\"/" "$ASSETS_DIR/appinfo.json"
}

# Whether every file of this assets/ is in the videoads copy unchanged, except tn/ (left out),
# appinfo.json (another id) and the mounted settings.json and watcher.json
va_files_current() {
    (cd "$ASSETS_DIR" && find . -path ./tn -prune -o -path ./appinfo.json -prune \
        -o -path ./settings.json -prune -o -path ./watcher.json -prune -o -type f -print) |
        while IFS= read -r f; do
            cmp -s "$ASSETS_DIR/$f" "$VA_DIR/$f" || exit 1
        done
}

# Whether the copy of assets/ mounted as videoads matches this Aerial (an update without a reboot
# leaves the old copy, and Quick Start+ keeps mounts across standby). The settings.json and
# watcher.json mounts must be this assets/ one's file and the watcher's, not files an update
# replaced. An outdated copy is unmounted.
va_mounted_current() {
    findmnt "$VA_DIR" >/dev/null || return 1
    if va_files_current && va_appinfo | cmp -s - "$VA_DIR/appinfo.json" &&
       [[ "$ASSETS_DIR/settings.json" -ef "$VA_DIR/settings.json" ]] &&
       [[ "$NOTIFY_HEARTBEAT" -ef "$VA_DIR/watcher.json" ]]; then
        return 0
    fi
    echo "[~] Replacing an outdated screensaver copy" >&2
    # -l also takes the settings.json and watcher.json mounts inside it along
    umount -l "$VA_DIR"
    return 1
}

# Mounts a copy of assets/ with the app id $VA_ID over videoads (videoads is a web app with the
# screenSaver window type too). The copy is in RAM, so it leaves out the playlist thumbnails (tn/),
# which only the settings app shows. A copy rather than a bind mount of assets/ with only
# appinfo.json replaced: mounts on the TV propagate between bind mounts of the same directory, so
# the replaced appinfo.json could also show up in com.webos.app.screensaver.
va_mount_copy() {
    rm -rf "$VA_STAGE"
    mkdir -p "$VA_STAGE"
    for f in "$ASSETS_DIR"/*; do
        [[ "${f##*/}" = tn ]] || cp -a "$f" "$VA_STAGE"/
    done
    va_appinfo > "$VA_STAGE/appinfo.json"
    if ! grep -q "\"$VA_ID\"" "$VA_STAGE/appinfo.json"; then
        echo "[-] Could not give the screensaver copy the id $VA_ID" >&2
        return 1
    fi
    mount --bind "$VA_STAGE" "$VA_DIR"
    # The app's own settings.json, so its settings reach the screensaver without applying
    # again. A bind mount rather than a symlink, since web apps can only read files inside
    # their own app directory.
    mount --bind "$ASSETS_DIR/settings.json" "$VA_DIR/settings.json"
    mount_heartbeat "$VA_DIR"
}

# tvpowerd launches LG's video screensaver, com.webos.app.videoads, instead of
# com.webos.app.screensaver whenever LG's own conditions switch the lgchannels setting
# isVideoScreenSaverEnabled on (#53). So where videoads exists, the web screensaver is mounted
# over it as well, and runs whichever one tvpowerd picks. The setting is left alone, and SAM
# rereads videoads through the failed dev install, so LG's block list isn't touched either: a
# videoads that a debloat tool blocked stays blocked and is skipped. Not fatal:
# com.webos.app.screensaver works without it.
mirror_videoads() {
    grep -q '"type" *: *"web"' "$VA_DIR/appinfo.json" 2>/dev/null || return 0
    grep -q "\"$VA_ID\"" "$BLOCKED_LIST_DIR"/*.json 2>/dev/null && return 0
    if ! va_mounted_current; then
        va_mount_copy || return 0
    fi
    systemctl is-active -q sam.service || return 0
    sam_call getAppInfo "{\"id\":\"$VA_ID\"}" "$VA_MAIN" && return 0
    if ! sam_reload "$VA_ID" "$VA_MAIN"; then
        umount -l "$VA_DIR" || true
        request_reload "$VA_ID"
        echo "[~] Could not also replace LG's video screensaver ($VA_ID)" >&2
    fi
}

# One apply at a time (a double press, or Apply during the boot hooks), so mounts don't stack.
# Aerial 3.0.2's restore hook takes the same lock at boot.
LOCK=/tmp/aerial-apply.lock
if ! mkdir "$LOCK" 2>/dev/null; then
    echo "[-] Already applying, try again in a moment" >&2
    exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

undo_videoads_setup

# webOS 25 and 26 (10.x/11.x): the stock screensaver is a Flutter app and QML apps can't be
# launched, so replace the whole app directory with assets/, which holds a web app (appinfo.json +
# web-screensaver.html) next to the settings, videos and locales it reads. The watcher switches
# notifications back on after the screensaver (#46), and ends by itself if this is unmounted.
if grep -q '"type" *: *"flutter"' "$APP_DIR/appinfo.json" 2>/dev/null || findmnt "$APP_DIR" >/dev/null; then
    if findmnt "$APP_DIR" >/dev/null && ! [[ "$ASSETS_DIR" -ef "$APP_DIR" ]]; then
        # Mounted, but not this assets/: installing an update can replace the app folder, and the
        # mount would keep serving the old one until a reboot. -l also takes mounts inside it along.
        echo "[~] Replacing the screensaver mounted from an earlier install" >&2
        umount -l "$APP_DIR"
    fi
    if ! findmnt "$APP_DIR" >/dev/null; then
        mount --bind "$ASSETS_DIR" "$APP_DIR"
        mount_heartbeat "$APP_DIR"
        start_watcher
        apply_web
        msg="[+] Enabled succesfully (web screensaver)"
    else
        mount_heartbeat "$APP_DIR"
        start_watcher
        # Mounted already. Clear a block an earlier run may have left (SAM can report the web app
        # while it's blocked), then make SAM reread if it still has the Flutter manifest
        if systemctl is-active -q sam.service; then
            release_block "$APP_ID" 1 || true
            if ! sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"type": *"web"'; then
                apply_web
            fi
        fi
        msg="[~] Enabled already (web screensaver)"
    fi
    mirror_videoads
    echo "$msg" >&2
    exit 0
fi

echo "[-] Unsupported screensaver: neither $MOUNT_TARGET nor a Flutter app found" >&2
exit 1
