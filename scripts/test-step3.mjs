/**
 * Adım 3 doğrulaması — kaba kuvvet, oturum iptali, CSRF, denetim limiti.
 * Kullanım: node scripts/test-step3.mjs [taban-adres]
 *
 * Önkoşul: admin hesabı mustChangePassword=false olmalı (test-auth-flow
 * çalıştıktan sonraki durum, veya .env şifresiyle giriş yapılıp değiştirilmiş).
 *
 * Bu betik kendi test kullanıcısını oluşturur ve siler.
 */
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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(mutating || body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  captureCookie(res);
  let payload = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    payload = await res.json().catch(() => null);
  }
  return {
    status: res.status,
    payload,
    location: res.headers.get("location"),
    retryAfter: res.headers.get("retry-after"),
  };
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

async function loginAsAdmin() {
  jar = new Map();
  await call("GET", "/login");
  let r = await call("POST", "/api/auth/login", {
    username: "admin",
    password: ADMIN_PASSWORD,
  });
  if (r.status !== 200) {
    r = await call("POST", "/api/auth/login", {
      username: "admin",
      password: ADMIN_INITIAL,
    });
    if (r.status === 200 && r.payload?.user?.mustChangePassword) {
      const changed = await call("POST", "/api/auth/change-password", {
        currentPassword: ADMIN_INITIAL,
        newPassword: ADMIN_PASSWORD,
      });
      if (changed.status !== 200) {
        throw new Error(`admin sifre degistirilemedi: ${JSON.stringify(changed)}`);
      }
    }
  }
  if (r.status !== 200 && r.payload?.user == null) {
    // ikinci deneme 200 olmayabilir çünkü ilk 200 oldu
    const me = await call("GET", "/api/auth/me");
    if (me.status !== 200) {
      throw new Error(`admin girisi basarisiz: ${JSON.stringify(r)}`);
    }
  }
}

console.log(`Test adresi: ${BASE}\n`);

console.log("1) CSRF olmadan durum degistiren istek reddedilir");
{
  jar = new Map();
  const noCookie = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "x" }),
    redirect: "manual",
  });
  check("CSRF cerezi yok -> 403", noCookie.status === 403, { status: noCookie.status });

  await call("GET", "/login");
  const csrf = jar.get("hamdart-csrf");
  const wrongHeader = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
      "x-csrf-token": "definitely-not-the-token",
    },
    body: JSON.stringify({ username: "admin", password: "x" }),
  });
  check("yanlis CSRF basligi -> 403", wrongHeader.status === 403, {
    status: wrongHeader.status,
    csrfVarMi: Boolean(csrf),
  });
}

console.log("\n2) Cikis oturum gerektirir");
{
  jar = new Map();
  await call("GET", "/login");
  const r = await call("POST", "/api/auth/logout");
  check("oturumsuz logout -> 401", r.status === 401, r);
}

console.log("\n3) Hesap kilidi (5 basarisiz deneme)");
{
  await loginAsAdmin();
  const created = await call("POST", "/api/users", {
    username: "kilit.test",
    name: "Kilit Deneme",
    role: "VIEWER",
    password: "GucluSifre123",
  });
  check("kilit test kullanicisi olusturuldu", created.status === 201, created);

  const adminJar = new Map(jar);
  jar = new Map();
  await call("GET", "/login");

  let last;
  for (let i = 1; i <= 5; i++) {
    last = await call("POST", "/api/auth/login", {
      username: "kilit.test",
      password: "YanlisSifre999",
    });
  }
  check("5. basarisiz deneme -> 429", last.status === 429, last);
  check("Retry-After basligi var", Number(last.retryAfter) > 0, last.retryAfter);

  const evenCorrect = await call("POST", "/api/auth/login", {
    username: "kilit.test",
    password: "GucluSifre123",
  });
  check("kilitliyken dogru sifre de -> 429", evenCorrect.status === 429, evenCorrect);

  jar = adminJar;
  if (created.payload?.id) {
    await call("DELETE", `/api/users/${created.payload.id}`);
  }
}

console.log("\n4) Olmayan kullanici 401 (hesap yok bilgisi sizmaz)");
{
  jar = new Map();
  await call("GET", "/login");
  const r = await call("POST", "/api/auth/login", {
    username: "asla.yok.olan",
    password: "YanlisSifre999",
  });
  check("olmayan kullanici -> 401", r.status === 401, r);
  check(
    "mesaj hesap varligini ele vermiyor",
    (r.payload?.error ?? "").includes("Geçersiz"),
    r.payload
  );
}

console.log("\n5) tokenVersion: hesap kapatilinca eski oturum dusar");
{
  await loginAsAdmin();
  const created = await call("POST", "/api/users", {
    username: "oturum.test",
    name: "Oturum Deneme",
    role: "VIEWER",
    password: "GucluSifre123",
  });
  check("oturum test kullanicisi olusturuldu", created.status === 201, created);

  const adminJar = new Map(jar);
  jar = new Map();
  await call("GET", "/login");
  const login = await call("POST", "/api/auth/login", {
    username: "oturum.test",
    password: "GucluSifre123",
  });
  check("test kullanici giris -> 200", login.status === 200, login);

  const changed = await call("POST", "/api/auth/change-password", {
    currentPassword: "GucluSifre123",
    newPassword: "KirmiziBalik12",
  });
  check("sifre degisti -> 200", changed.status === 200, changed);

  const meBefore = await call("GET", "/api/auth/me");
  check("kapatmadan once /me -> 200", meBefore.status === 200, meBefore);

  const victimCookie = new Map(jar);
  jar = adminJar;
  const closed = await call("PATCH", `/api/users/${created.payload.id}`, {
    active: false,
  });
  check("hesap kapatildi -> 200", closed.status === 200, closed);

  jar = victimCookie;
  const meAfter = await call("GET", "/api/auth/me");
  check("kapatilmis hesap /me -> 401", meAfter.status === 401, meAfter);

  jar = adminJar;
  await call("PATCH", `/api/users/${created.payload.id}`, { active: true });
  await call("DELETE", `/api/users/${created.payload.id}`);
}

console.log("\n6) Denetim kaydi limit tavanı");
{
  await loginAsAdmin();
  const r = await call("GET", "/api/audit?limit=999999");
  check("limit=999999 -> 200", r.status === 200, r);
  check(
    "en fazla 500 kayit doner",
    Array.isArray(r.payload) && r.payload.length <= 500,
    Array.isArray(r.payload) ? r.payload.length : r.payload
  );
}

console.log("\n7) CSRF ile login calisir");
{
  jar = new Map();
  await call("GET", "/login");
  const r = await call("POST", "/api/auth/login", {
    username: "admin",
    password: ADMIN_PASSWORD,
  });
  const ok = r.status === 200 || r.status === 429;
  check("CSRF'li login 200 veya kilit 429 (beklenen 200)", r.status === 200, r);
  if (!ok) {
    /* already counted */
  }
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
