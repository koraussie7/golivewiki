#!/usr/bin/env bash
#
# 02-setup-le-renewal.sh
# - 작업 2: Let's Encrypt 인증서 자동갱신 + Caddy 자동 reload 설정
#
# 사용법 (110 서버에서 실행):
#   sudo ./02-setup-le-renewal.sh
#
# 동작:
#   1. certbot 설치 확인 (없으면 설치)
#   2. 매일 03:30 에 certbot renew --quiet 실행하는 systemd timer 등록
#   3. renew 성공 시 자동으로 systemctl reload caddy 실행
#   4. dry-run 으로 동작 검증
#
set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; BLD=$'\033[1m'; RST=$'\033[0m'
info()  { printf '%s\n' "${CYN}==>${RST} $*"; }
ok()    { printf '%s\n' "${GRN}✓${RST} $*"; }
warn()  { printf '%s\n' "${YLW}!${RST} $*"; }
err()   { printf '%s\n' "${RED}✗${RST} $*" >&2; }

[ "$(id -u)" -eq 0 ] || { err "root 권한 필요. sudo 로 실행하세요."; exit 1; }

# 1. certbot 확인
if ! command -v certbot >/dev/null 2>&1; then
  warn "certbot 미설치. apt 로 설치합니다."
  apt-get update -qq
  apt-get install -y certbot
  ok "certbot 설치 완료: $(certbot --version 2>&1 | head -1)"
fi

# 2. systemd service & timer 작성
SVC=/etc/systemd/system/certbot-renew.service
TMR=/etc/systemd/system/certbot-renew.timer

cat > "$SVC" <<'EOF'
[Unit]
Description=Certbot renew (kbizhub.com / golive.wiki / etc.)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook /usr/local/bin/certbot-caddy-reload.sh
PrivateTmp=true
EOF

cat > "$TMR" <<'EOF'
[Unit]
Description=Daily Let's Encrypt renewal check

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 3. deploy hook (갱신 성공 시 caddy reload)
HOOK=/usr/local/bin/certbot-caddy-reload.sh
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
LOG=/var/log/certbot-renew.log
echo "$(date -Iseconds) certbot renew success → caddy reload" >> "$LOG"
systemctl reload caddy
EOF
chmod +x "$HOOK"

# 4. 활성화
systemctl daemon-reload
systemctl enable --now certbot-renew.timer

ok "systemd timer 등록 완료: 매일 03:30 자동 갱신 시도"

# 5. dry-run 검증
info "certbot renew --dry-run (실패해도 무해)..."
if certbot renew --dry-run >> /var/log/certbot-renew.log 2>&1; then
  ok "dry-run 성공. 실제 갱신도 정상 작동합니다."
else
  warn "dry-run 실패. /var/log/certbot-renew.log 확인하세요."
fi

# 6. timer 상태 확인
echo
info "timer 상태:"
systemctl list-timers certbot-renew.timer --no-pager || true
echo
info "다음 인증서 만료일:"
for d in kbizhub.com golive.wiki; do
  if [ -f "/etc/letsencrypt/live/$d/fullchain.pem" ]; then
    exp=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$d/fullchain.pem" | cut -d= -f2)
    printf "  %-15s → %s\n" "$d" "$exp"
  fi
done
echo
