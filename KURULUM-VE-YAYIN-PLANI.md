# HamdPharma — Sunucu Kurulum ve Yayın Hazırlık Planı

> Bu dosya iki bölümden oluşur:
> - **BÖLÜM A — SENİN YAPACAKLARIN:** Sunucuda elle yapılacak işler (Hyper-V, Ubuntu, ağ, alan adı).
> - **BÖLÜM B — BENİM YAPACAKLARIM:** Projenin yayına hazır hâle gelmesi için koddaki düzeltmeler. 13 adıma bölündü; sen "devam et" dedikçe sırayla yapacağım.
>
> Son güncelleme: 7 Eylül 2026 · Kaynak: `Server_Rapor.txt` + tam kod denetimi (2 bağımsız denetim raporu)

---

## 0. Mevcut Durum ve Hedef

### 0.1 Sunucu (Server_Rapor.txt'ten)

| Özellik | Değer |
|---|---|
| Makine adı | HAMDARD (WORKGROUP) |
| İşletim sistemi | Windows Server 2012 R2 Standard (6.3.9600) |
| Donanım | Fujitsu PRIMERGY RX2540 M2 |
| CPU | Xeon E5-2620 v4 — 8 çekirdek / 16 iş parçacığı |
| RAM | 31,84 GB |
| Disk C: | 222 GB (145 GB boş) — sistem |
| Disk D: | 11.176 GB (10.543 GB boş) — **sanal makine buraya kurulacak** |
| Ağ | 192.168.2.2 / GW 192.168.2.1 / DNS 192.168.2.1 (Onboard CNA Port 1, 1 Gbps) |
| Hyper-V | **Kurulu ve çalışıyor** (vmms servisi Running) |
| Açık portlar | 3389 (RDP), 7070, 2179, 135/139/445 (SMB) |
| Uzaktan erişim | RDP açık + AnyDesk servisi çalışıyor |

### 0.2 Hedef mimari

```
İnternet
   │
   ▼  (router'da yalnızca 80/443 port yönlendirme)
Windows Server 2012 R2 — HAMDARD (192.168.2.2)
   └── Hyper-V
        └── VM: hamdpharma-app — Ubuntu Server 24.04 LTS (192.168.2.50)
             └── Docker Compose
                  ├── nginx        → 80/443, HTTPS sonlandırma (Let's Encrypt)
                  ├── app          → Next.js 16 (standalone), iç port 3000, dışarı kapalı
                  └── postgres     → PostgreSQL 16, sadece iç ağ, dışarı kapalı
```

### 0.3 ⚠️ Önce okunması gereken 4 uyarı

Uygulamayı **internete açmaya** karar verdik. Bu, güvenlik çubuğunu ciddi şekilde yükseltiyor. Sunucunun mevcut durumunda 4 ciddi risk var:

1. **Windows Server 2012 R2'nin desteği 10 Ekim 2023'te bitti.** Rapordaki son güncellemeler (KB2977629, KB3003057 vb.) 2014–2017 seviyesinde; yani makine yıllardır güvenlik yaması almamış. Bu host **doğrudan internete açılmamalı.** Planımızda internete açılan tek şey Ubuntu VM'in 80/443 portları olacak, host'un kendisi olmayacak.
2. **SMB 1.0/CIFS kurulu** (`FS-SMB1` Installed). EternalBlue/WannaCry ailesinin giriş kapısı. Kaldırılmalı.
3. **Windows Firewall'un Private ve Public profilleri kapalı** (`Enabled: False`). Sadece Domain profili açık, ama makine WORKGROUP'ta — yani pratikte güvenlik duvarı devre dışı. Açılmalı.
4. **RDP (3389) açık.** Bu port kesinlikle internete yönlendirilmemeli.

> **Ayrıca dikkat:** Senin geliştirme yaptığın bilgisayar `192.168.1.x` ağında görünüyor (dev sunucusu `192.168.1.104` adresinden yayın yapıyor), sunucu ise `192.168.2.2` ağında. Bu iki alt ağ arasında yönlendirme var mı bilmiyoruz. "Yan bilgisayardan deneme" adımında bunu test etmemiz gerekecek — A7'de not düştüm.

### 0.4 Alınan kararlar

| Konu | Karar |
|---|---|
| Sanallaştırma | Hyper-V üzerinde Ubuntu Server 24.04 LTS (Gen2, Secure Boot kapalı) |
| Erişim | **İnternete açık** — alan adı + Let's Encrypt HTTPS. Yalnızca 80/443 yönlendirilecek |
| Düzeltme kapsamı | Tam: tüm güvenlik açıkları + veri kalıcılığı + eksik özellikler |
| Yerel test ortamı | **Docker Desktop** (projedeki `docker-compose.yml` ile PostgreSQL 16 — sunucudakinin aynısı) |
| Demo kullanıcılar | **Tamamen kaldırılacak.** Yalnızca tek yönetici hesabı kurulacak, diğer kullanıcılar arayüzden oluşturulacak |
| Stok transferleri | **Özellik gerçekten yazılacak** — depolar arası transfer kaydedilebilecek (Adım 8) |
| Katalog verileri | **Yazma API'leri eklenecek** — müşteri, tedarikçi, personel, fatura, yevmiye, bütçe arayüzden yönetilebilecek (Adım 9) |

### 0.5 Görev paylaşımı

**Ben yapacağım:** Bölüm B'deki 13 adımın tamamı — kod, migration, Docker, nginx, betikler, testler. Sen kod tarafında hiçbir şey yapmayacaksın.

**Sen yapacaksın:**
1. **Docker Desktop kurulumu** (tek seferlik, aşağıda). Bu olmadan yazdıklarımı test edemem.
2. Her adım sonunda "devam et" demek.
3. Kurulum aşamasında Bölüm A (Hyper-V, Ubuntu, alan adı, port yönlendirme).

#### Docker Desktop kurulumu (senin yapacağın tek teknik iş)

Şu an bilgisayarında ne Docker ne PostgreSQL var, 5432 portunda hiçbir şey dinlemiyor — bu yüzden uygulama yerelde hiç çalışmıyor (`Can't reach database server` hatası bundan).

1. <https://www.docker.com/products/docker-desktop/> adresinden **Docker Desktop for Windows**'u indir ve kur.
2. Kurulum WSL2 kurmayı önerirse kabul et. Gerekirse bilgisayarı yeniden başlat.
3. Docker Desktop'ı çalıştır, sol altta **"Engine running"** yazana kadar bekle.
4. Bana "Docker hazır" de — gerisini ben yapacağım (`npm run db:up` ile PostgreSQL'i ayağa kaldırıp migration ve seed'i çalıştıracağım).

> Docker kurulumu bitmeden de kod yazmaya başlayabilirim; sadece doğrulamaları Docker hazır olduğunda yapabilirim.

---

# BÖLÜM A — SENİN YAPACAKLARIN (Sunucu Tarafı)

Bu bölümdeki adımları sen yapacaksın. Her adımın sonunda **"✅ Kontrol"** satırı var; oradaki çıktıyı görüyorsan adım tamamdır.

## A1. Hazırlık ve yedek

1. Sunucuya RDP veya AnyDesk ile `Administrator` olarak bağlan.
2. Hyper-V Manager'ı aç: `Başlat → Yönetim Araçları → Hyper-V Manager`. Sol tarafta `HAMDARD` görünmeli.
3. Sunucuda başka çalışan sanal makine var mı bak. Varsa hangileri olduğunu bana söyle — RAM/CPU paylaşımını ona göre planlarız.
4. D: sürücüsünde sanal makine klasörünü oluştur:

