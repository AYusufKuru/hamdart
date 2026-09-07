/**
 * Adım 12 — Docker slim, tools aşaması, otomatik migration, prisma.config.
 * Kullanım: node scripts/test-step12.mjs
 */
import { existsSync, readFileSync } from "node:fs";

let pass = 0;
let fail = 0;

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  GECTI  ${label}`);
  } else {
    fail++;
    console.log(`  BASARISIZ  ${label}`);
    if (detail !== undefined) console.log(`         gelen: ${JSON.stringify(detail)}`);
  }
}

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const entry = readFileSync(new URL("../docker-entrypoint.sh", import.meta.url), "utf8");
const compose = readFileSync(new URL("../docker-compose.prod.yml", import.meta.url), "utf8");
const install = readFileSync(new URL("../deploy/install-ubuntu.sh", import.meta.url), "utf8");
const envEx = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const deployEnv = readFileSync(new URL("../deploy/env.example", import.meta.url), "utf8");
const prismaCfg = existsSync(new URL("../prisma.config.ts", import.meta.url));

console.log("1) Imaj ve tools");
check("temel imaj bookworm-slim", dockerfile.includes("node:20-bookworm-slim"), "yok");
check("alpine yok", !dockerfile.includes("node:20-alpine"), dockerfile.match(/FROM .*/g));
check("tools asaması", /FROM base AS tools/.test(dockerfile), "yok");
check("runner'da npm install yok", !/FROM base AS runner[\s\S]*npm install/.test(dockerfile), "var");
check("postgresql-client", dockerfile.includes("postgresql-client"), "yok");
check("entrypoint kopyalanır", dockerfile.includes("docker-entrypoint.sh"), "yok");
check("nextjs kullanıcısı", dockerfile.includes("USER nextjs"), "yok");
check("deps ignore-scripts", dockerfile.includes("npm ci --ignore-scripts"), "yok");

console.log("\n2) Otomatik migration");
check("entrypoint migrate deploy", entry.includes("prisma migrate deploy"), "yok");
check("SKIP_MIGRATE", entry.includes("SKIP_MIGRATE"), "yok");
check("compose SKIP_MIGRATE", compose.includes("SKIP_MIGRATE"), "yok");
check("güncelleme up --build", install.includes("up -d --build"), "yok");
check("açılışta migration notu", install.includes("otomatik uygulanır"), "yok");

console.log("\n3) Prisma yapılandırma");
check("prisma.config.ts var", prismaCfg, "yok");
check("package.json prisma blogu yok", !/"prisma"\s*:\s*\{/.test(pkg), "hâlâ var");
check("binaryTargets debian", schema.includes("debian-openssl-3.0.x"), "yok");
check("binaryTargets native", schema.includes('"native"'), "yok");

console.log("\n4) env.example");
for (const key of [
  "DATABASE_URL",
  "AUTH_SECRET",
  "ADMIN_INITIAL_PASSWORD",
  "TZ",
  "BACKUP_DIR",
]) {
  check(`.env.example ${key}`, envEx.includes(key), "yok");
}
for (const key of [
  "POSTGRES_PASSWORD",
  "AUTH_SECRET",
  "ADMIN_INITIAL_PASSWORD",
  "BACKUP_HOST_DIR",
  "SKIP_MIGRATE",
]) {
  check(`deploy/env.example ${key}`, deployEnv.includes(key), "yok");
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
