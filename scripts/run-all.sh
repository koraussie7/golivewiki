#!/usr/bin/env bash
#
# run-all.sh — 4개 후속작업 일괄 실행 마스터 스크립트
#
# 사용법 (호스트 맥북):
#   cd /Users/brianyeon/CodeGPT/integration-finalize-2
#   ./scripts/run-all.sh           # 전체 자동 (확인 받음)
#   ./scripts/run-all.sh --yes     # 확인 스킵하고 즉시 실행
#   ./scripts/run-all.sh --only 1  # 작업 1번만 실행
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
ONLY=""
ASSUME_YES=""

for arg in "$@"; do
  case "$arg" in
    --yes|-y)  ASSUME_YES="--yes" ;;
    --only)    shift; ONLY="${1:-}" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown: $arg"; exit 1 ;;
  esac
done

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; BLD=$'\033[1m'; RST=$'\033[0m'
step() { printf '\n%s━━ %s ━━%s\n' "$BLD$CYN" "$1" "$RST"; }
ok()   { printf '%s\n' "${GRN}✓${RST} $*"; }
err()  { printf '%s\n' "${RED}✗${RST} $*" >&2; }

run_remote() {
  local script_name="$1"
  step "110 서버 → $script_name"
  scp -q "$SCRIPTS/$script_name" "root@185.55.240.110:/tmp/$script_name"
  ssh -o StrictHostKeyChecking=no "root@185.55.240.110" "bash /tmp/$script_name"
  ok "$script_name 완료"
}

run_local() {
  local script_name="$1"
  step "호스트 → $script_name"
  bash "$SCRIPTS/$script_name"
  ok "$script_name 완료"
}

should_run() {
  local n="$1"
  [ -z "$ONLY" ] || [ "$ONLY" = "$n" ]
}

echo "${BLD}KBizHub 후속 4작업 자동 실행${RST}"
echo "  1. Terraform apply (DNS 일괄 동기화)"
echo "  2. LE 인증서 자동갱신 systemd timer"
echo "  3. 'muhanai' Cloudflare Worker 라우트 영구 삭제"
echo "  4. kbizhub.com 자동 백업 systemd timer"

if [ -z "$ASSUME_YES" ]; then
  echo
  printf '계속할까요? [yes/no] '
  read -r REPLY
  case "$REPLY" in
    yes|YES|y|Y) ;;
    *) echo "취소."; exit 0 ;;
  esac
fi

should_run 1 && run_local  "01-terraform-apply.sh"
should_run 2 && run_remote "02-setup-le-renewal.sh"
should_run 3 && run_local  "03-remove-muhanai-worker.sh"
should_run 4 && run_remote "04-setup-kbizhub-backup.sh"

echo
ok "전체 작업 완료. 110 서버/호스트 시스템 점검을 권장합니다."
echo "  → ssh root@185.55.240.110 'systemctl list-timers --all'"
echo "  → http://kbizhub.com 브라우저 확인"
echo
