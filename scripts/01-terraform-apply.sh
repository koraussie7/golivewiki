#!/usr/bin/env bash
#
# 01-terraform-apply.sh
# - 작업 1: Terraform 으로 Cloudflare DNS 일괄 동기화 (plan → apply)
#
# 사용법:
#   ./01-terraform-apply.sh           # plan 출력 후 자동 apply
#   ./01-terraform-apply.sh --plan    # plan 만 보고 종료
#
# 안전장치:
#   - apply 전 plan 결과를 마지막 30줄 출력해서 보여줌
#   - 실제 생성/수정 DNS 레코드만 골라서 보여줌
#   - terraform.tfvars 가 없으면 자동 생성 (API 토큰은 set-token-once.sh 로 입력)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$ROOT_DIR/terraform"

cd "$TF_DIR"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; BLD=$'\033[1m'; RST=$'\033[0m'
info()  { printf '%s\n' "${CYN}==>${RST} $*"; }
ok()    { printf '%s\n' "${GRN}✓${RST} $*"; }
warn()  { printf '%s\n' "${YLW}!${RST} $*"; }
err()   { printf '%s\n' "${RED}✗${RST} $*" >&2; }

command -v terraform >/dev/null 2>&1 || { err "terraform 미설치. brew install terraform"; exit 1; }

[ -f "main.tf" ]   || { err "main.tf 없음. $TF_DIR 확인"; exit 1; }
[ -f "terraform.tfvars" ] || {
  warn "terraform.tfvars 없음. example 로 생성합니다."
  cp terraform.tfvars.example terraform.tfvars
  warn "⚠️  반드시 terraform.tfvars 의 cloudflare_api_token 과 origin_ip 를 채운 뒤 다시 실행하세요."
  exit 1
}

info "Terraform init (lock 갱신 포함)..."
terraform init -upgrade -input=false

info "구문 검증..."
terraform validate

info "Plan 출력 (실제 변경/생성 DNS 만)..."
echo
terraform plan -input=false -no-color | tee /tmp/tf-plan.txt | tail -60
echo

CHANGES=$(grep -E "^\s*#\s*(cloudflare_record|cloudflare_zone)" /tmp/tf-plan.txt | wc -l | tr -d ' ')
ok "이번 apply 에서 변경/생성될 리소스: ${BLD}${CHANGES}개${RST}"

if [ "${1:-}" = "--plan" ]; then
  warn "--plan 모드: apply 는 실행하지 않았습니다."
  exit 0
fi

echo
warn "위 ${CHANGES}개 리소스가 Cloudflare 에 즉시 반영됩니다."
printf '%s진행할까요?%s [yes/no] ' "$BLD" "$RST"
read -r REPLY
case "$REPLY" in
  yes|YES|y|Y) ;;
  *) warn "사용자 취소. apply 안 함."; exit 0 ;;
esac

info "terraform apply..."
terraform apply -input=false -auto-approve

echo
ok "DNS 일괄 동기화 완료."
echo
info "현재 state 가 관리 중인 도메인:"
terraform output -json managed_domains 2>/dev/null | python3 -c "import json,sys; print('\n'.join(json.load(sys.stdin)))" 2>/dev/null || true
echo
