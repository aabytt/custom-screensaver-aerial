#!/bin/sh
set -e -o pipefail
APP_ID="com.webos.app.screensaver"
APP_DIR="/usr/palm/applications/$APP_ID"
MOUNT_TARGET="$APP_DIR/qml/main.qml"
ASSETS_DIR="$(dirname "$(realpath "$0")")"
QML_PATH="$ASSETS_DIR/screensaver-main.qml"
# No argument = apply, "status" only reports, "revert" puts LG's screensaver back.
MODE="${1:-apply}"
# status is read-only and runs before anything is restored, created or mounted. It answers with the
# same conditions the apply below uses for "Enabled already", so the settings app and the script
# can't disagree: applied = one of the mounts is there, stock = neither. A failed apply unmounts
# itself, so a mount always means the screensaver is in place.
if [ "$MODE" = status ]; then
if findmnt "$MOUNT_TARGET" >/dev/null 2>&1 || findmnt "$APP_DIR" >/dev/null 2>&1; then
echo applied
else
echo stock
fi
exit 0
fi
# Settings are also kept outside of the app directory (see SettingsStore.js in the app), so they
# survive a reinstall or an update. Restore them into assets/ first: everything below, and the
# screensaver itself, reads $ASSETS_DIR/settings.json. cp overwrites the file in place (same inode)
# on purpose: that file is bind-mounted into the videoads copy, and mv / cp --remove-destination
# would leave the mount pointing at the old file.
PERSIST_SETTINGS="/var/lib/webosbrew/custom-screensaver-aerial/settings.json"
if [ -s "$PERSIST_SETTINGS" ] && grep -q '^{' "$PERSIST_SETTINGS" &&
! cmp -s "$PERSIST_SETTINGS" "$ASSETS_DIR/settings.json"; then
. "$ASSETS_DIR/aerial-node.sh"
if find_aerial_node; then
"$NODE" "$ASSETS_DIR/update-check.js" restore "$ASSETS_DIR/settings.json" "$PERSIST_SETTINGS" ||
echo "[-] Could not restore settings from $PERSIST_SETTINGS" >&2
else
cp "$PERSIST_SETTINGS" "$ASSETS_DIR/settings.json" ||
echo "[-] Could not restore settings from $PERSIST_SETTINGS" >&2
fi
fi
# Custom OSD fonts (added from the app, see font-server.js) are kept next to the settings and copied
# into assets/fonts/custom, the only place the screensaver page can read them from. Files that were
# deleted from the persistent folder are removed from the copy too.
PERSIST_FONTS="/var/lib/webosbrew/custom-screensaver-aerial/fonts"
CUSTOM_FONTS="$ASSETS_DIR/fonts/custom"
mkdir -p "$CUSTOM_FONTS" 2>/dev/null || true
if [ -d "$PERSIST_FONTS" ]; then
for f in "$PERSIST_FONTS"/*; do
[ -f "$f" ] || continue
cmp -s "$f" "$CUSTOM_FONTS/${f##*/}" || cp -f "$f" "$CUSTOM_FONTS/" 2>/dev/null || true
done
for f in "$CUSTOM_FONTS"/*; do
[ -f "$f" ] || continue
[ -f "$PERSIST_FONTS/${f##*/}" ] || rm -f "$f"
done
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
# webOS 3.x, see apply_legacy
LEGACY_ID="org.aabytt.webos.custom-screensaver-aerial.player"
LEGACY_DIR="/media/developer/apps/usr/palm/applications/$LEGACY_ID"
LEGACY_STAGE="/tmp/aerial-overlay"
PLAYER_STAGE="/tmp/aerial-player"
PLAYER_PIDFILE="/tmp/aerial-player.pid"
# One apply (or revert) at a time (a double press, or Apply during the boot hooks), so mounts don't
# stack. Aerial 3.0.2's restore hook takes the same lock at boot.
LOCK=/tmp/aerial-apply.lock
SAM_WAIT=60   # seconds to wait for SAM at boot
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
# Whether SAM is up: it answers (works with any init system)
sam_up() {
sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"returnValue": *true'
}
# Restarting SAM while the screensaver runs kills it without tvpowerd noticing, which then stays in
# "Screen Saver Ready" and refuses every launch until a reboot
sam_restart_ok() {
if sam_call running '{}' '"id": *"com\.webos\.app\.screensaver"'; then
echo "[-] The screensaver is running: close it and apply again" >&2
return 1
fi
}
# Firmware without block / release (webOS 3.x) doesn't reread either way: callers skip the waiting
# for it. Blocking an app that doesn't exist is harmless where the method exists.
sam_no_reread() {
sam_call blockSystemApp '{"id":"aerial.probe"}' 'unknown method'
}
# Last resort when SAM can't be made to reread (webOS 3.x has no block / dev install reread). This
# closes the running apps, including the settings app.
sam_restart() {
if command -v systemctl >/dev/null 2>&1; then
systemctl restart sam.service
else
initctl restart sam
fi >/dev/null 2>&1 || true
for i in $(seq 1 30); do
sam_up && return 0
sleep 1
done
return 1
}
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
# broken (#50). (Where SAM can't be made to reread at all, i.e. webOS 4, the last resort below
# is a restart, only when the screensaver isn't running.)
apply_web() {
if ! sam_up; then
# SAM isn't up yet: it reads the mounted manifest on its first scan
return 0
fi
rc=0
if sam_no_reread; then
rc=3
else
sam_reread "$APP_ID" '"type": *"web"' || rc=$?
fi
if [[ $rc -eq 2 ]]; then
# Put the stock screensaver back so the next apply starts over (-l also takes the
# watcher.json mount inside it along)
umount -l "$APP_DIR" || true
echo "[-] Could not release $APP_ID from LG's blocked system app list, so no screensaver can launch." >&2
echo "    Apply again, or run: luna-send -n 1 $SAM/releaseBlockSystemApp '{\"id\":\"$APP_ID\"}'" >&2
exit 1
fi
if [[ $rc -ne 0 ]] && { [[ $rc -eq 3 ]] || ! sam_reload "$APP_ID" '"type": *"web"'; } &&
! { sam_restart_ok && sam_restart && sam_reports "$APP_ID" '"type": *"web"'; }; then
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
sam_up && break
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
for pf in "$NOTIFY_PIDFILE" "$PLAYER_PIDFILE"; do
if [[ -f "$pf" ]]; then
pid="$(cat "$pf")"
kill -s TERM "-$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
rm -f "$pf"
fi
done
rm -f /tmp/aerial-player.on
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
# webOS 3.x: the stock screensaver is a native app (native_builtin) and a web page has to be a
# screenSaver window for tvpowerd to follow, but then the compositor leaves the app below mapped and
# the video is hidden behind it. So the stock screensaver becomes a transparent overlay page
# (screensaver-overlay.html, mounted from a small stage) and the video plays in a card app: the player
# page, mounted over a new dev app $LEGACY_ID (a directory under the dev apps that SAM lists after its
# restart).
# legacy-player.sh starts and stops the player once tvpowerd has started the screensaver. SAM can't be
# made to reread a manifest here (no block / release), so a SAM restart picks up both.
start_legacy_watcher() {
# webOS 9: tvpowerd may refuse the screensaver request, see legacy-player.sh
LP_ARG=
if [[ "$WEBOS_MAJOR" = 9 ]]; then
LP_ARG=direct
fi
if command -v setsid >/dev/null 2>&1; then
setsid /bin/sh "$ASSETS_DIR/legacy-player.sh" $LP_ARG </dev/null >/dev/null 2>&1 &
else
nohup /bin/sh "$ASSETS_DIR/legacy-player.sh" $LP_ARG </dev/null >/dev/null 2>&1 &
fi
echo $! > "$PLAYER_PIDFILE"
}
legacy_sam_ok() {
sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"main": *"screensaver-overlay\.html"' &&
sam_call getAppInfo "{\"id\":\"$VA_ID\"}" "$VA_MAIN"
}
apply_legacy() {
VA_ID="$LEGACY_ID"
VA_DIR="$LEGACY_DIR"
VA_STAGE="$PLAYER_STAGE"
# webOS 3.x: the player is a card, not a screenSaver window. webOS 4.x keeps it a screenSaver window.
VA_FIX=
if [[ -z "$WEB_ONLY" ]]; then
VA_FIX='s/"defaultWindowType": *"screenSaver"/"defaultWindowType": "card"/'
fi
if findmnt "$APP_DIR" >/dev/null && ! cmp -s "$ASSETS_DIR/screensaver-overlay.html" "$APP_DIR/screensaver-overlay.html"; then
echo "[~] Replacing the screensaver mounted from an earlier install" >&2
umount -l "$APP_DIR"
fi
if ! findmnt "$APP_DIR" >/dev/null; then
rm -rf "$LEGACY_STAGE"
mkdir -p "$LEGACY_STAGE"
cp "$ASSETS_DIR/screensaver-overlay.html" "$LEGACY_STAGE"/
sed 's/"main": *"web-screensaver\.html"/"main": "screensaver-overlay.html"/' "$ASSETS_DIR/appinfo.json" > "$LEGACY_STAGE/appinfo.json"
mount --bind "$LEGACY_STAGE" "$APP_DIR"
fi
mkdir -p "$VA_DIR"
if ! va_mounted_current && ! va_mount_copy; then
umount -l "$APP_DIR" || true
echo "[-] Could not mount the player over $VA_ID" >&2
exit 1
fi
start_watcher
start_legacy_watcher
if sam_up && ! legacy_sam_ok; then
if sam_restart_ok && sam_restart; then
for i in $(seq 1 20); do
legacy_sam_ok && break
sleep 1
done
fi
if ! legacy_sam_ok; then
umount -l "$APP_DIR" || true
umount -l "$VA_DIR" || true
rmdir "$VA_DIR" 2>/dev/null || true
echo "[-] The app manager didn't pick up the screensaver, so the stock one is kept. Apply again after a reboot." >&2
exit 1
fi
fi
if [[ -n "$WEB_ONLY" ]]; then
echo "[+] Enabled succesfully (web screensaver, webOS ${WEBOS_REL:-4.x})" >&2
else
echo "[+] Enabled succesfully (web screensaver, webOS 3.x)" >&2
fi
}
# This Aerial's appinfo.json with the id $VA_ID
va_appinfo() {
if [[ -n "$VA_FIX" ]]; then
sed "s/\"$APP_ID\"/\"$VA_ID\"/" "$ASSETS_DIR/appinfo.json" | sed "$VA_FIX"
else
sed "s/\"$APP_ID\"/\"$VA_ID\"/" "$ASSETS_DIR/appinfo.json"
fi
}
# Whether every file of this assets/ is in the videoads copy unchanged, except tn/ (left out),
# appinfo.json (another id) and the mounted settings.json, watcher.json, solar.json and fonts/custom
va_files_current() {
(cd "$ASSETS_DIR" && find . -path ./tn -prune -o -path ./appinfo.json -prune \
-o -path ./settings.json -prune -o -path ./watcher.json -prune -o -path ./solar.json -prune \
-o -path ./fonts/custom -prune -o -type f -print) |
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
[[ "$ASSETS_DIR/solar.json" -ef "$VA_DIR/solar.json" ]] &&
findmnt "$VA_DIR/fonts/custom" >/dev/null &&
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
# Same for the sunrise / sunset times (solar-update.sh rewrites that file in place) and for the
# custom fonts (added while the copy is mounted)
[[ -f "$ASSETS_DIR/solar.json" ]] && [[ -f "$VA_DIR/solar.json" ]] &&
{ mount --bind "$ASSETS_DIR/solar.json" "$VA_DIR/solar.json" || true; }
mkdir -p "$VA_DIR/fonts/custom" 2>/dev/null || true
mount --bind "$CUSTOM_FONTS" "$VA_DIR/fonts/custom" || true
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
sam_up || return 0
sam_call getAppInfo "{\"id\":\"$VA_ID\"}" "$VA_MAIN" && return 0
if ! sam_reload "$VA_ID" "$VA_MAIN"; then
umount -l "$VA_DIR" || true
request_reload "$VA_ID"
echo "[~] Could not also replace LG's video screensaver ($VA_ID)" >&2
fi
}
# Boot hook: puts the screen brightness back if the TV rebooted in the middle of a screensaver
# (Panel protection lowers it). Installed by every apply, so it also works with the autostart off;
# it does nothing unless the watcher left a state file (see backlight-lib.sh).
BL_HOOK="/var/lib/webosbrew/init.d/48-aerial-backlight-restore"
BL_STATE="/var/lib/webosbrew/custom-screensaver-aerial/backlight.state"
install_backlight_hook() {
[[ -d "$(dirname "$BL_HOOK")" ]] || mkdir -p "$(dirname "$BL_HOOK")" || return 0
tmp="$BL_HOOK.new"
cat > "$tmp" <<HOOK
#!/bin/sh
# Installed by Aerial's apply.sh: puts the screen brightness back after a reboot during a screensaver
STATE="$BL_STATE"
R="$ASSETS_DIR/backlight-restore.sh"
[ -s "\$STATE" ] && [ -f "\$R" ] && { sh "\$R" </dev/null >/dev/null 2>&1 & }
exit 0
HOOK
if cmp -s "$tmp" "$BL_HOOK"; then
rm -f "$tmp"
else
chmod 755 "$tmp" && mv "$tmp" "$BL_HOOK"
fi
}
# ---- revert ----------------------------------------------------------------------------------------------
# Everything below undoes an apply. Nothing on flash is written and the autostart link is left
# alone, so with autostart on the stock screensaver is back only until the next boot.
# The "type" of the manifest that is on flash again ("flutter" on webOS 25/26, "qml" on older ones)
stock_type() {  # app dir
sed -n 's/.*"type" *: *"\([^"]*\)".*/\1/p' "$1/appinfo.json" 2>/dev/null | head -n 1
}
# SAM caches appinfo.json, so after the mounts are gone it still describes the web screensaver
# until it rereads the manifest. Same trick as apply: the failed dev install, no block and no
# restart. Returns 0 once SAM reports the stock type (or immediately, if it never took the web app).
reload_stock() {  # app dir app id
rs_type="$(stock_type "$1")"
[ -n "$rs_type" ] || return 0
rs_pat='"type": *"'"$rs_type"'"'
sam_call getAppInfo "{\"id\":\"$2\"}" "$rs_pat" && return 0
request_reload "$2"
sam_reports "$2" "$rs_pat"
}
# videoads is a web app both stock and replaced, so its "main" tells them apart, not its type
va_reports_stock() {
for i in $(seq 1 20); do
if ! sam_call getAppInfo "{\"id\":\"$VA_ID\"}" "$VA_MAIN"; then
return 0
fi
[[ $i -lt 20 ]] && sleep 1
done
return 1
}
reload_videoads_stock() {
grep -q '"type" *: *"web"' "$VA_DIR/appinfo.json" 2>/dev/null || return 0
# A videoads a debloat tool blocked is none of our business, same as in mirror_videoads
if grep -q "\"$VA_ID\"" "$BLOCKED_LIST_DIR"/*.json 2>/dev/null; then
return 0
fi
if ! sam_call getAppInfo "{\"id\":\"$VA_ID\"}" "$VA_MAIN"; then
return 0
fi
request_reload "$VA_ID"
va_reports_stock
}
revert_screensaver() {
stop_watcher
sh "$ASSETS_DIR/screensaver-delay.sh" revert || true
# The watcher is what puts the brightness back when the screensaver ends, and it is stopped now:
# do it here, exactly like the boot hook does (see install_backlight_hook)
if [ -s "$BL_STATE" ] && [ -f "$ASSETS_DIR/backlight-restore.sh" ]; then
sh "$ASSETS_DIR/backlight-restore.sh" </dev/null >/dev/null 2>&1 || true
fi
# -l also takes the mounts inside along (settings.json, solar.json, watcher.json, fonts/custom).
# The heartbeat is mounted into assets/ too, which on the QML screensaver is inside none of them.
for m in "$MOUNT_TARGET" "$APP_DIR" "$VA_DIR" "$LEGACY_DIR" \
"$ASSETS_DIR/watcher.json" "$APP_DIR/watcher.json" "$VA_DIR/watcher.json"; do
if findmnt "$m" >/dev/null 2>&1; then
umount -l "$m" || echo "[~] Could not unmount $m" >&2
fi
done
# The RAM copy is only dropped once videoads really shows its own files again
if ! findmnt "$VA_DIR" >/dev/null 2>&1; then
rm -rf "$VA_STAGE" 2>/dev/null || true
fi
rm -rf "$LEGACY_STAGE" "$PLAYER_STAGE" 2>/dev/null || true
findmnt "$LEGACY_DIR" >/dev/null 2>&1 || rmdir "$LEGACY_DIR" 2>/dev/null || true
if ! sam_up; then
# SAM isn't up: it reads the manifests on flash on its first scan
echo "[+] Restored the stock screensaver" >&2
return 0
fi
# Aerial 3.0.2's leftovers on webOS 26 (its watcher, the lgchannels setting, its boot hook)
undo_videoads_setup
# A block an interrupted apply left would keep the stock screensaver from launching
release_block "$APP_ID" 1 || true
rv_failed=
if sam_no_reread; then rv_failed=1; else reload_stock "$APP_DIR" "$APP_ID" || rv_failed=1; fi
reload_videoads_stock || rv_failed=1
if [ -n "$rv_failed" ] && sam_call getAppInfo "{\"id\":\"$APP_ID\"}" '"type": *"web"' && sam_restart_ok && sam_restart; then
rv_failed=
fi
if [ -n "$rv_failed" ]; then
echo "[~] The app manager didn't reread the stock screensaver yet; a reboot puts it right" >&2
fi
echo "[+] Restored the stock screensaver" >&2
}
if [ "$MODE" = revert ]; then
if ! mkdir "$LOCK" 2>/dev/null; then
echo "[-] Already applying, try again in a moment" >&2
exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
revert_screensaver
exit 0
fi
install_backlight_hook || true
# The screensaver delay where the TV has no setting for it (see screensaver-delay.sh); also at boot
sh "$ASSETS_DIR/screensaver-delay.sh" apply || true

# webOS 3.5+ (QML stock screensaver, up to 3.9), 4.x and 9.x: same legacy approach as webOS 3.0-3.4
# (transparent overlay as the screensaver, video in a separate player app, legacy-player.sh), except
# that the player stays a screenSaver window instead of a card. So the QML screensaver is skipped
# here and apply_legacy is used (see WEB_ONLY there). webOS 3.0-3.4 (native_builtin) is picked up
# by its manifest type further down and keeps the card player.
WEBOS_REL="$(grep -o '"webos_release" *: *"[0-9.]*' /var/run/nyx/os_info.json 2>/dev/null | grep -o '[0-9.]*$' || true)"
# webOS 3.x has no os_info.json (webOS 3.9: "sdkVersion": "3.9.0"): ask the system properties service
if [[ -z "$WEBOS_REL" ]]; then
WEBOS_REL="$($TIMEOUT luna-send -n 1 luna://com.webos.service.tv.systemproperty/getSystemInfo '{"keys":["sdkVersion"]}' </dev/null 2>/dev/null | grep -o '"sdkVersion": *"[0-9.]*' | grep -o '[0-9.]*$' || true)"
fi
WEBOS_MAJOR="${WEBOS_REL%%.*}"
WEBOS_MINOR=
case "$WEBOS_REL" in
*.*) WEBOS_MINOR="${WEBOS_REL#*.}"; WEBOS_MINOR="${WEBOS_MINOR%%.*}" ;;
esac
WEB_ONLY=
if [[ "$WEBOS_MAJOR" = 4 || "$WEBOS_MAJOR" = 9 ]]; then
WEB_ONLY=1
elif [[ "$WEBOS_MAJOR" = 3 && -n "$WEBOS_MINOR" && "$WEBOS_MINOR" -ge 5 ]] 2>/dev/null; then
WEB_ONLY=1
fi
# A QML screensaver an earlier install mounted would stay underneath
if [[ -n "$WEB_ONLY" ]] && findmnt "$MOUNT_TARGET" >/dev/null 2>&1; then
umount -l "$MOUNT_TARGET" || true
fi

if [[ -z "$WEB_ONLY" && -f "$MOUNT_TARGET" ]]; then
if ! findmnt "$MOUNT_TARGET"; then
mount --bind "$QML_PATH" "$MOUNT_TARGET"
echo "[+] Enabled succesfully" >&2
else
echo "[~] Enabled already" >&2
fi
# The watcher also serves the QML screensaver: it puts the screen brightness back (Panel
# protection) and writes the heartbeat the screensaver reads
mount_heartbeat "$ASSETS_DIR"
start_watcher
exit 0
fi
# One apply at a time, see $LOCK above
if ! mkdir "$LOCK" 2>/dev/null; then
echo "[-] Already applying, try again in a moment" >&2
exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
undo_videoads_setup
# webOS 3.x, 4.x and 9.x: native_builtin / QML stock screensaver, or the overlay an earlier install mounted
if [[ -n "$WEB_ONLY" ]] || grep -q '"type" *: *"native_builtin"' "$APP_DIR/appinfo.json" 2>/dev/null || [[ -f "$APP_DIR/screensaver-overlay.html" ]]; then
apply_legacy
exit 0
fi
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
if sam_up; then
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
