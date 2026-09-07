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

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/** Şifreler bilinçli olarak basit — sadece yerel geliştirme içindir */
const DEV_USERS = [
  { username: "dev-mudur", name: "Test Genel Müdür", role: "MANAGER" },
  { username: "dev-uretim", name: "Test Üretim Operatörü", role: "PRODUCTION" },
  { username: "dev-depo", name: "Test Depo Sorumlusu", role: "WAREHOUSE" },
  { username: "dev-lab", name: "Test Laboratuvar Uzmanı", role: "LAB" },
  { username: "dev-ticari", name: "Test Ticari Müdür", role: "COMMERCIAL" },
  { username: "dev-izleyici", name: "Test İzleyici", role: "VIEWER" },
  { username: "dev-admin", name: "Test Yönetici", role: "ADMIN" },
];

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
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_ROUNDS);

  for (const u of DEV_USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: u.username },
    });
    if (existing) {
      console.log(`  ${u.username}: zaten mevcut, atlandı`);
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
