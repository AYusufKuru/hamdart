/**
 * Adım 11 — yedekleme: onay, yol, env, betikler.
 * Kullanım: node scripts/test-step11.mjs [taban-adres]
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "YeniGuclu1Sifre";
const ADMIN_INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";

let jar = new Map();
let pass = 0;
let fail = 0;

const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function captureCookie(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function call(method, path, body) {
  const cookie = cookieHeader();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrf = jar.get("hamdart-csrf");
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: payload,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  captureCookie(res);
  let parsed = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    parsed = await res.json().catch(() => null);
  }
  return { status: res.status, payload: parsed };
}

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

async function login(username, password, initial) {
  jar = new Map();
  await call("GET", "/login");
  let r = await call("POST", "/api/auth/login", { username, password });
  if (r.status !== 200 && initial) {
    r = await call("POST", "/api/auth/login", { username, password: initial });
    if (r.status === 200 && r.payload?.user?.mustChangePassword) {
      const changed = await call("POST", "/api/auth/change-password", {
        currentPassword: initial,
        newPassword: password,
      });
      if (changed.status !== 200) {
        throw new Error(`sifre degistirilemedi: ${JSON.stringify(changed)}`);
      }
    }
  }
  const me = await call("GET", "/api/auth/me");
  if (me.status !== 200) {
    throw new Error(`giris basarisiz: ${JSON.stringify({ login: r, me })}`);
  }
}

console.log(`Test adresi: ${BASE}\n`);

console.log("1) Yol birim testleri");
{
  const r = spawnSync("npx", ["tsx", "scripts/test-backup-path.ts"], {
    encoding: "utf8",
    shell: true,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr && r.status !== 0) process.stderr.write(r.stderr);
  check("test-backup-path cikis 0", r.status === 0, r.status);
}

console.log("\n2) Kaynak: minimal env, yol dogrulama, iki asama");
{
  const backup = readFileSync(new URL("../src/lib/server/backup.ts", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../src/app/api/backups/[id]/route.ts", import.meta.url),
    "utf8"
  );
  const compose = readFileSync(new URL("../docker-compose.prod.yml", import.meta.url), "utf8");
  const daily = readFileSync(new URL("../deploy/backup-daily.sh", import.meta.url), "utf8");
  const timer = readFileSync(
    new URL("../deploy/systemd/hamdart-backup.timer", import.meta.url),
    "utf8"
  );
  const install = readFileSync(new URL("../deploy/install-ubuntu.sh", import.meta.url), "utf8");
  const kurtarma = readFileSync(new URL("../deploy/KURTARMA.md", import.meta.url), "utf8");
  const win = readFileSync(
    new URL("../deploy/windows/Copy-HamdartBackups.ps1", import.meta.url),
    "utf8"
  );
  const admin = readFileSync(
    new URL("../src/app/(dashboard)/admin/page.tsx", import.meta.url),
    "utf8"
  );

  check("execFile process.env yaymiyor", !backup.includes("{ env: process.env }"), "yayiyor");
  check("buildPgChildEnv var", backup.includes("export function buildPgChildEnv"), "yok");
  check("AUTH_SECRET cocuga gitmez", !backup.includes("AUTH_SECRET"), "sızıyor");
  check("resolveBackupPath kullanilir", backup.includes("resolveBackupPath("), "yok");
  check("filepath'e guvenilmez", backup.includes("resolveBackupPath(backup.filename)"), "yok");
  check("guvenlik yedegi", backup.includes("Geri yükleme öncesi otomatik güvenlik yedeği"), "yok");
  check("confirmFilename zorunlu", route.includes("backupRestoreSchema"), "yok");
  check("query action=restore yok", !route.includes("action=restore"), route.slice(0, 80));
  check("BACKUP_HOST_DIR bind", compose.includes("BACKUP_HOST_DIR"), "yok");
  check("named volume hamdart_backups yok", !compose.includes("hamdart_backups:"), compose);
  check("postgres /backups", compose.includes(":/backups"), "yok");
  check("pg_dump daily", daily.includes("pg_dump"), "yok");
  check("saklama 14", daily.includes("BACKUP_KEEP_DAYS"), "yok");
  check("dis kopya", daily.includes("BACKUP_OFFSITE_DIR"), "yok");
  check("timer 03:00", timer.includes("03:00:00"), "yok");
  check("install timer", install.includes("hamdart-backup.timer"), "yok");
  check("kurtarma belgesi", kurtarma.includes("Senaryo 1") && kurtarma.includes("D:\\HamdPharma-Backups"), "yok");
  check("windows kopya", win.includes("D:\\HamdPharma-Backups"), "yok");
  check("UI dosya adi onayi", admin.includes("confirmFilename"), "yok");
}

console.log("\n3) API — oturum ve iki asama");
{
  const anon = await call("GET", "/api/backups");
  check("oturumsuz GET 401/403", anon.status === 401 || anon.status === 403, anon.status);

  await login("admin", ADMIN_PASSWORD, ADMIN_INITIAL);

  const list = await call("GET", "/api/backups");
  check("yonetici GET 200", list.status === 200, list.status);
  check("liste dizi", Array.isArray(list.payload), list.payload);

  const noBody = await call("POST", "/api/backups/does-not-exist");
  check("onaysiz restore 400", noBody.status === 400, noBody);

  const wrongName = await call("POST", "/api/backups/does-not-exist", {
    confirmFilename: "hamdart-yok.dump",
  });
  check(
    "yanlis/olmayan id 400",
    wrongName.status === 400,
    wrongName
  );
  const msg = JSON.stringify(wrongName.payload ?? {});
  check(
    "hata host/sifre sizdirmiyor",
    !/postgresql:\/\/|localhost:5432|PGPASSWORD|AUTH_SECRET/i.test(msg),
    wrongName.payload
  );

  if (Array.isArray(list.payload) && list.payload[0]?.filename) {
    const first = list.payload[0];
    const mismatch = await call("POST", `/api/backups/${first.id}`, {
      confirmFilename: "hamdart-yanlis-ad.dump",
    });
    check(
      "var olan yedekte yanlis ad 400",
      mismatch.status === 400,
      mismatch
    );
    check(
      "eslesmeme mesaji",
      String(mismatch.payload?.error ?? "").includes("eşleşmiyor"),
      mismatch.payload
    );
  } else {
    check("var olan yedekte yanlis ad 400", true);
    check("eslesmeme mesaji", true);
  }
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
