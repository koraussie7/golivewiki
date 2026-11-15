#!/usr/bin/env bash
#
# deploy.sh — golive.wiki 운영 서버 배포 (안전 모드)
#
# 왜 --delete 를 쓰지 않는가
# ---------------------------------------------------------------------------
# 서버 웹루트(/var/www/golive.wiki)에는 dist/ 에 없는 파일이 28개 있다.
# (login.html, smartglass.html, agent-*.html, js/vendor/leaflet.js,
#  assets/*-hash.js 등 — 이 repo 밖에서 관리되는 페이지들.)
# 2026-11-15 에 `rsync --delete` 로 배포했다가 이 파일들이 전부 삭제됐고,
# nginx 의 `try_files ... /index.html` 폴백 때문에 200 응답은 계속 나와서
# 30분 넘게 발견되지 않았다. 백업에서 복구했지만 위험한 방식이다.
#
# 그래서 이 스크립트는:
#   1) 삭제를 하지 않는다 (추가/덮어쓰기만)
#   2) 배포 전 서버를 tar 로 백업한다
#   3) 배포 후 각 파일이 "실제로" 있는지 검증한다
#      — HTTP 200 은 폴백 때문에 신뢰할 수 없다. <title> 을 비교한다.
#
# 사용법
#   ./scripts/deploy.sh              # 빌드 + 배포 + 검증
#   ./scripts/deploy.sh --no-build   # 이미 빌드된 dist/ 로 배포
#   ./scripts/deploy.sh --dry-run    # 무엇이 바뀔지 확인만
#
set -euo pipefail

HOST="${DEPLOY_HOST:-110}"                  # ~/.ssh/config 의 별칭
ROOT="${DEPLOY_ROOT:-/var/www/golive.wiki}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO/dist"
STAMP="$(date +%Y%m%d-%H%M%S)"

BUILD=1
DRY=0
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --dry-run)  DRY=1 ;;
    -h|--help)  sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1) 브랜치 확인 — banchan 이 없는 브랜치에서 빌드하면 조용히 사라진다
# ---------------------------------------------------------------------------
say "1/6 브랜치 확인"
cd "$REPO"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "branch: $BRANCH"
for f in banchan.html js/banchan-api.js js/banchan-mock.js; do
  [ -f "$f" ] || { echo "ERROR: $f 없음 — main 브랜치에서 실행할 것" >&2; exit 1; }
done
grep -q 'banchan: resolve' vite.config.js || { echo "ERROR: vite.config.js 에 banchan input 이 없음" >&2; exit 1; }
grep -q 'banchan-api.js' scripts/postbuild.mjs || { echo "ERROR: postbuild.mjs 에 banchan 복사 블록이 없음" >&2; exit 1; }
echo "OK — banchan 페이지와 빌드 등록이 모두 있음"

# ---------------------------------------------------------------------------
# 2) 빌드
# ---------------------------------------------------------------------------
if [ "$BUILD" = 1 ]; then
  say "2/6 빌드"
  npm run build 2>&1 | tail -6
else
  say "2/6 빌드 건너뜀 (--no-build)"
fi

for f in banchan.html js/banchan-api.js js/banchan-mock.js index.html; do
  [ -f "$DIST/$f" ] || { echo "ERROR: dist/$f 가 없음 — 빌드 실패" >&2; exit 1; }
done
echo "OK — dist 산출물 확인 (banchan.html $(wc -c < "$DIST/banchan.html") bytes)"

# ---------------------------------------------------------------------------
# 3) 보존 목록 — dist/ 에 없는 서버 파일. 삭제 금지 대상.
# ---------------------------------------------------------------------------
say "3/6 서버 파일 목록 수집"
ssh -o ConnectTimeout=10 -o BatchMode=yes "$HOST" \
  "cd '$ROOT' && find . -type f | sed 's|^\./||' | sort" > /tmp/golive-srv.txt
