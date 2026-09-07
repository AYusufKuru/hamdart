#!/usr/bin/env bash
# Let's Encrypt ilk sertifika. Nginx HTTP+ACME ayakta olmalı.
# Kullanım (proje kökünden): sudo bash deploy/init-certs.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DOMAIN="${DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:-}"

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "BURAYA_ALAN_ADI" ]; then
  echo "HATA: .env içinde DOMAIN yok (örn. erp.hamdpharma.com)" >&2
  exit 1
fi
if [ -z "$EMAIL" ] || [ "$EMAIL" = "BURAYA_EPOSTA" ]; then
  echo "HATA: .env içinde CERTBOT_EMAIL yok" >&2
  exit 1
fi

echo "==> Sertifika: ${DOMAIN}"
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint certbot certbot \
  certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive \
  --rsa-key-size 4096 \
  --keep-until-expiring

echo "==> nginx HTTPS ile yeniden başlatılıyor..."
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
echo "==> Tamam — https://${DOMAIN}"
