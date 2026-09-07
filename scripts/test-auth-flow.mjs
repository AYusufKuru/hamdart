/**
 * Adım 2 doğrulaması — kimlik/şifre akışının uçtan uca testi.
 * Kullanım: node scripts/test-auth-flow.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3100";
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";
const NEW_PASSWORD = "YeniGuclu1Sifre";

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

async function call(method, path, body, opts = {}) {
  const cookie = cookieHeader();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrf = jar.get("hamdart-csrf");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined || mutating ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : mutating ? undefined : undefined,
    redirect: opts.redirect ?? "manual",
  });
  captureCookie(res);
  let payload = null;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    payload = await res.json().catch(() => null);
  }
  return { status: res.status, payload, location: res.headers.get("location") };
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

console.log(`Test adresi: ${BASE}\n`);

console.log("0) CSRF cerezi aliniyor");
{
  const r = await call("GET", "/login");
  check("GET /login CSRF cerezi verdi", Boolean(jar.get("hamdart-csrf")), {
    status: r.status,
    csrf: jar.get("hamdart-csrf") ? "var" : "yok",
  });
}

console.log("\n1) Oturumsuz erisim engelleniyor mu?");
{
  const r = await call("GET", "/dashboard");
  check("/dashboard -> /login yonlendirmesi", r.status === 307 && (r.location ?? "").includes("/login"), r);
  const api = await call("GET", "/api/users");
  check("/api/users oturumsuz -> 401", api.status === 401, api);
}

console.log("\n2) Yanlis sifre reddediliyor mu?");
{
  const r = await call("POST", "/api/auth/login", { username: "admin", password: "KesinlikleYanlis1" });
  check("yanlis sifre -> 401", r.status === 401, r);
  check("hata mesaji kullanici adi/sifre ayrimi yapmiyor", (r.payload?.error ?? "").length > 0, r.payload);
}

console.log("\n3) Dogru sifreyle giris");
{
  const r = await call("POST", "/api/auth/login", { username: "admin", password: ADMIN_PASSWORD });
  check("giris -> 200", r.status === 200, r);
  check("mustChangePassword = true", r.payload?.user?.mustChangePassword === true, r.payload);
  check("yanit passwordHash icermiyor", !JSON.stringify(r.payload ?? {}).includes("passwordHash"), r.payload);
}

console.log("\n4) Sifre degistirmeye zorlama calisiyor mu?");
{
  const page = await call("GET", "/dashboard");
  check("/dashboard -> /change-password yonlendirmesi", page.status === 307 && (page.location ?? "").includes("/change-password"), page);

  const api = await call("GET", "/api/users");
  check("/api/users -> 403 (sifre bekliyor)", api.status === 403, api);

  const orders = await call("GET", "/api/orders");
  check("/api/orders -> 403 (sifre bekliyor)", orders.status === 403, orders);

  const allowed = await call("GET", "/api/auth/me");
  check("/api/auth/me erisilebilir kaliyor", allowed.status === 200, allowed);
}

console.log("\n5) Sifre degistirme dogrulamalari");
{
  const wrongCurrent = await call("POST", "/api/auth/change-password", {
    currentPassword: "YanlisMevcut1",
    newPassword: NEW_PASSWORD,
  });
  check("mevcut sifre hatali -> 400", wrongCurrent.status === 400, wrongCurrent);

  const weak = await call("POST", "/api/auth/change-password", {
    currentPassword: ADMIN_PASSWORD,
    newPassword: "kisa1",
  });
  check("zayif yeni sifre -> 400", weak.status === 400, weak);

  const same = await call("POST", "/api/auth/change-password", {
    currentPassword: ADMIN_PASSWORD,
    newPassword: ADMIN_PASSWORD,
  });
  check("yeni sifre mevcutla ayni -> 400", same.status === 400, same);

  const containsUsername = await call("POST", "/api/auth/change-password", {
    currentPassword: ADMIN_PASSWORD,
    newPassword: "Admin123456789",
  });
  check("sifre kullanici adini iceriyor -> 400", containsUsername.status === 400, containsUsername);
}

console.log("\n6) Gecerli sifre degistirme");
{
  const r = await call("POST", "/api/auth/change-password", {
    currentPassword: ADMIN_PASSWORD,
    newPassword: NEW_PASSWORD,
  });
  check("sifre degistirme -> 200", r.status === 200, r);

  const me = await call("GET", "/api/auth/me");
  check("mustChangePassword = false", me.payload?.user?.mustChangePassword === false, me.payload);

  const users = await call("GET", "/api/users");
  check("/api/users artik erisilebilir -> 200", users.status === 200, users);
}

console.log("\n7) Kullanici yonetimi");
let createdId = null;
{
  const weak = await call("POST", "/api/users", {
    username: "test.depo", name: "Test Depo", role: "WAREHOUSE", password: "zayif",
  });
  check("zayif sifreyle kullanici olusturma -> 400", weak.status === 400, weak);

  const badRole = await call("POST", "/api/users", {
    username: "test.depo", name: "Test Depo", role: "SUPERUSER", password: "GucluSifre123",
  });
  check("gecersiz rol -> 400", badRole.status === 400, badRole);

  const badUsername = await call("POST", "/api/users", {
    username: "Test Depo!", name: "Test Depo", role: "WAREHOUSE", password: "GucluSifre123",
  });
  check("gecersiz kullanici adi -> 400", badUsername.status === 400, badUsername);

  const ok = await call("POST", "/api/users", {
    username: "test.depo", name: "Test Depo Sorumlusu", role: "WAREHOUSE", password: "GucluSifre123",
  });
  check("gecerli kullanici olusturma -> 201", ok.status === 201, ok);
  check("yeni kullanici mustChangePassword = true", ok.payload?.mustChangePassword === true, ok.payload);
  check("yanit passwordHash icermiyor", !JSON.stringify(ok.payload ?? {}).includes("passwordHash"), ok.payload);
  createdId = ok.payload?.id ?? null;

  const dup = await call("POST", "/api/users", {
    username: "test.depo", name: "Kopya", role: "VIEWER", password: "GucluSifre123",
  });
  check("ayni kullanici adi tekrar -> 400", dup.status === 400, dup);

  const list = await call("GET", "/api/users");
  check("kullanici listesi passwordHash icermiyor", !JSON.stringify(list.payload ?? {}).includes("passwordHash"), null);
}

console.log("\n8) Kendini kilitleme korumalari");
{
  const me = await call("GET", "/api/auth/me");
  const myId = me.payload?.user?.userId;

  const selfRole = await call("PATCH", `/api/users/${myId}`, { role: "VIEWER" });
  check("kendi rolunu degistirme -> 400", selfRole.status === 400, selfRole);

  const selfDeactivate = await call("PATCH", `/api/users/${myId}`, { active: false });
  check("kendi hesabini kapatma -> 400", selfDeactivate.status === 400, selfDeactivate);

  const selfDelete = await call("DELETE", `/api/users/${myId}`);
  check("kendi hesabini silme -> 400", selfDelete.status === 400, selfDelete);
}

console.log("\n9) Yetkisiz rol yonetim API'sine erisemiyor");
{
  const adminJar = new Map(jar);

  // Olusturulan depo kullanicisi once sifresini degistirmek zorunda
  jar = new Map();
  await call("GET", "/login");
  const login = await call("POST", "/api/auth/login", { username: "test.depo", password: "GucluSifre123" });
  check("yeni kullanici giris -> 200", login.status === 200, login);
  check("yeni kullanici mustChangePassword = true", login.payload?.user?.mustChangePassword === true, login.payload);

  // Sifre kullanici adini/adini icermemeli — bu yuzden ilgisiz bir sifre
  const changed = await call("POST", "/api/auth/change-password", {
    currentPassword: "GucluSifre123",
    newPassword: "KirmiziBalik12",
  });
  check("yeni kullanici sifresini degistirdi -> 200", changed.status === 200, changed);

  const users = await call("GET", "/api/users");
  check("WAREHOUSE rolu /api/users -> 403", users.status === 403, users);

  const create = await call("POST", "/api/users", {
    username: "yetkisiz.deneme", name: "Yetkisiz", role: "ADMIN", password: "GucluSifre123",
  });
  check("WAREHOUSE rolu kullanici olusturamaz -> 403", create.status === 403, create);

  const audit = await call("GET", "/api/audit");
  check("WAREHOUSE rolu /api/audit -> 403", audit.status === 403, audit);

  jar = adminJar;
}

console.log("\n10) Son aktif yonetici korumasi");
{
  // Ortamda kac yonetici oldugundan bagimsiz olmasi icin kendi yoneticisini olusturur
  const second = await call("POST", "/api/users", {
    username: "ikinci.admin", name: "Ikinci Yonetici", role: "ADMIN", password: "GucluSifre123",
  });
  check("ikinci yonetici olusturuldu -> 201", second.status === 201, second);

  const deactivate = await call("PATCH", `/api/users/${second.payload?.id}`, { active: false });
  check("baska bir yonetici kapatilabildi -> 200", deactivate.status === 200, deactivate);

  const del = await call("DELETE", `/api/users/${second.payload?.id}`);
  check("baska bir yonetici silinebildi -> 200", del.status === 200, del);

  const list = await call("GET", "/api/users");
  const rows = Array.isArray(list.payload) ? list.payload : [];
  const admins = rows.filter((u) => u.role === "ADMIN" && u.active);
  check("sistemde en az bir aktif yonetici kaldi", admins.length >= 1, admins.map((a) => a.username));
}

console.log("\n11) Temizlik");
{
  if (createdId) {
    const del = await call("DELETE", `/api/users/${createdId}`);
    check("test kullanicisi silindi", del.status === 200, del);
  }
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
