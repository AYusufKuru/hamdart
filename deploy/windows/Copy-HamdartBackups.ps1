# HamdPharma — Ubuntu VM yedeklerini Windows host D: sürücüsüne çeker.
# Görev Zamanlayıcı: her gün 03:30, bu betiği çalıştır.
#
# Kullanım (yönetici PowerShell):
#   powershell -File Copy-HamdartBackups.ps1
#   powershell -File Copy-HamdartBackups.ps1 -Source "\\192.168.2.50\hamdart-backups"
#
# Önkoşul (birini seçin):
#   A) Ubuntu'da samba paylaşımı (önerilen pull): \\192.168.2.50\hamdart-backups
#   B) Windows'ta D:\HamdPharma-Backups paylaşımı + Ubuntu CIFS mount
#      (o durumda bu betiğe gerek yok; daily script zaten D:'ye yazar)

param(
  [string]$Source = $(if ($env:HAMDART_BACKUP_SOURCE) { $env:HAMDART_BACKUP_SOURCE } else { "\\192.168.2.50\hamdart-backups" }),
  [string]$Destination = $(if ($env:HAMDART_BACKUP_DEST) { $env:HAMDART_BACKUP_DEST } else { "D:\HamdPharma-Backups" }),
  [int]$KeepDays = 14,
  [int]$KeepMonthlyDays = 365
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Destination)) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Kaynak erişilemiyor: $Source  (VM açık mı, paylaşım var mı?)"
}

Write-Host "==> $Source -> $Destination"
Copy-Item -Path (Join-Path $Source "hamdart-*.dump") -Destination $Destination -Force -ErrorAction SilentlyContinue

$now = Get-Date
Get-ChildItem -LiteralPath $Destination -Filter "hamdart-*.dump" -File | ForEach-Object {
  $age = ($now - $_.LastWriteTime).TotalDays
  $isMonthly = $_.Name -match '^hamdart-\d{4}-\d{2}-01_'
  $limit = if ($isMonthly) { $KeepMonthlyDays } else { $KeepDays }
  if ($age -gt $limit) {
    Write-Host "    siliniyor ($([int]$age)g): $($_.Name)"
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

Write-Host "==> Tamam"