```powershell
New-Item -ItemType Directory -Path "D:\HyperV\hamdpharma-app" -Force
New-Item -ItemType Directory -Path "D:\HyperV\ISO" -Force
```

**✅ Kontrol:** `D:\HyperV\hamdpharma-app` ve `D:\HyperV\ISO` klasörleri oluştu.

## A2. Ubuntu Server 24.04 LTS ISO'sunu indir

Sunucunun kendi tarayıcısı çok eski (Edge WebView2 109) olabilir, o yüzden PowerShell ile indir:

```powershell
$url = "https://releases.ubuntu.com/24.04/ubuntu-24.04.3-live-server-amd64.iso"
$out = "D:\HyperV\ISO\ubuntu-24.04-live-server-amd64.iso"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $out
```

> İndirme başarısız olursa (2012 R2'de TLS sorunları olabilir), ISO'yu kendi bilgisayarında indirip RDP üzerinden kopyala-yapıştır ile `D:\HyperV\ISO\` klasörüne taşı. Dosya ~3 GB.
>
> ISO adı değişmiş olabilir; güncel sürüm adı için <https://releases.ubuntu.com/24.04/> adresine bak.

**✅ Kontrol:** `Get-Item D:\HyperV\ISO\*.iso | Select Name, Length` komutu ~3 GB'lık bir dosya gösteriyor.

## A3. Hyper-V sanal ağ anahtarı (External Switch)

VM'in fabrika ağına doğrudan çıkabilmesi için **External** tipte bir switch gerekiyor. Fiziksel kart olarak `Onboard CNA Bağlantı Noktası 1` (192.168.2.2 olan, Up durumda) kullanılacak.

> ⚠️ Bu işlem yapıldığı anda ağ bağlantısı 5–15 saniye kesilir. RDP ile bağlıysan oturum düşebilir, sonra geri gelir. Panik yapma. Mümkünse **AnyDesk veya fiziksel konsoldan** yap.

Hyper-V Manager arayüzünden yapman daha güvenli:

1. Hyper-V Manager → sağ panelde **Virtual Switch Manager**.
2. **New virtual network switch** → **External** → **Create Virtual Switch**.
3. Name: `HamdPharma-External`
4. External network: `Emulex OneConnect OCe14000 10Gb Ethernet Bağdaştırıcısı` (birinci olan, Up durumda)
5. **"Allow management operating system to share this network adapter"** kutusu **işaretli kalsın** — yoksa sunucunun kendi ağ erişimi kesilir.
6. OK / Apply.

**✅ Kontrol:** `Get-VMSwitch` komutu `HamdPharma-External` / `External` satırını gösteriyor **ve** sunucunun internet erişimi hâlâ çalışıyor (`Test-NetConnection 8.8.8.8 -Port 53`).

## A4. Sanal makineyi oluştur

Windows Server 2012 R2'nin Hyper-V'si Generation 2 destekler, **ancak** Secure Boot şablonlarında "Microsoft UEFI Certificate Authority" seçeneği yoktur (o seçenek Server 2016'da geldi). Bu yüzden Gen2 VM'de **Secure Boot'u kapatmamız şart**, yoksa Ubuntu açılmaz.

```powershell
$vm = "hamdpharma-app"
$path = "D:\HyperV\hamdpharma-app"
$iso = (Get-Item D:\HyperV\ISO\*.iso).FullName

New-VM -Name $vm -Generation 2 -MemoryStartupBytes 12GB `
  -NewVHDPath "$path\$vm.vhdx" -NewVHDSizeBytes 300GB `
  -SwitchName "HamdPharma-External" -Path $path

# 2012 R2'de Linux için UEFI CA şablonu yok — Secure Boot kapatılmalı
Set-VMFirmware -VMName $vm -EnableSecureBoot Off

# 4 sanal işlemci (host'ta 16 mantıksal işlemci var, rahat)
Set-VMProcessor -VMName $vm -Count 4

# Sabit bellek: Linux + Docker + PostgreSQL için dinamik bellekten daha kararlı
Set-VMMemory -VMName $vm -DynamicMemoryEnabled $false -StartupBytes 12GB

# ISO'yu tak ve DVD'den önyüklemeye ayarla
Add-VMDvdDrive -VMName $vm -Path $iso
$dvd = Get-VMDvdDrive -VMName $vm
Set-VMFirmware -VMName $vm -FirstBootDevice $dvd

# Host yeniden başladığında VM otomatik açılsın, kapanırken düzgün kapansın
Set-VM -Name $vm -AutomaticStartAction Start -AutomaticStartDelay 60 `
  -AutomaticStopAction ShutDown -CheckpointType Disabled

Start-VM -Name $vm
```

Sonra Hyper-V Manager'da VM'e çift tıklayıp konsolu aç (**Connect**).

**✅ Kontrol:** `Get-VM hamdpharma-app` → State `Running`. Konsolda Ubuntu kurulum ekranı ("Language" seçimi) görünüyor.

> **Eğer Ubuntu açılmazsa** (siyah ekran / boot device not found): Gen2 yerine Gen1 dene. `Remove-VM -Name hamdpharma-app -Force` ile sil, yukarıdaki komutta `-Generation 2` yerine `-Generation 1` yaz, `Set-VMFirmware` satırlarını çıkar ve yerine `Set-VMBios -VMName $vm -StartupOrder @("CD","IDE","LegacyNetworkAdapter","Floppy")` kullan. Gen1 de sorunsuz çalışır, sadece disk arayüzü IDE olur.

## A5. Ubuntu Server 24.04 kurulumu

VM konsolunda kurulum sihirbazını takip et. Önemli olan ekranlar:

| Ekran | Seçim |
|---|---|
| Language | English (Türkçe seçme — sunucu hata mesajlarını aramak zorlaşır) |
| Installer update | "Continue without updating" |
| Keyboard | Turkish (istersen English) |
| Type of install | **Ubuntu Server** (Minimized değil — Docker sorunsuz çalışsın) |
| Network | **Aşağıdaki statik IP'yi elle gir** ↓ |
| Proxy | Boş bırak |
| Mirror | Varsayılan |
| Storage | "Use an entire disk" → LVM kutusunu **işaretle** → Continue → Confirm |
| Profile | Your name: `Hamdart` · Server name: `hamdpharma` · Username: `hamdart` · **güçlü bir şifre** |
| Ubuntu Pro | Skip for now |
| SSH | ☑ **Install OpenSSH server** (bu şart) |
| Featured snaps | Hiçbirini seçme (Docker'ı resmî depodan kuracağız) |

**Statik IP ayarı** (Network ekranında `eth0` üzerine gel → Edit IPv4 → Manual):

```
Subnet:   192.168.2.0/24
Address:  192.168.2.50
Gateway:  192.168.2.1
Name servers: 192.168.2.1, 1.1.1.1
Search domains: (boş)
```

> `192.168.2.50` adresinin ağda boş olduğunu doğrula. Sunucu üzerinde `ping 192.168.2.50` yanıt vermiyorsa boştur. Doluysa 192.168.2.51, .52 gibi başka bir adres seç ve **bana söyle** — yapılandırma dosyalarına o adresi yazacağım.

Kurulum bitince "Reboot Now" → ISO'yu çıkar:

```powershell
Get-VMDvdDrive -VMName hamdpharma-app | Set-VMDvdDrive -Path $null
```

**✅ Kontrol:** Windows sunucudan `ssh hamdart@192.168.2.50` ile bağlanabiliyorsun (2012 R2'de OpenSSH istemcisi olmayabilir — o zaman PuTTY indir veya VM konsolundan devam et).

## A6. Ubuntu temel sıkılaştırma

VM'e SSH ile bağlan ve şunları çalıştır:

```bash
# Sistem güncelleme
sudo apt update && sudo apt full-upgrade -y

# Saat dilimi (uygulama Türkiye saatiyle çalışacak)
sudo timedatectl set-timezone Europe/Istanbul

# Otomatik güvenlik yamaları
sudo apt install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades   # "Yes" seç

# Güvenlik duvarı — SSH sadece iç ağdan, HTTP/HTTPS herkese
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.2.0/24 to any port 22 proto tcp comment 'SSH ic ag'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable
sudo ufw status verbose

# SSH sıkılaştırma: şifreyle root girişi kapalı
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

sudo reboot
```

**✅ Kontrol:** Yeniden başladıktan sonra `sudo ufw status` → `Status: active` ve yukarıdaki 3 kural görünüyor. `timedatectl` → `Time zone: Europe/Istanbul`.

## A7. Ağ, alan adı ve port yönlendirme

Bunlar internete açmak için gerekli. Her birini yapıp sonucunu bana bildir:

1. **Alan adı:** Uygulamanın adresi ne olacak? (örn. `erp.hamdpharma.com`). Bir alan adın var mı, yoksa alman gerekiyor mu?
2. **Sabit IP:** İnternet servis sağlayıcından aldığın **sabit (statik) IP** var mı? Yoksa dinamik IP'de Let's Encrypt ve erişim sürekli kopar; bu durumda DDNS (No-IP, DuckDNS) kurmamız gerekir.
3. **DNS A kaydı:** Alan adının DNS panelinde `erp` → `<sunucunun genel IP'si>` şeklinde bir **A kaydı** oluştur.
4. **Router / modem port yönlendirme:** Modemin yönetim arayüzünde:
   - `TCP 80` → `192.168.2.50:80`
   - `TCP 443` → `192.168.2.50:443`
   - **`3389`'u (RDP) asla yönlendirme.** Başka hiçbir portu da açma.
5. **Alt ağ testi:** Senin bilgisayarın `192.168.1.x`, sunucu `192.168.2.x` ağında. Kendi bilgisayarından `ping 192.168.2.50` çalışıyor mu? Çalışmıyorsa iki ağ birbirini görmüyor demektir — testi ya sunucu üzerinden ya da yönlendirme kurarak yapacağız. Sonucu bana yaz.

**✅ Kontrol:** Bana şu 4 bilgiyi ver: **(a)** alan adı, **(b)** genel IP sabit mi, **(c)** VM'in iç IP'si, **(d)** `ping 192.168.2.50` sonucu.

## A8. Windows host sıkılaştırma (0.3'teki riskler)

VM çalıştıktan **sonra**, host'u da toparlayalım:

```powershell
# 1. Güvenlik duvarını tüm profillerde aç
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True

# 2. SMB1'i kaldır (yeniden başlatma gerektirir)
Remove-WindowsFeature FS-SMB1

# 3. RDP'yi sadece iç ağdan gelen bağlantılara izin verecek şekilde daralt
Get-NetFirewallRule -DisplayGroup "Uzak Masaüstü" |
  Set-NetFirewallRule -RemoteAddress 192.168.0.0/16

# 4. Kurulu güncellemeleri denetle (ESU olmadan çoğu gelmeyecek ama bakalım)
#    Sunucu Yöneticisi → Windows Update → Denetle
```

> **Uzun vadeli öneri:** Bu host'un işletim sistemi yıllardır yamasız. İnternete açık bir hizmeti bunun üzerinde çalıştırmak kalıcı bir çözüm değil. Orta vadede host'u Windows Server 2022'ye yükseltmeyi veya Ubuntu'yu doğrudan donanıma (bare metal) kurmayı planla. Bunu kurulum bittikten sonra ayrıca konuşuruz.

**✅ Kontrol:** `Get-NetFirewallProfile | Select Name, Enabled` → üçü de `True`. `Get-WindowsFeature FS-SMB1` → `Available` (kurulu değil).

## A9. Bana ne verecesin

Bölüm B'nin son adımlarını (kurulum) yapabilmem için:

- [ ] VM'in iç IP adresi (planlanan: `192.168.2.50`)
- [ ] SSH kullanıcı adı ve erişim yöntemi
- [ ] Alan adı (örn. `erp.hamdpharma.com`)
- [ ] Let's Encrypt bildirimleri için e-posta adresi
- [ ] Port yönlendirmenin yapıldığı onayı
- [ ] Projeyi sunucuya nasıl aktaralım: **git deposu** mu (özel repo açarız), yoksa **zip/scp** ile mi?

---

# BÖLÜM B — BENİM YAPACAKLARIM (Proje Tarafı)

## B0. Denetim özeti

Projeyi iki bağımsız denetimden geçirdim (API/güvenlik + veri katmanı/deploy) ve kendim de kritik dosyaları okudum. Toplam **26 bulgu** çıktı. Aşağıdaki tablolar, sonraki adımların gerekçesi.

### 🔴 Yayın engeli — bunlar düzelmeden internete açılamaz

| # | Sorun | Nerede | Neden kritik |
|---|---|---|---|
| 1 | **Seed betiği tüm veritabanını siliyor.** `main()` fonksiyonu 18 tablonun tamamında `deleteMany()` çalıştırıyor — kullanıcılar, denetim kayıtları, yedek kayıtları dahil. Kurulum betiği bunu **varsayılan olarak** çalıştırıyor | `prisma/seed.ts:16-37`<br>`deploy/install-ubuntu.sh:61-64` | Kurulum betiğini ikinci kez çalıştırmak (ki `.env` kontrolü yüzünden zararsız görünüyor) **tüm üretim verisini yok eder** |
| 2 | 7 demo kullanıcı sabit, tahmin edilebilir şifrelerle yazılıyor (`admin/admin123`, `mudur/mudur123`, …). Kurulum çıktısı şifreyi ekrana basıyor | `prisma/seed.ts:309-328`<br>`deploy/install-ubuntu.sh:76-77` | İnternete açık adreste bu hesaplar saniyeler içinde bulunur |
| 3 | **Şifre değiştirme ve kullanıcı yönetimi yok** — ne API ne arayüz. Admin paneli yalnızca denetim kaydı + yedekleme içeriyor | Eksik özellik | Yukarıdaki şifreleri değiştirmenin *hiçbir yolu yok* |
| 4 | **Kaba kuvvet koruması yok** — oran sınırlama, hesap kilitleme, başarısız deneme kaydı hiçbiri yok | `src/app/api/auth/login/route.ts:13-31` | Sınırsız şifre denemesi |
| 5 | **Kütle atama (mass assignment):** sunucu `id` ve `orderNo` üretiyor, sonra `...input` ile istemci gövdesini üzerine yayıyor | `src/lib/server/data-service.ts:191-196` | İstemci `id`, `orderNo`, `status` göndererek sunucu değerlerini ezebilir |
| 6 | Aynı sorun hammadde siparişi `PUT`'unda: istemci `status: "warehoused"` göndererek **kalite kontrol adımlarını atlayabilir** | `src/app/api/raw-material-orders/route.ts:33-40` | İlaç üretiminde QC bypass — düzenleyici açıdan da kabul edilemez |
| 7 | Aynı sorun reçete `PUT`'unda: istemci tüm `Recipe` nesnesini (`createdBy`, `createdAt`, `status`, `lines`) gönderip kaydı tamamen değiştirebilir | `src/app/api/recipes/route.ts:39-49` | Reçete geçmişi/sahipliği sahtelenebilir |
| 8 | **Oturumda rol ve hesap durumu yeniden doğrulanmıyor.** Yetki yalnızca JWT içeriğine güveniyor | `src/lib/auth/session.ts:28-41` | Bir kullanıcıyı işten çıkarıp pasife alsan bile **8 saat boyunca** eski yetkileriyle girmeye devam eder |
| 9 | **Güvenlik başlıkları yok** (HSTS, CSP, X-Frame-Options, Referrer-Policy) | `next.config.ts:3-6` | XSS ve clickjacking'e karşı savunma yok |
| 10 | Oturum çerezi üretimde `secure: true`, ama compose HTTP üzerinden 3000 portunu açıyor | `src/lib/auth/session.ts:56-65`<br>`docker-compose.prod.yml:35-36` | HTTPS olmadan **giriş hiç çalışmaz** (tarayıcı çerezi saklamaz). HTTPS planımızda var, bu yüzden çözülüyor |

### 🟠 Yüksek öncelik

| # | Sorun | Nerede |
|---|---|---|
| 11 | Next.js 16 `middleware` konvansiyonunu kullanımdan kaldırdı → `proxy`. Dev sunucusu her açılışta uyarı basıyor. **Tüm** kimlik doğrulama mantığı bu dosyada | `src/middleware.ts` |
| 12 | **Varsayılan izin ver (default-allow):** `getApiPermission` eşleşme bulamazsa `null` döner, middleware isteği geçirir. Sonradan eklenen her API otomatik korumasız | `src/lib/auth/permissions.ts:182-213` |
| 13 | Girdi doğrulaması hiç yok — `parseBody` sadece `as T` tip dönüşümü yapıyor, çalışma zamanında hiçbir şey doğrulanmıyor | `src/lib/server/api-utils.ts:44-46` + tüm route'lar |
| 14 | Sayısal alanlarda negatif / `NaN` / `Infinity` kontrolü yok (`quantity`, `unitCost`, `yield`, `qcScore`) | `data-service.ts:448-470, 638-658, 829-850` |
| 15 | Yedek geri yükleme tek POST ile tüm şemayı siliyor (`pg_restore --clean`), tek onay parametresi var | `src/lib/server/backup.ts:46-59` |
| 16 | Denetim kaydındaki "işlemi yapan kişi" HTTP başlığından okunabiliyor (`x-hamdart-actor`) — denetim izi taklit edilebilir | `src/lib/server/api-utils.ts:6-14` |
| 17 | Yedek endpoint'leri ham hata mesajını (`e.message`) döndürüyor — `pg_dump` stderr'i bağlantı/host detayı sızdırabilir | `src/app/api/backups/route.ts:24`<br>`backups/[id]/route.ts:23,37` |
| 18 | CSRF belirteci yok, koruma yalnızca `SameSite=Lax`. `POST /api/auth/logout` tamamen public | `src/lib/auth/session.ts:56-65` |
| 19 | Denetim kaydı `limit` parametresi sınırsız / `NaN` olabilir (`?limit=999999999`) | `src/app/api/audit/route.ts:6-10` |
| 20 | `/api/health` yok, `app` servisinde Docker healthcheck yok | Eksik |
| 21 | Nginx/HTTPS yok, yedekler yalnızca VM içindeki volume'de — otomatik ve dış kopya yok | `docker-compose.prod.yml:37-38` |
| 22 | Güncelleme akışında otomatik migration yok — `deploy:prod` şema değişikliğini uygulamıyor | `package.json:19` |
| 23 | **Depo arayüzü hâlâ statik JSON'a bağlı.** `fetchWarehouses()` tanımlı ama hiçbir sayfa kullanmıyor; sidebar, kapasite, doluluk oranları `warehouses.json`'dan geliyor | `src/data/warehouses.ts:68-91` |
| 24 | **Finansal alanlar `Float`** (`unitCost`, `totalPrice`, `salary`, `amount`). PostgreSQL `DOUBLE PRECISION` → para hesaplarında yuvarlama hatası | `prisma/schema.prisma:45,57-58,188,210,219-220,230` |

### 🟡 Orta / düşük

Prisma şemasında hiç ilişki ve foreign key yok (yetim kayıt riski) · tarihler `String` olarak saklanıyor · sık filtrelenen alanlarda indeks yok · bcrypt 10 tur (12 olmalı) · şifre uzunluk/karmaşıklık politikası yok · `binaryTargets` tanımsız (Alpine/musl kırılganlığı) · container'da `TZ` ayarı yok · Docker log rotasyonu ve kaynak limitleri yok · runner aşamasında root ile `npm install` · yedek dosya yolu `BACKUP_DIR` dışına çıkma kontrolü yok · `parseBody` gövde boyutu sınırsız · API yanıtlarında `Cache-Control: no-store` yok · `stockTransfers` hiç kalıcılaştırılmıyor (tablo hep boş) · başarısız girişler denetim kaydına yazılmıyor · `execFile` alt süreçlere tüm ortam değişkenlerini aktarıyor · `HEAD` endpoint'leri sıradaki reçete/parti numarasını sızdırıyor · personel maaş/IBAN düz metin.

### ✅ Zaten iyi durumda olanlar

Bunları değiştirmeyeceğim, denetimde temiz çıktılar:

- **SQL enjeksiyonu riski yok** — her yerde Prisma, hiç ham SQL (`$queryRaw`) yok.
- **Komut enjeksiyonu riski yok** — `backup.ts` `execFile` kullanıyor, `shell: true` yok, `DATABASE_URL` kullanıcı girdisinden gelmiyor.
- Oturum çerezi `httpOnly` + `sameSite`, `AUTH_SECRET` en az 32 karakter zorunlu.
- Giriş hataları tek tip mesaj döndürüyor — kullanıcı sayımı (enumeration) zorlaştırılmış.
- `passwordHash` hiçbir API yanıtında dönmüyor.
- Docker'da uygulama **root olmayan** kullanıcıyla çalışıyor; `output: "standalone"` yapısı doğru kurulmuş (`public` ve `.next/static` doğru kopyalanmış).
- PostgreSQL verisi kalıcı volume'de — **container yeniden başlatmada iş verisi kaybolmuyor.**
- Migration dosyaları şema ile uyumlu; `prisma/` klasörü imaja kopyalanıyor.
- TypeScript `strict: true`, build'de hata gizleyen ayar (`ignoreBuildErrors`) yok.
- `.env` `.gitignore`'da ve **git geçmişinde hiç commit edilmemiş** (kontrol ettim).

---

## Adım listesi

Öncelik sırasına göre dizildi. Sen "devam et" dedikçe sıradakini yapacağım; her adım sonunda ne değiştiğimi ve nasıl doğrulayacağını yazacağım.

### Adım 1 — Seed'i güvenli hâle getir *(engel #1)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `prisma/seed.ts`: baştaki 18 satırlık `deleteMany()` bloğu kaldırıldı. Tüm yüklemeler `createMany({ skipDuplicates: true })` ile **eklemeli** hâle getirildi — eksik kayıtları ekler, mevcutlara dokunmaz. Kullanıcı oluşturma da "varsa atla" mantığına çevrildi, mevcut şifreler ezilmiyor. Her tabloda kaç kayıt eklendiğini/atlandığını raporluyor.
> - `prisma/reset.ts` (yeni): yıkıcı sıfırlama buraya taşındı. `--confirm` bayrağı olmadan çalışmayı reddediyor, `NODE_ENV=production` ise tamamen reddediyor (`ALLOW_PROD_RESET=yes` ile açıkça geçersiz kılınabilir), üretimde 5 saniye iptal penceresi veriyor. Silmeden önce kaç kayıt gideceğini gösteriyor.
> - `package.json`: `db:reset` komutu eklendi.
> - `deploy/install-ubuntu.sh`: seed artık yalnızca **veritabanı boşsa** çalışıyor. Doluysa atlıyor ve manuel komutu yazdırıyor.
>
> **Neden `upsert` değil `skipDuplicates`:** Plan `upsert` diyordu ama düşününce daha güvenli olanı seçtim. `upsert`, arayüzden yapılmış düzenlemeleri JSON'daki eski değerlerle **geri alırdı** (örneğin bir müşterinin telefonunu güncellersen, seed tekrar çalışınca eski hâline dönerdi). `skipDuplicates` mevcut kayda hiç dokunmuyor. Ayrıca 4000 kayıt için tek tek upsert'ten çok daha hızlı.
>
> **Yol üstünde bulunan ekstra hata:** `prisma/migrations/` içinde `20260904202029_init` adında **boş bir klasör** vardı — içinde `migration.sql` yok, yarıda kalmış bir `prisma migrate dev` kalıntısı. Bu, `prisma migrate deploy`'u `P3015` hatasıyla tamamen kilitliyordu. Yani **sunucu kurulumu migration adımında patlayacaktı.** Klasörü sildim; iki gerçek migration yerinde.
>
> **Doğrulama (yapıldı):**
> - `prisma migrate deploy` → iki migration sorunsuz uygulandı
> - Seed 1. çalıştırma → 3.999 kayıt eklendi, 7 kullanıcı oluşturuldu
> - Araya elle bir müşteri + bir denetim kaydı eklendi (kullanıcının arayüzden girdiği veriyi taklit etmek için)
> - Seed 2. çalıştırma → **0 kayıt eklendi, hepsi atlandı, hata yok**
> - Elle eklenen iki kayıt **hayatta**, tablo sayıları değişmedi (490 müşteri = 489 seed + 1 elle)
> - `db:reset` `--confirm` olmadan reddetti; `NODE_ENV=production` ile reddetti; veri yerinde kaldı
> - `npx tsc --noEmit` → hata yok · `npm run lint` → 0 hata · `bash -n install-ubuntu.sh` → sözdizimi tamam
>
> **Not:** Seed artık silinmiş bir referans kaydını (örneğin arayüzden sildiğin bir tedarikçiyi) tekrar çalıştırıldığında geri ekler. Veri kaybı değil, sadece bunu bilmen için yazıyorum.

### Adım 2 — Kimlik ve hesap yönetimi *(engel #2, #3 + bcrypt/şifre politikası)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Kararlar (senin seçimlerin):** kullanıcı adı `admin` · ilk şifre `.env` içindeki `ADMIN_INITIAL_PASSWORD`'dan (rastgele üretim yok) · geliştirme test hesapları ayrı komutta.
>
> **Yapılanlar:**
>
> *Şifre politikası*
> - `src/lib/auth/password-rules.ts` (yeni): en az 12 karakter, küçük+büyük harf ve rakam zorunlu, 72 bayt üst sınırı (bcrypt'in sessiz kırpma sınırı), baştaki/sondaki boşluk reddi, tek karakter tekrarı reddi, yaygın şifre listesi, **şifre kullanıcı adını veya ad/soyadı içeremez**. Türkçe karakterler büyük/küçük harf kontrolüne dahil. Bu dosya bilinçli olarak Node'a özgü bağımlılık içermiyor; hem sunucu hem arayüz aynı kuralları kullanıyor.
> - `src/lib/auth/password.ts`: bcrypt **10 → 12 tur**. `hashPassword` politikayı kendi içinde de doğruluyor — bir çağrı yerinde kontrol atlanırsa hash aşamasında yine hata veriyor. Şifre sıfırlama için `generatePassword` eklendi (`node:crypto` `randomInt`, her karakter sınıfından en az bir tane, Fisher-Yates karıştırma).
>
> *Zorunlu şifre değiştirme*
> - `User` tablosuna `mustChangePassword` ve `passwordChangedAt` alanları + migration (`20260907185055_add_must_change_password`).
> - Bayrak JWT oturumuna taşındı; `middleware.ts` bu bayrak `true` iken **her sayfayı** `/change-password`'e yönlendiriyor, **her API'yi** `403` ile reddediyor. Yalnızca `/change-password`, `/api/auth/change-password`, `/api/auth/logout`, `/api/auth/me` açık.
> - `POST /api/auth/change-password`: mevcut şifre doğrulaması, politika kontrolü, "yeni şifre eskisiyle aynı olamaz", başarıda **oturum token'ı yenileniyor** (bayrak token içinde olduğu için şart), denetim kaydı. Başarısız denemeler de denetim kaydına yazılıyor.
> - `/change-password` ekranı: sunucu bileşeni oturumu okuyup `forced` bilgisini veriyor, form istemci bileşeni. Anlık şifre kuralı geri bildirimi ve şifre tekrarı kontrolü var.
> - Navbar hesap menüsüne "Şifre Değiştir" eklendi — kullanıcılar zorunlu olmadan da değiştirebiliyor.
>
> *Kullanıcı yönetimi*
> - `src/lib/server/users.ts` (yeni) + `/api/users` (GET, POST) ve `/api/users/[id]` (PATCH, DELETE), tümü `admin` yetkisine bağlı.
> - Kullanıcı adı normalizasyonu (küçük harf, 3-32 karakter, yalnızca `a-z0-9._-`), ad soyad ve rol beyaz listesi doğrulaması. `passwordHash` hiçbir yanıtta dönmüyor (`select` ile alan bazlı seçim).
> - Yöneticinin belirlediği/sıfırladığı şifre için `mustChangePassword` otomatik `true` — yönetici kimsenin şifresini bilmiş olarak kalmıyor.
> - Admin panelinde **"Kullanıcılar" sekmesi**: kullanıcı ekle, rol değiştir, hesap aç/kapat, şifre sıfırla, sil. Tüm işlemler denetim kaydına yazılıyor.
>
> *Kendini kilitleme korumaları*
> - Kendi rolünü değiştirme, kendi hesabını kapatma ve kendi hesabını silme engellendi.
> - **Son aktif yönetici** rolü değiştirilemez, kapatılamaz, silinemez — sistem yöneticisiz kalamaz.
>
> *Kurulum tarafı*
> - Seed'deki 7 demo hesap (`admin/admin123` vb.) **tamamen kaldırıldı**; yalnızca `admin` oluşuyor ve `mustChangePassword=true` ile geliyor. `ADMIN_INITIAL_PASSWORD` tanımsız veya politikaya uymuyorsa seed **hesap oluşturmadan** açıklayıcı hatayla duruyor.
> - `prisma/seed-dev.ts` + `npm run db:seed:dev` (yeni): `dev-` ön ekli rol test hesapları, yalnızca geliştirmede; `NODE_ENV=production` ise reddediyor.
> - `install-ubuntu.sh`: `.env` ilk oluşturulduğunda betik **durup** senden `ADMIN_INITIAL_PASSWORD` belirlemeni istiyor; değer placeholder olarak kalmışsa kurulumu başlatmıyor. Kurulum çıktısındaki `admin / admin123` satırı kaldırıldı.
> - `docker-compose.prod.yml`: `ADMIN_INITIAL_PASSWORD` app servisine geçiriliyor.
>
> *Yol üstünde eklenen*
> - `requireSession(req, permission)` yardımcısı (`api-utils.ts`): route seviyesinde **ikinci savunma hattı**. Bir yol eşleştirme hatası middleware'i atlatsa bile route kendini koruyor. Adım 6 bunun üzerine kuracak.
> - `getSessionFromCookies()` (`session.ts`): sunucu bileşenlerinin oturumu okuyabilmesi için.
>
> **Doğrulama (yapıldı):** `scripts/test-auth-flow.mjs` ile **40 senaryo, tamamı geçti.** Oturumsuz erişim engeli, yanlış şifre reddi, `mustChangePassword` zorlaması (sayfa yönlendirmesi + API 403), şifre değiştirme doğrulamaları (yanlış mevcut şifre / zayıf / aynı / kullanıcı adı içeren), geçerli değişiklik sonrası erişimin açılması, kullanıcı oluşturma doğrulamaları, kopya kullanıcı adı reddi, `passwordHash` sızmadığının kontrolü, WAREHOUSE rolünün `/api/users` ve `/api/audit`'ten `403` alması, üç kendini kilitleme koruması, son yönetici koruması. `scripts/test-pages.mjs` ile sayfaların oturumlu render'ı doğrulandı. Seed'in dört hata dalı ayrı ayrı test edildi — hiçbirinde zayıf şifreli hesap oluşmadı. Denetim kayıtları veritabanından teyit edildi (başarısız şifre değiştirme denemesi dahil). `tsc --noEmit` hatasız, `npm run lint` 0 hata, `bash -n install-ubuntu.sh` temiz.
>
> **Yol üstünde düzeltilen kusur:** `/change-password` başlangıçta tamamen istemci bileşeniydi ve başlığı `useAuth()`'tan alıyordu. Oturum istemcide sonradan yüklendiği için sunucu render'ında yanlış başlık ("Şifre Değiştir") çıkıp hidrasyondan sonra doğrusuna ("Şifrenizi Belirleyin") dönüyordu — gözle görülür bir yanıp sönme. Sayfayı sunucu bileşenine çevirip oturumu çerezden okuyarak giderdim.
>
> **Bilinçli olarak Adım 3'e bırakılanlar:** kaba kuvvet koruması (oran sınırlama, hesap kilitleme) ve oturumda rol/aktiflik yeniden doğrulaması. Yani **şu an pasife alınan bir kullanıcı, oturumu dolana kadar (8 saat) girmeye devam edebilir.** Bu, Adım 3'ün ilk maddesi.
>
> **Yerelde denemek için** (`npm run dev` → http://localhost:3000):
>
> | Kullanıcı | Şifre | Ne için |
> |---|---|---|
> | `admin` | `.env`'deki `ADMIN_INITIAL_PASSWORD` (şu an `YerelGelistirme1`) | Gerçek akış — giriş yapınca **şifre değiştirme ekranı zorunlu açılır** |
> | `dev-mudur`, `dev-uretim`, `dev-depo`, `dev-lab`, `dev-ticari`, `dev-izleyici`, `dev-admin` | `GelistirmeTest1` | Rol yetkilerini denemek (şifre değiştirme zorunluluğu yok) |
>
> Bu `dev-` hesapları yalnızca `npm run db:seed:dev` ile oluşur ve üretimde çalışmayı reddeder. Yerel veritabanını baştan kurmak için: `npm run db:reset -- --confirm` sonra `npm run db:seed`.

### Adım 3 — Kaba kuvvet koruması ve oturum sertliği *(engel #4, #8 + #18, #19)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
>
> *Kaba kuvvet*
> - `src/lib/auth/login-guard.ts` (yeni): giriş tek kapıdan geçiyor. IP+kullanıcı 15 dakikada 10 deneme, IP başına 15 dakikada 40 deneme; aşımda `429` + `Retry-After`. Hesap kilidi: 5 başarısız denemede 15 dakika (`failedAttempts`, `lockedUntil`). Kilitliyken doğru şifre de reddedilir. Sayacı yalnızca başarısız denemeler artırır; başarılı giriş sıfırlar. Kilit süresi dolunca sayaç sıfırlanır.
> - Kullanıcı yoksa da bcrypt çalışır (`dummyVerifyPassword`) — yanıt süresinden hesap varlığı anlaşılmasın diye. Aynı "Geçersiz kullanıcı adı veya şifre" mesajı.
> - Başarılı/başarısız/kilitli/oran sınırlı girişler IP ile denetim kaydına yazılıyor; şifre asla loglanmıyor.
>
> *Oturum iptali (#8)*
> - `User.tokenVersion` eklendi. Şifre değişimi, şifre sıfırlama, rol değişimi ve hesap aç/kapa `tokenVersion`'ı artırır; eski JWT hemen geçersiz olur.
> - `src/lib/auth/live-session.ts`: Node tarafında JWT'yi veritabanıyla doğrular (aktiflik, rol, `mustChangePassword`, `tokenVersion`). 3 saniyelik bellek önbelleği; version artınca önbellek düşer.
> - `requireSession`, `/api/auth/me`, şifre değiştirme, kullanıcı API'leri ve dashboard yerleşimi bu canlı oturumu kullanıyor. Pasife alınan kullanıcı `/me`'de 401 alır, çerez temizlenir; panel sayfaları `login`'e yönlenir.
> - Middleware Edge'de Prisma çalıştıramadığı için sayfa yönlendirmesinde hâlâ JWT'ye bakar. Bu yüzden `/login`'e JWT ile geleni dashboard'a fırlatmayı **kaldırdım** — aksi halde iptal oturum `/login` ↔ `/dashboard` döngüsüne giriyordu. İstemci `/api/auth/me` ile karar veriyor.
>
> *CSRF (#18)*
> - Double-submit: `hamdart-csrf` çerezi (httpOnly değil, SameSite=Lax) + `x-csrf-token` başlığı. Middleware tüm `/api/*` POST/PUT/PATCH/DELETE isteklerinde eşleşme ister; yoksa `403`.
> - `logout` artık oturum zorunlu (önceden herkese açıktı).
> - `api-client`, giriş, çıkış ve şifre değiştirme formları başlığı otomatik ekliyor.
>
> *Denetim limiti (#19)*
> - `limit` 1..500 aralığına sıkıştırılıyor; `NaN`/devasa değerler 100'e (veya tavana) çekiliyor. `/api/audit` ayrıca `requireSession(admin:read)` ile korunuyor.
>
> **Doğrulama:** `scripts/test-auth-flow.mjs` **41/41**. `scripts/test-step3.mjs` **18/18** (CSRF yok/yanlış → 403, oturumsuz logout → 401, 5 denemede kilit + kilitliyken doğru şifre 429, olmayan kullanıcı 401, hesap kapatılınca eski oturum 401, audit limit tavanı). `tsc --noEmit` temiz, lint 0 hata.
>
> **Adım 6 ile kapandı:** Her route canlı oturum doğruluyor; iptal/pasif hesap API'de de hemen kesiliyor.

### Adım 4 — Kütle atama açıklarını kapat *(engel #5, #6, #7)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `dbCreateOrder`: `...input` yayıldı. `id` ve `orderNo` yalnızca sunucuda üretiliyor; `recipeNo` istemciden alınmıyor. Durum/öncelik enum, miktar > 0, tutar ≥ 0, tarihler `YYYY-MM-DD`.
> - Hammadde siparişi `PUT`: `dbPatchRawMaterialOrder` — yalnızca tedarikçi, miktar, birim fiyat, birim, teslim tarihi, not, hedef depo. `status` / `warehousedAt` / `qcCompletedAt` yok sayılıyor; `totalPrice` sunucuda `miktar × fiyat`. `received` ve sonrası durumlar PUT ile hiç düzenlenemez (QC atlama kapalı). Durum değişikliği yalnızca `/actions` durum makinesinden.
> - Reçete `PUT`: `dbUpdateRecipe` — mevcut kaydı günceller, yoksa 400 (upsert ile sahte kayıt yok). `createdBy`, `createdAt`, `orderId`, `id`, `code` korunuyor. Yeni reçetede `createdBy` her zaman oturumdaki aktör.
> - Üretim hattı `PATCH`: yalnızca `product`, `status`, `operator`, `currentBatch`, `outputToday`, `targetToday`, `efficiency`, `lastMaintenance`. `name`/`code` dokunulmaz. `efficiency` 0–100, sayılar sonlu ve negatif değil.
> - Ortak okuyucular: `src/lib/server/fields.ts` (`FieldError`, enum, sonlu sayı, ISO tarih). Route katmanı Zod (Adım 5).
>
> **Doğrulama:** `scripts/test-step4.mjs` **27/27**. Sahte `id`/`orderNo` yok sayıldı, `status: warehoused` PUT'ta kalmadı, reçete sahipliği ezilmedi, `efficiency: 250` reddedildi, hat adı değişmedi. `tsc --noEmit` temiz.

### Adım 5 — Girdi doğrulama katmanı *(yüksek #13, #14)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Durum:** Kod tarafı bitti. `zod` 4.x, `parseBody(req, schema)` 1 MB tavan + alan bazlı `400`.
>
> **Yapılanlar:**
> - `parseBody` artık şemasız `as T` değil: gövdeyi 1 MB ile sınırlar (`413`), JSON sözdizimini ayırır, Zod `safeParse` ile doğrular. Hata yanıtı `{ error, fields }`.
> - Tüm yazma uçları şemaya bağlı: giriş, şifre değiştirme, kullanıcı, sipariş, reçete, hammadde, hammadde siparişi (+ `action` enum), üretim hattı/parti, stok, laboratuvar, yedek.
> - Sayılar `finite` + alt/üst sınır; negatif/NaN/Infinity ve uydurma enum reddedilir. Reçete satırı en fazla 200.
> - Servis katmanındaki `FieldError` okuyucuları ikinci hat olarak duruyor.
>
> **Doğrulama:** `scripts/test-step5.mjs` **35/35**. `scripts/test-step4.mjs` **27/27** gerileme yok. `tsc --noEmit` temiz.

### Adım 6 — Katmanlı yetkilendirme *(yüksek #11, #12, #16, #17)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `src/middleware.ts` silindi; `src/proxy.ts` + `export async function proxy` (Next.js 16). CSRF, oturum ve sayfa yetkisi aynı.
> - `getApiPermission` artık `skip` / `require` / `deny` döner. Eşleşmeyen `/api/*` ve bilinmeyen katalog varlıkları **403**. `/api/auth/*` `skip`.
> - Her yazma/okuma route'unun başında `requireSession` (canlı DB oturumu). İptal/pasif hesap JWT ile sipariş/stok API'sine giremiyor.
> - Denetim aktörü yalnızca oturumdaki ad; `x-hamdart-actor` / `x-actor-name` yok sayılıyor.
> - Altyapı hataları `console.error` + `formatApiError`; API yanıtlarına `Cache-Control: no-store, private`.
>
> **Doğrulama:** `scripts/test-step6.mjs` **20/20**. Adım 4 **27/27**, Adım 5 **35/35**. `tsc --noEmit` temiz.

### Adım 7 — Güvenlik başlıkları *(engel #9)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `next.config.ts`: `poweredByHeader: false` + tüm yollara `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (kamera/mikrofon/konum kapalı), `X-Accel-Buffering: no`. Üretimde HSTS (`max-age=31536000; includeSubDomains`).
> - Proxy her istekte nonce üretir; `Content-Security-Policy` `script-src` içinde `'nonce-…' 'strict-dynamic'`. Geliştirmede React için `'unsafe-eval'` ve HMR için `ws:`/`wss:`. `style-src` Radix/Recharts için `'unsafe-inline'` (script nonce'su korunur).
> - Kök layout `force-dynamic` + `connection()` — Next.js nonce'u script etiketlerine basabilsin.
>
> **Doğrulama:** `scripts/test-step7.mjs` **19/19**. Giriş + şifre değiştirme sayfası 200, HTML'de script nonce var. `tsc --noEmit` temiz.

### Adım 8 — Veri modeli doğruluğu *(yüksek #23, #24 + ilişkiler/indeksler)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - Depo arayüzü `/api/catalog/warehouses`'a bağlandı. `used` / `items` gerçek stok toplamı ve kalem sayısından hesaplanıyor; JSON'daki statik doluluk kullanılmıyor.
> - Finansal alanlar `Decimal(18,4)`: sipariş tutarı, hammadde maliyeti, RMO fiyatları, maaş, fatura, yevmiye, bütçe. API yanıtlarında sayıya çevriliyor.
> - FK: stok→depo Restrict, ikmal deposu SetNull, RMO hedef depo Restrict, fatura satırı→fatura Restrict, aktarım kaynak/hedef Restrict.
> - İndeks: `Order.status/orderDate`, `WarehouseStockItem.warehouseId/status/sku+warehouseId`, `RawMaterialOrder.status/sku/targetWarehouseId`, `InvoiceLine.invoiceNo`, `AuditLog`.
> - `StockTransfer` modeli + `GET/POST /api/stock/transfers`. Aktarım tek transaction: kaynak↓, hedef↑ (aynı SKU+lot birleşir), `completed`, denetim kaydı. Depo listesi ve detayda "Stok Aktar" formu.
> - İlk render mock'ları boş dizi (`orders`, hat, parti, stok, reçete, hammadde). JSON yalnızca `prisma/seed.ts` ile yükleniyor.
>
> **Doğrulama:** `scripts/test-step8.mjs` **26/26**. `tsc --noEmit` temiz.

### Adım 9 — Katalog yazma API'leri *(karar: eklenecek)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - Yazılabilir varlıklar: **müşteri, tedarikçi, personel, fatura (+kalem), yevmiye, bütçe**. `POST /api/catalog/[entity]`, `PATCH/DELETE /api/catalog/[entity]/[id]`. Ürün, depo ve fatura-kalemleri ayrı yazılamaz (404).
> - Her varlık için Zod şeması. Yazmalar denetim kaydına düşüyor.
> - Müşteri/tedarikçide `active`. Faturası veya siparişi olan müşteri / bağlı RMO'su olan tedarikçi silinmez, **pasife alınır**. Fatura satırları Cascade; RMO'ya bağlı fatura 409.
> - Personel maaş/IBAN yalnızca `personnel:write` (yönetici/müdür) yanıtında dolu; izleyici `null` görür, sütunlar gizlenir.
> - İlgili altı sayfada ekle/düzenle/sil formları (`form-sheet`).
>
> **Doğrulama:** `scripts/test-step9.mjs` **21/21**. `tsc --noEmit` temiz.

### Adım 10 — Sağlık kontrolü, izlenebilirlik, saat dilimi *(yüksek #20)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `GET /api/health`: oturumsuz, DB `SELECT 1`, yanıt yalnızca `{ ok: true|false }`. Proxy public + `getApiPermission` skip.
> - `docker-compose.prod.yml`: app healthcheck (`/api/health`); sağlıksız app'i `willfarrell/autoheal` yeniden başlatır. Log `10m` × 5. `TZ`/`PGTZ=Europe/Istanbul`.
> - Limitler (12 GB VM): postgres 6 GB / 2 CPU (`shared_buffers=1536MB`, `effective_cache_size=4GB`, `max_connections=50`); app 2 GB / 2 CPU.
> - Takvim: saklama `YYYY-MM-DD` (Istanbul günü); ekran `dd-mm-yyyy`. `timestamptz` UTC saklanır, gösterimde Istanbul. `todayIso` / `plusDaysIso` kuşağa bağlı.
>
> **Doğrulama:** `scripts/test-step10.mjs` **17/17**. `tsc --noEmit` temiz.

### Adım 11 — Yedekleme ve kurtarma *(yüksek #15, #21)*

> ### ✅ TAMAMLANDI — 7 Eylül 2026
>
> **Yapılanlar:**
> - `BACKUP_DIR` dışına çıkılamaz; dosya işlemleri DB'deki `filepath`'e değil ada göre çözülür. `..`, eğik çizgi, yabancı uzantı reddedilir.
> - `pg_dump` / `pg_restore` yalnızca `PG*` + `PATH`/`TZ` alır (`AUTH_SECRET` yok). Hata metninden bağlantı dizisi silinir.
> - Geri yükleme: gövdede `confirmFilename` dosya adıyla birebir eşleşmeli. Önce otomatik güvenlik yedeği, sonra `pg_restore`.
> - Günlük `deploy/backup-daily.sh` + `hamdart-backup.timer` (03:00 İstanbul). Saklama: 14 gün günlük, ayın 1'i 365 gün. Dış kopya `BACKUP_OFFSITE_DIR` (Windows `D:\HamdPharma-Backups`) veya `deploy/windows/Copy-HamdartBackups.ps1`.
> - `deploy/KURTARMA.md`: yanlış silme, bozuk DB, VM kaybı, yanlış dump.
>
> **Doğrulama:** `scripts/test-step11.mjs`. `tsc --noEmit` temiz.

### Adım 12 — Docker ve derleme sıkılaştırma

> ### ✅ TAMAMLANDI — 8 Eylül 2026
>
> **Yapılanlar:**
> - Prisma `binaryTargets`: `native` + `debian-openssl-3.0.x`. Temel imaj `node:20-bookworm-slim` (OpenSSL 3).
> - `tools` aşaması: prisma/tsx/bcryptjs ayrı kuruluyor. Runner'da root `npm install` yok; süreç `nextjs` kullanıcısı.
> - `docker-entrypoint.sh`: her açılışta `prisma migrate deploy`. `SKIP_MIGRATE=1` ile atlanır. `deploy:prod` / `up --build` şema değişikliğini unutmaz.
> - `package.json#prisma` → `prisma.config.ts` (seed + şema yolu). CLI artık o uyarıyı basmıyor.
> - `.env.example` ve `deploy/env.example` tüm değişkenlerle güncellendi.
> - Üretim imajı yerelde derlendi; `migrate deploy` + `GET /api/health` → `{ ok: true }`.
>
> **Doğrulama:** `scripts/test-step12.mjs`. `tsc --noEmit` temiz. `docker compose -f docker-compose.prod.yml build app` başarılı.

### Adım 13 — Nginx + HTTPS ve sunucuya kurulum *(engel #10, yüksek #21)*

> ### ✅ KOD TAMAMLANDI — 8 Eylül 2026
>
> **Yapılanlar:**
> - `nginx` 80/443; `app` yalnızca iç ağda 3000. Postgres hâlâ dışarı kapalı.
> - HTTP→HTTPS, ACME, `X-Real-IP` / `X-Forwarded-*` = `$remote_addr` (sahte zincir yok), gövde 1 MB, yavaş bağlantı timeout, `proxy_buffering off`, `/api/auth/login` 5 r/dk.
> - Let's Encrypt: `deploy/init-certs.sh` + certbot 12 saatte `renew` + her gece 04:15 nginx reload.
> - `install-ubuntu.sh` DOMAIN + CERTBOT_EMAIL ister, önce HTTP+ACME, sonra sertifika.
> - Üretim çerezi `Secure` (geçici HTTP: `AUTH_COOKIE_SECURE=0`).
> - Kontrol listesi: `deploy/YAYIN-KONTROL.md` — sunucu ve DNS hazır olunca birlikte işaretleriz.
>
> **Doğrulama:** `scripts/test-step13.mjs`. `tsc --noEmit` temiz.
>
> **Sunucuda birlikte (deploy/YAYIN-KONTROL.md):** HTTPS, oturumsuz erişim, şifre/kilit, pasif hesap, kütle atama, QC, roller, yedek, yeniden başlatma, başlıklar, kapalı 5432/3000.

---

## Şimdi ne yapmalıyız?

**Sen:** Bölüm A (Hyper-V VM, DNS A kaydı, 80/443 yönlendirme). Bitince alan adı, e-posta ve VM erişimini yaz; kurulumu birlikte çalıştırırız.

**Ben:** Proje tarafındaki 13 adım bitti. Sunucu bilgisi gelince `install-ubuntu.sh` + `deploy/YAYIN-KONTROL.md`.

### Adımların gruplanışı

| Grup | Adımlar | İçerik |
|---|---|---|
| **Güvenlik çekirdeği** | 1–7 | En kritik kısım. Yayın engellerinin tamamı burada kapanıyor |
| **Veri ve özellik tamamlama** | 8–9 | Şema düzeltmeleri, stok transferi, katalog yazma. Şema değişikliği içerdiği için kurulumdan önce bitmeli |
| **Kurulum altyapısı** | 10–13 | Sağlık kontrolü, yedekleme, Docker, nginx + HTTPS |

Deneme kurulumunu Adım 13'ten sonra yapmamız en sağlıklısı. Ama sadece "sanal makine ayağa kalkıyor mu" denemesi yapmak istersen Bölüm A'yı herhangi bir zamanda paralel yürütebilirsin.
