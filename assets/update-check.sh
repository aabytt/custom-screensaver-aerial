#!/bin/sh
# Called asynchronously by videoads-flag.sh. Stdout is only the next wake time.
DIR="$(dirname "$(realpath "$0")")"
LOCK="${AERIAL_UPDATE_LOCK:-/tmp/aerial-update-check.lock}"
now="$(date +%s)"

if ! mkdir "$LOCK" 2>/dev/null; then
    modified="$(stat -c %Y "$LOCK" 2>/dev/null || echo "$now")"
    [ $((now - modified)) -gt 120 ] && rmdir "$LOCK" 2>/dev/null
    mkdir "$LOCK" 2>/dev/null || exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' 0
trap 'exit 1' HUP INT TERM

. "$DIR/aerial-node.sh"
if ! find_aerial_node; then
    if ! logger -t aerial-update 'skipped: no existing Node runtime' 2>/dev/null; then
        printf '%s\n' 'skipped: no existing Node runtime' > /tmp/aerial-update.log
    fi
    echo $((now + 3600))
    exit 0
fi

if timeout 1 true >/dev/null 2>&1; then TIMEOUT='timeout 40'
elif timeout -t 1 true >/dev/null 2>&1; then TIMEOUT='timeout -t 40'
else TIMEOUT=; fi
client=
if command -v curl >/dev/null 2>&1; then client=curl
elif command -v wget >/dev/null 2>&1; then client=wget; fi
$TIMEOUT "$NODE" "$DIR/update-check.js" check "$client"
