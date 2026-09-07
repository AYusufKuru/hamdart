/**
 * Adım 7 — güvenlik başlıkları.
 * Kullanım: node scripts/test-step7.mjs [taban-adres]
 */
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

console.log("1) Sayfa yanıtı — zorunlu başlıklar");
{
  const res = await fetch(`${BASE}/login`, { redirect: "manual" });
  const headers = Object.fromEntries(res.headers.entries());
  const csp = res.headers.get("content-security-policy") ?? "";
  const html = await res.text();

  check("GET /login -> 200", res.status === 200, res.status);
  check("X-Frame-Options DENY", res.headers.get("x-frame-options") === "DENY", headers["x-frame-options"]);
  check(
    "X-Content-Type-Options nosniff",
    res.headers.get("x-content-type-options") === "nosniff",
    headers["x-content-type-options"]
  );
  check(
    "Referrer-Policy",
    res.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
    headers["referrer-policy"]
  );
  const permissions = res.headers.get("permissions-policy") ?? "";
  check("Permissions-Policy kamera kapalı", permissions.includes("camera=()"), permissions);
  check("Permissions-Policy mikrofon kapalı", permissions.includes("microphone=()"), permissions);
  check("Permissions-Policy konum kapalı", permissions.includes("geolocation=()"), permissions);
  check(
    "X-Accel-Buffering no",
    res.headers.get("x-accel-buffering") === "no",
    headers["x-accel-buffering"]
  );
  check("X-Powered-By yok", !res.headers.has("x-powered-by"), headers["x-powered-by"]);
  check("CSP var", csp.length > 0, csp);
  check("CSP nonce içerir", /'nonce-[^']+'/.test(csp), csp);
  check("CSP frame-ancestors none", csp.includes("frame-ancestors 'none'"), csp);
  check("CSP object-src none", csp.includes("object-src 'none'"), csp);
  check("HTML'de script nonce", /<script[^>]+nonce=/.test(html), html.includes("nonce=") ? "nonce var" : "nonce yok");
}

console.log("\n2) API yanıtı — no-store + nosniff");
{
  const res = await fetch(`${BASE}/api/orders`, { redirect: "manual" });
  check("oturumsuz /api/orders -> 401", res.status === 401, res.status);
  check(
    "API nosniff",
    res.headers.get("x-content-type-options") === "nosniff",
    res.headers.get("x-content-type-options")
  );
  check(
    "API X-Frame-Options",
    res.headers.get("x-frame-options") === "DENY",
    res.headers.get("x-frame-options")
  );
  const cache = res.headers.get("cache-control") ?? "";
  check("API Cache-Control no-store", cache.includes("no-store"), cache);
}

console.log("\n3) Geliştirmede HSTS yok (localhost HTTP)");
{
  const res = await fetch(`${BASE}/login`, { redirect: "manual" });
  const hsts = res.headers.get("strict-transport-security");
  check("dev'de HSTS gönderilmez", hsts === null, hsts);
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
