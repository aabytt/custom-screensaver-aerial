#!/bin/sh
# One-shot: puts the screen brightness back if a screensaver left it lowered (see backlight-lib.sh),
# e.g. after a reboot in the middle of a screensaver. Run at boot by the init.d hook that apply.sh
# installs (also with Aerial's autostart off), and handy by hand. Gives up after 3 minutes (the
# settings service may still be starting at boot); the state stays then, and the watcher keeps trying.
DIR="$(dirname "$(realpath "$0")")"
. "$DIR/backlight-lib.sh"
frozen=0
load_state || exit 0
i=0
while [ $i -lt 90 ]; do
    restore_backlight && exit 0
    i=$((i + 1))
    sleep 2
done
exit 0
