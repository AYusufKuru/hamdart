#!/usr/bin/env bash
# HamdPharma — günlük PostgreSQL yedeği + saklama + dış kopya
# systemd timer veya elle: sudo bash deploy/backup-daily.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

COMPOSE=(docker compose -f docker-compose.prod.yml)
BACKUP_HOST_DIR="${BACKUP_HOST_DIR:-/var/lib/hamdart/backups}"
OFFSITE="${BACKUP_OFFSITE_DIR:-/mnt/hamdart-offsite}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
KEEP_MONTHLY_DAYS="${BACKUP_KEEP_MONTHLY_DAYS:-365}"
PGUSER="${POSTGRES_USER:-hamdart}"
PGDB="${POSTGRES_DB:-hamdart}"

mkdir -p "$BACKUP_HOST_DIR"

STAMP="$(TZ=Europe/Istanbul date +%Y-%m-%d_%H%M%S)"
FILENAME="hamdart-${STAMP}.dump"

echo "==> Yedek alınıyor: ${FILENAME}"
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$PGUSER" -d "$PGDB" -F c --no-owner --no-acl \
  -f "/backups/${FILENAME}"

HOST_FILE="${BACKUP_HOST_DIR}/${FILENAME}"
if [ ! -f "$HOST_FILE" ]; then
  echo "HATA: yedek dosyası oluşmadı: ${HOST_FILE}" >&2
  echo "postgres servisinde /backups bağının BACKUP_HOST_DIR ile aynı olduğundan emin olun." >&2
  exit 1
fi

SIZE="$(stat -c%s "$HOST_FILE" 2>/dev/null || stat -f%z "$HOST_FILE")"
FILEPATH="/app/backups/${FILENAME}"

"${COMPOSE[@]}" exec -T postgres \
  psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 \
  -c "INSERT INTO \"BackupRecord\" (id, filename, filepath, \"sizeBytes\", \"createdAt\", \"createdBy\", note)
      VALUES ('auto-${STAMP}', '${FILENAME}', '${FILEPATH}', ${SIZE}, NOW(), 'sistem', 'Günlük otomatik yedek');" \
  >/dev/null

echo "==> Kayıt yazıldı (${SIZE} bayt)"

prune_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  local now age name
  now="$(date +%s)"
  find "$dir" -maxdepth 1 -type f -name 'hamdart-*.dump' -print0 |
    while IFS= read -r -d '' f; do
      name="$(basename "$f")"
      age=$(( (now - $(stat -c %Y "$f")) / 86400 ))
      if [[ "$name" =~ ^hamdart-[0-9]{4}-[0-9]{2}-01_ ]]; then
        if [ "$age" -gt "$KEEP_MONTHLY_DAYS" ]; then
          echo "    aylık yedek siliniyor (${age}g): $name"
          rm -f "$f"
        fi
      elif [ "$age" -gt "$KEEP_DAYS" ]; then
        echo "    günlük yedek siliniyor (${age}g): $name"
        rm -f "$f"
      fi
    done
}

echo "==> Saklama: ${KEEP_DAYS} gün günlük, ${KEEP_MONTHLY_DAYS} gün ayın 1'i"
prune_dir "$BACKUP_HOST_DIR"

if [ -d "$OFFSITE" ]; then
  echo "==> Dış kopya: ${OFFSITE}"
  cp -f "$HOST_FILE" "${OFFSITE}/${FILENAME}"
  prune_dir "$OFFSITE"
elif [ "${BACKUP_OFFSITE_REQUIRED:-}" = "1" ]; then
  echo "HATA: BACKUP_OFFSITE_DIR yok veya bağlanmamış: ${OFFSITE}" >&2
  exit 1
else
  echo "==> Dış kopya atlandı (BACKUP_OFFSITE_DIR bağlı değil: ${OFFSITE})"
fi

echo "==> Tamam"
