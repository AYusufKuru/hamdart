# HamdPharma — yayın öncesi kontrol listesi

Bölüm A (VM, DNS, 80/443 yönlendirme) bittikten sonra `sudo bash deploy/install-ubuntu.sh`, sonra bu listeyi birlikte işaretleriz.

- [ ] `https://<DOMAIN>` açılıyor, tarayıcıda kilit var, `http://` → `https://` yönleniyor
- [ ] Oturumsuz `curl` ile sayfa/API 401 veya girişe yönleniyor; `/api/health` yalnızca `{ ok: true }`
- [ ] Yönetici şifresi değiştirildi, `dev-` / demo hesap yok
- [ ] Yanlış şifre 5 kez → hesap kilitleniyor (15 dk)
- [ ] Kullanıcıyı pasife alınca erişim **anında** kesiliyor
- [ ] Sipariş oluştururken `id` / `orderNo` göndermek işe yaramıyor
- [ ] QC onayı olmadan sipariş depoya alınamıyor
- [ ] Her rol için yetkisiz sayfalar 403 / yönlendirme
- [ ] Yedek alma + geri yükleme (dosya adı onayı) çalışıyor; `D:\HamdPharma-Backups` kopyası var
- [ ] VM yeniden başlayınca uygulama kendiliğinden kalkıyor, **veri kaybı yok**
- [ ] Host yeniden başlayınca VM kendiliğinden açılıyor
- [ ] `curl -I https://<DOMAIN>` → HSTS, `X-Frame-Options: DENY`, `nosniff`
- [ ] PostgreSQL 5432 dışarıdan erişilemiyor (yalnızca Docker ağı)
- [ ] Uygulama 3000 dışarıda yok; yalnızca 80/443

Komutlar (Ubuntu VM):

```bash
curl -sI https://DOMAIN | head
curl -s https://DOMAIN/api/health
ss -lntup | grep -E ':80|:443|:3000|:5432'
docker compose -f docker-compose.prod.yml ps
```
