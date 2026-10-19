#!/usr/bin/env bash
#
# 03-remove-muhanai-worker.sh
# - 작업 3: 'muhanai' Cloudflare Worker 라우트 영구 삭제
#           (모든 Zone 에서 패턴 'muhanai' 라우트 제거)
#
# 사용법:
#   ./03-remove-muhanai-worker.sh           # dry-run 후 확인 받아 삭제
#   ./03-remove-muhanai-worker.sh --execute # 즉시 삭제
#   ./03-remove-muhanai-worker.sh --list    # 라우트 목록만 보기
#
set -euo pipefail

CF_TOKEN="${CLOUDFLARE_API_TOKEN:-cfut_oizCHPgI6TEVtrhB1SeOXcbFgpY4lKKsNWRuZ88Q2016c28f}"
MODE="interactive"

for arg in "$@"; do
  case "$arg" in
    --execute) MODE="execute" ;;
    --list)    MODE="list" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg"; exit 1 ;;
  esac
done

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; BLD=$'\033[1m'; RST=$'\033[0m'
info()  { printf '%s\n' "${CYN}==>${RST} $*"; }
ok()    { printf '%s\n' "${GRN}✓${RST} $*"; }
warn()  { printf '%s\n' "${YLW}!${RST} $*"; }
err()   { printf '%s\n' "${RED}✗${RST} $*" >&2; }

API="https://api.cloudflare.com/client/v4"
export CF_TOKEN API MODE

> /tmp/cf-routes-to-delete.txt

ZONES_FILE=/tmp/cf-zones.json
info "모든 Zone 목록 가져오는 중..."
curl -sS -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  "$API/zones?per_page=50" -o "$ZONES_FILE"

python3 - <<'PYEOF'
import json, subprocess, os
api  = os.environ['API']
tok  = os.environ['CF_TOKEN']
zones = json.load(open('/tmp/cf-zones.json')).get('result', [])
hits = []
for z in zones:
    zid, zname = z['id'], z['name']
    try:
        out = subprocess.run([
            'curl','-sS',
            '-H',f'Authorization: Bearer {tok}',
            '-H','Content-Type: application/json',
            f'{api}/zones/{zid}/workers/routes'
        ], capture_output=True, text=True, timeout=15).stdout
        parsed = json.loads(out)
        if not parsed.get('success'):
            continue
        routes = parsed.get('result') or []
        if not isinstance(routes, list):
            continue
    except Exception:
        continue
    for r in routes:
        pat = (r.get('pattern') or '').lower()
        if 'muhanai' in pat:
            hits.append((r['id'], r['pattern'], zname, zid))

with open('/tmp/cf-routes-to-delete.txt','w') as f:
    for h in hits:
        f.write('|'.join(h)+'\n')

print(f"총 {len(hits)}개 라우트가 'muhanai' 패턴을 포함합니다.")
for rid, pat, zn, _ in hits:
    print(f"  - zone={zn:25s} pattern={pat:40s} id={rid}")
PYEOF

COUNT=$(wc -l < /tmp/cf-routes-to-delete.txt | tr -d ' ')
echo

if [ "$MODE" = "list" ] || [ "$COUNT" = "0" ]; then
  exit 0
fi

if [ "$MODE" = "interactive" ]; then
  echo
  warn "위 ${COUNT}개 라우트가 Cloudflare 에서 영구 삭제됩니다."
  printf '%s정말 삭제할까요?%s [yes/no] ' "$BLD" "$RST"
  read -r REPLY
  case "$REPLY" in
    yes|YES|y|Y) ;;
    *) warn "취소."; exit 0 ;;
  esac
fi

DELETED=0
while IFS='|' read -r RID RPAT RZN RZID; do
  [ -z "$RID" ] && continue
  RES=$(curl -sS -X DELETE \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        "$API/zones/$RZID/workers/routes/$RID")
  if echo "$RES" | grep -q '"success":true'; then
    ok "삭제: ${RZN} → ${RPAT}"
    DELETED=$((DELETED+1))
  else
    err "실패: ${RZN} → ${RPAT}: $(echo "$RES" | head -c 200)"
  fi
done < /tmp/cf-routes-to-delete.txt

echo
ok "${DELETED}/${COUNT} 개 라우트 삭제 완료."
rm -f /tmp/cf-routes-to-delete.txt /tmp/cf-zones.json
echo
