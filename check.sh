#!/bin/sh
for o in https://golive.wiki https://evil.example http://localhost:4310; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: $o" -H 'Authorization: Bearer x' http://127.0.0.1:4300/smartglass/tasks)
  printf '%-24s %s\n' "$o" "$code"
done
-SH
sed -i '' '$d' check.sh; sh check.sh; rm -f check.sh