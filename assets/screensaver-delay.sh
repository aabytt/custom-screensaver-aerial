#!/bin/sh
# Screensaver delay: how long the TV waits before it starts the screensaver. On some TVs (webOS 3.x) it is
# fixed in the model data (tv.systemproperty screenSaverTimeout, 60 min) and LG's menu has no setting.
# The timer that uses it is a policy of nopd (/etc/palm/nop-conf.json, "[TIMER]ScreenSaver"), so a copy of
# that file with a constant interval is bind-mounted over it and nopd is restarted. Only done where the
# stock file has that timer reading screenSaverTimeout; anything else is left alone. The copy is in RAM:
# after a reboot apply.sh (which calls this) mounts it again.
#   support          prints the TV's own delay in minutes (0 if unknown) when it can be changed here
#   apply [minutes]  sets it (no minutes: settings.json screensaverDelay; none or 0: the TV's own)
#   revert           puts LG's policy back
CONF=/etc/palm/nop-conf.json
COPY=/tmp/aerial-nop-conf.json
ASSETS_DIR="$(dirname "$(realpath "$0")")"
SETTINGS="$ASSETS_DIR/settings.json"
NOP="luna://com.webos.service.nop"

# BusyBox before 1.30 only takes "timeout -t SECS" (same as apply.sh)
if timeout 1 true >/dev/null 2>&1; then
    T="timeout"
elif timeout -t 1 true >/dev/null 2>&1; then
    T="timeout -t"
else
    T=
fi

# Our mount is the only one over that file
patched() { findmnt "$CONF" >/dev/null 2>&1; }
stock_ok() {
    grep -q '"\[TIMER\]ScreenSaver"' "$CONF" && grep -q '"property": *"screenSaverTimeout"' "$CONF"
}
supported() { patched || stock_ok; }
stock_minutes() {
    m="$(${T:+$T 8} luna-send -n 1 luna://com.webos.service.tv.systemproperty/getSystemInfo \
        '{"keys":["screenSaverTimeout"]}' </dev/null 2>/dev/null |
        sed -n 's/.*"screenSaverTimeout" *: *"\{0,1\}\([0-9][0-9]*\).*/\1/p')"
    echo "${m:-0}"
}
restart_nopd() {
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart nopd
    else
        initctl restart nopd
    fi >/dev/null 2>&1
}
# Whether nopd runs the screensaver timer with $1 seconds; nopd needs a moment after its restart
nopd_runs() {
    i=0
    while [ $i -lt 10 ]; do
        sleep 1
        # the subscription never ends by itself: timeout stops it (and the shell's "Terminated" goes too)
        ( ${T:+$T 3} luna-send -i "$NOP/getTimerInfo" '{"subscribe":true}' </dev/null |
            grep -q "\"\[TIMER\]ScreenSaver:$1\"" ) 2>/dev/null && return 0
        i=$((i + 1))
    done
    return 1
}
# Writes $CONF with the interval of the screensaver timer replaced by $1 minutes to $COPY. The interval
# object spans several lines (and holds the method object), so its braces are counted.
make_copy() {
    awk -v m="$1" '
    function rep(rest) { print ind "\"interval\": {\"type\": \"constant\", \"constant\": " m ", \"adjust\": 0, \"unit\": \"minute\"}" rest; n++ }
    skip {
        depth += gsub(/\{/, "{") - gsub(/\}/, "}")
        if (depth <= 0) { skip = 0; sub(/.*\}/, ""); rep($0) }
        next
    }
    /"name": *"\[TIMER\]ScreenSaver"/ { t = 1 }
    t && /"interval": *\{/ {
        t = 0; ind = $0; sub(/[^ ].*/, "", ind)
        line = $0; depth = gsub(/\{/, "{", line) - gsub(/\}/, "}", line)
        if (depth <= 0) { sub(/.*\}/, "", line); rep(line) } else { skip = 1 }
        next
    }
    { print }
    END { exit (n == 1 ? 0 : 1) }' "$CONF" > "$COPY"
}
unpatch() {
    patched || return 0
    umount "$CONF" 2>/dev/null || umount -l "$CONF"
    restart_nopd
    rm -f "$COPY"
}

case "$1" in
support)
    supported && stock_minutes
    ;;
revert)
    unpatch
    ;;
apply)
    m="$2"
    [ -n "$m" ] || m="$(sed -n 's/.*"screensaverDelay"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$SETTINGS" 2>/dev/null | head -n 1)"
    case "$m" in ''|0) unpatch; exit 0 ;; *[!0-9]*) echo "[-] Screensaver delay: not a number: $m" >&2; exit 1 ;; esac
    if [ "$m" -gt 240 ]; then echo "[-] Screensaver delay: at most 240 minutes" >&2; exit 1; fi
    supported || exit 0
    if patched && grep -q "\"constant\": $m, \"adjust\": 0, \"unit\": \"minute\"" "$CONF"; then
        exit 0
    fi
    was=
    if patched; then umount "$CONF" 2>/dev/null || umount -l "$CONF"; was=1; fi
    if ! stock_ok || ! make_copy "$m"; then
        rm -f "$COPY"
        [ -n "$was" ] && restart_nopd
        echo "[-] Screensaver delay: unexpected $CONF, left as it is" >&2
        exit 1
    fi
    # a file nopd can't read would also take its other timers (auto standby...), so check it where Node is
    . "$ASSETS_DIR/aerial-node.sh"
    if find_aerial_node && ! "$NODE" -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$COPY" 2>/dev/null; then
        rm -f "$COPY"
        [ -n "$was" ] && restart_nopd
        echo "[-] Screensaver delay: could not write a valid copy of $CONF" >&2
        exit 1
    fi
    mount --bind "$COPY" "$CONF"
    restart_nopd
    if ! nopd_runs $((m * 60)); then
        unpatch
        echo "[-] Screensaver delay: nopd didn't take the new timer, put LG's back" >&2
        exit 1
    fi
    echo "[+] Screensaver delay: $m min" >&2
    ;;
*)
    echo "usage: $0 support | apply [minutes] | revert" >&2
    exit 2
    ;;
esac
