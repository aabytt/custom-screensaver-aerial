#!/bin/sh
# Solar mode: stores sunrise / sunset times of the chosen city in assets/solar.json, which the
# screensaver reads (it cannot do network requests of its own that early, and the app is not run
# once everything is set up). Called by the watcher (videoads-flag.sh), which apply.sh starts at
# boot, so it runs after every boot and then about once a day; also by the app right after a city
# is chosen ("force").
#
#   solar-update.sh          fetch if solar mode is on and the stored data is missing, for another
#                            city, or older than 23 hours (and the last try was over 30 minutes ago)
#   solar-update.sh force    fetch now
#
# Source: Open-Meteo (https://open-meteo.com, free, no key). It returns the next days at once, so
# the stored data keeps being valid for about a week without network; after that the screensaver
# calculates the times itself (solar.js), so a missing network only costs a few minutes of accuracy.
# Output on stdout (for the app): "ok", "skip" or "fail <why>".

ASSETS_DIR="$(dirname "$(realpath "$0")")"
SETTINGS="$ASSETS_DIR/settings.json"
OUT="$ASSETS_DIR/solar.json"
LOCK=/tmp/aerial-solar.lock
TRYFILE=/tmp/aerial-solar.try
MAX_AGE=82800       # 23 h
RETRY_AFTER=1800    # 30 min after a failed try
API="https://api.open-meteo.com/v1/forecast"

if timeout 1 true >/dev/null 2>&1; then TIMEOUT="timeout 30"
elif timeout -t 1 true >/dev/null 2>&1; then TIMEOUT="timeout -t 30"
else TIMEOUT=; fi

force=0; [ "$1" = force ] && force=1

grep -qsE '"solarMode" *: *true' "$SETTINGS" || { echo skip; exit 0; }

# {"solarCity":{"name":"Helsinki",...,"lat":60.1699,"lon":24.9384,...}}
city="$(sed -n 's/.*"solarCity" *: *\({[^}]*}\).*/\1/p' "$SETTINGS" | head -n 1)"
lat="$(echo "$city" | sed -n 's/.*"lat" *: *\(-\{0,1\}[0-9][0-9.]*\).*/\1/p')"
lon="$(echo "$city" | sed -n 's/.*"lon" *: *\(-\{0,1\}[0-9][0-9.]*\).*/\1/p')"
[ -n "$lat" ] && [ -n "$lon" ] || { echo "fail no city"; exit 0; }

now="$(date +%s)"
# before the clock is set (boot, no NTP yet) the times would be wrong
[ "$now" -gt 1700000000 ] || { echo "fail clock not set"; exit 0; }

if [ $force = 0 ]; then
    stored_lat="$(sed -n 's/.*"lat":\(-\{0,1\}[0-9][0-9.]*\).*/\1/p' "$OUT" 2>/dev/null | head -n 1)"
    stored_lon="$(sed -n 's/.*"lon":\(-\{0,1\}[0-9][0-9.]*\).*/\1/p' "$OUT" 2>/dev/null | head -n 1)"
    fetched="$(sed -n 's/.*"fetched":\([0-9]*\).*/\1/p' "$OUT" 2>/dev/null | head -n 1)"
    if [ "$stored_lat" = "$lat" ] && [ "$stored_lon" = "$lon" ] && [ -n "$fetched" ] &&
       [ $((now - fetched)) -lt $MAX_AGE ] && [ $((now - fetched)) -ge 0 ]; then
        echo skip; exit 0
    fi
    last="$(cat "$TRYFILE" 2>/dev/null)"
    [ -n "$last" ] && [ $((now - last)) -lt $RETRY_AFTER ] && [ $((now - last)) -ge 0 ] && { echo skip; exit 0; }
fi

# one run at a time (the watcher and the app can both call this)
if ! mkdir "$LOCK" 2>/dev/null; then
    # a lock left by a killed run goes away after 2 minutes
    age=$(( now - $(stat -c %Y "$LOCK" 2>/dev/null || echo "$now") ))
    [ $age -gt 120 ] && rmdir "$LOCK" 2>/dev/null
    mkdir "$LOCK" 2>/dev/null || { echo skip; exit 0; }
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
echo "$now" > "$TRYFILE"

url="$API?latitude=$lat&longitude=$lon&daily=sunrise,sunset&timezone=GMT&timeformat=unixtime&past_days=1&forecast_days=8"
fetch() {  # extra curl flag
    if command -v curl >/dev/null 2>&1; then
        $TIMEOUT curl -fsS $1 --max-time 25 "$url" </dev/null 2>/dev/null
    else
        $TIMEOUT wget -q -T 25 -O - $2 "$url" </dev/null 2>/dev/null
    fi
}
reply="$(fetch '' '')"
# TVs with an old CA bundle can't verify the certificate. These are only sunrise times, so retry
# without verification rather than fail.
[ -n "$reply" ] || reply="$(fetch -k --no-check-certificate)"

rises="$(echo "$reply" | sed -n 's/.*"sunrise" *: *\[\([^]]*\)\].*/\1/p' | head -n 1)"
sets="$(echo "$reply" | sed -n 's/.*"sunset" *: *\[\([^]]*\)\].*/\1/p' | head -n 1)"
# only numbers (a polar day has null entries)
rises="$(echo "$rises" | tr ',' '\n' | grep -E '^[0-9]{9,}$' | tr '\n' ',' | sed 's/,$//')"
sets="$(echo "$sets" | tr ',' '\n' | grep -E '^[0-9]{9,}$' | tr '\n' ',' | sed 's/,$//')"
if [ -z "$rises" ] && [ -z "$sets" ]; then
    # keeps the old file: it may still be good, and the screensaver falls back to calculating
    echo "fail no times in the reply"; exit 0
fi

# in place (same inode): the file is bind-mounted into the videoads copy of the app
printf '{"lat":%s,"lon":%s,"fetched":%s,"source":"open-meteo","sunrise":[%s],"sunset":[%s]}\n' \
    "$lat" "$lon" "$now" "$rises" "$sets" > "$OUT" 2>/dev/null || { echo "fail cannot write"; exit 0; }
echo "aerial-solar: stored sunrise/sunset for $lat,$lon" >&2
echo ok
