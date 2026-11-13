#!/bin/sh
# font-server.sh start|stop: starts / stops font-server.js (see there). `start` prints the address
# to open on the phone (or "ERR <why>"), the app turns it into the QR code. Run from the app through
# the Homebrew Channel service; the server outlives this script (own session, output to a log).
DIR="$(dirname "$(realpath "$0")")"
INFO=/tmp/aerial-fontserver.json
PERSIST=/var/lib/webosbrew/custom-screensaver-aerial/fonts
APPFONTS="$DIR/fonts/custom"
TTF_ONLY=0
[ "$2" = "ttf-only" ] && TTF_ONLY=1

alive() {  # pid
    [ -n "$1" ] && kill -0 "$1" 2>/dev/null
}
pid_of() { sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$INFO" 2>/dev/null | head -n 1; }
url_of() { sed -n 's/.*"url":"\([^"]*\)".*/\1/p' "$INFO" 2>/dev/null | head -n 1; }

case "$1" in
stop)
    pid="$(pid_of)"
    alive "$pid" && kill "$pid" 2>/dev/null
    rm -f "$INFO"
    echo stopped
    ;;
start)
    pid="$(pid_of)"
    expected_mode=false
    [ "$TTF_ONLY" -eq 1 ] && expected_mode=true
    if alive "$pid"; then
        running_mode="$(sed -n 's/.*"ttfOnly":\([^,}]*\).*/\1/p' "$INFO" 2>/dev/null)"
        if [ "$running_mode" = "$expected_mode" ]; then url_of; exit 0; fi
        if [ ! -r "/proc/$pid/cmdline" ] || ! tr '\000' '\n' <"/proc/$pid/cmdline" | grep -q 'font-server.js'; then
            echo "ERR cannot verify the existing font server process"
            exit 0
        fi
        kill "$pid" 2>/dev/null
        i=0
        while alive "$pid" && [ "$i" -lt 10 ]; do
            i=$((i + 1)); sleep 0.2 2>/dev/null || sleep 1
        done
        alive "$pid" && { echo "ERR the existing font server could not be restarted"; exit 0; }
    fi
    rm -f "$INFO"
    NODE="$(command -v node 2>/dev/null)"
    [ -n "$NODE" ] || for n in /usr/bin/node /usr/local/bin/node /media/developer/bin/node /usr/palm/nodejs/node; do
        [ -x "$n" ] && NODE="$n" && break
    done
    [ -n "$NODE" ] || { echo "ERR node was not found on this TV"; exit 0; }
    mkdir -p "$PERSIST" "$APPFONTS" 2>/dev/null
    if command -v setsid >/dev/null 2>&1; then
        setsid "$NODE" "$DIR/font-server.js" --persist "$PERSIST" --app "$APPFONTS" --ttf-only "$TTF_ONLY" </dev/null >/tmp/aerial-fontserver.log 2>&1 &
    else
        nohup "$NODE" "$DIR/font-server.js" --persist "$PERSIST" --app "$APPFONTS" --ttf-only "$TTF_ONLY" </dev/null >/tmp/aerial-fontserver.log 2>&1 &
    fi
    i=0
    while [ $i -lt 25 ]; do
        [ -s "$INFO" ] && { url_of; exit 0; }
        i=$((i + 1)); sleep 0.2 2>/dev/null || sleep 1
    done
    echo "ERR the server did not start: $(tail -n 1 /tmp/aerial-fontserver.log 2>/dev/null)"
    ;;
*)
    echo "usage: $0 start|stop"
    ;;
esac
exit 0
