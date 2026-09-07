/**
 * Adım 6 — katmanlı yetkilendirme: proxy, varsayılan ret, canlı oturum, aktör.
 * Kullanım: node scripts/test-step6.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "YeniGuclu1Sifre";
const ADMIN_INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";
const DEV_PASSWORD = "GelistirmeTest1";

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

async function call(method, path, body, extraHeaders = {}) {
  const cookie = cookieHeader();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrf = jar.get("hamdart-csrf");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(mutating || body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  captureCookie(res);
  let payload = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    payload = await res.json().catch(() => null);
  }
  return {
    status: res.status,
    payload,
    cache: res.headers.get("cache-control"),
    location: res.headers.get("location"),
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

async function login(username, password, changeIfRequired = true) {
  jar = new Map();
  await call("GET", "/login");
  const r = await call("POST", "/api/auth/login", { username, password });
  if (r.status === 200 && r.payload?.user?.mustChangePassword && changeIfRequired) {
    const changed = await call("POST", "/api/auth/change-password", {
      currentPassword: password,
      newPassword: ADMIN_PASSWORD,
    });
    if (changed.status !== 200) {
      throw new Error(`sifre degistirilemedi (${username}): ${JSON.stringify(changed)}`);
    }
  }
  return r;
}

async function loginAsAdmin() {
  let r = await login("admin", ADMIN_PASSWORD, false);
  if (r.status !== 200) {
    r = await login("admin", ADMIN_INITIAL, true);
  }
  const me = await call("GET", "/api/auth/me");
  if (me.status !== 200) {
    throw new Error(`admin girisi basarisiz: ${JSON.stringify(r)}`);
  }
}

console.log(`Test adresi: ${BASE}\n`);

console.log("1) Varsayilan reddet — bilinmeyen API");
{
  jar = new Map();
  await call("GET", "/login");
  const anon = await call("GET", "/api/definitely-not-a-route");
  check("oturumsuz bilinmeyen API -> 401", anon.status === 401, anon);

  await loginAsAdmin();
  const knownDeny = await call("GET", "/api/definitely-not-a-route");
  check("oturumlu bilinmeyen API -> 403", knownDeny.status === 403, knownDeny);

  const catalog = await call("GET", "/api/catalog/secret-entity");
  check("bilinmeyen katalog -> 403", catalog.status === 403, catalog);
}

console.log("\n2) Rol yetkisi — LAB siparise erisemez");
{
  const lab = await login("dev-lab", DEV_PASSWORD, false);
  check("dev-lab giris -> 200", lab.status === 200, lab);

  const orders = await call("GET", "/api/orders");
  check("LAB GET /api/orders -> 403", orders.status === 403, orders);

  const labOk = await call("GET", "/api/lab/experiments");
  check("LAB GET /api/lab/experiments -> 200", labOk.status === 200, labOk);

  const write = await call("POST", "/api/orders", {
    customer: "X",
    product: "Y",
    quantity: 1,
    unit: "adet",
    status: "pending",
    orderDate: "2026-09-07",
    deliveryDate: "2026-09-10",
    priority: "normal",
    warehouse: "wh-fabrika",
    value: 1,
  });
  check("LAB POST /api/orders -> 403", write.status === 403, write);
}

console.log("\n3) Aktör başlığı yok sayılır");
{
  await loginAsAdmin();
  const created = await call(
    "POST",
    "/api/orders",
    {
      customer: "aktor-test",
      product: "Test",
      quantity: 1,
      unit: "adet",
      status: "pending",
      orderDate: "2026-09-07",
      deliveryDate: "2026-09-10",
      priority: "normal",
      warehouse: "wh-fabrika",
      value: 1,
    },
    { "x-hamdart-actor": "Saldirgan", "x-actor-name": "Saldirgan" }
  );
  check("siparis olusturma -> 201", created.status === 201, created);

  const audit = await call(
    "GET",
    `/api/audit?entityType=Order&entityId=${encodeURIComponent(created.payload?.id ?? "")}&limit=5`
  );
  const row = Array.isArray(audit.payload) ? audit.payload[0] : null;
  check("denetim kaydı var", Boolean(row), audit.payload);
  check(
    "aktör oturum adı (başlık değil)",
    row?.actor === "Sistem Yöneticisi",
    row?.actor
  );
  check("başlık değeri yazılmadı", row?.actor !== "Saldirgan", row?.actor);
}

console.log("\n4) İptal oturum route'ta kesilir");
{
  await loginAsAdmin();
  const created = await call("POST", "/api/users", {
    username: "step6.oturum",
    name: "Step6 Oturum",
    role: "VIEWER",
    password: "GucluSifre123",
  });
  check("test kullanicisi -> 201", created.status === 201, created);

  const adminJar = new Map(jar);
  const loginR = await login("step6.oturum", "GucluSifre123", true);
  check("test kullanici giris -> 200", loginR.status === 200, loginR);
  const victimJar = new Map(jar);

  jar = adminJar;
  const closed = await call("PATCH", `/api/users/${created.payload.id}`, {
    active: false,
  });
  check("hesap kapatildi -> 200", closed.status === 200, closed);

  jar = victimJar;
  const orders = await call("GET", "/api/orders");
  check("kapatilmis hesap GET /api/orders -> 401", orders.status === 401, orders);

  jar = adminJar;
  await call("PATCH", `/api/users/${created.payload.id}`, { active: true });
  await call("DELETE", `/api/users/${created.payload.id}`);
}

console.log("\n5) Cache-Control no-store");
{
  await loginAsAdmin();
  const users = await call("GET", "/api/users");
  check("GET /api/users -> 200", users.status === 200, users);
  check(
    "users Cache-Control no-store",
    (users.cache ?? "").includes("no-store"),
    users.cache
  );

  const orders = await call("GET", "/api/orders");
  check(
    "orders Cache-Control no-store",
    (orders.cache ?? "").includes("no-store"),
    orders.cache
  );

  const me = await call("GET", "/api/auth/me");
  check(
    "me Cache-Control no-store",
    (me.cache ?? "").includes("no-store"),
    me.cache
  );
}

console.log("\n6) Login halka acik kalir");
{
  jar = new Map();
  await call("GET", "/login");
  const r = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "yanlis-sifre-adim6",
  });
  check("yanlis sifre -> 401 (403 degil)", r.status === 401, r);
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
