/**
 * Adım 10 — sağlık, TZ, Docker limit / log.
 * Kullanım: node scripts/test-step10.mjs [taban-adres]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";

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

console.log(`Test adresi: ${BASE}\n`);

console.log("1) GET /api/health — kimlik yok, sızdırma yok");
{
  const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
  const body = await res.json().catch(() => null);
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  check("GET /api/health -> 200", res.status === 200, res.status);
  check("govde { ok: true }", body?.ok === true, body);
  check("yalnizca ok alani", keys.length === 1 && keys[0] === "ok", keys);
  const cache = res.headers.get("cache-control") ?? "";
  check("Cache-Control no-store", cache.includes("no-store"), cache);
  const text = JSON.stringify(body);
  check(
    "surum/host/db yok",
    !/version|postgres|localhost|DATABASE|error/i.test(text),
    body
  );
}

console.log("\n2) Takvim kuşağı Europe/Istanbul");
{
  const utils = readFileSync(new URL("../src/lib/utils.ts", import.meta.url), "utf8");
  check("APP_TIME_ZONE sabiti", utils.includes('APP_TIME_ZONE = "Europe/Istanbul"'), "yok");
  check("todayIso Intl kullanır", utils.includes('timeZone: APP_TIME_ZONE'), "yok");
  const istanbulDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  check("Istanbul gunu YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(istanbulDay), istanbulDay);
}

console.log("\n3) docker-compose.prod.yml");
{
  const compose = readFileSync(new URL("../docker-compose.prod.yml", import.meta.url), "utf8");
  check("app healthcheck /api/health", compose.includes("/api/health"), "yok");
  check("TZ Europe/Istanbul", compose.includes("TZ: Europe/Istanbul"), "yok");
  check("PGTZ", compose.includes("PGTZ: Europe/Istanbul"), "yok");
  check("log max-size 10m", compose.includes('max-size: "10m"'), "yok");
  check("log max-file 5", compose.includes('max-file: "5"'), "yok");
  check("shared_buffers", compose.includes("shared_buffers="), "yok");
  check("app mem_limit", compose.includes("mem_limit: 2g"), "yok");
  check("postgres mem_limit", compose.includes("mem_limit: 6g"), "yok");
  check("autoheal etiketi", compose.includes("autoheal:"), "yok");
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
