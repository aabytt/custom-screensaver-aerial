#!/bin/sh
# webOS 3.x: plays Aerial's video for the stock screensaver. The video has to be in a card app: a
# screenSaver window leaves the app below mapped, which hides the video (see screensaver-overlay.html).
# apply.sh mounts the player page (web-screensaver.html) over the unused LG app $PLAYER.
#
# tvpowerd launches the (transparent) screensaver as usual and, once it has reached "Screen Saver", this
# launches the player under it. Launching a card hides the screensaver window and tvpowerd drops back to
# "Active", so the screensaver is launched once more, on top. Doing this before tvpowerd has launched the
# screensaver doesn't work: an app change during its request cancels the request.
# When the screensaver window is gone (a key), the player is closed and the app that was in front is
# brought back (closing a card alone leaves the TV on its last input).
PLAYER="com.webos.app.store-demo"
SAVER="com.webos.app.screensaver"
TVPOWER="luna://com.webos.service.tvpower/power"
SAM="luna://com.webos.applicationManager"
FLAG=/tmp/aerial-player.on

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
    [ -n "$prev" ] && launch "$prev"
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
    while [ -f "$FLAG" ]; do
        saver_running || { stop_player; break; }
        sleep 1
    done
}

rm -f "$FLAG"
luna-send -i "$TVPOWER/getPowerState" '{"subscribe":true}' </dev/null 2>/dev/null | while read -r line; do
    case "$line" in
    *'"state": "Screen Saver"'*) [ -f "$FLAG" ] || start_player ;;
    *'"state": "Active"'*) ;;
    # standby, screen off...: not a screensaver any more
    *) [ -f "$FLAG" ] && stop_player ;;
    esac
done
