#!/usr/bin/env bash
# HamdPharma — Ubuntu sunucu kurulumu (Docker)
# Kullanım: sudo bash deploy/install-ubuntu.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> HamdPharma kurulumu: $APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker kuruluyor..."
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

if [ ! -f .env ]; then
  echo "==> .env dosyası oluşturuluyor..."
  cp deploy/env.example .env
  POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env
  echo ""
  echo "    .env oluşturuldu. Veritabanı şifresi ve oturum anahtarı otomatik üretildi."
  echo ""
  echo "    ŞİMDİ YAPMANIZ GEREKEN — nano .env ile:"
  echo "      ADMIN_INITIAL_PASSWORD  yönetici ilk şifresi (12+ karakter, büyük+küçük+rakam)"
  echo "      DOMAIN                  örn. erp.hamdpharma.com"
  echo "      CERTBOT_EMAIL           Let's Encrypt bildirimleri"
  echo ""
  echo "    Sonra bu betiği tekrar çalıştırın."
  exit 0
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

if [ -z "${ADMIN_INITIAL_PASSWORD:-}" ] \
  || [ "${ADMIN_INITIAL_PASSWORD}" = "BURAYA_GUCLU_BIR_SIFRE_YAZIN" ]; then
  echo "HATA: .env içindeki ADMIN_INITIAL_PASSWORD belirlenmemiş."
  echo ""
  echo "  Yönetici hesabının ilk şifresini belirleyin:"
  echo "    nano .env      →  ADMIN_INITIAL_PASSWORD=..."
  echo ""
  echo "  Kural: en az 12 karakter, küçük harf + büyük harf + rakam içermeli."
  echo "  Bu şifreyle ilk girişte doğrudan şifre değiştirme ekranı açılır."
  exit 1
fi

if [ -z "${DOMAIN:-}" ] || [ "${DOMAIN}" = "BURAYA_ALAN_ADI" ]; then
  echo "HATA: .env içinde DOMAIN belirlenmemiş (örn. erp.hamdpharma.com)."
  echo "  DNS A kaydı ve router 80/443 yönlendirmesi bu ada işaret etmeli."
  exit 1
fi
if [ -z "${CERTBOT_EMAIL:-}" ] || [ "${CERTBOT_EMAIL}" = "BURAYA_EPOSTA" ]; then
  echo "HATA: .env içinde CERTBOT_EMAIL belirlenmemiş."
  exit 1
fi

if [ ! -f prisma/data/hamdart-veri.xlsx ]; then
  echo "HATA: prisma/data/hamdart-veri.xlsx bulunamadı."
  echo "  Kurulum yalnızca bu Excel dosyasındaki verileri yükler."
  echo "  Dosyayı proje ile birlikte sunucuya kopyalayıp betiği tekrar çalıştırın."
  exit 1
fi

echo "==> PostgreSQL başlatılıyor..."
docker compose -f docker-compose.prod.yml up -d postgres

echo "==> Veritabanı hazır olana kadar bekleniyor..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-hamdart}" -d "${POSTGRES_DB:-hamdart}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Uygulama imajı derleniyor (ilk seferde birkaç dakika sürebilir)..."
docker compose -f docker-compose.prod.yml build app

echo "==> Veritabanı tabloları oluşturuluyor (imaj her açılışta migrate deploy çalıştırır)..."
docker compose -f docker-compose.prod.yml run --rm --no-deps app prisma migrate deploy

# Başlangıç verileri yalnızca ilk kurulumda yüklenir. Betik tekrar çalıştırılırsa
# mevcut veriye dokunulmaz.
EXISTING_ROWS="$(docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-hamdart}" -d "${POSTGRES_DB:-hamdart}" \
  -tAc 'SELECT COUNT(*) FROM "Warehouse";' 2>/dev/null | tr -d '[:space:]' || true)"