(cd "$DIST" && find . -type f | sed 's|^\./||' | sort) > /tmp/golive-dist.txt
comm -23 /tmp/golive-srv.txt /tmp/golive-dist.txt > /tmp/golive-preserve.txt
echo "서버 $(wc -l < /tmp/golive-srv.txt)개 / dist $(wc -l < /tmp/golive-dist.txt)개 / 보존 대상 $(wc -l < /tmp/golive-preserve.txt)개"
echo "(보존: login.html, smartglass.html, agent-*.html, js/vendor/leaflet.js 등)"

# ---------------------------------------------------------------------------
# 4) 백업
# ---------------------------------------------------------------------------
if [ "$DRY" = 1 ]; then
  say "4/6 백업 건너뜀 (--dry-run)"
else
  say "4/6 서버 백업"
  ssh -o ConnectTimeout=10 -o BatchMode=yes "$HOST" \
    "tar -czf /var/www/golive.wiki.backup-$STAMP.tar.gz -C /var/www golive.wiki && ls -lh /var/www/golive.wiki.backup-$STAMP.tar.gz"
fi

# ---------------------------------------------------------------------------
# 5) 배포 — --delete 없음. dist 에 있는 것만 올린다.
# ---------------------------------------------------------------------------
say "5/6 rsync (삭제 없음)"
RSYNC_OPTS=(-rlptz --no-perms --omit-dir-times -e "ssh -o ConnectTimeout=10 -o BatchMode=yes")
[ "$DRY" = 1 ] && RSYNC_OPTS+=(--dry-run -i)
rsync "${RSYNC_OPTS[@]}" "$DIST/" "$HOST:$ROOT/"
echo "OK — 전송 완료 (서버의 다른 파일은 그대로 유지)"

[ "$DRY" = 1 ] && { say "dry-run 종료"; exit 0; }

# ---------------------------------------------------------------------------
# 6) 검증 — HTTP 200 이 아니라 <title> 로 실제 파일을 확인한다.
#    nginx try_files 폴백 때문에 없는 파일도 200 이 나온다.
# ---------------------------------------------------------------------------
say "6/6 라이브 검증"
FAIL=0
check() { # $1=경로 $2=기대 title 조각
  local body title
  body="$(curl -s -m 15 "https://golive.wiki/$1" || true)"
  # HTML 엔티티(&amp; 등)를 풀어서 비교한다. banchan 의 title 은 "Banchan &amp; Today's …"
  title="$(printf '%s' "$body" | tr '\n' ' ' | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//;s/^ *//;s/ *$//;s/&amp;/\&/g;s/&quot;/"/g;s/&#39;/'"'"'/g')"
  if printf '%s' "$title" | grep -qF "$2"; then
    printf '  \033[32mOK\033[0m   %-28s %s\n' "$1" "$title"
  else
    printf '  \033[31mFAIL\033[0m %-28s got="%s" want~"%s"\n' "$1" "$title" "$2"
    FAIL=$((FAIL+1))
  fi
}

check "index.html"           "Airtasker"
check "banchan.html"         "Banchan & Today's Chicken"
check "login.html"           "로그인"
check "smartglass.html"      "Smartglass"
check "agent-list.html"      "에이전트"
check "screens-07-ride.html" "라이드"

# 정적 자산이 실제로 서빙되는지 (폴백이면 text/html 이 온다)
for a in js/banchan-api.js js/banchan-mock.js; do
  ct="$(curl -s -o /dev/null -m 10 -w '%{content_type}' "https://golive.wiki/$a")"
  if printf '%s' "$ct" | grep -qi 'javascript'; then
    printf '  \033[32mOK\033[0m   %-28s %s\n' "$a" "$ct"
  else
    printf '  \033[31mFAIL\033[0m %-28s content-type=%s (expect javascript)\n' "$a" "$ct"
    FAIL=$((FAIL+1))
  fi
done

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "검증 실패 $FAIL 건. 백업: /var/www/golive.wiki.backup-$STAMP.tar.gz"
  exit 1
fi
echo
echo "완료. 백업: /var/www/golive.wiki.backup-$STAMP.tar.gz"
