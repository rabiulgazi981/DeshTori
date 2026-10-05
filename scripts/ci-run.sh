#!/usr/bin/env bash
# Run a command; on failure, surface the last lines as GitHub annotations (logs aren't always viewable).
set -o pipefail
out=$(mktemp)
"$@" 2>&1 | tee "$out"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  tail -n 25 "$out" | sed 's/%/%25/g' | while IFS= read -r line; do [ -n "$line" ] && echo "::error::$line"; done
fi
exit "$code"
