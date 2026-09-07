# HamdPharma — Yedekleme ve kurtarma

Takvim: İstanbul (`Europe/Istanbul`). Günlük yedek **03:00** civarı alınır.

## Saklanan yerler

| Yer | Yol | Ne işe yarar |
|---|---|---|
| VM içi (birincil) | `/var/lib/hamdart/backups` | Uygulama ve `pg_dump` buraya yazar |
| Windows host D: | `D:\HamdPharma-Backups` | VM ölürse buradan dönülür |
| Uygulama listesi | Admin → Yedekler | Elle yedek / geri yükleme |

Dosya adı: `hamdart-YYYY-MM-DD_HHMMSS.dump` (özel PostgreSQL formatı, `-Fc`).

**Saklama:** 14 gün günlük; her ayın 1'inde alınan dump 365 gün.

## D: sürücüsüne kopya (iki yoldan biri)

### Yol A — Ubuntu D: paylaşımını bağlar (önerilen)

Windows host'ta (yönetici PowerShell):

```powershell
New-Item -ItemType Directory -Path "D:\HamdPharma-Backups" -Force
New-SmbShare -Name "HamdPharma-Backups" -Path "D:\HamdPharma-Backups" `
  -FullAccess "Administrators" -ReadAccess "Everyone"
```

Ubuntu VM'de `/etc/fstab` (kullanıcı/şifreyi host'taki bir paylaşılan hesaba göre yazın):

```
//192.168.2.2/HamdPharma-Backups  /mnt/hamdart-offsite  cifs  credentials=/root/.smb-hamdart,uid=0,gid=0,iocharset=utf8,file_mode=0640,dir_mode=0750  0  0
```

`.env` içine:

```
BACKUP_OFFSITE_DIR=/mnt/hamdart-offsite
BACKUP_OFFSITE_REQUIRED=1
```

`BACKUP_OFFSITE_REQUIRED=1` iken dış kopya yoksa günlük betik **hata verir** — yedeğin yalnızca VM'de kaldığını gizlemez.

### Yol B — Windows host Ubuntu'dan çeker

Ubuntu'da `samba` ile `/var/lib/hamdart/backups` paylaşılır. Host'ta Görev Zamanlayıcı, her gün 03:30:

```
powershell -File C:\path\to\deploy\windows\Copy-HamdartBackups.ps1
```

## Elle yedek (hemen şimdi)

```bash
sudo bash /opt/hamdart/deploy/backup-daily.sh
# veya admin panelinden "Yedek Oluştur"
```

Timer durumu: `systemctl list-timers hamdart-backup.timer`

## Senaryo 1 — Yanlış silinen kayıt (VM ve Postgres ayakta)

1. Admin → Yedekler.
2. Doğru dump satırında **Geri Yükle**.
3. Ekrandaki dosya adını **aynı şekilde** yazın. Eşleşmezse işlem başlamaz.
4. Sistem önce o anki veritabanının güvenlik yedeğini alır, sonra seçilen dump'ı yükler.
5. Oturumlar geçersiz olabilir — yeniden giriş yapın.
6. Güvenlik yedeği diskte kalır (`hamdart-….dump`); gerekirse ondan tekrar dönülür.

API de aynı kuralı ister: `POST /api/backups/<id>` gövdesinde `{ "confirmFilename": "hamdart-….dump" }`.

## Senaryo 2 — Veritabanı bozuldu, konteynerler çalışıyor

```bash
cd /opt/hamdart   # kurulum dizininiz
set -a && source .env && set +a

# 1) O anki (bozuk) hâli de sakla
sudo bash deploy/backup-daily.sh

# 2) Geri yüklenecek dosyayı seç
ls -lt /var/lib/hamdart/backups/hamdart-*.dump | head

# 3) Geri yükle — --clean mevcut nesneleri düşürür
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-acl \
  /backups/hamdart-YYYY-MM-DD_HHMMSS.dump

docker compose -f docker-compose.prod.yml restart app
```

## Senaryo 3 — VM diskı gitti, D: kopyası duruyor

1. Yeni Ubuntu VM + Docker + bu depo (Adım 13 / `install-ubuntu.sh`).
2. Dump'ı host'tan kopyala:

```powershell
# Windows host
Copy-Item D:\HamdPharma-Backups\hamdart-EN-YENI.dump \\192.168.2.50\...
```

veya VM'de CIFS mount sonrası:

```bash
cp /mnt/hamdart-offsite/hamdart-EN-YENI.dump /var/lib/hamdart/backups/
```

3. Konteynerler ayakta iken Senaryo 2 adım 3.
4. `prisma migrate deploy` **geri yüklemeden sonra gerekmez** — dump şemayı da taşır. Daha yeni migration varsa dump'tan sonra `migrate deploy` çalıştırın.

## Senaryo 4 — Yanlış dump yüklendi

Geri yükleme öncesi otomatik güvenlik yedeği (veya D:'deki bir önceki dosya) ile Senaryo 1 veya 2'yi tekrarlayın.

## Kontrol listesi (ayda bir)

- [ ] `systemctl is-active hamdart-backup.timer` → active
- [ ] `/var/lib/hamdart/backups` içinde 03:00 civarı yeni dump var
- [ ] `D:\HamdPharma-Backups` içinde aynı günün dosyası var
- [ ] En eski günlük dump ~14 günden eski değil
- [ ] Test: kopyayı ayrı bir klasöre `pg_restore` ile boş bir veritabanına deneme (üretim DB'sine değil)
