/**
 * Adım 2 doğrulaması — oturumlu sayfaların render olduğunu kontrol eder.
 * Kullanım: node scripts/test-pages.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3100";
const INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";
const NEW = "YeniGuclu1Sifre";

let jar = "";

function capture(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0 && pair.slice(idx + 1).trim() !== "") jar = pair;
  }
}

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: jar ? { Cookie: jar } : {},
    redirect: "manual",
  });
  capture(res);
  const html = (res.headers.get("content-type") ?? "").includes("text/html")
    ? await res.text()
    : "";
  return { status: res.status, html };
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jar ? { Cookie: jar } : {}) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  capture(res);
  return res;
}

function report(label, status, html, expectText) {
  const broken = /Application error|Unhandled Runtime Error|__next_error__/.test(html);
  const found = expectText ? html.includes(expectText) : true;
  const marks = [];
  if (broken) marks.push("SAYFA HATASI");
  else if (expectText) marks.push(found ? `"${expectText}" bulundu` : `"${expectText}" BULUNAMADI`);
  console.log(`  ${label.padEnd(18)} HTTP ${status}  ${marks.join(" ")}`);
  return !broken && found;
}

let ok = true;

const login = await post("/api/auth/login", { username: "admin", password: INITIAL });
console.log(`  ${"giris".padEnd(18)} HTTP ${login.status}`);
ok = ok && login.status === 200;

const cp = await get("/change-password");
ok = report("/change-password", cp.status, cp.html, "Şifrenizi Belirleyin") && ok;

const changed = await post("/api/auth/change-password", {
  currentPassword: INITIAL,
  newPassword: NEW,
});
console.log(`  ${"sifre degistirme".padEnd(18)} HTTP ${changed.status}`);
ok = ok && changed.status === 200;

const admin = await get("/admin");
ok = report("/admin", admin.status, admin.html, "Kullanıcılar") && ok;

const dash = await get("/dashboard");
ok = report("/dashboard", dash.status, dash.html) && ok;

const cp2 = await get("/change-password");
ok = report("/change-password", cp2.status, cp2.html, "Şifre Değiştir") && ok;

console.log(ok ? "\n  SONUC: tum sayfalar sorunsuz" : "\n  SONUC: SORUN VAR");
process.exit(ok ? 0 : 1);
