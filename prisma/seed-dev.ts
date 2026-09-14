/**
 * YALNIZCA GELİŞTİRME — her rol için test hesabı oluşturur.
 *
 * Kullanım: npm run db:seed:dev
 *
 * Üretimde çalışmayı reddeder. Bu hesaplar zayıf şifreler kullanır ve
 * sunucuya asla kurulmaz; rol yetkilerini yerelde denemek içindir.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LEGACY_ROLE_MAP } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/** Şifreler bilinçli olarak basit — sadece yerel geliştirme içindir */
const DEV_USERS = [
  { username: "dev-mudur", name: "Test Müdür", role: "MANAGER" },
  { username: "dev-stok", name: "Test Stok", role: "STOCK" },
  { username: "dev-muhasebe", name: "Test Muhasebe", role: "ACCOUNTING" },
  { username: "dev-uretim", name: "Test Üretim", role: "PRODUCTION" },
  { username: "dev-satis", name: "Test Satış Pazarlama", role: "SALES" },
  { username: "dev-ik", name: "Test İK", role: "HR" },
  { username: "dev-admin", name: "Test Yönetici", role: "ADMIN" },
] as const;

const DEV_PASSWORD = "GelistirmeTest1";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "REDDEDİLDİ: Bu betik yalnızca geliştirme ortamında çalışır.\n" +
        "Test hesapları üretim sunucusunda oluşturulamaz."
    );
    process.exit(1);
  }

  console.log("Geliştirme test hesapları oluşturuluyor...\n");

  const legacy = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
  });
  for (const user of legacy) {
    let next = LEGACY_ROLE_MAP[user.role];
    if (user.username === "admin" && user.role === "ADMIN") {
      next = "SYSTEM_ADMIN";
    }
    if (!next || next === user.role) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { role: next, tokenVersion: { increment: 1 } },
    });
    console.log(`  ${user.username}: ${user.role} → ${next}`);
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_ROUNDS);

  for (const u of DEV_USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: u.username },
    });
    if (existing) {
      if (existing.role !== u.role) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: u.role, tokenVersion: { increment: 1 } },
        });
        console.log(`  ${u.username}: rol ${existing.role} → ${u.role}`);
      } else {
        console.log(`  ${u.username}: zaten mevcut, atlandı`);
      }
      continue;
    }
    await prisma.user.create({
      data: {
        username: u.username,
        name: u.name,
        passwordHash,
        role: u.role,
        // Test hesaplarında şifre değiştirme zorunluluğu yok
        mustChangePassword: false,
      },
    });
    console.log(`  ${u.username} (${u.role}) oluşturuldu`);
  }

  console.log(`\nTüm test hesaplarının şifresi: ${DEV_PASSWORD}`);
  console.log("Bu hesaplar 'dev-' ön ekiyle başlar; üretime asla gitmez.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
