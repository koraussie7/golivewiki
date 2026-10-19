#!/usr/bin/env bash
#
# 04-setup-kbizhub-backup.sh
# - 작업 4: kbizhub.com 자동 백업 (매일 02:00)
#
# 사용법 (110 서버에서 실행):
#   sudo ./04-setup-kbizhub-backup.sh
#
# 동작:
#   1. /var/www/kbizhub.com → /var/backups/kbizhub/kbizhub-YYYYMMDD-HHMM.tar.gz
#   2. 7일 이상 된 로컬 백업 자동 삭제
#   3. systemd timer 로 매일 02:00 자동 실행
#   4. 백업 성공/실패를 /var/log/kbizhub-backup.log 에 기록
#
set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; BLD=$'\033[1m'; RST=$'\033[0m'
info()  { printf '%s\n' "${CYN}==>${RST} $*"; }
ok()    { printf '%s\n' "${GRN}✓${RST} $*"; }
warn()  { printf '%s\n' "${YLW}!${RST} $*"; }
err()   { printf '%s\n' "${RED}✗${RST} $*" >&2; }

[ "$(id -u)" -eq 0 ] || { err "root 권한 필요. sudo 로 실행하세요."; exit 1; }

SRC=/var/www/kbizhub.com
DST=/var/backups/kbizhub
LOG=/var/log/kbizhub-backup.log
KEEP_DAYS=7

[ -d "$SRC" ] || { err "$SRC 없음. kbizhub.com 배포 상태 확인."; exit 1; }
mkdir -p "$DST"

# 1. 백업 스크립트 작성
HOOK=/usr/local/bin/kbizhub-backup.sh
cat > "$HOOK" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SRC=$SRC
DST=$DST
LOG=$LOG
KEEP_DAYS=$KEEP_DAYS

ts()  { date +'%Y-%m-%d %H:%M:%S'; }
log() { printf '[%s] %s\n' "\$(ts)" "\$*" >> "\$LOG"; }

NAME="kbizhub-\$(date +%Y%m%d-%H%M%S).tar.gz"
TMP="\$DST/\$NAME.tmp"

log "백업 시작: \$NAME"
if tar -czf "\$TMP" -C "\$(dirname \$SRC)" "\$(basename \$SRC)" 2>>"\$LOG"; then
  mv "\$TMP" "\$DST/\$NAME"
  log "백업 성공: \$DST/\$NAME (\$(du -h \$DST/\$NAME | cut -f1))"
else
  rm -f "\$TMP"
  log "백업 실패"
  exit 1
fi

# 7일 지난 백업 삭제
find "\$DST" -name 'kbizhub-*.tar.gz' -mtime +\$KEEP_DAYS -delete
COUNT=\$(find "\$DST" -name 'kbizhub-*.tar.gz' | wc -l | tr -d ' ')
log "현재 보존 백업 수: \${COUNT}개"
EOF
chmod +x "$HOOK"
ok "백업 스크립트 작성: $HOOK"

# 2. systemd service & timer
SVC=/etc/systemd/system/kbizhub-backup.service
TMR=/etc/systemd/system/kbizhub-backup.timer

cat > "$SVC" <<EOF
[Unit]
Description=KbizHub.com static files daily backup

[Service]
Type=oneshot
ExecStart=$HOOK
Nice=10
EOF

cat > "$TMR" <<'EOF'
[Unit]
Description=Daily kbizhub.com backup

[Timer]
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now kbizhub-backup.timer

ok "systemd timer 등록 완료: 매일 02:00 자동 백업"

# 3. 1회 수동 실행
info "백업 스크립트 1회 수동 실행..."
$HOOK
echo

# 4. 결과 확인
echo
info "백업 결과:"
ls -lh "$DST"
echo
info "timer 상태:"
systemctl list-timers kbizhub-backup.timer --no-pager || true
echo
info "복구 명령어 (필요시):"
echo "  sudo tar -xzf $DST/<파일명> -C /var/www/"
echo
