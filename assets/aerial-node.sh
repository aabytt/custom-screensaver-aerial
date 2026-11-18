# Locate the TV's existing Node runtime (also used by the custom font server).
find_aerial_node() {
    NODE="$(command -v node 2>/dev/null)" && [ -n "$NODE" ] && return 0
    for n in /usr/bin/node /usr/local/bin/node /media/developer/bin/node /usr/palm/nodejs/node; do
        if [ -x "$n" ]; then NODE="$n"; return 0; fi
    done
    return 1
}
