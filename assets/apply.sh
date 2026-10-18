#!/bin/sh

set -e -o pipefail

APP_DIR="/usr/palm/applications/com.webos.app.screensaver"
MOUNT_TARGET="$APP_DIR/qml/main.qml"
ASSETS_DIR="$(dirname "$(realpath "$0")")"
QML_PATH="$ASSETS_DIR/screensaver-main.qml"

if [[ -f "$MOUNT_TARGET" ]]; then
    if ! findmnt "$MOUNT_TARGET"; then
        mount --bind "$QML_PATH" "$MOUNT_TARGET"
        echo "[+] Enabled succesfully" >&2
    else
        echo "[~] Enabled already" >&2
    fi
    exit 0
fi

# webOS 25 (10.x): the stock screensaver is a Flutter app and QML apps can't be launched,
# so replace the whole app directory with assets/, which holds a web app (appinfo.json +
# web-screensaver.html) next to the settings, videos and locales it reads
if grep -q '"type" *: *"flutter"' "$APP_DIR/appinfo.json" 2>/dev/null || findmnt "$APP_DIR" >/dev/null; then
    if ! findmnt "$APP_DIR" >/dev/null; then
        mount --bind "$ASSETS_DIR" "$APP_DIR"
        # SAM caches appinfo and has no rescan method. Restart it in the background so
        # this script can return before SAM closes the running apps.
        if systemctl is-active -q sam.service; then
            (sleep 2; systemctl restart sam.service) >/dev/null 2>&1 &
        fi
        echo "[+] Enabled succesfully (web screensaver)" >&2
    else
        echo "[~] Enabled already (web screensaver)" >&2
    fi
    exit 0
fi

echo "[-] Unsupported screensaver: neither $MOUNT_TARGET nor a Flutter app found" >&2
exit 1