if [ "${SKIP_SEED:-}" = "1" ]; then
  echo "==> SKIP_SEED=1 — başlangıç verileri atlandı."
elif [ -n "$EXISTING_ROWS" ] && [ "$EXISTING_ROWS" != "0" ]; then
  echo "==> Veritabanında zaten veri var — başlangıç verileri atlandı."
  echo "    Eksik kayıtları yüklemek isterseniz (mevcutlara dokunmaz):"
  echo "    docker compose -f docker-compose.prod.yml run --rm --no-deps app tsx prisma/seed.ts"
else
  echo "==> Başlangıç verileri Excel'den yükleniyor (prisma/data/hamdart-veri.xlsx)..."
  docker compose -f docker-compose.prod.yml run --rm --no-deps app tsx prisma/seed.ts
fi

echo "==> Yedek klasörü ve günlük zamanlayıcı..."
BACKUP_HOST_DIR="${BACKUP_HOST_DIR:-/var/lib/hamdart/backups}"
mkdir -p "$BACKUP_HOST_DIR"
chmod 750 "$BACKUP_HOST_DIR"
chmod +x "$APP_DIR/deploy/backup-daily.sh"
sed "s|/opt/hamdart|${APP_DIR}|g" "$APP_DIR/deploy/systemd/hamdart-backup.service" \
  > /etc/systemd/system/hamdart-backup.service
cp "$APP_DIR/deploy/systemd/hamdart-backup.timer" /etc/systemd/system/hamdart-backup.timer
systemctl daemon-reload
systemctl enable --now hamdart-backup.timer

echo "==> Uygulama ve nginx başlatılıyor (önce HTTP+ACME)..."
chmod +x "$APP_DIR/deploy/init-certs.sh" "$APP_DIR/deploy/nginx/select-config.sh"
docker compose -f docker-compose.prod.yml up -d app nginx certbot

echo "==> Nginx hazır olana kadar bekleniyor..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T nginx wget -qO- http://127.0.0.1/nginx-health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Let's Encrypt sertifikası..."
if bash "$APP_DIR/deploy/init-certs.sh"; then
  echo "    HTTPS hazır: https://${DOMAIN}"
else
  echo "    UYARI: sertifika alınamadı. DNS A kaydı ve 80/443 yönlendirmesini kontrol edin."
  echo "    Sonra:  sudo bash deploy/init-certs.sh"
fi

cp "$APP_DIR/deploy/systemd/hamdart-nginx-reload.service" /etc/systemd/system/
cp "$APP_DIR/deploy/systemd/hamdart-nginx-reload.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hamdart-nginx-reload.timer

echo ""
echo "============================================"
echo "  Kurulum tamamlandı!"
echo "  Adres: https://${DOMAIN}"
echo ""
echo "  İlk giriş"
echo "    Kullanıcı adı : admin"
echo "    Şifre         : .env dosyasındaki ADMIN_INITIAL_PASSWORD değeri"
echo ""
echo "  Giriş yaptığınızda şifre değiştirme ekranı zorunlu olarak açılır."
echo "  Yeni şifrenizi belirlemeden uygulamaya erişemezsiniz."
echo "  Diğer kullanıcıları 'Denetim & Yedekleme > Kullanıcılar' ekranından"
echo "  oluşturabilirsiniz."
echo ""
echo "  Yayın kontrolü: deploy/YAYIN-KONTROL.md"
echo "  Güncelleme:  docker compose -f docker-compose.prod.yml up -d --build"
echo "               (açılışta bekleyen migration otomatik uygulanır)"
echo "  Loglar:      docker compose -f docker-compose.prod.yml logs -f nginx app"
echo "  Durdur:      docker compose -f docker-compose.prod.yml down"
echo "  Yedekler:    $BACKUP_HOST_DIR  (her gece 03:00)"
echo "  Dış kopya:   deploy/KURTARMA.md  (Windows D: sürücüsü)"
echo "============================================"
