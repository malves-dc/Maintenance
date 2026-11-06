#!/bin/sh
# Restarts `next dev` in the dev container (docker-compose.dev.yml), logging to /tmp/dev.log. The file watcher
# misses edits on a Windows bind mount, so restart after changing code instead of trusting hot reload.
pids() { for p in /proc/[0-9]*; do c=$(tr '\000' ' ' < "$p/cmdline" 2>/dev/null); case "$c" in *"next dev"*|next-server*|*"npm exec next"*) echo "${p#/proc/}";; esac; done; }
for i in 1 2 3 4 5 6 7 8 9 10; do P=$(pids); [ -z "$P" ] && break; kill $P 2>/dev/null; sleep 1; done
cd /app && nohup npx next dev -H 0.0.0.0 -p 3000 > /tmp/dev.log 2>&1 &
echo restarted
