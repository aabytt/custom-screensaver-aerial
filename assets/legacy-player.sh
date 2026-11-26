#!/bin/sh
# webOS 3.x: plays Aerial's video for the stock screensaver. The video has to be in a card app: a
# screenSaver window leaves the app below mapped, which hides the video (see screensaver-overlay.html).
# apply.sh mounts the player page (web-screensaver.html) as the dev app $PLAYER.
#
# tvpowerd launches the (transparent) screensaver as usual and, once it has reached "Screen Saver", this
# launches the player under it. Launching a card hides the screensaver window and tvpowerd drops back to
# "Active", so the screensaver is launched once more, on top. Doing this before tvpowerd has launched the
# screensaver doesn't work: an app change during its request cancels the request.
# When the screensaver window is gone (a key), the player is closed and the app that was in front is
# brought back (closing a card alone leaves the TV on its last input).
PLAYER="org.aabytt.webos.custom-screensaver-aerial.player"
SAVER="com.webos.app.screensaver"
TVPOWER="luna://com.webos.service.tvpower/power"
SAM="luna://com.webos.applicationManager"
FLAG=/tmp/aerial-player.on
LOG=/tmp/aerial-player.log
INPUT_HIT=/tmp/aerial-input.hit
INPUT_PIDS=/tmp/aerial-input.pids
# webOS 9.x fallback (apply.sh passes "direct" there): on a G3 (9.2.2) tvpowerd answers a screensaver
# request with "Request Screen Saver" and then goes straight back to "Screen On", started nothing,
# because a registered client refuses it. When that happens the screensaver is launched directly,
# and, as tvpowerd doesn't know about it, closed again on any input event.
# "direct-now" starts one immediately, for testing: sh legacy-player.sh direct-now
DIRECT_FALLBACK=
[ "$1" = direct ] && DIRECT_FALLBACK=1
DIRECT=
COOLDOWN_UNTIL=0

[ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 200000 ] && : > "$LOG"
log() {
    echo "$(date +%T) $*" >> "$LOG" 2>/dev/null
}

fg_app() {
    luna-send -n 1 "$SAM/getForegroundAppInfo" '{}' </dev/null 2>/dev/null | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p'
}
launch() {
    luna-send -n 1 "$SAM/launch" "{\"id\":\"$1\"}" </dev/null >/dev/null 2>&1
}
saver_running() {
    luna-send -n 1 "$SAM/running" '{}' </dev/null 2>/dev/null | grep -q "\"id\": *\"$SAVER\""
}
stop_player() {
    prev="$(cat "$FLAG" 2>/dev/null)"
    rm -f "$FLAG"
    luna-send -n 1 "$SAM/closeByAppId" "{\"id\":\"$PLAYER\"}" </dev/null >/dev/null 2>&1
    # a screensaver launched directly isn't closed by tvpowerd
    [ -n "$DIRECT" ] && luna-send -n 1 "$SAM/closeByAppId" "{\"id\":\"$SAVER\"}" </dev/null >/dev/null 2>&1
    [ -n "$prev" ] && launch "$prev"
    log "player stopped, back to ${prev:-nothing}"
}
start_player() {
    prev="$(fg_app)"
    [ "$prev" = "$PLAYER" ] && prev=
    echo "$prev" > "$FLAG"
    launch "$PLAYER"
    i=0
    while [ $i -lt 30 ] && [ "$(fg_app)" != "$PLAYER" ]; do i=$((i + 1)); usleep 100000; done
    launch "$SAVER"
    # the screensaver is back in the running list a moment after it was launched
    sleep 2
    [ -n "$DIRECT" ] && input_watch_start
    while [ -f "$FLAG" ]; do
        saver_running || { stop_player; break; }
        if [ -n "$DIRECT" ] && input_hit; then
            log "input event, closing the screensaver"
            stop_player
            break
        fi
        sleep 1
    done
    input_watch_stop
    # lines that piled up while this ran must not start it again right away
    COOLDOWN_UNTIL=$(( $(date +%s) + 5 ))
}
power_state() {
    luna-send -n 1 "$TVPOWER/getPowerState" '{}' </dev/null 2>/dev/null | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p' | head -n 1
}
# Called on "Request Screen Saver". Polls for ~3 s: 0 if the TV settles back to plain screen-on
# (the request was refused), 1 if it moves on to the screensaver.
refused_after_request() {
    plain=0
    i=0
    while [ $i -lt 6 ]; do
        i=$((i + 1))
        usleep 500000
        st="$(power_state)"
        log "after request: $st"
        case "$st" in
        "Screen Saver"|"Screen Saver Ready") return 1 ;;
        "Screen On"|"Active") plain=$((plain + 1)); [ $plain -ge 2 ] && return 0 ;;
        *) plain=0 ;;
        esac
    done
    return 1
}
# Best effort: something playing full screen (the reply format isn't known here, so an unexpected
# one counts as "nothing playing")
media_playing() {
    luna-send -n 1 "luna://com.webos.media/getActivePipelines" '{}' </dev/null 2>/dev/null | grep -q '"state": *"playing"'
}
# One watcher per input device: dd returns once the device delivers an event. The device is read in
# 64 byte blocks, as evdev refuses a read smaller than one event.
input_watch_start() {
    input_watch_stop
    n=0
    for d in /dev/input/event*; do
        [ -c "$d" ] || continue
        n=$((n + 1))
        : > "$INPUT_HIT.$n"
        dd if="$d" of="$INPUT_HIT.$n" bs=64 count=1 2>/dev/null &
        echo $! >> "$INPUT_PIDS"
    done
    log "watching $n input devices"
}
input_hit() {
    for f in "$INPUT_HIT".*; do
        [ -s "$f" ] && return 0
    done
    return 1
}
input_watch_stop() {
    if [ -f "$INPUT_PIDS" ]; then
        while read -r p; do kill "$p" 2>/dev/null; done < "$INPUT_PIDS"
    fi
    rm -f "$INPUT_PIDS" "$INPUT_HIT".* 2>/dev/null
}
direct_start() {
    [ -f "$FLAG" ] && return 0
    fg="$(fg_app)"
    case "$fg" in
    com.webos.app.hdmi*|com.webos.app.livetv*|com.webos.app.externalinput*)
        log "direct: not starting over $fg"
        return 0 ;;
    esac
    if media_playing; then
        log "direct: not starting, media is playing"
        return 0
    fi
    log "direct: starting over ${fg:-nothing}"
    DIRECT=1
    start_player
    DIRECT=
}

if [ "$1" = direct-now ]; then
    log "direct-now"
    direct_start
    exit 0
fi
rm -f "$FLAG"
log "started${DIRECT_FALLBACK:+, direct fallback on}"
luna-send -i "$TVPOWER/getPowerState" '{"subscribe":true}' </dev/null 2>/dev/null | while read -r line; do
    case "$line" in *'"state"'*) log "power: $line" ;; esac
    case "$line" in
    *'"state": "Screen Saver"'*) [ -f "$FLAG" ] || start_player ;;
    *'"state": "Request Screen Saver"'*)
        if [ -n "$DIRECT_FALLBACK" ] && [ ! -f "$FLAG" ] && [ "$(date +%s)" -ge "$COOLDOWN_UNTIL" ]; then
            if refused_after_request; then
                log "screensaver request refused"
                direct_start
            fi
        fi ;;
    *'"state": "Active"'*) ;;
    # standby, screen off...: not a screensaver any more
    *) [ -f "$FLAG" ] && stop_player ;;
    esac
done
